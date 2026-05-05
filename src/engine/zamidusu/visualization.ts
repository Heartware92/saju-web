/**
 * 자미두수(紫微斗數) 명반 → 시각화 데이터 산출
 *
 * 명반의 객관 데이터(brightness, mutagen, 보좌성)를 가중합으로 환산해
 * 6궁 점수, 사화 위치, 대한 흐름을 도출한다. AI 호출 없이 명반 자체에서
 * 계산되므로 결과가 풀이 텍스트와 무관하게 일관된다.
 */

import type { ZamidusuResult, ZamidusuPalace, ZamidusuStar } from '../zamidusu';
import { MAJOR_STARS_META, MUTAGEN_META, MINOR_STARS_META } from './knowledge';

// ============================================
// brightness 점수표 (iztro 한국어 로케일 기준)
// 묘=가장 밝음 → 함=가장 어두움
// ============================================

const BRIGHTNESS_SCORE: Record<string, number> = {
  '묘': 22,
  '왕': 18,
  '지': 14,
  '득': 14,
  '이': 10,
  '평': 6,
  '불': 0,
  '함': -8,
};

const POLARITY_BIAS: Record<string, number> = {
  '선': 6,
  '중': 0,
  '부': -6,
};

const MUTAGEN_DELTA: Record<string, number> = {
  '화록': 14,
  '화권': 12,
  '화과': 10,
  '화기': -16,
};

const MINOR_DELTA: Record<string, number> = {
  '6길성': 5,
  '4흉성': -6,
  '기타': 2,
};

// ============================================
// 단일 궁 점수 (0~100)
// ============================================

function scoreOfStar(star: ZamidusuStar): number {
  const meta = MAJOR_STARS_META[star.name];
  const polarity = meta ? POLARITY_BIAS[meta.polarity] ?? 0 : 0;
  const bright = star.brightness ? BRIGHTNESS_SCORE[star.brightness] ?? 0 : 0;
  const mut = star.mutagen ? MUTAGEN_DELTA[star.mutagen] ?? 0 : 0;
  return polarity + bright + mut;
}

function scoreOfMinor(star: ZamidusuStar): number {
  const meta = MINOR_STARS_META[star.name];
  if (!meta) return 0;
  const base = MINOR_DELTA[meta.category] ?? 0;
  const mut = star.mutagen ? MUTAGEN_DELTA[star.mutagen] ?? 0 : 0;
  return base + mut;
}

export function scorePalace(palace: ZamidusuPalace): number {
  let raw = 50;
  if (palace.majorStars.length === 0) {
    raw -= 4;
  } else {
    palace.majorStars.forEach((s) => { raw += scoreOfStar(s); });
  }
  palace.minorStars.forEach((s) => { raw += scoreOfMinor(s); });
  if (palace.isOriginalPalace) raw += 3;
  const clamped = Math.max(8, Math.min(96, Math.round(raw)));
  return liftScore(clamped);
}

function liftScore(raw: number): number {
  const t = (raw - 8) / 88;
  const curved = Math.pow(t, 0.72);
  return Math.round(30 + curved * 66);
}

// ============================================
// 6궁 핵심 점수
// ============================================

export const CORE_PALACE_KEYS = [
  '명궁',
  '재백궁',
  '관록궁',
  '부처궁',
  '전택궁',
  '복덕궁',
] as const;
export type CorePalaceKey = typeof CORE_PALACE_KEYS[number];

export const CORE_PALACE_LABEL: Record<CorePalaceKey, string> = {
  '명궁': '본질',
  '재백궁': '재물',
  '관록궁': '직업',
  '부처궁': '인연',
  '전택궁': '터전',
  '복덕궁': '마음',
};

export interface CoreScore {
  key: CorePalaceKey;
  label: string;
  palaceName: CorePalaceKey;
  score: number;
  headline: string;
}

function headlineForCore(key: CorePalaceKey, score: number): string {
  if (score >= 75) {
    return ({
      '명궁':   '주인공 별이 환하게 떠 있다',
      '재백궁': '재물의 흐름이 단단하다',
      '관록궁': '커리어의 별이 길을 비춘다',
      '부처궁': '인연의 자리가 따뜻하다',
      '전택궁': '안식처가 든든히 자리잡는다',
      '복덕궁': '마음의 평안이 깊다',
    } as Record<CorePalaceKey, string>)[key];
  }
  if (score >= 55) {
    return ({
      '명궁':   '본질의 빛이 차분하게 깃든다',
      '재백궁': '재물의 결이 안정적으로 흐른다',
      '관록궁': '쌓아온 길이 차곡차곡 이어진다',
      '부처궁': '관계의 결이 무난하게 풀린다',
      '전택궁': '터전이 큰 흔들림 없이 안정',
      '복덕궁': '내면이 잔잔히 흐른다',
    } as Record<CorePalaceKey, string>)[key];
  }
  if (score >= 40) {
    return ({
      '명궁':   '본질을 갈고닦을 시기',
      '재백궁': '재물은 가꾸어야 자란다',
      '관록궁': '직업의 결을 다듬을 때',
      '부처궁': '관계는 말로 다져야 한다',
      '전택궁': '터전을 매만지는 손길이 필요',
      '복덕궁': '마음에 여백을 두어야 한다',
    } as Record<CorePalaceKey, string>)[key];
  }
  return ({
    '명궁':   '본질의 별이 시험을 받는다',
    '재백궁': '돈의 흐름에 주의 필요',
    '관록궁': '직업 환경에 변동이 따른다',
    '부처궁': '관계의 결을 살펴야 할 시기',
    '전택궁': '터전에 손이 많이 간다',
    '복덕궁': '마음의 무게가 무거울 수 있다',
  } as Record<CorePalaceKey, string>)[key];
}

export function calcCoreScores(chart: ZamidusuResult): CoreScore[] {
  return CORE_PALACE_KEYS.map((key) => {
    const palace = chart.palaces.find((p) => p.name === key);
    const score = palace ? scorePalace(palace) : 50;
    return {
      key,
      label: CORE_PALACE_LABEL[key],
      palaceName: key,
      score,
      headline: headlineForCore(key, score),
    };
  });
}

// ============================================
// 사화(四化) 위치
// ============================================

export const MUTAGEN_ORDER = ['화록', '화권', '화과', '화기'] as const;
export type MutagenName = typeof MUTAGEN_ORDER[number];

export interface MutagenPlacement {
  name: MutagenName;
  hanja: string;
  starName: string;     // 어떤 별에 사화가 붙었나
  palaceName: string;   // 어느 궁에 떨어졌나
  palaceDomain: string; // 그 궁의 영역
  effect: string;
  positive: string;
  caution: string;
  tone: 'positive' | 'caution';
}

const PALACE_DOMAIN_SHORT: Record<string, string> = {
  '명궁': '본질·삶의 방향',
  '형제궁': '형제·동료',
  '부처궁': '배우자·연인',
  '자녀궁': '자녀·창작',
  '재백궁': '돈의 흐름',
  '질액궁': '건강·체질',
  '천이궁': '이동·외부',
  '노복궁': '친구·인맥',
  '관록궁': '직업·지위',
  '전택궁': '집·부동산',
  '복덕궁': '마음·여가',
  '부모궁': '부모·윗사람',
};

export function calcMutagenPlacements(chart: ZamidusuResult): MutagenPlacement[] {
  const placements: MutagenPlacement[] = [];
  const seen = new Set<string>();

  chart.palaces.forEach((p) => {
    [...p.majorStars, ...p.minorStars].forEach((s) => {
      if (!s.mutagen) return;
      if (seen.has(s.mutagen)) return;
      const meta = MUTAGEN_META[s.mutagen];
      if (!meta) return;
      seen.add(s.mutagen);
      placements.push({
        name: s.mutagen as MutagenName,
        hanja: meta.hanja,
        starName: s.name,
        palaceName: p.name,
        palaceDomain: PALACE_DOMAIN_SHORT[p.name] ?? p.name,
        effect: meta.effect,
        positive: meta.positive,
        caution: meta.caution,
        tone: s.mutagen === '화기' ? 'caution' : 'positive',
      });
    });
  });

  return MUTAGEN_ORDER
    .map((name) => placements.find((m) => m.name === name))
    .filter((m): m is MutagenPlacement => !!m);
}

// ============================================
// 대한(大限) 타임라인 — 0~80세 구간을 점수화
// ============================================

export interface DaehanSegment {
  palaceName: string;   // 그 대한이 머무는 궁
  startAge: number;
  endAge: number;
  score: number;
  isCurrent: boolean;
  headline: string;
}

function headlineForDaehan(palaceName: string, score: number): string {
  const domain = PALACE_DOMAIN_SHORT[palaceName] ?? palaceName;
  if (score >= 75) return `${domain}의 별이 무르익는 시기`;
  if (score >= 60) return `${domain}이 차분하게 흐르는 시기`;
  if (score >= 45) return `${domain}을 다듬는 시기`;
  return `${domain}의 결을 점검할 시기`;
}

export function calcDaehanTimeline(chart: ZamidusuResult, currentAge: number): DaehanSegment[] {
  const segments: DaehanSegment[] = [];

  chart.palaces.forEach((p) => {
    if (!p.ages || p.ages.length === 0) return;
    const startAge = Math.min(...p.ages);
    const endAge = Math.max(...p.ages);
    const score = scorePalace(p);
    const isCurrent = currentAge >= startAge && currentAge <= endAge;
    segments.push({
      palaceName: p.name,
      startAge,
      endAge,
      score,
      isCurrent,
      headline: headlineForDaehan(p.name, score),
    });
  });

  segments.sort((a, b) => a.startAge - b.startAge);
  return segments.slice(0, 8);
}

// ============================================
// 종합 점수 — 6궁 가중평균 (명궁·재백·관록 강조)
// ============================================

export function calcOverallScore(coreScores: CoreScore[]): number {
  const weights: Record<CorePalaceKey, number> = {
    '명궁': 1.6,
    '재백궁': 1.2,
    '관록궁': 1.2,
    '부처궁': 1.0,
    '전택궁': 0.8,
    '복덕궁': 1.0,
  };
  let sum = 0;
  let wsum = 0;
  coreScores.forEach((s) => {
    const w = weights[s.key];
    sum += s.score * w;
    wsum += w;
  });
  return Math.round(sum / wsum);
}
