'use client';

/**
 * Monument Valley 풍 코스믹 행성 — 로딩 화면용 우주 시각화
 *
 * 디자인 컨셉:
 *  - 미니멀 기하학 (단순 도형, 평면적 레이어)
 *  - 파스텔 그라디언트 (라일락·살구·페일 핑크 — 부드러운 코스믹 톤)
 *  - 디테일 텍스처 제거 (표면 무늬·위경도선 없음)
 *  - 평면 토성 고리 (앞·뒤 단순 곡선)
 *  - 큰 위성 하나 (단순 구체, 정적 그라디언트)
 *  - 정돈된 별빛 점 (별똥별 느낌의 흐름선)
 *
 * 애니메이션:
 *  - 행성 본체: 18초 1회전 (linear infinite) — 천천히 부유
 *  - 위성: 12초 궤도 공전
 *  - 외곽 후광: 5초 부드러운 펄스
 *  - 별빛 점: 4~7초 페이드
 *
 * size prop 으로 크기 조절. 기본 220px.
 */

interface SpinningEarthProps {
  size?: number;
  className?: string;
}

export function SpinningEarth({ size = 220, className = '' }: SpinningEarthProps) {
  // 정돈된 별빛 점 — Monument Valley 풍의 단정한 배치
  const stars = [
    { cx: 18, cy: 22, r: 0.9, delay: 0, duration: 5 },
    { cx: 88, cy: 16, r: 1.2, delay: 1.2, duration: 6 },
    { cx: 12, cy: 78, r: 0.7, delay: 0.6, duration: 5.5 },
    { cx: 92, cy: 84, r: 1.0, delay: 2, duration: 7 },
    { cx: 50, cy: 6, r: 0.8, delay: 1.5, duration: 4.5 },
    { cx: 82, cy: 50, r: 0.6, delay: 0.3, duration: 6.5 },
  ];

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* 외곽 후광 — 매우 부드러운 라일락 글로우 */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(201,166,255,0.22) 0%, rgba(252,211,193,0.08) 40%, transparent 65%)',
          filter: 'blur(28px)',
          animation: 'mv-pulse 5s ease-in-out infinite',
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
          {/* 행성 본체 — 라일락·보라 파스텔 그라디언트 (Monument Valley 풍) */}
          <radialGradient id="mvPlanet" cx="38%" cy="36%" r="62%">
            <stop offset="0%" stopColor="#e9d5ff" stopOpacity="1" />
            <stop offset="35%" stopColor="#c4a4e8" stopOpacity="1" />
            <stop offset="70%" stopColor="#8e76c4" stopOpacity="1" />
            <stop offset="100%" stopColor="#4a3878" stopOpacity="1" />
          </radialGradient>

          {/* 토성 고리 — 살구·페일 핑크 (Monument Valley 의 따뜻한 톤) */}
          <linearGradient id="mvRing" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="rgba(252,211,193,0)" />
            <stop offset="20%" stopColor="rgba(252,211,193,0.85)" />
            <stop offset="50%" stopColor="rgba(252,189,189,0.95)" />
            <stop offset="80%" stopColor="rgba(252,211,193,0.85)" />
            <stop offset="100%" stopColor="rgba(252,211,193,0)" />
          </linearGradient>

          {/* 위성 — 페일 핑크·크림 (단순 구체) */}
          <radialGradient id="mvMoon" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fff5e1" stopOpacity="1" />
            <stop offset="60%" stopColor="#fcd5c0" stopOpacity="1" />
            <stop offset="100%" stopColor="#e8a890" stopOpacity="1" />
          </radialGradient>

          {/* 빛 반사 — 부드러운 하이라이트 */}
          <radialGradient id="mvHighlight" cx="30%" cy="30%" r="40%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* 정돈된 별빛 점 — 부드러운 페이드 */}
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="rgba(254,243,199,0.85)"
            style={{ animation: `mv-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite` }}
          />
        ))}

        {/* 토성 고리 — 뒤쪽 곡선 (행성 뒤로 가는 부분) */}
        <g transform="translate(50 50) rotate(-18)">
          <path
            d="M -42 0 A 42 9 0 0 1 42 0"
            fill="none"
            stroke="url(#mvRing)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>

        {/* 회전하는 행성 본체 — Monument Valley 풍 단순 구체 */}
        <g style={{ animation: 'mv-spin 18s linear infinite', transformOrigin: '50px 50px' }}>
          {/* 본체 */}
          <circle cx="50" cy="50" r="24" fill="url(#mvPlanet)" />

          {/* 빛 반사 — 좌상단 하이라이트 (단순한 평면적 광) */}
          <ellipse
            cx="42"
            cy="40"
            rx="11"
            ry="7"
            fill="url(#mvHighlight)"
          />

          {/* 색면 — 하단 그림자 영역 (평면적 음영) */}
          <path
            d="M 50 74 A 24 24 0 0 1 30 60 Q 36 58, 50 58 Q 64 58, 70 60 A 24 24 0 0 1 50 74 Z"
            fill="rgba(74,56,120,0.35)"
          />
        </g>

        {/* 토성 고리 — 앞쪽 곡선 (행성 앞으로 가는 부분, 살짝 두껍게) */}
        <g transform="translate(50 50) rotate(-18)">
          <path
            d="M -42 0 A 42 9 0 0 0 42 0"
            fill="none"
            stroke="url(#mvRing)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>

        {/* 위성 — 큰 구체 하나, 천천히 궤도 공전 */}
        <g style={{ animation: 'mv-orbit 12s linear infinite', transformOrigin: '50px 50px' }}>
          <circle cx="50" cy="12" r="4" fill="url(#mvMoon)" />
        </g>
      </svg>

      <style jsx>{`
        @keyframes mv-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes mv-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes mv-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes mv-twinkle {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
