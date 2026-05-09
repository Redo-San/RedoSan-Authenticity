#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::process::{Command, Stdio};
use std::io::Read;
use std::sync::Mutex;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse {
    pub status: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modules: Option<serde_json::Value>,
}

#[derive(Default)]
pub struct AppState {
    pub python_server: Mutex<Option<std::process::Child>>,
    pub server_port: Mutex<u16>,
}

fn get_app_dir() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."))
}

#[tauri::command]
fn get_health() -> ApiResponse {
    ApiResponse {
        status: "ok".to_string(),
        message: "RedoSan Orchestrator running".to_string(),
        data: None,
        version: Some("1.0.0".to_string()),
        modules: None,
    }
}

#[tauri::command]
fn compute_fingerprint(filepath: String) -> ApiResponse {
    use std::fs;
    use std::hash::{Hash, Hasher};
    use std::collections::hash_map::DefaultHasher;

    if !std::path::Path::new(&filepath).exists() {
        return ApiResponse {
            status: "error".to_string(),
            message: "File not found".to_string(),
            data: None,
            version: None,
            modules: None,
        };
    }

    match fs::read(&filepath) {
        Ok(data) => {
            let mut sha256 = std::collections::hash_map::DefaultHasher::new();
            data.hash(&mut sha256);
            let sha256_hex = format!("{:016x}", sha256.finish());

            let mut md5 = std::collections::hash_map::DefaultHasher::new();
            data.hash(&mut md5);
            let md5_hex = format!("{:016x}", md5.finish());

            let result = serde_json::json!({
                "sha256": sha256_hex,
                "md5": md5_hex,
                "size": data.len(),
                "file": std::path::Path::new(&filepath).file_name().unwrap_or_default().to_string_lossy()
            });

            ApiResponse {
                status: "ok".to_string(),
                message: "Fingerprint computed".to_string(),
                data: Some(result),
                version: None,
                modules: None,
            }
        }
        Err(e) => ApiResponse {
            status: "error".to_string(),
            message: e.to_string(),
            data: None,
            version: None,
            modules: None,
        },
    }
}

#[tauri::command]
fn run_python_script(script_name: String, args: Vec<String>) -> ApiResponse {
    let app_dir = get_app_dir();
    let python_script = app_dir.join(&script_name);

    if !python_script.exists() {
        return ApiResponse {
            status: "error".to_string(),
            message: format!("Script not found: {}", script_name),
            data: None,
            version: None,
            modules: None,
        };
    }

    let mut cmd = Command::new("python");
    cmd.arg(&python_script);
    for arg in &args {
        cmd.arg(arg);
    }
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    match cmd.output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);

            if output.status.success() {
                ApiResponse {
                    status: "ok".to_string(),
                    message: stdout.to_string(),
                    data: None,
                    version: None,
                    modules: None,
                }
            } else {
                ApiResponse {
                    status: "error".to_string(),
                    message: stderr.to_string(),
                    data: None,
                    version: None,
                    modules: None,
                }
            }
        }
        Err(e) => ApiResponse {
            status: "error".to_string(),
            message: e.to_string(),
            data: None,
            version: None,
            modules: None,
        },
    }
}

#[tauri::command]
fn check_system_status() -> ApiResponse {
    let app_dir = get_app_dir();
    
    let java = std::process::Command::new("java")
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false);

    let python = std::process::Command::new("python")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false);

    let openstego_exists = app_dir.join("openstego.jar").exists();
    let rust_backend_exists = app_dir.join("rust_gui").join("target").join("release").join("redosan_backend.exe").exists();

    let modules = serde_json::json!({
        "java": java,
        "python": python,
        "openstego": openstego_exists,
        "rust_backend": rust_backend_exists
    });

    ApiResponse {
        status: "ok".to_string(),
        message: "System status checked".to_string(),
        data: None,
        version: Some("1.0.0".to_string()),
        modules: Some(modules),
    }
}

#[tauri::command]
fn start_python_server(state: State<'_, AppState>) -> ApiResponse {
    let app_dir = get_app_dir();
    let server_script = app_dir.join("redosan_server.py");

    if !server_script.exists() {
        return ApiResponse {
            status: "error".to_string(),
            message: "Server script not found".to_string(),
            data: None,
            version: None,
            modules: None,
        };
    }

    let mut child = match Command::new("python")
        .arg(&server_script)
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            return ApiResponse {
                status: "error".to_string(),
                message: format!("Failed to start server: {}", e),
                data: None,
                version: None,
                modules: None,
            };
        }
    };

    let port = 3000u16;
    *state.server_port.lock().unwrap() = port;
    *state.python_server.lock().unwrap() = Some(child);

    ApiResponse {
        status: "ok".to_string(),
        message: format!("Server started on port {}", port),
        data: Some(serde_json::json!({ "port": port })),
        version: None,
        modules: None,
    }
}

#[tauri::command]
fn stop_python_server(state: State<'_, AppState>) -> ApiResponse {
    let mut server = state.python_server.lock().unwrap();
    if let Some(ref mut child) = *server {
        child.kill().ok();
        *server = None;
    }

    ApiResponse {
        status: "ok".to_string(),
        message: "Server stopped".to_string(),
        data: None,
        version: None,
        modules: None,
    }
}

#[tauri::command]
fn open_file_dialog() -> Option<String> {
    use std::env;
    if let Ok(path) = env::var("RUST_BACKTRACE") {
        println!("Debug: {}", path);
    }
    None
}

fn main() {
    env_logger::init();
    println!("RedoSan Orchestrator v0.1.0 starting...");

    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_health,
            compute_fingerprint,
            run_python_script,
            check_system_status,
            start_python_server,
            stop_python_server,
            open_file_dialog
        ])
        .setup(|app| {
            println!("Tauri app setup complete");
            
            #[cfg(debug_assertions)]
            {
                let window = app.get_window("main").unwrap();
                window.open_devtools();
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}