/**
 * 크레딧 차감 비용 일원화
 *
 * ── 카테고리 구분
 *  A. 큰 8개 꼭지 (해 ☀ 1개): 정통사주·신년운세·오늘의운세·궁합·지정일운세·택일·토정비결·자미두수
 *  B. 더 많은 운세 10종 (달 🌙 1개): 애정/재물/직업/건강/학업/귀인/자녀/성격/이름/꿈
 *  C. 타로 (달 🌙 1개): 단독 타로·하이브리드 타로
 *  D. 상담소 (팩 단위): 해 1 = 3질문 OR 달 3 = 3질문. 질문당 단 1개 차감 불가.
 *
 * ── 철학
 *  - 한 번의 "의미 있는 결과 확인"에 대해 1회 차감
 *  - 자동 호출 페이지: 첫 성공 응답 시 useRef 가드 + 차감
 *  - 수동 호출 페이지: 버튼 클릭 성공 시 차감
 *  - 페이지 새로고침 = 새 마운트 = 새 차감 (서비스 특성상 매번 풀이이므로 합리적)
 */

export const SUN_COST_BIG = 1;    // 큰 8개 꼭지
export const MOON_COST_MORE = 1;  // 더 많은 운세 10종
export const MOON_COST_TAROT = 1; // 타로 (단독·하이브리드)

// ── 상담소 팩(pack) 정책 ─────────────────────────────────────
/** 한 팩당 질문 가능 횟수 */
export const CONSULTATION_QUESTIONS_PER_PACK = 3;
/** 팩 구매: 해 1개 */
export const CONSULTATION_PACK_SUN_COST = 1;
/** 팩 구매: 달 3개 */
export const CONSULTATION_PACK_MOON_COST = 3;

// ── 사유(reason) 라벨 — 차감 로그 추적용 ─────────────────────
export const CHARGE_REASONS = {
  traditional: '정통사주',
  newyear: '신년운세',
  today: '실시간 운세',
  gunghap: '궁합',
  date: '지정일 운세',
  taekil: '택일',
  tojeong: '토정비결',
  zamidusu: '자미두수',
  tarot: '타로',
  tarotHybrid: '타로·사주 하이브리드',
  consultationPack: '상담소 질문팩',
} as const;
