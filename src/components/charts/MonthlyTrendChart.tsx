'use client';

import { motion } from 'framer-motion';
import type { FortuneGrade } from '../../engine/periodFortune';

interface MonthlyPoint {
  month: number;
  grade: FortuneGrade;
  keyword: string;
}

interface MonthlyTrendChartProps {
  data: MonthlyPoint[];
  className?: string;
}

const GRADE_TO_NUM: Record<FortuneGrade, number> = {
  '대길': 100,
  '길': 83,
  '중길': 67,
  '평': 50,
  '중흉': 33,
  '흉': 17,
};

const GRADE_COLOR: Record<FortuneGrade, string> = {
  '대길': '#34D399',
  '길': '#86EFAC',
  '중길': '#FBBF24',
  '평': '#CBD5E1',
  '중흉': '#FB923C',
  '흉': '#F87171',
};

export function MonthlyTrendChart({ data, className = '' }: MonthlyTrendChartProps) {
  if (data.length === 0) return null;

  const W = 340;
  const H = 180;
  // 라벨이 viewBox 가장자리에서 잘리지 않도록 좌우 padding 충분히 확보.
  const padL = 18;
  const padR = 18;
  const padT = 16;
  // 지그재그 두 줄 배치 위해 하단 여백 확대.
  const padB = 44;

  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const points = data.map((d, i) => {
    const x = padL + (i / (data.length - 1)) * plotW;
    const val = GRADE_TO_NUM[d.grade];
    const y = padT + plotH - (val / 100) * plotH;
    return { x, y, ...d, val };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = linePath + ` L${points[points.length - 1].x},${padT + plotH} L${points[0].x},${padT + plotH} Z`;

  const gradientId = 'trend-grad';

  return (
    <div className={`overflow-x-auto ${className}`}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto"
        style={{ minWidth: W }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(139,92,246,0.35)" />
            <stop offset="100%" stopColor="rgba(139,92,246,0.02)" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[100, 67, 33].map(val => {
          const y = padT + plotH - (val / 100) * plotH;
          return (
            <line
              key={val}
              x1={padL} y1={y} x2={padL + plotW} y2={y}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={0.5}
              strokeDasharray="4,4"
            />
          );
        })}

        {/* Area fill */}
        <motion.path
          d={areaPath}
          fill={`url(#${gradientId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        />

        {/* Line */}
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

        {/* Data points and labels */}
        {points.map((p, i) => (
          <g key={i}>
            <motion.circle
              cx={p.x} cy={p.y} r={3.5}
              fill={GRADE_COLOR[p.grade]}
              stroke="rgba(15,10,30,0.8)"
              strokeWidth={1.5}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.05 }}
            />
            {/* Month label — 12개 라벨이 좁은 폭에 들어가야 해서 짝수 인덱스(2·4·6·8·10·12월)는
                약간 아래로 내려서 지그재그 두 줄 배치. 첫·마지막은 textAnchor 도 보정. */}
            <text
              x={p.x}
              y={i % 2 === 1 ? H - 8 : H - 22}
              textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
              fontSize={11}
              fill="rgba(255,255,255,0.6)"
            >
              {p.month}월
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
