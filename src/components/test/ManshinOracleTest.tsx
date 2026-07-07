'use client';

/**
 * 만신 오라클 테스트 페이지 (/tarot_test 전용)
 *
 * 흐름: 인트로(장수 선택) → 셔플 연출 → 질문 떠올리기 + 리본 스프레드에서 뽑기 → 플립 공개
 * - 공수(총운)는 문장 단위로 한 줄씩 천천히 내려오며 등장
 * - 연애/재물/일·사업/건강은 탭하면 열리는 아코디언 (한 번에 벽글 노출 방지)
 * - 크레딧·DB·AI 호출 없음. 라이브 타로와 완전 격리.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MANSHIN_DECK,
  MANSHIN_GROUP_COLORS,
  FORTUNE_SECTIONS,
  type ManshinCard,
  type ManshinFortunes,
} from '@/constants/test/manshinDeck.test';

type Phase = 'intro' | 'shuffle' | 'pick' | 'reveal';

const BACK_IMG = "url('/manshin/back.png')";

function shuffleDeck(cards: ManshinCard[]): ManshinCard[] {
  const a = [...cards];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 공수를 문장 단위로 분리 — 한 줄 풀이 + 줄바꿈 가독성 (구형 사파리 호환 위해 lookbehind 미사용) */
function speechLines(speech: string): string[] {
  const parts = speech.split('. ');
  return parts
    .map((p, i) => (i < parts.length - 1 ? `${p.trim()}.` : p.trim()))
    .filter(Boolean);
}

/** 카드 아트 영역에 떠다니는 별가루 */
function Sparkles({ color }: { color: string }) {
  const dots = [
    { left: '14%', top: '22%', size: 3, delay: 0 },
    { left: '82%', top: '18%', size: 2, delay: 0.8 },
    { left: '70%', top: '68%', size: 3, delay: 1.4 },
    { left: '24%', top: '74%', size: 2, delay: 2.0 },
    { left: '50%', top: '12%', size: 2, delay: 2.6 },
    { left: '90%', top: '46%', size: 2, delay: 3.1 },
  ];
  return (
    <>
      {dots.map((d, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{ left: d.left, top: d.top, width: d.size, height: d.size, background: color }}
          animate={{ opacity: [0, 1, 0], y: [0, -10, -20], scale: [0.6, 1.2, 0.5] }}
          transition={{ duration: 3.2, delay: d.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </>
  );
}

export function ManshinOracleTest() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [drawCount, setDrawCount] = useState<1 | 3>(1);
  const [deck, setDeck] = useState<ManshinCard[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  /** reveal 아코디언: `${cardIdx}-${sectionKey}` → open */
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const shuffleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (shuffleTimer.current) clearTimeout(shuffleTimer.current); }, []);

  const startShuffle = () => {
    setDeck(shuffleDeck(MANSHIN_DECK));
    setPicked([]);
    setOpenSections({});
    setPhase('shuffle');
    shuffleTimer.current = setTimeout(() => setPhase('pick'), 2100);
  };

  const togglePick = (idx: number) => {
    if (picked.includes(idx)) {
      setPicked(picked.filter((v) => v !== idx));
      return;
    }
    if (picked.length >= drawCount) return;
    const next = [...picked, idx];
    setPicked(next);
    if (next.length === drawCount) {
      setTimeout(() => setPhase('reveal'), 650);
    }
  };

  const reset = () => {
    setPicked([]);
    setDeck([]);
    setOpenSections({});
    setPhase('intro');
  };

  return (
    <div className="min-h-screen px-5 pt-8 pb-24 max-w-[520px] mx-auto overflow-hidden">
      {/* 헤더 */}
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
      >
        <div className="text-[12px] tracking-[0.3em] text-text-tertiary mb-2">TEST · 만신 오라클</div>
        <h1 className="text-[26px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-title)' }}>
          만신 오라클
        </h1>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* ── 인트로: 장수 선택 + 섞기 ── */}
        {phase === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-6"
          >
            {/* 떠 있는 카드 덱 */}
            <div className="flex justify-center py-4">
              <motion.div
                className="relative w-[120px] aspect-[2/3]"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                {[2, 1, 0].map((layer) => (
                  <div
                    key={layer}
                    className="absolute inset-0 rounded-lg border border-[rgba(201,166,255,0.3)]"
                    style={{
                      backgroundImage: BACK_IMG,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      transform: `translate(${layer * 3}px, ${layer * -3}px) rotate(${layer * 2 - 2}deg)`,
                      boxShadow: layer === 0 ? '0 8px 32px rgba(201,166,255,0.25)' : undefined,
                    }}
                  />
                ))}
              </motion.div>
            </div>

            <div className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
              <div className="text-[14px] font-semibold text-text-primary mb-3">몇 장을 뽑을까요?</div>
              <div className="flex gap-2">
                {([1, 3] as const).map((n) => (
                  <motion.button
                    key={n}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setDrawCount(n)}
                    className={`flex-1 py-3 rounded-xl text-[15px] font-bold transition-all border ${
                      drawCount === n
                        ? 'bg-cta/20 border-cta/50 text-cta'
                        : 'bg-white/5 border-[var(--border-subtle)] text-text-tertiary'
                    }`}
                  >
                    {n === 1 ? '한 장 — 오늘의 공수' : '세 장 — 흐름 보기'}
                  </motion.button>
                ))}
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={startShuffle}
              className="w-full py-4 rounded-2xl bg-cta/20 border border-cta/50 text-cta font-bold text-[16px] shadow-[0_0_24px_rgba(232,164,144,0.15)]"
            >
              카드 섞기
            </motion.button>
          </motion.div>
        )}

        {/* ── 셔플 연출 ── */}
        {phase === 'shuffle' && (
          <motion.div
            key="shuffle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="relative h-[340px] flex items-center justify-center"
          >
            {Array.from({ length: 10 }).map((_, i) => {
              const dir = i % 2 === 0 ? 1 : -1;
              const spread = 46 + (i % 5) * 16;
              return (
                <motion.div
                  key={i}
                  className="absolute w-[92px] aspect-[2/3] rounded-lg border border-[rgba(201,166,255,0.35)]"
                  style={{
                    backgroundImage: BACK_IMG,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    zIndex: i,
                  }}
                  animate={{
                    x: [0, dir * spread, 0, -dir * (spread * 0.7), 0],
                    y: [0, -(10 + (i % 3) * 8), 4, -(6 + (i % 4) * 6), 0],
                    rotate: [0, dir * (8 + (i % 4) * 4), 0, -dir * 6, 0],
                  }}
                  transition={{ duration: 1.9, times: [0, 0.25, 0.5, 0.75, 1], ease: 'easeInOut' }}
                />
              );
            })}
            <motion.p
              className="absolute bottom-2 text-[14px] text-text-secondary tracking-wide"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              괘를 섞고 있습니다
            </motion.p>
          </motion.div>
        )}

        {/* ── 뽑기: 질문 떠올리기 + 리본 스프레드 ── */}
        {phase === 'pick' && (
          <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* 질문 안내 — 카드 클릭 전 */}
            <AnimatePresence mode="wait">
              {picked.length === 0 ? (
                <motion.div
                  key="ask"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.8 }}
                  className="text-center mb-2"
                >
                  <p className="text-[17px] text-text-primary leading-relaxed" style={{ fontFamily: 'var(--font-serif)' }}>
                    마음속으로 묻고 싶은 것을
                    <br />
                    하나 떠올려 주세요
                  </p>
                  <motion.p
                    className="text-[12.5px] text-text-tertiary mt-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2, duration: 0.8 }}
                  >
                    준비되었다면, 옆으로 밀며 끌리는 카드를 {drawCount}장 골라 주세요
                  </motion.p>
                </motion.div>
              ) : (
                <motion.p
                  key="count"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-[14px] text-text-secondary mb-2"
                >
                  <span className="text-cta font-bold">{picked.length}</span>
                  <span className="text-text-tertiary"> / {drawCount}장</span>
                </motion.p>
              )}
            </AnimatePresence>

            {/* 리본 스프레드 — 옆으로 스크롤하며 고르기 */}
            <div className="-mx-5 overflow-x-auto scrollbar-hide">
              <div className="flex w-max items-end px-8 pt-12 pb-8">
                {deck.map((_, idx) => {
                  const isPicked = picked.includes(idx);
                  const jitter = ((idx * 7) % 5) - 2; // -2 ~ 2 결정적 지터
                  return (
                    <motion.button
                      key={idx}
                      initial={{ x: -140, opacity: 0, rotate: -10 }}
                      animate={{
                        x: 0,
                        opacity: 1,
                        rotate: isPicked ? 0 : jitter * 0.8,
                        y: isPicked ? -22 : 0,
                        scale: isPicked ? 1.08 : 1,
                      }}
                      transition={{ delay: idx * 0.018, type: 'spring', stiffness: 260, damping: 24 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => togglePick(idx)}
                      className={`relative shrink-0 w-[68px] aspect-[2/3] rounded-md border -ml-[44px] first:ml-0 transition-colors ${
                        isPicked
                          ? 'border-cta shadow-[0_0_18px_rgba(232,164,144,0.55)]'
                          : 'border-[rgba(201,166,255,0.3)]'
                      }`}
                      style={{
                        backgroundImage: BACK_IMG,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        zIndex: isPicked ? 200 : idx,
                      }}
                      aria-label={`카드 ${idx + 1}`}
                    />
                  );
                })}
              </div>
            </div>

            <button
              onClick={reset}
              className="mt-4 w-full py-3 rounded-xl bg-white/5 border border-[var(--border-subtle)] text-[13.5px] text-text-tertiary"
            >
              처음으로
            </button>
          </motion.div>
        )}

        {/* ── 공개: 플립 리빌 + 공수 낭독 + 카테고리 아코디언 ── */}
        {phase === 'reveal' && (
          <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {picked.map((deckIdx, i) => {
              const card = deck[deckIdx];
              const color = MANSHIN_GROUP_COLORS[card.group];
              const baseDelay = i * 0.55;
              return (
                <motion.div
                  key={card.id}
                  initial={{ rotateY: 100, opacity: 0, scale: 0.94 }}
                  animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                  transition={{ delay: baseDelay, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformPerspective: 900 }}
                  className="rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[rgba(20,12,38,0.55)]"
                >
                  {/* 카드 아트 자리 — 이미지 제작 전 텍스트 카드 */}
                  <div
                    className="relative flex flex-col items-center justify-center py-10 px-4 overflow-hidden"
                    style={{
                      background: `radial-gradient(circle at 50% 20%, ${color}33, rgba(20,12,38,0.2)), linear-gradient(180deg, ${color}22, transparent)`,
                    }}
                  >
                    <Sparkles color={color} />
                    {/* 뒤에서 번지는 광륜 */}
                    <motion.div
                      className="absolute w-[180px] h-[180px] rounded-full pointer-events-none"
                      style={{ background: `radial-gradient(circle, ${color}2e, transparent 70%)` }}
                      animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: baseDelay + 0.3 }}
                      className="text-[11px] tracking-[0.25em] mb-2 relative"
                      style={{ color }}
                    >
                      {card.group} · 제{card.no}패
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: baseDelay + 0.45, type: 'spring', stiffness: 200, damping: 16 }}
                      className="text-[36px] font-bold text-text-primary leading-tight text-center relative"
                      style={{ fontFamily: 'var(--font-title)' }}
                    >
                      {card.name}
                    </motion.div>
                    {card.hanja && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: baseDelay + 0.7 }}
                        className="text-[13px] text-text-tertiary mt-1 relative"
                      >
                        {card.hanja}
                      </motion.div>
                    )}
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: baseDelay + 0.85 }}
                      className="text-[13.5px] text-text-secondary mt-3 text-center relative"
                    >
                      {card.title}
                    </motion.div>
                    <div className="absolute bottom-2 right-3 text-[10px] text-[rgba(255,245,225,0.25)]">
                      일러스트 준비 중
                    </div>
                  </div>

                  {/* 공수 — 문장이 한 줄씩 천천히 내려오며 등장 */}
                  <div className="px-5 py-5">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: baseDelay + 1.0 }}
                      className="text-[11.5px] tracking-[0.2em] text-text-tertiary mb-3"
                    >
                      공수 내리시길
                    </motion.div>
                    <div className="space-y-3 border-l-2 pl-4" style={{ borderColor: `${color}66` }}>
                      {speechLines(card.speech).map((line, li) => (
                        <motion.p
                          key={li}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: baseDelay + 1.15 + li * 0.55, duration: 0.7, ease: 'easeOut' }}
                          className="text-[16px] text-text-primary leading-[1.85]"
                          style={{ fontFamily: 'var(--font-serif)' }}
                        >
                          {line}
                        </motion.p>
                      ))}
                    </div>

                    {/* 키워드 */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: baseDelay + 1.2 + speechLines(card.speech).length * 0.55 }}
                      className="flex flex-wrap gap-1.5 mt-4"
                    >
                      {card.keywords.map((k) => (
                        <span
                          key={k}
                          className="text-[12px] px-2.5 py-1 rounded-full border"
                          style={{ color, borderColor: `${color}55`, background: `${color}14` }}
                        >
                          {k}
                        </span>
                      ))}
                    </motion.div>

                    {/* 카테고리별 공수 — 탭하면 열리는 아코디언 */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: baseDelay + 1.5 + speechLines(card.speech).length * 0.55 }}
                      className="mt-5 space-y-2"
                    >
                      <div className="text-[11.5px] text-text-tertiary mb-1">
                        궁금한 운을 눌러 마저 들어보세요
                      </div>
                      {FORTUNE_SECTIONS.map((sec) => {
                        const key = `${deckIdx}-${sec.key}`;
                        const open = !!openSections[key];
                        const text = card.fortunes[sec.key as keyof ManshinFortunes];
                        return (
                          <div
                            key={sec.key}
                            className="rounded-xl border overflow-hidden"
                            style={{ borderColor: open ? `${color}55` : 'var(--border-subtle)' }}
                          >
                            <motion.button
                              whileTap={{ scale: 0.99 }}
                              onClick={() => setOpenSections((s) => ({ ...s, [key]: !s[key] }))}
                              className="w-full flex items-center justify-between px-4 py-3"
                              style={{ background: open ? `${color}0f` : 'rgba(255,255,255,0.03)' }}
                            >
                              <span className="text-[14px] font-semibold" style={{ color: open ? color : 'var(--text-secondary)' }}>
                                {sec.label}
                              </span>
                              <motion.span
                                animate={{ rotate: open ? 180 : 0 }}
                                transition={{ duration: 0.25 }}
                                className="text-[11px] text-text-tertiary"
                              >
                                ▾
                              </motion.span>
                            </motion.button>
                            <AnimatePresence initial={false}>
                              {open && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.35, ease: 'easeInOut' }}
                                >
                                  <div className="px-4 pb-4 pt-1 space-y-2">
                                    {speechLines(text).map((line, li) => (
                                      <motion.p
                                        key={li}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.12 + li * 0.3, duration: 0.5 }}
                                        className="text-[15px] text-text-primary leading-[1.8]"
                                        style={{ fontFamily: 'var(--font-serif)' }}
                                      >
                                        {line}
                                      </motion.p>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}

            <div className="flex gap-2 pt-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={startShuffle}
                className="flex-1 py-3.5 rounded-xl bg-cta/20 border border-cta/50 text-cta font-bold text-[15px]"
              >
                다시 뽑기
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={reset}
                className="flex-1 py-3.5 rounded-xl bg-white/5 border border-[var(--border-subtle)] text-[15px] text-text-secondary"
              >
                처음으로
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
