'use client';

/**
 * 코스믹 행성 — 로딩 화면용 우주 시각화
 *
 * 디자인 컨셉 (Flaticon-style + Monument Valley 톤):
 *  - 굵은 외곽선 (stroke) + 단색 면 (fill) 분리 — GIF 4종 (asteroid·moon·galaxy·solar-system) 참고
 *  - 십자 별 (+) 장식 — galaxy GIF 모티프
 *  - 단색 면 — 살구·라일락·청록 코스믹 톤
 *  - 다크 배경 위에서 떠 있는 일러스트 느낌
 *
 * 구성:
 *  - 행성 (토성) — 두꺼운 보라 외곽선 + 살구 면 + 라일락 무늬 곡선
 *  - 고리 — 두꺼운 라이트 라일락 stroke (앞·뒤 분리)
 *  - 위성(달) — 청록 외곽선 + 페일핑크 면 + 분화구 점들
 *  - 십자 별 4개 + 작은 점 별 6개
 *
 * 애니메이션:
 *  - 행성 자전: 20s linear infinite
 *  - 위성 궤도: 14s linear infinite
 *  - 십자 별 깜빡임: 각각 다른 timing
 *  - 외곽 후광: 5s 펄스
 */

interface SpinningEarthProps {
  size?: number;
  className?: string;
}

export function SpinningEarth({ size = 220, className = '' }: SpinningEarthProps) {
  // 별 — 십자 (+) 4개 + 점 6개
  const crossStars = [
    { x: 16, y: 14, size: 5, delay: 0, duration: 3 },
    { x: 86, y: 78, size: 4.5, delay: 1.2, duration: 3.5 },
    { x: 84, y: 20, size: 4, delay: 2, duration: 4 },
    { x: 18, y: 84, size: 4, delay: 0.6, duration: 3.2 },
  ];
  const dotStars = [
    { cx: 10, cy: 50, r: 0.9, delay: 0.3 },
    { cx: 90, cy: 50, r: 1.1, delay: 1.8 },
    { cx: 50, cy: 5, r: 0.8, delay: 0.9 },
    { cx: 50, cy: 95, r: 1.0, delay: 2.4 },
    { cx: 28, cy: 30, r: 0.7, delay: 1.4 },
    { cx: 76, cy: 70, r: 0.8, delay: 0.5 },
  ];

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* 외곽 후광 — 부드러운 라일락 글로우 */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(167,139,250,0.22) 0%, rgba(252,211,193,0.10) 40%, transparent 65%)',
          filter: 'blur(28px)',
          animation: 'orb-pulse 5s ease-in-out infinite',
        }}
      />

      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="relative z-10"
        style={{ overflow: 'visible' }}
      >
        {/* 점 별 — 다크 배경 위 작은 별빛 */}
        {dotStars.map((s, i) => (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="#fef3c7"
            opacity="0.85"
            style={{ animation: `orb-twinkle 4s ease-in-out ${s.delay}s infinite` }}
          />
        ))}

        {/* 십자 별 (+) — galaxy GIF 모티프 */}
        {crossStars.map((s, i) => {
          const half = s.size / 2;
          return (
            <g
              key={i}
              transform={`translate(${s.x} ${s.y})`}
              style={{ animation: `orb-cross-twinkle ${s.duration}s ease-in-out ${s.delay}s infinite` }}
            >
              <line x1={-half} y1="0" x2={half} y2="0" stroke="#67e8f9" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="0" y1={-half} x2="0" y2={half} stroke="#67e8f9" strokeWidth="1.4" strokeLinecap="round" />
            </g>
          );
        })}

        {/* 토성 고리 — 뒤쪽 */}
        <g transform="translate(50 52) rotate(-18)">
          <ellipse
            cx="0"
            cy="0"
            rx="34"
            ry="8"
            fill="none"
            stroke="#c9a6ff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="58 100"
            strokeDashoffset="0"
          />
        </g>

        {/* 회전하는 행성 본체 — 두꺼운 보라 외곽선 + 살구 면 (Flaticon 풍) */}
        <g style={{ animation: 'orb-spin 20s linear infinite', transformOrigin: '50px 52px' }}>
          {/* 면 — 살구 단색 */}
          <circle cx="50" cy="52" r="20" fill="#fdba74" />

          {/* 무늬 — 라일락 곡선 (solar-system GIF 의 토성 무늬 참고) */}
          <path
            d="M 32 55 Q 42 50, 50 55 Q 58 60, 68 56"
            fill="none"
            stroke="#c084fc"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.85"
          />
          <path
            d="M 36 47 Q 44 44, 52 48"
            fill="none"
            stroke="#c084fc"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.7"
          />

          {/* 외곽선 — 두꺼운 다크 보라 */}
          <circle cx="50" cy="52" r="20" fill="none" stroke="#3b2860" strokeWidth="3.5" />
        </g>

        {/* 토성 고리 — 앞쪽 (행성 위에 겹쳐서 그려야 깊이감) */}
        <g transform="translate(50 52) rotate(-18)">
          <ellipse
            cx="0"
            cy="0"
            rx="34"
            ry="8"
            fill="none"
            stroke="#c9a6ff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="58 100"
            strokeDashoffset="-58"
          />
        </g>

        {/* 위성(달) — 청록 외곽선 + 페일핑크 면 (moon GIF 참고) */}
        <g style={{ animation: 'orb-orbit 14s linear infinite', transformOrigin: '50px 52px' }}>
          <g transform="translate(50 12)">
            <circle cx="0" cy="0" r="6" fill="#fcd5c0" />
            {/* 분화구 — 작은 원 */}
            <circle cx="-1.8" cy="-1.5" r="1.2" fill="none" stroke="#3b2860" strokeWidth="0.8" />
            <circle cx="2" cy="1.5" r="0.9" fill="none" stroke="#3b2860" strokeWidth="0.7" />
            <circle cx="-0.5" cy="2.2" r="0.5" fill="#3b2860" />
            {/* 외곽선 */}
            <circle cx="0" cy="0" r="6" fill="none" stroke="#3b2860" strokeWidth="2" />
          </g>
        </g>
      </svg>

      <style jsx>{`
        @keyframes orb-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orb-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes orb-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes orb-twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes orb-cross-twinkle {
          0%, 100% { opacity: 0.4; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
