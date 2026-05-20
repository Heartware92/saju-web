'use client';

/**
 * 관계 추이 차트 — 시간이 흐름에 따른 궁합 점수 곡선.
 *
 * 궁합 풀이의 [gunghap_timeline] 데이터(만남·6개월·1~5년차 등 라벨별 점수)를 받아
 * 라인 차트로 표시. MonthlyTrendChart 와 동일한 인터랙션 패턴:
 *  · 차트를 터치/클릭/호버하면 해당 시점이 선택됨
 *  · 선택 시점의 점수·등급을 상단 카드에 표시
 *  · 최고·주의 시점 칩으로 빠른 이동
 */

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { GRADE_COLOR, scoreToGrade, type GunghapTimelinePoint } from '@/lib/gunghap';

interface RelationTimelineChartProps {
  data: GunghapTimelinePoint[];
  className?: string;
}

export function RelationTimelineChart({ data, className = '' }: RelationTimelineChartProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  const W = 340;
  const H = 188;
  const padL = 24;
  const padR = 24;
  const padT = 22;
  const padB = 42;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // 점수 범위를 plot 스케일로 정규화 — 데이터 폭에 맞춰 변별력 확보.
  const { lo, hi } = useMemo(() => {
    if (data.length === 0) return { lo: 45, hi: 98 };
    const scores = data.map(d => d.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    // 위아래 8점 여백 — 곡선이 차트 가장자리에 붙지 않도록
    return { lo: Math.max(0, min - 8), hi: Math.min(100, max + 8) };
  }, [data]);

  const points = useMemo(
    () =>
      data.map((d, i) => {
        const x = padL + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2);
        const norm = hi > lo ? (d.score - lo) / (hi - lo) : 0.5;
        const y = padT + plotH - norm * plotH;
        return { x, y, ...d };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, lo, hi],
  );

  if (points.length === 0) return null;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${padT + plotH} L${points[0].x},${padT + plotH} Z`;

  const safeIdx = Math.min(selectedIdx, points.length - 1);
  const selected = points[safeIdx];

  const handlePointer = (clientX: number, target: SVGSVGElement) => {
    const rect = target.getBoundingClientRect();
    const scale = W / rect.width;
    const svgX = (clientX - rect.left) * scale;
    let nearest = 0;
    let minDist = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - svgX);
      if (d < minDist) {
        minDist = d;
        nearest = i;
      }
    });
    setSelectedIdx(nearest);
  };

  const avgScore = Math.round(data.reduce((s, d) => s + d.score, 0) / data.length);
  let bestIdx = 0;
  let worstIdx = 0;
  data.forEach((d, i) => {
    if (d.score > data[bestIdx].score) bestIdx = i;
    if (d.score < data[worstIdx].score) worstIdx = i;
  });
  const best = data[bestIdx];
  const worst = data[worstIdx];

  const selectedGrade = scoreToGrade(selected.score);
  const selectedColor = GRADE_COLOR[selectedGrade];

  return (
    <div className={className}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[14px] font-bold text-text-secondary">관계 흐름 그래프</span>
        <span className="text-[12.5px] text-text-tertiary">
          평균 <span className="text-text-secondary font-semibold">{avgScore}</span>점
        </span>
      </div>

      {/* 선택 시점 카드 */}
      <div className="mb-3 rounded-xl px-4 py-3 bg-[rgba(124,92,252,0.10)] border border-[rgba(124,92,252,0.32)]">
        <div className="flex items-center justify-between">
          <span
            className="text-[20px] font-bold text-text-primary"
            style={{ fontFamily: 'var(--font-title)' }}
          >
            {selected.label}
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[27px] font-bold leading-none" style={{ color: selectedColor }}>
              {selected.score}
            </span>
            <span className="text-[12px] text-text-tertiary">점</span>
            <span className="text-[14px] font-bold ml-0.5" style={{ color: selectedColor }}>
              · {selectedGrade}
            </span>
          </div>
        </div>
      </div>

      {/* 차트 — 터치/클릭/호버로 시점 선택 */}
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
            <linearGradient id="relation-trend-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(139,92,246,0.35)" />
              <stop offset="100%" stopColor="rgba(139,92,246,0.02)" />
            </linearGradient>
          </defs>

          {/* 가로 보조선 */}
          {[0.85, 0.5, 0.15].map((r) => {
            const y = padT + plotH - r * plotH;
            return (
              <line
                key={r}
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
            fill="url(#relation-trend-grad)"
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

          {/* 선택 시점 마커 */}
          <g>
            <line
              x1={selected.x}
              x2={selected.x}
              y1={padT}
              y2={padT + plotH}
              stroke={selectedColor}
              strokeWidth={1.5}
              strokeDasharray="3 3"
              opacity={0.7}
            />
            <circle cx={selected.x} cy={selected.y} r={6} fill={selectedColor} opacity={0.25} />
            <circle
              cx={selected.x}
              cy={selected.y}
              r={4}
              fill={selectedColor}
              stroke="rgba(15,10,30,0.9)"
              strokeWidth={1.5}
            />
          </g>

          {/* 데이터 점 + 라벨 */}
          {points.map((p, i) => (
            <g key={i}>
              <motion.circle
                cx={p.x}
                cy={p.y}
                r={i === safeIdx ? 0 : 3.2}
                fill={GRADE_COLOR[scoreToGrade(p.score)]}
                stroke="rgba(15,10,30,0.8)"
                strokeWidth={1.5}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.06 }}
              />
              <text
                x={p.x}
                y={H - 14}
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                fontSize={11}
                fontWeight={i === safeIdx ? 700 : 400}
                fill={i === safeIdx ? selectedColor : 'rgba(255,255,255,0.55)'}
              >
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* 최고·주의 시점 빠른 이동 */}
      <div className="flex items-center justify-center gap-2 mt-1">
        <button
          type="button"
          onClick={() => setSelectedIdx(bestIdx)}
          className="px-3 py-1.5 rounded-full text-[12.5px] font-semibold border transition-all active:scale-95"
          style={{
            background: `${GRADE_COLOR[scoreToGrade(best.score)]}1a`,
            borderColor: `${GRADE_COLOR[scoreToGrade(best.score)]}55`,
            color: GRADE_COLOR[scoreToGrade(best.score)],
          }}
        >
          최고 {best.label} ({best.score})
        </button>
        <button
          type="button"
          onClick={() => setSelectedIdx(worstIdx)}
          className="px-3 py-1.5 rounded-full text-[12.5px] font-semibold border transition-all active:scale-95"
          style={{
            background: `${GRADE_COLOR[scoreToGrade(worst.score)]}1a`,
            borderColor: `${GRADE_COLOR[scoreToGrade(worst.score)]}55`,
            color: GRADE_COLOR[scoreToGrade(worst.score)],
          }}
        >
          주의 {worst.label} ({worst.score})
        </button>
      </div>
    </div>
  );
}
