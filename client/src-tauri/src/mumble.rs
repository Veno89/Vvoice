use anyhow::Result;
use bytes::BytesMut;
use futures::{stream::SplitSink, SinkExt, StreamExt};
use prost::Message;
use std::convert::TryFrom;
use std::sync::Arc;
use tokio::net::TcpStream;
use tokio_rustls::rustls::{pki_types::ServerName, ClientConfig, RootCertStore};
use tokio_rustls::TlsConnector;
use tokio_util::codec::{Decoder, Encoder, Framed};

// Include generated protos
pub mod mumble_proto {
    include!(concat!(env!("OUT_DIR"), "/mumble_proto.rs"));
}
pub use mumble_proto::*;

// --- CODEC IMPLEMENTATION ---

pub struct MumbleCodec;

impl Decoder for MumbleCodec {
    type Item = MumblePacket;
    type Error = anyhow::Error;

    fn decode(&mut self, src: &mut BytesMut) -> Result<Option<Self::Item>, Self::Error> {
        if src.len() < 6 {
            return Ok(None);
        }

        let packet_type = u16::from_be_bytes([src[0], src[1]]);
        let length = u32::from_be_bytes([src[2], src[3], src[4], src[5]]) as usize;

        if src.len() < 6 + length {
            src.reserve(6 + length - src.len());
            return Ok(None);
        }

        let _header = src.split_to(6);
        let payload = src.split_to(length);

        let packet = match packet_type {
            0 => MumblePacket::Version(Version::decode(payload)?),
            1 => MumblePacket::UDPTunnel(UdpTunnel {
                packet: payload.to_vec(),
            }),
            2 => MumblePacket::Authenticate(Authenticate::decode(payload)?),
            3 => MumblePacket::Ping(Ping::decode(payload)?),
            4 => MumblePacket::Reject(Reject::decode(payload)?),
            5 => MumblePacket::ServerSync(ServerSync::decode(payload)?),
            6 => MumblePacket::ChannelRemove(ChannelRemove::decode(payload)?),
            7 => MumblePacket::ChannelState(ChannelState::decode(payload)?),
            8 => MumblePacket::UserRemove(UserRemove::decode(payload)?),
            9 => MumblePacket::UserState(UserState::decode(payload)?),
            10 => MumblePacket::BanList(BanList::decode(payload)?),
            11 => MumblePacket::TextMessage(TextMessage::decode(payload)?),
            12 => MumblePacket::PermissionDenied(PermissionDenied::decode(payload)?),
            13 => MumblePacket::ACL(Acl::decode(payload)?),
            14 => MumblePacket::QueryUsers(QueryUsers::decode(payload)?),
            15 => MumblePacket::CryptSetup(CryptSetup::decode(payload)?),
            16 => MumblePacket::ContextActionModify(ContextActionModify::decode(payload)?),
            17 => MumblePacket::ContextAction(ContextAction::decode(payload)?),
            18 => MumblePacket::UserList(UserList::decode(payload)?),
            19 => MumblePacket::VoiceTarget(VoiceTarget::decode(payload)?),
            20 => MumblePacket::PermissionQuery(PermissionQuery::decode(payload)?),
            21 => MumblePacket::CodecVersion(CodecVersion::decode(payload)?),
            22 => MumblePacket::UserStats(UserStats::decode(payload)?),
            23 => MumblePacket::RequestBlob(RequestBlob::decode(payload)?),
            24 => MumblePacket::ServerConfig(ServerConfig::decode(payload)?),
            25 => MumblePacket::SuggestConfig(SuggestConfig::decode(payload)?),
            _ => return Ok(None),
        };

        Ok(Some(packet))
    }
}

impl Encoder<MumblePacket> for MumbleCodec {
    type Error = anyhow::Error;

    fn encode(&mut self, item: MumblePacket, dst: &mut BytesMut) -> Result<(), Self::Error> {
        let (packet_type, payload) = match item {
            MumblePacket::Version(msg) => (0u16, msg.encode_to_vec()),
            MumblePacket::UDPTunnel(msg) => (1, msg.packet),
            MumblePacket::Authenticate(msg) => (2, msg.encode_to_vec()),
            MumblePacket::Ping(msg) => (3, msg.encode_to_vec()),
            MumblePacket::Reject(msg) => (4, msg.encode_to_vec()),
            MumblePacket::ServerSync(msg) => (5, msg.encode_to_vec()),
            MumblePacket::ChannelRemove(msg) => (6, msg.encode_to_vec()),
            MumblePacket::ChannelState(msg) => (7, msg.encode_to_vec()),
            MumblePacket::UserRemove(msg) => (8, msg.encode_to_vec()),
            MumblePacket::UserState(msg) => (9, msg.encode_to_vec()),
            MumblePacket::BanList(msg) => (10, msg.encode_to_vec()),
            MumblePacket::TextMessage(msg) => (11, msg.encode_to_vec()),
            MumblePacket::PermissionDenied(msg) => (12, msg.encode_to_vec()),
            MumblePacket::ACL(msg) => (13, msg.encode_to_vec()),
            MumblePacket::QueryUsers(msg) => (14, msg.encode_to_vec()),
            MumblePacket::CryptSetup(msg) => (15, msg.encode_to_vec()),
            MumblePacket::ContextActionModify(msg) => (16, msg.encode_to_vec()),
            MumblePacket::ContextAction(msg) => (17, msg.encode_to_vec()),
            MumblePacket::UserList(msg) => (18, msg.encode_to_vec()),
            MumblePacket::VoiceTarget(msg) => (19, msg.encode_to_vec()),
            MumblePacket::PermissionQuery(msg) => (20, msg.encode_to_vec()),
            MumblePacket::CodecVersion(msg) => (21, msg.encode_to_vec()),
            MumblePacket::UserStats(msg) => (22, msg.encode_to_vec()),
            MumblePacket::RequestBlob(msg) => (23, msg.encode_to_vec()),
            MumblePacket::ServerConfig(msg) => (24, msg.encode_to_vec()),
            MumblePacket::SuggestConfig(msg) => (25, msg.encode_to_vec()),
        };

        dst.reserve(6 + payload.len());
        dst.extend_from_slice(&packet_type.to_be_bytes());
        dst.extend_from_slice(&(payload.len() as u32).to_be_bytes());
        dst.extend_from_slice(&payload);
        Ok(())
    }
}

pub enum MumblePacket {
    Version(Version),
    UDPTunnel(UdpTunnel),
    Authenticate(Authenticate),
    Ping(Ping),
    Reject(Reject),
    ServerSync(ServerSync),
    ChannelRemove(ChannelRemove),
    ChannelState(ChannelState),
    UserRemove(UserRemove),
    UserState(UserState),
    BanList(BanList),
    TextMessage(TextMessage),
    PermissionDenied(PermissionDenied),
    ACL(Acl),
    QueryUsers(QueryUsers),
    CryptSetup(CryptSetup),
    ContextActionModify(ContextActionModify),
    ContextAction(ContextAction),
    UserList(UserList),
    VoiceTarget(VoiceTarget),
    PermissionQuery(PermissionQuery),
    CodecVersion(CodecVersion),
    UserStats(UserStats),
    RequestBlob(RequestBlob),
    ServerConfig(ServerConfig),
    SuggestConfig(SuggestConfig),
}

// --- CLIENT IMPLEMENTATION ---

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use opus::{Application, Channels, Decoder as OpusDecoder, Encoder as OpusEncoder};
use std::collections::VecDeque;
use std::sync::Mutex;
use tauri::Emitter;

type MumbleSink =
    SplitSink<Framed<tokio_rustls::client::TlsStream<TcpStream>, MumbleCodec>, MumblePacket>;

// Simple thread-safe jitter buffer
struct AudioBuffer {
    buffer: VecDeque<f32>,
}

pub struct VoiceClient {
    tx: tokio::sync::mpsc::UnboundedSender<MumblePacket>,
    _shutdown: tokio::sync::oneshot::Sender<()>,
    vad_threshold: Arc<Mutex<f32>>,
}

impl VoiceClient {
    pub fn list_input_devices() -> Vec<String> {
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
        vad_threshold: f32,
    ) -> Result<Self> {
        let addr = format!("{}:{}", host, port);
        // ... (connection logic, handshake)

        let socket = TcpStream::connect(&addr).await?;
        let mut root_store = RootCertStore::empty();
        for cert in rustls_native_certs::load_native_certs().certs {
            let _ = root_store.add(cert);
        }

        let config = ClientConfig::builder()
            .with_root_certificates(root_store)
            .with_no_client_auth();

        let connector = TlsConnector::from(Arc::new(config));
        let server_name = if host.is_empty() { "localhost" } else { host };
        let dns_name = ServerName::try_from(server_name.to_owned())
            .map_err(|e| anyhow::anyhow!("Invalid TLS server name '{}': {}", server_name, e))?;
        let tls_stream = connector.connect(dns_name, socket).await?;

        let framed = Framed::new(tls_stream, MumbleCodec);
        let (mut sink, mut stream) = framed.split();

        // Create main outgoing channel
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<MumblePacket>();

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

        // --- AUDIO PLAYBACK SETUP ---
        let audio_buffer = Arc::new(Mutex::new(AudioBuffer {
            buffer: VecDeque::new(),
        }));
        let audio_buffer_playback = audio_buffer.clone();

        // 3. Spawn Playback Thread (cpal)
        std::thread::spawn(move || {
            let host = cpal::default_host();
            let device = match host.default_output_device() {
                Some(d) => d,
                None => {
                    eprintln!("No output device available");
                    return;
                }
            };

            let config = match device.default_output_config() {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Failed to get output config: {}", e);
                    return;
                }
            };

            println!(
                "INFO: Output device: {}",
                device.name().unwrap_or("Unknown".into())
            );

            let err_fn = |err| eprintln!("an error occurred on stream: {}", err);

            let stream = match config.sample_format() {
                cpal::SampleFormat::F32 => device.build_output_stream(
                    &config.into(),
                    move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                        if let Ok(mut buf) = audio_buffer_playback.lock() {
                            for sample in data.iter_mut() {
                                if let Some(s) = buf.buffer.pop_front() {
                                    *sample = s;
                                } else {
                                    *sample = 0.0;
                                }
                            }
                        } else {
                            for sample in data.iter_mut() {
                        let Ok(mut buf) = audio_buffer_playback.lock() else {
                            return;
                        };
                        for sample in data.iter_mut() {
                            if let Some(s) = buf.buffer.pop_front() {
                                *sample = s;
                            } else {
                                *sample = 0.0;
                            }
                        }
                    },
                    err_fn,
                    None,
                ),
                _ => {
                    eprintln!("Unsupported sample format");
                    return;
                } // TODO: Support other formats
            };

            if let Ok(s) = stream {
                println!("INFO: Audio playback stream started!");
                let _ = s.play();
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(60));
                }
            }
        });

        // Initialize Opus Decoder
        let mut decoder = OpusDecoder::new(48000, Channels::Mono)?;

        // Clone for Audio Capture Thread
        let tx_audio = tx.clone();

        // Shared VAD threshold
        let vad_threshold_outer = Arc::new(Mutex::new(vad_threshold));
        let vad_threshold_clone = vad_threshold_outer.clone();

        // 4. Start Capture Thread
        let vad_threshold_capture = vad_threshold_clone.clone();
        let selected_device_name = input_device.clone();

        std::thread::spawn(move || {
            let host = cpal::default_host();

            // Select Device
            let device = if let Some(name) = selected_device_name {
                host.input_devices().ok().and_then(|mut devices| {
                    devices.find(|d| d.name().map(|n| n == name).unwrap_or(false))
                })
            } else {
                host.default_input_device()
            };

            let device = match device {
                Some(d) => d,
                None => {
                    eprintln!("No input device found");
                    return;
                }
            };

            println!(
                "INFO: Using Input Device: {}",
                device.name().unwrap_or("Unknown".into())
            );

            let config = match device.default_input_config() {
                Ok(c) => c,
                Err(_) => return,
            };

            let mut encoder = match OpusEncoder::new(48000, Channels::Mono, Application::Voip) {
                Ok(e) => e,
                Err(e) => {
                    tracing::error!("Failed to create Opus encoder: {:?}", e);
                    return;
                }
            };

            println!("INFO: Opus encoder initialized successfully! (Audio Thread)");

            let mut sequence_number = 0u64;

            let stream = device.build_input_stream(
                &config.into(),
                move |data: &[f32], _: &_| {
                    // VAD Check
                    let mut sum_sq = 0.0;
                    for &sample in data {
                        sum_sq += sample * sample;
                    }
                    let rms = (sum_sq / data.len() as f32).sqrt();
                    let threshold = match vad_threshold_capture.lock() {
                        Ok(v) => *v,
                    let threshold = if let Ok(v) = vad_threshold_capture.lock() {
                        *v
                    } else {
                        return;
                    let threshold = match vad_threshold_capture.lock() {
                        Ok(value) => *value,
                        Err(_) => return,
                    };

                    if rms < threshold {
                        // Silence - do not transmit
                        return;
                    }

                    let i16_samples: Vec<i16> = data
                        .iter()
                        .map(|&s| (s.clamp(-1.0, 1.0) * 32767.0) as i16)
                        .collect();

                    if i16_samples.len() >= 480 {
                        let mut output = [0u8; 1500];
                        match encoder.encode(&i16_samples, &mut output) {
                            Ok(len) => {
                                let opus_data = &output[..len];
                                let header_byte = (4u8 << 5) | (0 & 0x1F);
                                let mut i = sequence_number;
                                let mut packet = Vec::with_capacity(1 + 10 + len);
                                packet.push(header_byte);

                                // Simple Varint writer
                                loop {
                                    let mut byte = (i & 0x7F) as u8;
                                    i >>= 7;
                                    if i != 0 {
                                        byte |= 0x80;
                                        packet.push(byte);
                                    } else {
                                        packet.push(byte);
                                        break;
                                    }
                                }

                                sequence_number += 1;
                                packet.extend_from_slice(opus_data);

                                let tunnel_msg = UdpTunnel { packet };
                                let _ = tx_audio.send(MumblePacket::UDPTunnel(tunnel_msg));
                            }
                            Err(_e) => {}
                        }
                    }
                },
                move |err| {
                    eprintln!("Audio error: {}", err);
                },
                None,
            );

            if let Ok(s) = stream {
                println!("INFO: Audio capture stream started!");
                let _ = s.play();
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(60));
                }
            }
        });

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
                                        // Emit event to Frontend
                                        println!("RUST: Received UserState: {:?}", user);
                                        match app.emit("user_update", user) {
                                            Ok(_) => println!("RUST: Automatically emitted user_update"),
                                            Err(e) => println!("RUST: Failed to emit user_update: {}", e),
                                        }
                                    },
                                    MumblePacket::UserRemove(remove) => {
                                        println!("User Removed: {:?}", remove);
                                        let _ = app.emit("user_remove", remove);
                                    },
                                    MumblePacket::ChannelState(channel) => {
                                        println!("Channel Update: {:?}", channel);
                                        let _ = app.emit("channel_update", channel);
                                    },
                                    MumblePacket::ChannelRemove(remove) => {
                                        println!("Channel Remove: {:?}", remove);
                                        let _ = app.emit("channel_remove", remove);
                                    },
                                    MumblePacket::TextMessage(msg) => {
                                        println!("RUST: Received TextMessage: {:?}", msg);
                                        let _ = app.emit("text_message", msg);
                                    },
                                    MumblePacket::UDPTunnel(udp) => {
                                        // DECODE AND PLAY
                                        // Format: [Header][Seq][Opus]
                                        let packet = udp.packet;
                                        if packet.len() > 2 {
                                            // Simple parser:
                                            // 1. Header (1 byte, assume type 4)
                                            // 2. Client-Seq (Varint)
                                            // 3. Payload

                                            // Skip header
                                            let mut idx = 1;

                                            // Skip Varint (Seq)
                                            loop {
                                                if idx >= packet.len() { break; }
                                                let byte = packet[idx];
                                                idx += 1;
                                                if (byte & 0x80) == 0 { break; }
                                            }

                                            if idx < packet.len() {
                                                let opus_data = &packet[idx..];
                                                let mut pcm = [0.0f32; 1920]; // Max frame size

                                                match decoder.decode_float(opus_data, &mut pcm, false) {
                                                    Ok(samples) => {
                                                        // Push to buffer
                                                        if let Ok(mut buf) = audio_buffer.lock() {
                                                            for i in 0..samples {
                                                                buf.buffer.push_back(pcm[i]);
                                                            for sample in pcm.iter().take(samples) {
                                                                buf.buffer.push_back(*sample);
                                                            }

                                                            // Prevent buffer bloat
                                                            if buf.buffer.len() > 48000 { // 1 sec
                                                                let to_remove = buf.buffer.len() - 48000;
                                                                buf.buffer.drain(0..to_remove);
                                                            }
                                                        let Ok(mut buf) = audio_buffer.lock() else {
                                                            return;
                                                        };
                                                        for i in 0..samples {
                                                            buf.buffer.push_back(pcm[i]);
                                                        }

                                                        // Prevent buffer bloat
                                                        if buf.buffer.len() > 48000 { // 1 sec
                                                            let to_remove = buf.buffer.len() - 48000;
                                                            buf.buffer.drain(0..to_remove);
                                                        }
                                                    }
                                                    Err(e) => eprintln!("Decode error: {:?}", e),
                                                }
                                            }
                                        }
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

        Ok(Self {
            tx,
            _shutdown: shutdown_tx,
            vad_threshold: vad_threshold_outer,
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
        let _ = self.tx.send(MumblePacket::TextMessage(msg));
    }

    pub fn join_channel(&self, channel_id: u32) {
        println!("RUST: Sending UserState to move to channel {}", channel_id);
        let mut msg = UserState::default();
        msg.channel_id = Some(channel_id);
        let _ = self.tx.send(MumblePacket::UserState(msg));
    }

    pub fn set_mute(&self, mute: bool) {
        let mut msg = UserState::default();
        msg.self_mute = Some(mute);
        let _ = self.tx.send(MumblePacket::UserState(msg));
    }

    pub fn set_deaf(&self, deaf: bool) {
        let mut msg = UserState::default();
        msg.self_deaf = Some(deaf);
        // If deaf, also mute (usually client enforces this)
        if deaf {
            msg.self_mute = Some(true);
        }
        let _ = self.tx.send(MumblePacket::UserState(msg));
    }
}
