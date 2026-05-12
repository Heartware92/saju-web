/**
 * 정통사주 평생 운세 흐름 전용 점수 함수.
 *
 * 기존 calculatePeriodFortune (오늘운세·신년운세 등 공용) 과 격리되어 있어
 * 가중치를 자유롭게 변경해도 다른 카테고리 점수에 영향 없음.
 *
 * 설계 목표: 변동폭 큰 곡선 — 흉운 해는 25~45, 평년 50~70, 대길은 85~95 분포.
 *
 * 점수 구성 (base 50 시작):
 *   1) 세운 천간 십신             (range +15 ~ -6)
 *   2) 세운 지지 본기 십신 × 0.6
 *   3) 대운 천간/지지 십신 (배경) ×0.5 / ×0.3
 *   4) 용신/희신/기신 적중        (가장 강한 영향, ±18)
 *   5) 4기둥 지지 × 세운 지지 (합/충/형/파/해)
 *   6) 일간 vs 세운 천간 (천간 5합 / 충극)
 *   7) 12운성 (일간 기준 세운 지지) — 절·태·사 등 큰 페널티
 *   8) 핵심 신살 (천을귀인 / 양인 / 도화)
 *
 * 최종 clamp: 15~98
 */

import { Solar } from 'lunar-javascript';
import {
  STEM_ELEMENT,
  BRANCH_ELEMENT,
  BRANCH_HIDDEN_STEMS,
  TEN_GODS_MAP,
  getTwelveStage,
  normalizeGan,
  normalizeZhi,
  type SajuResult,
  type DaeWoon,
} from './sajuCalculator';

// ============================================
// 가중치
// ============================================

const TEN_GOD_SCORE: Record<string, number> = {
  '정관': 15,
  '정인': 13,
  '정재': 12,
  '식신': 11,
  '편재': 8,
  '편인': 3,
  '비견': -1,
  '겁재': -5,
  '편관': -3,
  '상관': -6,
};

const TWELVE_STAGE_SCORE: Record<string, number> = {
  '장생': 5,
  '목욕': -3,
  '관대': 6,
  '건록': 8,
  '제왕': 10,
  '쇠': -2,
  '병': -7,
  '사': -10,
  '묘': -5,
  '절': -12,
  '태': -7,
  '양': 2,
};

// 지지 상호작용 가중치
const W_YUKCHUNG = -7; // 육충
const W_HYEONG = -4;   // 형
const W_PA = -3;       // 파
const W_HAE = -2;      // 해
const W_YUKHAP = 4;    // 육합
const W_BANHAP = 5;    // 반합 (삼합 중 2자)

// 천간 합/충
const W_STEM_HAP = 4;
const W_STEM_CHUNG = -6;

// 용신/희신/기신 가중치
const W_YONGSIN_GAN = 18;
const W_YONGSIN_ZHI = 12;
const W_HEESIN_GAN = 10;
const W_HEESIN_ZHI = 7;
const W_GISIN_GAN = -16;
const W_GISIN_ZHI = -11;
const W_DW_YONGSIN = 8;
const W_DW_GISIN = -7;

// 신살
const W_CHEONULGWIIN = 8;
const W_YANGIN = -4;
const W_DOHWA = -2;

// ============================================
// 상수
// ============================================

const YUKHAP: [string, string][] = [
  ['자', '축'], ['인', '해'], ['묘', '술'], ['진', '유'], ['사', '신'], ['오', '미'],
];
const YUKCHUNG: [string, string][] = [
  ['자', '오'], ['축', '미'], ['인', '신'], ['묘', '유'], ['진', '술'], ['사', '해'],
];
const SAMHAP_TRIOS: string[][] = [
  ['신', '자', '진'],
  ['사', '유', '축'],
  ['인', '오', '술'],
  ['해', '묘', '미'],
];
const HYEONG_PAIRS: [string, string][] = [
  ['인', '사'], ['사', '신'], ['인', '신'],
  ['축', '술'], ['술', '미'], ['축', '미'],
  ['자', '묘'],
];
const PA_PAIRS: [string, string][] = [
  ['자', '유'], ['오', '묘'], ['신', '사'], ['인', '해'], ['진', '축'], ['술', '미'],
];
const HAE_PAIRS: [string, string][] = [
  ['자', '미'], ['축', '오'], ['인', '사'], ['묘', '진'], ['신', '해'], ['유', '술'],
];

// 천간 5합 (좋은 결속·인연)
const STEM_HAP: [string, string][] = [
  ['갑', '기'], ['을', '경'], ['병', '신'], ['정', '임'], ['무', '계'],
];
// 천간 충(극) — 토(무·기)는 제외
const STEM_CHUNG: [string, string][] = [
  ['갑', '경'], ['을', '신'], ['병', '임'], ['정', '계'],
];

// 천을귀인 — 일간 기준 지지
const CHEONULGWIIN: Record<string, string[]> = {
  '갑': ['축', '미'], '무': ['축', '미'], '경': ['축', '미'],
  '을': ['자', '신'], '기': ['자', '신'],
  '병': ['해', '유'], '정': ['해', '유'],
  '신': ['인', '오'],
  '임': ['사', '묘'], '계': ['사', '묘'],
};

// 양인 — 양 일간 기준
const YANGIN: Record<string, string> = {
  '갑': '묘', '병': '오', '무': '오', '경': '유', '임': '자',
};

// 도화 — 년지/일지 삼합국 기준
const DOHWA_FROM_TRIO: Record<string, string> = {
  '사': '오', '유': '오', '축': '오',
  '신': '유', '자': '유', '진': '유',
  '인': '묘', '오': '묘', '술': '묘',
  '해': '자', '묘': '자', '미': '자',
};

// ============================================
// 헬퍼
// ============================================

function pairMatch(pairs: [string, string][], a: string, b: string): boolean {
  return pairs.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

function isHalfSamhap(a: string, b: string): boolean {
  if (a === b) return false;
  for (const trio of SAMHAP_TRIOS) {
    if (trio.includes(a) && trio.includes(b)) return true;
  }
  return false;
}

function yearGanZhi(year: number): { gan: string; zhi: string } {
  const solar = Solar.fromYmd(year, 6, 15);
  const lunar = solar.getLunar();
  const gz = lunar.getYearInGanZhi();
  return {
    gan: normalizeGan(gz[0]),
    zhi: normalizeZhi(gz[1]),
  };
}

// ============================================
// 메인
// ============================================

export interface LifetimeScoreResult {
  score: number;        // 15~98
  yearGan: string;
  yearZhi: string;
  yearGanZhi: string;
}

export function computeLifetimeScore(
  saju: SajuResult,
  year: number,
  daewoon: DaeWoon | null,
): LifetimeScoreResult {
  let score = 50;

  const { gan: yearGan, zhi: yearZhi } = yearGanZhi(year);
  const yearGanElement = STEM_ELEMENT[yearGan] ?? '';
  const yearZhiElement = BRANCH_ELEMENT[yearZhi] ?? '';
  const dayGan = saju.dayMaster;

  // 1) 세운 천간 십신
  const yearGanTG = TEN_GODS_MAP[dayGan]?.[yearGan] ?? '';
  score += TEN_GOD_SCORE[yearGanTG] ?? 0;

  // 2) 세운 지지 본기 십신 × 0.6
  const yearZhiMain = BRANCH_HIDDEN_STEMS[yearZhi]?.[0];
  if (yearZhiMain) {
    const yzhTG = TEN_GODS_MAP[dayGan]?.[yearZhiMain] ?? '';
    score += (TEN_GOD_SCORE[yzhTG] ?? 0) * 0.6;
  }

  // 3) 대운 영향 (배경)
  if (daewoon) {
    const dwGanTG = TEN_GODS_MAP[dayGan]?.[daewoon.gan] ?? '';
    score += (TEN_GOD_SCORE[dwGanTG] ?? 0) * 0.5;
    const dwZhiMain = BRANCH_HIDDEN_STEMS[daewoon.zhi]?.[0];
    if (dwZhiMain) {
      const dwZhiTG = TEN_GODS_MAP[dayGan]?.[dwZhiMain] ?? '';
      score += (TEN_GOD_SCORE[dwZhiTG] ?? 0) * 0.3;
    }
  }

  // 4) 용신/희신/기신
  const yongsin = saju.yongSinElement;
  const heesin = saju.heeSin;
  const gisin = saju.giSin;

  if (yearGanElement === yongsin) score += W_YONGSIN_GAN;
  else if (yearGanElement === heesin) score += W_HEESIN_GAN;
  else if (yearGanElement === gisin) score += W_GISIN_GAN;

  if (yearZhiElement === yongsin) score += W_YONGSIN_ZHI;
  else if (yearZhiElement === heesin) score += W_HEESIN_ZHI;
  else if (yearZhiElement === gisin) score += W_GISIN_ZHI;

  if (daewoon) {
    const dwGanElement = STEM_ELEMENT[daewoon.gan] ?? '';
    if (dwGanElement === yongsin) score += W_DW_YONGSIN;
    else if (dwGanElement === gisin) score += W_DW_GISIN;
  }

  // 5) 4기둥 지지 × 세운 지지
  const pillarZhis = [
    saju.pillars.year.zhi,
    saju.pillars.month.zhi,
    saju.pillars.day.zhi,
    saju.pillars.hour.zhi,
  ].filter(Boolean);

  for (const pz of pillarZhis) {
    if (pairMatch(YUKCHUNG, pz, yearZhi)) {
      score += W_YUKCHUNG;
    } else if (pairMatch(HYEONG_PAIRS, pz, yearZhi)) {
      score += W_HYEONG;
    } else if (pairMatch(PA_PAIRS, pz, yearZhi)) {
      score += W_PA;
    } else if (pairMatch(HAE_PAIRS, pz, yearZhi)) {
      score += W_HAE;
    } else if (pairMatch(YUKHAP, pz, yearZhi)) {
      score += W_YUKHAP;
    } else if (isHalfSamhap(pz, yearZhi)) {
      score += W_BANHAP;
    }
  }

  // 6) 일간 vs 세운 천간 합/충
  if (pairMatch(STEM_HAP, dayGan, yearGan)) score += W_STEM_HAP;
  if (pairMatch(STEM_CHUNG, dayGan, yearGan)) score += W_STEM_CHUNG;

  // 7) 12운성 (일간 기준 세운 지지)
  try {
    const stage = getTwelveStage(dayGan, yearZhi);
    score += TWELVE_STAGE_SCORE[stage] ?? 0;
  } catch {
    // 안전망 — 12운성 계산 실패 시 무시
  }

  // 8) 신살
  if (CHEONULGWIIN[dayGan]?.includes(yearZhi)) score += W_CHEONULGWIIN;
  if (YANGIN[dayGan] === yearZhi) score += W_YANGIN;
  const dohwaTarget =
    DOHWA_FROM_TRIO[saju.pillars.day.zhi] ?? DOHWA_FROM_TRIO[saju.pillars.year.zhi];
  if (dohwaTarget && dohwaTarget === yearZhi) score += W_DOHWA;

  const finalScore = Math.max(15, Math.min(98, Math.round(score)));

  return {
    score: finalScore,
    yearGan,
    yearZhi,
    yearGanZhi: `${yearGan}${yearZhi}`,
  };
}

// 점수 → 등급
export type LifetimeGrade = '대길' | '길' | '중길' | '평' | '중흉' | '흉';

export function lifetimeGrade(score: number): LifetimeGrade {
  if (score >= 85) return '대길';
  if (score >= 72) return '길';
  if (score >= 60) return '중길';
  if (score >= 45) return '평';
  if (score >= 32) return '중흉';
  return '흉';
}
