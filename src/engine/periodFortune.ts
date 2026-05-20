/**
 * 기간 운세 엔진 (신년운세 · 실시간 운세 · 지정일 운세 통합)
 *
 * 원국(natal chart)과 대상 기간(년/월/일)의 간지를 비교하여
 * 결정론적으로 운세 점수와 해석 카드를 생성한다.
 *
 * 모든 계산은 순수 함수 — LLM 호출 없이 오프라인 결과 보장.
 */

import { Solar, Lunar } from 'lunar-javascript';
import {
  HEAVENLY_STEMS,
  EARTHLY_BRANCHES,
  STEM_ELEMENT,
  BRANCH_ELEMENT,
  TEN_GODS_MAP,
  BRANCH_HIDDEN_STEMS,
  normalizeGan,
  normalizeZhi,
  getTenGodForBranch,
  getTwelveStage,
  getSinSal12,
  type SajuResult,
} from '../utils/sajuCalculator';

// ============================================
// 타입
// ============================================

export type FortuneScope = 'year' | 'month' | 'day';

export type FortuneGrade = '대길' | '길' | '중길' | '평' | '중흉' | '흉';

export interface FortuneDomain {
  key: 'overall' | 'wealth' | 'career' | 'love' | 'health' | 'study' | 'relation';
  label: string;
  score: number; // 0~100
  grade: FortuneGrade;
  summary: string;
  tips: string[];
}

export interface TargetGanZhi {
  gan: string;
  zhi: string;
  ganZhi: string;
  ganElement: string;
  zhiElement: string;
  tenGodGan: string;
  tenGodZhi: string;
  hiddenStems: string[];
}

export interface GanZhiInteraction {
  kind: '삼합' | '육합' | '육충' | '형' | '반합' | '없음';
  between: string; // "년지(申) × 세운지(午)" 등
  nature: 'good' | 'bad' | 'mixed';
  description: string;
}

export interface PeriodFortune {
  scope: FortuneScope;
  targetLabel: string; // "2026년" / "2026-04-15" / "4월"
  targetDate: string;  // ISO — e.g., 2026-04-15
  lunarLabel: string;  // "을사년 기묘월 갑자일" 등
  targetGanZhi: TargetGanZhi;
  overallScore: number; // 0~100
  overallGrade: FortuneGrade;
  headline: string;     // 한 줄 총평
  summary: string;      // 2~3문장
  domains: FortuneDomain[];
  interactions: GanZhiInteraction[];
  luckyColors: string[];
  luckyNumbers: number[];
  luckyDirection: string;
  luckyTime: string;
  luckyGem?: string;
  luckyActivity?: string;
  cautions: string[];
  monthlyFlow?: MonthlyFlowItem[]; // year scope only
}

// ============================================
// 상수 / 헬퍼
// ============================================

const ELEMENT_COLORS: Record<string, string[]> = {
  '목': ['초록', '연두', '민트'],
  '화': ['빨강', '주황', '핑크'],
  '토': ['노랑', '황토', '베이지'],
  '금': ['화이트', '실버', '그레이'],
  '수': ['파랑', '네이비', '블랙'],
};

const ELEMENT_NUMBERS: Record<string, number[]> = {
  '목': [3, 8],
  '화': [2, 7],
  '토': [5, 10],
  '금': [4, 9],
  '수': [1, 6],
};

const ELEMENT_DIRECTIONS: Record<string, string> = {
  '목': '동쪽',
  '화': '남쪽',
  '토': '중앙',
  '금': '서쪽',
  '수': '북쪽',
};

const ELEMENT_TIMES: Record<string, string> = {
  '목': '오전 5시~7시 (인·묘시)',
  '화': '오전 11시~오후 1시 (사·오시)',
  '토': '진·술·축·미시',
  '금': '오후 3시~7시 (신·유시)',
  '수': '밤 11시~새벽 3시 (자·축시)',
};

const BRANCH_DIRECTION: Record<string, string> = {
  '자': '북쪽', '축': '북쪽', '인': '동쪽', '묘': '동쪽',
  '진': '동쪽', '사': '남쪽', '오': '남쪽', '미': '남쪽',
  '신': '서쪽', '유': '서쪽', '술': '서쪽', '해': '북쪽',
};

const BRANCH_LUCKY_TIME: Record<string, string> = {
  '자': '밤 11시~새벽 1시 (자시)', '축': '새벽 1~3시 (축시)',
  '인': '새벽 3~5시 (인시)', '묘': '오전 5~7시 (묘시)',
  '진': '오전 7~9시 (진시)', '사': '오전 9~11시 (사시)',
  '오': '오전 11시~오후 1시 (오시)', '미': '오후 1~3시 (미시)',
  '신': '오후 3~5시 (신시)', '유': '오후 5~7시 (유시)',
  '술': '오후 7~9시 (술시)', '해': '밤 9~11시 (해시)',
};

const ELEMENT_GEMS: Record<string, string> = {
  '목': '에메랄드·옥', '화': '루비·석류석', '토': '황수정·호박',
  '금': '다이아몬드·백수정', '수': '사파이어·청금석',
};

const ELEMENT_ACTIVITIES: Record<string, string> = {
  '목': '숲 산책·독서·글쓰기', '화': '사교 모임·발표·운동',
  '토': '정원 가꾸기·요리·명상', '금': '악기 연주·정리정돈',
  '수': '수영·명상·물 가까운 환경',
};

function calcDailyLucky(saju: SajuResult, target: TargetGanZhi) {
  const yongEl = saju.yongSinElement || '목';
  const dayEl = target.ganElement;
  const dayZhi = target.zhi;

  const yukhapZhi = YUKHAP.find(([a, b]) => a === dayZhi || b === dayZhi);
  const bestZhi = yukhapZhi ? (yukhapZhi[0] === dayZhi ? yukhapZhi[1] : yukhapZhi[0]) : dayZhi;
  const bestTime = BRANCH_LUCKY_TIME[bestZhi] || ELEMENT_TIMES[yongEl] || '오전';

  const direction = BRANCH_DIRECTION[dayZhi] || ELEMENT_DIRECTIONS[yongEl] || '동쪽';

  const primaryEl = dayEl;
  const secondaryEl = yongEl;
  const colors = [
    ...(ELEMENT_COLORS[primaryEl] ?? []).slice(0, 1),
    ...(primaryEl !== secondaryEl ? (ELEMENT_COLORS[secondaryEl] ?? []).slice(0, 1) : (ELEMENT_COLORS[primaryEl] ?? []).slice(1, 2)),
  ];

  const dayNum = (ELEMENT_NUMBERS[primaryEl] ?? [3, 8])[0];
  const yongNum = (ELEMENT_NUMBERS[secondaryEl] ?? [3, 8])[1];
  const numbers = dayNum !== yongNum ? [dayNum, yongNum] : ELEMENT_NUMBERS[primaryEl] ?? [3, 8];

  const gem = ELEMENT_GEMS[secondaryEl] || ELEMENT_GEMS['목'];
  const activity = ELEMENT_ACTIVITIES[primaryEl] || ELEMENT_ACTIVITIES['목'];

  return { colors, numbers, direction, time: bestTime, gem, activity };
}

const TEN_GOD_SCORE: Record<string, number> = {
  '정관': 12, '정인': 10, '정재': 10, '식신': 9, '편재': 7,
  '편인': 2, '겁재': -1, '비견': 0, '상관': -2, '편관': -1,
};

// 삼합(三合)
const SAMHAP: [string, string, string, string][] = [
  ['신', '자', '진', '수'],
  ['사', '유', '축', '금'],
  ['인', '오', '술', '화'],
  ['해', '묘', '미', '목'],
];

// 육합(六合)
const YUKHAP: [string, string, string][] = [
  ['자', '축', '토'],
  ['인', '해', '목'],
  ['묘', '술', '화'],
  ['진', '유', '금'],
  ['사', '신', '수'],
  ['오', '미', '화'],
];

// 육충(六沖)
const YUKCHUNG: [string, string][] = [
  ['자', '오'], ['축', '미'], ['인', '신'],
  ['묘', '유'], ['진', '술'], ['사', '해'],
];

// 형(刑) — 삼형 + 자형
const HYEONG: [string, string][] = [
  ['인', '사'], ['사', '신'], ['인', '신'],
  ['축', '술'], ['술', '미'], ['축', '미'],
  ['자', '묘'],
];

function checkBranchPair(a: string, b: string): GanZhiInteraction | null {
  // 육충 우선
  for (const [x, y] of YUKCHUNG) {
    if ((a === x && b === y) || (a === y && b === x)) {
      return {
        kind: '육충',
        between: `${a} × ${b}`,
        nature: 'bad',
        description: `${a}와 ${b}가 충돌 — 변동·이동·갈등 암시`,
      };
    }
  }
  // 형
  for (const [x, y] of HYEONG) {
    if ((a === x && b === y) || (a === y && b === x)) {
      return {
        kind: '형',
        between: `${a} × ${b}`,
        nature: 'bad',
        description: `${a}와 ${b}가 형 — 시비·소송·건강 주의`,
      };
    }
  }
  // 육합
  for (const [x, y, el] of YUKHAP) {
    if ((a === x && b === y) || (a === y && b === x)) {
      return {
        kind: '육합',
        between: `${a} × ${b}`,
        nature: 'good',
        description: `${a}와 ${b}가 육합(${el}) — 결속·인연·협력의 기운`,
      };
    }
  }
  // 반합 (삼합 중 2자 매칭)
  for (const [a1, a2, a3, el] of SAMHAP) {
    const trio = [a1, a2, a3];
    if (trio.includes(a) && trio.includes(b) && a !== b) {
      return {
        kind: '반합',
        between: `${a} × ${b}`,
        nature: 'good',
        description: `${a}와 ${b}가 반합(${el}국) — 원하는 방향으로 기운 결집`,
      };
    }
  }
  return null;
}

function gradeFromScore(s: number): FortuneGrade {
  if (s >= 90) return '대길';
  if (s >= 82) return '길';
  if (s >= 72) return '중길';
  if (s >= 65) return '평';
  if (s >= 60) return '중흉';
  return '흉';
}

// ============================================
// 대상 간지 조회
// ============================================

function ganZhiForYear(year: number) {
  const solar = Solar.fromYmd(year, 6, 15);
  const lunar = solar.getLunar();
  const gz = lunar.getYearInGanZhi();
  return { gan: normalizeGan(gz[0]), zhi: normalizeZhi(gz[1]), ganZhi: gz };
}

function ganZhiForDate(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const solar = Solar.fromYmd(y, m, d);
  const lunar = solar.getLunar();
  const yearGz = lunar.getYearInGanZhi();
  const monthGz = lunar.getMonthInGanZhi();
  const dayGz = lunar.getDayInGanZhi();
  return {
    year: { gan: normalizeGan(yearGz[0]), zhi: normalizeZhi(yearGz[1]), ganZhi: yearGz },
    month: { gan: normalizeGan(monthGz[0]), zhi: normalizeZhi(monthGz[1]), ganZhi: monthGz },
    day: { gan: normalizeGan(dayGz[0]), zhi: normalizeZhi(dayGz[1]), ganZhi: dayGz },
    lunarLabel: `${yearGz}년 ${monthGz}월 ${dayGz}일`,
  };
}

// ============================================
// 점수 계산
// ============================================

function scoreForTarget(saju: SajuResult, target: TargetGanZhi): {
  overall: number;
  domains: Record<FortuneDomain['key'], number>;
  rationale: string[];
} {
  const dayGan = saju.dayMaster;
  const rationale: string[] = [];
  let base = 70;

  // 1) 천간 십신 점수
  const ganScore = TEN_GOD_SCORE[target.tenGodGan] ?? 0;
  base += ganScore;
  if (target.tenGodGan) {
    rationale.push(`대상 천간 십신: ${target.tenGodGan} (${ganScore >= 0 ? '+' : ''}${ganScore})`);
  }

  // 2) 지지 십신 점수
  const zhiScore = TEN_GOD_SCORE[target.tenGodZhi] ?? 0;
  base += zhiScore * 0.7;

  // 3) 용신 일치 보너스
  if (target.ganElement === saju.yongSinElement) {
    base += 12;
    rationale.push(`대상 천간이 용신(${saju.yongSinElement}) — 기운 상승 +12`);
  }
  if (target.zhiElement === saju.yongSinElement) {
    base += 7;
  }

  // 4) 합·충 보너스/페널티 (4기둥 지지와 대상 지지 비교)
  const pillars = [saju.pillars.year, saju.pillars.month, saju.pillars.day, saju.pillars.hour].filter(p => p.zhi);
  let interactionBonus = 0;
  pillars.forEach(p => {
    const inter = checkBranchPair(p.zhi, target.zhi);
    if (inter) {
      if (inter.nature === 'good') interactionBonus += 5;
      else if (inter.nature === 'bad') interactionBonus -= 2;
    }
  });
  base += interactionBonus;
  if (interactionBonus !== 0) {
    rationale.push(`지지 상호작용 합산 ${interactionBonus >= 0 ? '+' : ''}${interactionBonus}`);
  }

  // 5) clamp — 상향 평준화 (60~97 범위 보장)
  const overall = Math.max(60, Math.min(97, Math.round(base)));

  // 6) 영역별 점수 — 십신 매핑 기반
  const wealthBoost = ['정재', '편재', '식신'].includes(target.tenGodGan) ? 15
    : ['겁재', '비견'].includes(target.tenGodGan) ? -6 : 0;
  const careerBoost = ['정관', '편관', '정인'].includes(target.tenGodGan) ? 15
    : target.tenGodGan === '상관' ? -6 : 0;
  const healthBoost = interactionBonus < 0 ? -8 : ['정인', '식신'].includes(target.tenGodGan) ? 8 : 0;
  const studyBoost = ['정인', '편인', '식신'].includes(target.tenGodGan) ? 14 : 0;
  const relationBoost = ['정인', '편인', '정관'].includes(target.tenGodGan) ? 12
    : ['겁재', '상관'].includes(target.tenGodGan) ? -6 : 0;

  // 애정운 — 성별 구분 (명리: 남성 재성=애정, 여성 관성=애정)
  const isMale = saju.gender === 'male';
  const loveBoost = (() => {
    if (isMale) {
      // 남자: 정재/편재가 애정 → 재물과 애정 연동
      if (['정재', '편재'].includes(target.tenGodGan)) return 14;
      if (target.tenGodGan === '식신') return 8;
      if (target.tenGodGan === '겁재') return -6;
      return 0;
    } else {
      // 여자: 정관/편관이 애정
      if (['정관', '편관'].includes(target.tenGodGan)) return 14;
      if (target.tenGodGan === '정인') return 8;
      if (target.tenGodGan === '상관') return -6;
      return 0;
    }
  })();

  const clamp = (v: number) => Math.max(60, Math.min(97, Math.round(overall * 0.45 + 38 + v)));

  return {
    overall,
    domains: {
      overall,
      wealth: clamp(wealthBoost),
      career: clamp(careerBoost),
      love: clamp(loveBoost),
      health: clamp(healthBoost),
      study: clamp(studyBoost),
      relation: clamp(relationBoost),
    },
    rationale,
  };
}

// ============================================
// 해석 빌더
// ============================================

function buildDomainSummary(key: FortuneDomain['key'], grade: FortuneGrade, target: TargetGanZhi): { summary: string; tips: string[] } {
  const g = target.tenGodGan || '—';
  const positive = grade === '대길' || grade === '길' || grade === '중길';

  const byKey: Record<FortuneDomain['key'], { up: string; down: string; tipsUp: string[]; tipsDown: string[] }> = {
    overall: {
      up: `전반적 기운이 ${g}의 흐름으로 순조롭게 열립니다.`,
      down: `${g}의 기운이 강해 조심이 필요한 시기입니다.`,
      tipsUp: ['기회가 오면 망설이지 말 것', '주변 인연을 넓혀두기'],
      tipsDown: ['무리한 결정 미루기', '이성적 판단 유지'],
    },
    wealth: {
      up: `재물의 기운이 ${g}을(를) 통해 들어옵니다.`,
      down: `재물이 빠져나가기 쉬운 구조 — 지출 관리 필요.`,
      tipsUp: ['저축·재투자 타이밍', '부수입 기회 주목'],
      tipsDown: ['충동 소비 자제', '공동 투자 신중'],
    },
    career: {
      up: `직장·커리어의 기운이 상승, ${g}이(가) 도움을 줍니다.`,
      down: `직장 내 충돌·평가 변동이 예상 — 신중히.`,
      tipsUp: ['중요 발표·면접 밀어붙이기', '상사·협력자에 선물 인사'],
      tipsDown: ['말실수 주의', '문서·계약 이중 점검'],
    },
    love: {
      up: `애정 기운이 활발 — 인연·고백·화해에 좋음.`,
      down: `관계 균열 가능 — 자존심보단 배려.`,
      tipsUp: ['새 만남·데이트 시도', '상대 이야기 경청'],
      tipsDown: ['말 조심·감정 폭발 자제', '잠시 거리두기'],
    },
    health: {
      up: `심신 컨디션 안정 — 규칙적 리듬 유지.`,
      down: `과로·스트레스 주의 — 휴식 우선.`,
      tipsUp: ['운동·야외 활동 확대', '수면 패턴 유지'],
      tipsDown: ['무리한 야근 자제', '소화·호흡기 점검'],
    },
    study: {
      up: `학습·집중력 상승 — 시험·자격 준비에 유리.`,
      down: `집중이 흩어지는 시기 — 단기 목표에 집중.`,
      tipsUp: ['핵심 과목부터 집중 공략', '스터디 그룹 결성'],
      tipsDown: ['과목 분산 자제', '짧은 시간 반복 학습'],
    },
    relation: {
      up: `귀인 운기가 열려 — 인맥·협력·지지 관계가 순조롭습니다.`,
      down: `인간관계에 잡음이 끼는 시기 — 신뢰 관계부터 챙기세요.`,
      tipsUp: ['새 네트워크 확장 시도', '가까운 사람에게 먼저 연락'],
      tipsDown: ['험담·분쟁 거리두기', '중요 부탁은 타이밍 보고'],
    },
  };
  const block = byKey[key];
  return {
    summary: positive ? block.up : block.down,
    tips: positive ? block.tipsUp : block.tipsDown,
  };
}

function buildHeadline(target: TargetGanZhi, grade: FortuneGrade, scope: FortuneScope): string {
  const when = scope === 'year' ? '올해' : scope === 'day' ? '오늘' : '이 날';
  const toneMap: Record<FortuneGrade, string> = {
    '대길': `${when}은 크게 열리는 시기입니다`,
    '길': `${when}은 순풍이 불어옵니다`,
    '중길': `${when}은 잔잔히 흘러갑니다`,
    '평': `${when}은 담담한 하루·해가 됩니다`,
    '중흉': `${when}은 신중히 돌아갈 때입니다`,
    '흉': `${when}은 몸을 낮춰 지나가야 합니다`,
  };
  return `${toneMap[grade]} — ${target.tenGodGan}의 기운`;
}

// 오행 상극 — 극하는 쪽 → 극당하는 쪽
const EL_CONTROLS: Record<string, string> = {
  '목': '토', '토': '수', '수': '화', '화': '금', '금': '목',
};

// 오행 → 취약 장부 (전통 명리 기준)
const ELEMENT_TO_ORGAN: Record<string, string> = {
  '목': '간·담(눈·근육)',
  '화': '심장·소장(혈압·순환)',
  '토': '비장·위(소화기)',
  '금': '폐·대장(호흡기·피부)',
  '수': '신장·방광(요통·생식)',
};

/** SajuResult의 4주 십성에서 특정 십성이 존재하는지 체크 */
function hasTenGod(saju: SajuResult, target: string): boolean {
  const p = saju.pillars;
  return [
    p.year.tenGodGan, p.year.tenGodZhi,
    p.month.tenGodGan, p.month.tenGodZhi,
    p.day.tenGodZhi,
    p.hour.tenGodGan, p.hour.tenGodZhi,
  ].some(tg => tg === target);
}

/**
 * 주의점 생성 — 규칙 기반 지식베이스.
 * LLM 없이 결정적으로 산출. 너무 많으면 가독성 저하되어 상위 5개만 반환.
 *
 * 규칙은 임팩트 순으로 정렬:
 *   1) 지지 충·형 (어느 기둥에서 발생했나 세분)
 *   2) 기신 강림 + 오행 장부 경고
 *   3) 십성 특수 구조 (상관견관·겁재탈재·편관+신약 등)
 *   4) 병존·삼존 증폭
 *   5) 신강·신약 극단화
 */
function buildCautions(saju: SajuResult, target: TargetGanZhi, interactions: GanZhiInteraction[]): string[] {
  const out: string[] = [];

  // ── 1) 지지 충·형 — 기둥별 의미 차별화 ──────────────────────
  const byPillar = (label: string) => interactions.find(i => i.between.startsWith(label));

  const dayInter = byPillar('일지');
  if (dayInter?.nature === 'bad') {
    out.push(
      dayInter.kind === '육충'
        ? '일지 충 — 본인·배우자궁 흔들림. 이사·이직·관계 큰 변화 가능'
        : '일지 형 — 건강·사고·법적 시비 조심, 큰 결정은 한 달 미루기',
    );
  }

  const monthInter = byPillar('월지');
  if (monthInter?.nature === 'bad') {
    out.push(
      monthInter.kind === '육충'
        ? '월지 충 — 직업·사회적 환경 변동. 조직 이동·업무 재편 신호'
        : '월지 형 — 동료·상사와 갈등, 이직 타이밍은 신중히 판단',
    );
  }

  const yearInter = byPillar('년지');
  if (yearInter?.nature === 'bad') {
    out.push('년지 충·형 — 부모·조상·가문 관련 이슈. 부동산·가족 결정 재점검');
  }

  const hourInter = byPillar('시지');
  if (hourInter?.nature === 'bad' && !saju.hourUnknown) {
    out.push('시지 충·형 — 자녀·말년 계획 흔들림. 장기 목표 재설계 필요');
  }

  // ── 2) 기신 강림 + 오행 취약점 경고 ─────────────────────────
  if (saju.giSin && target.ganElement === STEM_ELEMENT[saju.giSin]) {
    out.push(`기신(${saju.giSin}·${target.ganElement}) 기운 강림 — 습관적·관성적 결정 위험, 검증 한 번 더`);
  }

  // 약한 오행이 target 오행에게 극(克)당하는 해 → 해당 장부 경고
  const weakEl = saju.weakElement;
  if (weakEl && target.ganElement && EL_CONTROLS[target.ganElement] === weakEl) {
    const organ = ELEMENT_TO_ORGAN[weakEl];
    if (organ) {
      out.push(`원국 약점(${weakEl})이 더 눌리는 구조 — ${organ} 건강 관리 특별 주의`);
    }
  }

  // ── 3) 십성 특수 구조 ────────────────────────────────────────
  if (target.tenGodGan === '상관') {
    const jungGwan = hasTenGod(saju, '정관');
    out.push(
      jungGwan
        ? '상관견관(傷官見官) — 직장·권위와 충돌 신호. 소송·상사 마찰·퇴사 충동 주의'
        : '상관의 해 — 말·표현 관련 구설, 계약서는 두 번 읽기',
    );
  }

  if (target.tenGodGan === '겁재') {
    const jeongJae = hasTenGod(saju, '정재');
    out.push(
      jeongJae
        ? '겁재탈재(劫財奪財) — 금전 사기·동업 이별 극도 경계. 보증·공동 투자 금지'
        : '겁재의 해 — 돈이 새는 해, 지출 관리와 친구 간 금전 거래 주의',
    );
  }

  if (target.tenGodGan === '편관' && !saju.isStrong) {
    out.push('편관 강림 + 신약 — 과로·스트레스·사고 최고 위험. 업무량·속도 줄이기');
  }

  if (target.tenGodGan === '편재') {
    const pyeonJaeCount = [
      saju.pillars.year.tenGodGan, saju.pillars.month.tenGodGan,
      saju.pillars.hour.tenGodGan,
    ].filter(t => t === '편재').length;
    if (pyeonJaeCount >= 2) {
      out.push('편재 다봉의 해 — 투자·사업 확장 유혹 강화, 여러 곳에 벌이기보다 한 곳 집중');
    }
  }

  if (target.tenGodGan === '편인') {
    const sikSin = hasTenGod(saju, '식신');
    if (sikSin) {
      out.push('식신도식(食神倒食) — 창작·진로 막힘, 새 시작보다 기존 흐름 지키기');
    }
  }

  // ── 4) 병존·삼존 + 같은 오행 강림 → 편향 극단화 ─────────────
  const byeongjOn = saju.byeongjOn || [];
  for (const b of byeongjOn) {
    if (STEM_ELEMENT[b.gan] === target.ganElement) {
      const label = b.isSamjon ? '삼존' : '병존';
      out.push(`${b.gan}(${b.element}) ${label} + 동일 오행 강림 — 기존 편향이 극단으로, 고집·과열 경계`);
      break;
    }
  }

  // ── 5) 신강·신약 극단화 ────────────────────────────────────
  if (saju.isStrong && target.tenGodGan === '비견') {
    out.push('신강 + 비견의 해 — 자아 과잉, 주변 의견 차단되기 쉬움. 협력자와 자주 대화');
  }
  if (!saju.isStrong && target.tenGodGan === '편관') {
    // 위 3)에서 이미 추가된 경우 중복 방지
  } else if (!saju.isStrong && target.ganElement && EL_CONTROLS[target.ganElement] === STEM_ELEMENT[saju.dayMaster]) {
    out.push('신약에 일간을 극하는 해 — 번아웃·무기력 경계, 쉼 없이 밀어붙이지 말기');
  }

  // Fallback
  if (out.length === 0) {
    out.push('특별한 흉조 없음 — 평소의 리듬 유지');
  }

  // 가독성 — 상위 5개만
  return out.slice(0, 5);
}

// ============================================
// 월별 흐름 (신년운세 전용)
// ============================================

export interface MonthlyFlowItem {
  month: number;
  grade: FortuneGrade;
  keyword: string;
  /** 0~100 운세 점수 (그래프 인터랙션·툴팁용) */
  score: number;
  gan: string;
  zhi: string;
  ganElement: string;
  zhiElement: string;
  tenGod: string;
  tenGodZhi: string;
  twelveStage: string;
  sinSal12: string;
}

export function buildMonthlyFlow(saju: SajuResult, year: number): MonthlyFlowItem[] {
  const result: MonthlyFlowItem[] = [];
  const yearZhi = saju.pillars.year.zhi;
  for (let m = 1; m <= 12; m++) {
    const mid = Solar.fromYmd(year, m, 15);
    const lunar = mid.getLunar();
    const monthGz = lunar.getMonthInGanZhi();
    const mGan = normalizeGan(monthGz[0]);
    const mZhi = normalizeZhi(monthGz[1]);
    const targetGan = TEN_GODS_MAP[saju.dayMaster]?.[mGan] ?? '';
    const ganElement = STEM_ELEMENT[mGan];
    const zhiElement = BRANCH_ELEMENT[mZhi] ?? '';

    let score = 70;
    score += TEN_GOD_SCORE[targetGan] ?? 0;
    if (ganElement === saju.yongSinElement) score += 10;
    const inter = checkBranchPair(saju.pillars.day.zhi, mZhi);
    if (inter?.nature === 'bad') score -= 3;
    else if (inter?.nature === 'good') score += 6;
    const clampedScore = Math.max(60, Math.min(95, score));
    const grade = gradeFromScore(clampedScore);
    const keyword =
      grade === '대길' ? '전진·도약'
      : grade === '길' ? '확장·기회'
      : grade === '중길' ? '축적·안정'
      : grade === '평' ? '유지·관찰'
      : grade === '중흉' ? '신중·보수'
      : '휴식·정비';
    result.push({
      month: m,
      grade,
      keyword,
      score: clampedScore,
      gan: mGan,
      zhi: mZhi,
      ganElement,
      zhiElement,
      tenGod: targetGan,
      tenGodZhi: getTenGodForBranch(saju.dayMaster, mZhi),
      twelveStage: getTwelveStage(saju.dayMaster, mZhi),
      sinSal12: getSinSal12(yearZhi, mZhi),
    });
  }
  return result;
}

// ============================================
// 메인
// ============================================

export function calculatePeriodFortune(
  saju: SajuResult,
  opts: { scope: FortuneScope; date?: string; year?: number },
): PeriodFortune {
  const dayGan = saju.dayMaster;
  let gan = '', zhi = '', ganZhi = '', lunarLabel = '', targetLabel = '', targetDate = '';

  if (opts.scope === 'year') {
    const year = opts.year ?? new Date().getFullYear();
    const gz = ganZhiForYear(year);
    gan = gz.gan; zhi = gz.zhi; ganZhi = gz.ganZhi;
    targetLabel = `${year}년`;
    targetDate = `${year}-01-01`;
    lunarLabel = `${ganZhi}년`;
  } else {
    const date = opts.date ?? new Date().toISOString().slice(0, 10);
    const gz = ganZhiForDate(date);
    const ref = opts.scope === 'day' ? gz.day : gz.month;
    gan = ref.gan; zhi = ref.zhi; ganZhi = ref.ganZhi;
    targetDate = date;
    targetLabel = opts.scope === 'day' ? date : `${date.slice(0, 7)}월`;
    lunarLabel = gz.lunarLabel;
  }

  const target: TargetGanZhi = {
    gan, zhi, ganZhi,
    ganElement: STEM_ELEMENT[gan] ?? '',
    zhiElement: BRANCH_ELEMENT[zhi] ?? '',
    tenGodGan: TEN_GODS_MAP[dayGan]?.[gan] ?? '',
    tenGodZhi: (() => {
      const main = BRANCH_HIDDEN_STEMS[zhi]?.[0];
      return main ? TEN_GODS_MAP[dayGan]?.[main] ?? '' : '';
    })(),
    hiddenStems: BRANCH_HIDDEN_STEMS[zhi] ?? [],
  };

  const { overall, domains } = scoreForTarget(saju, target);
  const overallGrade = gradeFromScore(overall);

  // 원국 4지지와 대상 지지 상호작용
  const interactions: GanZhiInteraction[] = [];
  (['year', 'month', 'day', 'hour'] as const).forEach(k => {
    const z = saju.pillars[k].zhi;
    if (!z) return;
    const inter = checkBranchPair(z, target.zhi);
    if (inter) {
      interactions.push({
        ...inter,
        between: `${k === 'year' ? '년지' : k === 'month' ? '월지' : k === 'day' ? '일지' : '시지'}(${z}) × 대상지(${target.zhi})`,
      });
    }
  });

  const domainList: FortuneDomain[] = (['overall', 'wealth', 'career', 'love', 'health', 'relation', 'study'] as const).map(key => {
    const score = domains[key];
    const grade = gradeFromScore(score);
    const { summary, tips } = buildDomainSummary(key, grade, target);
    return {
      key,
      label: { overall: '총운', wealth: '재물운', career: '직장·사업운', love: '연애·결혼운', health: '건강운', relation: '인간관계운', study: '학업·시험운' }[key],
      score,
      grade,
      summary,
      tips,
    };
  });

  const luckyEl = saju.yongSinElement || target.ganElement;
  const monthlyFlow = opts.scope === 'year' ? buildMonthlyFlow(saju, opts.year ?? new Date().getFullYear()) : undefined;

  const headline = buildHeadline(target, overallGrade, opts.scope);
  const summary =
    overallGrade === '대길' || overallGrade === '길'
      ? `${target.ganZhi}의 기운이 일간 ${dayGan}에 ${target.tenGodGan}으로 작용하며 흐름을 밀어줍니다. ${luckyEl} 기운을 활용해 기회를 잡을 때입니다.`
      : overallGrade === '중길' || overallGrade === '평'
      ? `${target.ganZhi}의 기운은 일간 ${dayGan}과 큰 굴곡 없이 흐릅니다. 작은 기회를 놓치지 말고 꾸준함을 유지하세요.`
      : `${target.ganZhi}의 기운이 일간 ${dayGan}과 부딪히는 부분이 있어 무리한 행동은 피해야 합니다. 내실을 다지는 시기로 활용하세요.`;

  const isDaily = opts.scope === 'day';
  const daily = isDaily ? calcDailyLucky(saju, target) : null;

  return {
    scope: opts.scope,
    targetLabel,
    targetDate,
    lunarLabel,
    targetGanZhi: target,
    overallScore: overall,
    overallGrade,
    headline,
    summary,
    domains: domainList,
    interactions,
    luckyColors: daily?.colors ?? ELEMENT_COLORS[luckyEl] ?? ELEMENT_COLORS['목'],
    luckyNumbers: daily?.numbers ?? ELEMENT_NUMBERS[luckyEl] ?? [3, 8],
    luckyDirection: daily?.direction ?? ELEMENT_DIRECTIONS[luckyEl] ?? '동쪽',
    luckyTime: daily?.time ?? ELEMENT_TIMES[luckyEl] ?? '오전',
    luckyGem: daily?.gem,
    luckyActivity: daily?.activity,
    cautions: buildCautions(saju, target, interactions),
    monthlyFlow,
  };
}
