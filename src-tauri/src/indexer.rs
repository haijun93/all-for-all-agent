use crate::extractor;
use crate::keyword_engine;
use serde::Serialize;

#[derive(Serialize)]
pub struct DocExtractResult {
    pub text: String,
    pub page_count: u32,
    pub cover_data_url: Option<String>,
    pub category: String,
    pub keywords: Vec<String>,
    pub snippet: String,
}

/// Native replacement for the old JS RealDocExtractor + KeywordEngine pipeline:
/// parses the file straight off disk in Rust (no WebView/JS engine overhead)
/// and returns everything BackgroundIndexer.createRealDocItem needs.
#[tauri::command]
pub fn extract_and_analyze(path: String, format: String) -> DocExtractResult {
    let title = std::path::Path::new(&path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(&path)
        .to_string();

    let extracted = extractor::extract(&path, &format);
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
