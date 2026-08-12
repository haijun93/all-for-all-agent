use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use image::imageops::FilterType;
use image::DynamicImage;

/// Resizes an already-decoded image to fit within max_w x max_h, flattens
/// any transparency onto a white background, and JPEG-encodes it.
/// Shared by document cover thumbnails and native photo thumbnails so
/// there's exactly one place that does this (fairly involved) resize +
/// alpha-composite + encode pipeline.
pub fn resize_to_jpeg_bytes(
    img: &DynamicImage,
    max_w: u32,
    max_h: u32,
    quality: u8,
) -> Option<Vec<u8>> {
    let (w, h) = (img.width(), img.height());
    if w == 0 || h == 0 {
        return None;
    }

    let aspect = w as f64 / h as f64;
    let mut target_w = w;
    let mut target_h = h;
    if target_w > max_w {
        target_w = max_w;
        target_h = ((target_w as f64) / aspect).round() as u32;
    }
    if target_h > max_h {
        target_h = max_h;
        target_w = ((target_h as f64) * aspect).round() as u32;
    }
    let target_w = target_w.max(1);
    let target_h = target_h.max(1);

    let resized = img.resize(target_w, target_h, FilterType::CatmullRom).to_rgba8();

    // Alpha-composite onto a white background (mirrors ctx.fillStyle = '#fff' before drawImage)
    let mut canvas = image::RgbImage::from_pixel(target_w, target_h, image::Rgb([255, 255, 255]));
    for (x, y, p) in resized.enumerate_pixels() {
        let [r, g, b, a] = p.0;
        let alpha = a as f32 / 255.0;
        let blend = |c: u8| -> u8 { ((c as f32) * alpha + 255.0 * (1.0 - alpha)).round() as u8 };
        canvas.put_pixel(x, y, image::Rgb([blend(r), blend(g), blend(b)]));
    }

    let mut out = Vec::new();
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, quality);
    encoder.encode_image(&canvas).ok()?;
    Some(out)
}

pub fn resize_to_jpeg_data_url(img: &DynamicImage, max_w: u32, max_h: u32, quality: u8) -> Option<String> {
    let bytes = resize_to_jpeg_bytes(img, max_w, max_h, quality)?;
    Some(format!("data:image/jpeg;base64,{}", BASE64.encode(bytes)))
}

pub fn resize_bytes_to_jpeg_data_url(bytes: &[u8], max_w: u32, max_h: u32, quality: u8) -> Option<String> {
    let img = image::load_from_memory(bytes).ok()?;
    resize_to_jpeg_data_url(&img, max_w, max_h, quality)
}
