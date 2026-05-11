'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lunar } from 'lunar-javascript';
import { calculateSaju, type SajuResult } from '../utils/sajuCalculator';
import {
  getJungtongsajuReport,
  parseJungtongsaju,
  parseAdviceMeta,
  stripAllSectionTags,
  type JungtongsajuAIResult,
} from '../services/fortuneService';
import { sajuDB } from '../services/supabase';
import { findRecentArchive } from '../services/archiveService';
import { JUNGTONGSAJU_SECTION_KEYS, JUNGTONGSAJU_SECTION_LABELS } from '../constants/prompts';
import { useProfileStore } from '../store/useProfileStore';
import { useCreditStore } from '../store/useCreditStore';
import { useReportCacheStore, sajuKey, type ReportKind } from '../store/useReportCacheStore';
import { RestoreReportModal } from '../components/RestoreReportModal';
import { FortuneProfileSelect } from '../components/FortuneProfileSelect';
import { computeSajuFromProfile } from '../utils/profileSaju';
import { SUN_COST_BIG, CHARGE_REASONS } from '../constants/creditCosts';
import { determineGyeokguk } from '../engine/gyeokguk';
import { stemToHanja, zhiToHanja } from '../lib/character';
import { AdviceCard } from '../components/saju/AdviceCard';
import SajuReport from '../components/saju/SajuReport';
import { AILoadingBar } from '../components/AILoadingBar';
import { BackButton } from '../components/ui/BackButton';
import { useLoadingGuard } from '../hooks/useLoadingGuard';
import { useScrollToTopOnLoad } from '../hooks/useScrollToTopOnLoad';
import { ShareBar } from '@/components/share/ShareBar';

// 정통사주 = AI 풀이 가치, 만세력 = 무료 데이터.
// 사용자가 풀이 맥락을 알 수 있도록 핵심 요약만 카드로 노출하고
// 자세한 데이터 보드는 만세력 페이지로 위임 (직원 피드백: 두 페이지 데이터 중복 제거).
const ELEMENT_COLORS: Record<string, string> = {
  '목': '#34D399', '화': '#F43F5E', '토': '#F59E0B', '금': '#CBD5E1', '수': '#3B82F6',
};
const ELEMENT_TO_STEMS: Record<string, [string, string]> = {
  '목': ['갑목', '을목'], '화': ['병화', '정화'], '토': ['무토', '기토'],
  '금': ['경금', '신금'], '수': ['임수', '계수'],
};

const JUNGTONGSAJU_MESSAGES = [
  '격국과 용신을 계산하는 중입니다',
  '오행 분포와 신강신약을 분석하는 중입니다',
  '대운·세운의 흐름을 읽는 중입니다',
  '십성 분포와 일주 특성을 해석하는 중입니다',
  '재물·직업·건강 운세를 종합하는 중입니다',
  '신살과 합충형파를 검토하는 중입니다',
];

export default function SajuResultPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
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

  const [result, setResult] = useState<SajuResult | null>(null);
  const [report, setReport] = useState<JungtongsajuAIResult | null>(null);
  const [reportLoading, setReportLoading] = useState(!isArchiveMode && !needsProfileSelect);

  // 결과 준비 완료 시 스크롤 최상단
  useScrollToTopOnLoad(!!report && !reportLoading);
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

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // ── 보관함 재생 모드 — recordId 가 있으면 DB에서 복원, AI 호출·차감 모두 skip ──
  useEffect(() => {
    if (!recordId) return;
    let cancelled = false;
    sajuDB.getRecordById(recordId)
      .then((record) => {
        if (cancelled || !record) return;
        try {
          const [yStr, mStr, dStr] = record.birth_date.split('-');
          const year = parseInt(yStr, 10);
          const month = parseInt(mStr, 10);
          const day = parseInt(dStr, 10);
          const hour = record.birth_time ? parseInt(record.birth_time.split(':')[0], 10) : 12;
          const minute = record.birth_time ? parseInt(record.birth_time.split(':')[1] || '0', 10) : 0;
          const unknownTime = !record.birth_time;
          setResult(calculateSaju(year, month, day, hour, minute, record.gender, unknownTime));
        } catch (e) {
          console.error('[archive replay] saju recalc failed', e);
        }
        const content = record.interpretation_detailed ?? record.interpretation_basic ?? '';
        const sections = parseJungtongsaju(content);
        const adviceMeta = sections.advice ? parseAdviceMeta(sections.advice) : undefined;
        setReport(
          Object.keys(sections).length > 0
            ? { success: true, sections, adviceMeta }
            : { success: true, rawText: content },
        );
      })
      .catch((e) => {
        console.error('[archive replay] load failed', e);
        if (!cancelled) setReport({ success: false, error: '보관된 풀이를 불러오지 못했어요.' });
      })
      .finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [recordId]);

  // 사주 계산 — 보관함 모드에선 위 useEffect 가 처리
  useEffect(() => {
    if (isArchiveMode) return;
    const hasUrlBirth = !!(searchParams?.get('year') && searchParams?.get('month') && searchParams?.get('day'));

    if (hasUrlBirth) {
      const year    = parseInt(searchParams!.get('year')!);
      const month   = parseInt(searchParams!.get('month')!);
      const day     = parseInt(searchParams!.get('day')!);
      const hour    = parseInt(searchParams!.get('hour') || '12');
      const minute  = parseInt(searchParams!.get('minute') || '0');
      const gender  = (searchParams!.get('gender') || 'male') as 'male' | 'female';
      const calendarType = searchParams!.get('calendarType') || 'solar';
      const unknownTime  = searchParams!.get('unknownTime') === 'true';

      let solarYear = year, solarMonth = month, solarDay = day;
      if (calendarType === 'lunar') {
        const lunar = Lunar.fromYmdHms(year, month, day, hour, minute, 0);
        const solar = lunar.getSolar();
        solarYear  = solar.getYear();
        solarMonth = solar.getMonth();
        solarDay   = solar.getDay();
      }

      let finalY = solarYear, finalM = solarMonth, finalD = solarDay;
      let finalH = unknownTime ? 12 : hour;
      let finalMin = unknownTime ? 0 : minute;
      if (!unknownTime) {
        const dt = new Date(solarYear, solarMonth - 1, solarDay, hour, minute);
        const shifted = new Date(dt.getTime() - 30 * 60 * 1000);
        finalY   = shifted.getFullYear();
        finalM   = shifted.getMonth() + 1;
        finalD   = shifted.getDate();
        finalH   = shifted.getHours();
        finalMin = shifted.getMinutes();
      }

      setResult(calculateSaju(finalY, finalM, finalD, finalH, finalMin, gender, unknownTime));
    } else if (targetProfile) {
      setResult(computeSajuFromProfile(targetProfile));
    }
  }, [searchParams, targetProfile]);

  // ── 로딩 안전장치: 2-pass 정통사주는 최대 120초 허용 ──
  const [reportTimedOut] = useLoadingGuard(reportLoading, 120_000);
  useEffect(() => {
    if (reportTimedOut) {
      setReportLoading(false);
      if (!report) setReport({ success: false, error: '응답이 너무 오래 걸려요. 새로고침 후 다시 시도해주세요.' });
    }
  }, [reportTimedOut, report]);

  // ── 보관함 DB 확인 → AI 호출 (순차 실행) ──
  // 보관함 체크를 먼저 완료한 뒤, 기존 풀이가 없을 때만 AI 호출
  useEffect(() => {
    if (isArchiveMode) return;
    if (!result) return;

    const isFresh = searchParams?.get('fresh') === '1';

    // 중복 호출 방지 (탭 복귀·프로필 hydration 방어)
    const effectKey = sajuKey(result);
    if (!isFresh && refetchNonce === 0 && apiCalledKeyRef.current === effectKey) return;

    let cancelled = false;

    if (isFresh) {
      setReport(null);
      setReportLoading(true);
      setSavedRecordId(null);
      const cacheKey = sajuKey(result);
      useReportCacheStore.getState().invalidate('jungtong', cacheKey);
    }

    const run = async () => {
      const cacheKey = sajuKey(result);

      // ★ cache 우선 — 메모리 unload→reload 시에도 모달 없이 즉시 복원
      // archive 체크보다 먼저 검사: 캐시가 곧 사용자가 마지막에 본 화면이므로 그대로 표시.
      if (!isFresh && refetchNonce === 0) {
        const cached = useReportCacheStore.getState().getReport<JungtongsajuAIResult>('jungtong', cacheKey);
        if (cached?.error) {
          setReport({ success: false, error: cached.error });
          return;
        }
        if (cached?.data) {
          setReport(cached.data);
          return;
        }
      }

      if (refetchNonce === 0 && targetProfile && !isFresh) {
        try {
          const found = await findRecentArchive({
            category: 'traditional',
            birth_date: targetProfile.birth_date,
            gender: targetProfile.gender,
            profile_id: targetProfile.id,
          });
          if (cancelled) return;
          if (found) {
            setSavedRecordId(found.id);
            setReportLoading(false);
            setCacheGate({
              kind: 'jungtong',
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

      if (report || reportLoading) return;

      apiCalledKeyRef.current = effectKey;
      setReportLoading(true);
      getJungtongsajuReport(result, (partial) => {
        if (cancelled) return;
        setReport(partial);
      }, targetProfile?.id)
        .then(r => {
          if (cancelled) return;
          setReport(r);
          const cache = useReportCacheStore.getState();
          if (r.success) {
            cache.setReport('jungtong', cacheKey, r);
            if (!cache.isCharged('jungtong', cacheKey)) {
              cache.markCharged('jungtong', cacheKey);
              chargeRef.current('sun', SUN_COST_BIG, CHARGE_REASONS.traditional).catch(() => {});
            }
          } else if (r.error) {
            cache.setError('jungtong', cacheKey, r.error);
          }
        })
        .catch((err: any) => {
          if (cancelled) return;
          useReportCacheStore.getState().setError('jungtong', cacheKey, err?.message || '오류가 발생했어요.');
        })
        .finally(() => { if (!cancelled) setReportLoading(false); });
    };

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, isArchiveMode, refetchNonce]);

  // ── 프로필 선택 가드 ──────────────────────────────────
  if (needsProfileSelect) {
    return (
      <FortuneProfileSelect
        serviceName="정통 사주"
        archiveCategory="traditional"
        creditType="sun"
        creditCost={SUN_COST_BIG}
      />
    );
  }

  // ── 로딩 / 빈 상태 ──────────────────────────────────
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

  // ── 리포트 로딩 중 전체 화면 — 1차(Core 4섹션) 결과가 아직 없을 때만 ──
  // 2-pass: 1차 결과 도착하면 partial sections 가 setReport 로 채워짐 → 그 시점부터 페이지 렌더
  // 2차는 백그라운드 진행. reportLoading 은 true 유지하되 페이지 안에서 "심층 분석 중" 배지로 표시
  const hasAnySections = !!report?.sections && Object.keys(report.sections).length > 0;
  if (reportLoading && !hasAnySections) {
    return (
      <AILoadingBar
        label="정통사주 분석중"
        minLabel="30초"
        maxLabel="1분 30초"
        estimatedSeconds={70}
        messages={JUNGTONGSAJU_MESSAGES}
        topContent={
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="text-[30px] mb-1" style={{ fontFamily: 'var(--font-serif)' }}>
              {result.pillars.year.gan}{result.pillars.year.zhi}년생
            </div>
            <div className="text-[15px] text-text-tertiary">
              {result.pillars.year.gan}{result.pillars.year.zhi} {result.pillars.month.gan}{result.pillars.month.zhi} {result.pillars.day.gan}{result.pillars.day.zhi}
            </div>
          </motion.div>
        }
      />
    );
  }

  // ── 메인 결과 화면 ────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen px-4 pt-4 pb-12"
    >
      {/* 헤더 */}
      <div className="flex items-center relative pt-3 px-1">
        <BackButton className="absolute left-0" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            정통사주
          </h1>
        </div>
      </div>
      <p className="text-sm text-text-tertiary text-center mt-2 mb-4">
        {targetProfile?.name ? `${targetProfile.name} · ` : ''}{result.solarDate} (양력) | {result.lunarDateSimple} (음력)
      </p>

      {/* 시간 미상 배너 */}
      {result.hourUnknown && (
        <div className="mb-3 rounded-xl px-4 py-3 bg-amber-500/10 border border-amber-500/30 text-[14px] text-amber-300 leading-relaxed">
          출생 시간 미상 · 삼주추명(三柱推命) — 연·월·일주 기반으로 분석합니다.
          자녀운·말년운·시간대 조언은 제한적으로 제공됩니다.
        </div>
      )}

      {/* 핵심 요약 카드 — 풀이 맥락만 짧게. 자세한 데이터는 만세력 페이지로 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 rounded-2xl px-5 py-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
      >
        {(() => {
          const gyeokguk = determineGyeokguk(result);
          const yongStems = ELEMENT_TO_STEMS[result.yongSinElement];
          const yongColor = ELEMENT_COLORS[result.yongSinElement] ?? 'var(--text-secondary)';
          const dayPillarLabel = `${stemToHanja(result.pillars.day.gan)}${zhiToHanja(result.pillars.day.zhi)}`;
          const dayKor = `${result.pillars.day.gan}${result.pillars.day.zhi}`;
          const rows: Array<{ label: string; value: React.ReactNode }> = [
            {
              label: '일주',
              value: (
                <span>
                  <span style={{ fontFamily: 'var(--font-serif)', marginRight: 6 }}>{dayPillarLabel}</span>
                  <span className="text-text-tertiary text-[13px]">({dayKor})</span>
                </span>
              ),
            },
            { label: '격국', value: gyeokguk.name },
            {
              label: '용신',
              value: (
                <span>
                  <span style={{ color: yongColor, fontWeight: 700 }}>{result.yongSinElement}</span>
                  {yongStems && (
                    <span className="text-text-tertiary text-[13px]" style={{ marginLeft: 6 }}>
                      · {yongStems[0]}·{yongStems[1]}
                    </span>
                  )}
                </span>
              ),
            },
            {
              label: '신강신약',
              value: `${result.strengthStatus} (${result.strengthScore}점)`,
            },
          ];
          return (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.label} className="flex items-center text-[14px]">
                  <span className="w-16 flex-shrink-0 text-text-tertiary">{r.label}</span>
                  <span className="text-text-primary font-semibold">{r.value}</span>
                </li>
              ))}
            </ul>
          );
        })()}
      </motion.div>

      {/*
        만세력 데이터 보드 — 사주원국만 펼쳐지고 나머지(사주관계·오행십성·신강신약·대운수)는 접힘.
        만세력 페이지(/saju/manseryeok)는 defaultExpanded={true} 로 모두 펼침.
        (직원 피드백 재정리 — 만세력 자체는 정통사주에도 노출하되 보조 섹션은 접어 정보량 조절)
      */}
      <SajuReport result={result} />

      {/* 에러 */}
      {report?.error && (
        <div className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <p className="text-[14px] text-text-secondary">{report.error}</p>
        </div>
      )}

      {/* 부분 성공 안내 — 2차 실패해도 1차 결과는 살림 */}
      {report?.partial && report.partialMessage && (
        <div className="rounded-2xl p-4 mb-3 bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.35)]">
          <div className="flex items-start gap-2">
            <span className="text-[16px]" aria-hidden>⚠️</span>
            <div className="flex-1">
              <p className="text-[14px] text-amber-200 font-semibold mb-1">일부 섹션 분석 미완료</p>
              <p className="text-[13px] text-text-secondary leading-relaxed">{report.partialMessage}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 px-3 py-1.5 rounded-lg bg-cta/20 border border-cta/40 text-cta text-[13px] font-semibold hover:bg-cta/30 active:scale-95 transition-all"
              >
                나머지 8섹션 다시 분석받기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* rawText fallback */}
      {report?.rawText && (
        <div className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <p className="text-[15px] text-text-secondary leading-relaxed whitespace-pre-line">
            {stripAllSectionTags(report.rawText)}
          </p>
        </div>
      )}

      {/* 9섹션 카드 */}
      {report?.sections && (
        <div className="space-y-2">
          {JUNGTONGSAJU_SECTION_KEYS.map((key, idx) => {
            const text = report.sections?.[key];
            if (!text) return null;
            const isAdvice = key === 'advice';

            // 은유 부제목 추출 — "[은유]" 마커 기반 결정적 파싱
            // a30ea72 이후 모든 카드에 [은유] 마커가 강제됨. 기존 휴리스틱은 오탐/미탐 둘 다 발생.
            const lines = text.trim().split('\n');
            let metaphorTitle = '';
            let bodyText = text.trim();
            for (let i = 0; i < Math.min(lines.length, 3); i++) {
              const m = lines[i]?.trim().match(/^\[은유\]\s*(.+)/);
              if (m) {
                metaphorTitle = m[1].trim();
                bodyText = [...lines.slice(0, i), ...lines.slice(i + 1)].join('\n').trim();
                break;
              }
            }

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 * idx }}
                className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
              >
                {/* 섹션 레이블 — 상단에 크게 강조 (오행 분포, 애정·결혼운 등) */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block w-1 h-5 rounded-full bg-cta" />
                  <div
                    className="text-[17px] font-bold text-text-primary tracking-tight"
                    style={{ fontFamily: 'var(--font-serif)' }}
                  >
                    {JUNGTONGSAJU_SECTION_LABELS[key]}
                  </div>
                </div>

                {metaphorTitle && (
                  <div
                    className="text-[17px] font-medium leading-snug text-cta/90 mb-4 pl-3"
                    style={{ fontFamily: 'var(--font-serif)' }}
                  >
                    {metaphorTitle}
                  </div>
                )}

                {isAdvice && report.adviceMeta ? (
                  <AdviceCard
                    yongSinElement={result.yongSinElement}
                    meta={report.adviceMeta}
                  />
                ) : (
                  <div className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
                    {bodyText.split(/\n\n+/).map((para, pi) => (
                      <p key={pi} className="whitespace-pre-line">{para.trim()}</p>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 2차(Application 8섹션) 진행 중 인디케이터 — 1차 결과만 도착해 있을 때 */}
      {reportLoading && hasAnySections && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-2xl px-5 py-4 bg-[rgba(124,92,252,0.08)] border border-[rgba(124,92,252,0.25)]"
        >
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cta animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-cta animate-pulse" style={{ animationDelay: '0.2s' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-cta animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-semibold text-text-primary">심층 분석 중 (성격 · 직업 · 재물 · 애정 · 건강 · 인간관계 · 대운 · 처방)</div>
              <div className="text-[12px] text-text-tertiary mt-0.5">1차 핵심 분석은 위에 도착했어요. 영역별 깊이 분석이 30~40초 후 추가됩니다.</div>
            </div>
          </div>
        </motion.div>
      )}

      {(recordId || savedRecordId) && (
        <div className="mt-6">
          <ShareBar recordId={(recordId || savedRecordId)!} type="saju" category="traditional" />
        </div>
      )}

      <RestoreReportModal
        open={!!cacheGate}
        title="정통사주"
        onUseCached={handleUseCached}
        onRefresh={handleRefetch}
        onClose={() => setCacheGate(null)}
      />
    </motion.div>
  );
}
