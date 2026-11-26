use chrono::Utc;
use serde_json::{json, Value};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};
use uuid::Uuid;

struct AppState {
    write_lock: Mutex<()>,
    last_backup_ms: Mutex<u128>,
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn user_data_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_local_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("com.abdo.chunktrainer"))
}

fn state_file_path(app: &AppHandle) -> PathBuf {
    user_data_dir(app).join("progress.json")
}

fn backup_dir_path(app: &AppHandle) -> PathBuf {
    user_data_dir(app).join("backups")
}

/// Atomic JSON writer with Windows antivirus/OneDrive rename retry & fsync.
fn write_json_atomic(path: &Path, value: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("mkdir failed: {}", e))?;
    }
    let tmp_name = format!(
        "{}.{}.{}.tmp",
        path.file_name().unwrap_or_default().to_string_lossy(),
        std::process::id(),
        &Uuid::new_v4().to_string()[..8]
    );
    let tmp_path = path.with_file_name(tmp_name);

    let payload = serde_json::to_string_pretty(value).map_err(|e| format!("serialize failed: {}", e))?;
    {
        let mut file = fs::File::create(&tmp_path).map_err(|e| format!("create tmp failed: {}", e))?;
        file.write_all(payload.as_bytes()).map_err(|e| format!("write tmp failed: {}", e))?;
        file.sync_all().map_err(|e| format!("fsync failed: {}", e))?;
    }

    let mut renamed = false;
    for attempt in 0..5 {
        if fs::rename(&tmp_path, path).is_ok() {
            renamed = true;
            break;
        }
        std::thread::sleep(Duration::from_millis(20 * (1u64 << attempt)));
    }
    if !renamed {
        fs::copy(&tmp_path, path).map_err(|e| format!("fallback copy failed: {}", e))?;
        let _ = fs::remove_file(&tmp_path);
    }
    Ok(())
}

fn snapshot_backup(app: &AppHandle, state: &State<AppState>, force: bool) {
    let now = now_ms();
    let mut last = state.last_backup_ms.lock().unwrap();
    if !force && now.saturating_sub(*last) < 5 * 60 * 1000 {
        return;
    }
    let src = state_file_path(app);
    if !src.exists() {
        return;
    }
    let bdir = backup_dir_path(app);
    if fs::create_dir_all(&bdir).is_err() {
        return;
    }
    let stamp = Utc::now().format("%Y-%m-%dT%H-%M-%S").to_string();
    let dst = bdir.join(format!("progress-{}.json", stamp));
    if fs::copy(&src, &dst).is_ok() {
        *last = now;
        if let Ok(entries) = fs::read_dir(&bdir) {
            let mut files: Vec<PathBuf> = entries
                .flatten()
                .map(|e| e.path())
                .filter(|p| p.extension().and_then(|s| s.to_str()) == Some("json"))
                .collect();
            files.sort();
            if files.len() > 16 {
                for stale in &files[..files.len() - 16] {
                    let _ = fs::remove_file(stale);
                }
            }
        }
    }
}

#[tauri::command]
fn state_load(app: AppHandle) -> Result<Value, String> {
    let file = state_file_path(&app);
    let dir = user_data_dir(&app);
    if !file.exists() {
        return Ok(json!({
            "state": Value::Null,
            "path": file.to_string_lossy(),
            "dir": dir.to_string_lossy(),
            "recoveredFromBackup": false
        }));
    }

    match fs::read_to_string(&file).and_then(|txt| {
        serde_json::from_str::<Value>(&txt)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))
    }) {
        Ok(parsed) => Ok(json!({
            "state": parsed,
            "path": file.to_string_lossy(),
            "dir": dir.to_string_lossy(),
            "recoveredFromBackup": false
        })),
        Err(_) => {
            // Preserve corrupt file and auto-recover from latest healthy backup
            let stamp = Utc::now().format("%Y-%m-%dT%H-%M-%S").to_string();
            let _ = fs::copy(&file, dir.join(format!("progress.corrupt.{}.json", stamp)));
            let bdir = backup_dir_path(&app);
            if let Ok(entries) = fs::read_dir(&bdir) {
                let mut files: Vec<PathBuf> = entries
                    .flatten()
                    .map(|e| e.path())
                    .filter(|p| p.extension().and_then(|s| s.to_str()) == Some("json"))
                    .collect();
                files.sort();
                files.reverse();
                for cand in files {
                    if let Ok(txt) = fs::read_to_string(&cand) {
                        if let Ok(val) = serde_json::from_str::<Value>(&txt) {
                            if val.get("chunks").is_some() {
                                let _ = write_json_atomic(&file, &val);
                                return Ok(json!({
                                    "state": val,
                                    "path": file.to_string_lossy(),
                                    "dir": dir.to_string_lossy(),
                                    "recoveredFromBackup": true,
                                    "backupFile": cand.file_name().unwrap_or_default().to_string_lossy()
                                }));
                            }
                        }
                    }
                }
            }
            Ok(json!({
                "state": Value::Null,
                "path": file.to_string_lossy(),
                "dir": dir.to_string_lossy(),
                "recoveredFromBackup": false,
                "corruptPreserved": true
            }))
        }
    }
}

#[tauri::command]
fn state_save(app: AppHandle, app_state: State<AppState>, mut state: Value) -> Result<Value, String> {
    let _guard = app_state.write_lock.lock().map_err(|_| "lock poisoned")?;
    snapshot_backup(&app, &app_state, false);
    let saved_at = Utc::now().to_rfc3339();
    if let Some(obj) = state.as_object_mut() {
        obj.insert("updatedAt".to_string(), Value::String(saved_at.clone()));
    }
    write_json_atomic(&state_file_path(&app), &state)?;
    Ok(json!({ "ok": true, "savedAt": saved_at }))
}

#[tauri::command]
fn state_reset(app: AppHandle, app_state: State<AppState>) -> Result<Value, String> {
    let _guard = app_state.write_lock.lock().map_err(|_| "lock poisoned")?;
    snapshot_backup(&app, &app_state, true);
    let file = state_file_path(&app);
    if file.exists() {
        let _ = fs::remove_file(&file);
    }
    Ok(json!({ "ok": true }))
}

#[tauri::command]
fn open_data_folder(app: AppHandle) -> Result<Value, String> {
    let dir = user_data_dir(&app);
    let _ = fs::create_dir_all(&dir);
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer").arg(&dir).spawn();
    }
    Ok(json!({ "ok": true }))
}

#[tauri::command]
fn app_info(app: AppHandle) -> Result<Value, String> {
    Ok(json!({
        "version": env!("CARGO_PKG_VERSION"),
        "runtime": "Rust / Tauri v2",
        "electron": "Rust/Tauri v2",
        "userDir": user_data_dir(&app).to_string_lossy(),
        "stateFile": state_file_path(&app).to_string_lossy(),
        "backupDir": backup_dir_path(&app).to_string_lossy()
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            write_lock: Mutex::new(()),
            last_backup_ms: Mutex::new(0),
        })
        .invoke_handler(tauri::generate_handler![
            state_load,
            state_save,
            state_reset,
            open_data_folder,
            app_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running ChunkTrainer (Rust/Tauri v2)");
}
