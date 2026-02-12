use crate::codec::{MumblePacket, UdpTunnel};
use crate::state::SharedState;
use crate::voice_router::collect_voice_recipients;
use std::sync::Arc;
use tokio::sync::Mutex;

pub async fn process_voice_packet(
    state: &Arc<Mutex<SharedState>>,
    session_id: u32,
    tunnel: UdpTunnel,
) {
    let recipients = {
        let s = state.lock().await;
        collect_voice_recipients(&s, session_id)
    };

    if !recipients.is_empty() {
        let packet = MumblePacket::UDPTunnel(tunnel);
        for recipient in recipients {
            let _ = recipient.try_send(packet.clone());
        }
    }
}
