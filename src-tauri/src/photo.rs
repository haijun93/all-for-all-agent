use crate::image_utils::resize_to_jpeg_data_url;
use serde::{Deserialize, Serialize};
use std::hash::{Hash, Hasher};
use tauri::{AppHandle, Manager};

#[derive(Clone, Serialize, Deserialize)]
pub struct PhotoThumbnail {
    pub thumbnail_data_url: String,
    pub width: u32,
    pub height: u32,
}

fn cache_key(path: &str, modified_ms: u128, max_dim: u32) -> String {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    path.hash(&mut hasher);
    modified_ms.hash(&mut hasher);
    max_dim.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Generates a resized, JPEG-compressed thumbnail for a photo natively in
/// Rust (decode + resize is far cheaper here than in the WebView's JS
/// engine), and caches the result to disk keyed by path+mtime+size so a
/// re-scroll or app restart never re-decodes the same photo twice.
///
/// Deliberately does NOT return the original full-resolution bytes or read
/// EXIF — this command backs the low-cost "grid + lightbox" viewing path.
/// Full-resolution loading for editing is a separate, on-demand path
/// triggered only when a user opens the editor for a specific photo.
#[tauri::command]
pub async fn generate_photo_thumbnail(
    app: AppHandle,
    path: String,
    max_dim: u32,
) -> Result<PhotoThumbnail, String> {
    let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    let modified_ms = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("photo-thumbnails");
    let _ = std::fs::create_dir_all(&cache_dir);

    let key = cache_key(&path, modified_ms, max_dim);
    let cache_path = cache_dir.join(format!("{key}.json"));

    if let Ok(cached_bytes) = std::fs::read(&cache_path) {
        if let Ok(cached) = serde_json::from_slice::<PhotoThumbnail>(&cached_bytes) {
            return Ok(cached);
        }
    }

    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
    let (orig_w, orig_h) = (img.width(), img.height());

    let thumbnail_data_url = resize_to_jpeg_data_url(&img, max_dim, max_dim, 75)
        .ok_or_else(|| "failed to encode thumbnail".to_string())?;

    let result = PhotoThumbnail {
        thumbnail_data_url,
        width: orig_w,
        height: orig_h,
    };

    if let Ok(serialized) = serde_json::to_vec(&result) {
        let _ = std::fs::write(&cache_path, serialized);
    }

    Ok(result)
}
