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

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue, useSpring, useMotionTemplate, animate } from 'framer-motion';
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
/** 공개 화면 대형 신령패 전용 고해상 카드백 (작은 카드들은 소형본으로 성능 우선) */
const BACK_LG = "url('/manshin/back.png')";

/** 공용 카드 프레임 오버레이 (중앙 투명 펀칭 PNG — 전 카드 물리 동일 보장) */
const FRAME_SRC = '/manshin/frame.png';

/** 확정 엽전패 일러스트 6종 (2026-07-10) — 카드 id → 이미지 */
const COIN_IMAGES: Record<string, string> = {
  yeopjeon1: '/manshin/coins/y1.jpg',
  yeopjeon2: '/manshin/coins/y2.jpg',
  yeopjeon3: '/manshin/coins/y3.jpg',
  yeopjeon4: '/manshin/coins/y4.jpg',
  yeopjeon5: '/manshin/coins/y5.jpg',
  yeopjeon6: '/manshin/coins/y6.jpg',
};

/** 확정 풍습패 일러스트 — 카드 id → 이미지 (1호 혼례 2026-07-12, 후처리: 4% 크롭+얼룩 청소) */
const CUSTOM_IMAGES: Record<string, string> = {
  honrye: '/manshin/customs/honrye.jpg',
};

// 안내 문구도 전부 공수체로 통일 (일반 안내투 금지)
const STEP_META: { key: 'deity' | 'custom' | 'coin'; label: string; guide: string; fan: number }[] = [
  { key: 'deity', label: '신령패', guide: '오늘 너를 봐줄 신령부터 모시거라', fan: 12 },
  { key: 'custom', label: '풍습패', guide: '네 앞에 펼쳐질 장면을 짚어 보거라', fan: 12 },
  { key: 'coin', label: '엽전패', guide: '엽전을 던져 때를 물어 보거라', fan: 6 },
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

/**
 * 공수 강조 2단계 렌더 — ==핵심==(1차: 빨강) / **중요**(2차: 노랑).
 * 서버 프롬프트의 강조 규칙과 짝. 짝이 안 맞는 홑 마커는 텍스트 그대로 둔다.
 */
const MANSHIN_EMPHASIS_RE = /==([^=]+?)==|\*\*([^*]+?)\*\*/g;
function renderManshinEmphasis(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(MANSHIN_EMPHASIS_RE.source, 'g');
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      nodes.push(
        <strong key={`em1-${match.index}`} style={{ color: '#ff5f5f', fontWeight: 700 }}>
          {match[1]}
        </strong>,
      );
    } else {
      nodes.push(
        <strong key={`em2-${match.index}`} style={{ color: '#ffd54a', fontWeight: 700 }}>
          {match[2]}
        </strong>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.length > 0 ? nodes : [text];
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

/**
 * 스크롤 연동 문장 — 읽는 지점(뷰포트 65% 높이)에 오면 선명, 그 아래는 흐릿.
 * whileInView(1회성)가 아니라 스크롤 위치에 "연속" 연동: 내리는 만큼 점점 밝아진다.
 * (opacity/transform 만 변경 — 리렌더 없이 스타일만 갱신되어 모바일에서도 60fps)
 */
function RevealLine({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLParagraphElement>(null);
  // 뷰포트 통과 전 구간을 비율로 추적: 0 = 문장이 화면 하단 진입, 1 = 화면 상단 이탈.
  // 가운데(읽는 눈높이, 40~62% 구간)만 또렷하고 위아래는 흐릿 — 데스크톱/모바일 공통 비율 기준.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start start'] });
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.22, 0.38, 0.62, 0.82, 1],
    [0.1, 0.3, 1, 1, 0.28, 0.12],
  );
  const y = useTransform(scrollYProgress, [0, 0.38], [10, 0]);
  return (
    <motion.p ref={ref} style={{ opacity, y, willChange: 'transform, opacity', ...style }} className={className}>
      {children}
    </motion.p>
  );
}

/**
 * 세 패 요약 카드 — 삼각 배치(상단 신령패 大, 하단 풍습·엽전 2장)용.
 * 일러스트 전이라 카드백(삼태극) 텍스처 + 어둡게 깔고 이름만 크게. 일러스트 나오면 imageSrc 로 교체.
 * 캡션(title·domains)은 카드 아래 중앙 정렬 — 덱 전수분석상 title 최장 21자라 카드 내부엔 넣지 않는다.
 */
function SummaryPatCard({ label, card, imageSrc, large }: { label: string; card: ManshinCard; imageSrc?: string; large?: boolean }) {
  const color = MANSHIN_GROUP_COLORS[card.group];
  const src = imageSrc ?? COIN_IMAGES[card.id] ?? CUSTOM_IMAGES[card.id]; // 엽전·풍습패는 확정 일러스트 자동 매칭
  return (
    <div className={large ? 'w-[229px]' : 'w-full max-w-[203px]'}>
      <div
        className="relative aspect-[2/3] rounded-xl overflow-hidden"
        style={{ boxShadow: `0 6px 24px ${color}22` }}
      >
        {src ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={card.name} draggable={false} className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none [-webkit-touch-callout:none]" />
            <div className="absolute inset-x-0 bottom-0 h-2/5" style={{ background: 'linear-gradient(180deg, transparent, rgba(10,6,20,0.9))' }} />
          </>
        ) : (
          <>
            <div className="absolute inset-0" style={{ backgroundImage: BACK_SM, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 22%, ${color}30, rgba(10,6,20,0.78))` }} />
          </>
        )}
        {/* 공용 프레임 오버레이 — 일러스트 카드에만 (카드백은 자체 테두리 보유, 이중 테두리 방지) */}
        {src && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={FRAME_SRC} alt="" aria-hidden className="absolute inset-0 w-full h-full z-20 pointer-events-none select-none [-webkit-touch-callout:none]" />
        )}
        {/* 한자 인장 뱃지는 제거 (2026-07-13) — 하단 한글 카드명과 정보 중복 */}
        <div className="absolute top-2.5 inset-x-0 flex justify-center z-30">
          <span
            className="text-[12.5px] font-semibold tracking-[0.14em] px-2.5 py-0.5 rounded-full border"
            style={{ background: 'rgba(10,6,20,0.6)', color, borderColor: `${color}55` }}
          >
            {label}
          </span>
        </div>
        <div
          className={`absolute inset-x-0 z-30 text-center font-bold text-text-primary px-2 leading-tight ${
            src ? 'bottom-[11%]' : 'top-1/2 -translate-y-1/2'
          } ${large ? 'text-[22px]' : 'text-[18px]'}`}
          style={{ fontFamily: 'var(--font-title)', textShadow: '0 2px 10px rgba(10,6,20,0.8)' }}
        >
          {card.name}
        </div>
      </div>
      <div className={`mt-2 text-center text-text-secondary leading-snug ${large ? 'text-[14.5px]' : 'text-[13px]'}`}>{card.title}</div>
      <div className="mt-1 text-center text-[12.5px] leading-snug" style={{ color: `${color}dd` }}>
        {card.domains}
      </div>
    </div>
  );
}

/**
 * 신령패 홀드-투-리빌 — "카드에 손을 얹고 기원한다"는 무속 서사와 일치하는 유보 공개.
 * 길게 누르는 동안 글로우가 차오르고(anticipation), 완충되면 onReveal.
 * 성능: 글로우/밝기 전부 transform·opacity 만 애니메이션 (box-shadow/filter 금지 원칙 유지)
 */
const HOLD_MS = 1100;
function DeityHoldReveal({ onReveal }: { onReveal: () => void }) {
  const [charging, setCharging] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = () => {
    if (holdTimer.current) return;
    setCharging(true);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      // 완충 햅틱 — 지원 기기(안드로이드)만, 미지원은 조용히 무시
      try { navigator.vibrate?.(35); } catch { /* noop */ }
      onReveal();
    }, HOLD_MS);
  };
  const cancel = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    setCharging(false);
  };
  useEffect(() => () => { if (holdTimer.current) clearTimeout(holdTimer.current); }, []);
  return (
    <div className="relative flex flex-col items-center">
      <div className="relative w-[min(343px,80vw)]">
        {/* 차오르는 기운 — 대기 중엔 은은한 펄스, 누르는 동안 HOLD_MS 에 맞춰 차오름 */}
        <motion.div
          className="absolute -inset-6 rounded-[30px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(201,166,255,0.5), transparent 70%)', willChange: 'transform, opacity' }}
          animate={charging ? { opacity: 1, scale: 1.12 } : { opacity: [0.16, 0.38, 0.16], scale: 1 }}
          transition={charging ? { duration: HOLD_MS / 1000, ease: 'easeIn' } : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.button
          type="button"
          onPointerDown={start}
          onPointerUp={cancel}
          onPointerLeave={cancel}
          onPointerCancel={cancel}
          onContextMenu={(e) => e.preventDefault()}
          className="relative block w-full aspect-[2/3] rounded-xl overflow-hidden select-none"
          style={{ WebkitTouchCallout: 'none', touchAction: 'manipulation', willChange: 'transform' }}
          animate={charging ? { scale: 1.045 } : { scale: 1 }}
          transition={charging ? { duration: HOLD_MS / 1000, ease: 'easeOut' } : { type: 'spring', stiffness: 300, damping: 22 }}
          aria-label="신령패 공개 — 길게 누르기"
        >
          <div className="absolute inset-0" style={{ backgroundImage: BACK_LG, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          {/* 누르는 동안 카드가 안쪽부터 밝아짐 */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 50% 45%, rgba(255,245,225,0.55), transparent 75%)' }}
            animate={{ opacity: charging ? 0.6 : 0 }}
            transition={{ duration: charging ? HOLD_MS / 1000 : 0.25, ease: 'easeIn' }}
          />
          <div className="absolute top-3 inset-x-0 flex justify-center">
            <span
              className="text-[13px] font-semibold tracking-[0.14em] px-3 py-1 rounded-full border"
              style={{ background: 'rgba(10,6,20,0.6)', color: '#c9a6ff', borderColor: 'rgba(201,166,255,0.4)' }}
            >
              신령패
            </span>
          </div>
        </motion.button>
      </div>
      <motion.p
        className="mt-4 text-[15px] text-text-secondary text-center"
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {charging ? '신령이 다가오고 있느니라' : '카드에 손을 얹고 지그시 누르고 있거라'}
      </motion.p>
    </div>
  );
}

/**
 * 3D 틸트 + 흐르는 광택 (Spline interactive cards 참고)
 * - 아이들 오토 모션: 스스로 은은하게 일렁이고 광택이 주기적으로 쓸고 지나감
 *   (모바일은 hover 가 없고 터치 드래그는 스크롤과 충돌 — pan-y 에선 pointercancel 로 즉시 리셋되므로
 *    "살아있는 카드" 루프가 모바일의 기본 경험. Balatro 방식)
 * - 포인터가 닿으면 아이들을 멈추고 추적 틸트로 전환, 떼면 아이들 재개
 * - MotionValue 직결(리렌더 0) + 스프링. glare 는 translate 이동 — 전부 transform/opacity (GPU 합성)
 */
function TiltGlareCard({ className, children }: { className?: string; children: ReactNode }) {
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const active = useMotionValue(0);
  const sp = { stiffness: 160, damping: 18, mass: 0.6 };
  const rotateX = useSpring(useTransform(py, [0, 1], [8, -8]), sp);
  const rotateY = useSpring(useTransform(px, [0, 1], [-12, 12]), sp);
  const glareX = useSpring(useTransform(px, [0, 1], [-28, 28]), sp);
  const glareY = useSpring(useTransform(py, [0, 1], [-28, 28]), sp);
  const glareOpacity = useSpring(active, { stiffness: 120, damping: 22 });
  const glareTransform = useMotionTemplate`translate(${glareX}%, ${glareY}%)`;

  // 아이들 루프 — 포인터와 같은 px/py 를 구동해 틸트·광택이 한 체계로 움직인다
  const idleControls = useRef<{ stop: () => void }[]>([]);
  const stopIdle = () => { idleControls.current.forEach((c) => c.stop()); idleControls.current = []; };
  const startIdle = () => {
    stopIdle();
    idleControls.current = [
      animate(px, [0.5, 0.84, 0.2, 0.74, 0.5], { duration: 7, repeat: Infinity, ease: 'easeInOut' }),
      animate(py, [0.5, 0.28, 0.7, 0.36, 0.5], { duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }),
      animate(active, [0.24, 0.46, 0.24], { duration: 3.5, repeat: Infinity, ease: 'easeInOut' }),
    ];
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 아이들 루프는 마운트 시 1회 시작
  useEffect(() => { startIdle(); return stopIdle; }, []);

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    stopIdle();
    const rect = e.currentTarget.getBoundingClientRect();
    px.set(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
    py.set(Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)));
    active.set(0.5);
  };
  const reset = () => { px.set(0.5); py.set(0.5); active.set(0); startIdle(); };

  return (
    <motion.div
      onPointerMove={move}
      onPointerLeave={reset}
      onPointerCancel={reset}
      onPointerUp={reset}
      onContextMenu={(e) => e.preventDefault()}
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 800, touchAction: 'pan-y', willChange: 'transform' }}
    >
      {children}
      {/* 광택 — 카드보다 크게 깔고 translate 로만 이동 (배경 위치 애니메이션 금지 원칙) */}
      <motion.div
        aria-hidden
        className="absolute -inset-[35%] z-40 pointer-events-none rounded-full"
        style={{
          transform: glareTransform,
          opacity: glareOpacity,
          background: 'radial-gradient(circle, rgba(255,245,225,0.4), rgba(201,166,255,0.12) 45%, transparent 68%)',
          willChange: 'transform, opacity',
        }}
      />
    </motion.div>
  );
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
  // 유보 리빌: 풍습·엽전은 바로 보여주고 신령패는 홀드-투-리빌로 마지막에 공개
  const [deityRevealed, setDeityRevealed] = useState(false);
  const [burst, setBurst] = useState(false);
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
    setDeityRevealed(true); // 재진입은 이미 본 결과 — 홀드 의식 생략
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
    setDeityRevealed(false);
    setBurst(false);
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
    setDeityRevealed(false);
    setBurst(false);
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
                className="relative w-[156px] aspect-[2/3]"
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
              <div className="text-[16px] font-semibold text-text-primary mb-3">세 개의 패를 뽑느니라</div>
              <div className="space-y-2">
                {STEP_META.map((m, i) => (
                  <div key={m.key} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-[14.5px] font-bold text-cta">{m.label}</span>
                    <span className="text-[14.5px] text-text-tertiary">
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

        {/* ── 스파이럴 오빗 셔플: 덱이 원형으로 피어났다 소용돌이치며 다시 모인다 ──
             (수학 곡선 키프레임 + linear 타이밍 = 구간 꺾임 없는 완전히 매끄러운 궤적,
              transform-only, 20ms 스태거) */}
        {phase === 'shuffle' && (
          <motion.div
            key="shuffle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative h-[400px] flex items-center justify-center"
          >
            {/* 중심에서 번지는 기운 */}
            <motion.div
              className="absolute w-[280px] h-[280px] rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(201,166,255,0.22), transparent 70%)', willChange: 'transform, opacity' }}
              animate={{ scale: [0.7, 1.15, 0.75], opacity: [0.3, 0.85, 0.4] }}
              transition={{ duration: 2.4, ease: 'easeInOut' }}
            />
            {Array.from({ length: 8 }).map((_, i) => {
              // 카드 i 의 나선 궤적: 반지름 r(t)=R·sin(πt) — 스택에서 피어나 궤도를 돌고 다시 스택으로
              const STEPS = 15;
              const phase0 = (i / 8) * Math.PI * 2;
              const xs: number[] = [];
              const ys: number[] = [];
              const rots: number[] = [];
              for (let k = 0; k < STEPS; k++) {
                const t = k / (STEPS - 1);
                const bloom = Math.sin(Math.PI * t); // 0 → 1 → 0
                const ang = phase0 + Math.PI * 3.2 * t; // 약 1.6바퀴 공전
                const r = 104 * bloom;
                xs.push(Math.cos(ang) * r);
                ys.push(Math.sin(ang) * r * 0.58); // 타원 궤도 — 살짝 눕힌 3D 느낌
                rots.push(Math.sin(ang) * 10 * bloom); // 궤도 따라 기우는 카드
              }
              return (
                <motion.div
                  key={i}
                  className="absolute w-[120px] aspect-[2/3] rounded-lg border border-[rgba(201,166,255,0.35)]"
                  style={{
                    backgroundImage: BACK_SM,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    zIndex: i,
                    willChange: 'transform',
                  }}
                  animate={{ x: xs, y: ys, rotate: rots }}
                  transition={{ duration: 2.3, ease: 'linear', delay: i * 0.02 }}
                />
              );
            })}
            <motion.p
              className="absolute bottom-1 text-[14px] text-text-secondary tracking-wide"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              괘를 섞고 있느니라
            </motion.p>
          </motion.div>
        )}

        {/* ── 뽑기: 3단계 부채꼴 (신령 → 풍습 → 엽전) ──
             한 화면 맞춤: 세로 플렉스 + dvh 기반 높이 — 스크롤 없이 안내/부채꼴/버튼이
             균등한 리듬으로 배치 (부채꼴이 남는 공간을 흡수) */}
        {phase === 'pick' && (
          <motion.div
            key="pick"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col"
            style={{ height: 'calc(100dvh - 252px)', minHeight: 520 }}
          >
            {/* 진행 표시 — 연결선으로 이어진 세 패 여정 */}
            <div className="flex items-center justify-center mb-4">
              {STEP_META.map((m, i) => {
                const done = !!selected[m.key];
                const active = i === step;
                return (
                  <div key={m.key} className="flex items-center shrink-0">
                    {i > 0 && (
                      <div
                        className="w-4 h-px mx-1 shrink-0"
                        style={{
                          background: done || active
                            ? 'linear-gradient(90deg, rgba(232,164,144,0.6), rgba(201,166,255,0.4))'
                            : 'var(--border-subtle)',
                        }}
                      />
                    )}
                    {/* whitespace-nowrap — "신령패 · 남이 장군" 같은 라벨이 중간에서 꺾이지 않게 */}
                    <motion.div
                      animate={active ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                      transition={active ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : undefined}
                      className={`px-3.5 py-2 rounded-full text-[13.5px] font-semibold border whitespace-nowrap transition-colors ${
                        done
                          ? 'border-cta/60 text-cta bg-cta/10'
                          : active
                            ? 'border-[rgba(201,166,255,0.65)] text-text-primary bg-[rgba(201,166,255,0.12)] shadow-[0_0_16px_rgba(201,166,255,0.25)]'
                            : 'border-[var(--border-subtle)] text-text-tertiary'
                      }`}
                    >
                      {m.label}
                      {done ? `·${selected[m.key]!.name}` : ''}
                    </motion.div>
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
                  {/* 장식 문양 — 회전 마름모 + 양옆 라인 */}
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="w-10 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(232,164,144,0.5))' }} />
                    <motion.span
                      className="block w-2 h-2 rotate-45 bg-cta/70"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <div className="w-10 h-px" style={{ background: 'linear-gradient(90deg, rgba(232,164,144,0.5), transparent)' }} />
                  </div>
                  <p
                    className="text-[22px] text-text-primary leading-[1.65] tracking-[0.01em]"
                    style={{ fontFamily: 'var(--font-serif)' }}
                  >
                    마음속에 묻고 싶은 것을
                    <br />
                    하나 품어 보거라
                  </p>
                  <motion.p
                    className="text-[14.5px] text-text-tertiary mt-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.1, duration: 0.8 }}
                  >
                    품었거든, {STEP_META[0].guide}
                  </motion.p>
                </motion.div>
              ) : (
                <motion.div
                  key={`guide-${step}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="text-center mb-1"
                >
                  <div className="flex items-center justify-center gap-3 mb-3">
                    <div className="w-10 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(232,164,144,0.5))' }} />
                    <span className="block w-1.5 h-1.5 rotate-45 bg-cta/70" />
                    <div className="w-10 h-px" style={{ background: 'linear-gradient(90deg, rgba(232,164,144,0.5), transparent)' }} />
                  </div>
                  <p className="text-[20px] text-text-primary leading-relaxed" style={{ fontFamily: 'var(--font-serif)' }}>
                    {STEP_META[step].guide}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 부채꼴 — 단계별로 새로 펼침. flex-1 로 남는 공간을 채워 세로 중심 배치 */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`fan-${step}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3 }}
                className="relative flex-1 min-h-[330px]"
              >
                {pools[STEP_META[step].key].slice(0, STEP_META[step].fan).map((_, idx) => {
                  const fanCount = Math.min(pools[STEP_META[step].key].length, STEP_META[step].fan);
                  // 1.3배 카드에 맞춰 각도 축소 — 375px 폭에서도 부채 끝이 잘리지 않는 값
                  const stepDeg = fanCount > 8 ? 6 : 9;
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
                      // 모바일(hover 없음)에선 탭이 유일한 피드백 — 살짝 들어올리며 응답
                      whileTap={{ scale: 1.04, y: isPicked ? -26 : -14 }}
                      onClick={() => pickCard(idx)}
                      className={`absolute left-1/2 bottom-10 w-[120px] aspect-[2/3] -ml-[60px] rounded-lg border ${
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
              className="w-full py-3 mt-4 shrink-0 rounded-xl bg-white/5 border border-[var(--border-subtle)] text-[13.5px] text-text-tertiary"
            >
              처음으로
            </button>
          </motion.div>
        )}

        {/* ── 공개: 세 패 + 신령의 단일 공수 ── */}
        {phase === 'reveal' && deity && selected.custom && selected.coin && (
          <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            {/* 세 패 요약 — 풍습·엽전 2장만 (신령패는 아래 공수 카드의 대형 카드로 표시, 중복 제거) */}
            <div className="flex justify-center gap-4">
              {(['custom', 'coin'] as const).map((key, i) => (
                <motion.div
                  key={key}
                  className="flex-1 max-w-[203px]"
                  initial={{ rotateY: 100, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  transition={{ delay: i * 0.25, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformPerspective: 700 }}
                >
                  <SummaryPatCard label={key === 'custom' ? '풍습패' : '엽전패'} card={selected[key]!} />
                </motion.div>
              ))}
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
                  // 공개 전엔 신령의 기운(색)을 누설하지 않는다 — 중립 라벤더 유지
                  background: deityRevealed
                    ? `radial-gradient(circle at 50% 20%, ${deityColor}33, rgba(20,12,38,0.2)), linear-gradient(180deg, ${deityColor}22, transparent)`
                    : 'radial-gradient(circle at 50% 20%, rgba(201,166,255,0.18), rgba(20,12,38,0.2))',
                }}
              >
                <Sparkles color={deityRevealed ? deityColor : '#c9a6ff'} />
                <motion.div
                  className="absolute w-[230px] h-[230px] rounded-full pointer-events-none"
                  style={{
                    background: `radial-gradient(circle, ${deityRevealed ? deityColor : '#c9a6ff'}2e, transparent 70%)`,
                    willChange: 'transform, opacity',
                  }}
                  animate={{ scale: [1, 1.22, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
                />
                {/* 공개 순간 글로우 버스트 — 1회성, transform/opacity 만 */}
                {burst && (
                  <motion.div
                    className="absolute w-[300px] h-[300px] rounded-full pointer-events-none z-10"
                    style={{ background: `radial-gradient(circle, ${deityColor}66, transparent 60%)`, willChange: 'transform, opacity' }}
                    initial={{ scale: 0.2, opacity: 0.95 }}
                    animate={{ scale: 3, opacity: 0 }}
                    transition={{ duration: 0.65, ease: 'easeOut' }}
                    onAnimationComplete={() => setBurst(false)}
                  />
                )}
                {/* 신령패 라벨은 카드 위가 아닌 여기(카드 밖)에 — 캐릭터 모자/머리 가림 방지 */}
                <div className="text-[15px] tracking-[0.22em] mb-3 relative" style={{ color: deityRevealed ? deityColor : '#c9a6ff' }}>
                  {deityRevealed ? `신령패 · ${deity.group} · 제${deity.no}패` : '마지막 패가 남았느니라'}
                </div>
                {!deityRevealed ? (
                  /* 유보 리빌 — 신령패는 손을 얹고 기원해야 모습을 드러낸다 */
                  <DeityHoldReveal onReveal={() => { setBurst(true); setDeityRevealed(true); }} />
                ) : (
                  <>
                    {/* 신령패 대형 카드 — 진입 플립(외부) + 터치 틸트/광택(내부) 분리 */}
                    <motion.div
                      initial={{ opacity: 0, rotateY: 100, scale: 0.92 }}
                      animate={{ opacity: 1, rotateY: 0, scale: [0.92, 1.05, 1] }}
                      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                      style={{ transformPerspective: 900, willChange: 'transform, opacity' }}
                      className="relative w-[min(343px,80vw)] mb-4"
                    >
                      <TiltGlareCard className="relative w-full aspect-[2/3] rounded-xl overflow-hidden">
                        {/* 카드백 플레이스홀더 — 자체 테두리가 있어 프레임 오버레이 미적용 (일러스트 교체 시 FRAME_SRC 적용)
                            대형 카드라 고해상본(BACK_LG) 사용 — 소형본은 이 크기에서 뭉개짐 */}
                        <div className="absolute inset-0" style={{ backgroundImage: BACK_LG, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                        <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 22%, ${deityColor}30, rgba(10,6,20,0.72))` }} />
                        <div className="absolute bottom-4 inset-x-0 text-center text-[12px] text-[rgba(255,245,225,0.4)] z-30">
                          일러스트 준비 중
                        </div>
                      </TiltGlareCard>
                    </motion.div>
                    <div className="text-[32px] font-bold text-text-primary leading-tight text-center relative" style={{ fontFamily: 'var(--font-title)' }}>
                      {deity.name}
                    </div>
                    <div className="text-[15.5px] text-text-secondary mt-1.5 text-center relative">{deity.title}</div>
                    <div className="text-[14px] text-text-tertiary mt-2.5 text-center relative">
                      {selected.custom.name}의 장면에 {selected.coin.name}을 얹어 공수를 내립니다
                    </div>
                  </>
                )}
              </div>

              {deityRevealed && (
              <div className="px-5 py-5">
                {/* 신령 소개 — 설화 기반 lore (신령부 전원 보유) */}
                {deity.lore && (
                  <div className="mb-4 rounded-xl px-4 py-3 bg-white/[0.04] border border-[var(--border-subtle)]">
                    <div className="text-[13px] tracking-[0.18em] text-text-tertiary mb-1.5">이 신령은</div>
                    <p className="text-[15px] text-text-secondary leading-[1.8]">{deity.lore}</p>
                  </div>
                )}
                <div className="mb-4">
                  <div className="text-[13.5px] tracking-[0.2em] text-text-tertiary">공수 내리시길</div>
                  <div className="text-[12.5px] text-text-tertiary mt-1" style={{ opacity: 0.75 }}>
                    공수(空唱) — 신령이 사람의 입을 빌려 직접 들려주는 말
                  </div>
                </div>
                {/* 결과 전에는 기본 문구를 미리 보여주지 않는다 — 로딩 → 결과만 자연스럽게.
                    문장은 스크롤 연동 리빌: 화면 밖 줄은 흐릿(0.1), 들어오면 선명해진다 */}
                <div className="space-y-5 border-l-2 pl-4" style={{ borderColor: `${deityColor}66` }}>
                  {reading.total ? (
                    speechLines(reading.total).map((line, li) => (
                      <RevealLine
                        key={`ai-${li}`}
                        className="text-[19px] text-text-primary leading-[2.05]"
                        style={{ fontFamily: 'var(--font-serif)' }}
                      >
                        {renderManshinEmphasis(line)}
                      </RevealLine>
                    ))
                  ) : createError || jobFailed ? (
                    <>
                      {speechLines(deity.speech).map((line, li) => (
                        <p key={li} className="text-[19px] text-text-primary leading-[2.05]" style={{ fontFamily: 'var(--font-serif)' }}>
                          {line}
                        </p>
                      ))}
                      <p className="text-[13.5px] text-text-tertiary">
                        {createError || job?.errorMessage || '공수 생성에 실패했어요. 다시 뽑아주세요.'}
                      </p>
                    </>
                  ) : (
                    <motion.p
                      animate={{ opacity: [0.35, 0.9, 0.35] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                      className="text-[14px] text-text-tertiary"
                    >
                      신령이 세 패를 읽고 있느니라. 잠시 자리를 비워도 공수는 이어지느니.
                    </motion.p>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 mt-4">
                  {deity.keywords.map((k) => (
                    <span
                      key={k}
                      className="text-[13.5px] px-3 py-1.5 rounded-full border"
                      style={{ color: deityColor, borderColor: `${deityColor}55`, background: `${deityColor}14` }}
                    >
                      {k}
                    </span>
                  ))}
                </div>

                {/* 카테고리별 공수 — 탭하면 열리는 아코디언 */}
                <div className="mt-5 space-y-2">
                  <div className="text-[13.5px] text-text-tertiary mb-1.5">궁금한 운을 짚어 마저 듣거라</div>
                  {FORTUNE_SECTIONS.map((sec) => {
                    const open = !!openSections[sec.key];
                    const aiText = reading[sec.key];
                    // 결과 전에는 씨앗 문구를 미리 보여주지 않는다 (실패 시에만 폴백)
                    const text = aiText ?? (createError || jobFailed ? deity.fortunes[sec.key as keyof ManshinFortunes] : null);
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
                          <span className="text-[17px] font-semibold" style={{ color: open ? deityColor : 'var(--text-secondary)' }}>
                            {sec.label}
                          </span>
                          <motion.span
                            animate={{ rotate: open ? 180 : 0 }}
                            transition={{ duration: 0.25 }}
                            className="text-[12.5px] text-text-tertiary"
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
                              <div className="px-4 pb-5 pt-1 space-y-4">
                                {text &&
                                  speechLines(text).map((line, li) => (
                                    <RevealLine
                                      key={`${aiText ? 'ai' : 'base'}-${li}`}
                                      className="text-[18px] text-text-primary leading-[2.0]"
                                      style={{ fontFamily: 'var(--font-serif)' }}
                                    >
                                      {renderManshinEmphasis(line)}
                                    </RevealLine>
                                  ))}
                                {!text && jobRunning && (
                                  <motion.p
                                    animate={{ opacity: [0.35, 0.9, 0.35] }}
                                    transition={{ duration: 1.4, repeat: Infinity }}
                                    className="text-[14px] text-text-tertiary"
                                  >
                                    깊은 공수를 받아오는 중이니라
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
              )}
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
