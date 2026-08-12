use crate::extractor;
use crate::keyword_engine;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct DocExtractResult {
    pub text: String,
    pub page_count: u32,
    pub cover_data_url: Option<String>,
    pub category: String,
    pub keywords: Vec<String>,
    pub snippet: String,
}

fn extract_and_analyze_one(path: &str, format: &str) -> DocExtractResult {
    let title = std::path::Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(path)
        .to_string();

    let extracted = extractor::extract(path, format);
    let analysis = keyword_engine::analyze_document_text(&title, &extracted.text);

    DocExtractResult {
        text: extracted.text,
        page_count: extracted.page_count,
        cover_data_url: extracted.cover_data_url,
        category: analysis.category,
        keywords: analysis.keywords,
        snippet: analysis.snippet,
    }
}

/// Native replacement for the old JS RealDocExtractor + KeywordEngine pipeline:
/// parses the file straight off disk in Rust (no WebView/JS engine overhead)
/// and returns everything BackgroundIndexer.createRealDocItem needs.
#[tauri::command]
pub fn extract_and_analyze(path: String, format: String) -> DocExtractResult {
    extract_and_analyze_one(&path, &format)
}

#[derive(Deserialize)]
pub struct BatchExtractItem {
    pub path: String,
    pub format: String,
}

#[derive(Serialize)]
pub struct BatchExtractResult {
    pub path: String,
    pub result: DocExtractResult,
}

/// Parallel batch extraction: parses+analyzes many files across all CPU
/// cores via rayon's work-stealing pool instead of the caller invoking
/// extract_and_analyze once per file (which only ever uses one core at a
/// time, no matter how many files are queued). Runs on a blocking thread
/// so rayon's synchronous, CPU-bound parallel iteration doesn't stall the
/// async runtime other Tauri commands share.
#[tauri::command]
pub async fn extract_and_analyze_batch(items: Vec<BatchExtractItem>) -> Vec<BatchExtractResult> {
    tauri::async_runtime::spawn_blocking(move || {
        items
            .par_iter()
            .map(|item| BatchExtractResult {
                path: item.path.clone(),
                result: extract_and_analyze_one(&item.path, &item.format),
            })
            .collect()
    })
    .await
    .unwrap_or_default()
}
