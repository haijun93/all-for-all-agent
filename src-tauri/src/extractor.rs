use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use calamine::{open_workbook_auto, Reader};
use crate::image_utils::resize_bytes_to_jpeg_data_url;
use quick_xml::events::Event;
use quick_xml::reader::Reader as XmlReader;
use serde::Serialize;
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use zip::ZipArchive;

#[derive(Clone, Serialize, Default)]
pub struct ExtractedDoc {
    pub text: String,
    pub page_count: u32,
    /// Full `data:<mime>;base64,...` URL, ready to use as an <img> src.
    pub cover_data_url: Option<String>,
}

/// Dispatches to the right per-format extractor. Never fails — on any parse
/// error it falls back to a minimal placeholder, matching the previous
/// JS extractor's fallback-on-timeout/error behavior.
pub fn extract(path: &str, format: &str) -> ExtractedDoc {
    let title = Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(path)
        .to_string();

    let result = match format {
        "pdf" => extract_pdf(path),
        "docx" | "doc" => extract_docx(path),
        "xlsx" | "xls" => extract_xlsx(path),
        "hwpx" => extract_hwpx(path),
        "hwp" => extract_hwp(path),
        "epub" => extract_epub(path),
        "zip" | "cbz" => extract_comic_zip(path),
        _ => extract_plain_text(path),
    };

    result.unwrap_or(ExtractedDoc {
        text: format!("{title} 문서입니다."),
        page_count: 1,
        cover_data_url: None,
    })
}

fn read_bytes(path: &str) -> std::io::Result<Vec<u8>> {
    std::fs::read(path)
}

fn truncate_chars(s: &str, max: usize) -> String {
    s.chars().take(max).collect()
}

// ---------------------------------------------------------------------------
// Image downsizing (mirrors RealDocExtractor.createOptimizedThumbnail)
// ---------------------------------------------------------------------------

fn downsize_to_jpeg_data_url(bytes: &[u8], max_w: u32, max_h: u32) -> Option<String> {
    resize_bytes_to_jpeg_data_url(bytes, max_w, max_h, 72)
}

fn guess_mime(name: &str) -> &'static str {
    let lower = name.to_lowercase();
    if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else {
        "image/jpeg"
    }
}

// ---------------------------------------------------------------------------
// Zip helpers
// ---------------------------------------------------------------------------

fn open_zip(path: &str) -> zip::result::ZipResult<ZipArchive<File>> {
    let file = File::open(path)?;
    ZipArchive::new(file)
}

fn zip_read_text(archive: &mut ZipArchive<File>, name: &str) -> Option<String> {
    let mut f = archive.by_name(name).ok()?;
    let mut s = String::new();
    f.read_to_string(&mut s).ok()?;
    Some(s)
}

fn zip_read_bytes_case_insensitive(
    archive: &mut ZipArchive<File>,
    candidate: &str,
) -> Option<(String, Vec<u8>)> {
    if let Ok(mut f) = archive.by_name(candidate) {
        let mut buf = Vec::new();
        f.read_to_end(&mut buf).ok()?;
        let name = f.name().to_string();
        return Some((name, buf));
    }
    let lower = candidate.to_lowercase();
    let names: Vec<String> = archive.file_names().map(|s| s.to_string()).collect();
    let matched = names.into_iter().find(|n| n.to_lowercase() == lower)?;
    let mut f = archive.by_name(&matched).ok()?;
    let mut buf = Vec::new();
    f.read_to_end(&mut buf).ok()?;
    Some((matched, buf))
}

/// Resolves a relative href against a base directory inside a zip archive,
/// collapsing "." and ".." segments (mirrors RealDocExtractor's resolveZipPath).
fn resolve_zip_path(base_dir: &str, rel_path: &str) -> String {
    let clean = rel_path.split('#').next().unwrap_or("").split('?').next().unwrap_or("");
    if let Some(stripped) = clean.strip_prefix('/') {
        return stripped.to_string();
    }
    let combined = format!("{base_dir}{clean}").replace('\\', "/");
    let mut stack: Vec<&str> = Vec::new();
    for part in combined.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            stack.pop();
        } else {
            stack.push(part);
        }
    }
    stack.join("/")
}

fn dir_of(path: &str) -> String {
    match path.rfind('/') {
        Some(idx) => path[..=idx].to_string(),
        None => String::new(),
    }
}

/// Natural-ish sort key: compares digit runs numerically, everything else lexically.
fn natural_key(s: &str) -> Vec<(bool, String)> {
    let mut chunks = Vec::new();
    let mut cur = String::new();
    let mut cur_is_digit = false;
    for c in s.chars() {
        let is_digit = c.is_ascii_digit();
        if cur.is_empty() {
            cur_is_digit = is_digit;
        }
        if is_digit != cur_is_digit {
            chunks.push((cur_is_digit, std::mem::take(&mut cur)));
            cur_is_digit = is_digit;
        }
        cur.push(c);
    }
    if !cur.is_empty() {
        chunks.push((cur_is_digit, cur));
    }
    chunks
        .into_iter()
        .map(|(is_digit, s)| {
            if is_digit {
                let n: u64 = s.parse().unwrap_or(0);
                (true, format!("{n:020}"))
            } else {
                (false, s.to_lowercase())
            }
        })
        .collect()
}

fn is_cover_like(name: &str) -> bool {
    let l = name.to_lowercase();
    l.contains("cover") || l.contains("표지") || l.contains("front") || l.contains("title")
        || l.contains("000.") || l.contains("001.")
}

const IMAGE_EXT_RE_SUFFIXES: &[&str] = &[".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"];

fn is_image_name(name: &str) -> bool {
    let l = name.to_lowercase();
    IMAGE_EXT_RE_SUFFIXES.iter().any(|ext| l.ends_with(ext))
}

fn is_hidden_or_macosx(name: &str) -> bool {
    name.contains("__MACOSX") || name.starts_with('.') || name.contains("/.")
}

// ---------------------------------------------------------------------------
// 1. PDF — real page-1 text extraction (mirrors pdf.js getTextContent)
// ---------------------------------------------------------------------------

fn extract_pdf(path: &str) -> Option<ExtractedDoc> {
    let bytes = read_bytes(path).ok()?;
    match pdf_extract::extract_text_from_mem_by_pages(&bytes) {
        Ok(pages) => {
            let page_count = pages.len().max(1) as u32;
            let first_page_text = pages.first().cloned().unwrap_or_default();
            let clean = first_page_text.split_whitespace().collect::<Vec<_>>().join(" ");
            Some(ExtractedDoc {
                text: truncate_chars(&clean, 500),
                page_count,
                cover_data_url: None,
            })
        }
        Err(_) => None,
    }
}

// ---------------------------------------------------------------------------
// 2. DOCX — word/document.xml paragraph text extraction
// ---------------------------------------------------------------------------

fn extract_docx(path: &str) -> Option<ExtractedDoc> {
    let mut archive = open_zip(path).ok()?;
    let xml = zip_read_text(&mut archive, "word/document.xml")?;

    let mut reader = XmlReader::from_str(&xml);
    let mut buf = Vec::new();
    let mut paragraphs: Vec<String> = Vec::new();
    let mut in_p = false;
    let mut current = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) if e.name().as_ref() == b"w:p" => {
                in_p = true;
                current.clear();
            }
            Ok(Event::End(e)) if e.name().as_ref() == b"w:p" => {
                in_p = false;
                let trimmed = current.trim();
                if !trimmed.is_empty() {
                    paragraphs.push(trimmed.to_string());
                }
            }
            Ok(Event::Text(e)) if in_p => {
                if let Ok(text) = e.unescape() {
                    current.push_str(&text);
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    let extracted_text = paragraphs.join("\n");
    let page_count = ((paragraphs.len() as f64) / 5.0).ceil().max(1.0) as u32;

    Some(ExtractedDoc {
        text: truncate_chars(&extracted_text, 500),
        page_count,
        cover_data_url: None,
    })
}

// ---------------------------------------------------------------------------
// 3. XLSX — first sheet cell grid extraction (via calamine)
// ---------------------------------------------------------------------------

fn extract_xlsx(path: &str) -> Option<ExtractedDoc> {
    let mut workbook = open_workbook_auto(path).ok()?;
    let range = workbook.worksheet_range_at(0)?.ok()?;

    let mut lines: Vec<String> = Vec::new();
    let mut row_count = 0u32;
    for row in range.rows().take(200) {
        row_count += 1;
        let cells: Vec<String> = row.iter().take(24).map(|c| c.to_string()).collect();
        lines.push(cells.join("\t"));
    }

    let full_text = lines.join("\n");
    Some(ExtractedDoc {
        text: truncate_chars(&full_text, 500),
        page_count: row_count.max(1),
        cover_data_url: None,
    })
}

// ---------------------------------------------------------------------------
// 4. HWPX — OWPML preview image or Contents/section0.xml text
// ---------------------------------------------------------------------------

fn extract_hwpx(path: &str) -> Option<ExtractedDoc> {
    let mut archive = open_zip(path).ok()?;

    for candidate in ["Preview/PrvImage.png", "Preview/PrvImage.jpg"] {
        if let Some((name, bytes)) = zip_read_bytes_case_insensitive(&mut archive, candidate) {
            let mime = guess_mime(&name);
            return Some(ExtractedDoc {
                text: "한글 HWPX 정식 문서".to_string(),
                page_count: 1,
                cover_data_url: Some(format!("data:{mime};base64,{}", BASE64.encode(bytes))),
            });
        }
    }

    let xml = zip_read_text(&mut archive, "Contents/section0.xml")?;
    let mut reader = XmlReader::from_str(&xml);
    let mut buf = Vec::new();
    let mut in_t = false;
    let mut text = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) if e.name().as_ref() == b"hp:t" => in_t = true,
            Ok(Event::End(e)) if e.name().as_ref() == b"hp:t" => {
                in_t = false;
                text.push(' ');
            }
            Ok(Event::Text(e)) if in_t => {
                if let Ok(t) = e.unescape() {
                    text.push_str(&t);
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }

    Some(ExtractedDoc {
        text: truncate_chars(text.trim(), 500),
        page_count: 1,
        cover_data_url: None,
    })
}

// ---------------------------------------------------------------------------
// 5. HWP 5.0 binary — scan for an embedded PNG preview in the first 512KB
// ---------------------------------------------------------------------------

// HWPTAG_PARA_TEXT — the record tag that carries a paragraph's actual
// UTF-16LE text content, per the published HWP5 binary spec.
const HWPTAG_PARA_TEXT: u32 = 67;

/// Decodes one PARA_TEXT record's payload into visible text. HWP5 inlines
/// non-text "control characters" (tables, footnotes, page breaks, etc.) as
/// UTF-16 code points below 32, each followed by a fixed 7-unit block of
/// associated metadata that isn't text and must be skipped over — best
/// effort here (skip the whole 8-unit block) since this is for search
/// indexing, not layout-accurate rendering.
fn decode_para_text(payload: &[u8]) -> String {
    let units: Vec<u16> = payload
        .chunks_exact(2)
        .map(|c| u16::from_le_bytes([c[0], c[1]]))
        .collect();

    let mut kept: Vec<u16> = Vec::with_capacity(units.len());
    let mut i = 0;
    while i < units.len() {
        let code = units[i];
        if code == 10 || code == 13 {
            kept.push(b'\n' as u16);
            i += 1;
        } else if code == 9 {
            kept.push(b' ' as u16);
            i += 1;
        } else if code < 32 {
            // Control char block: itself + 7 metadata units.
            i += 8;
        } else {
            kept.push(code);
            i += 1;
        }
    }

    String::from_utf16_lossy(&kept)
}

/// Parses a decompressed BodyText section stream into its paragraph text,
/// walking the record stream (tag/level/size header, optionally extended
/// size) and decoding only HWPTAG_PARA_TEXT records.
fn parse_hwp_section_records(data: &[u8]) -> String {
    let mut out = String::new();
    let mut pos = 0usize;
    while pos + 4 <= data.len() {
        let header = u32::from_le_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]);
        pos += 4;
        let tag_id = header & 0x3FF;
        let mut size = (header >> 20) & 0xFFF;
        if size == 0xFFF {
            if pos + 4 > data.len() {
                break;
            }
            size = u32::from_le_bytes([data[pos], data[pos + 1], data[pos + 2], data[pos + 3]]);
            pos += 4;
        }
        let size = size as usize;
        if pos + size > data.len() {
            break;
        }
        if tag_id == HWPTAG_PARA_TEXT {
            let text = decode_para_text(&data[pos..pos + size]);
            if !text.trim().is_empty() {
                out.push_str(text.trim());
                out.push('\n');
            }
        }
        pos += size;
    }
    out
}

/// HWP5 (.hwp, the binary/OLE2-compound-file format used since 2002) text
/// extraction: opens the CFB container, decompresses each BodyText/SectionN
/// stream (raw DEFLATE, per the compressed-document flag in FileHeader),
/// and decodes paragraph text from the record stream. Falls back to a
/// placeholder if the file isn't a well-formed HWP5 container (e.g. the
/// much rarer pre-2002 HWP3 format, which uses a different binary layout
/// entirely and isn't handled here).
fn extract_hwp(path: &str) -> Option<ExtractedDoc> {
    let file = File::open(path).ok()?;
    let cover_data_url = find_embedded_png_cover(path);

    let mut comp = match cfb::CompoundFile::open(file) {
        Ok(c) => c,
        Err(_) => {
            return Some(ExtractedDoc {
                text: "한글 문서".to_string(),
                page_count: 1,
                cover_data_url,
            });
        }
    };

    let compressed = read_hwp_compressed_flag(&mut comp).unwrap_or(true);

    let mut section_names: Vec<String> = comp
        .read_storage("/BodyText")
        .map(|entries| {
            entries
                .filter(|e| e.is_stream())
                .map(|e| e.name().to_string())
                .collect()
        })
        .unwrap_or_default();

    section_names.sort_by_key(|name| {
        name.trim_start_matches("Section")
            .parse::<u32>()
            .unwrap_or(u32::MAX)
    });

    if section_names.is_empty() {
        return Some(ExtractedDoc {
            text: "한글 문서".to_string(),
            page_count: 1,
            cover_data_url,
        });
    }

    let mut full_text = String::new();
    let mut section_count = 0u32;

    for name in &section_names {
        let stream_path = format!("/BodyText/{name}");
        let mut stream = match comp.open_stream(&stream_path) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let mut raw = Vec::new();
        if stream.read_to_end(&mut raw).is_err() {
            continue;
        }

        let decompressed = if compressed {
            let mut decoder = flate2::read::DeflateDecoder::new(&raw[..]);
            let mut buf = Vec::new();
            if decoder.read_to_end(&mut buf).is_err() {
                continue;
            }
            buf
        } else {
            raw
        };

        full_text.push_str(&parse_hwp_section_records(&decompressed));
        section_count += 1;
    }

    if full_text.trim().is_empty() {
        return Some(ExtractedDoc {
            text: "한글 문서".to_string(),
            page_count: 1,
            cover_data_url,
        });
    }

    Some(ExtractedDoc {
        text: truncate_chars(full_text.trim(), 500),
        page_count: section_count.max(1),
        cover_data_url,
    })
}

/// Reads FileHeader's property flags (offset 36, little-endian u32) to
/// check bit 0 — whether BodyText streams are DEFLATE-compressed. True for
/// essentially every real-world HWP5 file; defaulting to `true` on any
/// read failure matches that overwhelming common case.
fn read_hwp_compressed_flag<F: std::io::Read + std::io::Seek>(
    comp: &mut cfb::CompoundFile<F>,
) -> Option<bool> {
    let mut stream = comp.open_stream("/FileHeader").ok()?;
    let mut header = Vec::new();
    stream.read_to_end(&mut header).ok()?;
    if header.len() < 40 {
        return None;
    }
    let flags = u32::from_le_bytes([header[36], header[37], header[38], header[39]]);
    Some(flags & 0x1 != 0)
}

/// Best-effort embedded cover thumbnail: scans the first chunk of the raw
/// file for a PNG signature. Cheap and works for the common case where an
/// uncompressed embedded image happens to be byte-contiguous; not a
/// substitute for parsing the BinData storage, which HWP5 also compresses
/// per-stream like BodyText.
fn find_embedded_png_cover(path: &str) -> Option<String> {
    let mut file = File::open(path).ok()?;
    let mut head = vec![0u8; 512 * 1024];
    let n = file.read(&mut head).ok()?;
    head.truncate(n);

    let png_start = head.windows(4).position(|w| w == [0x89, 0x50, 0x4E, 0x47])?;
    let cover = &head[png_start..];
    Some(format!("data:image/png;base64,{}", BASE64.encode(cover)))
}

// ---------------------------------------------------------------------------
// 6. EPUB — Calibre-style cover & metadata extraction
// ---------------------------------------------------------------------------

struct ManifestItem {
    href: String,
    media_type: String,
    properties: String,
}

fn xml_attr(e: &quick_xml::events::BytesStart, name: &str) -> Option<String> {
    e.attributes().flatten().find_map(|a| {
        let key = a.key.as_ref();
        let local = key.split(|&b| b == b':').last().unwrap_or(key);
        if local == name.as_bytes() {
            a.unescape_value().ok().map(|c| c.into_owned())
        } else {
            None
        }
    })
}

fn local_name(name: &[u8]) -> &[u8] {
    match name.iter().position(|&b| b == b':') {
        Some(idx) => &name[idx + 1..],
        None => name,
    }
}

fn extract_epub(path: &str) -> Option<ExtractedDoc> {
    let mut archive = open_zip(path).ok()?;
    let title_fallback = Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("문서")
        .to_string();

    let mut opf_path = "OEBPS/content.opf".to_string();
    if let Some(container_xml) = zip_read_text(&mut archive, "META-INF/container.xml") {
        let mut reader = XmlReader::from_str(&container_xml);
        let mut buf = Vec::new();
        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Empty(e)) | Ok(Event::Start(e))
                    if local_name(e.name().as_ref()) == b"rootfile" =>
                {
                    if let Some(p) = xml_attr(&e, "full-path") {
                        opf_path = p;
                    }
                    break;
                }
                Ok(Event::Eof) => break,
                Err(_) => break,
                _ => {}
            }
            buf.clear();
        }
    }

    let opf_dir = dir_of(&opf_path);
    let opf_candidates = [
        opf_path.clone(),
        "content.opf".to_string(),
        "OEBPS/content.opf".to_string(),
        "EPUB/package.opf".to_string(),
    ];
    let opf_xml = opf_candidates
        .iter()
        .find_map(|c| zip_read_text(&mut archive, c));

    let mut book_title = title_fallback.clone();
    let mut book_author = String::new();
    let mut book_publisher = String::new();
    let mut book_description = String::new();
    let mut manifest: HashMap<String, ManifestItem> = HashMap::new();
    let mut cover_href: Option<String> = None;
    let mut first_spine_href: Option<String> = None;

    if let Some(opf_xml) = &opf_xml {
        let mut reader = XmlReader::from_str(opf_xml);
        let mut buf = Vec::new();
        let mut meta_cover_id: Option<String> = None;
        let mut guide_cover_href: Option<String> = None;
        let mut cur_meta_tag: Option<Vec<u8>> = None;
        let mut cur_meta_text = String::new();
        let got = |field: &mut String, val: String| {
            if field.is_empty() && !val.trim().is_empty() {
                *field = val.trim().to_string();
            }
        };

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(e)) => {
                    let ln = local_name(e.name().as_ref()).to_vec();
                    if ln == b"item" {
                        let id = xml_attr(&e, "id").unwrap_or_default();
                        let href = xml_attr(&e, "href").unwrap_or_default();
                        let media_type = xml_attr(&e, "media-type").unwrap_or_default().to_lowercase();
                        let properties = xml_attr(&e, "properties").unwrap_or_default();
                        if !id.is_empty() {
                            manifest.insert(id, ManifestItem { href, media_type, properties });
                        }
                    } else if ln == b"itemref" && first_spine_href.is_none() {
                        if let Some(idref) = xml_attr(&e, "idref") {
                            first_spine_href = Some(idref);
                        }
                    } else if ln == b"reference" {
                        if xml_attr(&e, "type").as_deref() == Some("cover") {
                            guide_cover_href = xml_attr(&e, "href");
                        }
                    } else if ln == b"meta" {
                        if xml_attr(&e, "name").as_deref() == Some("cover") {
                            meta_cover_id = xml_attr(&e, "content");
                        }
                    } else if matches!(ln.as_slice(), b"title" | b"creator" | b"publisher" | b"description") {
                        cur_meta_tag = Some(ln);
                        cur_meta_text.clear();
                    }
                }
                Ok(Event::Empty(e)) => {
                    let ln = local_name(e.name().as_ref()).to_vec();
                    if ln == b"item" {
                        let id = xml_attr(&e, "id").unwrap_or_default();
                        let href = xml_attr(&e, "href").unwrap_or_default();
                        let media_type = xml_attr(&e, "media-type").unwrap_or_default().to_lowercase();
                        let properties = xml_attr(&e, "properties").unwrap_or_default();
                        if !id.is_empty() {
                            manifest.insert(id, ManifestItem { href, media_type, properties });
                        }
                    } else if ln == b"itemref" && first_spine_href.is_none() {
                        if let Some(idref) = xml_attr(&e, "idref") {
                            first_spine_href = Some(idref);
                        }
                    } else if ln == b"reference" {
                        if xml_attr(&e, "type").as_deref() == Some("cover") {
                            guide_cover_href = xml_attr(&e, "href");
                        }
                    } else if ln == b"meta" {
                        if xml_attr(&e, "name").as_deref() == Some("cover") {
                            meta_cover_id = xml_attr(&e, "content");
                        }
                    }
                }
                Ok(Event::Text(e)) => {
                    if cur_meta_tag.is_some() {
                        if let Ok(t) = e.unescape() {
                            cur_meta_text.push_str(&t);
                        }
                    }
                }
                Ok(Event::End(e)) => {
                    let ln = local_name(e.name().as_ref()).to_vec();
                    if Some(&ln) == cur_meta_tag.as_ref() {
                        match ln.as_slice() {
                            b"title" => got(&mut book_title, cur_meta_text.clone()),
                            b"creator" => got(&mut book_author, cur_meta_text.clone()),
                            b"publisher" => got(&mut book_publisher, cur_meta_text.clone()),
                            b"description" => got(&mut book_description, cur_meta_text.clone()),
                            _ => {}
                        }
                        cur_meta_tag = None;
                    }
                }
                Ok(Event::Eof) => break,
                Err(_) => break,
                _ => {}
            }
            buf.clear();
        }

        // Step A: EPUB3 cover-image property
        cover_href = manifest
            .values()
            .find(|it| it.properties.contains("cover-image") && it.media_type.starts_with("image/"))
            .map(|it| it.href.clone());

        // Step B: EPUB2 meta name=cover -> manifest id
        if cover_href.is_none() {
            if let Some(id) = &meta_cover_id {
                cover_href = manifest.get(id).map(|it| it.href.clone());
            }
        }

        // Step C: guide reference type=cover (direct image, or xhtml wrapper via regex)
        if cover_href.is_none() {
            if let Some(href) = &guide_cover_href {
                if is_image_name(href) {
                    cover_href = Some(href.clone());
                } else {
                    let full = resolve_zip_path(&opf_dir, href);
                    if let Some(html) = zip_read_text(&mut archive, &full) {
                        if let Some(src) = extract_first_img_src(&html) {
                            let html_dir = dir_of(&full);
                            cover_href = Some(resolve_zip_path(&html_dir, &src));
                        }
                    }
                }
            }
        }

        // Step D: manifest heuristic search
        if cover_href.is_none() {
            cover_href = manifest
                .iter()
                .find(|(id, it)| {
                    it.media_type.starts_with("image/") && (is_cover_like(id) || is_cover_like(&it.href))
                })
                .map(|(_, it)| it.href.clone());
        }
    }

    // Resolve & load cover bytes
    if let Some(href) = &cover_href {
        let full = resolve_zip_path(&opf_dir, href);
        if let Some((name, bytes)) = zip_read_bytes_case_insensitive(&mut archive, &full)
            .or_else(|| zip_read_bytes_case_insensitive(&mut archive, href))
        {
            let _ = name;
            if let Some(thumb) = downsize_to_jpeg_data_url(&bytes, 380, 540) {
                return Some(ExtractedDoc {
                    text: truncate_chars(
                        &format!(
                            "[전자책 EPUB] {book_title}\n저자: {}\n출판사: {}\n\n[도서 소개]\n{}",
                            if book_author.is_empty() { "작가 미상" } else { &book_author },
                            if book_publisher.is_empty() { "전자출판" } else { &book_publisher },
                            if book_description.is_empty() { "EPUB 표준 전자책입니다." } else { &book_description },
                        ),
                        500,
                    ),
                    page_count: 250,
                    cover_data_url: Some(thumb),
                });
            }
        }
    }

    // Step F: first spine HTML page image
    if let Some(idref) = &first_spine_href {
        if let Some(item) = manifest.get(idref) {
            let full = resolve_zip_path(&opf_dir, &item.href);
            if let Some(html) = zip_read_text(&mut archive, &full) {
                if let Some(src) = extract_first_img_src(&html) {
                    let html_dir = dir_of(&full);
                    let img_path = resolve_zip_path(&html_dir, &src);
                    if let Some((_, bytes)) = zip_read_bytes_case_insensitive(&mut archive, &img_path) {
                        if let Some(thumb) = downsize_to_jpeg_data_url(&bytes, 380, 540) {
                            return Some(ExtractedDoc {
                                text: truncate_chars(
                                    &format!(
                                        "[전자책 EPUB] {book_title}\n저자: {}\n\n{}",
                                        if book_author.is_empty() { "작가 미상" } else { &book_author },
                                        book_description
                                    ),
                                    500,
                                ),
                                page_count: 250,
                                cover_data_url: Some(thumb),
                            });
                        }
                    }
                }
            }
        }
    }

    // Step G: fallback to any image in the zip, preferring cover-ish names
    let mut all_images: Vec<String> = archive
        .file_names()
        .filter(|n| is_image_name(n) && !n.contains("__MACOSX"))
        .map(|s| s.to_string())
        .collect();
    all_images.sort_by(|a, b| {
        let a_cover = is_cover_like(a);
        let b_cover = is_cover_like(b);
        match (a_cover, b_cover) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => natural_key(a).cmp(&natural_key(b)),
        }
    });

    if let Some(first) = all_images.first() {
        if let Some((_, bytes)) = zip_read_bytes_case_insensitive(&mut archive, first) {
            if let Some(thumb) = downsize_to_jpeg_data_url(&bytes, 380, 540) {
                return Some(ExtractedDoc {
                    text: truncate_chars(
                        &format!(
                            "[전자책 EPUB] {book_title}\n저자: {}\n\n{}",
                            if book_author.is_empty() { "작가 미상" } else { &book_author },
                            book_description
                        ),
                        500,
                    ),
                    page_count: 250,
                    cover_data_url: Some(thumb),
                });
            }
        }
    }

    Some(ExtractedDoc {
        text: truncate_chars(
            &format!(
                "[전자책 EPUB] {book_title}\n저자: {}\n\n{}",
                if book_author.is_empty() { "작가 미상" } else { &book_author },
                book_description
            ),
            500,
        ),
        page_count: 250,
        cover_data_url: None,
    })
}

/// Fast regex-free <img src="..."> / <image xlink:href="..."> extraction from raw HTML/XHTML text.
fn extract_first_img_src(html: &str) -> Option<String> {
    let lower = html.to_lowercase();
    for tag in ["<img", "<image"] {
        if let Some(tag_start) = lower.find(tag) {
            let tag_end = lower[tag_start..].find('>').map(|i| tag_start + i).unwrap_or(html.len());
            let slice = &html[tag_start..tag_end];
            for attr in ["src=", "xlink:href=", "href="] {
                if let Some(pos) = slice.to_lowercase().find(attr) {
                    let rest = &slice[pos + attr.len()..];
                    let quote = rest.chars().next()?;
                    if quote == '"' || quote == '\'' {
                        let rest = &rest[1..];
                        if let Some(end) = rest.find(quote) {
                            return Some(rest[..end].to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

// ---------------------------------------------------------------------------
// 7. Comic book (.zip / .cbz) — cover / first page image, with one level of
//    nested-volume-zip traversal (mirrors extractComicZip)
// ---------------------------------------------------------------------------

fn extract_comic_zip(path: &str) -> Option<ExtractedDoc> {
    let title = Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("만화책")
        .to_string();

    let mut archive = open_zip(path).ok()?;

    let mut image_names: Vec<String> = archive
        .file_names()
        .filter(|n| is_image_name(n) && !is_hidden_or_macosx(n))
        .map(|s| s.to_string())
        .collect();

    if !image_names.is_empty() {
        image_names.sort_by(|a, b| {
            let a_cover = is_cover_like(a);
            let b_cover = is_cover_like(b);
            match (a_cover, b_cover) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => natural_key(a).cmp(&natural_key(b)),
            }
        });

        if let Some((_, bytes)) = zip_read_bytes_case_insensitive(&mut archive, &image_names[0]) {
            if let Some(thumb) = downsize_to_jpeg_data_url(&bytes, 380, 540) {
                return Some(ExtractedDoc {
                    text: truncate_chars(
                        &format!(
                            "[만화책 코믹스] {title}\n총 {}페이지 수록\n첫 페이지 표지: {}",
                            image_names.len(),
                            image_names[0]
                        ),
                        500,
                    ),
                    page_count: image_names.len() as u32,
                    cover_data_url: Some(thumb),
                });
            }
        }
    }

    // Nested volume zip (one level)
    let mut nested_names: Vec<String> = archive
        .file_names()
        .filter(|n| {
            !is_hidden_or_macosx(n) && (n.to_lowercase().ends_with(".zip") || n.to_lowercase().ends_with(".cbz"))
        })
        .map(|s| s.to_string())
        .collect();
    nested_names.sort_by(|a, b| natural_key(a).cmp(&natural_key(b)));

    if let Some(first_nested) = nested_names.first() {
        if let Some((_, nested_bytes)) = zip_read_bytes_case_insensitive(&mut archive, first_nested) {
            if let Ok(mut nested_archive) = ZipArchive::new(std::io::Cursor::new(nested_bytes)) {
                let mut nested_images: Vec<String> = nested_archive
                    .file_names()
                    .filter(|n| is_image_name(n) && !is_hidden_or_macosx(n))
                    .map(|s| s.to_string())
                    .collect();
                nested_images.sort_by(|a, b| natural_key(a).cmp(&natural_key(b)));

                if let Some(first_img_name) = nested_images.first().cloned() {
                    if let Ok(mut f) = nested_archive.by_name(&first_img_name) {
                        let mut buf = Vec::new();
                        if f.read_to_end(&mut buf).is_ok() {
                            if let Some(thumb) = downsize_to_jpeg_data_url(&buf, 380, 540) {
                                return Some(ExtractedDoc {
                                    text: truncate_chars(
                                        &format!(
                                            "[만화책 코믹스 전권] {title}\n총 {}권 수록 (1권: {first_nested})\n첫 페이지 표지: {first_img_name}",
                                            nested_names.len()
                                        ),
                                        500,
                                    ),
                                    page_count: (nested_images.len() as u32) * (nested_names.len() as u32),
                                    cover_data_url: Some(thumb),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    Some(ExtractedDoc {
        text: format!("{title} 만화책 파일"),
        page_count: image_names.len().max(1) as u32,
        cover_data_url: None,
    })
}

// ---------------------------------------------------------------------------
// 8. Plain text / markdown / code fallback
// ---------------------------------------------------------------------------

fn extract_plain_text(path: &str) -> Option<ExtractedDoc> {
    let bytes = read_bytes(path).ok()?;
    let text = decode_text_bytes(&bytes);
    Some(ExtractedDoc {
        text: truncate_chars(&text, 500),
        page_count: 1,
        cover_data_url: None,
    })
}

/// Decodes file bytes to a String, auto-detecting the common encodings for
/// Korean text files: UTF-8/UTF-16 (via BOM when present), and legacy
/// EUC-KR/CP949 for BOM-less files. Many older Korean .txt files predate
/// UTF-8 adoption; naively assuming UTF-8 (the previous behavior) turns
/// those into a wall of U+FFFD replacement characters, destroying the text
/// for both preview and keyword search.
fn decode_text_bytes(bytes: &[u8]) -> String {
    if let Some(rest) = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]) {
        return String::from_utf8_lossy(rest).to_string();
    }
    if let Some(rest) = bytes.strip_prefix(&[0xFF, 0xFE]) {
        return encoding_rs::UTF_16LE.decode(rest).0.to_string();
    }
    if let Some(rest) = bytes.strip_prefix(&[0xFE, 0xFF]) {
        return encoding_rs::UTF_16BE.decode(rest).0.to_string();
    }

    // No BOM: valid UTF-8 is trusted outright (the overwhelmingly common
    // case for anything created or saved in the last ~15 years).
    if let Ok(s) = std::str::from_utf8(bytes) {
        return s.to_string();
    }

    // Not valid UTF-8 — try legacy Korean encoding before giving up to a
    // lossy UTF-8 decode (which would just be replacement-character noise
    // for a genuinely EUC-KR/CP949 file).
    let (text, _, had_errors) = encoding_rs::EUC_KR.decode(bytes);
    if had_errors {
        return String::from_utf8_lossy(bytes).to_string();
    }
    text.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    fn tmp_path(name: &str) -> String {
        let dir = std::env::temp_dir().join(format!("extractor_test_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name).to_string_lossy().to_string()
    }

    #[test]
    fn extracts_plain_text() {
        let path = tmp_path("note.txt");
        std::fs::write(&path, "안녕하세요 테스트 문서입니다").unwrap();
        let doc = extract(&path, "txt");
        assert_eq!(doc.text, "안녕하세요 테스트 문서입니다");
        assert_eq!(doc.page_count, 1);
        assert!(doc.cover_data_url.is_none());
    }

    #[test]
    fn decodes_legacy_euc_kr_text_files() {
        let original = "옛날 방식으로 저장된 한글 문서";
        let (encoded, _, had_errors) = encoding_rs::EUC_KR.encode(original);
        assert!(!had_errors, "test string must be fully EUC-KR representable");

        let path = tmp_path("legacy_euckr.txt");
        std::fs::write(&path, &encoded).unwrap();

        let doc = extract(&path, "txt");
        assert_eq!(doc.text, original);
    }

    #[test]
    fn extracts_docx_paragraphs() {
        let path = tmp_path("sample.docx");
        let file = File::create(&path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let opts = SimpleFileOptions::default();
        zip.start_file("word/document.xml", opts).unwrap();
        let xml = r#"<?xml version="1.0"?><w:document xmlns:w="ns"><w:body>
                <w:p><w:r><w:t>첫 번째 문단입니다</w:t></w:r></w:p>
                <w:p><w:r><w:t>두 번째 </w:t></w:r><w:r><w:t>문단</w:t></w:r></w:p>
            </w:body></w:document>"#;
        zip.write_all(xml.as_bytes()).unwrap();
        zip.finish().unwrap();

        let doc = extract(&path, "docx");
        assert!(doc.text.contains("첫 번째 문단입니다"));
        assert!(doc.text.contains("두 번째 문단"));
    }

    #[test]
    fn extracts_comic_zip_cover() {
        let path = tmp_path("comic.cbz");
        let file = File::create(&path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let opts = SimpleFileOptions::default();

        // 1x1 red pixel PNG
        let png_bytes: &[u8] = &[
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48,
            0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00,
            0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08,
            0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D,
            0xB0, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
        ];

        zip.start_file("002.jpg", opts).unwrap();
        zip.write_all(b"not a real jpg but fine for name-sort test").unwrap();
        zip.start_file("001_cover.png", opts).unwrap();
        zip.write_all(png_bytes).unwrap();
        zip.finish().unwrap();

        let doc = extract(&path, "cbz");
        assert_eq!(doc.page_count, 2);
        assert!(doc.cover_data_url.is_some());
        assert!(doc.text.contains("만화책"));
    }

    #[test]
    fn natural_key_orders_numbers_numerically() {
        let mut names = vec!["img10.jpg".to_string(), "img2.jpg".to_string(), "img1.jpg".to_string()];
        names.sort_by(|a, b| natural_key(a).cmp(&natural_key(b)));
        assert_eq!(names, vec!["img1.jpg", "img2.jpg", "img10.jpg"]);
    }

    #[test]
    fn extract_first_img_src_finds_src_attr() {
        let html = r#"<html><body><p>hi</p><img src="images/cover.jpg" alt="c"/></body></html>"#;
        assert_eq!(extract_first_img_src(html), Some("images/cover.jpg".to_string()));
    }

    #[test]
    fn resolve_zip_path_collapses_relative_segments() {
        assert_eq!(resolve_zip_path("OEBPS/", "../images/cover.jpg"), "images/cover.jpg");
        assert_eq!(resolve_zip_path("OEBPS/", "images/cover.jpg"), "OEBPS/images/cover.jpg");
        assert_eq!(resolve_zip_path("OEBPS/", "/root/cover.jpg"), "root/cover.jpg");
    }

    fn utf16le_bytes(s: &str) -> Vec<u8> {
        s.encode_utf16().flat_map(|u| u.to_le_bytes()).collect()
    }

    fn hwp_para_text_record(text: &str) -> Vec<u8> {
        let payload = utf16le_bytes(text);
        let size = payload.len() as u32;
        assert!(size < 0xFFF, "test payload too large for a short record");
        let header = (size << 20) | HWPTAG_PARA_TEXT;
        let mut record = header.to_le_bytes().to_vec();
        record.extend_from_slice(&payload);
        record
    }

    #[test]
    fn decode_para_text_skips_inline_control_blocks() {
        // 'A' (0x0041), an 8-unit inline control block (control char 0x01 + 7
        // metadata units), then 'B' (0x0042) — only A and B should survive.
        let mut units: Vec<u16> = vec![0x0041];
        units.push(0x0001);
        units.extend(std::iter::repeat(0u16).take(7));
        units.push(0x0042);
        let bytes: Vec<u8> = units.iter().flat_map(|u| u.to_le_bytes()).collect();
        assert_eq!(decode_para_text(&bytes), "AB");
    }

    #[test]
    fn extracts_hwp5_paragraph_text_from_synthetic_cfb() {
        let mut file_header = vec![0u8; 256];
        file_header[36] = 0x01; // bit 0: BodyText streams are DEFLATE-compressed

        let mut section_records = Vec::new();
        section_records.extend(hwp_para_text_record("안녕하세요"));
        section_records.extend(hwp_para_text_record("두 번째 문단"));

        let mut compressed = Vec::new();
        {
            let mut encoder =
                flate2::write::DeflateEncoder::new(&mut compressed, flate2::Compression::default());
            encoder.write_all(&section_records).unwrap();
            encoder.finish().unwrap();
        }

        let cursor = std::io::Cursor::new(Vec::<u8>::new());
        let mut comp = cfb::CompoundFile::create(cursor).unwrap();
        comp.create_stream("/FileHeader").unwrap().write_all(&file_header).unwrap();
        comp.create_storage("/BodyText").unwrap();
        comp.create_stream("/BodyText/Section0").unwrap().write_all(&compressed).unwrap();
        let cursor = comp.into_inner();

        let path = tmp_path("synthetic.hwp");
        std::fs::write(&path, cursor.into_inner()).unwrap();

        let doc = extract_hwp(&path).expect("extract_hwp should succeed on a well-formed CFB");
        assert!(doc.text.contains("안녕하세요"), "got: {}", doc.text);
        assert!(doc.text.contains("두 번째 문단"), "got: {}", doc.text);
    }
}
