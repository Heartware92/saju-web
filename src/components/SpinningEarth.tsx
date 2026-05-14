'use client';

/**
 * Monument Valley 풍 신전 포털 — 로딩 화면용 우주 시각화
 *
 * 사용자 참고 (Monument Valley 게임 스크린샷):
 *  - 신전형 대칭 건축물 + 중앙 원형 메달 + 방사형 빛 줄기 (열렸다 닫혔다)
 *  - 평면 색면 (외곽선 없음, 단색 면만으로 입체)
 *  - 정적·신비로운 분위기
 *
 * 구성:
 *  - 중앙 원형 포털 (크림·살구 톤 메달)
 *  - 사방 12개 빛 줄기 — 펼침·닫힘 펄스 (운명의 문 모티프)
 *  - 좌우 대칭 기둥 (라일락 평면)
 *  - 상단 돔 + 작은 첨탑 (페일핑크)
 *  - 하단 받침대 (살구)
 *  - 배경 별빛 정적 (사주 점성술 톤)
 *
 * 애니메이션:
 *  - 빛 줄기: 4s ease-in-out, 펼쳐졌다 닫혔다 (scale + opacity)
 *  - 중앙 메달: 5s 호흡 (작은 펄스)
 *  - 외곽 후광: 6s 호흡
 *  - 별: 정적·미세 트윙클 8s
 *  - 건축물: 정적 (Monument Valley 정석)
 */

interface SpinningEarthProps {
  size?: number;
  className?: string;
}

export function SpinningEarth({ size = 240, className = '' }: SpinningEarthProps) {
  // 별 — 6개 정적 점
  const stars = [
    { cx: 10, cy: 18, r: 0.9, delay: 0 },
    { cx: 90, cy: 14, r: 1.1, delay: 3 },
    { cx: 92, cy: 70, r: 0.8, delay: 1.5 },
    { cx: 8, cy: 76, r: 1.0, delay: 5 },
    { cx: 22, cy: 8, r: 0.7, delay: 2 },
    { cx: 78, cy: 88, r: 0.8, delay: 4 },
  ];

  // 방사형 빛 줄기 — 12방향 (시계 12·1·2... 위치)
  const rays = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30) - 90; // 12시 방향부터 시작
    return { angle, delay: (i % 4) * 0.15 };
  });

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* 외곽 후광 — 부드러운 살구·라일락 호흡 */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(252,211,193,0.22) 0%, rgba(201,166,255,0.10) 38%, transparent 62%)',
          filter: 'blur(32px)',
          animation: 'mv-breathe 6s ease-in-out infinite',
        }}
      />

      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="relative z-10"
        style={{ overflow: 'visible' }}
      >
        {/* 배경 별 — 정적·미세 트윙클 */}
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="#fef3c7"
            opacity="0.55"
            style={{ animation: `mv-star 8s ease-in-out ${s.delay}s infinite` }}
          />
        ))}

        {/* 방사형 빛 줄기 — 12방향, 펼쳐졌다 닫혔다 (운명의 관문이 열림) */}
        <g style={{ transformOrigin: '50px 50px' }}>
          {rays.map((r, i) => (
            <g
              key={i}
              transform={`rotate(${r.angle} 50 50)`}
              style={{ animation: `mv-ray 4s ease-in-out ${r.delay}s infinite` }}
            >
              <line
                x1="50"
                y1="35"
                x2="50"
                y2="22"
                stroke="#fcd5b4"
                strokeWidth="1.4"
                strokeLinecap="round"
                opacity="0.7"
              />
            </g>
          ))}
        </g>

        {/* 좌우 대칭 기둥 — 라일락 평면 색면 (Monument Valley 풍) */}
        {/* 왼쪽 기둥 */}
        <g>
          <rect x="22" y="52" width="6" height="22" fill="#9b7dc7" />
          <rect x="22" y="52" width="6" height="3" fill="#c9a6ff" />
          {/* 받침 */}
          <rect x="20" y="72" width="10" height="3" fill="#7c5ca8" />
        </g>
        {/* 오른쪽 기둥 (대칭) */}
        <g>
          <rect x="72" y="52" width="6" height="22" fill="#9b7dc7" />
          <rect x="72" y="52" width="6" height="3" fill="#c9a6ff" />
          <rect x="70" y="72" width="10" height="3" fill="#7c5ca8" />
        </g>

        {/* 하단 받침대 — 살구 평면 색면 */}
        <g>
          {/* 윗단 */}
          <rect x="30" y="73" width="40" height="4" fill="#f0a880" />
          <rect x="30" y="73" width="40" height="1.5" fill="#fcd5b4" />
          {/* 아래단 (조금 넓게) */}
          <rect x="26" y="77" width="48" height="5" fill="#d89472" />
          <rect x="26" y="77" width="48" height="1.5" fill="#f0a880" />
        </g>

        {/* 중앙 원형 포털 (메달) — 부드러운 펄스 */}
        <g style={{ transformOrigin: '50px 50px', animation: 'mv-medallion 5s ease-in-out infinite' }}>
          {/* 외곽 링 — 살구 톤 */}
          <circle cx="50" cy="50" r="14" fill="#fcd5b4" />
          {/* 안쪽 원 — 크림 톤 */}
          <circle cx="50" cy="50" r="10" fill="#fff5e1" />
          {/* 메달 안 4분점 star — 사주 점성술 모티프 */}
          <g>
            <circle cx="50" cy="50" r="1.8" fill="#c084fc" />
            <line x1="50" y1="44" x2="50" y2="46" stroke="#c084fc" strokeWidth="1" strokeLinecap="round" />
            <line x1="50" y1="54" x2="50" y2="56" stroke="#c084fc" strokeWidth="1" strokeLinecap="round" />
            <line x1="44" y1="50" x2="46" y2="50" stroke="#c084fc" strokeWidth="1" strokeLinecap="round" />
            <line x1="54" y1="50" x2="56" y2="50" stroke="#c084fc" strokeWidth="1" strokeLinecap="round" />
          </g>
        </g>

        {/* 상단 돔 + 첨탑 — 페일핑크 평면 */}
        <g>
          {/* 돔 본체 (반원) */}
          <path
            d="M 36 36 Q 50 22, 64 36 L 64 38 L 36 38 Z"
            fill="#eaa5bc"
          />
          {/* 돔 하이라이트 (좌측) */}
          <path
            d="M 36 36 Q 44 26, 50 24 L 50 38 L 36 38 Z"
            fill="#f8bbd0"
          />
          {/* 첨탑 (위로 솟은 삼각) */}
          <path d="M 50 22 L 48 14 L 50 12 L 52 14 Z" fill="#f8bbd0" />
          {/* 첨탑 꼭대기 작은 별 */}
          <circle cx="50" cy="11" r="1.2" fill="#fff5e1" />
        </g>
      </svg>

      <style jsx>{`
        @keyframes mv-breathe {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes mv-star {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.85; }
        }
        @keyframes mv-ray {
          0%, 100% { opacity: 0.15; transform: scaleY(0.45); }
          50% { opacity: 0.95; transform: scaleY(1); }
        }
        @keyframes mv-medallion {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
      `}</style>
    </div>
  );
}
