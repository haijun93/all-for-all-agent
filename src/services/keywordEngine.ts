export interface KeywordAnalysisResult {
  category: string;
  keywords: string[];
  snippet: string;
}

const STOP_WORDS = new Set([
  '은', '는', '이', '가', '을', '를', '의', '에', '에서', '로', '으로', '와', '과',
  '및', '등', '등에', '대한', '위한', '따라', '통해', '있음', '없음', '관한', '그리고',
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'are', 'was', 'were',
  '한다', '된다', '있다', '합니다', '됩니다', '페이지', 'page', '총', '건', '개'
]);

// Korean Morphological Particle & Josa Stripper (Inspired by Lindera NLP)
const KOREAN_PARTICLES = [
  /에서$/, /에게$/, /으로$/, /로써$/, /와의$/, /과의$/, /과의$/, /까지$/, /부터$/,
  /이나$/, /이나마$/, /에게는$/, /에서는$/, /으로의$/, /사항$/, /내역$/
];

const CATEGORY_RULES: Array<{ category: string; terms: string[] }> = [
  {
    category: '📜 계약서 / 법률',
    terms: ['계약', '계약서', '갑', '을', '조항', '체결', '특약', '당사자', '해지', '손해배상', '의무', '합의', '비밀유지'],
  },
  {
    category: '📊 사업계획서 / 제안서',
    terms: ['사업계획', '사업계획서', '제안서', '추진전략', '로드맵', '시장분석', '비즈니스', '타겟', '수익모델', '투자유치', '비전', '전략'],
  },
  {
    category: '💰 재무 / 결산 / 예산',
    terms: ['재무제표', '손익계산서', '결산', '매출', '지출', '예산안', '부가세', '세금계산서', '회계', '영업이익', '대차대조표', '손익'],
  },
  {
    category: '📑 견적서 / 명세서',
    terms: ['견적서', '견적', '품명', '수량', '단가', '공급가액', '세액', '합계금액', '발주서', '거래명세서', '단가표'],
  },
  {
    category: '🔬 연구 / 기술보고서',
    terms: ['연구보고서', '기술보고서', '알고리즘', '아키텍처', '실험결과', '분석결과', '데이터셋', '시스템', '검증', '인공지능', '특허', 'r&d'],
  },
  {
    category: '👥 인사 / 총무 / 행정',
    terms: ['근로계약서', '인사평가', '급여명세서', '채용공고', '복무규정', '퇴직금', '신청서', '출장보고서', '회의록', '서약서'],
  },
  {
    category: '📚 도서 / 전자책 (e-Book)',
    terms: ['소설', '에세이', '인문', '기술서', '챕터', 'chapter', '저자', '출판사', '발행일', '전자책', 'epub', '독서', '문학', '가이드북'],
  },
  {
    category: '🎨 만화책 / 코믹스 (Comics)',
    terms: ['만화', '만화책', '코믹스', '드래곤볼', '진격의 거인', '귀멸의 칼날', '베르세르크', '원펀맨', '주술회전', '스파이', '스캔', '단행본', '완결', '전권', '무협', 'comics', 'manga', 'cbz', 'zip', '화', '권'],
  },
];

export class KeywordEngine {
  /**
   * Normalizes a Korean word token by stripping trailing grammatical particles
   */
  public static normalizeKoreanToken(word: string): string {
    let normalized = word;
    for (const pattern of KOREAN_PARTICLES) {
      if (pattern.test(normalized) && normalized.length > 2) {
        normalized = normalized.replace(pattern, '');
        break;
      }
    }
    return normalized;
  }

  /**
   * Extracts top keywords and auto-categorizes a document based on its extracted text
   */
  public static analyzeDocumentText(title: string, text: string): KeywordAnalysisResult {
    const fullText = `${title} ${title} ${text}`.toLowerCase();
    
    // 1. Tokenize words & apply Korean morphological normalization
    const rawTokens = fullText
      .replace(/[^\w가-힣\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !STOP_WORDS.has(w) && isNaN(Number(w)));

    const tokens = rawTokens.map((t) => this.normalizeKoreanToken(t)).filter((w) => w.length >= 2);

    // 2. Compute Term Frequencies
    const freqMap = new Map<string, number>();
    tokens.forEach((word) => {
      freqMap.set(word, (freqMap.get(word) || 0) + 1);
    });

    // 3. Extract top keywords by frequency
    const sortedKeywords = Array.from(freqMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word)
      .slice(0, 8);

    // 4. Determine Category
    let bestCategory = '📁 일반 문서 (General)';
    let maxCategoryScore = 0;

    for (const rule of CATEGORY_RULES) {
      let score = 0;
      for (const term of rule.terms) {
        if (freqMap.has(term.toLowerCase())) {
          score += (freqMap.get(term.toLowerCase()) || 0) * 3;
        }
        if (title.toLowerCase().includes(term.toLowerCase())) {
          score += 10;
        }
      }

      if (score > maxCategoryScore) {
        maxCategoryScore = score;
        bestCategory = rule.category;
      }
    }

    // 5. Generate clean snippet preview
    const cleanSnippet = text
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180);

    return {
      category: bestCategory,
      keywords: sortedKeywords.length > 0 ? sortedKeywords : ['문서', title.split(' ')[0]],
      snippet: cleanSnippet || '본문 텍스트 요약이 제공되지 않습니다.',
    };
  }
}
