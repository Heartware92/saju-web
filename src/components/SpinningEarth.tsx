'use client';

/**
 * 태양계 9행성 일자 배열 — 로딩 화면용 우주 시각화 (몽환 톤)
 *
 * 디자인:
 *  - 좌상(태양) → 우하(명왕성) 25° 대각선 일자 배열
 *  - 각 행성: 자전(rotate) + 공전(작은 원 궤도 부유)
 *  - 행성 본체: radial gradient + drop-shadow glow (몽환적)
 *  - 자전 가시화: 줄무늬 + 작은 표식 점 (도는 게 명확히 보임)
 *  - 태양 반짝임 5중 (코로나·광선·펄스·sparkle·후광)
 *
 * SVG transform-origin 호환성 문제 회피:
 *  - 각 행성을 `<g transform="translate(cx, cy)">` 로 위치 옮기고
 *  - 내부 group 들이 (0, 0) 기준으로 회전/부유
 *  - 이러면 transform-origin 없이도 모든 브라우저에서 회전 정상 작동
 */

interface SpinningEarthProps {
  size?: number;
  className?: string;
}

const ANGLE_RAD = (25 * Math.PI) / 180;
const COS = Math.cos(ANGLE_RAD);
const SIN = Math.sin(ANGLE_RAD);
const X0 = 8;
const Y0 = 28;

type Planet = {
  key: string;
  d: number;
  r: number;
  color: string;
  glow: string;   // radial gradient 중심부 (밝은 색)
  stripe?: string;
  shadow: string;
  spin: number;   // 자전 (초)
  orbit: number;  // 공전 (초)
  orbitR: number; // 공전 반경
};

const planets: Planet[] = [
  { key: 'mercury', d: 12, r: 1.2, color: '#a899c2', glow: '#d0c2e0', shadow: '#6b5d85', spin: 5, orbit: 6, orbitR: 2.2 },
  { key: 'venus',   d: 19, r: 2.2, color: '#fcd5b4', glow: '#fff0d8', stripe: '#f0a880', shadow: '#a8784e', spin: 8, orbit: 8, orbitR: 2.6 },
  { key: 'earth',   d: 27, r: 2.3, color: '#7dd3c0', glow: '#c8ece4', stripe: '#c9a6ff', shadow: '#3a6e6b', spin: 4, orbit: 10, orbitR: 2.9 },
  { key: 'mars',    d: 34, r: 1.5, color: '#f0a880', glow: '#fcd5b4', stripe: '#fff0d8', shadow: '#a85e3f', spin: 5, orbit: 12, orbitR: 2.7 },
  { key: 'jupiter', d: 47, r: 5.5, color: '#c9a6ff', glow: '#e9d5ff', stripe: '#f8bbd0', shadow: '#6e4ca0', spin: 3, orbit: 15, orbitR: 3.6 },
  { key: 'saturn',  d: 62, r: 4.6, color: '#f8bbd0', glow: '#fdd9e4', stripe: '#fcd5b4', shadow: '#a96b85', spin: 4, orbit: 18, orbitR: 3.3 },
  { key: 'uranus',  d: 75, r: 3.0, color: '#9bc4d4', glow: '#cee6ee', stripe: '#c9a6ff', shadow: '#5a8294', spin: 4, orbit: 21, orbitR: 3.0 },
  { key: 'neptune', d: 85, r: 2.9, color: '#7d6db5', glow: '#b8aae0', stripe: '#a899c2', shadow: '#3d3475', spin: 4, orbit: 24, orbitR: 2.9 },
  { key: 'pluto',   d: 94, r: 0.8, color: '#b8a8b8', glow: '#d8c8d8', shadow: '#6e6070', spin: 8, orbit: 27, orbitR: 1.8 },
];

export function SpinningEarth({ size = 380, className = '' }: SpinningEarthProps) {
  const stars = [
    { cx: 6, cy: 10, r: 0.8, delay: 0 },
    { cx: 95, cy: 12, r: 1.0, delay: 2 },
    { cx: 50, cy: 8, r: 0.7, delay: 4 },
    { cx: 5, cy: 88, r: 0.9, delay: 1 },
    { cx: 96, cy: 92, r: 0.8, delay: 3 },
    { cx: 30, cy: 90, r: 0.6, delay: 5 },
    { cx: 70, cy: 18, r: 0.7, delay: 2.5 },
    { cx: 18, cy: 70, r: 0.6, delay: 4.5 },
  ];

  const sunRays = Array.from({ length: 12 }, (_, i) => i * 30);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* 태양 외곽 후광 */}
      <div
        className="absolute"
        style={{
          left: `${(X0 / 100) * size - 70}px`,
          top: `${(Y0 / 100) * size - 70}px`,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(252,213,180,0.32) 0%, rgba(240,168,128,0.10) 45%, transparent 70%)',
          filter: 'blur(28px)',
          animation: 'sol-breathe 5s ease-in-out infinite',
        }}
      />

      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="relative z-10"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* 태양 그라데이션 — 행성과 동일 톤으로 부드러운 파스텔 */}
          <radialGradient id="sun-body" cx="35%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#fff5e1" stopOpacity="1" />
            <stop offset="40%" stopColor="#fdd9b4" stopOpacity="1" />
            <stop offset="100%" stopColor="#e8a890" stopOpacity="1" />
          </radialGradient>
          <radialGradient id="sun-corona" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(253,217,180,0.55)" />
            <stop offset="60%" stopColor="rgba(248,187,208,0.12)" />
            <stop offset="100%" stopColor="rgba(248,187,208,0)" />
          </radialGradient>

          {/* 행성별 radial gradient — 몽환적 표면 */}
          {planets.map((p) => (
            <radialGradient key={p.key} id={`planet-${p.key}`} cx="35%" cy="32%" r="65%">
              <stop offset="0%" stopColor={p.glow} stopOpacity="1" />
              <stop offset="55%" stopColor={p.color} stopOpacity="1" />
              <stop offset="100%" stopColor={p.shadow} stopOpacity="1" />
            </radialGradient>
          ))}

          {/* 외곽 글로우 필터 (몽환적 빛 번짐) */}
          <filter id="planet-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 배경 별 */}
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="#fef3c7"
            opacity="0.55"
            style={{ animation: `sol-twinkle 7s ease-in-out ${s.delay}s infinite` }}
          />
        ))}

        {/* 일자 안내선 */}
        <line
          x1={X0}
          y1={Y0}
          x2={X0 + 96 * COS}
          y2={Y0 + 96 * SIN}
          stroke="#fcd5b4"
          strokeWidth="0.2"
          strokeDasharray="0.5 1.5"
          opacity="0.10"
        />

        {/* 태양 — 좌상단, 행성과 통일된 몽환 톤 */}
        <g transform={`translate(${X0} ${Y0})`}>
          {/* 외곽 부드러운 글로우 (행성과 동일 패턴) */}
          <circle cx="0" cy="0" r="11" fill="#fdd9b4" opacity="0.16" style={{ filter: 'blur(2.5px)' }} />

          {/* 코로나 글로우 */}
          <circle cx="0" cy="0" r="11" fill="url(#sun-corona)" style={{ animation: 'sol-pulse 3s ease-in-out infinite' }} />

          {/* 광선 12개 — 부드럽고 가늘게, 더 천천히 회전 */}
          <g style={{ animation: 'sol-rays-spin 60s linear infinite' }}>
            {sunRays.map((angle, i) => (
              <line
                key={i}
                x1="0"
                y1="-8"
                x2="0"
                y2="-10.5"
                stroke="#fdd9b4"
                strokeWidth="0.5"
                strokeLinecap="round"
                transform={`rotate(${angle})`}
                opacity="0.55"
                style={{ animation: `sol-ray-blink 3s ease-in-out ${(i % 4) * 0.3}s infinite` }}
              />
            ))}
          </g>

          {/* 태양 본체 — 행성과 동일한 radial gradient + filter glow */}
          <g style={{ animation: 'sol-pulse 3s ease-in-out infinite' }}>
            <circle cx="0" cy="0" r="6" fill="url(#sun-body)" filter="url(#planet-glow)" />
            {/* 좌상단 하이라이트 (행성처럼) */}
            <ellipse cx="-2" cy="-2.5" rx="2.4" ry="1.6" fill="rgba(255,255,255,0.45)" style={{ filter: 'blur(0.4px)' }} />
            {/* 작은 sparkle */}
            <circle cx="-1.5" cy="-2" r="0.9" fill="rgba(255,255,255,0.7)" style={{ animation: 'sol-sparkle 2.5s ease-in-out infinite' }} />
          </g>
        </g>

        {/* 9행성 일렬 배치 — 각각 (cx,cy) 로 옮긴 뒤 (0,0) 기준 자전·공전 */}
        {planets.map((p) => {
          const cx = X0 + p.d * COS;
          const cy = Y0 + p.d * SIN;
          return (
            <g key={p.key} transform={`translate(${cx} ${cy})`}>
              {/* 외곽 글로우 — 행성 뒤쪽 부드러운 빛 번짐 (몽환 톤) */}
              <circle
                cx="0"
                cy="0"
                r={p.r * 1.8}
                fill={p.glow}
                opacity="0.18"
                style={{ filter: 'blur(2px)' }}
              />

              {/* 공전 — 작은 원 궤도 부유 */}
              <g style={{ animation: `sol-orbit-${p.key} ${p.orbit}s linear infinite` }}>

                {/* 토성 고리 뒤쪽 (자전 영향 안 받음) */}
                {p.key === 'saturn' && (
                  <g transform="rotate(-12)">
                    <path
                      d={`M ${-p.r * 1.9} 0 A ${p.r * 1.9} ${p.r * 0.55} 0 0 1 ${p.r * 1.9} 0`}
                      fill="none"
                      stroke="#c9a6ff"
                      strokeWidth="0.7"
                      strokeLinecap="round"
                    />
                  </g>
                )}

                {/* 자전 — 행성 본체 회전 그룹 */}
                <g style={{ animation: `sol-spin-${p.key} ${p.spin}s linear infinite` }}>
                  {/* 본체 — radial gradient (몽환 표면) */}
                  <circle cx="0" cy="0" r={p.r} fill={`url(#planet-${p.key})`} filter="url(#planet-glow)" />

                  {/* 자전 가시화 — 줄무늬 (있는 행성만) */}
                  {p.stripe && (
                    <>
                      <path
                        d={`M ${-p.r * 0.9} ${-p.r * 0.2} Q 0 ${-p.r * 0.55}, ${p.r * 0.9} ${-p.r * 0.2}`}
                        fill="none"
                        stroke={p.stripe}
                        strokeWidth={p.r * 0.22}
                        strokeLinecap="round"
                        opacity="0.75"
                      />
                      <path
                        d={`M ${-p.r * 0.95} ${p.r * 0.3} Q 0 ${p.r * 0.05}, ${p.r * 0.95} ${p.r * 0.3}`}
                        fill="none"
                        stroke={p.stripe}
                        strokeWidth={p.r * 0.16}
                        strokeLinecap="round"
                        opacity="0.6"
                      />
                    </>
                  )}

                  {/* 자전 표식 점 — 회전이 보이도록 한쪽에 작은 점 */}
                  <circle
                    cx={p.r * 0.5}
                    cy={-p.r * 0.4}
                    r={Math.max(0.18, p.r * 0.13)}
                    fill={p.shadow}
                    opacity="0.55"
                  />

                  {/* 하이라이트 — 좌상단 빛 반사 (몽환) */}
                  <ellipse
                    cx={-p.r * 0.35}
                    cy={-p.r * 0.45}
                    rx={p.r * 0.4}
                    ry={p.r * 0.25}
                    fill="rgba(255,255,255,0.4)"
                    style={{ filter: 'blur(0.3px)' }}
                  />
                </g>

                {/* 토성 고리 앞쪽 (자전 그룹 밖) */}
                {p.key === 'saturn' && (
                  <g transform="rotate(-12)">
                    <path
                      d={`M ${-p.r * 1.9} 0 A ${p.r * 1.9} ${p.r * 0.55} 0 0 0 ${p.r * 1.9} 0`}
                      fill="none"
                      stroke="#c9a6ff"
                      strokeWidth="0.7"
                      strokeLinecap="round"
                    />
                  </g>
                )}

                {/* 천왕성 세로 고리 */}
                {p.key === 'uranus' && (
                  <g transform="rotate(75)">
                    <path
                      d={`M ${-p.r * 1.7} 0 A ${p.r * 1.7} ${p.r * 0.4} 0 0 1 ${p.r * 1.7} 0`}
                      fill="none"
                      stroke="#c9a6ff"
                      strokeWidth="0.4"
                      strokeLinecap="round"
                      opacity="0.6"
                    />
                    <path
                      d={`M ${-p.r * 1.7} 0 A ${p.r * 1.7} ${p.r * 0.4} 0 0 0 ${p.r * 1.7} 0`}
                      fill="none"
                      stroke="#c9a6ff"
                      strokeWidth="0.4"
                      strokeLinecap="round"
                      opacity="0.6"
                    />
                  </g>
                )}
              </g>
            </g>
          );
        })}
      </svg>

      <style jsx>{`
        @keyframes sol-breathe {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.12); }
        }
        @keyframes sol-twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.9; }
        }
        @keyframes sol-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes sol-rays-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes sol-ray-blink {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes sol-sparkle {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.3); }
        }

        ${planets.map((p) => `
          @keyframes sol-spin-${p.key} {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes sol-orbit-${p.key} {
            0%   { transform: translate(${p.orbitR}px, 0); }
            12.5% { transform: translate(${(p.orbitR * 0.707).toFixed(2)}px, ${(p.orbitR * 0.707).toFixed(2)}px); }
            25%  { transform: translate(0, ${p.orbitR}px); }
            37.5% { transform: translate(-${(p.orbitR * 0.707).toFixed(2)}px, ${(p.orbitR * 0.707).toFixed(2)}px); }
            50%  { transform: translate(-${p.orbitR}px, 0); }
            62.5% { transform: translate(-${(p.orbitR * 0.707).toFixed(2)}px, -${(p.orbitR * 0.707).toFixed(2)}px); }
            75%  { transform: translate(0, -${p.orbitR}px); }
            87.5% { transform: translate(${(p.orbitR * 0.707).toFixed(2)}px, -${(p.orbitR * 0.707).toFixed(2)}px); }
            100% { transform: translate(${p.orbitR}px, 0); }
          }
        `).join('\n')}
      `}</style>
    </div>
  );
}
