import type { DocFormat } from '../types/document';

export class DocRendererService {
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
    const canvas = document.createElement('canvas');
    canvas.width = 440;
    canvas.height = 620; // ~A4 aspect ratio
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // 1. Clean Paper Background with drop shadow and border
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle paper edge border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

    if (format === 'pdf') {
      this.drawPdfFirstPage(ctx, title, category, snippet, date, author);
    } else if (format === 'xlsx' || format === 'xls') {
      this.drawExcelFirstPage(ctx, title, category, date);
    } else if (format === 'hwp' || format === 'hwpx') {
      this.drawHwpFirstPage(ctx, title, category, snippet, date, author);
    } else {
      // docx, doc, txt, pptx
      this.drawWordFirstPage(ctx, title, category, snippet, date, author);
    }

    return canvas.toDataURL('image/jpeg', 0.9);
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
    // Top PDF Color Accent Bar
    ctx.fillStyle = '#ea4335';
    ctx.fillRect(0, 0, 440, 10);

    // Header Logo/Badge
    ctx.fillStyle = '#fee2e2';
    ctx.beginPath();
    ctx.roundRect(30, 35, 60, 22, 4);
    ctx.fill();

    ctx.fillStyle = '#b91c1c';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('PDF DOC', 38, 50);

    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.fillText(category, 100, 50);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(date, 340, 50);

    // Decorative Line
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 68);
    ctx.lineTo(410, 68);
    ctx.stroke();

    // Document Main Title
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px sans-serif';
    this.wrapText(ctx, title, 30, 110, 380, 26);

    // Subtitle / Abstract Box
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(30, 175, 380, 75);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(30, 175, 380, 75);

    ctx.fillStyle = '#475569';
    ctx.font = 'italic 12px sans-serif';
    this.wrapText(ctx, `[요약] ${snippet}`, 42, 198, 356, 18);

    // Paragraph Lines simulation
    ctx.fillStyle = '#334155';
    ctx.font = '11px sans-serif';
    this.wrapText(
      ctx,
      '1. 개요 및 배경\n본 문서는 프로젝트의 핵심 요구사항과 기술적 구조, 단계별 추진 일정을 정의하며 이해관계자 간의 원활한 협업과 의사결정을 지원하기 위해 작성되었습니다.\n\n2. 주요 추진 전략\n- 고성능 데이터 파이프라인 구축 및 안정성 확보\n- 사용자 중심의 직관적 인터페이스와 실시간 검색 제공\n- 데이터 보안 및 접근 권한 체계화',
      30,
      280,
      380,
      18
    );

    // Footer
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(30, 580, 380, 0.5);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(author || 'Picasa Document System', 30, 598);
    ctx.fillText('Page 1 of 1', 360, 598);
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
    // Top Excel Green Accent
    ctx.fillStyle = '#107c41';
    ctx.fillRect(0, 0, 440, 10);

    // Excel Sheet Header
    ctx.fillStyle = '#107c41';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(title, 25, 42);

    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${category} • ${date}`, 25, 60);

    // Draw Spreadsheet Grid Table
    const startY = 80;
    const cols = [40, 120, 75, 75, 90];
    const colNames = ['No', '항목 / 구분', '단가 (원)', '수량', '합계 (원)'];

    // Header Row
    ctx.fillStyle = '#107c41';
    ctx.fillRect(20, startY, 400, 24);

    let curX = 20;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    colNames.forEach((name, i) => {
      ctx.fillText(name, curX + 6, startY + 16);
      curX += cols[i];
    });

    // Sample Table Rows
    const sampleRows = [
      ['01', '시스템 개발비', '3,500,000', '1식', '3,500,000'],
      ['02', 'UI/UX 디자인', '1,800,000', '1식', '1,800,000'],
      ['03', '인덱싱 엔진 구축', '2,400,000', '1식', '2,400,000'],
      ['04', '클라우드 인프라', '450,000', '12월', '5,400,000'],
      ['05', '데이터베이스 튜닝', '1,200,000', '1식', '1,200,000'],
      ['06', '보안 및 권한 검증', '900,000', '1식', '900,000'],
      ['07', '유지보수 및 운영', '350,000', '12월', '4,200,000'],
      ['08', '기술 지원비', '600,000', '2회', '1,200,000'],
      ['09', '문서화 및 매뉴얼', '500,000', '1식', '500,000'],
      ['10', '최종 검수 및 배포', '800,000', '1식', '800,000'],
    ];

    let rowY = startY + 24;
    sampleRows.forEach((row, rIdx) => {
      ctx.fillStyle = rIdx % 2 === 0 ? '#f8fafc' : '#ffffff';
      ctx.fillRect(20, rowY, 400, 22);

      // Cell Grid Lines
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(20, rowY, 400, 22);

      let x = 20;
      ctx.fillStyle = '#334155';
      ctx.font = '10px sans-serif';
      row.forEach((val, cIdx) => {
        ctx.fillText(val, x + 6, rowY + 15);
        x += cols[cIdx];
      });

      rowY += 22;
    });

    // Total Row
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(20, rowY, 400, 26);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('총 합계 금액 (VAT 포함)', 30, rowY + 18);
    ctx.fillText('₩ 21,900,000', 315, rowY + 18);

    // Mini Bar Chart simulation below table
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(20, rowY + 40, 400, 180);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(20, rowY + 40, 400, 180);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('월별 매출 및 지출 추이 그래프 (Sheet1)', 32, rowY + 60);

    // Draw bars
    const barColors = ['#107c41', '#34a853', '#4285f4', '#fbbc05', '#ea4335'];
    for (let b = 0; b < 5; b++) {
      ctx.fillStyle = barColors[b];
      const h = 40 + b * 20;
      ctx.fillRect(50 + b * 70, rowY + 190 - h, 40, h);
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
    // Top HWP Blue Accent
    ctx.fillStyle = '#0055aa';
    ctx.fillRect(0, 0, 440, 10);

    // Header Title Box (공문서/보고서 표제 상자)
    ctx.strokeStyle = '#0055aa';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, 380, 90);

    ctx.fillStyle = '#0055aa';
    ctx.font = 'bold 18px "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 220, 70);

    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.fillText(`[ ${category} ]`, 220, 98);
    ctx.textAlign = 'left';

    // Meta row (기안자, 일자)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(30, 130, 380, 28);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(30, 130, 380, 28);

    ctx.fillStyle = '#334155';
    ctx.font = '10px sans-serif';
    ctx.fillText(`작성부서: ${author || '경영기획팀'}`, 40, 148);
    ctx.fillText(`기안일자: ${date}`, 270, 148);

    // Body Text with HWP Bullet points (1. 추진 목적, 2. 주요 내용)
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('1. 추진 목적 및 필요성', 30, 190);

    ctx.fillStyle = '#334155';
    ctx.font = '11px "Malgun Gothic", sans-serif';
    this.wrapText(
      ctx,
      `가. ${snippet}\n나. 관련 부서와의 긴밀한 협력 체계를 구축하고 실시간 의사결정을 강화함.\n다. 디지털 전환 및 프로세스 자동화를 통한 업무 효율성 30% 증대.`,
      35,
      212,
      370,
      18
    );

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('2. 사업 개요 및 세부 내용', 30, 295);

    // HWP Grid Box inside
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(30, 310, 380, 130);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(30, 310, 380, 130);

    ctx.fillStyle = '#475569';
    ctx.font = '11px sans-serif';
    this.wrapText(
      ctx,
      '○ 사업 기간: 2024. 01. 01 ~ 2024. 12. 31 (12개월)\n○ 소요 예산: 금이천일백구십만원정 (₩21,900,000)\n○ 주요 산출물: 완료보고서, 시스템 소스코드, 사용자 매뉴얼',
      42,
      335,
      356,
      22
    );

    // Korean Red Official Seal Stamp (직인 인장 시뮬레이션)
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(330, 480, 60, 60);

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 12px "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('대표이사', 360, 506);
    ctx.fillText('직 인', 360, 526);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#64748b';
    ctx.font = '10px sans-serif';
    ctx.fillText('한글(HWP) 표준 서식 문서', 30, 595);
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
    // Top Word Blue Accent
    ctx.fillStyle = '#2b579a';
    ctx.fillRect(0, 0, 440, 10);

    // Header Title
    ctx.fillStyle = '#2b579a';
    ctx.font = 'bold 22px sans-serif';
    this.wrapText(ctx, title, 30, 65, 380, 28);

    ctx.fillStyle = '#64748b';
    ctx.font = '11px sans-serif';
    ctx.fillText(`분류: ${category} | 작성일: ${date}`, 30, 125);

    ctx.strokeStyle = '#2b579a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, 138);
    ctx.lineTo(410, 138);
    ctx.stroke();

    // Section 1
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Article 1. 목적 (Purpose)', 30, 175);

    ctx.fillStyle = '#334155';
    ctx.font = '11px sans-serif';
    this.wrapText(
      ctx,
      `${snippet}\n본 조항은 계약 당사자 간의 권리와 의무를 명확히 규정하고, 신의성실의 원칙에 따라 상호 협력하는 것을 목적으로 한다.`,
      30,
      198,
      380,
      18
    );

    // Section 2
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Article 2. 계약 기간 및 조건', 30, 280);

    ctx.fillStyle = '#334155';
    ctx.font = '11px sans-serif';
    this.wrapText(
      ctx,
      '1. 계약의 유효기간은 체결일로부터 1년으로 하며, 만료 1개월 전 서면 통지가 없을 경우 동일한 조건으로 자동 연장된다.\n2. 을은 갑의 사전 서면 승인 없이 계약상 권리와 의무를 제3자에게 양도할 수 없다.\n3. 분쟁 발생 시 당사자의 관할 법원에 따른다.',
      30,
      304,
      380,
      18
    );

    // Signature Box
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(30, 430, 380, 120);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(30, 430, 380, 120);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('[서명 및 날인란]', 42, 452);

    ctx.fillStyle = '#475569';
    ctx.font = '10px sans-serif';
    ctx.fillText(`(갑) 발주사: 주식회사 알파 (대표이사 서명/인)`, 42, 480);
    ctx.fillText(`(을) 수급사: ${author || '주식회사 베타'} (대표이사 서명/인)`, 42, 510);
  }

  /**
   * Helper function to wrap text inside canvas
   */
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
