use crate::codec::UserState;
use crate::state::{SharedState, Tx};
use tracing::info;

pub struct SessionUpdate {
    pub channel_update: Option<UserState>,
    pub state_delta: Option<UserState>,
    pub recipients: Vec<Tx>,
}

pub fn process_user_state_update(
    state: &mut SharedState,
    session_id: u32,
    username: &str,
    state_update: UserState,
) -> SessionUpdate {
    let mut channel_update: Option<UserState> = None;

    if let Some(target_channel) = state_update.channel_id {
        if let Some(peer) = state.peers.get_mut(&session_id) {
            peer.channel_id = target_channel;
            info!("User {} moved to channel {}", peer.username, target_channel);

            let mut update = UserState::default();
            update.session = Some(session_id);
            update.channel_id = Some(target_channel);
            channel_update = Some(update);
        }
    }

    let mut changes = false;
    let mut update = UserState::default();
    update.session = Some(session_id);

    if let Some(mute) = state_update.self_mute {
        if let Some(peer) = state.peers.get_mut(&session_id) {
            peer.self_mute = mute;
            update.self_mute = Some(mute);
            changes = true;
        }
    }

    if let Some(deaf) = state_update.self_deaf {
        if let Some(peer) = state.peers.get_mut(&session_id) {
            peer.self_deaf = deaf;
            update.self_deaf = Some(deaf);
            if deaf {
                peer.self_mute = true;
                update.self_mute = Some(true);
            }
            changes = true;
        }
    }

    if changes {
        info!(
            "User {} updated state: Mute={:?} Deaf={:?}",
            username, update.self_mute, update.self_deaf
        );
    }

    let recipients = state
        .peers
        .values()
        .map(|peer| peer.tx.clone())
        .collect::<Vec<_>>();

    SessionUpdate {
        channel_update,
        state_delta: if changes { Some(update) } else { None },
        recipients,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::codec::MumblePacket;
    use crate::state::{Peer, SharedState};
    use tokio::sync::mpsc;

    fn peer(session_id: u32, channel_id: u32) -> Peer {
        let (tx, _rx) = mpsc::unbounded_channel::<MumblePacket>();
        Peer {
            tx,
            username: format!("u{}", session_id),
            session_id,
            channel_id,
            self_mute: false,
            self_deaf: false,
            echo_enabled: false,
        }
    }

    #[test]
    fn applies_channel_move_and_mute_deaf_updates() {
        let mut state = SharedState::new();
        state.add_peer(1, peer(1, 0));
        state.add_peer(2, peer(2, 0));

        let mut update = UserState::default();
        update.channel_id = Some(2);
        update.self_deaf = Some(true);

        let result = process_user_state_update(&mut state, 1, "u1", update);

        assert_eq!(state.peers.get(&1).expect("peer").channel_id, 2);
        assert!(state.peers.get(&1).expect("peer").self_deaf);
        assert!(state.peers.get(&1).expect("peer").self_mute);

        assert!(result.channel_update.is_some());
        assert!(result.state_delta.is_some());
        assert_eq!(result.recipients.len(), 2);
    }
}
