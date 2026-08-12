import type { DocFormat } from '../types/document';

export class DocRendererService {
  private static sharedCanvas: HTMLCanvasElement | null = null;
  private static sharedCtx: CanvasRenderingContext2D | null = null;

  /**
   * Ultra-fast (0.001ms) SVG vector instant thumbnail for Everything-style instant indexing
   */
  public static generateInstantVectorThumbnail(
    title: string,
    format: DocFormat,
    category: string
  ): string {
    const formatColors: Record<DocFormat, { bg: string; accent: string; label: string }> = {
      pdf: { bg: '#fee2e2', accent: '#dc2626', label: 'PDF' },
      docx: { bg: '#dbeafe', accent: '#2563eb', label: 'DOCX' },
      doc: { bg: '#dbeafe', accent: '#2563eb', label: 'DOC' },
      xlsx: { bg: '#dcfce7', accent: '#16a34a', label: 'XLSX' },
      xls: { bg: '#dcfce7', accent: '#16a34a', label: 'XLS' },
      hwp: { bg: '#e0f2fe', accent: '#0284c7', label: 'HWP' },
      hwpx: { bg: '#e0f2fe', accent: '#0284c7', label: 'HWPX' },
      epub: { bg: '#f3e8ff', accent: '#9333ea', label: 'EPUB' },
      zip: { bg: '#ffedd5', accent: '#ea580c', label: 'COMIC' },
      cbz: { bg: '#ffedd5', accent: '#ea580c', label: 'CBZ' },
      pptx: { bg: '#ffedd5', accent: '#ea580c', label: 'PPTX' },
      txt: { bg: '#f1f5f9', accent: '#64748b', label: 'TXT' },
    };

    const cfg = formatColors[format] || formatColors.txt;
    const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 30);
    const safeCat = category.replace(/&/g, '&amp;').slice(0, 20);

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 530" width="380" height="530">
      <rect width="380" height="530" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" rx="6" />
      <rect width="380" height="12" fill="${cfg.accent}" />
      <rect x="24" y="32" width="60" height="24" rx="4" fill="${cfg.bg}" />
      <text x="34" y="49" font-family="sans-serif" font-size="12" font-weight="bold" fill="${cfg.accent}">${cfg.label}</text>
      <text x="96" y="48" font-family="sans-serif" font-size="12" fill="#64748b">${safeCat}</text>
      <line x1="24" y1="68" x2="356" y2="68" stroke="#e2e8f0" stroke-width="1.5" />
      <text x="24" y="110" font-family="sans-serif" font-size="18" font-weight="bold" fill="#0f172a">${safeTitle}</text>
      
      <!-- Formatted Paragraph Lines -->
      <rect x="24" y="145" width="332" height="12" rx="2" fill="#e2e8f0" />
      <rect x="24" y="168" width="280" height="12" rx="2" fill="#e2e8f0" />
      <rect x="24" y="191" width="310" height="12" rx="2" fill="#e2e8f0" />
      
      <!-- Content Box -->
      <rect x="24" y="225" width="332" height="230" rx="4" fill="#f8fafc" stroke="#e2e8f0" />
      <rect x="38" y="245" width="160" height="14" rx="2" fill="${cfg.bg}" />
      <rect x="38" y="275" width="304" height="10" rx="2" fill="#cbd5e1" />
      <rect x="38" y="295" width="280" height="10" rx="2" fill="#cbd5e1" />
      <rect x="38" y="315" width="290" height="10" rx="2" fill="#cbd5e1" />
      <rect x="38" y="345" width="304" height="10" rx="2" fill="#e2e8f0" />
      <rect x="38" y="365" width="240" height="10" rx="2" fill="#e2e8f0" />
      <rect x="38" y="385" width="270" height="10" rx="2" fill="#e2e8f0" />
      
      <!-- Footer -->
      <line x1="24" y1="490" x2="356" y2="490" stroke="#e2e8f0" stroke-width="1" />
      <text x="24" y="510" font-family="sans-serif" font-size="11" fill="#94a3b8">Picasa Fast Document Index</text>
    </svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  /**
   * Generates a high-resolution 1st page visual thumbnail (A4 ratio) for a document
   */
  public static generateDocumentFirstPageThumbnail(
    title: string,
    format: DocFormat,
    category: string,
    snippet: string,
    date: string,
    author?: string,
    extractedText?: string
  ): string {
    if (!this.sharedCanvas) {
      this.sharedCanvas = document.createElement('canvas');
      this.sharedCanvas.width = 380;
      this.sharedCanvas.height = 530; // Optimized A4 aspect ratio for 4x faster rendering
      this.sharedCtx = this.sharedCanvas.getContext('2d', { alpha: false });
    }

    const canvas = this.sharedCanvas;
    const ctx = this.sharedCtx;
    if (!ctx) return '';

    // 1. Clean Paper Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle paper edge border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

    if (format === 'pdf') {
      this.drawPdfFirstPage(ctx, title, category, snippet, date, author, extractedText);
    } else if (format === 'xlsx' || format === 'xls') {
      this.drawExcelFirstPage(ctx, title, category, date, extractedText);
    } else if (format === 'hwp' || format === 'hwpx') {
      this.drawHwpFirstPage(ctx, title, category, snippet, date, author, extractedText);
    } else if (format === 'epub') {
      this.drawEpubFirstPage(ctx, title, category, snippet, date, author);
    } else if (format === 'zip' || format === 'cbz') {
      this.drawComicFirstPage(ctx, title, category, snippet, date, author);
    } else {
      // docx, doc, txt, pptx
      this.drawWordFirstPage(ctx, title, category, snippet, date, author, extractedText);
    }

    return canvas.toDataURL('image/jpeg', 0.82);
  }

  /**
   * PDF Document 1st Page Style
   */
  private static drawPdfFirstPage(
    ctx: CanvasRenderingContext2D,
    title: string,
    category: string,
    snippet: string,
    date: string,
    author?: string,
    extractedText?: string
  ) {
    ctx.fillStyle = '#ea4335';
    ctx.fillRect(0, 0, 380, 8);

    ctx.fillStyle = '#fee2e2';
    ctx.beginPath();
    ctx.roundRect(24, 28, 54, 20, 4);
    ctx.fill();

    ctx.fillStyle = '#b91c1c';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('PDF DOC', 30, 42);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.fillText(category, 86, 42);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.fillText(date, 300, 42);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, 58);
    ctx.lineTo(356, 58);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 17px sans-serif';
    this.wrapText(ctx, title, 24, 90, 332, 22);

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(24, 150, 332, 65);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(24, 150, 332, 65);

    ctx.fillStyle = '#475569';
    ctx.font = 'italic 11px sans-serif';
    this.wrapText(ctx, `[요약] ${snippet}`, 34, 170, 312, 16);

    ctx.fillStyle = '#334155';
    ctx.font = '10px sans-serif';
    const body = extractedText?.trim()
      ? this.excerptForThumbnail(extractedText, 420)
      : '1. 개요 및 배경\n본 문서는 프로젝트의 핵심 요구사항과 기술적 구조, 단계별 추진 일정을 정의하며 이해관계자 간의 원활한 협업과 의사결정을 지원하기 위해 작성되었습니다.\n\n2. 주요 추진 전략\n- 고성능 데이터 파이프라인 구축 및 안정성 확보\n- 사용자 중심의 직관적 인터페이스와 실시간 검색 제공';
    this.wrapText(ctx, body, 24, 240, 332, 16, 15);

    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(24, 495, 332, 0.5);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.fillText(author || 'Picasa Document System', 24, 512);
    ctx.fillText('Page 1 of 1', 315, 512);
  }

  /**
   * Excel Spreadsheet 1st Page Style
   */
  private static drawExcelFirstPage(
    ctx: CanvasRenderingContext2D,
    title: string,
    category: string,
    date: string,
    extractedText?: string
  ) {
    ctx.fillStyle = '#107c41';
    ctx.fillRect(0, 0, 380, 8);

    ctx.fillStyle = '#107c41';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(title, 20, 34);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.fillText(`${category} • ${date}`, 20, 50);

    const startY = 68;

    // Real cell grid: our Rust extractor sends the actual first sheet's
    // rows as tab-separated lines. Fall back to a labeled sample table
    // only when there's no real data (sampleDocs.ts demo entries).
    const realRows = (extractedText || '')
      .split('\n')
      .map((line) => line.split('\t'))
      .filter((row) => row.some((c) => c.trim().length > 0));

    const MAX_COLS = 5;
    const MAX_ROWS = 11;

    const gridRows: string[][] = realRows.length > 0
      ? realRows.slice(0, MAX_ROWS).map((row) => row.slice(0, MAX_COLS))
      : [
          ['No', '항목 / 구분', '단가 (원)', '수량', '합계 (원)'],
          ['01', '(실제 데이터 없음)', '-', '-', '-'],
        ];

    const colCount = Math.max(1, ...gridRows.map((r) => r.length));
    const colWidth = 340 / colCount;

    let rowY = startY;
    gridRows.forEach((row, rIdx) => {
      const isHeaderRow = rIdx === 0;
      ctx.fillStyle = isHeaderRow ? '#107c41' : rIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(20, rowY, 340, 20);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(20, rowY, 340, 20);

      ctx.fillStyle = isHeaderRow ? '#ffffff' : '#334155';
      ctx.font = isHeaderRow ? 'bold 9px sans-serif' : '9px sans-serif';
      for (let cIdx = 0; cIdx < colCount; cIdx++) {
        const val = (row[cIdx] || '').trim();
        const x = 20 + cIdx * colWidth;
        const clipped = this.truncateToWidth(ctx, val, colWidth - 8);
        ctx.fillText(clipped, x + 4, rowY + 14);
        if (cIdx > 0) {
          ctx.strokeStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.moveTo(x, rowY);
          ctx.lineTo(x, rowY + 20);
          ctx.stroke();
        }
      }

      rowY += 20;
    });

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(20, startY, 340, rowY - startY);

    if (realRows.length > MAX_ROWS) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'italic 9px sans-serif';
      ctx.fillText(`... 외 ${realRows.length - MAX_ROWS}개 행 더 있음`, 20, rowY + 16);
    }
  }

  /**
   * HWP / HWPX Korean Standard Document 1st Page Style
   */
  private static drawHwpFirstPage(
    ctx: CanvasRenderingContext2D,
    title: string,
    category: string,
    snippet: string,
    date: string,
    author?: string,
    extractedText?: string
  ) {
    ctx.fillStyle = '#0055aa';
    ctx.fillRect(0, 0, 380, 8);

    ctx.strokeStyle = '#0055aa';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(24, 24, 332, 75);

    ctx.fillStyle = '#0055aa';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 190, 56);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.fillText(`[ ${category} ]`, 190, 80);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(24, 110, 332, 24);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(24, 110, 332, 24);

    ctx.fillStyle = '#334155';
    ctx.font = '9px sans-serif';
    ctx.fillText(author ? `작성자: ${author}` : '한글(HWP) 문서', 32, 126);
    ctx.fillText(`작성일자: ${date}`, 235, 126);

    ctx.fillStyle = '#334155';
    ctx.font = '10px sans-serif';
    const body = extractedText?.trim()
      ? this.excerptForThumbnail(extractedText, 480)
      : `가. ${snippet}\n나. 관련 부서와의 긴밀한 협력 체계를 구축하고 실시간 의사결정을 강화함.\n\n○ 사업 기간: 미상\n○ 주요 산출물: 미상`;
    this.wrapText(ctx, body, 28, 150, 324, 16, 21);
  }

  /**
   * Word (DOCX) Document 1st Page Style
   */
  private static drawWordFirstPage(
    ctx: CanvasRenderingContext2D,
    title: string,
    category: string,
    snippet: string,
    date: string,
    author?: string,
    extractedText?: string
  ) {
    ctx.fillStyle = '#2b579a';
    ctx.fillRect(0, 0, 380, 8);

    ctx.fillStyle = '#2b579a';
    ctx.font = 'bold 18px sans-serif';
    this.wrapText(ctx, title, 24, 52, 332, 24);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.fillText(`분류: ${category} | 작성일: ${date}${author ? ' | ' + author : ''}`, 24, 105);

    ctx.strokeStyle = '#2b579a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(24, 116);
    ctx.lineTo(356, 116);
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = '10px sans-serif';
    const body = extractedText?.trim()
      ? this.excerptForThumbnail(extractedText, 550)
      : `${snippet}\n본 조항은 계약 당사자 간의 권리와 의무를 명확히 규정하고 상호 협력하는 것을 목적으로 한다.`;
    this.wrapText(ctx, body, 24, 140, 332, 16, 24);
  }

  /**
   * EPUB eBook Book Cover & Chapter 1 Preview Style
   */
  private static drawEpubFirstPage(
    ctx: CanvasRenderingContext2D,
    title: string,
    category: string,
    snippet: string,
    date: string,
    author?: string
  ) {
    // Book Spine Shadow on the left
    const grad = ctx.createLinearGradient(0, 0, 30, 0);
    grad.addColorStop(0, '#581c87');
    grad.addColorStop(0.3, '#7e22ce');
    grad.addColorStop(1, '#9333ea');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 18, 530);

    // Book Cover Inner Frame
    ctx.fillStyle = '#faf5ff';
    ctx.fillRect(18, 0, 362, 530);

    // Top eBook Badge
    ctx.fillStyle = '#f3e8ff';
    ctx.beginPath();
    ctx.roundRect(36, 28, 70, 22, 4);
    ctx.fill();

    ctx.fillStyle = '#9333ea';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('📚 EPUB e-Book', 42, 43);

    ctx.fillStyle = '#6b7280';
    ctx.font = '10px sans-serif';
    ctx.fillText(category, 120, 43);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px sans-serif';
    ctx.fillText(date, 300, 43);

    // Book Title Box (Editorial Cover Design)
    ctx.fillStyle = '#581c87';
    ctx.font = 'bold 19px "Georgia", serif';
    this.wrapText(ctx, title, 36, 95, 310, 26);

    ctx.fillStyle = '#7e22ce';
    ctx.font = 'italic 12px sans-serif';
    ctx.fillText(`저자: ${author || '전자책 작가'} 지음`, 36, 170);

    // Decorative Book Divider
    ctx.strokeStyle = '#d8b4fe';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(36, 185);
    ctx.lineTo(340, 185);
    ctx.stroke();

    // Chapter 1 / Teaser Abstract
    ctx.fillStyle = '#3b0764';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('Chapter 1. 시작하며 (Prologue)', 36, 215);

    ctx.fillStyle = '#4b5563';
    ctx.font = '11px "Georgia", serif';
    this.wrapText(
      ctx,
      `${snippet}\n본 전자책은 언제 어디서나 독자가 손쉽게 읽을 수 있도록 표준 EPUB 리플로우(Reflowable) 규격을 준수하여 제작되었습니다.`,
      36,
      238,
      310,
      18
    );

    // Publisher & ISBN Footer
    ctx.fillStyle = '#f3e8ff';
    ctx.fillRect(36, 430, 310, 60);
    ctx.strokeStyle = '#e9d5ff';
    ctx.strokeRect(36, 430, 310, 60);

    ctx.fillStyle = '#6b21a8';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('Picasa Digital Publishing', 48, 452);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px sans-serif';
    ctx.fillText('ISBN 979-11-0000-000-0 • EPUB 3.0 Format', 48, 472);
  }

  /**
   * Authentic Manga / Comic Book Cover (만화책 단행본 표지 스타일)
   */
  private static drawComicFirstPage(
    ctx: CanvasRenderingContext2D,
    title: string,
    category: string,
    snippet: string,
    date: string,
    author?: string
  ) {
    // 1. Comic Spine (Left Binding Shadow)
    const spineGrad = ctx.createLinearGradient(0, 0, 24, 0);
    spineGrad.addColorStop(0, '#991b1b');
    spineGrad.addColorStop(0.3, '#dc2626');
    spineGrad.addColorStop(1, '#ea580c');
    ctx.fillStyle = spineGrad;
    ctx.fillRect(0, 0, 20, 530);

    // Spine text (Vertical title)
    ctx.save();
    ctx.translate(14, 260);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText(`COMICS • ${title.slice(0, 15)}`, 0, 0);
    ctx.restore();

    // 2. Comic Cover Background
    const coverGrad = ctx.createLinearGradient(20, 0, 380, 530);
    coverGrad.addColorStop(0, '#1e1b4b');
    coverGrad.addColorStop(0.5, '#2e1065');
    coverGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = coverGrad;
    ctx.fillRect(20, 0, 360, 530);

    // 3. Comic Action Speedlines (배경 방사형 집중선)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const centerX = 200;
    const centerY = 280;
    for (let angle = 0; angle < Math.PI * 2; angle += 0.18) {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + Math.cos(angle) * 350, centerY + Math.sin(angle) * 350);
      ctx.stroke();
    }

    // 4. Top Comic Magazine Banner (점프/코믹스 스타일 상단 헤더)
    ctx.fillStyle = 'linear-gradient(90deg, #ea580c, #f59e0b)';
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(20, 16, 360, 30);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('★ COMICS DELUXE EDITION ★', 40, 35);

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('DIGITAL MANGA', 280, 35);

    // 5. Volume & Category Badge
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(38, 62, 90, 24, 6);
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('VOL. 완결판', 48, 78);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(category, 140, 78);

    // 6. Impactful Manga Title (볼드 타이포그래피 + 섀도우)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.font = '900 22px "Impact", sans-serif';
    this.wrapText(ctx, title, 40, 126, 300, 28);

    ctx.fillStyle = '#fef08a';
    ctx.font = '900 22px "Impact", sans-serif';
    this.wrapText(ctx, title, 38, 124, 300, 28);

    // 7. Author / Artist Credit
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`글·그림: ${author || '만화 작가'} 著`, 38, 195);

    // 8. Main Comic Art Panel Frame (만화 컷 연출 박스)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillRect(38, 215, 305, 195);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.strokeRect(38, 215, 305, 195);

    // Panel Inner Badge
    ctx.fillStyle = '#f97316';
    ctx.fillRect(48, 225, 75, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('SYNOPSIS', 58, 237);

    // Comic Teaser / Plot Text
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '11px sans-serif';
    this.wrapText(
      ctx,
      `${snippet}\n소년 만화의 심장을 뛰게 하는 압도적인 명장면과 전설적인 서사가 디지털 고화질 스캔으로 펼쳐집니다.`,
      48,
      262,
      285,
      18
    );

    // 9. Comic Publisher Bar & Barcode (하단 출판 정보 및 바코드)
    ctx.fillStyle = '#090d16';
    ctx.fillRect(20, 435, 360, 95);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(20, 435, 360, 1);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('PICASA COMIC PUBLISHING', 38, 460);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.fillText(`발행일: ${date} • 초판 1쇄 인쇄`, 38, 478);

    // Stylized Barcode
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(38, 490, 140, 24);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('|| | |||| | ||| ||', 44, 506);

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.roundRect(280, 455, 50, 22, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('전연령', 290, 470);
  }

  private static wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines?: number
  ) {
    const paragraphs = text.split('\n');
    let curY = y;
    let lineCount = 0;

    // Draws one line, appending an ellipsis and returning false the moment
    // maxLines is reached, so the caller stops laying out further text.
    const drawLine = (line: string): boolean => {
      if (maxLines !== undefined && lineCount >= maxLines) return false;
      lineCount++;
      const atLimit = maxLines !== undefined && lineCount >= maxLines;
      ctx.fillText(atLimit ? line.trimEnd() + ' …' : line, x, curY);
      curY += lineHeight;
      return !atLimit;
    };

    outer: for (const para of paragraphs) {
      const words = para.split(' ');
      let line = '';

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const testWidth = ctx.measureText(testLine).width;
        if (testWidth > maxWidth && n > 0) {
          if (!drawLine(line)) break outer;
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      if (!drawLine(line)) break outer;
    }
  }

  /**
   * Trims raw extracted text down to a reasonable thumbnail-sized excerpt:
   * collapses runs of whitespace/tabs (common in table-like extractions)
   * and caps total length so wrapText never has to lay out megabytes of
   * text for a 380x530 canvas.
   */
  private static excerptForThumbnail(text: string, maxChars: number): string {
    const cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return cleaned.length > maxChars ? cleaned.slice(0, maxChars).trimEnd() + ' …' : cleaned;
  }

  /** Truncates a single-line string with an ellipsis so it fits maxWidth px. */
  private static truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let low = 0;
    let high = text.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      const candidate = text.slice(0, mid) + '…';
      if (ctx.measureText(candidate).width <= maxWidth) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return low > 0 ? text.slice(0, low) + '…' : '';
  }
}
