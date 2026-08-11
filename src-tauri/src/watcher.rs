use tauri::{AppHandle, Emitter, State};
use notify::{Watcher, RecursiveMode, Event, EventKind};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::collections::HashSet;
use serde::Serialize;
use std::time::Duration;

#[derive(Clone, Serialize)]
pub struct FileChangeEvent {
    pub event_type: String, // "create", "modify", "remove"
    pub path: String,
    pub name: String,
    pub size: u64,
    pub modified: i64,
}

pub struct WatcherState {
    pub watcher: Arc<Mutex<Option<notify::RecommendedWatcher>>>,
    pub watched_paths: Arc<Mutex<HashSet<PathBuf>>>,
}

impl Default for WatcherState {
    fn default() -> Self {
        Self {
            watcher: Arc::new(Mutex::new(None)),
            watched_paths: Arc::new(Mutex::new(HashSet::new())),
        }
    }
}

pub fn init_watcher(app: AppHandle, state: &WatcherState) -> Result<(), String> {
    let app_handle = app.clone();
    
    let mut watcher_guard = state.watcher.lock().map_err(|e| e.to_string())?;
    if watcher_guard.is_some() {
        return Ok(());
    }

    let watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        if let Ok(event) = res {
            let event_type = match event.kind {
                EventKind::Create(_) => "create",
                EventKind::Modify(_) => "modify",
                EventKind::Remove(_) => "remove",
                _ => return,
            };

            for path in event.paths {
                let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                let name_lower = name.to_lowercase();
                if !name_lower.ends_with(".pdf") && 
                   !name_lower.ends_with(".doc") &&
                   !name_lower.ends_with(".docx") &&
                   !name_lower.ends_with(".xls") &&
                   !name_lower.ends_with(".xlsx") &&
                   !name_lower.ends_with(".hwp") &&
                   !name_lower.ends_with(".hwpx") &&
                   !name_lower.ends_with(".epub") &&
                   !name_lower.ends_with(".zip") &&
                   !name_lower.ends_with(".cbz") &&
                   !name_lower.ends_with(".ppt") &&
                   !name_lower.ends_with(".pptx") &&
                   !name_lower.ends_with(".txt") {
                    continue;
                }

                let mut size = 0;
                let mut modified = 0;
                if event_type != "remove" {
                    if let Ok(metadata) = std::fs::metadata(&path) {
                        size = metadata.len();
                        modified = metadata.modified()
                            .unwrap_or(std::time::SystemTime::now())
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or(Duration::from_secs(0))
                            .as_millis() as i64;
                    }
                }

                let change_event = FileChangeEvent {
                    event_type: event_type.to_string(),
                    path: path.to_string_lossy().to_string(),
                    name,
                    size,
                    modified,
                };

                let _ = app_handle.emit("file-change-event", &change_event);
            }
        }
    }).map_err(|e| e.to_string())?;

    *watcher_guard = Some(watcher);
    Ok(())
}

#[tauri::command]
pub async fn start_watching(app: AppHandle, state: State<'_, WatcherState>, path: String) -> Result<(), String> {
    init_watcher(app, &state)?;
    let p = PathBuf::from(&path);
    
    let mut paths_guard = state.watched_paths.lock().map_err(|e| e.to_string())?;
    if paths_guard.contains(&p) {
        return Ok(());
    }

    let mut watcher_guard = state.watcher.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut watcher) = *watcher_guard {
        watcher.watch(&p, RecursiveMode::Recursive).map_err(|e| e.to_string())?;
        paths_guard.insert(p);
        println!("[Rust Watcher] Started watching: {}", path);
    }
    Ok(())
}

#[tauri::command]
pub async fn stop_watching(state: State<'_, WatcherState>, path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    let mut paths_guard = state.watched_paths.lock().map_err(|e| e.to_string())?;
    if !paths_guard.contains(&p) {
        return Ok(());
    }

    let mut watcher_guard = state.watcher.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut watcher) = *watcher_guard {
        let _ = watcher.unwatch(&p);
        paths_guard.remove(&p);
        println!("[Rust Watcher] Stopped watching: {}", path);
    }
    Ok(())
}
