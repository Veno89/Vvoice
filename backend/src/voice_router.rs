use crate::state::{SharedState, Tx};

pub fn collect_voice_recipients(state: &SharedState, session_id: u32) -> Vec<Tx> {
    let current_channel = state
        .peers
        .get(&session_id)
        .map(|p| p.channel_id)
        .unwrap_or(0);
    let is_muted = state
        .peers
        .get(&session_id)
        .map(|p| p.self_mute || p.self_deaf)
        .unwrap_or(false);

    if is_muted {
        return Vec::new();
    }

    state
        .peers
        .values()
        .filter(|peer| {
            (peer.session_id != session_id && peer.channel_id == current_channel)
                || (peer.session_id == session_id && peer.echo_enabled)
        })
        .map(|peer| peer.tx.clone())
        .collect::<Vec<_>>()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::codec::MumblePacket;
    use crate::state::{Peer, SharedState};
    use tokio::sync::mpsc;

    fn peer(session_id: u32, channel_id: u32, muted: bool, deaf: bool, echo_enabled: bool) -> Peer {
        let (tx, _rx) = mpsc::unbounded_channel::<MumblePacket>();
        Peer {
            tx,
            username: format!("u{}", session_id),
            session_id,
            channel_id,
            self_mute: muted,
            self_deaf: deaf,
            echo_enabled,
        }
    }

    #[test]
    fn routes_to_same_channel_and_echo_self() {
        let mut state = SharedState::new();
        state.add_peer(1, peer(1, 10, false, false, true));
        state.add_peer(2, peer(2, 10, false, false, false));
        state.add_peer(3, peer(3, 11, false, false, false));

        let recipients = collect_voice_recipients(&state, 1);
        assert_eq!(recipients.len(), 2);
    }

    #[test]
    fn drops_when_sender_muted() {
        let mut state = SharedState::new();
        state.add_peer(1, peer(1, 10, true, false, true));
        state.add_peer(2, peer(2, 10, false, false, false));

        let recipients = collect_voice_recipients(&state, 1);
        assert!(recipients.is_empty());
    }
}
