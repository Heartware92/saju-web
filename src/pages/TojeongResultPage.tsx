'use client';

/**
 * 토정비결 결과 페이지 (전체 무료 · 결정론적 풀이)
 * URL: /saju/tojeong?year=1990&month=1&day=1&calendarType=solar&...&targetYear=2026
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { calculateTojeong, type TojeongResult } from '../engine/tojeong';
import { computeSajuFromProfile } from '../utils/profileSaju';
import { buildTojeongReading, type TojeongReading } from '../engine/tojeong/reading';
import type { GwaeGrade } from '../engine/tojeong/gwae-table';
import { useProfileStore } from '../store/useProfileStore';
import { extractMetaphor } from '../utils/parseMetaphor';
import { renderEmphasis } from '../utils/renderEmphasis';
import { SectionCollapsible } from '../components/saju/SectionCollapsible';
import { useCreditStore } from '../store/useCreditStore';
import { useReportCacheStore, type ReportKind } from '../store/useReportCacheStore';
import { RestoreReportModal } from '../components/RestoreReportModal';
import { QuickFortuneGate } from '../components/QuickFortuneGate';
import { parseTojeongSections, parseTojeongScores, stripAllSectionTags, type TojeongAIResult } from '../services/fortuneService';
import { supabase } from '../services/supabase';
import { useFortuneJob } from '../hooks/useFortuneJob';
import { sajuDB } from '../services/supabase';
import { findRecentArchive } from '../services/archiveService';
import { AILoadingBar } from '../components/AILoadingBar';
import { SUN_COST_BIG, CHARGE_REASONS } from '../constants/creditCosts';
import { BackButton } from '../components/ui/BackButton';
import { useLoadingGuard } from '../hooks/useLoadingGuard';
import { useScrollToTopOnLoad } from '../hooks/useScrollToTopOnLoad';
import { ShareBar } from '@/components/share/ShareBar';
import { ResultFooterActions } from '@/components/ui/ResultFooterActions';
import { RadarChart } from '../components/charts/RadarChart';
import { LuckyVisualCard, ELEMENT_LUCKY } from '../components/saju/LuckyVisualCard';
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

// 한자 오행 → 한글 매핑 (LuckyVisualCard.ELEMENT_LUCKY key 와 호환)
const ELEMENT_HAN_TO_KOR: Record<string, string> = {
  '木': '목', '火': '화', '土': '토', '金': '금', '水': '수',
  '목': '목', '화': '화', '토': '토', '금': '금', '수': '수',
};

function parseMonthlyEntries(raw: string): { month: number; keyword: string; text: string }[] {
  const entries: { month: number; keyword: string; text: string }[] = [];
  const seen = new Set<number>();
  // 영문 마커 ([chongun], [monthly] 등) + 한글 마커 ([은유], [요약], [핵심] 등) 모두 strip.
  // [은유] 마커가 본문에 노출되던 사고 (2026-05-19) — prompt 수정 + 이 정규식 한글 확장으로 2축 방어.
  const cleaned = raw
    .replace(/\[\/?[a-zA-Z_]+\]/g, '')
    .replace(/\[(?:은유|요약|핵심|metaphor|summary)\]/g, '')
    .trim();
  const parts = cleaned.split(/(?=\d{1,2}월\s*[—\-–]\s*)/);
  for (const part of parts) {
    const m = part.match(/^(\d{1,2})월\s*[—\-–]\s*(.+?)[\n\r]/);
    if (!m) continue;
    const month = parseInt(m[1], 10);
    if (month < 1 || month > 12) continue;
    if (seen.has(month)) continue; // AI 가 1~9 만 만들고 다시 1월부터 출력하는 사고 차단
    const keyword = m[2].trim();
    const text = part.slice(m[0].length).trim();
    if (!text) continue;
    seen.add(month);
    entries.push({ month, keyword, text });
  }
  entries.sort((a, b) => a.month - b.month);
  return entries;
}

const HANJA_MONTH_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

// 토정비결 월별 흐름 카드 — 신년운세 MonthlySectionView 와 동일 톤(코스믹 그라데이션 + 큰 숫자/月 + 키워드 + 한자 워터마크 + 본문 + 카드 간 점선)
function TojeongMonthlyCards({
  months,
  accentColor,
}: {
  months: { month: number; keyword: string; text: string }[];
  accentColor: string;
}) {
  if (!months.length) return null;
  const c = accentColor;
  return (
    <div className="relative flex flex-col">
      {months.map((m, idx) => {
        const isLast = idx === months.length - 1;
        return (
          <div key={m.month} className="relative">
            <div
              className="relative overflow-hidden rounded-2xl border"
              style={{
                background: `linear-gradient(135deg, rgba(20,12,38,0.65) 0%, ${c}11 50%, rgba(20,12,38,0.55) 100%)`,
                borderColor: `${c}33`,
                boxShadow: `0 0 24px ${c}10, inset 0 0 1px ${c}40`,
              }}
            >
              {/* 상단 — 월 번호(큰 글씨) + 月 + 키워드 + 한자 워터마크 */}
              <div className="relative flex items-start justify-between gap-3 px-5 pt-4 pb-2">
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <span
                    className="font-bold leading-none"
                    style={{
                      fontFamily: 'var(--font-title)',
                      fontSize: '32px',
                      color: c,
                      textShadow: `0 0 18px ${c}55`,
                      letterSpacing: '-0.04em',
                    }}
                  >
                    {m.month}
                  </span>
                  <span
                    className="font-bold leading-none"
                    style={{
                      fontFamily: 'var(--font-title)',
                      fontSize: '28px',
                      color: c,
                      opacity: 0.85,
                      letterSpacing: '-0.04em',
                    }}
                  >
                    月
                  </span>
                  {m.keyword && (
                    <span
                      className="text-[18px] font-semibold text-text-primary ml-2"
                      style={{ fontFamily: 'var(--font-title)', letterSpacing: '-0.01em' }}
                    >
                      {m.keyword}
                    </span>
                  )}
                </div>
                {/* 월 한자 — 우측 워터마크(별점·등급 자리 대체) */}
                <span
                  aria-hidden
                  className="text-[40px] font-bold leading-none select-none pointer-events-none shrink-0"
                  style={{
                    fontFamily: 'var(--font-title)',
                    color: c,
                    opacity: 0.32,
                    letterSpacing: '-0.05em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {HANJA_MONTH_NUM[m.month - 1] ?? `${m.month}`}
                </span>
              </div>

              {/* 구분선 */}
              <div
                className="relative mx-5 h-px"
                style={{
                  background: `linear-gradient(90deg, transparent, ${c}55, transparent)`,
                }}
              />

              {/* 본문 — 다른 섹션 본문과 동일 톤 (SUIT 16px, 자간 -0.005em, leading 1.85) */}
              <div className="relative px-4 pt-3 pb-4">
                <p
                  className="text-[16px] text-text-secondary leading-[1.85] tracking-[-0.005em]"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {renderEmphasis(m.text)}
                </p>
              </div>
            </div>

            {/* 카드 간 연결 점선 (마지막 제외) */}
            {!isLast && (
              <div className="flex justify-start pl-9 py-1.5">
                <div className="flex flex-col items-center gap-1">
                  <span className="w-px h-1.5 bg-white/15" />
                  <span className="w-1 h-1 rounded-full bg-white/25" />
                  <span className="w-px h-1.5 bg-white/15" />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
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
  const urlJobId = searchParams?.get('jobId') ?? null;
  const isArchiveMode = !!recordId;
  const needsProfileSelect = !profileId && !isArchiveMode && !urlJobId && !searchParams?.get('year');

  // 백그라운드 잡 시스템 — Phase 4 (가이드 4.10 가드 적용 필수)
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const effectiveJobId = urlJobId ?? createdJobId;
  const { job: fortuneJob } = useFortuneJob(effectiveJobId);
  const { profiles, fetchProfiles, hydrated, loading: profilesLoading, lastFetchedAt } = useProfileStore();
  const targetProfile = useMemo(() => {
    if (profileId) return profiles.find(p => p.id === profileId) ?? null;
    if (needsProfileSelect) return null;
    return profiles.find(p => p.is_primary) ?? null;
  }, [profiles, profileId, needsProfileSelect]);
  const chargeForContent = useCreditStore(s => s.chargeForContent);
  const chargeRef = useRef(chargeForContent);
  chargeRef.current = chargeForContent;

  // ★ 사주+토정 하이브리드 — targetProfile 로부터 사주 명식 계산.
  // 토정 풀이에 일간·용신·격국·대운 인용해 다른 서비스가 못 하는 깊이.
  // targetProfile 없으면 (URL 직접 진입) saju 없이 진행 → AI 가 사주 인용 없이 토정만 풀이.
  const saju = useMemo(() => {
    if (!targetProfile) return null;
    return computeSajuFromProfile(targetProfile);
  }, [targetProfile]);

  // AI 내러티브 — 진입 즉시 자동 호출
  const [aiContent, setAiContent] = useState<string | null>(null);
  const [aiSections, setAiSections] = useState<Partial<Record<TojeongSectionKey, string>> | null>(null);
  const [aiDomainScores, setAiDomainScores] = useState<{ wealth: number; love: number; health: number; career: number } | null>(null);
  const [aiLoading, setAiLoading] = useState(!isArchiveMode && !needsProfileSelect);

  // 결과 준비 완료 시 스크롤 최상단
  useScrollToTopOnLoad(!!aiSections && !aiLoading);
  const [aiError, setAiError] = useState<string | null>(null);

  // ── 로딩 안전장치: 165초 초과 시 강제 해제 + 친절한 에러 ──
  // 백엔드 race 마감 150s + 클라이언트 4초 retry + 마진 11s.
  // 무료 결정론적 풀이가 페이지의 결과로 노출되므로 "결과를 못 받는" 상황은 발생하지 않음.
  // 단, AI 심층 풀이가 빠진 채 풀리는 케이스는 사용자가 인지할 수 있도록 에러 배너 표시.
  const [aiTimedOut, aiTimeoutMsg] = useLoadingGuard(aiLoading, 165_000);
  useEffect(() => {
    if (aiTimedOut) {
      setAiLoading(false);
      if (!aiContent) setAiError(aiTimeoutMsg);
    }
  }, [aiTimedOut, aiContent, aiTimeoutMsg]);

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
      // ★ v3 prefix — 11섹션 + 사주 하이브리드 + userCtx 변경에 따라 옛 캐시 자동 무효화.
      const key = `v3_${calendarType}_${year}-${month}-${day}_${targetYear}`;
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
  // 첫 시도가 빈 응답이면 백그라운드에서 1회 자동 재시도(4s 후) → 사용자에게 에러 노출 최소화.
  const aiStartedRef = useRef(false);
  const aiAttemptCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isArchiveMode) return;
    // ★ 가이드 4.10: ?jobId 진입 또는 새 잡 생성된 경우 cacheGate/findRecentArchive
    //   분기 전체 skip. saju_records 가 잡 모드의 단일 source of truth.
    if (effectiveJobId) return;
    if (!tojeong || !cacheKey) return;

    let cancelled = false;
    const isFresh = searchParams?.get('fresh') === '1';

    // 새 잡 생성 — 옛 4단 폴백·retry 로직은 server 잡 처리기 + 자동 환불로 대체.
    const fetchOnce = async (): Promise<void> => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          setAiError('로그인이 만료됐어요. 다시 로그인해주세요.');
          setAiLoading(false);
          return;
        }
        const minuteBucket = Math.floor(Date.now() / 60000);
        const idempotencyKey = `${cacheKey}:${minuteBucket}`;
        const res = await fetch('/api/fortune/jobs/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            category: 'tojeong',
            sajuResult: saju,
            tojeongResult: tojeong,
            saju: saju,
            userCtx: {
              jobState: targetProfile?.job_state ?? null,
              customJobState: targetProfile?.custom_job_state ?? null,
              loveState: targetProfile?.love_state ?? null,
              customLoveState: targetProfile?.custom_love_state ?? null,
            },
            profileId: targetProfile?.id,
            sourceBirth: sourceBirth
              ? {
                  birthDate: sourceBirth.birth_date,
                  birthTime: null,
                  birthPlace: null,
                  gender: sourceBirth.gender,
                  calendarType: sourceBirth.calendar_type ?? 'solar',
                }
              : null,
            idempotencyKey,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          setAiError(errData.error || '풀이 요청에 실패했어요.');
          setAiLoading(false);
          return;
        }
        const { jobId } = (await res.json()) as { jobId: string };
        if (cancelled) return;
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('jobId', jobId);
        window.history.replaceState(null, '', newUrl.toString());
        setCreatedJobId(jobId);
        // 이후 잡 동기화 useEffect 가 setAiContent·setAiLoading(false) 책임 (가이드 4.8)
      } catch (e) {
        if (!cancelled) {
          setAiError(e instanceof Error ? e.message : '풀이 요청 중 오류가 발생했어요.');
          setAiLoading(false);
        }
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
      void fetchOnce();
    };

    run();
    return () => {
      cancelled = true;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tojeong, cacheKey, isArchiveMode, refetchNonce, effectiveJobId]);

  // ── 잡 결과 → state 동기화 (백그라운드 잡 시스템) ──
  // archive 모드는 별도 useEffect. 새 잡 흐름에서 status 변경 시 setAiContent 매핑.
  useEffect(() => {
    if (isArchiveMode) return;
    if (!fortuneJob) return;
    if (fortuneJob.status === 'done') {
      const content = fortuneJob.interpretationDetailed ?? '';
      setAiContent(content);
      const sections = parseTojeongSections(content);
      if (Object.keys(sections).length > 0) setAiSections(sections);
      const scores = parseTojeongScores(content);
      if (scores) setAiDomainScores(scores);
      setSavedRecordId(fortuneJob.jobId);
      setAiLoading(false);
    } else if (fortuneJob.status === 'failed') {
      setAiError(fortuneJob.errorMessage ?? '풀이 생성에 실패했어요. 크레딧은 자동 환불됐어요.');
      setAiLoading(false);
    } else if (fortuneJob.status === 'processing' && fortuneJob.interpretationBasic) {
      // 1차 partial 도착 — 부분 렌더 (정통사주 Phase 1.5 패턴)
      const content = fortuneJob.interpretationBasic;
      setAiContent(content);
      const sections = parseTojeongSections(content);
      if (Object.keys(sections).length > 0) setAiSections(sections);
      const scores = parseTojeongScores(content);
      if (scores) setAiDomainScores(scores);
      setSavedRecordId(fortuneJob.jobId);
      setAiLoading(true);
    } else {
      setAiLoading(true);
    }
  }, [
    fortuneJob?.status,
    fortuneJob?.interpretationDetailed,
    fortuneJob?.interpretationBasic,
    fortuneJob?.errorMessage,
    fortuneJob?.jobId,
    isArchiveMode,
  ]);

  const retryAI = () => {
    if (!tojeong || !cacheKey) return;
    useReportCacheStore.getState().invalidate('tojeong', cacheKey);
    aiStartedRef.current = false;  // useEffect 가 fetchOnce 다시 호출
    setAiContent(null);
    setAiSections(null);
    setAiDomainScores(null);
    setAiError(null);
    setCreatedJobId(null);  // 새 잡 생성 트리거
    setAiLoading(true);
    setRefetchNonce(n => n + 1);
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
        startedAt={fortuneJob?.startedAt}
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

      {/* 원문 한문 괘사 — 토정비결 전통 표기: 메타(144괘 N번째·등급) + 한자 제목(낙관 글로우) + 한문 점사(양각 박스) + 현대어 풀이(인용 박스) */}
      {reading.entry.hanjaSa && (
        <section
          className="relative rounded-2xl px-5 py-6 mb-3 text-center overflow-hidden"
          style={{
            background: `radial-gradient(ellipse at top, ${gradeColor}14 0%, rgba(20,12,38,0.6) 70%)`,
            border: `1px solid ${gradeColor}3a`,
            boxShadow: `0 0 32px ${gradeColor}10, inset 0 0 1px ${gradeColor}55`,
          }}
        >
          {/* 메타 — 144괘 중 N번째 · 등급 */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="h-px w-8" style={{ background: `linear-gradient(90deg, transparent, ${gradeColor}66)` }} />
            <span
              className="text-[11px] font-semibold tracking-[0.18em] uppercase"
              style={{ color: gradeColor, opacity: 0.85, fontFamily: 'var(--font-title)' }}
            >
              144괘 중 {tojeong.gwaeNumber}괘 · {reading.grade}
            </span>
            <span className="h-px w-8" style={{ background: `linear-gradient(90deg, ${gradeColor}66, transparent)` }} />
          </div>

          {/* 한자 제목 — 낙관 도장 톤 (큰 글씨 + 글로우 + 사방 살짝 여백) */}
          <div
            className="relative inline-block px-5 py-2 mb-5"
            style={{
              borderTop: `1px solid ${gradeColor}55`,
              borderBottom: `1px solid ${gradeColor}55`,
            }}
          >
            <div
              className="text-[30px] font-bold tracking-[0.18em]"
              style={{
                fontFamily: 'var(--font-serif)',
                color: gradeColor,
                textShadow: `0 0 24px ${gradeColor}55`,
                letterSpacing: '0.18em',
              }}
            >
              {reading.entry.hanjaSa.title}
            </div>
          </div>

          {/* 한문 점사 — 양각 박스 */}
          <div
            className="space-y-1.5 mb-5 px-4 py-3 mx-auto inline-block"
            style={{
              background: `${gradeColor}0a`,
              border: `1px solid ${gradeColor}26`,
              borderRadius: '12px',
            }}
          >
            {reading.entry.hanjaSa.lines.map((line, i) => (
              <div
                key={i}
                className="text-[17px] tracking-[0.18em] text-text-secondary"
                style={{ fontFamily: 'var(--font-serif)', lineHeight: 1.7 }}
              >
                {line}
              </div>
            ))}
          </div>

          {/* 현대어 풀이 — 인용구 톤 (한문 점사와 시각적 분리) */}
          <div className="relative max-w-[330px] mx-auto">
            <span
              aria-hidden
              className="absolute -top-1 left-0 text-[28px] leading-none select-none"
              style={{ color: gradeColor, opacity: 0.45, fontFamily: 'var(--font-serif)' }}
            >
              『
            </span>
            <p
              className="px-5 text-[14px] text-text-secondary leading-[1.85] tracking-[-0.005em]"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {reading.entry.hanjaSa.translation}
            </p>
            <span
              aria-hidden
              className="absolute -bottom-3 right-0 text-[28px] leading-none select-none"
              style={{ color: gradeColor, opacity: 0.45, fontFamily: 'var(--font-serif)' }}
            >
              』
            </span>
          </div>
        </section>
      )}

      {/* 총평 — 심층 풀이 [chongun] 이 없을 때만 fallback 으로 표시 (중복 방지) */}
      {!aiSections?.chongun && (
        <section className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <div className="text-[15px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">올해 총평</div>
          <div className="space-y-3">
            {reading.paragraphs.map((p, i) => (
              <p
                key={i}
                className="text-[15px] text-text-secondary leading-[1.85] tracking-[-0.005em]"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {renderEmphasis(p)}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* 월별 흐름 — 심층 풀이 [monthly] 가 없을 때만 fallback 으로 표시 (중복 방지) */}
      {!aiSections?.monthly && (
        <section className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <div className="text-[15px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">월별 흐름</div>
          <TojeongMonthlyCards
            months={reading.monthly.map(m => ({ ...m, keyword: m.keyword.split('·')[0] }))}
            accentColor={gradeColor}
          />
        </section>
      )}

      {/* 조언·주의 */}
      <div className="grid grid-cols-1 gap-3">
        <section className="rounded-2xl p-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <div className="text-[15px] font-semibold mb-2" style={{ color: '#34D399' }}>올해의 조언</div>
          <ul className="space-y-1.5">
            {reading.advice.map((a, i) => (
              <li
                key={i}
                className="text-[14px] text-text-secondary flex gap-2 leading-[1.85] tracking-[-0.005em]"
                style={{ fontFamily: 'var(--font-body)' }}
              >
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
              <li
                key={i}
                className="text-[14px] text-text-secondary flex gap-2 leading-[1.85] tracking-[-0.005em]"
                style={{ fontFamily: 'var(--font-body)' }}
              >
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

            // 월별 흐름 섹션 — AI 가 만든 카드 + 빠진 달은 결정론적 reading.monthly 로 보충해 12개월 보장
            if (key === 'monthly') {
              const aiEntries = parseMonthlyEntries(body);
              if (aiEntries.length > 0) {
                const aiMonths = new Set(aiEntries.map(m => m.month));
                const merged: { month: number; keyword: string; text: string }[] = [...aiEntries];
                for (const dm of reading.monthly) {
                  if (!aiMonths.has(dm.month)) {
                    merged.push({ ...dm, keyword: dm.keyword.split('·')[0] });
                  }
                }
                merged.sort((a, b) => a.month - b.month);
                return (
                  <SectionCollapsible
                    key={key}
                    title={TOJEONG_SECTION_LABELS[key]}
                    defaultOpen={idx === 0}
                    enterDelay={0.15 + idx * 0.05}
                  >
                    <TojeongMonthlyCards months={merged} accentColor={gradeColor} />
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

            // 개운 조언 섹션 — 상괘 오행 기반 결정론적 LuckyVisualCard + AI 본문
            // 사용자 캡처와 동일한 6슬롯 그리드(방위·색상·숫자·시간·보석·활동) 시각화
            if (key === 'advice') {
              const elKor = ELEMENT_HAN_TO_KOR[tojeong.upperGwae.element] ?? '목';
              const lucky = ELEMENT_LUCKY[elKor];
              return (
                <SectionCollapsible
                  key={key}
                  title={TOJEONG_SECTION_LABELS[key]}
                  metaphorTitle={metaphorTitle}
                  defaultOpen={idx === 0}
                  enterDelay={0.15 + idx * 0.05}
                >
                  <div className="space-y-4">
                    {/* 결정론적 행운 처방 카드 — 정통사주·신년운세와 동일 6슬롯 그리드 */}
                    <LuckyVisualCard
                      colors={lucky.colors}
                      colorCss={lucky.colorCss}
                      numbers={lucky.numbers}
                      direction={lucky.direction}
                      timeSlot={lucky.timeSlot}
                      gem={lucky.gem}
                      activity={lucky.activity}
                    />
                    {/* AI 본문 — 실생활 적용·실천 풀이 */}
                    <div className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
                      {bodyText.split(/\n\n+/).map((para, pi) => (
                        <p key={pi} className="whitespace-pre-line">{renderEmphasis(para.trim())}</p>
                      ))}
                    </div>
                  </div>
                </SectionCollapsible>
              );
            }

            // warning 섹션 — 빨강 톤 (택일 "피해야 할 날" 과 동일 시그널)
            const isWarning = key === 'warning';
            return (
              <SectionCollapsible
                key={key}
                title={TOJEONG_SECTION_LABELS[key]}
                metaphorTitle={metaphorTitle}
                defaultOpen={idx === 0}
                enterDelay={0.15 + idx * 0.05}
                {...(isWarning ? {
                  barColor: '#F87171',
                  barPulseColor: '#FCA5A5',
                  borderColor: 'rgba(248,113,113,0.30)',
                } : {})}
              >
                <div className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
                  {bodyText.split(/\n\n+/).map((para, pi) => (
                    <p key={pi} className="whitespace-pre-line">{renderEmphasis(para.trim())}</p>
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
          <p
            className="text-[15px] text-text-secondary leading-[1.85] whitespace-pre-line tracking-[-0.005em]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {stripAllSectionTags(aiContent)}
          </p>
        </section>
      )}

      {(recordId || savedRecordId) && (
        <div className="mt-6">
          <ShareBar recordId={(recordId || savedRecordId)!} type="saju" category="tojeong" />
        </div>
      )}

      <ResultFooterActions />

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
