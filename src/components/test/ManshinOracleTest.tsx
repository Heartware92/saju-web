'use client';

/**
 * 만신 오라클 테스트 페이지 (/tarot_test 전용)
 *
 * - 60장(신령 36 + 풍습 18 + 엽전 6) 셔플 → 1장/3장 선택 → 플립 공개
 * - 이미지 미제작 상태: 카드 앞면은 그룹색 그라데이션 + 신령 이름 텍스트 카드로 대체
 * - 공수(speech)는 문장 단위 줄바꿈으로 렌더 (가독성 원칙)
 * - 크레딧·DB·AI 호출 없음. 라이브 타로와 완전 격리.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MANSHIN_DECK,
  MANSHIN_GROUP_COLORS,
  type ManshinCard,
} from '@/constants/test/manshinDeck.test';

type Phase = 'intro' | 'pick' | 'reveal';

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

export function ManshinOracleTest() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [drawCount, setDrawCount] = useState<1 | 3>(1);
  const [deck, setDeck] = useState<ManshinCard[]>([]);
  const [picked, setPicked] = useState<number[]>([]); // deck 인덱스

  const startShuffle = () => {
    setDeck(shuffleDeck(MANSHIN_DECK));
    setPicked([]);
    setPhase('pick');
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
      setTimeout(() => setPhase('reveal'), 550);
    }
  };

  const reset = () => {
    setPicked([]);
    setDeck([]);
    setPhase('intro');
  };

  return (
    <div className="min-h-screen px-5 pt-8 pb-24 max-w-[520px] mx-auto">
      {/* 헤더 */}
      <div className="text-center mb-6">
        <div className="text-[12px] tracking-[0.3em] text-text-tertiary mb-2">TEST · 만신 오라클</div>
        <h1 className="text-[26px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-title)' }}>
          만신 오라클
        </h1>
        <p className="text-[13.5px] text-text-tertiary mt-2 leading-relaxed">
          예순 장의 신령과 풍습, 엽전이<br />당신의 물음에 답을 내립니다
        </p>
      </div>

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
            <div className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
              <div className="text-[14px] font-semibold text-text-primary mb-3">몇 장을 뽑을까요?</div>
              <div className="flex gap-2">
                {([1, 3] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setDrawCount(n)}
                    className={`flex-1 py-3 rounded-xl text-[15px] font-bold transition-all border ${
                      drawCount === n
                        ? 'bg-cta/20 border-cta/50 text-cta'
                        : 'bg-white/5 border-[var(--border-subtle)] text-text-tertiary'
                    }`}
                  >
                    {n === 1 ? '한 장 — 오늘의 공수' : '세 장 — 흐름 보기'}
                  </button>
                ))}
              </div>
              <p className="text-[12.5px] text-text-tertiary mt-3 leading-relaxed">
                마음속으로 묻고 싶은 것을 하나 떠올려 주세요.
              </p>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={startShuffle}
              className="w-full py-4 rounded-2xl bg-cta/20 border border-cta/50 text-cta font-bold text-[16px]"
            >
              카드 섞기
            </motion.button>

            <div className="text-center text-[12px] text-text-tertiary">
              신령부 36장 · 풍습부 18장 · 엽전부 6장 = 60장
            </div>
          </motion.div>
        )}

        {/* ── 뽑기: 60장 펼침 ── */}
        {phase === 'pick' && (
          <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <p className="text-center text-[14px] text-text-secondary mb-4">
              끌리는 카드 <span className="text-cta font-bold">{drawCount}장</span>을 고르세요
              <span className="text-text-tertiary"> ({picked.length}/{drawCount})</span>
            </p>
            <div className="grid grid-cols-6 gap-1.5">
              {deck.map((_, idx) => {
                const isPicked = picked.includes(idx);
                return (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, y: 10, rotate: -4 + Math.random() * 8 }}
                    animate={{
                      opacity: 1,
                      y: isPicked ? -8 : 0,
                      rotate: 0,
                      scale: isPicked ? 1.08 : 1,
                    }}
                    transition={{ delay: idx * 0.012, type: 'spring', stiffness: 300, damping: 22 }}
                    onClick={() => togglePick(idx)}
                    className={`aspect-[2/3] rounded-md border overflow-hidden transition-colors ${
                      isPicked
                        ? 'border-cta shadow-[0_0_12px_rgba(232,164,144,0.5)]'
                        : 'border-[rgba(201,166,255,0.25)]'
                    }`}
                    style={{
                      backgroundImage: "url('/manshin/back.png')",
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                    aria-label={`카드 ${idx + 1}`}
                  />
                );
              })}
            </div>
            <button onClick={reset} className="mt-6 w-full py-3 rounded-xl bg-white/5 border border-[var(--border-subtle)] text-[13.5px] text-text-tertiary">
              처음으로
            </button>
          </motion.div>
        )}

        {/* ── 공개: 플립 리빌 ── */}
        {phase === 'reveal' && (
          <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            {picked.map((deckIdx, i) => {
              const card = deck[deckIdx];
              const color = MANSHIN_GROUP_COLORS[card.group];
              return (
                <motion.div
                  key={card.id}
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ delay: i * 0.4, duration: 0.5, ease: 'easeOut' }}
                  style={{ transformPerspective: 900 }}
                  className="rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[rgba(20,12,38,0.55)]"
                >
                  {/* 카드 아트 자리 — 이미지 제작 전 텍스트 카드 */}
                  <div
                    className="relative flex flex-col items-center justify-center py-9 px-4"
                    style={{
                      background: `radial-gradient(circle at 50% 20%, ${color}33, rgba(20,12,38,0.2)), linear-gradient(180deg, ${color}22, transparent)`,
                    }}
                  >
                    <div className="text-[11px] tracking-[0.25em] mb-2" style={{ color }}>
                      {card.group} · 제{card.no}패
                    </div>
                    <div
                      className="text-[34px] font-bold text-text-primary leading-tight text-center"
                      style={{ fontFamily: 'var(--font-title)' }}
                    >
                      {card.name}
                    </div>
                    {card.hanja && (
                      <div className="text-[13px] text-text-tertiary mt-1">{card.hanja}</div>
                    )}
                    <div className="text-[13.5px] text-text-secondary mt-3 text-center">{card.title}</div>
                    <div className="absolute bottom-2 right-3 text-[10px] text-[rgba(255,245,225,0.25)]">
                      일러스트 준비 중
                    </div>
                  </div>

                  {/* 공수 — 문장 단위 줄바꿈 */}
                  <div className="px-5 py-5">
                    <div className="text-[11.5px] tracking-[0.2em] text-text-tertiary mb-3">공수 내리시길</div>
                    <div className="space-y-2.5 border-l-2 pl-4" style={{ borderColor: `${color}66` }}>
                      {speechLines(card.speech).map((line, li) => (
                        <motion.p
                          key={li}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.4 + 0.35 + li * 0.25 }}
                          className="text-[16px] text-text-primary leading-[1.8]"
                          style={{ fontFamily: 'var(--font-serif)' }}
                        >
                          {line}
                        </motion.p>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {card.keywords.map((k) => (
                        <span
                          key={k}
                          className="text-[12px] px-2.5 py-1 rounded-full border"
                          style={{ color, borderColor: `${color}55`, background: `${color}14` }}
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                    <div className="text-[12px] text-text-tertiary mt-3">{card.domains}</div>
                  </div>
                </motion.div>
              );
            })}

            <div className="flex gap-2 pt-2">
              <button
                onClick={startShuffle}
                className="flex-1 py-3.5 rounded-xl bg-cta/20 border border-cta/50 text-cta font-bold text-[15px]"
              >
                다시 뽑기
              </button>
              <button
                onClick={reset}
                className="flex-1 py-3.5 rounded-xl bg-white/5 border border-[var(--border-subtle)] text-[15px] text-text-secondary"
              >
                처음으로
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
