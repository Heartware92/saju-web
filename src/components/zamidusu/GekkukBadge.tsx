'use client';

/**
 * 격국(格局) 배지 카드.
 *
 * detectGekkuk()로 자동 판정된 명반의 격국을 카드 형태로 노출.
 * tier(top/high/mid/special)에 따라 색상 차등.
 */

import type { GekkukMeta } from '../../engine/zamidusu/knowledge';

const TIER_COLOR: Record<GekkukMeta['tier'], { border: string; bg: string; text: string; label: string }> = {
  top:     { border: '#fbbf24', bg: 'rgba(251,191,36,0.10)',  text: '#fbbf24', label: '최상격' },
  high:    { border: '#a78bfa', bg: 'rgba(167,139,250,0.10)', text: '#c4b5fd', label: '상격' },
  mid:     { border: '#60a5fa', bg: 'rgba(96,165,250,0.10)',  text: '#93c5fd', label: '중격' },
  special: { border: '#94a3b8', bg: 'rgba(148,163,184,0.10)', text: '#cbd5e1', label: '특수격' },
};

interface Props {
  gekkuk: GekkukMeta;
}

export function GekkukBadge({ gekkuk }: Props) {
  const tier = TIER_COLOR[gekkuk.tier];
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: tier.border, backgroundColor: tier.bg }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: tier.border, color: '#0f0a2e' }}
        >
          {tier.label}
        </span>
        <span
          className="text-base font-bold"
          style={{ color: tier.text, fontFamily: 'var(--font-serif)' }}
        >
          {gekkuk.name}
        </span>
        <span className="text-xs text-text-tertiary">{gekkuk.hanja}</span>
      </div>
      <p
        className="text-[13px] text-text-secondary leading-relaxed mb-2"
        style={{ wordBreak: 'keep-all' }}
      >
        {gekkuk.description}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
        <div className="text-[12px] text-text-secondary">
          <span className="font-semibold" style={{ color: tier.text }}>강점</span> {gekkuk.positive}
        </div>
        <div className="text-[12px] text-text-secondary">
          <span className="font-semibold text-amber-300/80">유의</span> {gekkuk.caution}
        </div>
      </div>
    </div>
  );
}

interface ListProps {
  gekkuks: GekkukMeta[];
}

export function GekkukList({ gekkuks }: ListProps) {
  if (gekkuks.length === 0) return null;
  return (
    <div className="space-y-2">
      {gekkuks.map((g) => (
        <GekkukBadge key={g.name} gekkuk={g} />
      ))}
    </div>
  );
}
