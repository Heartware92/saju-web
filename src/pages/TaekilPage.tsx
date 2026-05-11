'use client';

/**
 * 택일 운세 페이지 — 스텝 기반 UX
 * Step 1: 행사 카테고리 선택
 * Step 2: 캘린더에서 후보 날짜 최대 5개 선택
 * Step 3: "택일 풀이보기" → AI 분석 결과 (포디움 + 상세 카드)
 */

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sajuDB } from '../services/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';
import { useCreditStore } from '../store/useCreditStore';
import { useReportCacheStore, sajuKey } from '../store/useReportCacheStore';
import { QuickFortuneGate } from '../components/QuickFortuneGate';
import { findArchiveList, type ArchiveListItem } from '../services/archiveService';
import { SUN_COST_BIG, CHARGE_REASONS } from '../constants/creditCosts';
import { computeSajuFromProfile } from '../utils/profileSaju';
import { BackButton } from '../components/ui/BackButton';
import {
  calculateTaekil,
  TAEKIL_CATEGORIES,
  migrateLegacyCategory,
  type TaekilCategory,
  type TaekilGrade,
  type TaekilDay,
  type TaekilResult,
  type TimeSlotEnergy,
} from '../engine/taekil';
import { getTaekilAdvice } from '../services/fortuneService';
import { useLoadingGuard } from '../hooks/useLoadingGuard';
import { useScrollToTopOnLoad } from '../hooks/useScrollToTopOnLoad';
import styles from './SajuResultPage.module.css';
import { ShareBar } from '@/components/share/ShareBar';

const GRADE_COLOR: Record<TaekilGrade, string> = {
  '대길': '#34D399',
  '길': '#86EFAC',
  '평': '#94A3B8',
  '흉': '#F87171',
};

const GRADE_BG: Record<TaekilGrade, string> = {
  '대길': 'rgba(52,211,153,0.2)',
  '길': 'rgba(134,239,172,0.15)',
  '평': 'rgba(148,163,184,0.08)',
  '흉': 'rgba(248,113,113,0.15)',
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_PICKS = 5;

interface TaekilDateAdvice {
  rank: number;
  summary: string;
  keywords: string[];
}

function parseTaekilStructuredAdvice(raw: string): { dates: TaekilDateAdvice[]; avoid: string } {
  const dates: TaekilDateAdvice[] = [];
  const topRe = /\[top(\d)\]/g;
  const parts = raw.split(topRe);
  for (let i = 1; i < parts.length; i += 2) {
    const rank = parseInt(parts[i], 10);
    const content = (parts[i + 1] ?? '').split(/\[(?:top\d|avoid)\]/)[0].trim();

    // New format: 종합 + 키워드
    const summaryMatch = content.match(/종합[:：]\s*([\s\S]*?)(?=\n키워드[:：]|$)/);
    const keywordMatch = content.match(/키워드[:：]\s*(.+)/);

    if (summaryMatch) {
      dates.push({
        rank,
        summary: summaryMatch[1].trim(),
        keywords: keywordMatch
          ? keywordMatch[1].split(/[,，]/).map(k => k.trim()).filter(Boolean)
          : [],
      });
    } else {
      // Legacy format fallback: 분석 + 시간대 + 개운법 + 주의 → merge into summary
      const extract = (label: string): string => {
        const re = new RegExp(`${label}[:：]\\s*([\\s\\S]*?)(?=\\n(?:분석|시간대|개운법|주의|종합|키워드)[:：]|$)`);
        const m = content.match(re);
        return m ? m[1].trim() : '';
      };
      const analysis = extract('분석');
      const times = extract('시간대');
      const luck = extract('개운법');
      const caution = extract('주의');
      const merged = [analysis, times && `추천 시간대: ${times}`, luck && `개운법: ${luck}`, caution && `주의: ${caution}`].filter(Boolean).join('\n');
      dates.push({ rank, summary: merged || content, keywords: [] });
    }
  }
  const avoidMatch = raw.match(/\[avoid\]\s*([\s\S]*?)$/);
  const avoid = avoidMatch ? avoidMatch[1].trim() : '';
  return { dates, avoid };
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export default function TaekilPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = searchParams?.get('profileId') ?? null;
  const recordId = searchParams?.get('recordId') ?? null;
  const isArchiveMode = !!recordId;
  const needsProfileSelect = !profileId && !isArchiveMode;
  const { user } = useUserStore();
  const { profiles, fetchProfiles, hydrated, loading: profilesLoading, lastFetchedAt } = useProfileStore();
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) fetchProfiles();
  }, [user, fetchProfiles]);

  const targetProfile = useMemo(() => {
    if (profileId) return profiles.find(p => p.id === profileId) ?? null;
    if (needsProfileSelect) return null;
    return profiles.find((p) => p.is_primary) ?? null;
  }, [profiles, profileId, needsProfileSelect]);

  const saju = useMemo(() => {
    if (!targetProfile) return null;
    return computeSajuFromProfile(targetProfile);
  }, [targetProfile]);

  // ── Step 상태 ──
  const [category, setCategory] = useState<TaekilCategory | null>(null);
  const [subItem, setSubItem] = useState<string | null>(null);
  /** category='custom' 일 때만 사용 — 사용자가 직접 입력한 행사 이름 (예: "전시회 오픈") */
  const [customLabel, setCustomLabel] = useState('');

  const today = new Date();
  const todayYear = today.getFullYear();
  const MAX_YEAR = todayYear + 5;
  const MIN_YEAR = todayYear;

  const [viewYear, setViewYear] = useState(todayYear);
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);

  // 택일 엔진 결과 (카테고리 + 월 변경시 재계산)
  const [result, setResult] = useState<TaekilResult | null>(null);

  // 사용자가 선택한 후보 날짜 (최대 5개)
  const [pickedDates, setPickedDates] = useState<string[]>([]);

  // AI 결과
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [parsedAdvice, setParsedAdvice] = useState<{ dates: TaekilDateAdvice[]; avoid: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  // 결과 페이지 진입 시 스크롤 최상단
  useScrollToTopOnLoad(showResult && !aiLoading);

  const [aiTimedOut] = useLoadingGuard(aiLoading, 140_000);
  useEffect(() => {
    if (aiTimedOut) {
      setAiLoading(false);
      if (!aiAdvice) setAiError('응답이 너무 오래 걸려요. 새로고침 후 다시 시도해주세요.');
    }
  }, [aiTimedOut, aiAdvice]);

  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [archiveItems, setArchiveItems] = useState<ArchiveListItem[]>([]);
  const [showArchiveList, setShowArchiveList] = useState(false);
  const [refetchNonce, setRefetchNonce] = useState(0);

  const taekilCacheKey = useMemo(() => {
    if (!saju || !category || pickedDates.length === 0) return null;
    if (category === 'custom' && !customLabel.trim()) return null;
    const subSeg = subItem ? `:${subItem}` : '';
    const customSeg = category === 'custom' ? `:${customLabel.trim().slice(0, 30)}` : '';
    return `${sajuKey(saju)}:${category}${subSeg}${customSeg}:${[...pickedDates].sort().join(',')}`;
  }, [saju, category, subItem, pickedDates, customLabel]);

  // 카테고리/연월 변경시 엔진 재계산 (보관함 모드에서는 스킵)
  const compute = useCallback(() => {
    if (isArchiveMode) return;
    if (!saju || !category) { setResult(null); return; }
    const start = `${viewYear}-${String(viewMonth).padStart(2, '0')}-01`;
    const lastDay = daysInMonth(viewYear, viewMonth);
    const end = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const r = calculateTaekil(saju, category, start, end, category === 'custom' ? customLabel : undefined, subItem ?? undefined);
    setResult(r);
  }, [saju, viewYear, viewMonth, category, subItem, isArchiveMode, customLabel]);

  useEffect(() => {
    compute();
  }, [compute]);

  // 카테고리 변경시 선택/결과 초기화 (보관함 모드에서는 스킵)
  // subItem은 여기서 초기화하지 않음 — 칩 onClick에서 동시에 관리
  useEffect(() => {
    if (isArchiveMode) return;
    setPickedDates([]);
    setAiAdvice(null);
    setParsedAdvice(null);
    setAiError(null);
    setShowResult(false);
    if (category !== 'custom') setCustomLabel('');
  }, [category, isArchiveMode]);

  // 연/월 변경시에도 선택 초기화 (보관함 모드에서는 스킵)
  useEffect(() => {
    if (isArchiveMode) return;
    setPickedDates([]);
    setAiAdvice(null);
    setParsedAdvice(null);
    setAiError(null);
    setShowResult(false);
  }, [viewYear, viewMonth, isArchiveMode]);

  // ── 보관함 재생 모드 ──
  useEffect(() => {
    if (!recordId) return;
    let cancelled = false;
    sajuDB.getRecordById(recordId)
      .then((record) => {
        if (cancelled || !record) return;
        const engine = record.engine_result as unknown as TaekilResult | null;
        if (engine) {
          // legacy id (marriage/moving/business/contract/travel/surgery) → 신 묶음으로 변환
          const migrated = migrateLegacyCategory(engine.category as string) ?? engine.category;
          setCategory(migrated);
          if (engine.subItem) setSubItem(engine.subItem);
          if (engine.customLabel) setCustomLabel(engine.customLabel);
          setResult({ ...engine, category: migrated });
          setPickedDates(engine.days.map(d => d.date));
        }
        const content = record.interpretation_detailed ?? record.interpretation_basic ?? '';
        if (content) {
          setAiAdvice(content);
          setParsedAdvice(parseTaekilStructuredAdvice(content));
          setShowResult(true);
        }
      })
      .catch((e) => console.error('[archive replay] taekil load failed', e));
    return () => { cancelled = true; };
  }, [recordId]);

  // ── 보관함 DB 확인 (리스트) ──
  useEffect(() => {
    if (isArchiveMode || !targetProfile) return;
    if (refetchNonce > 0) return;
    if (searchParams?.get('fresh') === '1') return;
    let cancelled = false;
    findArchiveList({
      category: 'taekil',
      birth_date: targetProfile.birth_date,
      gender: targetProfile.gender,
      profile_id: targetProfile.id,
    }).then(list => {
      if (cancelled || list.length === 0) return;
      setArchiveItems(list);
      setSavedRecordId(list[0].id);
      setShowArchiveList(true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [targetProfile, isArchiveMode, refetchNonce]);

  const prevYear = () => { if (viewYear > MIN_YEAR) setViewYear(y => y - 1); };
  const nextYear = () => { if (viewYear < MAX_YEAR) setViewYear(y => y + 1); };

  // 선택한 날짜들의 TaekilDay 데이터 (점수순 정렬)
  const pickedDays = useMemo(() => {
    if (!result || pickedDates.length === 0) return [];
    const map = new Map(result.days.map(d => [d.date, d]));
    return pickedDates
      .map(date => map.get(date))
      .filter((d): d is TaekilDay => !!d)
      .sort((a, b) => b.score - a.score);
  }, [result, pickedDates]);

  const togglePick = (date: string) => {
    if (showResult) return;
    setPickedDates(prev => {
      if (prev.includes(date)) return prev.filter(d => d !== date);
      if (prev.length >= MAX_PICKS) return prev;
      return [...prev, date];
    });
  };

  const removePick = (date: string) => {
    setPickedDates(prev => prev.filter(d => d !== date));
    setAiAdvice(null);
    setParsedAdvice(null);
    setShowResult(false);
  };

  // ── AI 호출 ──
  const handleRequestAI = async () => {
    if (!saju || !result || aiLoading || !taekilCacheKey || pickedDays.length === 0) return;
    // 기타 카테고리는 사용자 입력이 필수 (engine·prompt 모두 필요)
    if (category === 'custom' && !customLabel.trim()) {
      setAiError('어떤 행사인지 입력해 주세요. (예: 전시회 오픈, 발표회)');
      return;
    }

    const cached = useReportCacheStore.getState().getReport<string>('taekil', taekilCacheKey);
    if (cached?.error) {
      setAiError(cached.error);
      return;
    }
    if (cached?.data) {
      setAiAdvice(cached.data);
      setParsedAdvice(parseTaekilStructuredAdvice(cached.data));
      setShowResult(true);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      return;
    }

    const payload: TaekilResult = {
      ...result,
      days: pickedDays,
      bestDays: [...pickedDays].sort((a, b) => b.score - a.score),
    };

    setAiError(null);
    setAiLoading(true);
    try {
      const r = await getTaekilAdvice(saju, payload, targetProfile?.id);
      if (!r.success || !r.advice) {
        throw new Error(r.error || '길일 분석을 가져오지 못했어요.');
      }
      setAiAdvice(r.advice);
      setParsedAdvice(parseTaekilStructuredAdvice(r.advice));
      setShowResult(true);
      const cache = useReportCacheStore.getState();
      cache.setReport('taekil', taekilCacheKey, r.advice);
      if (!cache.isCharged('taekil', taekilCacheKey)) {
        cache.markCharged('taekil', taekilCacheKey);
        useCreditStore.getState()
          .chargeForContent('sun', SUN_COST_BIG, CHARGE_REASONS.taekil)
          .catch(() => {});
      }
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '오류가 발생했어요.';
      setAiError(msg);
      useReportCacheStore.getState().setError('taekil', taekilCacheKey, msg);
    } finally {
      setAiLoading(false);
    }
  };

  // 캘린더 그리드
  const calendarCells = useMemo(() => {
    if (!result) return [];
    const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay();
    const total = daysInMonth(viewYear, viewMonth);
    const dayMap = new Map<string, TaekilDay>();
    result.days.forEach(d => dayMap.set(d.date, d));
    const cells: Array<{ day: number; date: string; data: TaekilDay | null } | null> = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= total; d++) {
      const iso = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, date: iso, data: dayMap.get(iso) ?? null });
    }
    return cells;
  }, [result, viewYear, viewMonth]);

  const todayIso = useMemo(() => {
    const t = new Date();
    return t.toISOString().slice(0, 10);
  }, []);

  // ── 프로필 게이트 ──
  if (needsProfileSelect) {
    return (
      <QuickFortuneGate
        serviceName="택일 운세"
        archiveCategory="taekil"
        creditType="sun"
        creditCost={SUN_COST_BIG}
      />
    );
  }

  if (!targetProfile) {
    const ready = hydrated && lastFetchedAt !== null && !profilesLoading;
    if (!ready) return <div className={styles.loading}>로딩 중...</div>;
    return (
      <div className={styles.container}>
        <div className="flex items-center relative mb-5 pt-3 px-1">
          <BackButton className="absolute left-0" />
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>택일 운세</h1>
          </div>
        </div>
        <div className={styles.section} style={{ textAlign: 'center', padding: '48px 24px' }}>
          <h2>대표 프로필이 없어요</h2>
          <p style={{ margin: '16px 0 24px', color: 'var(--text-secondary)' }}>
            택일을 하려면 먼저 생년월일시를 등록해주세요.
          </p>
          <button className={styles.backBtn} onClick={() => router.push('/saju/input?mode=profile-only')} style={{ margin: '0 auto' }}>
            프로필 등록하기
          </button>
        </div>
      </div>
    );
  }

  if (!saju && !isArchiveMode) return <div className={styles.loading}>로딩 중...</div>;

  const catLabel = TAEKIL_CATEGORIES.find(c => c.id === category)?.label ?? '';

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className="flex items-center relative mb-5 pt-3 px-1">
        <BackButton className="absolute left-0" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>택일 운세</h1>
          <p className="text-base text-text-tertiary mt-1">
            {targetProfile.name}{isArchiveMode && catLabel ? ` · ${catLabel}` : ' · 길일을 골라드려요'}
          </p>
        </div>
      </div>

      <div className={styles.content}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

          {/* ═══ STEP 1: 행사 카테고리 선택 ═══ */}
          {!isArchiveMode && <div className={styles.section}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 24, height: 24, borderRadius: '50%',
                background: category ? 'var(--cta-primary)' : 'rgba(124,92,252,0.2)',
                fontSize: 12, fontWeight: 800, color: 'white',
              }}>1</span>
              <h2 style={{ margin: 0, fontSize: 16 }}>어떤 목적의 택일인가요?</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {TAEKIL_CATEGORIES.filter(c => c.id !== 'custom').map(cat => {
                const isActive = category === cat.id;
                return (
                  <div
                    key={cat.id}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '14px',
                      border: `2px solid ${isActive ? 'var(--cta-primary)' : 'var(--border-subtle)'}`,
                      background: isActive
                        ? 'rgba(124,92,252,0.08)'
                        : 'var(--space-elevated)',
                    }}
                  >
                    <div style={{
                      fontSize: '20px',
                      fontWeight: 800,
                      color: isActive ? 'var(--cta-primary)' : 'var(--text-primary)',
                      marginBottom: '12px',
                      textAlign: 'center',
                    }}>
                      {cat.label}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {cat.subItems.map(item => {
                        const selected = category === cat.id && subItem === item;
                        return (
                          <button
                            key={item}
                            onClick={() => {
                              setCategory(cat.id);
                              setSubItem(selected ? null : item);
                            }}
                            style={{
                              padding: '13px 4px',
                              borderRadius: '10px',
                              border: `2px solid ${selected ? 'var(--cta-primary)' : 'transparent'}`,
                              background: selected
                                ? 'rgba(124,92,252,0.25)'
                                : 'rgba(255,255,255,0.06)',
                              fontSize: '17px',
                              fontWeight: selected ? 700 : 600,
                              color: selected ? '#fff' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              textAlign: 'center',
                              whiteSpace: 'nowrap',
                              letterSpacing: '-0.02em',
                            }}
                          >
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* 기타 */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: '14px',
                  border: `2px solid ${category === 'custom' ? 'var(--cta-primary)' : 'var(--border-subtle)'}`,
                  background: category === 'custom'
                    ? 'rgba(124,92,252,0.08)'
                    : 'var(--space-elevated)',
                }}
              >
                <div style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: category === 'custom' ? 'var(--cta-primary)' : 'var(--text-primary)',
                  marginBottom: '12px',
                  textAlign: 'center',
                }}>
                  기타
                </div>
                <button
                  onClick={() => { setCategory('custom'); setSubItem(null); }}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '10px',
                    border: `2px solid ${category === 'custom' ? 'var(--cta-primary)' : 'transparent'}`,
                    background: category === 'custom'
                      ? 'rgba(124,92,252,0.25)'
                      : 'rgba(255,255,255,0.06)',
                    fontSize: '15px',
                    fontWeight: category === 'custom' ? 700 : 500,
                    color: category === 'custom' ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  직접 입력
                </button>
              </div>
            </div>

            {/* 기타 선택 시 직접 입력 */}
            {category === 'custom' && (
              <div style={{ marginTop: 14 }}>
                <label style={{
                  display: 'block', fontSize: 12, fontWeight: 700,
                  color: 'var(--text-secondary)', marginBottom: 6,
                }}>
                  어떤 행사인가요?
                </label>
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value.slice(0, 30))}
                  placeholder="예: 전시회 오픈, 발표회, 첫 데이트, 부동산 청약…"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle)',
                    background: 'rgba(20,12,38,0.55)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
                  입력한 행사 이름과 사주 원국·일진을 함께 분석해 풀이해드려요. 30자 이내로 짧고 명확하게 적어주세요.
                </p>
              </div>
            )}
          </div>}

          {/* ═══ STEP 2: 캘린더에서 날짜 선택 (하위항목 선택 or custom 입력 후 노출) ═══ */}
          <AnimatePresence>
            {category && (
              category === 'custom' ? customLabel.trim().length > 0 : !!subItem
            ) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                {!isArchiveMode && (<>
                <div className={styles.section}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 24, height: 24, borderRadius: '50%',
                      background: pickedDates.length > 0 ? 'var(--cta-primary)' : 'rgba(124,92,252,0.2)',
                      fontSize: 12, fontWeight: 800, color: 'white',
                    }}>2</span>
                    <h2 style={{ margin: 0, fontSize: 16 }}>후보 날짜를 골라주세요</h2>
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: 13, fontWeight: 700,
                      color: pickedDates.length >= MAX_PICKS ? '#34D399' : 'var(--text-tertiary)',
                    }}>
                      {pickedDates.length} / {MAX_PICKS}
                    </span>
                  </div>

                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14, lineHeight: 1.5 }}>
                    {catLabel}에 고려 중인 날짜를 최대 {MAX_PICKS}개 선택하면, 각 날짜의 길흉을 분석해드려요.
                  </p>

                  {/* 연도 네비 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <button
                      onClick={prevYear}
                      disabled={viewYear <= MIN_YEAR}
                      style={{
                        background: 'var(--space-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px', padding: '8px 16px',
                        color: viewYear <= MIN_YEAR ? 'var(--text-tertiary)' : 'var(--text-primary)',
                        cursor: viewYear <= MIN_YEAR ? 'not-allowed' : 'pointer',
                        fontSize: '16px', fontWeight: 700,
                        opacity: viewYear <= MIN_YEAR ? 0.4 : 1,
                      }}
                    >
                      ◀
                    </button>
                    <h2 style={{ margin: 0, fontSize: 20, fontFamily: 'var(--font-serif)' }}>
                      {viewYear}년
                    </h2>
                    <button
                      onClick={nextYear}
                      disabled={viewYear >= MAX_YEAR}
                      style={{
                        background: 'var(--space-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px', padding: '8px 16px',
                        color: viewYear >= MAX_YEAR ? 'var(--text-tertiary)' : 'var(--text-primary)',
                        cursor: viewYear >= MAX_YEAR ? 'not-allowed' : 'pointer',
                        fontSize: '16px', fontWeight: 700,
                        opacity: viewYear >= MAX_YEAR ? 0.4 : 1,
                      }}
                    >
                      ▶
                    </button>
                  </div>

                  {/* 월 선택 */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: '4px', marginBottom: '14px',
                  }}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                      const isCurrent = m === viewMonth;
                      const isPast = viewYear === todayYear && m < today.getMonth() + 1;
                      return (
                        <button
                          key={m}
                          onClick={() => !isPast && setViewMonth(m)}
                          disabled={isPast}
                          style={{
                            padding: '8px 4px', borderRadius: 8,
                            border: isCurrent ? '1.5px solid var(--cta-primary)' : '1px solid var(--border-subtle)',
                            background: isCurrent ? 'rgba(232,164,144,0.18)' : isPast ? 'rgba(20,12,38,0.3)' : 'var(--space-elevated)',
                            color: isCurrent ? 'var(--cta-primary)' : isPast ? 'var(--text-tertiary)' : 'var(--text-primary)',
                            fontSize: 13, fontWeight: isCurrent ? 700 : 500,
                            cursor: isPast ? 'not-allowed' : 'pointer',
                            opacity: isPast ? 0.4 : 1,
                            transition: 'all 0.15s',
                          }}
                        >
                          {m}월
                        </button>
                      );
                    })}
                  </div>

                  {/* 요일 헤더 */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '2px', textAlign: 'center', marginBottom: '4px',
                  }}>
                    {WEEKDAYS.map((w, i) => (
                      <span key={w} style={{
                        fontSize: '12px', fontWeight: 600, padding: '4px 0',
                        color: i === 0 ? '#F87171' : i === 6 ? '#60A5FA' : 'var(--text-tertiary)',
                      }}>
                        {w}
                      </span>
                    ))}
                  </div>

                  {/* 날짜 그리드 */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '2px',
                  }}>
                    {calendarCells.map((cell, i) => {
                      if (!cell) return <div key={`empty-${i}`} />;
                      const d = cell.data;
                      const isToday = cell.date === todayIso;
                      const isPicked = pickedDates.includes(cell.date);
                      const isFull = pickedDates.length >= MAX_PICKS && !isPicked;
                      const dow = new Date(cell.date).getDay();
                      return (
                        <button
                          key={cell.date}
                          onClick={() => d && !showResult && togglePick(cell.date)}
                          disabled={!d || (isFull && !showResult)}
                          style={{
                            aspectRatio: '1',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            borderRadius: '10px',
                            border: isPicked ? '2px solid var(--cta-primary)'
                              : isToday ? '1px solid rgba(255,255,255,0.3)'
                              : '1px solid transparent',
                            background: isPicked
                              ? 'rgba(124,92,252,0.22)'
                              : 'var(--space-elevated)',
                            cursor: (!d || showResult || isFull) ? 'default' : 'pointer',
                            transition: 'all 0.15s',
                            padding: '2px',
                            position: 'relative',
                            opacity: (isFull && !showResult) ? 0.4 : 1,
                          }}
                        >
                          {isPicked && (
                            <span style={{
                              position: 'absolute', top: 1, right: 2,
                              fontSize: 9, fontWeight: 800, color: 'var(--cta-primary)',
                              background: 'rgba(124,92,252,0.15)',
                              borderRadius: 4, padding: '0 3px',
                            }}>
                              {pickedDates.indexOf(cell.date) + 1}
                            </span>
                          )}
                          <span style={{
                            fontSize: '14px', fontWeight: isToday ? 800 : 600,
                            color: dow === 0 ? '#F87171' : dow === 6 ? '#60A5FA' : 'var(--text-primary)',
                          }}>
                            {cell.day}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 10, opacity: 0.6 }}>
                    날짜를 탭하면 후보에 추가돼요 (다시 탭하면 해제)
                  </p>
                </div>

                {/* 선택된 날짜 칩 */}
                {pickedDates.length > 0 && (
                  <div className={styles.section} style={{ paddingTop: 12, paddingBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                      선택한 후보 날짜
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {pickedDates.map((date) => {
                        const dayNum = parseInt(date.split('-')[2]);
                        const mon = parseInt(date.split('-')[1]);
                        const dow = WEEKDAYS[new Date(date).getDay()];
                        return (
                          <div key={date} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '6px 10px',
                            background: 'rgba(124,92,252,0.12)',
                            border: '1px solid rgba(124,92,252,0.3)',
                            borderRadius: 10,
                          }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                              {mon}/{dayNum}({dow})
                            </span>
                            {/* 등급(평·길)은 풀이 결과 영역에서만 노출 — 후보 단계에선 날짜만 */}
                            {!showResult && (
                              <button
                                onClick={() => removePick(date)}
                                style={{
                                  background: 'none', border: 'none',
                                  color: 'var(--text-tertiary)', cursor: 'pointer',
                                  fontSize: 14, lineHeight: 1, padding: 0,
                                }}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ═══ STEP 3: 풀이 요청 버튼 ═══ */}
                {pickedDates.length > 0 && !showResult && !aiLoading && (
                  <div className={styles.section} style={{ paddingTop: 12, paddingBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 24, height: 24, borderRadius: '50%',
                        background: 'rgba(124,92,252,0.2)',
                        fontSize: 12, fontWeight: 800, color: 'white',
                      }}>3</span>
                      <h2 style={{ margin: 0, fontSize: 16 }}>택일 풀이 받기</h2>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 14 }}>
                      선택한 {pickedDates.length}개 날짜를 {catLabel} 관점에서 분석하고, 최적의 날짜를 추천해드려요.
                    </p>
                    <button
                      onClick={handleRequestAI}
                      style={{
                        width: '100%',
                        padding: '16px',
                        borderRadius: 14,
                        background: 'var(--cta-primary)',
                        color: 'white',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: 16,
                        cursor: 'pointer',
                      }}
                    >
                      택일 운세 풀이보기
                    </button>
                    {aiError && (
                      <div style={{
                        marginTop: 12, padding: 12, borderRadius: 10,
                        background: 'rgba(248,113,113,0.1)',
                        border: '1px solid rgba(248,113,113,0.35)',
                      }}>
                        <p style={{ fontSize: 13, color: '#F87171', margin: 0, marginBottom: 6 }}>
                          {aiError}
                        </p>
                        <button
                          onClick={handleRequestAI}
                          style={{
                            background: 'none', border: 'none', fontSize: 13,
                            color: 'var(--cta-primary)', fontWeight: 600,
                            textDecoration: 'underline', cursor: 'pointer', padding: 0,
                          }}
                        >
                          다시 시도
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 로딩 */}
                {aiLoading && (
                  <div className={styles.section}>
                    <div style={{
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', padding: '32px 16px', gap: 12,
                    }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cta-primary)' }} className="animate-pulse" />
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cta-primary)', animationDelay: '0.2s' }} className="animate-pulse" />
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--cta-primary)', animationDelay: '0.4s' }} className="animate-pulse" />
                      </div>
                      <p style={{ fontSize: 14, color: 'var(--text-tertiary)', margin: 0, fontWeight: 600 }}>
                        {pickedDates.length}개 날짜 분석 중...
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0, opacity: 0.6 }}>
                        약 30초~1분 정도 소요돼요
                      </p>
                    </div>
                  </div>
                )}

                </>)}

                {/* ═══ RESULT: 포디움 + 상세 카드 ═══ */}
                {showResult && aiAdvice && (
                  <div ref={resultRef}>
                    {/* 포디움 — 점수순 Top 3 */}
                    {pickedDays.length > 0 && (
                      <div className={styles.section}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                          <span style={{ display: 'inline-block', width: 4, height: 20, borderRadius: 2, background: '#34D399' }} />
                          <h2 style={{ margin: 0, fontSize: 17, fontFamily: 'var(--font-serif)' }}>
                            {catLabel} 추천 순위
                          </h2>
                        </div>

                        <div style={{
                          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                          gap: 8, padding: '0 4px',
                        }}>
                          {(() => {
                            const top = pickedDays.slice(0, 3);
                            const podiumOrder = top.length >= 3
                              ? [{ d: top[1], rank: 2, h: 120 }, { d: top[0], rank: 1, h: 155 }, { d: top[2], rank: 3, h: 100 }]
                              : top.length === 2
                              ? [{ d: top[0], rank: 1, h: 155 }, { d: top[1], rank: 2, h: 120 }]
                              : [{ d: top[0], rank: 1, h: 155 }];
                            const rankBadge = ['', '1st', '2nd', '3rd'];
                            const rankColor = ['', '#FFD700', '#C0C0C0', '#CD7F32'];
                            return podiumOrder.map(({ d, rank, h }) => {
                              const dayNum = parseInt(d.date.split('-')[2]);
                              const mon = parseInt(d.date.split('-')[1]);
                              const dow = WEEKDAYS[new Date(d.date).getDay()];
                              return (
                                <div
                                  key={d.date}
                                  style={{
                                    flex: rank === 1 ? '1.2' : '1',
                                    minHeight: h,
                                    padding: '14px 6px 12px',
                                    background: rank === 1
                                      ? 'linear-gradient(180deg, rgba(255,215,0,0.15) 0%, rgba(124,92,252,0.12) 100%)'
                                      : 'var(--space-elevated)',
                                    border: rank === 1
                                      ? '1.5px solid rgba(255,215,0,0.4)'
                                      : '1px solid var(--border-subtle)',
                                    borderRadius: 16,
                                    textAlign: 'center',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <span style={{
                                    fontSize: rank === 1 ? 13 : 11,
                                    fontWeight: 800, color: rankColor[rank],
                                    letterSpacing: '0.05em',
                                  }}>
                                    {rankBadge[rank]}
                                  </span>
                                  <span style={{
                                    fontSize: rank === 1 ? 28 : 22,
                                    fontWeight: 900, color: 'var(--text-primary)',
                                    lineHeight: 1.1,
                                  }}>
                                    {dayNum}
                                  </span>
                                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                    {mon}월 ({dow})
                                  </span>
                                  <span style={{
                                    marginTop: 4,
                                    padding: '3px 10px', borderRadius: 99,
                                    fontSize: 11, fontWeight: 700,
                                    color: GRADE_COLOR[d.grade],
                                    background: GRADE_BG[d.grade],
                                    border: `1px solid ${GRADE_COLOR[d.grade]}40`,
                                  }}>
                                    {d.grade} · {d.score}점
                                  </span>
                                </div>
                              );
                            });
                          })()}
                        </div>

                        {/* 점수 바 그래프 — 전체 선택 날짜 */}
                        {pickedDays.length > 1 && (
                          <div style={{ marginTop: 18 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {pickedDays.map((d) => (
                                <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 11, width: 50, color: 'var(--text-secondary)', flexShrink: 0 }}>
                                    {d.date.slice(5).replace('-', '/')}
                                  </span>
                                  <div style={{
                                    flex: 1, height: 16, borderRadius: 6,
                                    background: 'rgba(255,255,255,0.05)',
                                    position: 'relative', overflow: 'hidden',
                                  }}>
                                    <div style={{
                                      width: `${d.score}%`, height: '100%',
                                      background: GRADE_COLOR[d.grade],
                                      opacity: 0.85, borderRadius: 6,
                                      transition: 'width 0.4s ease',
                                    }} />
                                    <span style={{
                                      position: 'absolute', right: 6, top: 0,
                                      fontSize: 10, fontWeight: 700,
                                      color: 'var(--text-primary)',
                                      textShadow: '0 0 4px rgba(0,0,0,0.6)',
                                    }}>
                                      {d.score}
                                    </span>
                                  </div>
                                  <span style={{
                                    fontSize: 10, fontWeight: 700, width: 28, textAlign: 'right',
                                    color: GRADE_COLOR[d.grade], flexShrink: 0,
                                  }}>
                                    {d.grade}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI 상세 카드 — 오행 에너지 + 시간 에너지 + 종합 풀이 */}
                    <div className={styles.section}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <span style={{ display: 'inline-block', width: 4, height: 20, borderRadius: 2, background: 'var(--cta-primary)' }} />
                        <h2 style={{ margin: 0, fontSize: 17, fontFamily: 'var(--font-serif)' }}>
                          날짜별 상세 풀이
                        </h2>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {parsedAdvice && parsedAdvice.dates.length > 0 ? (
                          <>
                            {parsedAdvice.dates.map((adv, idx) => {
                              const topDay = pickedDays[idx];
                              const rankLabel = [`1위`, `2위`, `3위`][idx] ?? `${idx + 1}위`;
                              const rankColor = ['#FFD700', '#C0C0C0', '#CD7F32'][idx] ?? 'var(--text-secondary)';
                              const ELEMENT_COLORS: Record<string, string> = {
                                '목': '#2D8659', '화': '#E63946', '토': '#F4A261', '금': '#94A3B8', '수': '#3B82F6',
                              };
                              const elEnergy = topDay?.elementEnergy;
                              const timeSlots = topDay?.timeSlots;
                              const peakSlots = timeSlots?.filter(t => t.energy >= 7) ?? [];
                              const maxTimeEnergy = timeSlots ? Math.max(...timeSlots.map(t => t.energy)) : 10;

                              return (
                                <div
                                  key={idx}
                                  style={{
                                    padding: 16,
                                    background: idx === 0
                                      ? 'linear-gradient(135deg, rgba(255,215,0,0.08) 0%, rgba(20,12,38,0.55) 40%)'
                                      : 'rgba(20,12,38,0.55)',
                                    borderRadius: 14,
                                    border: idx === 0
                                      ? '1px solid rgba(255,215,0,0.25)'
                                      : '1px solid var(--border-subtle)',
                                  }}
                                >
                                  {/* Header */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                    <span style={{
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      width: 28, height: 28, borderRadius: '50%',
                                      background: `${rankColor}22`,
                                      border: `1.5px solid ${rankColor}`,
                                      fontSize: 11, fontWeight: 800, color: rankColor,
                                    }}>
                                      {rankLabel}
                                    </span>
                                    {topDay && (
                                      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                                        {topDay.date} ({WEEKDAYS[new Date(topDay.date).getDay()]})
                                      </span>
                                    )}
                                    {topDay && (
                                      <span style={{
                                        padding: '2px 8px', borderRadius: 99,
                                        fontSize: 11, fontWeight: 700,
                                        color: GRADE_COLOR[topDay.grade],
                                        background: GRADE_BG[topDay.grade],
                                      }}>
                                        {topDay.grade}
                                      </span>
                                    )}
                                  </div>

                                  {/* 키워드 태그 */}
                                  {adv.keywords.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                                      {adv.keywords.map((kw, ki) => (
                                        <span key={ki} style={{
                                          padding: '4px 10px', borderRadius: 99,
                                          fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
                                          color: 'var(--cta-primary)',
                                          background: 'rgba(124,92,252,0.12)',
                                          border: '1px solid rgba(124,92,252,0.25)',
                                        }}>
                                          {kw}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* 오행 에너지 바 */}
                                  {elEnergy && (
                                    <div style={{
                                      marginBottom: 14, padding: '12px 14px',
                                      background: 'rgba(255,255,255,0.03)', borderRadius: 12,
                                      border: '1px solid rgba(255,255,255,0.06)',
                                    }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 10 }}>
                                        오행 에너지
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        {(['목', '화', '토', '금', '수'] as const).map((el) => (
                                          <div key={el} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{
                                              width: 16, fontSize: 12, fontWeight: 800,
                                              color: ELEMENT_COLORS[el], textAlign: 'center',
                                            }}>{el}</span>
                                            <div style={{
                                              flex: 1, height: 10, borderRadius: 5,
                                              background: 'rgba(255,255,255,0.05)',
                                              overflow: 'hidden',
                                            }}>
                                              <div style={{
                                                width: `${(elEnergy[el] ?? 1) * 10}%`, height: '100%',
                                                borderRadius: 5,
                                                background: `linear-gradient(90deg, ${ELEMENT_COLORS[el]}88, ${ELEMENT_COLORS[el]})`,
                                                transition: 'width 0.5s ease',
                                              }} />
                                            </div>
                                            <span style={{
                                              width: 16, fontSize: 10, fontWeight: 700,
                                              color: 'var(--text-tertiary)', textAlign: 'right',
                                            }}>{elEnergy[el]}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* 종합 분석 */}
                                  {adv.summary && (
                                    <div style={{ marginBottom: 14 }}>
                                      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.85, margin: 0, whiteSpace: 'pre-line' }}>
                                        {adv.summary}
                                      </p>
                                    </div>
                                  )}

                                  {/* 시간 에너지 맵 */}
                                  {timeSlots && timeSlots.length > 0 && (
                                    <div style={{
                                      padding: '16px 14px',
                                      background: 'rgba(255,255,255,0.03)', borderRadius: 12,
                                      border: '1px solid rgba(255,255,255,0.06)',
                                    }}>
                                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14 }}>
                                        시간 에너지 흐름
                                      </div>
                                      <div style={{
                                        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                                        gap: 3, height: 68, padding: '0 2px',
                                      }}>
                                        {timeSlots.map((slot) => {
                                          const isPeak = slot.energy >= 7;
                                          const barH = Math.max(8, (slot.energy / maxTimeEnergy) * 68);
                                          return (
                                            <div key={slot.zhi} style={{
                                              display: 'flex', flexDirection: 'column', alignItems: 'center',
                                              flex: 1, gap: 3,
                                            }}>
                                              <div style={{
                                                width: '100%', maxWidth: 24,
                                                height: barH, borderRadius: 4,
                                                background: isPeak
                                                  ? 'linear-gradient(180deg, #34D399, rgba(52,211,153,0.4))'
                                                  : slot.energy <= 3
                                                    ? 'rgba(248,113,113,0.3)'
                                                    : 'rgba(148,163,184,0.2)',
                                                transition: 'height 0.4s ease',
                                              }} />
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div style={{
                                        display: 'flex', justifyContent: 'space-between',
                                        marginTop: 8, padding: '0 2px',
                                      }}>
                                        {timeSlots.map((slot) => (
                                          <span key={slot.zhi} style={{
                                            flex: 1, textAlign: 'center',
                                            fontSize: 14, fontWeight: slot.energy >= 7 ? 800 : 600,
                                            color: slot.energy >= 7 ? '#34D399' : 'var(--text-secondary)',
                                            letterSpacing: '-0.01em',
                                          }}>
                                            {slot.zhi}
                                          </span>
                                        ))}
                                      </div>
                                      {peakSlots.length > 0 && (
                                        <div style={{
                                          marginTop: 14,
                                          paddingTop: 12,
                                          borderTop: '1px solid rgba(255,255,255,0.06)',
                                          fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75,
                                          wordBreak: 'keep-all',
                                        }}>
                                          <span style={{ color: '#34D399', fontWeight: 700 }}>에너지 집중 구간</span>
                                          {' · '}
                                          {peakSlots.map(s => `${s.name}(${s.hours})`).join(', ')}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {parsedAdvice.avoid && (
                              <div style={{
                                padding: 14,
                                background: 'rgba(248,113,113,0.06)',
                                borderRadius: 14,
                                border: '1px solid rgba(248,113,113,0.25)',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: 22, height: 22, borderRadius: '50%',
                                    background: 'rgba(248,113,113,0.15)',
                                    fontSize: 11, fontWeight: 800, color: '#F87171',
                                  }}>!</span>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: '#F87171' }}>피해야 할 날</span>
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>
                                  {parsedAdvice.avoid}
                                </p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{
                            padding: 16,
                            background: 'rgba(20,12,38,0.55)',
                            borderRadius: 14,
                            border: '1px solid var(--border-subtle)',
                            fontSize: 15,
                            color: 'var(--text-secondary)',
                            lineHeight: 1.85,
                            whiteSpace: 'pre-line',
                          }}>
                            {aiAdvice
                              .replace(/^\s*\[(?:top\d|avoid)\].*$/gm, '')
                              .trim()}
                          </div>
                        )}
                      </div>

                      {/* 다시하기 (보관함 모드에서는 숨김) */}
                      {!isArchiveMode && (
                        <button
                          onClick={() => {
                            setPickedDates([]);
                            setAiAdvice(null);
                            setParsedAdvice(null);
                            setAiError(null);
                            setShowResult(false);
                          }}
                          style={{
                            width: '100%', marginTop: 16,
                            padding: '14px', borderRadius: 12,
                            background: 'transparent',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)',
                            fontWeight: 600, fontSize: 14,
                            cursor: 'pointer',
                          }}
                        >
                          다른 날짜로 다시 풀이받기
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </div>

      {(recordId || savedRecordId) && (
        <div style={{ marginTop: 24, padding: '0 16px' }}>
          <ShareBar recordId={(recordId || savedRecordId)!} type="saju" category="taekil" />
        </div>
      )}

      {/* 보관함 리스트 모달 */}
      <AnimatePresence>
        {showArchiveList && archiveItems.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowArchiveList(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="fixed inset-0 z-50 flex items-center justify-center px-5 pointer-events-none"
            >
              <div className="relative w-full max-w-[380px] rounded-2xl bg-[rgba(20,12,38,0.97)] border border-[var(--border-subtle)] p-6 text-center shadow-2xl pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setShowArchiveList(false)}
                  className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary hover:bg-white/10 transition-colors"
                  aria-label="닫기"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
                <h3 className="text-[17px] font-bold text-text-primary mb-2">이전 택일 기록이 있어요</h3>
                <p className="text-[14px] text-text-secondary leading-relaxed mb-3">
                  다시 보고 싶은 결과를 선택하세요.
                </p>
                <div className="max-h-[200px] overflow-y-auto space-y-1.5 mb-4 px-1">
                  {archiveItems.map(item => {
                    const dateLabel = new Date(item.created_at).toLocaleDateString('ko-KR');
                    const catLabel = item.context_category_label;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setShowArchiveList(false);
                          const params = new URLSearchParams(window.location.search);
                          params.set('recordId', item.id);
                          router.replace(`${window.location.pathname}?${params.toString()}`);
                        }}
                        className="w-full min-h-10 py-2 px-3 rounded-lg border border-[var(--border-subtle)] text-[14px] text-text-primary font-medium hover:bg-cta/10 hover:border-cta/40 transition-all flex items-center justify-between gap-2"
                      >
                        <span className="flex items-center gap-2">
                          {catLabel && <span className="text-[12px] font-bold text-cta bg-cta/10 px-2 py-0.5 rounded-md">{catLabel}</span>}
                          <span>{dateLabel}</span>
                        </span>
                        <span className="text-[12px] text-text-tertiary flex-shrink-0">결과 보기</span>
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => { setShowArchiveList(false); setRefetchNonce(n => n + 1); }}
                    className="block w-full h-12 rounded-lg bg-gradient-to-r from-cta to-cta-active text-white font-bold text-[15px] hover:opacity-90 transition-all"
                  >
                    새로 풀이 받기
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowArchiveList(false)}
                    className="block w-full h-12 rounded-lg border border-[var(--border-subtle)] text-text-secondary font-medium text-[15px] hover:bg-white/5 transition-all"
                  >
                    취소
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
