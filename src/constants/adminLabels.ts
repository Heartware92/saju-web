/**
 * 어드민 라벨 단일 소스
 * - saju_records.category (큰 8 꼭지 + 더많은운세 10종 + 꿈)
 * - tarot_records.spread_type
 * - credit_transactions.reason
 * - orders.package_id / payment_method
 * - 세그먼트·인구통계 라벨
 */

// ── 사주 분석 카테고리 ───────────────────────────────────────
/** saju_records.category 에 저장되는 값의 사람 친화 라벨 */
export const SAJU_CATEGORY_LABEL: Record<string, string> = {
  // 큰 8 꼭지 (해 ☀ 1개)
  traditional: '정통사주',
  newyear: '신년운세',
  today: '오늘의 운세',
  period: '지정일 운세',  // archiveService 저장 키
  date: '지정일 운세',     // 레거시 호환
  gunghap: '궁합',
  taekil: '택일',
  tojeong: '토정비결',
  zamidusu: '자미두수',
  // 더 많은 운세 (달 🌙 5개 — 2026-05-16 단일 달 크레딧 통합 후)
  love: '애정운',
  wealth: '재물운',
  career: '직업·진로운',
  health: '건강운',
  study: '학업·시험운',
  people: '귀인운',
  children: '자녀·출산운',
  personality: '성격 분석',
  name: '이름 풀이',
  dream: '꿈 해몽',
  // 레거시 (과거 데이터 호환)
  hybrid: '사주·타로 하이브리드',
  relation: '인간관계',
};

/** 큰 8 꼭지 (해 1 차감) — DB 저장 키와 일치 */
export const SAJU_BIG_CATEGORIES = [
  'traditional', 'newyear', 'today', 'period', 'gunghap', 'taekil', 'tojeong', 'zamidusu',
] as const;

/** 더 많은 운세 10종 (달 1 차감) */
export const SAJU_MORE_CATEGORIES = [
  'love', 'wealth', 'career', 'health', 'study', 'people', 'children', 'personality', 'name', 'dream',
] as const;

// ── 타로 스프레드 ────────────────────────────────────────────
export const TAROT_SPREAD_LABEL: Record<string, string> = {
  // 실제 archiveTarot 가 저장하는 키
  today: '오늘의 타로',
  monthly: '이달의 타로',
  'monthly-3card': '이달의 타로',
  question: '질문 타로',
  single: '카드 한 장',
  'hybrid-saju': '사주 × 타로',
  // 레거시
  oneCard: '원카드',
  threeCard: '쓰리카드',
  celticCross: '켈틱크로스',
  love: '애정 타로',
  hybrid: '사주·타로 하이브리드',
};

// ── 크레딧 거래 reason ──────────────────────────────────────
/** credit_transactions.reason 로 저장될 수 있는 값 */
export const CREDIT_REASON_LABEL: Record<string, string> = {
  // 컨텐츠 소비
  traditional: '정통사주',
  newyear: '신년운세',
  today: '오늘의 운세',
  gunghap: '궁합',
  period: '지정일 운세',
  date: '지정일 운세',  // 레거시 호환
  taekil: '택일',
  tojeong: '토정비결',
  zamidusu: '자미두수',
  tarot: '타로',
  tarotHybrid: '타로·사주 하이브리드',
  consultationPack: '상담소 질문팩',
  // 시스템
  signup_bonus: '회원가입 보너스',
  purchase: '크레딧 패키지 구매',
  refund: '환불',
  admin_adjust: '관리자 조정',
};

// ── 주문 상태 ────────────────────────────────────────────────
export const ORDER_STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  completed: { text: '완료',  cls: 'bg-green-500/20 text-green-300 border-green-500/30' },
  pending:   { text: '대기',  cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  refunded:  { text: '환불',  cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
  failed:    { text: '실패',  cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

// ── 인구통계 ─────────────────────────────────────────────────
export const GENDER_LABEL: Record<string, string> = {
  male: '남성',
  female: '여성',
  unknown: '미등록',
};

export const PROVIDER_LABEL: Record<string, string> = {
  email: '이메일',
  google: '구글',
  kakao: '카카오',
  apple: '애플',
  naver: '네이버',
};

/** 연령대 버킷 — 만 나이 기준 */
export const AGE_BUCKETS = [
  { key: 'teens',   label: '10대',  min: 10, max: 19 },
  { key: 'twenties',label: '20대',  min: 20, max: 29 },
  { key: 'thirties',label: '30대',  min: 30, max: 39 },
  { key: 'forties', label: '40대',  min: 40, max: 49 },
  { key: 'fifties', label: '50대',  min: 50, max: 59 },
  { key: 'sixties', label: '60대+', min: 60, max: 200 },
  { key: 'under10', label: '9세 이하', min: 0,  max: 9 },
  { key: 'unknown', label: '미등록', min: -1, max: -1 },
] as const;

export type AgeBucketKey = typeof AGE_BUCKETS[number]['key'];

/** 생년월일 (YYYY-MM-DD) → 연령대 key */
export function bucketizeAge(birthDate: string | null | undefined): AgeBucketKey {
  if (!birthDate) return 'unknown';
  const [y, m, d] = birthDate.split('-').map(Number);
  if (!y || !m || !d) return 'unknown';
  const now = new Date();
  let age = now.getFullYear() - y;
  const mm = now.getMonth() + 1;
  const dd = now.getDate();
  if (mm < m || (mm === m && dd < d)) age -= 1;
  if (age < 0 || age > 130) return 'unknown';
  for (const b of AGE_BUCKETS) {
    if (b.key === 'unknown') continue;
    if (age >= b.min && age <= b.max) return b.key;
  }
  return 'unknown';
}

// ── 세그먼트 ────────────────────────────────────────────────
export type UserSegment =
  | 'new'      // 가입 7일 이내
  | 'active'   // 최근 30일 내 이용 기록 있음
  | 'dormant'  // 60일+ 무접속
  | 'vip'      // 누적 결제 5만원+
  | 'paying'   // 1회 이상 결제
  | 'free';    // 결제 경험 없음

export const SEGMENT_LABEL: Record<UserSegment, { text: string; cls: string }> = {
  new:     { text: '신규',    cls: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  active:  { text: '활성',    cls: 'bg-green-500/20 text-green-300 border-green-500/30' },
  dormant: { text: '휴면',    cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  vip:     { text: 'VIP',    cls: 'bg-amber-500/25 text-amber-300 border-amber-500/40' },
  paying:  { text: '결제회원', cls: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  free:    { text: '무결제',   cls: 'bg-white/10 text-text-tertiary border-white/15' },
};

export const VIP_THRESHOLD_WON = 50_000;
export const NEW_DAYS = 7;
export const ACTIVE_DAYS = 30;
export const DORMANT_DAYS = 60;

// ── 탈퇴 사유 ────────────────────────────────────────────────
/** account_deletion_logs.reason_code 라벨 */
export const DELETION_REASON_LABEL: Record<string, string> = {
  not_useful:  '서비스 불만족',
  rarely_used: '미사용',
  hard_to_use: '사용 어려움',
  too_expensive: '가격 부담',   // 레거시
  privacy:     '개인정보 우려', // 레거시
  other:       '기타',
  unknown:     '미선택',
};

// ── 통합 라벨 조회 ───────────────────────────────────────────
/** saju category / tarot spread / credit reason 을 모두 커버하는 단일 조회 */
export function lookupServiceLabel(key: string | null | undefined): string {
  if (!key) return '-';
  return (
    SAJU_CATEGORY_LABEL[key] ??
    TAROT_SPREAD_LABEL[key] ??
    CREDIT_REASON_LABEL[key] ??
    key
  );
}
