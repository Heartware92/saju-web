'use client';

/**
 * 달 위상 SVG — 음력일(0~29) 단위로 스냅 + 일정한 밝기로 렌더.
 *
 * 천문 phase(0~1) 를 음력일자(lunar age, 0~29) 로 변환해 round → 같은 날 동안 모양 안정.
 * 음력 한 달(삭망월) ≈ 29.53일 → 30단계 (1일=삭, 15일=보름 근처, 29일=다시 삭 근접).
 *
 * 밝은 면 fill·drop-shadow·viewBox 모두 동일 → 어떤 위상에서도 밝기·크기 일정.
 *
 * 북반구(서울) 기준: 차오름(waxing) = 오른쪽부터 밝아짐.
 */

import { useEffect, useId, useState } from 'react';

export interface MoonPhaseProps {
  size?: number;
}

const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const SYNODIC_MONTH_MS = 29.53058770576 * 86400000;
const SYNODIC_DAYS = 29.53058770576;

/** 천문 phase 0~1 (0=삭, 0.5=보름, 1=삭) */
function getAstronomicalPhase(): number {
  const elapsed = Date.now() - KNOWN_NEW_MOON_MS;
  const raw = (elapsed / SYNODIC_MONTH_MS) % 1;
  return (raw + 1) % 1;
}

/** phase(0~1) → 한국어 위상 이름 (8개 표준) */
function phaseName(phase: number): string {
  if (phase < 0.033 || phase >= 0.967) return '삭';
  if (phase < 0.20) return '초승달';
  if (phase < 0.30) return '상현달';
  if (phase < 0.47) return '상현망';
  if (phase < 0.53) return '보름달';
  if (phase < 0.70) return '하현망';
  if (phase < 0.80) return '하현달';
  return '그믐달';
}

/** 너무 얇은 crescent(삭 근처)는 최소 가시성 phase 로 보정 */
const MIN_VISIBLE_PHASE = 0.04;

interface DailyPhase {
  lunarDay: number;   // 0~29
  phase: number;      // 렌더용 phase (가시성 보정 포함)
  name: string;
}

function snapToDailyPhase(rawPhase: number): DailyPhase {
  // 음력일 0~29 로 스냅 (round)
  const lunarDay = Math.round(rawPhase * SYNODIC_DAYS) % 30;
  const snapped = (lunarDay / SYNODIC_DAYS) % 1;

  // 가시성 보정: 너무 얇으면 최소 폭 보장
  let renderPhase = snapped;
  if (snapped < MIN_VISIBLE_PHASE) renderPhase = MIN_VISIBLE_PHASE;
  else if (snapped > 1 - MIN_VISIBLE_PHASE) renderPhase = 1 - MIN_VISIBLE_PHASE;

  return { lunarDay, phase: renderPhase, name: phaseName(snapped) };
}

export default function MoonPhase({ size = 76 }: MoonPhaseProps) {
  const uid = useId();
  const litId = `moon-lit-${uid}`;
  const darkId = `moon-dark-${uid}`;
  const [rawPhase, setRawPhase] = useState(0.5);

  useEffect(() => {
    setRawPhase(getAstronomicalPhase());
  }, []);

  const { lunarDay, phase: renderPhase, name } = snapToDailyPhase(rawPhase);
  const ariaLabel = `오늘 달: ${name} (음력 ${lunarDay + 1}일)`;

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
        <radialGradient id={darkId} cx="50%" cy="50%">
          <stop offset="0%" stopColor="#5a4a78" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#2a1f3a" stopOpacity="0.95" />
        </radialGradient>
      </defs>

      <circle
        r={R}
        fill={`url(#${darkId})`}
        stroke="rgba(255,235,200,0.22)"
        strokeWidth={0.6}
      />

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
