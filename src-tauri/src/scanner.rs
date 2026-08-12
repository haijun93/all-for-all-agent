use tauri::{AppHandle, Emitter, State};
use walkdir::{DirEntry, WalkDir};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

// Shared pause/cancel flags for the in-progress scan_directory walk. A
// single global pair is enough since only one scan runs at a time in
// practice (the user starts one folder scan flow, in either photo or
// document mode, before starting another) — both modes' Phase-1 scans
// invoke the same scan_directory command, so this one control surface
// covers pause/stop/restart for both.
#[derive(Default)]
pub struct ScanControlState {
    paused: AtomicBool,
    cancelled: AtomicBool,
}

#[tauri::command]
pub fn pause_scan(state: State<'_, ScanControlState>) {
    state.paused.store(true, Ordering::Relaxed);
}

#[tauri::command]
pub fn resume_scan(state: State<'_, ScanControlState>) {
    state.paused.store(false, Ordering::Relaxed);
}

#[tauri::command]
pub fn cancel_scan(state: State<'_, ScanControlState>) {
    state.cancelled.store(true, Ordering::Relaxed);
    state.paused.store(false, Ordering::Relaxed);
}

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
// a slow or cloud-placeholder path, or on a slow network/mapped drive
// (common in institutional environments). The Windows hidden *attribute*
// is checked separately in the main scan loop below, only for FILES that
// already matched a target extension and already need a metadata() call
// for size/mtime — reusing that fetch instead of issuing a fresh one.
//
// A per-directory attribute check (metadata() on every folder visited,
// regardless of match) was tried and reverted: it reintroduced the same
// class of stall this comment already warns about, just scoped to
// directories instead of files — directories are fewer than files, but on
// a slow network share a metadata() round-trip per folder still adds up to
// a scan that never visibly progresses. Attribute-hidden directories
// (hidden without a dot-prefixed name) are therefore not excluded; only
// dot-prefixed and named trash directories are.
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
    control: State<'_, ScanControlState>,
    path: String,
    extensions: Option<Vec<String>>,
) -> Result<usize, String> {
    let start = Instant::now();
    let mut total_count = 0;

    // A fresh scan always starts clean, regardless of how the previous one
    // ended (paused mid-way, stopped, or finished) — this is what makes a
    // "restart" work correctly by just calling this command again.
    control.paused.store(false, Ordering::Relaxed);
    control.cancelled.store(false, Ordering::Relaxed);

    let allowed_extensions: Vec<String> = match extensions {
        Some(exts) => exts.into_iter().map(|e| e.to_lowercase()).collect(),
        None => DEFAULT_DOCUMENT_EXTENSIONS.iter().map(|s| s.to_string()).collect(),
    };

    // Strip any `\\?\` extended-length prefix so downstream path strings
    // (sent to the frontend, matched against watched-folder names, etc.)
    // look like normal Windows paths. Pure string manipulation, no I/O —
    // safe to call unconditionally, unlike metadata()/canonicalize().
    let root = dunce::simplified(std::path::Path::new(&path));

    // Send a file batch every 50 files
    let mut batch: Vec<ScannedFile> = Vec::with_capacity(50);

    for entry in WalkDir::new(root)
        .into_iter()
        .filter_entry(|e| !is_trash_dir(e) && !is_hidden_name(e))
        .filter_map(|e| e.ok())
    {
        // Cooperative pause/cancel checkpoint, once per entry. Pausing just
        // idles here without unwinding the walk, so resuming continues
        // exactly where it left off; cancelling breaks out and returns
        // whatever was already found.
        if control.cancelled.load(Ordering::Relaxed) {
            break;
        }
        while control.paused.load(Ordering::Relaxed) {
            if control.cancelled.load(Ordering::Relaxed) {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        }
        if control.cancelled.load(Ordering::Relaxed) {
            break;
        }

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
    // Verbatim `\\?\`-prefixed paths can confuse `cmd /C start` on Windows;
    // strip it (string-only, no I/O) before handing off to the shell.
    let path = dunce::simplified(std::path::Path::new(&path)).to_string_lossy().to_string();

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

#[cfg(test)]
mod async_control_tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::time::Duration;

    // Mirrors scan_directory's exact loop body (minus the AppHandle/emit
    // calls, which need a running Tauri app) to verify the cooperative
    // pause/cancel checkpoint terminates correctly and doesn't hang when
    // never paused — i.e. the default, most common path.
    async fn walk_with_control(path: &std::path::Path, control: &(AtomicBool, AtomicBool)) -> usize {
        let (paused, cancelled) = control;
        let mut total = 0;
        for entry in WalkDir::new(path)
            .into_iter()
            .filter_entry(|e| !is_trash_dir(e) && !is_hidden_name(e))
            .filter_map(|e| e.ok())
        {
            if cancelled.load(Ordering::Relaxed) {
                break;
            }
            while paused.load(Ordering::Relaxed) {
                if cancelled.load(Ordering::Relaxed) {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(150)).await;
            }
            if cancelled.load(Ordering::Relaxed) {
                break;
            }
            if entry.file_type().is_file() {
                total += 1;
            }
        }
        total
    }

    #[tokio::test]
    async fn unpaused_scan_completes_without_hanging() {
        let base = std::env::temp_dir().join(format!("scanner_async_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).unwrap();
        fs::write(base.join("a.jpg"), b"x").unwrap();
        fs::write(base.join("b.jpg"), b"x").unwrap();

        let control = (AtomicBool::new(false), AtomicBool::new(false));

        let result = tokio::time::timeout(
            Duration::from_secs(5),
            walk_with_control(&base, &control),
        )
        .await
        .expect("walk_with_control hung for 5s on an unpaused scan");

        assert_eq!(result, 2);
        let _ = fs::remove_dir_all(&base);
    }
}
