'use client';

/**
 * Monument Valley 톤 측면 태양계 — 로딩 화면용 우주 시각화
 *
 * 2026-05-17 궤도 정확화 — 4단계 keyframes 의 직선 보간(마름모꼴 경로) 문제 해결.
 * cos/sin 으로 36단계(10도 간격) keyframes 동적 생성하여 점선 ellipse 와 정확히 일치.
 *
 * 시각화 컨셉:
 *  - 측면 시점 (45도 위에서 비스듬히) — ry/rx ≈ 0.7
 *  - 행성이 앞으로 (y > 0): 크게·진하게
 *  - 행성이 뒤로 (y < 0): 작게·흐리게
 *  - 측면 (y = 0): 기본 크기·완전 불투명
 *
 * 구성:
 *  - 중앙 태양 (5s 펄스 + 8광선 회전)
 *  - 4개 행성 각자 타원 궤도 (안쪽 빠름·바깥 느림)
 *  - 행성 2(라일락) 은 달 거느림 (작은 원 궤도, 동일한 측면 시점)
 *  - 배경 별 6개 트윙클
 *
 * 좌표계: viewBox 100×100, 중심 (50,50).
 * 행성 outer <g> 가 keyframes 로 (rx*cosθ, ry*sinθ) 만큼 translate.
 * inner <g> 에 translate(50,50) 으로 origin 보정.
 */

interface SpinningEarthProps {
  size?: number;
  className?: string;
}

// ── 궤도 keyframes 동적 생성 ─────────────────────────────────────
/**
 * 측면 시점 타원 궤도 keyframes 36단계 생성.
 * t ∈ [0,1] 일 때 (rx*cos(2πt), ry*sin(2πt)).
 * y 부호로 scale·opacity 보간:
 *  - y > 0 (앞): scale 1 → 1.4, opacity 1
 *  - y < 0 (뒤): scale 1 → 0.6, opacity 1 → 0.55
 *  - y = 0 (측면): scale 1, opacity 1
 */
function buildOrbitKeyframes(name: string, rx: number, ry: number): string {
  const STEPS = 36;
  const frames: string[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const theta = 2 * Math.PI * t;
    const x = rx * Math.cos(theta);
    const y = ry * Math.sin(theta);
    const yRatio = y / ry;                      // -1 (뒤) ~ +1 (앞)
    // scale: 뒤(-1)→0.6, 측면(0)→1, 앞(+1)→1.4
    const scale = 1 + yRatio * 0.4;
    // opacity: 앞·측면=1, 뒤로 갈수록 0.55 까지
    const opacity = y >= 0 ? 1 : 1 + yRatio * 0.45;
    frames.push(
      `${(t * 100).toFixed(2)}% { transform: translate(${x.toFixed(3)}px, ${y.toFixed(3)}px) scale(${scale.toFixed(3)}); opacity: ${opacity.toFixed(3)}; }`,
    );
  }
  return `@keyframes ${name} {\n      ${frames.join('\n      ')}\n    }`;
}

// 4개 궤도 — viewBox 100x100, ry/rx ≈ 0.7 균일 (같은 시야각)
const ORBIT_RADII = [
  { rx: 22, ry: 15 },  // 안쪽 (행성1)
  { rx: 34, ry: 24 },  // 행성2 (지구·달)
  { rx: 44, ry: 31 },  // 행성3
  { rx: 52, ry: 36 },  // 바깥 (행성4)
];

const ORBIT_KEYFRAMES_CSS = ORBIT_RADII
  .map((r, i) => buildOrbitKeyframes(`orbit-side-${i + 1}`, r.rx, r.ry))
  .join('\n    ');

// 달 궤도 — 행성2 주변 작은 원, 측면 시점 동일 비율(ry/rx ≈ 0.4 정도, 더 납작)
const MOON_KEYFRAMES_CSS = buildOrbitKeyframes('moon-orbit-side', 6, 2.4);

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

        {/* 궤도 가이드 — ORBIT_RADII 와 정확히 같은 rx/ry */}
        <g opacity="0.16">
          {ORBIT_RADII.map((r, i) => (
            <ellipse
              key={i}
              cx="50"
              cy="50"
              rx={r.rx}
              ry={r.ry}
              fill="none"
              stroke="#fcd5b4"
              strokeWidth="0.3"
              strokeDasharray="1 2"
            />
          ))}
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

        {/* 행성 1 — 가장 안쪽 궤도(rx=22, ry=15), 페일핑크, 8s */}
        <g style={{ animation: 'orbit-side-1 8s linear infinite', transformOrigin: '50px 50px' }}>
          <g style={{ transform: 'translate(50px, 50px)' }}>
            <g style={{ animation: 'planet-spin-fast 7s linear infinite' }}>
              <circle cx="0" cy="0" r="2.2" fill="#f8bbd0" />
              <path d="M 0 2.2 A 2.2 2.2 0 0 1 -1.8 0 Q -0.9 -0.5, 0 -0.5 Q 0.9 -0.5, 1.8 0 A 2.2 2.2 0 0 1 0 2.2 Z" fill="#d68aa3" opacity="0.5" />
            </g>
          </g>
        </g>

        {/* 행성 2 — 지구 궤도(rx=34, ry=24), 라일락+청록, 14s + 달 */}
        <g style={{ animation: 'orbit-side-2 14s linear infinite', transformOrigin: '50px 50px' }}>
          <g style={{ transform: 'translate(50px, 50px)' }}>
            <g style={{ animation: 'planet-spin-mid 10s linear infinite' }}>
              <circle cx="0" cy="0" r="3.2" fill="#c9a6ff" />
              <path d="M -1.5 -0.8 Q -0.5 -1.5, 0.8 -1 Q 1 -0.2, 0.3 0.4 Q -0.8 0.2, -1.5 -0.8 Z" fill="#7dd3c0" opacity="0.7" />
              <path d="M 0 3.2 A 3.2 3.2 0 0 1 -2.6 0.5 Q -1.3 0.2, 0 0.2 Q 1.3 0.2, 2.6 0.5 A 3.2 3.2 0 0 1 0 3.2 Z" fill="#7c5ca8" opacity="0.4" />
            </g>
            {/* 달 — 행성 2 주위 작은 측면 궤도 (rx=6, ry=2.4), 5s */}
            <g style={{ animation: 'moon-orbit-side 5s linear infinite' }}>
              <circle cx="0" cy="0" r="1.2" fill="#fff5e1" />
            </g>
          </g>
        </g>

        {/* 행성 3 — 화성 궤도(rx=44, ry=31), 살구, 22s */}
        <g style={{ animation: 'orbit-side-3 22s linear infinite', transformOrigin: '50px 50px' }}>
          <g style={{ transform: 'translate(50px, 50px)' }}>
            <g style={{ animation: 'planet-spin-rev 16s linear infinite reverse' }}>
              <circle cx="0" cy="0" r="2.6" fill="#f0a880" />
              <path d="M -1 -0.5 Q 0.5 -0.8, 1.2 -0.2 Q 0.8 0.3, 0 0.4 Q -1 0.1, -1 -0.5 Z" fill="#fcd5b4" opacity="0.65" />
              <path d="M 0 2.6 A 2.6 2.6 0 0 1 -2.1 0.3 Q -1.05 0, 0 0 Q 1.05 0, 2.1 0.3 A 2.6 2.6 0 0 1 0 2.6 Z" fill="#a85e3f" opacity="0.4" />
            </g>
          </g>
        </g>

        {/* 행성 4 — 토성형 궤도(rx=52, ry=36), 32s */}
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

        /* ── 측면 타원 궤도 keyframes — cos/sin 36단계로 점선 ellipse 와 정확히 일치 ── */
        ${ORBIT_KEYFRAMES_CSS}

        ${MOON_KEYFRAMES_CSS}

        @keyframes planet-spin-fast { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes planet-spin-mid  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes planet-spin-rev  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes planet-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
