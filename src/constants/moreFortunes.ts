/**
 * "더 많은 운세" 카테고리 메타 정보
 * - 홈 탭 아래 버튼으로 노출
 * - 각 카테고리는 달(moon) 크레딧 1개 소모
 * - 큰 카테고리(정통사주·신년·오늘·지정일·택일·토정·자미두수)와 달리 짧고 집중된 풀이
 *
 * [B안 적용 — 2026-04-27]
 * 직원 피드백: 메인 8(신년/정통/오늘/궁합/지정일/택일/토정/자미두수)에서 이미 다루는
 * 영역이 더많은운세에서 중복으로 노출됨. 중복되던 5개 카테고리를 비활성화하고,
 * 메인 8 이 못 다루는 진짜 고유 영역(학업/자녀/성격 심층/이름/꿈)만 남김.
 *
 * 비활성: love, wealth, career, health, people (모두 신년운세·정통사주에서 다룸)
 * 유지:   study, children, personality, name, dream (메인 8에서 다루지 않음)
 *
 * 비활성 항목은 주석으로 보존 — 비즈니스 결정 변경 시 빠르게 복원 가능.
 * 보관함의 옛날 기록 호환성: SAJU_CATEGORY_LABEL 의 5개 라벨은 그대로 유지하므로
 * 이전 결제·풀이 기록은 보관함에서 정상 표시됨.
 */

export type MoreFortuneId =
  // [비활성] 메인 8 (신년/정통사주/지정일/자미두수) 와 중복 — 주석 보존, 복원 가능
  // | 'love'         // 애정운     → 신년운세 연애·결혼운, 정통사주 애정·결혼운, 궁합 카테고리에서 다룸
  // | 'wealth'       // 재물운     → 신년운세 재물운, 정통사주 재물운, 자미두수 재물·일의 하늘에서 다룸
  // | 'career'       // 직업·진로운 → 신년운세 직장·사업운, 정통사주 직업·적성에서 다룸
  // | 'health'       // 건강운     → 신년운세 건강운, 정통사주 건강운, 자미두수 몸과 마음의 하늘에서 다룸
  // | 'people'       // 인간관계·귀인운 → 신년운세 인간관계운, 정통사주 인간관계·가족, 자미두수 관계 하늘에서 다룸
  | 'study'        // 학업·시험운       (메인 8에 없음 — 고유)
  | 'children'     // 자녀·출산운       (정통사주 인간관계 일부 외 단독 없음 — 고유)
  | 'personality'  // 성격 심층 분석     (정통사주 성격·기질보다 깊이↑ — 60갑자/간여지동/신살 종합)
  | 'name'         // 이름 풀이          (사주 무관 음령오행/자원오행 — 메인 8에 없음)
  | 'dream';       // 꿈 해몽           (사주 무관 — 메인 8에 없음)

export interface MoreFortuneConfig {
  id: MoreFortuneId;
  title: string;
  icon: string;
  shortDesc: string;       // 홈 버튼 아래 한 줄
  longDesc: string;        // 페이지 소개 카드 본문
  ctaButton: string;       // 풀이 버튼 문구
  maxTokens: number;       // AI 응답 길이 (토큰)
  needsNameInput?: boolean;
  needsDreamInput?: boolean;
}

export const MORE_FORTUNE_CONFIGS: Record<MoreFortuneId, MoreFortuneConfig> = {
  // [비활성 — B안] 메인 8 중복. 주석 보존, 복원 가능.
  // love: {
  //   id: 'love',
  //   title: '애정운',
  //   icon: '♡',
  //   shortDesc: '연애·결혼 시기',
  //   longDesc: '일지(배우자궁)와 재성·관성, 도화살을 바탕으로 어떤 사람에게 끌리는지, 올해 연애·결혼 가능성이 높은 시기가 언제인지 풀어드려요.',
  //   ctaButton: '내 애정운 보기',
  //   maxTokens: 1500,
  // },
  // wealth: {
  //   id: 'wealth',
  //   title: '재물운',
  //   icon: '◆',
  //   shortDesc: '돈의 흐름·시기',
  //   longDesc: '사주 속 재성(편재·정재) 분포와 재고, 올해 세운의 재성 흐름을 근거로 돈이 들어오는 스타일과 쌓이는 시기를 알려드려요.',
  //   ctaButton: '내 재물운 보기',
  //   maxTokens: 1500,
  // },
  // career: {
  //   id: 'career',
  //   title: '직업·진로운',
  //   icon: '▲',
  //   shortDesc: '적성·이직 시기',
  //   longDesc: '관성(조직)과 식상(창의), 격국을 종합해 어떤 직군이 잘 맞는지, 지금 이직·승진 시기로 적절한지 진단해드려요.',
  //   ctaButton: '내 직업운 보기',
  //   maxTokens: 1500,
  // },
  // health: {
  //   id: 'health',
  //   title: '건강운',
  //   icon: '◎',
  //   shortDesc: '약한 장부 진단',
  //   longDesc: '약한 오행과 충·형 구조로 취약한 장부를 파악하고, 올해 세운이 어느 장부에 영향을 주는지 주의사항과 습관을 알려드려요.',
  //   ctaButton: '내 건강운 보기',
  //   maxTokens: 1300,
  // },
  study: {
    id: 'study',
    title: '학업·시험운',
    icon: '✎',
    shortDesc: '시험 유리한 달',
    longDesc: '인성(문창·학당귀인)과 식상, 올해 세운을 근거로 공부 체질인지, 시험·자격·발표에 유리한 달이 언제인지 짚어드려요.',
    ctaButton: '내 학업운 보기',
    maxTokens: 3500,
  },
  // [비활성 — B안] 신년운세 인간관계운, 정통사주 인간관계·가족과 중복.
  // people: {
  //   id: 'people',
  //   title: '귀인운',
  //   icon: '★',
  //   shortDesc: '귀인·경계 관계',
  //   longDesc: '천을귀인과 비겁·인성·관성 배치를 바탕으로 올해 누가 도움이 될지, 조심해야 할 관계 유형이 무엇인지 알려드려요.',
  //   ctaButton: '내 귀인운 보기',
  //   maxTokens: 1500,
  // },
  children: {
    id: 'children',
    title: '자녀·출산운',
    icon: '◇',
    shortDesc: '출산 유리한 달',
    longDesc: '남성은 관성, 여성은 식상을 자녀성으로 보고 시주의 자녀궁과 세운 흐름으로 자녀복과 출산에 유리한 시기를 풀어드려요.',
    ctaButton: '내 자녀운 보기',
    maxTokens: 3500,
  },
  personality: {
    id: 'personality',
    title: '성격 심층 분석',
    icon: '◉',
    shortDesc: '성격 심층 진단',
    longDesc: '일주 60갑자와 격국·신강신약·간여지동·주요 신살을 종합해 타고난 본질, 강점 2가지와 숨은 그림자 2가지를 명확히 짚어드려요.',
    ctaButton: '내 성격 분석 보기',
    maxTokens: 4500,
  },
  name: {
    id: 'name',
    title: '이름 풀이',
    icon: '✦',
    shortDesc: '이름·사주 조화',
    longDesc: '한글 초성의 음령오행을 분석해 내 이름이 사주 용신을 돕는지 거스르는지 진단하고, 한자를 입력하면 부수 기반 자원오행까지 교차 분석해 필명·닉네임 방향을 제안해드려요.',
    ctaButton: '내 이름 풀이 보기',
    // 한글만 2,000 / 한자 포함 2,500 — fortuneService 에서 hanjaName 유무로 분기
    maxTokens: 2000,
    needsNameInput: true,
  },
  dream: {
    id: 'dream',
    title: '꿈 해몽',
    icon: '☾',
    shortDesc: '꿈의 현실 힌트',
    longDesc: '간밤에 꾼 꿈을 적어주세요. 주공해몽·한국 민속 해몽 전통과 현대 심리 해석을 결합한 지식베이스로, 꿈속 상징·맥락·감정을 함께 풀어 현실의 힌트를 구체적으로 짚어드려요. (꿈은 사주와 무관하게 꿈 자체로 해석합니다)',
    ctaButton: '내 꿈 풀이 보기',
    maxTokens: 2500,
    needsDreamInput: true,
  },
};

// [B안] 비활성 5개(love/wealth/career/health/people) 제외하고 5개만 노출.
// 비활성 항목을 복원하려면 위 CONFIGS 주석 풀고 아래 배열에도 다시 추가.
export const MORE_FORTUNE_ORDER: MoreFortuneId[] = [
  'study', 'children', 'personality',
  'name', 'dream',
];

/**
 * 보관함 호환용 — 비활성된 5개 카테고리 ID.
 * saju_records DB 에 옛 기록이 남아있고 사용자가 보관함에서 클릭 시
 * `/saju/more/love?recordId=...` 같은 경로로 진입한다.
 * page.tsx 의 가드와 MoreFortunePage 의 cfg 부재 처리에서 이 목록을 활용해
 * archive replay 만 허용하고 정상 진입은 차단.
 */
export const LEGACY_MORE_CATEGORIES = [
  'love', 'wealth', 'career', 'health', 'people',
] as const;
export type LegacyMoreCategory = typeof LEGACY_MORE_CATEGORIES[number];

/** category 가 보관함 호환 전용(비활성)인지 판정 */
export const isLegacyMoreCategory = (cat: string): cat is LegacyMoreCategory =>
  (LEGACY_MORE_CATEGORIES as readonly string[]).includes(cat);

/** 비활성 카테고리의 사람 친화 라벨 (보관함 카드 + 페이지 헤더용) */
export const LEGACY_MORE_LABELS: Record<LegacyMoreCategory, string> = {
  love: '애정운',
  wealth: '재물운',
  career: '직업·진로운',
  health: '건강운',
  people: '귀인운',
};

export const MOON_COST_PER_FORTUNE = 1;
