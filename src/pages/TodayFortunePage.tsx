'use client';

/**
 * 오늘의 운세 V3 — 시간대 기반 + 사용자 입력 반영 13섹션 풀이
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
import { SUN_COST_BIG, CHARGE_REASONS } from '../constants/creditCosts';
import { calculateSaju, type SajuResult } from '../utils/sajuCalculator';
import {
  getTodayFortuneV3Report,
  parseTodayV3Sections,
  parseTodayV3DomainScores,
  parseTodayV3FlowScores,
  stripStrayMarkers,
  type TodayFortuneV3AIResult,
} from '../services/fortuneService';
import { sajuDB } from '../services/supabase';
import { findRecentArchive } from '../services/archiveService';
import {
  TODAY_V3_SECTION_KEYS,
  TODAY_V3_SECTION_LABELS,
  TODAY_V3_DOMAIN_KEYS,
  TODAY_V3_DOMAIN_LABELS,
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
  type TodayV3DomainKey,
} from '../constants/prompts';
import { AILoadingBar } from '../components/AILoadingBar';
import { useLoadingGuard } from '../hooks/useLoadingGuard';
import { ShareBar } from '@/components/share/ShareBar';

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

function ScoreRing({ score, size = 132 }: { score: number; size?: number }) {
  const r = size * 0.4;
  const C = 2 * Math.PI * r;
  const offset = C * (1 - score / 100);
  const color = score >= 75 ? '#34D399' : score >= 60 ? '#86EFAC' : score >= 45 ? '#FBBF24' : score >= 30 ? '#FB923C' : '#F87171';
  const grade = score >= 75 ? '대길' : score >= 60 ? '길' : score >= 45 ? '평' : score >= 30 ? '주의' : '경계';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={size * 0.083} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={size * 0.083} strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
      />
      <text x={size / 2} y={size / 2 - 2} textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.26} fontWeight="bold" fill="white">{score}</text>
      <text x={size / 2} y={size / 2 + size * 0.18} textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.09} fill="rgba(255,255,255,0.6)">점 · {grade}</text>
    </svg>
  );
}

function DomainBars({ scores }: { scores: Partial<Record<TodayV3DomainKey, number>> }) {
  return (
    <div className="space-y-2.5">
      {TODAY_V3_DOMAIN_KEYS.map((k) => {
        const v = scores[k] ?? 0;
        const c = v >= 75 ? '#34D399' : v >= 60 ? '#A78BFA' : v >= 45 ? '#FBBF24' : v >= 30 ? '#FB923C' : '#F87171';
        return (
          <div key={k} className="flex items-center gap-3">
            <span className="text-[12.5px] text-text-tertiary w-[68px] shrink-0 text-right">
              {TODAY_V3_DOMAIN_LABELS[k]}
            </span>
            <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${v}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
                className="h-full rounded-full"
                style={{ backgroundColor: c }}
              />
            </div>
            <span className="text-[13px] font-semibold w-7 text-right" style={{ color: c }}>{v}</span>
          </div>
        );
      })}
    </div>
  );
}

function FlowChart({ flow, currentSlot }: { flow: Record<TodayTimeSlot, number>; currentSlot: TodayTimeSlot }) {
  const slots: TodayTimeSlot[] = ['midnight', 'morning', 'afternoon', 'evening'];
  const points = slots.map((s, i) => ({ x: 30 + i * 80, y: 110 - (flow[s] ?? 50) * 0.85, slot: s, score: flow[s] ?? 50 }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  return (
    <div className="w-full">
      <svg viewBox="0 0 290 140" className="w-full">
        {/* baseline */}
        <line x1="20" y1="110" x2="270" y2="110" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1="20" y1="68"  x2="270" y2="68"  stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
        <line x1="20" y1="25"  x2="270" y2="25"  stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
        {/* line */}
        <path d={path} fill="none" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* fill area */}
        <path
          d={`${path} L${points[points.length-1].x},110 L${points[0].x},110 Z`}
          fill="url(#flowGrad)"
          opacity="0.35"
        />
        <defs>
          <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={p.slot === currentSlot ? 6 : 4} fill="#A78BFA" stroke="#1C1033" strokeWidth="2" />
            <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#A78BFA">{p.score}</text>
            <text x={p.x} y={128} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.7)">
              {TODAY_TIME_SLOT_LABELS[p.slot]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 입력 폼
// ─────────────────────────────────────────────────────────────────────────────

function InputForm({
  initialSlot,
  onSubmit,
}: {
  initialSlot: TodayTimeSlot;
  onSubmit: (ctx: TodayUserContext) => void;
}) {
  const [hobbies, setHobbies] = useState<TodayHobby[]>([]);
  const [customHobby, setCustomHobby] = useState('');
  const [jobState, setJobState] = useState<TodayJobState | null>(null);
  const [loveState, setLoveState] = useState<TodayLoveState | null>(null);
  const [q1Answer, setQ1Answer] = useState('');
  const [q2Answer, setQ2Answer] = useState('');
  // '직접 입력'을 골랐을 때만 노출되는 보조 입력값
  const [q1Custom, setQ1Custom] = useState('');
  const [q2Custom, setQ2Custom] = useState('');

  const [[q1, q2]] = useState(() => pickTwoQuestions(initialSlot));
  const slotLabel = TODAY_TIME_SLOT_LABELS[initialSlot];

  const canSubmit =
    (hobbies.length > 0 || customHobby.trim().length > 0) &&
    jobState !== null &&
    loveState !== null;

  const toggleHobby = (h: TodayHobby) => {
    setHobbies((prev) => (prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]));
  };

  const submit = () => {
    if (!canSubmit) return;
    // '직접 입력' 모드면 사용자가 추가로 친 텍스트를, 아니면 선택한 보기 텍스트 그대로 전송
    const resolvedQ1 = q1Answer === '__custom__' ? q1Custom.trim() : q1Answer.trim();
    const resolvedQ2 = q2Answer === '__custom__' ? q2Custom.trim() : q2Answer.trim();
    onSubmit({
      hobbies,
      customHobby: customHobby.trim() || undefined,
      jobState: jobState!,
      loveState: loveState!,
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

      {/* 1. 취미·관심사 */}
      <div className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-1 h-5 rounded-full bg-cta" />
          <h3 className="text-[16px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            요즘 가장 시간을 쏟는 분야
          </h3>
        </div>
        <p className="text-[12px] text-text-tertiary mb-3">하나 이상 선택. 직접 입력도 가능해요.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {TODAY_HOBBY_OPTIONS.map((h) => {
            const on = hobbies.includes(h);
            return (
              <button
                key={h}
                onClick={() => toggleHobby(h)}
                className="px-3.5 py-2 rounded-full text-[13px] font-medium"
                style={{
                  border: on ? '1.5px solid var(--cta-primary)' : '1px solid rgba(255,255,255,0.18)',
                  background: on ? 'rgba(139,92,246,0.20)' : 'rgba(255,255,255,0.04)',
                  color: on ? '#E9D5FF' : 'var(--text-primary)',
                }}
              >
                {h}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          value={customHobby}
          onChange={(e) => setCustomHobby(e.target.value.slice(0, 30))}
          placeholder="그 외 직접 입력 (선택)"
          className="w-full px-3 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[14px] text-text-primary placeholder-text-tertiary"
        />
      </div>

      {/* 2. 직업 상태 */}
      <div className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-1 h-5 rounded-full bg-cta" />
          <h3 className="text-[16px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            직업 상태
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {TODAY_JOB_STATES.map((s) => {
            const on = jobState === s;
            return (
              <button
                key={s}
                onClick={() => setJobState(s)}
                className="px-3.5 py-2 rounded-full text-[13px] font-medium"
                style={{
                  border: on ? '1.5px solid var(--cta-primary)' : '1px solid rgba(255,255,255,0.18)',
                  background: on ? 'rgba(139,92,246,0.20)' : 'rgba(255,255,255,0.04)',
                  color: on ? '#E9D5FF' : 'var(--text-primary)',
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. 연애 상태 */}
      <div className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-1 h-5 rounded-full bg-cta" />
          <h3 className="text-[16px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            연애 상태
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {TODAY_LOVE_STATES.map((s) => {
            const on = loveState === s;
            return (
              <button
                key={s}
                onClick={() => setLoveState(s)}
                className="px-3.5 py-2 rounded-full text-[13px] font-medium"
                style={{
                  border: on ? '1.5px solid var(--cta-primary)' : '1px solid rgba(255,255,255,0.18)',
                  background: on ? 'rgba(139,92,246,0.20)' : 'rgba(255,255,255,0.04)',
                  color: on ? '#E9D5FF' : 'var(--text-primary)',
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. 시간대별 질문 2개 */}
      <div className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-1 h-5 rounded-full bg-cta" />
          <h3 className="text-[16px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            지금 상태
          </h3>
        </div>
        <p className="text-[12px] text-text-tertiary mb-3">{slotLabel}에 어울리는 질문 2개 — 답변하지 않아도 풀이는 가능해요.</p>
        <div className="space-y-5">
          {([
            { question: q1, value: q1Answer, setValue: setQ1Answer, custom: q1Custom, setCustom: setQ1Custom },
            { question: q2, value: q2Answer, setValue: setQ2Answer, custom: q2Custom, setCustom: setQ2Custom },
          ] as const).map(({ question, value, setValue, custom, setCustom }, idx) => (
            <div key={idx}>
              <label className="block text-[13px] text-text-secondary mb-2">{question.q}</label>
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
                        border: on ? '1.5px solid var(--cta-primary)' : '1px solid rgba(255,255,255,0.18)',
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
                    border: value === '__custom__' ? '1.5px solid var(--cta-primary)' : '1px solid rgba(255,255,255,0.18)',
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
                  onChange={(e) => setCustom(e.target.value.slice(0, 100))}
                  placeholder="짧게 적어주세요"
                  className="mt-2 w-full px-3 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[14px] text-text-primary placeholder-text-tertiary"
                />
              )}
            </div>
          ))}
        </div>
      </div>

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
        오늘의 운세 보기
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
  const isArchiveMode = !!recordId;
  const needsProfileSelect = !profileId && !isArchiveMode && !(searchParams?.get('year') && searchParams?.get('month') && searchParams?.get('day'));

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

  // 로딩 안전장치 — 130s. callGPT 자체 90s + 여유.
  const [reportTimedOut] = useLoadingGuard(reportLoading, 130_000);
  useEffect(() => {
    if (reportTimedOut) {
      setReportLoading(false);
      if (!report) setReport({ success: false, error: '응답이 너무 오래 걸려요. 다시 시도해주세요.' });
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

  // userCtx 가 채워지면 보관함 + 캐시 확인 후 호출
  useEffect(() => {
    if (isArchiveMode) return;
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
      getTodayFortuneV3Report(result, userCtx, todayIso, targetProfile?.id)
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
  }, [result, userCtx, isArchiveMode]);

  // ── 프로필 선택 가드 ─────────────────────────────────────────
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
            <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>오늘의 운세</h1>
            <span className="text-[12px] text-text-tertiary mt-0.5">{todayDateStr}</span>
          </div>
          <div className="w-9" />
        </div>
        <InputForm initialSlot={initialSlot} onSubmit={handleSubmitForm} />
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

  // ── 결과 화면 ─────────────────────────────────────────────────
  const todayGz = report?.todayGz;
  const reportDateStr = (() => {
    const iso = report?.isoDate ?? todayIso;
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
  })();
  const overall = report?.domainScores?.overall ?? 0;
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
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>오늘의 운세</h1>
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

      {/* 1. 일진·날짜 카드 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl px-5 py-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] text-text-tertiary mb-1">{reportDateStr}</div>
            <div className="text-[15px] font-semibold text-text-secondary">
              내 일주: <span className="text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
                {result.pillars.day.gan}{result.pillars.day.zhi}
              </span>
            </div>
            {ctxLabel && (
              <div className="text-[12px] text-text-tertiary mt-1">{ctxLabel} 기준 풀이</div>
            )}
          </div>
          {todayGz && (
            <div className="text-right">
              <div className="text-[13px] text-text-tertiary mb-0.5">오늘 일진</div>
              <div className="text-[26px] font-bold text-text-primary leading-none" style={{ fontFamily: 'var(--font-serif)' }}>
                {todayGz.hanja}
              </div>
              <div className="text-[13px] text-text-tertiary mt-0.5">
                {todayGz.ganElement}·{todayGz.zhiElement}
                {todayGz.tenGodGan ? ` · ${todayGz.tenGodGan}` : ''}
              </div>
              {todayGz.interactions.length > 0 && (
                <div className="text-[11px] text-text-tertiary mt-0.5 max-w-[140px] truncate" title={todayGz.interactions.join(' / ')}>
                  {todayGz.interactions[0]}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* 2. 종합 점수 ring */}
      {report?.domainScores && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl px-5 py-5 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] flex items-center gap-5"
        >
          <ScoreRing score={overall} />
          <div className="flex-1">
            <div className="text-[15px] font-bold text-text-primary mb-1" style={{ fontFamily: 'var(--font-serif)' }}>
              오늘의 종합 점수
            </div>
            <p className="text-[12.5px] text-text-tertiary leading-relaxed">
              사주 원국과 4층 운기(대운·세운·월운·일진)를 종합한 오늘 하루의 전체 기운
            </p>
          </div>
        </motion.div>
      )}

      {/* 3. 항목별 점수 9개 */}
      {report?.domainScores && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl px-5 py-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block w-1 h-5 rounded-full bg-cta" />
            <h3 className="text-[16px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
              항목별 운세
            </h3>
          </div>
          <DomainBars scores={report.domainScores} />
        </motion.div>
      )}

      {/* 시간대별 흐름 그래프 */}
      {report?.flowScores && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl px-5 py-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block w-1 h-5 rounded-full bg-cta" />
            <h3 className="text-[16px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
              시간대별 흐름
            </h3>
          </div>
          <FlowChart flow={report.flowScores} currentSlot={report.userContext?.timeSlot ?? initialSlot} />
        </motion.div>
      )}

      {/* 에러 / rawText fallback */}
      {report?.error && (
        <div className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <p className="text-[14px] text-text-secondary">{report.error}</p>
        </div>
      )}
      {report?.rawText && (
        <div className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <p className="text-[15px] text-text-secondary leading-relaxed whitespace-pre-line">
            {stripStrayMarkers(report.rawText)}
          </p>
        </div>
      )}

      {/* 본문 10 섹션 */}
      {report?.sections && (
        <div className="space-y-2">
          {TODAY_V3_SECTION_KEYS.map((key, idx) => {
            const text = report.sections?.[key];
            if (!text) return null;

            // 마지막 safety: 본문에 마커 잔여물이 새어나오지 않게 한 번 더 정화
            const safe = stripStrayMarkers(text);
            // 첫 줄 = 은유 제목, 나머지 = 본문 (정통사주 패턴)
            const lines = safe.split('\n');
            const firstLine = lines[0]?.trim() ?? '';
            const hasMetaphor = lines.length > 1 && firstLine.length > 0 && firstLine.length <= 40 && !firstLine.endsWith('.');
            const metaphorTitle = hasMetaphor ? firstLine : '';
            const bodyText = hasMetaphor ? lines.slice(1).join('\n').trim() : safe;

            // 5번 운용법 헤더는 사용자 취미에 맞춰 동적
            const headerLabel = (() => {
              if (key === 'today_hobby_method' && report.userContext) {
                const primary = report.userContext.hobbies[0] ?? report.userContext.customHobby ?? '자기계발';
                return `${primary} 운용법`;
              }
              return TODAY_V3_SECTION_LABELS[key];
            })();

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * idx }}
                className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block w-1 h-5 rounded-full bg-cta" />
                  <div className="text-[17px] font-bold text-text-primary tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
                    {headerLabel}
                  </div>
                </div>
                {metaphorTitle && (
                  <div className="text-[15px] font-medium leading-snug text-cta/90 mb-4 pl-3" style={{ fontFamily: 'var(--font-serif)' }}>
                    {metaphorTitle}
                  </div>
                )}
                <div className="text-[15px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
                  {bodyText.split(/\n\n+/).map((para, pi) => (
                    <p key={pi} className="whitespace-pre-line">{para.trim()}</p>
                  ))}
                </div>
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function hashUserCtx(ctx: TodayUserContext): string {
  const parts = [
    ctx.timeSlot,
    [...ctx.hobbies].sort().join(','),
    (ctx.customHobby ?? '').trim(),
    ctx.jobState,
    ctx.loveState,
    (ctx.q1Answer ?? '').trim().slice(0, 40),
    (ctx.q2Answer ?? '').trim().slice(0, 40),
  ];
  return parts.join('|');
}
