mod auth_service;
mod bootstrap;
mod cert;
mod chat_service;
mod codec;
mod db;
mod handler;
mod packet_dispatch;
mod session_service;
mod state;
mod voice_router;

use anyhow::{Context, Result};
use db::Database;
use dotenvy::dotenv;
use state::SharedState;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use tokio_rustls::TlsAcceptor;
use tracing::info;

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
    bootstrap::load_channels(&db, &mut shared_state).await?;

    let state = Arc::new(Mutex::new(shared_state));
    bootstrap::run_listener(listener, acceptor, state, db).await
}
