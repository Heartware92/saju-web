'use client';

/**
 * 달 위상 SVG — 표준 8 위상으로 스냅 + 일정한 밝기로 렌더.
 *
 * 천문 phase(0~1) 를 8개 anchor 중 가장 가까운 것으로 스냅 → 모양만 단계적으로 변함.
 * 밝은 면 fill·drop-shadow·크기는 모든 위상에서 동일.
 *
 * 8 위상 anchor (북반구·서울 기준):
 *   0  삭(new)         — 보이지 않으므로 얇은 그믐달 모양으로 대체 표시
 *   1  초승달          — 오른쪽 얇은 조각
 *   2  상현달(반달)    — 오른쪽 반원
 *   3  상현망(gibbous) — 오른쪽 부풀림
 *   4  보름달          — 원
 *   5  하현망(gibbous) — 왼쪽 부풀림
 *   6  하현달(반달)    — 왼쪽 반원
 *   7  그믐달          — 왼쪽 얇은 조각
 */

import { useEffect, useId, useState } from 'react';

export interface MoonPhaseProps {
  size?: number;
}

const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const SYNODIC_MONTH_MS = 29.53058770576 * 86400000;

function getAstronomicalPhase(): number {
  const elapsed = Date.now() - KNOWN_NEW_MOON_MS;
  const raw = (elapsed / SYNODIC_MONTH_MS) % 1;
  return (raw + 1) % 1;
}

interface PhaseAnchor {
  index: number;        // 0~7
  name: string;         // 한국어 이름
  value: number;        // 렌더에 쓸 phase 값 (0~1)
}

const PHASE_ANCHORS: PhaseAnchor[] = [
  { index: 0, name: '삭',       value: 0.04 },  // 삭은 보이지 않으므로 얇은 그믐달 모양으로 표시
  { index: 1, name: '초승달',   value: 0.125 },
  { index: 2, name: '상현달',   value: 0.25 },
  { index: 3, name: '상현망',   value: 0.375 },
  { index: 4, name: '보름달',   value: 0.5 },
  { index: 5, name: '하현망',   value: 0.625 },
  { index: 6, name: '하현달',   value: 0.75 },
  { index: 7, name: '그믐달',   value: 0.875 },
];

const ANCHOR_CENTERS = [0.0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875];

function snapToAnchor(rawPhase: number): PhaseAnchor {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < ANCHOR_CENTERS.length; i++) {
    const c = ANCHOR_CENTERS[i];
    const d = Math.min(Math.abs(rawPhase - c), Math.abs(rawPhase - c - 1), Math.abs(rawPhase - c + 1));
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return PHASE_ANCHORS[bestIdx];
}

export default function MoonPhase({ size = 76 }: MoonPhaseProps) {
  const uid = useId();
  const litId = `moon-lit-${uid}`;
  const [rawPhase, setRawPhase] = useState(0.5);

  useEffect(() => {
    setRawPhase(getAstronomicalPhase());
  }, []);

  const anchor = snapToAnchor(rawPhase);
  const renderPhase = anchor.value;
  const ariaLabel = `오늘 달: ${anchor.name}`;

  const R = (size - 8) / 2;
  const viewR = R + 4;

  const waxing = renderPhase < 0.5;
  const cos = Math.cos(2 * Math.PI * renderPhase);
  const rx = Math.abs(cos) * R;

  const semiSweep = waxing ? 1 : 0;
  let ellipseSweep: 0 | 1;
  if (waxing) {
    ellipseSweep = cos >= 0 ? 0 : 1;
  } else {
    ellipseSweep = cos > 0 ? 1 : 0;
  }

  const litPath = `M 0 ${-R} A ${R} ${R} 0 0 ${semiSweep} 0 ${R} A ${rx} ${R} 0 0 ${ellipseSweep} 0 ${-R} Z`;

  return (
    <svg
      viewBox={`${-viewR} ${-viewR} ${2 * viewR} ${2 * viewR}`}
      width={size}
      height={size}
      style={{ display: 'block' }}
      aria-label={ariaLabel}
      role="img"
    >
      <defs>
        <radialGradient id={litId} cx="35%" cy="35%">
          <stop offset="0%" stopColor="#fffdf5" />
          <stop offset="55%" stopColor="#fff0cc" />
          <stop offset="100%" stopColor="#f0d090" />
        </radialGradient>
      </defs>

      <path
        d={litPath}
        fill={`url(#${litId})`}
        style={{
          filter: 'drop-shadow(0 0 6px rgba(255, 230, 180, 0.35))',
        }}
      />
    </svg>
  );
}
