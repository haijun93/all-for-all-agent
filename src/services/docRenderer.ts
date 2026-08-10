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
    author?: string
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
      this.drawPdfFirstPage(ctx, title, category, snippet, date, author);
    } else if (format === 'xlsx' || format === 'xls') {
      this.drawExcelFirstPage(ctx, title, category, date);
    } else if (format === 'hwp' || format === 'hwpx') {
      this.drawHwpFirstPage(ctx, title, category, snippet, date, author);
    } else if (format === 'epub') {
      this.drawEpubFirstPage(ctx, title, category, snippet, date, author);
    } else {
      // docx, doc, txt, pptx
      this.drawWordFirstPage(ctx, title, category, snippet, date, author);
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
    author?: string
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
    this.wrapText(
      ctx,
      '1. 개요 및 배경\n본 문서는 프로젝트의 핵심 요구사항과 기술적 구조, 단계별 추진 일정을 정의하며 이해관계자 간의 원활한 협업과 의사결정을 지원하기 위해 작성되었습니다.\n\n2. 주요 추진 전략\n- 고성능 데이터 파이프라인 구축 및 안정성 확보\n- 사용자 중심의 직관적 인터페이스와 실시간 검색 제공',
      24,
      240,
      332,
      16
    );

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
    date: string
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
    const cols = [35, 105, 65, 65, 70];
    const colNames = ['No', '항목 / 구분', '단가 (원)', '수량', '합계 (원)'];

    ctx.fillStyle = '#107c41';
    ctx.fillRect(20, startY, 340, 20);

    let curX = 20;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    colNames.forEach((name, i) => {
      ctx.fillText(name, curX + 4, startY + 14);
      curX += cols[i];
    });

    const sampleRows = [
      ['01', '시스템 개발비', '3,500,000', '1식', '3,500,000'],
      ['02', 'UI/UX 디자인', '1,800,000', '1식', '1,800,000'],
      ['03', '인덱싱 엔진 구축', '2,400,000', '1식', '2,400,000'],
      ['04', '클라우드 인프라', '450,000', '12월', '5,400,000'],
      ['05', '데이터베이스 튜닝', '1,200,000', '1식', '1,200,000'],
      ['06', '보안 및 권한 검증', '900,000', '1식', '900,000'],
      ['07', '유지보수 및 운영', '350,000', '12월', '4,200,000'],
    ];

    let rowY = startY + 20;
    sampleRows.forEach((row, rIdx) => {
      ctx.fillStyle = rIdx % 2 === 0 ? '#f8fafc' : '#ffffff';
      ctx.fillRect(20, rowY, 340, 18);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(20, rowY, 340, 18);

      let x = 20;
      ctx.fillStyle = '#334155';
      ctx.font = '9px sans-serif';
      row.forEach((val, cIdx) => {
        ctx.fillText(val, x + 4, rowY + 13);
        x += cols[cIdx];
      });

      rowY += 18;
    });

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(20, rowY, 340, 22);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('총 합계 금액 (VAT 포함)', 26, rowY + 15);
    ctx.fillText('₩ 21,900,000', 270, rowY + 15);

    // Mini Chart Graphic
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(20, rowY + 32, 340, 160);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(20, rowY + 32, 340, 160);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('월별 매출 및 지출 추이 그래프 (Sheet1)', 28, rowY + 48);

    const barColors = ['#107c41', '#34a853', '#4285f4', '#fbbc05', '#ea4335'];
    for (let b = 0; b < 5; b++) {
      ctx.fillStyle = barColors[b];
      const h = 30 + b * 18;
      ctx.fillRect(45 + b * 60, rowY + 175 - h, 34, h);
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
    author?: string
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
    ctx.fillText(`작성부서: ${author || '경영기획팀'}`, 32, 126);
    ctx.fillText(`기안일자: ${date}`, 235, 126);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('1. 추진 목적 및 필요성', 24, 160);

    ctx.fillStyle = '#334155';
    ctx.font = '10px sans-serif';
    this.wrapText(
      ctx,
      `가. ${snippet}\n나. 관련 부서와의 긴밀한 협력 체계를 구축하고 실시간 의사결정을 강화함.`,
      28,
      178,
      324,
      15
    );

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('2. 사업 개요 및 세부 내용', 24, 245);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(24, 260, 332, 105);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(24, 260, 332, 105);

    ctx.fillStyle = '#475569';
    ctx.font = '10px sans-serif';
    this.wrapText(
      ctx,
      '○ 사업 기간: 2024. 01. 01 ~ 2024. 12. 31 (12개월)\n○ 소요 예산: 금이천일백구십만원정 (₩21,900,000)\n○ 주요 산출물: 완료보고서, 소스코드, 매뉴얼',
      32,
      282,
      316,
      18
    );

    // Seal
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.strokeRect(285, 410, 50, 50);

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('대표이사', 310, 432);
    ctx.fillText('직 인', 310, 448);
    ctx.textAlign = 'left';
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
    author?: string
  ) {
    ctx.fillStyle = '#2b579a';
    ctx.fillRect(0, 0, 380, 8);

    ctx.fillStyle = '#2b579a';
    ctx.font = 'bold 18px sans-serif';
    this.wrapText(ctx, title, 24, 52, 332, 24);

    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.fillText(`분류: ${category} | 작성일: ${date}`, 24, 105);

    ctx.strokeStyle = '#2b579a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(24, 116);
    ctx.lineTo(356, 116);
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('Article 1. 목적 (Purpose)', 24, 145);

    ctx.fillStyle = '#334155';
    ctx.font = '10px sans-serif';
    this.wrapText(
      ctx,
      `${snippet}\n본 조항은 계약 당사자 간의 권리와 의무를 명확히 규정하고 상호 협력하는 것을 목적으로 한다.`,
      24,
      165,
      332,
      15
    );

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(24, 370, 332, 95);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(24, 370, 332, 95);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('[서명 및 날인란]', 34, 388);

    ctx.fillStyle = '#475569';
    ctx.font = '9px sans-serif';
    ctx.fillText(`(갑) 발주사: 주식회사 알파 (대표이사 서명/인)`, 34, 412);
    ctx.fillText(`(을) 수급사: ${author || '주식회사 베타'} (대표이사 서명/인)`, 34, 436);
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

  private static wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) {
    const paragraphs = text.split('\n');
    let curY = y;

    for (const para of paragraphs) {
      const words = para.split(' ');
      let line = '';

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line, x, curY);
          line = words[n] + ' ';
          curY += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x, curY);
      curY += lineHeight;
    }
  }
}
