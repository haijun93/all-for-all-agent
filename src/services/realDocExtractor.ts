import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import type { DocFormat } from '../types/document';
import { DocRendererService } from './docRenderer';

// Configure PDF.js worker
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    // Fallback CDN if bundler worker fails
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }
}

export interface RealDocParseResult {
  thumbnailUrl: string;
  extractedText: string;
  pageCount: number;
}

export class RealDocExtractor {
  /**
   * Main entry point: Extracts real 1st page visual thumbnail and text with strict timeout protection
   */
  public static async extractRealDocumentData(
    file: File,
    format: DocFormat,
    category: string
  ): Promise<RealDocParseResult> {
    const parsePromise = async (): Promise<RealDocParseResult> => {
      if (format === 'pdf') {
        return await this.extractPdf(file);
      } else if (format === 'docx' || format === 'doc') {
        return await this.extractDocx(file, category);
      } else if (format === 'xlsx' || format === 'xls') {
        return await this.extractXlsx(file, category);
      } else if (format === 'hwpx') {
        return await this.extractHwpx(file, category);
      } else if (format === 'hwp') {
        return await this.extractHwp(file, category);
      } else if (format === 'epub') {
        return await this.extractEpub(file, category);
      } else {
        return await this.extractPlainText(file, format, category);
      }
    };

    const timeoutPromise = new Promise<RealDocParseResult>((_, reject) => {
      setTimeout(() => reject(new Error('Extraction timeout')), 2500);
    });

    try {
      return await Promise.race([parsePromise(), timeoutPromise]);
    } catch (err) {
      console.warn(`[RealDocExtractor] Fallback for ${file.name}:`, err);
      const title = file.name.replace(/\.[^/.]+$/, '');
      const dateStr = new Date(file.lastModified).toISOString().split('T')[0];
      const thumb = DocRendererService.generateDocumentFirstPageThumbnail(
        title,
        format,
        category,
        `${title} 본문 내용`,
        dateStr,
        '문서 작성자'
      );
      return {
        thumbnailUrl: thumb,
        extractedText: `${title} 문서입니다.`,
        pageCount: 1,
      };
    }
  }

  /**
   * 1. Real PDF 1st Page Canvas Rendering & Text Extraction
   */
  private static async extractPdf(file: File): Promise<RealDocParseResult> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;

    // Load actual Page 1
    const page = await pdf.getPage(1);
    const unscaledViewport = page.getViewport({ scale: 1.0 });

    // Target A4 thumbnail aspect ratio (~380 width)
    const targetWidth = 380;
    const scale = targetWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d', { alpha: false });

    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await (page.render({ canvasContext: ctx, viewport } as any)).promise;
    }

    // Extract real text from Page 1
    const textContent = await page.getTextContent();
    const textItems = textContent.items
      .map((item: any) => (item.str ? item.str : ''))
      .join(' ');

    const cleanText = textItems.replace(/\s+/g, ' ').trim() || file.name;
    const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.85);

    return {
      thumbnailUrl,
      extractedText: cleanText,
      pageCount,
    };
  }

  /**
   * 2. Real Word (.docx) XML Extraction & 1st Page Layout Rendering
   */
  private static async extractDocx(file: File, category: string): Promise<RealDocParseResult> {
    const zip = await JSZip.loadAsync(file);
    let extractedText = '';
    const paragraphs: string[] = [];

    const docXmlFile = zip.file('word/document.xml');
    if (docXmlFile) {
      const xmlStr = await docXmlFile.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
      const pNodes = xmlDoc.getElementsByTagName('w:p');

      for (let i = 0; i < pNodes.length; i++) {
        const textContent = pNodes[i].textContent?.trim();
        if (textContent) {
          paragraphs.push(textContent);
        }
      }
      extractedText = paragraphs.join('\n');
    }

    const title = file.name.replace(/\.[^/.]+$/, '');
    const dateStr = new Date(file.lastModified).toISOString().split('T')[0];

    // Render real extracted paragraphs onto document canvas
    const canvas = document.createElement('canvas');
    canvas.width = 380;
    canvas.height = 530;
    const ctx = canvas.getContext('2d', { alpha: false });

    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 380, 530);

      // Top Word Blue Stripe
      ctx.fillStyle = '#2b579a';
      ctx.fillRect(0, 0, 380, 8);

      // Header info
      ctx.fillStyle = '#2b579a';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(paragraphs[0] || title, 24, 38, 332);

      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${category} • ${dateStr}`, 24, 54);

      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(24, 64, 332, 1);

      // Render actual paragraphs
      let curY = 86;
      ctx.fillStyle = '#1e293b';

      for (let pIdx = 0; pIdx < Math.min(paragraphs.length, 8); pIdx++) {
        const text = paragraphs[pIdx];
        if (pIdx === 0 && text === title) continue;

        ctx.font = pIdx === 1 ? 'bold 12px sans-serif' : '10px sans-serif';
        const words = text.split(' ');
        let line = '';

        for (let w = 0; w < words.length; w++) {
          const test = line + words[w] + ' ';
          if (ctx.measureText(test).width > 330 && w > 0) {
            ctx.fillText(line, 24, curY);
            line = words[w] + ' ';
            curY += 15;
            if (curY > 480) break;
          } else {
            line = test;
          }
        }
        ctx.fillText(line, 24, curY);
        curY += 18;
        if (curY > 480) break;
      }
    }

    return {
      thumbnailUrl: canvas.toDataURL('image/jpeg', 0.85),
      extractedText: extractedText || title,
      pageCount: Math.max(1, Math.ceil(paragraphs.length / 5)),
    };
  }

  /**
   * 3. Real Excel (.xlsx) XML Extraction & Spreadsheet Grid Rendering
   */
  private static async extractXlsx(file: File, category: string): Promise<RealDocParseResult> {
    const zip = await JSZip.loadAsync(file);
    const sharedStrings: string[] = [];
    const cellRows: Array<Array<{ col: string; val: string }>> = [];

    // Parse Shared Strings
    const sstFile = zip.file('xl/sharedStrings.xml');
    if (sstFile) {
      const sstXml = await sstFile.async('text');
      const parser = new DOMParser();
      const sstDoc = parser.parseFromString(sstXml, 'application/xml');
      const tNodes = sstDoc.getElementsByTagName('t');
      for (let i = 0; i < tNodes.length; i++) {
        sharedStrings.push(tNodes[i].textContent || '');
      }
    }

    // Parse Sheet 1
    const sheetFile = zip.file('xl/worksheets/sheet1.xml');
    if (sheetFile) {
      const sheetXml = await sheetFile.async('text');
      const parser = new DOMParser();
      const sheetDoc = parser.parseFromString(sheetXml, 'application/xml');
      const rowNodes = sheetDoc.getElementsByTagName('row');

      for (let r = 0; r < Math.min(rowNodes.length, 18); r++) {
        const row = rowNodes[r];
        const rowCells: Array<{ col: string; val: string }> = [];
        const cNodes = row.getElementsByTagName('c');

        for (let c = 0; c < Math.min(cNodes.length, 6); c++) {
          const cell = cNodes[c];
          const type = cell.getAttribute('t');
          const vNode = cell.getElementsByTagName('v')[0];
          let val = vNode?.textContent || '';

          if (type === 's' && sharedStrings[parseInt(val, 10)]) {
            val = sharedStrings[parseInt(val, 10)];
          }
          rowCells.push({ col: cell.getAttribute('r') || '', val });
        }
        cellRows.push(rowCells);
      }
    }

    const title = file.name.replace(/\.[^/.]+$/, '');
    const dateStr = new Date(file.lastModified).toISOString().split('T')[0];

    // Render Real Spreadsheet Matrix onto Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 380;
    canvas.height = 530;
    const ctx = canvas.getContext('2d', { alpha: false });

    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 380, 530);

      // Top Excel Green Bar
      ctx.fillStyle = '#107c41';
      ctx.fillRect(0, 0, 380, 8);

      ctx.fillStyle = '#107c41';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(title, 20, 32);

      ctx.fillStyle = '#64748b';
      ctx.font = '9px sans-serif';
      ctx.fillText(`${category} • ${dateStr}`, 20, 46);

      // Draw real cell table
      let y = 60;
      const colWidth = 56;

      cellRows.forEach((row, rIdx) => {
        ctx.fillStyle = rIdx === 0 ? '#107c41' : rIdx % 2 === 0 ? '#f8fafc' : '#ffffff';
        ctx.fillRect(20, y, 340, 20);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(20, y, 340, 20);

        row.forEach((cell, cIdx) => {
          ctx.fillStyle = rIdx === 0 ? '#ffffff' : '#1e293b';
          ctx.font = rIdx === 0 ? 'bold 9px sans-serif' : '9px sans-serif';
          ctx.fillText(cell.val.slice(0, 8), 24 + cIdx * colWidth, y + 14);
        });

        y += 20;
      });
    }

    const fullText = cellRows.map((r) => r.map((c) => c.val).join('\t')).join('\n');

    return {
      thumbnailUrl: canvas.toDataURL('image/jpeg', 0.85),
      extractedText: fullText || title,
      pageCount: Math.max(1, cellRows.length),
    };
  }

  /**
   * 4. Real HWPX (OWPML) Image / Text Extraction
   */
  private static async extractHwpx(file: File, category: string): Promise<RealDocParseResult> {
    const zip = await JSZip.loadAsync(file);

    // Check for pre-rendered real preview image
    const previewImgFile = zip.file('Preview/PrvImage.png') || zip.file('Preview/PrvImage.jpg');
    if (previewImgFile) {
      const base64 = await previewImgFile.async('base64');
      const mime = previewImgFile.name.endsWith('.png') ? 'image/png' : 'image/jpeg';
      return {
        thumbnailUrl: `data:${mime};base64,${base64}`,
        extractedText: `${file.name.replace(/\.[^/.]+$/, '')} 한글 HWPX 정식 문서`,
        pageCount: 1,
      };
    }

    // Otherwise extract Section0.xml text
    let text = '';
    const secFile = zip.file('Contents/section0.xml');
    if (secFile) {
      const xmlStr = await secFile.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
      const tNodes = xmlDoc.getElementsByTagName('hp:t');
      text = Array.from(tNodes).map((n) => n.textContent || '').join(' ');
    }

    const title = file.name.replace(/\.[^/.]+$/, '');
    const dateStr = new Date(file.lastModified).toISOString().split('T')[0];
    const thumb = DocRendererService.generateDocumentFirstPageThumbnail(
      title,
      'hwpx',
      category,
      text.slice(0, 100) || title,
      dateStr,
      '한글 작성자'
    );

    return {
      thumbnailUrl: thumb,
      extractedText: text || title,
      pageCount: 1,
    };
  }

  /**
   * 5. Real HWP 5.0 Binary Extraction
   */
  private static async extractHwp(file: File, category: string): Promise<RealDocParseResult> {
    const title = file.name.replace(/\.[^/.]+$/, '');
    const dateStr = new Date(file.lastModified).toISOString().split('T')[0];

    // Read head bytes to check for embedded preview image (PNG/JPEG header in binary stream)
    const arrayBuffer = await file.slice(0, 1024 * 512).arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Search for PNG magic numbers: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    let pngStart = -1;
    for (let i = 0; i < uint8.length - 8; i++) {
      if (
        uint8[i] === 0x89 &&
        uint8[i + 1] === 0x50 &&
        uint8[i + 2] === 0x4e &&
        uint8[i + 3] === 0x47
      ) {
        pngStart = i;
        break;
      }
    }

    if (pngStart !== -1) {
      const pngBlob = new Blob([uint8.slice(pngStart)], { type: 'image/png' });
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(pngBlob);
      });

      return {
        thumbnailUrl: dataUrl,
        extractedText: `${title} 한글 HWP 문서`,
        pageCount: 1,
      };
    }

    const thumb = DocRendererService.generateDocumentFirstPageThumbnail(
      title,
      'hwp',
      category,
      `${title} 공문서 본문`,
      dateStr,
      '기안 부서'
    );

    return {
      thumbnailUrl: thumb,
      extractedText: `${title} 한글 문서`,
      pageCount: 1,
    };
  }

  /**
   * 6. Real EPUB eBook Cover Image Extraction
   */
  private static async extractEpub(file: File, category: string): Promise<RealDocParseResult> {
    const zip = await JSZip.loadAsync(file);

    // Search for cover image inside EPUB zip
    const coverFiles = Object.keys(zip.files).filter((name) =>
      /(cover\.(jpe?g|png)|images\/cover\.(jpe?g|png)|OEBPS\/.*cover\.(jpe?g|png))/i.test(name)
    );

    if (coverFiles.length > 0) {
      const coverFile = zip.file(coverFiles[0]);
      if (coverFile) {
        const base64 = await coverFile.async('base64');
        const mime = coverFiles[0].endsWith('.png') ? 'image/png' : 'image/jpeg';
        return {
          thumbnailUrl: `data:${mime};base64,${base64}`,
          extractedText: `${file.name.replace(/\.[^/.]+$/, '')} 전자책 EPUB 도서`,
          pageCount: 200,
        };
      }
    }

    const title = file.name.replace(/\.[^/.]+$/, '');
    const dateStr = new Date(file.lastModified).toISOString().split('T')[0];
    const thumb = DocRendererService.generateDocumentFirstPageThumbnail(
      title,
      'epub',
      category,
      `${title} 전자책`,
      dateStr,
      '전자책 저자'
    );

    return {
      thumbnailUrl: thumb,
      extractedText: `${title} EPUB 도서`,
      pageCount: 200,
    };
  }

  /**
   * 7. Plain Text / Markdown / Code fallback
   */
  private static async extractPlainText(
    file: File,
    format: DocFormat,
    category: string
  ): Promise<RealDocParseResult> {
    const text = await file.text();
    const title = file.name.replace(/\.[^/.]+$/, '');
    const dateStr = new Date(file.lastModified).toISOString().split('T')[0];
    const thumb = DocRendererService.generateDocumentFirstPageThumbnail(
      title,
      format,
      category,
      text.slice(0, 150) || title,
      dateStr,
      '작성자'
    );

    return {
      thumbnailUrl: thumb,
      extractedText: text.slice(0, 2000),
      pageCount: 1,
    };
  }
}
