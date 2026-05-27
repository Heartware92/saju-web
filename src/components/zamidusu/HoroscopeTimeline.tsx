'use client';

/**
 * 유년·유월 시기 예측 타임라인.
 *
 * 자운파 색채 — 자미두수 정통 시기 단위(대한·유년·유월·유일)를
 * 사용자가 즉시 알아보는 연도/월 라벨로 시각화. 각 시점의 천간·지지·사화(4개 별)
 * 노출. 사화는 색상 칩(록=금색, 권=보라, 과=초록, 기=빨강)으로 구분.
 *
 * 데이터 소스: engine/zamidusu/horoscope.ts
 */

import type { YearlyHoroscope, MonthlyHoroscope } from '../../engine/zamidusu/horoscope';

const MUTAGEN_COLOR: Record<string, string> = {
  록: '#fbbf24', // 금
  권: '#a78bfa', // 보라
  과: '#34d399', // 초록
  기: '#f87171', // 빨강
};

function MutagenChip({ type, star }: { type: '록' | '권' | '과' | '기'; star: string }) {
  if (!star) return null;
  const color = MUTAGEN_COLOR[type];
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded"
      style={{ backgroundColor: `${color}1f`, color, border: `1px solid ${color}55` }}
    >
      <span className="font-semibold">{type}</span>
      <span>{star}</span>
    </span>
  );
}

interface YearlyProps {
  horoscopes: YearlyHoroscope[];
}

export function YearlyTimeline({ horoscopes }: YearlyProps) {
  if (horoscopes.length === 0) return null;
  return (
    <div className="rounded-2xl bg-space-surface border border-[var(--border-subtle)] p-5">
      <h3
        className="text-base font-bold text-text-primary mb-1"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        유년(流年) 시기 예측
      </h3>
      <p className="text-xs text-text-tertiary mb-4">
        연도별 사화 비행 — 그 해의 주된 흐름(록·권·과)과 주의(기)
      </p>
      <div className="space-y-3">
        {horoscopes.map((y) => (
          <div
            key={y.year}
            className="flex items-start gap-3 pb-3 border-b border-[var(--border-subtle)] last:border-b-0 last:pb-0"
          >
            <div className="flex-shrink-0 w-16">
              <div className="text-sm font-bold text-text-primary">{y.year}년</div>
              <div className="text-[11px] text-text-tertiary">{y.approxAge}세</div>
              <div className="text-[11px] text-cta mt-0.5">{y.heavenlyStem}{y.earthlyBranch}</div>
            </div>
            <div className="flex-1 flex flex-wrap gap-1.5">
              <MutagenChip type="록" star={y.mutagen.록} />
              <MutagenChip type="권" star={y.mutagen.권} />
              <MutagenChip type="과" star={y.mutagen.과} />
              <MutagenChip type="기" star={y.mutagen.기} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface MonthlyProps {
  year: number;
  horoscopes: MonthlyHoroscope[];
}

export function MonthlyTimeline({ year, horoscopes }: MonthlyProps) {
  if (horoscopes.length === 0) return null;
  return (
    <div className="rounded-2xl bg-space-surface border border-[var(--border-subtle)] p-5">
      <h3
        className="text-base font-bold text-text-primary mb-1"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        유월(流月) 시기 예측 · {year}년
      </h3>
      <p className="text-xs text-text-tertiary mb-4">
        월별 사화 비행 — 즉각 의사결정 단위
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {horoscopes.map((m) => (
          <div
            key={m.month}
            className="rounded-lg bg-space-deep p-2.5"
          >
            <div className="flex items-baseline justify-between mb-1.5">
              <div className="text-sm font-bold text-text-primary">{m.month}월</div>
              <div className="text-[10px] text-cta">{m.heavenlyStem}{m.earthlyBranch}</div>
            </div>
            <div className="flex flex-wrap gap-1">
              <MutagenChip type="록" star={m.mutagen.록} />
              <MutagenChip type="권" star={m.mutagen.권} />
              <MutagenChip type="과" star={m.mutagen.과} />
              <MutagenChip type="기" star={m.mutagen.기} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
