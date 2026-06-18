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
import { renderEmphasis } from '../utils/renderEmphasis';
import { SectionCollapsible } from '../components/saju/SectionCollapsible';
import { useUserStore } from '../store/useUserStore';
import { useCreditStore } from '../store/useCreditStore';
import { useReportCacheStore, sajuKey, type ReportKind } from '../store/useReportCacheStore';
import { RestoreReportModal } from '../components/RestoreReportModal';
import { FortuneProfileSelect } from '../components/FortuneProfileSelect';
import { QuickFortuneGate } from '../components/QuickFortuneGate';
import { sajuDB, supabase } from '../services/supabase';
import { parseNewyearReport } from '../services/fortuneService';
import { useFortuneJob } from '../hooks/useFortuneJob';
import { findRecentArchive } from '../services/archiveService';
import { BackButton } from '../components/ui/BackButton';
import { SUN_COST_BIG, CHARGE_REASONS } from '../constants/creditCosts';
import { computeSajuFromProfile, sajuFromRecord } from '../utils/profileSaju';
import { calculateSaju, type SajuResult } from '../utils/sajuCalculator';
import { calculatePeriodFortune, type FortuneScope, type FortuneGrade, type PeriodFortune } from '../engine/periodFortune';
import { getPeriodDomainsDescription, getNewyearReport, getPickedDateReport, parsePickedDateReport, parseDateFlowScores, stripAllSectionTags, DATE_TIME_SLOT_LABELS, type NewyearReportAIResult, type PickedDateReportAIResult, type DateTimeSlot, type DateFlowScores } from '../services/fortuneService';
import { NEWYEAR_SECTION_KEYS, NEWYEAR_SECTION_LABELS, PICKED_DATE_SECTION_KEYS, PICKED_DATE_SECTION_LABELS } from '../constants/prompts';
import { AILoadingBar } from '../components/AILoadingBar';
import { LuckyVisualCard, ELEMENT_LUCKY } from '../components/saju/LuckyVisualCard';
import { TermChip } from '../components/ui/TermChip';
import { useLoadingGuard } from '../hooks/useLoadingGuard';
import { ShareBar } from '@/components/share/ShareBar';
import { ResultFooterActions } from '@/components/ui/ResultFooterActions';
import { RadarChart } from '../components/charts/RadarChart';
import { MonthlyTrendChart } from '../components/charts/MonthlyTrendChart';
import { renderNewyearSectionVisual, renderPickedDateSectionVisual } from '../components/saju/NewyearSectionVisuals';
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
      <div className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
        {paragraphs.map((para, pi) => (
          <p key={pi} className="whitespace-pre-line">{renderEmphasis(para)}</p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {unmatched.length > 0 && (
        <p className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] mb-1">{unmatched.join(' ')}</p>
      )}
      {matched.map((card, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i }}
          className="rounded-xl px-4 py-3.5 bg-[rgba(139,92,246,0.08)] border border-[rgba(139,92,246,0.15)]"
        >
          <div className="text-[17px] font-bold text-cta mb-2">{card.label}</div>
          <p className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em]">{renderEmphasis(card.text)}</p>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * 시도하면 좋은 일·피하면 좋은 일 — 항목별 카드 분할 시각화.
 * 프롬프트가 각 항목을 빈 줄로 분리하도록 강제 (date_yes 3장 / date_no 2장).
 * yes = 초록 #34D399 / no = 빨강 #F87171. 좌측 색띠 SectionCollapsible.barColor 와 동일 톤.
 */
/**
 * 빈 줄(\n\n)로 쪼갠 조각 중 "문장이 안 끝난" 조각을 다음 조각과 병합.
 * AI 가 한 문장 중간에 빈 줄을 넣어("…전환하기에\n\n유리합니다") 카드가
 * 문장 한복판에서 쪼개지는 사고를 차단. 한국어 종결(다·요·죠·네·까 + 마침표류)
 * 로 끝나지 않으면 미완결로 보고 뒤 조각을 공백으로 이어 붙인다.
 */
const SENTENCE_END_RE = /(?:[.!?…]|[다요죠네까래])[”"’'」』)）\]]*\s*$/;
function mergeSentenceFragments(parts: string[]): string[] {
  const out: string[] = [];
  for (const p of parts) {
    if (out.length > 0 && !SENTENCE_END_RE.test(out[out.length - 1])) {
      out[out.length - 1] = `${out[out.length - 1]} ${p}`.replace(/\s+/g, ' ').trim();
    } else {
      out.push(p);
    }
  }
  return out;
}

function ActionCardList({ bodyText, variant }: { bodyText: string; variant: 'yes' | 'no' }) {
  const paragraphs = mergeSentenceFragments(
    bodyText.split(/\n\n+/).map(p => p.trim()).filter(Boolean),
  );

  if (paragraphs.length < 2) {
    return (
      <div className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
        {paragraphs.map((para, pi) => (
          <p key={pi} className="whitespace-pre-line">{renderEmphasis(para)}</p>
        ))}
      </div>
    );
  }

  const palette = variant === 'yes'
    ? { bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.22)', accent: '#34D399' }
    : { bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.22)', accent: '#F87171' };

  // 최우선 카드 — prompt 룰에서 첫 문단을 1순위로 작성 강제. 항상 첫 카드.
  const topIdx = 0;
  const topLabel = variant === 'yes' ? '가장 추천' : '가장 조심';

  // 본문 앞에 붙은 prefix 안전망 — AI 가 룰을 어겨 "1순위는/가장 추천은/첫째/①/1)/1." 등으로 시작하면 제거.
  //  · "1순위는" "가장 추천은" 같은 조사 변형, "1." "1)" "①" 번호 마커 모두 매칭
  const stripPrefix = (s: string) => {
    let out = s;
    // 한국어 라벨 prefix + 조사 (는/은/이/가/으로/에/엔/에는) + 구분자
    out = out.replace(/^(가장\s*추천|가장\s*조심|가장\s*권장|가장\s*경계|최우선|최대\s*주의|\d+\s*순위)\s*(는|은|이|가|으로|에는?)?\s*[:·\-,~]*\s*/u, '');
    // 한자/원형 번호 마커: ① ② ③ ④ ⑤ ⓛ
    out = out.replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*[:·\-]*\s*/u, '');
    // 평문 번호: "1." "1)" "1)" "1번"
    out = out.replace(/^\d+\s*[\.\)번]\s*[:·\-]*\s*/u, '');
    // 첫째/둘째/셋째
    out = out.replace(/^(첫째|둘째|셋째|넷째)\s*[:·\-,]*\s*/u, '');
    // 별 마커
    out = out.replace(/^★\s*[:·\-]*\s*/u, '');
    return out.trim();
  };

  return (
    <div className="space-y-2.5">
      {paragraphs.map((para, i) => {
        const isTop = i === topIdx;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="rounded-xl px-4 py-3.5 border"
            style={{ background: palette.bg, borderColor: palette.border }}
          >
            {isTop && (
              <div className="mb-2">
                <span
                  className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide"
                  style={{ background: palette.accent, color: '#0a0a0a' }}
                >
                  {topLabel}
                </span>
              </div>
            )}
            <p className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] whitespace-pre-line">
              {renderEmphasis(stripPrefix(para))}
            </p>
          </motion.div>
        );
      })}
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
      <div className="flex items-center justify-between mb-3 gap-1">
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setViewDate(new Date(year - 1, month, 1))}
            aria-label="이전 해"
            className="w-8 h-8 rounded-lg text-text-secondary hover:bg-white/5 text-[15px]"
          >«</button>
          <button
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            aria-label="이전 달"
            className="w-8 h-8 rounded-lg text-text-secondary hover:bg-white/5 text-[16px]"
          >‹</button>
        </div>
        <span className="text-[16px] font-bold text-text-primary">
          {year}년 {month + 1}월
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            aria-label="다음 달"
            className="w-8 h-8 rounded-lg text-text-secondary hover:bg-white/5 text-[16px]"
          >›</button>
          <button
            onClick={() => setViewDate(new Date(year + 1, month, 1))}
            aria-label="다음 해"
            className="w-8 h-8 rounded-lg text-text-secondary hover:bg-white/5 text-[15px]"
          >»</button>
        </div>
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
  const urlJobId = searchParams?.get('jobId') ?? null;
  const isArchiveMode = !!recordId;
  const needsProfileSelect = !profileId && !isArchiveMode && !urlJobId;

  // 백그라운드 잡 시스템 — scope='year' 의 신년운세에 적용. scope='date' 는 옛 흐름.
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const effectiveJobId = urlJobId ?? createdJobId;
  const { job: fortuneJob } = useFortuneJob(effectiveJobId);
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

  // archive 재생 모드에서 record 의 engine_result.year 가 로드되면 그 값을 우선 사용
  // (연도별 운세 list 모달에서 다른 연도 record 클릭 시 URL.year 와 다른 record.year 가 충돌하는 사고 방지)
  const [archiveYear, setArchiveYear] = useState<number | null>(null);
  // 보관함 재생 시 저장된 result_data(SajuResult) 미러링용 — 생성·공유와 동일 보장
  const [archiveSaju, setArchiveSaju] = useState<SajuResult | null>(null);
  const targetYear = (() => {
    if (archiveYear !== null) return archiveYear;
    const y = searchParams?.get('year');
    if (y) return parseInt(y, 10);
    return new Date().getFullYear();
  })();

  // 계산 — 보관함이면 저장본 미러링, URL에 간지 원국이 들어오면 그것 사용, 아니면 대표 프로필
  const saju = useMemo(() => {
    // ★ 보관함 재생: 생성 시 저장된 result_data 를 그대로 사용 (재계산 X → 공유와 동일)
    if (archiveSaju) return archiveSaju;
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
  }, [archiveSaju, searchParams, targetProfile, scope]);

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

  // source=year-fortune 으로 진입했으면 헤더 라벨을 "연도별 운세" 로 (연도는 부제로)
  const sourceParam = searchParams?.get('source');
  const isFromYearFortune = sourceParam === 'year-fortune';
  const pageTitle =
    scope === 'year' ? (isFromYearFortune ? `${targetYear}년도 운세 풀이` : `${targetYear} 신년운세`)
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

  // ★ fresh=1 또는 targetYear/profileId 변경 시 state + cache 명시적 reset
  //   router.push 만으로는 같은 component instance 라 useState 유지됨 →
  //   연도별 운세에서 다른 연도로 navigate 시 옛 결과 state 가 그대로 보이는 사고 방지.
  //   또 useReportCacheStore 의 cached 값이 즉시 hit 되지 않도록 invalidate 강제.
  const profileIdParam = searchParams?.get('profileId') ?? null;
  const isFreshParam = searchParams?.get('fresh') === '1';
  useEffect(() => {
    if (!isFreshParam) return;
    // 1. cache 강제 invalidate — 다른 곳에서 cached 값 못 가져오도록
    if (saju) {
      const sk = sajuKey(saju);
      const cache = useReportCacheStore.getState();
      if (scope === 'year') cache.invalidate('newyear', `${sk}:${targetYear}`);
      else if (scope === 'date' && pickedDate) cache.invalidate('period_date', `${sk}:${pickedDate}`);
      else if (scope === 'day') cache.invalidate('period_day', `${sk}:${today}`);
    }
    // 2. 모든 풀이 state 강제 초기화 후 useEffect 가 새 풀이 호출하도록
    setNewyearReport(null);
    setPickedDateReport(null);
    setNewyearReportLoading(scope === 'year');
    setPickedDateReportLoading(scope === 'date');
    setCacheGate(null);
    setSavedRecordId(null);
    setArchiveYear(null);  // 새 풀이라 archive year override 해제
    apiCalledKeyRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // ★ saju(객체)는 탭 복귀 시 fetchProfiles→새 profiles→새 saju 로 reference 가 바뀌어 이 reset effect
    //   가 재실행되며 결과를 null 로 만들었다(0.x초 떴다 로딩 복귀). 안정 문자열 sajuKey 로 교체해 차단.
  }, [isFreshParam, targetYear, profileIdParam, scope, saju && sajuKey(saju)]);

  // ── 보관함 재생 모드 — recordId 가 있으면 DB에서 풀이 복원, AI 호출 skip ──
  // (scope='year'·newyear / scope='date'·period 가 archive 저장됨)
  useEffect(() => {
    if (!recordId) return;
    if (scope !== 'year' && scope !== 'date') return;
    let cancelled = false;
    sajuDB.getRecordById(recordId)
      .then((record) => {
        if (cancelled || !record) return;
        // ★ 저장된 result_data 미러링 — 보관함 사주가 생성·공유와 100% 동일
        setArchiveSaju(sajuFromRecord(record));
        const content = record.interpretation_detailed ?? record.interpretation_basic ?? '';
        // archive 의 engine_result.year 가 있으면 targetYear override (헤더·prompt 동기화)
        const recordYear = (record.engine_result as { year?: number | string } | null)?.year;
        if (scope === 'year' && recordYear !== undefined && recordYear !== null) {
          const y = Number(recordYear);
          if (!Number.isNaN(y)) setArchiveYear(y);
        }
        // ★ 지정일 record — engine_result.isoDate 로 pickedDate 동기화.
        //   사고: URL 에 ?date= 없이 ?recordId= 만 들어오면 pickedDate 가 today 디폴트라
        //   헤더에 "선택한 날짜 = 오늘" 로 표시되는데 본문은 실제 풀이 날짜 → 불일치.
        if (scope === 'date') {
          const recordIsoDate = (record.engine_result as { isoDate?: string } | null)?.isoDate;
          if (recordIsoDate && /^\d{4}-\d{2}-\d{2}$/.test(recordIsoDate)) {
            setPickedDate(recordIsoDate);
          }
        }
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

  // ── 잡 결과 → state 동기화 (scope='date' 지정일 운세) ──
  useEffect(() => {
    if (scope !== 'date') return;
    if (isArchiveMode) return;
    if (!fortuneJob) return;
    if (fortuneJob.status === 'done') {
      const content = fortuneJob.interpretationDetailed ?? '';
      const sections = parsePickedDateReport(content);
      const flow = parseDateFlowScores(content);
      setPickedDateReport(
        Object.keys(sections).length > 0
          ? { success: true, sections, rawText: content, flow }
          : { success: true, rawText: content, flow },
      );
      setSavedRecordId(fortuneJob.jobId);
      setPickedDateReportLoading(false);
    } else if (fortuneJob.status === 'failed') {
      setPickedDateReport({
        success: false,
        error: fortuneJob.errorMessage ?? '풀이 생성에 실패했어요. 크레딧은 자동 환불됐어요.',
      });
      setPickedDateReportLoading(false);
    } else if (fortuneJob.status === 'processing' && fortuneJob.interpretationBasic) {
      const content = fortuneJob.interpretationBasic;
      const sections = parsePickedDateReport(content);
      const flow = parseDateFlowScores(content);
      if (Object.keys(sections).length > 0) {
        setPickedDateReport({ success: true, sections, rawText: content, flow });
      }
      setSavedRecordId(fortuneJob.jobId);
      setPickedDateReportLoading(true);
    } else {
      setPickedDateReportLoading(true);
    }
  }, [
    scope,
    isArchiveMode,
    fortuneJob?.status,
    fortuneJob?.interpretationDetailed,
    fortuneJob?.interpretationBasic,
    fortuneJob?.errorMessage,
    fortuneJob?.jobId,
  ]);

  // ── 잡 결과 → state 동기화 (scope='year' 신년운세 전용) ──
  // useFortuneJob 가 saju_records row 변경을 push. status·interpretation 을
  // 기존 newyearReport state 에 매핑. archive 모드(?recordId) 는 별도 useEffect.
  useEffect(() => {
    if (scope !== 'year') return;
    if (isArchiveMode) return;
    if (!fortuneJob) return;
    if (fortuneJob.status === 'done') {
      const content = fortuneJob.interpretationDetailed ?? '';
      const sections = parseNewyearReport(content);
      setNewyearReport(
        Object.keys(sections).length > 0
          ? { success: true, sections }
          : { success: true, rawText: content },
      );
      setSavedRecordId(fortuneJob.jobId);
      setNewyearReportLoading(false);
    } else if (fortuneJob.status === 'failed') {
      setNewyearReport({
        success: false,
        error: fortuneJob.errorMessage ?? '풀이 생성에 실패했어요. 크레딧은 자동 환불됐어요.',
      });
      setNewyearReportLoading(false);
    } else if (fortuneJob.status === 'processing' && fortuneJob.interpretationBasic) {
      // 1차 partial 도착 — 부분 렌더 켜고 2차는 백그라운드 진행 (정통사주 Phase 1.5 패턴)
      const content = fortuneJob.interpretationBasic;
      const sections = parseNewyearReport(content);
      if (Object.keys(sections).length > 0) {
        setNewyearReport({ success: true, sections });
      }
      setSavedRecordId(fortuneJob.jobId);
      setNewyearReportLoading(true);
    } else {
      // pending — 진행 시작 전 모래시계
      setNewyearReportLoading(true);
    }
  }, [
    scope,
    isArchiveMode,
    fortuneJob?.status,
    fortuneJob?.interpretationDetailed,
    fortuneJob?.interpretationBasic,
    fortuneJob?.errorMessage,
    fortuneJob?.jobId,
  ]);

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
    // ★ ?jobId 진입(보관함의 진행 중·완료된 잡 클릭) 또는 새 잡 생성된 경우엔
    //   findRecentArchive 모달 분기 자체 skip. saju_records 가 단일 source of truth.
    //   가드 없으면 옛 archive 가 매칭되어 "기존 풀이 보겠습니까?" 모달이 떠버리는 사고.
    if (effectiveJobId) return;
    if (!saju || !fortune) return;
    // ★ 지정일 운세 — 캘린더 선택 단계 (dateConfirmed=false) 에서는 useEffect 일찍 종료.
    //   apiCalledKeyRef.current 오염 방지 — 사용자가 "풀이 보기" 버튼 눌러 dateConfirmed=true
    //   되면 같은 effectKey 로 useEffect 재실행되는데, 오염된 ref 와 같으니 early return 하는
    //   사고 (2026-05-20 commit 03c437d 이후 발생) 차단.
    if (scope === 'date' && !dateConfirmed) return;

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

      // 이미 잡 ID 가 있으면 (URL ?jobId 또는 직전에 createdJobId 설정) 새로 만들지 않음.
      // useFortuneJob 가 구독, 동기화 useEffect 가 setNewyearReport 처리.
      if (effectiveJobId) return;

      setNewyearReport(null);
      setNewyearReportLoading(true);
      // 백그라운드 잡 생성 — 차감·INSERT·archive 모두 서버.
      // setLoading(false) 는 잡 결과 동기화 useEffect 가 책임 (가이드 4.8 finally 충돌 차단).
      (async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          if (!accessToken) {
            if (!cancelled) {
              setNewyearReport({ success: false, error: '로그인이 만료됐어요. 다시 로그인해주세요.' });
              setNewyearReportLoading(false);
            }
            return;
          }
          const minuteBucket = Math.floor(Date.now() / 60000);
          const idempotencyKey = `${sajuKey(saju)}:${targetYear}:${isFromYearFortune ? 'yf' : 'ny'}:${minuteBucket}`;
          const res = await fetch('/api/fortune/jobs/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({
              category: 'newyear',
              sajuResult: saju,
              fortune,
              year: targetYear,
              userCtx: {
                jobState: targetProfile?.job_state ?? null,
                customJobState: targetProfile?.custom_job_state ?? null,
                loveState: targetProfile?.love_state ?? null,
                customLoveState: targetProfile?.custom_love_state ?? null,
              },
              isYearFortune: isFromYearFortune,
              profileId: targetProfile?.id,
              sourceBirth: {
                birthDate: targetProfile?.birth_date ?? '',
                birthTime: targetProfile?.birth_time ?? null,
                birthPlace: targetProfile?.birth_place ?? null,
                gender: (targetProfile?.gender ?? 'male') as 'male' | 'female',
                calendarType: (targetProfile?.calendar_type ?? 'solar') as 'solar' | 'lunar',
              },
              idempotencyKey,
            }),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            if (!cancelled) {
              setNewyearReport({ success: false, error: errData.error || '풀이 요청에 실패했어요.' });
              setNewyearReportLoading(false);
            }
            return;
          }
          const { jobId } = (await res.json()) as { jobId: string; deduplicated?: boolean };
          if (cancelled) return;
          // URL ?jobId 로 replace — 새로고침·재진입 시 같은 잡 재구독.
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('jobId', jobId);
          window.history.replaceState(null, '', newUrl.toString());
          setCreatedJobId(jobId);
          // setNewyearReportLoading(false) 는 동기화 useEffect 가 status='done' 시 호출.
        } catch (e) {
          if (!cancelled) {
            const msg = e instanceof Error ? e.message : '풀이 요청 중 오류';
            setNewyearReport({ success: false, error: msg });
            setNewyearReportLoading(false);
          }
        }
      })();
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
      if (effectiveJobId) return;  // 이미 잡 있음 (가이드 4.10)
      setPickedDateReport(null);
      setPickedDateReportLoading(true);
      (async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          if (!accessToken) {
            if (!cancelled) {
              setPickedDateReport({ success: false, error: '로그인이 만료됐어요.' });
              setPickedDateReportLoading(false);
            }
            return;
          }
          // server 가 generatePickedDateFortunePrompt 호출하기 위해 클라가 만든 prompt 전달.
          // 한 가지 문제: generatePickedDateFortunePrompt 가 fortuneService.ts(클라) 에서 호출됨.
          // 여기선 prompts.ts 의 함수를 직접 import 해서 호출.
          const { generatePickedDateFortunePrompt } = await import('@/constants/prompts');
          const { calcTodayGanZhi } = await import('@/services/fortuneService');
          const todayGz = calcTodayGanZhi(saju, pickedDate);
          const prompt = generatePickedDateFortunePrompt(saju, todayGz, pickedDate, {
            jobState: targetProfile?.job_state ?? null,
            customJobState: targetProfile?.custom_job_state ?? null,
            loveState: targetProfile?.love_state ?? null,
            customLoveState: targetProfile?.custom_love_state ?? null,
          });
          const minuteBucket = Math.floor(Date.now() / 60000);
          const idempotencyKey = `period:${sajuKey(saju)}:${pickedDate}:${minuteBucket}`;
          const res = await fetch('/api/fortune/jobs/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({
              category: 'period',
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
              engineResult: { isoDate: pickedDate, todayGz },
              idempotencyKey,
            }),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            if (!cancelled) {
              setPickedDateReport({ success: false, error: errData.error || '풀이 요청에 실패했어요.' });
              setPickedDateReportLoading(false);
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
            const msg = e instanceof Error ? e.message : '풀이 요청 중 오류';
            setPickedDateReport({ success: false, error: msg });
            setPickedDateReportLoading(false);
          }
        }
      })();
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
            chargeRef.current('moon', SUN_COST_BIG, CHARGE_REASONS.today, `${kind}:${cacheKey}`)
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
  }, [saju, fortune, scope, pickedDate, targetYear, today, isArchiveMode, dateConfirmed, refetchNonce, effectiveJobId]);

  if (needsProfileSelect) {
    const CURRENT_YEAR = new Date().getFullYear();
    if (scope === 'year') {
      return (
        <FortuneProfileSelect
          serviceName={isFromYearFortune ? `${targetYear}년도 운세 풀이` : `${targetYear} 신년운세`}
          archiveCategory="newyear"
          archiveContext={{ key: 'year', value: String(targetYear) }}
          creditType="moon"
          creditCost={SUN_COST_BIG}
        />
      );
    }
    return (
      <QuickFortuneGate
        serviceName="지정일 운세"
        archiveCategory="period"
        creditType="moon"
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
  // ★ sticky — 결과(newyearReport)가 한 번 채워지면 로딩으로 안 돌아간다(정통사주와 동일 패턴).
  //   모바일/데스크톱 백그라운드 복귀 시 로딩 재시작/되돌아감 차단.
  if (scope === 'year' && newyearReportLoading && !newyearReport) {
    return (
      <AILoadingBar
        label={isFromYearFortune ? `${targetYear}년도 운세 풀이중` : `${targetYear}년 신년운세 풀이중`}
        minLabel="20초"
        maxLabel="1분"
        estimatedSeconds={40}
        startedAt={fortuneJob?.startedAt}
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
  if (scope === 'date' && dateConfirmed && pickedDateReportLoading && !pickedDateReport) {
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
          {/* 캘린더 클릭 = 날짜 선택만 (highlight). 풀이는 아래 버튼으로 명시적 확정.
              잘못 클릭해도 다른 날짜 클릭으로 자유롭게 재선택 가능. */}
          <CalendarPicker
            value={pickedDate}
            onChange={(iso) => setPickedDate(iso)}
          />
          <button
            type="button"
            onClick={() => setDateConfirmed(true)}
            disabled={!pickedDate}
            className="w-full py-3.5 rounded-xl font-bold text-[15px] transition-all"
            style={{
              background: pickedDate ? 'var(--cta-primary)' : 'rgba(124,92,252,0.3)',
              color: '#fff',
              cursor: pickedDate ? 'pointer' : 'not-allowed',
              opacity: pickedDate ? 1 : 0.6,
            }}
          >
            {pickedDate ? `${pickedDate} 풀이 보기` : '날짜를 선택해주세요'}
          </button>
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
              // ★ 잡 컨텍스트 reset — 옛 ?jobId 잔존 시 AILoadingBar 80%~ 시작 버그 차단
              setCreatedJobId(null);
              if (typeof window !== 'undefined') {
                const u = new URL(window.location.href);
                u.searchParams.delete('jobId');
                u.searchParams.delete('recordId');
                u.searchParams.delete('fresh');
                u.searchParams.delete('_t');
                window.history.replaceState(null, '', u.pathname + (u.search ? u.search : ''));
              }
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

      {/* 행운 메타 — 비주얼 카드.
          scope='year'(신년·연도별)는 [lucky] 섹션 카드 안에서 LuckyVisualCard 를
          렌더하므로 여기서는 중복 방지를 위해 생략. date·day 만 상단 단독 노출. */}
      {scope !== 'year' && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
        >
          <div className="text-[15px] font-semibold text-text-secondary mb-3 px-1 uppercase tracking-wider">
            {scope === 'date' ? '이 날의 행운' : '오늘의 행운'}
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
      )}

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
                    {/* 섹션별 시각 데이터 카드 — 본문 줄글 위 한눈 요약 */}
                    {renderNewyearSectionVisual(key, fortune, saju)}
                    {key === 'monthly' ? (
                      <MonthlySectionView bodyText={bodyText} monthlyFlow={fortune?.monthlyFlow ?? []} />
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
                const isTimeflow = key === 'date_timeflow';
                // 시그널 명확성 우선 — 시도(초록)·피하기(빨강) 좌측 띠 + 카드 외곽 테두리 둘 다 적용.
                const sectionBarColor = isYes ? '#34D399' : isNo ? '#F87171' : '#e8a490';
                const sectionBorderColor = isYes
                  ? 'rgba(52,211,153,0.45)'
                  : isNo
                  ? 'rgba(248,113,113,0.45)'
                  : undefined;
                return (
                  <SectionCollapsible
                    key={key}
                    title={PICKED_DATE_SECTION_LABELS[key]}
                    metaphorTitle={metaphorTitle}
                    defaultOpen={idx === 0}
                    enterDelay={0.05 * idx}
                    barColor={sectionBarColor}
                    borderColor={sectionBorderColor}
                  >
                    {isRemedy ? (
                      <RemedyCardGrid bodyText={bodyText} />
                    ) : isTimeflow ? (
                      <TimeFlowSectionView bodyText={bodyText} flow={pickedDateReport.flow} />
                    ) : isYes || isNo ? (
                      <ActionCardList bodyText={bodyText} variant={isYes ? 'yes' : 'no'} />
                    ) : (
                      <>
                        {/* 섹션별 시각 데이터 카드 — 본문 줄글 위 한눈 요약 */}
                        {renderPickedDateSectionVisual(key, fortune)}
                        {/* 시그널은 SectionCollapsible 의 좌측 색띠(barColor) 로 전달. */}
                        <div className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
                          {bodyText.split(/\n\n+/).map((para, pi) => (
                            <p key={pi} className="whitespace-pre-line">{para.trim()}</p>
                          ))}
                        </div>
                      </>
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

      {/* 결과 화면에서만 노출 — 지정일 캘린더 선택 단계에서는 숨김 */}
      {!(scope === 'date' && !dateConfirmed) && (
        <ResultFooterActions
          redo={
            scope === 'date' && !isArchiveMode
              ? {
                  label: '다른 날짜로 다시 풀이받기',
                  onClick: () => {
                    setDateConfirmed(false);
                    setPickedDateReport(null);
                    // ★ 잡 컨텍스트 reset — 옛 ?jobId 잔존 시 AILoadingBar 80%~ 시작 버그 차단
                    setCreatedJobId(null);
                    if (typeof window !== 'undefined') {
                      const u = new URL(window.location.href);
                      u.searchParams.delete('jobId');
                      u.searchParams.delete('recordId');
                      u.searchParams.delete('fresh');
                      u.searchParams.delete('_t');
                      window.history.replaceState(null, '', u.pathname + (u.search ? u.search : ''));
                    }
                    window.scrollTo({ top: 0 });
                  },
                }
              : undefined
          }
        />
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

// ─────────────────────────────────────────────────────────────────────────────
// 월별 흐름 섹션 — 12개월 카드 + "이 해의 핵심 시기" 정리 박스
// ─────────────────────────────────────────────────────────────────────────────
function MonthlySectionView({
  bodyText,
  monthlyFlow,
}: {
  bodyText: string;
  monthlyFlow: PeriodFortune['monthlyFlow'];
}) {
  // 본문을 12개월 블록과 정리 단락으로 분리.
  // 정리 단락은 "── 이 해의 핵심 시기 ──" 헤더로 시작 (AI 출력 기준).
  // 호환: 헤더 없거나 다른 형태면 정리 단락 X, 12개월만 표시.
  const SUMMARY_MARKER_RE = /[─━]{2,}\s*이\s*해의\s*핵심\s*시기\s*[─━]{2,}/;
  let monthsRaw = bodyText;
  let summaryRaw = '';
  const splitIdx = bodyText.search(SUMMARY_MARKER_RE);
  if (splitIdx >= 0) {
    monthsRaw = bodyText.slice(0, splitIdx).trim();
    summaryRaw = bodyText.slice(splitIdx).replace(SUMMARY_MARKER_RE, '').trim();
  }

  // 12개월 블록 파싱 — "N월(...)" 으로 시작하는 단락 split
  const monthBlocks = (monthsRaw.includes('\n\n')
    ? monthsRaw.split(/\n\n+/)
    : monthsRaw.split(/(?=\d{1,2}월\s*\()/)
  ).map(b => b.trim()).filter(Boolean);

  // 각 블록 파싱 — "N월(등급·키워드) | 영역: ○○·○○" 첫 줄 + 본문
  const parseMonthBlock = (block: string): {
    month: number;
    grade: string;
    keyword: string;
    domains: string[];
    body: string;
  } | null => {
    const flat = block.replace(/\n/g, ' ').trim();
    // 매칭: "5월(길·확장) | 영역: 재물·도전" 또는 "5월(길·확장):"
    // ★ 영역 부분은 한글 1~4글자 + 구분자(·,/)만 허용 — non-greedy 함정 방지
    //   (이전 정규식은 m[4] 가 "직" 1글자만 잡고 "장·건강 직장에서는..." 가 본문으로 흘러
    //    영역 칩=직장, 본문="장·건강 직장에서는..." 가 되는 버그 있었음)
    const m = flat.match(/^(\d{1,2})월\s*\(([^·)]+)·([^)]+)\)\s*(?:\|\s*영역\s*:\s*([가-힣]{1,4}(?:\s*[·,/]\s*[가-힣]{1,4})*))?\s*[:|]?\s*(.*)$/);
    if (!m) return null;
    const month = parseInt(m[1], 10);
    const grade = (m[2] ?? '').trim();
    const keyword = (m[3] ?? '').trim();
    // 영역 1글자 약자 → 풀어 표기 (AI 가 가끔 휴/직 단축 출력)
    const DOMAIN_EXPAND: Record<string, string> = {
      '재': '재물', '직': '직장', '연': '연애', '건': '건강',
      '이': '이동', '관': '관계', '결': '결정', '휴': '휴식',
      '기': '기회', '도': '도전', '학': '학업', '가': '가족',
    };
    const domains = (m[4] ?? '')
      .split(/[·,/]/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(d => (d.length === 1 && DOMAIN_EXPAND[d]) ? DOMAIN_EXPAND[d] : d);
    const body = (m[5] ?? '').trim();
    return { month, grade, keyword, domains, body };
  };

  const months = monthBlocks
    .map(parseMonthBlock)
    .filter((m): m is NonNullable<ReturnType<typeof parseMonthBlock>> => !!m)
    .sort((a, b) => a.month - b.month);

  // 정리 단락 — "· " 불릿 항목 split
  const summaryItems = summaryRaw
    .split(/\n+/)
    .map(s => s.replace(/^[·•\-]\s*/, '').trim())
    .filter(Boolean);

  // 등급 → 색 (그라데이션·글로우용)
  const gradeColor: Record<string, string> = {
    '대길': '#34D399',
    '길':   '#86EFAC',
    '중길': '#FBBF24',
    '평':   '#CBD5E1',
    '중흉': '#FB923C',
    '흉':   '#F87171',
  };
  // 월 → 한자 (사주 컨셉 강화)
  const HANJA_MONTH = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
  // 등급 → 별 개수 (시각 시그널)
  const gradeStars: Record<string, number> = {
    '대길': 5, '길': 4, '중길': 3, '평': 3, '중흉': 2, '흉': 1,
  };

  return (
    <div className="space-y-1">
      {/* 12개월 — 큰 한자·숫자 + 코스믹 카드 + 카드 간 연결점 */}
      <div className="relative flex flex-col">
        {months.length > 0
          ? months.map((m, idx) => {
              const c = gradeColor[m.grade] ?? '#CBD5E1';
              const starCount = gradeStars[m.grade] ?? 3;
              const isLast = idx === months.length - 1;
              return (
                <div key={m.month} className="relative">
                  {/* 카드 */}
                  <div
                    className="relative overflow-hidden rounded-2xl border"
                    style={{
                      background: `linear-gradient(135deg, rgba(20,12,38,0.65) 0%, ${c}11 50%, rgba(20,12,38,0.55) 100%)`,
                      borderColor: `${c}33`,
                      boxShadow: `0 0 24px ${c}10, inset 0 0 1px ${c}40`,
                    }}
                  >
                    {/* 상단 — 월 번호(serif 큰 글씨) + 별점 + 영역 태그 */}
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
                        {/* 月 자 — 숫자와 동일 크기로 통일감 */}
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
                      {/* 별점 + 등급 라벨 */}
                      <div className="relative flex flex-col items-end gap-1 shrink-0">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }, (_, si) => (
                            <svg
                              key={si}
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill={si < starCount ? c : 'transparent'}
                              stroke={si < starCount ? c : 'rgba(255,255,255,0.18)'}
                              strokeWidth="2"
                            >
                              <polygon points="12 2 15 9 22 9 17 14 19 22 12 18 5 22 7 14 2 9 9 9 12 2" />
                            </svg>
                          ))}
                        </div>
                        <span
                          className="text-[10.5px] font-semibold tracking-[0.08em]"
                          style={{ color: c }}
                        >
                          {m.grade.toUpperCase()}
                        </span>
                        {/* 월 한자 — 별점·등급 바로 아래에 페이드 워터마크 */}
                        <span
                          aria-hidden
                          className="absolute right-0 text-[56px] font-bold leading-none select-none pointer-events-none"
                          style={{
                            fontFamily: 'var(--font-title)',
                            color: c,
                            opacity: 0.22,
                            letterSpacing: '-0.05em',
                            top: 'calc(100% + 4px)',
                            whiteSpace: 'nowrap',
                            width: 'max-content',
                            display: 'block',
                          }}
                        >
                          {HANJA_MONTH[m.month - 1] ?? `${m.month}`}
                        </span>
                      </div>
                    </div>

                    {/* 영역 태그 (구분선 위) */}
                    {m.domains.length > 0 && (
                      <div className="relative flex flex-wrap gap-1.5 px-5 pb-2.5">
                        {m.domains.map((d, di) => (
                          <span
                            key={di}
                            className="text-[10.5px] px-2 py-0.5 rounded-full"
                            style={{
                              background: `${c}1a`,
                              color: c,
                              border: `1px solid ${c}3a`,
                              fontFamily: 'var(--font-body)',
                              letterSpacing: '0.02em',
                            }}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 구분선 */}
                    <div
                      className="relative mx-5 h-px"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${c}55, transparent)`,
                      }}
                    />

                    {/* 본문 — 다른 섹션과 동일 톤 (leading-[1.85] 룰이 SUIT + 자간 0.16em 자동 적용) */}
                    <div className="relative px-4 pt-3 pb-4">
                      <p className="text-[16px] text-text-secondary leading-[1.85] tracking-[-0.005em]">
                        {m.body}
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
            })
          : // 파싱 실패 시 fallback
            monthBlocks.map((mb, mi) => (
              <p key={mi} className="text-[16px] text-text-secondary leading-[1.85] tracking-[0.012em] py-1.5"
                 style={{ fontFamily: 'var(--font-body)', wordBreak: 'keep-all' }}>
                {mb.replace(/\n/g, ' ').trim()}
              </p>
            ))}
      </div>

      {/* 정리 단락 — "이 해의 핵심 시기" 코스믹 강조 박스 */}
      {summaryItems.length > 0 && (
        <div
          className="mt-5 relative overflow-hidden rounded-2xl p-5"
          style={{
            background: 'radial-gradient(ellipse at top right, rgba(252,213,180,0.10) 0%, rgba(20,12,38,0.7) 70%)',
            border: '1px solid rgba(252,213,180,0.30)',
            boxShadow: '0 0 32px rgba(252,213,180,0.08), inset 0 0 1px rgba(252,213,180,0.40)',
          }}
        >
          {/* 배경 별빛 점 */}
          <span aria-hidden className="absolute top-3 right-4 w-1 h-1 rounded-full bg-[#fcd5b4] opacity-70" />
          <span aria-hidden className="absolute top-8 right-10 w-0.5 h-0.5 rounded-full bg-[#fcd5b4] opacity-50" />
          <span aria-hidden className="absolute bottom-5 left-6 w-0.5 h-0.5 rounded-full bg-[#fcd5b4] opacity-40" />

          <div className="relative flex items-center gap-2.5 mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fcd5b4" stroke="#fcd5b4" strokeWidth="1.5">
              <polygon points="12 2 15 9 22 9 17 14 19 22 12 18 5 22 7 14 2 9 9 9 12 2" />
            </svg>
            <span
              className="text-[16px] font-bold text-text-primary"
              style={{ fontFamily: 'var(--font-title)', letterSpacing: '-0.01em' }}
            >
              이 해의 핵심 시기
            </span>
          </div>
          <ul className="relative space-y-2.5">
            {summaryItems.map((item, i) => (
              <li
                key={i}
                className="text-[15px] text-text-secondary"
                style={{
                  fontFamily: 'var(--font-body)',
                  lineHeight: 1.85,
                  letterSpacing: '-0.005em',
                }}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// 시간대별 흐름 — 아침·낮·저녁·밤 4구간 카드 레이아웃
function TimeFlowSectionView({
  bodyText,
  flow,
}: {
  bodyText: string;
  flow?: DateFlowScores;
}) {
  type SlotKey = 'morning' | 'afternoon' | 'evening' | 'night';

  // 4 시간대 메타 — 한글 라벨 / 한자 / 시간 범위 / 색
  const SLOT_META: Record<SlotKey, { ko: string; hanja: string; range: string; color: string }> = {
    morning:   { ko: '아침', hanja: '朝', range: '06 — 12시', color: '#FCD34D' }, // sunrise amber
    afternoon: { ko: '낮',   hanja: '晝', range: '12 — 18시', color: '#FB923C' }, // noon orange
    evening:   { ko: '저녁', hanja: '夕', range: '18 — 22시', color: '#F472B6' }, // sunset pink
    night:     { ko: '밤',   hanja: '夜', range: '22 — 02시', color: '#818CF8' }, // night indigo
  };
  const SLOT_ORDER: SlotKey[] = ['morning', 'afternoon', 'evening', 'night'];

  // bodyText 파싱 — 각 시간대로 시작하는 단락 추출
  // AI 출력 변형 흡수: "아침(06~12시) — ..." / "아침 — ..." / "아침: ..." /
  // "아침(06~12시)는 ..." / "낮(12~18시)은 ..." / "저녁에 ..." / "밤이 ..." 등
  const paragraphs = bodyText.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const slotBodies: Partial<Record<SlotKey, string>> = {};
  const otherParas: string[] = [];

  const SLOT_LABEL: Record<SlotKey, string> = {
    morning: '아침',
    afternoon: '낮',
    evening: '저녁',
    night: '밤',
  };

  // 라벨로 시작하는 단락에서 prefix(시간 괄호·조사·구분자) 제거 후 본문 반환
  const stripSlotPrefix = (para: string, label: string): string | null => {
    const trimmed = para.trimStart();
    if (!trimmed.startsWith(label)) return null;
    let rest = trimmed.slice(label.length);
    rest = rest.replace(/^\s*\([^)]*\)/, '');
    rest = rest.replace(/^\s*(?:에는|에서는|에서|은|는|이|가|에|을|를)?\s*[—\-–·:：]?\s*/, '');
    const body = rest.trim();
    if (body.length < 2) return null;
    return body;
  };

  for (const para of paragraphs) {
    let matched = false;
    for (const slot of SLOT_ORDER) {
      if (slotBodies[slot]) continue;
      const body = stripSlotPrefix(para, SLOT_LABEL[slot]);
      if (body) {
        slotBodies[slot] = body;
        matched = true;
        break;
      }
    }
    if (!matched) otherParas.push(para);
  }

  const hasAnySlot = SLOT_ORDER.some(s => slotBodies[s]);

  // 가장 좋은/약한 시간대 추출 (flow 기반, summary 박스에 표시)
  const bestSlot = flow
    ? SLOT_ORDER.reduce((a, b) => (flow[a] >= flow[b] ? a : b))
    : null;
  const weakSlot = flow
    ? SLOT_ORDER.reduce((a, b) => (flow[a] <= flow[b] ? a : b))
    : null;

  // 파싱 실패 시 fallback — 원본 단락 그대로
  if (!hasAnySlot) {
    return (
      <div className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
        {paragraphs.map((para, pi) => (
          <p key={pi} className="whitespace-pre-line">{renderEmphasis(para)}</p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="relative flex flex-col">
        {SLOT_ORDER.map((slot, idx) => {
          const meta = SLOT_META[slot];
          const body = slotBodies[slot];
          if (!body) return null;
          const score = flow?.[slot];
          const isLast = idx === SLOT_ORDER.length - 1
            || SLOT_ORDER.slice(idx + 1).every(s => !slotBodies[s]);
          const isBest = bestSlot === slot;

          return (
            <div key={slot} className="relative">
              <div
                className="relative overflow-hidden rounded-2xl border"
                style={{
                  background: `linear-gradient(135deg, rgba(20,12,38,0.65) 0%, ${meta.color}11 50%, rgba(20,12,38,0.55) 100%)`,
                  borderColor: `${meta.color}33`,
                  boxShadow: `0 0 24px ${meta.color}10, inset 0 0 1px ${meta.color}40`,
                }}
              >
                {/* 한자 — 전통 낙관(도장) 스타일, 우측 중앙 배치 */}
                <span
                  aria-hidden
                  className="absolute top-1/2 right-5 text-[56px] font-bold leading-none select-none pointer-events-none"
                  style={{
                    fontFamily: 'var(--font-title)',
                    color: meta.color,
                    opacity: 0.22,
                    letterSpacing: '-0.05em',
                    transform: 'translateY(-50%)',
                  }}
                >
                  {meta.hanja}
                </span>

                {/* 상단 — 시간대 + 시간 범위 + 점수 */}
                <div className="relative flex items-start justify-between gap-3 px-5 pt-4 pb-2">
                  <div className="flex items-baseline gap-2.5 flex-wrap">
                    <span
                      className="font-bold leading-none"
                      style={{
                        fontFamily: 'var(--font-title)',
                        fontSize: '23px',
                        color: meta.color,
                        textShadow: `0 0 18px ${meta.color}55`,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {meta.ko}
                    </span>
                    <span
                      className="text-[13px] text-text-tertiary ml-1"
                      style={{ fontFamily: 'var(--font-title)', letterSpacing: '0.02em' }}
                    >
                      {meta.range}
                    </span>
                  </div>
                  {/* 점수 + best 표시 */}
                  {typeof score === 'number' && (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className="text-[20px] font-bold leading-none"
                        style={{
                          fontFamily: 'var(--font-title)',
                          color: meta.color,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {score}
                      </span>
                      {isBest && (
                        <span
                          className="text-[10px] font-semibold tracking-[0.08em]"
                          style={{ color: meta.color }}
                        >
                          BEST
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 구분선 */}
                <div
                  className="relative mx-5 h-px"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${meta.color}55, transparent)`,
                  }}
                />

                {/* 본문 — 다른 섹션 본문과 동일 톤(SUIT 17px, 자간 -0.005em, 라인 1.85) */}
                <div className="relative px-4 pt-3 pb-4">
                  <p
                    className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em]"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {body}
                  </p>
                </div>
              </div>

              {/* 카드 간 연결 점선 */}
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

      {/* 정리 — 가장 좋은/약한 시간대 + 본문 내 잔여 단락 (예: 마지막 정리 문장) */}
      {(otherParas.length > 0 || (bestSlot && weakSlot && bestSlot !== weakSlot)) && (
        <div
          className="mt-5 relative overflow-hidden rounded-2xl p-5"
          style={{
            background: 'radial-gradient(ellipse at top right, rgba(252,213,180,0.10) 0%, rgba(20,12,38,0.7) 70%)',
            border: '1px solid rgba(252,213,180,0.30)',
            boxShadow: '0 0 32px rgba(252,213,180,0.08), inset 0 0 1px rgba(252,213,180,0.40)',
          }}
        >
          <div className="relative flex items-center gap-2.5 mb-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fcd5b4" stroke="#fcd5b4" strokeWidth="1.5">
              <polygon points="12 2 15 9 22 9 17 14 19 22 12 18 5 22 7 14 2 9 9 9 12 2" />
            </svg>
            <span
              className="text-[16px] font-bold text-text-primary"
              style={{ fontFamily: 'var(--font-title)', letterSpacing: '-0.01em' }}
            >
              하루의 결
            </span>
          </div>

          {/* 가장 좋은 / 가장 약한 시간대 — flow 데이터 있을 때만 */}
          {bestSlot && weakSlot && bestSlot !== weakSlot && (
            <div className="flex gap-2 mb-3">
              <div
                className="flex-1 rounded-xl px-3 py-2.5"
                style={{
                  background: `${SLOT_META[bestSlot].color}14`,
                  border: `1px solid ${SLOT_META[bestSlot].color}40`,
                }}
              >
                <div
                  className="text-[11px] mb-0.5 tracking-[0.08em]"
                  style={{ color: SLOT_META[bestSlot].color }}
                >
                  가장 좋은 시간
                </div>
                <div
                  className="text-[16px] font-bold"
                  style={{
                    fontFamily: 'var(--font-title)',
                    color: SLOT_META[bestSlot].color,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {SLOT_META[bestSlot].ko}
                </div>
              </div>
              <div
                className="flex-1 rounded-xl px-3 py-2.5"
                style={{
                  background: `${SLOT_META[weakSlot].color}10`,
                  border: `1px solid ${SLOT_META[weakSlot].color}30`,
                }}
              >
                <div
                  className="text-[11px] mb-0.5 tracking-[0.08em]"
                  style={{ color: SLOT_META[weakSlot].color, opacity: 0.85 }}
                >
                  가장 약한 시간
                </div>
                <div
                  className="text-[16px] font-bold"
                  style={{
                    fontFamily: 'var(--font-title)',
                    color: SLOT_META[weakSlot].color,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {SLOT_META[weakSlot].ko}
                </div>
              </div>
            </div>
          )}

          {/* 본문 내 잔여 단락 (마지막 정리 문장 등) — 본문 톤 통일(SUIT, 자간 -0.005em) */}
          {otherParas.length > 0 && (
            <div className="space-y-2">
              {otherParas.map((para, i) => (
                <p
                  key={i}
                  className="text-[15px] text-text-secondary leading-[1.85] tracking-[-0.005em]"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {renderEmphasis(para)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
