/**
 * 만신 카드 전람 (/tarot_card) — 60장 전체를 신령패 → 풍습패 → 엽전패 순으로 나열.
 *
 * 카드 이미지 양산 진행 관리용 내부 페이지 (noindex).
 * ★ 새 일러스트가 확정되면 아래 CARD_IMAGES 에 `카드id: '경로'` 한 줄만 추가하면 된다.
 *   이미지가 없는 카드는 카드백 + 이름 플레이스홀더로 표시된다.
 * 렌더 방식은 SummaryPatCard(ManshinOracleTest.tsx)와 동일: 일러스트 + 공용 프레임 오버레이.
 */

import {
  MANSHIN_DECK,
  MANSHIN_GROUP_COLORS,
  type ManshinCard,
} from '@/constants/test/manshinDeck.test';

const BACK_SM = "url('/manshin/back_sm.png')";
const FRAME_SRC = '/manshin/frame.png';

/** 확정 일러스트 매핑 — 카드 id → 이미지 경로. 이미지가 나올 때마다 여기에 한 줄씩 추가 */
const CARD_IMAGES: Record<string, string> = {
  // 신령패 (1/36)
  okhwang: '/manshin/test2/okhwang_final.jpg',
  // 풍습패 (1/18)
  honrye: '/manshin/customs/honrye.jpg',
  // 엽전패 (6/6 완료)
  yeopjeon1: '/manshin/coins/y1.jpg',
  yeopjeon2: '/manshin/coins/y2.jpg',
  yeopjeon3: '/manshin/coins/y3.jpg',
  yeopjeon4: '/manshin/coins/y4.jpg',
  yeopjeon5: '/manshin/coins/y5.jpg',
  yeopjeon6: '/manshin/coins/y6.jpg',
};

const DEITIES = MANSHIN_DECK.filter((c) => c.group !== '풍습' && c.group !== '엽전');
const CUSTOMS = MANSHIN_DECK.filter((c) => c.group === '풍습');
const COINS = MANSHIN_DECK.filter((c) => c.group === '엽전');

function GalleryCard({ card }: { card: ManshinCard }) {
  const color = MANSHIN_GROUP_COLORS[card.group];
  const src = CARD_IMAGES[card.id];
  return (
    <div className="w-full">
      <div
        className="relative aspect-[2/3] rounded-xl overflow-hidden"
        style={{ boxShadow: `0 6px 24px ${color}22` }}
      >
        {src ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={card.name}
              loading="lazy"
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none [-webkit-touch-callout:none]"
            />
            <div
              className="absolute inset-x-0 bottom-0 h-2/5"
              style={{ background: 'linear-gradient(180deg, transparent, rgba(10,6,20,0.9))' }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={FRAME_SRC}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute inset-0 w-full h-full z-20 pointer-events-none select-none [-webkit-touch-callout:none]"
            />
          </>
        ) : (
          <>
            <div
              className="absolute inset-0"
              style={{ backgroundImage: BACK_SM, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
            <div
              className="absolute inset-0"
              style={{ background: `radial-gradient(circle at 50% 22%, ${color}30, rgba(10,6,20,0.82))` }}
            />
            <div className="absolute top-2.5 inset-x-0 flex justify-center z-30">
              <span
                className="text-[11px] tracking-[0.14em] px-2 py-0.5 rounded-full border"
                style={{ background: 'rgba(10,6,20,0.6)', color: `${color}bb`, borderColor: `${color}44` }}
              >
                준비 중
              </span>
            </div>
          </>
        )}
        {/* 카드 번호 — 양산 진행 관리용 */}
        <div
          className="absolute top-2 left-2 z-30 text-[11px] font-semibold px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(10,6,20,0.55)', color: `${color}cc` }}
        >
          {card.no}
        </div>
        <div
          className={`absolute inset-x-0 z-30 text-center font-bold text-text-primary px-2 leading-tight text-[17px] ${
            src ? 'bottom-[11%]' : 'top-1/2 -translate-y-1/2'
          }`}
          style={{ fontFamily: 'var(--font-title)', textShadow: '0 2px 10px rgba(10,6,20,0.8)' }}
        >
          {card.name}
        </div>
      </div>
      <div className="mt-2 text-center text-text-secondary leading-snug text-[12.5px]">{card.title}</div>
      <div className="mt-0.5 text-center text-[11.5px] leading-snug" style={{ color: `${color}dd` }}>
        {card.domains}
      </div>
    </div>
  );
}

function GallerySection({ title, guide, cards }: { title: string; guide: string; cards: ManshinCard[] }) {
  const done = cards.filter((c) => CARD_IMAGES[c.id]).length;
  return (
    <section className="mt-12 first:mt-0">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h2
          className="text-[22px] font-bold text-text-primary"
          style={{ fontFamily: 'var(--font-title)' }}
        >
          {title}
        </h2>
        <span className="text-[13px] text-text-secondary shrink-0">
          일러스트 {done}/{cards.length}
        </span>
      </div>
      <p className="text-[13px] text-text-secondary mb-5">{guide}</p>
      {/* Layout 이 모바일 프레임(약 430px 고정)이라 뷰포트 브레이크포인트는 무의미 — 2열 고정 */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-8">
        {cards.map((card) => (
          <GalleryCard key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

export function ManshinCardGalleryTest() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1
        className="text-[28px] font-bold text-text-primary text-center"
        style={{ fontFamily: 'var(--font-title)' }}
      >
        만신 카드 전람
      </h1>
      <p className="text-center text-[13.5px] text-text-secondary mt-2 mb-12">
        신령 {DEITIES.length} · 풍습 {CUSTOMS.length} · 엽전 {COINS.length} — 총 {MANSHIN_DECK.length}장
      </p>
      <GallerySection title="신령패" guide="오늘 너를 봐줄 신령들이니라" cards={DEITIES} />
      <GallerySection title="풍습패" guide="네 앞에 펼쳐질 삶의 장면들이니라" cards={CUSTOMS} />
      <GallerySection title="엽전패" guide="때와 흐름을 셈하는 여섯 닢이니라" cards={COINS} />
    </div>
  );
}
