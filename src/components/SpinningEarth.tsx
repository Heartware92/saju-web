'use client';

/**
 * Monument Valley 풍 이소메트릭 탑 — 로딩 화면용 우주 시각화
 *
 * 진짜 Monument Valley 게임 톤:
 *  - 이소메트릭 투시 (3면 — top·left·right) 평면 색면
 *  - 외곽선 없음, 면 색만으로 형태
 *  - 파스텔 그라디언트 (라일락·살구·페일핑크·세이지)
 *  - 한 면 = 한 색 (그라디언트 X, 단색 평면 톤)
 *  - 정적이고 명상적 — 거의 움직이지 않음
 *
 * 구성:
 *  - 3층 계단형 큐브 탑 (위로 갈수록 작아짐)
 *  - 각 큐브: top(밝은 면) / left(중간 면) / right(어두운 면) 3색
 *  - 꼭대기에 작은 달 (천천히 부유)
 *  - 배경 별 4개 (정적·미세 트윙클)
 *  - 외곽 후광 (부드러운 호흡)
 *
 * 애니메이션:
 *  - 탑: 완전 정적
 *  - 달 부유: 14s ease-in-out (위·아래 3px)
 *  - 후광: 8s ease-in-out 호흡
 *  - 별 트윙클: 12s ease-in-out (정적에 가깝게)
 */

interface SpinningEarthProps {
  size?: number;
  className?: string;
}

export function SpinningEarth({ size = 220, className = '' }: SpinningEarthProps) {
  // 별 — 정적·미세한 점 4개
  const stars = [
    { cx: 14, cy: 22, r: 0.9, delay: 0 },
    { cx: 86, cy: 18, r: 1.1, delay: 4 },
    { cx: 88, cy: 78, r: 0.8, delay: 2 },
    { cx: 12, cy: 80, r: 1.0, delay: 6 },
  ];

  // 이소메트릭 큐브 좌표 계산 헬퍼
  // cx, cy = 큐브 중심 (윗면 중심 기준), w = 큐브 한 변(이소메트릭 기준 가로 절반), h = 높이
  function isoCube(cx: number, cy: number, w: number, h: number) {
    // top face — 다이아몬드 (4점)
    const top = `M ${cx} ${cy} L ${cx + w} ${cy + w * 0.5} L ${cx} ${cy + w} L ${cx - w} ${cy + w * 0.5} Z`;
    // left face — 평행사변형 (앞에서 본 왼쪽)
    const left = `M ${cx - w} ${cy + w * 0.5} L ${cx} ${cy + w} L ${cx} ${cy + w + h} L ${cx - w} ${cy + w * 0.5 + h} Z`;
    // right face — 평행사변형 (앞에서 본 오른쪽)
    const right = `M ${cx + w} ${cy + w * 0.5} L ${cx} ${cy + w} L ${cx} ${cy + w + h} L ${cx + w} ${cy + w * 0.5 + h} Z`;
    return { top, left, right };
  }

  // 1층 (가장 큰 큐브) — 하부, 라일락 톤
  const cube1 = isoCube(50, 56, 18, 10);
  // 2층 — 살구 톤
  const cube2 = isoCube(50, 46, 13, 8);
  // 3층 (가장 작은 큐브) — 페일핑크 톤
  const cube3 = isoCube(50, 39, 9, 6);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* 외곽 후광 — 부드러운 라일락·살구 호흡 */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(201,166,255,0.20) 0%, rgba(252,189,189,0.10) 38%, transparent 62%)',
          filter: 'blur(32px)',
          animation: 'mv-breathe 8s ease-in-out infinite',
        }}
      />

      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="relative z-10"
        style={{ overflow: 'visible' }}
      >
        {/* 별 — 매우 미세한 정적 점들 */}
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="#fef3c7"
            opacity="0.55"
            style={{ animation: `mv-star 12s ease-in-out ${s.delay}s infinite` }}
          />
        ))}

        {/* 3층 큐브 탑 — 외곽선 없는 평면 색면 (Monument Valley 톤) */}

        {/* 1층 — 라일락 톤 (가장 큰 큐브) */}
        <g>
          {/* right face — 가장 어두운 면 (그림자 쪽) */}
          <path d={cube1.right} fill="#7c5ca8" />
          {/* left face — 중간 면 */}
          <path d={cube1.left} fill="#9b7dc7" />
          {/* top face — 가장 밝은 면 (빛 받는 쪽) */}
          <path d={cube1.top} fill="#c9a6ff" />
        </g>

        {/* 2층 — 살구 톤 (중간 큐브) */}
        <g>
          <path d={cube2.right} fill="#d89472" />
          <path d={cube2.left} fill="#f0a880" />
          <path d={cube2.top} fill="#fcd5b4" />
        </g>

        {/* 3층 — 페일핑크 톤 (가장 작은 큐브) */}
        <g>
          <path d={cube3.right} fill="#d68aa3" />
          <path d={cube3.left} fill="#eaa5bc" />
          <path d={cube3.top} fill="#f8bbd0" />
        </g>

        {/* 꼭대기 작은 달 — 부드러운 부유 */}
        <g style={{ animation: 'mv-moon-float 14s ease-in-out infinite' }}>
          {/* 달 본체 — 크림 단색 (외곽선 없이) */}
          <circle cx="50" cy="26" r="4.5" fill="#fff5e1" />
          {/* 달 음영 — 우측 하단 단색면 (Monument Valley 풍) */}
          <path
            d="M 50 30.5 A 4.5 4.5 0 0 1 45.7 23.7 Q 47.5 23.5, 50 23.5 Q 52.5 23.5, 54.3 23.7 A 4.5 4.5 0 0 1 50 30.5 Z"
            fill="#e8c8a0"
            opacity="0.45"
          />
        </g>
      </svg>

      <style jsx>{`
        @keyframes mv-breathe {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
        @keyframes mv-star {
          0%, 100% { opacity: 0.22; }
          50% { opacity: 0.9; }
        }
        @keyframes mv-moon-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
}
