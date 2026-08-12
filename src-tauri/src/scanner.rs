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

// Name-only check, safe to run during tree traversal (filter_entry) for
// every directory and file: no filesystem calls, so it can never stall on
// a slow or cloud-placeholder (OneDrive-style) path. The Windows hidden
// *attribute* is checked separately in the main scan loop below, only for
// files that already matched a target extension and already need a
// metadata() call for size/mtime — reusing that fetch instead of issuing a
// fresh metadata() call for every single entry in the tree. (An earlier
// version of this filter called metadata() here, inside filter_entry, for
// every entry regardless of extension — which stalled scans indefinitely
// on folders containing slow or cloud-placeholder reparse points, since
// filter_entry runs before any extension match.)
fn is_hidden_name(entry: &DirEntry) -> bool {
    let name = entry.file_name().to_string_lossy();
    name.starts_with('.') && name != "." && name != ".."
}

#[cfg(target_os = "windows")]
fn is_hidden_attribute(metadata: &std::fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
    metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0
}

#[cfg(not(target_os = "windows"))]
fn is_hidden_attribute(_metadata: &std::fs::Metadata) -> bool {
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
        .filter_entry(|e| !is_trash_dir(e) && !is_hidden_name(e))
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

        if is_hidden_attribute(&metadata) {
            continue;
        }

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



#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn walk_filters_trash_and_hidden_but_keeps_normal_files() {
        let base = std::env::temp_dir().join(format!("scanner_repro_{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(base.join("sub")).unwrap();
        fs::create_dir_all(base.join(".hidden_dir")).unwrap();
        fs::create_dir_all(base.join("$RECYCLE.BIN")).unwrap();
        fs::write(base.join("photo1.jpg"), b"x").unwrap();
        fs::write(base.join("sub").join("photo2.png"), b"x").unwrap();
        fs::write(base.join(".hidden_dir").join("photo3.jpg"), b"x").unwrap();
        fs::write(base.join("$RECYCLE.BIN").join("photo4.jpg"), b"x").unwrap();
        fs::write(base.join(".dotfile.jpg"), b"x").unwrap();

        let mut found = vec![];
        for entry in WalkDir::new(&base)
            .into_iter()
            .filter_entry(|e| !is_trash_dir(e) && !is_hidden_name(e))
            .filter_map(|e| e.ok())
        {
            if entry.file_type().is_file() {
                found.push(entry.file_name().to_string_lossy().to_string());
            }
        }
        found.sort();
        assert_eq!(found, vec!["photo1.jpg", "photo2.png"]);

        let _ = fs::remove_dir_all(&base);
    }
}
