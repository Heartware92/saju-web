'use client';

/**
 * 유년·유월 시기 예측 타임라인.
 *
 * 자운파 색채 — 자미두수 정통 시기 단위(대한·유년·유월·유일)를
 * 사용자가 즉시 알아보는 연도/월 라벨로 시각화.
 *
 * 각 시점:
 *  - 사화 4개 비행 (록·권·과·기 별)
 *  - 종합 점수 게이지 (사화 polarity 가중) — 신년운세 ScoreGauge 스타일 통일
 *  - 천간·지지 라벨
 *
 * 데이터 소스: engine/zamidusu/horoscope.ts
 */

import type { YearlyHoroscope, MonthlyHoroscope } from '../../engine/zamidusu/horoscope';
import { MAJOR_STARS_META } from '../../engine/zamidusu/knowledge';

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

/**
 * 시기별 종합 점수 산출 — 사화 4개 비행 별의 polarity 가중 합.
 * 록·권·과는 + (별이 길성일수록 강한 +), 기는 - (별이 길성일수록 강한 -).
 * 범위: 0~100, 기본 50.
 */
function calcWindowScore(mutagen: { 록: string; 권: string; 과: string; 기: string }): number {
  const polW = (star: string): number => {
    const p = MAJOR_STARS_META[star]?.polarity;
    return p === '선' ? 1 : p === '중' ? 0.6 : p === '부' ? 0.3 : 0.5;
  };
  let s = 50;
  if (mutagen.록) s += polW(mutagen.록) * 12;
  if (mutagen.권) s += polW(mutagen.권) * 10;
  if (mutagen.과) s += polW(mutagen.과) * 8;
  if (mutagen.기) s -= polW(mutagen.기) * 16;
  return Math.max(0, Math.min(100, Math.round(s)));
}

function scoreColor(score: number): string {
  if (score >= 60) return '#34d399';
  if (score >= 45) return '#fbbf24';
  return '#f87171';
}

function scoreLabel(score: number): string {
  if (score >= 75) return '대길';
  if (score >= 60) return '길';
  if (score >= 45) return '평';
  if (score >= 30) return '주의';
  return '흉';
}

/** 점수 게이지 막대 — 신년운세 ScoreGauge 스타일 통일 */
function ScoreBar({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const color = scoreColor(score);
  const label = scoreLabel(score);
  const height = size === 'sm' ? 4 : 6;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full bg-space-deep overflow-hidden" style={{ height }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span
        className={`${size === 'sm' ? 'text-[10px]' : 'text-[11px]'} font-bold whitespace-nowrap`}
        style={{ color }}
      >
        {score} · {label}
      </span>
    </div>
  );
}

interface YearlyProps {
  horoscopes: YearlyHoroscope[];
}

export function YearlyTimeline({ horoscopes }: YearlyProps) {
  if (horoscopes.length === 0) return null;
  return (
    <div className="rounded-2xl bg-space-surface border border-[var(--border-subtle)] p-5">
      <h3 className="text-base font-bold text-text-primary mb-1" style={{ fontFamily: 'var(--font-serif)' }}>
        유년(流年) 시기 예측
      </h3>
      <p className="text-xs text-text-tertiary mb-4">
        연도별 사화 비행 + 종합 점수 — 그 해의 주된 흐름
      </p>
      <div className="space-y-4">
        {horoscopes.map((y) => {
          const score = calcWindowScore(y.mutagen);
          return (
            <div key={y.year} className="pb-4 border-b border-[var(--border-subtle)] last:border-b-0 last:pb-0">
              <div className="flex items-start gap-3 mb-2">
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
              <ScoreBar score={score} />
            </div>
          );
        })}
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
      <h3 className="text-base font-bold text-text-primary mb-1" style={{ fontFamily: 'var(--font-serif)' }}>
        유월(流月) 시기 예측 · {year}년
      </h3>
      <p className="text-xs text-text-tertiary mb-4">
        월별 사화 비행 + 점수 — 즉각 의사결정 단위
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {horoscopes.map((m) => {
          const score = calcWindowScore(m.mutagen);
          return (
            <div key={m.month} className="rounded-lg bg-space-deep p-2.5">
              <div className="flex items-baseline justify-between mb-1.5">
                <div className="text-sm font-bold text-text-primary">{m.month}월</div>
                <div className="text-[10px] text-cta">{m.heavenlyStem}{m.earthlyBranch}</div>
              </div>
              <div className="flex flex-wrap gap-1 mb-1.5">
                <MutagenChip type="록" star={m.mutagen.록} />
                <MutagenChip type="권" star={m.mutagen.권} />
                <MutagenChip type="과" star={m.mutagen.과} />
                <MutagenChip type="기" star={m.mutagen.기} />
              </div>
              <ScoreBar score={score} size="sm" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
