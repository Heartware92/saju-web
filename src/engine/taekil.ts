/**
 * 택일(擇日) 엔진 — 특정 행사에 맞는 길일을 판별
 *
 * 원국(natal chart) + 행사 카테고리 + 날짜 범위를 받아
 * 각 날짜의 길흉 등급과 점수를 결정론적으로 계산한다.
 */

import { Solar } from 'lunar-javascript';
import {
  STEM_ELEMENT,
  BRANCH_ELEMENT,
  TEN_GODS_MAP,
  BRANCH_HIDDEN_STEMS,
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  STEM_YINYANG,
  TWELVE_STAGE_NAMES,
  normalizeGan,
  normalizeZhi,
  type SajuResult,
} from '../utils/sajuCalculator';
import { detectSinsal, type SinsalHit } from './taekilSinsal';

// ============================================
// 타입
// ============================================

/**
 * 인생 변곡점 6묶음 + 기타(직접 입력) — 다른 앱과 차별화된 묶음 카테고리.
 * 단순 행사 나열이 아니라 명리적 에너지 결이 비슷한 상황을 한 묶음으로.
 */
export type TaekilCategory =
  | 'settle'     // 터를 잡다 — 이사·입주·창업·개업·신축
  | 'bond'       // 마음을 묶다 — 혼례·약혼·상견례·고백·재회
  | 'decision'   // 획을 긋다 — 큰 계약·매매·차량·이별·퇴사·관계 정리
  | 'journey'    // 길을 나서다 — 여행·해외 출장·이주·유학·면접·시험
  | 'heal'       // 몸을 보살피다 — 수술·시술·치유
  | 'birth'      // 새 생명을 맞다 — 출산·제왕절개
  | 'custom';    // 기타 — 사용자 직접 입력

export const TAEKIL_CATEGORIES: { id: TaekilCategory; label: string; desc: string; subItems: string[] }[] = [
  { id: 'settle',   label: '터를 잡다',      desc: '이사 · 입주 · 창업 · 개업 · 신축', subItems: ['이사', '입주', '창업', '개업', '신축'] },
  { id: 'bond',     label: '마음을 묶다',    desc: '혼례 · 약혼 · 상견례 · 고백 · 재회', subItems: ['혼례', '약혼', '상견례', '고백', '재회'] },
  { id: 'decision', label: '획을 긋다',      desc: '큰 계약 · 매매 · 차량 · 이별 · 퇴사 · 관계 정리', subItems: ['큰 계약', '매매', '차량 구매', '이별', '퇴사', '관계 정리'] },
  { id: 'journey',  label: '길을 나서다',    desc: '여행 · 해외 출장 · 이주 · 유학 · 면접 · 시험', subItems: ['여행', '해외 출장', '이주', '유학', '면접', '시험'] },
  { id: 'heal',     label: '몸을 보살피다',  desc: '수술 · 시술 · 치유', subItems: ['수술', '시술', '치유'] },
  { id: 'birth',    label: '새 생명을 맞다', desc: '출산 · 제왕절개', subItems: ['출산', '제왕절개'] },
  { id: 'custom',   label: '기타',           desc: '직접 입력 — 위 묶음에 없는 행사', subItems: [] },
];

/**
 * 구버전 → 신버전 카테고리 매핑.
 * 보관함의 archive record가 옛 id 로 저장되어 있을 때 신 id 로 변환해 재생.
 */
export const LEGACY_CATEGORY_MIGRATION: Record<string, TaekilCategory> = {
  marriage: 'bond',
  moving:   'settle',
  business: 'settle',
  contract: 'decision',
  travel:   'journey',
  surgery:  'heal',
  birth:    'birth',
};

export function migrateLegacyCategory(raw: string | undefined | null): TaekilCategory | null {
  if (!raw) return null;
  // 신 id 가 그대로면 통과
  if (TAEKIL_CATEGORIES.some(c => c.id === raw)) return raw as TaekilCategory;
  return LEGACY_CATEGORY_MIGRATION[raw] ?? null;
}

export type TaekilGrade = '대길' | '길' | '평' | '흉';

export interface TimeSlotEnergy {
  zhi: string;
  name: string;
  hours: string;
  energy: number; // 1-10
}

export interface TaekilDay {
  date: string;       // YYYY-MM-DD
  lunarLabel: string;  // "을사년 기묘월 갑자일"
  dayGan: string;
  dayZhi: string;
  dayGanElement: string;
  dayZhiElement: string;
  score: number;       // 5~95
  grade: TaekilGrade;
  reasons: string[];   // 판정 사유
  luckyTime?: string;  // 길시 추천
  elementEnergy: Record<string, number>; // { 목:1~10, 화:1~10, ... }
  timeSlots: TimeSlotEnergy[];           // 12시진별 에너지
  /** 한국 명리 표준 흉신·길신 적중 목록. 카테고리별 차등 적용. 옛 archive 호환을 위해 optional. */
  sinsalHits?: SinsalHit[];
}

export interface TaekilResult {
  category: TaekilCategory;
  categoryLabel: string;
  /** 대분류 내 선택된 구체적 행사 (예: "이사", "창업"). custom일 때는 undefined. */
  subItem?: string;
  /** category='custom' 일 때 사용자가 직접 입력한 행사 이름. (예: "전시회 오픈", "리허설"). 다른 묶음에선 undefined. */
  customLabel?: string;
  startDate: string;
  endDate: string;
  days: TaekilDay[];
  bestDays: TaekilDay[];  // 대길+길 날들 (상위)
}

// ============================================
// 상수
// ============================================

const TEN_GOD_SCORE: Record<string, number> = {
  '정관': 12, '정인': 10, '정재': 10, '식신': 9, '편재': 7,
  '편인': 2, '겁재': -3, '비견': 0, '상관': -4, '편관': -2,
};

/**
 * 묶음별 십성 가중치.
 * - 묶음 안의 다양한 상황(예: settle = 이사+창업)을 함께 다루므로 보수적으로 합집합.
 * - 정재/편재(재성), 정관(공인 절차), 식신(생명·풍요), 정인(보호·문서)을 양수로,
 *   상관(관 극)·겁재(재성 극)·편관(압박)을 음수로.
 * - custom 은 균형(0) — 일반 길흉 점수만 사용. 사용자 입력 텍스트는 prompt 단계에서 활용.
 */
const CATEGORY_BOOST: Record<TaekilCategory, Record<string, number>> = {
  // 터를 잡다: 정인(터·뿌리) + 편재(자금) + 식신(풍요) + 정재(안정)
  settle:   { '정인': 14, '편재': 12, '식신': 10, '정재': 10, '상관':  4, '겁재': -10, '편관': -8 },
  // 마음을 묶다: 정재(배우자·남) + 정관(배우자·여, 공식 인연) + 식신(가정 풍요) + 편재(외향 인연)
  bond:     { '정재': 14, '정관': 12, '식신':  8, '편재':  6, '상관': -10, '편관': -8, '겁재': -6 },
  // 획을 긋다: 정재(거래) + 정관(법적 보호) + 정인(문서) — 정리·결단도 같은 결
  decision: { '정재': 14, '정관': 12, '정인':  8, '식신':  4, '편관': -10, '겁재': -10, '상관': -8 },
  // 길을 나서다: 식신(이동·즐거움) + 정인(학습·안전) + 편재(현지 활동) + 정관(시험·면접 공식 절차)
  journey:  { '식신': 12, '정인': 10, '정관':  8, '편재':  6, '편관': -10, '겁재': -4, '상관': -2 },
  // 몸을 보살피다: 정인(보호·회복) + 식신(생명력) — 편인 극식신, 편관·상관 강한 감점
  heal:     { '정인': 14, '식신': 10, '편인':  4, '편관': -12, '상관': -10, '겁재': -4 },
  // 새 생명: 식신 최우선(子息), 정인(양육), 편인은 도식(倒食)으로 강한 감점
  birth:    { '식신': 18, '정인': 14, '정재':  6, '편인': -14, '편관': -16, '상관': -12, '겁재': -6 },
  // 기타: boost 없음 — 일반 길흉 + AI 가 사용자 입력 텍스트로 결을 잡음
  custom:   {},
};

// 육충
const YUKCHUNG: [string, string][] = [
  ['자', '오'], ['축', '미'], ['인', '신'],
  ['묘', '유'], ['진', '술'], ['사', '해'],
];

// 육합
const YUKHAP: [string, string][] = [
  ['자', '축'], ['인', '해'], ['묘', '술'],
  ['진', '유'], ['사', '신'], ['오', '미'],
];

// 형
const HYEONG: [string, string][] = [
  ['인', '사'], ['사', '신'], ['인', '신'],
  ['축', '술'], ['술', '미'], ['축', '미'],
  ['자', '묘'],
];

// 천덕귀인 — 월지 기준으로 천간에 해당하면 길
const CHEONDUK: Record<string, string> = {
  '인': '정', '묘': '신', '진': '임', '사': '신',
  '오': '해', '미': '갑', '신': '계', '유': '인',
  '술': '병', '해': '을', '자': '기', '축': '경',
};

const ELEMENT_TIMES: Record<string, string> = {
  '목': '오전 5~7시 (인·묘시)',
  '화': '오전 11시~오후 1시 (사·오시)',
  '토': '오전 7~9시 (진·미시)',
  '금': '오후 3~7시 (신·유시)',
  '수': '밤 9~11시 (해·자시)',
};

// 지장간 가중치: 정기/중기/여기
const HIDDEN_STEM_WEIGHTS = [0.6, 0.3, 0.1];

// 12운성 점수
const STAGE_POINTS: Record<string, number> = {
  '장생': 12, '목욕': 8, '관대': 12, '건록': 18, '제왕': 20,
  '쇠': 8, '병': 4, '사': 2, '묘': 8, '절': 0, '태': 2, '양': 6,
};

// 삼합
const SAMHAP: [string, string, string, string][] = [
  ['신', '자', '진', '수'],
  ['사', '유', '축', '금'],
  ['인', '오', '술', '화'],
  ['해', '묘', '미', '목'],
];

// 시작 행사 카테고리 (공망 감점이 큰 카테고리 — '시작'의 무게가 큰 묶음)
const START_CATEGORIES: TaekilCategory[] = ['settle', 'bond', 'decision', 'birth'];

// ============================================
// 헬퍼 함수
// ============================================

function getTwelveStage(dayGan: string, branch: string): string {
  const branchIndex = EARTHLY_BRANCHES.indexOf(branch);
  if (branchIndex === -1) return '';
  const isYang = STEM_YINYANG[dayGan] === '양';
  const element = STEM_ELEMENT[dayGan];
  // 음양이행(전통): 양간은 亥·寅·巳·申에서 장생 순행, 음간은 午·酉·子·卯에서 장생 역행
  const yangStartPos: Record<string, number> = {
    '목': 11, '화': 2, '토': 2, '금': 5, '수': 8,
  };
  const yinStartPos: Record<string, number> = {
    '목': 6, '화': 9, '토': 9, '금': 0, '수': 3,
  };
  if (isYang) {
    const startPos = yangStartPos[element] ?? 0;
    return TWELVE_STAGE_NAMES[(branchIndex - startPos + 12) % 12];
  } else {
    const startPos = yinStartPos[element] ?? 0;
    return TWELVE_STAGE_NAMES[(startPos - branchIndex + 12) % 12];
  }
}

function getKongmangZhis(dayGan: string, dayZhi: string): [string, string] | null {
  const ganIdx = HEAVENLY_STEMS.indexOf(dayGan);
  const zhiIdx = EARTHLY_BRANCHES.indexOf(dayZhi);
  if (ganIdx < 0 || zhiIdx < 0) return null;
  const sunStart = (zhiIdx - ganIdx + 12) % 12;
  const k1 = (sunStart + 10) % 12;
  const k2 = (sunStart + 11) % 12;
  return [EARTHLY_BRANCHES[k1], EARTHLY_BRANCHES[k2]];
}

// ============================================
// 시간대 에너지 계산용 상수
// ============================================

const SIGAN_DATA: { zhi: string; name: string; hours: string }[] = [
  { zhi: '자', name: '자시', hours: '23:00~01:00' },
  { zhi: '축', name: '축시', hours: '01:00~03:00' },
  { zhi: '인', name: '인시', hours: '03:00~05:00' },
  { zhi: '묘', name: '묘시', hours: '05:00~07:00' },
  { zhi: '진', name: '진시', hours: '07:00~09:00' },
  { zhi: '사', name: '사시', hours: '09:00~11:00' },
  { zhi: '오', name: '오시', hours: '11:00~13:00' },
  { zhi: '미', name: '미시', hours: '13:00~15:00' },
  { zhi: '신', name: '신시', hours: '15:00~17:00' },
  { zhi: '유', name: '유시', hours: '17:00~19:00' },
  { zhi: '술', name: '술시', hours: '19:00~21:00' },
  { zhi: '해', name: '해시', hours: '21:00~23:00' },
];

const OSEOJEONHWAN: Record<string, string> = {
  '갑': '갑', '기': '갑',
  '을': '병', '경': '병',
  '병': '무', '신': '무',
  '정': '경', '임': '경',
  '무': '임', '계': '임',
};

function getHourGan(dayGan: string, hourZhi: string): string {
  const startGan = OSEOJEONHWAN[dayGan] || '갑';
  const ganIdx = HEAVENLY_STEMS.indexOf(startGan);
  const zhiIdx = EARTHLY_BRANCHES.indexOf(hourZhi);
  return HEAVENLY_STEMS[(ganIdx + zhiIdx) % 10];
}

function calcDayElementEnergy(
  saju: SajuResult,
  dayGan: string,
  dayZhi: string,
): Record<string, number> {
  const e: Record<string, number> = { '목': 3, '화': 3, '토': 3, '금': 3, '수': 3 };

  const dayEl = STEM_ELEMENT[dayGan];
  if (dayEl) e[dayEl] += 4;

  const hidden = (BRANCH_HIDDEN_STEMS as Record<string, string[]>)[dayZhi] || [];
  hidden.forEach((stem, i) => {
    const el = STEM_ELEMENT[stem];
    if (el) e[el] += [3, 1.5, 0.5][i] ?? 0;
  });

  if (saju.yongSinElement && e[saju.yongSinElement] !== undefined) e[saju.yongSinElement] += 1.5;
  if (saju.giSin && e[saju.giSin] !== undefined) e[saju.giSin] -= 1;

  const vals = Object.values(e);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const range = max - min || 1;
  for (const k of Object.keys(e)) {
    e[k] = Math.max(1, Math.min(10, Math.round(((e[k] - min) / range) * 9 + 1)));
  }
  return e;
}

function calcTimeSlotEnergy(
  saju: SajuResult,
  dayGan: string,
  dayZhi: string,
  category: TaekilCategory,
): TimeSlotEnergy[] {
  const catBoost = CATEGORY_BOOST[category];
  const dayMaster = saju.dayMaster;
  const natalZhis = [saju.pillars.year.zhi, saju.pillars.month.zhi, saju.pillars.day.zhi];
  if (!saju.hourUnknown) natalZhis.push(saju.pillars.hour.zhi);

  return SIGAN_DATA.map(({ zhi, name, hours }) => {
    let score = 5;

    const hourGan = getHourGan(dayGan, zhi);
    const tenGod = TEN_GODS_MAP[dayMaster]?.[hourGan] || '';
    score += (TEN_GOD_SCORE[tenGod] ?? 0) * 0.25;
    score += (catBoost[tenGod] ?? 0) * 0.15;

    const zhiEl = BRANCH_ELEMENT[zhi];
    if (zhiEl === saju.yongSinElement) score += 2;
    if (zhiEl === saju.giSin) score -= 1.5;

    for (const [a, b] of YUKHAP) {
      if ((dayZhi === a && zhi === b) || (dayZhi === b && zhi === a)) score += 1.5;
    }
    for (const [a, b] of YUKCHUNG) {
      if ((dayZhi === a && zhi === b) || (dayZhi === b && zhi === a)) score -= 2;
    }

    for (const nz of natalZhis) {
      for (const [a, b] of YUKHAP) {
        if ((nz === a && zhi === b) || (nz === b && zhi === a)) score += 0.5;
      }
      for (const [a, b] of YUKCHUNG) {
        if ((nz === a && zhi === b) || (nz === b && zhi === a)) score -= 0.5;
      }
    }

    return { zhi, name, hours, energy: Math.max(1, Math.min(10, Math.round(score))) };
  });
}

// ============================================
// 메인 계산
// ============================================

function gradeFromScore(s: number): TaekilGrade {
  if (s >= 80) return '대길';
  if (s >= 65) return '길';
  if (s >= 45) return '평';
  return '흉';
}

function scoreOneDay(
  saju: SajuResult,
  dateStr: string,
  category: TaekilCategory,
  subItem?: string,
): TaekilDay {
  const [y, m, d] = dateStr.split('-').map(Number);
  const solar = Solar.fromYmd(y, m, d);
  const lunar = solar.getLunar();
  const dayGz = lunar.getDayInGanZhi();
  const monthGz = lunar.getMonthInGanZhi();
  const yearGz = lunar.getYearInGanZhi();

  const dayGan = normalizeGan(dayGz[0]);
  const dayZhi = normalizeZhi(dayGz[1]);
  const monthZhi = normalizeZhi(monthGz[1]);
  const yearZhi = normalizeZhi(yearGz[1]);
  const dayGzKor = `${dayGan}${dayZhi}`;
  const dayGanElement = STEM_ELEMENT[dayGan] || '';
  const dayZhiElement = BRANCH_ELEMENT[dayZhi] || '';

  const dayMaster = saju.dayMaster;
  const tenGodGan = TEN_GODS_MAP[dayMaster]?.[dayGan] || '';
  const hiddenStems = (BRANCH_HIDDEN_STEMS as Record<string, string[]>)[dayZhi] || [];

  const reasons: string[] = [];
  let base = 50;

  // 1) 기본 십신 점수
  const ganScore = TEN_GOD_SCORE[tenGodGan] ?? 0;
  base += ganScore * 0.6;

  // 2) 지장간 full — 정기/중기/여기 가중 분석
  const catBoost = CATEGORY_BOOST[category];
  let hiddenStemBonus = 0;
  hiddenStems.forEach((stem, idx) => {
    const w = HIDDEN_STEM_WEIGHTS[idx] ?? 0.1;
    const tenGod = TEN_GODS_MAP[dayMaster]?.[stem] || '';
    const godScore = TEN_GOD_SCORE[tenGod] ?? 0;
    hiddenStemBonus += godScore * w * 0.4;
    const catB = catBoost[tenGod] ?? 0;
    hiddenStemBonus += catB * w * 0.3;
  });
  base += hiddenStemBonus;

  // 3) 카테고리별 천간 십신 보정
  const catGanBoost = catBoost[tenGodGan] ?? 0;
  base += catGanBoost * 0.5;
  if (catGanBoost > 0) reasons.push(`${tenGodGan} — 행사에 유리`);
  if (catGanBoost < 0) reasons.push(`${tenGodGan} — 행사에 불리`);

  // 3) 용신 일치
  if (dayGanElement === saju.yongSinElement) {
    base += 8;
    reasons.push(`일진 천간이 용신(${saju.yongSinElement})과 일치`);
  }
  if (dayZhiElement === saju.yongSinElement) {
    base += 4;
  }

  // 4) 기신 일치 (불리)
  if (dayGanElement === saju.giSin) {
    base -= 6;
    reasons.push(`일진 천간이 기신(${saju.giSin})과 일치 — 주의`);
  }

  // 5) 원국 지지와 일진 지지 합·충·형
  const pillars = [saju.pillars.year, saju.pillars.month, saju.pillars.day];
  if (!saju.hourUnknown) pillars.push(saju.pillars.hour);

  let interactionBonus = 0;
  pillars.forEach(p => {
    // 육합
    for (const [a, b] of YUKHAP) {
      if ((p.zhi === a && dayZhi === b) || (p.zhi === b && dayZhi === a)) {
        interactionBonus += 5;
        reasons.push(`${p.zhi}(원국)와 ${dayZhi}(일진) 육합 — 조화`);
      }
    }
    // 육충
    for (const [a, b] of YUKCHUNG) {
      if ((p.zhi === a && dayZhi === b) || (p.zhi === b && dayZhi === a)) {
        interactionBonus -= 7;
        reasons.push(`${p.zhi}(원국)와 ${dayZhi}(일진) 육충 — 충돌`);
      }
    }
    // 형
    for (const [a, b] of HYEONG) {
      if ((p.zhi === a && dayZhi === b) || (p.zhi === b && dayZhi === a)) {
        interactionBonus -= 4;
        reasons.push(`${p.zhi}(원국)와 ${dayZhi}(일진) 형 — 시비 주의`);
      }
    }
  });
  base += interactionBonus;

  // 6) 천덕귀인 체크 (월지 기준)
  const cheondukGan = CHEONDUK[monthZhi];
  if (cheondukGan && dayGan === cheondukGan) {
    base += 8;
    reasons.push('천덕귀인일 — 재앙 해소, 대길');
  }

  // 7) 12운성 — 일간 기준으로 일진 지지의 운성 판단
  const stage = getTwelveStage(dayMaster, dayZhi);
  if (stage) {
    const stageScore = STAGE_POINTS[stage] ?? 0;
    const stageBonus = (stageScore - 8) * 0.4;
    base += stageBonus;
    if (stageScore >= 18) {
      reasons.push(`12운성 ${stage} — 강한 기운, 시작에 유리`);
    } else if (stageScore <= 2) {
      reasons.push(`12운성 ${stage} — 기운 약함, 주의 필요`);
    }
  }

  // 8) 공망 — 일주 기준 공망 지지가 일진 지지와 일치하면 감점
  const natalDayGan = saju.pillars.day.gan;
  const natalDayZhi = saju.pillars.day.zhi;
  const kongmang = getKongmangZhis(natalDayGan, natalDayZhi);
  if (kongmang && kongmang.includes(dayZhi)) {
    const isStartEvent = START_CATEGORIES.includes(category);
    const penalty = isStartEvent ? -10 : -5;
    base += penalty;
    reasons.push(`공망일(${kongmang.join('·')}) — ${isStartEvent ? '시작 행사 크게 불리' : '허한 기운 주의'}`);
  }

  // 9) 삼합 — 원국 지지 + 일진 지지로 삼합 완성 시 보너스
  const natalZhis = pillars.map(p => p.zhi);
  for (const [b1, b2, b3, element] of SAMHAP) {
    const trio = [b1, b2, b3];
    if (!trio.includes(dayZhi)) continue;
    const remaining = trio.filter(b => b !== dayZhi);
    if (remaining.every(b => natalZhis.includes(b))) {
      base += 8;
      reasons.push(`삼합 완성(${trio.join('')}→${element}) — 강한 조화`);
      if (element === saju.yongSinElement) {
        base += 5;
        reasons.push(`삼합 오행(${element})이 용신과 일치 — 대길`);
      }
    }
  }

  // 10) 출산 택일 전용 — 사(死)·절(絶) 강화 패널티 / 장생·제왕 보너스
  if (category === 'birth') {
    if (stage === '사' || stage === '절') {
      base -= 12;
      reasons.push(`12운성 ${stage} — 출산 택일 기피일`);
    } else if (stage === '장생' || stage === '제왕' || stage === '건록') {
      base += 6;
      reasons.push(`12운성 ${stage} — 출산에 강한 생명 에너지`);
    }
  }

  // 11) 한국 명리 흉신·길신 판정 — 카테고리별 차등 적용
  const sinsalHits: SinsalHit[] = detectSinsal({
    date: dateStr,
    lunar,
    solar,
    dayGan,
    dayZhi,
    dayGz: dayGzKor,
    monthZhi,
    yearZhi,
    natalDayZhi: saju.pillars.day.zhi,
    natalYearZhi: saju.pillars.year.zhi,
    lunarDay: lunar.getDay(),
    category,
    subItem,
  });
  for (const hit of sinsalHits) {
    base += hit.delta;
    reasons.push(hit.reason);
  }

  // 12) 강흉 흉신 적중 시 grade 하한 — 점수 보정만으로는 부족할 수 있어
  // 복단일·십악대패일·수사일 같은 severe 흉신이 1개라도 적중하면 grade를 '평' 이하로 강제.
  const hasSevereSinsal = sinsalHits.some(h => h.kind === 'severe');

  // 13) 비대칭 상향 — 좋은 점수만 끌어올림 (날짜 비교용이므로 흉일은 그대로 유지)
  // [B안 — 2026-05-21 재강화] 배율 1.6→2.6.
  //   사용자 피드백: 좋게 본 날도 68점을 못 넘어 70 문턱조차 안 닿음 →
  //   실제 좋은 날(base 60대 초반)이 길·대길 점수로 보이지 않아 추천 의미 약함.
  //   풀이 실제 길흉 판정은 보존 (base 계산·grade 임계는 동일), 점수 표시만 보정.
  //   변환 예: base 65→89, 63→84, 61→79, 60→76, 58→71, 55→63, 53→58, 50→50.
  //   ★ 흉일(base ≤ 50) 은 변경 없음 — 좋은 날만 끌어올려 편차 ↑.
  let liftedBase = base;
  if (base > 50) {
    liftedBase = 50 + (base - 50) * 2.6;
  }
  let score = Math.max(5, Math.min(95, Math.round(liftedBase)));
  if (hasSevereSinsal && score > 55) {
    score = Math.min(score, 55); // 강흉 흉신 있으면 '평' 상한
  }
  const grade = gradeFromScore(score);
  if (reasons.length === 0) {
    reasons.push(grade === '대길' || grade === '길' ? '전반적으로 무난한 길일' : '특별한 길흉 요소 없음');
  }

  const lunarLabel = `${yearGz}년 ${monthGz}월 ${dayGz}일`;
  const luckyTime = ELEMENT_TIMES[saju.yongSinElement] || '';

  return {
    date: dateStr,
    lunarLabel,
    dayGan,
    dayZhi,
    dayGanElement,
    dayZhiElement,
    score,
    grade,
    reasons,
    luckyTime: grade === '대길' || grade === '길' ? luckyTime : undefined,
    elementEnergy: calcDayElementEnergy(saju, dayGan, dayZhi),
    timeSlots: calcTimeSlotEnergy(saju, dayGan, dayZhi, category),
    sinsalHits,
  };
}

// ============================================
// 공개 API
// ============================================

export function calculateTaekil(
  saju: SajuResult,
  category: TaekilCategory,
  startDate: string,
  endDate: string,
  customLabel?: string,
  subItem?: string,
): TaekilResult {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days: TaekilDay[] = [];

  const cursor = new Date(start);
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    days.push(scoreOneDay(saju, iso, category, subItem));
    cursor.setDate(cursor.getDate() + 1);
  }

  const bestDays = days
    .filter(d => d.grade === '대길' || d.grade === '길')
    .sort((a, b) => b.score - a.score);

  const cat = TAEKIL_CATEGORIES.find(c => c.id === category)!;
  const trimmedCustom = (customLabel ?? '').trim().slice(0, 30);
  const finalLabel = category === 'custom' && trimmedCustom
    ? `기타 — ${trimmedCustom}`
    : cat.label;

  return {
    category,
    categoryLabel: finalLabel,
    subItem: category !== 'custom' ? subItem : undefined,
    customLabel: category === 'custom' ? trimmedCustom : undefined,
    startDate,
    endDate,
    days,
    bestDays,
  };
}
