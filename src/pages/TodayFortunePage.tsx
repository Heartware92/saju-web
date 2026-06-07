'use client';

/**
 * 실시간 운세 V3 (내부 식별자는 today/V3 legacy 유지) — 시간대 기반 + 사용자 입력 반영 13섹션 풀이
 *
 * 흐름:
 *   1. 진입 → 시간대 자동 감지 (자정/아침/오후/저녁)
 *   2. 사용자 입력 폼 (취미·직업·연애·시간대 질문 2개)
 *   3. 제출 → 로딩 → 결과
 *   4. 결과: 일진 카드 + 종합 점수 링 + 9 항목 점수 바 + 4 시간대 흐름 그래프 + 10 섹션 카드
 *
 * 결과 디자인은 정통사주 패턴(레이블+은유 부제+본문) 통일.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useProfileStore } from '../store/useProfileStore';
import { useCreditStore } from '../store/useCreditStore';
import { useReportCacheStore, sajuKey, type ReportKind } from '../store/useReportCacheStore';
import { RestoreReportModal } from '../components/RestoreReportModal';
import { QuickFortuneGate } from '../components/QuickFortuneGate';
import { computeSajuFromProfile } from '../utils/profileSaju';
import { MOON_COST_MORE, CHARGE_REASONS } from '../constants/creditCosts';
import { calculateSaju, type SajuResult } from '../utils/sajuCalculator';
import {
  buildTodayV3Prompt,
  parseTodayV3Sections,
  parseTodayV3DomainScores,
  parseTodayV3FlowScores,
  type TodayFortuneV3AIResult,
} from '../services/fortuneService';
import { sajuDB, supabase } from '../services/supabase';
import { useFortuneJob } from '../hooks/useFortuneJob';
import { findRecentArchive } from '../services/archiveService';
import {
  TODAY_HOBBY_OPTIONS,
  TODAY_JOB_STATES,
  TODAY_LOVE_STATES,
  TODAY_TIME_SLOT_LABELS,
  pickTwoQuestions,
  getTodayTimeSlot,
  type TodayHobby,
  type TodayJobState,
  type TodayLoveState,
  type TodayTimeSlot,
  type TodayUserContext,
} from '../constants/prompts';
import { AILoadingBar } from '../components/AILoadingBar';
import { useLoadingGuard } from '../hooks/useLoadingGuard';
import { useScrollToTopOnLoad } from '../hooks/useScrollToTopOnLoad';
import { ShareBar } from '@/components/share/ShareBar';
import { ResultFooterActions } from '@/components/ui/ResultFooterActions';
import { TodayResultView } from '../components/saju/TodayResultView';

const TODAY_MESSAGES = [
  '일진과 원국의 오행을 대조하는 중입니다',
  '오늘의 합충 관계를 분석하는 중입니다',
  '시간대별 흐름을 그려보는 중입니다',
  '입력해주신 상황을 풀이에 녹이는 중입니다',
  '거의 다 됐어요 — 하루의 결을 정리 중입니다',
];

// ─────────────────────────────────────────────────────────────────────────────
// 점수 시각화
// ─────────────────────────────────────────────────────────────────────────────

// 결과 본문 렌더(일진 카드·입력 요약·점수·흐름·11섹션)와 그 헬퍼(ScoreRing·DomainBars·
// FlowChart·UserInputSummary·Icon)는 TodayResultView 로 추출됨 — 제품/temp_test 1:1 공유.

// ─────────────────────────────────────────────────────────────────────────────
// 입력 폼
// ─────────────────────────────────────────────────────────────────────────────

function InputForm({
  initialSlot,
  profileJobState,
  profileCustomJobState,
  profileLoveState,
  profileCustomLoveState,
  onSubmit,
}: {
  initialSlot: TodayTimeSlot;
  /** 프로필에 저장된 직업·연애 상태 — 매번 선택할 필요 없이 자동 사용 */
  profileJobState: string;
  profileCustomJobState: string | null;
  profileLoveState: string;
  profileCustomLoveState: string | null;
  onSubmit: (ctx: TodayUserContext) => void;
}) {
  const [hobbies, setHobbies] = useState<TodayHobby[]>([]);
  const [customHobby, setCustomHobby] = useState('');
  const [hobbyCustomOpen, setHobbyCustomOpen] = useState(false);

  // 직업·연애 상태는 프로필에서 받아 props 로 주입 — 폼 내부 state 제거
  // 직업·연애 미선택(null)이면 강제로 '직장인'/'연애 중'을 지어내지 않고 중립값(기타/공개 안 함)으로 풀이.
  // 미선택은 '미입력'으로 표시 — '기타'/'공개 안 함' 같은 값을 지어내지 않는다.
  const effectiveJobState = (profileCustomJobState && profileCustomJobState.trim()) || profileJobState || '미입력';
  const effectiveLoveState = (profileCustomLoveState && profileCustomLoveState.trim()) || profileLoveState || '미입력';

  // Progressive disclosure — 취미만 단계 의미. 직업·연애는 프로필 데이터라 자동 done
  const hobbyDone = hobbies.length > 0 || customHobby.trim().length > 0;
  const [q1Answer, setQ1Answer] = useState('');
  const [q2Answer, setQ2Answer] = useState('');
  // '직접 입력'을 골랐을 때만 노출되는 보조 입력값
  const [q1Custom, setQ1Custom] = useState('');
  const [q2Custom, setQ2Custom] = useState('');

  const [[q1, q2]] = useState(() => pickTwoQuestions(initialSlot));
  const slotLabel = TODAY_TIME_SLOT_LABELS[initialSlot];

  // 진행형 노출 — 취미 → 질문 시간대 단계
  const timeSectionRef = useRef<HTMLDivElement | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);
  const prevHobbyDone = useRef(false);

  const scrollIntoCenter = (el: HTMLElement | null) => {
    if (!el) return;
    // 모션 애니메이션이 시작된 직후 한 프레임 양보 → 정확한 위치 계산
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  useEffect(() => {
    if (hobbyDone && !prevHobbyDone.current) scrollIntoCenter(timeSectionRef.current);
    prevHobbyDone.current = hobbyDone;
  }, [hobbyDone]);

  const canSubmit = hobbies.length > 0 || customHobby.trim().length > 0;

  // 단일 선택 — 같은 칩 재클릭 시 해제, 다른 칩 클릭 시 교체.
  // 표준 칩과 직접 입력은 서로 mutually exclusive — 한 쪽 활성 시 다른 쪽 자동 해제.
  const selectHobby = (h: TodayHobby) => {
    setHobbies((prev) => (prev[0] === h ? [] : [h]));
    setHobbyCustomOpen(false);
    setCustomHobby('');
  };

  const toggleHobbyCustom = () => {
    setHobbyCustomOpen((o) => {
      const next = !o;
      if (next) setHobbies([]); // 직접 입력 켤 때 표준 선택 해제
      else setCustomHobby('');
      return next;
    });
  };

  const submit = () => {
    if (!canSubmit) return;
    // '직접 입력' 모드면 사용자가 추가로 친 텍스트를, 아니면 선택한 보기 텍스트 그대로 전송
    const resolvedQ1 = q1Answer === '__custom__' ? q1Custom.trim() : q1Answer.trim();
    const resolvedQ2 = q2Answer === '__custom__' ? q2Custom.trim() : q2Answer.trim();
    onSubmit({
      hobbies,
      customHobby: customHobby.trim() || undefined,
      // 프로필에 저장된 직업·연애 상태를 사용. 사용자가 매번 선택할 필요 없음.
      jobState: (profileJobState || undefined) as TodayJobState | undefined,
      customJobState: (profileCustomJobState && profileCustomJobState.trim()) || undefined,
      loveState: (profileLoveState || undefined) as TodayLoveState | undefined,
      customLoveState: (profileCustomLoveState && profileCustomLoveState.trim()) || undefined,
      timeSlot: initialSlot,
      q1Text: q1.q,
      q2Text: q2.q,
      q1Answer: resolvedQ1 || undefined,
      q2Answer: resolvedQ2 || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 bg-[rgba(124,92,252,0.08)] border border-[rgba(124,92,252,0.25)]">
        <div className="text-[13px] text-text-tertiary mb-1">지금 시간대</div>
        <div className="text-[18px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
          {slotLabel}
        </div>
        <p className="text-[12.5px] text-text-secondary mt-2 leading-relaxed">
          오늘 풀이 전에 몇 가지만 알려주시면 지금 상황에 맞춰 더 정확하게 풀어드릴게요.
        </p>
      </div>

      {/* 직업·연애 상태는 birth_profiles 에서 자동 사용.
          취미 입력 전에 노출해 사용자가 어떤 정보가 적용되는지 미리 인지. */}
      <div className="rounded-xl px-4 py-3 bg-[rgba(20,12,38,0.4)] border border-[var(--border-subtle)] leading-relaxed">
        <div className="text-[12px] text-text-tertiary mb-1.5">오늘 풀이에 반영되는 정보</div>
        <div className="text-[13.5px] text-text-secondary">
          직업 <span className="text-text-primary font-semibold">{effectiveJobState}</span>
          {'  ·  '}
          연애 <span className="text-text-primary font-semibold">{effectiveLoveState}</span>
        </div>
        <div className="text-[11.5px] text-text-tertiary opacity-80 mt-1.5">바꾸려면 프로필 관리에서 수정해주세요</div>
      </div>

      {/* 1. 취미·관심사 — "직접 입력" 칩 클릭 시에만 input 노출 (시간대 질문 패턴과 통일) */}
      <div className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-1 h-5 rounded-full bg-cta" />
          <h3 className="text-[16px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            요즘 가장 시간을 쏟는 분야
          </h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {TODAY_HOBBY_OPTIONS.map((h) => {
            const on = hobbies.includes(h);
            return (
              <button
                key={h}
                onClick={() => selectHobby(h)}
                className="px-3.5 py-2 rounded-full text-[13px] font-medium"
                style={{
                  border: `1.5px solid ${on ? 'var(--cta-primary)' : 'rgba(255,255,255,0.18)'}`,
                  background: on ? 'rgba(139,92,246,0.20)' : 'rgba(255,255,255,0.04)',
                  color: on ? '#E9D5FF' : 'var(--text-primary)',
                }}
              >
                {h}
              </button>
            );
          })}
          <button
            onClick={toggleHobbyCustom}
            className="px-3.5 py-2 rounded-full text-[13px] font-medium"
            style={{
              border: `1.5px solid ${hobbyCustomOpen ? 'var(--cta-primary)' : 'rgba(255,255,255,0.18)'}`,
              background: hobbyCustomOpen ? 'rgba(139,92,246,0.20)' : 'rgba(255,255,255,0.04)',
              color: hobbyCustomOpen ? '#E9D5FF' : 'var(--text-tertiary)',
            }}
          >
            직접 입력
          </button>
        </div>
        {hobbyCustomOpen && (
          <input
            type="text"
            value={customHobby}
            onChange={(e) => setCustomHobby(e.target.value.slice(0, 10))}
            maxLength={10}
            placeholder="10자 이내로 적어주세요"
            className="w-full px-3 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[14px] text-text-primary placeholder-text-tertiary"
          />
        )}
      </div>

      {/* 2. 지금 상태 — 취미 완료 시 등장 */}
      {hobbyDone && (
      <motion.div
        ref={timeSectionRef}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-1 h-5 rounded-full bg-cta" />
          <h3 className="text-[16px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            지금 상태
          </h3>
        </div>
        <p className="text-[12px] text-text-tertiary mb-3">답변하지 않아도 풀이는 가능해요.</p>
        <div className="space-y-5">
          {([
            { question: q1, value: q1Answer, setValue: setQ1Answer, custom: q1Custom, setCustom: setQ1Custom },
            { question: q2, value: q2Answer, setValue: setQ2Answer, custom: q2Custom, setCustom: setQ2Custom },
          ] as const).map(({ question, value, setValue, custom, setCustom }, idx) => (
            <div key={idx}>
              <label className="block text-[16px] font-semibold text-text-primary mb-3 leading-snug">{question.q}</label>
              <div className="flex flex-wrap gap-2">
                {question.options.map((opt) => {
                  const on = value === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setValue(on ? '' : opt)}
                      className="px-3.5 py-2 rounded-full text-[13px] font-medium"
                      style={{
                        border: `1.5px solid ${on ? 'var(--cta-primary)' : 'rgba(255,255,255,0.18)'}`,
                        background: on ? 'rgba(139,92,246,0.20)' : 'rgba(255,255,255,0.04)',
                        color: on ? '#E9D5FF' : 'var(--text-primary)',
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setValue(value === '__custom__' ? '' : '__custom__')}
                  className="px-3.5 py-2 rounded-full text-[13px] font-medium"
                  style={{
                    border: `1.5px solid ${value === '__custom__' ? 'var(--cta-primary)' : 'rgba(255,255,255,0.18)'}`,
                    background: value === '__custom__' ? 'rgba(139,92,246,0.20)' : 'rgba(255,255,255,0.04)',
                    color: value === '__custom__' ? '#E9D5FF' : 'var(--text-tertiary)',
                  }}
                >
                  직접 입력
                </button>
              </div>
              {value === '__custom__' && (
                <input
                  type="text"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.slice(0, 10))}
                  maxLength={10}
                  placeholder="10자 이내로 적어주세요"
                  className="mt-2 w-full px-3 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[14px] text-text-primary placeholder-text-tertiary"
                />
              )}
            </div>
          ))}
        </div>
      </motion.div>
      )}

      <button
        onClick={submit}
        disabled={!canSubmit}
        className="w-full py-4 rounded-2xl font-bold text-[16px] text-white transition-opacity"
        style={{
          background: 'linear-gradient(135deg, var(--cta-primary), var(--cta-secondary, var(--cta-primary)))',
          opacity: canSubmit ? 1 : 0.45,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          boxShadow: '0 4px 20px rgba(139,92,246,0.3)',
        }}
      >
        실시간 운세 보기
      </button>
      {!canSubmit && (
        <p className="text-[12px] text-text-tertiary text-center -mt-1">취미·직업·연애 상태를 모두 선택해주세요</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────────────────────────────────────

export default function TodayFortunePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = searchParams?.get('profileId') ?? null;
  const recordId = searchParams?.get('recordId') ?? null;
  const urlJobId = searchParams?.get('jobId') ?? null;
  const isArchiveMode = !!recordId;
  const needsProfileSelect = !profileId && !isArchiveMode && !urlJobId && !(searchParams?.get('year') && searchParams?.get('month') && searchParams?.get('day'));

  // 백그라운드 잡 시스템
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const effectiveJobId = urlJobId ?? createdJobId;
  const { job: fortuneJob } = useFortuneJob(effectiveJobId);

  const { profiles, fetchProfiles, hydrated, loading: profilesLoading, lastFetchedAt } = useProfileStore();
  const targetProfile = useMemo(() => {
    if (profileId) return profiles.find(p => p.id === profileId) ?? null;
    if (needsProfileSelect) return null;
    return profiles.find(p => p.is_primary) ?? null;
  }, [profiles, profileId, needsProfileSelect]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const initialSlot = useMemo(() => getTodayTimeSlot(new Date().getHours()), []);

  const [result, setResult] = useState<SajuResult | null>(null);
  const [userCtx, setUserCtx] = useState<TodayUserContext | null>(null);
  const [report, setReport] = useState<TodayFortuneV3AIResult | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [archivedAt, setArchivedAt] = useState<string | null>(null);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);

  // 결과가 준비되면 스크롤 최상단으로
  useScrollToTopOnLoad(!!report && !reportLoading);

  const [cacheGate, setCacheGate] = useState<{ kind: ReportKind; key: string; restore: () => void } | null>(null);
  const handleUseCached = () => { cacheGate?.restore(); setCacheGate(null); };
  const handleRefetch = () => {
    if (cacheGate) useReportCacheStore.getState().invalidate(cacheGate.kind, cacheGate.key);
    setCacheGate(null);
    apiCalledKeyRef.current = null;
  };
  const chargeForContent = useCreditStore(s => s.chargeForContent);
  const chargeRef = useRef(chargeForContent);
  chargeRef.current = chargeForContent;
  const apiCalledKeyRef = useRef<string | null>(null);

  // 로딩 안전장치 — 서버 잡 maxDuration(300s)보다 약간 짧게(240s). 그 전에 끝나면 잡 동기화가 처리.
  // 잡은 백그라운드에서 계속 진행 중일 수 있으므로(서버 300s) 하드 실패 대신 안내만 — 완료되면
  // 잡 동기화 useEffect 가 결과로 자동 교체하고, 실패면 환불 후 failed 메시지로 교체된다. 보관함에도 저장됨.
  const [reportTimedOut] = useLoadingGuard(reportLoading, 240_000);
  useEffect(() => {
    if (reportTimedOut) {
      setReportLoading(false);
      if (!report) setReport({ success: false, error: '풀이가 생각보다 오래 걸리고 있어요. 완료되면 자동으로 표시되고, 잠시 후 보관함에서도 확인할 수 있어요.' });
    }
  }, [reportTimedOut, report]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // 보관함 재생 — recordId 있으면 DB에서 복원
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
        const sections = parseTodayV3Sections(content);
        const domainScores = parseTodayV3DomainScores(content);
        const flowScores = parseTodayV3FlowScores(content);
        const engine = (record.engine_result ?? {}) as { todayGz?: TodayFortuneV3AIResult['todayGz']; isoDate?: string; userContext?: TodayUserContext };
        const archivedReport: TodayFortuneV3AIResult = Object.keys(sections).length > 0
          ? { success: true, sections, domainScores, flowScores, todayGz: engine.todayGz, isoDate: engine.isoDate, userContext: engine.userContext }
          : { success: true, rawText: content, domainScores, flowScores, todayGz: engine.todayGz, isoDate: engine.isoDate, userContext: engine.userContext };
        setReport(archivedReport);
        if (engine.userContext) setUserCtx(engine.userContext);
        setArchivedAt(record.created_at);
      })
      .catch((e) => {
        console.error('[archive replay] load failed', e);
        if (!cancelled) setReport({ success: false, error: '보관된 풀이를 불러오지 못했어요.' });
      })
      .finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [recordId]);

  // 사주 계산
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

  // 사용자 입력 제출 시 호출
  const handleSubmitForm = (ctx: TodayUserContext) => {
    setUserCtx(ctx);
  };

  // ── 잡 결과 → state 동기화 ──
  useEffect(() => {
    if (isArchiveMode) return;
    if (!fortuneJob) return;
    if (fortuneJob.status === 'done') {
      const content = fortuneJob.interpretationDetailed ?? '';
      const sections = parseTodayV3Sections(content);
      const domainScores = parseTodayV3DomainScores(content);
      const flowScores = parseTodayV3FlowScores(content);
      const eng = (fortuneJob.engineResult ?? {}) as Record<string, unknown>;
      setReport(
        Object.keys(sections).length > 0
          ? { success: true, sections, domainScores, flowScores,
              todayGz: eng.todayGz as never, isoDate: todayIso, userContext: eng.userContext as never }
          : { success: true, rawText: content, domainScores, flowScores,
              todayGz: eng.todayGz as never, isoDate: todayIso, userContext: eng.userContext as never },
      );
      setSavedRecordId(fortuneJob.jobId);
      setReportLoading(false);
    } else if (fortuneJob.status === 'failed') {
      setReport({ success: false, error: fortuneJob.errorMessage ?? '풀이 생성에 실패했어요. 크레딧은 자동 환불됐어요.' });
      setReportLoading(false);
    } else {
      setReportLoading(true);
    }
  }, [
    isArchiveMode, todayIso,
    fortuneJob?.status, fortuneJob?.interpretationDetailed,
    fortuneJob?.errorMessage, fortuneJob?.jobId, fortuneJob?.engineResult,
  ]);

  // userCtx 가 채워지면 보관함 + 캐시 확인 후 호출
  useEffect(() => {
    if (isArchiveMode) return;
    if (effectiveJobId) return;  // 가이드 4.10 — ?jobId 진입 시 cacheGate skip
    if (!result || !userCtx) return;

    const ctxHash = hashUserCtx(userCtx);
    const effectKey = `${sajuKey(result)}:${todayIso}:${ctxHash}`;
    if (apiCalledKeyRef.current === effectKey) return;

    let cancelled = false;
    const isFresh = searchParams?.get('fresh') === '1';

    const run = async () => {
      const cacheKey = effectKey;

      // ★ cache 우선 — 메모리 unload→reload 후에도 archive 모달 없이 즉시 복원
      if (!isFresh) {
        const cached = useReportCacheStore.getState().getReport<TodayFortuneV3AIResult>('today', cacheKey);
        if (cached?.error) {
          setReport({ success: false, error: cached.error });
          return;
        }
        if (cached?.data) {
          setReport(cached.data);
          return;
        }
      }

      // 보관함 — 같은 사주·같은 날짜로 이미 받은 풀이 있으면 모달 권유
      if (targetProfile && !isFresh) {
        try {
          const found = await findRecentArchive({
            category: 'today',
            birth_date: targetProfile.birth_date,
            gender: targetProfile.gender,
            context: { key: 'isoDate', value: todayIso },
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

      apiCalledKeyRef.current = effectKey;
      setReport(null);
      setReportLoading(true);
      // 백그라운드 잡 — buildTodayV3Prompt 로 분류기·prompt 완성 후 POST.
      // setReportLoading(false) 책임은 잡 결과 동기화 useEffect (가이드 4.8).
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          if (!cancelled) {
            setReport({ success: false, error: '로그인이 만료됐어요. 다시 로그인해주세요.' });
            setReportLoading(false);
          }
          return;
        }
        const { prompt, todayGz } = await buildTodayV3Prompt(result, userCtx, todayIso);
        if (cancelled) return;
        const minuteBucket = Math.floor(Date.now() / 60000);
        const res = await fetch('/api/fortune/jobs/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            category: 'today',
            sajuResult: result,
            prompt,
            profileId: targetProfile?.id,
            sourceBirth: {
              birthDate: targetProfile?.birth_date ?? '',
              birthTime: targetProfile?.birth_time ?? null,
              birthPlace: targetProfile?.birth_place ?? null,
              gender: (targetProfile?.gender ?? 'male') as 'male' | 'female',
              calendarType: (targetProfile?.calendar_type ?? 'solar') as 'solar' | 'lunar',
            },
            engineResult: { todayGz, isoDate: todayIso, userContext: userCtx, version: 'v3' },
            idempotencyKey: `today:${cacheKey}:${minuteBucket}`,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (!cancelled) {
            setReport({ success: false, error: errData.error || '풀이 요청에 실패했어요.' });
            setReportLoading(false);
          }
          return;
        }
        const { jobId } = (await res.json()) as { jobId: string };
        if (cancelled) return;
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('jobId', jobId);
        window.history.replaceState(null, '', newUrl.toString());
        setCreatedJobId(jobId);
      } catch (e) {
        if (!cancelled) {
          setReport({ success: false, error: e instanceof Error ? e.message : '풀이 요청 중 오류' });
          setReportLoading(false);
        }
      }
    };

    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, userCtx, isArchiveMode, effectiveJobId]);

  // ── 프로필 선택 가드 ─────────────────────────────────────────
  if (needsProfileSelect) {
    return (
      <QuickFortuneGate
        serviceName="실시간 운세"
        archiveCategory="today"
        creditType="moon"
        creditCost={MOON_COST_MORE}
      />
    );
  }

  if (!result) {
    const hasUrlBirth = !!(searchParams?.get('year') && searchParams?.get('month') && searchParams?.get('day'));
    const profileStoreReady = hydrated && lastFetchedAt !== null && !profilesLoading;
    if (!hasUrlBirth && !profileStoreReady) {
      return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-cta border-t-transparent rounded-full animate-spin" /></div>;
    }
    if (!hasUrlBirth && !targetProfile) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4">
          <p className="text-text-secondary">대표 프로필이 없어요</p>
          <button onClick={() => router.push('/saju/input')} className="px-5 py-2.5 rounded-xl bg-cta text-white text-sm font-semibold">생년월일 입력</button>
        </div>
      );
    }
    return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-cta border-t-transparent rounded-full animate-spin" /></div>;
  }

  // 로딩 화면 (사용자 입력 제출 후 ~ 결과 도착 전)
  if (reportLoading) {
    const targetDateStr = (() => {
      const d = new Date(todayIso);
      return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
    })();
    return (
      <AILoadingBar
        label="오늘의 기운 분석중"
        minLabel="15초"
        maxLabel="60초"
        estimatedSeconds={30}
        startedAt={fortuneJob?.startedAt}
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

  // ── 입력 폼 노출 (보관함 모드 아니고 아직 결과 없을 때) ──
  if (!isArchiveMode && !report) {
    const todayDateStr = (() => {
      const d = new Date(todayIso);
      return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
    })();
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen px-4 pt-4 pb-12">
        <div className="flex items-center justify-between mb-5 pt-3 px-1">
          <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary" aria-label="뒤로">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="flex-1 flex flex-col items-center">
            <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>실시간 운세</h1>
            <span className="text-[12px] text-text-tertiary mt-0.5">{todayDateStr}</span>
          </div>
          <div className="w-9" />
        </div>
        <InputForm
          initialSlot={initialSlot}
          profileJobState={targetProfile?.job_state || ''}
          profileCustomJobState={targetProfile?.custom_job_state ?? null}
          profileLoveState={targetProfile?.love_state || ''}
          profileCustomLoveState={targetProfile?.custom_love_state ?? null}
          onSubmit={handleSubmitForm}
        />
        <RestoreReportModal
          open={!!cacheGate}
          title="실시간 운세"
          onUseCached={handleUseCached}
          onRefresh={handleRefetch}
          onClose={() => setCacheGate(null)}
        />
      </motion.div>
    );
  }

  // ── 결과 화면 ─────────────────────────────────────────────────
  const reportDateStr = (() => {
    const iso = report?.isoDate ?? todayIso;
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
  })();
  const ctxLabel = report?.userContext ? `${TODAY_TIME_SLOT_LABELS[report.userContext.timeSlot]} · ${report.userContext.hobbies[0] ?? '자기계발'}` : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen px-4 pt-4 pb-12">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-5 pt-3 px-1">
        <button
          onClick={() => {
            if (report && !isArchiveMode) {
              setReport(null);
              setUserCtx(null);
              apiCalledKeyRef.current = null;
              // URL에 박혀 있던 ?jobId 제거 — 안 지우면 새로고침 시 결과로 다시 점프
              setCreatedJobId(null);
              const url = new URL(window.location.href);
              if (url.searchParams.has('jobId')) {
                url.searchParams.delete('jobId');
                window.history.replaceState(null, '', url.toString());
              }
            } else {
              router.back();
            }
          }}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary"
          aria-label="뒤로"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="flex-1 flex flex-col items-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>실시간 운세</h1>
          {isArchiveMode && archivedAt ? (
            <span className="text-[11px] text-text-tertiary mt-0.5">
              보관함 · {new Date(archivedAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          ) : (
            <span className="text-[11px] text-text-tertiary mt-0.5">{reportDateStr}</span>
          )}
        </div>
        <div className="w-9" />
      </div>

      {/* 결과 본문 — 제품/temp_test 1:1 공유 컴포넌트 */}
      {report && (
        <TodayResultView
          report={report}
          result={result}
          reportDateStr={reportDateStr}
          ctxLabel={ctxLabel}
          initialSlot={initialSlot}
        />
      )}

      {(recordId || savedRecordId) && (
        <div className="mt-6">
          <ShareBar recordId={(recordId || savedRecordId)!} type="saju" category="today" />
        </div>
      )}

      <ResultFooterActions
        redo={
          !isArchiveMode
            ? {
                label: '다시 풀이 받기',
                onClick: () => {
                  setReport(null);
                  setUserCtx(null);
                  apiCalledKeyRef.current = null;
                  // URL에 박혀 있던 ?jobId 제거 — 안 지우면 새로고침 시 결과로 다시 점프
                  setCreatedJobId(null);
                  const url = new URL(window.location.href);
                  if (url.searchParams.has('jobId')) {
                    url.searchParams.delete('jobId');
                    window.history.replaceState(null, '', url.toString());
                  }
                  window.scrollTo({ top: 0 });
                },
              }
            : undefined
        }
      />

      <RestoreReportModal
        open={!!cacheGate}
        title="실시간 운세"
        onUseCached={handleUseCached}
        onRefresh={handleRefetch}
        onClose={() => setCacheGate(null)}
      />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function hashUserCtx(ctx: TodayUserContext): string {
  const parts = [
    ctx.timeSlot,
    [...ctx.hobbies].sort().join(','),
    (ctx.customHobby ?? '').trim(),
    ctx.jobState,
    (ctx.customJobState ?? '').trim(),
    ctx.loveState,
    (ctx.customLoveState ?? '').trim(),
    (ctx.q1Answer ?? '').trim().slice(0, 40),
    (ctx.q2Answer ?? '').trim().slice(0, 40),
  ];
  return parts.join('|');
}
