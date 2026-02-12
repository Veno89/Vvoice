use crate::codec::{MumblePacket, TextMessage};
use crate::db::Database;
use crate::state::{SharedState, Tx};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::error;

/// Core logic for handling chat messages.
/// Returns: (Command Response, Broadcast Packet + Recipients, Content to Persist)
pub fn resolve_chat_logic(
    state: &mut SharedState,
    session_id: u32,
    mut msg: TextMessage,
) -> (
    Option<MumblePacket>,
    Option<(MumblePacket, Vec<Tx>)>,
    Option<(String, i32)>,
) {
    let content = msg.message.clone();
    msg.actor = Some(session_id);

    if content.starts_with("/echo") {
        if let Some(peer) = state.peers.get_mut(&session_id) {
            peer.echo_enabled = !peer.echo_enabled;

            let mut sys_msg = TextMessage::default();
            sys_msg.session = vec![session_id];
            sys_msg.message = format!(
                "Echo mode: {}",
                if peer.echo_enabled { "ON" } else { "OFF" }
            );

            (Some(MumblePacket::TextMessage(sys_msg)), None, None)
        } else {
            (None, None, None)
        }
    } else {
        if msg.timestamp.is_none() {
            msg.timestamp = Some(chrono::Utc::now().timestamp() as u64);
        }

        let sender_channel_id = state.peers.get(&session_id).map(|p| p.channel_id).unwrap_or(0);

        let recipients = state
            .peers
            .values()
            .filter(|peer| peer.channel_id == sender_channel_id)
            .map(|peer| peer.tx.clone())
            .collect::<Vec<_>>();

        (
            None,
            Some((MumblePacket::TextMessage(msg), recipients)),
            Some((content, sender_channel_id as i32)),
        )
    }
}

pub async fn handle_chat_packet(
    state: &Arc<Mutex<SharedState>>,
    db: &Database,
    tx: &Tx,
    session_id: u32,
    username: &str,
    msg: TextMessage,
) {
    let (response_packet, recipients_to_broadcast, persist_data) = {
        let mut s = state.lock().await;
        resolve_chat_logic(&mut s, session_id, msg)
    };

    // 1. Send Command Response (to self/client)
    if let Some(packet) = response_packet {
        let _ = tx.try_send(packet);
    }

    // 2. Broadcast Chat
    if let Some((packet, recipients)) = recipients_to_broadcast {
        for recipient in recipients {
            let _ = recipient.try_send(packet.clone());
        }
    }

    // 3. Persist to DB
    if let Some((content, channel_id)) = persist_data {
        let db_clone = db.clone();
        let sender_name = username.to_string();
        tokio::spawn(async move {
            if let Err(e) = db_clone.save_message(&sender_name, channel_id, &content).await {
                error!("Failed to save message: {}", e);
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::Peer;
    use tokio::sync::mpsc;

    fn test_peer(session_id: u32) -> Peer {
        let (tx, _rx) = mpsc::channel(10);
        Peer {
            tx,
            username: format!("User{}", session_id),
            session_id,
            channel_id: 0,
            self_mute: false,
            self_deaf: false,
            echo_enabled: false,
        }
    }

    #[test]
    fn test_echo_command() {
        let mut state = SharedState::new();
        state.add_peer(1, test_peer(1));

        let mut msg = TextMessage::default();
        msg.message = "/echo".to_string();

        let (resp, bcast, persist) = resolve_chat_logic(&mut state, 1, msg);

        assert!(resp.is_some());
        assert!(bcast.is_none());
        assert!(persist.is_none());

        match resp.unwrap() {
            MumblePacket::TextMessage(t) => {
                assert!(t.message.contains("Echo mode: ON"));
            }
            _ => panic!("Expected TextMessage"),
        }
    }

    #[test]
    fn test_broadcast_chat() {
        let mut state = SharedState::new();
        state.add_peer(1, test_peer(1));
        state.add_peer(2, test_peer(2));

        let mut msg = TextMessage::default();
        msg.message = "Hello".to_string();

        let (resp, bcast, persist) = resolve_chat_logic(&mut state, 1, msg);

        assert!(resp.is_none());
        assert!(bcast.is_some());
        assert!(persist.is_some());

        let (packet, recipients) = bcast.unwrap();
        assert_eq!(recipients.len(), 2);
        match packet {
            MumblePacket::TextMessage(t) => {
                assert_eq!(t.message, "Hello");
                assert!(t.timestamp.is_some());
            }
            _ => panic!("Expected TextMessage"),
        }
        
        let (content, channel_id) = persist.unwrap();
        assert_eq!(content, "Hello");
        assert_eq!(channel_id, 0);
    }
}
