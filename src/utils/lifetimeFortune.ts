/**
 * 정통사주 평생 운세 흐름 (1~99세).
 *
 * 점수는 lifetimeFortuneScoring.ts 의 전용 함수로 계산 — 다른 카테고리(오늘운세·
 * 신년운세 등) 의 점수에 영향을 주지 않도록 격리되어 있다.
 */

import { computeLifetimeScore, lifetimeGrade, type LifetimeGrade } from './lifetimeFortuneScoring';
import type { SajuResult } from './sajuCalculator';

export type { LifetimeGrade };

export interface LifetimePoint {
  age: number;
  year: number;
  score: number;       // 15~98
  grade: LifetimeGrade;
  sewoonGanZhi: string;
  daewoonGanZhi: string;
  daewoonGan: string;
  daewoonZhi: string;
  isDaewoonStart: boolean;
}

export function computeLifetimeFortune(saju: SajuResult, maxAge: number = 99): LifetimePoint[] {
  const birthYearStr = saju.solarDate.slice(0, 4);
  const birthYear = parseInt(birthYearStr, 10);
  if (!Number.isFinite(birthYear)) return [];

  const points: LifetimePoint[] = [];
  for (let age = 1; age <= maxAge; age++) {
    const year = birthYear + age;
    const dw = saju.daeWoon.find((d) => age >= d.startAge && age < d.startAge + 10) ?? null;

    let score = 50;
    let yearGanZhi = '';
    try {
      const r = computeLifetimeScore(saju, year, dw);
      score = r.score;
      yearGanZhi = r.yearGanZhi;
    } catch {
      // 안전망 — 단일 연도 실패 시 차트 끊김 방지
    }

    points.push({
      age,
      year,
      score,
      grade: lifetimeGrade(score),
      sewoonGanZhi: yearGanZhi,
      daewoonGanZhi: dw ? `${dw.gan}${dw.zhi}` : '',
      daewoonGan: dw?.gan ?? '',
      daewoonZhi: dw?.zhi ?? '',
      isDaewoonStart: !!(dw && dw.startAge === age),
    });
  }
  return points;
}

/**
 * 평생 운세 흐름의 '현재' 마커 나이.
 * ★ 평생 흐름은 연(年) 기준 — 각 점의 year = birthYear + age (위 buildLifetimeFortune).
 *   그래서 '현재' 마커도 현재 '연도'에 정확히 맞춰야 한다(연나이 = 현재연도 - 출생연도).
 *   만나이를 쓰면 생일 전 사용자는 birthYear + 만나이 = 작년 연도로 찍혀 "2025년(현재)" 오류 발생.
 */
export function getCurrentAge(saju: SajuResult): number {
  const birthYear = parseInt(saju.solarDate.slice(0, 4), 10);
  if (!Number.isFinite(birthYear)) return 1;
  return Math.max(1, new Date().getFullYear() - birthYear);
}
