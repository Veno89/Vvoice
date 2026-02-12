use crate::auth_service::{authenticate_or_register, AuthDecision};
use crate::chat_service::handle_chat_packet;
use crate::codec::{
    MumblePacket, ServerSync, TextMessage, UserRemove, UserState, Version,
};
use crate::connection::Connection;
use crate::db::Database;
use crate::session_service::process_user_state_update;
use crate::state::{Peer, SharedState, Tx};
use crate::voice_service::process_voice_packet;
use anyhow::Result;
use futures::StreamExt;
use std::sync::Arc;
use tokio::net::TcpStream;
use tokio::sync::{mpsc, Mutex};
use tokio_rustls::server::TlsStream;
use tracing::{error, info};

fn broadcast(packet: MumblePacket, recipients: &[Tx]) {
    for recipient in recipients {
        let _ = recipient.try_send(packet.clone());
    }
}

async fn perform_handshake(
    connection: &mut Connection,
    db: &Database,
) -> Result<String> {
    let peer_addr = connection.peer_addr();

    if let Some(MumblePacket::Version(v)) = connection.read_packet().await? {
        info!(
            "Client {} Version: {:?} OS: {:?}",
            peer_addr, v.version, v.os
        );
    } else {
        anyhow::bail!("Expected Version packet");
    }

    if let Some(MumblePacket::Authenticate(auth)) = connection.read_packet().await? {
        match authenticate_or_register(db, auth).await? {
            AuthDecision::Accepted { username } => {
                info!("Client {} authenticated as: {:?}", peer_addr, username);
                Ok(username)
            }
            AuthDecision::Rejected(reject) => {
                let reason = reject
                    .reason
                    .clone()
                    .unwrap_or_else(|| "Authentication rejected".to_string());
                connection.write_packet(MumblePacket::Reject(reject)).await?;
                anyhow::bail!("Authentication failed for {}: {}", peer_addr, reason);
            }
        }
    } else {
        anyhow::bail!("Expected Authenticate packet");
    }
}

async fn setup_session(
    state: &Arc<Mutex<SharedState>>,
    db: &Database,
    username: &str,
) -> (u32, Tx, mpsc::Receiver<MumblePacket>) {
    let (tx, rx) = mpsc::channel(256);
    let session_id;

    // Fetch user profile
    let db_user = db.get_user_by_username(username).await.unwrap_or(None);
    let (avatar, bio) = if let Some(u) = db_user {
        (u.avatar_url, u.bio)
    } else {
        (None, None)
    };

    {
        let mut s = state.lock().await;

        session_id = s.next_session_id;
        s.next_session_id += 1;

        info!("Assigned Session ID {} to {}", session_id, username);

        let mut new_user_msg = UserState::default();
        new_user_msg.session = Some(session_id);
        new_user_msg.name = Some(username.to_string());
        new_user_msg.user_id = Some(session_id);
        new_user_msg.channel_id = Some(0);
        new_user_msg.avatar_url = avatar.clone();
        new_user_msg.comment = bio.clone();

        for peer in s.peers.values() {
            let mut existing_user = UserState::default();
            existing_user.session = Some(peer.session_id);
            existing_user.name = Some(peer.username.clone());
            existing_user.channel_id = Some(peer.channel_id);
            existing_user.self_mute = Some(peer.self_mute);
            existing_user.self_deaf = Some(peer.self_deaf);
            existing_user.avatar_url = peer.avatar_url.clone();
            existing_user.comment = peer.bio.clone();
            
            let _ = tx.try_send(MumblePacket::UserState(existing_user));

            let _ = peer
                .tx
                .try_send(MumblePacket::UserState(new_user_msg.clone()));
        }

        s.add_peer(
            session_id,
            Peer {
                tx: tx.clone(),
                username: username.to_string(),
                session_id,
                channel_id: 0,
                self_mute: false,
                self_deaf: false,
                echo_enabled: false,
                avatar_url: avatar,
                bio: bio,
            },
        );
    }

    (session_id, tx, rx)
}

async fn send_initial_state(
    connection: &mut Connection,
    state: &Arc<Mutex<SharedState>>,
    db: &Database,
    username: &str,
    session_id: u32,
) -> Result<()> {
    let mut version = Version::default();
    version.version = Some(1 << 16 | 3 << 8 | 0);
    connection.write_packet(MumblePacket::Version(version)).await?;

    {
        let s = state.lock().await;
        let mut channels: Vec<_> = s.channels.values().cloned().collect();
        channels.sort_by_key(|c| c.channel_id.unwrap_or(0));

        info!("Sent {} channels to {}", channels.len(), username);
        for channel in channels {
            connection.write_packet(MumblePacket::ChannelState(channel)).await?;
        }
    }

    let mut self_state = UserState::default();
    self_state.session = Some(session_id);
    self_state.name = Some(username.to_string());
    self_state.user_id = Some(session_id);
    self_state.channel_id = Some(0);
    connection.write_packet(MumblePacket::UserState(self_state)).await?;

    let mut sync = ServerSync::default();
    sync.session = Some(session_id);
    sync.max_bandwidth = Some(128000);
    sync.welcome_text =
        Some("Welcome to Vvoice Rust Server! Type /echo to toggle loopback.".into());
    connection.write_packet(MumblePacket::ServerSync(sync)).await?;

    if let Ok(recent) = db.get_recent_messages(0, 50).await {
        for msg in recent {
            let mut text = TextMessage::default();
            text.message = format!("[History] {}: {}", msg.sender_name, msg.content);
            text.session = vec![session_id];
            if let Some(created_at) = msg.created_at {
                text.timestamp = Some(created_at.timestamp() as u64);
            }
            connection.write_packet(MumblePacket::TextMessage(text)).await?;
        }
    }

    Ok(())
}

async fn handle_incoming_packet(
    packet: MumblePacket,
    tx: &Tx,
    state: &Arc<Mutex<SharedState>>,
    db: &Database,
    username: &str,
    session_id: u32,
) {
    match packet {
        MumblePacket::Ping(p) => {
            let _ = tx.try_send(MumblePacket::Ping(p));
        }
        MumblePacket::UDPTunnel(msg) => {
            process_voice_packet(state, session_id, msg).await;
        }
        MumblePacket::TextMessage(msg) => {
            handle_chat_packet(state, db, tx, session_id, username, msg).await;
        }
        MumblePacket::UserState(state_update) => {
            // Save profile updates to DB
            if state_update.avatar_url.is_some() || state_update.comment.is_some() {
                 let _ = db.update_user_profile(
                     username, 
                     state_update.avatar_url.clone(), 
                     state_update.comment.clone()
                 ).await;
            }

            let session_update = {
                let mut s = state.lock().await;
                process_user_state_update(&mut s, session_id, username, state_update)
            };

            if let Some(update) = session_update.channel_update {
                broadcast(MumblePacket::UserState(update.clone()), &session_update.recipients);

                // Send history for the new channel
                if let Some(chan_id) = update.channel_id {
                    let db_clone = db.clone();
                    let tx_clone = tx.clone();
                    let session_id_copy = session_id;
                    
                    // Spawn to avoid blocking the handler loop with DB calls
                    tokio::spawn(async move {
                         if let Ok(recent) = db_clone.get_recent_messages(chan_id as i32, 50).await {
                             for msg in recent {
                                 let mut text = TextMessage::default();
                                 text.message = format!("[History] {}: {}", msg.sender_name, msg.content);
                                 text.session = vec![session_id_copy];
                                 if let Some(created_at) = msg.created_at {
                                     text.timestamp = Some(created_at.timestamp() as u64);
                                 }
                                 let _ = tx_clone.try_send(MumblePacket::TextMessage(text));
                             }
                         }
                    });
                }
            }

            if let Some(update) = session_update.state_delta {
                broadcast(MumblePacket::UserState(update), &session_update.recipients);
            }
        }
        _ => {}
    }
}

async fn cleanup_session(state: &Arc<Mutex<SharedState>>, session_id: u32) {
    let mut s = state.lock().await;
    s.remove_peer(session_id);
    info!("Cleaned up session {}", session_id);

    let mut remove_msg = UserRemove::default();
    remove_msg.session = session_id;

    for peer in s.peers.values() {
        let _ = peer
            .tx
            .try_send(MumblePacket::UserRemove(remove_msg.clone()));
    }
}

pub async fn handle_client(
    stream: TlsStream<TcpStream>,
    state: Arc<Mutex<SharedState>>,
    peer_addr: std::net::SocketAddr,
    db: Database,
) -> Result<()> {
    let mut connection = Connection::new(stream, peer_addr);

    let username = perform_handshake(&mut connection, &db).await?;
    let (session_id, tx, mut rx) = setup_session(&state, &db, &username).await;
    send_initial_state(&mut connection, &state, &db, &username, session_id).await?;

    loop {
        tokio::select! {
            msg = rx.recv() => {
                match msg {
                    Some(packet) => {
                        if let Err(e) = connection.write_packet(packet).await {
                             error!("Failed to send packet to {}: {}", username, e);
                             break;
                        }
                    }
                    None => break,
                }
            }
            packet = connection.read_packet() => {
                 match packet {
                    Ok(Some(pkt)) => {
                        handle_incoming_packet(pkt, &tx, &state, &db, &username, session_id).await;
                    }
                    Ok(None) => {
                        // Connection closed cleanly
                        break;
                    }
                    Err(e) => {
                        error!("Connection error from {}: {}", username, e);
                        break;
                    }
                 }
            }
        }
    }

    cleanup_session(&state, session_id).await;

    Ok(())
}
