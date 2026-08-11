use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;
use serde::Serialize;
use std::time::Instant;

#[derive(Clone, Serialize)]
struct ScanProgress {
    total_count: usize,
    elapsed_ms: u64,
    speed: f64,
}

#[derive(Clone, Serialize)]
struct ScannedFile {
    path: String,
    name: String,
    size: u64,
    modified: i64,
}

#[tauri::command]
pub async fn scan_directory(app: AppHandle, path: String) -> Result<usize, String> {
    let start = Instant::now();
    let mut total_count = 0;
    
    // Send a file batch every 50 files
    let mut batch: Vec<ScannedFile> = Vec::with_capacity(50);

    for entry in WalkDir::new(&path).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();
        let name_lower = name.to_lowercase();
        
        // Filter out unwanted files
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

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let modified = metadata.modified()
            .unwrap_or(std::time::SystemTime::now())
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or(std::time::Duration::from_secs(0))
            .as_millis() as i64;

        batch.push(ScannedFile {
            path: entry.path().to_string_lossy().to_string(),
            name,
            size: metadata.len(),
            modified,
        });

        total_count += 1;

        if batch.len() >= 50 {
            app.emit("scan-batch", &batch).map_err(|e| e.to_string())?;
            batch.clear();
            
            let elapsed = start.elapsed().as_millis() as u64;
            let speed = if elapsed > 0 {
                total_count as f64 / (elapsed as f64 / 1000.0)
            } else {
                0.0
            };
            app.emit("scan-progress", ScanProgress {
                total_count,
                elapsed_ms: elapsed,
                speed,
            }).map_err(|e| e.to_string())?;
        }
    }

    if !batch.is_empty() {
        app.emit("scan-batch", &batch).map_err(|e| e.to_string())?;
    }

    Ok(total_count)
}

#[tauri::command]
pub async fn read_file_binary(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_file_with_default_app(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}


