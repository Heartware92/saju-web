'use client';

/**
 * 택일 운세 페이지 — 스텝 기반 UX
 * Step 1: 행사 카테고리 선택
 * Step 2: 캘린더에서 후보 날짜 최대 5개 선택
 * Step 3: "택일 풀이보기" → AI 분석 결과 (포디움 + 상세 카드)
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  type TaekilCategory,
  type TaekilDay,
  type TaekilResult,
} from '../engine/taekil';
import { supabase } from '../services/supabase';
import { generateTaekilAdvicePrompt } from '../constants/prompts';
import { pickTaekilDetailHint, TAEKIL_DETAIL_MAX_LEN } from '../constants/taekilDetailHints';
import { useLoadingGuard } from '../hooks/useLoadingGuard';
import { AILoadingBar } from '../components/AILoadingBar';
import { truncateTaekilLabel } from '../utils/truncateTaekilLabel';
import styles from './SajuResultPage.module.css';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_PICKS = 5;

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
  /** 사용자가 선택한 행사에 대해 더 자세한 정황(100자 이내). prompt 의 [상세 입력] 블록으로 전달되어
   *  1·2·3위 풀이와 "OO에 대한 조언" 영역이 이 입력을 반영하도록 한다. */
  const [detail, setDetail] = useState('');

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

  // AI 호출 상태 (결과 자체는 새 페이지로 navigate 하므로 보관 안 함)
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [aiTimedOut] = useLoadingGuard(aiLoading, 140_000);
  useEffect(() => {
    if (aiTimedOut) {
      setAiLoading(false);
      setAiError('응답이 너무 오래 걸려요. 새로고침 후 다시 시도해주세요.');
    }
  }, [aiTimedOut]);

  const [archiveItems, setArchiveItems] = useState<ArchiveListItem[]>([]);
  const [showArchiveList, setShowArchiveList] = useState(false);
  const [refetchNonce, setRefetchNonce] = useState(0);

  const taekilCacheKey = useMemo(() => {
    if (!saju || !category || pickedDates.length === 0) return null;
    if (category === 'custom' && !customLabel.trim()) return null;
    const subSeg = subItem ? `:${subItem}` : '';
    const customSeg = category === 'custom' ? `:${customLabel.trim().slice(0, 30)}` : '';
    const detailSeg = detail.trim() ? `:d=${detail.trim().slice(0, 100)}` : '';
    // v2: prompt 에 [comprehensive_analysis] 마커 + 흉신 풀이 가이드 + 조언 다양화 추가됨.
    // 옛 캐시(v1) 는 새 마커 없이 응답 → 종합 분석 섹션이 비어 미노출되는 사고 회피.
    return `v2:${sajuKey(saju)}:${category}${subSeg}${customSeg}${detailSeg}:${[...pickedDates].sort().join(',')}`;
  }, [saju, category, subItem, pickedDates, customLabel, detail]);

  // 카테고리/연월 변경시 엔진 재계산 (보관함 모드에서는 스킵)
  // ★ pickedDates 가 viewMonth 밖 날짜를 포함하면 range 확장 — 여러 달 후보 통합 풀이 위해.
  //   캘린더 셀 표시는 calendarCells 에서 viewMonth 만 잘라서 그리므로 시각 영향 없음.
  const compute = useCallback(() => {
    if (isArchiveMode) return;
    if (!saju || !category) { setResult(null); return; }
    let start = `${viewYear}-${String(viewMonth).padStart(2, '0')}-01`;
    const lastDay = daysInMonth(viewYear, viewMonth);
    let end = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    if (pickedDates.length > 0) {
      const sorted = [...pickedDates].sort();
      const minPicked = sorted[0];
      const maxPicked = sorted[sorted.length - 1];
      if (minPicked < start) {
        const [y, m] = minPicked.split('-');
        start = `${y}-${m}-01`;
      }
      if (maxPicked > end) {
        const [yStr, mStr] = maxPicked.split('-');
        const y = Number(yStr);
        const m = Number(mStr);
        const last = daysInMonth(y, m);
        end = `${yStr}-${mStr}-${String(last).padStart(2, '0')}`;
      }
    }
    const r = calculateTaekil(saju, category, start, end, category === 'custom' ? customLabel : undefined, subItem ?? undefined);
    setResult(r);
  }, [saju, viewYear, viewMonth, category, subItem, isArchiveMode, customLabel, pickedDates]);

  useEffect(() => {
    compute();
  }, [compute]);

  // 카테고리 변경시 선택/결과 초기화 (보관함 모드에서는 스킵)
  // subItem은 여기서 초기화하지 않음 — 칩 onClick에서 동시에 관리
  useEffect(() => {
    if (isArchiveMode) return;
    setPickedDates([]);
    setAiError(null);
    if (category !== 'custom') setCustomLabel('');
  }, [category, isArchiveMode]);

  // 연/월 변경시 결과 영역만 리셋 — pickedDates 는 유지 (여러 달 후보 비교 가능)
  // 사용자가 5월에서 1~2개, 6월에서 1~2개 골라서 총 후보 비교하는 케이스 지원
  useEffect(() => {
    if (isArchiveMode) return;
    setAiError(null);
  }, [viewYear, viewMonth, isArchiveMode]);

  // ── URL 에 recordId 가 있으면 결과 페이지로 즉시 redirect (legacy 진입 호환) ──
  useEffect(() => {
    if (!recordId) return;
    router.replace(`/saju/taekil/result?recordId=${recordId}`);
  }, [recordId, router]);

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
      setShowArchiveList(true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [targetProfile, isArchiveMode, refetchNonce, searchParams]);

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
    setPickedDates(prev => {
      if (prev.includes(date)) return prev.filter(d => d !== date);
      if (prev.length >= MAX_PICKS) return prev;
      return [...prev, date];
    });
  };

  const removePick = (date: string) => {
    setPickedDates(prev => prev.filter(d => d !== date));
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
    // 캐시된 결과가 있으면 fortuneService 가 archive 재사용 (자동 dedup)
    // 결과는 어쨌든 새 페이지로 navigate

    const payload: TaekilResult = {
      ...result,
      days: pickedDays,
      bestDays: [...pickedDays].sort((a, b) => b.score - a.score),
    };

    setAiError(null);
    setAiLoading(true);
    // 로딩 시작 시각 — 결과 페이지 AILoadingBar 가 fortuneJob 도착 전에도
    // 이 시각 기준 경과율로 시작하도록 URL 로 전달 (20%→0% 반짝 사고 차단).
    const loadStartedAt = Date.now();
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('로그인이 만료됐어요. 다시 로그인해주세요.');

      const prompt = generateTaekilAdvicePrompt(saju, payload, detail.trim() || undefined);
      const minuteBucket = Math.floor(Date.now() / 60000);
      const idempotencyKey = `${taekilCacheKey}:${minuteBucket}`;
      const res = await fetch('/api/fortune/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          category: 'taekil',
          sajuResult: saju,
          prompt,
          profileId: targetProfile?.id,
          sourceBirth: {
            birthDate: targetProfile?.birth_date ?? '',
            birthTime: targetProfile?.birth_time ?? null,
            birthPlace: targetProfile?.birth_place ?? null,
            gender: (targetProfile?.gender ?? 'male') as 'male' | 'female',
            calendarType: (targetProfile?.calendar_type ?? 'solar') as 'solar' | 'lunar',
          },
          engineResult: { ...(payload as unknown as Record<string, unknown>), userDetail: detail.trim() },
          idempotencyKey,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '풀이 요청에 실패했어요.');
      }
      const { jobId } = (await res.json()) as { jobId: string };
      // 결과 페이지로 navigate — TaekilResultPage 가 ?jobId 로 Realtime 구독.
      // ?t= 로 로딩 시작 시각 전달 → 결과 페이지 로딩바가 0% 부터 새로 시작하지 않음.
      router.push(`/saju/taekil/result?jobId=${jobId}&t=${loadStartedAt}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '오류가 발생했어요.';
      setAiError(msg);
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
        creditType="moon"
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

  // 풀이 요청 후 — 다른 운세 페이지와 일관되게 전체화면 로딩.
  // 잡 생성(POST) 동안 표시되고, jobId 받으면 결과 페이지로 router.push → 거기서 모래시계 이어짐.
  if (aiLoading) {
    return (
      <AILoadingBar
        label="택일 운세 분석중"
        minLabel="20초"
        maxLabel="1분"
        estimatedSeconds={35}
        messages={[
          '선택한 날짜의 일진을 분석하는 중입니다',
          '사주 원국과의 합충을 짚는 중입니다',
          '흉신·길신을 검토하는 중입니다',
          '최적의 날짜를 가려내는 중입니다',
        ]}
      />
    );
  }

  const catLabel = TAEKIL_CATEGORIES.find(c => c.id === category)?.label ?? '';

  // 칩(또는 기타 직접입력) 선택 시 다른 카테고리 그룹을 접어 보기 좋게.
  //  - subItem 선택 또는 category='custom' 이면 collapsed=true
  //  - 칩을 다시 눌러 해제(subItem=null)하면 모든 카테고리 다시 표시
  const collapsed = subItem !== null || category === 'custom';

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
              {collapsed && (
                <p style={{
                  margin: '0 0 2px', fontSize: 13, color: 'var(--text-tertiary)',
                  textAlign: 'center', letterSpacing: '-0.01em',
                }}>
                  선택한 칩을 다시 누르면 다른 목적도 볼 수 있어요
                </p>
              )}
              {TAEKIL_CATEGORIES.filter(c => c.id !== 'custom')
                .filter(c => !collapsed || category === c.id)
                .map(cat => {
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

              {/* 기타 — collapsed 상태에서 custom 이 아니면 숨김 */}
              {(!collapsed || category === 'custom') && (
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
              )}
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

          {/* ═══ STEP 1.5: 선택한 행사에 대한 상세 입력 (하위항목 선택 or custom 입력 후 노출) ═══ */}
          {!isArchiveMode && (
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
                  <div className={styles.section}>
                    {/* 선택된 카테고리 표시 + 상세 입력 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 24, height: 24, borderRadius: '50%',
                        background: detail.trim().length > 0 ? 'var(--cta-primary)' : 'rgba(124,92,252,0.2)',
                        fontSize: 12, fontWeight: 800, color: 'white',
                      }}>2</span>
                      <h2 style={{ margin: 0, fontSize: 16 }}>자세히 알려주세요 (선택)</h2>
                    </div>

                    {/* 선택된 행사 칩 — 사용자가 어떤 행사인지 다시 확인 */}
                    <div style={{ marginBottom: 10 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px', borderRadius: 999,
                        background: 'rgba(124,92,252,0.18)',
                        border: '1px solid var(--cta-primary)',
                        fontSize: 13, fontWeight: 700,
                        color: 'var(--cta-primary)',
                      }}>
                        {catLabel}
                        {(category === 'custom' ? customLabel : subItem) && (
                          <>
                            <span style={{ opacity: 0.5 }}>·</span>
                            <span style={{ color: 'var(--text-primary)' }}>
                              {category === 'custom' ? customLabel : subItem}
                            </span>
                          </>
                        )}
                      </span>
                    </div>

                    <textarea
                      value={detail}
                      onChange={e => setDetail(e.target.value.slice(0, TAEKIL_DETAIL_MAX_LEN))}
                      placeholder={pickTaekilDetailHint(category, subItem) + ' (선택, 비워두셔도 풀이됩니다)'}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: 12,
                        border: '1px solid var(--border-subtle)',
                        background: 'rgba(20,12,38,0.55)',
                        color: 'var(--text-primary)',
                        fontSize: 14,
                        lineHeight: 1.5,
                        outline: 'none',
                        resize: 'none',
                        fontFamily: 'var(--font-body)',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: detail.length >= TAEKIL_DETAIL_MAX_LEN ? 'var(--cta-primary)' : 'var(--text-tertiary)' }}>
                        {detail.length}/{TAEKIL_DETAIL_MAX_LEN}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

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
                            border: `1.5px solid ${isCurrent ? 'var(--cta-primary)' : 'var(--border-subtle)'}`,
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
                      // 택일 운세는 앞으로 할 일에 좋은 날을 고르는 미래 지향 서비스 — 지난 날짜는 선택 불가.
                      // 월 단위는 이미 isPast 로 막혀 있는데, 같은 월 안의 과거 일자가 열려 있어 룰 불일치 → 동일 차단.
                      const isPast = cell.date < todayIso;
                      const dow = new Date(cell.date).getDay();
                      return (
                        <button
                          key={cell.date}
                          onClick={() => d && !isPast && togglePick(cell.date)}
                          disabled={!d || isFull || isPast}
                          style={{
                            aspectRatio: '1',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            borderRadius: '10px',
                            border: `2px solid ${isPicked
                              ? 'var(--cta-primary)'
                              : isToday ? 'rgba(255,255,255,0.3)'
                              : 'transparent'}`,
                            background: isPicked
                              ? 'rgba(124,92,252,0.22)'
                              : 'var(--space-elevated)',
                            cursor: (!d || isFull || isPast) ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s',
                            padding: '2px',
                            position: 'relative',
                            opacity: isPast ? 0.35 : isFull ? 0.4 : 1,
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
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ═══ STEP 3: 풀이 요청 버튼 ═══ */}
                {pickedDates.length > 0 && !aiLoading && (
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

                </>)}

              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </div>

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
                    const catLabel = truncateTaekilLabel(item.context_category_label);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setShowArchiveList(false);
                          router.push(`/saju/taekil/result?recordId=${item.id}`);
                        }}
                        className="w-full min-h-10 py-2 px-3 rounded-lg border border-[var(--border-subtle)] text-[14px] text-text-primary font-medium hover:bg-cta/10 hover:border-cta/40 transition-all flex items-center justify-between gap-2"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          {catLabel && (
                            <span className="text-[12px] font-bold text-cta bg-cta/10 px-2 py-0.5 rounded-md whitespace-nowrap flex-shrink-0 text-center w-[120px]">
                              {catLabel}
                            </span>
                          )}
                          <span className="truncate">{dateLabel}</span>
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
