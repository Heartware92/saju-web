'use client';

/**
 * 봉신연의 캐릭터 카드 — 14주성 의인화 시각화.
 *
 * 명궁/신궁/주요 궁 주성에 매칭된 봉신연의 인물의 서사를 카드로 노출.
 * 별의 추상 성정을 친숙한 인물 일화로 전달해 사용자 몰입을 높임.
 *
 * 데이터 소스: engine/zamidusu/knowledge.ts MAJOR_STARS_META[*].fenshen
 * 카드 빌드: engine/zamidusu/reading.ts buildZamidusuReading().characterCards
 */

import type { CharacterCard as CharacterCardData } from '../../engine/zamidusu/reading';

interface Props {
  data: CharacterCardData;
}

export function CharacterCard({ data }: Props) {
  const traits = data.character.trait.split('·');

  return (
    <div className="rounded-2xl bg-space-surface border border-[var(--border-subtle)] p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-cta/15 text-cta">
          {data.palace}
        </span>
        <span className="text-[12px] text-text-tertiary">{data.starName}</span>
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <h3
          className="text-xl font-bold text-text-primary"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {data.character.name}
        </h3>
        <span className="text-sm text-text-tertiary font-normal">
          {data.character.hanja}
        </span>
      </div>
      <p className="text-[13px] text-cta mb-3">{data.character.role}</p>
      <p
        className="text-sm text-text-secondary leading-[1.65] mb-4"
        style={{ wordBreak: 'keep-all' }}
      >
        {data.character.anecdote}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {traits.map((t) => (
          <span
            key={t}
            className="text-[12px] font-medium px-2 py-1 rounded-full bg-cta/10 text-cta border border-cta/30"
          >
            #{t}
          </span>
        ))}
      </div>
    </div>
  );
}
