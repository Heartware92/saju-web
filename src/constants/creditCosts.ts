/**
 * 크레딧 차감 단가 일원화 (2026-05-16: 단일 달 크레딧으로 통합)
 *
 * ── 카테고리별 차감 (모두 달 🌙 단위, 1달 = ₩200)
 *  A. 기본 풀이 7종 (달 10개): 정통사주·신년운세·궁합·지정일·택일·토정비결·자미두수
 *  B. 더많은 운세 6종 + 오늘의 운세 (달 5개): 실시간/학업/자녀/성격/이름/꿈
 *  C. 타로 3종 (달 1개): 오늘의 타로·이달의 타로·질문 타로
 *  D. 상담소 (달 1개): 질문 1개당 1개씩 자동 차감 (팩 개념 제거)
 *
 * ── 철학
 *  - 한 번의 "의미 있는 결과 확인"에 대해 1회 차감
 *  - 자동 호출 페이지: 첫 성공 응답 시 useRef 가드 + 차감
 *  - 수동 호출 페이지: 버튼 클릭 성공 시 차감
 *  - 페이지 새로고침 = 새 마운트 = 새 차감 (서비스 특성상 매번 풀이이므로 합리적)
 *  - 잔액 0 도달 시 알림, 차감 자체는 RPC 가 0 잔액일 때 차단
 */

// ── 신규 단가 (2026-05-16) ─────────────────────────────────
/** 기본 풀이 7종 — 정통/신년/궁합/지정일/택일/토정/자미두수 */
export const MOON_COST_BIG = 10;
/** 더많은 운세 6종 + 오늘의 운세 */
export const MOON_COST_MORE = 5;
/** 타로 3종 — 오늘/이달/질문 */
export const MOON_COST_TAROT = 1;
/** 상담소 질문 1개 */
export const MOON_COST_CONSULTATION_QUESTION = 1;

// ── 옛 상수 별칭 (호환) ─────────────────────────────────────
/** @deprecated MOON_COST_BIG 사용. 옛 'sun' 차감 호출처 마이그레이션 후 제거 */
export const SUN_COST_BIG = MOON_COST_BIG;
/** @deprecated MOON_COST_MORE 사용 (값 1→5 변경됨) */
export const MOON_COST_PER_FORTUNE = MOON_COST_MORE;

// ── 사유(reason) 라벨 — 차감 로그 추적용 ─────────────────────
export const CHARGE_REASONS = {
  traditional: '정통사주',
  newyear: '신년운세',
  today: '오늘의 운세',
  gunghap: '궁합',
  date: '지정일 운세',
  /** 백그라운드 잡 시스템의 server CATEGORY_POLICY 는 'period' 키 사용 — 보관함 category 와 동일.
   *  reason 문자열은 위 'date' 와 일치 (가이드 4.7 일관성). */
  period: '지정일 운세',
  taekil: '택일',
  tojeong: '토정비결',
  zamidusu: '자미두수',
  // ── 더많은 운세 5종 (활성) — server CATEGORY_POLICY 와 reason 1:1 일치 (가이드 4.7) ──
  study: '학업·시험운',
  children: '자녀·출산운',
  personality: '성격 분석',
  name: '이름 풀이',
  dream: '꿈해몽',
  tarot: '타로',
  tarotHybrid: '타로·사주 하이브리드',
  consultation: '상담소 질문',
  /** @deprecated 팩 개념 폐지 — consultation 사용 */
  consultationPack: '상담소 질문팩',
} as const;
