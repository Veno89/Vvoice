use crate::codec::ChannelState;
use crate::db::Database;
use crate::handler::handle_client;
use crate::state::SharedState;
use anyhow::Result;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use tokio_rustls::TlsAcceptor;
use tracing::{error, info};

pub async fn load_channels(db: &Database, shared_state: &mut SharedState) -> Result<()> {
    let channels = db.get_all_channels().await?;
    for db_chan in channels {
        let mut chan_state = ChannelState::default();
        chan_state.channel_id = Some(db_chan.id as u32);
        chan_state.parent = db_chan.parent_id.map(|id| id as u32);
        chan_state.name = Some(db_chan.name);
        chan_state.description = db_chan.description;

        if let Some(channel_id) = chan_state.channel_id {
            shared_state.channels.insert(channel_id, chan_state);
        }
    }

    info!("Loaded {} channels from DB", shared_state.channels.len());
    Ok(())
}

pub async fn run_listener(
    listener: TcpListener,
    acceptor: TlsAcceptor,
    state: Arc<Mutex<SharedState>>,
    db: Database,
) -> Result<()> {
    loop {
        let (stream, peer_addr) = listener.accept().await?;
        let acceptor = acceptor.clone();
        let state = state.clone();
        let db = db.clone();

        info!("New connection from {}", peer_addr);

        tokio::spawn(async move {
            match acceptor.accept(stream).await {
                Ok(stream) => {
                    info!("TLS Handshake successful with {}", peer_addr);
                    if let Err(e) = handle_client(stream, state, peer_addr, db).await {
                        error!("Client error: {}", e);
                    }
                }
                Err(e) => {
                    error!("TLS Handshake failed: {}", e);
                }
            }
        });
    }
}
