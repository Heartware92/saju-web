'use client';

/**
 * 실제 천문학적 달 위상을 SVG로 렌더.
 *
 * 계산 원리 (Meeus 간략 공식)
 *  - 기준: 2000-01-06 18:14 UTC (알려진 삭/new moon)
 *  - 삭망월: 29.53058770576일
 *  - phase = ((now - 기준) / 삭망월) % 1  →  0=삭, 0.5=보름
 *
 * 렌더링 (표준 moon-phase SVG)
 *  - 반원(semicircle): waxing → 오른쪽, waning → 왼쪽
 *  - 터미네이터 타원: rx = |cos(2π·phase)| · R
 *  - cos 부호로 crescent vs gibbous 구분 (sweep flag 방향)
 *
 * 북반구(서울) 기준: waxing = 오른쪽부터 밝아짐
 */

import { useEffect, useId, useState } from 'react';

export interface MoonPhaseProps {
  size?: number;
}

// 기준 삭(new moon): 2000-01-06 18:14 UTC (NASA 기준)
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const SYNODIC_MONTH_MS = 29.53058770576 * 86400000;

/** 천문학적 달 위상 (0=삭, 0.5=보름, 1=삭) */
function getAstronomicalPhase(): number {
  const elapsed = Date.now() - KNOWN_NEW_MOON_MS;
  const raw = (elapsed / SYNODIC_MONTH_MS) % 1;
  return (raw + 1) % 1;
}

/** phase(0~1) → 한국어 위상 이름 */
function phaseName(phase: number): string {
  if (phase < 0.033 || phase >= 0.967) return '삭(그믐)';
  if (phase < 0.10) return '초승달';
  if (phase < 0.20) return '초승달 지난 뒤';
  if (phase < 0.28) return '상현달(반달)';
  if (phase < 0.47) return '상현망';
  if (phase < 0.53) return '보름달';
  if (phase < 0.72) return '하현망';
  if (phase < 0.78) return '하현달(반달)';
  return '그믐달';
}

export default function MoonPhase({ size = 76 }: MoonPhaseProps) {
  const uid = useId();
  const litId = `moon-lit-${uid}`;
  const [phase, setPhase] = useState(0.5);

  useEffect(() => {
    setPhase(getAstronomicalPhase());
  }, []);

  const name = phaseName(phase);
  const isInvisible = phase < 0.02 || phase > 0.98;
  const renderPhase = isInvisible ? 0.5 : phase;

  const ariaLabel = isInvisible
    ? `오늘 달: ${name} — 달이 보이지 않는 날이라 보름달로 표시합니다`
    : `오늘 달: ${name}`;

  const R = (size - 8) / 2;
  const viewR = R + 4;

  const waxing = renderPhase < 0.5;
  const cos = Math.cos(2 * Math.PI * renderPhase);
  const rx = Math.abs(cos) * R;

  // 반원: waxing → 오른쪽(sweep=1), waning → 왼쪽(sweep=0)
  const semiSweep = waxing ? 1 : 0;

  // 터미네이터 타원 sweep:
  //   crescent(cos>0) → 반원과 같은 쪽으로 → 사이 얇은 조각
  //   gibbous(cos<0)  → 반원 반대쪽으로 → 반원 + 반대쪽 벌지 = 넓은 면적
  let ellipseSweep: 0 | 1;
  if (waxing) {
    ellipseSweep = cos >= 0 ? 0 : 1;
  } else {
    ellipseSweep = cos > 0 ? 1 : 0;
  }

  const litPath = `M 0 ${-R} A ${R} ${R} 0 0 ${semiSweep} 0 ${R} A ${rx} ${R} 0 0 ${ellipseSweep} 0 ${-R} Z`;

  const showCraters = renderPhase > 0.35 && renderPhase < 0.65;

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

      {showCraters && (
        <g opacity="0.15">
          <circle cx={R * 0.2} cy={-R * 0.15} r={R * 0.12} fill="#8a6a4a" />
          <circle cx={-R * 0.1} cy={R * 0.22} r={R * 0.08} fill="#8a6a4a" />
          <circle cx={R * 0.28} cy={R * 0.28} r={R * 0.06} fill="#8a6a4a" />
        </g>
      )}
    </svg>
  );
}
