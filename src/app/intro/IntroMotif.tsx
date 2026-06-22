'use client';

/**
 * 오프닝 인트로 — 슬라이드별 SVG 모티프 (고급 버전)
 *
 * 단순 도형이 아니라 '빛'을 쌓아 올린다:
 *  - 볼류메트릭 글로우(블러 레이어 다중)  - 글래스 구체(림라이트+스페큘러)
 *  - 다단계 라디얼 그라데이션            - 미세 입자(궤도/부유)
 *  - prefers-reduced-motion 존중
 *
 *  0 떨어지는 별  1 빛 정령  2 열 정령(오행5×음양2)  3 잠든 정령  4 달빛 점집  5 달 조각 둘
 */

import styles from './intro.module.css';

const OHAENG = [
  'var(--wood-core)',
  'var(--fire-core)',
  'var(--earth-core)',
  'var(--metal-core)',
  'var(--water-core)',
];

const SIZE = 160;

/* 모든 모티프가 공유하는 필터/그라데이션 — 한 번에 하나만 렌더되므로 id 충돌 없음 */
function Defs() {
  return (
    <defs>
      <filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
      <filter id="bloom" x="-120%" y="-120%" width="340%" height="340%">
        <feGaussianBlur stdDeviation="7" />
      </filter>
      <filter id="haze" x="-120%" y="-120%" width="340%" height="340%">
        <feGaussianBlur stdDeviation="14" />
      </filter>

      {/* 구체 외곽 볼류메트릭 글로우 */}
      <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="var(--cta-secondary)" stopOpacity="0.55" />
        <stop offset="45%" stopColor="var(--moon-halo)" stopOpacity="0.28" />
        <stop offset="100%" stopColor="var(--moon-halo)" stopOpacity="0" />
      </radialGradient>

      {/* 글래스 본체 — 위는 밝고 아래로 그늘 */}
      <radialGradient id="glass" cx="0.38" cy="0.32" r="0.85">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="22%" stopColor="#f1ebff" />
        <stop offset="62%" stopColor="var(--moon-halo)" />
        <stop offset="100%" stopColor="var(--moon-shadow)" />
      </radialGradient>

      {/* 내부에 도는 색 기운(성운) */}
      <radialGradient id="core" cx="0.5" cy="0.62" r="0.55">
        <stop offset="0%" stopColor="var(--cta-secondary)" stopOpacity="0.85" />
        <stop offset="100%" stopColor="var(--cta-secondary)" stopOpacity="0" />
      </radialGradient>

      {/* 달 표면 */}
      <radialGradient id="moon" cx="0.38" cy="0.32" r="0.9">
        <stop offset="0%" stopColor="#fffaf0" />
        <stop offset="55%" stopColor="var(--moon-core)" />
        <stop offset="100%" stopColor="var(--moon-shadow)" />
      </radialGradient>

      <linearGradient id="trail" x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#fff5dc" stopOpacity="0" />
        <stop offset="1" stopColor="#fff" stopOpacity="0.95" />
      </linearGradient>
    </defs>
  );
}

/* 고급 빛 구체 — 슬라이드 1·3·(작게)2 에서 재사용 */
function Orb({ cx, cy, r, sleeping = false, dim = false }: { cx: number; cy: number; r: number; sleeping?: boolean; dim?: boolean }) {
  return (
    <g opacity={dim ? 0.78 : 1}>
      {/* 외곽 글로우 (블러 2겹) */}
      <circle cx={cx} cy={cy} r={r * 2.4} fill="url(#glow)" filter="url(#haze)" />
      <circle cx={cx} cy={cy} r={r * 1.5} fill="url(#glow)" filter="url(#bloom)" />
      {/* 본체 */}
      <circle cx={cx} cy={cy} r={r} fill="url(#glass)" />
      {/* 내부 색 기운 */}
      <circle cx={cx} cy={cy} r={r * 0.92} fill="url(#core)" filter="url(#soft)" />
      {/* 하단 림라이트 */}
      <path
        d={`M ${cx - r * 0.7} ${cy + r * 0.6} A ${r} ${r} 0 0 0 ${cx + r * 0.7} ${cy + r * 0.6}`}
        fill="none"
        stroke="var(--cta-secondary)"
        strokeWidth={r * 0.09}
        strokeLinecap="round"
        opacity="0.5"
        filter="url(#soft)"
      />
      {/* 스페큘러 하이라이트 */}
      <ellipse cx={cx - r * 0.32} cy={cy - r * 0.38} rx={r * 0.28} ry={r * 0.2} fill="#ffffff" opacity="0.85" filter="url(#soft)" />
      <circle cx={cx - r * 0.12} cy={cy - r * 0.55} r={r * 0.06} fill="#fff" opacity="0.9" />
      {/* 표정 */}
      {sleeping ? (
        <>
          <path d={`M ${cx - r * 0.42} ${cy + r * 0.08} q ${r * 0.18} ${r * 0.2} ${r * 0.36} 0`} stroke="#3a2d52" strokeWidth={r * 0.07} strokeLinecap="round" fill="none" />
          <path d={`M ${cx + r * 0.06} ${cy + r * 0.08} q ${r * 0.18} ${r * 0.2} ${r * 0.36} 0`} stroke="#3a2d52" strokeWidth={r * 0.07} strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx={cx - r * 0.24} cy={cy + r * 0.14} r={r * 0.08} fill="#3a2d52" />
          <circle cx={cx + r * 0.24} cy={cy + r * 0.14} r={r * 0.08} fill="#3a2d52" />
        </>
      )}
    </g>
  );
}

/* 부유 입자 */
function Dust({ pts }: { pts: [number, number, number, number][] }) {
  return (
    <>
      {pts.map(([x, y, r, d], i) => (
        <circle key={i} className={styles.twinkle} cx={x} cy={y} r={r} fill="#fff5dc" style={{ animationDelay: `${d}s` }} />
      ))}
    </>
  );
}

/* 0 — 떨어지는 별 */
function FallingStar() {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <Defs />
      <Dust pts={[[20, 28, 1.3, 0.2], [96, 24, 1, 1.1], [90, 96, 1.2, 0.6], [30, 92, 0.9, 1.4]]} />
      {/* 글로우 후광 */}
      <circle cx="64" cy="64" r="30" fill="url(#glow)" filter="url(#bloom)" />
      <g className={styles.fall}>
        {/* 모션 트레일 (블러) */}
        <path d="M30 30 L60 60" stroke="url(#trail)" strokeWidth="6" strokeLinecap="round" filter="url(#soft)" opacity="0.7" />
        <path d="M34 34 L60 60" stroke="url(#trail)" strokeWidth="2.4" strokeLinecap="round" />
        {/* 4각 별 */}
        <path
          d="M64 42 C 66.5 58, 72 63.5, 88 66 C 72 68.5, 66.5 74, 64 90 C 61.5 74, 56 68.5, 40 66 C 56 63.5, 61.5 58, 64 42 Z"
          fill="#fffdf5"
          filter="url(#soft)"
        />
        <path
          d="M64 50 C 65.6 60, 69 63.4, 79 65 C 69 66.6, 65.6 70, 64 80 C 62.4 70, 59 66.6, 49 65 C 59 63.4, 62.4 60, 64 50 Z"
          fill="#fff"
        />
      </g>
    </svg>
  );
}

/* 1 — 빛 정령 (실제 일러스트, 가장자리 페더 마스크로 우주에 녹임) */
function SpiritImage() {
  const mask = 'radial-gradient(ellipse 72% 72% at 50% 47%, #000 48%, transparent 100%)';
  return (
    <div className={styles.float} style={{ width: 'min(82vw, 330px)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/intro/spirit.webp"
        alt=""
        aria-hidden="true"
        className="h-auto w-full"
        style={{
          WebkitMaskImage: mask,
          maskImage: mask,
          filter: 'drop-shadow(0 0 22px rgba(201, 166, 255, 0.35))',
        }}
      />
    </div>
  );
}

/* 2 — 열 종류의 정령 (오행 5색 × 음양 2) — 작은 글래스 구슬 10개 */
function TenSpirits() {
  const cols = [18, 39, 60, 81, 102];
  return (
    <svg width={SIZE + 32} height={SIZE} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <defs>
        <filter id="b2" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="4" /></filter>
        <radialGradient id="bead" cx="0.36" cy="0.3" r="0.85">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {cols.map((cx, i) => {
        const color = OHAENG[i];
        return (
          <g key={i}>
            {/* 양 */}
            <g className={styles.twinkle} style={{ animationDelay: `${i * 0.22}s` }}>
              <circle cx={cx} cy="44" r="14" fill={color} opacity="0.32" filter="url(#b2)" />
              <circle cx={cx} cy="44" r="8.5" fill={color} />
              <circle cx={cx} cy="44" r="8.5" fill="url(#bead)" />
            </g>
            {/* 음 */}
            <g className={styles.twinkle} style={{ animationDelay: `${i * 0.22 + 0.7}s` }}>
              <circle cx={cx} cy="80" r="6" fill={color} opacity="0.5" />
              <circle cx={cx} cy="80" r="6" fill="none" stroke={color} strokeWidth="1.1" />
              <circle cx={cx} cy="80" r="6" fill="url(#bead)" opacity="0.6" />
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/* 3 — 잠든 정령 */
function SleepingSpirit() {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <Defs />
      <text className={styles.float} x="86" y="40" fontSize="12" fontStyle="italic" fill="var(--moon-halo)" opacity="0.7" style={{ animationDelay: '0.3s' }}>z</text>
      <text className={styles.float} x="95" y="28" fontSize="8.5" fontStyle="italic" fill="var(--moon-halo)" opacity="0.5" style={{ animationDelay: '0.95s' }}>z</text>
      <g className={styles.breathe}>
        <Orb cx={58} cy={64} r={24} sleeping dim />
      </g>
    </svg>
  );
}

/* 4 — 달빛 아래 작은 점집 */
function MoonHouse() {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <Defs />
      <Dust pts={[[20, 24, 1.1, 0.4], [102, 60, 1, 1.2], [34, 96, 0.9, 0.7]]} />
      {/* 달 + 후광 */}
      <circle cx="80" cy="34" r="34" fill="url(#glow)" filter="url(#haze)" />
      <g className={styles.breathe}>
        <circle cx="80" cy="34" r="15" fill="url(#moon)" />
        {/* 분화구 살짝 */}
        <circle cx="84" cy="30" r="2.4" fill="var(--moon-shadow)" opacity="0.3" />
        <circle cx="76" cy="38" r="1.6" fill="var(--moon-shadow)" opacity="0.25" />
      </g>
      {/* 점집 실루엣 + 바닥 빛 반사 */}
      <ellipse cx="58" cy="99" rx="30" ry="4" fill="var(--moon-halo)" opacity="0.18" filter="url(#soft)" />
      <g fill="#16102b" stroke="#3a2d52" strokeWidth="0.7">
        {/* 곡선 기와지붕 */}
        <path d="M26 72 Q34 60 58 58 Q82 60 90 72 Q86 66 58 64 Q30 66 26 72 Z" />
        <rect x="40" y="70" width="36" height="30" rx="2.5" />
        <rect x="53" y="82" width="10" height="18" rx="1.5" fill="#0c0719" />
      </g>
      {/* 처마 등불 */}
      <circle cx="58" cy="76" r="6" fill="var(--sun-corona)" opacity="0.45" filter="url(#bloom)" />
      <circle className={styles.twinkle} cx="58" cy="76" r="2.4" fill="var(--sun-core)" />
    </svg>
  );
}

/* 4각 별 한 개 (재사용) */
function Star({ cx, cy, s }: { cx: number; cy: number; s: number }) {
  const d =
    `M${cx} ${cy - s} ` +
    `C ${cx + s * 0.14} ${cy - s * 0.34}, ${cx + s * 0.5} ${cy - s * 0.12}, ${cx + s} ${cy} ` +
    `C ${cx + s * 0.5} ${cy + s * 0.12}, ${cx + s * 0.14} ${cy + s * 0.34}, ${cx} ${cy + s} ` +
    `C ${cx - s * 0.14} ${cy + s * 0.34}, ${cx - s * 0.5} ${cy + s * 0.12}, ${cx - s} ${cy} ` +
    `C ${cx - s * 0.5} ${cy - s * 0.12}, ${cx - s * 0.14} ${cy - s * 0.34}, ${cx} ${cy - s} Z`;
  return (
    <>
      <circle cx={cx} cy={cy} r={s * 1.4} fill="url(#glow)" filter="url(#haze)" />
      <path d={d} fill="#fffdf5" filter="url(#soft)" />
      <path
        d={`M${cx} ${cy - s * 0.62} C ${cx + s * 0.09} ${cy - s * 0.2}, ${cx + s * 0.32} ${cy - s * 0.07}, ${cx + s * 0.62} ${cy} C ${cx + s * 0.32} ${cy + s * 0.07}, ${cx + s * 0.09} ${cy + s * 0.2}, ${cx} ${cy + s * 0.62} C ${cx - s * 0.09} ${cy + s * 0.2}, ${cx - s * 0.32} ${cy + s * 0.07}, ${cx - s * 0.62} ${cy} C ${cx - s * 0.32} ${cy - s * 0.07}, ${cx - s * 0.09} ${cy - s * 0.2}, ${cx} ${cy - s * 0.62} Z`}
        fill="#ffffff"
      />
    </>
  );
}

/* 5 — 별 두 개 (별 하나에 천 원, 별 두 개에 이천 원) */
function TwoStars() {
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <Defs />
      <Dust pts={[[26, 30, 1.1, 0.5], [98, 36, 1, 1.3], [70, 96, 0.9, 0.8]]} />
      <g className={styles.float}>
        <Star cx={44} cy={54} s={22} />
      </g>
      <g className={styles.float} style={{ animationDelay: '0.7s' }}>
        <Star cx={84} cy={66} s={16} />
      </g>
    </svg>
  );
}

const MOTIFS = [FallingStar, SpiritImage, TenSpirits, SleepingSpirit, MoonHouse, TwoStars];

export default function IntroMotif({ index }: { index: number }) {
  const Motif = MOTIFS[index] ?? FallingStar;
  return (
    <div className={`flex items-center justify-center ${styles.motif}`}>
      <Motif />
    </div>
  );
}
