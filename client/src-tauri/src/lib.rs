mod mumble;
use mumble::VoiceClient;
use tokio::sync::Mutex;

struct AppState {
    client: Mutex<Option<VoiceClient>>,
}

#[tauri::command]
async fn connect_voice(app: tauri::AppHandle, state: tauri::State<'_, AppState>, username: String) -> Result<(), String> {
    println!("Connecting to voice as {}...", username);
    let mut client_lock = state.client.lock().await;
    match VoiceClient::connect(app, "127.0.0.1", 64738, &username).await {
        Ok(client) => {
            println!("Successfully connected!");
            *client_lock = Some(client);
            Ok(())
        },
        Err(e) => {
            println!("Failed to connect: {}", e);
            Err(e.to_string())
        }
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();
    println!("Starting Vvoice Tauri Client...");

    tauri::Builder::default()
        .manage(AppState {
            client: Mutex::new(None),
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![connect_voice, disconnect_voice, send_message])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
