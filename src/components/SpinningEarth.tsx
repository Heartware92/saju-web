'use client';

/**
 * Monument Valley 톤 측면 태양계 — 로딩 화면용 우주 시각화
 *
 * 사용자 요청:
 *  - 가로 정렬 (행성들이 일렬로)
 *  - 측면 시점 (전지적 작가시점 X, 옆에서 보는 시각)
 *  - 코일처럼 앞뒤로 자전·공전 시각화
 *
 * 시각화 컨셉:
 *  - 각 행성이 매우 납작한 타원 궤도 (rx 큼, ry 작음) 측면에서 본 듯
 *  - 행성이 앞으로 올 때: 크게·진하게 (translateY +)
 *  - 행성이 뒤로 갈 때: 작게·흐리게 (translateY -, scale ↓, opacity ↓)
 *  - 4단계 keyframes — 오른쪽(보통) → 뒤(작음) → 왼쪽(보통) → 앞(큼) → 오른쪽
 *
 * 구성:
 *  - 중앙 태양 (3s 펄스 + 8광선 회전)
 *  - 4개 행성 각자 타원 궤도 (안쪽 빠름·바깥 느림)
 *  - 각 행성 자체 자전 (회전)
 *  - 행성 2(라일락)은 달 거느림
 *  - 배경 별 6개 트윙클
 *
 * 애니메이션:
 *  - 행성 1 공전: 5s linear
 *  - 행성 2 공전: 8s linear (+ 달 3s)
 *  - 행성 3 공전: 12s linear (역방향 자전)
 *  - 행성 4 공전: 18s linear (토성형 고리)
 *  - 태양 펄스: 3s / 광선: 30s
 *  - 별 트윙클: 6s
 */

interface SpinningEarthProps {
  size?: number;
  className?: string;
}

export function SpinningEarth({ size = 320, className = '' }: SpinningEarthProps) {
  const stars = [
    { cx: 8, cy: 22, r: 0.9, delay: 0 },
    { cx: 92, cy: 18, r: 1.0, delay: 2 },
    { cx: 12, cy: 78, r: 0.8, delay: 1 },
    { cx: 88, cy: 82, r: 1.0, delay: 3 },
    { cx: 50, cy: 6, r: 0.7, delay: 1.5 },
    { cx: 50, cy: 92, r: 0.7, delay: 4 },
  ];

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* 외곽 후광 */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(ellipse 70% 35%, rgba(252,211,193,0.22) 0%, rgba(201,166,255,0.10) 50%, transparent 75%)',
          filter: 'blur(28px)',
          animation: 'solar-breathe 6s ease-in-out infinite',
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
          <radialGradient id="sunBody2" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#fff5e1" stopOpacity="1" />
            <stop offset="30%" stopColor="#fcd5b4" stopOpacity="1" />
            <stop offset="70%" stopColor="#f0a880" stopOpacity="1" />
            <stop offset="100%" stopColor="#d89472" stopOpacity="1" />
          </radialGradient>
          <radialGradient id="sunGlow2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(252,213,180,0.6)" />
            <stop offset="60%" stopColor="rgba(240,168,128,0.15)" />
            <stop offset="100%" stopColor="rgba(240,168,128,0)" />
          </radialGradient>
        </defs>

        {/* 배경 별 */}
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="#fef3c7"
            opacity="0.6"
            style={{ animation: `solar-star 9s ease-in-out ${s.delay}s infinite` }}
          />
        ))}

        {/* 궤도 시스템 전체 — 살짝 회전(-15°)으로 코일 같은 비틀림 부여 */}
        <g transform="rotate(-15 50 50)">
          {/* 궤도 가이드 — 45도 기울어진 타원 (ry/rx ≈ 0.7) */}
          <g opacity="0.18">
            <ellipse cx="50" cy="50" rx="22" ry="15" fill="none" stroke="#fcd5b4" strokeWidth="0.3" strokeDasharray="1 2" />
            <ellipse cx="50" cy="50" rx="34" ry="24" fill="none" stroke="#fcd5b4" strokeWidth="0.3" strokeDasharray="1 2" />
            <ellipse cx="50" cy="50" rx="44" ry="31" fill="none" stroke="#fcd5b4" strokeWidth="0.3" strokeDasharray="1 2" />
            <ellipse cx="50" cy="50" rx="52" ry="36" fill="none" stroke="#fcd5b4" strokeWidth="0.3" strokeDasharray="1 2" />
          </g>
        </g>

        {/* 태양 코로나 글로우 */}
        <circle cx="50" cy="50" r="14" fill="url(#sunGlow2)" style={{ animation: 'sun-pulse 5s ease-in-out infinite' }} />

        {/* 태양 광선 8개 — 회전 */}
        <g style={{ transformOrigin: '50px 50px', animation: 'sun-ray-spin 50s linear infinite' }}>
          {Array.from({ length: 8 }, (_, i) => (
            <line
              key={i}
              x1="50"
              y1="42"
              x2="50"
              y2="38"
              stroke="#fcd5b4"
              strokeWidth="1"
              strokeLinecap="round"
              transform={`rotate(${i * 45} 50 50)`}
              opacity="0.7"
            />
          ))}
        </g>

        {/* 태양 본체 */}
        <circle cx="50" cy="50" r="7.5" fill="url(#sunBody2)" style={{ animation: 'sun-pulse 5s ease-in-out infinite' }} />

        {/* 모든 행성 시스템 — 궤도와 함께 -15° 회전으로 코일 비틀림 */}
        <g transform="rotate(-15 50 50)">

        {/* 행성 1 — 가장 안쪽, 페일핑크, 8s 측면 공전 (느림) */}
        <g style={{ animation: 'orbit-side-1 8s linear infinite', transformOrigin: '50px 50px' }}>
          <g style={{ transform: 'translate(50px, 50px)' }}>
            <g style={{ animation: 'planet-spin-fast 7s linear infinite' }}>
              <circle cx="0" cy="0" r="2.2" fill="#f8bbd0" />
              <path d="M 0 2.2 A 2.2 2.2 0 0 1 -1.8 0 Q -0.9 -0.5, 0 -0.5 Q 0.9 -0.5, 1.8 0 A 2.2 2.2 0 0 1 0 2.2 Z" fill="#d68aa3" opacity="0.5" />
            </g>
          </g>
        </g>

        {/* 행성 2 — 지구 위치, 라일락+청록, 14s 측면 공전 + 달 */}
        <g style={{ animation: 'orbit-side-2 14s linear infinite', transformOrigin: '50px 50px' }}>
          <g style={{ transform: 'translate(50px, 50px)' }}>
            <g style={{ animation: 'planet-spin-mid 10s linear infinite' }}>
              <circle cx="0" cy="0" r="3.2" fill="#c9a6ff" />
              <path d="M -1.5 -0.8 Q -0.5 -1.5, 0.8 -1 Q 1 -0.2, 0.3 0.4 Q -0.8 0.2, -1.5 -0.8 Z" fill="#7dd3c0" opacity="0.7" />
              <path d="M 0 3.2 A 3.2 3.2 0 0 1 -2.6 0.5 Q -1.3 0.2, 0 0.2 Q 1.3 0.2, 2.6 0.5 A 3.2 3.2 0 0 1 0 3.2 Z" fill="#7c5ca8" opacity="0.4" />
            </g>
            {/* 달 — 행성 2 주위 공전 (5s) */}
            <g style={{ animation: 'moon-orbit-side 5s linear infinite' }}>
              <g style={{ transform: 'translate(0px, 0px)' }}>
                <circle cx="6" cy="0" r="1.2" fill="#fff5e1" />
              </g>
            </g>
          </g>
        </g>

        {/* 행성 3 — 화성 위치, 살구, 22s 측면 공전 */}
        <g style={{ animation: 'orbit-side-3 22s linear infinite', transformOrigin: '50px 50px' }}>
          <g style={{ transform: 'translate(50px, 50px)' }}>
            <g style={{ animation: 'planet-spin-rev 16s linear infinite reverse' }}>
              <circle cx="0" cy="0" r="2.6" fill="#f0a880" />
              <path d="M -1 -0.5 Q 0.5 -0.8, 1.2 -0.2 Q 0.8 0.3, 0 0.4 Q -1 0.1, -1 -0.5 Z" fill="#fcd5b4" opacity="0.65" />
              <path d="M 0 2.6 A 2.6 2.6 0 0 1 -2.1 0.3 Q -1.05 0, 0 0 Q 1.05 0, 2.1 0.3 A 2.6 2.6 0 0 1 0 2.6 Z" fill="#a85e3f" opacity="0.4" />
            </g>
          </g>
        </g>

        {/* 행성 4 — 토성형, 32s 측면 공전 */}
        <g style={{ animation: 'orbit-side-4 32s linear infinite', transformOrigin: '50px 50px' }}>
          <g style={{ transform: 'translate(50px, 50px)' }}>
            <g style={{ animation: 'planet-spin-slow 22s linear infinite' }}>
              {/* 고리 뒤 */}
              <g transform="rotate(-12)">
                <path d="M -7 0 A 7 1.8 0 0 1 7 0" fill="none" stroke="#c9a6ff" strokeWidth="0.8" strokeLinecap="round" />
              </g>
              <circle cx="0" cy="0" r="3.8" fill="#fcd5b4" />
              <path d="M -2.8 0.3 Q 0 -0.3, 2.8 0.3" fill="none" stroke="#f0a880" strokeWidth="0.8" strokeLinecap="round" opacity="0.8" />
              <path d="M -3 1.5 Q 0 1, 3 1.5" fill="none" stroke="#f0a880" strokeWidth="0.6" strokeLinecap="round" opacity="0.6" />
              <path d="M 0 3.8 A 3.8 3.8 0 0 1 -3.1 0.5 Q -1.55 0.2, 0 0.2 Q 1.55 0.2, 3.1 0.5 A 3.8 3.8 0 0 1 0 3.8 Z" fill="#d89472" opacity="0.35" />
              {/* 고리 앞 */}
              <g transform="rotate(-12)">
                <path d="M -7 0 A 7 1.8 0 0 0 7 0" fill="none" stroke="#c9a6ff" strokeWidth="0.8" strokeLinecap="round" />
              </g>
            </g>
          </g>
        </g>

        </g>{/* end: 궤도 시스템 -15° 회전 그룹 */}
      </svg>

      <style jsx>{`
        @keyframes solar-breathe {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
        @keyframes solar-star {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.95; }
        }
        @keyframes sun-pulse {
          0%, 100% { transform: scale(1); transform-origin: 50px 50px; }
          50% { transform: scale(1.08); transform-origin: 50px 50px; }
        }
        @keyframes sun-ray-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* 측면 공전 — 가로 타원 + 앞뒤 코일 모션 (4단계 keyframes)
           오른쪽(보통) → 뒤(작음·흐림) → 왼쪽(보통) → 앞(큼·진함) → 오른쪽
           translate 값은 viewBox 100x100 기준 px */

        /* 코일 모션 — 깊이감 극대화 (scale 0.3↔1.7, opacity 0.25↔1) */
        @keyframes orbit-side-1 {
          0%   { transform: translate(22px, 0px) scale(1); opacity: 1; filter: blur(0); }
          25%  { transform: translate(0px, -15px) scale(0.3); opacity: 0.3; filter: blur(0.6px); }
          50%  { transform: translate(-22px, 0px) scale(1); opacity: 1; filter: blur(0); }
          75%  { transform: translate(0px, 15px) scale(1.7); opacity: 1; filter: blur(0); }
          100% { transform: translate(22px, 0px) scale(1); opacity: 1; filter: blur(0); }
        }
        @keyframes orbit-side-2 {
          0%   { transform: translate(34px, 0px) scale(1); opacity: 1; filter: blur(0); }
          25%  { transform: translate(0px, -24px) scale(0.3); opacity: 0.3; filter: blur(0.6px); }
          50%  { transform: translate(-34px, 0px) scale(1); opacity: 1; filter: blur(0); }
          75%  { transform: translate(0px, 24px) scale(1.7); opacity: 1; filter: blur(0); }
          100% { transform: translate(34px, 0px) scale(1); opacity: 1; filter: blur(0); }
        }
        @keyframes orbit-side-3 {
          0%   { transform: translate(44px, 0px) scale(1); opacity: 1; filter: blur(0); }
          25%  { transform: translate(0px, -31px) scale(0.3); opacity: 0.3; filter: blur(0.6px); }
          50%  { transform: translate(-44px, 0px) scale(1); opacity: 1; filter: blur(0); }
          75%  { transform: translate(0px, 31px) scale(1.7); opacity: 1; filter: blur(0); }
          100% { transform: translate(44px, 0px) scale(1); opacity: 1; filter: blur(0); }
        }
        @keyframes orbit-side-4 {
          0%   { transform: translate(52px, 0px) scale(1); opacity: 1; filter: blur(0); }
          25%  { transform: translate(0px, -36px) scale(0.3); opacity: 0.3; filter: blur(0.6px); }
          50%  { transform: translate(-52px, 0px) scale(1); opacity: 1; filter: blur(0); }
          75%  { transform: translate(0px, 36px) scale(1.7); opacity: 1; filter: blur(0); }
          100% { transform: translate(52px, 0px) scale(1); opacity: 1; filter: blur(0); }
        }
        @keyframes moon-orbit-side {
          0%   { transform: translate(0px, 0px) scale(1); }
          25%  { transform: translate(0px, -4px) scale(0.5); opacity: 0.5; }
          50%  { transform: translate(0px, 0px) scale(1); opacity: 1; }
          75%  { transform: translate(0px, 4px) scale(1.25); }
          100% { transform: translate(0px, 0px) scale(1); }
        }

        @keyframes planet-spin-fast {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes planet-spin-mid {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes planet-spin-rev {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes planet-spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
