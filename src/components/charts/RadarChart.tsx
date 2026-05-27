'use client';

import { motion } from 'framer-motion';

export interface RadarDomain {
  label: string;
  score: number; // 0-100
  color?: string;
}

interface RadarChartProps {
  domains: RadarDomain[];
  size?: number;
  fillColor?: string;
  strokeColor?: string;
  className?: string;
  /** 라벨(영역명) 폰트 크기 — 기본 15 */
  labelFontSize?: number;
  /** 점수 폰트 크기 — 기본 17 */
  scoreFontSize?: number;
}

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function polygonPoints(cx: number, cy: number, r: number, n: number): string {
  return Array.from({ length: n }, (_, i) => {
    const { x, y } = polarToXY(cx, cy, r, (360 / n) * i);
    return `${x},${y}`;
  }).join(' ');
}

export function RadarChart({
  domains,
  size = 240,
  fillColor = 'rgba(139,92,246,0.25)',
  strokeColor = 'rgba(139,92,246,0.8)',
  className = '',
  labelFontSize = 15,
  scoreFontSize = 17,
}: RadarChartProps) {
  const n = domains.length;
  if (n < 3) return null;

  // 라벨이 차트 영역 밖으로 잘리지 않을 만큼만 pad 확보 — 폰트 줄높이 1.6배 정도면 충분
  const pad = Math.max(48, Math.round(labelFontSize * 1.8 + 10));
  const cx = pad + size / 2;
  const cy = pad + size / 2;
  // 차트 자체를 더 크게 — 폰트가 크면 labelR을 살짝 더 안쪽으로 (글자가 차트 모서리에 더 붙음)
  const maxR = size * 0.36;
  const labelR = size * 0.44;
  const vbW = size + pad * 2;
  const vbH = size + pad * 2;
  const gridLevels = [20, 40, 60, 80, 100];

  const dataPoints = domains.map((d, i) => {
    const r = (d.score / 100) * maxR;
    return polarToXY(cx, cy, r, (360 / n) * i);
  });
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

  return (
    <div className={`flex justify-center ${className}`}>
      <svg width={vbW} height={vbH} viewBox={`0 0 ${vbW} ${vbH}`}>
        {/* Grid */}
        {gridLevels.map(pct => (
          <polygon
            key={pct}
            points={polygonPoints(cx, cy, (pct / 100) * maxR, n)}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={pct === 100 ? 1 : 0.5}
          />
        ))}

        {/* Axis lines */}
        {domains.map((_, i) => {
          const { x, y } = polarToXY(cx, cy, maxR, (360 / n) * i);
          return (
            <line
              key={`axis-${i}`}
              x1={cx} y1={cy} x2={x} y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Data area */}
        <motion.path
          d={dataPath}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={2}
          strokeLinejoin="round"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* Data points */}
        {dataPoints.map((p, i) => (
          <motion.circle
            key={`dot-${i}`}
            cx={p.x} cy={p.y} r={3}
            fill={strokeColor}
            stroke="white"
            strokeWidth={1.5}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.08 }}
          />
        ))}

        {/* Labels */}
        {domains.map((d, i) => {
          const { x, y } = polarToXY(cx, cy, labelR, (360 / n) * i);
          const anchor = x < cx - 4 ? 'end' : x > cx + 4 ? 'start' : 'middle';
          // 폰트가 커지면 위쪽 라벨 안전 거리 확보, 아래쪽도 정렬 유지
          const topOffset = -Math.round(labelFontSize * 0.3);
          const bottomOffset = Math.round(labelFontSize * 0.8);
          const dy = y < cy - 10 ? topOffset : y > cy + 10 ? bottomOffset : Math.round(labelFontSize * 0.3);
          const scoreDy = Math.round(labelFontSize * 1.25);
          return (
            <g key={`label-${i}`}>
              <text
                x={x} y={y + dy}
                textAnchor={anchor}
                fontSize={labelFontSize}
                fontWeight={600}
                fill="rgba(255,255,255,0.85)"
              >
                {d.label}
              </text>
              <text
                x={x} y={y + dy + scoreDy}
                textAnchor={anchor}
                fontSize={scoreFontSize}
                fontWeight={800}
                fill={d.color || strokeColor}
              >
                {d.score}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
