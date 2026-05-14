'use client';

/**
 * 코스믹 행성 — 로딩 화면용 우주 시각화
 *
 * 구성:
 *  - 회전하는 행성 (보라·청록·자홍 그라디언트로 우주적 톤)
 *  - 행성 표면의 추상 무늬 (대륙 윤곽 + 별빛 점)
 *  - 토성 고리 (살짝 기울어진 타원, 부드러운 glow)
 *  - 외곽 후광 (별빛 펄스)
 *  - 떠다니는 작은 별·먼지 입자 (CSS keyframe — 위·아래 부드러운 부유)
 *
 * 애니메이션:
 *  - 행성 자전: 14초 1회전 (linear infinite)
 *  - 고리: 정적 (기울어진 타원, 회전 없음)
 *  - 외곽 후광: 4초 펄스
 *  - 먼지 입자: 6~10초 부유
 *
 * size prop 으로 전체 크기 조절. 기본 200px.
 */

interface SpinningEarthProps {
  size?: number;
  className?: string;
}

export function SpinningEarth({ size = 200, className = '' }: SpinningEarthProps) {
  // 떠다니는 먼지 별 입자 좌표 (구체 외곽 우주 공간)
  const dustParticles = [
    { cx: 15, cy: 25, r: 0.8, delay: 0, duration: 7 },
    { cx: 85, cy: 18, r: 0.6, delay: 1.5, duration: 8 },
    { cx: 92, cy: 55, r: 1.0, delay: 0.5, duration: 6 },
    { cx: 8, cy: 70, r: 0.7, delay: 2, duration: 9 },
    { cx: 78, cy: 88, r: 0.9, delay: 1, duration: 7.5 },
    { cx: 22, cy: 92, r: 0.6, delay: 2.5, duration: 8.5 },
    { cx: 50, cy: 8, r: 0.8, delay: 0.8, duration: 7 },
    { cx: 95, cy: 75, r: 0.5, delay: 1.8, duration: 10 },
  ];

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* 외곽 후광 — 부드러운 별빛 글로우 */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(167,139,250,0.30) 0%, rgba(167,139,250,0.10) 35%, transparent 60%)',
          filter: 'blur(20px)',
          animation: 'cosmic-pulse 4s ease-in-out infinite',
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
          {/* 행성 표면 그라디언트 — 코스믹 보라·자홍·청록 */}
          <radialGradient id="planetGradient" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#c9a6ff" stopOpacity="0.95" />
            <stop offset="25%" stopColor="#8b5cf6" stopOpacity="1" />
            <stop offset="55%" stopColor="#5b21b6" stopOpacity="1" />
            <stop offset="80%" stopColor="#1e1b4b" stopOpacity="1" />
            <stop offset="100%" stopColor="#0f0a2e" stopOpacity="1" />
          </radialGradient>

          {/* 대륙·무늬 색 */}
          <linearGradient id="surfaceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fce8b2" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#c9a6ff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#7c5cfc" stopOpacity="0.35" />
          </linearGradient>

          {/* 위도·경도 선 */}
          <linearGradient id="gridLine" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
          </linearGradient>

          {/* 토성 고리 그라디언트 */}
          <linearGradient id="ringGradient" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="rgba(252,232,178,0.0)" />
            <stop offset="20%" stopColor="rgba(252,232,178,0.5)" />
            <stop offset="50%" stopColor="rgba(201,166,255,0.7)" />
            <stop offset="80%" stopColor="rgba(252,232,178,0.5)" />
            <stop offset="100%" stopColor="rgba(252,232,178,0.0)" />
          </linearGradient>
        </defs>

        {/* 떠다니는 먼지 별 입자 — 행성 외곽 우주 공간 */}
        {dustParticles.map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            fill="rgba(255,255,255,0.7)"
            style={{
              animation: `cosmic-dust ${p.duration}s ease-in-out ${p.delay}s infinite`,
              transformOrigin: `${p.cx}px ${p.cy}px`,
            }}
          />
        ))}

        {/* 토성 고리 — 뒤쪽 (행성 뒤로 가는 부분) */}
        <g transform="translate(50 50) rotate(-22)">
          <path
            d="M -40 0 A 40 11 0 0 1 40 0"
            fill="none"
            stroke="url(#ringGradient)"
            strokeWidth="2.5"
            opacity="0.85"
          />
          <path
            d="M -36 0 A 36 9 0 0 1 36 0"
            fill="none"
            stroke="rgba(252,232,178,0.35)"
            strokeWidth="0.6"
          />
        </g>

        {/* 회전하는 행성 본체 */}
        <g style={{ animation: 'planet-spin 14s linear infinite', transformOrigin: '50px 50px' }}>
          {/* 본체 — 구체 */}
          <circle cx="50" cy="50" r="26" fill="url(#planetGradient)" />

          {/* 경도선 (자전 시 흐름 시각화) */}
          <ellipse cx="50" cy="50" rx="26" ry="26" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="0.4" />
          <ellipse cx="50" cy="50" rx="19" ry="26" fill="none" stroke="url(#gridLine)" strokeWidth="0.4" />
          <ellipse cx="50" cy="50" rx="11" ry="26" fill="none" stroke="url(#gridLine)" strokeWidth="0.4" />
          <ellipse cx="50" cy="50" rx="3.5" ry="26" fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="0.4" />

          {/* 위도선 (수평) */}
          <ellipse cx="50" cy="50" rx="26" ry="12" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="0.4" />
          <ellipse cx="50" cy="50" rx="26" ry="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.4" />

          {/* 표면 무늬 — 추상적 대륙·구름 */}
          <g opacity="0.75">
            <path
              d="M 42 38 Q 48 36, 54 40 Q 58 44, 56 50 Q 52 56, 46 54 Q 42 52, 42 46 Q 41 41, 42 38 Z"
              fill="url(#surfaceGradient)"
            />
            <path
              d="M 36 60 Q 42 60, 44 64 Q 44 68, 40 70 Q 36 70, 35 66 Q 35 62, 36 60 Z"
              fill="url(#surfaceGradient)"
            />
            <circle cx="60" cy="58" r="2" fill="url(#surfaceGradient)" opacity="0.6" />
            <circle cx="63" cy="46" r="1.5" fill="url(#surfaceGradient)" opacity="0.5" />
            <circle cx="38" cy="48" r="1.2" fill="url(#surfaceGradient)" opacity="0.5" />
          </g>

          {/* 하이라이트 — 좌상단 빛 반사 */}
          <ellipse
            cx="42"
            cy="40"
            rx="9"
            ry="6"
            fill="rgba(255,255,255,0.15)"
            style={{ filter: 'blur(2px)' }}
          />
        </g>

        {/* 토성 고리 — 앞쪽 (행성 앞으로 가는 부분) */}
        <g transform="translate(50 50) rotate(-22)">
          <path
            d="M -40 0 A 40 11 0 0 0 40 0"
            fill="none"
            stroke="url(#ringGradient)"
            strokeWidth="2.5"
            opacity="0.85"
          />
          <path
            d="M -36 0 A 36 9 0 0 0 36 0"
            fill="none"
            stroke="rgba(252,232,178,0.4)"
            strokeWidth="0.6"
          />
          {/* 고리 위 작은 입자 */}
          <circle cx="32" cy="2" r="0.7" fill="rgba(252,232,178,0.85)" />
          <circle cx="-28" cy="-1" r="0.6" fill="rgba(252,232,178,0.75)" />
        </g>

        {/* 행성 옆 작은 위성 */}
        <g style={{ animation: 'moon-orbit 8s linear infinite', transformOrigin: '50px 50px' }}>
          <circle cx="50" cy="14" r="2.2" fill="rgba(201,166,255,0.9)" />
          <circle cx="50" cy="14" r="2.2" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.3" />
        </g>
      </svg>

      <style jsx>{`
        @keyframes planet-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes moon-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes cosmic-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.12); }
        }
        @keyframes cosmic-dust {
          0%, 100% { opacity: 0.3; transform: translate(0, 0); }
          50% { opacity: 0.95; transform: translate(2px, -3px); }
        }
      `}</style>
    </div>
  );
}
