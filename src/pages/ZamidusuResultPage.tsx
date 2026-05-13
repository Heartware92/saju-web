'use client';

/**
 * 자미두수 결과 페이지 (리뉴얼)
 * - 진입 → 풀스크린 로딩 → 결과 (명반 계산 + AI 풀이 동시 대기)
 * - 별자리 SVG 시각화 (StarChart)
 * - 섹션별 은유 헤드라인 + 카드 UI
 * - AI 용어 제거 — "별이 전하는 이야기" 같은 감성 네이밍
 *
 * URL: /saju/zamidusu?year=1990&month=1&day=1&hour=12&gender=male&calendarType=solar
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  calculateZamidusu,
  ZamidusuResult,
  ZamidusuPalace,
} from '../engine/zamidusu';
import { buildZamidusuReading, type ZamidusuReading } from '../engine/zamidusu/reading';
import { SectionCollapsible } from '../components/saju/SectionCollapsible';
import styles from './ZamidusuResultPage.module.css';
import { useProfileStore } from '../store/useProfileStore';
import { extractMetaphor } from '../utils/parseMetaphor';
import { useCreditStore } from '../store/useCreditStore';
import { useReportCacheStore, type ReportKind } from '../store/useReportCacheStore';
import { RestoreReportModal } from '../components/RestoreReportModal';
import { QuickFortuneGate } from '../components/QuickFortuneGate';
import { findRecentArchive } from '../services/archiveService';
import {
  getZamidusuReading,
  parseZamidusuSections,
  stripAllSectionTags,
  type ZamidusuAIResult,
} from '../services/fortuneService';
import { sajuDB } from '../services/supabase';
import { SUN_COST_BIG, CHARGE_REASONS } from '../constants/creditCosts';
import { ZAMIDUSU_SECTION_KEYS, ZAMIDUSU_SECTION_LABELS } from '../constants/prompts';
import { MAJOR_STARS_META, MINOR_STARS_META, MUTAGEN_META, PALACE_ROLE_META } from '../engine/zamidusu/knowledge';
import { AILoadingBar } from '../components/AILoadingBar';
import { BackButton } from '../components/ui/BackButton';
import { StarChart } from '../components/zamidusu/StarChart';
import { CorePalaceScores } from '../components/zamidusu/CorePalaceScores';
import { MutagenCards } from '../components/zamidusu/MutagenCards';
import { DaehanTimeline } from '../components/zamidusu/DaehanTimeline';
import {
  calcCoreScores,
  calcMutagenPlacements,
  calcDaehanTimeline,
  calcOverallScore,
} from '../engine/zamidusu/visualization';
import { useLoadingGuard } from '../hooks/useLoadingGuard';
import { useScrollToTopOnLoad } from '../hooks/useScrollToTopOnLoad';
import { ShareBar } from '@/components/share/ShareBar';

const LOADING_MESSAGES = [
  '명반 12궁의 별자리를 배치하는 중입니다',
  '주인공 별과 보좌별을 확인하는 중입니다',
  '사화(四化)의 변주를 읽는 중입니다',
  '대한(大限)의 10년 리듬을 살피는 중입니다',
  '별자리 속 이야기를 엮는 중입니다',
];

/**
 * 긴 본문을 읽기 쉬운 단락 배열로 분리.
 * - 이미 빈 줄(\n\n)로 단락이 나뉘어 있으면 그대로 존중
 * - 한 단락 안에 문장이 너무 많으면 sentencesPerPara 단위로 추가 분할
 * - 한국어 문장 종결(. ! ? + 공백) 기준
 */
function splitIntoParagraphs(text: string, sentencesPerPara = 3): string[] {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const para of paras) {
    const flat = para.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    const parts = flat.split(/([.!?])\s+/);
    const sentences: string[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      const s = (parts[i] || '').trim();
      const punct = parts[i + 1] || '';
      const combined = (s + punct).trim();
      if (combined) sentences.push(combined);
    }
    if (sentences.length === 0) {
      out.push(flat);
      continue;
    }
    if (sentences.length <= sentencesPerPara) {
      out.push(sentences.join(' '));
      continue;
    }
    for (let i = 0; i < sentences.length; i += sentencesPerPara) {
      out.push(sentences.slice(i, i + sentencesPerPara).join(' '));
    }
  }
  return out;
}


export default function ZamidusuResultPage() {
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

  const [chart, setChart] = useState<ZamidusuResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<number | null>(null);
  const [aiResult, setAiResult] = useState<ZamidusuAIResult | null>(null);
  const [aiLoading, setAiLoading] = useState(!isArchiveMode && !needsProfileSelect);
  const [introOpen, setIntroOpen] = useState(false);

  // 결과 준비 완료 시 스크롤 최상단
  useScrollToTopOnLoad(!!chart && !aiLoading);

  // ── 로딩 안전장치: 70초 초과 시 강제 해제 ──
  const [aiTimedOut] = useLoadingGuard(aiLoading, 140_000);
  useEffect(() => {
    if (aiTimedOut) {
      setAiLoading(false);
      if (!aiResult) setAiResult({ success: false, error: '응답이 너무 오래 걸려요. 새로고침 후 다시 시도해주세요.' });
    }
  }, [aiTimedOut, aiResult]);
  const chargeForContent = useCreditStore(s => s.chargeForContent);
  const chargeRef = useRef(chargeForContent);
  chargeRef.current = chargeForContent;

  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [cacheGate, setCacheGate] = useState<{ kind: ReportKind; key: string; restore: () => void } | null>(null);
  const [refetchNonce, setRefetchNonce] = useState(0);
  const handleUseCached = () => { cacheGate?.restore(); setCacheGate(null); };
  const handleRefetch = () => {
    if (cacheGate) useReportCacheStore.getState().invalidate(cacheGate.kind, cacheGate.key);
    setCacheGate(null);
    aiStartedRef.current = false;
    setRefetchNonce(n => n + 1);
  };

  const hasUrlBirth = !!(searchParams?.get('year') && searchParams?.get('month') && searchParams?.get('day'));
  const primaryHourUnknown = !!targetProfile && !targetProfile.birth_time;
  const hourUnknown = hasUrlBirth
    ? searchParams?.get('unknownTime') === 'true'
    : primaryHourUnknown;

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // 모달 오픈 시 ESC 키로 닫기 + body 스크롤 잠금
  useEffect(() => {
    if (selectedPalace === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedPalace(null);
    };
    window.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedPalace]);

  // 명반 계산용 입력 — 캐시 키와 chart 둘 다 같은 입력에서 파생되도록 분리
  const birthInput = useMemo(() => {
    if (hourUnknown) return null;
    if (hasUrlBirth) {
      return {
        year: parseInt(searchParams!.get('year')!),
        month: parseInt(searchParams!.get('month')!),
        day: parseInt(searchParams!.get('day')!),
        hour: parseInt(searchParams!.get('hour') || '12'),
        gender: (searchParams!.get('gender') || 'male') as 'male' | 'female',
        calendarType: (searchParams!.get('calendarType') || 'solar') as 'solar' | 'lunar',
      };
    }
    if (targetProfile) {
      const [y, m, d] = targetProfile.birth_date.split('-').map(Number);
      return {
        year: y, month: m, day: d,
        hour: targetProfile.birth_time ? parseInt(targetProfile.birth_time.split(':')[0]) : 12,
        gender: targetProfile.gender,
        calendarType: targetProfile.calendar_type,
      };
    }
    return null;
  }, [searchParams, hourUnknown, hasUrlBirth, targetProfile]);

  const cacheKey = useMemo(() => {
    if (!birthInput) return null;
    const b = birthInput;
    return `${b.calendarType}_${b.year}-${b.month}-${b.day}_${b.hour}_${b.gender}`;
  }, [birthInput]);

  // 보관함 매칭용 sourceBirth — birthInput 에서 추출
  const sourceBirth = useMemo(() => {
    if (!birthInput) return undefined;
    const b = birthInput;
    return {
      birth_date: `${b.year}-${String(b.month).padStart(2,'0')}-${String(b.day).padStart(2,'0')}`,
      gender: b.gender,
      calendar_type: b.calendarType,
    };
  }, [birthInput]);

  // 명반 계산 — 보관함 재생 모드에서도 chart 는 birth_date 기반으로 재계산해 SVG 등 렌더 가능하게.
  // birthInput 객체 reference 가 매 렌더 갱신되어도 명반 식별이 동일하면 chart reference 를
  // 유지해야 하위 effect (AI 호출) 가 cleanup→재실행 되며 setTimeout 이 무한 cancel 되는
  // 무한 로딩 버그를 방지.
  useEffect(() => {
    if (!birthInput) return;
    try {
      const b = birthInput;
      const result = calculateZamidusu(b.year, b.month, b.day, b.hour, b.gender, b.calendarType);
      setChart((prev) => {
        if (
          prev &&
          prev.solarDate === result.solarDate &&
          prev.lunarDate === result.lunarDate &&
          prev.gender === result.gender &&
          prev.timeRange === result.timeRange
        ) {
          return prev;
        }
        return result;
      });
    } catch (e: any) {
      setError(e?.message || '명반 계산 실패');
    }
  }, [birthInput]);

  // ── 보관함 재생 모드 — recordId 가 있으면 DB에서 풀이 복원, AI 호출 skip ──
  useEffect(() => {
    if (!recordId) return;
    let cancelled = false;
    sajuDB.getRecordById(recordId)
      .then((record) => {
        if (cancelled || !record) return;
        // chart 는 위 useEffect 가 처리(birthInput → calculateZamidusu).
        // 보관함 모드에서 birthInput 도출은 primary/searchParams 를 따르므로,
        // 보관함 record 의 birth 로 강제 재계산.
        try {
          const [y, m, d] = record.birth_date.split('-').map(Number);
          const h = record.birth_time ? parseInt(record.birth_time.split(':')[0], 10) : 12;
          setChart(calculateZamidusu(y, m, d, h, record.gender, record.calendar_type));
        } catch (e) {
          console.error('[archive replay] zamidusu chart recalc failed', e);
        }
        const content = record.interpretation_detailed ?? record.interpretation_basic ?? '';
        const sections = parseZamidusuSections(content);
        setAiResult(
          Object.keys(sections).length > 0
            ? { success: true, content, sections }
            : { success: true, content },
        );
      })
      .catch((e) => {
        console.error('[archive replay] load failed', e);
        if (!cancelled) setAiResult({ success: false, error: '보관된 풀이를 불러오지 못했어요.' });
      })
      .finally(() => { if (!cancelled) setAiLoading(false); });
    return () => { cancelled = true; };
  }, [recordId]);

  const reading: ZamidusuReading | null = useMemo(() => {
    return chart ? buildZamidusuReading(chart) : null;
  }, [chart]);

  // ── 보관함 DB 확인 → AI 호출 (순차 실행) ──
  // 보관함 체크를 먼저 완료한 뒤, 기존 풀이가 없을 때만 AI 호출
  const aiStartedRef = useRef(false);
  useEffect(() => {
    if (isArchiveMode) return;
    if (!chart || !cacheKey) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const isFresh = searchParams?.get('fresh') === '1';

    const run = async () => {
      // ★ cache 우선 — 메모리 unload→reload 후에도 archive 모달 없이 즉시 복원
      if (!isFresh && refetchNonce === 0) {
        const cached = useReportCacheStore.getState().getReport<ZamidusuAIResult>('zamidusu', cacheKey);
        if (cached?.error) {
          setAiResult({ success: false, error: cached.error });
          setAiLoading(false);
          return;
        }
        if (cached?.data) {
          setAiResult(cached.data);
          setAiLoading(false);
          aiStartedRef.current = true;
          return;
        }
      } else if (isFresh) {
        useReportCacheStore.getState().invalidate('zamidusu', cacheKey);
      }

      if (refetchNonce === 0 && sourceBirth && !isFresh) {
        try {
          const found = await findRecentArchive({
            category: 'zamidusu',
            birth_date: sourceBirth.birth_date,
            gender: sourceBirth.gender,
            profile_id: targetProfile?.id,
          });
          if (cancelled) return;
          if (found) {
            setSavedRecordId(found.id);
            setAiLoading(false);
            setCacheGate({
              kind: 'zamidusu',
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

      if (aiStartedRef.current) return;
      aiStartedRef.current = true;

      setAiLoading(true);
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        const timeoutMsg = '응답이 너무 오래 걸려요. 아래 명반은 정상이니 확인하시고, 풀이는 다시 시도해주세요.';
        setAiResult({ success: false, error: timeoutMsg });
        setAiLoading(false);
        useReportCacheStore.getState().setError('zamidusu', cacheKey, timeoutMsg);
      }, 45_000);

      getZamidusuReading(chart, sourceBirth, targetProfile?.id)
        .then(r => {
          if (cancelled) return;
          clearTimeout(timeoutId);
          setAiResult(r);
          setAiLoading(false);
          // archive 저장이 완료된 경우 ShareBar 즉시 노출
          if (r.success && r.archivedRecordId) setSavedRecordId(r.archivedRecordId);
          const cache = useReportCacheStore.getState();
          if (r.success) {
            cache.setReport('zamidusu', cacheKey, r);
            if (!cache.isCharged('zamidusu', cacheKey)) {
              cache.markCharged('zamidusu', cacheKey);
              chargeRef.current('sun', SUN_COST_BIG, CHARGE_REASONS.zamidusu).catch(() => {});
            }
          } else if (r.error) {
            cache.setError('zamidusu', cacheKey, r.error);
          }
        })
        .catch(err => {
          if (cancelled) return;
          clearTimeout(timeoutId);
          const msg = err?.message || '풀이를 불러오지 못했어요';
          setAiResult({ success: false, error: msg });
          setAiLoading(false);
          useReportCacheStore.getState().setError('zamidusu', cacheKey, msg);
        });
    };

    run();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, cacheKey, isArchiveMode, refetchNonce]);

  // ── 시각화 데이터 (chart 가 null 일 수 있으므로 가드. 훅 순서 보장 위해 early return 앞에 둠) ──
  const currentAge = useMemo(() => {
    if (!birthInput) return 0;
    return Math.max(0, new Date().getFullYear() - birthInput.year + 1);
  }, [birthInput]);
  const coreScores = useMemo(() => (chart ? calcCoreScores(chart) : []), [chart]);
  const overallScore = useMemo(
    () => (coreScores.length > 0 ? calcOverallScore(coreScores) : 0),
    [coreScores],
  );
  const mutagenPlacements = useMemo(
    () => (chart ? calcMutagenPlacements(chart) : []),
    [chart],
  );
  const daehanSegments = useMemo(
    () => (chart ? calcDaehanTimeline(chart, currentAge) : []),
    [chart, currentAge],
  );

  // ── 시간 미상 가드 ──
  // 보관함 재생 모드에선 이 가드를 우회 — 과거에 시간 알았던 시점에 받은 풀이를
  // 이후 프로필 시간을 미상으로 바꿨다는 이유로 못 보게 막으면 안 됨.
  if (hourUnknown && !isArchiveMode) {
    return (
      <div className={styles.container}>
        <div className="flex items-center relative mb-5 pt-3 px-1">
          <BackButton className="absolute left-0" />
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>자미두수</h1>
          </div>
        </div>
        <div style={{
          margin: '24px 16px', padding: '20px',
          background: 'var(--space-surface)',
          border: '1px solid rgba(251, 191, 36, 0.35)',
          borderRadius: '16px',
          color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          <p style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 8 }}>
            자미두수는 정확한 출생 시간이 필요합니다
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            자미두수는 태어난 시각(시지)에 따라 12궁 배치가 완전히 달라지는 별자리 체계예요. 시간이 없으면 별들이 어느 방에 자리 잡는지 알 수 없어 명반 자체가 성립하지 않습니다.
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            대신 <strong>사주 해석</strong>은 시주 없이도 연·월·일주와 대운으로 성격·재물·애정·직업을 충실히 읽어드려요.
          </p>
          <button
            onClick={() => {
              if (!searchParams) return;
              const qs = searchParams.toString();
              router.push(`/saju/result?${qs}`);
            }}
            style={{
              width: '100%', padding: '12px',
              background: 'var(--cta-primary)', color: '#fff',
              border: 'none', borderRadius: 10,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            사주 해석으로 이동
          </button>
        </div>
      </div>
    );
  }

  // ── 프로필 선택 가드 ──
  if (needsProfileSelect) {
    return (
      <QuickFortuneGate
        serviceName="자미두수"
        description="중국 송나라 진희이가 창시한 별자리 명리학이에요. 생년월일시를 기반으로 자미성을 비롯한 108개 성(星)의 배치를 분석하여 성격, 재물, 관계, 건강 등 삶의 큰 그림을 읽어냅니다."
        archiveCategory="zamidusu"
        creditType="sun"
        creditCost={SUN_COST_BIG}
      />
    );
  }

  // ── 프로필 없음 가드 ──
  if (!hasUrlBirth && !targetProfile) {
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
        <p className="text-[17px] font-semibold text-text-primary mb-2">대표 프로필이 없어요</p>
        <p className="text-[15px] text-text-secondary mb-4">프로필을 등록하면 자미두수를 볼 수 있어요</p>
        <button
          onClick={() => router.push('/saju/input?mode=profile-only')}
          className="px-4 py-2 rounded-lg bg-cta text-white text-[15px] font-semibold"
        >
          프로필 등록하기
        </button>
      </div>
    );
  }

  if (error) {
    return <div className={styles.loading}>{error}</div>;
  }

  // ── 풀스크린 로딩: 명반 계산 OR AI 풀이 대기 중 ──
  // 한번에 모든 내용이 준비되어 쭉 보이도록 풀스크린으로 대기
  if (!chart || aiLoading) {
    return (
      <AILoadingBar
        label="자미두수 명반을 펼치는 중"
        minLabel="15초"
        maxLabel="40초"
        estimatedSeconds={25}
        messages={LOADING_MESSAGES}
        topContent={
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="text-[28px] mb-1 tracking-widest" style={{ fontFamily: 'var(--font-serif)' }}>
              紫微斗數
            </div>
            <div className="text-[15px] text-text-tertiary">하늘의 별자리 지도</div>
          </motion.div>
        }
      />
    );
  }

  const sections = aiResult?.sections ?? {};
  const aiFailed = !!aiResult && !aiResult.success;

  const retryAI = () => {
    aiStartedRef.current = false;
    setAiResult(null);
    setAiLoading(false);
    // effect가 chart 의존성이라 chart 여전히 같으면 재실행 안 됨 → 강제로 state 초기화 후
    // 즉시 수동 재호출
    if (!chart) return;
    aiStartedRef.current = true;
    setAiLoading(true);
    getZamidusuReading(chart, sourceBirth, targetProfile?.id)
      .then(r => {
        setAiResult(r);
        setAiLoading(false);
        if (r.success && r.archivedRecordId) setSavedRecordId(r.archivedRecordId);
      })
      .catch(err => {
        setAiResult({ success: false, error: err?.message || '풀이를 불러오지 못했어요' });
        setAiLoading(false);
      });
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className="flex items-center relative mb-5 pt-3 px-1">
        <BackButton className="absolute left-0" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>자미두수</h1>
          <p className="text-base text-text-tertiary mt-1">
            {chart.solarDate} {chart.timeRange}
          </p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

        {/* AI 풀이 실패 배너 + 재시도 */}
        {aiFailed && (
          <div
            className={styles.section}
            style={{
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.35)',
            }}
          >
            <p style={{ fontSize: 13, color: '#F87171', fontWeight: 600, marginBottom: 6 }}>
              별자리 풀이를 불러오지 못했어요
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              {aiResult?.error || '잠시 후 다시 시도해주세요.'} 아래 명반 자체는 정상적으로 계산되어 있어 바로 확인할 수 있어요.
            </p>
            <button
              onClick={retryAI}
              style={{
                padding: '8px 16px',
                background: 'var(--cta-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              다시 풀이받기
            </button>
          </div>
        )}

        {/* 자미두수란? 안내 카드 */}
        <div className={styles.section} style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }}>
          <button
            onClick={() => setIntroOpen(v => !v)}
            style={{
              width: '100%', background: 'none', border: 'none', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              자미두수가 뭔가요?
            </span>
            <span style={{ fontSize: 14, color: 'var(--cta-primary)', fontWeight: 600 }}>
              {introOpen ? '접기' : '펼치기'}
            </span>
          </button>
          <AnimatePresence>
            {introOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.85, letterSpacing: '-0.005em', margin: '14px 0 0', fontFamily: 'var(--font-body)' }}>
                  자미두수(紫微斗數)는 <b style={{ color: 'var(--text-primary)' }}>북극성</b>과 <b style={{ color: 'var(--text-primary)' }}>북두칠성</b>으로 운명을 읽는 천 년 된 별자리 점성술이에요.
                  태어난 순간 하늘에 나만의 <b style={{ color: 'var(--text-primary)' }}>별자리 지도(명반)</b>가 그려지는데, 이 지도에는 인생의 12개 방이 있어요.
                  각 방에는 다른 주인공 별이 앉아서 — 사랑·재물·건강·명예 — 인생의 각 영역을 이끌어가죠.
                  사주가 <b style={{ color: 'var(--text-primary)' }}>내 기질·체질</b>을 본다면, 자미두수는 <b style={{ color: 'var(--text-primary)' }}>내 인생 무대의 조명 배치</b>를 봅니다.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 명반 요약 메타 — 별도 섹션으로 분리 + 크게 */}
        <div className={styles.section} style={{ padding: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <div style={{ textAlign: 'center', padding: '10px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>띠</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>{chart.zodiac}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>별자리</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>{chart.sign}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>오행국</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#FBBF24', fontFamily: 'var(--font-serif)' }}>{chart.fiveElementsClass}</div>
            </div>
          </div>
        </div>

        {/* 별자리 시각화 */}
        <div className={styles.section}>
          <h2 style={{ textAlign: 'center', marginBottom: 14, fontSize: 18 }}>하늘에 새겨진 당신의 별자리</h2>
          <StarChart
            palaces={chart.palaces}
            soul={chart.soul}
            fiveElementsClass={chart.fiveElementsClass}
            selectedIndex={selectedPalace}
            onSelect={(idx) => setSelectedPalace(selectedPalace === idx ? null : idx)}
          />
        </div>

        {/* 선택된 궁 상세 — 모달 오버레이 */}
        <AnimatePresence>
          {selectedPalace !== null && (() => {
            const p = chart.palaces.find((x) => x.index === selectedPalace);
            if (!p) return null;
            return (
              <motion.div
                key="palace-modal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSelectedPalace(null)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 100,
                  background: 'rgba(0,0,0,0.7)',
                  backdropFilter: 'blur(6px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 16,
                  paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
                  paddingBottom: 'calc(16px + 64px + env(safe-area-inset-bottom, 0px))',
                  overflowY: 'auto',
                }}
              >
                {/* 모달 카드 — transform 대신 flex 센터링 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.22 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'relative',
                    width: 'min(380px, 100%)',
                    maxHeight: 'calc(100dvh - 120px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
                    overflowY: 'auto',
                    background: 'rgba(20, 12, 38, 0.98)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 18,
                    padding: 22,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                  }}
                >
                  {/* 닫기 버튼 */}
                  <button
                    onClick={() => setSelectedPalace(null)}
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.06)',
                      border: 'none',
                      color: 'var(--text-tertiary)',
                      fontSize: 20,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    aria-label="닫기"
                  >
                    ✕
                  </button>

                  {/* 헤더 — 궁 이름 + 이 방이 뭐하는 곳인지 설명 */}
                  <div style={{ marginBottom: 20, paddingRight: 36 }}>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-serif)',
                      }}
                    >
                      {p.name}
                      {p.isBodyPalace && (
                        <span style={{ fontSize: 14, color: '#F472B6', marginLeft: 8, fontWeight: 500 }}>
                          · 신궁
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--text-tertiary)',
                        marginTop: 4,
                        letterSpacing: 1,
                      }}
                    >
                      {p.heavenlyStem}{p.earthlyBranch}
                      {p.decadalRange && ` · 대한 ${p.decadalRange}`}
                    </div>

                    {/* 이 궁이 뭐하는 자리인지 쉬운 설명 */}
                    {PALACE_ROLE_META[p.name] && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: '12px 14px',
                          background: 'rgba(139,92,246,0.08)',
                          border: '1px solid rgba(139,92,246,0.25)',
                          borderRadius: 10,
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#C4B5FD', marginBottom: 4 }}>
                          이 방은 뭘 맡고 있나요?
                        </div>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>
                          {PALACE_ROLE_META[p.name].domain}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                          {PALACE_ROLE_META[p.name].focus}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 주성 — 각각 설명 풀어서 */}
                  <div style={{ marginBottom: 18 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span style={{ display: 'inline-block', width: 3, height: 16, borderRadius: 2, background: 'var(--cta-primary)' }} />
                      주인공 별
                    </div>
                    {p.majorStars.length === 0 ? (
                      <div
                        style={{
                          fontSize: 14,
                          padding: 14,
                          borderRadius: 10,
                          background: 'rgba(255,255,255,0.04)',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.6,
                        }}
                      >
                        공궁이에요 — 이 방에는 주성이 없고 맞은편 궁(대궁)의 영향을 크게 받습니다.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {p.majorStars.map((s, i) => {
                          const meta = MAJOR_STARS_META[s.name];
                          const mutagen = s.mutagen ? MUTAGEN_META[s.mutagen] : undefined;
                          return (
                            <div
                              key={i}
                              style={{
                                padding: 14,
                                borderRadius: 12,
                                background: 'rgba(196,181,253,0.08)',
                                border: '1px solid rgba(196,181,253,0.25)',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: '#D8BFFD',
                                    fontFamily: 'var(--font-serif)',
                                  }}
                                >
                                  {s.name}
                                  {meta && <span style={{ fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: 4 }}>({meta.hanja})</span>}
                                </span>
                                {s.brightness && (
                                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 6 }}>
                                    {s.brightness}
                                  </span>
                                )}
                                {s.mutagen && (
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#FBBF24', background: 'rgba(251,191,36,0.12)', padding: '2px 8px', borderRadius: 6 }}>
                                    {s.mutagen}
                                  </span>
                                )}
                              </div>

                              {meta && (
                                <>
                                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6, lineHeight: 1.5 }}>
                                    {meta.theme}
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                                    {meta.keywords.slice(0, 5).map((kw, ki) => (
                                      <span
                                        key={ki}
                                        style={{
                                          fontSize: 12,
                                          padding: '3px 9px',
                                          borderRadius: 999,
                                          background: 'rgba(255,255,255,0.05)',
                                          color: 'var(--text-secondary)',
                                        }}
                                      >
                                        {kw}
                                      </span>
                                    ))}
                                  </div>
                                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 4 }}>
                                    <b style={{ color: '#34D399' }}>강점</b> {meta.strength}
                                  </div>
                                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                                    <b style={{ color: '#F87171' }}>약점</b> {meta.weakness}
                                  </div>
                                </>
                              )}

                              {mutagen && (
                                <div
                                  style={{
                                    marginTop: 10,
                                    padding: '10px 12px',
                                    background: 'rgba(251,191,36,0.1)',
                                    border: '1px solid rgba(251,191,36,0.3)',
                                    borderRadius: 8,
                                  }}
                                >
                                  <div style={{ fontSize: 12, fontWeight: 700, color: '#FBBF24', marginBottom: 3 }}>
                                    사화({mutagen.name}) 발동
                                  </div>
                                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                                    {mutagen.effect}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 보조성 — 각각 설명 */}
                  {p.minorStars.length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          marginBottom: 10,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span style={{ display: 'inline-block', width: 3, height: 16, borderRadius: 2, background: '#34D399' }} />
                        곁에서 돕는 별
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {p.minorStars.map((s, i) => {
                          const meta = MINOR_STARS_META[s.name];
                          const badgeColor =
                            meta?.category === '6길성' ? '#34D399' :
                            meta?.category === '4흉성' ? '#F87171' : 'var(--text-tertiary)';
                          return (
                            <div
                              key={i}
                              style={{
                                padding: '10px 12px',
                                borderRadius: 10,
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: meta ? 4 : 0, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {s.name}
                                  {meta && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: 4 }}>({meta.hanja})</span>}
                                </span>
                                {meta && (
                                  <span style={{ fontSize: 11, fontWeight: 600, color: badgeColor, background: `${badgeColor}18`, padding: '2px 7px', borderRadius: 6 }}>
                                    {meta.category}
                                  </span>
                                )}
                              </div>
                              {meta && (
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                  {meta.effect}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* 시각화 — 6궁 레이더·사화·대한 (명반 데이터 기반, AI 무관) */}
        <div className={styles.section}>
          <CorePalaceScores cores={coreScores} overall={overallScore} />
        </div>
        {mutagenPlacements.length > 0 && (
          <div className={styles.section}>
            <MutagenCards placements={mutagenPlacements} />
          </div>
        )}
        {daehanSegments.length > 0 && (
          <div className={styles.section}>
            <DaehanTimeline segments={daehanSegments} currentAge={currentAge} />
          </div>
        )}

        {/* AI 풀이 — 섹션별 은유 헤드라인으로 카드화 */}
        {ZAMIDUSU_SECTION_KEYS.map((key, idx) => {
          const text = sections[key];
          if (!text) return null;
          // [은유] 마커 우선 추출 + 본문 strip. 마커 없으면 첫 줄 휴리스틱 fallback.
          const parsed = extractMetaphor(text);
          let headline = parsed.metaphorTitle;
          let body = parsed.bodyText;
          let hasHeadline = headline.length > 0;
          if (!hasHeadline) {
            const lines = body.split('\n');
            const candidate = lines[0]?.trim() || '';
            const couldBe = lines.length > 1 && candidate.length > 0 && candidate.length <= 80;
            if (couldBe) {
              headline = candidate;
              body = lines.slice(1).join('\n').trim() || candidate;
              hasHeadline = true;
            } else {
              body = body || candidate;
            }
          }
          return (
            <SectionCollapsible
              key={key}
              title={ZAMIDUSU_SECTION_LABELS[key]}
              metaphorTitle={hasHeadline ? headline : undefined}
              defaultOpen={idx === 0}
              enterDelay={0.05 * idx}
            >
              {(() => {
                const raw = hasHeadline ? body : text;
                const paragraphs = splitIntoParagraphs(raw);
                return paragraphs.map((p, i) => (
                  <p
                    key={i}
                    style={{
                      fontSize: 17,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.85,
                      letterSpacing: '-0.005em',
                      margin: i === 0 ? 0 : '14px 0 0',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    {p}
                  </p>
                ));
              })()}
            </SectionCollapsible>
          );
        })}

        {/* AI 응답이 섹션 파싱 실패했거나 완전히 비어있으면 원문 fallback */}
        {aiResult?.content && Object.keys(sections).length === 0 && (
          <div className={styles.section}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, whiteSpace: 'pre-line', margin: 0 }}>
              {stripAllSectionTags(aiResult.content)}
            </p>
          </div>
        )}

        {/* 엔진 기반 보조 풀이 — AI 섹션도 실패하고 원문도 없을 때만 노출 */}
        {reading && Object.keys(sections).length === 0 && !aiResult?.content && (
          <>
            <div className={styles.section}>
              <h2>명반 요약</h2>
              <p style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 12 }}>
                {reading.profileHeadline}
              </p>
              {reading.coreStars.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {reading.coreStars.map((s, i) => (
                    <div key={i} style={{ padding: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                        {s.name}({s.hanja}) — {s.keywords.slice(0, 3).join(' · ')}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.theme}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </motion.div>

      {(recordId || savedRecordId) && (
        <div style={{ marginTop: 24, padding: '0 16px' }}>
          <ShareBar recordId={(recordId || savedRecordId)!} type="saju" category="zamidusu" />
        </div>
      )}

      <RestoreReportModal
        open={!!cacheGate}
        title="자미두수"
        onUseCached={handleUseCached}
        onRefresh={handleRefetch}
        onClose={() => setCacheGate(null)}
      />
    </div>
  );
}
