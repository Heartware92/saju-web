'use client';

/**
 * 만신 오라클 테스트 페이지 (/tarot_test 전용)
 *
 * 흐름: 인트로(장수 선택) → 셔플 연출 → 질문 떠올리기 + 부채꼴 스프레드에서 뽑기 → 플립 공개
 *
 * 모바일웹 성능 원칙 (웹/모바일웹 공통):
 * - 애니메이션은 transform/opacity 만 사용 (레이아웃·페인트 유발 속성 금지)
 * - box-shadow/filter 는 애니메이션하지 않음 — 글로우는 별도 레이어의 opacity 로
 * - 카드 텍스처는 소형본(back_sm.png, 280px)으로 GPU 메모리 절약
 * - 화면에 그리는 카드는 부채꼴 15장만 (60장 전체를 그리지 않음 — 덱은 셔플돼 있어
 *   보이는 15장 = 무작위 15장이므로 확률적으로 동일)
 * - willChange: transform 로 컴포지터 레이어 승격
 *
 * 크레딧·DB·AI 호출 없음. 라이브 타로와 완전 격리.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/services/supabase';
import {
  MANSHIN_DECK,
  MANSHIN_GROUP_COLORS,
  FORTUNE_SECTIONS,
  type ManshinCard,
  type ManshinFortunes,
} from '@/constants/test/manshinDeck.test';

type Phase = 'intro' | 'shuffle' | 'pick' | 'reveal';

/** AI 생성 공수 — cardId → { total?, love?, money?, work?, health? } */
type AiReadings = Record<string, Partial<Record<'total' | keyof ManshinFortunes, string>>>;

const BACK_SM = "url('/manshin/back_sm.png')";
/** 부채꼴에 실제로 펼치는 장수 — 덱이 셔플돼 있어 무작위성은 60장 기준과 동일 */
const FAN_COUNT = 15;
const FAN_STEP_DEG = 6; // 카드 간 각도

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

/** 카드 아트 영역에 떠다니는 별가루 (transform/opacity 만 사용) */
function Sparkles({ color }: { color: string }) {
  const dots = [
    { left: '16%', top: '24%', size: 3, delay: 0 },
    { left: '80%', top: '18%', size: 2, delay: 1.1 },
    { left: '68%', top: '70%', size: 3, delay: 2.0 },
    { left: '28%', top: '72%', size: 2, delay: 2.8 },
  ];
  return (
    <>
      {dots.map((d, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{ left: d.left, top: d.top, width: d.size, height: d.size, background: color, willChange: 'transform, opacity' }}
          animate={{ opacity: [0, 1, 0], y: [0, -12, -22] }}
          transition={{ duration: 3.6, delay: d.delay, repeat: Infinity, ease: 'easeInOut' }}
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
  /** AI 깊은 공수 — 공개 시 1회 요청, 도착하면 기본 공수를 대체 */
  const [aiReadings, setAiReadings] = useState<AiReadings>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiRequested = useRef(false);
  const shuffleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (shuffleTimer.current) clearTimeout(shuffleTimer.current); }, []);

  // 공개 단계 진입 시 AI 공수 1회 요청 (실패해도 기본 공수는 그대로 보임)
  useEffect(() => {
    if (phase !== 'reveal' || aiRequested.current || picked.length === 0) return;
    aiRequested.current = true;
    const cardIds = picked.map((idx) => deck[idx]?.id).filter(Boolean);
    (async () => {
      setAiLoading(true);
      setAiError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setAiError('로그인하면 신령의 깊은 공수를 들을 수 있어요');
          return;
        }
        const res = await fetch('/api/test/manshin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ cardIds }),
        });
        const json = await res.json();
        if (res.ok && json?.readings) setAiReadings(json.readings);
        else setAiError(json?.error || '깊은 공수를 받지 못했어요');
      } catch {
        setAiError('깊은 공수를 받지 못했어요');
      } finally {
        setAiLoading(false);
      }
    })();
  }, [phase, picked, deck]);

  const startShuffle = () => {
    setDeck(shuffleDeck(MANSHIN_DECK));
    setPicked([]);
    setOpenSections({});
    setAiReadings({});
    setAiError(null);
    aiRequested.current = false;
    setPhase('shuffle');
    shuffleTimer.current = setTimeout(() => setPhase('pick'), 2000);
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
      setTimeout(() => setPhase('reveal'), 700);
    }
  };

  const reset = () => {
    setPicked([]);
    setDeck([]);
    setOpenSections({});
    setAiReadings({});
    setAiError(null);
    aiRequested.current = false;
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
                style={{ willChange: 'transform' }}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                {[2, 1, 0].map((layer) => (
                  <div
                    key={layer}
                    className="absolute inset-0 rounded-lg border border-[rgba(201,166,255,0.3)]"
                    style={{
                      backgroundImage: BACK_SM,
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

        {/* ── 셔플 연출 — 8장, transform 만 애니메이션 ── */}
        {phase === 'shuffle' && (
          <motion.div
            key="shuffle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="relative h-[320px] flex items-center justify-center"
          >
            {Array.from({ length: 8 }).map((_, i) => {
              const dir = i % 2 === 0 ? 1 : -1;
              const spread = 42 + (i % 4) * 14;
              return (
                <motion.div
                  key={i}
                  className="absolute w-[88px] aspect-[2/3] rounded-lg border border-[rgba(201,166,255,0.35)]"
                  style={{
                    backgroundImage: BACK_SM,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    zIndex: i,
                    willChange: 'transform',
                  }}
                  animate={{
                    x: [0, dir * spread, 0, -dir * spread * 0.65, 0],
                    y: [0, -(8 + (i % 3) * 7), 3, -(5 + (i % 4) * 5), 0],
                    rotate: [0, dir * (7 + (i % 4) * 4), 0, -dir * 5, 0],
                  }}
                  transition={{ duration: 1.8, times: [0, 0.25, 0.5, 0.75, 1], ease: 'easeInOut' }}
                />
              );
            })}
            <motion.p
              className="absolute bottom-1 text-[14px] text-text-secondary tracking-wide"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              괘를 섞고 있습니다
            </motion.p>
          </motion.div>
        )}

        {/* ── 뽑기: 질문 떠올리기 + 부채꼴 스프레드 (스크롤 없음, 한 화면) ── */}
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
                  className="text-center mb-1"
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
                    준비되었다면, 끌리는 카드를 {drawCount}장 골라 주세요
                  </motion.p>
                </motion.div>
              ) : (
                <motion.p
                  key="count"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-[14px] text-text-secondary mb-1"
                >
                  <span className="text-cta font-bold">{picked.length}</span>
                  <span className="text-text-tertiary"> / {drawCount}장</span>
                </motion.p>
              )}
            </AnimatePresence>

            {/* 부채꼴 스프레드 */}
            <div className="relative h-[330px]">
              {deck.slice(0, FAN_COUNT).map((_, idx) => {
                const isPicked = picked.includes(idx);
                const angle = (idx - (FAN_COUNT - 1) / 2) * FAN_STEP_DEG;
                return (
                  <motion.button
                    key={idx}
                    initial={{ rotate: 0, opacity: 0 }}
                    animate={{
                      rotate: angle,
                      opacity: 1,
                      y: isPicked ? -26 : 0,
                      scale: isPicked ? 1.07 : 1,
                    }}
                    transition={{
                      rotate: { delay: 0.25 + idx * 0.045, type: 'spring', stiffness: 160, damping: 19 },
                      opacity: { delay: 0.25 + idx * 0.045, duration: 0.3 },
                      y: { type: 'spring', stiffness: 300, damping: 20 },
                      scale: { type: 'spring', stiffness: 300, damping: 20 },
                    }}
                    whileHover={{ y: isPicked ? -26 : -12 }}
                    whileTap={{ scale: 1.02 }}
                    onClick={() => togglePick(idx)}
                    className={`absolute left-1/2 bottom-10 w-[92px] aspect-[2/3] -ml-[46px] rounded-lg border ${
                      isPicked
                        ? 'border-cta shadow-[0_0_18px_rgba(232,164,144,0.55)]'
                        : 'border-[rgba(201,166,255,0.35)]'
                    }`}
                    style={{
                      backgroundImage: BACK_SM,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      transformOrigin: '50% 135%',
                      zIndex: isPicked ? 200 : idx,
                      willChange: 'transform',
                    }}
                    aria-label={`카드 ${idx + 1}`}
                  />
                );
              })}
            </div>

            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={startShuffle}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-[var(--border-subtle)] text-[13.5px] text-text-tertiary"
              >
                다시 섞기
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={reset}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-[var(--border-subtle)] text-[13.5px] text-text-tertiary"
              >
                처음으로
              </motion.button>
            </div>
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
                    {/* 뒤에서 번지는 광륜 — opacity/scale 만 애니메이션 */}
                    <motion.div
                      className="absolute w-[180px] h-[180px] rounded-full pointer-events-none"
                      style={{ background: `radial-gradient(circle, ${color}2e, transparent 70%)`, willChange: 'transform, opacity' }}
                      animate={{ scale: [1, 1.22, 1], opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
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
                      {speechLines(aiReadings[card.id]?.total ?? card.speech).map((line, li) => (
                        <motion.p
                          key={`${aiReadings[card.id]?.total ? 'ai' : 'base'}-${li}`}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: aiReadings[card.id]?.total ? li * 0.35 : baseDelay + 1.15 + li * 0.5, duration: 0.7, ease: 'easeOut' }}
                          className="text-[16px] text-text-primary leading-[1.85]"
                          style={{ fontFamily: 'var(--font-serif)' }}
                        >
                          {line}
                        </motion.p>
                      ))}
                      {aiLoading && !aiReadings[card.id]?.total && (
                        <motion.p
                          animate={{ opacity: [0.35, 0.9, 0.35] }}
                          transition={{ duration: 1.4, repeat: Infinity }}
                          className="text-[13px] text-text-tertiary"
                        >
                          신령이 깊은 공수를 고르는 중입니다
                        </motion.p>
                      )}
                      {aiError && !aiLoading && !aiReadings[card.id]?.total && (
                        <p className="text-[12px] text-text-tertiary">{aiError}</p>
                      )}
                    </div>

                    {/* 키워드 */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: baseDelay + 1.1 + speechLines(card.speech).length * 0.5 }}
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
                      transition={{ delay: baseDelay + 1.4 + speechLines(card.speech).length * 0.5 }}
                      className="mt-5 space-y-2"
                    >
                      <div className="text-[11.5px] text-text-tertiary mb-1">
                        궁금한 운을 눌러 마저 들어보세요
                      </div>
                      {FORTUNE_SECTIONS.map((sec) => {
                        const key = `${deckIdx}-${sec.key}`;
                        const open = !!openSections[key];
                        const aiText = aiReadings[card.id]?.[sec.key];
                        const text = aiText ?? card.fortunes[sec.key as keyof ManshinFortunes];
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
                                  <div className="px-4 pb-4 pt-1 space-y-2.5">
                                    {speechLines(text).map((line, li) => (
                                      <motion.p
                                        key={`${aiText ? 'ai' : 'base'}-${li}`}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.12 + li * 0.22, duration: 0.5 }}
                                        className="text-[15px] text-text-primary leading-[1.85]"
                                        style={{ fontFamily: 'var(--font-serif)' }}
                                      >
                                        {line}
                                      </motion.p>
                                    ))}
                                    {!aiText && aiLoading && (
                                      <motion.p
                                        animate={{ opacity: [0.35, 0.9, 0.35] }}
                                        transition={{ duration: 1.4, repeat: Infinity }}
                                        className="text-[12.5px] text-text-tertiary"
                                      >
                                        더 깊은 공수를 받아오는 중입니다
                                      </motion.p>
                                    )}
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
