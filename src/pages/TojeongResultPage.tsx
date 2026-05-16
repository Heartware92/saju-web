'use client';

/**
 * 토정비결 결과 페이지 (전체 무료 · 결정론적 풀이)
 * URL: /saju/tojeong?year=1990&month=1&day=1&calendarType=solar&...&targetYear=2026
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { calculateTojeong, type TojeongResult } from '../engine/tojeong';
import { buildTojeongReading, type TojeongReading } from '../engine/tojeong/reading';
import type { GwaeGrade } from '../engine/tojeong/gwae-table';
import { useProfileStore } from '../store/useProfileStore';
import { extractMetaphor } from '../utils/parseMetaphor';
import { SectionCollapsible } from '../components/saju/SectionCollapsible';
import { useCreditStore } from '../store/useCreditStore';
import { useReportCacheStore, type ReportKind } from '../store/useReportCacheStore';
import { RestoreReportModal } from '../components/RestoreReportModal';
import { QuickFortuneGate } from '../components/QuickFortuneGate';
import { getTojeongReading, parseTojeongSections, parseTojeongScores, stripAllSectionTags, type TojeongAIResult } from '../services/fortuneService';
import { sajuDB } from '../services/supabase';
import { findRecentArchive } from '../services/archiveService';
import { AILoadingBar } from '../components/AILoadingBar';
import { SUN_COST_BIG, CHARGE_REASONS } from '../constants/creditCosts';
import { BackButton } from '../components/ui/BackButton';
import { useLoadingGuard } from '../hooks/useLoadingGuard';
import { useScrollToTopOnLoad } from '../hooks/useScrollToTopOnLoad';
import { ShareBar } from '@/components/share/ShareBar';
import { RadarChart } from '../components/charts/RadarChart';
import { TOJEONG_SECTION_KEYS, TOJEONG_SECTION_LABELS, type TojeongSectionKey } from '../constants/prompts';
import type { FortuneGrade } from '../engine/periodFortune';

const TOJEONG_MESSAGES = [
  '괘의 상징을 풀어 쓰는 중입니다',
  '12개월의 흐름을 정리하는 중입니다',
  '총운의 방향을 잡는 중입니다',
  '깊이 있는 풀이를 위해 한 번 더 다듬는 중입니다',
  '거의 다 됐어요 — 한 해의 결을 정리 중입니다',
];

// 한자 간지 → 한글 간지 (예: "丙午" → "병오")
const HANJA_TO_KOR: Record<string, string> = {
  '甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무',
  '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계',
  '子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진',
  '巳': '사', '午': '오', '未': '미', '申': '신', '酉': '유',
  '戌': '술', '亥': '해',
};

function ganZhiToKor(ganZhi: string): string {
  if (!ganZhi) return '';
  return Array.from(ganZhi).map((c) => HANJA_TO_KOR[c] ?? c).join('');
}

const GRADE_COLOR: Record<GwaeGrade, string> = {
  '대길': '#34D399',
  '길': '#86EFAC',
  '중길': '#FBBF24',
  '평': '#CBD5E1',
  '중흉': '#FB923C',
  '흉': '#F87171',
  '대흉': '#EF4444',
};

const FORTUNE_GRADE_COLOR: Record<FortuneGrade, string> = {
  '대길': '#34D399',
  '길': '#86EFAC',
  '중길': '#FBBF24',
  '평': '#CBD5E1',
  '중흉': '#FB923C',
  '흉': '#F87171',
};

function scoreToGrade(s: number): FortuneGrade {
  if (s >= 90) return '대길';
  if (s >= 82) return '길';
  if (s >= 72) return '중길';
  if (s >= 65) return '평';
  if (s >= 60) return '중흉';
  return '흉';
}

function ScoreRing({ score, grade, size = 120 }: { score: number; grade: FortuneGrade; size?: number }) {
  const c = FORTUNE_GRADE_COLOR[grade];
  const r = size * 0.4;
  const C = 2 * Math.PI * r;
  const offset = C * (1 - score / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={size * 0.083} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={c} strokeWidth={size * 0.083} strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.23} fontWeight="bold" fill="white">{score}</text>
      <text x={size / 2} y={size / 2 + size * 0.18} textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.09} fill="rgba(255,255,255,0.6)">점 · {grade}</text>
    </svg>
  );
}

function DomainBar({ label, score, grade }: { label: string; score: number; grade: FortuneGrade }) {
  const c = FORTUNE_GRADE_COLOR[grade];
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

function parseMonthlyEntries(raw: string): { month: number; keyword: string; text: string }[] {
  const entries: { month: number; keyword: string; text: string }[] = [];
  const cleaned = raw.replace(/\[\/?[a-zA-Z_]+\]/g, '').trim();
  const parts = cleaned.split(/(?=\d{1,2}월\s*[—\-–]\s*)/);
  for (const part of parts) {
    const m = part.match(/^(\d{1,2})월\s*[—\-–]\s*(.+?)[\n\r]/);
    if (!m) continue;
    const month = parseInt(m[1], 10);
    const keyword = m[2].trim();
    const text = part.slice(m[0].length).trim();
    if (month >= 1 && month <= 12 && text) {
      entries.push({ month, keyword, text });
    }
  }
  return entries;
}

const DOMAIN_DEFS: { key: 'wealth' | 'love' | 'health' | 'career'; label: string }[] = [
  { key: 'wealth', label: '재물운' },
  { key: 'love', label: '애정·가정' },
  { key: 'health', label: '건강운' },
  { key: 'career', label: '직장·학업' },
];

export default function TojeongResultPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const profileId = searchParams?.get('profileId') ?? null;
  const recordId = searchParams?.get('recordId') ?? null;
  const isArchiveMode = !!recordId;
  const needsProfileSelect = !profileId && !isArchiveMode && !searchParams?.get('year');
  const { profiles, fetchProfiles, hydrated, loading: profilesLoading, lastFetchedAt } = useProfileStore();
  const targetProfile = useMemo(() => {
    if (profileId) return profiles.find(p => p.id === profileId) ?? null;
    if (needsProfileSelect) return null;
    return profiles.find(p => p.is_primary) ?? null;
  }, [profiles, profileId, needsProfileSelect]);
  const chargeForContent = useCreditStore(s => s.chargeForContent);
  const chargeRef = useRef(chargeForContent);
  chargeRef.current = chargeForContent;

  // AI 내러티브 — 진입 즉시 자동 호출
  const [aiContent, setAiContent] = useState<string | null>(null);
  const [aiSections, setAiSections] = useState<Partial<Record<TojeongSectionKey, string>> | null>(null);
  const [aiDomainScores, setAiDomainScores] = useState<{ wealth: number; love: number; health: number; career: number } | null>(null);
  const [aiLoading, setAiLoading] = useState(!isArchiveMode && !needsProfileSelect);

  // 결과 준비 완료 시 스크롤 최상단
  useScrollToTopOnLoad(!!aiSections && !aiLoading);
  const [aiError, setAiError] = useState<string | null>(null);

  // ── 로딩 안전장치: 180초 초과 시 강제 해제 (에러 표시 없음) ──
  // 백엔드 race 마감 150s + 자동 재시도 사이의 여유까지 모두 포함.
  // 길어 보이지만, 실패 시에도 무료 결정론적 풀이가 결과로 노출되므로
  // 사용자는 "결과를 못 받는" 상황이 발생하지 않음.
  const [aiTimedOut] = useLoadingGuard(aiLoading, 180_000);
  useEffect(() => {
    if (aiTimedOut) setAiLoading(false);
  }, [aiTimedOut]);

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

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // ── 보관함 재생 모드 — recordId 가 있으면 DB에서 풀이 복원, AI 호출 skip ──
  useEffect(() => {
    if (!recordId) return;
    let cancelled = false;
    sajuDB.getRecordById(recordId)
      .then((record) => {
        if (cancelled || !record) return;
        const content = record.interpretation_detailed ?? record.interpretation_basic ?? '';
        if (content) {
          setAiContent(content);
          const sections = parseTojeongSections(content);
          if (Object.keys(sections).length > 0) setAiSections(sections);
          const scores = parseTojeongScores(content);
          if (scores) setAiDomainScores(scores);
        }
      })
      .catch((e) => {
        console.error('[archive replay] tojeong load failed', e);
      })
      .finally(() => { if (!cancelled) setAiLoading(false); });
    return () => { cancelled = true; };
  }, [recordId]);

  const { tojeong, reading, cacheKey } = useMemo(() => {
    const hasUrlBirth = !!(searchParams?.get('year') && searchParams?.get('month') && searchParams?.get('day'));
    let year: number, month: number, day: number, calendarType: 'solar' | 'lunar';
    const targetYear = parseInt(searchParams?.get('targetYear') || String(new Date().getFullYear()));

    if (hasUrlBirth) {
      year = parseInt(searchParams!.get('year')!);
      month = parseInt(searchParams!.get('month')!);
      day = parseInt(searchParams!.get('day')!);
      calendarType = (searchParams!.get('calendarType') || 'solar') as 'solar' | 'lunar';
    } else if (targetProfile) {
      const [y, m, d] = targetProfile.birth_date.split('-').map(Number);
      year = y; month = m; day = d;
      calendarType = targetProfile.calendar_type;
    } else {
      return { tojeong: null, reading: null, cacheKey: null };
    }

    try {
      const t = calculateTojeong(year, month, day, calendarType, targetYear);
      const r = buildTojeongReading(t);
      const key = `${calendarType}_${year}-${month}-${day}_${targetYear}`;
      return { tojeong: t, reading: r, cacheKey: key };
    } catch {
      return { tojeong: null, reading: null, cacheKey: null };
    }
  }, [searchParams, targetProfile]);

  // 보관함 매칭용 sourceBirth — 대표 프로필 또는 URL birth 쿼리에서 추출
  const sourceBirth = useMemo(() => {
    const urlGender = searchParams?.get('gender');
    const urlYear = searchParams?.get('year');
    if (urlYear && urlGender) {
      const year = parseInt(urlYear, 10);
      const month = parseInt(searchParams!.get('month')!, 10);
      const day = parseInt(searchParams!.get('day')!, 10);
      const cal = (searchParams!.get('calendarType') || 'solar') as 'solar' | 'lunar';
      return {
        birth_date: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
        gender: urlGender as 'male' | 'female',
        calendar_type: cal,
      };
    }
    if (targetProfile) {
      return {
        birth_date: targetProfile.birth_date,
        gender: targetProfile.gender,
        calendar_type: targetProfile.calendar_type,
      };
    }
    return undefined;
  }, [searchParams, targetProfile]);

  // ── 보관함 DB 확인 → 심층 풀이 호출 (순차 실행) ──
  // 보관함 체크를 먼저 완료한 뒤, 기존 풀이가 없을 때만 호출.
  // 첫 시도가 빈 응답이면 백그라운드에서 1회 자동 재시도(5s 후) → 사용자에게 에러 노출 최소화.
  const aiStartedRef = useRef(false);
  const aiAttemptCountRef = useRef(0);
  useEffect(() => {
    if (isArchiveMode) return;
    if (!tojeong || !cacheKey) return;

    let cancelled = false;

    const isFresh = searchParams?.get('fresh') === '1';

    // 페이지 사이드 자동 재시도 — 백엔드 4단 폴백이 모두 실패해 빈 결과를 받았을 때
    // 4초 대기 후 한 번 더 호출. 사용자 입장에서는 길어진 단일 로딩 안에서 처리됨.
    // 2회 모두 실패해도 무료 결정론적 풀이가 페이지의 결과로 노출되므로 화면은 절대 비지 않음.
    const MAX_PAGE_ATTEMPTS = 2;

    const fetchOnce = async (attemptIdx: number): Promise<void> => {
      try {
        const r = await getTojeongReading(tojeong, sourceBirth, targetProfile?.id);
        if (cancelled) return;
        if (r.content) {
          setAiContent(r.content);
          if (r.sections) setAiSections(r.sections);
          if (r.domainScores) setAiDomainScores(r.domainScores);
          // archive 저장이 완료된 경우 ShareBar 즉시 노출
          if (r.archivedRecordId) setSavedRecordId(r.archivedRecordId);
          const cache = useReportCacheStore.getState();
          cache.setReport('tojeong', cacheKey, r.content);
          if (!cache.isCharged('tojeong', cacheKey)) {
            cache.markCharged('tojeong', cacheKey);
            chargeRef.current('moon', SUN_COST_BIG, CHARGE_REASONS.tojeong, `tojeong:${cacheKey}`)
              .catch(e => console.error('[charge:tojeong] failed', e));
          }
          setAiLoading(false);
          return;
        }
        if (attemptIdx + 1 < MAX_PAGE_ATTEMPTS) {
          aiAttemptCountRef.current = attemptIdx + 1;
          setTimeout(() => {
            if (cancelled) return;
            void fetchOnce(attemptIdx + 1);
          }, 4_000);
          return;
        }
        // 모든 시도 실패 — 로딩만 종료. 무료 결정론적 풀이가 페이지 결과로 노출.
        setAiLoading(false);
      } catch {
        if (cancelled) return;
        if (attemptIdx + 1 < MAX_PAGE_ATTEMPTS) {
          aiAttemptCountRef.current = attemptIdx + 1;
          setTimeout(() => {
            if (cancelled) return;
            void fetchOnce(attemptIdx + 1);
          }, 4_000);
          return;
        }
        setAiLoading(false);
      }
    };

    const run = async () => {
      // ★ cache 우선 — 메모리 unload→reload 후에도 archive 모달 없이 즉시 복원
      if (!isFresh && refetchNonce === 0) {
        const cached = useReportCacheStore.getState().getReport<string>('tojeong', cacheKey);
        // 캐시된 에러는 무시하고 새로 시도 (일시적 장애 후 복구 보장)
        if (cached?.data) {
          setAiContent(cached.data);
          const sections = parseTojeongSections(cached.data);
          if (Object.keys(sections).length > 0) setAiSections(sections);
          const scores = parseTojeongScores(cached.data);
          if (scores) setAiDomainScores(scores);
          setAiLoading(false);
          aiStartedRef.current = true;
          return;
        }
      } else if (isFresh) {
        useReportCacheStore.getState().invalidate('tojeong', cacheKey);
      }

      if (refetchNonce === 0 && sourceBirth && !isFresh) {
        try {
          const found = await findRecentArchive({
            category: 'tojeong',
            birth_date: sourceBirth.birth_date,
            gender: sourceBirth.gender,
            profile_id: targetProfile?.id,
          });
          if (cancelled) return;
          if (found) {
            setSavedRecordId(found.id);
            setAiLoading(false);
            setCacheGate({
              kind: 'tojeong',
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
      aiAttemptCountRef.current = 0;

      setAiLoading(true);
      void fetchOnce(0);
    };

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tojeong, cacheKey, isArchiveMode, refetchNonce]);

  const retryAI = () => {
    if (!tojeong || !cacheKey) return;
    useReportCacheStore.getState().invalidate('tojeong', cacheKey);
    aiStartedRef.current = true;
    setAiContent(null);
    setAiSections(null);
    setAiDomainScores(null);
    setAiError(null);
    setAiLoading(true);
    getTojeongReading(tojeong, sourceBirth, targetProfile?.id)
      .then((r: TojeongAIResult) => {
        if (r.content) {
          setAiContent(r.content);
          if (r.sections) setAiSections(r.sections);
          if (r.domainScores) setAiDomainScores(r.domainScores);
          // archive 저장이 완료된 경우 ShareBar 즉시 노출
          if (r.archivedRecordId) setSavedRecordId(r.archivedRecordId);
          const cache = useReportCacheStore.getState();
          cache.setReport('tojeong', cacheKey, r.content);
          if (!cache.isCharged('tojeong', cacheKey)) {
            cache.markCharged('tojeong', cacheKey);
            chargeRef.current('moon', SUN_COST_BIG, CHARGE_REASONS.tojeong, `tojeong:${cacheKey}`)
              .catch(e => console.error('[charge:tojeong] failed', e));
          }
        }
        setAiLoading(false);
      })
      .catch(() => {
        setAiLoading(false);
      });
  };

  if (needsProfileSelect) {
    return (
      <QuickFortuneGate
        serviceName="토정비결"
        description="조선 시대 토정 이지함 선생이 만든 연간 신수 풀이예요. 음력 생년월일과 세는 나이로 144괘 중 하나를 뽑아 올해의 총운, 12개월 흐름, 재물·애정·건강·직장운을 살펴봅니다."
        archiveCategory="tojeong"
        creditType="moon"
        creditCost={SUN_COST_BIG}
      />
    );
  }

  if (!tojeong || !reading) {
    const hasUrlBirth = !!searchParams?.get('year');
    const profileStoreReady = hydrated && lastFetchedAt !== null && !profilesLoading;
    if (!hasUrlBirth && !profileStoreReady) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-cta border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    if (!targetProfile && !hasUrlBirth) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
          <p className="text-[17px] font-semibold text-text-primary mb-2">대표 프로필이 없어요</p>
          <p className="text-[15px] text-text-secondary mb-4">프로필을 등록하면 토정비결을 볼 수 있어요</p>
          <button
            onClick={() => router.push('/saju/input?mode=profile-only')}
            className="px-4 py-2 rounded-lg bg-cta text-white text-[15px] font-semibold"
          >
            프로필 등록하기
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

  // ── AI 풀이 로딩 — 풀스크린 ──
  if (aiLoading) {
    return (
      <AILoadingBar
        label="토정비결 심층 풀이중"
        minLabel="15초"
        maxLabel="45초"
        estimatedSeconds={25}
        messages={TOJEONG_MESSAGES}
        topContent={
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="text-[32px] mb-1" style={{ fontFamily: 'var(--font-serif)' }}>
              {tojeong.gwaeNumber}괘
            </div>
            <div className="text-[15px] text-text-tertiary">
              {tojeong.targetYear}년 · {reading.grade}
            </div>
          </motion.div>
        }
      />
    );
  }

  const gradeColor = GRADE_COLOR[reading.grade];

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
            {tojeong.targetYear}년 토정비결
          </h1>
        </div>
      </div>

      <p className="text-center text-[14px] text-text-tertiary mb-3">
        {ganZhiToKor(tojeong.yearGanZhi.ganZhi)}년 ({tojeong.yearGanZhi.ganZhi}年)
      </p>

      {/* 토정비결 소개 (직원 피드백: 홈 설명 부족 → 결과 진입 시 안내) */}
      <TojeongIntroCard />

      {/* 괘 번호 */}
      <motion.section
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl p-6 mb-3 text-center"
        style={{ backgroundColor: `${gradeColor}12`, border: `1px solid ${gradeColor}55` }}
      >
        <div className="text-[13px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">올해의 괘</div>
        <div className="text-5xl font-bold mb-2" style={{ color: gradeColor, fontFamily: 'var(--font-serif)' }}>
          {tojeong.gwaeNumber}
        </div>
        <div className="text-[16px] font-semibold mb-1" style={{ color: gradeColor }}>{reading.grade}</div>
        <div className="text-[15px] text-text-secondary">{reading.headline}</div>
      </motion.section>

      {/* 괘 구성 */}
      <section className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <div className="text-[15px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">괘 풀이</div>

        <div className="space-y-2">
          <div className="rounded-lg p-3 bg-white/5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[13px] font-bold text-text-tertiary">상괘</span>
              <span className="text-2xl">{tojeong.upperGwae.symbol}</span>
              <span className="text-[15px] font-bold text-text-primary">
                {tojeong.upperGwae.name}({tojeong.upperGwae.hanja})
              </span>
              <span className="text-[13px] text-text-tertiary">· {tojeong.upperGwae.element}</span>
            </div>
            <div className="text-[14px] text-text-secondary">{tojeong.upperGwae.meaning}</div>
          </div>

          <div className="rounded-lg p-3 bg-white/5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[13px] font-bold text-text-tertiary">중괘</span>
              <span className="text-[15px] font-bold text-text-primary">{tojeong.middleGwae.position}</span>
            </div>
            <div className="text-[14px] text-text-secondary">{tojeong.middleGwae.meaning}</div>
          </div>

          <div className="rounded-lg p-3 bg-white/5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[13px] font-bold text-text-tertiary">하괘</span>
              <span className="text-[15px] font-bold text-text-primary">{tojeong.lowerGwae.name}</span>
            </div>
            <div className="text-[14px] text-text-secondary">{tojeong.lowerGwae.meaning}</div>
          </div>
        </div>
      </section>

      {/* 키워드 */}
      <section className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <div className="text-[15px] font-semibold text-text-secondary mb-2 uppercase tracking-wider">키워드</div>
        <div className="flex flex-wrap gap-1.5">
          {reading.entry.keywords.map((k, i) => (
            <span
              key={i}
              className="text-[14px] px-2.5 py-1 rounded-md border"
              style={{ borderColor: `${gradeColor}55`, color: gradeColor, backgroundColor: `${gradeColor}12` }}
            >
              {k}
            </span>
          ))}
        </div>
      </section>

      {/* 원문 한문 괘사 */}
      {reading.entry.hanjaSa && (
        <section className="rounded-2xl p-4 mb-3 text-center" style={{ backgroundColor: `${gradeColor}08`, border: `1px solid ${gradeColor}33` }}>
          <div className="text-[12px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">괘사 (卦辭)</div>
          <div className="text-[22px] font-bold mb-3 tracking-[0.15em]" style={{ fontFamily: 'var(--font-serif)', color: gradeColor }}>
            {reading.entry.hanjaSa.title}
          </div>
          <div className="space-y-1 mb-3">
            {reading.entry.hanjaSa.lines.map((line, i) => (
              <div key={i} className="text-[16px] tracking-[0.1em] text-text-secondary" style={{ fontFamily: 'var(--font-serif)' }}>
                {line}
              </div>
            ))}
          </div>
          <div className="text-[14px] text-text-tertiary leading-relaxed border-t border-white/10 pt-3 mt-3">
            {reading.entry.hanjaSa.translation}
          </div>
        </section>
      )}

      {/* 총평 */}
      <section className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <div className="text-[15px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">올해 총평</div>
        <div className="space-y-3">
          {reading.paragraphs.map((p, i) => (
            <p key={i} className="text-[15px] text-text-secondary leading-relaxed">{p}</p>
          ))}
        </div>
      </section>

      {/* 월별 흐름 */}
      <section className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <div className="text-[15px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">월별 흐름</div>
        <div className="space-y-1.5">
          {reading.monthly.map(m => (
            <div key={m.month} className="rounded-lg p-2.5 bg-white/5 flex gap-3">
              <div className="shrink-0 text-center" style={{ minWidth: 52 }}>
                <div className="text-[15px] font-bold text-text-primary">{m.month}월</div>
                <div className="text-[12px] text-text-tertiary mt-0.5 whitespace-nowrap">{m.keyword.split('·')[0]}</div>
              </div>
              <div className="flex-1 text-[14px] text-text-secondary leading-relaxed">
                {m.text}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 조언·주의 */}
      <div className="grid grid-cols-1 gap-3">
        <section className="rounded-2xl p-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <div className="text-[15px] font-semibold mb-2" style={{ color: '#34D399' }}>올해의 조언</div>
          <ul className="space-y-1.5">
            {reading.advice.map((a, i) => (
              <li key={i} className="text-[14px] text-text-secondary flex gap-2">
                <span style={{ color: '#34D399' }}>✓</span>
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl p-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <div className="text-[15px] font-semibold mb-2" style={{ color: '#F87171' }}>주의할 점</div>
          <ul className="space-y-1.5">
            {reading.warnings.map((w, i) => (
              <li key={i} className="text-[14px] text-text-secondary flex gap-2">
                <span style={{ color: '#F87171' }}>!</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* 심층 풀이 — 섹션별 카드 렌더링 */}

      {/* 심층 풀이 실패 카드는 노출하지 않음 — 무료 결정론적 풀이가 위에 항상 보이므로
          사용자는 항상 결과를 받을 수 있고, 별도 에러 UI 가 필요 없음.
          (실패 시 크레딧 차감도 일어나지 않음 — chargeForContent 는 r.content 가 있을 때만 호출) */}

      {/* 영역별 점수 시각화 */}
      {aiDomainScores && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-3 rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ display: 'inline-block', width: 4, height: 20, borderRadius: 2, background: 'var(--cta-primary)' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>
              영역별 운세 점수
            </div>
          </div>

          {/* 종합 점수 링 */}
          {(() => {
            const avg = Math.round((aiDomainScores.wealth + aiDomainScores.love + aiDomainScores.health + aiDomainScores.career) / 4);
            return (
              <div className="flex justify-center mb-4">
                <ScoreRing score={avg} grade={scoreToGrade(avg)} size={130} />
              </div>
            );
          })()}

          {/* 레이더 차트 */}
          <RadarChart
            domains={DOMAIN_DEFS.map(d => ({
              label: d.label,
              score: aiDomainScores[d.key],
              color: FORTUNE_GRADE_COLOR[scoreToGrade(aiDomainScores[d.key])],
            }))}
            size={240}
            className="mb-4"
          />

          {/* 도메인 바 */}
          <div className="space-y-2.5">
            {DOMAIN_DEFS.map(d => (
              <DomainBar key={d.key} label={d.label} score={aiDomainScores[d.key]} grade={scoreToGrade(aiDomainScores[d.key])} />
            ))}
          </div>
        </motion.section>
      )}

      {/* 섹션별 카드 */}
      {aiSections && Object.keys(aiSections).length > 0 && (
        <div className="mt-3 space-y-3">
          {TOJEONG_SECTION_KEYS.map((key, idx) => {
            const body = aiSections[key];
            if (!body) return null;

            // 월별운세 섹션 — "N월 — 키워드" 패턴으로 월별 카드 분리
            if (key === 'monthly') {
              const monthEntries = parseMonthlyEntries(body);
              if (monthEntries.length > 0) {
                return (
                  <SectionCollapsible
                    key={key}
                    title={TOJEONG_SECTION_LABELS[key]}
                    defaultOpen={idx === 0}
                    enterDelay={0.15 + idx * 0.05}
                  >
                    <div className="space-y-2">
                      {monthEntries.map(me => (
                        <div key={me.month} className="rounded-lg p-3 bg-white/5">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[15px] font-bold text-text-primary" style={{ minWidth: 36 }}>{me.month}월</span>
                            <span className="text-[13px] text-cta/70 font-semibold whitespace-nowrap">{me.keyword}</span>
                          </div>
                          <div className="text-[14px] text-text-secondary leading-relaxed">
                            {me.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCollapsible>
                );
              }
            }

            // [은유] 마커 우선 추출 + 본문 strip. 마커 없으면 첫 줄 휴리스틱 fallback.
            const parsed = extractMetaphor(body);
            let metaphorTitle = parsed.metaphorTitle;
            let bodyText = parsed.bodyText;
            if (!metaphorTitle) {
              const lines = bodyText.split('\n');
              const firstLine = lines[0]?.trim() ?? '';
              const hasMetaphor = lines.length > 1
                && firstLine.length > 0
                && firstLine.length <= 40
                && !firstLine.endsWith('.')
                && !/[다요니까습]$/.test(firstLine);
              metaphorTitle = hasMetaphor ? firstLine : '';
              bodyText = hasMetaphor ? lines.slice(1).join('\n').trim() : bodyText;
            }
            return (
              <SectionCollapsible
                key={key}
                title={TOJEONG_SECTION_LABELS[key]}
                metaphorTitle={metaphorTitle}
                defaultOpen={idx === 0}
                enterDelay={0.15 + idx * 0.05}
              >
                <div className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
                  {bodyText.split(/\n\n+/).map((para, pi) => (
                    <p key={pi} className="whitespace-pre-line">{para.trim()}</p>
                  ))}
                </div>
              </SectionCollapsible>
            );
          })}
        </div>
      )}

      {/* fallback: 섹션 파싱 실패 시 원문 전체 표시 */}
      {aiContent && (!aiSections || Object.keys(aiSections).length === 0) && (
        <section className="mt-3 rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block w-1 h-5 rounded-full bg-cta" />
            <div className="text-[17px] font-bold text-text-primary tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
              심층 풀이
            </div>
          </div>
          <p className="text-[15px] text-text-secondary leading-[1.85] whitespace-pre-line tracking-[-0.005em]">
            {stripAllSectionTags(aiContent)}
          </p>
        </section>
      )}

      {(recordId || savedRecordId) && (
        <div className="mt-6">
          <ShareBar recordId={(recordId || savedRecordId)!} type="saju" category="tojeong" />
        </div>
      )}

      <RestoreReportModal
        open={!!cacheGate}
        title="토정비결"
        onUseCached={handleUseCached}
        onClose={() => setCacheGate(null)}
        onRefresh={handleRefetch}
      />
    </motion.div>
  );
}

// 토정비결 소개 카드 — 사용자가 토정비결이 무엇인지 모를 수 있어 한 번 안내
// (직원 피드백: 홈에 토정비결 설명이 부족하다 → 결과 진입 시 접을 수 있는 안내 카드 제공)
function TojeongIntroCard() {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-2xl p-3 mb-3 bg-[rgba(124,92,252,0.08)] border border-[rgba(124,92,252,0.25)]">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[14px]" aria-hidden>📖</span>
          <span className="text-[14px] font-semibold text-text-primary">
            토정비결이란?
          </span>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-tertiary)' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-[rgba(124,92,252,0.2)] space-y-2">
          <p className="text-[13px] text-text-secondary leading-relaxed">
            조선 명종 때 토정 이지함(李之菡) 선생이 만든 한 해 신수(身數) 풀이예요.
            음력 생년월일과 세는 나이로 144괘(상괘 8 × 중괘 6 × 하괘 3) 중 하나를 뽑아
            그 해의 길흉화복과 12달의 흐름을 봐요.
          </p>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            사주명리가 평생의 큰 그림이라면, 토정비결은 <strong className="text-text-primary">매년 1월 1일~12월 31일 한 해의 결</strong>을
            짚어주는 연간 신수서예요.
          </p>
          <ul className="text-[12px] text-text-tertiary leading-relaxed space-y-0.5 mt-2">
            <li>· 8개 섹션: 총운 · 괘의 의미 · 월별 흐름(12개월) · 재물 · 애정·가정 · 건강 · 직장·학업 · 개운 조언</li>
            <li>· 양력 입력 시 자동으로 음력으로 환산해요</li>
            <li>· 길흉 등급은 144괘 표를 기반으로 결정되어 매번 동일해요</li>
          </ul>
        </div>
      )}
    </section>
  );
}
