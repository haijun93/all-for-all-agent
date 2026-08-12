use once_cell::sync::Lazy;
use serde::Serialize;
use std::collections::{HashMap, HashSet};

#[derive(Clone, Serialize)]
pub struct KeywordAnalysisResult {
    pub category: String,
    pub keywords: Vec<String>,
    pub snippet: String,
}

static STOP_WORDS: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    [
        "은", "는", "이", "가", "을", "를", "의", "에", "에서", "로", "으로", "와", "과", "및", "등",
        "등에", "대한", "위한", "따라", "통해", "있음", "없음", "관한", "그리고", "the", "and", "for",
        "with", "that", "this", "from", "have", "are", "was", "were", "한다", "된다", "있다", "합니다",
        "됩니다", "페이지", "page", "총", "건", "개",
    ]
    .into_iter()
    .collect()
});

// Korean Morphological Particle & Josa Stripper (Inspired by Lindera NLP)
const KOREAN_PARTICLES: &[&str] = &[
    "에서", "에게", "으로", "로써", "와의", "과의", "까지", "부터", "이나", "이나마", "에게는", "에서는",
    "으로의", "사항", "내역",
];

struct CategoryRule {
    category: &'static str,
    terms: &'static [&'static str],
}

const CATEGORY_RULES: &[CategoryRule] = &[
    CategoryRule {
        category: "📜 계약서 / 법률",
        terms: &[
            "계약", "계약서", "갑", "을", "조항", "체결", "특약", "당사자", "해지", "손해배상", "의무",
            "합의", "비밀유지",
        ],
    },
    CategoryRule {
        category: "📊 사업계획서 / 제안서",
        terms: &[
            "사업계획", "사업계획서", "제안서", "추진전략", "로드맵", "시장분석", "비즈니스", "타겟",
            "수익모델", "투자유치", "비전", "전략",
        ],
    },
    CategoryRule {
        category: "💰 재무 / 결산 / 예산",
        terms: &[
            "재무제표", "손익계산서", "결산", "매출", "지출", "예산안", "부가세", "세금계산서", "회계",
            "영업이익", "대차대조표", "손익",
        ],
    },
    CategoryRule {
        category: "📑 견적서 / 명세서",
        terms: &[
            "견적서", "견적", "품명", "수량", "단가", "공급가액", "세액", "합계금액", "발주서",
            "거래명세서", "단가표",
        ],
    },
    CategoryRule {
        category: "🔬 연구 / 기술보고서",
        terms: &[
            "연구보고서", "기술보고서", "알고리즘", "아키텍처", "실험결과", "분석결과", "데이터셋",
            "시스템", "검증", "인공지능", "특허", "r&d",
        ],
    },
    CategoryRule {
        category: "👥 인사 / 총무 / 행정",
        terms: &[
            "근로계약서", "인사평가", "급여명세서", "채용공고", "복무규정", "퇴직금", "신청서",
            "출장보고서", "회의록", "서약서",
        ],
    },
    CategoryRule {
        category: "📚 도서 / 전자책 (e-Book)",
        terms: &[
            "소설", "에세이", "인문", "기술서", "챕터", "chapter", "저자", "출판사", "발행일", "전자책",
            "epub", "독서", "문학", "가이드북",
        ],
    },
    CategoryRule {
        category: "🎨 만화책 / 코믹스 (Comics)",
        terms: &[
            "만화", "만화책", "코믹스", "드래곤볼", "진격의 거인", "귀멸의 칼날", "베르세르크", "원펀맨",
            "주술회전", "스파이", "스캔", "단행본", "완결", "전권", "무협", "comics", "manga", "cbz",
            "zip", "화", "권",
        ],
    },
];

fn is_hangul_syllable(c: char) -> bool {
    ('\u{AC00}'..='\u{D7A3}').contains(&c)
}

/// Normalizes a Korean word token by stripping a trailing grammatical particle
pub fn normalize_korean_token(word: &str) -> String {
    if word.chars().count() > 2 {
        for particle in KOREAN_PARTICLES {
            if let Some(stripped) = word.strip_suffix(particle) {
                return stripped.to_string();
            }
        }
    }
    word.to_string()
}

/// Extracts top keywords and auto-categorizes a document based on its extracted text
pub fn analyze_document_text(title: &str, text: &str) -> KeywordAnalysisResult {
    let full_text = format!("{title} {title} {text}").to_lowercase();

    // 1. Tokenize (replace anything that isn't ascii word char / hangul syllable / whitespace)
    let cleaned: String = full_text
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' || is_hangul_syllable(c) || c.is_whitespace() {
                c
            } else {
                ' '
            }
        })
        .collect();

    let raw_tokens: Vec<String> = cleaned
        .split_whitespace()
        .filter(|w| w.chars().count() >= 2 && !STOP_WORDS.contains(*w) && w.parse::<f64>().is_err())
        .map(|w| w.to_string())
        .collect();

    let tokens: Vec<String> = raw_tokens
        .iter()
        .map(|t| normalize_korean_token(t))
        .filter(|w| w.chars().count() >= 2)
        .collect();

    // 2. Compute term frequencies, preserving first-seen order for stable tie-breaking
    let mut order: Vec<String> = Vec::new();
    let mut freq_map: HashMap<String, i32> = HashMap::new();
    for tok in &tokens {
        if !freq_map.contains_key(tok) {
            order.push(tok.clone());
        }
        *freq_map.entry(tok.clone()).or_insert(0) += 1;
    }

    // 3. Extract top keywords by frequency
    let mut entries: Vec<(String, i32)> = order
        .into_iter()
        .map(|w| {
            let c = freq_map[&w];
            (w, c)
        })
        .collect();
    entries.sort_by(|a, b| b.1.cmp(&a.1));
    let sorted_keywords: Vec<String> = entries.into_iter().take(8).map(|(w, _)| w).collect();

    // 4. Determine category
    let mut best_category = "📁 일반 문서 (General)".to_string();
    let mut max_score = 0i32;
    let title_lower = title.to_lowercase();

    for rule in CATEGORY_RULES {
        let mut score = 0i32;
        for term in rule.terms {
            let term_lower = term.to_lowercase();
            if let Some(count) = freq_map.get(&term_lower) {
                score += count * 3;
            }
            if title_lower.contains(&term_lower) {
                score += 10;
            }
        }
        if score > max_score {
            max_score = score;
            best_category = rule.category.to_string();
        }
    }

    // 5. Generate clean snippet preview
    let collapsed_ws = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let clean_snippet: String = collapsed_ws.chars().take(180).collect();

    let keywords = if sorted_keywords.is_empty() {
        vec![
            "문서".to_string(),
            title.split(' ').next().unwrap_or("").to_string(),
        ]
    } else {
        sorted_keywords
    };

    KeywordAnalysisResult {
        category: best_category,
        keywords,
        snippet: if clean_snippet.is_empty() {
            "본문 텍스트 요약이 제공되지 않습니다.".to_string()
        } else {
            clean_snippet
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn categorizes_contract_documents() {
        let r = analyze_document_text(
            "2024년 공급 계약서",
            "본 계약서는 갑과 을 사이의 물품 공급에 관한 계약 조항을 정한다. 계약 해지 시 손해배상 의무가 발생한다.",
        );
        assert_eq!(r.category, "📜 계약서 / 법률");
        assert!(!r.keywords.is_empty());
    }

    #[test]
    fn strips_trailing_particles() {
        assert_eq!(normalize_korean_token("서울에서"), "서울");
        assert_eq!(normalize_korean_token("데이터로"), "데이터로"); // "으로" only, not "로" alone
        assert_eq!(normalize_korean_token("회사로써"), "회사");
    }

    #[test]
    fn falls_back_to_general_category() {
        let r = analyze_document_text("아무 제목", "특별한 키워드가 전혀 없는 임의의 텍스트입니다.");
        assert_eq!(r.category, "📁 일반 문서 (General)");
    }
}
