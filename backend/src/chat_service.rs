use crate::codec::{MumblePacket, TextMessage};
use crate::state::{SharedState, Tx};

pub enum ChatHandling {
    CommandResponse(MumblePacket),
    Broadcast {
        packet: MumblePacket,
        recipients: Vec<Tx>,
        persist_content: String,
    },
    None,
}

pub fn process_text_message(
    state: &mut SharedState,
    session_id: u32,
    msg: TextMessage,
) -> ChatHandling {
    let content = msg.message.clone();

    if content.starts_with("/echo") {
        if let Some(peer) = state.peers.get_mut(&session_id) {
            peer.echo_enabled = !peer.echo_enabled;

            let mut sys_msg = TextMessage::default();
            sys_msg.session = vec![session_id];
            sys_msg.message = format!(
                "Echo mode: {}",
                if peer.echo_enabled { "ON" } else { "OFF" }
            );

            return ChatHandling::CommandResponse(MumblePacket::TextMessage(sys_msg));
        }

        return ChatHandling::None;
    }

    let mut broadcast_msg = msg;
    if broadcast_msg.timestamp.is_none() {
        broadcast_msg.timestamp = Some(chrono::Utc::now().timestamp() as u64);
    }

    let recipients = state
        .peers
        .values()
        .map(|peer| peer.tx.clone())
        .collect::<Vec<_>>();

    ChatHandling::Broadcast {
        packet: MumblePacket::TextMessage(broadcast_msg),
        recipients,
        persist_content: content,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::codec::MumblePacket;
    use crate::state::{Peer, SharedState};
    use tokio::sync::mpsc;

    fn peer(session_id: u32, channel_id: u32, echo_enabled: bool) -> Peer {
        let (tx, _rx) = mpsc::unbounded_channel();
        Peer {
            tx,
            username: format!("u{}", session_id),
            session_id,
            channel_id,
            self_mute: false,
            self_deaf: false,
            echo_enabled,
        }
    }

    #[test]
    fn toggles_echo_and_returns_command_response() {
        let mut state = SharedState::new();
        state.add_peer(1, peer(1, 0, false));

        let mut msg = TextMessage::default();
        msg.message = "/echo".into();

        let result = process_text_message(&mut state, 1, msg);

        match result {
            ChatHandling::CommandResponse(MumblePacket::TextMessage(response)) => {
                assert!(response.message.contains("ON"));
                assert!(state.peers.get(&1).expect("peer").echo_enabled);
            }
            _ => panic!("unexpected result"),
        }
    }

    #[test]
    fn broadcasts_regular_text_with_recipients() {
        let mut state = SharedState::new();
        state.add_peer(1, peer(1, 0, false));
        state.add_peer(2, peer(2, 0, false));

        let mut msg = TextMessage::default();
        msg.message = "hello".into();

        let result = process_text_message(&mut state, 1, msg);
        match result {
            ChatHandling::Broadcast {
                packet,
                recipients,
                persist_content,
            } => {
                assert_eq!(persist_content, "hello");
                assert_eq!(recipients.len(), 2);
                match packet {
                    MumblePacket::TextMessage(text) => {
                        assert_eq!(text.message, "hello");
                        assert!(text.timestamp.is_some());
                    }
                    _ => panic!("unexpected packet type"),
                }
            }
            _ => panic!("unexpected result"),
        }
    }
}
