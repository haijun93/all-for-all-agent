use tauri::{AppHandle, Emitter};
use walkdir::{DirEntry, WalkDir};
use serde::Serialize;
use std::time::Instant;

// Recycle-bin / trash directory names to skip entirely (whole subtree),
// so previously-deleted documents never show up as scan results.
const TRASH_DIR_NAMES: &[&str] = &["$recycle.bin", ".trash", ".trashes", ".recycle", "recycler"];

fn is_trash_dir(entry: &DirEntry) -> bool {
    if !entry.file_type().is_dir() {
        return false;
    }
    let name = entry.file_name().to_string_lossy().to_lowercase();
    TRASH_DIR_NAMES.contains(&name.as_str())
}

fn is_hidden(entry: &DirEntry) -> bool {
    let name = entry.file_name().to_string_lossy();
    if name.starts_with('.') && name != "." && name != ".." {
        return true;
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
        if let Ok(metadata) = entry.metadata() {
            if metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0 {
                return true;
            }
        }
    }

    false
}

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

const DEFAULT_DOCUMENT_EXTENSIONS: &[&str] = &[
    "pdf", "doc", "docx", "xls", "xlsx", "hwp", "hwpx", "epub", "zip", "cbz", "ppt", "pptx", "txt",
];

#[tauri::command]
pub async fn scan_directory(
    app: AppHandle,
    path: String,
    extensions: Option<Vec<String>>,
) -> Result<usize, String> {
    let start = Instant::now();
    let mut total_count = 0;

    let allowed_extensions: Vec<String> = match extensions {
        Some(exts) => exts.into_iter().map(|e| e.to_lowercase()).collect(),
        None => DEFAULT_DOCUMENT_EXTENSIONS.iter().map(|s| s.to_string()).collect(),
    };

    // Send a file batch every 50 files
    let mut batch: Vec<ScannedFile> = Vec::with_capacity(50);

    for entry in WalkDir::new(&path)
        .into_iter()
        .filter_entry(|e| !is_trash_dir(e) && !is_hidden(e))
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().to_string();
        let name_lower = name.to_lowercase();

        let matches_extension = allowed_extensions
            .iter()
            .any(|ext| name_lower.ends_with(&format!(".{ext}")));
        if !matches_extension {
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


