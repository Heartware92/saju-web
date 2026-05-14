'use client';

/**
 * 태양계 9행성 일자 배열 — 로딩 화면용 우주 시각화
 *
 * 디자인:
 *  - 태양 + 수성·금성·지구·화성·목성·토성·천왕성·해왕성·명왕성 (10개)
 *  - 좌상(태양) → 우하(명왕성) 약 25도 비스듬한 일자 배열
 *  - 각 행성 실제 크기 비례 (시각적 압축, 0.8 ~ 5.5)
 *  - 행성 자체 자전 (각자 다른 속도) + 미세 부유 (공전 흉내)
 *  - 태양 반짝임 (코로나 펄스·광선 회전·작은 별빛 입자)
 *  - 페이지 톤 매칭 — 라일락·살구·페일핑크·보라 코스믹
 */

interface SpinningEarthProps {
  size?: number;
  className?: string;
}

// 좌상 → 우하 일자 배열 — 각도 25°
const ANGLE_RAD = (25 * Math.PI) / 180;
const COS = Math.cos(ANGLE_RAD);
const SIN = Math.sin(ANGLE_RAD);
const X0 = 8;
const Y0 = 28;

// 행성 데이터 — 위치 거리(d) · 실제 비례 크기(r) · 색 · 자전 속도 · 부유 속도
type Planet = {
  key: string;
  d: number;        // 태양 기준 거리 (viewBox 단위)
  r: number;        // 크기 (시각적 압축)
  color: string;    // 본체 색
  stripe?: string;  // 표면 무늬 색 (자전 시각화)
  shadow: string;   // 음영 한 면 색
  spin: number;     // 자전 1바퀴 (초)
  float: number;    // 미세 부유 (초)
};

const planets: Planet[] = [
  { key: 'mercury', d: 12, r: 1.2, color: '#a899c2', shadow: '#6b5d85', spin: 8, float: 5 },
  { key: 'venus',   d: 19, r: 2.2, color: '#fcd5b4', stripe: '#f0a880', shadow: '#a8784e', spin: 15, float: 6.5 },
  { key: 'earth',   d: 27, r: 2.3, color: '#7dd3c0', stripe: '#c9a6ff', shadow: '#3a6e6b', spin: 6, float: 7 },
  { key: 'mars',    d: 34, r: 1.5, color: '#f0a880', stripe: '#fcd5b4', shadow: '#a85e3f', spin: 7, float: 5.5 },
  { key: 'jupiter', d: 47, r: 5.5, color: '#c9a6ff', stripe: '#f8bbd0', shadow: '#6e4ca0', spin: 4, float: 9 },
  { key: 'saturn',  d: 62, r: 4.6, color: '#f8bbd0', stripe: '#fcd5b4', shadow: '#a96b85', spin: 5, float: 8.5 },
  { key: 'uranus',  d: 75, r: 3.0, color: '#9bc4d4', stripe: '#c9a6ff', shadow: '#5a8294', spin: 5, float: 7.5 },
  { key: 'neptune', d: 85, r: 2.9, color: '#7d6db5', stripe: '#a899c2', shadow: '#3d3475', spin: 5, float: 7.2 },
  { key: 'pluto',   d: 94, r: 0.8, color: '#b8a8b8', shadow: '#6e6070', spin: 12, float: 6 },
];

export function SpinningEarth({ size = 380, className = '' }: SpinningEarthProps) {
  // 배경 별 — 정적 트윙클
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

  // 태양 광선 (반짝임)
  const sunRays = Array.from({ length: 12 }, (_, i) => i * 30);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* 외곽 후광 — 태양 위치 기준 */}
      <div
        className="absolute"
        style={{
          left: `${(X0 / 100) * size - 60}px`,
          top: `${(Y0 / 100) * size - 60}px`,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(252,213,180,0.30) 0%, rgba(240,168,128,0.10) 45%, transparent 70%)',
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
          {/* 태양 그라데이션 */}
          <radialGradient id="sun-body" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#fff5e1" stopOpacity="1" />
            <stop offset="30%" stopColor="#fcd5b4" stopOpacity="1" />
            <stop offset="70%" stopColor="#f0a880" stopOpacity="1" />
            <stop offset="100%" stopColor="#d89472" stopOpacity="1" />
          </radialGradient>
          <radialGradient id="sun-corona" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(252,213,180,0.7)" />
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
            opacity="0.55"
            style={{ animation: `sol-twinkle 7s ease-in-out ${s.delay}s infinite` }}
          />
        ))}

        {/* 행성 배열 안내선 — 매우 옅게 */}
        <line
          x1={X0}
          y1={Y0}
          x2={X0 + 96 * COS}
          y2={Y0 + 96 * SIN}
          stroke="#fcd5b4"
          strokeWidth="0.2"
          strokeDasharray="0.5 1.5"
          opacity="0.12"
        />

        {/* 태양 — 좌상단, 반짝임 */}
        <g style={{ animation: 'sol-float 7s ease-in-out infinite' }}>
          {/* 코로나 글로우 */}
          <circle cx={X0} cy={Y0} r="12" fill="url(#sun-corona)" style={{ animation: 'sol-pulse 3s ease-in-out infinite' }} />
          {/* 광선 12개 (회전) */}
          <g style={{ transformOrigin: `${X0}px ${Y0}px`, animation: 'sol-rays-spin 40s linear infinite' }}>
            {sunRays.map((angle, i) => (
              <line
                key={i}
                x1={X0}
                y1={Y0 - 8}
                x2={X0}
                y2={Y0 - 11.5}
                stroke="#fcd5b4"
                strokeWidth="0.9"
                strokeLinecap="round"
                transform={`rotate(${angle} ${X0} ${Y0})`}
                opacity="0.85"
                style={{ animation: `sol-ray-blink 2.5s ease-in-out ${(i % 4) * 0.3}s infinite` }}
              />
            ))}
          </g>
          {/* 태양 본체 (펄스) */}
          <circle cx={X0} cy={Y0} r="6.5" fill="url(#sun-body)" style={{ animation: 'sol-pulse 3s ease-in-out infinite' }} />
          {/* 본체 위 반짝임 */}
          <circle cx={X0 - 1.5} cy={Y0 - 2} r="1.2" fill="rgba(255,255,255,0.7)" style={{ animation: 'sol-sparkle 2s ease-in-out infinite' }} />
        </g>

        {/* 9행성 일렬 배치 */}
        {planets.map((p) => {
          const cx = X0 + p.d * COS;
          const cy = Y0 + p.d * SIN;
          return (
            <g
              key={p.key}
              style={{ animation: `sol-planet-float-${p.key} ${p.float}s ease-in-out infinite` }}
            >
              {/* 토성 고리 — 뒤쪽 */}
              {p.key === 'saturn' && (
                <g transform={`translate(${cx} ${cy}) rotate(-12)`}>
                  <path
                    d={`M ${-p.r * 1.9} 0 A ${p.r * 1.9} ${p.r * 0.55} 0 0 1 ${p.r * 1.9} 0`}
                    fill="none"
                    stroke="#c9a6ff"
                    strokeWidth="0.7"
                    strokeLinecap="round"
                  />
                </g>
              )}

              {/* 행성 본체 + 자전 무늬 그룹 (자전) */}
              <g
                style={{
                  transformOrigin: `${cx}px ${cy}px`,
                  animation: `sol-spin-${p.key} ${p.spin}s linear infinite`,
                }}
              >
                <circle cx={cx} cy={cy} r={p.r} fill={p.color} />

                {/* 자전 표시용 표면 무늬 */}
                {p.stripe && (
                  <>
                    <path
                      d={`M ${cx - p.r * 0.85} ${cy - p.r * 0.2} Q ${cx} ${cy - p.r * 0.5}, ${cx + p.r * 0.85} ${cy - p.r * 0.2}`}
                      fill="none"
                      stroke={p.stripe}
                      strokeWidth={p.r * 0.18}
                      strokeLinecap="round"
                      opacity="0.7"
                    />
                    <path
                      d={`M ${cx - p.r * 0.9} ${cy + p.r * 0.35} Q ${cx} ${cy + p.r * 0.1}, ${cx + p.r * 0.9} ${cy + p.r * 0.35}`}
                      fill="none"
                      stroke={p.stripe}
                      strokeWidth={p.r * 0.14}
                      strokeLinecap="round"
                      opacity="0.55"
                    />
                  </>
                )}

                {/* 음영 한 면 (Monument Valley 풍) */}
                <path
                  d={`M ${cx} ${cy + p.r} A ${p.r} ${p.r} 0 0 1 ${cx - p.r * 0.85} ${cy + p.r * 0.2} Q ${cx - p.r * 0.4} ${cy}, ${cx} ${cy} Q ${cx + p.r * 0.4} ${cy}, ${cx + p.r * 0.85} ${cy + p.r * 0.2} A ${p.r} ${p.r} 0 0 1 ${cx} ${cy + p.r} Z`}
                  fill={p.shadow}
                  opacity="0.38"
                />
              </g>

              {/* 토성 고리 — 앞쪽 */}
              {p.key === 'saturn' && (
                <g transform={`translate(${cx} ${cy}) rotate(-12)`}>
                  <path
                    d={`M ${-p.r * 1.9} 0 A ${p.r * 1.9} ${p.r * 0.55} 0 0 0 ${p.r * 1.9} 0`}
                    fill="none"
                    stroke="#c9a6ff"
                    strokeWidth="0.7"
                    strokeLinecap="round"
                  />
                </g>
              )}

              {/* 천왕성 세로 고리 (실제 천왕성 특징) */}
              {p.key === 'uranus' && (
                <g transform={`translate(${cx} ${cy}) rotate(75)`}>
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
          0%, 100% { transform: scale(1); transform-origin: ${X0}px ${Y0}px; }
          50% { transform: scale(1.1); transform-origin: ${X0}px ${Y0}px; }
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
          0%, 100% { opacity: 0.4; transform: scale(0.9); transform-origin: ${X0 - 1.5}px ${Y0 - 2}px; }
          50% { opacity: 1; transform: scale(1.3); transform-origin: ${X0 - 1.5}px ${Y0 - 2}px; }
        }
        @keyframes sol-float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(0.5px, -0.8px); }
        }

        ${planets.map((p) => `
          @keyframes sol-spin-${p.key} {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes sol-planet-float-${p.key} {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(${(parseInt(p.key.charCodeAt(0).toString()) % 2 === 0 ? '0.4' : '-0.4')}px, -${0.5 + p.r * 0.08}px); }
          }
        `).join('\n')}
      `}</style>
    </div>
  );
}
