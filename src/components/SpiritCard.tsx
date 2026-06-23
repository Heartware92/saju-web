'use client';

/**
 * 물상 정령 카드 — 세로형(포켓몬 카드 스타일)
 * 오행 색을 테마로, 일러스트 + 이름 + 일간/물상 + 별 종류 + 핵심 성향 + 한마디.
 */

import type { Spirit } from '@/data/spirits';
import { OHAENG_COLOR } from '@/data/spirits';

export default function SpiritCard({ spirit }: { spirit: Spirit }) {
  const color = OHAENG_COLOR[spirit.ohaeng];

  return (
    <div
      className="relative w-full max-w-[330px] overflow-hidden rounded-[28px] border p-5 backdrop-blur-md"
      style={{
        borderColor: color,
        background:
          'linear-gradient(180deg, rgba(28,18,52,0.78) 0%, rgba(16,10,34,0.86) 100%)',
        boxShadow: `0 14px 50px rgba(0,0,0,0.45), 0 0 22px -6px ${color}`,
      }}
    >
      {/* 상단: 일간 라벨 + 별 종류 */}
      <div className="mb-3 flex items-center justify-between">
        <span
          className="rounded-full px-3 py-1 text-[12px] font-semibold"
          style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}
        >
          {spirit.ilganLabel}
        </span>
        <span className="text-[12px] text-text-secondary">
          {spirit.ilganHanja} · {spirit.starType}
        </span>
      </div>

      {/* 일러스트 — squircle(모서리 라운드 ~40%)로 우측 하단 워터마크만 잘림, 캐릭터는 보존 */}
      <div
        className="relative mx-auto mb-4 aspect-square w-full max-w-[270px] overflow-hidden"
        style={{ borderRadius: '40%', border: `2px solid ${color}`, boxShadow: `0 0 26px -6px ${color}` }}
      >
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(circle at 50% 45%, color-mix(in srgb, ${color} 38%, transparent) 0%, transparent 68%)` }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={spirit.image} alt={spirit.name} className="relative h-full w-full object-cover" />
      </div>

      {/* 이름 */}
      <div className="mb-3 text-center">
        <h2 className="text-[26px] font-bold leading-tight" style={{ color, fontFamily: 'var(--font-title)' }}>
          {spirit.name}
        </h2>
        <p className="text-[12px] tracking-[0.18em] text-text-tertiary">{spirit.nameEn.toUpperCase()}</p>
      </div>

      {/* 핵심 성향 칩 — 5개는 3+2 균형 2줄, 칩은 한 줄 유지 */}
      <div className="mb-4 flex flex-col items-center gap-1.5">
        {(spirit.traits.length > 4
          ? [spirit.traits.slice(0, Math.ceil(spirit.traits.length / 2)), spirit.traits.slice(Math.ceil(spirit.traits.length / 2))]
          : [spirit.traits]
        ).map((row, ri) => (
          <div key={ri} className="flex flex-wrap justify-center gap-1.5">
            {row.map((t) => (
              <span
                key={t}
                className="whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] text-text-secondary"
                style={{ borderColor: `color-mix(in srgb, ${color} 40%, transparent)` }}
              >
                {t}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* 세계관 한 줄 */}
      <p className="mb-3 break-keep text-center text-[12px] leading-relaxed text-text-tertiary">{spirit.worldview}</p>

      {/* 한마디 */}
      <div
        className="break-keep rounded-2xl px-4 py-3 text-center text-[13px] leading-relaxed text-text-primary"
        style={{ background: `color-mix(in srgb, ${color} 12%, rgba(0,0,0,0.25))` }}
      >
        “{spirit.quote}”
      </div>
    </div>
  );
}
