import { Solar } from 'lunar-javascript';

// ============================================
// 기본 상수 정의
// ============================================

// 천간 (10 Heavenly Stems)
export const HEAVENLY_STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
// 지지 (12 Earthly Branches)
export const EARTHLY_BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];

// ============================================
// 한자(lunar-javascript 반환) → 한글 정규화
// lunar-javascript는 천간/지지를 중국 한자(甲乙…癸 / 子丑…亥)로 반환하지만
// 본 계산 모듈의 모든 맵(TEN_GODS_MAP, STEM_ELEMENT 등)은 한글 키를 사용한다.
// 데이터가 들어오는 경계에서 반드시 한글로 정규화해야 모든 매핑이 정상 동작한다.
// ============================================
const HANJA_STEM_TO_HANGUL: Record<string, string> = {
  '甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무',
  '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계'
};
const HANJA_BRANCH_TO_HANGUL: Record<string, string> = {
  '子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진', '巳': '사',
  '午': '오', '未': '미', '申': '신', '酉': '유', '戌': '술', '亥': '해'
};
/** 천간 문자(한자·한글 무관) → 한글 */
export const normalizeGan = (g: string): string => {
  if (!g) return '';
  if (HEAVENLY_STEMS.includes(g)) return g;
  return HANJA_STEM_TO_HANGUL[g] || '';
};
/** 지지 문자(한자·한글 무관) → 한글 */
export const normalizeZhi = (z: string): string => {
  if (!z) return '';
  if (EARTHLY_BRANCHES.includes(z)) return z;
  return HANJA_BRANCH_TO_HANGUL[z] || '';
};

// 오행
export const FIVE_ELEMENTS = {
  wood: '목', fire: '화', earth: '토', metal: '금', water: '수'
};

// 천간의 오행
export const STEM_ELEMENT: Record<string, string> = {
  '갑': '목', '을': '목',
  '병': '화', '정': '화',
  '무': '토', '기': '토',
  '경': '금', '신': '금',
  '임': '수', '계': '수'
};

// 천간의 음양
export const STEM_YINYANG: Record<string, string> = {
  '갑': '양', '을': '음',
  '병': '양', '정': '음',
  '무': '양', '기': '음',
  '경': '양', '신': '음',
  '임': '양', '계': '음'
};

// 지지의 오행
export const BRANCH_ELEMENT: Record<string, string> = {
  '자': '수', '축': '토', '인': '목', '묘': '목',
  '진': '토', '사': '화', '오': '화', '미': '토',
  '신': '금', '유': '금', '술': '토', '해': '수'
};

// 지지의 음양
export const BRANCH_YINYANG: Record<string, string> = {
  '자': '양', '축': '음', '인': '양', '묘': '음',
  '진': '양', '사': '음', '오': '양', '미': '음',
  '신': '양', '유': '음', '술': '양', '해': '음'
};

// 지장간 (지지 속에 숨은 천간)
export const BRANCH_HIDDEN_STEMS: Record<string, string[]> = {
  '자': ['계'],
  '축': ['기', '신', '계'],
  '인': ['갑', '병', '무'],
  '묘': ['을'],
  '진': ['무', '을', '계'],
  '사': ['병', '경', '무'],
  '오': ['정', '기'],
  '미': ['기', '정', '을'],
  '신': ['경', '임', '무'],
  '유': ['신'],
  '술': ['무', '신', '정'],
  '해': ['임', '갑']
};

// 십성 (Ten Gods) 계산
export const TEN_GODS_MAP: Record<string, Record<string, string>> = {
  '갑': { '갑': '비견', '을': '겁재', '병': '식신', '정': '상관', '무': '편재', '기': '정재', '경': '편관', '신': '정관', '임': '편인', '계': '정인' },
  '을': { '을': '비견', '갑': '겁재', '정': '식신', '병': '상관', '기': '편재', '무': '정재', '신': '편관', '경': '정관', '계': '편인', '임': '정인' },
  '병': { '병': '비견', '정': '겁재', '무': '식신', '기': '상관', '경': '편재', '신': '정재', '임': '편관', '계': '정관', '갑': '편인', '을': '정인' },
  '정': { '정': '비견', '병': '겁재', '기': '식신', '무': '상관', '신': '편재', '경': '정재', '계': '편관', '임': '정관', '을': '편인', '갑': '정인' },
  '무': { '무': '비견', '기': '겁재', '경': '식신', '신': '상관', '임': '편재', '계': '정재', '갑': '편관', '을': '정관', '병': '편인', '정': '정인' },
  '기': { '기': '비견', '무': '겁재', '신': '식신', '경': '상관', '계': '편재', '임': '정재', '을': '편관', '갑': '정관', '정': '편인', '병': '정인' },
  '경': { '경': '비견', '신': '겁재', '임': '식신', '계': '상관', '갑': '편재', '을': '정재', '병': '편관', '정': '정관', '무': '편인', '기': '정인' },
  '신': { '신': '비견', '경': '겁재', '계': '식신', '임': '상관', '을': '편재', '갑': '정재', '정': '편관', '병': '정관', '기': '편인', '무': '정인' },
  '임': { '임': '비견', '계': '겁재', '갑': '식신', '을': '상관', '병': '편재', '정': '정재', '무': '편관', '기': '정관', '경': '편인', '신': '정인' },
  '계': { '계': '비견', '임': '겁재', '을': '식신', '갑': '상관', '정': '편재', '병': '정재', '기': '편관', '무': '정관', '신': '편인', '경': '정인' }
};

// 12운성 명칭
export const TWELVE_STAGE_NAMES = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'];

// ============================================
// 타입 정의
// ============================================

export interface Pillar {
  gan: string;
  zhi: string;
  ganElement: string;
  zhiElement: string;
  ganYinYang: string;
  zhiYinYang: string;
  hiddenStems: string[];
  tenGodGan: string;
  tenGodZhi: string;
  twelveStage: string;
  /** 12신살 (년지 삼합 기준) — 겁살/재살/천살/지살/도화/월살/망신/장성/반안/역마/육해/화개 */
  sinSal12: string;
  /** 일주 기준 공망 여부 */
  isKongmang: boolean;
}

export interface ElementCount {
  목: number;
  화: number;
  토: number;
  금: number;
  수: number;
}

export interface SinSal {
  name: string;
  type: 'good' | 'bad' | 'neutral';
  description: string;
  /**
   * 신살이 걸린 기둥 인덱스 (표시 순서 기준: 0=시, 1=일, 2=월, 3=년)
   * - 지지를 기반으로 발동한 신살은 해당 지지가 위치한 기둥을 기록
   * - 조합형(삼형 등)은 관여한 모든 기둥을 기록
   */
  pillars: number[];
}

export interface Interaction {
  type: '합' | '충' | '형' | '파' | '해';
  elements: string[];
  description: string;
}

/** 간여지동(干與支同) — 천간과 지지의 오행이 동일한 기둥 */
export interface GanYeojidong {
  pillar: 'year' | 'month' | 'day' | 'hour';
  gan: string;
  zhi: string;
  element: string;
}

/** 병존(竝存) / 삼존(三存) — 같은 천간이 2개(병존) 또는 3개 이상(삼존) */
export interface ByeongjOn {
  gan: string;
  element: string;
  count: number;
  positions: string[];
  isSamjon: boolean;
}

export interface DaeWoon {
  startAge: number;
  endAge: number;
  gan: string;
  zhi: string;
  ganElement: string;
  zhiElement: string;
  tenGod: string;
  tenGodZhi: string;
  twelveStage: string;
  sinSal12: string;
}

export interface SeWoon {
  year: number;
  gan: string;
  zhi: string;
  ganElement: string;
  zhiElement: string;
  tenGod: string;
  tenGodZhi: string;
  twelveStage: string;
  sinSal12: string;
  animal: string;
}

export interface SajuResult {
  solarDate: string;
  lunarDate: string;
  lunarDateSimple: string;
  isLeapMonth: boolean;
  gender: 'male' | 'female';
  /**
   * 출생 시간을 모를 때 true.
   * - 시주(pillars.hour)는 빈 값("?")으로 세팅되어 화면에 "시간 미상"으로 표시됨.
   * - 모든 하위 계산(오행·십성·신살·합충)은 시주를 제외하고 삼주추명으로 진행됨.
   * - AI 프롬프트에도 플래그로 전달되어 자녀·말년·시간대 관련 해석이 제한됨.
   */
  hourUnknown: boolean;
  pillars: {
    year: Pillar;
    month: Pillar;
    day: Pillar;
    hour: Pillar;
  };
  dayMaster: string;
  dayMasterElement: string;
  dayMasterYinYang: string;
  elementCount: ElementCount;
  elementPercent: ElementCount;
  strongElement: string;
  weakElement: string;
  isStrong: boolean;
  strengthScore: number;
  strengthAnalysis: string;
  strengthStatus: StrengthStatus;
  deukRyeong: boolean;
  deukJi: boolean;
  deukSe: boolean;
  strengthDetail: StrengthDetail;
  yongSin: string;
  heeSin: string;
  giSin: string;
  yongSinElement: string;
  interactions: Interaction[];
  sinSals: SinSal[];
  ganYeojidong: GanYeojidong[];
  byeongjOn: ByeongjOn[];
  daeWoon: DaeWoon[];
  daeWoonStartAge: number;
  seWoon: SeWoon[];
  currentSeWoon: SeWoon;
}

// ============================================
// 계산 함수들
// ============================================

const getTenGod = (dayGan: string, targetGan: string): string => {
  return TEN_GODS_MAP[dayGan]?.[targetGan] || '';
};

export const getTenGodForBranch = (dayGan: string, branch: string): string => {
  const mainStem = BRANCH_HIDDEN_STEMS[branch]?.[0];
  if (!mainStem) return '';
  return getTenGod(dayGan, mainStem);
};

export const getTwelveStage = (dayGan: string, branch: string): string => {
  const branchIndex = EARTHLY_BRANCHES.indexOf(branch);
  if (branchIndex === -1) return '';

  const isYang = STEM_YINYANG[dayGan] === '양';
  const element = STEM_ELEMENT[dayGan];

  // 음양이행(전통): 양간은 亥·寅·巳·申에서 장생 순행, 음간은 午·酉·子·卯에서 장생 역행
  const yangStartPos: Record<string, number> = {
    '목': 11, '화': 2, '토': 2, '금': 5, '수': 8
  };
  const yinStartPos: Record<string, number> = {
    '목': 6, '화': 9, '토': 9, '금': 0, '수': 3
  };

  if (isYang) {
    const startPos = yangStartPos[element] ?? 0;
    const idx = (branchIndex - startPos + 12) % 12;
    return TWELVE_STAGE_NAMES[idx];
  } else {
    const startPos = yinStartPos[element] ?? 0;
    const idx = (startPos - branchIndex + 12) % 12;
    return TWELVE_STAGE_NAMES[idx];
  }
};

const countElements = (pillars: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar }): ElementCount => {
  const count: ElementCount = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const allPillars = [pillars.year, pillars.month, pillars.day, pillars.hour];

  allPillars.forEach(pillar => {
    const ganEl = pillar.ganElement as keyof ElementCount;
    if (ganEl) count[ganEl] += 1;

    const zhiEl = pillar.zhiElement as keyof ElementCount;
    if (zhiEl) count[zhiEl] += 1;

    pillar.hiddenStems.forEach((stem, idx) => {
      const hiddenEl = STEM_ELEMENT[stem] as keyof ElementCount;
      if (hiddenEl) {
        count[hiddenEl] += idx === 0 ? 0.5 : 0.25;
      }
    });
  });

  return count;
};

const getHelpingElements = (element: string): string[] => {
  const helping: Record<string, string[]> = {
    '목': ['목', '수'], '화': ['화', '목'], '토': ['토', '화'], '금': ['금', '토'], '수': ['수', '금']
  };
  return helping[element] || [];
};

const getControllingElement = (element: string): string => {
  const controlling: Record<string, string> = {
    '목': '금', '화': '수', '토': '목', '금': '화', '수': '토'
  };
  return controlling[element] || '';
};

// 오행 상생/상극
const ELEMENT_GENERATES: Record<string, string> = {
  '목': '화', '화': '토', '토': '금', '금': '수', '수': '목'
};
const ELEMENT_CONTROLS: Record<string, string> = {
  '목': '토', '화': '금', '토': '수', '금': '목', '수': '화'
};

type SipseongGroup = '비겁' | '인성' | '식상' | '재성' | '관성';

// 일간 오행 대비 대상 오행 → 십성 그룹
const classifySipseongGroup = (dayEl: string, targetEl: string): SipseongGroup => {
  if (!dayEl || !targetEl) return '비겁';
  if (targetEl === dayEl) return '비겁';
  if (ELEMENT_GENERATES[targetEl] === dayEl) return '인성';   // 대상이 일간을 생
  if (ELEMENT_GENERATES[dayEl] === targetEl) return '식상';   // 일간이 대상을 생
  if (ELEMENT_CONTROLS[dayEl] === targetEl) return '재성';    // 일간이 대상을 극
  return '관성';                                               // 대상이 일간을 극
};

// 12운성별 점수 (지지가 일간에게 제공하는 기반 점수)
const STAGE_POINTS: Record<string, number> = {
  '장생': 12, '목욕': 8, '관대': 12, '건록': 18, '제왕': 20,
  '쇠': 8, '병': 4, '사': 2, '묘': 8, '절': 0, '태': 2, '양': 6
};

// 지장간 가중치: 정기/중기/여기
const HIDDEN_STEM_WEIGHTS = [0.6, 0.3, 0.1];

export interface StrengthDetail {
  bijeopScore: number;
  inseongScore: number;
  sikSangPenalty: number;
  jaeseongPenalty: number;
  gwanseongPenalty: number;
  supportTotal: number;
  weakenTotal: number;
}

export type StrengthStatus = '매우 신강' | '신강' | '중화' | '신약' | '매우 신약';

const analyzeStrength = (
  dayGan: string,
  monthBranch: string,
  pillars: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar }
): {
  isStrong: boolean;
  score: number;
  status: StrengthStatus;
  analysis: string;
  deukRyeong: boolean;
  deukJi: boolean;
  deukSe: boolean;
  detail: StrengthDetail;
} => {
  const dayEl = STEM_ELEMENT[dayGan] || '';

  // 십성 그룹별 원점수 집계
  const scores: Record<SipseongGroup, number> = {
    '비겁': 0, '인성': 0, '식상': 0, '재성': 0, '관성': 0
  };

  // 1) 천간 가산 — 월간 10점 / 년·시간 각 7점 (일간 제외)
  const stemInputs: Array<[string, number]> = [
    [pillars.year.gan, 7],
    [pillars.month.gan, 10],
    [pillars.hour.gan, 7]
  ];
  stemInputs.forEach(([stem, weight]) => {
    if (!stem) return;
    const el = STEM_ELEMENT[stem];
    if (!el) return;
    scores[classifySipseongGroup(dayEl, el)] += weight;
  });

  // 2) 지지 — 12운성 기반 점수를 지장간 비율(6:3:1)로 분배, 각 지장간의 오행으로 십성 분류
  const branchList = [pillars.year.zhi, pillars.month.zhi, pillars.day.zhi, pillars.hour.zhi];
  branchList.forEach(branch => {
    if (!branch) return;
    const stage = getTwelveStage(dayGan, branch);
    const base = STAGE_POINTS[stage] ?? 0;
    const hidden = BRANCH_HIDDEN_STEMS[branch] || [];
    hidden.forEach((stem, idx) => {
      const w = HIDDEN_STEM_WEIGHTS[idx] ?? 0;
      const el = STEM_ELEMENT[stem];
      if (!el || w === 0 || base === 0) return;
      scores[classifySipseongGroup(dayEl, el)] += base * w;
    });
  });

  // 3) 득령(得令) — 월지 정기가 일간과 같은 오행이거나 일간을 생하면 +20 보너스
  const monthMainStem = BRANCH_HIDDEN_STEMS[monthBranch]?.[0];
  const monthMainEl = monthMainStem ? STEM_ELEMENT[monthMainStem] : '';
  const deukRyeong = !!monthMainEl && (
    monthMainEl === dayEl || ELEMENT_GENERATES[monthMainEl] === dayEl
  );
  const deukRyeongBonus = deukRyeong ? 20 : 0;

  // 4) 득지(得地) — 일지가 일간을 돕는 오행(비겁 or 인성)이면 true
  const dayBranchEl = pillars.day.zhiElement;
  const deukJi = !!dayBranchEl && (
    dayBranchEl === dayEl || ELEMENT_GENERATES[dayBranchEl] === dayEl
  );

  const bijeopScore = Math.round(scores['비겁'] * 10) / 10;
  const inseongScore = Math.round(scores['인성'] * 10) / 10;
  const sikSangPenalty = Math.round(scores['식상'] * 10) / 10;
  const jaeseongPenalty = Math.round(scores['재성'] * 10) / 10;
  const gwanseongPenalty = Math.round(scores['관성'] * 10) / 10;

  const supportTotal = Math.round((bijeopScore + inseongScore + deukRyeongBonus) * 10) / 10;
  const weakenTotal = Math.round((sikSangPenalty + jaeseongPenalty + gwanseongPenalty) * 10) / 10;

  // 5) 득세(得勢) — 강화점수 ≥ 약화점수
  const deukSe = supportTotal >= weakenTotal;

  // 6) 정규화 점수 0~100
  const denom = supportTotal + weakenTotal;
  const score = denom > 0 ? Math.round((supportTotal / denom) * 100) : 50;

  // 7) 5단계 판정
  let status: StrengthStatus;
  if (score >= 70) status = '매우 신강';
  else if (score >= 60) status = '신강';
  else if (score >= 45) status = '중화';
  else if (score >= 35) status = '신약';
  else status = '매우 신약';

  const isStrong = score >= 60;

  const trio = [deukRyeong && '득령', deukJi && '득지', deukSe && '득세'].filter(Boolean).join('·') || '삼자(득령·득지·득세) 모두 미성립';
  let analysis = '';
  if (status === '매우 신강') {
    analysis = `매우 강한 신강 사주입니다(${trio}). 기운이 넘쳐 관성이나 식상으로 설기·제어가 필요합니다.`;
  } else if (status === '신강') {
    analysis = `신강 사주입니다(${trio}). 적절한 발산과 재·관의 조화가 필요합니다.`;
  } else if (status === '중화') {
    analysis = `중화된 사주입니다(${trio}). 오행 균형이 비교적 잘 잡혀 있어 상황에 맞춘 용신 운용이 유리합니다.`;
  } else if (status === '신약') {
    analysis = `신약 사주입니다(${trio}). 인성·비겁의 도움이 필요합니다.`;
  } else {
    analysis = `매우 약한 신약 사주입니다(${trio}). 인성과 비겁의 도움이 절실합니다.`;
  }

  return {
    isStrong,
    score,
    status,
    analysis,
    deukRyeong,
    deukJi,
    deukSe,
    detail: {
      bijeopScore,
      inseongScore,
      sikSangPenalty,
      jaeseongPenalty,
      gwanseongPenalty,
      supportTotal,
      weakenTotal
    }
  };
};

const determineYongSin = (
  dayElement: string,
  isStrong: boolean,
  elementCount: ElementCount,
  _monthBranch: string,
  strengthScore: number
): { yongSin: string; heeSin: string; giSin: string; element: string } => {
  // 오행 관계 테이블
  const GEN: Record<string, string>  = { '목': '화', '화': '토', '토': '금', '금': '수', '수': '목' };
  const CTRL: Record<string, string> = { '목': '토', '화': '금', '토': '수', '금': '목', '수': '화' };
  const PAR: Record<string, string>  = { '목': '수', '화': '목', '토': '화', '금': '토', '수': '금' };
  const BY: Record<string, string>   = { '목': '금', '화': '수', '토': '목', '금': '화', '수': '토' };

  const total = (Object.values(elementCount) as number[]).reduce((a, b) => a + b, 0);

  // ── 전왕법(專旺法) ─────────────────────────────────────────────
  // 극신강(85↑): 비겁+인성이 원국의 65% 이상 → 종강격, 일간 오행이 용신
  if (isStrong && strengthScore >= 85 && total > 0) {
    const bigyeop = (elementCount[dayElement as keyof ElementCount] || 0);
    const inseong = (elementCount[PAR[dayElement] as keyof ElementCount] || 0);
    if ((bigyeop + inseong) / total >= 0.65) {
      return {
        yongSin: '비견/겁재',
        heeSin: '편인/정인',
        giSin: '편관/정관',
        element: dayElement,
      };
    }
  }

  // 극신약(15↓): 일간 외 단일 오행이 65% 이상 → 종격, 그 오행이 용신
  if (!isStrong && strengthScore <= 15 && total > 0) {
    const others = (Object.entries(elementCount) as [string, number][])
      .filter(([el]) => el !== dayElement)
      .sort((a, b) => b[1] - a[1]);
    if (others.length > 0 && others[0][1] / total >= 0.65) {
      const domEl = others[0][0];
      if (domEl === GEN[dayElement]) {
        // 종아격(從兒格): 식상 압도
        return { yongSin: '식신/상관', heeSin: '편재/정재', giSin: '비견/겁재', element: domEl };
      }
      if (domEl === CTRL[dayElement]) {
        // 종재격(從財格): 재성 압도
        return { yongSin: '편재/정재', heeSin: '식신/상관', giSin: '비견/겁재', element: domEl };
      }
      if (domEl === BY[dayElement]) {
        // 종살격(從殺格): 관살 압도
        return { yongSin: '편관/정관', heeSin: '편재/정재', giSin: '편인/정인', element: domEl };
      }
    }
  }

  // ── 억부법(抑扶法) — 일반 케이스 ────────────────────────────────
  if (isStrong) {
    return {
      yongSin: '식신/상관',
      heeSin: '편재/정재',
      giSin: '편인/정인',
      element: GEN[dayElement],
    };
  } else {
    return {
      yongSin: '편인/정인',
      heeSin: '비견/겁재',
      giSin: '편관/정관',
      element: PAR[dayElement],
    };
  }
};

const calculateSinSals = (
  dayGan: string,
  pillars: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar }
): SinSal[] => {
  const sinSals: SinSal[] = [];
  const branches: Array<{ zhi: string; col: number }> = [
    { zhi: pillars.year.zhi, col: 3 },
    { zhi: pillars.month.zhi, col: 2 },
    { zhi: pillars.day.zhi, col: 1 },
    { zhi: pillars.hour.zhi, col: 0 },
  ];
  const stems: Array<{ gan: string; col: number }> = [
    { gan: pillars.year.gan, col: 3 },
    { gan: pillars.month.gan, col: 2 },
    { gan: pillars.day.gan, col: 1 },
    { gan: pillars.hour.gan, col: 0 },
  ];
  const findCols = (target: string): number[] =>
    branches.filter(b => b.zhi === target).map(b => b.col);
  const yearBranch = pillars.year.zhi;
  const dayBranch = pillars.day.zhi;

  // ── 길성 (貴人) ──

  // 천을귀인 (天乙貴人) — 일간 기준
  const tianYiGuiRen: Record<string, string[]> = {
    '갑': ['축', '미'], '을': ['자', '신'], '병': ['해', '유'], '정': ['해', '유'],
    '무': ['축', '미'], '기': ['자', '신'], '경': ['축', '미'], '신': ['인', '오'],
    '임': ['묘', '사'], '계': ['묘', '사'],
  };
  const guiRenBranches = tianYiGuiRen[dayGan] || [];
  const guiRenCols = branches.filter(b => guiRenBranches.includes(b.zhi)).map(b => b.col);
  if (guiRenCols.length > 0) {
    sinSals.push({ name: '천을귀인', type: 'good', description: '위기에 귀인 도움, 최고의 길성', pillars: guiRenCols });
  }

  // 태극귀인 (太極貴人) — 일간의 장생지 + 건록지
  const taegeukGuiIn: Record<string, string[]> = {
    '갑': ['인', '해'], '을': ['신', '해'],
    '병': ['사', '인'], '정': ['해', '인'],
    '무': ['사', '인'], '기': ['해', '인'],
    '경': ['신', '사'], '신': ['인', '사'],
    '임': ['해', '신'], '계': ['사', '신'],
  };
  const tgCols = branches.filter(b => (taegeukGuiIn[dayGan] || []).includes(b.zhi)).map(b => b.col);
  if (tgCols.length > 0) {
    sinSals.push({ name: '태극귀인', type: 'good', description: '위기를 기회로, 큰 변화 속 행운', pillars: tgCols });
  }

  // 천복귀인 (天福貴人) — 일간의 합 상대 건록지
  const cheonbokGuiIn: Record<string, string> = {
    '갑': '오', '을': '신', '병': '유', '정': '해', '무': '자',
    '기': '인', '경': '묘', '신': '사', '임': '오', '계': '사',
  };
  const cbCols = findCols(cheonbokGuiIn[dayGan] || '');
  if (cbCols.length > 0) {
    sinSals.push({ name: '천복귀인', type: 'good', description: '하늘이 내린 복덕, 의식주 풍족', pillars: cbCols });
  }

  // 문곡귀인 (文曲貴人) — 일간 기준
  const mungokGuiIn: Record<string, string> = {
    '갑': '인', '기': '인', '을': '사', '경': '사',
    '병': '신', '신': '신', '정': '해', '임': '해',
    '무': '유', '계': '유',
  };
  const mgCols = findCols(mungokGuiIn[dayGan] || '');
  if (mgCols.length > 0) {
    sinSals.push({ name: '문곡귀인', type: 'good', description: '학문·문서에 뛰어난 재능, 시험운', pillars: mgCols });
  }

  // 학당귀인 (學堂貴人) — 일간 오행의 장생지
  const hakdang: Record<string, string> = {
    '갑': '해', '을': '오', '병': '인', '정': '유',
    '무': '인', '기': '유', '경': '사', '신': '자',
    '임': '신', '계': '묘',
  };
  const hdCols = findCols(hakdang[dayGan] || '');
  if (hdCols.length > 0) {
    sinSals.push({ name: '학당귀인', type: 'good', description: '학업과 지적 활동에 유리한 재능', pillars: hdCols });
  }

  // 금여록 (金輿祿) — 일간 기준, 배우자복
  const geumYeo: Record<string, string> = {
    '갑': '진', '을': '사', '병': '미', '정': '신',
    '무': '미', '기': '신', '경': '술', '신': '해',
    '임': '축', '계': '인',
  };
  const gyCols = findCols(geumYeo[dayGan] || '');
  if (gyCols.length > 0) {
    sinSals.push({ name: '금여록', type: 'good', description: '배우자복이 좋고 물질적 풍요', pillars: gyCols });
  }

  // 천의성 (天醫星) — 월지 기준
  const cheonUi: Record<string, string> = {
    '자': '해', '축': '자', '인': '축', '묘': '인',
    '진': '묘', '사': '진', '오': '사', '미': '오',
    '신': '미', '유': '신', '술': '유', '해': '술',
  };
  const cuCols = findCols(cheonUi[pillars.month.zhi] || '');
  if (cuCols.length > 0) {
    sinSals.push({ name: '천의성', type: 'good', description: '의학·치유 재능, 건강 회복력', pillars: cuCols });
  }

  // 천덕귀인 (天德貴人) — 월지 기준 천간
  const cheondukMap: Record<string, string> = {
    '인': '정', '묘': '신', '진': '임', '사': '경',
    '오': '해', '미': '갑', '신': '계', '유': '임',
    '술': '병', '해': '을', '자': '기', '축': '경',
  };
  const cdGan = cheondukMap[pillars.month.zhi];
  if (cdGan) {
    const cdCols = stems.filter(s => s.gan === cdGan).map(s => s.col);
    if (cdCols.length > 0) {
      sinSals.push({ name: '천덕귀인', type: 'good', description: '하늘의 덕, 흉을 길로 돌림', pillars: cdCols });
    }
  }

  // 월덕귀인 (月德貴人) — 월지 기준 천간
  const woldukMap: Record<string, string> = {
    '인': '병', '오': '병', '술': '병',
    '사': '임', '유': '임', '축': '임',
    '신': '임', '자': '임', '진': '임',
    '해': '갑', '묘': '갑', '미': '갑',
  };
  const wdGan = woldukMap[pillars.month.zhi];
  if (wdGan) {
    const wdCols = stems.filter(s => s.gan === wdGan).map(s => s.col);
    if (wdCols.length > 0) {
      sinSals.push({ name: '월덕귀인', type: 'good', description: '월덕의 은혜, 관재·질병 해소', pillars: wdCols });
    }
  }

  // ── 살 (殺) ──

  // 역마살 (驛馬殺) — 년지 + 일지 기준
  const yeokMa: Record<string, string> = {
    '인': '신', '오': '신', '술': '신',
    '사': '해', '유': '해', '축': '해',
    '신': '인', '자': '인', '진': '인',
    '해': '사', '묘': '사', '미': '사',
  };
  const addYeokMa = (refBranch: string) => {
    const target = yeokMa[refBranch];
    if (!target) return;
    const cols = findCols(target);
    if (cols.length > 0 && !sinSals.some(s => s.name === '역마살' && s.pillars.some(c => cols.includes(c)))) {
      sinSals.push({ name: '역마살', type: 'neutral', description: '이동·해외 여행·무역 기회', pillars: cols });
    }
  };
  addYeokMa(yearBranch);
  addYeokMa(dayBranch);

  // 도화살 (桃花殺) — 년지 + 일지 기준
  const doHwa: Record<string, string> = {
    '인': '묘', '오': '묘', '술': '묘',
    '사': '오', '유': '오', '축': '오',
    '신': '유', '자': '유', '진': '유',
    '해': '자', '묘': '자', '미': '자',
  };
  const doHwaAdded = new Set<number>();
  const addDoHwa = (refBranch: string) => {
    const target = doHwa[refBranch];
    if (!target) return;
    const cols = findCols(target).filter(c => !doHwaAdded.has(c));
    if (cols.length > 0) {
      cols.forEach(c => doHwaAdded.add(c));
      sinSals.push({ name: '도화살', type: 'neutral', description: '인기·매력, 연예·예술·대인관계', pillars: cols });
    }
  };
  addDoHwa(yearBranch);
  addDoHwa(dayBranch);

  // 화개살 (華蓋殺) — 년지 + 일지 기준
  const hwaGae: Record<string, string> = {
    '인': '술', '오': '술', '술': '술',
    '사': '축', '유': '축', '축': '축',
    '신': '진', '자': '진', '진': '진',
    '해': '미', '묘': '미', '미': '미',
  };
  const hgAdded = new Set<number>();
  const addHwaGae = (refBranch: string) => {
    const target = hwaGae[refBranch];
    if (!target) return;
    const cols = findCols(target).filter(c => !hgAdded.has(c));
    if (cols.length > 0) {
      cols.forEach(c => hgAdded.add(c));
      sinSals.push({ name: '화개살', type: 'neutral', description: '종교·학문·예술 재능, 고독한 탐구자', pillars: cols });
    }
  };
  addHwaGae(yearBranch);
  addHwaGae(dayBranch);

  // 홍염살 (紅艶殺) — 일간 기준
  const hongYeom: Record<string, string> = {
    '갑': '오', '을': '신', '병': '인', '정': '미',
    '무': '진', '기': '진', '경': '술', '신': '유',
    '임': '자', '계': '신',
  };
  const hyCols = findCols(hongYeom[dayGan] || '');
  if (hyCols.length > 0) {
    sinSals.push({ name: '홍염살', type: 'neutral', description: '강한 이성 매력, 연애/결혼에 영향', pillars: hyCols });
  }

  // 현침살 (懸針殺) — 천간 형태(甲/辛/壬/癸) + 일간 기준 지지 (일간 자신 제외)
  const hyeonchimSet = new Set(['갑', '신', '임', '계']);
  const hcStemCols = stems.filter(s => hyeonchimSet.has(s.gan) && s.col !== 1).map(s => s.col);
  const hyeonchimZhi: Record<string, string> = {
    '갑': '유', '을': '신', '병': '사', '정': '해',
    '무': '유', '기': '신', '경': '사', '신': '해',
    '임': '유', '계': '미',
  };
  const hcZhiCols = findCols(hyeonchimZhi[dayGan] || '');
  const hcAllCols = [...new Set([...hcStemCols, ...hcZhiCols])];
  if (hcAllCols.length > 0) {
    sinSals.push({ name: '현침살', type: 'neutral', description: '날카로운 지성·분석력, 예민한 감수성', pillars: hcAllCols });
  }

  // 양인살 (羊刃殺) — 일간 기준
  const yangIn: Record<string, string> = {
    '갑': '묘', '을': '인', '병': '오', '정': '사',
    '무': '오', '기': '사', '경': '유', '신': '신',
    '임': '자', '계': '해',
  };
  const yiCols = findCols(yangIn[dayGan] || '');
  if (yiCols.length > 0) {
    sinSals.push({ name: '양인살', type: 'bad', description: '강한 승부욕·결단력, 수술·사고 주의', pillars: yiCols });
  }

  // 괴강살 (魁罡殺) — 특정 일주
  const gwaegangSet = new Set(['경진', '경술', '임진', '임술']);
  if (gwaegangSet.has(pillars.day.gan + pillars.day.zhi)) {
    sinSals.push({ name: '괴강살', type: 'neutral', description: '강한 카리스마와 리더십, 결단력', pillars: [1] });
  }

  // 겁살 (劫殺) — 년지 기준
  const geopSal: Record<string, string> = {
    '인': '해', '오': '해', '술': '해',
    '사': '인', '유': '인', '축': '인',
    '신': '사', '자': '사', '진': '사',
    '해': '신', '묘': '신', '미': '신',
  };
  const gsCols = findCols(geopSal[yearBranch] || '');
  if (gsCols.length > 0) {
    sinSals.push({ name: '겁살', type: 'bad', description: '갑작스러운 재물 손실, 도난 주의', pillars: gsCols });
  }

  // 망신살 (亡神殺) — 년지 기준
  const mangSin: Record<string, string> = {
    '인': '사', '오': '사', '술': '사',
    '사': '신', '유': '신', '축': '신',
    '신': '해', '자': '해', '진': '해',
    '해': '인', '묘': '인', '미': '인',
  };
  const msCols = findCols(mangSin[yearBranch] || '');
  if (msCols.length > 0) {
    sinSals.push({ name: '망신살', type: 'bad', description: '실수나 망신을 당할 수 있는 기운', pillars: msCols });
  }

  // 장성살 (將星殺) — 년지 기준
  const jangSeong: Record<string, string> = {
    '인': '오', '오': '오', '술': '오',
    '사': '유', '유': '유', '축': '유',
    '신': '자', '자': '자', '진': '자',
    '해': '묘', '묘': '묘', '미': '묘',
  };
  const jsCols = findCols(jangSeong[yearBranch] || '');
  if (jsCols.length > 0) {
    sinSals.push({ name: '장성', type: 'good', description: '리더십과 권위, 승진/출세운', pillars: jsCols });
  }

  // 관귀학관 (官貴學館) — 정관 천간의 장생지
  const gwanGwiHakGwan: Record<string, string> = {
    '갑': '사', '을': '사', '병': '신', '정': '신', '무': '해',
    '기': '해', '경': '인', '신': '인', '임': '신', '계': '신',
  };
  const ghCols = findCols(gwanGwiHakGwan[dayGan] || '');
  if (ghCols.length > 0) {
    sinSals.push({ name: '관귀학관', type: 'good', description: '관직/시험운이 좋고 학문적 성취', pillars: ghCols });
  }

  // 원진살 (元嗔殺) — 서로 밀어내는 지지 조합
  const wonJin: [string, string][] = [
    ['자', '미'], ['축', '오'], ['인', '사'], ['묘', '진'],
    ['신', '해'], ['유', '술'],
  ];
  wonJin.forEach(([a, b]) => {
    const hasBoth = branches.some(br => br.zhi === a) && branches.some(br => br.zhi === b);
    if (hasBoth) {
      const cols = branches.filter(br => br.zhi === a || br.zhi === b).map(br => br.col);
      sinSals.push({ name: '원진살', type: 'bad', description: '서로 밀어내는 기운, 관계 갈등 주의', pillars: cols });
    }
  });

  // 백호대살 (白虎大殺) — 일간 기준 특정 지지
  const baekho: Record<string, string> = {
    '갑': '진', '을': '사', '병': '오', '정': '미',
    '무': '신', '기': '유', '경': '술', '신': '해',
    '임': '자', '계': '축',
  };
  const bhCols = findCols(baekho[dayGan] || '');
  if (bhCols.length > 0) {
    sinSals.push({ name: '백호대살', type: 'bad', description: '사고·수술·혈액 주의, 결단력', pillars: bhCols });
  }

  // ── 삼형 ──
  const hasInSaSin = ['인', '사', '신'].every(b => branches.some(br => br.zhi === b));
  const hasChukSulMi = ['축', '술', '미'].every(b => branches.some(br => br.zhi === b));

  if (hasInSaSin) {
    const cols = branches.filter(b => ['인', '사', '신'].includes(b.zhi)).map(b => b.col);
    sinSals.push({ name: '인사신 삼형', type: 'bad', description: '지세지형 — 교통사고·수술 주의', pillars: cols });
  }
  if (hasChukSulMi) {
    const cols = branches.filter(b => ['축', '술', '미'].includes(b.zhi)).map(b => b.col);
    sinSals.push({ name: '축술미 삼형', type: 'bad', description: '무은지형 - 가족 갈등, 건강 주의', pillars: cols });
  }

  // 귀문관살 (鬼門關殺)
  const guiMun: string[][] = [
    ['자', '유'], ['축', '오'], ['인', '미'], ['묘', '신'], ['진', '사'], ['술', '해'],
  ];
  guiMun.forEach(pair => {
    const hasBoth = pair.every(p => branches.some(br => br.zhi === p));
    if (hasBoth) {
      const cols = branches.filter(b => pair.includes(b.zhi)).map(b => b.col);
      sinSals.push({ name: '귀문관살', type: 'neutral', description: '영적 감수성·직관력, 예술/종교 재능', pillars: cols });
    }
  });

  return sinSals;
};

const analyzeInteractions = (
  pillars: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar }
): Interaction[] => {
  const interactions: Interaction[] = [];
  const branches = [
    { pos: '년지', val: pillars.year.zhi },
    { pos: '월지', val: pillars.month.zhi },
    { pos: '일지', val: pillars.day.zhi },
    { pos: '시지', val: pillars.hour.zhi }
  ];
  const stems = [
    { pos: '년간', val: pillars.year.gan },
    { pos: '월간', val: pillars.month.gan },
    { pos: '일간', val: pillars.day.gan },
    { pos: '시간', val: pillars.hour.gan }
  ];

  const stemCombinations: [string, string, string][] = [
    ['갑', '기', '토'], ['을', '경', '금'], ['병', '신', '수'],
    ['정', '임', '목'], ['무', '계', '화']
  ];

  for (let i = 0; i < stems.length; i++) {
    for (let j = i + 1; j < stems.length; j++) {
      stemCombinations.forEach(([s1, s2, result]) => {
        if ((stems[i].val === s1 && stems[j].val === s2) ||
            (stems[i].val === s2 && stems[j].val === s1)) {
          interactions.push({
            type: '합',
            elements: [stems[i].pos, stems[j].pos],
            description: `${stems[i].val}${stems[j].val}합 ${result} - 두 기운이 결합`
          });
        }
      });
    }
  }

  const branchCombinations: [string, string, string][] = [
    ['자', '축', '토'], ['인', '해', '목'], ['묘', '술', '화'],
    ['진', '유', '금'], ['사', '신', '수'], ['오', '미', '토']
  ];

  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      branchCombinations.forEach(([b1, b2, result]) => {
        if ((branches[i].val === b1 && branches[j].val === b2) ||
            (branches[i].val === b2 && branches[j].val === b1)) {
          interactions.push({
            type: '합',
            elements: [branches[i].pos, branches[j].pos],
            description: `${branches[i].val}${branches[j].val}합 ${result} - 육합으로 결속`
          });
        }
      });
    }
  }

  const triCombinations: [string, string, string, string][] = [
    ['인', '오', '술', '화'], ['사', '유', '축', '금'],
    ['신', '자', '진', '수'], ['해', '묘', '미', '목']
  ];

  triCombinations.forEach(([b1, b2, b3, element]) => {
    const trioSet = new Set([b1, b2, b3]);
    const matched = branches.filter(br => trioSet.has(br.val));
    const uniqueVals = new Set(matched.map(m => m.val));
    if (uniqueVals.size >= 2) {
      const matchVals = Array.from(uniqueVals);
      interactions.push({
        type: '합',
        elements: matched.map(m => m.pos),
        description: `${matchVals.join('')} ${uniqueVals.size === 3 ? '삼합' : '반합'} ${element}국 - 강력한 ${element} 기운 형성`
      });
    }
  });

  const clashes: [string, string][] = [
    ['자', '오'], ['축', '미'], ['인', '신'], ['묘', '유'], ['진', '술'], ['사', '해']
  ];

  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      clashes.forEach(([c1, c2]) => {
        if ((branches[i].val === c1 && branches[j].val === c2) ||
            (branches[i].val === c2 && branches[j].val === c1)) {
          interactions.push({
            type: '충',
            elements: [branches[i].pos, branches[j].pos],
            description: `${branches[i].val}${branches[j].val}충 - 변동과 갈등의 기운`
          });
        }
      });
    }
  }

  // ── 방합(方合) — 인묘진(동방·목국), 사오미(남방·화국), 신유술(서방·금국), 해자축(북방·수국) ──
  // 같은 방향 3 지지가 모이면 강한 계절성 기운 형성. 2개만 있으면 반방합으로 표시.
  const banghap: [string, string, string, string][] = [
    ['인', '묘', '진', '목'], ['사', '오', '미', '화'],
    ['신', '유', '술', '금'], ['해', '자', '축', '수'],
  ];
  banghap.forEach(([b1, b2, b3, element]) => {
    const trioSet = new Set([b1, b2, b3]);
    const matched = branches.filter(br => trioSet.has(br.val));
    const uniqueVals = new Set(matched.map(m => m.val));
    if (uniqueVals.size >= 2) {
      const matchVals = Array.from(uniqueVals);
      interactions.push({
        type: '합',
        elements: matched.map(m => m.pos),
        description: `${matchVals.join('')} ${uniqueVals.size === 3 ? '방합' : '반합'} ${element}국 - 같은 방향 ${element} 기운 결집`
      });
    }
  });

  // ── 형(刑) — 무례지형/지세지형/무은지형/자형 ──
  // 삼형(3개 모두 모임), 상형(2개), 자형(같은 글자 2개)
  const samhyung: [string, string, string, string][] = [
    ['인', '사', '신', '지세지형(인사신)'],
    ['축', '술', '미', '무은지형(축술미)'],
  ];
  samhyung.forEach(([b1, b2, b3, label]) => {
    const trio = [b1, b2, b3];
    const trioSet = new Set(trio);
    const matched = branches.filter(br => trioSet.has(br.val));
    const uniqueVals = new Set(matched.map(m => m.val));
    if (uniqueVals.size === 3) {
      interactions.push({
        type: '형',
        elements: matched.map(m => m.pos),
        description: `${label} 완성 - 시비·소송·수술·다툼 강한 자극`
      });
    } else if (uniqueVals.size === 2) {
      // 2글자만 있으면 반쯤 형 (예: 인사 형, 사신 형)
      const vals = Array.from(uniqueVals);
      interactions.push({
        type: '형',
        elements: matched.map(m => m.pos),
        description: `${vals.join('')} 형(${label.split('(')[0]} 일부) - 부분 형, 마찰 가능`
      });
    }
  });

  // 자묘 상형(무례지형) — 별도 페어
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      if ((branches[i].val === '자' && branches[j].val === '묘') ||
          (branches[i].val === '묘' && branches[j].val === '자')) {
        interactions.push({
          type: '형',
          elements: [branches[i].pos, branches[j].pos],
          description: '자묘 상형(무례지형) - 예의·관계 갈등',
        });
      }
    }
  }

  // 자형(自刑) — 같은 글자 2개 (진진·오오·유유·해해)
  const jahyung = ['진', '오', '유', '해'];
  jahyung.forEach((zhi) => {
    const matched = branches.filter(br => br.val === zhi);
    if (matched.length >= 2) {
      interactions.push({
        type: '형',
        elements: matched.map(m => m.pos),
        description: `${zhi}${zhi} 자형(自刑) - 자기 안의 갈등·자해적 행동 주의`,
      });
    }
  });

  // ── 파(破) — 자유, 묘오, 사신, 인해, 진축, 술미 ──
  const pa: [string, string][] = [
    ['자', '유'], ['묘', '오'], ['사', '신'],
    ['인', '해'], ['진', '축'], ['술', '미'],
  ];
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      pa.forEach(([p1, p2]) => {
        if ((branches[i].val === p1 && branches[j].val === p2) ||
            (branches[i].val === p2 && branches[j].val === p1)) {
          interactions.push({
            type: '파',
            elements: [branches[i].pos, branches[j].pos],
            description: `${branches[i].val}${branches[j].val} 파 - 균열·중단·약속 어긋남`,
          });
        }
      });
    }
  }

  // ── 해(害) — 자미, 축오, 인사, 묘진, 신해, 유술 ──
  const hae: [string, string][] = [
    ['자', '미'], ['축', '오'], ['인', '사'],
    ['묘', '진'], ['신', '해'], ['유', '술'],
  ];
  for (let i = 0; i < branches.length; i++) {
    for (let j = i + 1; j < branches.length; j++) {
      hae.forEach(([h1, h2]) => {
        if ((branches[i].val === h1 && branches[j].val === h2) ||
            (branches[i].val === h2 && branches[j].val === h1)) {
          interactions.push({
            type: '해',
            elements: [branches[i].pos, branches[j].pos],
            description: `${branches[i].val}${branches[j].val} 해 - 시기·질투·은밀한 방해`,
          });
        }
      });
    }
  }

  return interactions;
};

const getAnimal = (branch: string): string => {
  const animals: Record<string, string> = {
    '자': '쥐', '축': '소', '인': '호랑이', '묘': '토끼',
    '진': '용', '사': '뱀', '오': '말', '미': '양',
    '신': '원숭이', '유': '닭', '술': '개', '해': '돼지'
  };
  return animals[branch] || '';
};

// ============================================
// 12신살 (년지 삼합 기준)
// ============================================
/**
 * 년지가 속한 삼합(水/金/火/木 국)에 따라 각 지지에 붙는 신살을 반환.
 * 순서: 겁살 → 재살 → 천살 → 지살 → 도화(연살) → 월살 → 망신 → 장성 → 반안 → 역마 → 육해 → 화개
 * 지살은 항상 "생지(삼합 첫 글자)" 에 위치 — 그로부터 시계방향으로 돈다.
 */
const SINSAL12_SEQUENCE = ['겁살','재살','천살','지살','도화','월살','망신','장성','반안','역마','육해','화개'];
// 삼합 그룹 → 지살이 위치하는 지지(=생지)의 EARTHLY_BRANCHES 인덱스
const SINSAL12_GROUP_START: Record<string, number> = {
  '신': 8, '자': 8, '진': 8, // 수국 — 지살=신
  '사': 5, '유': 5, '축': 5, // 금국 — 지살=사
  '인': 2, '오': 2, '술': 2, // 화국 — 지살=인
  '해': 11, '묘': 11, '미': 11, // 목국 — 지살=해
};
export const getSinSal12 = (yearZhi: string, targetZhi: string): string => {
  const start = SINSAL12_GROUP_START[yearZhi];
  const targetIdx = EARTHLY_BRANCHES.indexOf(targetZhi);
  if (start === undefined || targetIdx < 0) return '';
  // 지살이 순서상 index 3 이므로, 지살 위치(start)에서 뺀 뒤 +3 을 더하면 신살 인덱스가 나온다.
  const sinSalIdx = ((targetIdx - start + 12) % 12 + 3) % 12;
  return SINSAL12_SEQUENCE[sinSalIdx];
};

// ============================================
// 공망 (일주 기준 순중공망)
// ============================================
/**
 * 일주가 속한 60갑자 순(旬)에서 빠지는 2개 지지 = 공망.
 * 공망 지지 인덱스 = (순 시작 지지 + 10), (+11) mod 12
 * 순 시작 지지 인덱스 = (일지idx - 일간idx + 12) mod 12
 */
const getKongmangZhis = (dayGan: string, dayZhi: string): [string, string] | null => {
  const ganIdx = HEAVENLY_STEMS.indexOf(dayGan);
  const zhiIdx = EARTHLY_BRANCHES.indexOf(dayZhi);
  if (ganIdx < 0 || zhiIdx < 0) return null;
  const sunStart = (zhiIdx - ganIdx + 12) % 12;
  const k1 = (sunStart + 10) % 12;
  const k2 = (sunStart + 11) % 12;
  return [EARTHLY_BRANCHES[k1], EARTHLY_BRANCHES[k2]];
};

const calculateSeWoon = (dayGan: string, currentYear: number, yearZhiBirth: string = ''): SeWoon[] => {
  const startYear = currentYear - 7;
  return calculateSeWoonRange(dayGan, startYear, 12, yearZhiBirth);
};

export const calculateSeWoonRange = (dayGan: string, startYear: number, count: number, yearZhiBirth: string = ''): SeWoon[] => {
  const seWoons: SeWoon[] = [];
  for (let i = 0; i < count; i++) {
    const year = startYear + i;
    const solar = Solar.fromYmd(year, 6, 15);
    const lunar = solar.getLunar();
    const yearGanZhi = lunar.getYearInGanZhiExact();

    const gan = normalizeGan(yearGanZhi.substring(0, 1));
    const zhi = normalizeZhi(yearGanZhi.substring(1, 2));

    seWoons.push({
      year,
      gan,
      zhi,
      ganElement: STEM_ELEMENT[gan] || '',
      zhiElement: BRANCH_ELEMENT[zhi] || '',
      tenGod: getTenGod(dayGan, gan),
      tenGodZhi: getTenGodForBranch(dayGan, zhi),
      twelveStage: getTwelveStage(dayGan, zhi),
      sinSal12: yearZhiBirth ? getSinSal12(yearZhiBirth, zhi) : '',
      animal: getAnimal(zhi)
    });
  }
  return seWoons;
};

// ============================================
// 간여지동 · 병존 · 삼존 계산
// ============================================

const calculateGanYeojidong = (
  pillars: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar },
  hourUnknown: boolean
): GanYeojidong[] => {
  const result: GanYeojidong[] = [];
  const entries: Array<['year' | 'month' | 'day' | 'hour', Pillar]> = [
    ['year', pillars.year],
    ['month', pillars.month],
    ['day', pillars.day],
    ...(!hourUnknown ? [['hour', pillars.hour] as ['hour', Pillar]] : []),
  ];
  for (const [key, p] of entries) {
    if (p.ganElement && p.zhiElement && p.ganElement === p.zhiElement) {
      result.push({ pillar: key, gan: p.gan, zhi: p.zhi, element: p.ganElement });
    }
  }
  return result;
};

const calculateByeongjOn = (
  pillars: { year: Pillar; month: Pillar; day: Pillar; hour: Pillar },
  hourUnknown: boolean
): ByeongjOn[] => {
  const ganMap: Record<string, { count: number; positions: string[] }> = {};
  const entries: [string, string][] = [
    [pillars.year.gan, '년간'],
    [pillars.month.gan, '월간'],
    [pillars.day.gan, '일간'],
    ...(!hourUnknown && pillars.hour.gan ? [[pillars.hour.gan, '시간'] as [string, string]] : []),
  ];
  for (const [gan, pos] of entries) {
    if (!gan) continue;
    if (!ganMap[gan]) ganMap[gan] = { count: 0, positions: [] };
    ganMap[gan].count++;
    ganMap[gan].positions.push(pos);
  }
  return Object.entries(ganMap)
    .filter(([, v]) => v.count >= 2)
    .map(([gan, v]) => ({
      gan,
      element: STEM_ELEMENT[gan] || '',
      count: v.count,
      positions: v.positions,
      isSamjon: v.count >= 3,
    }));
};

// ============================================
// 메인 계산 함수
// ============================================

/**
 * 출생 시간 미상 시 사용할 빈 시주 placeholder.
 * 모든 문자열 필드를 빈 문자열, 배열 필드를 빈 배열로 둠으로써
 * 하위 계산 함수들(`countElements`, `analyzeStrength`, `calculateSinSals`,
 * `analyzeInteractions`)이 해당 기둥을 자연스럽게 건너뛰게 한다
 * (예: `if (ganEl) count[ganEl] += 1` 의 falsy check, `branches.includes('')` 불일치).
 */
const EMPTY_HOUR_PILLAR: Pillar = {
  gan: '',
  zhi: '',
  ganElement: '',
  zhiElement: '',
  ganYinYang: '',
  zhiYinYang: '',
  hiddenStems: [],
  tenGodGan: '',
  tenGodZhi: '',
  twelveStage: '',
  sinSal12: '',
  isKongmang: false,
};

export const calculateSaju = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  gender: 'male' | 'female' = 'male',
  hourUnknown: boolean = false
): SajuResult => {
  // 시간 미상일 때도 lunar 계산 자체는 정오(12:00) 기준으로 돌려 일주(日柱)까지 안전하게 산출.
  // 이후 시주만 비워 삼주추명 규칙으로 전환한다.
  const safeHour = hourUnknown ? 12 : hour;
  const safeMinute = hourUnknown ? 0 : minute;
  const solar = Solar.fromYmdHms(year, month, day, safeHour, safeMinute, 0);
  const lunar = solar.getLunar();
  const baZi = lunar.getEightChar();

  const genderNum = gender === 'male' ? 1 : 0;
  const yun = baZi.getYun(genderNum);
  // lunar-javascript 의 getDaYun() 은 첫 요소가 출생~첫대운 직전의 유년기(ganZhi 빈값)
  // placeholder 라서 그대로 쓰면 카드가 한 칸씩 밀린다. 한 개 더 받아서 첫 요소를 제거.
  const daewoonRaw = yun.getDaYun(11).slice(1);

  const dayGan = normalizeGan(baZi.getDayGan());
  const monthZhiNorm = normalizeZhi(baZi.getMonthZhi());
  const dayMasterElement = STEM_ELEMENT[dayGan] || '';
  const dayMasterYinYang = STEM_YINYANG[dayGan] || '';

  // 12신살·공망 판정에 필요한 기준 지지들을 먼저 뽑는다.
  const yearZhiForSinsal = normalizeZhi(baZi.getYearZhi());
  const dayZhiForKongmang = normalizeZhi(baZi.getDayZhi());
  const kongmangZhis = getKongmangZhis(dayGan, dayZhiForKongmang);

  const createPillar = (ganRaw: string, zhiRaw: string, isDayPillar = false): Pillar => {
    const gan = normalizeGan(ganRaw);
    const zhi = normalizeZhi(zhiRaw);
    return {
      gan,
      zhi,
      ganElement: STEM_ELEMENT[gan] || '',
      zhiElement: BRANCH_ELEMENT[zhi] || '',
      ganYinYang: STEM_YINYANG[gan] || '',
      zhiYinYang: BRANCH_YINYANG[zhi] || '',
      hiddenStems: BRANCH_HIDDEN_STEMS[zhi] || [],
      tenGodGan: isDayPillar ? '일주' : getTenGod(dayGan, gan),
      tenGodZhi: getTenGodForBranch(dayGan, zhi),
      twelveStage: getTwelveStage(dayGan, zhi),
      sinSal12: getSinSal12(yearZhiForSinsal, zhi),
      isKongmang: kongmangZhis ? (zhi === kongmangZhis[0] || zhi === kongmangZhis[1]) : false,
    };
  };

  const pillars = {
    year: createPillar(baZi.getYearGan(), baZi.getYearZhi()),
    month: createPillar(baZi.getMonthGan(), baZi.getMonthZhi()),
    day: createPillar(baZi.getDayGan(), baZi.getDayZhi(), true),
    // 시간 미상 시 시주는 빈 placeholder — 하위 계산이 자연스럽게 시주를 스킵함
    hour: hourUnknown ? { ...EMPTY_HOUR_PILLAR } : createPillar(baZi.getTimeGan(), baZi.getTimeZhi())
  };

  const elementCount = countElements(pillars);
  const totalWeight = Object.values(elementCount).reduce((a, b) => a + b, 0);
  const elementPercent: ElementCount = totalWeight > 0 ? {
    목: Math.round((elementCount.목 / totalWeight) * 100),
    화: Math.round((elementCount.화 / totalWeight) * 100),
    토: Math.round((elementCount.토 / totalWeight) * 100),
    금: Math.round((elementCount.금 / totalWeight) * 100),
    수: Math.round((elementCount.수 / totalWeight) * 100)
  } : { 목: 20, 화: 20, 토: 20, 금: 20, 수: 20 };

  const sortedElements = Object.entries(elementCount).sort((a, b) => b[1] - a[1]);
  const strongElement = sortedElements[0][0];
  const weakElement = sortedElements[sortedElements.length - 1][0];

  const strengthResult = analyzeStrength(dayGan, monthZhiNorm, pillars);
  const yongSinResult = determineYongSin(dayMasterElement, strengthResult.isStrong, elementCount, monthZhiNorm, strengthResult.score);
  const sinSals = calculateSinSals(dayGan, pillars);
  const interactions = analyzeInteractions(pillars);
  const ganYeojidong = calculateGanYeojidong(pillars, hourUnknown);
  const byeongjOn = calculateByeongjOn(pillars, hourUnknown);

  const daeWoon: DaeWoon[] = daewoonRaw.map((dw: any) => {
    const ganZhi = dw.getGanZhi();
    const gan = normalizeGan(ganZhi.substring(0, 1));
    const zhi = normalizeZhi(ganZhi.substring(1, 2));
    return {
      startAge: dw.getStartYear(),
      endAge: dw.getStartYear() + 9,
      gan,
      zhi,
      ganElement: STEM_ELEMENT[gan] || '',
      zhiElement: BRANCH_ELEMENT[zhi] || '',
      tenGod: getTenGod(dayGan, gan),
      tenGodZhi: getTenGodForBranch(dayGan, zhi),
      twelveStage: getTwelveStage(dayGan, zhi),
      sinSal12: getSinSal12(yearZhiForSinsal, zhi),
    };
  });

  const currentYear = new Date().getFullYear();
  const seWoon = calculateSeWoon(dayGan, currentYear, yearZhiForSinsal);
  const currentSeWoon = seWoon.find(s => s.year === currentYear) ?? seWoon[0];

  const lunarMonth = lunar.getMonth();
  const lunarDay = lunar.getDay();
  const isLeapMonth = lunar.getMonth() < 0;

  return {
    solarDate: solar.toYmdHms(),
    lunarDate: lunar.toFullString(),
    lunarDateSimple: `${Math.abs(lunarMonth)}월 ${lunarDay}일${isLeapMonth ? ' (윤달)' : ''}`,
    isLeapMonth,
    gender,
    hourUnknown,
    pillars,
    dayMaster: dayGan,
    dayMasterElement,
    dayMasterYinYang,
    elementCount,
    elementPercent,
    strongElement,
    weakElement,
    isStrong: strengthResult.isStrong,
    strengthScore: strengthResult.score,
    strengthAnalysis: strengthResult.analysis,
    strengthStatus: strengthResult.status,
    deukRyeong: strengthResult.deukRyeong,
    deukJi: strengthResult.deukJi,
    deukSe: strengthResult.deukSe,
    strengthDetail: strengthResult.detail,
    yongSin: yongSinResult.yongSin,
    heeSin: yongSinResult.heeSin,
    giSin: yongSinResult.giSin,
    yongSinElement: yongSinResult.element,
    interactions,
    sinSals,
    ganYeojidong,
    byeongjOn,
    daeWoon,
    daeWoonStartAge: Math.round(yun.getStartYear() + yun.getStartMonth() / 12),
    seWoon,
    currentSeWoon
  };
};

export const getSajuSummary = (result: SajuResult): string => {
  const { pillars, dayMasterElement, isStrong, yongSinElement } = result;
  return `일주: ${pillars.day.gan}${pillars.day.zhi} (${dayMasterElement} 일간)\n신강/신약: ${isStrong ? '신강' : '신약'}\n용신 오행: ${yongSinElement}`;
};
