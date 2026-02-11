use crate::chat_service::{process_text_message, ChatHandling};
use crate::codec::{
    MumbleCodec, MumblePacket, Reject, ServerSync, TextMessage, UserRemove, UserState, Version,
};
use crate::db::Database;
use crate::state::{Peer, SharedState, Tx};
use crate::voice_router::collect_voice_recipients;
use anyhow::Result;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use futures::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::net::TcpStream;
use tokio::sync::{mpsc, Mutex};
use tokio_rustls::server::TlsStream;
use tokio_util::codec::Framed;
use tracing::{error, info};

fn broadcast(packet: MumblePacket, recipients: &[Tx]) {
    for recipient in recipients {
        let _ = recipient.send(packet.clone());
    }
}

pub async fn handle_client(
    stream: TlsStream<TcpStream>,
    state: Arc<Mutex<SharedState>>,
    peer_addr: std::net::SocketAddr,
    db: Database,
) -> Result<()> {
    let mut framed = Framed::new(stream, MumbleCodec);

    // 1. Handshake: Expect Version
    if let Some(Ok(MumblePacket::Version(v))) = framed.next().await {
        info!(
            "Client {} Version: {:?} OS: {:?}",
            peer_addr, v.version, v.os
        );
    } else {
        anyhow::bail!("Expected Version packet");
    }

    // 2. Handshake: Expect Authenticate
    let username = if let Some(Ok(MumblePacket::Authenticate(auth))) = framed.next().await {
        let username = auth.username.unwrap_or("Unknown".to_string());
        let password = auth.password.unwrap_or_default();

        info!("Client {} Authenticating as: {:?}", peer_addr, username);

        // Check DB
        if let Some(user) = db.get_user_by_username(&username).await? {
            // User exists: Verify Password
            let parsed_hash = PasswordHash::new(&user.password_hash)
                .map_err(|e| anyhow::anyhow!("Invalid hash in DB: {}", e))?;

            if Argon2::default()
                .verify_password(password.as_bytes(), &parsed_hash)
                .is_ok()
            {
                info!("User {} logged in successfully via DB.", username);
                username
            } else {
                // Wrong password
                let mut reject = Reject::default();
                reject.reason = Some("Invalid password".into());
                reject.r#type = Some(1); // 1 = WrongPW
                framed.send(MumblePacket::Reject(reject)).await?;
                anyhow::bail!("Invalid password for user {}", username);
            }
        } else {
            // User does not exist: Register (Auto-register for now)
            info!("User {} not found. Registering...", username);
            let salt = SaltString::generate(&mut OsRng);
            let password_hash = Argon2::default()
                .hash_password(password.as_bytes(), &salt)
                .map_err(|e| anyhow::anyhow!("Hashing failed: {}", e))?
                .to_string();

            let _new_user = db.create_user(&username, &password_hash).await?;
            info!("User {} registered successfully.", username);
            username
        }
    } else {
        anyhow::bail!("Expected Authenticate packet");
    };

    // --- SETUP SESSION ---
    let (tx, mut rx) = mpsc::unbounded_channel();
    let session_id;

    {
        let mut s = state.lock().await;
        // Check collision (basic)
        // In real app, check DB or existing names.
        // For MVP, just ID increment.

        session_id = s.next_session_id;
        s.next_session_id += 1;

        info!("Assigned Session ID {} to {}", session_id, username);

        // Notify existing peers about new user
        let mut new_user_msg = UserState::default();
        new_user_msg.session = Some(session_id);
        new_user_msg.name = Some(username.clone());
        new_user_msg.user_id = Some(session_id); // Temporary: Use session as user_id
        new_user_msg.channel_id = Some(0); // Root
        let packet = MumblePacket::UserState(new_user_msg);

        for peer in s.peers.values() {
            // 1. Tell new user about existing peer
            let mut existing_user = UserState::default();
            existing_user.session = Some(peer.session_id);
            existing_user.name = Some(peer.username.clone());
            existing_user.channel_id = Some(peer.channel_id); // FIXED: Send actual channel
            existing_user.self_mute = Some(peer.self_mute);
            existing_user.self_deaf = Some(peer.self_deaf);
            let _ = tx.send(MumblePacket::UserState(existing_user));

            // 2. Tell existing peer about new user
            let _ = peer
                .tx
                .send(MumblePacket::UserState(Clone::clone(match &packet {
                    MumblePacket::UserState(u) => u,
                    _ => unreachable!(),
                })));
        }

        s.add_peer(
            session_id,
            Peer {
                tx: tx.clone(),
                username: username.clone(),
                session_id,
                channel_id: 0,
                self_mute: false,
                self_deaf: false,
                echo_enabled: false,
            },
        );
    }

    // --- SEND SERVER RESPONSE ---

    // 3. Send Version
    let mut version = Version::default();
    version.version = Some(1 << 16 | 3 << 8 | 0);
    framed.send(MumblePacket::Version(version)).await?;

    // 4. Send Channels
    {
        let s = state.lock().await;
        let mut channels: Vec<_> = s.channels.values().cloned().collect();
        channels.sort_by_key(|c| c.channel_id.unwrap_or(0));

        info!("Sent {} channels to {}", channels.len(), username);
        for channel in channels {
            framed.send(MumblePacket::ChannelState(channel)).await?;
        }
    }

    // 4.5 Send UserState (Self)
    let mut self_state = UserState::default();
    self_state.session = Some(session_id);
    self_state.name = Some(username.clone());
    self_state.user_id = Some(session_id);
    self_state.channel_id = Some(0);
    framed.send(MumblePacket::UserState(self_state)).await?;

    // 5. Send ServerSync
    let mut sync = ServerSync::default();
    sync.session = Some(session_id);
    sync.max_bandwidth = Some(128000);
    sync.welcome_text =
        Some("Welcome to Vvoice Rust Server! Type /echo to toggle loopback.".into());
    framed.send(MumblePacket::ServerSync(sync)).await?;

    // 6. Send Recent Chat History (Global/Root for now)
    if let Ok(recent) = db.get_recent_messages(0, 50).await {
        for msg in recent {
            let mut text = TextMessage::default();
            // Prefix name for now (client doesn't have actor map for old sessions)
            text.message = format!("[History] {}: {}", msg.sender_name, msg.content);
            text.session = vec![session_id];
            // Set Timestamp (if available)
            if let Some(created_at) = msg.created_at {
                text.timestamp = Some(created_at.timestamp() as u64);
            }
            framed.send(MumblePacket::TextMessage(text)).await?;
        }
    }

    // --- PACKET LOOP ---
    loop {
        tokio::select! {
            // Outgoing (To Client)
            msg = rx.recv() => {
                match msg {
                    Some(packet) => {
                        if let Err(e) = framed.send(packet).await {
                             error!("Failed to send packet to {}: {}", username, e);
                             break;
                        }
                    }
                    None => break, // Channel closed
                }
            }

            // Incoming (From Client)
            packet = framed.next() => {
                 match packet {
                    Some(Ok(pkt)) => {
                        match pkt {
                             MumblePacket::Ping(p) => {
                                 // Ping Echo
                                 let _ = tx.send(MumblePacket::Ping(p));
                             }
                             MumblePacket::UDPTunnel(msg) => {
                                 // Simple Relay (Voice Routing)
                                 let recipients = {
                                     let s = state.lock().await;
                                     collect_voice_recipients(&s, session_id)
                                 };

                                 if recipients.is_empty() {
                                     continue;
                                 }

                                 broadcast(MumblePacket::UDPTunnel(msg), &recipients);
                             }
                             MumblePacket::TextMessage(msg) => {
                                 let action = {
                                     let mut s = state.lock().await;
                                     process_text_message(&mut s, session_id, msg)
                                 };

                                 match action {
                                     ChatHandling::CommandResponse(packet) => {
                                         let _ = tx.send(packet);
                                     }
                                     ChatHandling::Broadcast {
                                         packet,
                                         recipients,
                                         persist_content,
                                     } => {
                                         broadcast(packet, &recipients);

                                         // Persist to DB (Background)
                                         let db_clone = db.clone();
                                         let sender_name = username.clone();
                                         tokio::spawn(async move {
                                             if let Err(e) = db_clone
                                                 .save_message(&sender_name, 0, &persist_content)
                                                 .await
                                             {
                                                 error!("Failed to save message: {}", e);
                                             }
                                         });
                                     }
                                     ChatHandling::None => {}
                                 }
                             }
                             MumblePacket::UserState(state_update) => {
                                 let (channel_update, state_delta, recipients) = {
                                     let mut s = state.lock().await;
                                     let mut channel_update: Option<UserState> = None;

                                     // Handle Channel Move
                                     if let Some(target_channel) = state_update.channel_id {
                                         if let Some(peer) = s.peers.get_mut(&session_id) {
                                             peer.channel_id = target_channel;
                                             info!("User {} moved to channel {}", peer.username, target_channel);

                                             let mut update = UserState::default();
                                             update.session = Some(session_id);
                                             update.channel_id = Some(target_channel);
                                             channel_update = Some(update);
                                         }
                                     }

                                     // Handle Mute/Deaf
                                     let mut changes = false;
                                     let mut update = UserState::default();
                                     update.session = Some(session_id);

                                     if let Some(mute) = state_update.self_mute {
                                         if let Some(peer) = s.peers.get_mut(&session_id) {
                                             peer.self_mute = mute;
                                             update.self_mute = Some(mute);
                                             changes = true;
                                         }
                                     }
                                     if let Some(deaf) = state_update.self_deaf {
                                          if let Some(peer) = s.peers.get_mut(&session_id) {
                                              peer.self_deaf = deaf;
                                              update.self_deaf = Some(deaf);
                                              // Implicitly mute if deaf
                                              if deaf {
                                                  peer.self_mute = true;
                                                  update.self_mute = Some(true);
                                              }
                                              changes = true;
                                          }
                                     }

                                     let recipients = s.peers.values().map(|p| p.tx.clone()).collect::<Vec<_>>();
                                     (channel_update, if changes { Some(update) } else { None }, recipients)
                                 };

                                 if let Some(update) = channel_update {
                                     broadcast(MumblePacket::UserState(update), &recipients);
                                 }

                                 if let Some(update) = state_delta {
                                     info!("User {} updated state: Mute={:?} Deaf={:?}", username, update.self_mute, update.self_deaf);
                                     broadcast(MumblePacket::UserState(update), &recipients);
                                 }
                             }
                             _ => {}
                        }
                    }
                    Some(Err(e)) => {
                        error!("Connection error from {}: {}", username, e);
                        break;
                    }
                    None => break, // EOF
                 }
            }
        }
    }

    // --- CLEANUP ---
    {
        let mut s = state.lock().await;
        s.remove_peer(session_id);
        info!("Cleaned up session {}", session_id);

        // Notify others of disconnect
        let mut remove_msg = UserRemove::default();
        remove_msg.session = session_id;

        for peer in s.peers.values() {
            let _ = peer.tx.send(MumblePacket::UserRemove(remove_msg.clone()));
        }
    }

    Ok(())
}
