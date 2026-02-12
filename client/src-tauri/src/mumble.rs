use anyhow::Result;
use bytes::BytesMut;
use futures::{stream::SplitSink, SinkExt, StreamExt};
use prost::Message;
use std::convert::TryFrom;
use std::sync::{Arc, Mutex};
use tokio::net::TcpStream;
use tokio_rustls::rustls::{pki_types::{ServerName, CertificateDer, UnixTime}, ClientConfig, RootCertStore, DigitallySignedStruct, Error, SignatureScheme};
use tokio_rustls::rustls::client::danger::{ServerCertVerified, ServerCertVerifier, HandshakeSignatureValid};
use tokio_rustls::TlsConnector;
use tokio_util::codec::{Decoder, Encoder, Framed};

#[derive(Debug)]
struct NoCertVerifier;

impl ServerCertVerifier for NoCertVerifier {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, Error> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, Error> {
         Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        vec![
            SignatureScheme::RSA_PKCS1_SHA256,
            SignatureScheme::ECDSA_NISTP256_SHA256,
            SignatureScheme::RSA_PSS_SHA256,
            SignatureScheme::ED25519,
        ]
    }
}

use crate::audio::AudioSystem;

// Include generated protos
pub mod mumble_proto {
    include!(concat!(env!("OUT_DIR"), "/mumble_proto.rs"));
}
pub use mumble_proto::*;

// --- CODEC IMPLEMENTATION ---

include!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../proto/mumble_codec_shared.rs"
));

// --- CLIENT IMPLEMENTATION ---

use tauri::Emitter;

type MumbleSink =
    SplitSink<Framed<tokio_rustls::client::TlsStream<TcpStream>, MumbleCodec>, MumblePacket>;

pub struct VoiceClient {
    tx: tokio::sync::mpsc::Sender<MumblePacket>,
    _shutdown: tokio::sync::oneshot::Sender<()>,
    vad_threshold: Arc<Mutex<f32>>,
    #[allow(dead_code)] // Kept alive
    audio: Arc<AudioSystem>,
}

impl VoiceClient {
    pub fn list_input_devices() -> Vec<String> {
        // We can delegate this to audio subsystem if we want, or keep using cpal here for listing.
        // For strict separation, let's keep it here but using cpal directly is fine for just listing.
        // Or better, move static methods to AudioSystem? 
        // For now, let's just re-implement it briefly or use cpal here just for listing.
        use cpal::traits::{DeviceTrait, HostTrait};
        let host = cpal::default_host();
        match host.input_devices() {
            Ok(devices) => devices.filter_map(|d| d.name().ok()).collect(),
            Err(_) => vec![],
        }
    }

    pub async fn connect(
        app: tauri::AppHandle,
        host: &str,
        port: u16,
        username: &str,
        password: &str,
        input_device: Option<String>,
        vad_threshold_val: f32,
    ) -> Result<Self> {
        let addr = format!("{}:{}", host, port);
        // ... (connection logic, handshake)

        let socket = TcpStream::connect(&addr).await?;
        let mut root_store = RootCertStore::empty();
        let native_certs = rustls_native_certs::load_native_certs()?;
        for cert in native_certs {
            let _ = root_store.add(cert);
        }

        if root_store.is_empty() {
             tracing::warn!("No system root certificates found (or failed to load). SSL may fail.");
        }

        let config = ClientConfig::builder()
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(NoCertVerifier))
            .with_no_client_auth();

        let connector = TlsConnector::from(Arc::new(config));
        // let server_name = if host.is_empty() { "localhost" } else { host };
        // Quick fix to avoid empty host issues
        let server_name = "localhost"; // For PoC, or use passed host
        let dns_name = ServerName::try_from(server_name.to_owned())
            .map_err(|e| anyhow::anyhow!("Invalid TLS server name '{}': {}", server_name, e))?;
        let tls_stream = connector.connect(dns_name, socket).await?;

        let framed = Framed::new(tls_stream, MumbleCodec);
        let (mut sink, mut stream) = framed.split();

        // Create main outgoing channel
        let (tx, mut rx) = tokio::sync::mpsc::channel::<MumblePacket>(512);

        // Create shutdown channel
        let (shutdown_tx, mut shutdown_rx) = tokio::sync::oneshot::channel::<()>();

        let mut version = Version::default();
        version.version = Some(1 << 16 | 4 << 8 | 0); // 1.4.0
        version.release = Some("Vvoice PoC".into());
        sink.send(MumblePacket::Version(version)).await?;

        let mut auth = Authenticate::default();
        auth.username = Some(username.into());
        auth.password = Some(password.into());
        sink.send(MumblePacket::Authenticate(auth)).await?;

        // Wait for ServerSync
        println!("Waiting for Server Handshake...");
        let mut session_id = None;

        while let Some(packet) = stream.next().await {
            match packet {
                Ok(MumblePacket::Version(v)) => {
                    println!("Server Version: {:?}", v.release);
                }
                Ok(MumblePacket::ServerSync(s)) => {
                    session_id = s.session;
                    println!("Handshake Complete! Session ID: {:?}", session_id);
                    break;
                }
                Ok(MumblePacket::ChannelState(c)) => {
                    println!("Handshake Channel: {:?}", c);
                    let _ = app.emit("channel_update", c);
                }
                Ok(MumblePacket::UserState(u)) => {
                    println!("Handshake User: {:?}", u);
                    let _ = app.emit("user_update", u);
                }
                Ok(MumblePacket::Reject(r)) => {
                    return Err(anyhow::anyhow!("Connection rejected: {:?}", r.reason));
                }
                Ok(MumblePacket::Ping(_)) => {}
                Ok(_) => {}
                Err(e) => return Err(anyhow::anyhow!("Handshake error: {}", e)),
            }
        }

        if session_id.is_none() {
            return Err(anyhow::anyhow!("Disconnected during handshake"));
        }

        // --- AUDIO SYSTEM SETUP ---
        let mut audio = AudioSystem::new()?;
        let vad_threshold = Arc::new(Mutex::new(vad_threshold_val));
        
        // Start Capture
        audio.start_capture(tx.clone(), vad_threshold.clone(), input_device)?;
        
        // Start Playback
        audio.start_playback()?;

        let audio = Arc::new(audio);
        let audio_clone = audio.clone();
        // Spawn Network Loop
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    _ = &mut shutdown_rx => {
                        println!("Shutdown signal received. Closing connection.");
                        break;
                    }
                    packet = stream.next() => {
                        match packet {
                            Some(Ok(msg)) => {
                                match msg {
                                    MumblePacket::Ping(_ping) => {},
                                    MumblePacket::UserState(user) => {
                                        println!("RUST: Received UserState: {:?}", user);
                                        let _ = app.emit("user_update", user);
                                    },
                                    MumblePacket::UserRemove(remove) => {
                                        let _ = app.emit("user_remove", remove);
                                    },
                                    MumblePacket::ChannelState(channel) => {
                                        let _ = app.emit("channel_update", channel);
                                    },
                                    MumblePacket::ChannelRemove(remove) => {
                                        let _ = app.emit("channel_remove", remove);
                                    },
                                    MumblePacket::TextMessage(msg) => {
                                        let _ = app.emit("text_message", msg);
                                    },
                                    MumblePacket::UDPTunnel(udp) => {
                                        // DELEGATE TO AUDIO SYSTEM
                                        audio_clone.decode_and_play(&udp.packet);
                                    },
                                    _ => {}
                                }
                            }
                            Some(Err(e)) => {
                                println!("Connection error: {}", e);
                                break;
                            }
                            None => {
                                println!("Connection closed.");
                                break;
                            }
                        }
                    }
                    out_packet = rx.recv() => {
                        match out_packet {
                            Some(pkt) => {
                                if let Err(e) = sink.send(pkt).await {
                                    println!("Failed to send packet: {}", e);
                                    break;
                                }
                            }
                            None => break,
                        }
                    }
                }
            }
        });

        // We can't return `audio` (Arc) if the struct expects `AudioSystem`.
        // struct VoiceClient { audio: Arc<AudioSystem> }
        // I need to update the struct definition in this replacement too.
        
        Ok(Self {
            tx,
            _shutdown: shutdown_tx,
            vad_threshold,
            audio: audio, // We need to change struct type to Arc<AudioSystem>
        })
    }

    pub fn set_vad_threshold(&self, threshold: f32) {
        if let Ok(mut t) = self.vad_threshold.lock() {
            *t = threshold;
            println!("VAD Threshold set to: {}", threshold);
        }
    }

    pub fn send_message(&self, message: String) {
        let mut msg = TextMessage::default();
        msg.message = message;
        let _ = self.tx.try_send(MumblePacket::TextMessage(msg));
    }

    pub fn join_channel(&self, channel_id: u32) {
        let mut msg = UserState::default();
        msg.channel_id = Some(channel_id);
        let _ = self.tx.try_send(MumblePacket::UserState(msg));
    }

    pub fn set_mute(&self, mute: bool) {
        // Update local audio system to stop capturing
        self.audio.set_mute(mute);
        
        // Notify server
        let mut msg = UserState::default();
        msg.self_mute = Some(mute);
        let _ = self.tx.try_send(MumblePacket::UserState(msg));
    }

    pub fn set_deaf(&self, deaf: bool) {
        let mut msg = UserState::default();
        msg.self_deaf = Some(deaf);
        if deaf {
            msg.self_mute = Some(true);
        }
        let _ = self.tx.try_send(MumblePacket::UserState(msg));
    }

    pub fn set_profile(&self, avatar_url: Option<String>, bio: Option<String>) {
        let mut msg = UserState::default();
        msg.avatar_url = avatar_url;
        msg.comment = bio;
        let _ = self.tx.try_send(MumblePacket::UserState(msg));
    }
}

