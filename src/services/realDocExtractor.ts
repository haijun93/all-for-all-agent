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
      } else if (format === 'zip' || format === 'cbz') {
        return await this.extractComicZip(file, category);
      } else {
        return await this.extractPlainText(file, format, category);
      }
    };

    // Dynamic timeout: scales from 3.5s up to 25s for 1GB+ large Comic ZIP files
    const dynamicTimeoutMs = Math.max(3500, Math.min(25000, Math.round((file.size / (1024 * 1024)) * 25)));

    const timeoutPromise = new Promise<RealDocParseResult>((_, reject) => {
      setTimeout(() => reject(new Error('Extraction timeout')), dynamicTimeoutMs);
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
   * 6. Calibre-Standard Real EPUB 2.0 & 3.0 Cover Image & Metadata Extraction Engine
   * Follows the exact Calibre specification:
   *  1. META-INF/container.xml -> OPF rootfile path
   *  2. OPF EPUB 3: <item properties="cover-image" href="..."/>
   *  3. OPF EPUB 2: <meta name="cover" content="item_id"/> -> <manifest item>
   *  4. OPF <guide><reference type="cover" href="..."/></guide> (including XHTML cover wrapper parsing)
   *  5. OPF Manifest heuristics (/cover/i, /jacket/i, /titlepage/i)
   *  6. OPF Spine first itemref XHTML 1st page extraction
   *  7. Rich metadata extraction (dc:title, dc:creator, dc:publisher, dc:description, dc:date)
   */
  private static async extractEpub(file: File, category: string): Promise<RealDocParseResult> {
    const zip = await JSZip.loadAsync(file);

    // 1. Locate OPF file via META-INF/container.xml
    let opfPath = 'OEBPS/content.opf';
    const containerFile = zip.file('META-INF/container.xml') || zip.file('meta-inf/container.xml');
    if (containerFile) {
      try {
        const containerXml = await containerFile.async('text');
        const parser = new DOMParser();
        const doc = parser.parseFromString(containerXml, 'application/xml');
        const rootfile = doc.querySelector('rootfile');
        if (rootfile && rootfile.getAttribute('full-path')) {
          opfPath = rootfile.getAttribute('full-path')!;
        }
      } catch (e) {
        console.warn('[RealDocExtractor:EPUB] Failed to parse container.xml:', e);
      }
    }

    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

    let coverHref: string | null = null;
    let bookTitle = file.name.replace(/\.[^/.]+$/, '');
    let bookAuthor = '';
    let bookPublisher = '';
    let bookDescription = '';
    let bookDate = new Date(file.lastModified).toISOString().split('T')[0];
    let firstSpineHtmlHref: string | null = null;

    // Helper: Normalize relative path resolution inside zip
    const resolveZipPath = (baseDir: string, relPath: string): string => {
      const clean = relPath.split('#')[0].split('?')[0];
      if (clean.startsWith('/')) return clean.slice(1);
      const combined = (baseDir + clean).replace(/\\/g, '/');
      const parts = combined.split('/');
      const stack: string[] = [];
      for (const part of parts) {
        if (part === '.' || part === '') continue;
        if (part === '..') stack.pop();
        else stack.push(part);
      }
      return stack.join('/');
    };

    // 2. Parse OPF Package File
    const opfCandidates = [
      opfPath,
      'content.opf',
      'OEBPS/content.opf',
      'oebps/content.opf',
      'EPUB/package.opf',
      'epub/package.opf',
    ];
    let opfFile: JSZip.JSZipObject | null = null;
    for (const cand of opfCandidates) {
      const found = zip.file(cand);
      if (found) {
        opfFile = found;
        break;
      }
    }

    if (opfFile) {
      try {
        const opfXml = await opfFile.async('text');
        const parser = new DOMParser();
        const opfDoc = parser.parseFromString(opfXml, 'application/xml');

        // Extract Dublin Core Metadata
        const titleNode = opfDoc.querySelector('title, dc\\:title');
        if (titleNode?.textContent?.trim()) bookTitle = titleNode.textContent.trim();

        const creatorNode = opfDoc.querySelector('creator, dc\\:creator');
        if (creatorNode?.textContent?.trim()) bookAuthor = creatorNode.textContent.trim();

        const publisherNode = opfDoc.querySelector('publisher, dc\\:publisher');
        if (publisherNode?.textContent?.trim()) bookPublisher = publisherNode.textContent.trim();

        const descNode = opfDoc.querySelector('description, dc\\:description');
        if (descNode?.textContent?.trim()) bookDescription = descNode.textContent.trim();

        const dateNode = opfDoc.querySelector('date, dc\\:date');
        if (dateNode?.textContent?.trim()) {
          const parsed = dateNode.textContent.trim().slice(0, 10);
          if (/^\d{4}/.test(parsed)) bookDate = parsed;
        }

        // Build Manifest Table
        const manifestItems = Array.from(opfDoc.querySelectorAll('manifest item'));
        const manifestMap = new Map<string, { href: string; mediaType: string; properties?: string }>();
        manifestItems.forEach((item) => {
          const id = item.getAttribute('id') || '';
          const href = item.getAttribute('href') || '';
          const mediaType = (item.getAttribute('media-type') || '').toLowerCase();
          const properties = item.getAttribute('properties') || '';
          if (id || href) {
            manifestMap.set(id, { href, mediaType, properties });
          }
        });

        // Calibre Step A: EPUB 3 properties="cover-image"
        for (const [_, item] of manifestMap.entries()) {
          if (item.properties?.includes('cover-image') && item.mediaType.startsWith('image/')) {
            coverHref = item.href;
            break;
          }
        }

        // Calibre Step B: EPUB 2 <meta name="cover" content="item_id"/>
        if (!coverHref) {
          const metaCover = opfDoc.querySelector('meta[name="cover"]');
          if (metaCover) {
            const coverId = metaCover.getAttribute('content');
            if (coverId && manifestMap.has(coverId)) {
              coverHref = manifestMap.get(coverId)!.href;
            }
          }
        }

        // Calibre Step C: <guide><reference type="cover" href="..."/></guide>
        if (!coverHref) {
          const guideCover = opfDoc.querySelector('guide reference[type="cover"]');
          if (guideCover) {
            const refHref = guideCover.getAttribute('href');
            if (refHref) {
              if (/\.(jpe?g|png|webp|gif)$/i.test(refHref)) {
                coverHref = refHref;
              } else {
                // Points to an XHTML cover page (e.g. cover.xhtml or titlepage.xhtml)
                const coverHtmlPath = resolveZipPath(opfDir, refHref);
                const coverHtmlFile = zip.file(coverHtmlPath) || zip.file(refHref);
                if (coverHtmlFile) {
                  try {
                    const htmlText = await coverHtmlFile.async('text');
                    const htmlDoc = new DOMParser().parseFromString(htmlText, 'text/html');
                    const img = htmlDoc.querySelector('img, image');
                    const src = img?.getAttribute('src') || img?.getAttribute('xlink:href') || img?.getAttribute('href');
                    if (src) {
                      const htmlDir = coverHtmlPath.includes('/') ? coverHtmlPath.substring(0, coverHtmlPath.lastIndexOf('/') + 1) : '';
                      coverHref = resolveZipPath(htmlDir, src);
                    }
                  } catch (e) {
                    console.warn('[RealDocExtractor:EPUB] Cover HTML parse failed:', e);
                  }
                }
              }
            }
          }
        }

        // Calibre Step D: Manifest Heuristic Search
        if (!coverHref) {
          for (const [id, item] of manifestMap.entries()) {
            if (item.mediaType.startsWith('image/')) {
              if (/cover/i.test(id) || /cover/i.test(item.href) || /jacket/i.test(item.href) || /title/i.test(item.href)) {
                coverHref = item.href;
                break;
              }
            }
          }
        }

        // Calibre Step E: First Spine Item for 1st page extraction
        const firstItemref = opfDoc.querySelector('spine itemref');
        if (firstItemref) {
          const idref = firstItemref.getAttribute('idref');
          if (idref && manifestMap.has(idref)) {
            firstSpineHtmlHref = manifestMap.get(idref)!.href;
          }
        }
      } catch (e) {
        console.warn('[RealDocExtractor:EPUB] OPF parse failed:', e);
      }
    }

    // 3. Load cover image from zip if resolved
    if (coverHref) {
      const fullCoverPath = resolveZipPath(opfDir, coverHref);
      let imgFile = zip.file(fullCoverPath) || zip.file(coverHref);
      if (!imgFile) {
        const lower = fullCoverPath.toLowerCase();
        const matchKey = Object.keys(zip.files).find((k) => k.toLowerCase() === lower);
        if (matchKey) imgFile = zip.file(matchKey);
      }

      if (imgFile) {
        const base64 = await imgFile.async('base64');
        const ext = imgFile.name.split('.').pop()?.toLowerCase() || 'jpeg';
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        return {
          thumbnailUrl: `data:${mime};base64,${base64}`,
          extractedText: `[전자책 EPUB] ${bookTitle}\n저자: ${bookAuthor || '작가 미상'}\n출판사: ${bookPublisher || '전자출판'}\n\n[도서 소개]\n${bookDescription || 'EPUB 표준 전자책입니다.'}`,
          pageCount: 250,
        };
      }
    }

    // 4. Calibre Step F: First Spine HTML page inspection (Fast Regex extraction without heavy DOMParser)
    if (firstSpineHtmlHref) {
      const fullHtmlPath = resolveZipPath(opfDir, firstSpineHtmlHref);
      const htmlFile = zip.file(fullHtmlPath) || zip.file(firstSpineHtmlHref);
      if (htmlFile) {
        try {
          const htmlText = await htmlFile.async('text');
          // Fast regex check to avoid heavy DOM allocation on large chapter HTMLs
          const imgMatch = htmlText.match(/<(?:img|image)[^>]+(?:src|xlink:href|href)=["']([^"']+)["']/i);
          const src = imgMatch ? imgMatch[1] : null;
          if (src) {
            const htmlDir = fullHtmlPath.includes('/') ? fullHtmlPath.substring(0, fullHtmlPath.lastIndexOf('/') + 1) : '';
            const imgPath = resolveZipPath(htmlDir, src);
            const embeddedImgFile = zip.file(imgPath) || zip.file(src);
            if (embeddedImgFile) {
              const base64 = await embeddedImgFile.async('base64');
              const ext = embeddedImgFile.name.split('.').pop()?.toLowerCase() || 'jpeg';
              const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
              return {
                thumbnailUrl: `data:${mime};base64,${base64}`,
                extractedText: `[전자책 EPUB] ${bookTitle}\n저자: ${bookAuthor || '작가 미상'}\n\n${bookDescription || ''}`,
                pageCount: 250,
              };
            }
          }
        } catch (e) {
          console.warn('[RealDocExtractor:EPUB] Spine HTML parse failed:', e);
        }
      }
    }

    // 5. Calibre Step G: Fallback to any valid image inside zip with cover heuristic
    const allImages = Object.keys(zip.files).filter((k) =>
      /\.(jpe?g|png|webp)$/i.test(k) && !zip.files[k].dir && !k.includes('__MACOSX')
    );
    if (allImages.length > 0) {
      allImages.sort((a, b) => {
        const aIsCover = /cover/i.test(a) ? -1 : 1;
        const bIsCover = /cover/i.test(b) ? -1 : 1;
        if (aIsCover !== bIsCover) return aIsCover - bIsCover;
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      });

      const fallbackImg = zip.file(allImages[0]);
      if (fallbackImg) {
        const base64 = await fallbackImg.async('base64');
        const ext = fallbackImg.name.split('.').pop()?.toLowerCase() || 'jpeg';
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        return {
          thumbnailUrl: `data:${mime};base64,${base64}`,
          extractedText: `[전자책 EPUB] ${bookTitle}\n저자: ${bookAuthor || '작가 미상'}\n\n${bookDescription || ''}`,
          pageCount: 250,
        };
      }
    }

    // 6. Ultimate Fallback: High-res e-Book Book Cover Canvas
    const thumb = DocRendererService.generateDocumentFirstPageThumbnail(
      bookTitle,
      'epub',
      category,
      bookDescription || `${bookTitle} 전자책`,
      bookDate,
      bookAuthor || '전자책 저자'
    );

    return {
      thumbnailUrl: thumb,
      extractedText: `[전자책 EPUB] ${bookTitle}\n저자: ${bookAuthor || '작가 미상'}\n\n${bookDescription || ''}`,
      pageCount: 250,
    };
  }

  /**
   * 7. Real Comic Book (.zip / .cbz) Cover & 1st Page Image Extraction
   *  - Extracts direct 1st page / cover image (001.jpg, cover.jpg, etc.) with accurate natural sort
   *  - Automatically traverses nested volume ZIPs (e.g. dragonball.zip -> 01권.zip -> 001.jpg)
   *  - Multi-level directory natural sorting
   */
  private static async extractComicZip(file: File, category: string): Promise<RealDocParseResult> {
    const title = file.name.replace(/\.[^/.]+$/, '');
    const zip = await JSZip.loadAsync(file);

    // Natural sort comparator for comic pages and folders
    const naturalSort = (a: string, b: string) => {
      const aIsCover = /(cover|표지|front|title|000\.|001\.)/i.test(a);
      const bIsCover = /(cover|표지|front|title|000\.|001\.)/i.test(b);

      const aSegments = a.split('/');
      const bSegments = b.split('/');

      // Compare folder depth/name first
      for (let i = 0; i < Math.min(aSegments.length, bSegments.length) - 1; i++) {
        const cmp = aSegments[i].localeCompare(bSegments[i], undefined, { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return cmp;
      }
      if (aSegments.length !== bSegments.length) {
        return aSegments.length - bSegments.length;
      }

      if (aIsCover !== bIsCover) return aIsCover ? -1 : 1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    };

    // 1. Check for direct images inside the archive
    let imageNames = Object.keys(zip.files).filter((name) => {
      const entry = zip.files[name];
      if (entry.dir || name.includes('__MACOSX') || name.startsWith('.') || name.includes('/.')) return false;
      return /\.(jpe?g|png|webp|bmp|gif)$/i.test(name);
    });

    if (imageNames.length > 0) {
      imageNames.sort(naturalSort);

      const firstImageFile = zip.file(imageNames[0]);
      if (firstImageFile) {
        const base64 = await firstImageFile.async('base64');
        const ext = imageNames[0].split('.').pop()?.toLowerCase() || 'jpeg';
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

        return {
          thumbnailUrl: `data:${mime};base64,${base64}`,
          extractedText: `[만화책 코믹스] ${title}\n총 ${imageNames.length}페이지 수록\n첫 페이지 표지: ${imageNames[0]}`,
          pageCount: imageNames.length,
        };
      }
    }

    // 2. Check for nested volume ZIP/CBZ archives (e.g. dragonball.zip -> 01권.zip -> 001.jpg)
    const nestedZipNames = Object.keys(zip.files).filter((name) => {
      const entry = zip.files[name];
      if (entry.dir || name.includes('__MACOSX') || name.startsWith('.') || name.includes('/.')) return false;
      return /\.(zip|cbz)$/i.test(name);
    });

    if (nestedZipNames.length > 0) {
      nestedZipNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      const firstNestedZipFile = zip.file(nestedZipNames[0]);
      if (firstNestedZipFile) {
        try {
          const nestedZipBuffer = await firstNestedZipFile.async('arraybuffer');
          const nestedZip = await JSZip.loadAsync(nestedZipBuffer);

          const nestedImageNames = Object.keys(nestedZip.files).filter((name) => {
            const entry = nestedZip.files[name];
            if (entry.dir || name.includes('__MACOSX') || name.startsWith('.') || name.includes('/.')) return false;
            return /\.(jpe?g|png|webp|bmp|gif)$/i.test(name);
          });

          if (nestedImageNames.length > 0) {
            nestedImageNames.sort(naturalSort);
            const nestedFirstImg = nestedZip.file(nestedImageNames[0]);
            if (nestedFirstImg) {
              const base64 = await nestedFirstImg.async('base64');
              const ext = nestedImageNames[0].split('.').pop()?.toLowerCase() || 'jpeg';
              const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

              return {
                thumbnailUrl: `data:${mime};base64,${base64}`,
                extractedText: `[만화책 코믹스 전권] ${title}\n총 ${nestedZipNames.length}권 수록 (1권: ${nestedZipNames[0]})\n첫 페이지 표지: ${nestedImageNames[0]}`,
                pageCount: nestedImageNames.length * nestedZipNames.length,
              };
            }
          }
        } catch (nestedErr) {
          console.warn('[RealDocExtractor] Failed to extract from nested volume zip:', nestedErr);
        }
      }
    }

    // 3. Fallback: stylized comic cover canvas
    const dateStr = new Date(file.lastModified).toISOString().split('T')[0];
    const thumb = DocRendererService.generateDocumentFirstPageThumbnail(
      title,
      'zip',
      category,
      `${title} 만화책 압축 파일`,
      dateStr,
      '만화 작가'
    );

    return {
      thumbnailUrl: thumb,
      extractedText: `${title} 만화책 파일`,
      pageCount: Math.max(1, imageNames.length),
    };
  }

  /**
   * 8. Plain Text / Markdown / Code fallback
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
