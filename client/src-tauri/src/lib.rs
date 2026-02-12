mod audio;
mod mumble;
use mumble::VoiceClient;
use tauri::image::Image;
use tauri::tray::TrayIconBuilder;
use tokio::sync::Mutex;
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use device_query::{DeviceQuery, DeviceState, Keycode};

struct PttState {
    enabled: std::sync::Mutex<bool>,
    key: std::sync::Mutex<Option<Keycode>>,
}

struct AppState {
    client: Arc<Mutex<Option<VoiceClient>>>,
    ptt: Arc<PttState>,
}

fn parse_keycode(s: &str) -> Option<Keycode> {
    let s = s.to_uppercase();
    match s.as_str() {
        "F1" => Some(Keycode::F1), "F2" => Some(Keycode::F2), "F3" => Some(Keycode::F3),
        "F4" => Some(Keycode::F4), "F5" => Some(Keycode::F5), "F6" => Some(Keycode::F6),
        "F7" => Some(Keycode::F7), "F8" => Some(Keycode::F8), "F9" => Some(Keycode::F9),
        "F10" => Some(Keycode::F10), "F11" => Some(Keycode::F11), "F12" => Some(Keycode::F12),
        "SPACE" => Some(Keycode::Space), "LCONTROL" => Some(Keycode::LControl), "RCONTROL" => Some(Keycode::RControl),
        "LSHIFT" => Some(Keycode::LShift), "RSHIFT" => Some(Keycode::RShift), "LALT" => Some(Keycode::LAlt),
        "RALT" => Some(Keycode::RAlt), "ENTER" => Some(Keycode::Enter),
        k if k.len() == 1 => {
             // Handle A-Z, 0-9 roughly
             let c = k.chars().next().unwrap();
             match c {
                 'A' => Some(Keycode::A), 'B' => Some(Keycode::B), 'C' => Some(Keycode::C),
                 'D' => Some(Keycode::D), 'E' => Some(Keycode::E), 'F' => Some(Keycode::F),
                 'G' => Some(Keycode::G), 'H' => Some(Keycode::H), 'I' => Some(Keycode::I),
                 'J' => Some(Keycode::J), 'K' => Some(Keycode::K), 'L' => Some(Keycode::L),
                 'M' => Some(Keycode::M), 'N' => Some(Keycode::N), 'O' => Some(Keycode::O),
                 'P' => Some(Keycode::P), 'Q' => Some(Keycode::Q), 'R' => Some(Keycode::R),
                 'S' => Some(Keycode::S), 'T' => Some(Keycode::T), 'U' => Some(Keycode::U),
                 'V' => Some(Keycode::V), 'W' => Some(Keycode::W), 'X' => Some(Keycode::X),
                 'Y' => Some(Keycode::Y), 'Z' => Some(Keycode::Z),
                 '0' => Some(Keycode::Key0), '1' => Some(Keycode::Key1), '2' => Some(Keycode::Key2),
                 '3' => Some(Keycode::Key3), '4' => Some(Keycode::Key4), '5' => Some(Keycode::Key5),
                 '6' => Some(Keycode::Key6), '7' => Some(Keycode::Key7), '8' => Some(Keycode::Key8),
                 '9' => Some(Keycode::Key9),
                 _ => None,
             }
        }
        _ => None,
    }
}

#[tauri::command]
#[tauri::command]
async fn connect_voice(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    username: String,
    password: String,
    input_device: Option<String>,
    vad_threshold: Option<f32>,
    server_address: Option<String>,
) -> Result<(), String> {
    println!(
        "Connecting as {} to {:?} (Device: {:?}, VAD: {:?})...",
        username, server_address, input_device, vad_threshold
    );
    let mut client_lock = state.client.lock().await; // Works same with Arc<Mutex>
    // Default VAD to 0.01 if not provided
    let threshold = vad_threshold.unwrap_or(0.01);
    let host = server_address.unwrap_or_else(|| "127.0.0.1".to_string());

    match VoiceClient::connect(
        app,
        &host,
        64738,
        &username,
        &password,
        input_device,
        threshold,
    )
    .await
    {
        Ok(client) => {
            println!("Successfully connected!");
            *client_lock = Some(client);
            Ok(())
        }
        Err(e) => {
            println!("Failed to connect: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn get_input_devices() -> Result<Vec<String>, String> {
    Ok(VoiceClient::list_input_devices())
}

#[tauri::command]
async fn set_vad_threshold(
    state: tauri::State<'_, AppState>,
    threshold: f32,
) -> Result<(), String> {
    let client_lock = state.client.lock().await;
    if let Some(client) = &*client_lock {
        client.set_vad_threshold(threshold);
        Ok(())
    } else {
        Err("Not connected".into())
    }
}

#[tauri::command]
async fn disconnect_voice(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut client_lock = state.client.lock().await;
    *client_lock = None;
    Ok(())
}

#[tauri::command]
async fn send_message(state: tauri::State<'_, AppState>, message: String) -> Result<(), String> {
    let client_lock = state.client.lock().await;
    if let Some(client) = &*client_lock {
        client.send_message(message);
        Ok(())
    } else {
        Err("Not connected".into())
    }
}

#[tauri::command]
async fn join_channel(state: tauri::State<'_, AppState>, channel_id: u32) -> Result<(), String> {
    println!("Invoked join_channel: {}", channel_id);
    let client_lock = state.client.lock().await;
    if let Some(client) = &*client_lock {
        client.join_channel(channel_id);
        Ok(())
    } else {
        Err("Not connected".into())
    }
}

#[tauri::command]
async fn set_mute(state: tauri::State<'_, AppState>, mute: bool) -> Result<(), String> {
    let client_lock = state.client.lock().await;
    if let Some(client) = &*client_lock {
        client.set_mute(mute);
        Ok(())
    } else {
        Err("Not connected".into())
    }
}

#[tauri::command]
async fn set_profile(state: tauri::State<'_, AppState>, avatar_url: Option<String>, bio: Option<String>) -> Result<(), String> {
    let client_lock = state.client.lock().await;
    if let Some(client) = &*client_lock {
        client.set_profile(avatar_url, bio);
        Ok(())
    } else {
        Err("Not connected".into())
    }
}

#[tauri::command]
async fn set_deaf(state: tauri::State<'_, AppState>, deaf: bool) -> Result<(), String> {
    let client_lock = state.client.lock().await;
    if let Some(client) = &*client_lock {
        client.set_deaf(deaf);
        Ok(())
    } else {
        Err("Not connected".into())
    }
}

#[tauri::command]
async fn set_ptt_config(state: tauri::State<'_, AppState>, enabled: bool, key: Option<String>) -> Result<(), String> {
    if let Ok(mut e) = state.ptt.enabled.lock() {
        *e = enabled;
    }
    if let Ok(mut k) = state.ptt.key.lock() {
        if let Some(key_str) = key {
            *k = parse_keycode(&key_str);
            println!("PTT Config: Enabled={}, Key={:?} (from '{}')", enabled, *k, key_str);
        } else {
            *k = None;
             println!("PTT Config: Enabled={}, Key=None", enabled);
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();
    println!("Starting Vvoice Tauri Client...");

    let client: Arc<Mutex<Option<VoiceClient>>> = Arc::new(Mutex::new(None));
    let ptt = Arc::new(PttState {
        enabled: std::sync::Mutex::new(false),
        key: std::sync::Mutex::new(Some(Keycode::F12)), // Default
    });

    // PTT Thread
    let client_thread = client.clone();
    let ptt_thread = ptt.clone();
    
    thread::spawn(move || {
        let device_state = DeviceState::new();
        let mut was_pressed = false;
        
        loop {
            thread::sleep(Duration::from_millis(30)); 

            let enabled = {
                *ptt_thread.enabled.lock().unwrap()
            };

            if !enabled {
                // If PTT disabled, we don't control mute state automatically here?
                // Or should we ensure unmuted?
                // Let's assume standard mode (VAD/Open Mic) means we don't interfere.
                was_pressed = false; 
                continue; 
            }

            let key_opt = {
                ptt_thread.key.lock().unwrap().clone()
            };

            if let Some(ref key) = key_opt {
                let keys = device_state.get_keys();
                let is_pressed = keys.contains(key);

                if is_pressed != was_pressed {
                     // State changed
                     // Access client synchronously
                     {
                         let guard = client_thread.blocking_lock();
                         if let Some(client) = &*guard {
                             // Pressed = Unmuted (False)
                             // Released = Muted (True)
                             client.set_mute(!is_pressed);
                             println!("PTT Action: Pressed={}, Muted={}", is_pressed, !is_pressed);
                         }
                     }
                     was_pressed = is_pressed;
                }
            }
        }
    });

    let run_result = tauri::Builder::default()
        .manage(AppState {
            client: client,
            ptt: ptt,
        })
        .setup(|app| {
            // Load icons... (keep existing logic)
             if let Ok(tray_image) = Image::from_bytes(include_bytes!("../icons/vvoice2.png")) {
                let _ = TrayIconBuilder::new()
                    .icon(tray_image)
                    .tooltip("Vvoice")
                    .build(app)?;
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        // .plugin(tauri_plugin_global_shortcut::Builder::new().build()) // Removed, using internal poll
        .invoke_handler(tauri::generate_handler![
            connect_voice,
            disconnect_voice,
            send_message,
            join_channel,
            set_mute,
            set_deaf,
            get_input_devices,
            set_vad_threshold,
            set_ptt_config,
            set_profile
        ])
        .run(tauri::generate_context!());

    if let Err(e) = run_result {
        eprintln!("error while running tauri application: {}", e);
    }
}
