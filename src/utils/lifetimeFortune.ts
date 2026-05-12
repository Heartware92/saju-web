/**
 * 평생 운세 흐름 (1~99세) — 기존 calculatePeriodFortune 엔진 재사용.
 *
 * 매 나이마다 (출생연도 + age) 에 해당하는 세운 + 활성 대운으로 종합 점수를 산출한다.
 * 결과를 라인 차트로 시각화하여 인생 전반의 흐름을 한 눈에 보여준다.
 */

import { calculatePeriodFortune, type FortuneGrade } from '../engine/periodFortune';
import type { SajuResult } from './sajuCalculator';

export interface LifetimePoint {
  age: number;
  year: number;
  score: number;       // 0~100
  grade: FortuneGrade;
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
    let score = 50;
    let grade: FortuneGrade = '평';
    let sewoonGanZhi = '';
    try {
      const f = calculatePeriodFortune(saju, { scope: 'year', year });
      score = f.overallScore;
      grade = f.overallGrade;
      sewoonGanZhi = f.targetGanZhi.ganZhi;
    } catch {
      // 만약 일부 연도 계산 실패 시 기본값으로 처리 — 차트 끊김 방지
    }
    const dw = saju.daeWoon.find((d) => age >= d.startAge && age < d.startAge + 10);
    points.push({
      age,
      year,
      score,
      grade,
      sewoonGanZhi,
      daewoonGanZhi: dw ? `${dw.gan}${dw.zhi}` : '',
      daewoonGan: dw?.gan ?? '',
      daewoonZhi: dw?.zhi ?? '',
      isDaewoonStart: !!(dw && dw.startAge === age),
    });
  }
  return points;
}

/** 현재 만나이 (오늘 - 출생일) */
export function getCurrentAge(saju: SajuResult): number {
  const today = new Date();
  const birth = new Date(saju.solarDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return Math.max(1, age);
}
