mod mumble;
use mumble::VoiceClient;
use tauri::image::Image;
use tauri::tray::TrayIconBuilder;
use tokio::sync::Mutex;

struct AppState {
    client: Mutex<Option<VoiceClient>>,
}

#[tauri::command]
async fn connect_voice(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    username: String,
    password: String,
    input_device: Option<String>,
    vad_threshold: Option<f32>,
) -> Result<(), String> {
    println!(
        "Connecting as {} (Device: {:?}, VAD: {:?})...",
        username, input_device, vad_threshold
    );
    let mut client_lock = state.client.lock().await;
    // Default VAD to 0.01 if not provided
    let threshold = vad_threshold.unwrap_or(0.01);

    match VoiceClient::connect(
        app,
        "127.0.0.1",
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
async fn set_deaf(state: tauri::State<'_, AppState>, deaf: bool) -> Result<(), String> {
    let client_lock = state.client.lock().await;
    if let Some(client) = &*client_lock {
        client.set_deaf(deaf);
        Ok(())
    } else {
        Err("Not connected".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();
    println!("Starting Vvoice Tauri Client...");

    tauri::Builder::default()
        .manage(AppState {
            client: Mutex::new(None),
        })
        .setup(|app| {
            let tray_image = Image::from_bytes(include_bytes!("../icons/vvoice2.png"))?;
            let _tray = TrayIconBuilder::new()
                .icon(tray_image)
                .tooltip("Vvoice")
                .build(app)?;
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            connect_voice,
            disconnect_voice,
            send_message,
            join_channel,
            set_mute,
            set_deaf,
            get_input_devices,
            set_vad_threshold
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
