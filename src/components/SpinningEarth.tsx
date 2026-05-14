'use client';

/**
 * Monument Valley 톤 태양계 — 로딩 화면용 우주 시각화
 *
 * 디자인 컨셉:
 *  - Monument Valley 평면 색면 (외곽선 없음, 단색 면 위주)
 *  - 파스텔 + 코스믹 톤 (살구·라일락·페일핑크·세이지·청록)
 *  - 태양계 구조 — 중앙 태양 + 4개 행성 + 토성형 고리 + 달
 *  - 역동적 움직임 — 각 행성 다른 속도로 공전 + 자전 + 펄스
 *
 * 구성:
 *  - 중앙 태양 (살구·골드 그라데이션, 펄스 + 광선 호흡)
 *  - 4개 궤도 (얇은 살구 점선, 거의 보일 듯)
 *  - 행성 1 (가장 안쪽 — 페일핑크, 5s 공전 + 빠른 자전)
 *  - 행성 2 (라일락, 8s 공전 + 작은 위성 같이 도는 시스템)
 *  - 행성 3 (오렌지·살구, 12s 공전)
 *  - 행성 4 (토성형 — 페일핑크 + 라일락 고리, 18s 공전 + 자전)
 *  - 배경 별 6개 (트윙클)
 *  - 외곽 후광 (호흡)
 *
 * 애니메이션 (역동적):
 *  - 태양 펄스: 3s
 *  - 태양 광선 회전: 30s linear
 *  - 행성 공전: 5s / 8s / 12s / 18s linear
 *  - 행성 자전: 4s / 6s / 10s linear (역방향 일부)
 *  - 달 공전 (행성 2 주변): 3s linear
 *  - 별 트윙클: 4~6s
 *  - 외곽 후광: 4s 호흡
 */

interface SpinningEarthProps {
  size?: number;
  className?: string;
}

export function SpinningEarth({ size = 260, className = '' }: SpinningEarthProps) {
  // 배경 별 — 정적 6개
  const stars = [
    { cx: 8, cy: 14, r: 0.9, delay: 0 },
    { cx: 92, cy: 10, r: 1.0, delay: 2 },
    { cx: 6, cy: 84, r: 0.8, delay: 1 },
    { cx: 94, cy: 88, r: 1.1, delay: 3 },
    { cx: 50, cy: 4, r: 0.7, delay: 1.5 },
    { cx: 50, cy: 96, r: 0.8, delay: 0.8 },
  ];

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* 외곽 후광 */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(252,211,193,0.22) 0%, rgba(201,166,255,0.10) 38%, transparent 62%)',
          filter: 'blur(32px)',
          animation: 'solar-breathe 4s ease-in-out infinite',
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
          {/* 태양 그라데이션 — 살구·골드 코어 */}
          <radialGradient id="sunBody" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#fff5e1" stopOpacity="1" />
            <stop offset="30%" stopColor="#fcd5b4" stopOpacity="1" />
            <stop offset="70%" stopColor="#f0a880" stopOpacity="1" />
            <stop offset="100%" stopColor="#d89472" stopOpacity="1" />
          </radialGradient>

          {/* 태양 코로나 글로우 */}
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(252,213,180,0.6)" />
            <stop offset="60%" stopColor="rgba(240,168,128,0.15)" />
            <stop offset="100%" stopColor="rgba(240,168,128,0)" />
          </radialGradient>
        </defs>

        {/* 배경 별 — 트윙클 */}
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="#fef3c7"
            opacity="0.6"
            style={{ animation: `solar-star 6s ease-in-out ${s.delay}s infinite` }}
          />
        ))}

        {/* 행성 궤도 — 얇은 점선 (가이드) */}
        <g opacity="0.18">
          <circle cx="50" cy="50" r="20" fill="none" stroke="#fcd5b4" strokeWidth="0.3" strokeDasharray="1 2" />
          <circle cx="50" cy="50" r="28" fill="none" stroke="#fcd5b4" strokeWidth="0.3" strokeDasharray="1 2" />
          <circle cx="50" cy="50" r="36" fill="none" stroke="#fcd5b4" strokeWidth="0.3" strokeDasharray="1 2" />
          <circle cx="50" cy="50" r="44" fill="none" stroke="#fcd5b4" strokeWidth="0.3" strokeDasharray="1 2" />
        </g>

        {/* 태양 코로나 — 부드러운 글로우 */}
        <circle cx="50" cy="50" r="18" fill="url(#sunGlow)" style={{ animation: 'sun-pulse 3s ease-in-out infinite' }} />

        {/* 태양 광선 — 천천히 회전 */}
        <g style={{ transformOrigin: '50px 50px', animation: 'sun-ray-spin 30s linear infinite' }}>
          {Array.from({ length: 8 }, (_, i) => (
            <line
              key={i}
              x1="50"
              y1="40"
              x2="50"
              y2="36"
              stroke="#fcd5b4"
              strokeWidth="1"
              strokeLinecap="round"
              transform={`rotate(${i * 45} 50 50)`}
              opacity="0.7"
            />
          ))}
        </g>

        {/* 태양 본체 — 펄스 */}
        <circle cx="50" cy="50" r="9" fill="url(#sunBody)" style={{ animation: 'sun-pulse 3s ease-in-out infinite' }} />

        {/* 행성 1 — 페일핑크 (수성·금성 위치, 5s 공전) */}
        <g style={{ transformOrigin: '50px 50px', animation: 'orbit-1 5s linear infinite' }}>
          <g transform="translate(50 30)">
            <g style={{ animation: 'planet-spin-fast 4s linear infinite', transformOrigin: 'center' }}>
              <circle cx="0" cy="0" r="2.2" fill="#f8bbd0" />
              {/* 음영 한 면 */}
              <path d="M 0 2.2 A 2.2 2.2 0 0 1 -1.8 0 Q -0.9 -0.5, 0 -0.5 Q 0.9 -0.5, 1.8 0 A 2.2 2.2 0 0 1 0 2.2 Z" fill="#d68aa3" opacity="0.5" />
            </g>
          </g>
        </g>

        {/* 행성 2 — 라일락·청록 (지구 위치, 8s 공전, 달까지 거느린 시스템) */}
        <g style={{ transformOrigin: '50px 50px', animation: 'orbit-2 8s linear infinite' }}>
          <g transform="translate(50 22)">
            {/* 행성 본체 */}
            <g style={{ animation: 'planet-spin-mid 6s linear infinite', transformOrigin: 'center' }}>
              <circle cx="0" cy="0" r="3.2" fill="#c9a6ff" />
              {/* 표면 무늬 (대륙 느낌의 청록) */}
              <path d="M -1.5 -0.8 Q -0.5 -1.5, 0.8 -1 Q 1 -0.2, 0.3 0.4 Q -0.8 0.2, -1.5 -0.8 Z" fill="#7dd3c0" opacity="0.7" />
              {/* 음영 한 면 */}
              <path d="M 0 3.2 A 3.2 3.2 0 0 1 -2.6 0.5 Q -1.3 0.2, 0 0.2 Q 1.3 0.2, 2.6 0.5 A 3.2 3.2 0 0 1 0 3.2 Z" fill="#7c5ca8" opacity="0.4" />
            </g>
            {/* 달 — 행성 2 주위 작은 위성 (빠른 공전) */}
            <g style={{ animation: 'moon-orbit 3s linear infinite', transformOrigin: 'center' }}>
              <circle cx="6" cy="0" r="1.2" fill="#fff5e1" />
              <path d="M 6 1.2 A 1.2 1.2 0 0 1 4.9 0 Q 5.4 -0.3, 6 -0.3 Q 6.6 -0.3, 7.1 0 A 1.2 1.2 0 0 1 6 1.2 Z" fill="#dba294" opacity="0.45" />
            </g>
          </g>
        </g>

        {/* 행성 3 — 오렌지·살구 (화성 위치, 12s 공전) */}
        <g style={{ transformOrigin: '50px 50px', animation: 'orbit-3 12s linear infinite' }}>
          <g transform="translate(50 14)">
            <g style={{ animation: 'planet-spin-rev 10s linear infinite reverse', transformOrigin: 'center' }}>
              <circle cx="0" cy="0" r="2.6" fill="#f0a880" />
              <path d="M -1 -0.5 Q 0.5 -0.8, 1.2 -0.2 Q 0.8 0.3, 0 0.4 Q -1 0.1, -1 -0.5 Z" fill="#fcd5b4" opacity="0.65" />
              <path d="M 0 2.6 A 2.6 2.6 0 0 1 -2.1 0.3 Q -1.05 0, 0 0 Q 1.05 0, 2.1 0.3 A 2.6 2.6 0 0 1 0 2.6 Z" fill="#a85e3f" opacity="0.4" />
            </g>
          </g>
        </g>

        {/* 행성 4 — 토성형 (가장 바깥, 18s 공전 + 고리) */}
        <g style={{ transformOrigin: '50px 50px', animation: 'orbit-4 18s linear infinite' }}>
          <g transform="translate(50 6)">
            <g style={{ animation: 'planet-spin-slow 14s linear infinite', transformOrigin: 'center' }}>
              {/* 고리 — 뒤쪽 */}
              <g transform="rotate(-15)">
                <path d="M -6.5 0 A 6.5 1.8 0 0 1 6.5 0" fill="none" stroke="#c9a6ff" strokeWidth="0.8" strokeLinecap="round" />
              </g>
              {/* 행성 본체 */}
              <circle cx="0" cy="0" r="3.5" fill="#fcd5b4" />
              {/* 무늬 곡선 */}
              <path d="M -2.5 0.3 Q 0 -0.3, 2.5 0.3" fill="none" stroke="#f0a880" strokeWidth="0.8" strokeLinecap="round" opacity="0.8" />
              <path d="M -2.8 1.5 Q 0 1, 2.8 1.5" fill="none" stroke="#f0a880" strokeWidth="0.6" strokeLinecap="round" opacity="0.6" />
              {/* 음영 한 면 */}
              <path d="M 0 3.5 A 3.5 3.5 0 0 1 -2.9 0.5 Q -1.45 0.2, 0 0.2 Q 1.45 0.2, 2.9 0.5 A 3.5 3.5 0 0 1 0 3.5 Z" fill="#d89472" opacity="0.35" />
              {/* 고리 — 앞쪽 */}
              <g transform="rotate(-15)">
                <path d="M -6.5 0 A 6.5 1.8 0 0 0 6.5 0" fill="none" stroke="#c9a6ff" strokeWidth="0.8" strokeLinecap="round" />
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
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); transform-origin: 50px 50px; }
        }
        @keyframes sun-ray-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orbit-1 {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orbit-2 {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orbit-3 {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orbit-4 {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
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
        @keyframes moon-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
