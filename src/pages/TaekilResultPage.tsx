'use client';

/**
 * 택일 운세 결과 페이지 — recordId 기반 단독 라우트
 * 입력은 TaekilPage 가 처리하고, 풀이 완료 후 archive recordId 와 함께 이 페이지로 navigate.
 * 보관함 진입(recordId in URL) 역시 동일 페이지를 사용.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { sajuDB } from '../services/supabase';
import { useFortuneJob } from '../hooks/useFortuneJob';
import { AILoadingBar } from '../components/AILoadingBar';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';
import { computeSajuFromProfile } from '../utils/profileSaju';
import { extractMetaphor } from '../utils/parseMetaphor';
import { BackButton } from '../components/ui/BackButton';
import { ShareBar } from '@/components/share/ShareBar';
import { ResultFooterActions } from '@/components/ui/ResultFooterActions';
import { SectionCollapsible } from '../components/saju/SectionCollapsible';
import { renderEmphasis } from '../utils/renderEmphasis';
import { renderTaekilSectionVisual } from '../components/saju/TaekilSectionVisuals';
import {
  TAEKIL_CATEGORIES,
  migrateLegacyCategory,
  type TaekilGrade,
  type TaekilDay,
  type TaekilResult,
} from '../engine/taekil';
import styles from './SajuResultPage.module.css';

// ── 상수 ──
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
const ELEMENT_COLORS: Record<string, string> = {
  '목': '#2D8659', '화': '#E63946', '토': '#F4A261', '금': '#94A3B8', '수': '#3B82F6',
};

interface TaekilKeyword {
  name: string;
  desc: string;
}

interface TaekilDateAdvice {
  rank: number;
  /** "종합:" 본문 (옛 레코드 호환을 위해 summary 이름 유지) */
  summary: string;
  /** "조언:" 본문 — 이 날 무엇을 하면 좋은지 구체 행동 */
  advice: string;
  /** "주의:" 본문 — 이 날 조심해야 할 점 */
  caution: string;
  /** "키워드:" 칩 3개 — {name, desc} 형태. 옛 record 호환 위해 desc 빈문자열 허용 */
  keywords: TaekilKeyword[];
}

interface TaekilParsedAdvice {
  /** "종합 분석" — 사주 + 카테고리 + 정황을 엮은 커스텀 분석. 새 마커 [comprehensive_analysis] */
  comprehensiveAnalysis: string;
  dates: TaekilDateAdvice[];
  avoid: string;
  /** "OO에 대한 조언" 영역 — 1·2·3위 통합 권고 */
  overallAdvice: string;
  /** "추천 대체 방법" 영역 */
  alternative: string;
}

/** "정인안정=설명문" 또는 "정인안정" 형식을 파싱. = 없으면 desc 빈문자열. */
function parseKeywordToken(token: string): TaekilKeyword | null {
  const t = token.trim();
  if (!t) return null;
  const eqIdx = t.indexOf('=');
  if (eqIdx === -1) return { name: t, desc: '' };
  const name = t.slice(0, eqIdx).trim();
  const desc = t.slice(eqIdx + 1).trim();
  if (!name) return null;
  return { name, desc };
}

/**
 * 조언·주의 본문을 문장별 항목으로 분리.
 * - 새 record: AI 가 "- " 불릿으로 출력 → 불릿 라인 추출
 * - 옛 record: 줄글 → 문장 종결부 기준 분리 (fallback)
 */
function toBullets(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const bulletLines = lines.filter((l) => /^[-·•▸*]/.test(l));
  if (bulletLines.length >= 2) {
    return bulletLines.map((l) => l.replace(/^[-·•▸*]\s*/, '').trim()).filter(Boolean);
  }
  return text
    .replace(/\s*\n+\s*/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 조언·주의 — 문장별 불릿 리스트 (색점 + 한 문장) */
function SentenceList({ items, color }: { items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {items.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <span
            style={{
              marginTop: 9, width: 5, height: 5, borderRadius: '50%',
              background: color, flexShrink: 0,
            }}
          />
          <span
            className="text-text-secondary"
            style={{ fontSize: 16, lineHeight: 1.7, fontFamily: 'var(--font-body)', letterSpacing: '-0.005em' }}
          >
            {renderEmphasis(s)}
          </span>
        </div>
      ))}
    </div>
  );
}

function parseTaekilStructuredAdvice(raw: string): TaekilParsedAdvice {
  // ── 마커 변형 정규화 ──
  // LLM 이 [top1] 대신 "1위", "1순위", "## 1위", "**1위**", "<1위>" 등으로 답하는 경우가 있어
  // 표준 마커로 통일 후 파싱. 같은 패턴을 comprehensive_analysis / overall_advice / alternative / avoid 에도 적용.
  // (대소문자·공백·마크다운 변형 모두 [표준마커] 로 치환)
  let normalized = raw
    // 마크다운 헤딩·볼드·이탤릭·앵글브라켓 제거
    .replace(/^[ \t]*#{1,6}[ \t]*/gm, '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    // 영문 마커가 변형돼 들어오는 경우 (대소문자, 언더바·하이픈 변형)
    .replace(/\[?\s*top[\s_-]*([123])\s*\]?\s*[:：]?/gi, '\n[top$1]\n')
    .replace(/\[?\s*comprehensive[\s_-]*analysis\s*\]?\s*[:：]?/gi, '\n[comprehensive_analysis]\n')
    .replace(/\[?\s*overall[\s_-]*advice\s*\]?\s*[:：]?/gi, '\n[overall_advice]\n')
    .replace(/\[?\s*alternative\s*\]?\s*[:：]?/gi, '\n[alternative]\n')
    .replace(/\[?\s*avoid\s*\]?\s*[:：]?/gi, '\n[avoid]\n')
    // 한글 마커 변형 → 표준 마커로 치환.
    // 줄 시작에 (선택: 번호 접두사 "1.", "1)", "①" 등) + 마커 + (콜론·공백 후 같은 줄 본문) 매치.
    // 라벨 "종합:", "조언:" 과 충돌 방지 — "종합 분석" / "전체·전반 조언" 만 매치, 단독 "종합"·"조언" 은 라벨로 보존.
    .replace(/^[ \t]*(?:\d+[\.\)]\s*)?[<\[\(]?\s*1\s*(?:위|순위)\s*[>\]\)]?\s*[:：]?[ \t]*/gm, '[top1]\n')
    .replace(/^[ \t]*(?:\d+[\.\)]\s*)?[<\[\(]?\s*2\s*(?:위|순위)\s*[>\]\)]?\s*[:：]?[ \t]*/gm, '[top2]\n')
    .replace(/^[ \t]*(?:\d+[\.\)]\s*)?[<\[\(]?\s*3\s*(?:위|순위)\s*[>\]\)]?\s*[:：]?[ \t]*/gm, '[top3]\n')
    .replace(/^[ \t]*(?:\d+[\.\)]\s*)?[<\[\(]?\s*종합\s*분석\s*[>\]\)]?\s*[:：]?[ \t]*/gm, '[comprehensive_analysis]\n')
    .replace(/^[ \t]*(?:\d+[\.\)]\s*)?[<\[\(]?\s*(?:전체|전반)?\s*[^\n]*?에?\s*대한?\s*조언\s*[>\]\)]?\s*[:：]?[ \t]*$/gm, '[overall_advice]\n')
    .replace(/^[ \t]*(?:\d+[\.\)]\s*)?[<\[\(]?\s*(?:추천\s*)?(?:대체|대안)\s*(?:방법|방안)\s*[>\]\)]?\s*[:：]?[ \t]*/gm, '[alternative]\n')
    .replace(/^[ \t]*(?:\d+[\.\)]\s*)?[<\[\(]?\s*(?:흉일\s*피하기|피해야\s*할?\s*날)\s*[>\]\)]?\s*[:：]?[ \t]*/gm, '[avoid]\n');

  // ── 번호+날짜 패턴 fallback ──
  // LLM 이 "1. 종합 분석" / "2. 2026-05-23(...)" / "3. 2026-12-12(...)" 형식으로 출력하는 옛 케이스 대응.
  // 위 한글 마커 정규식이 종합·avoid·overall_advice·alternative 는 잡지만,
  // 날짜만 들어간 top1·2·3 는 못 잡으므로 — "N. YYYY-MM-DD(...)" 패턴을 순서대로 [topK] 로 치환.
  {
    let topCounter = 0;
    normalized = normalized.replace(
      /^[ \t]*\d+[\.\)]\s*(\d{4}-\d{2}-\d{2}[^\n]*)/gm,
      (_full, dateLine) => {
        topCounter += 1;
        if (topCounter > 3) return _full;
        return `[top${topCounter}]\n${dateLine}`;
      },
    );
  }

  // 같은 마커가 연속해서 들어간 케이스 정리 ([top1]\n[top1] → [top1])
  normalized = normalized.replace(/(\[(?:top\d|comprehensive_analysis|overall_advice|alternative|avoid)\])\s*\1/g, '$1');

  // [comprehensive_analysis] 추출 — top1 또는 다른 마커 직전까지
  const compMatch = normalized.match(/\[comprehensive_analysis\]\s*([\s\S]*?)(?=\[(?:top\d|avoid|overall_advice|alternative)\]|$)/);
  let comprehensiveAnalysis = compMatch ? compMatch[1].trim() : '';

  // ── fallback 추출 ──
  // [comprehensive_analysis] 마커가 정규화 후에도 없는 경우 (LLM 이 마커를 완전 누락 + 첫 줄부터 본문 시작),
  // [top1] 마커 직전까지의 본문 덩어리가 50자 이상이면 그것을 종합 분석으로 인정.
  // ([taekil_advice] 마커는 제외)
  if (!comprehensiveAnalysis) {
    const firstTopIdx = normalized.search(/\[top\d\]/);
    if (firstTopIdx > 0) {
      const beforeTop = normalized.slice(0, firstTopIdx)
        .replace(/^\s*\[taekil_advice\]\s*/i, '')
        .trim();
      if (beforeTop.length >= 50) comprehensiveAnalysis = beforeTop;
    }
  }

  const dates: TaekilDateAdvice[] = [];
  const topRe = /\[top(\d)\]/g;
  const parts = normalized.split(topRe);
  for (let i = 1; i < parts.length; i += 2) {
    const rank = parseInt(parts[i], 10);
    // 다음 마커 직전까지가 이 top 의 본문 (top·avoid·overall_advice·alternative 어느 것 먼저 와도 끊음)
    const content = (parts[i + 1] ?? '').split(/\[(?:top\d|avoid|overall_advice|alternative)\]/)[0].trim();

    // 새 포맷: 종합 / 조언 / 주의 / 키워드 4 라벨
    const extractLabel = (label: string): string => {
      // 다음 라벨 전까지 추출
      const re = new RegExp(`${label}[:：]\\s*([\\s\\S]*?)(?=\\n\\s*(?:종합|조언|주의|키워드|분석|시간대|개운법)[:：]|$)`);
      const m = content.match(re);
      return m ? m[1].trim() : '';
    };
    const summary = extractLabel('종합');
    const advice = extractLabel('조언');
    const caution = extractLabel('주의');
    const keywordRaw = extractLabel('키워드');

    if (summary || advice || caution) {
      dates.push({
        rank,
        summary,
        advice,
        caution,
        keywords: keywordRaw
          ? keywordRaw.split(/[,，]/).map(parseKeywordToken).filter((k): k is TaekilKeyword => !!k)
          : [],
      });
    } else {
      // 옛 포맷(분석·시간대·개운법) fallback — 단일 summary 로 합쳐서 보존
      const legacyExtract = (label: string): string => {
        const re = new RegExp(`${label}[:：]\\s*([\\s\\S]*?)(?=\\n(?:분석|시간대|개운법|주의|종합|조언|키워드)[:：]|$)`);
        const m = content.match(re);
        return m ? m[1].trim() : '';
      };
      const analysis = legacyExtract('분석');
      const times = legacyExtract('시간대');
      const luck = legacyExtract('개운법');
      const legacyCaution = legacyExtract('주의');
      const merged = [analysis, times && `추천 시간대: ${times}`, luck && `개운법: ${luck}`].filter(Boolean).join('\n');
      dates.push({
        rank,
        summary: merged || content,
        advice: '',
        caution: legacyCaution,
        keywords: [],
      });
    }
  }

  const avoidMatch = normalized.match(/\[avoid\]\s*([\s\S]*?)(?=\[(?:overall_advice|alternative)\]|$)/);
  const avoid = avoidMatch ? avoidMatch[1].trim() : '';

  const overallMatch = normalized.match(/\[overall_advice\]\s*([\s\S]*?)(?=\[alternative\]|$)/);
  const overallAdvice = overallMatch ? overallMatch[1].trim() : '';

  const altMatch = normalized.match(/\[alternative\]\s*([\s\S]*?)$/);
  const alternative = altMatch ? altMatch[1].trim() : '';

  return { comprehensiveAnalysis, dates, avoid, overallAdvice, alternative };
}

export default function TaekilResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recordId = searchParams?.get('recordId') ?? null;
  const urlJobId = searchParams?.get('jobId') ?? null;
  // TaekilPage 가 넘긴 로딩 시작 시각(ms) — fortuneJob 도착 전 AILoadingBar 가
  // 0% 부터 새로 시작하지 않도록 fallback startedAt 으로 사용.
  const loadStartedParam = searchParams?.get('t') ?? null;
  const fallbackStartedAt = loadStartedParam
    ? new Date(Number(loadStartedParam)).toISOString()
    : null;
  const { user } = useUserStore();
  const { profiles, fetchProfiles } = useProfileStore();

  const [result, setResult] = useState<TaekilResult | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [parsedAdvice, setParsedAdvice] = useState<TaekilParsedAdvice | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  // 키워드 칩 클릭 시 설명을 보여줄 모달. null 이면 닫힘.
  const [activeKeyword, setActiveKeyword] = useState<TaekilKeyword | null>(null);
  // recordId 또는 jobId 없으면 즉시 에러 상태로 시작
  const [loading, setLoading] = useState<boolean>(!!recordId || !!urlJobId);
  const [error, setError] = useState<string | null>(
    (recordId || urlJobId) ? null : '잘못된 접근이에요. recordId 또는 jobId 가 없습니다.'
  );

  // 백그라운드 잡 시스템 — ?jobId 진입 시 useFortuneJob 으로 saju_records 구독
  const { job: fortuneJob } = useFortuneJob(urlJobId);

  // ── 잡 결과 → state 동기화 ──
  useEffect(() => {
    if (!urlJobId) return;
    if (!fortuneJob) return;
    if (fortuneJob.status === 'done') {
      const content = fortuneJob.interpretationDetailed ?? '';
      setAiAdvice(content);
      setParsedAdvice(parseTaekilStructuredAdvice(content));
      const engine = fortuneJob.engineResult as unknown as TaekilResult | null;
      if (engine) {
        const migrated = migrateLegacyCategory(engine.category as string) ?? engine.category;
        setResult({ ...engine, category: migrated });
      }
      setLoading(false);
    } else if (fortuneJob.status === 'failed') {
      setError(fortuneJob.errorMessage ?? '풀이 생성에 실패했어요. 크레딧은 자동 환불됐어요.');
      setLoading(false);
    } else {
      // pending/processing — 모래시계
      setLoading(true);
      // engine_result 가 있으면 결과 화면 진입 (택일 카테고리·picked days 등)
      const engine = fortuneJob.engineResult as unknown as TaekilResult | null;
      if (engine) {
        const migrated = migrateLegacyCategory(engine.category as string) ?? engine.category;
        setResult({ ...engine, category: migrated });
      }
    }
  }, [
    urlJobId,
    fortuneJob?.status,
    fortuneJob?.interpretationDetailed,
    fortuneJob?.errorMessage,
    fortuneJob?.engineResult,
  ]);

  useEffect(() => {
    if (user) fetchProfiles();
  }, [user, fetchProfiles]);

  // recordId 기반 record load
  useEffect(() => {
    if (!recordId) return;
    let cancelled = false;
    sajuDB.getRecordById(recordId)
      .then((record) => {
        if (cancelled) return;
        if (!record) {
          setError('결과를 찾을 수 없어요.');
          setLoading(false);
          return;
        }
        const engine = record.engine_result as unknown as TaekilResult | null;
        if (engine) {
          const migrated = migrateLegacyCategory(engine.category as string) ?? engine.category;
          setResult({ ...engine, category: migrated });
        }
        const content = record.interpretation_detailed ?? record.interpretation_basic ?? '';
        if (content) {
          setAiAdvice(content);
          setParsedAdvice(parseTaekilStructuredAdvice(content));
        }
        setProfileId(record.profile_id ?? null);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('[taekil-result] load failed', e);
        setError('결과 로드 중 오류가 발생했어요.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [recordId]);

  const targetProfile = useMemo(() => {
    if (!profileId) return null;
    return profiles.find(p => p.id === profileId) ?? null;
  }, [profiles, profileId]);

  // "다른 날짜로 다시 풀이받기" 라우팅용 — record.profile_id 가 비어 있어도
  // 대표(또는 첫) 프로필로 보강. profileId 없이 /saju/taekil 진입 시
  // needsProfileSelect=true 가 되어 QuickFortuneGate 모달이 떠버리는 사고 차단.
  const resolvedProfileId = useMemo(
    () => profileId ?? profiles.find(p => p.is_primary)?.id ?? profiles[0]?.id ?? null,
    [profileId, profiles],
  );

  const saju = useMemo(() => {
    if (!targetProfile) return null;
    return computeSajuFromProfile(targetProfile);
  }, [targetProfile]);

  const catLabel = useMemo(() => {
    if (!result) return '';
    return TAEKIL_CATEGORIES.find(c => c.id === result.category)?.label ?? '';
  }, [result]);

  // 점수순 정렬된 후보 날짜 목록
  const pickedDays = useMemo(() => {
    if (!result) return [];
    return [...result.days].sort((a, b) => b.score - a.score) as TaekilDay[];
  }, [result]);

  // ── 로딩/에러 ──
  // ?jobId 진행 중 잡 + ?recordId 보관함 조회 모두 AILoadingBar 로 통일.
  // TaekilPage 의 풀이 로딩과 같은 컴포넌트라 router.push 후에도 끊김 없이 이어짐.
  if (loading) {
    return (
      <AILoadingBar
        label="택일 운세 분석중"
        minLabel="20초"
        maxLabel="1분"
        estimatedSeconds={35}
        startedAt={fortuneJob?.startedAt ?? fallbackStartedAt}
        messages={[
          '선택한 날짜의 일진을 분석하는 중입니다',
          '사주 원국과의 합충을 짚는 중입니다',
          '흉신·길신을 검토하는 중입니다',
          '최적의 날짜를 가려내는 중입니다',
        ]}
      />
    );
  }

  if (error || !result || !aiAdvice) {
    return (
      <div className={styles.container}>
        <div className="flex items-center relative mb-5 pt-3 px-1">
          <BackButton className="absolute left-0" />
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>택일 운세</h1>
          </div>
        </div>
        <div className={styles.section} style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>{error ?? '결과를 표시할 수 없어요.'}</p>
          <button
            onClick={() => {
              const qs = resolvedProfileId ? `?profileId=${resolvedProfileId}&fresh=1` : "?fresh=1";
              router.push(`/saju/taekil${qs}`);
            }}
            style={{
              padding: '12px 28px', borderRadius: 12,
              background: 'var(--cta-primary)', color: 'white',
              border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >
            택일 다시하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <div className="flex items-center relative mb-5 pt-3 px-1">
        <BackButton className="absolute left-0" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>택일 운세</h1>
          {targetProfile && (
            <p className="text-[12px] text-text-tertiary mt-0.5">
              {targetProfile.name}{catLabel ? ` · ${catLabel}` : ''}
              {result.customLabel ? ` · ${result.customLabel}` : ''}
              {result.subItem ? ` · ${result.subItem}` : ''}
            </p>
          )}
        </div>
      </div>

      <div className={styles.content}>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {/* 선택한 후보 날짜 */}
          {pickedDays.length > 0 && (
            <div className={styles.section} style={{ paddingTop: 12, paddingBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                선택한 후보 날짜
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {pickedDays.map((d) => {
                  const dayNum = parseInt(d.date.split('-')[2]);
                  const mon = parseInt(d.date.split('-')[1]);
                  const dow = WEEKDAYS[new Date(d.date).getDay()];
                  return (
                    <div key={d.date} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px',
                      background: 'rgba(124,92,252,0.12)',
                      border: '1px solid rgba(124,92,252,0.3)',
                      borderRadius: 10,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {mon}/{dayNum}({dow})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 포디움 — Top 3 */}
          {pickedDays.length > 0 && (
            <div className={styles.section}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ display: 'inline-block', width: 4, height: 20, borderRadius: 2, background: '#34D399' }} />
                <h2 style={{ margin: 0, fontSize: 17, fontFamily: 'var(--font-title)' }}>
                  {catLabel} 추천 순위
                </h2>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, padding: '0 4px' }}>
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
                      <div key={d.date} style={{
                        flex: rank === 1 ? '1.2' : '1',
                        minHeight: h + 20, padding: '18px 8px 16px',
                        background: rank === 1
                          ? 'linear-gradient(180deg, rgba(255,215,0,0.15) 0%, rgba(124,92,252,0.12) 100%)'
                          : 'var(--space-elevated)',
                        border: rank === 1 ? '1.5px solid rgba(255,215,0,0.4)' : '1px solid var(--border-subtle)',
                        borderRadius: 16, textAlign: 'center',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        <span style={{ fontSize: rank === 1 ? 16 : 14, fontWeight: 800, color: rankColor[rank], letterSpacing: '0.05em' }}>
                          {rankBadge[rank]}
                        </span>
                        <span style={{ fontSize: rank === 1 ? 36 : 30, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                          {dayNum}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>{mon}월 ({dow})</span>
                        <span style={{
                          marginTop: 6, padding: '5px 12px', borderRadius: 99,
                          fontSize: 14, fontWeight: 700,
                          color: GRADE_COLOR[d.grade], background: GRADE_BG[d.grade],
                          border: `1px solid ${GRADE_COLOR[d.grade]}40`,
                        }}>
                          {d.grade} · {d.score}점
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* 점수 바 그래프 — 직관성 위해 폰트·바 높이 모두 키움 */}
              {pickedDays.length > 1 && (
                <div style={{ marginTop: 22 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {pickedDays.map((d) => (
                      <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, width: 60, color: 'var(--text-secondary)', flexShrink: 0 }}>
                          {d.date.slice(5).replace('-', '/')}
                        </span>
                        <div style={{
                          flex: 1, height: 26, borderRadius: 8,
                          background: 'rgba(255,255,255,0.05)',
                          position: 'relative', overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${d.score}%`, height: '100%',
                            background: GRADE_COLOR[d.grade], opacity: 0.85, borderRadius: 8,
                            transition: 'width 0.4s ease',
                          }} />
                          <span style={{
                            position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
                            fontSize: 14, fontWeight: 800, color: 'var(--text-primary)',
                            textShadow: '0 0 4px rgba(0,0,0,0.6)',
                          }}>
                            {d.score}
                          </span>
                        </div>
                        <span style={{
                          fontSize: 14, fontWeight: 800, width: 36, textAlign: 'right',
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
              <h2 style={{ margin: 0, fontSize: 17, fontFamily: 'var(--font-title)' }}>
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
                    const elEnergy = topDay?.elementEnergy;
                    const timeSlots = topDay?.timeSlots;
                    const peakSlots = timeSlots?.filter(t => t.energy >= 7) ?? [];
                    const maxTimeEnergy = timeSlots ? Math.max(...timeSlots.map(t => t.energy)) : 10;

                    return (
                      <div key={idx} style={{
                        padding: 16,
                        background: idx === 0
                          ? 'linear-gradient(135deg, rgba(255,215,0,0.08) 0%, rgba(20,12,38,0.55) 40%)'
                          : 'rgba(20,12,38,0.55)',
                        borderRadius: 14,
                        border: idx === 0 ? '1px solid rgba(255,215,0,0.25)' : '1px solid var(--border-subtle)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 28, height: 28, borderRadius: '50%',
                            background: `${rankColor}22`, border: `1.5px solid ${rankColor}`,
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
                              color: GRADE_COLOR[topDay.grade], background: GRADE_BG[topDay.grade],
                            }}>
                              {topDay.grade}
                            </span>
                          )}
                        </div>

                        {adv.keywords.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                            {adv.keywords.map((kw, ki) => (
                              <button
                                key={ki}
                                type="button"
                                onClick={() => setActiveKeyword(kw)}
                                style={{
                                  padding: '6px 14px', borderRadius: 99,
                                  fontSize: 13, fontWeight: 700, letterSpacing: '0.02em',
                                  color: 'var(--cta-primary)',
                                  background: 'rgba(124,92,252,0.12)',
                                  border: '1px solid rgba(124,92,252,0.25)',
                                  cursor: 'pointer',
                                  fontFamily: 'inherit',
                                }}
                                aria-label={`${kw.name} 설명 보기`}
                              >
                                {kw.name}
                              </button>
                            ))}
                          </div>
                        )}

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
                                    background: 'rgba(255,255,255,0.05)', overflow: 'hidden',
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

                        {/* 종합 / 조언 / 주의 — 새 3섹션 구조 (옛 record 는 summary 만 있을 수 있음) */}
                        {adv.summary && (
                          <div style={{ marginBottom: adv.advice || adv.caution ? 14 : 16 }}>
                            {/* 헤더 — "이렇게 하면 좋아요"·"주의할 점" 헤더와 동일 크기·웨이트 */}
                            <div style={{
                              fontSize: 17, fontWeight: 900,
                              color: 'var(--text-primary)',
                              letterSpacing: '-0.01em',
                              marginBottom: 12,
                              fontFamily: 'var(--font-title)',
                              lineHeight: 1.4,
                            }}>
                              종합
                            </div>
                            {/* 본문 — "이렇게 하면 좋아요" 본문과 동일 (SUIT 폰트·자간·크기·줄간격) */}
                            <p
                              className="text-text-secondary leading-[1.85] tracking-[-0.005em]"
                              style={{
                                fontSize: 17, margin: 0, whiteSpace: 'pre-line',
                                fontFamily: 'var(--font-body)',
                              }}
                            >
                              {adv.summary}
                            </p>
                          </div>
                        )}
                        {adv.advice && (
                          <div style={{
                            marginBottom: adv.caution ? 14 : 16,
                            padding: '20px 20px',
                            borderRadius: 14,
                            background: 'rgba(52,211,153,0.08)',
                            border: '1px solid rgba(52,211,153,0.28)',
                          }}>
                            <div style={{
                              fontSize: 17, fontWeight: 900,
                              color: '#34D399',
                              letterSpacing: '-0.01em',
                              marginBottom: 12,
                              fontFamily: 'var(--font-title)',
                              lineHeight: 1.4,
                            }}>
                              이렇게 하면 좋아요
                            </div>
                            {/* 줄글 대신 실천 항목별 문장 리스트 — 종합 본문과 역할 분리. */}
                            <SentenceList items={toBullets(adv.advice)} color="#34D399" />
                          </div>
                        )}
                        {adv.caution && (
                          <div style={{
                            marginBottom: 16,
                            padding: '20px 20px',
                            borderRadius: 14,
                            background: 'rgba(248,113,113,0.08)',
                            border: '1px solid rgba(248,113,113,0.28)',
                          }}>
                            <div style={{
                              fontSize: 17, fontWeight: 900,
                              color: '#F87171',
                              letterSpacing: '-0.01em',
                              marginBottom: 12,
                              fontFamily: 'var(--font-title)',
                              lineHeight: 1.4,
                            }}>
                              주의할 점
                            </div>
                            <SentenceList items={toBullets(adv.caution)} color="#F87171" />
                          </div>
                        )}

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
                                      width: '100%', maxWidth: 24, height: barH, borderRadius: 4,
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '0 2px' }}>
                              {timeSlots.map((slot) => {
                                const startHour = slot.hours.split('~')[0].slice(0, 2);
                                const isPeak = slot.energy >= 7;
                                return (
                                  <div key={slot.zhi} style={{
                                    flex: 1, textAlign: 'center',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                                  }}>
                                    <span style={{
                                      fontSize: 14, fontWeight: isPeak ? 800 : 600,
                                      color: isPeak ? '#34D399' : 'var(--text-secondary)',
                                      letterSpacing: '-0.01em', lineHeight: 1.1,
                                    }}>{slot.zhi}</span>
                                    <span style={{
                                      fontSize: 9.5, fontWeight: 500,
                                      color: isPeak ? 'rgba(52,211,153,0.75)' : 'var(--text-tertiary)',
                                      lineHeight: 1, letterSpacing: '-0.02em',
                                    }}>{startHour}</span>
                                  </div>
                                );
                              })}
                            </div>
                            {peakSlots.length > 0 && (
                              <div style={{
                                marginTop: 12, paddingTop: 10,
                                borderTop: '1px solid rgba(255,255,255,0.06)',
                                fontSize: 12.5, color: 'var(--text-tertiary)',
                                lineHeight: 1.5, textAlign: 'center',
                              }}>
                                <span style={{ color: '#34D399', fontWeight: 700 }}>녹색 시간대</span>
                                가 에너지가 강한 구간이에요
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* 종합 분석 — 본인 사주 + 카테고리 + detail 을 엮은 커스텀 분석.
                      날짜별 상세 풀이(1·2·3위 카드들) 다음 위치 — 사용자 동선에 맞춤 (2026-05-19).
                      ★ defaultOpen=true — 1순위 정보라 펼쳐서 시작. */}
                  {parsedAdvice?.comprehensiveAnalysis ? (
                    <div className="mt-3">
                      <SectionCollapsible
                        title="종합 분석"
                        defaultOpen={true}
                        enterDelay={0.05}
                      >
                        {renderTaekilSectionVisual('comprehensive', result, pickedDays)}
                        <p
                          className="text-text-secondary leading-[1.9] tracking-[-0.005em] whitespace-pre-line"
                          style={{
                            fontSize: 17, margin: 0,
                            fontFamily: 'var(--font-body)',
                          }}
                        >
                          {renderEmphasis(parsedAdvice.comprehensiveAnalysis)}
                        </p>
                      </SectionCollapsible>
                    </div>
                  ) : parsedAdvice && parsedAdvice.dates.length > 0 && (
                    // 옛 record (종합 분석 마커 추가 전 풀이) — 다시 받기 안내 카드
                    <div className="mt-3">
                      <div style={{
                        padding: '18px 20px',
                        borderRadius: 14,
                        background: 'rgba(124,92,252,0.08)',
                        border: '1px solid rgba(124,92,252,0.25)',
                      }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--cta-primary)', marginBottom: 6 }}>
                          종합 분석은 다시 풀이 받으면 추가돼요
                        </div>
                        <p style={{
                          margin: 0, fontSize: 14, lineHeight: 1.7,
                          color: 'var(--text-secondary)',
                          fontFamily: 'var(--font-body)',
                        }}>
                          이 풀이는 종합 분석 기능 추가 전에 받으셨어요. 같은 사주·날짜로 다시 풀이 받으시면 본인 사주와 택일 내용을 엮은 맞춤 종합 분석이 추가돼요.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 피해야 할 날 — SectionCollapsible 패턴, 빨강 톤 유지 */}
                  {parsedAdvice.avoid && (
                    <div className="mt-3">
                      <SectionCollapsible
                        title="피해야 할 날"
                        defaultOpen={false}
                        enterDelay={0.1}
                        barColor="#F87171"
                        barPulseColor="#FCA5A5"
                        borderColor="rgba(248,113,113,0.30)"
                      >
                        {renderTaekilSectionVisual('avoid', result, pickedDays)}
                        <p
                          className="text-text-secondary leading-[1.85] tracking-[-0.005em] whitespace-pre-line"
                          style={{ fontSize: 17, margin: 0, fontFamily: 'var(--font-body)' }}
                        >
                          {renderEmphasis(parsedAdvice.avoid)}
                        </p>
                      </SectionCollapsible>
                    </div>
                  )}

                  {/* "OO에 대한 조언" — SectionCollapsible 패턴, cta 톤 */}
                  {parsedAdvice.overallAdvice && (() => {
                    const eventLabel = result?.subItem ?? result?.customLabel ?? result?.categoryLabel ?? '';
                    return (
                      <div className="mt-3">
                        <SectionCollapsible
                          title={eventLabel ? `${eventLabel}에 대한 조언` : '이 일에 대한 조언'}
                          defaultOpen={false}
                          enterDelay={0.15}
                        >
                          {renderTaekilSectionVisual('overall', result, pickedDays)}
                          <p
                            className="text-text-secondary leading-[1.85] tracking-[-0.005em] whitespace-pre-line"
                            style={{ fontSize: 17, margin: 0, fontFamily: 'var(--font-body)' }}
                          >
                            {renderEmphasis(parsedAdvice.overallAdvice)}
                          </p>
                        </SectionCollapsible>
                      </div>
                    );
                  })()}

                  {/* "추천 대체 방법" — SectionCollapsible 패턴, cta 톤 */}
                  {parsedAdvice.alternative && (
                    <div className="mt-3">
                      <SectionCollapsible
                        title="추천 대체 방법"
                        defaultOpen={false}
                        enterDelay={0.2}
                      >
                        {renderTaekilSectionVisual('alternative', result, pickedDays)}
                        {/* "첫째로 …", "둘째로 …", "셋째로 …" 패턴으로 split 해서 문단 분리.
                            split 안 되면 (LLM이 다른 형식으로 출력) 단일 paragraph fallback. */}
                        {(() => {
                          const parts = parsedAdvice.alternative
                            .split(/(?=첫째로|둘째로|셋째로)/g)
                            .map(p => p.trim())
                            .filter(Boolean);
                          if (parts.length < 2) {
                            return (
                              <p
                                className="text-text-secondary leading-[1.85] tracking-[-0.005em] whitespace-pre-line"
                                style={{ fontSize: 17, margin: 0, fontFamily: 'var(--font-body)' }}
                              >
                                {renderEmphasis(parsedAdvice.alternative)}
                              </p>
                            );
                          }
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                              {parts.map((para, i) => (
                                <p
                                  key={i}
                                  className="text-text-secondary leading-[1.85] tracking-[-0.005em] whitespace-pre-line"
                                  style={{ fontSize: 17, margin: 0, fontFamily: 'var(--font-body)' }}
                                >
                                  {renderEmphasis(para)}
                                </p>
                              ))}
                            </div>
                          );
                        })()}
                      </SectionCollapsible>
                    </div>
                  )}
                </>
              ) : (
                // dates.length === 0 fallback — AI가 표준 마커를 한 개도 출력하지 않은 경우.
                // 본문은 보존하되 사용자에게 명확히 "응답 형식 이상" 안내 + 다시 풀이 받기 유도.
                <div>
                  <div style={{
                    padding: '18px 20px',
                    borderRadius: 14,
                    background: 'rgba(248,113,113,0.06)',
                    border: '1px solid rgba(248,113,113,0.22)',
                    marginBottom: 12,
                  }}>
                    <div style={{
                      fontSize: 15, fontWeight: 800, color: '#F87171',
                      marginBottom: 8, letterSpacing: '-0.01em',
                    }}>
                      AI 응답 형식이 일시적으로 어긋났어요
                    </div>
                    <p style={{
                      margin: 0, fontSize: 14, lineHeight: 1.7,
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-body)',
                    }}>
                      카드 분할이 적용되지 않은 본문이 아래에 표시돼요. 같은 사주·날짜로 다시 풀이 받으시면 정상 카드 형식으로 보입니다.
                      반복되면 문의하기로 알려주세요.
                    </p>
                    <button
                      onClick={() => {
                        const qs = resolvedProfileId ? `?profileId=${resolvedProfileId}&fresh=1` : "?fresh=1";
                        router.push(`/saju/taekil${qs}`);
                      }}
                      style={{
                        marginTop: 12, padding: '10px 16px', borderRadius: 10,
                        background: 'var(--cta-primary)', color: '#fff',
                        border: 'none', fontWeight: 700, fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      다시 풀이 받기
                    </button>
                  </div>
                  <div style={{
                    padding: 16,
                    background: 'rgba(20,12,38,0.55)',
                    borderRadius: 14,
                    border: '1px solid var(--border-subtle)',
                    fontSize: 15,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.85,
                    whiteSpace: 'pre-line',
                    fontFamily: 'var(--font-body)',
                    letterSpacing: '0.02em',
                  }}>
                    {extractMetaphor(aiAdvice.replace(/^\s*\[(?:top\d|avoid|comprehensive_analysis|overall_advice|alternative)\].*$/gm, '')).bodyText}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* 공유 — 카카오톡 + URL 복사 */}
      {recordId && (
        <div style={{ marginTop: 24, padding: '0 4px' }}>
          <ShareBar recordId={recordId} type="saju" category="taekil" />
        </div>
      )}

      <div style={{ marginBottom: 32, padding: '0 4px' }}>
        <ResultFooterActions
          redo={{
            label: '다른 날짜로 다시 풀이받기',
            onClick: () => {
              const qs = resolvedProfileId ? `?profileId=${resolvedProfileId}&fresh=1` : '?fresh=1';
              router.push(`/saju/taekil${qs}`);
            },
          }}
        />
      </div>
      {/* saju ref 살림 — TS unused 방지: 향후 confirm 모달/디버그용 */}
      {!saju && null}

      {/* 키워드 설명 모달 — 칩 클릭 시 열림. AI 응답의 desc 가 비어 있으면 fallback 안내. */}
      <AnimatePresence>
        {activeKeyword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setActiveKeyword(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(8,4,20,0.65)',
              backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20,
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 420,
                padding: 24,
                borderRadius: 20,
                background: 'rgba(20,12,38,0.95)',
                border: '1px solid var(--cta-primary)',
                boxShadow: '0 20px 60px rgba(124,92,252,0.35)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{
                  display: 'inline-block', width: 4, height: 22, borderRadius: 2,
                  background: 'var(--cta-primary)',
                }} />
                <h3 style={{
                  margin: 0, fontSize: 20, fontWeight: 800,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-title)',
                }}>
                  {activeKeyword.name}
                </h3>
              </div>
              <p
                className="leading-[1.9]"
                style={{
                  margin: 0, fontSize: 17,
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-body)',
                  whiteSpace: 'pre-line',
                }}
              >
                {activeKeyword.desc || '이 키워드는 그 날의 명리적 핵심을 함축한 표현이에요. 상세 풀이는 위 종합/조언 본문에서 확인하실 수 있어요.'}
              </p>
              <button
                type="button"
                onClick={() => setActiveKeyword(null)}
                style={{
                  width: '100%', marginTop: 18,
                  padding: '12px', borderRadius: 12,
                  background: 'var(--cta-primary)',
                  border: 'none',
                  color: 'white',
                  fontSize: 15, fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
