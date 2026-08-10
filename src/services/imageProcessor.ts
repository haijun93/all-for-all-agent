import type { EditParams } from '../types/photo';

export const DEFAULT_EDIT_PARAMS: EditParams = {
  rotation: 0,
  straighten: 0,
  flipH: false,
  flipV: false,
  feelingLucky: false,
  autoContrast: false,
  autoColor: false,
  redEyes: [],

  fillLight: 0,
  highlights: 0,
  shadows: 0,
  temperature: 0,
  tint: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  clarity: 0,

  filter: 'none',
  filterStrength: 100,
  vignetteStrength: 0,
  grainStrength: 0,
  tiltShiftY: 50,
};

/**
 * High-performance Canvas-based image processing engine inspired by Google Picasa
 */
export class ImageProcessor {
  private static imageCache = new Map<string, HTMLImageElement>();

  public static async loadImage(url: string): Promise<HTMLImageElement> {
    if (this.imageCache.has(url)) {
      const cached = this.imageCache.get(url)!;
      if (cached.complete) return cached;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.imageCache.set(url, img);
        resolve(img);
      };
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  }

  public static async renderToCanvas(
    canvas: HTMLCanvasElement,
    imageSource: string | HTMLImageElement,
    params: EditParams,
    maxDimension: number = 1920
  ): Promise<void> {
    const img = typeof imageSource === 'string' ? await this.loadImage(imageSource) : imageSource;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Calculate base dimensions
    const origWidth = img.naturalWidth || img.width;
    const origHeight = img.naturalHeight || img.height;

    if (origWidth === 0 || origHeight === 0) return;

    // Scale down for preview performance if needed
    let scale = 1;
    if (Math.max(origWidth, origHeight) > maxDimension) {
      scale = maxDimension / Math.max(origWidth, origHeight);
    }

    const targetWidth = Math.round(origWidth * scale);
    const targetHeight = Math.round(origHeight * scale);

    // Apply crop boundary if specified
    let cropX = 0;
    let cropY = 0;
    let cropW = targetWidth;
    let cropH = targetHeight;

    if (params.crop) {
      cropX = Math.round(params.crop.x * targetWidth);
      cropY = Math.round(params.crop.y * targetHeight);
      cropW = Math.round(params.crop.width * targetWidth);
      cropH = Math.round(params.crop.height * targetHeight);
    }

    // Determine canvas dimensions based on 90/270 rotation
    const isRotated90or270 = params.rotation === 90 || params.rotation === 270;
    canvas.width = isRotated90or270 ? cropH : cropW;
    canvas.height = isRotated90or270 ? cropW : cropH;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Center transform
    ctx.translate(canvas.width / 2, canvas.height / 2);

    // Rotation
    ctx.rotate((params.rotation * Math.PI) / 180);

    // Straighten tilt
    if (params.straighten !== 0) {
      ctx.rotate((params.straighten * Math.PI) / 180);
      // Auto zoom to avoid empty borders when straightened
      const rad = Math.abs((params.straighten * Math.PI) / 180);
      const straightenScale = 1 + Math.sin(rad) * 0.8;
      ctx.scale(straightenScale, straightenScale);
    }

    // Flip
    ctx.scale(params.flipH ? -1 : 1, params.flipV ? -1 : 1);

    ctx.drawImage(
      img,
      0,
      0,
      origWidth,
      origHeight,
      -targetWidth / 2 - cropX + (targetWidth - cropW) / 2,
      -targetHeight / 2 - cropY + (targetHeight - cropH) / 2,
      targetWidth,
      targetHeight
    );

    ctx.restore();

    // Now perform pixel-level adjustments
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Apply color & tone adjustments
    this.applyPixelTransforms(data, params);

    ctx.putImageData(imageData, 0, 0);

    // Apply Overlays (Vignette, Film Grain, Soft Focus, Tilt-Shift)
    this.applyCanvasOverlays(ctx, canvas.width, canvas.height, params);

    // Red-eye stamps
    if (params.redEyes && params.redEyes.length > 0) {
      for (const eye of params.redEyes) {
        this.fixRedEyeAtPoint(ctx, eye.x * canvas.width, eye.y * canvas.height, eye.radius);
      }
    }
  }

  private static applyPixelTransforms(data: Uint8ClampedArray, params: EditParams) {
    const len = data.length;

    // Calculate adjustment factors
    let bMult = params.brightness / 100; // -1 to 1
    let cFactor = (259 * (params.contrast + 255)) / (255 * (259 - params.contrast)); // Contrast factor
    let satMult = 1 + params.saturation / 100; // 0 to 2
    let fillLight = params.fillLight / 100; // 0 to 1
    let temp = params.temperature / 100; // -1 (cool) to 1 (warm)
    let tint = params.tint / 100; // -1 (green) to 1 (magenta)
    let highlights = params.highlights / 100;
    let shadows = params.shadows / 100;

    // "I'm Feeling Lucky" auto enhancement
    if (params.feelingLucky) {
      bMult += 0.08;
      cFactor *= 1.15;
      satMult *= 1.2;
      temp += 0.05;
      fillLight += 0.15;
    }

    if (params.autoContrast) {
      cFactor *= 1.25;
    }

    if (params.autoColor) {
      satMult *= 1.15;
    }

    for (let i = 0; i < len; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // 1. Fill light (boost shadows & midtones non-linearly)
      if (fillLight > 0) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const shadowFactor = Math.max(0, 1 - lum / 180) * fillLight * 60;
        r = Math.min(255, r + shadowFactor);
        g = Math.min(255, g + shadowFactor);
        b = Math.min(255, b + shadowFactor);
      }

      // 2. Highlights & Shadows adjustments
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (shadows !== 0 && lum < 0.5) {
        const shadowWeight = (0.5 - lum) * 2;
        const shadowDelta = shadows * shadowWeight * 50;
        r = Math.max(0, Math.min(255, r + shadowDelta));
        g = Math.max(0, Math.min(255, g + shadowDelta));
        b = Math.max(0, Math.min(255, g + shadowDelta));
      }
      if (highlights !== 0 && lum > 0.5) {
        const hlWeight = (lum - 0.5) * 2;
        const hlDelta = highlights * hlWeight * 50;
        r = Math.max(0, Math.min(255, r + hlDelta));
        g = Math.max(0, Math.min(255, g + hlDelta));
        b = Math.max(0, Math.min(255, g + hlDelta));
      }

      // 3. Temperature & Tint
      if (temp !== 0) {
        r += temp * 30;
        b -= temp * 30;
      }
      if (tint !== 0) {
        g -= tint * 25;
        r += tint * 12;
        b += tint * 12;
      }

      // 4. Brightness
      if (bMult !== 0) {
        r += bMult * 100;
        g += bMult * 100;
        b += bMult * 100;
      }

      // 5. Contrast
      if (params.contrast !== 0 || params.autoContrast || params.feelingLucky) {
        r = cFactor * (r - 128) + 128;
        g = cFactor * (g - 128) + 128;
        b = cFactor * (b - 128) + 128;
      }

      // 6. Saturation
      if (satMult !== 1) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = gray + (r - gray) * satMult;
        g = gray + (g - gray) * satMult;
        b = gray + (b - gray) * satMult;
      }

      // 7. Picasa Creative Filters
      const fStrength = params.filterStrength / 100;
      if (params.filter !== 'none') {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        let fr = r, fg = g, fb = b;

        switch (params.filter) {
          case 'bw':
            fr = fg = fb = gray > 120 ? Math.min(255, gray * 1.1) : gray * 0.9;
            break;
          case 'sepia':
            fr = gray * 1.2 + 20;
            fg = gray * 1.0 + 10;
            fb = gray * 0.75 - 10;
            break;
          case 'warmify':
            fr = r * 1.15 + 15;
            fg = g * 1.05 + 5;
            fb = b * 0.85;
            break;
          case 'cinema':
            fr = r > 128 ? r * 1.2 : r * 0.9;
            fg = g * 1.0;
            fb = b < 128 ? b * 1.3 : b * 0.8;
            break;
          case 'lomo':
            fr = r * 1.25;
            fg = g * 1.1;
            fb = b * 0.8;
            break;
          case 'vintage60':
            fr = r * 1.2 + 10;
            fg = g * 0.9 + 15;
            fb = b * 1.1 + 30;
            break;
          case 'posterize':
            fr = Math.floor(r / 64) * 85;
            fg = Math.floor(g / 64) * 85;
            fb = Math.floor(b / 64) * 85;
            break;
          case 'inverted':
            fr = 255 - r;
            fg = 255 - g;
            fb = 255 - b;
            break;
          case 'infrared':
            fr = (255 - b) * 1.2;
            fg = gray * 1.1;
            fb = (255 - r) * 0.8;
            break;
          default:
            break;
        }

        r = r * (1 - fStrength) + fr * fStrength;
        g = g * (1 - fStrength) + fg * fStrength;
        b = b * (1 - fStrength) + fb * fStrength;
      }

      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }
  }

  private static applyCanvasOverlays(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    params: EditParams
  ) {
    // 1. Vignette (Dark corner falloff)
    const vigStrength = params.filter === 'vignette' ? 80 : (params.filter === 'lomo' ? 70 : params.vignetteStrength);
    if (vigStrength > 0) {
      const radius = Math.sqrt((width / 2) ** 2 + (height / 2) ** 2);
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        radius * 0.4,
        width / 2,
        height / 2,
        radius * 0.95
      );
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(0.7, `rgba(0, 0, 0, ${(vigStrength / 100) * 0.4})`);
      gradient.addColorStop(1, `rgba(0, 0, 0, ${(vigStrength / 100) * 0.85})`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Film Grain
    const grainStrength = params.filter === 'film' ? 40 : params.grainStrength;
    if (grainStrength > 0) {
      const grainCanvas = document.createElement('canvas');
      grainCanvas.width = 120;
      grainCanvas.height = 120;
      const gCtx = grainCanvas.getContext('2d');
      if (gCtx) {
        const gImgData = gCtx.createImageData(120, 120);
        const gData = gImgData.data;
        for (let j = 0; j < gData.length; j += 4) {
          const noise = (Math.random() - 0.5) * 255;
          gData[j] = noise > 0 ? 255 : 0;
          gData[j + 1] = noise > 0 ? 255 : 0;
          gData[j + 2] = noise > 0 ? 255 : 0;
          gData[j + 3] = Math.abs(noise) * (grainStrength / 100) * 0.35;
        }
        gCtx.putImageData(gImgData, 0, 0);

        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        const pattern = ctx.createPattern(grainCanvas, 'repeat');
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, width, height);
        }
        ctx.restore();
      }
    }

    // 3. Soft Focus / Orton Glow
    if (params.filter === 'softFocus') {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.35 * (params.filterStrength / 100);
      ctx.filter = 'blur(12px) brightness(1.2)';
      ctx.drawImage(ctx.canvas, 0, 0);
      ctx.restore();
    }
  }

  private static fixRedEyeAtPoint(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    radius: number
  ) {
    const size = Math.round(radius * 2);
    const startX = Math.max(0, Math.round(centerX - radius));
    const startY = Math.max(0, Math.round(centerY - radius));
    const width = Math.min(ctx.canvas.width - startX, size);
    const height = Math.min(ctx.canvas.height - startY, size);

    if (width <= 0 || height <= 0) return;

    const imgData = ctx.getImageData(startX, startY, width, height);
    const d = imgData.data;

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];

      const gbAvg = (g + b) / 2;
      if (r > 80 && r / (gbAvg + 1) > 1.4) {
        const pupilDarkness = gbAvg * 0.6;
        d[i] = pupilDarkness;
        d[i + 1] = pupilDarkness;
        d[i + 2] = pupilDarkness;
      }
    }

    ctx.putImageData(imgData, startX, startY);
  }

  public static async exportImage(
    imageSource: string | HTMLImageElement,
    params: EditParams,
    format: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg',
    quality: number = 0.92
  ): Promise<string> {
    const canvas = document.createElement('canvas');
    await this.renderToCanvas(canvas, imageSource, params, 3840);
    return canvas.toDataURL(format, quality);
  }
}
