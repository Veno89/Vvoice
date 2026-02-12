use crate::chat_service::{process_text_message, ChatHandling};
use crate::codec::MumblePacket;
use crate::db::Database;
use crate::session_service::process_user_state_update;
use crate::state::{try_send_packet, SharedState, Tx};
use crate::voice_router::collect_voice_recipients;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::error;

fn broadcast(packet: MumblePacket, recipients: &[Tx]) {
    for recipient in recipients {
        try_send_packet(recipient, packet.clone(), "dispatch_broadcast");
    }
}

pub async fn handle_incoming_packet(
    packet: MumblePacket,
    tx: &Tx,
    state: &Arc<Mutex<SharedState>>,
    db: &Database,
    username: &str,
    session_id: u32,
) {
    match packet {
        MumblePacket::Ping(p) => {
            try_send_packet(tx, MumblePacket::Ping(p), "dispatch_ping");
        }
        MumblePacket::UDPTunnel(msg) => {
            let recipients = {
                let s = state.lock().await;
                collect_voice_recipients(&s, session_id)
            };

            if !recipients.is_empty() {
                broadcast(MumblePacket::UDPTunnel(msg), &recipients);
            }
        }
        MumblePacket::TextMessage(msg) => {
            let action = {
                let mut s = state.lock().await;
                process_text_message(&mut s, session_id, msg)
            };

            match action {
                ChatHandling::CommandResponse(packet) => {
                    try_send_packet(tx, packet, "dispatch_command_response");
                }
                ChatHandling::Broadcast {
                    packet,
                    recipients,
                    persist_content,
                } => {
                    broadcast(packet, &recipients);

                    let db_clone = db.clone();
                    let sender_name = username.to_string();
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
            let session_update = {
                let mut s = state.lock().await;
                process_user_state_update(&mut s, session_id, username, state_update)
            };

            if let Some(update) = session_update.channel_update {
                broadcast(MumblePacket::UserState(update), &session_update.recipients);
            }

            if let Some(update) = session_update.state_delta {
                broadcast(MumblePacket::UserState(update), &session_update.recipients);
            }
        }
        _ => {}
    }
}
