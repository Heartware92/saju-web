'use client';

/**
 * 만신 타로 테스트 페이지 (/tarot_test 전용)
 *
 * 리딩 문법(3패 고정): 신령패(누가) → 풍습패(무슨 일) → 엽전패(얼마나/언제)
 * 흐름: 인트로 → 컷 셔플 연출 → 질문 떠올리기 → 세 번의 부채꼴에서 한 장씩 →
 *       잡 생성(POST /api/test/manshin) → 세 패 공개 + 신령의 단일 공수
 *
 * ★ 백그라운드 잡: 생성은 서버 after() 로 진행 — 화면을 벗어나도 완주.
 *   결과는 tarot_records 에 저장되고 useFortuneJob(jobId, 'tarot_records') 로
 *   실시간 구독. URL ?jobId= 로 새로고침/재진입 복원.
 *
 * 모바일웹 성능 원칙 (웹/모바일웹 공통):
 * - 애니메이션은 transform/opacity 만 (GPU 합성). box-shadow/filter 애니메이션 금지
 * - 컷 셔플: 덱이 좌우로 갈라졌다 합쳐지는 모션 ×3 + 40ms 스태거 + easeInOut
 * - 부채꼴 진입: 스프링 물리 + 스태거
 * - 카드 텍스처는 소형본(back_sm.png), willChange 로 레이어 승격
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/services/supabase';
import { useFortuneJob } from '@/hooks/useFortuneJob';
import {
  MANSHIN_DECK,
  MANSHIN_GROUP_COLORS,
  FORTUNE_SECTIONS,
  type ManshinCard,
  type ManshinFortunes,
} from '@/constants/test/manshinDeck.test';

type Phase = 'intro' | 'shuffle' | 'pick' | 'reveal';
type PickStep = 0 | 1 | 2; // 0=신령 1=풍습 2=엽전
type SectionKey = 'total' | keyof ManshinFortunes;

const BACK_SM = "url('/manshin/back_sm.png')";

const STEP_META: { key: 'deity' | 'custom' | 'coin'; label: string; guide: string; fan: number }[] = [
  { key: 'deity', label: '신령패', guide: '오늘 너를 봐줄 신령을 모시세요', fan: 12 },
  { key: 'custom', label: '풍습패', guide: '지금 네 앞의 장면을 뽑으세요', fan: 12 },
  { key: 'coin', label: '엽전패', guide: '엽전을 던져 때를 보세요', fan: 6 },
];

const SECTION_MARKERS: Record<SectionKey, string> = {
  total: '총운',
  love: '연애운',
  money: '재물운',
  work: '일사업운',
  health: '건강운',
};

function shuffleCards(cards: ManshinCard[]): ManshinCard[] {
  const a = [...cards];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 공수를 문장 단위로 분리 — 한 줄 풀이 + 줄바꿈 (구형 사파리 호환 위해 lookbehind 미사용) */
function speechLines(speech: string): string[] {
  const parts = speech.split('. ');
  return parts
    .map((p, i) => (i < parts.length - 1 ? `${p.trim()}.` : p.trim()))
    .filter(Boolean);
}

/** interpretation 원문([총운]... 마커)을 섹션별로 파싱 */
function parseInterpretation(raw: string | null): Partial<Record<SectionKey, string>> {
  if (!raw) return {};
  const out: Partial<Record<SectionKey, string>> = {};
  const alt = Object.values(SECTION_MARKERS).join('|');
  (Object.keys(SECTION_MARKERS) as SectionKey[]).forEach((key) => {
    const m = raw.match(new RegExp(`\\[${SECTION_MARKERS[key]}\\]([\\s\\S]*?)(?=\\[(?:${alt})\\]|$)`));
    const text = m?.[1]?.trim();
    if (text && text.length >= 40) out[key] = text;
  });
  return out;
}

/** 카드 아트 영역 별가루 (transform/opacity 만) */
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
          style={{ left: d.left, top: d.top, width: d.size, height: d.size, background: d ? color : color, willChange: 'transform, opacity' }}
          animate={{ opacity: [0, 1, 0], y: [0, -12, -22] }}
          transition={{ duration: 3.6, delay: d.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </>
  );
}

export function ManshinOracleTest() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [step, setStep] = useState<PickStep>(0);
  const [pools, setPools] = useState<{ deity: ManshinCard[]; custom: ManshinCard[]; coin: ManshinCard[] }>({ deity: [], custom: [], coin: [] });
  const [selected, setSelected] = useState<{ deity?: ManshinCard; custom?: ManshinCard; coin?: ManshinCard }>({});
  const [pendingIdx, setPendingIdx] = useState<number | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 백그라운드 잡 구독 (기존 타로와 동일 훅 — 실시간 + 폴백 fetch)
  const { job } = useFortuneJob(jobId, 'tarot_records');
  const reading = parseInterpretation(job?.status === 'done' ? job.interpretationDetailed : null);
  const jobFailed = job?.status === 'failed';
  const jobRunning = !!jobId && !jobFailed && !reading.total && !createError;

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };

  // 새로고침/재진입 복원 — URL ?jobId= 가 있으면 공개 화면으로 직행
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resumeId = params.get('jobId');
    if (!resumeId) return;
    setJobId(resumeId);
    setPhase('reveal');
    // 세 패 스냅샷 복원 (tarot_records.cards)
    (async () => {
      const { data } = await supabase
        .from('tarot_records')
        .select('cards')
        .eq('id', resumeId)
        .maybeSingle();
      const cards = (data?.cards ?? []) as { role: string; id: string }[];
      const find = (role: string) => MANSHIN_DECK.find((c) => c.id === cards.find((x) => x.role === role)?.id);
      const deity = find('deity');
      const custom = find('custom');
      const coin = find('coin');
      if (deity && custom && coin) setSelected({ deity, custom, coin });
      else setPhase('intro'); // 복원 불가 → 처음부터
    })();
  }, []);

  // 세 패 확정 → 잡 생성 (서버가 백그라운드로 완주)
  const createJob = async (deity: ManshinCard, custom: ManshinCard, coin: ManshinCard) => {
    setCreateError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setCreateError('로그인하면 신령의 깊은 공수를 들을 수 있어요');
        return;
      }
      const res = await fetch('/api/test/manshin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ deityId: deity.id, customId: custom.id, coinId: coin.id }),
      });
      const json = await res.json();
      if (res.ok && json?.jobId) {
        setJobId(json.jobId);
        // URL 에 jobId 보존 — 새로고침/재진입해도 이어보기
        const u = new URL(window.location.href);
        u.searchParams.set('jobId', json.jobId);
        window.history.replaceState(null, '', u.toString());
      } else {
        setCreateError(json?.error || '공수 요청에 실패했어요');
      }
    } catch {
      setCreateError('공수 요청에 실패했어요');
    }
  };

  const startShuffle = () => {
    setPools({
      deity: shuffleCards(MANSHIN_DECK.filter((c) => c.group !== '풍습' && c.group !== '엽전')),
      custom: shuffleCards(MANSHIN_DECK.filter((c) => c.group === '풍습')),
      coin: shuffleCards(MANSHIN_DECK.filter((c) => c.group === '엽전')),
    });
    setSelected({});
    setStep(0);
    setPendingIdx(null);
    setOpenSections({});
    setJobId(null);
    setCreateError(null);
    const u = new URL(window.location.href);
    u.searchParams.delete('jobId');
    window.history.replaceState(null, '', u.toString());
    setPhase('shuffle');
    later(() => setPhase('pick'), 2500);
  };

  const pickCard = (idx: number) => {
    if (pendingIdx !== null) return;
    const meta = STEP_META[step];
    const card = pools[meta.key][idx];
    if (!card) return;
    setPendingIdx(idx);
    later(() => {
      const next = { ...selected, [meta.key]: card };
      setSelected(next);
      setPendingIdx(null);
      if (step < 2) {
        setStep((step + 1) as PickStep);
      } else {
        setPhase('reveal');
        if (next.deity && next.custom && next.coin) {
          void createJob(next.deity, next.custom, next.coin);
        }
      }
    }, 550);
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    setSelected({});
    setStep(0);
    setPendingIdx(null);
    setOpenSections({});
    setJobId(null);
    setCreateError(null);
    const u = new URL(window.location.href);
    u.searchParams.delete('jobId');
    window.history.replaceState(null, '', u.toString());
    setPhase('intro');
  };

  const deity = selected.deity;
  const deityColor = deity ? MANSHIN_GROUP_COLORS[deity.group] : '#c9a6ff';

  return (
    <div className="min-h-screen px-5 pt-8 pb-24 max-w-[520px] mx-auto overflow-hidden">
      {/* 헤더 */}
      <motion.div
        className="text-center mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
      >
        <h1 className="text-[26px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-title)' }}>
          만신 타로
        </h1>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* ── 인트로 ── */}
        {phase === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-6"
          >
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
              <div className="text-[14px] font-semibold text-text-primary mb-3">세 개의 패를 뽑습니다</div>
              <div className="space-y-2">
                {STEP_META.map((m, i) => (
                  <div key={m.key} className="flex items-center gap-3">
                    <span className="w-14 shrink-0 text-[13px] font-bold text-cta">{m.label}</span>
                    <span className="text-[13px] text-text-tertiary">
                      {i === 0 ? '누가 너를 도울지' : i === 1 ? '무슨 일이 벌어질지' : '얼마나, 언제일지'}
                    </span>
                  </div>
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

        {/* ── 컷 셔플: 덱이 좌우로 갈라졌다 합쳐지기 ×3 (스태거 + transform-only) ── */}
        {phase === 'shuffle' && (
          <motion.div
            key="shuffle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative h-[320px] flex items-center justify-center"
          >
            {Array.from({ length: 8 }).map((_, i) => {
              // 라운드마다 소속 패킷(좌/우)이 바뀌어 '컷 & 머지' 느낌
              const d0 = i % 2 === 0 ? -1 : 1;
              const d1 = (i + 1) % 2 === 0 ? -1 : 1;
              const d2 = i % 2 === 0 ? 1 : -1;
              const S = 62;
              return (
                <motion.div
                  key={i}
                  className="absolute w-[92px] aspect-[2/3] rounded-lg border border-[rgba(201,166,255,0.35)]"
                  style={{
                    backgroundImage: BACK_SM,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    zIndex: i,
                    willChange: 'transform',
                  }}
                  animate={{
                    x: [0, d0 * S, 0, d1 * S, 0, d2 * S, 0],
                    y: [0, -10, 2, -10, 2, -10, 0],
                    rotate: [0, d0 * 5, 0, d1 * 5, 0, d2 * 5, 0],
                  }}
                  transition={{
                    duration: 2.2,
                    times: [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1],
                    ease: 'easeInOut',
                    delay: (i % 4) * 0.04, // 스태거 40ms
                  }}
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

        {/* ── 뽑기: 3단계 부채꼴 (신령 → 풍습 → 엽전) ── */}
        {phase === 'pick' && (
          <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* 진행 표시 */}
            <div className="flex justify-center gap-2 mb-3">
              {STEP_META.map((m, i) => {
                const done = !!selected[m.key];
                const active = i === step;
                return (
                  <div
                    key={m.key}
                    className={`px-3 py-1.5 rounded-full text-[12px] border transition-colors ${
                      done
                        ? 'border-cta/60 text-cta bg-cta/10'
                        : active
                          ? 'border-[rgba(201,166,255,0.5)] text-text-primary bg-white/5'
                          : 'border-[var(--border-subtle)] text-text-tertiary'
                    }`}
                  >
                    {m.label}
                    {done ? ` · ${selected[m.key]!.name}` : ''}
                  </div>
                );
              })}
            </div>

            {/* 질문 안내(첫 패 전) / 단계 가이드 */}
            <AnimatePresence mode="wait">
              {step === 0 && !selected.deity ? (
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
                    transition={{ delay: 1.1, duration: 0.8 }}
                  >
                    준비되었다면 {STEP_META[0].guide}
                  </motion.p>
                </motion.div>
              ) : (
                <motion.p
                  key={`guide-${step}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="text-center text-[15px] text-text-primary mb-1"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {STEP_META[step].guide}
                </motion.p>
              )}
            </AnimatePresence>

            {/* 부채꼴 — 단계별로 새로 펼침 */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`fan-${step}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3 }}
                className="relative h-[320px]"
              >
                {pools[STEP_META[step].key].slice(0, STEP_META[step].fan).map((_, idx) => {
                  const fanCount = Math.min(pools[STEP_META[step].key].length, STEP_META[step].fan);
                  const stepDeg = fanCount > 8 ? 7 : 10;
                  const angle = (idx - (fanCount - 1) / 2) * stepDeg;
                  const isPicked = pendingIdx === idx;
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
                        rotate: { delay: 0.15 + idx * 0.04, type: 'spring', stiffness: 170, damping: 22 },
                        opacity: { delay: 0.15 + idx * 0.04, duration: 0.3 },
                        y: { type: 'spring', stiffness: 300, damping: 20 },
                        scale: { type: 'spring', stiffness: 300, damping: 20 },
                      }}
                      whileHover={{ y: isPicked ? -26 : -12 }}
                      whileTap={{ scale: 1.02 }}
                      onClick={() => pickCard(idx)}
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
                      aria-label={`${STEP_META[step].label} ${idx + 1}`}
                    />
                  );
                })}
              </motion.div>
            </AnimatePresence>

            <button
              onClick={reset}
              className="w-full py-3 rounded-xl bg-white/5 border border-[var(--border-subtle)] text-[13.5px] text-text-tertiary"
            >
              처음으로
            </button>
          </motion.div>
        )}

        {/* ── 공개: 세 패 + 신령의 단일 공수 ── */}
        {phase === 'reveal' && deity && selected.custom && selected.coin && (
          <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            {/* 세 패 요약 */}
            <div className="grid grid-cols-3 gap-2">
              {STEP_META.map((m, i) => {
                const card = selected[m.key]!;
                const color = MANSHIN_GROUP_COLORS[card.group];
                return (
                  <motion.div
                    key={m.key}
                    initial={{ rotateY: 100, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    transition={{ delay: i * 0.3, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    style={{ transformPerspective: 700 }}
                    className="rounded-xl border border-[var(--border-subtle)] overflow-hidden text-center"
                  >
                    <div className="py-1.5 text-[10.5px] tracking-[0.15em]" style={{ background: `${color}1a`, color }}>
                      {m.label}
                    </div>
                    <div
                      className="px-1 py-3 flex flex-col items-center justify-center min-h-[86px]"
                      style={{ background: `radial-gradient(circle at 50% 0%, ${color}22, rgba(20,12,38,0.4))` }}
                    >
                      <div className="text-[16px] font-bold text-text-primary leading-tight" style={{ fontFamily: 'var(--font-title)' }}>
                        {card.name}
                      </div>
                      <div className="text-[10.5px] text-text-tertiary mt-1 leading-snug px-1">{card.title}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* 공수 카드 */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[rgba(20,12,38,0.55)]"
            >
              <div
                className="relative flex flex-col items-center justify-center py-8 px-4 overflow-hidden"
                style={{
                  background: `radial-gradient(circle at 50% 20%, ${deityColor}33, rgba(20,12,38,0.2)), linear-gradient(180deg, ${deityColor}22, transparent)`,
                }}
              >
                <Sparkles color={deityColor} />
                <motion.div
                  className="absolute w-[180px] h-[180px] rounded-full pointer-events-none"
                  style={{ background: `radial-gradient(circle, ${deityColor}2e, transparent 70%)`, willChange: 'transform, opacity' }}
                  animate={{ scale: [1, 1.22, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="text-[11px] tracking-[0.25em] mb-2 relative" style={{ color: deityColor }}>
                  {deity.group} · 제{deity.no}패
                </div>
                <div className="text-[32px] font-bold text-text-primary leading-tight text-center relative" style={{ fontFamily: 'var(--font-title)' }}>
                  {deity.name}
                </div>
                <div className="text-[13px] text-text-secondary mt-2 text-center relative">
                  {selected.custom.name}의 장면에 {selected.coin.name}을 얹어 공수를 내립니다
                </div>
                <div className="absolute bottom-2 right-3 text-[10px] text-[rgba(255,245,225,0.25)]">
                  일러스트 준비 중
                </div>
              </div>

              <div className="px-5 py-5">
                <div className="text-[11.5px] tracking-[0.2em] text-text-tertiary mb-3">공수 내리시길</div>
                <div className="space-y-3 border-l-2 pl-4" style={{ borderColor: `${deityColor}66` }}>
                  {speechLines(reading.total ?? deity.speech).map((line, li) => (
                    <motion.p
                      key={`${reading.total ? 'ai' : 'base'}-${li}`}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: li * 0.35, duration: 0.7, ease: 'easeOut' }}
                      className="text-[16px] text-text-primary leading-[1.85]"
                      style={{ fontFamily: 'var(--font-serif)' }}
                    >
                      {line}
                    </motion.p>
                  ))}
                  {jobRunning && !reading.total && (
                    <motion.p
                      animate={{ opacity: [0.35, 0.9, 0.35] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                      className="text-[13px] text-text-tertiary"
                    >
                      신령이 세 패를 읽고 있습니다 (잠시 자리를 비워도 계속됩니다)
                    </motion.p>
                  )}
                  {(createError || jobFailed) && !reading.total && (
                    <p className="text-[12px] text-text-tertiary">
                      {createError || job?.errorMessage || '공수 생성에 실패했어요. 다시 뽑아주세요.'}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 mt-4">
                  {deity.keywords.map((k) => (
                    <span
                      key={k}
                      className="text-[12px] px-2.5 py-1 rounded-full border"
                      style={{ color: deityColor, borderColor: `${deityColor}55`, background: `${deityColor}14` }}
                    >
                      {k}
                    </span>
                  ))}
                </div>

                {/* 카테고리별 공수 — 탭하면 열리는 아코디언 */}
                <div className="mt-5 space-y-2">
                  <div className="text-[11.5px] text-text-tertiary mb-1">궁금한 운을 눌러 마저 들어보세요</div>
                  {FORTUNE_SECTIONS.map((sec) => {
                    const open = !!openSections[sec.key];
                    const aiText = reading[sec.key];
                    const text = aiText ?? deity.fortunes[sec.key as keyof ManshinFortunes];
                    return (
                      <div
                        key={sec.key}
                        className="rounded-xl border overflow-hidden"
                        style={{ borderColor: open ? `${deityColor}55` : 'var(--border-subtle)' }}
                      >
                        <motion.button
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setOpenSections((s) => ({ ...s, [sec.key]: !s[sec.key] }))}
                          className="w-full flex items-center justify-between px-4 py-3"
                          style={{ background: open ? `${deityColor}0f` : 'rgba(255,255,255,0.03)' }}
                        >
                          <span className="text-[14px] font-semibold" style={{ color: open ? deityColor : 'var(--text-secondary)' }}>
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
                                {!aiText && jobRunning && (
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
                </div>
              </div>
            </motion.div>

            <div className="flex gap-2 pt-1">
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
