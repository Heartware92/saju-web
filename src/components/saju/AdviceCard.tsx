'use client';

import { motion } from 'framer-motion';
import type { AdviceMeta } from '../../services/fortuneService';

// 용신 오행 → 색상·방향·행운 숫자 결정론적 매핑
const YONGSIN_MAP: Record<string, {
  colors: { name: string; css: string }[];
  direction: string;
  directionDeg: number; // 나침반: 북=0, 동=90, 남=180, 서=270, 중앙=-1
  numbers: [number, number]; // 행운 숫자 2개 (표준 명리 매핑)
}> = {
  목: {
    colors: [{ name: '초록', css: '#22c55e' }, { name: '연두', css: '#84cc16' }],
    direction: '동', directionDeg: 90,
    numbers: [3, 8],
  },
  화: {
    colors: [{ name: '빨강', css: '#ef4444' }, { name: '주황', css: '#f97316' }],
    direction: '남', directionDeg: 180,
    numbers: [2, 7],
  },
  토: {
    colors: [{ name: '노랑', css: '#eab308' }, { name: '황토', css: '#b45309' }],
    direction: '중앙', directionDeg: -1,
    numbers: [5, 10],
  },
  금: {
    colors: [{ name: '흰색', css: '#e2e8f0' }, { name: '은색', css: '#94a3b8' }],
    direction: '서', directionDeg: 270,
    numbers: [4, 9],
  },
  수: {
    colors: [{ name: '검정', css: '#1e293b' }, { name: '남색', css: '#1e3a8a' }],
    direction: '북', directionDeg: 0,
    numbers: [1, 6],
  },
};

// 나침반 SVG
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

  // 방위 라벨 위치
  const labels = [
    { text: '북', x: 36, y: 11 },
    { text: '동', x: 64, y: 39 },
    { text: '남', x: 36, y: 67 },
    { text: '서', x: 8,  y: 39 },
  ];

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        {/* 외부 링 */}
        <circle cx="36" cy="36" r="34" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        {/* 십자선 */}
        <line x1="36" y1="4" x2="36" y2="68" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1="4" y1="36" x2="68" y2="36" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {/* 방위 텍스트 */}
        {labels.map(l => (
          <text key={l.text} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fill="rgba(255,255,255,0.35)" fontFamily="var(--font-sans)">
            {l.text}
          </text>
        ))}
        {/* 바늘 (deg 방향으로 회전) */}
        <g transform={`rotate(${deg}, 36, 36)`}>
          {/* 빨간 팁 (가리키는 방향) */}
          <polygon points="36,6 32.5,36 39.5,36" fill="var(--color-cta, #8B6914)" opacity="0.9" />
          {/* 흰색 꼬리 */}
          <polygon points="36,66 32.5,36 39.5,36" fill="rgba(255,255,255,0.18)" />
        </g>
        {/* 중심 원 */}
        <circle cx="36" cy="36" r="3.5" fill="white" opacity="0.7" />
      </svg>
      <span className="text-[13px] text-text-tertiary">{direction}쪽이 길합니다</span>
    </div>
  );
}

// 색상 스와치
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

interface AdviceCardProps {
  yongSinElement: string; // '목' | '화' | '토' | '금' | '수'
  meta: AdviceMeta;
}

// 12지지 → 실제 시간 매핑 (사용자가 한자만 보고 시간 모르는 케이스 해결)
const ZHI_HOUR: Record<string, string> = {
  '자': '23-01시', '축': '01-03시', '인': '03-05시', '묘': '05-07시',
  '진': '07-09시', '사': '09-11시', '오': '11-13시', '미': '13-15시',
  '신': '15-17시', '유': '17-19시', '술': '19-21시', '해': '21-23시',
};
// timeSlot 안의 "X시" 또는 "X·Y시" 패턴에 시간 병기 — 이미 "(...시)" 가 있으면 그대로 둠
function annotateTimeSlot(s: string): string {
  if (!s) return '—';
  if (/\d{1,2}/.test(s)) return s; // 이미 숫자 시간 포함
  return s.replace(/([자축인묘진사오미신유술해])(·([자축인묘진사오미신유술해]))?시/g, (_m, a, _b, c) => {
    const aHour = ZHI_HOUR[a];
    if (c) {
      const cHour = ZHI_HOUR[c];
      return `${a}시 (${aHour}) · ${c}시 (${cHour})`;
    }
    return `${a}시 (${aHour})`;
  });
}

export function AdviceCard({ yongSinElement, meta }: AdviceCardProps) {
  // 한자 포함된 경우 매핑
  const elementKey = Object.keys(YONGSIN_MAP).find(k =>
    yongSinElement === k || yongSinElement.startsWith(k)
  ) ?? '목';
  const mapData = YONGSIN_MAP[elementKey];

  return (
    <div className="flex flex-col gap-4">
      {/* 시각 정보 그리드: 나침반 + 색상 */}
      <div className="flex items-center justify-around py-3 px-2 rounded-2xl bg-white/5 border border-white/10">
        {/* 나침반 */}
        <CompassSVG deg={mapData.directionDeg} direction={mapData.direction} />

        {/* 구분선 */}
        <div className="w-px h-16 bg-white/10" />

        {/* 색상 스와치 */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-[12px] text-text-tertiary mb-0.5">용신 색상</span>
          <div className="flex gap-3">
            {mapData.colors.map(c => (
              <ColorSwatch key={c.name} name={c.name} css={c.css} />
            ))}
          </div>
        </div>
      </div>

      {/* 시간대 + 음식 + 행운 숫자 — 좌측 정렬·폰트 통일 (LuckyVisualCard 와 동일 스펙) */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl px-3 py-3 bg-white/5 border border-white/10 min-h-[78px]">
          <div className="text-[13px] text-text-tertiary mb-1.5">유리한 시간대</div>
          <div className="text-[16px] text-text-primary font-semibold leading-snug">
            {annotateTimeSlot(meta.timeSlot)}
          </div>
        </div>
        <div className="rounded-xl px-3 py-3 bg-white/5 border border-white/10 min-h-[78px]">
          <div className="text-[13px] text-text-tertiary mb-1.5">보강 음식</div>
          <div className="text-[16px] text-text-primary font-semibold leading-snug">
            {meta.foods.length > 0 ? meta.foods.join(', ') : '—'}
          </div>
        </div>
        <div className="rounded-xl px-3 py-3 bg-white/5 border border-white/10 min-h-[78px]">
          <div className="text-[13px] text-text-tertiary mb-1.5">행운 숫자</div>
          <div className="text-[20px] text-text-primary font-bold leading-snug tracking-wider">
            {mapData.numbers[0]} · {mapData.numbers[1]}
          </div>
        </div>
      </div>

      {/* 본문 — 정통사주 다른 섹션 본문과 동일 스펙(17px / 1.85 / -0.005em) */}
      {meta.body && (
        <p className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] whitespace-pre-line">
          {meta.body}
        </p>
      )}

      {/* 평생 실천 */}
      {meta.actions.length > 0 && (
        <div className="rounded-xl p-3 bg-white/5 border border-white/10">
          <div className="text-[13px] text-text-tertiary mb-2">평생 실천</div>
          <ul className="flex flex-col gap-2">
            {meta.actions.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em]">
                <span className="text-text-tertiary shrink-0">·</span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
