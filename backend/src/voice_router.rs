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
