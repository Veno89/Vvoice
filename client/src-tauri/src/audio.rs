use crate::mumble::{MumblePacket, UdpTunnel};
use anyhow::{anyhow, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use opus::{Application, Channels, Decoder as OpusDecoder, Encoder as OpusEncoder};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;

// Simple thread-safe jitter buffer
struct AudioBuffer {
    buffer: VecDeque<f32>,
}

pub struct AudioSystem {
    audio_buffer: Arc<Mutex<AudioBuffer>>,
    // We keep the streams alive by holding a shutdown channel.
    // The streams themselves live in their own threads.
    _input_shutdown: Option<std::sync::mpsc::Sender<()>>,
    _output_shutdown: Option<std::sync::mpsc::Sender<()>>,
    decoder: Arc<Mutex<OpusDecoder>>,
    mute_state: Arc<Mutex<bool>>,
}

impl AudioSystem {
    pub fn new() -> Result<Self> {
        let decoder = OpusDecoder::new(48000, Channels::Mono)?;
        
        Ok(Self {
            audio_buffer: Arc::new(Mutex::new(AudioBuffer {
                buffer: VecDeque::new(),
            })),
            _input_shutdown: None,
            _output_shutdown: None,
            decoder: Arc::new(Mutex::new(decoder)),
            mute_state: Arc::new(Mutex::new(false)),
        })
    }

    pub fn start_playback(&mut self) -> Result<()> {
        let audio_buffer_playback = self.audio_buffer.clone();
        let host = cpal::default_host();
        let device = host
            .default_output_device()
            .ok_or_else(|| anyhow!("No output device available"))?;

        let _config = device.default_output_config()?;
        println!(
            "INFO: Output device: {}",
            device.name().unwrap_or("Unknown".into())
        );

        let _err_fn = |err: cpal::StreamError| eprintln!("an error occurred on output stream: {}", err);

        let (tx, rx) = std::sync::mpsc::channel::<()>();
        
        std::thread::spawn(move || {
            let stream_result = (|| -> Result<cpal::Stream> {
                 let host = cpal::default_host();
                 let device = host.default_output_device().ok_or_else(|| anyhow!("No output device"))?;
                 let config = device.default_output_config()?;
                 let err_fn = |err| eprintln!("Output stream error: {}", err);
                 
                 // We need to move buf inside
                 // But wait, audio_buffer_playback is Arc<Mutex<...>> so it IS Send (if Mutex is Send, which it is).
                 
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
                                for sample in data.iter_mut() { *sample = 0.0; }
                            }
                        },
                        err_fn,
                        None,
                    )?,
                    _ => return Err(anyhow!("Unsupported sample format")),
                };
                stream.play()?;
                Ok(stream)
            })();

            match stream_result {
                Ok(_stream) => {
                    println!("Audio Playback Started");
                    // Keep stream alive until signal
                    let _ = rx.recv();
                    println!("Audio Playback Stopped");
                }
                Err(e) => eprintln!("Failed to start playback: {}", e),
            }
        });

        self._output_shutdown = Some(tx);
        Ok(())
    }

    pub fn set_mute(&self, mute: bool) {
        if let Ok(mut m) = self.mute_state.lock() {
            *m = mute;
        }
    }

    pub fn start_capture(
        &mut self,
        tx: mpsc::Sender<MumblePacket>,
        vad_threshold: Arc<Mutex<f32>>,
        input_device_name: Option<String>,
    ) -> Result<()> {
        let (tx_shutdown, rx_shutdown) = std::sync::mpsc::channel::<()>();
        let mute_state = self.mute_state.clone();

        std::thread::spawn(move || {
             let stream_result = (|| -> Result<cpal::Stream> {
                let host = cpal::default_host();
                let device = if let Some(name) = input_device_name {
                    host.input_devices()?
                        .find(|d| d.name().map(|n| n == name).unwrap_or(false))
                        .ok_or_else(|| anyhow!("Selected input device not found"))?
                } else {
                    host.default_input_device()
                        .ok_or_else(|| anyhow!("No input device found"))?
                };

                println!("INFO: Using Input Device: {}", device.name().unwrap_or("Unknown".into()));

                let config = device.default_input_config()?;
                let mut encoder = OpusEncoder::new(48000, Channels::Mono, Application::Voip)?;
                let mut sequence_number = 0u64;
                let err_fn = |err: cpal::StreamError| eprintln!("Input stream error: {}", err);
                
                let stream = device.build_input_stream(
                    &config.into(),
                    move |data: &[f32], _: &_| {
                         // Mute Check
                         if *mute_state.lock().unwrap() {
                             return;
                         }

                         // VAD Check
                        let mut sum_sq = 0.0;
                        for &sample in data {
                            sum_sq += sample * sample;
                        }
                        let rms = (sum_sq / data.len() as f32).sqrt();
                        
                        let threshold = match vad_threshold.lock() {
                            Ok(v) => *v,
                            Err(_) => return,
                        };

                        if rms < threshold { return; }

                        let i16_samples: Vec<i16> = data.iter().map(|&s| (s.clamp(-1.0, 1.0) * 32767.0) as i16).collect();

                        if i16_samples.len() >= 480 {
                            let mut output = [0u8; 1500];
                            match encoder.encode(&i16_samples, &mut output) {
                                Ok(len) => {
                                    let opus_data = &output[..len];
                                    let header_byte = (4u8 << 5) | (0 & 0x1F);
                                    let mut packet = Vec::with_capacity(1 + 10 + len);
                                    packet.push(header_byte);

                                    let mut i = sequence_number;
                                    loop {
                                        let mut byte = (i & 0x7F) as u8;
                                        i >>= 7;
                                        if i != 0 { byte |= 0x80; packet.push(byte); } else { packet.push(byte); break; }
                                    }
                                    sequence_number = sequence_number.wrapping_add(1);
                                    packet.extend_from_slice(opus_data);

                                    let tunnel_msg = UdpTunnel { packet };
                                    let _ = tx.try_send(MumblePacket::UDPTunnel(tunnel_msg));
                                }
                                Err(e) => eprintln!("Opus encode error: {:?}", e),
                            }
                        }
                    },
                    err_fn,
                    None
                )?;
                stream.play()?;
                Ok(stream)
             })();
             
             match stream_result {
                Ok(_stream) => {
                    println!("Audio Capture Started");
                    let _ = rx_shutdown.recv();
                    println!("Audio Capture Stopped");
                }
                Err(e) => eprintln!("Failed to start capture: {}", e),
             }
        });

        self._input_shutdown = Some(tx_shutdown);
        Ok(())
    }

    pub fn decode_and_play(&self, packet: &[u8]) {
        if packet.len() <= 2 {
            return;
        }

        // Simple parser to skip Header + Seq
        let mut idx = 1;
        loop {
            if idx >= packet.len() {
                return;
            }
            let byte = packet[idx];
            idx += 1;
            if (byte & 0x80) == 0 {
                break;
            }
        }

        if idx < packet.len() {
            let opus_data = &packet[idx..];
            let mut pcm = [0.0f32; 1920]; // Max frame size

            if let Ok(mut decoder) = self.decoder.lock() {
                 match decoder.decode_float(opus_data, &mut pcm, false) {
                    Ok(samples) => {
                        if let Ok(mut buf) = self.audio_buffer.lock() {
                            for i in 0..samples {
                                buf.buffer.push_back(pcm[i]);
                            }
                            // Prevent buffer bloat (1 sec limit)
                            if buf.buffer.len() > 48000 {
                                let to_remove = buf.buffer.len() - 48000;
                                buf.buffer.drain(0..to_remove);
                            }
                        }
                    }
                    Err(e) => eprintln!("Opus decode error: {:?}", e),
                }
            }
        }
    }
}
