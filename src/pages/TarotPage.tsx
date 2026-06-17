'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { TAROT_DECK, ELEMENT_COLORS, getCardImg } from '../engine/tarot/deck';
import { buildTarotReading, type DrawnCard, type TarotReading } from '../engine/tarot/reading';
import { formatTodayString, formatMonthString } from '../utils/tarotSeed';
import { extractMetaphor } from '../utils/parseMetaphor';
import { renderEmphasis } from '../utils/renderEmphasis';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';
import { useCreditStore } from '../store/useCreditStore';
import { useReportCacheStore, sajuKey } from '../store/useReportCacheStore';
import { MOON_COST_TAROT, CHARGE_REASONS } from '../constants/creditCosts';
import { computeSajuFromProfile } from '../utils/profileSaju';
import { parseNumberedSections } from '../services/fortuneService';
import { generateHybridPrompt } from '../constants/prompts';
import { supabase } from '../services/supabase';
import { useFortuneJob } from '../hooks/useFortuneJob';
import { SectionCollapsible } from '../components/saju/SectionCollapsible';
import type { TarotCardInfo } from '../services/api';
import type { SajuResult } from '../utils/sajuCalculator';
import { AILoadingBar } from '../components/AILoadingBar';
import { useLoadingGuard } from '../hooks/useLoadingGuard';

type TarotMode = 'today' | 'monthly' | 'question';
type AutoState = 'idle' | 'shuffling' | 'spread' | 'revealed';
type QuestionState = 'select' | 'shuffling' | 'spread' | 'revealed';

function drawnToCardInfo(drawn: DrawnCard): TarotCardInfo {
  const dir = drawn.isReversed ? 'reversed' : 'upright';
  return {
    name: drawn.card.name,
    nameKr: drawn.card.nameKr,
    element: drawn.card.element,
    isReversed: drawn.isReversed,
    keywords: drawn.card.keywords[drawn.isReversed ? 'reversed' : 'upright'],
    meaning: drawn.card[dir].overall,
    contexts: {
      overall: drawn.card[dir].overall,
      love: drawn.card[dir].love,
      career: drawn.card[dir].career,
      money: drawn.card[dir].money,
      health: drawn.card[dir].health,
      advice: drawn.card[dir].advice,
    },
  };
}

// ── 뒷면→앞면 3D 플립 카드 ───────────────────────────────────────────────────
function FlipCard({
  drawn, width = 120, shouldFlip, flipDelay = 0,
}: {
  drawn: DrawnCard;
  width?: number;
  shouldFlip: boolean;
  flipDelay?: number;
}) {
  const { card, isReversed, position } = drawn;
  const color = ELEMENT_COLORS[card.element];
  // 실제 카드 비율 350×600 = 1.714
  const height = Math.round(width * 1.714);

  return (
    <div style={{ width, flexShrink: 0, textAlign: 'center' }}>
      {position && (
        <div className="text-[12px] text-text-tertiary mb-2 font-semibold tracking-wide uppercase">
          {position}
        </div>
      )}
      <div style={{ perspective: 1400, width, height }}>
        <motion.div
          animate={{ rotateY: shouldFlip ? 180 : 0 }}
          transition={{ delay: flipDelay, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          style={{ width, height, position: 'relative', transformStyle: 'preserve-3d' }}
        >
          {/* 뒷면 */}
          <div style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            borderRadius: 13,
            overflow: 'hidden',
            border: '2px solid rgba(124,92,252,0.5)',
            boxShadow: '0 4px 18px rgba(0,0,0,0.45)',
            backgroundColor: '#2a1660',
          }}>
            <img src="/tarot/back.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          </div>
          {/* 앞면 — 이미지만, 잘림 없음 */}
          <div style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: 13,
            overflow: 'hidden',
            border: `2px solid ${color}`,
            boxShadow: `0 4px 22px ${color}35`,
          }}>
            <img
              src={getCardImg(card)}
              alt={card.nameKr}
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                transform: isReversed ? 'rotate(180deg)' : 'none',
              }}
            />
            <div
              className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[11px] font-bold"
              style={{
                backgroundColor: isReversed ? '#F8717133' : '#34D39933',
                color: isReversed ? '#F87171' : '#34D399',
                backdropFilter: 'blur(4px)',
              }}
            >
              {isReversed ? '역' : '정'}
            </div>
          </div>
        </motion.div>
      </div>
      {/* 카드명 — 플립 후 등장 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: shouldFlip ? 1 : 0 }}
        transition={{ delay: flipDelay + 0.65, duration: 0.35 }}
        className="mt-2"
      >
        <div className="text-[14px] font-semibold text-text-primary">{card.nameKr}</div>
        <div className="text-[12px] text-text-tertiary mt-0.5">{card.name}</div>
      </motion.div>
    </div>
  );
}

// ── 섹션별 점진 등장 래퍼 ────────────────────────────────────────────────────
function FadeIn({ delay, children }: { delay: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// ── ReadingView ───────────────────────────────────────────────────────────────
function ContextBlock({ block, color }: { block: TarotReading['contexts'][number]; color: string }) {
  return (
    <div className="rounded-xl p-3 bg-white/5 border border-[var(--border-subtle)]">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color }} className="text-[16px]">{block.icon}</span>
        <span className="text-[15px] font-semibold text-text-primary">{block.label}</span>
      </div>
      <p
        className="text-[15px] text-text-secondary leading-[1.85] tracking-[-0.005em] mb-2"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        {block.text}
      </p>
      {block.cardLines.length > 1 && (
        <ul className="space-y-1 pt-2 border-t border-[var(--border-subtle)]">
          {block.cardLines.map((line, i) => (
            <li key={i} className="text-[11.5px] text-text-tertiary leading-relaxed">· {line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReadingView({ reading, color }: { reading: TarotReading; color: string }) {
  return (
    <div className="space-y-3">
      <FadeIn delay={0.1}>
        <section className="rounded-2xl p-5 text-center" style={{ backgroundColor: `${color}12`, border: `1px solid ${color}55` }}>
          <div className="text-[13px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">타로 리딩</div>
          <div
            className="text-[18px] font-bold mb-1"
            style={{ color, fontFamily: 'var(--font-title)', letterSpacing: '-0.01em' }}
          >
            {reading.headline}
          </div>
          <div
            className="text-[15px] text-text-secondary tracking-[-0.005em]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {reading.subhead}
          </div>
        </section>
      </FadeIn>
      <FadeIn delay={0.35}>
        <section className="rounded-2xl p-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <div className="text-[15px] font-semibold text-text-secondary mb-2 uppercase tracking-wider">키워드</div>
          <div className="flex flex-wrap gap-1.5">
            {reading.keywords.map((k, i) => (
              <span key={i} className="text-[14px] px-2.5 py-1 rounded-md border"
                style={{ borderColor: `${color}55`, color, backgroundColor: `${color}12` }}>
                {k}
              </span>
            ))}
          </div>
        </section>
      </FadeIn>
      <FadeIn delay={0.55}>
        <section className="rounded-2xl p-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <div className="text-[15px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">종합 해석</div>
          <div className="space-y-3">
            {reading.synthesis.map((p, i) => (
              <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: 0.7 + i * 0.18, duration: 0.4 }}
                className="text-[15px] text-text-secondary leading-[1.85] tracking-[-0.005em]"
                style={{ fontFamily: 'var(--font-body)' }}>
                {p}
              </motion.p>
            ))}
          </div>
        </section>
      </FadeIn>
      <FadeIn delay={0.9}>
        <section className="rounded-2xl p-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <div className="text-[15px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">맥락별 풀이</div>
          <div className="space-y-2">
            {reading.contexts.map((b, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.05 + i * 0.15, duration: 0.4 }}>
                <ContextBlock block={b} color={color} />
              </motion.div>
            ))}
          </div>
        </section>
      </FadeIn>
      <FadeIn delay={1.9}>
        <section className="rounded-2xl p-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <div className="text-[15px] font-semibold mb-2" style={{ color: '#34D399' }}>카드의 조언</div>
          <ul className="space-y-1.5">
            {reading.advice.map((a, i) => (
              <li
                key={i}
                className="text-[14px] text-text-secondary tracking-[-0.005em] flex gap-2"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <span style={{ color: '#34D399' }}>✓</span><span>{a}</span>
              </li>
            ))}
          </ul>
        </section>
      </FadeIn>
    </div>
  );
}

// ── AI ReadingView ────────────────────────────────────────────────────────────
// 1·2·3… 번호 섹션을 SectionCollapsible 카드로 분리 — 다른 운세 결과(토정·신년)와 동일 톤.
function AIBodyChildren({ body, color }: { body: string; color: string }) {
  // 문단별 — bullet vs 일반 문단 분기
  const paras = body.split(/\n\n+/).filter(Boolean);
  return (
    <div
      className="text-[16px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {paras.map((p, i) => {
        const trimmed = p.trim();
        if (trimmed.startsWith('-') || trimmed.startsWith('·')) {
          return (
            <ul key={i} className="space-y-1.5">
              {trimmed.split('\n').map((line, j) => (
                <li key={j} className="flex gap-2">
                  <span style={{ color }} className="shrink-0">·</span>
                  <span>{renderEmphasis(line.replace(/^[-·]\s*/, '').trim())}</span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={i} className="whitespace-pre-line">{renderEmphasis(trimmed)}</p>;
      })}
    </div>
  );
}

function AIReadingView({ content, color }: { content: string; color: string }) {
  // [은유] 마커 안전망 — 본문에 마커가 섞여 있어도 strip 후 파싱
  const clean = extractMetaphor(content).bodyText || content;
  const sections = parseNumberedSections(clean);

  return (
    <div className="space-y-3">
      <FadeIn delay={0.1}>
        <section className="rounded-2xl p-5 text-center" style={{ backgroundColor: `${color}12`, border: `1px solid ${color}55` }}>
          <div className="text-[13px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">사주 × 타로 리딩</div>
          <div
            className="text-[16px] font-bold"
            style={{ color, fontFamily: 'var(--font-title)', letterSpacing: '-0.01em' }}
          >
            당신의 사주와 카드가 만나는 순간
          </div>
        </section>
      </FadeIn>

      {sections.length > 0 ? (
        sections.map((s, idx) => (
          <FadeIn key={idx} delay={0.25 + Math.min(idx * 0.1, 1.2)}>
            <SectionCollapsible
              title={s.title}
              defaultOpen={idx === 0}
              enterDelay={0}
            >
              <AIBodyChildren body={s.body} color={color} />
            </SectionCollapsible>
          </FadeIn>
        ))
      ) : (
        // 파싱 실패 fallback: 기존 단일 카드
        <FadeIn delay={0.3}>
          <section className="rounded-2xl p-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
            <AIBodyChildren body={clean} color={color} />
          </section>
        </FadeIn>
      )}
    </div>
  );
}

function LoadingSpinner({ startedAt }: { startedAt?: string | null }) {
  return (
    <AILoadingBar
      inline
      label="타로 해석중"
      minLabel="8초"
      maxLabel="25초"
      estimatedSeconds={15}
      startedAt={startedAt}
      messages={['카드의 상징을 읽는 중입니다', '사주와 카드의 흐름을 짚는 중입니다', '풀이를 정리하는 중입니다']}
    />
  );
}

function NoPrimaryModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-[calc(64px+env(safe-area-inset-bottom,0px))] sm:pb-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl p-6 max-w-sm w-full bg-[rgba(20,12,38,0.95)] border border-[var(--border-subtle)]">
        <div className="text-center">
          <div className="text-[32px] mb-3">✦</div>
          <h3 className="text-[17px] font-bold text-text-primary mb-2">대표 프로필이 필요합니다</h3>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-5">
            사주와 타로를 함께 풀이하려면<br />대표 프로필을 먼저 등록해 주세요.
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[var(--border-subtle)] text-[15px] text-text-secondary">닫기</button>
            <button onClick={() => router.push('/saju/input?mode=profile-only')}
              className="flex-1 py-2.5 rounded-xl font-bold text-white text-[15px]"
              style={{ background: 'var(--cta-primary)' }}>
              프로필 등록하기
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function TarotPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recordId = searchParams?.get('recordId') ?? null;
  const urlJobId = searchParams?.get('jobId') ?? null;
  const isArchiveMode = !!recordId;
  const { user } = useUserStore();

  // 백그라운드 잡 시스템 — 타로는 tarot_records 테이블 (useFortuneJob 의 table 분기)
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const effectiveJobId = urlJobId ?? createdJobId;
  const { job: fortuneJob } = useFortuneJob(effectiveJobId, 'tarot_records');
  const { profiles, fetchProfiles } = useProfileStore();

  const [mode, setMode] = useState<TarotMode>('today');
  const [showNoPrimaryModal, setShowNoPrimaryModal] = useState(false);

  // 오늘/이달
  const [autoState, setAutoState] = useState<AutoState>('idle');
  const [autoDrawn, setAutoDrawn] = useState<DrawnCard[]>([]);
  const [autoSpread, setAutoSpread] = useState<number[]>([]);
  const [autoSpreadReversed, setAutoSpreadReversed] = useState<boolean[]>([]);
  const [selectedSpreadIdxs, setSelectedSpreadIdxs] = useState<number[]>([]);

  // 질문 모드
  const [qState, setQState] = useState<QuestionState>('select');
  const [qSpread, setQSpread] = useState<number[]>([]);
  const [qDrawn, setQDrawn] = useState<DrawnCard | null>(null);
  const [question, setQuestion] = useState('');

  // 리딩
  const [aiContent, setAiContent] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // ── 로딩 안전장치: 70초 초과 시 강제 해제 ──
  const [aiTimedOut] = useLoadingGuard(aiLoading, 140_000);
  useEffect(() => {
    if (aiTimedOut) {
      setAiLoading(false);
      if (!aiContent) setAiError('응답이 너무 오래 걸려요. 새로고침 후 다시 시도해주세요.');
    }
  }, [aiTimedOut, aiContent]);

  // ── 잡 결과 → state 동기화 (백그라운드 잡 시스템) ──
  useEffect(() => {
    if (isArchiveMode) return;
    if (!fortuneJob) return;
    if (fortuneJob.status === 'done') {
      setAiContent(fortuneJob.interpretationDetailed ?? '');
      setAiError(null);
      setAiLoading(false);
    } else if (fortuneJob.status === 'failed') {
      setAiError(fortuneJob.errorMessage ?? '풀이 생성에 실패했어요. 크레딧은 자동 환불됐어요.');
      setAiLoading(false);
    } else {
      setAiLoading(true);
    }
  }, [
    isArchiveMode,
    fortuneJob?.status,
    fortuneJob?.interpretationDetailed,
    fortuneJob?.errorMessage,
  ]);

  useEffect(() => { if (user) fetchProfiles(); }, [user, fetchProfiles]);

  // 카드백 이미지 프리로드 — 셔플 첫 프레임에 투명 보이는 문제 방지
  useEffect(() => {
    const img = new Image();
    img.src = '/tarot/back.png';
  }, []);

  const primary = useMemo(() => profiles.find((p) => p.is_primary) ?? null, [profiles]);
  const sajuResult = useMemo<SajuResult | null>(() => primary ? computeSajuFromProfile(primary) : null, [primary]);

  // 모드 전환 시 리셋 — 보관함 재생 모드에선 리셋 금지 (저장된 결과 유지)
  useEffect(() => {
    if (isArchiveMode) return;
    setAutoState('idle');
    setAutoDrawn([]);
    setAutoSpread([]);
    setAutoSpreadReversed([]);
    setSelectedSpreadIdxs([]);
    setQState('select');
    setQSpread([]);
    setQDrawn(null);
    setQuestion('');
    setAiContent(null);
    setAiLoading(false);
    setAiError(null);
  }, [mode, isArchiveMode]);

  // 보관함 재생은 /tarot/result 로 분리됨. /tarot 은 라이브 드로잉 전용.
  // 옛 URL(/tarot?recordId=X) 호환 — 새 결과 페이지로 리다이렉트.
  useEffect(() => {
    if (recordId) router.replace(`/tarot/result?recordId=${recordId}`);
  }, [recordId, router]);

  const callAI = async (drawn: DrawnCard[], currentMode: TarotMode, userQuestion?: string) => {
    if (!sajuResult) { setShowNoPrimaryModal(true); return; }

    // 캐시 키 — 사주 + 모드 + 카드(이름·정/역) + 질문 텍스트.
    // 같은 사주가 같은 카드를 같은 질문으로 뽑으면 같은 풀이 → 재호출/재차감 없음.
    const card = drawn[0];
    const cacheKey = [
      sajuKey(sajuResult),
      currentMode,
      `${card.card.name}:${card.isReversed ? 'R' : 'U'}`,
      currentMode === 'today' ? formatTodayString() : '',
      currentMode === 'monthly' ? formatMonthString() : '',
      currentMode === 'question' ? (userQuestion || '').trim() : '',
    ].join('|');

    const cached = useReportCacheStore.getState().getReport<string>('tarot', cacheKey);
    if (cached?.error) {
      setAiError(cached.error);
      setAiContent(null);
      setAiLoading(false);
      return;
    }
    // 재진입 silent restore
    if (cached?.data) {
      setAiContent(cached.data);
      setAiError(null);
      setAiLoading(false);
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiContent(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setAiError('로그인이 만료됐어요. 다시 로그인해주세요.');
        setAiLoading(false);
        return;
      }
      const cardInfo = drawnToCardInfo(drawn[0]);
      const allCardsInfo = drawn.map(drawnToCardInfo);
      const questionMap: Record<TarotMode, string | undefined> = {
        today: undefined,
        monthly: '이달의 전체적인 흐름',
        question: userQuestion || undefined,
      };
      const prompt = generateHybridPrompt(sajuResult, cardInfo, questionMap[currentMode], currentMode, allCardsInfo);
      const spreadType = currentMode === 'today' ? 'today'
        : currentMode === 'monthly' ? 'monthly'
        : currentMode === 'question' ? 'question'
        : 'hybrid-saju';
      const cardsPayload: Record<string, unknown> = {
        mode: spreadType,
        cards: allCardsInfo,
        card: cardInfo,
      };
      const minuteBucket = Math.floor(Date.now() / 60000);
      const res = await fetch('/api/fortune/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          category: 'tarot',
          prompt,
          spreadType,
          cards: cardsPayload,
          question: questionMap[currentMode],
          idempotencyKey: `${cacheKey}:${minuteBucket}`,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setAiError(errData.error || '해석을 불러오지 못했습니다.');
        setAiLoading(false);
        return;
      }
      const { jobId } = (await res.json()) as { jobId: string };
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('jobId', jobId);
      window.history.replaceState(null, '', newUrl.toString());
      setCreatedJobId(jobId);
      // 이후 잡 동기화 useEffect 가 setAiContent·setAiLoading(false) 처리
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : '네트워크 오류가 발생했습니다.');
      setAiLoading(false);
    }
  };

  const resetAuto = () => {
    setAutoState('idle');
    setAutoDrawn([]);
    setAutoSpread([]);
    setAutoSpreadReversed([]);
    setSelectedSpreadIdxs([]);
    setAiContent(null);
    setAiError(null);
    setAiLoading(false);
  };

  // 셔플 → 팬 스프레드 (22장 펼치기)
  const startAutoShuffle = (currentMode: TarotMode) => {
    if (autoState !== 'idle') return;
    if (!sajuResult) { setShowNoPrimaryModal(true); return; }
    const pool = Array.from({ length: TAROT_DECK.length }, (_, i) => i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setAutoSpread(pool.slice(0, 22));
    setAutoSpreadReversed(Array.from({ length: 22 }, () => Math.random() < 0.35));
    setSelectedSpreadIdxs([]);
    setAutoDrawn([]);
    setAutoState('shuffling');
    setTimeout(() => setAutoState('spread'), 2500);
  };

  // 팬에서 카드 선택 — 오늘 1장, 이달 3장
  const pickAutoCard = (spreadIdx: number, currentMode: TarotMode) => {
    if (autoState !== 'spread') return;
    if (selectedSpreadIdxs.includes(spreadIdx)) return;
    const neededCount = currentMode === 'monthly' ? 3 : 1;
    if (selectedSpreadIdxs.length >= neededCount) return;

    const newSelected = [...selectedSpreadIdxs, spreadIdx];
    setSelectedSpreadIdxs(newSelected);

    if (newSelected.length >= neededCount) {
      const positions = currentMode === 'monthly' ? ['상순', '중순', '하순'] : ['오늘'];
      const drawn: DrawnCard[] = newSelected.map((sIdx, i) => ({
        card: TAROT_DECK[autoSpread[sIdx]],
        isReversed: autoSpreadReversed[sIdx],
        position: positions[i],
      }));
      setAutoDrawn(drawn);
      setAutoState('revealed');
      const aiDelay = currentMode === 'monthly' ? 1400 : 950;
      setTimeout(() => callAI(drawn, currentMode), aiDelay);
    }
  };

  const shuffleForQuestion = () => {
    if (!sajuResult) { setShowNoPrimaryModal(true); return; }
    setQState('shuffling');
    const indices = Array.from({ length: TAROT_DECK.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setQSpread(indices.slice(0, 22));
    setTimeout(() => setQState('spread'), 1200);
  };

  const pickQuestionCard = (idxInSpread: number) => {
    if (qState !== 'spread') return;
    const cardIndex = qSpread[idxInSpread];
    const reversed = Math.random() < 0.35;
    const drawn: DrawnCard = { card: TAROT_DECK[cardIndex], isReversed: reversed, position: '질문' };
    setQDrawn(drawn);
    setQState('revealed');
    setTimeout(() => callAI([drawn], 'question', question), 1100);
  };

  const reading = useMemo(() => {
    if (mode === 'today' && autoDrawn.length === 1) return buildTarotReading(autoDrawn, 'single');
    if (mode === 'monthly' && autoDrawn.length === 3) return buildTarotReading(autoDrawn, 'three');
    if (mode === 'question' && qDrawn) return buildTarotReading([qDrawn], 'question');
    return null;
  }, [mode, autoDrawn, qDrawn]);

  const primaryColor = useMemo(() => {
    const first = autoDrawn[0]?.card ?? qDrawn?.card;
    return first ? ELEMENT_COLORS[first.element] : '#C4B5FD';
  }, [autoDrawn, qDrawn]);

  const modeLabels: Record<TarotMode, string> = { today: '오늘의 타로', monthly: '이달의 타로', question: '질문 타로' };

  return (
    <div className="w-full px-4 pt-4 pb-10">
      {showNoPrimaryModal && <NoPrimaryModal onClose={() => setShowNoPrimaryModal(false)} />}

      {/* 헤더 — 메인 페이지라 뒤로가기 없음. 타이틀 + 우측 차감 안내 */}
      <div className="flex items-center mb-4 relative">
        <div className="flex-1 text-center">
          <h1 className="text-[22px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-title)', letterSpacing: '-0.01em' }}>타로 상담</h1>
          <p className="text-[15px] text-text-tertiary mt-1">78장 라이더-웨이트 풀덱 · 전문 타로인의 노하우 기반</p>
        </div>
        <span className="absolute right-2 top-1 text-[12px] text-text-tertiary">🌙 1개 소모</span>
      </div>

      {/* 모드 탭 */}
      <div className="flex gap-1 max-w-[520px] mx-auto mb-4 p-1 rounded-xl bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        {(['today', 'monthly', 'question'] as TarotMode[]).map(m => {
          const active = mode === m;
          return (
            <button key={m} onClick={() => setMode(m)}
              className="flex-1 py-2.5 rounded-lg text-[15px] transition-colors"
              style={{ fontWeight: active ? 700 : 500, background: active ? 'var(--cta-primary)' : 'transparent', color: active ? '#fff' : 'var(--text-tertiary)' }}>
              {modeLabels[m]}
            </button>
          );
        })}
      </div>

      <div className="max-w-[640px] mx-auto">

        {/* ── 오늘 / 이달 ── */}
        {(mode === 'today' || mode === 'monthly') && (
          <AnimatePresence mode="wait">
            {autoState === 'idle' && (
              <motion.div key="idle" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-2xl p-6 text-center bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
                <p className="text-[15px] text-text-tertiary mb-2">
                  {mode === 'today' ? formatTodayString() : formatMonthString()}
                </p>
                <p className="text-[16px] text-text-secondary leading-relaxed mb-5">
                  {mode === 'today'
                    ? '카드를 섞고, 마음이 끌리는 한 장을 직접 선택하세요.'
                    : '카드를 섞고, 이달을 담을 세 장을 순서대로 직접 선택하세요.'}
                </p>
                <motion.button
                  onClick={() => startAutoShuffle(mode)}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  className="px-6 py-3 rounded-xl font-bold text-white"
                  style={{ background: 'var(--cta-primary)', boxShadow: '0 4px 16px rgba(124,92,252,0.35)' }}>
                  {mode === 'today' ? '카드 섞고 펼치기' : '카드 섞고 펼치기'}
                </motion.button>
              </motion.div>
            )}

            {(autoState === 'shuffling' || autoState === 'spread') && (
              <motion.div key="shuffle-spread" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {(() => {
                  const neededCount = mode === 'monthly' ? 3 : 1;
                  const remaining = neededCount - selectedSpreadIdxs.length;
                  const positions = mode === 'monthly' ? ['상순', '중순', '하순'] : ['오늘'];
                  const isShuffling = autoState === 'shuffling';
                  return (
                    <div className="relative flex justify-center items-center flex-wrap gap-1" style={{ minHeight: 220, marginTop: 40 }}>
                      {autoSpread.map((_, i) => {
                        const isSelected = selectedSpreadIdxs.includes(i);
                        const selectedOrder = selectedSpreadIdxs.indexOf(i);
                        return (
                          <motion.div
                            key={i}
                            onClick={() => !isShuffling && pickAutoCard(i, mode)}
                            whileHover={!isShuffling && !isSelected ? { y: 28, scale: 1.13, zIndex: 50 } : {}}
                            initial={{ x: 0, y: 0, rotate: 0 }}
                            animate={
                              isShuffling
                                ? { x: (Math.random() - 0.5) * 300, y: (Math.random() - 0.5) * 140, rotate: (Math.random() - 0.5) * 60 }
                                : { x: (i - 10.5) * 14, y: Math.sin((i - 10.5) * 0.3) * 18, rotate: (i - 10.5) * 2 }
                            }
                            transition={{ duration: 0.5, delay: i * 0.02 }}
                            className="absolute"
                            style={{
                              width: 58, height: 92, borderRadius: 8, overflow: 'hidden',
                              boxShadow: isSelected ? '0 0 14px rgba(124,92,252,0.9)' : '0 3px 10px rgba(0,0,0,0.4)',
                              border: `2px solid ${isSelected ? 'rgba(124,92,252,1)' : 'rgba(124,92,252,0.5)'}`,
                              cursor: isShuffling || isSelected ? 'default' : 'pointer',
                              backgroundColor: '#2a1660',
                            }}
                          >
                            <img src="/tarot/back.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                            {isSelected && (
                              <div style={{
                                position: 'absolute', inset: 0,
                                background: 'rgba(124,92,252,0.78)',
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                gap: 3,
                              }}>
                                <span style={{ fontSize: 15, color: '#fff' }}>✓</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{positions[selectedOrder]}</span>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                      {!isShuffling && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                          className="absolute -bottom-10 w-full text-center text-[14px] text-text-tertiary">
                          {remaining > 0
                            ? (mode === 'today' ? '마음이 끌리는 카드를 선택하세요' : `마음이 끌리는 카드를 ${remaining}장 더 선택하세요`)
                            : '카드를 확인하는 중...'}
                        </motion.p>
                      )}
                    </div>
                  );
                })()}
              </motion.div>
            )}

            {autoState === 'revealed' && (
              <motion.div key="revealed" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex justify-center gap-4 flex-wrap mb-6">
                  {autoDrawn.map((d, i) => (
                    <FlipCard
                      key={i}
                      drawn={d}
                      width={mode === 'monthly' ? 98 : 145}
                      shouldFlip={true}
                      flipDelay={i * 0.28}
                    />
                  ))}
                </div>
                {aiLoading && !aiContent && <LoadingSpinner startedAt={fortuneJob?.startedAt} />}
                {aiError && (
                  <div className="rounded-2xl p-4 text-center bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.3)]">
                    <p className="text-[15px] text-[#F87171] mb-3">{aiError}</p>
                    <button onClick={() => callAI(autoDrawn, mode)} className="text-[14px] text-text-secondary underline">다시 시도</button>
                  </div>
                )}
                {aiContent && <AIReadingView content={aiContent} color={primaryColor} />}
                <button onClick={resetAuto}
                  className="w-full mt-4 py-3 rounded-xl border border-[var(--border-subtle)] text-[15px] text-text-secondary">
                  다시 펼치기
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* ── 질문 모드 ── */}
        {mode === 'question' && (
          <>
            {qState === 'select' && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl p-6 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
                <p className="text-[16px] text-text-secondary leading-relaxed mb-4 text-center">
                  마음속 질문을 적고, 카드를 섞어 직접 선택하세요.<br />
                  사주와 카드를 함께 읽어 깊은 풀이를 드립니다.
                </p>
                <div className="mb-5">
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="예: 이직을 해도 될까요? / 이 사람과 계속 만나야 할까요?"
                    maxLength={80}
                    rows={2}
                    className="w-full rounded-xl px-4 py-3 text-[15px] text-text-primary resize-none outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid var(--border-subtle)',
                      lineHeight: 1.6,
                    }}
                  />
                  <div className="text-right text-[13px] text-text-tertiary mt-1">{question.length}/80</div>
                </div>
                <motion.button onClick={shuffleForQuestion}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  className="w-full py-3 rounded-xl font-bold text-white"
                  style={{ background: 'var(--cta-primary)', boxShadow: '0 4px 16px rgba(124,92,252,0.35)' }}>
                  카드 섞고 펼치기
                </motion.button>
              </motion.div>
            )}

            {(qState === 'shuffling' || qState === 'spread') && (
              <div className="relative flex justify-center items-center flex-wrap gap-1" style={{ minHeight: 220, marginTop: 40 }}>
                {(qState === 'shuffling' ? Array.from({ length: 22 }) : qSpread).map((_, i) => (
                  <motion.div
                    key={i}
                    onClick={() => pickQuestionCard(i)}
                    whileHover={qState === 'spread' ? { y: 28, scale: 1.13, zIndex: 50 } : {}}
                    initial={{ x: 0, y: 0, rotate: 0 }}
                    animate={
                      qState === 'spread'
                        ? { x: (i - 10.5) * 14, y: Math.sin((i - 10.5) * 0.3) * 18, rotate: (i - 10.5) * 2 }
                        : { x: (Math.random() - 0.5) * 300, y: (Math.random() - 0.5) * 140, rotate: (Math.random() - 0.5) * 60 }
                    }
                    transition={{ duration: 0.5, delay: i * 0.02 }}
                    className="absolute cursor-pointer"
                    style={{ width: 58, height: 92, borderRadius: 8, overflow: 'hidden',
                      boxShadow: '0 3px 10px rgba(0,0,0,0.4)', border: '2px solid rgba(124,92,252,0.5)',
                      backgroundColor: '#2a1660' }}
                  >
                    <img src="/tarot/back.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  </motion.div>
                ))}
                {qState === 'spread' && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                    className="absolute -bottom-10 w-full text-center text-[14px] text-text-tertiary">
                    마음이 끌리는 카드를 선택하세요
                  </motion.p>
                )}
              </div>
            )}

            {qState === 'revealed' && qDrawn && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex justify-center mb-6">
                  <FlipCard drawn={qDrawn} width={160} shouldFlip={true} flipDelay={0.15} />
                </div>
                {aiLoading && !aiContent && <LoadingSpinner startedAt={fortuneJob?.startedAt} />}
                {aiError && (
                  <div className="rounded-2xl p-4 text-center bg-[rgba(248,113,113,0.1)] border border-[rgba(248,113,113,0.3)]">
                    <p className="text-[15px] text-[#F87171] mb-3">{aiError}</p>
                    <button onClick={() => callAI([qDrawn], 'question', question)} className="text-[14px] text-text-secondary underline">다시 시도</button>
                  </div>
                )}
                {aiContent && <AIReadingView content={aiContent} color={primaryColor} />}
                <button
                  onClick={() => { setQState('select'); setQDrawn(null); setQSpread([]); setAiContent(null); setAiError(null); }}
                  className="w-full mt-4 py-3 rounded-xl border border-[var(--border-subtle)] text-[15px] text-text-secondary">
                  다른 질문 · 다시 뽑기
                </button>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
