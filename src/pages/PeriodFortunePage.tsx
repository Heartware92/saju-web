'use client';

/**
 * 기간 운세 공통 결과 페이지
 * - scope: 'year' | 'day' | 'date'
 *   · year  → /saju/newyear (연도는 자동으로 현재 연도 사용)
 *   · day   → /saju/today
 *   · date  → /saju/date?date=YYYY-MM-DD  (+ 달력 피커)
 *
 * 사주 원국은 URL query 또는 대표 프로필에서 가져와 계산한다.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useProfileStore } from '../store/useProfileStore';
import { extractMetaphor } from '../utils/parseMetaphor';
import { SectionCollapsible } from '../components/saju/SectionCollapsible';
import { useUserStore } from '../store/useUserStore';
import { useCreditStore } from '../store/useCreditStore';
import { useReportCacheStore, sajuKey, type ReportKind } from '../store/useReportCacheStore';
import { RestoreReportModal } from '../components/RestoreReportModal';
import { FortuneProfileSelect } from '../components/FortuneProfileSelect';
import { QuickFortuneGate } from '../components/QuickFortuneGate';
import { sajuDB } from '../services/supabase';
import { parseNewyearReport } from '../services/fortuneService';
import { findRecentArchive } from '../services/archiveService';
import { BackButton } from '../components/ui/BackButton';
import { SUN_COST_BIG, CHARGE_REASONS } from '../constants/creditCosts';
import { computeSajuFromProfile } from '../utils/profileSaju';
import { calculateSaju } from '../utils/sajuCalculator';
import { calculatePeriodFortune, type FortuneScope, type FortuneGrade, type PeriodFortune } from '../engine/periodFortune';
import { getPeriodDomainsDescription, getNewyearReport, getPickedDateReport, parsePickedDateReport, parseDateFlowScores, stripAllSectionTags, DATE_TIME_SLOT_LABELS, type NewyearReportAIResult, type PickedDateReportAIResult, type DateTimeSlot, type DateFlowScores } from '../services/fortuneService';
import { NEWYEAR_SECTION_KEYS, NEWYEAR_SECTION_LABELS, PICKED_DATE_SECTION_KEYS, PICKED_DATE_SECTION_LABELS } from '../constants/prompts';
import { AILoadingBar } from '../components/AILoadingBar';
import { LuckyVisualCard, ELEMENT_LUCKY } from '../components/saju/LuckyVisualCard';
import { TermChip } from '../components/ui/TermChip';
import { useLoadingGuard } from '../hooks/useLoadingGuard';
import { ShareBar } from '@/components/share/ShareBar';
import { RadarChart } from '../components/charts/RadarChart';
import { MonthlyTrendChart } from '../components/charts/MonthlyTrendChart';
import { useScrollToTopOnLoad } from '../hooks/useScrollToTopOnLoad';

const NEWYEAR_MESSAGES = [
  '세운과 원국의 합충을 분석하는 중입니다',
  '재물·직업·애정 기운을 읽는 중입니다',
  '월별 흐름과 대운 맥락을 종합하는 중입니다',
  '신년 전체 운세를 정리하는 중입니다',
];

const GRADE_COLOR: Record<FortuneGrade, string> = {
  '대길': '#34D399',
  '길': '#86EFAC',
  '중길': '#FBBF24',
  '평': '#CBD5E1',
  '중흉': '#FB923C',
  '흉': '#F87171',
};

function ScoreRing({ score, grade }: { score: number; grade: FortuneGrade }) {
  const c = GRADE_COLOR[grade];
  const r = 48, C = 2 * Math.PI * r;
  const offset = C * (1 - score / 100);
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
      <circle
        cx="60" cy="60" r={r} fill="none"
        stroke={c} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={offset}
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
      />
      <text x="60" y="60" textAnchor="middle" dominantBaseline="middle"
            fontSize="28" fontWeight="bold" fill="white">{score}</text>
      <text x="60" y="82" textAnchor="middle" dominantBaseline="middle"
            fontSize="11" fill="rgba(255,255,255,0.6)">점 · {grade}</text>
    </svg>
  );
}

function DomainBar({ label, score, grade }: { label: string; score: number; grade: FortuneGrade }) {
  const c = GRADE_COLOR[grade];
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 shrink-0 text-[14px] font-semibold text-text-secondary whitespace-nowrap">{label}</div>
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: c }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <div className="w-8 text-right text-[14px] font-bold" style={{ color: c }}>{score}</div>
    </div>
  );
}

function DateFlowChart({ flow }: { flow: DateFlowScores }) {
  const slots: DateTimeSlot[] = ['morning', 'afternoon', 'evening', 'night'];
  const points = slots.map((s, i) => ({ x: 30 + i * 80, y: 110 - (flow[s] ?? 50) * 0.85, slot: s, score: flow[s] ?? 50 }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const bestSlot = slots.reduce((a, b) => (flow[a] >= flow[b] ? a : b));
  return (
    <div className="w-full">
      <svg viewBox="0 0 290 140" className="w-full">
        <line x1="20" y1="110" x2="270" y2="110" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1="20" y1="68" x2="270" y2="68" stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
        <line x1="20" y1="25" x2="270" y2="25" stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
        <path d={path} fill="none" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d={`${path} L${points[points.length - 1].x},110 L${points[0].x},110 Z`}
          fill="url(#dateFlowGrad)"
          opacity="0.35"
        />
        <defs>
          <linearGradient id="dateFlowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
          </linearGradient>
        </defs>
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={p.slot === bestSlot ? 6 : 4} fill="#A78BFA" stroke="#1C1033" strokeWidth="2" />
            <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#A78BFA">{p.score}</text>
            <text x={p.x} y={128} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.7)">
              {DATE_TIME_SLOT_LABELS[p.slot]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

const REMEDY_RULES: [RegExp, string][] = [
  [/음식[·\s]*음료|식재료|섭취|먹/, '음식'],
  [/향기[·\s]*아로마|디퓨저|아로마|향을\s*추천/, '향기'],
  [/미니\s*행동|스트레칭|산책|호흡|정리|기록/, '행동'],
  [/마음가짐|마음\s*자세|태도|관통하는/, '마음'],
];

function RemedyCardGrid({ bodyText }: { bodyText: string }) {
  const paragraphs = bodyText.split(/\n\n+/).map(p => p.trim()).filter(Boolean);

  const matched: { label: string; text: string }[] = [];
  const unmatched: string[] = [];
  const usedLabels = new Set<string>();

  for (const para of paragraphs) {
    let found = false;
    for (const [re, label] of REMEDY_RULES) {
      if (re.test(para) && !usedLabels.has(label)) {
        matched.push({ label, text: para });
        usedLabels.add(label);
        found = true;
        break;
      }
    }
    if (!found) unmatched.push(para);
  }

  if (matched.length < 2) {
    return (
      <div className="text-[15px] text-text-secondary leading-[1.85] space-y-3">
        {paragraphs.map((para, pi) => (
          <p key={pi} className="whitespace-pre-line">{para}</p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {unmatched.length > 0 && (
        <p className="text-[14px] text-text-secondary leading-[1.85] mb-1">{unmatched.join(' ')}</p>
      )}
      {matched.map((card, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i }}
          className="rounded-xl px-4 py-3 bg-[rgba(139,92,246,0.08)] border border-[rgba(139,92,246,0.15)]"
        >
          <div className="text-[17px] font-bold text-cta mb-2">{card.label}</div>
          <p className="text-[14px] text-text-secondary leading-[1.85]">{card.text}</p>
        </motion.div>
      ))}
    </div>
  );
}

function CalendarPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [viewDate, setViewDate] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-indexed
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [] as (number | null)[];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isSelected = (d: number) => {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return iso === value;
  };

  const pick = (d: number) => {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    onChange(iso);
  };

  return (
    <div className="rounded-2xl p-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="w-8 h-8 rounded-lg text-text-secondary hover:bg-white/5"
        >‹</button>
        <span className="text-[16px] font-bold text-text-primary">
          {year}년 {month + 1}월
        </span>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="w-8 h-8 rounded-lg text-text-secondary hover:bg-white/5"
        >›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[13px] text-text-tertiary mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => (
          <button
            key={i}
            disabled={!d}
            onClick={() => d && pick(d)}
            className={`aspect-square rounded-lg text-[14px] font-medium
              ${!d ? 'opacity-0' : ''}
              ${d && isSelected(d) ? 'bg-cta text-white' : 'text-text-primary hover:bg-white/5'}`}
          >
            {d ?? ''}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PeriodFortunePage({ scope }: { scope: FortuneScope | 'date' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = searchParams?.get('profileId') ?? null;
  const recordId = searchParams?.get('recordId') ?? null;
  const isArchiveMode = !!recordId;
  const needsProfileSelect = !profileId && !isArchiveMode;
  const { user } = useUserStore();
  const { profiles, fetchProfiles, hydrated, loading: profilesLoading, lastFetchedAt } = useProfileStore();

  useEffect(() => { if (user) fetchProfiles(); }, [user, fetchProfiles]);

  const targetProfile = useMemo(() => {
    if (profileId) return profiles.find(p => p.id === profileId) ?? null;
    if (needsProfileSelect) return null;
    return profiles.find(p => p.is_primary) ?? null;
  }, [profiles, profileId, needsProfileSelect]);

  const today = new Date().toISOString().slice(0, 10);
  const initialDate = searchParams?.get('date') || today;
  const [pickedDate, setPickedDate] = useState(initialDate);
  // scope='date' 전용: 사용자가 명시적으로 날짜를 선택해 결과를 본 상태인지.
  // 진입 시 달력만 보이고, 날짜 클릭 후에야 결과 단계로 진입한다.
  // - URL에 ?date=가 있거나 ?recordId= 보관함 복원이면 즉시 confirmed
  // - 그 외엔 달력 진입부터.
  const [dateConfirmed, setDateConfirmed] = useState<boolean>(
    scope !== 'date' || !!searchParams?.get('date') || !!searchParams?.get('recordId'),
  );

  const targetYear = (() => {
    const y = searchParams?.get('year');
    if (y) return parseInt(y, 10);
    return new Date().getFullYear();
  })();

  // 계산 — URL에 간지 원국이 들어오면 그것 사용, 아니면 대표 프로필
  const saju = useMemo(() => {
    // URL 쿼리로 birth 정보가 들어왔을 경우
    const q = searchParams;
    if (q?.get('year') && q?.get('month') && q?.get('day')) {
      try {
        return calculateSaju(
          parseInt(q.get('year')!, 10),
          parseInt(q.get('month')!, 10),
          parseInt(q.get('day')!, 10),
          parseInt(q.get('hour') || '12', 10),
          parseInt(q.get('minute') || '0', 10),
          (q.get('gender') || 'male') as 'male' | 'female',
          q.get('unknownTime') === 'true',
        );
      } catch {
        return null;
      }
    }
    return targetProfile ? computeSajuFromProfile(targetProfile) : null;
  }, [searchParams, targetProfile, scope]);

  const fortune: PeriodFortune | null = useMemo(() => {
    if (!saju) return null;
    const realScope: FortuneScope = scope === 'date' ? 'day' : scope;
    try {
      return calculatePeriodFortune(saju, {
        scope: realScope,
        date: scope === 'day' ? today : scope === 'date' ? pickedDate : undefined,
        year: scope === 'year' ? targetYear : undefined,
      });
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [saju, scope, pickedDate, today, targetYear]);

  const pageTitle =
    scope === 'year' ? `${targetYear} 신년운세`
    : scope === 'day' ? '실시간 운세'
    : '지정일 운세';

  // 영역별 AI 상세 설명 (5문장)
  const [domainAI, setDomainAI] = useState<Partial<Record<'wealth' | 'career' | 'love' | 'health' | 'study', string>>>({});
  const [domainAILoading, setDomainAILoading] = useState(false);

  // 신년운세 종합 리포트 (scope='year'에서만 사용)
  const [newyearReport, setNewyearReport] = useState<NewyearReportAIResult | null>(null);
  const [newyearReportLoading, setNewyearReportLoading] = useState(scope === 'year' && !isArchiveMode);

  // 지정일 운세 7섹션 리포트 (scope='date'에서만 사용)
  const [pickedDateReport, setPickedDateReport] = useState<PickedDateReportAIResult | null>(null);
  const [pickedDateReportLoading, setPickedDateReportLoading] = useState(false);

  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);

  // 결과 준비 완료 시 스크롤 최상단 (newyear 또는 picked-date 어느 것이든 ready 시점)
  useScrollToTopOnLoad(
    (!!newyearReport && !newyearReportLoading) ||
    (!!pickedDateReport && !pickedDateReportLoading)
  );

  // ── 캐시 게이트 ─ 캐시 hit 시 silent restore 대신 모달 띄움. 사용자가 [기존 보기] / [새로 풀이] 선택. ──
  const [cacheGate, setCacheGate] = useState<{ kind: ReportKind; key: string; restore: () => void } | null>(null);
  const [refetchNonce, setRefetchNonce] = useState(0);
  const handleUseCached = () => {
    cacheGate?.restore();
    setCacheGate(null);
  };
  const handleRefetch = () => {
    if (cacheGate) useReportCacheStore.getState().invalidate(cacheGate.kind, cacheGate.key);
    setCacheGate(null);
    apiCalledKeyRef.current = null;
    setRefetchNonce(n => n + 1);
  };

  const chargeForContent = useCreditStore(s => s.chargeForContent);
  const chargeRef = useRef(chargeForContent);
  chargeRef.current = chargeForContent;

  // ref guard: 동일한 호출 키에 대해 중복 API 호출 방지 (탭 전환·백그라운드 복귀 시 보호)
  const apiCalledKeyRef = useRef<string | null>(null);

  // ── 보관함 재생 모드 — recordId 가 있으면 DB에서 풀이 복원, AI 호출 skip ──
  // (scope='year'·newyear / scope='date'·period 가 archive 저장됨)
  useEffect(() => {
    if (!recordId) return;
    if (scope !== 'year' && scope !== 'date') return;
    let cancelled = false;
    sajuDB.getRecordById(recordId)
      .then((record) => {
        if (cancelled || !record) return;
        const content = record.interpretation_detailed ?? record.interpretation_basic ?? '';
        if (scope === 'year') {
          const sections = parseNewyearReport(content);
          setNewyearReport(
            Object.keys(sections).length > 0
              ? { success: true, sections }
              : { success: true, rawText: content },
          );
        } else {
          const sections = parsePickedDateReport(content);
          const flow = parseDateFlowScores(content);
          setPickedDateReport(
            Object.keys(sections).length > 0
              ? { success: true, sections, rawText: content, flow }
              : { success: true, rawText: content, flow },
          );
        }
      })
      .catch((e) => {
        console.error('[archive replay] period load failed', e);
        if (!cancelled) {
          if (scope === 'year') setNewyearReport({ success: false, error: '보관된 풀이를 불러오지 못했어요.' });
          else setPickedDateReport({ success: false, error: '보관된 풀이를 불러오지 못했어요.' });
        }
      })
      .finally(() => {
        if (!cancelled) {
          if (scope === 'year') setNewyearReportLoading(false);
          else setPickedDateReportLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [recordId, scope]);

  // ── 로딩 안전장치: 70초 초과 시 강제 해제 ──
  const [yearTimedOut] = useLoadingGuard(newyearReportLoading, 140_000);
  const [dateTimedOut] = useLoadingGuard(pickedDateReportLoading, 140_000);
  const [domainTimedOut] = useLoadingGuard(domainAILoading, 140_000);
  useEffect(() => {
    if (yearTimedOut) {
      setNewyearReportLoading(false);
      setNewyearReport({ success: false, error: '응답이 너무 오래 걸려요. 새로고침 후 다시 시도해주세요.' });
    }
  }, [yearTimedOut]);
  useEffect(() => {
    if (dateTimedOut) {
      setPickedDateReportLoading(false);
      setPickedDateReport({ success: false, error: '응답이 너무 오래 걸려요. 새로고침 후 다시 시도해주세요.' });
    }
  }, [dateTimedOut]);
  useEffect(() => {
    if (domainTimedOut) setDomainAILoading(false);
  }, [domainTimedOut]);

  // ── 보관함 DB 확인 → AI 호출 (순차 실행) ──
  // 보관함 체크를 먼저 완료한 뒤, 기존 풀이가 없을 때만 AI 호출
  useEffect(() => {
    if (isArchiveMode) return;
    if (!saju || !fortune) return;

    // 중복 호출 방지: 이미 동일 키로 호출이 시작되었으면 skip (탭 복귀·프로필 hydration 방어)
    const effectKey = `${sajuKey(saju)}:${scope}:${scope === 'year' ? targetYear : scope === 'date' ? pickedDate : today}`;
    if (refetchNonce === 0 && apiCalledKeyRef.current === effectKey) return;

    let cancelled = false;

    const isFresh = searchParams?.get('fresh') === '1';

    // ★ cache 우선 — 메모리 unload→reload 후에도 archive 모달 없이 즉시 복원
    // scope 별 캐시 키가 있으면 archive 모달 분기 자체를 skip.
    const peekCache = (): boolean => {
      if (isFresh || refetchNonce > 0) return false;
      const sk = sajuKey(saju);
      if (scope === 'year') {
        const cached = useReportCacheStore.getState().getReport<NewyearReportAIResult>('newyear', `${sk}:${targetYear}`);
        if (cached?.error) { setNewyearReport({ success: false, error: cached.error }); setNewyearReportLoading(false); return true; }
        if (cached?.data) { setNewyearReport(cached.data); setNewyearReportLoading(false); return true; }
      } else if (scope === 'date' && dateConfirmed) {
        const cached = useReportCacheStore.getState().getReport<PickedDateReportAIResult>('period_date', `${sk}:${pickedDate}`);
        if (cached?.error) { setPickedDateReport({ success: false, error: cached.error }); setPickedDateReportLoading(false); return true; }
        if (cached?.data) { setPickedDateReport(cached.data); setPickedDateReportLoading(false); return true; }
      } else if (scope === 'day') {
        const cached = useReportCacheStore.getState().getReport<Partial<Record<'wealth' | 'career' | 'love' | 'health' | 'study', string>>>('period_day', `${sk}:${today}`);
        if (cached?.data) { setDomainAI(cached.data); setDomainAILoading(false); return true; }
      }
      return false;
    };

    const runWithArchiveCheck = async () => {
      if (peekCache()) return;

      if (refetchNonce === 0 && targetProfile && !isFresh) {
        let category: 'newyear' | 'period' | 'today' | undefined;
        let context: { key: string; value: string } | undefined;
        if (scope === 'year') {
          category = 'newyear';
          context = { key: 'year', value: String(targetYear) };
        } else if (scope === 'date' && dateConfirmed) {
          category = 'period';
          context = { key: 'isoDate', value: pickedDate };
        } else if (scope === 'day') {
          category = 'today';
          context = { key: 'isoDate', value: today };
        }

        if (category) {
          try {
            const found = await findRecentArchive({
              category,
              birth_date: targetProfile.birth_date,
              gender: targetProfile.gender,
              context,
              profile_id: targetProfile.id,
            });
            if (cancelled) return;
            if (found) {
              setSavedRecordId(found.id);
              setNewyearReportLoading(false);
              setPickedDateReportLoading(false);
              setCacheGate({
                kind: 'newyear',
                key: '',
                restore: () => {
                  const params = new URLSearchParams(window.location.search);
                  params.set('recordId', found.id);
                  router.replace(`${window.location.pathname}?${params.toString()}`);
                },
              });
              return;
            }
          } catch { /* ignore */ }
          if (cancelled) return;
        }
      }

      const sk = sajuKey(saju);
      apiCalledKeyRef.current = effectKey;

    // scope=year: 신년운세 종합 리포트 호출 (도메인 상세는 패스)
    // 정상 응답 캐시 X (홈 진입 = 새 풀이). 실패만 1분 negative cache.
    if (scope === 'year') {
      const cacheKey = `${sk}:${targetYear}`;
      const cached = useReportCacheStore.getState().getReport<NewyearReportAIResult>('newyear', cacheKey);
      if (!(isFresh || refetchNonce > 0) && cached?.error) {
        setNewyearReport({ success: false, error: cached.error });
        setNewyearReportLoading(false);
        return;
      }
      // 캐시 silent restore (같은 디바이스 빠른 재진입). 보관함 모달은 별도 useEffect 에서 처리.
      if (!(isFresh || refetchNonce > 0) && cached?.data) {
        setNewyearReport(cached.data);
        setNewyearReportLoading(false);
        return;
      }

      setNewyearReport(null);
      setNewyearReportLoading(true);
      getNewyearReport(saju, fortune, targetYear, targetProfile?.id)
        .then(r => {
          if (cancelled) return;
          setNewyearReport(r);
          // archive 저장이 완료된 경우 ShareBar 즉시 노출
          if (r.success && r.archivedRecordId) {
            setSavedRecordId(r.archivedRecordId);
          }
          const cache = useReportCacheStore.getState();
          if (r.success) {
            cache.setReport('newyear', cacheKey, r);
            if (!cache.isCharged('newyear', cacheKey)) {
              cache.markCharged('newyear', cacheKey);
              chargeRef.current('sun', SUN_COST_BIG, CHARGE_REASONS.newyear, `newyear:${cacheKey}`)
                .catch(e => console.error('[charge:newyear] failed', e));
            }
          } else if (r.error) {
            cache.setError('newyear', cacheKey, r.error);
          }
        })
        .catch((err: any) => {
          if (cancelled) return;
          useReportCacheStore.getState().setError('newyear', cacheKey, err?.message || '오류가 발생했어요.');
        })
        .finally(() => { if (!cancelled) setNewyearReportLoading(false); });
      return;
    }

    // scope=date: 지정일 7섹션 리포트 — 사용자가 날짜를 선택해 confirmed된 경우에만 호출
    if (scope === 'date') {
      if (!dateConfirmed) return;
      const cacheKey = `${sk}:${pickedDate}`;
      const cached = useReportCacheStore.getState().getReport<PickedDateReportAIResult>('period_date', cacheKey);
      if (!(isFresh || refetchNonce > 0) && cached?.error) {
        setPickedDateReport({ success: false, error: cached.error });
        setPickedDateReportLoading(false);
        return;
      }
      if (!(isFresh || refetchNonce > 0) && cached?.data) {
        setPickedDateReport(cached.data);
        setPickedDateReportLoading(false);
        return;
      }
      setPickedDateReport(null);
      setPickedDateReportLoading(true);
      getPickedDateReport(saju, pickedDate, targetProfile?.id)
        .then(r => {
          if (cancelled) return;
          setPickedDateReport(r);
          // archive 저장이 완료된 경우 ShareBar 즉시 노출
          if (r.success && r.archivedRecordId) {
            setSavedRecordId(r.archivedRecordId);
          }
          const cache = useReportCacheStore.getState();
          if (r.success) {
            cache.setReport('period_date', cacheKey, r);
            if (!cache.isCharged('period_date', cacheKey)) {
              cache.markCharged('period_date', cacheKey);
              chargeRef.current('sun', SUN_COST_BIG, CHARGE_REASONS.date, `period_date:${cacheKey}`)
                .catch(e => console.error('[charge:period_date] failed', e));
            }
          } else if (r.error) {
            cache.setError('period_date', cacheKey, r.error);
          }
        })
        .catch((err: any) => {
          if (cancelled) return;
          useReportCacheStore.getState().setError('period_date', cacheKey, err?.message || '오류가 발생했어요.');
        })
        .finally(() => { if (!cancelled) setPickedDateReportLoading(false); });
      return;
    }

    // scope=day: 영역별 5문장 상세 — 정상 캐시 X, 실패만 1분 차단
    const kind = 'period_day';
    const targetDate = today;
    const cacheKey = `${sk}:${targetDate}`;
    const cached = useReportCacheStore.getState().getReport<Partial<Record<'wealth' | 'career' | 'love' | 'health' | 'study', string>>>(kind, cacheKey);
    if (cached?.error) {
      // 도메인 AI 실패는 페이지 자체 에러 state 가 없어 console 만 남김 — 1분간 자동 재호출 차단
      console.warn('[period] cached error', cached.error);
      setDomainAI({});
      setDomainAILoading(false);
      return;
    }
    if (cached?.data) {
      setDomainAI(cached.data);
      setDomainAILoading(false);
      return;
    }

    setDomainAI({});
    setDomainAILoading(true);

    const scopeLabel = `오늘(${today})`;

    const domainsBrief = fortune.domains
      .filter(d => d.key !== 'overall')
      .map(d => ({
        key: d.key as 'wealth' | 'career' | 'love' | 'health' | 'study',
        label: d.label,
        score: d.score,
        grade: d.grade,
      }));

    getPeriodDomainsDescription(saju, {
      scopeLabel,
      targetGanZhi: fortune.targetGanZhi.ganZhi,
      overallHeadline: fortune.headline,
      domains: domainsBrief,
    })
      .then(r => {
        if (cancelled) return;
        const cache = useReportCacheStore.getState();
        if (r.success && r.descriptions) {
          setDomainAI(r.descriptions);
          cache.setReport(kind, cacheKey, r.descriptions);
          if (!cache.isCharged(kind, cacheKey)) {
            cache.markCharged(kind, cacheKey);
            chargeRef.current('sun', SUN_COST_BIG, CHARGE_REASONS.today, `${kind}:${cacheKey}`)
              .catch(e => console.error('[charge:period_day] failed', e));
          }
        } else if (r.error) {
          cache.setError(kind, cacheKey, r.error);
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        useReportCacheStore.getState().setError(kind, cacheKey, err?.message || '오류가 발생했어요.');
      })
      .finally(() => {
        if (!cancelled) setDomainAILoading(false);
      });
    };

    runWithArchiveCheck();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saju, fortune, scope, pickedDate, targetYear, today, isArchiveMode, dateConfirmed, refetchNonce]);

  if (needsProfileSelect) {
    const CURRENT_YEAR = new Date().getFullYear();
    if (scope === 'year') {
      return (
        <FortuneProfileSelect
          serviceName={`${targetYear} 신년운세`}
          archiveCategory="newyear"
          archiveContext={{ key: 'year', value: String(targetYear) }}
          creditType="sun"
          creditCost={SUN_COST_BIG}
        />
      );
    }
    return (
      <QuickFortuneGate
        serviceName="지정일 운세"
        archiveCategory="period"
        creditType="sun"
        creditCost={SUN_COST_BIG}
      />
    );
  }

  if (!targetProfile && !searchParams?.get('year')) {
    const profileStoreReady = hydrated && lastFetchedAt !== null && !profilesLoading;
    if (!profileStoreReady) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-cta border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-text-secondary mb-4">대표 프로필이 없어요</p>
        <button
          onClick={() => router.push('/saju/input')}
          className="px-5 py-2.5 rounded-xl bg-cta text-white text-sm font-semibold"
        >
          생년월일 입력
        </button>
      </div>
    );
  }

  if (!saju || !fortune) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-cta border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 신년운세: 리포트 응답 오기 전까지 전체 로딩 화면
  if (scope === 'year' && newyearReportLoading) {
    return (
      <AILoadingBar
        label={`${targetYear}년 신년운세 풀이중`}
        minLabel="20초"
        maxLabel="1분"
        estimatedSeconds={40}
        messages={NEWYEAR_MESSAGES}
        topContent={
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="text-[32px] mb-1" style={{ fontFamily: 'var(--font-serif)' }}>
              {fortune.targetGanZhi.ganZhi}년
            </div>
          </motion.div>
        }
      />
    );
  }

  // 지정일 운세: 사용자가 날짜를 선택한 직후 풀이 응답 대기 중 — 전체 로딩 화면
  if (scope === 'date' && dateConfirmed && pickedDateReportLoading) {
    return (
      <AILoadingBar
        label="지정일 운세 풀이중"
        minLabel="20초"
        maxLabel="1분"
        estimatedSeconds={40}
        messages={[
          '지정일 일진과 원국의 관계를 분석하는 중입니다',
          '시간대별 흐름을 그리는 중입니다',
          '시도하면 좋은 일과 피할 일을 정리하는 중입니다',
          '인연·환경·처방을 종합하는 중입니다',
        ]}
        topContent={
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="text-[24px] mb-1" style={{ fontFamily: 'var(--font-serif)' }}>
              {pickedDate}
            </div>
            <div className="text-[14px] text-text-tertiary">
              {fortune.targetGanZhi.ganZhi} 일진
            </div>
          </motion.div>
        }
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen px-4 pt-4 pb-10"
    >
      {/* 헤더 */}
      <div className="flex items-center relative mb-5 pt-3 px-1">
        <BackButton className="absolute left-0" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* 지정일 — 진입 단계 (달력 + 안내) — 날짜 클릭 후 결과 단계로 전환 */}
      {scope === 'date' && !dateConfirmed && (
        <div className="mb-4 space-y-3">
          <div className="rounded-xl p-4 bg-gradient-to-br from-[rgba(124,92,252,0.18)] to-[rgba(201,166,255,0.06)] border border-cta/25">
            <p className="text-[15px] font-bold text-text-primary mb-1">풀이를 보고 싶은 날짜를 선택해주세요</p>
            <p className="text-[13px] text-text-secondary leading-[1.85]">
              과거·미래 어떤 날짜든 가능합니다. 일진·세운·월운·대운 4개 층을 함께 풀어 그 날의 핵심·시간대 흐름·시도하면 좋은 일·피할 일·인연·처방까지 7가지 관점으로 알려드려요.
            </p>
          </div>
          <CalendarPicker
            value={pickedDate}
            onChange={(iso) => {
              setPickedDate(iso);
              setDateConfirmed(true);
            }}
          />
        </div>
      )}

      {/* 결과 영역 — 지정일 진입 단계(미확정)에서는 통째로 숨김 */}
      {!(scope === 'date' && !dateConfirmed) && (<>

      {/* 지정일 결과 헤더 — "선택한 날짜" + 다른 날짜 보기 버튼 */}
      {scope === 'date' && dateConfirmed && (
        <div className="mb-3 flex items-center justify-between gap-2 px-1">
          <div className="text-[15px] font-semibold text-text-secondary">
            <span className="text-text-tertiary text-[13px]">선택한 날짜</span>{' '}
            <span className="text-text-primary">{pickedDate}</span>
          </div>
          <button
            onClick={() => {
              setDateConfirmed(false);
              setPickedDateReport(null);
            }}
            className="text-[13px] px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20 active:scale-[0.97] transition-all"
          >
            다른 날짜 보기
          </button>
        </div>
      )}

      {/* 요약 카드 */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 mb-3 bg-[rgba(20,12,38,0.6)] border border-[var(--border-subtle)]"
      >
        <div className="flex items-center gap-4">
          <ScoreRing score={fortune.overallScore} grade={fortune.overallGrade} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-text-tertiary mb-2">{fortune.lunarLabel}</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <TermChip term={fortune.targetGanZhi.ganZhi} />
              <TermChip term={fortune.targetGanZhi.tenGodGan} />
              <TermChip term={fortune.overallGrade} asGrade />
            </div>
          </div>
        </div>
        <div className="text-[17px] font-bold text-text-primary leading-snug mt-4 break-keep">
          {fortune.headline}
        </div>
        <p className="text-[15px] text-text-secondary mt-2 leading-[1.85]">
          {fortune.summary}
        </p>
      </motion.section>

      {/* 영역별 점수 */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
      >
        <div className="text-[15px] font-semibold text-text-secondary mb-3 px-1 uppercase tracking-wider">영역별 운세</div>

        {/* 레이더 차트 — 5개 영역 한눈에 비교 */}
        <RadarChart
          domains={fortune.domains.filter(d => d.key !== 'overall').map(d => ({
            label: d.label,
            score: d.score,
            color: GRADE_COLOR[d.grade],
          }))}
          size={250}
          className="mb-4"
        />

        <div className="space-y-2.5">
          {fortune.domains.filter(d => d.key !== 'overall').map(d => (
            <DomainBar key={d.key} label={d.label} score={d.score} grade={d.grade} />
          ))}
        </div>
      </motion.section>

      {/* 영역별 상세 */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="space-y-2 mb-3"
      >
        {fortune.domains.filter(d => d.key !== 'overall').map(d => {
          const aiText = domainAI[d.key as 'wealth' | 'career' | 'love' | 'health' | 'study'];
          return (
            <div
              key={d.key}
              className="rounded-xl p-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[15px] font-bold text-text-primary">{d.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-bold" style={{ color: GRADE_COLOR[d.grade] }}>{d.score}점</span>
                  <TermChip term={d.grade} asGrade />
                </div>
              </div>
              {aiText ? (
                <p className="text-[14px] text-text-secondary leading-relaxed mb-2 whitespace-pre-line">{aiText}</p>
              ) : domainAILoading ? (
                <div className="mb-2 space-y-1.5">
                  <div className="h-2 rounded bg-white/5 animate-pulse" />
                  <div className="h-2 rounded bg-white/5 animate-pulse w-[90%]" />
                  <div className="h-2 rounded bg-white/5 animate-pulse w-[75%]" />
                  <div className="h-2 rounded bg-white/5 animate-pulse w-[85%]" />
                  <div className="h-2 rounded bg-white/5 animate-pulse w-[60%]" />
                </div>
              ) : (
                <p className="text-[14px] text-text-secondary leading-relaxed mb-2">{d.summary}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {d.tips.map((t, i) => (
                  <span
                    key={i}
                    className="text-[13px] px-2 py-1 rounded-md border"
                    style={{ borderColor: `${GRADE_COLOR[d.grade]}55`, color: GRADE_COLOR[d.grade], backgroundColor: `${GRADE_COLOR[d.grade]}12` }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </motion.section>

      {/* 행운 메타 — 비주얼 카드 */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
      >
        <div className="text-[15px] font-semibold text-text-secondary mb-3 px-1 uppercase tracking-wider">
          {scope === 'year' ? '연간 행운 처방' : scope === 'date' ? '이 날의 행운' : '오늘의 행운'}
        </div>
        {(() => {
          const luckyEl = saju.yongSinElement ?? '목';
          const el = ELEMENT_LUCKY[luckyEl] ?? ELEMENT_LUCKY['목'];
          return (
            <LuckyVisualCard
              colors={fortune.luckyColors.length >= 2 ? fortune.luckyColors : el.colors}
              colorCss={fortune.luckyColors.length >= 2 ? undefined : el.colorCss}
              numbers={fortune.luckyNumbers.length > 0 ? fortune.luckyNumbers : el.numbers}
              direction={fortune.luckyDirection || el.direction}
              timeSlot={fortune.luckyTime || el.timeSlot}
              gem={fortune.luckyGem || el.gem}
              activity={fortune.luckyActivity || el.activity}
            />
          );
        })()}
      </motion.section>

      {/* 상호작용 */}
      {fortune.interactions.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
        >
          <div className="text-[15px] font-semibold text-text-secondary mb-3 px-1 uppercase tracking-wider">원국과의 상호작용</div>
          <div className="space-y-2">
            {fortune.interactions.map((it, i) => {
              const color = it.nature === 'good' ? '#34D399' : it.nature === 'bad' ? '#F87171' : '#FBBF24';
              return (
                <div key={i} className="rounded-lg p-2.5 border" style={{ borderColor: `${color}55`, backgroundColor: `${color}12` }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[14px] font-bold" style={{ color }}>{it.kind}</span>
                    <span className="text-[13px] text-text-tertiary">{it.between}</span>
                  </div>
                  <div className="text-[14px] text-text-secondary">{it.description}</div>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* 주의점 */}
      {fortune.cautions.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
        >
          <div className="text-[15px] font-semibold text-text-secondary mb-2 px-1 uppercase tracking-wider">주의점</div>
          <ul className="space-y-1">
            {fortune.cautions.map((c, i) => (
              <li key={i} className="text-[14px] text-text-secondary flex gap-2">
                <span className="text-[#F87171]">•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      {/* 월별 흐름 (신년운세 전용) */}
      {fortune.monthlyFlow && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
        >
          <div className="text-[15px] font-semibold text-text-secondary mb-3 px-1 uppercase tracking-wider">월별 흐름 (12개월)</div>

          {/* 트렌드 라인 차트 */}
          <MonthlyTrendChart data={fortune.monthlyFlow} className="mb-4" />

          <div className="grid grid-cols-3 gap-1.5">
            {fortune.monthlyFlow.map(m => (
              <div
                key={m.month}
                className="rounded-lg p-2 border flex flex-col items-center gap-0.5"
                style={{ borderColor: `${GRADE_COLOR[m.grade]}55`, backgroundColor: `${GRADE_COLOR[m.grade]}10` }}
              >
                <span className="text-[13px] text-text-tertiary">{m.month}월</span>
                <span className="text-[14px] font-bold" style={{ color: GRADE_COLOR[m.grade] }}>{m.grade}</span>
                <span className="text-[12px] text-text-secondary">{m.keyword}</span>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* 신년운세 종합 리포트 (scope=year 전용 — 로딩 완료 후 표시) */}
      {scope === 'year' && !newyearReportLoading && newyearReport && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-3"
        >
          <div className="text-center mb-5 mt-2">
            <div
              className="text-[26px] font-bold text-text-primary tracking-tight"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {targetYear}년 종합 리포트
            </div>
            <div className="mt-1.5 mx-auto w-12 h-[2px] rounded-full bg-cta/50" />
          </div>

          {newyearReport.error && (
            <div className="rounded-2xl p-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
              <p className="text-[14px] text-text-secondary">{newyearReport.error}</p>
            </div>
          )}

          {newyearReport.rawText && (
            <div className="rounded-2xl p-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
              <p className="text-[15px] text-text-secondary leading-relaxed whitespace-pre-line">
                {stripAllSectionTags(newyearReport.rawText)}
              </p>
            </div>
          )}

          {newyearReport.sections && (
            <div className="space-y-2">
              {NEWYEAR_SECTION_KEYS.map((key, idx) => {
                const text = newyearReport.sections?.[key];
                if (!text) return null;

                // [은유] 마커 우선 추출 + 본문 strip. 마커 없으면 첫 줄 fallback.
                const parsed = extractMetaphor(text);
                let metaphorTitle = parsed.metaphorTitle;
                let rawBody = parsed.bodyText;
                if (!metaphorTitle) {
                  const lines = rawBody.split('\n');
                  metaphorTitle = lines[0]?.trim() ?? '';
                  rawBody = lines.slice(1).join('\n').trim();
                }

                // monthly 이전 캐시 호환: 첫 줄이 "N월(" 패턴이면 은유 제목 없는 구 포맷
                if (key === 'monthly' && /^\d{1,2}월\s*\(/.test(metaphorTitle)) {
                  rawBody = parsed.bodyText;
                  metaphorTitle = '';
                }

                // monthly: 월 사이 빈 줄 유지
                // lucky: "- 라벨: 내용" 5개 불릿 구조 — 각 불릿 앞에 빈 줄 강제 삽입해 단락 분리
                // 그 외: 단락 내 불필요 줄바꿈 제거
                const bodyText = key === 'monthly'
                  ? rawBody
                  : key === 'lucky'
                    ? rawBody
                        .replace(/\n(?!\n)/g, ' ')
                        // " - 한글: " 패턴(불릿) 앞에 빈 줄 삽입. AI 가 줄바꿈 빼먹어도 안전.
                        .replace(/\s+-\s+(?=[가-힣]+(?:[·\s][가-힣]+)*\s*:)/g, '\n\n- ')
                        .trim()
                    : rawBody.replace(/\n(?!\n)/g, ' ');

                return (
                  <SectionCollapsible
                    key={key}
                    title={NEWYEAR_SECTION_LABELS[key]}
                    metaphorTitle={metaphorTitle}
                    defaultOpen={idx === 0}
                    enterDelay={0.06 * idx}
                  >
                    {key === 'monthly' ? (
                      <div className="space-y-3">
                        {(bodyText.includes('\n\n')
                          ? bodyText.split(/\n\n+/)
                          : bodyText.split(/(?=\d{1,2}월\s*\()/)
                        ).filter(Boolean).map((monthBlock, mi) => (
                          <p key={mi} className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em]">
                            {monthBlock.replace(/\n/g, ' ').trim()}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] whitespace-pre-line">
                        {bodyText}
                      </p>
                    )}
                  </SectionCollapsible>
                );
              })}
            </div>
          )}
        </motion.section>
      )}

      {/* ── 지정일 운세 7섹션 종합 풀이 (scope='date' 전용) ── */}
      {scope === 'date' && dateConfirmed && pickedDateReport && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
        >
          <div className="text-[15px] font-semibold text-text-secondary mb-3 px-1 uppercase tracking-wider">
            이 날의 종합 풀이
          </div>
          {pickedDateReport.error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
              <p className="text-[14px] text-red-400">{pickedDateReport.error}</p>
            </div>
          )}

          {/* FlowChart — 섹션 파싱 여부 무관하게 flow 데이터 있으면 항상 표시 */}
          {pickedDateReport.flow && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-1 h-5 rounded-full bg-cta" />
                <div className="text-[15px] font-bold text-text-primary tracking-tight">시간대별 에너지 흐름</div>
              </div>
              <DateFlowChart flow={pickedDateReport.flow} />
            </motion.div>
          )}

          {pickedDateReport.rawText && !pickedDateReport.sections && (
            <div className="p-4 rounded-xl bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
              <p className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] whitespace-pre-line">
                {stripAllSectionTags(pickedDateReport.rawText)
                  .replace(/아침\s*[:：]\s*\d+\s*낮\s*[:：]\s*\d+\s*저녁\s*[:：]\s*\d+\s*밤\s*[:：]\s*\d+/, '')
                  .trim()}
              </p>
            </div>
          )}
          {pickedDateReport.sections && (
            <div className="space-y-3">
              {PICKED_DATE_SECTION_KEYS.map((key, idx) => {
                const text = pickedDateReport.sections?.[key];
                if (!text) return null;
                // [은유] 마커 우선 추출 + 본문 strip. 마커 없으면 첫 줄 fallback.
                const parsed = extractMetaphor(text);
                let metaphorTitle = parsed.metaphorTitle;
                let bodyText = parsed.bodyText;
                if (!metaphorTitle) {
                  const lines = bodyText.split('\n');
                  metaphorTitle = lines[0]?.trim() ?? '';
                  bodyText = lines.slice(1).join('\n').trim();
                }
                const isYes = key === 'date_yes';
                const isNo = key === 'date_no';
                const isRemedy = key === 'date_remedy';
                const sectionBarColor = isYes ? '#34D399' : isNo ? '#F87171' : '#e8a490';
                return (
                  <SectionCollapsible
                    key={key}
                    title={PICKED_DATE_SECTION_LABELS[key]}
                    metaphorTitle={metaphorTitle}
                    defaultOpen={idx === 0}
                    enterDelay={0.05 * idx}
                    barColor={sectionBarColor}
                  >
                    {isRemedy ? (
                      <RemedyCardGrid bodyText={bodyText} />
                    ) : (isYes || isNo) ? (
                      <div className="space-y-2.5">
                        {bodyText.split(/\n\n+/).map((para, pi) => (
                          <div key={pi} className="flex gap-2.5 items-start">
                            <span className={`shrink-0 mt-0.5 text-[16px] ${isYes ? 'text-emerald-400' : 'text-red-400'}`}>
                              {isYes ? '●' : '▲'}
                            </span>
                            <p className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] whitespace-pre-line">{para.trim()}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
                        {bodyText.split(/\n\n+/).map((para, pi) => (
                          <p key={pi} className="whitespace-pre-line">{para.trim()}</p>
                        ))}
                      </div>
                    )}
                  </SectionCollapsible>
                );
              })}
            </div>
          )}
        </motion.section>
      )}

      </>)}

      {(recordId || savedRecordId) && (
        <div className="mt-6">
          <ShareBar recordId={(recordId || savedRecordId)!} type="saju" category={scope === 'year' ? 'newyear' : scope === 'date' ? 'period' : 'today'} />
        </div>
      )}

      <RestoreReportModal
        open={!!cacheGate}
        title={scope === 'year' ? '신년운세' : scope === 'date' ? '지정일 운세' : '실시간 운세'}
        onUseCached={handleUseCached}
        onRefresh={handleRefetch}
        onClose={() => setCacheGate(null)}
      />
    </motion.div>
  );
}
