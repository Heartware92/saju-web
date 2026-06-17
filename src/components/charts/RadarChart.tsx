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

  // 좌우 라벨(직장·사업운 등 6글자)이 start/end anchor 로 바깥으로 뻗으므로 padX 를 라벨 폭만큼 확보.
  //   ~5.5글자 폭 = labelFontSize * 4.5 (차트 자체 여유 0.0843*size 는 별도로 더해짐).
  // 하단은 라벨 + 점수 2줄이 들어가므로 padBottom 을 크게, 상단은 라벨 한 줄만이라 작게(비대칭).
  const padX = Math.max(48, Math.round(labelFontSize * 4.5));
  const padTop = Math.max(14, Math.round(labelFontSize * 0.9));
  const padBottom = Math.max(36, Math.round(labelFontSize * 2.4));
  const cx = padX + size / 2;
  const cy = padTop + size / 2;
  // 차트 자체를 더 크게 — maxR 비율 ↑
  const maxR = size * 0.42;
  const labelR = size * 0.48;
  const vbW = size + padX * 2;
  const vbH = size + padTop + padBottom;
  const gridLevels = [20, 40, 60, 80, 100];

  const dataPoints = domains.map((d, i) => {
    const r = (d.score / 100) * maxR;
    return polarToXY(cx, cy, r, (360 / n) * i);
  });
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

  return (
    <div className={`flex justify-center ${className}`}>
      {/* 고정 px 대신 컨테이너 폭에 맞춰 축소(viewBox 비율 유지) — 좁은 모바일에서 라벨 잘림 방지 */}
      <svg
        width={vbW}
        height={vbH}
        viewBox={`0 0 ${vbW} ${vbH}`}
        style={{ width: '100%', height: 'auto', maxWidth: vbW }}
      >
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
