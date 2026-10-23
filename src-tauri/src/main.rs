#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

/// Native "Save As" for a result file: shows the OS dialog on the main
/// thread (rfd requires it), then writes the bytes only after the user
/// confirms a location. Returns the final path, or None when cancelled.
/// The bytes are moved into the dialog closure so nothing is written
/// before the user picks a spot.
#[tauri::command]
async fn save_result_file(
    app: tauri::AppHandle,
    default_name: String,
    bytes: Vec<u8>,
) -> Result<Option<String>, String> {
    let start_dir = app.path().download_dir().ok();
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let mut dialog = rfd::FileDialog::new().set_file_name(&default_name);
        if let Some(dir) = start_dir {
            dialog = dialog.set_directory(dir);
        }
        let result = match dialog.save_file() {
            Some(path) => std::fs::write(&path, bytes)
                .map(|()| Some(path.to_string_lossy().into_owned()))
                .map_err(|e| e.to_string()),
            None => Ok(None),
        };
        let _ = tx.send(result);
    })
    .map_err(|e| e.to_string())?;
    rx.recv().map_err(|_| "dialog-channel-closed".to_string())?
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![save_result_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
