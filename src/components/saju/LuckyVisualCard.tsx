'use client';

// 행운 시각 카드 — 오늘의 운세 / 신년운세 / 정통사주 공통 사용
// 나침반(compass) + 색상 스와치 + 숫자 + 시간대 + 보조 텍스트

const COLOR_CSS: Record<string, string> = {
  '초록': '#22c55e', '연두': '#84cc16', '민트': '#10b981',
  '빨강': '#ef4444', '주황': '#f97316', '핑크': '#ec4899',
  '노랑': '#eab308', '황토': '#b45309', '베이지': '#d4a574',
  '화이트': '#f1f5f9', '실버': '#94a3b8', '그레이': '#64748b',
  '파랑': '#3b82f6', '네이비': '#1e3a8a', '블랙': '#1e293b',
};

const DIRECTION_DEG: Record<string, number> = {
  '동쪽': 90, '남쪽': 180, '서쪽': 270, '북쪽': 0, '중앙': -1,
  '동': 90, '남': 180, '서': 270, '북': 0,
};

// 오행별 행운 데이터 (결정론적)
export const ELEMENT_LUCKY: Record<string, {
  colors: string[];
  colorCss: string[];
  numbers: number[];
  direction: string;
  directionDeg: number;
  timeSlot: string;
  gem: string;
  activity: string;
}> = {
  '목': {
    colors: ['초록', '연두'],
    colorCss: ['#22c55e', '#84cc16'],
    numbers: [3, 8],
    direction: '동쪽',
    directionDeg: 90,
    timeSlot: '오전 5~7시 (인·묘시)',
    gem: '에메랄드·옥',
    activity: '숲 산책·독서·글쓰기',
  },
  '화': {
    colors: ['빨강', '주황'],
    colorCss: ['#ef4444', '#f97316'],
    numbers: [2, 7],
    direction: '남쪽',
    directionDeg: 180,
    timeSlot: '오전 11시~오후 1시 (사·오시)',
    gem: '루비·석류석',
    activity: '사교 모임·발표·운동',
  },
  '토': {
    colors: ['노랑', '황토'],
    colorCss: ['#eab308', '#b45309'],
    numbers: [5, 10],
    direction: '중앙',
    directionDeg: -1,
    timeSlot: '오전 9~11시 (진·미시)',
    gem: '황수정·호박',
    activity: '정원 가꾸기·요리·명상',
  },
  '금': {
    colors: ['화이트', '실버'],
    colorCss: ['#f1f5f9', '#94a3b8'],
    numbers: [4, 9],
    direction: '서쪽',
    directionDeg: 270,
    timeSlot: '오후 3~7시 (신·유시)',
    gem: '다이아몬드·백수정',
    activity: '악기 연주·정리정돈·금속 소품',
  },
  '수': {
    colors: ['파랑', '네이비'],
    colorCss: ['#3b82f6', '#1e3a8a'],
    numbers: [1, 6],
    direction: '북쪽',
    directionDeg: 0,
    timeSlot: '밤 11시~새벽 3시 (자·축시)',
    gem: '사파이어·청금석',
    activity: '수영·독서·명상·물 가까운 환경',
  },
};

function CompassSVG({ deg, direction }: { deg: number; direction: string }) {
  if (deg === -1) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="w-[72px] h-[72px] rounded-full border border-white/20 flex items-center justify-center bg-white/5">
          <span className="text-[22px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>中</span>
        </div>
        <span className="text-[13px] text-text-tertiary">중앙이 길합니다</span>
      </div>
    );
  }

  const labels = [
    { text: '북', x: 36, y: 11 },
    { text: '동', x: 64, y: 39 },
    { text: '남', x: 36, y: 67 },
    { text: '서', x: 8,  y: 39 },
  ];

  const dirShort = direction.replace('쪽', '');

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r="34" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        <line x1="36" y1="4" x2="36" y2="68" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1="4" y1="36" x2="68" y2="36" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {labels.map(l => (
          <text key={l.text} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fill="rgba(255,255,255,0.35)" fontFamily="var(--font-sans)">
            {l.text}
          </text>
        ))}
        <g transform={`rotate(${deg}, 36, 36)`}>
          <polygon points="36,6 32.5,36 39.5,36" fill="var(--color-cta, #8B6914)" opacity="0.9" />
          <polygon points="36,66 32.5,36 39.5,36" fill="rgba(255,255,255,0.18)" />
        </g>
        <circle cx="36" cy="36" r="3.5" fill="white" opacity="0.7" />
      </svg>
      <span className="text-[13px] text-text-tertiary">{dirShort}쪽이 길합니다</span>
    </div>
  );
}

function ColorSwatch({ name, css }: { name: string; css: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="w-10 h-10 rounded-xl border border-white/15 shadow-inner"
        style={{ background: css }}
      />
      <span className="text-[13px] text-text-tertiary">{name}</span>
    </div>
  );
}

export interface LuckyVisualCardProps {
  // 결정론적 데이터
  colors: string[];        // 색상 이름 e.g. ['초록', '연두']
  colorCss?: string[];     // CSS hex (없으면 COLOR_CSS로 자동 매핑)
  numbers: number[];
  direction: string;       // e.g. '동쪽'
  timeSlot: string;
  gem?: string;            // 보석/소품
  activity?: string;       // 추천 활동
  // AI 생성 추가 텍스트 (선택)
  extraText?: string;
}

export function LuckyVisualCard({
  colors,
  colorCss,
  numbers,
  direction,
  timeSlot,
  gem,
  activity,
  extraText,
}: LuckyVisualCardProps) {
  const deg = DIRECTION_DEG[direction] ?? 0;
  const swatches = colors.slice(0, 2).map((name, i) => ({
    name,
    css: colorCss?.[i] ?? COLOR_CSS[name] ?? '#888',
  }));

  return (
    <div className="flex flex-col gap-3">
      {/* 나침반 + 색상 스와치 */}
      <div className="flex items-center justify-around py-3 px-2 rounded-2xl bg-white/5 border border-white/10">
        <CompassSVG deg={deg} direction={direction} />
        <div className="w-px h-16 bg-white/10" />
        <div className="flex flex-col items-center gap-2">
          <span className="text-[12px] text-text-tertiary mb-0.5">행운 색상</span>
          <div className="flex gap-3">
            {swatches.map(c => (
              <ColorSwatch key={c.name} name={c.name} css={c.css} />
            ))}
          </div>
        </div>
      </div>

      {/* 숫자 + 시간대 — 좌측 정렬·폰트 통일 (AdviceCard 와 동일 스펙) */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl p-3 bg-white/5 border border-white/10">
          <div className="text-[13px] text-text-tertiary mb-1.5">행운 숫자</div>
          <div
            className="text-[22px] font-bold text-text-primary tracking-widest leading-none"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {numbers.join(' · ')}
          </div>
        </div>
        <div className="rounded-xl p-3 bg-white/5 border border-white/10">
          <div className="text-[13px] text-text-tertiary mb-1.5">유리한 시간대</div>
          <div className="text-[16px] text-text-primary font-semibold leading-snug">{timeSlot || '—'}</div>
        </div>
      </div>

      {/* 보석 + 활동 (있을 때만) */}
      {(gem || activity) && (
        <div className="grid grid-cols-2 gap-2">
          {gem && (
            <div className="rounded-xl p-3 bg-white/5 border border-white/10">
              <div className="text-[13px] text-text-tertiary mb-1.5">행운 보석·소품</div>
              <div className="text-[16px] text-text-primary font-semibold leading-snug">{gem}</div>
            </div>
          )}
          {activity && (
            <div className="rounded-xl p-3 bg-white/5 border border-white/10">
              <div className="text-[13px] text-text-tertiary mb-1.5">추천 활동</div>
              <div className="text-[16px] text-text-primary font-semibold leading-snug">{activity}</div>
            </div>
          )}
        </div>
      )}

      {/* AI 보조 텍스트 */}
      {extraText && (
        <p className="text-[15px] text-text-secondary leading-relaxed whitespace-pre-line">
          {extraText}
        </p>
      )}
    </div>
  );
}
