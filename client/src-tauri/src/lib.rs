use tauri::image::Image;
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager}; // Manager trait for emit
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use device_query::{DeviceQuery, DeviceState, Keycode};

struct PttState {
    enabled: Mutex<bool>,
    key: Mutex<Option<Keycode>>,
}

struct AppState {
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
    println!("Starting Vvoice Tauri Client (WebRTC Mode)...");

    let ptt = Arc::new(PttState {
        enabled: Mutex::new(false),
        key: Mutex::new(Some(Keycode::F12)), // Default
    });

    let ptt_state_clone = ptt.clone();

    tauri::Builder::default()
        .manage(AppState {
            ptt: ptt,
        })
        .setup(move |app| {
            // Load icons
             if let Ok(tray_image) = Image::from_bytes(include_bytes!("../icons/vvoice2.png")) {
                let _ = TrayIconBuilder::new()
                    .icon(tray_image)
                    .tooltip("Vvoice")
                    .build(app)?;
            }

            // Spawn PTT Thread using AppHandle for emitting events
            let app_handle = app.handle().clone();
            let ptt_thread = ptt_state_clone.clone();

            thread::spawn(move || {
                let device_state = DeviceState::new();
                let mut was_pressed = false;
                
                loop {
                    thread::sleep(Duration::from_millis(30)); 

                    let enabled = {
                        match ptt_thread.enabled.lock() {
                            Ok(guard) => *guard,
                            Err(_) => false
                        }
                    };

                    if !enabled {
                        was_pressed = false; 
                        continue; 
                    }

                    let key_opt = {
                        match ptt_thread.key.lock() {
                            Ok(guard) => guard.clone(),
                            Err(_) => None
                        }
                    };

                    if let Some(ref key) = key_opt {
                        let keys = device_state.get_keys();
                        let is_pressed = keys.contains(key);

                        if is_pressed != was_pressed {
                             println!("PTT Global Action: Pressed={}", is_pressed);
                             // Emit event to frontend
                             let _ = app_handle.emit("ptt_event", is_pressed);
                             was_pressed = is_pressed;
                        }
                    }
                }
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            set_ptt_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
