mod db;
mod cert;
mod codec;

use tokio::net::{TcpListener, TcpStream};
use tokio_rustls::TlsAcceptor;
use tokio_rustls::server::TlsStream;
use anyhow::Result;
use tracing::{info, error};
use db::Database;
use dotenvy::dotenv;
use tokio::sync::{Mutex, mpsc};
use std::collections::HashMap;
use std::sync::Arc;
use tokio_util::codec::Framed;
use futures::{SinkExt, StreamExt};
use codec::{MumbleCodec, MumblePacket, Version, Authenticate, ServerSync, ChannelState, UserState, UserRemove, UdpTunnel};

type Tx = mpsc::UnboundedSender<MumblePacket>;

struct Peer {
    tx: Tx,
    username: String,
    session_id: u32,
    echo_enabled: bool,
}

struct SharedState {
    peers: HashMap<u32, Peer>,
    next_session_id: u32,
}

impl SharedState {
    fn new() -> Self {
        Self {
            peers: HashMap::new(),
            next_session_id: 1,
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    tracing_subscriber::fmt::init();
    
    info!("Starting Vvoice Server...");

    // 1. Initialize Database
    let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let _db = Database::connect(&db_url).await?;

    // 2. Generate/Load Certs
    let tls_config = cert::generate_dev_cert()?;
    let acceptor = TlsAcceptor::from(tls_config);

    // 3. Bind TCP Listener
    let addr = "0.0.0.0:64738";
    let listener = TcpListener::bind(addr).await?;
    info!("Listening on {}", addr);
    
    let state = Arc::new(Mutex::new(SharedState::new()));

    loop {
        let (stream, peer_addr) = listener.accept().await?;
        let acceptor = acceptor.clone();
        let state = state.clone();
        
        info!("New connection from {}", peer_addr);

        tokio::spawn(async move {
            match acceptor.accept(stream).await {
                Ok(stream) => {
                    info!("TLS Handshake successful with {}", peer_addr);
                    
                    // Spawn client handler
                    tokio::spawn(async move {
                        if let Err(e) = handle_client(stream, state, peer_addr).await {
                            error!("Client error: {}", e);
                        }
                    });
                }
                Err(e) => {
                    error!("TLS Handshake failed: {}", e);
                }
            }
        });
    }
}

async fn handle_client(stream: TlsStream<TcpStream>, state: Arc<Mutex<SharedState>>, peer_addr: std::net::SocketAddr) -> Result<()> {
    let mut framed = Framed::new(stream, MumbleCodec);

    // 1. Handshake: Expect Version
    if let Some(Ok(MumblePacket::Version(v))) = framed.next().await {
        info!("Client {} Version: {:?} OS: {:?}", peer_addr, v.version, v.os);
    } else {
        anyhow::bail!("Expected Version packet");
    }

    // 2. Handshake: Expect Authenticate
    let username = if let Some(Ok(MumblePacket::Authenticate(auth))) = framed.next().await {
        info!("Client {} Authenticating as: {:?}", peer_addr, auth.username);
        auth.username.unwrap_or("Unknown".to_string())
    } else {
        anyhow::bail!("Expected Authenticate packet");
    };

    // --- SETUP SESSION ---
    let (tx, mut rx) = mpsc::unbounded_channel();
    let session_id;
    
    {
        let mut s = state.lock().await;
        session_id = s.next_session_id;
        s.next_session_id += 1;
        
        info!("Assigned Session ID {} to {}", session_id, username);

        // Notify existing peers about new user
        let mut new_user_msg = UserState::default();
        new_user_msg.session = Some(session_id);
        new_user_msg.name = Some(username.clone());
        new_user_msg.user_id = Some(session_id); // Temporary: Use session as user_id
        new_user_msg.channel_id = Some(0); // Root
        let packet = MumblePacket::UserState(new_user_msg);

        for peer in s.peers.values() {
            // 1. Tell new user about existing peer
            let mut existing_user = UserState::default();
            existing_user.session = Some(peer.session_id);
            existing_user.name = Some(peer.username.clone());
            existing_user.channel_id = Some(0);
            let _ = tx.send(MumblePacket::UserState(existing_user));

            // 2. Tell existing peer about new user
            let _ = peer.tx.send(MumblePacket::UserState(Clone::clone(match &packet { MumblePacket::UserState(u) => u, _ => unreachable!() })));
        }

        s.peers.insert(session_id, Peer {
            tx: tx.clone(),
            username: username.clone(),
            session_id,
            echo_enabled: false,
        });
    }

    // --- SEND SERVER RESPONSE ---

    // 3. Send Version
    let mut version = Version::default();
    version.version = Some(1 << 16 | 3 << 8 | 0);
    framed.send(MumblePacket::Version(version)).await?;

    // 4. Send Root Channel
    let mut root = ChannelState::default();
    root.channel_id = Some(0);
    root.name = Some("Root".into());
    framed.send(MumblePacket::ChannelState(root)).await?;

    // 5. Send ServerSync
    let mut sync = ServerSync::default();
    sync.session = Some(session_id);
    sync.max_bandwidth = Some(128000);
    sync.welcome_text = Some("Welcome to Vvoice Rust Server! Type /echo to toggle loopback.".into());
    framed.send(MumblePacket::ServerSync(sync)).await?;

    // --- PACKET LOOP ---
    loop {
        tokio::select! {
            // Outgoing (To Client)
            msg = rx.recv() => {
                match msg {
                    Some(packet) => {
                        if let Err(e) = framed.send(packet).await {
                             error!("Failed to send packet to {}: {}", username, e);
                             break;
                        }
                    }
                    None => break, // Channel closed
                }
            }

            // Incoming (From Client)
            packet = framed.next() => {
                 match packet {
                    Some(Ok(pkt)) => {
                        match pkt {
                             MumblePacket::Ping(p) => {
                                 // Ping Echo
                                 let _ = tx.send(MumblePacket::Ping(p));
                             }
                             MumblePacket::UDPTunnel(udp) => {
                                 // BROADCAST VOICE
                                 let mut s = state.lock().await; // Lock for read/write (echo flag)
                                 
                                 let mut voice_packet = udp.packet.clone();
                                 let sender_echo = if let Some(peer) = s.peers.get(&session_id) {
                                     peer.echo_enabled
                                 } else { false };

                                 // Inject Session ID if we were doing proper header rewriting
                                 // For MVP, simplistic forwarding.
                                 
                                 // Forward to others
                                 for peer in s.peers.values() {
                                     if peer.session_id != session_id {
                                         let _ = peer.tx.send(MumblePacket::UDPTunnel(UdpTunnel { packet: voice_packet.clone() }));
                                     }
                                 }
                                 
                                 // Echo Back?
                                 if sender_echo {
                                     let _ = tx.send(MumblePacket::UDPTunnel(UdpTunnel { packet: voice_packet }));
                                 }
                             }
                             MumblePacket::TextMessage(msg) => {
                                 let mut s = state.lock().await;

                                 // Check for commands
                                 let content = msg.message.clone();
                                 if content.starts_with("/echo") {
                                     if let Some(peer) = s.peers.get_mut(&session_id) {
                                         peer.echo_enabled = !peer.echo_enabled;
                                         
                                         // Send system confirmation
                                         let mut sys_msg = codec::TextMessage::default();
                                         sys_msg.session = vec![session_id]; // Target self
                                         sys_msg.message = format!("Echo mode: {}", if peer.echo_enabled { "ON" } else { "OFF" });
                                         let _ = tx.send(MumblePacket::TextMessage(sys_msg));
                                     }
                                 } else {
                                     // Text Chat Broadcast
                                     for peer in s.peers.values() {
                                         // Broadcast to all (including self? usually yes for confirmation)
                                         let _ = peer.tx.send(MumblePacket::TextMessage(msg.clone()));
                                     }
                                 }
                             }
                             _ => {}
                        }
                    }
                    Some(Err(e)) => {
                        error!("Connection error from {}: {}", username, e);
                        break;
                    }
                    None => break, // EOF
                 }
            }
        }
    }

    // --- CLEANUP ---
    {
        let mut s = state.lock().await;
        s.peers.remove(&session_id);
        info!("Cleaned up session {}", session_id);
        
        // Notify others of disconnect
        let mut remove_msg = UserRemove::default();
        remove_msg.session = session_id;
        
        for peer in s.peers.values() {
            let _ = peer.tx.send(MumblePacket::UserRemove(remove_msg.clone()));
        }
    }

    Ok(())
}
