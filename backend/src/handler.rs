use crate::auth_service::{authenticate_or_register, AuthDecision};
use crate::codec::{
    MumbleCodec, MumblePacket, ServerSync, TextMessage, UserRemove, UserState, Version,
};
use crate::db::Database;
use crate::packet_dispatch::handle_incoming_packet;
use crate::state::{try_send_packet, Peer, SharedState, Tx};
use anyhow::Result;
use futures::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::net::TcpStream;
use tokio::sync::{mpsc, Mutex};
use tokio_rustls::server::TlsStream;
use tokio_util::codec::Framed;
use tracing::{error, info};

type ServerFramed = Framed<TlsStream<TcpStream>, MumbleCodec>;

fn broadcast(packet: MumblePacket, recipients: &[Tx]) {
    for recipient in recipients {
        try_send_packet(recipient, packet.clone(), "handler_broadcast");
    }
}

async fn perform_handshake(
    framed: &mut ServerFramed,
    db: &Database,
    peer_addr: std::net::SocketAddr,
) -> Result<String> {
    if let Some(Ok(MumblePacket::Version(v))) = framed.next().await {
        info!(
            "Client {} Version: {:?} OS: {:?}",
            peer_addr, v.version, v.os
        );
    } else {
        anyhow::bail!("Expected Version packet");
    }

    if let Some(Ok(MumblePacket::Authenticate(auth))) = framed.next().await {
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
                framed.send(MumblePacket::Reject(reject)).await?;
                anyhow::bail!("Authentication failed for {}: {}", peer_addr, reason);
            }
        }
    } else {
        anyhow::bail!("Expected Authenticate packet");
    }
}

async fn setup_session(
    state: &Arc<Mutex<SharedState>>,
    username: &str,
) -> (u32, Tx, mpsc::Receiver<MumblePacket>) {
    let (tx, rx) = mpsc::channel(256);
    let session_id;

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

        for peer in s.peers.values() {
            let mut existing_user = UserState::default();
            existing_user.session = Some(peer.session_id);
            existing_user.name = Some(peer.username.clone());
            existing_user.channel_id = Some(peer.channel_id);
            existing_user.self_mute = Some(peer.self_mute);
            existing_user.self_deaf = Some(peer.self_deaf);
            try_send_packet(
                &tx,
                MumblePacket::UserState(existing_user),
                "session_existing_user",
            );

            try_send_packet(
                &peer.tx,
                MumblePacket::UserState(new_user_msg.clone()),
                "session_new_user_announce",
            );
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
            },
        );
    }

    (session_id, tx, rx)
}

async fn send_initial_state(
    framed: &mut ServerFramed,
    state: &Arc<Mutex<SharedState>>,
    db: &Database,
    username: &str,
    session_id: u32,
) -> Result<()> {
    let mut version = Version::default();
    version.version = Some(1 << 16 | 3 << 8 | 0);
    framed.send(MumblePacket::Version(version)).await?;

    {
        let s = state.lock().await;
        let mut channels: Vec<_> = s.channels.values().cloned().collect();
        channels.sort_by_key(|c| c.channel_id.unwrap_or(0));

        info!("Sent {} channels to {}", channels.len(), username);
        for channel in channels {
            framed.send(MumblePacket::ChannelState(channel)).await?;
        }
    }

    let mut self_state = UserState::default();
    self_state.session = Some(session_id);
    self_state.name = Some(username.to_string());
    self_state.user_id = Some(session_id);
    self_state.channel_id = Some(0);
    framed.send(MumblePacket::UserState(self_state)).await?;

    let mut sync = ServerSync::default();
    sync.session = Some(session_id);
    sync.max_bandwidth = Some(128000);
    sync.welcome_text =
        Some("Welcome to Vvoice Rust Server! Type /echo to toggle loopback.".into());
    framed.send(MumblePacket::ServerSync(sync)).await?;

    if let Ok(recent) = db.get_recent_messages(0, 50).await {
        for msg in recent {
            let mut text = TextMessage::default();
            text.message = format!("[History] {}: {}", msg.sender_name, msg.content);
            text.session = vec![session_id];
            if let Some(created_at) = msg.created_at {
                text.timestamp = Some(created_at.timestamp() as u64);
            }
            framed.send(MumblePacket::TextMessage(text)).await?;
        }
    }

    Ok(())
}

async fn cleanup_session(state: &Arc<Mutex<SharedState>>, session_id: u32) {
    let mut s = state.lock().await;
    s.remove_peer(session_id);
    info!("Cleaned up session {}", session_id);

    let mut remove_msg = UserRemove::default();
    remove_msg.session = session_id;

    for peer in s.peers.values() {
        try_send_packet(
            &peer.tx,
            MumblePacket::UserRemove(remove_msg.clone()),
            "cleanup_user_remove",
        );
    }
}

pub async fn handle_client(
    stream: TlsStream<TcpStream>,
    state: Arc<Mutex<SharedState>>,
    peer_addr: std::net::SocketAddr,
    db: Database,
) -> Result<()> {
    let mut framed = Framed::new(stream, MumbleCodec);

    let username = perform_handshake(&mut framed, &db, peer_addr).await?;
    let (session_id, tx, mut rx) = setup_session(&state, &username).await;
    send_initial_state(&mut framed, &state, &db, &username, session_id).await?;

    loop {
        tokio::select! {
            msg = rx.recv() => {
                match msg {
                    Some(packet) => {
                        if let Err(e) = framed.send(packet).await {
                             error!("Failed to send packet to {}: {}", username, e);
                             break;
                        }
                    }
                    None => break,
                }
            }
            packet = framed.next() => {
                 match packet {
                    Some(Ok(pkt)) => {
                        handle_incoming_packet(pkt, &tx, &state, &db, &username, session_id).await;
                    }
                    Some(Err(e)) => {
                        error!("Connection error from {}: {}", username, e);
                        break;
                    }
                    None => break,
                 }
            }
        }
    }

    cleanup_session(&state, session_id).await;

    Ok(())
}
