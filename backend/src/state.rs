use crate::codec::{ChannelState, MumblePacket};
use std::collections::HashMap;
use tokio::sync::mpsc;

pub type Tx = mpsc::Sender<MumblePacket>;

pub struct Peer {
    pub tx: Tx,
    pub username: String,
    pub session_id: u32,
    pub channel_id: u32,
    pub self_mute: bool,
    pub self_deaf: bool,
    pub echo_enabled: bool,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
}

pub struct SharedState {
    pub peers: HashMap<u32, Peer>,
    pub channels: HashMap<u32, ChannelState>,
    pub next_session_id: u32,
}

impl SharedState {
    pub fn new() -> Self {
        Self {
            peers: HashMap::new(),
            channels: HashMap::new(),
            next_session_id: 1,
        }
    }

    pub fn add_peer(&mut self, session_id: u32, peer: Peer) {
        self.peers.insert(session_id, peer);
    }

    pub fn remove_peer(&mut self, session_id: u32) -> Option<Peer> {
        self.peers.remove(&session_id)
    }
}
