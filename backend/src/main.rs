mod cert;
mod codec;
mod db;
mod handler;
mod state;

use anyhow::{Context, Result};
use db::Database;
use dotenvy::dotenv;
use handler::handle_client;
use state::SharedState;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use tokio_rustls::TlsAcceptor;
use tracing::{error, info};

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    tracing_subscriber::fmt::init();

    info!("Starting Vvoice Server...");

    // 1. Initialize Database
    let db_url = std::env::var("DATABASE_URL").context("DATABASE_URL must be set")?;
    let db = Database::connect(&db_url).await?;

    // 2. Generate/Load Certs
    let tls_config = cert::generate_dev_cert()?;
    let acceptor = TlsAcceptor::from(tls_config);

    // 3. Bind TCP Listener
    let addr = "0.0.0.0:64738";
    let listener = TcpListener::bind(addr).await?;
    info!("Listening on {}", addr);

    let mut shared_state = SharedState::new();

    // 4. Load Channels from DB
    let channels = db.get_all_channels().await?;
    for db_chan in channels {
        let mut chan_state = codec::ChannelState::default();
        chan_state.channel_id = Some(db_chan.id as u32);
        chan_state.parent = db_chan.parent_id.map(|id| id as u32);
        chan_state.name = Some(db_chan.name);
        chan_state.description = db_chan.description;
        if let Some(channel_id) = chan_state.channel_id {
            shared_state.channels.insert(channel_id, chan_state);
        }
    }
    info!("Loaded {} channels from DB", shared_state.channels.len());

    let state = Arc::new(Mutex::new(shared_state));

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
