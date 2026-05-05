'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useProfileStore } from '../store/useProfileStore';
import { useCreditStore } from '../store/useCreditStore';
import { useReportCacheStore, sajuKey, type ReportKind } from '../store/useReportCacheStore';
import { RestoreReportModal } from '../components/RestoreReportModal';
import { QuickFortuneGate } from '../components/QuickFortuneGate';
import { computeSajuFromProfile } from '../utils/profileSaju';
import { SUN_COST_BIG, CHARGE_REASONS } from '../constants/creditCosts';
import { calculateSaju, type SajuResult } from '../utils/sajuCalculator';
import { getTodayFortuneReport, parseTodayFortune, parseTodayScores, type TodayFortuneAIResult } from '../services/fortuneService';
import { sajuDB } from '../services/supabase';
import { findRecentArchive } from '../services/archiveService';
import { TODAY_SECTION_KEYS, TODAY_SECTION_LABELS, TODAY_SCORE_LABELS, type TodayScoreDomain } from '../constants/prompts';
import { AILoadingBar } from '../components/AILoadingBar';
import { LuckyVisualCard, ELEMENT_LUCKY } from '../components/saju/LuckyVisualCard';
import { useLoadingGuard } from '../hooks/useLoadingGuard';
import { ShareBar } from '@/components/share/ShareBar';

const TODAY_MESSAGES = [
  '일진과 원국의 오행을 대조하는 중입니다',
  '오늘의 합충 관계를 분석하는 중입니다',
  '재물·직업·건강 기운을 읽는 중입니다',
  '오늘 하루의 흐름을 정리하는 중입니다',
];

// 날짜 피커 (지정일 모드용)
function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [viewDate, setViewDate] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const toIso = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const isSelected = (d: number) => toIso(d) === value;
  const isToday = (d: number) => toIso(d) === new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-2xl p-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] mb-4">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="w-8 h-8 rounded-lg text-text-secondary hover:bg-white/5 text-lg"
        >‹</button>
        <span className="text-[16px] font-bold text-text-primary">{year}년 {month + 1}월</span>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="w-8 h-8 rounded-lg text-text-secondary hover:bg-white/5 text-lg"
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
            onClick={() => d && onChange(toIso(d))}
            className={`aspect-square rounded-lg text-[14px] font-medium
              ${!d ? 'opacity-0 pointer-events-none' : ''}
              ${d && isSelected(d) ? 'bg-cta text-white' : ''}
              ${d && isToday(d) && !isSelected(d) ? 'border border-cta/50 text-cta' : ''}
              ${d && !isSelected(d) && !isToday(d) ? 'text-text-primary hover:bg-white/5' : ''}`}
          >
            {d ?? ''}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TodayFortunePage({ mode = 'today' }: { mode?: 'today' | 'date' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = searchParams?.get('profileId') ?? null;
  const recordId = searchParams?.get('recordId') ?? null;
  const isArchiveMode = !!recordId;
  const needsProfileSelect = !profileId && !isArchiveMode && !(searchParams?.get('year') && searchParams?.get('month') && searchParams?.get('day'));

  const { profiles, fetchProfiles, hydrated, loading: profilesLoading, lastFetchedAt } = useProfileStore();
  const targetProfile = useMemo(() => {
    if (profileId) return profiles.find(p => p.id === profileId) ?? null;
    if (needsProfileSelect) return null;
    return profiles.find(p => p.is_primary) ?? null;
  }, [profiles, profileId, needsProfileSelect]);

  const todayIso = new Date().toISOString().slice(0, 10);
  // 지정일 모드: 날짜 피커 상태 (기본값 = 오늘)
  const [pickedDate, setPickedDate] = useState(todayIso);
  // 지정일 모드: 날짜 확정 상태 (날짜 선택 후 "이 날 운세 보기" 버튼 클릭)
  const [confirmedDate, setConfirmedDate] = useState<string | null>(
    mode === 'today' ? todayIso : null
  );

  const [result, setResult] = useState<SajuResult | null>(null);
  const [report, setReport] = useState<TodayFortuneAIResult | null>(null);
  const [reportLoading, setReportLoading] = useState(!isArchiveMode && !needsProfileSelect && confirmedDate !== null);
  const [archivedAt, setArchivedAt] = useState<string | null>(null);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);

  const [cacheGate, setCacheGate] = useState<{ kind: ReportKind; key: string; restore: () => void } | null>(null);
  const [refetchNonce, setRefetchNonce] = useState(0);
  const handleUseCached = () => { cacheGate?.restore(); setCacheGate(null); };
  const handleRefetch = () => {
    if (cacheGate) useReportCacheStore.getState().invalidate(cacheGate.kind, cacheGate.key);
    setCacheGate(null);
    apiCalledKeyRef.current = null;
    setRefetchNonce(n => n + 1);
  };
  const chargeForContent = useCreditStore(s => s.chargeForContent);
  const chargeRef = useRef(chargeForContent);
  chargeRef.current = chargeForContent;
  const apiCalledKeyRef = useRef<string | null>(null);

  // ── 로딩 안전장치: 70초 초과 시 강제 해제 ──
  const [reportTimedOut] = useLoadingGuard(reportLoading, 70_000);
  useEffect(() => {
    if (reportTimedOut) {
      setReportLoading(false);
      if (!report) setReport({ success: false, error: '응답이 너무 오래 걸려요. 새로고침 후 다시 시도해주세요.' });
    }
  }, [reportTimedOut, report]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // ── 보관함 재생 모드 — recordId 가 있으면 DB에서 복원하고 AI 호출은 skip ──
  useEffect(() => {
    if (!recordId) return;
    let cancelled = false;
    sajuDB.getRecordById(recordId)
      .then((record) => {
        if (cancelled || !record) return;
        // birth 정보로 사주 원국 그대로 재계산 → 일진/합충 등 렌더에 필요한 값 확보
        try {
          const [yStr, mStr, dStr] = record.birth_date.split('-');
          const year = parseInt(yStr, 10);
          const month = parseInt(mStr, 10);
          const day = parseInt(dStr, 10);
          const hour = record.birth_time ? parseInt(record.birth_time.split(':')[0], 10) : 12;
          const minute = record.birth_time ? parseInt(record.birth_time.split(':')[1] || '0', 10) : 0;
          const unknownTime = !record.birth_time;
          const calc = calculateSaju(year, month, day, hour, minute, record.gender, unknownTime);
          setResult(calc);
        } catch (e) {
          console.error('[archive replay] saju recalc failed', e);
        }
        // 저장된 interpretation 을 sections 로 파싱 (rawText fallback 포함)
        const content = record.interpretation_detailed ?? record.interpretation_basic ?? '';
        const scores = parseTodayScores(content);
        const sections = parseTodayFortune(content);
        const engine = (record.engine_result ?? {}) as { todayGz?: TodayFortuneAIResult['todayGz']; isoDate?: string };
        const archivedReport: TodayFortuneAIResult = Object.keys(sections).length > 0
          ? { success: true, sections, scores, todayGz: engine.todayGz, isoDate: engine.isoDate }
          : { success: true, rawText: content, scores, todayGz: engine.todayGz, isoDate: engine.isoDate };
        setReport(archivedReport);
        setConfirmedDate(engine.isoDate ?? record.created_at.slice(0, 10));
        setArchivedAt(record.created_at);
      })
      .catch((e) => {
        console.error('[archive replay] load failed', e);
        if (!cancelled) setReport({ success: false, error: '보관된 풀이를 불러오지 못했어요.' });
      })
      .finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [recordId]);

  // 사주 계산 (URL 파라미터 or 대표 프로필) — 보관함 재생 모드에서는 위 useEffect 가 처리
  useEffect(() => {
    if (isArchiveMode) return;
    const hasUrlBirth = !!(searchParams?.get('year') && searchParams?.get('month') && searchParams?.get('day'));
    if (hasUrlBirth) {
      const year   = parseInt(searchParams!.get('year')!);
      const month  = parseInt(searchParams!.get('month')!);
      const day    = parseInt(searchParams!.get('day')!);
      const hour   = parseInt(searchParams!.get('hour') || '12');
      const minute = parseInt(searchParams!.get('minute') || '0');
      const gender = (searchParams!.get('gender') || 'male') as 'male' | 'female';
      const unknownTime = searchParams!.get('unknownTime') === 'true';
      setResult(calculateSaju(year, month, day, hour, minute, gender, unknownTime));
    } else if (targetProfile) {
      setResult(computeSajuFromProfile(targetProfile));
    }
  }, [searchParams, targetProfile, isArchiveMode]);

  // ── 보관함 DB 확인 → AI 호출 (순차 실행) ──
  // 보관함 체크를 먼저 완료한 뒤, 기존 풀이가 없을 때만 AI 호출
  useEffect(() => {
    if (isArchiveMode) return;
    if (!result || !confirmedDate) return;

    // 중복 호출 방지: 동일 키에 대해 이미 호출이 시작되었으면 skip (탭 복귀·프로필 hydration 방어)
    const effectKey = `${sajuKey(result)}:${confirmedDate}`;
    if (refetchNonce === 0 && apiCalledKeyRef.current === effectKey) return;

    let cancelled = false;

    const isFresh = searchParams?.get('fresh') === '1';

    const run = async () => {
      if (refetchNonce === 0 && targetProfile && !isFresh) {
        try {
          const found = await findRecentArchive({
            category: mode === 'date' ? 'period' : 'today',
            birth_date: targetProfile.birth_date,
            gender: targetProfile.gender,
            context: { key: 'isoDate', value: confirmedDate },
            profile_id: targetProfile.id,
          });
          if (cancelled) return;
          if (found) {
            setSavedRecordId(found.id);
            setReportLoading(false);
            setCacheGate({
              kind: 'today',
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

      const cacheKey = `${sajuKey(result)}:${confirmedDate}`;
      const cached = useReportCacheStore.getState().getReport<TodayFortuneAIResult>('today', cacheKey);
      if (cached?.error) {
        setReport({ success: false, error: cached.error });
        setReportLoading(false);
        return;
      }
      if (cached?.data) {
        setReport(cached.data);
        setReportLoading(false);
        return;
      }

      apiCalledKeyRef.current = effectKey;
      setReport(null);
      setReportLoading(true);
      getTodayFortuneReport(result, confirmedDate, targetProfile?.id)
        .then(r => {
          if (cancelled) return;
          setReport(r);
          const cache = useReportCacheStore.getState();
          if (r.success) {
            cache.setReport('today', cacheKey, r);
            if (!cache.isCharged('today', cacheKey)) {
              cache.markCharged('today', cacheKey);
              chargeRef.current('sun', SUN_COST_BIG, CHARGE_REASONS.today).catch(() => {});
            }
          } else if (r.error) {
            cache.setError('today', cacheKey, r.error);
          }
        })
        .catch((err: any) => {
          if (cancelled) return;
          useReportCacheStore.getState().setError('today', cacheKey, err?.message || '오류가 발생했어요.');
        })
        .finally(() => { if (!cancelled) setReportLoading(false); });
    };

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, confirmedDate, isArchiveMode, refetchNonce]);

  // ── 프로필 선택 가드 ───────────────────────────────────────
  if (needsProfileSelect) {
    const todayIsoCtx = new Date().toISOString().slice(0, 10);
    return (
      <QuickFortuneGate
        serviceName="오늘의 운세"
        archiveCategory="today"
        archiveContext={{ key: 'isoDate', value: todayIsoCtx }}
        creditType="sun"
        creditCost={SUN_COST_BIG}
      />
    );
  }

  // ── 로딩·빈 상태 ───────────────────────────────────────────
  if (!result) {
    const hasUrlBirth = !!(searchParams?.get('year') && searchParams?.get('month') && searchParams?.get('day'));
    const profileStoreReady = hydrated && lastFetchedAt !== null && !profilesLoading;

    if (!hasUrlBirth && !profileStoreReady) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-cta border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    if (!hasUrlBirth && !targetProfile) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
          <p className="text-text-secondary">대표 프로필이 없어요</p>
          <button
            onClick={() => router.push('/saju/input')}
            className="px-5 py-2.5 rounded-xl bg-cta text-white text-sm font-semibold"
          >
            생년월일 입력
          </button>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-cta border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── AI 분석중 로딩 스크린 ──────────────────────────────────
  if (reportLoading) {
    const targetDateStr = (() => {
      const d = new Date(confirmedDate ?? todayIso);
      return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
    })();
    const loadingLabel = mode === 'date' ? '지정일 기운 분석중' : '오늘의 기운 분석중';

    return (
      <AILoadingBar
        label={loadingLabel}
        minLabel="10초"
        maxLabel="40초"
        estimatedSeconds={25}
        messages={TODAY_MESSAGES}
        topContent={
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="text-[28px] mb-1 tracking-widest" style={{ fontFamily: 'var(--font-serif)' }}>
              {result.pillars.day.gan}{result.pillars.day.zhi}일주
            </div>
            <div className="text-[15px] text-text-tertiary">{targetDateStr}</div>
          </motion.div>
        }
      />
    );
  }

  // ── 일진 표시용 ────────────────────────────────────────────
  const todayGz = report?.todayGz;
  const reportDateStr = (() => {
    const iso = report?.isoDate ?? confirmedDate ?? todayIso;
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
  })();
  const pageTitle = mode === 'date' ? '지정일 운세' : '오늘의 운세';

  // ── 메인 결과 화면 ─────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen px-4 pt-4 pb-12"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5 pt-3 px-1">
        <button
          onClick={() => {
            if (mode === 'date' && report) {
              // 결과 화면에서 뒤로 → 날짜 피커로
              setReport(null);
              setConfirmedDate(null);
            } else {
              router.back();
            }
          }}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary"
          aria-label="뒤로"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex-1 flex flex-col items-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            {pageTitle}
          </h1>
          {isArchiveMode && archivedAt && (
            <span className="text-[11px] text-text-tertiary mt-0.5">
              보관함 · {new Date(archivedAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          )}
        </div>
        <div className="w-9" />
      </div>

      {/* 지정일 모드 — 날짜 미선택 상태: 피커 표시 */}
      {mode === 'date' && !confirmedDate && (
        <>
          <DatePicker value={pickedDate} onChange={setPickedDate} />
          <button
            onClick={() => setConfirmedDate(pickedDate)}
            className="w-full py-3 rounded-2xl bg-cta text-white font-semibold text-[17px] mb-6"
          >
            {(() => {
              const d = new Date(pickedDate);
              return `${d.getMonth() + 1}월 ${d.getDate()}일 운세 보기`;
            })()}
          </button>
        </>
      )}

      {/* 일진 헤더 카드 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl px-5 py-4 mb-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] text-text-tertiary mb-1">{reportDateStr}</div>
            <div className="text-[15px] font-semibold text-text-secondary">
              내 일주: <span className="text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
                {result.pillars.day.gan}{result.pillars.day.zhi}
              </span>
            </div>
          </div>
          {todayGz && (
            <div className="text-right">
              <div className="text-[13px] text-text-tertiary mb-0.5">{mode === 'date' ? '일진' : '오늘 일진'}</div>
              <div
                className="text-[26px] font-bold text-text-primary leading-none"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {todayGz.hanja}
              </div>
              <div className="text-[13px] text-text-tertiary mt-0.5">
                {todayGz.ganElement}·{todayGz.zhiElement}
                {todayGz.tenGodGan ? ` · ${todayGz.tenGodGan}` : ''}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* 점수 그래프 */}
      {report?.scores && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl px-5 py-4 mb-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-block w-1 h-5 rounded-full bg-cta" />
            <span
              className="text-[17px] font-bold text-text-primary tracking-tight"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              오늘의 운세 지수
            </span>
            <span className="ml-auto text-[24px] font-bold text-cta" style={{ fontFamily: 'var(--font-serif)' }}>
              {report.scores.overall}
            </span>
            <span className="text-[13px] text-text-tertiary">/ 100</span>
          </div>
          <div className="space-y-2.5">
            {(['wealth', 'work', 'love', 'health'] as TodayScoreDomain[]).map((domain) => {
              const score = report.scores![domain];
              const barColor = score >= 75 ? 'bg-[#7c5cfc]' : score >= 50 ? 'bg-[#a78bfa]' : score >= 30 ? 'bg-[#f59e0b]' : 'bg-[#ef4444]';
              return (
                <div key={domain} className="flex items-center gap-3">
                  <span className="text-[13px] text-text-tertiary w-8 shrink-0 text-right">
                    {TODAY_SCORE_LABELS[domain]}
                  </span>
                  <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${score}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                      className={`h-full rounded-full ${barColor}`}
                    />
                  </div>
                  <span className="text-[13px] font-semibold text-text-primary w-7 text-right">
                    {score}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* 에러 */}
      {report?.error && (
        <div className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <p className="text-[14px] text-text-secondary">{report.error}</p>
        </div>
      )}

      {/* rawText fallback */}
      {report?.rawText && (
        <div className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <p className="text-[15px] text-text-secondary leading-relaxed whitespace-pre-line">
            {report.rawText.replace(/^\s*\[today_scores\][^\n]*\n?/, '')}
          </p>
        </div>
      )}

      {/* 5섹션 카드 — 정통사주 패턴: 레이블(상단 크게) + 은유 제목(부제) + 본문 */}
      {report?.sections && result && (
        <div className="space-y-2">
          {TODAY_SECTION_KEYS.map((key, idx) => {
            const text = report.sections?.[key];
            if (!text) return null;
            const isLucky = key === 'today_lucky';
            const luckyEl = result.yongSinElement ?? '목';
            const el = ELEMENT_LUCKY[luckyEl] ?? ELEMENT_LUCKY['목'];

            // 첫 줄 = 은유 제목, 나머지 = 본문 (정통사주와 동일 파싱)
            const lines = text.trim().split('\n');
            const firstLine = lines[0]?.trim() ?? '';
            // 은유 제목 감지: 첫 줄이 짧고(≤60자) 문장 부호(「」·:·() 제외)가 상대적으로 적을 때
            const hasMetaphor = lines.length > 1
              && firstLine.length > 0
              && firstLine.length <= 40
              && !firstLine.endsWith('.');
            const metaphorTitle = hasMetaphor ? firstLine : '';
            const bodyText = hasMetaphor ? lines.slice(1).join('\n').trim() : text;

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.07 * idx }}
                className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
              >
                {/* 섹션 레이블 — 상단 크게 강조 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block w-1 h-5 rounded-full bg-cta" />
                  <div
                    className="text-[17px] font-bold text-text-primary tracking-tight"
                    style={{ fontFamily: 'var(--font-serif)' }}
                  >
                    {TODAY_SECTION_LABELS[key]}
                  </div>
                </div>

                {/* 은유 제목 — 부제 */}
                {metaphorTitle && (
                  <div
                    className="text-[15px] font-medium leading-snug text-cta/90 mb-4 pl-3"
                    style={{ fontFamily: 'var(--font-serif)' }}
                  >
                    {metaphorTitle}
                  </div>
                )}

                {/* 본문 */}
                {isLucky ? (
                  <LuckyVisualCard
                    colors={el.colors}
                    colorCss={el.colorCss}
                    numbers={el.numbers}
                    direction={el.direction}
                    timeSlot={el.timeSlot}
                    gem={el.gem}
                    activity={el.activity}
                    extraText={bodyText}
                  />
                ) : (
                  <p className="text-[15px] text-text-secondary leading-[1.85] whitespace-pre-line tracking-[-0.005em]">
                    {bodyText}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {(recordId || savedRecordId) && (
        <div className="mt-6">
          <ShareBar recordId={(recordId || savedRecordId)!} type="saju" category="today" />
        </div>
      )}

      <RestoreReportModal
        open={!!cacheGate}
        title="오늘의 운세"
        onUseCached={handleUseCached}
        onRefresh={handleRefetch}
        onClose={() => setCacheGate(null)}
      />
    </motion.div>
  );
}
