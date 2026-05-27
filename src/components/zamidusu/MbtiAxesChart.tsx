'use client';

/**
 * MBTI식 4축 정량 그래프 — 청월당 벤치마크.
 *
 * 자미두수 14주성 성정을 4개 축으로 변환해 사용자가 자기 성향을 빠르게 파악.
 *   - 활동: 외향(A) vs 내향(B)
 *   - 판단: 이성(A) vs 감성(B)
 *   - 지향: 안정(A) vs 변동(B)
 *   - 행동: 주도(A) vs 수용(B)
 *
 * 산출 방식: 명궁 + 신궁(다르면) 주성의 4축 가중치를 합산해서
 * 백분율로 변환. 보조성·사화는 다음 버전에서 반영 예정.
 *
 * 학파/저자에 따라 매핑이 다를 수 있으나, 본 점수는 자미두수
 * 정통 별 성정(MAJOR_STARS_META.keywords·strength)에 기반함.
 */

import type { ZamidusuPalace } from '../../engine/zamidusu';

type AxisKey = 'activity' | 'thinking' | 'orientation' | 'action';

/**
 * 별 → 4축 점수.
 * 값 범위: -3 (B쪽 강함) ~ +3 (A쪽 강함). 0은 중립.
 *
 * 축 의미:
 *   - activity: +값=외향, -값=내향
 *   - thinking: +값=이성, -값=감성
 *   - orientation: +값=안정, -값=변동
 *   - action: +값=주도, -값=수용
 */
const STAR_AXIS_SCORES: Record<string, Record<AxisKey, number>> = {
  자미: { activity:  1, thinking:  2, orientation:  1, action:  3 },
  천기: { activity:  1, thinking:  3, orientation: -2, action: -1 },
  태양: { activity:  3, thinking:  2, orientation:  1, action:  2 },
  무곡: { activity:  1, thinking:  3, orientation:  1, action:  3 },
  천동: { activity: -1, thinking: -2, orientation:  2, action: -2 },
  염정: { activity:  1, thinking: -2, orientation: -1, action:  1 },
  천부: { activity: -1, thinking:  2, orientation:  3, action: -1 },
  태음: { activity: -3, thinking: -2, orientation:  2, action: -2 },
  탐랑: { activity:  2, thinking: -1, orientation: -2, action:  1 },
  거문: { activity: -1, thinking:  2, orientation:  0, action:  1 },
  천상: { activity: -1, thinking:  1, orientation:  2, action: -1 },
  천량: { activity: -1, thinking:  1, orientation:  2, action: -1 },
  칠살: { activity:  2, thinking:  1, orientation: -2, action:  3 },
  파군: { activity:  2, thinking:  0, orientation: -3, action:  2 },
};

interface AxisLabel {
  key: AxisKey;
  label: string;
  sideA: string;
  sideB: string;
}

const AXES: AxisLabel[] = [
  { key: 'activity',    label: '활동', sideA: '외향', sideB: '내향' },
  { key: 'thinking',    label: '판단', sideA: '이성', sideB: '감성' },
  { key: 'orientation', label: '지향', sideA: '안정', sideB: '변동' },
  { key: 'action',      label: '행동', sideA: '주도', sideB: '수용' },
];

/** 명궁 + 신궁(다르면) 주성으로 4축 백분율 산출 */
function computePercentages(palaces: ZamidusuPalace[]): Record<AxisKey, number> {
  const myeong = palaces.find((p) => p.name === '명궁');
  const sin = palaces.find((p) => p.isBodyPalace);
  const stars: string[] = [];
  myeong?.majorStars.forEach((s) => stars.push(s.name));
  if (sin && sin.name !== '명궁') sin.majorStars.forEach((s) => stars.push(s.name));

  const sums: Record<AxisKey, number> = { activity: 0, thinking: 0, orientation: 0, action: 0 };
  let count = 0;
  stars.forEach((name) => {
    const score = STAR_AXIS_SCORES[name];
    if (!score) return;
    sums.activity    += score.activity;
    sums.thinking    += score.thinking;
    sums.orientation += score.orientation;
    sums.action      += score.action;
    count += 1;
  });

  // 별이 하나도 없으면 모두 50% (공궁)
  if (count === 0) {
    return { activity: 50, thinking: 50, orientation: 50, action: 50 };
  }

  // -3*count ~ +3*count 범위를 0~100으로 변환 (A쪽이 클수록 0에 가깝게)
  const maxAbs = 3 * count;
  const toPct = (v: number) => Math.round(((v + maxAbs) / (2 * maxAbs)) * 100);
  return {
    activity:    toPct(sums.activity),
    thinking:    toPct(sums.thinking),
    orientation: toPct(sums.orientation),
    action:      toPct(sums.action),
  };
}

interface Props {
  palaces: ZamidusuPalace[];
}

export function MbtiAxesChart({ palaces }: Props) {
  const pcts = computePercentages(palaces);

  return (
    <div className="rounded-2xl bg-space-surface border border-[var(--border-subtle)] p-5">
      <h3
        className="text-base font-bold text-text-primary mb-4 text-center"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        타고난 나의 성향
      </h3>
      <div className="space-y-4">
        {AXES.map((axis) => {
          const aPct = pcts[axis.key];
          const bPct = 100 - aPct;
          return (
            <div key={axis.key}>
              <div className="flex justify-between text-[11px] text-text-tertiary mb-1.5">
                <span>{axis.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-text-secondary w-12 text-right">
                  {axis.sideA} <strong className="text-cta">{aPct}%</strong>
                </span>
                <div className="flex-1 h-2 rounded-full bg-space-deep overflow-hidden flex">
                  <div
                    className="bg-cta"
                    style={{ width: `${aPct}%` }}
                  />
                  <div
                    className="bg-[#a78bfa]"
                    style={{ width: `${bPct}%` }}
                  />
                </div>
                <span className="text-[12px] text-text-secondary w-12">
                  <strong className="text-[#c4b5fd]">{bPct}%</strong> {axis.sideB}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
