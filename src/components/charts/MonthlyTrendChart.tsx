'use client';

/**
 * 월별 흐름 차트 — 12개월 운세 점수 곡선.
 *
 * LifetimeFortuneChart(평생 운세 흐름) 와 동일한 인터랙션 패턴:
 *  · 차트를 터치/클릭하거나 마우스를 올리면 해당 월이 선택됨
 *  · 선택된 월의 점수·등급·키워드·간지·십성을 상단 카드에 표시
 *  · 선택 월 마커(세로선 + 강조 점 + 점수 라벨) 표시
 */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { FortuneGrade, MonthlyFlowItem } from '../../engine/periodFortune';

interface MonthlyTrendChartProps {
  /** buildMonthlyFlow 결과 — score 포함 */
  data: MonthlyFlowItem[];
  className?: string;
}

const GRADE_COLOR: Record<FortuneGrade, string> = {
  '대길': '#34D399',
  '길': '#86EFAC',
  '중길': '#FBBF24',
  '평': '#CBD5E1',
  '중흉': '#FB923C',
  '흉': '#F87171',
};

export function MonthlyTrendChart({ data, className = '' }: MonthlyTrendChartProps) {
  const currentMonth = new Date().getMonth() + 1;
  // 데이터에 현재 월이 있으면 그걸, 없으면 첫 월을 기본 선택
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    if (data.some((d) => d.month === currentMonth)) return currentMonth;
    return data[0]?.month ?? 1;
  });

  const W = 340;
  const H = 188;
  const padL = 20;
  const padR = 20;
  const padT = 18;
  const padB = 46;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // score 기반 — 60~95 범위를 0~100 plot 스케일로 정규화 (변별력 ↑)
  const SCORE_MIN = 55;
  const SCORE_MAX = 100;
  const norm = (s: number) => ((s - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100;

  const points = useMemo(
    () =>
      data.map((d, i) => {
        const x = padL + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2);
        const y = padT + plotH - (norm(d.score) / 100) * plotH;
        return { x, y, ...d };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );

  if (points.length === 0) return null;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${padT + plotH} L${points[0].x},${padT + plotH} Z`;

  const selected = points.find((p) => p.month === selectedMonth) ?? points[0];

  // 포인터 X → 가장 가까운 월
  const handlePointer = (clientX: number, target: SVGSVGElement) => {
    const rect = target.getBoundingClientRect();
    const scale = W / rect.width;
    const svgX = (clientX - rect.left) * scale;
    let nearest = points[0];
    let minDist = Infinity;
    for (const p of points) {
      const d = Math.abs(p.x - svgX);
      if (d < minDist) {
        minDist = d;
        nearest = p;
      }
    }
    setSelectedMonth(nearest.month);
  };

  const avgScore = Math.round(data.reduce((s, d) => s + d.score, 0) / data.length);
  const best = data.reduce((a, b) => (b.score > a.score ? b : a));
  const worst = data.reduce((a, b) => (b.score < a.score ? b : a));

  return (
    <div className={className}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[14px] font-bold text-text-secondary">월별 흐름 그래프</span>
        <span className="text-[12.5px] text-text-tertiary">
          평균 <span className="text-text-secondary font-semibold">{avgScore}</span>점
        </span>
      </div>

      {/* 선택 월 카드 */}
      <div className="mb-3 rounded-xl px-4 py-3 bg-[rgba(124,92,252,0.10)] border border-[rgba(124,92,252,0.32)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-2">
            <span
              className="text-[22px] font-bold text-text-primary"
              style={{ fontFamily: 'var(--font-title)' }}
            >
              {selected.month}월
            </span>
            <span className="text-[13px] text-text-tertiary">{selected.keyword}</span>
            {selected.month === currentMonth && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-cta/20 text-cta font-semibold">
                이번 달
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-[27px] font-bold leading-none"
              style={{ color: GRADE_COLOR[selected.grade] }}
            >
              {selected.score}
            </span>
            <span className="text-[12px] text-text-tertiary">점</span>
            <span
              className="text-[14px] font-bold ml-0.5"
              style={{ color: GRADE_COLOR[selected.grade] }}
            >
              · {selected.grade}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 pt-2 border-t border-[rgba(124,92,252,0.18)]">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[12px] text-text-tertiary">간지</span>
            <span
              className="text-[15px] font-bold text-text-primary"
              style={{ fontFamily: 'var(--font-title)' }}
            >
              {selected.gan}{selected.zhi}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[12px] text-text-tertiary">십성</span>
            <span
              className="text-[15px] font-bold text-text-primary"
              style={{ fontFamily: 'var(--font-title)' }}
            >
              {selected.tenGod || '-'}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[12px] text-text-tertiary">12운성</span>
            <span
              className="text-[15px] font-bold text-text-primary"
              style={{ fontFamily: 'var(--font-title)' }}
            >
              {selected.twelveStage || '-'}
            </span>
          </div>
        </div>
      </div>

      {/* 차트 — 터치/클릭/호버로 월 선택 */}
      <div className="overflow-x-auto overflow-y-hidden">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="mx-auto"
          style={{ minWidth: W, cursor: 'pointer', touchAction: 'pan-y' }}
          onClick={(e) => handlePointer(e.clientX, e.currentTarget)}
          onMouseMove={(e) => {
            if (e.buttons === 0) handlePointer(e.clientX, e.currentTarget);
          }}
          onTouchStart={(e) => {
            if (e.touches[0]) handlePointer(e.touches[0].clientX, e.currentTarget);
          }}
          onTouchMove={(e) => {
            if (e.touches[0]) handlePointer(e.touches[0].clientX, e.currentTarget);
          }}
        >
          <defs>
            <linearGradient id="monthly-trend-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(139,92,246,0.35)" />
              <stop offset="100%" stopColor="rgba(139,92,246,0.02)" />
            </linearGradient>
          </defs>

          {/* 가로 보조선 */}
          {[100, 67, 33].map((val) => {
            const y = padT + plotH - (val / 100) * plotH;
            return (
              <line
                key={val}
                x1={padL}
                y1={y}
                x2={padL + plotW}
                y2={y}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth={0.5}
                strokeDasharray="4,4"
              />
            );
          })}

          {/* 영역 */}
          <motion.path
            d={areaPath}
            fill="url(#monthly-trend-grad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          />

          {/* 곡선 */}
          <motion.path
            d={linePath}
            fill="none"
            stroke="rgba(139,92,246,0.8)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />

          {/* 선택 월 마커 — 세로선 + 점수 라벨 */}
          {(() => {
            const c = GRADE_COLOR[selected.grade];
            return (
              <g>
                <line
                  x1={selected.x}
                  x2={selected.x}
                  y1={padT}
                  y2={padT + plotH}
                  stroke={c}
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  opacity={0.7}
                />
                <circle cx={selected.x} cy={selected.y} r={6} fill={c} opacity={0.25} />
                <circle
                  cx={selected.x}
                  cy={selected.y}
                  r={4}
                  fill={c}
                  stroke="rgba(15,10,30,0.9)"
                  strokeWidth={1.5}
                />
              </g>
            );
          })()}

          {/* 데이터 점 + 월 라벨 */}
          {points.map((p, i) => (
            <g key={i}>
              <motion.circle
                cx={p.x}
                cy={p.y}
                r={p.month === selectedMonth ? 0 : 3.2}
                fill={GRADE_COLOR[p.grade]}
                stroke="rgba(15,10,30,0.8)"
                strokeWidth={1.5}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.05 }}
              />
              <text
                x={p.x}
                y={i % 2 === 1 ? H - 8 : H - 24}
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                fontSize={11}
                fontWeight={p.month === selectedMonth ? 700 : 400}
                fill={
                  p.month === selectedMonth
                    ? GRADE_COLOR[p.grade]
                    : 'rgba(255,255,255,0.55)'
                }
              >
                {p.month}월
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* 최고·최저 빠른 이동 */}
      <div className="flex items-center justify-center gap-2 mt-1">
        <button
          type="button"
          onClick={() => setSelectedMonth(best.month)}
          className="px-3 py-1.5 rounded-full text-[12.5px] font-semibold border transition-all active:scale-95"
          style={{
            background: `${GRADE_COLOR[best.grade]}1a`,
            borderColor: `${GRADE_COLOR[best.grade]}55`,
            color: GRADE_COLOR[best.grade],
          }}
        >
          최고 {best.month}월 ({best.score})
        </button>
        <button
          type="button"
          onClick={() => setSelectedMonth(worst.month)}
          className="px-3 py-1.5 rounded-full text-[12.5px] font-semibold border transition-all active:scale-95"
          style={{
            background: `${GRADE_COLOR[worst.grade]}1a`,
            borderColor: `${GRADE_COLOR[worst.grade]}55`,
            color: GRADE_COLOR[worst.grade],
          }}
        >
          주의 {worst.month}월 ({worst.score})
        </button>
      </div>
    </div>
  );
}
