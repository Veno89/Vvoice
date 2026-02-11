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
