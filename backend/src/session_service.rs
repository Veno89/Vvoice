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
