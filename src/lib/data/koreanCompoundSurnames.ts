/**
 * 한국 현존 복성(複姓, 2글자 성씨) 화이트리스트.
 *
 * 출처: 통계청 인구주택총조사 + 한국의 복성(위키백과). 인구순.
 *
 * 정통 성명학 4격 계산 룰 (irum.com 정통작명연구원):
 *   복성 + 이름 2자 (총 4자) 경우 — 단성 공식을 그대로 쓰되 "성" = 복성의 둘째 글자만 사용.
 *     · 원격 = 이름 첫 글자 + 이름 끝 글자
 *     · 형격 = 이름 첫 글자 + 복성의 둘째 글자
 *     · 이격 = 복성의 둘째 글자 + 이름 끝 글자
 *     · 정격 = 전체 합
 *   자원오행·음령오행: 모든 글자(4개) 개별 분석.
 */

export interface CompoundSurname {
  /** 한글 (2글자) */
  korean: string;
  /** 한자 (2글자) */
  hanja: string;
  /** 한글 음 배열 (예: ['남', '궁']) */
  sounds: [string, string];
  /** 한자 배열 (예: ['南', '宮']) */
  hanjaChars: [string, string];
  /** 통계청 기준 인구 (참고용) */
  populationApprox: number;
}

export const KOREAN_COMPOUND_SURNAMES: CompoundSurname[] = [
  { korean: '남궁', hanja: '南宮', sounds: ['남', '궁'], hanjaChars: ['南', '宮'], populationApprox: 21308 },
  { korean: '황보', hanja: '皇甫', sounds: ['황', '보'], hanjaChars: ['皇', '甫'], populationApprox: 10383 },
  { korean: '제갈', hanja: '諸葛', sounds: ['제', '갈'], hanjaChars: ['諸', '葛'], populationApprox: 5655 },
  { korean: '사공', hanja: '司空', sounds: ['사', '공'], hanjaChars: ['司', '空'], populationApprox: 4476 },
  { korean: '선우', hanja: '鮮于', sounds: ['선', '우'], hanjaChars: ['鮮', '于'], populationApprox: 3588 },
  { korean: '서문', hanja: '西門', sounds: ['서', '문'], hanjaChars: ['西', '門'], populationApprox: 2028 },
  { korean: '독고', hanja: '獨孤', sounds: ['독', '고'], hanjaChars: ['獨', '孤'], populationApprox: 807 },
  { korean: '동방', hanja: '東方', sounds: ['동', '방'], hanjaChars: ['東', '方'], populationApprox: 220 },
];

const KOREAN_SET = new Set(KOREAN_COMPOUND_SURNAMES.map(s => s.korean));

/**
 * 한글 이름 앞 2글자가 한국 복성에 해당하는지 자동 감지.
 * 자동 감지는 추천만 (사용자가 체크박스로 최종 결정).
 */
export function detectCompoundSurname(koreanName: string): CompoundSurname | null {
  if (!koreanName || koreanName.length < 3) return null;  // 복성 + 이름 최소 1자 = 3자 이상
  const prefix = koreanName.slice(0, 2);
  if (!KOREAN_SET.has(prefix)) return null;
  return KOREAN_COMPOUND_SURNAMES.find(s => s.korean === prefix) ?? null;
}

/**
 * 복성 한글 → 한자 자동 매칭 (한자 picker 보조).
 * 정확한 1-to-1 매핑이라 picker 모달 없이 한자 자동 채울 수 있음.
 */
export function lookupCompoundSurnameHanja(korean: string): CompoundSurname | null {
  return KOREAN_COMPOUND_SURNAMES.find(s => s.korean === korean) ?? null;
}
