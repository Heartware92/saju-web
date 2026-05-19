'use client';

/**
 * 더 많은 운세 — 공통 페이지 컴포넌트
 * 9개 카테고리를 단일 페이지에서 처리:
 *  1. 소개 카드(긴 설명)
 *  2. 대표 프로필 요약
 *  3. 풀이 보기 버튼 (달 크레딧 1 소모)
 *  4. 버튼 클릭 시 로딩 → 결과 표시
 *
 * 이름 풀이는 name 입력 폼이 추가로 노출됨.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';
import { useCreditStore } from '../store/useCreditStore';
import { useReportCacheStore, sajuKey } from '../store/useReportCacheStore';
import { computeSajuFromProfile } from '../utils/profileSaju';
import { extractMetaphor } from '../utils/parseMetaphor';
import {
  MORE_FORTUNE_CONFIGS,
  MOON_COST_PER_FORTUNE,
  isLegacyMoreCategory,
  LEGACY_MORE_LABELS,
  type LegacyMoreCategory,
  type MoreFortuneId,
} from '../constants/moreFortunes';
import {
  // [B안] love/wealth/career/health/people 비활성 — 메인 8 중복. 복원 시 import 같이 풀기.
  // getLoveShort, getWealthShort, getCareerShort, getHealthShort, getPeopleShort,
  getStudyShort,
  getChildrenShort,
  getPersonalityShort,
  getNameFortune,
  getDreamInterpretation,
  parseStudySections,
  parseChildrenSections,
  parsePersonalitySections,
  parseNameSections,
  parseDreamSections,
  parseDreamSymbols,
  parseDreamAction,
} from '../services/fortuneService';
import { sajuDB } from '../services/supabase';
import { findRecentArchive, type ArchiveCategory } from '../services/archiveService';
import { RestoreReportModal } from '../components/RestoreReportModal';
import { QuickFortuneGate } from '../components/QuickFortuneGate';
import { MOON_COST_PER_FORTUNE as MOON_COST_SELECT } from '../constants/moreFortunes';
import { analyzeKoreanName } from '../utils/nameEumRyeong';
import { AILoadingBar } from '../components/AILoadingBar';
import { DreamInputPanel } from '../components/dream/DreamInputPanel';
import { BackButton } from '../components/ui/BackButton';
import { useLoadingGuard } from '../hooks/useLoadingGuard';
import { useScrollToTopOnLoad } from '../hooks/useScrollToTopOnLoad';
import styles from './SajuResultPage.module.css';
import { ShareBar } from '@/components/share/ShareBar';
import {
  STUDY_SECTION_KEYS, STUDY_SECTION_LABELS,
  CHILDREN_SECTION_KEYS, CHILDREN_SECTION_LABELS,
  PERSONALITY_SECTION_KEYS, PERSONALITY_SECTION_LABELS,
  NAME_SECTION_KEYS, NAME_SECTION_LABELS,
} from '../constants/prompts';
import { SectionCollapsible } from '@/components/saju/SectionCollapsible';
import { renderEmphasis } from '@/utils/renderEmphasis';
import { HanjaPickerModal } from '@/components/saju/HanjaPickerModal';
import type { HanjaCandidate } from '@/lib/data/hanjaByKoreanSound';
import {
  EumRyeongVisual,
  JaWonVisual,
  HarmonyVisual,
  NumerologyVisual,
  AdviceVisual,
  resolveHanjasForVisual,
  extractBullets,
} from '@/components/saju/NameSectionVisuals';

interface Props {
  /** 카테고리 id. /saju/more/[category] 동적 라우트에서 주입된다. */
  category?: MoreFortuneId;
}

// [B안] love/wealth/career/health/people 메시지는 주석 보존. 복원 시 함께 풀기.
const LOADING_MESSAGES: Record<MoreFortuneId, string[]> = {
  // love:        ['일지 배우자궁을 살피는 중입니다', '재성·관성 배치를 읽는 중입니다', '올해 연애운 월별 흐름 분석 중입니다'],
  // wealth:      ['재성·재고를 확인하는 중입니다', '식상 흐름으로 재물 구조 분석 중입니다', '올해 돈의 흐름을 짚는 중입니다'],
  // career:      ['격국과 관성·식상을 분석 중입니다', '적합한 직군을 도출하는 중입니다', '올해 커리어 시기 살피는 중입니다'],
  // health:      ['약한 오행과 취약 장부를 보는 중입니다', '충·형 구조를 확인하는 중입니다', '올해 주의할 달을 짚는 중입니다'],
  // people:      ['천을귀인과 인성을 살피는 중입니다', '비겁 배치로 관계 스타일 분석 중입니다', '올해 도움될 사람 유형 도출 중입니다'],
  study:       ['인성·문창귀인 확인 중입니다', '격국과 십성 분포 분석 중입니다', '대운·세운으로 유리한 시험 시기 도출 중입니다', '공부 전략을 정리하는 중입니다'],
  children:    ['자녀성과 자녀궁을 확인 중입니다', '시주 지장간과 12운성 분석 중입니다', '대운·세운으로 출산 유리 시기 도출 중입니다', '양육 조언을 정리하는 중입니다'],
  personality: ['일주 60갑자 특성 확인 중입니다', '격국·성패와 십성 에너지 종합 중입니다', '간여지동·병존과 신살 분석 중입니다', '12운성 라이프사이클 판독 중입니다', '대운 흐름으로 성격 변화 궤적 도출 중입니다'],
  name:        ['초성 오행을 계산 중입니다', '사주 용신과 이름 오행 비교 중입니다', '이름이 주는 기운을 분석 중입니다'],
  dream:       ['전통 해몽 사전을 펼치는 중입니다', '꿈속 상징의 길흉을 가늠하는 중입니다', '맥락과 감정으로 의미를 다듬는 중입니다'],
};

export default function MoreFortunePage({ category }: Props) {
  // ── 모든 Hooks는 무조건 상단에 호출 (React Hooks 규칙) ──
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = searchParams?.get('profileId') ?? null;
  const recordId = searchParams?.get('recordId') ?? null;
  const isArchiveMode = !!recordId;

  const { user } = useUserStore();
  const { profiles, fetchProfiles } = useProfileStore();
  const { moonBalance, chargeForContent, fetchBalance } = useCreditStore();

  const isValidCategory = !!category && (category in MORE_FORTUNE_CONFIGS);
  const cfg = isValidCategory ? MORE_FORTUNE_CONFIGS[category as MoreFortuneId] : null;
  const isLegacy = !!category && isLegacyMoreCategory(category);

  const needsProfileSelect = !profileId && !isArchiveMode && !cfg?.needsNameInput && !cfg?.needsDreamInput;

  const targetProfile = useMemo(() => {
    if (profileId) return profiles.find(p => p.id === profileId) ?? null;
    if (needsProfileSelect) return null;
    return profiles.find((p) => p.is_primary) ?? profiles[0] ?? null;
  }, [profiles, profileId, needsProfileSelect]);

  const saju = useMemo(() => {
    if (!targetProfile) return null;
    return computeSajuFromProfile(targetProfile);
  }, [targetProfile]);

  // 이름 풀이 전용 state
  // koreanName: 한글 이름 (성씨 포함, 4글자 이내 권장)
  // charMeanings: 글자별 뜻 (한자 추정용). 인덱스가 한글 이름 글자 순서와 1:1 매칭.
  //               비워두면 순우리말 또는 모름으로 처리되어 음령오행만 적용.
  const [koreanName, setKoreanName] = useState('');
  const [charMeanings, setCharMeanings] = useState<string[]>([]);
  /** 사용자가 모달에서 선택한 한자 (글자 위치별). null = 미선택. 선택 시 charMeanings 자동 채움 */
  const [selectedHanjas, setSelectedHanjas] = useState<(string | null)[]>([]);

  /** 이름 풀이 시각 컴포넌트들의 context — analyzeKoreanName + selectedHanjas + saju 로 빌드 */
  const nameVisualContext = useMemo(() => {
    if (category !== 'name') return null;
    const kor = analyzeKoreanName(koreanName);
    const hanjaName = selectedHanjas.filter(Boolean).join('');
    const completeHanja = hanjaName.length === kor.chars.length && kor.chars.length > 0;
    const charMeaningsArr = kor.chars.map((_, i) => ({ sound: kor.chars[i], meaning: charMeanings[i] ?? '' }));
    const hanjas = completeHanja ? resolveHanjasForVisual(hanjaName, charMeaningsArr) : [];
    return {
      chars: kor.chars,
      elements: kor.elements,
      sounds: kor.chars, // 한국 음 = 한글 음절
      hanjas, // 한자 모드일 때만 채워짐
      yongSinEl: saju?.yongSinElement ?? '',
      giSinEl: (() => {
        if (!saju) return '';
        const g = saju.giSin || '';
        const dayEl = saju.dayMasterElement;
        const EL_GEN: Record<string, string> = { '목': '화', '화': '토', '토': '금', '금': '수', '수': '목' };
        const EL_CON: Record<string, string> = { '목': '토', '화': '금', '토': '수', '금': '목', '수': '화' };
        const EL_PAR: Record<string, string> = { '목': '수', '화': '목', '토': '화', '금': '토', '수': '금' };
        const EL_BY:  Record<string, string> = { '목': '금', '화': '수', '토': '목', '금': '화', '수': '토' };
        if (g.includes('식신') || g.includes('상관')) return EL_GEN[dayEl] ?? '';
        if (g.includes('편재') || g.includes('정재')) return EL_CON[dayEl] ?? '';
        if (g.includes('편관') || g.includes('정관')) return EL_BY[dayEl] ?? '';
        if (g.includes('편인') || g.includes('정인')) return EL_PAR[dayEl] ?? '';
        if (g.includes('비견') || g.includes('겁재')) return dayEl;
        return '';
      })(),
      jawonElements: hanjas.map(h => h.jawon).filter(Boolean),
    };
  // saju 객체 자체가 매 렌더 새로 생기더라도 핵심 필드만 보고 stale 회피
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, koreanName, charMeanings, selectedHanjas, saju?.yongSinElement, saju?.giSin, saju?.dayMasterElement]);

  // 꿈 해몽 전용 state — DreamInputPanel에서 onChange로 주입되는 합성 텍스트/유효성
  // dreamInputResetKey: "다른 꿈 풀이받기" 클릭 시 패널을 강제 remount 해 내부 상태(선명/흐릿 모드, 칩 선택 등)를 초기화
  const [dreamText, setDreamText] = useState('');
  const [dreamValid, setDreamValid] = useState(false);
  const [dreamInputResetKey, setDreamInputResetKey] = useState(0);

  // 결과 state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  // 섹션 마커 기반 파싱 결과 (학업·자녀·성격에서 사용)
  const [resultSections, setResultSections] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);

  // 결과 준비 완료 시 스크롤 최상단
  useScrollToTopOnLoad(!!result && !loading);

  // 학업/자녀/성격: fresh=1 진입 시 소개 페이지 건너뛰고 바로 풀이 시작
  // manualMode: "다시 풀이 받기" 클릭 시 true → 소개+CTA 페이지로 복귀
  const autoStartedRef = useRef(false);
  const [manualMode, setManualMode] = useState(false);
  const freshParam = searchParams?.get('fresh') === '1';
  // handleRead 의 stale closure 회피 — handleRefetch 같은 외부 콜백에서
  // 항상 최신 handleRead 를 호출하도록 ref 동기화
  const handleReadRef = useRef<((force?: boolean) => Promise<void>) | null>(null);
  // SajuResultPage 패턴: refetchNonce 증가 → useEffect 가 force AI 호출 트리거
  const [refetchNonce, setRefetchNonce] = useState(0);
  // ★ name 은 한자 선택이 사용자 입력 필수 → autoStart 제외. fresh URL 진입해도
  //   입력 화면을 다시 거쳐 한자를 새로 선택할 수 있게 한다.
  const shouldAutoStart = freshParam && !isArchiveMode && !manualMode &&
    (category === 'study' || category === 'children' || category === 'personality');

  // ── 로딩 안전장치: 70초 초과 시 강제 해제 ──
  const [loadingTimedOut] = useLoadingGuard(loading, 70_000);
  useEffect(() => {
    if (loadingTimedOut) {
      setLoading(false);
      if (!result) setError('응답이 너무 오래 걸려요. 새로고침 후 다시 시도해주세요.');
    }
  }, [loadingTimedOut, result]);

  const [cacheGate, setCacheGate] = useState<{ kind: 'today' | 'jungtong' | 'zamidusu' | 'tojeong' | 'newyear' | 'period_date' | 'period_day' | 'taekil' | 'gunghap' | 'tarot' | `more:${string}`; key: string; restore: () => void } | null>(null);
  const handleUseCached = () => { cacheGate?.restore(); setCacheGate(null); };
  const handleRefetch = () => {
    // ★★★ 최후 수단: in-page refetch 가 사용자 환경에서 작동 안 하는 사고가
    //   반복되어, localStorage 정리 + 페이지 강제 새로 로드 (브라우저 캐시
    //   회피용 timestamp 포함) 로 무조건 새 풀이가 시작되도록 보장.
    //
    // 흐름:
    //   1. zustand store 메모리 캐시 invalidate
    //   2. localStorage 'report-cache' 에서 'more:${category}::' 접두 키 삭제
    //   3. URL fresh=1 + _t=timestamp + recordId 제거
    //   4. window.location.href 로 페이지 강제 새로 로드
    if (category) {
      useReportCacheStore.getState().invalidate(`more:${category}` as const);
    }
    if (typeof window !== 'undefined') {
      // localStorage 직접 정리 — persist 비동기 저장 race 차단
      try {
        const raw = window.localStorage.getItem('report-cache');
        if (raw && category) {
          const parsed = JSON.parse(raw);
          if (parsed?.state?.entries) {
            const prefix = `more:${category}::`;
            for (const key of Object.keys(parsed.state.entries)) {
              if (key.startsWith(prefix)) delete parsed.state.entries[key];
            }
            window.localStorage.setItem('report-cache', JSON.stringify(parsed));
          }
        }
      } catch { /* ignore */ }
      // 페이지 강제 새로 로드 — fresh=1 + timestamp (브라우저 캐시 회피)
      const params = new URLSearchParams(window.location.search);
      params.set('fresh', '1');
      params.set('_t', String(Date.now()));
      params.delete('recordId');
      window.location.href = `${window.location.pathname}?${params.toString()}`;
    }
  };

  // 보관함 재생 메타 (원본 기록 시각 표시용)
  const [archivedAt, setArchivedAt] = useState<string | null>(null);

  // 잘못된 카테고리 → 홈.
  // 비활성(legacy) 카테고리는 isArchiveMode 일 때만 허용 — 정상 진입(?recordId 없음)이면 홈으로.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isLegacy) {
      if (!isArchiveMode) router.replace('/');
      return;
    }
    if (!isValidCategory) {
      router.replace('/');
    }
  }, [isValidCategory, isLegacy, isArchiveMode, router]);

  useEffect(() => {
    if (user) {
      fetchProfiles();
      fetchBalance();
    }
  }, [user, fetchProfiles, fetchBalance]);

  // 이름 풀이: 사용자가 직접 입력 — 대표 프로필 이름을 자동 채우지 않는다.
  // (자녀·부모·친구 등 프로필이 아닌 사람의 이름도 풀이 가능해야 함)

  // ── 보관함 재생 모드 — recordId 쿼리가 있으면 저장된 기록으로 state 복원 ──
  useEffect(() => {
    if (!recordId) return;
    let cancelled = false;
    sajuDB.getRecordById(recordId)
      .then((record) => {
        if (cancelled) return;
        if (!record) {
          setError('기록을 불러오지 못했어요. 삭제되었거나 권한이 없는 기록일 수 있어요.');
          return;
        }
        // 저장된 interpretation 을 결과로 바로 주입 (AI 호출 없이)
        const content = record.interpretation_detailed ?? record.interpretation_basic ?? '';
        setResult(content);
        // 학업·자녀·성격이면 섹션 마커 파싱 (정규화 일관성 위해 fortuneService 의 파서 재사용)
        if (record.category === 'study') {
          const out = parseStudySections(content) as Record<string, string>;
          setResultSections(Object.keys(out).length > 0 ? out : null);
        } else if (record.category === 'children') {
          const out = parseChildrenSections(content) as Record<string, string>;
          setResultSections(Object.keys(out).length > 0 ? out : null);
        } else if (record.category === 'personality') {
          const out = parsePersonalitySections(content) as Record<string, string>;
          setResultSections(Object.keys(out).length > 0 ? out : null);
        } else if (record.category === 'name') {
          const out = parseNameSections(content) as Record<string, string>;
          setResultSections(Object.keys(out).length > 0 ? out : null);
        } else if (record.category === 'dream') {
          // 옛 record (v1: 마커 없는 단일 본문 / v2: oriental+western 2섹션) 는 fallback 으로 일부만 채워짐.
          // 5섹션 중 하나라도 있으면 렌더 분기 통과.
          const out = parseDreamSections(content);
          const hasAny = out.diagnosis || out.symbols || out.oriental || out.western || out.advice || out.caution;
          setResultSections(hasAny ? out as Record<string, string> : null);
        } else {
          setResultSections(null);
        }
        setArchivedAt(record.created_at);
        // 이름 풀이면 저장된 한글 이름 + 글자별 뜻 복원 (읽기 전용으로 표시)
        if (record.category === 'name' && record.engine_result) {
          const eng = record.engine_result as {
            koreanName?: string;
            charMeanings?: { sound?: string; meaning?: string }[];
            hanjaName?: string;
          };
          if (typeof eng.koreanName === 'string') setKoreanName(eng.koreanName);
          if (Array.isArray(eng.charMeanings)) {
            setCharMeanings(eng.charMeanings.map((c) => (typeof c?.meaning === 'string' ? c.meaning : '')));
          }
          // 옛 record 호환: hanjaName 이 있으면 글자 단위로 분해해 selectedHanjas 복원
          if (typeof eng.hanjaName === 'string' && eng.hanjaName.length > 0) {
            setSelectedHanjas([...eng.hanjaName]);
          }
        }
        // 꿈 해몽이면 저장된 꿈 텍스트 복원
        if (record.category === 'dream' && record.engine_result) {
          const eng = record.engine_result as { dreamText?: string };
          if (typeof eng.dreamText === 'string') setDreamText(eng.dreamText);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('[archive replay] load failed', e);
        setError('보관된 풀이를 불러오는 중 오류가 발생했어요.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [recordId]);

  // ── 보관함 DB 확인 — 이전에 본 풀이가 있으면 모달 표시 ──
  // ★ 메모리 캐시(localStorage) 가 살아있으면 모달 띄우지 않음.
  //   reload 후에도 사용자는 자기가 마지막에 본 결과를 그대로 봄.
  useEffect(() => {
    if (isArchiveMode || !targetProfile || !category) return;
    if (isLegacy) return;
    if (searchParams?.get('fresh') === '1') return;

    // 카테고리가 saju 의존인 경우만 캐시 검사 (dream 은 텍스트 기반이라 별도)
    if (saju && category !== 'dream') {
      const sk = sajuKey(saju);
      // name 등 입력 의존 카테고리는 입력값 미정 시 단순 sk 만으로도 시도
      const guessKey = category === 'name' ? null : sk;
      if (guessKey) {
        const cached = useReportCacheStore.getState().getReport<string>(`more:${category}` as const, guessKey);
        if (cached?.data) return; // silent — useEffect 303 가 setResult 처리
      }
    }

    let cancelled = false;
    findRecentArchive({
      category: category as ArchiveCategory,
      birth_date: targetProfile.birth_date,
      gender: targetProfile.gender,
      profile_id: targetProfile.id,
    }).then(found => {
      if (cancelled || !found) return;
      setSavedRecordId(found.id);
      setCacheGate({
        kind: `more:${category}` as const,
        key: '',
        restore: () => {
          const params = new URLSearchParams(window.location.search);
          params.set('recordId', found.id);
          router.replace(`${window.location.pathname}?${params.toString()}`);
        },
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [category, targetProfile, isArchiveMode, isLegacy, router, saju]);

  // [B안] cfg 가 없는데 legacy + archive 모드면 보관함 재생 전용 fallback 화면 렌더.
  // 그 외 (legacy + 정상 진입 / 잘못된 카테고리) 는 위 useEffect 가 홈으로 redirect.
  if (!cfg && isLegacy && isArchiveMode) {
    const legacyLabel = LEGACY_MORE_LABELS[category as LegacyMoreCategory];
    return (
      <div className={styles.container}>
        <div className="flex items-center relative mb-5 pt-3 px-1">
          <BackButton className="absolute left-0" />
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>{legacyLabel}</h1>
            <p className="text-base text-text-tertiary mt-1">보관된 풀이</p>
          </div>
        </div>
        <div className={styles.content}>
          <div
            className={styles.section}
            style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.35)' }}
          >
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              이 카테고리는 메인 풀이(신년운세·정통사주·자미두수)와 중복이라 신규 풀이는 종료됐어요.
              아래는 이전에 받으신 풀이 기록입니다.
            </p>
          </div>
          {loading && <p className={styles.loading}>불러오는 중…</p>}
          {error && <p style={{ color: 'var(--fire-core)' }}>{error}</p>}
          {result && (
            <div className={styles.section}>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                {result}
              </pre>
              {archivedAt && (
                <p className={styles.dateInfo} style={{ marginTop: 12 }}>
                  저장 시각: {new Date(archivedAt).toLocaleString('ko-KR')}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 모든 Hooks 이후 guard: 유효하지 않은 카테고리면 렌더 중단
  if (!cfg) return null;

  const canSubmit = useMemo(() => {
    // 꿈 해몽은 사주 원국을 쓰지 않는다 — 프로필 없어도 DreamInputPanel 입력만으로 가능
    if (category === 'dream') return dreamValid;
    if (!saju) return false;
    if (category === 'name') {
      return koreanName.trim().length >= 1;
    }
    return true;
  }, [saju, category, koreanName, dreamValid]);

  // 캐시 키 — 카테고리별로 식별자가 다름
  const buildCacheKey = (): string | null => {
    if (!category) return null;
    if (category === 'dream') {
      const t = dreamText.trim();
      if (!t) return null;
      // v4: 6섹션 ([action] → [advice]+[caution] 분리) prompt. 옛 캐시(v3, 5섹션) 자동 무효화.
      return `dream:v4:${t}`;
    }
    if (!saju) return null;
    const sk = sajuKey(saju);
    if (category === 'name') {
      const meaningsKey = charMeanings.map((m) => (m || '').trim()).join('|');
      // 한자 선택값이 다르면 다른 풀이로 인식해야 함 — 같은 뜻이라도 한자 다르면 자원오행 다름
      const hanjasKey = selectedHanjas.map((h) => h ?? '').join('|');
      // v2: prefix — 6 섹션 마커 prompt 적용 후 옛 단일 본문 캐시 자동 무효화
      // 81 수리 4격 도입·섹션 분리 후 prompt 출력 형식이 완전히 바뀌어, 옛 캐시는
      // 사용 안 함. 이 prefix 만으로 새 풀이가 강제됨.
      return `v2:${sk}:${koreanName.trim()}|${meaningsKey}|${hanjasKey}`;
    }
    return sk;
  };

  // 카테고리/입력 바뀔 때 캐시 silent restore — 탭 이동·새로고침 후 다시 와도 재호출 X
  // ★ fresh=1 URL 진입 (모달 "새로 풀이받기" 클릭 후) 에선 캐시 복원 완전 차단:
  //   기존엔 fresh=1 이어도 silent restore 가 메모리·persist 캐시 hit 으로 setResult 를
  //   호출해, auto-start useEffect 가 result 있으니 skip → AI 호출이 안 일어나
  //   이전 결과가 그대로 표시되는 사고가 있었음. 사용자 신고 "A 시나리오 만 발생" 의 원인.
  // ★ fresh URL 진입 시 name 입력 강제 리셋 — 별도 useEffect 로 분리해 입력 state 변경에
  //   다시 발동되는 무한 리셋 루프 차단. deps 는 freshParam/category/isArchiveMode 만.
  //   mount 또는 이 3개 변경 시 1회만 발동.
  const nameResetDoneRef = useRef(false);
  useEffect(() => {
    if (!freshParam || isArchiveMode || category !== 'name') return;
    if (nameResetDoneRef.current) return;
    nameResetDoneRef.current = true;
    setKoreanName('');
    setCharMeanings([]);
    setSelectedHanjas([]);
    setManualMode(true);
  }, [freshParam, category, isArchiveMode]);

  useEffect(() => {
    if (isArchiveMode) return;
    if (cacheGate) return;
    if (freshParam) {
      // fresh=1 진입 — 캐시 무시하고 result/sections 비워둠 → auto-start useEffect 가 새 AI 호출 트리거
      setResult(null);
      setResultSections(null);
      return;
    }
    const cacheKey = buildCacheKey();
    const kindKey = category ? (`more:${category}` as const) : null;
    if (cacheKey && kindKey) {
      const cached = useReportCacheStore.getState().getReport<string>(kindKey, cacheKey);
      if (cached?.data) {
        setResult(cached.data);
        // 캐시 복원 시 학업·자녀·성격이면 섹션 재파싱 (정규화 일관성 — fortuneService 파서 재사용)
        if (category === 'study') {
          const out = parseStudySections(cached.data) as Record<string, string>;
          setResultSections(Object.keys(out).length > 0 ? out : null);
        } else if (category === 'children') {
          const out = parseChildrenSections(cached.data) as Record<string, string>;
          setResultSections(Object.keys(out).length > 0 ? out : null);
        } else if (category === 'personality') {
          const out = parsePersonalitySections(cached.data) as Record<string, string>;
          setResultSections(Object.keys(out).length > 0 ? out : null);
        } else if (category === 'name') {
          const out = parseNameSections(cached.data) as Record<string, string>;
          setResultSections(Object.keys(out).length > 0 ? out : null);
        } else if (category === 'dream') {
          const out = parseDreamSections(cached.data);
          const hasAny = out.diagnosis || out.symbols || out.oriental || out.western || out.advice || out.caution;
          setResultSections(hasAny ? out as Record<string, string> : null);
        } else {
          setResultSections(null);
        }
        return;
      }
    }
    setResult(null);
    setResultSections(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, saju, koreanName, charMeanings, selectedHanjas, dreamText, isArchiveMode, freshParam]);

  // auto-start: 모달에서 "새로 풀이 받기" 클릭 후 소개 페이지 건너뛰고 바로 풀이
  // ★ shouldAutoStart 는 freshParam=true 일 때만 true → 무조건 force=true 로 호출.
  //   fresh=1 진입에서 캐시 hit 가 일어나 옛 결과가 setResult 되던 사고 차단.
  useEffect(() => {
    if (!shouldAutoStart || autoStartedRef.current) return;
    if (!canSubmit || loading || result || error) return;
    autoStartedRef.current = true;
    handleRead(true); // ★ force=true — 캐시 검사 skip + loading 무시
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoStart, canSubmit, loading, result, error]);

  // ★ refetchNonce 변경 → 강제 새 AI 호출 (SajuResultPage 패턴)
  //   handleRefetch 가 increment 하면 이 useEffect 가 handleReadRef.current(true) 직접 호출
  //   force=true 로 캐시·loading 상태 모두 우회
  useEffect(() => {
    if (refetchNonce === 0) return; // 초기 마운트 무시
    // handleReadRef 는 매 render 마다 최신 handleRead 로 동기화되므로 stale closure 없음
    void handleReadRef.current?.(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchNonce]);

  const handleRead = async (force: boolean = false) => {
    // 꿈 해몽은 saju 없이도 실행 가능
    if (category !== 'dream' && !saju) return;
    // ★ force=true 면 loading 상태 무시(이전 호출 중단된 잔여 loading=true 방지)
    if (!canSubmit || (loading && !force)) return;

    // 이름풀이 사전 validation: 한글 이름이 실제 한글인지 로딩 시작 전에 확인
    if (category === 'name') {
      const kor = analyzeKoreanName(koreanName);
      if (kor.elements.length === 0) {
        setError('한글 이름은 반드시 한글로 입력해주세요. 한자는 아래 "한자 이름" 칸에 따로 입력하면 됩니다.');
        return;
      }
    }

    // ★ handleRead 의 cache 검사 분기 제거 (2026-05-19 사고 fix)
    //   - 옛 분기는 cache hit 시 setResult(cached.data) 만 하고 setResultSections 누락 →
    //     단일 카드 fallback + [total]·[diagnosis] 등 raw 마커 본문 노출 사고
    //   - 사용자가 "풀이 시작" 버튼을 누른 액션은 항상 새 호출 의도
    //   - 페이지 재진입의 silent restore 는 useEffect (line 487~528) 가 별도 처리하며
    //     거기선 카테고리별 sections parser 를 호출하므로 안전
    //   ※ cacheKey·kindKey 변수는 응답 저장(setReport) 분기에 그대로 필요 — 정의만 유지.
    const cacheKey = buildCacheKey();
    const kindKey = `more:${category}` as const;

    if (moonBalance < MOON_COST_PER_FORTUNE) {
      setError('달 크레딧이 부족해요. 크레딧을 충전해주세요.');
      return;
    }

    setError(null);
    setResult(null);
    setResultSections(null);
    setLoading(true);

    // ★ 로딩 화면 최소 표시 시간 — AI 응답이 너무 빨라(<5s) 로딩 화면이
    //   안 보이고 결과로 바로 넘어가는 사고 방지. 사용자에게 "새 풀이 진행 중"
    //   임을 시각적으로 명확히 전달.
    const loadingStart = Date.now();
    const MIN_LOADING_MS = 2000;

    try {
      type FortuneResp = { success: boolean; content?: string; error?: string; sections?: Record<string, string> };
      let resp: FortuneResp = { success: false, error: '알 수 없는 카테고리' };

      if (category === 'dream') {
        resp = await getDreamInterpretation(dreamText.trim(), targetProfile?.id);
      } else {
        // 여기서 saju는 이미 위 가드로 보장됨
        const s = saju!;
        // [B안] love/wealth/career/health/people 비활성. 복원 시 case 같이 풀기.
        // case 'love':   resp = await getLoveShort(s); break;
        // case 'wealth': resp = await getWealthShort(s); break;
        // case 'career': resp = await getCareerShort(s); break;
        // case 'health': resp = await getHealthShort(s); break;
        // case 'people': resp = await getPeopleShort(s); break;
        switch (category) {
          case 'study':       resp = await getStudyShort(s, targetProfile?.id); break;
          case 'children':    resp = await getChildrenShort(s, targetProfile?.id); break;
          case 'personality': resp = await getPersonalityShort(s, targetProfile?.id); break;
          case 'name': {
            const kor = analyzeKoreanName(koreanName);
            // 글자별 뜻+음 — kor.chars 와 charMeanings 를 1:1 매칭. 4글자까지.
            const sounds = kor.chars.slice(0, 4);
            const meanings = sounds.map((_, i) => (charMeanings[i] || '').trim());
            const charPairs = sounds.map((sound, i) => ({ sound, meaning: meanings[i] }));
            // 모달에서 선택한 한자가 모두 채워졌으면 hanjaName 으로 prompt 에 직접 주입
            // → AI 한자 추정 단계 생략, 자원오행 정확도 ↑
            const hanjaName = selectedHanjas.slice(0, sounds.length).filter(Boolean).join('');
            resp = await getNameFortune(s, {
              koreanName: koreanName.trim(),
              koreanInitialsElements: kor.elements,
              charMeanings: charPairs,
              ...(hanjaName.length === sounds.length ? { hanjaName } : {}),
            }, targetProfile?.id);
            break;
          }
        }
      }

      if (!resp || !resp.success || !resp.content) {
        throw new Error(resp?.error || '풀이 생성에 실패했어요.');
      }

      // 로딩 화면 최소 표시 시간 보장
      const elapsed = Date.now() - loadingStart;
      if (elapsed < MIN_LOADING_MS) {
        await new Promise(r => setTimeout(r, MIN_LOADING_MS - elapsed));
      }

      setResult(resp!.content);
      // 섹션 마커 기반 파싱 결과 (학업·자녀·성격에서 카드별 렌더링에 사용)
      if (resp!.sections && Object.keys(resp!.sections).length > 0) {
        setResultSections(resp!.sections);
      } else {
        setResultSections(null);
      }

      if (cacheKey) {
        const cache = useReportCacheStore.getState();
        // 정상 응답 캐시 저장 — 재진입 시 silent restore
        cache.setReport(kindKey, cacheKey, resp!.content);
        if (!cache.isCharged(kindKey, cacheKey)) {
          cache.markCharged(kindKey, cacheKey);
          const consumed = await chargeForContent('moon', MOON_COST_PER_FORTUNE, `더많은운세:${cfg.title}`, `more:${kindKey}:${cacheKey}`);
          if (!consumed) {
            console.error('크레딧 차감 실패 (응답은 이미 생성됨)');
          }
        }
      }
    } catch (e: any) {
      const msg = e?.message || '오류가 발생했어요.';
      setError(msg);
      // negative cache: 같은 입력 즉시 재시도 차단
      if (cacheKey) {
        useReportCacheStore.getState().setError(kindKey, cacheKey, msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // handleRead 최신 참조 동기화 — handleRefetch 같은 외부 콜백에서 stale closure 회피
  handleReadRef.current = handleRead;

  // 비로그인 가드
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-text-secondary mb-4">{cfg.title} 풀이는 로그인 후 이용 가능해요.</p>
        <Link href={`/login?from=${encodeURIComponent(`/saju/more/${category ?? ''}`)}`} className="text-cta font-semibold underline">로그인하기</Link>
      </div>
    );
  }

  if (needsProfileSelect && cfg) {
    return (
      <QuickFortuneGate
        serviceName={cfg.title}
        archiveCategory={category as ArchiveCategory}
        creditType="moon"
        creditCost={MOON_COST_SELECT}
      />
    );
  }

  // 꿈 해몽은 사주와 무관 — 프로필 없어도 진입 가능.
  // shouldAutoStart 일 때는 로딩 화면을 바로 보여주므로 이 가드를 건너뜀
  if (!isArchiveMode && category !== 'dream' && !targetProfile && !shouldAutoStart) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-text-secondary mb-4">{cfg.title}을 보려면 대표 프로필이 필요해요.</p>
        <Link href="/saju/input?mode=profile-only" className="text-cta font-semibold underline">프로필 등록</Link>
      </div>
    );
  }

  if (!isArchiveMode && category !== 'dream' && !saju && !shouldAutoStart) {
    return <div className={styles.loading}>사주 계산 중...</div>;
  }

  // 로딩 풀스크린 — 보관함 재생 모드는 짧은 DB 조회라 AI 로딩 연출 대신 간단한 표시
  // shouldAutoStart: 모달→바로 풀이 시 saju 로드 전부터 로딩 화면 표시
  if (!isArchiveMode && (loading || (shouldAutoStart && !result && !error))) {
    return (
      <AILoadingBar
        label={`${cfg.title} 분석 중`}
        minLabel="10초"
        maxLabel="40초"
        estimatedSeconds={25}
        messages={LOADING_MESSAGES[category as MoreFortuneId]}
        topContent={
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="text-[28px] mb-1 font-bold" style={{ fontFamily: 'var(--font-serif)' }}>
              {cfg.title}
            </div>
            <div className="text-[14px] text-text-tertiary">{cfg.shortDesc}</div>
          </motion.div>
        }
      />
    );
  }
  if (loading && isArchiveMode) {
    return <div className={styles.loading}>보관된 풀이를 불러오는 중…</div>;
  }

  return (
    <div className={styles.container}>
      <div className="flex items-center relative mb-5 pt-3 px-1">
        <BackButton className="absolute left-0" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>{cfg.title}</h1>
          {isArchiveMode && archivedAt ? (
            <p className="text-base text-text-tertiary mt-1">
              보관함 · {new Date(archivedAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          ) : category !== 'name' && category !== 'dream' && targetProfile ? (
            <p className="text-base text-text-tertiary mt-1">{targetProfile.name} · {targetProfile.birth_date}</p>
          ) : null}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={styles.content}
      >
        {/* 소개 카드 */}
        <div
          className={styles.section}
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.10), rgba(236,72,153,0.06))',
            border: '1px solid rgba(139,92,246,0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ display: 'inline-block', width: 4, height: 22, borderRadius: 2, background: 'var(--cta-primary)' }} />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{cfg.title}</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0 }}>
            {cfg.longDesc}
          </p>
        </div>

        {/* 입력·버튼 영역 — 결과가 나오면 숨겨서 결과만 보이도록 (보관함 모드는 이 블록을 건너뜀) */}
        {!result && !isArchiveMode && (
          <>
            {category === 'dream' && (
              <div className={styles.section}>
                <h2 style={{ fontSize: 18, marginBottom: 14, fontWeight: 700 }}>꿈 내용 입력</h2>
                <DreamInputPanel
                  key={dreamInputResetKey}
                  onTextChange={setDreamText}
                  onValidChange={setDreamValid}
                />
              </div>
            )}

            {category === 'name' && (
              <NameInputPanel
                koreanName={koreanName}
                onKoreanNameChange={setKoreanName}
                charMeanings={charMeanings}
                onCharMeaningsChange={setCharMeanings}
                selectedHanjas={selectedHanjas}
                onSelectedHanjasChange={setSelectedHanjas}
                readOnly={false}
              />
            )}

            <div className={styles.section} style={{ padding: 0, background: 'none', border: 'none' }}>
              <button
                onClick={() => { void handleRead(); }}
                disabled={!canSubmit || loading || moonBalance < MOON_COST_PER_FORTUNE}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: 'linear-gradient(135deg, var(--cta-primary), var(--cta-secondary, var(--cta-primary)))',
                  color: 'white',
                  border: 'none',
                  borderRadius: 14,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: (!canSubmit || loading || moonBalance < MOON_COST_PER_FORTUNE) ? 'not-allowed' : 'pointer',
                  opacity: (!canSubmit || loading || moonBalance < MOON_COST_PER_FORTUNE) ? 0.5 : 1,
                  boxShadow: '0 4px 20px rgba(139,92,246,0.3)',
                  transition: 'all 0.2s',
                }}
              >
                {cfg.ctaButton} <span style={{ opacity: 0.85, fontSize: 13 }}>🌙 {MOON_COST_PER_FORTUNE}</span>
              </button>
            </div>

            {error && (
              <div
                className={styles.section}
                style={{
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.35)',
                }}
              >
                <p style={{ fontSize: 13, color: '#F87171', margin: 0 }}>{error}</p>
              </div>
            )}
          </>
        )}

        {/* 보관함 재생 모드: 저장된 꿈 텍스트만 표시 */}
        {category === 'dream' && isArchiveMode && dreamText && (
          <div className={styles.section}>
            <h2 style={{ fontSize: 14, marginBottom: 8 }}>당신이 적은 꿈</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>
              {dreamText}
            </p>
          </div>
        )}

        {/* 결과 — 학업·자녀·성격은 섹션별 카드 / 꿈해몽은 동양식·서양식 2섹션 / 그 외는 단일 카드 */}
        <AnimatePresence>
          {result && resultSections && (category === 'study' || category === 'children' || category === 'personality' || category === 'name') && (
            <MoreFortuneSectionedCard
              nameVisualContext={category === 'name' ? nameVisualContext : null}
              title={`${cfg.title} 풀이`}
              sections={resultSections}
              category={category}
              isArchiveMode={isArchiveMode}
              onReset={() => {
                handleRefetch();
              }}
            />
          )}
          {/* 꿈해몽 — 진단 + 상징 + 동양식 + 서양식 + 이렇게 하면 좋아요 + 주의할 점 6섹션 */}
          {result && category === 'dream' && resultSections && (resultSections.diagnosis || resultSections.symbols || resultSections.oriental || resultSections.western || resultSections.advice || resultSections.caution) && (
            <MoreFortuneDreamCard
              title={`${cfg.title} 풀이`}
              diagnosis={resultSections.diagnosis ?? ''}
              symbols={resultSections.symbols ?? ''}
              oriental={resultSections.oriental ?? ''}
              western={resultSections.western ?? ''}
              advice={resultSections.advice ?? ''}
              caution={resultSections.caution ?? ''}
              isArchiveMode={isArchiveMode}
              onReset={() => {
                setResult(null);
                setResultSections(null);
                setError(null);
                setManualMode(true);
                useReportCacheStore.getState().invalidate(`more:dream` as const);
                setDreamText('');
                setDreamValid(false);
                setDreamInputResetKey(k => k + 1);
              }}
            />
          )}
          {result && (!resultSections || !(category === 'study' || category === 'children' || category === 'personality' || category === 'name' || category === 'dream')) && (
            <MoreFortuneResultCard
              title={`${cfg.title} 풀이`}
              text={result}
              isArchiveMode={isArchiveMode}
              category={category}
              onReset={() => {
                // ★ 자동 풀이 카테고리 (학업·자녀·성격) 는 사용자 추가 입력이 없으므로
                //   곧장 새 풀이 시작 (handleRefetch — fresh=1 URL 강제 reload)
                //   이름·꿈 카테고리는 입력 필요 → manualMode=true 로 입력 화면 복귀
                if (category === 'study' || category === 'children' || category === 'personality') {
                  handleRefetch();
                  return;
                }
                setResult(null);
                setResultSections(null);
                setError(null);
                setManualMode(true);
                // 캐시 무효화 — 다시 풀이 시 이전 결과가 복원되지 않도록
                if (category) {
                  useReportCacheStore.getState().invalidate(`more:${category}` as const);
                }
                // 이름 풀이 입력값 초기화 — 한자 다시 선택할 수 있게
                if (category === 'name') {
                  setKoreanName('');
                  setCharMeanings([]);
                  setSelectedHanjas([]);
                }
                if (category === 'dream') {
                  setDreamText('');
                  setDreamValid(false);
                  setDreamInputResetKey((k) => k + 1);
                }
              }}
            />
          )}
        </AnimatePresence>

        {(recordId || savedRecordId) && result && (
          <div style={{ marginTop: 16, padding: '0 16px' }}>
            <ShareBar recordId={(recordId || savedRecordId)!} type="saju" category={category || 'traditional'} />
          </div>
        )}
      </motion.div>

      <RestoreReportModal
        open={!!cacheGate}
        title={cfg.title}
        onUseCached={handleUseCached}
        onRefresh={handleRefetch}
        onClose={() => setCacheGate(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 이름 풀이 입력 패널
//   한글 이름 (4글자 이내) + 글자별 뜻(한자 추정용)을 입력받는다.
//   - 글자별 뜻이 1개 이상 채워지면 한자 추정 모드 (자원오행 분석 포함).
//   - 모두 비어 있으면 순우리말/모름 모드 (음령오행만 분석).
// ─────────────────────────────────────────────────────────────────────────────
function NameInputPanel({
  koreanName,
  onKoreanNameChange,
  charMeanings,
  onCharMeaningsChange,
  selectedHanjas,
  onSelectedHanjasChange,
  readOnly,
}: {
  koreanName: string;
  onKoreanNameChange: (v: string) => void;
  charMeanings: string[];
  onCharMeaningsChange: (v: string[]) => void;
  selectedHanjas: (string | null)[];
  onSelectedHanjasChange: (v: (string | null)[]) => void;
  readOnly: boolean;
}) {
  // 한글 음절만 추출 (공백·한자·기호 제외) — 4글자까지
  const chars = (() => {
    const out: string[] = [];
    for (const ch of koreanName.trim()) {
      if (ch.charCodeAt(0) >= 0xac00 && ch.charCodeAt(0) <= 0xd7a3) {
        out.push(ch);
        if (out.length >= 4) break;
      }
    }
    return out;
  })();

  // 모달 state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [manualMeaningIndex, setManualMeaningIndex] = useState<number | null>(null);

  const ensureSize = (arr: string[], n: number): string[] => {
    const out = [...arr];
    while (out.length < n) out.push('');
    return out;
  };
  const ensureSizeNullable = (arr: (string | null)[], n: number): (string | null)[] => {
    const out = [...arr];
    while (out.length < n) out.push(null);
    return out;
  };

  const handleSelectHanja = (i: number, candidate: HanjaCandidate) => {
    // 한자 + 뜻 동시 채움
    const nextHanjas = ensureSizeNullable(selectedHanjas, chars.length);
    nextHanjas[i] = candidate.char;
    onSelectedHanjasChange(nextHanjas);
    const nextMeanings = ensureSize(charMeanings, chars.length);
    nextMeanings[i] = candidate.meanings[0] ?? '';
    onCharMeaningsChange(nextMeanings);
    setPickerOpen(false);
  };

  const handleClearHanja = (i: number) => {
    const nextHanjas = ensureSizeNullable(selectedHanjas, chars.length);
    nextHanjas[i] = null;
    onSelectedHanjasChange(nextHanjas);
    const nextMeanings = ensureSize(charMeanings, chars.length);
    nextMeanings[i] = '';
    onCharMeaningsChange(nextMeanings);
  };

  const handleManualMeaning = (i: number, value: string) => {
    const nextMeanings = ensureSize(charMeanings, chars.length);
    nextMeanings[i] = value;
    onCharMeaningsChange(nextMeanings);
  };

  return (
    <div className={styles.section}>
      <h2 style={{ fontSize: 14 }}>이름 입력</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>
            한글 이름 {readOnly ? '' : '(필수, 4글자까지)'}
          </label>
          <input
            type="text"
            value={koreanName}
            onChange={(e) => onKoreanNameChange(e.target.value)}
            placeholder="예: 홍길동"
            maxLength={6}
            readOnly={readOnly}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              color: 'var(--text-primary)',
              fontSize: 14,
              cursor: readOnly ? 'default' : 'text',
            }}
          />
        </div>

        {chars.length > 0 && (
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>
              글자별 한자 {readOnly ? '' : '(+ 버튼을 누르면 그 음의 한자 후보가 나와요)'}
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chars.map((ch, i) => {
                const hanja = selectedHanjas[i] ?? null;
                const meaning = (charMeanings[i] ?? '').trim();
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* 한글 음 */}
                    <div
                      style={{
                        flex: '0 0 44px',
                        height: 44,
                        borderRadius: 10,
                        background: 'rgba(168, 132, 255, 0.12)',
                        border: '1px solid rgba(168, 132, 255, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-serif)',
                      }}
                    >
                      {ch}
                    </div>

                    {/* 한자 카드 or + 버튼 */}
                    {hanja ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (readOnly) return;
                          setPickerIndex(i);
                          setManualMeaningIndex(null);
                          setPickerOpen(true);
                        }}
                        disabled={readOnly}
                        style={{
                          flex: 1,
                          height: 44,
                          borderRadius: 10,
                          background: 'rgba(124,92,252,0.15)',
                          border: '1px solid var(--cta-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '0 12px',
                          cursor: readOnly ? 'default' : 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 24,
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-serif)',
                            lineHeight: 1,
                          }}
                        >
                          {hanja}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            fontSize: 13,
                            color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-body)',
                          }}
                        >
                          {meaning ? `${meaning} ${ch}` : ch}
                        </span>
                        {!readOnly && (
                          <span style={{ fontSize: 11, color: 'var(--cta-primary)', fontWeight: 700 }}>변경</span>
                        )}
                      </button>
                    ) : manualMeaningIndex === i && !readOnly ? (
                      // 직접 뜻 입력 모드
                      <input
                        type="text"
                        value={meaning}
                        onChange={(e) => handleManualMeaning(i, e.target.value)}
                        onBlur={() => setManualMeaningIndex(null)}
                        autoFocus
                        placeholder="뜻을 직접 입력 (예: 넓을)"
                        maxLength={12}
                        style={{
                          flex: 1,
                          height: 44,
                          padding: '0 12px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(168, 132, 255, 0.4)',
                          borderRadius: 10,
                          color: 'var(--text-primary)',
                          fontSize: 14,
                        }}
                      />
                    ) : (
                      <div style={{ flex: 1, display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (readOnly) return;
                            setPickerIndex(i);
                            setManualMeaningIndex(null);
                            setPickerOpen(true);
                          }}
                          disabled={readOnly}
                          style={{
                            flex: 1,
                            height: 44,
                            borderRadius: 10,
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px dashed rgba(255,255,255,0.2)',
                            color: 'var(--text-tertiary)',
                            fontSize: 13,
                            cursor: readOnly ? 'default' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                        >
                          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--cta-primary)' }}>+</span>
                          <span>"{ch}" 자 한자 선택</span>
                        </button>
                        {meaning && (
                          <div
                            style={{
                              flex: '0 0 80px',
                              height: 44,
                              borderRadius: 10,
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              padding: '0 10px',
                              display: 'flex',
                              alignItems: 'center',
                              fontSize: 12,
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {meaning}
                          </div>
                        )}
                      </div>
                    )}

                    {/* X (제거) — 한자 또는 뜻 입력됐을 때 */}
                    {(hanja || meaning) && !readOnly && (
                      <button
                        type="button"
                        onClick={() => handleClearHanja(i)}
                        style={{
                          flex: '0 0 32px',
                          height: 44,
                          borderRadius: 10,
                          background: 'transparent',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'var(--text-tertiary)',
                          fontSize: 14,
                          cursor: 'pointer',
                        }}
                        aria-label="제거"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {!readOnly && (
              <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.6 }}>
                각 글자의 + 버튼을 누르면 그 음의 한자 후보(뜻·부수·자원오행 색)가 나와요.
                한자를 모르거나 순우리말 이름이면 비워두셔도 됩니다 — 음령오행만으로도 풀이돼요.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 한자 선택 모달 — 음 → 한자 후보 그리드 */}
      <HanjaPickerModal
        open={pickerOpen}
        sound={chars[pickerIndex] ?? ''}
        currentChar={selectedHanjas[pickerIndex] ?? undefined}
        onSelect={(c) => handleSelectHanja(pickerIndex, c)}
        onClose={() => setPickerOpen(false)}
      />

      {/* "한자 모르겠어요" 모드 안내 — 모달이 닫혀있을 때만 */}
      {!readOnly && manualMeaningIndex === null && (
        <div style={{ marginTop: 4 }}>
          <button
            type="button"
            onClick={() => {
              // 첫 번째 미선택 글자에서 직접 뜻 입력 모드 시작
              const firstEmpty = chars.findIndex((_, i) => !selectedHanjas[i] && !(charMeanings[i] || '').trim());
              setManualMeaningIndex(firstEmpty >= 0 ? firstEmpty : 0);
            }}
            style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              background: 'transparent',
              border: 'none',
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: '2px 0',
            }}
          >
            한자 후보에 없어요 — 뜻만 직접 입력하기
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 더많은운세 결과 카드
//   정통사주(SajuResultPage)와 동일한 카드 패턴으로 통일.
//   - 상단: 섹션 레이블 (cta 바 + 굵은 제목)
//   - 그 아래: 은유 제목 (cta 색상, font-serif)
//   - 한자 모드면 "자원오행 판정:" 라인을 별도 chip 으로 분리
//   - 본문은 단락 단위로 나눠 렌더
//   - 하단 액션: 보관함 모드면 "보관함으로", 아니면 "다른 풀이 받기"(리셋)만
// ─────────────────────────────────────────────────────────────────────────────
function MoreFortuneResultCard({
  title,
  text,
  isArchiveMode,
  category,
  onReset,
}: {
  title: string;
  text: string;
  isArchiveMode: boolean;
  category?: MoreFortuneId;
  onReset: () => void;
}) {
  // 옛 record 호환 + 안전망 — 마커가 본문에 그대로 노출되던 사고 차단.
  // (1) 옛 단일 마커 [name]/[name_old]/[legacy]
  // (2) 새 6 섹션 마커도 strip (parseMarkerSections 가 매칭 실패해 fallback 으로 들어온 경우)
  // 대소문자·공백·콜론 변형까지 모두 흡수.
  const cleanText = text
    .replace(/\r/g, '')
    .replace(/^[\s*#▶■·•\-]*\[\s*(?:name|name_old|legacy|summary|eum_ryeong|ja_won|harmony|numerology|advice)\s*\][\s*#:：]*$/gmi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // [은유] 마커 우선 추출 + 본문 strip. 마커 없으면 첫 비어있지 않은 줄 fallback.
  const parsed = extractMetaphor(cleanText);
  let metaphor = parsed.metaphorTitle;
  let restSource = parsed.bodyText;
  if (!metaphor) {
    const rawLines = restSource.split('\n');
    const metaphorIdx = rawLines.findIndex((l) => l.trim().length > 0);
    metaphor = metaphorIdx >= 0 ? rawLines[metaphorIdx].trim() : '';
    restSource = metaphorIdx >= 0 ? rawLines.slice(metaphorIdx + 1).join('\n') : '';
  }

  // "자원오행 판정:" 라인은 별도 chip 으로 표시 (이름 풀이 한자 모드)
  const restLines = restSource.split('\n');
  let jawonLine = '';
  const bodyLines: string[] = [];
  for (const ln of restLines) {
    const t = ln.trim();
    if (!jawonLine && t.startsWith('자원오행 판정')) {
      jawonLine = t;
    } else {
      bodyLines.push(ln);
    }
  }
  const body = bodyLines.join('\n').replace(/^\s*\n+/, '');

  // 본문을 빈 줄 기준 단락 분할 — 빈 줄 없는 평문이면 마침표 묶음으로 자동 분할
  const paragraphs = (() => {
    const parts = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
    if (parts.length === 0) return [];
    const flat = parts[0].replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    const sents = flat.split(/([.!?])\s+/);
    const sentences: string[] = [];
    for (let i = 0; i < sents.length; i += 2) {
      const s = (sents[i] || '').trim();
      const punct = sents[i + 1] || '';
      const combined = (s + punct).trim();
      if (combined) sentences.push(combined);
    }
    if (sentences.length <= 3) return [flat];
    const grouped: string[] = [];
    for (let i = 0; i < sentences.length; i += 3) grouped.push(sentences.slice(i, i + 3).join(' '));
    return grouped;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block w-1 h-5 rounded-full bg-cta" />
        <div
          className="text-[17px] font-bold text-text-primary tracking-tight"
          style={{ fontFamily: 'var(--font-title)' }}
        >
          {title}
        </div>
      </div>

      {metaphor && (
        <div
          className="text-[17px] font-bold leading-snug text-cta/90 mb-4 pl-3"
          style={{ fontFamily: 'var(--font-title)' }}
        >
          {metaphor}
        </div>
      )}

      {jawonLine && (
        <div
          style={{
            margin: '0 0 14px',
            padding: '10px 12px',
            background: 'rgba(168, 132, 255, 0.08)',
            border: '1px solid rgba(168, 132, 255, 0.25)',
            borderRadius: 10,
            fontSize: 12.5,
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
          }}
        >
          {jawonLine}
        </div>
      )}

      <div className="space-y-3">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className="text-[17px] text-text-secondary leading-[1.85] whitespace-pre-line tracking-[-0.005em]"
          >
            {renderEmphasis(p)}
          </p>
        ))}
      </div>

      {/* 꿈해몽은 archive 모드에서 "보관함으로" 버튼 숨김 — 다른 결과 페이지와 일관성 (상단 BackButton 으로 복귀) */}
      {!(isArchiveMode && category === 'dream') && (
        <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
          {isArchiveMode ? (
            <Link
              href="/archive"
              style={{
                flex: 1,
                padding: '12px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                color: 'var(--text-secondary)',
                fontSize: 13,
                textAlign: 'center',
                textDecoration: 'none',
              }}
            >
              보관함으로
            </Link>
          ) : (
            <button
              onClick={onReset}
              style={{
                flex: 1,
                padding: '12px',
                background: 'var(--cta-primary)',
                border: 'none',
                borderRadius: 10,
                color: 'white',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {category === 'name' ? '다른 이름 풀이받기' : category === 'dream' ? '다른 꿈 풀이받기' : '다시 풀이 받기'}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 꿈해몽 결과 카드 — 5섹션 (진단·상징·동양식·서양식·실천)
//   정통사주·이름풀이와 동일 스타일·애니메이션.
//   - 진단(diagnosis): 카드 상단 배지 + 짧은 해설 (SectionCollapsible 아님)
//   - 상징(symbols): SectionCollapsible 펼침 디폴트, 카드 그리드
//   - 동양식/서양식: SectionCollapsible 접힘 디폴트
//   - 실천(action): SectionCollapsible 접힘 디폴트 + 행운/액막이 그리드
//   ※ 옛 record (마커 없는 단일 본문) 는 oriental 에 fallback 으로 들어가 있어 동양식 하나만 렌더.
// ─────────────────────────────────────────────────────────────────────────────
function MoreFortuneDreamCard({
  title,
  diagnosis,
  symbols,
  oriental,
  western,
  advice,
  caution,
  isArchiveMode,
  onReset,
}: {
  title: string;
  diagnosis: string;
  symbols: string;
  oriental: string;
  western: string;
  advice: string;
  caution: string;
  isArchiveMode: boolean;
  onReset: () => void;
}) {
  // ★ 안전망 — 옛 record / AI 마커 잔존으로 본문에 [marker] 가 그대로 들어가는 사고 차단.
  //   parseDreamSections 의 fallback (전체를 oriental 에 보존) 경로에서 발생 가능.
  //   다른 카테고리 마커(예: [total], [eum_ryeong])도 함께 strip.
  const stripMarkers = (s: string) =>
    s.replace(/^\s*\[[a-z_]+\]\s*$/gmi, '').replace(/\n{3,}/g, '\n\n').trim();

  diagnosis = stripMarkers(diagnosis);
  symbols = stripMarkers(symbols);
  oriental = stripMarkers(oriental);
  western = stripMarkers(western);
  advice = stripMarkers(advice);
  caution = stripMarkers(caution);

  // 진단 본문에서 첫 줄(태그 라인)과 나머지(근거 본문) 분리
  const diagnosisLines = diagnosis.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const diagnosisTag = diagnosisLines[0] ?? '';
  const diagnosisBody = diagnosisLines.slice(1).join(' ').trim();
  const diagnosisTags = diagnosisTag.split(/\s*[·•·]\s*/).filter(Boolean);

  const symbolCards = parseDreamSymbols(symbols);
  // advice 본문 안에 행운/액막이 키-값 항목이 들어와 있으므로 parseDreamAction 으로 분리 (마커 이름만 다를 뿐 동일 형식)
  const { body: adviceBody, items: adviceItems } = parseDreamAction(advice);

  // SectionCollapsible 에 들어갈 섹션 — 빈 본문은 자동 제외 (옛 record 호환)
  const bodySections: { key: string; label: string; text: string }[] = [];
  if (symbols.trim() && symbolCards.length > 0) bodySections.push({ key: 'symbols', label: '꿈 속 상징', text: symbols });
  if (oriental.trim()) bodySections.push({ key: 'oriental', label: '동양식 해몽', text: oriental });
  if (western.trim()) bodySections.push({ key: 'western', label: '서양식 해몽', text: western });
  if (advice.trim() && (adviceBody || adviceItems.length > 0)) bodySections.push({ key: 'advice', label: '이렇게 하면 좋아요', text: advice });
  if (caution.trim()) bodySections.push({ key: 'caution', label: '주의할 점', text: caution });

  // 길몽/흉몽 판정 — 진단 태그 첫 단어로 색상 결정
  const isGood = /길몽/.test(diagnosisTag);
  const isBad = /흉몽/.test(diagnosisTag);
  const diagnosisColor = isGood ? '#34D399' : isBad ? '#F87171' : 'var(--cta-primary)';
  const diagnosisBg = isGood ? 'rgba(52,211,153,0.10)' : isBad ? 'rgba(248,113,113,0.10)' : 'rgba(124,92,252,0.10)';
  const diagnosisBorder = isGood ? 'rgba(52,211,153,0.30)' : isBad ? 'rgba(248,113,113,0.30)' : 'rgba(124,92,252,0.30)';

  return (
    <motion.div
      key="dream-sectioned"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      style={{ paddingTop: 4 }}
    >
      {/* 카드 헤더 */}
      <div className="flex items-center gap-2 mb-3 pl-1">
        <span className="inline-block w-1 h-5 rounded-full bg-cta" />
        <div
          className="text-[17px] font-bold text-text-primary tracking-tight"
          style={{ fontFamily: 'var(--font-title)' }}
        >
          {title}
        </div>
      </div>

      {/* 진단 배지 카드 — 카드 상단 한눈 요약 */}
      {diagnosisTag && (
        <div style={{
          marginBottom: 12,
          padding: '14px 16px',
          borderRadius: 14,
          background: diagnosisBg,
          border: `1px solid ${diagnosisBorder}`,
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: diagnosisBody ? 8 : 0 }}>
            {diagnosisTags.map((tag, i) => (
              <span key={i} style={{
                padding: '4px 12px', borderRadius: 99,
                fontSize: 13, fontWeight: 800, letterSpacing: '0.02em',
                color: diagnosisColor,
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${diagnosisBorder}`,
                fontFamily: 'var(--font-title)',
              }}>
                {tag}
              </span>
            ))}
          </div>
          {diagnosisBody && (
            <p style={{
              margin: 0, fontSize: 14, lineHeight: 1.7,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
            }}>
              {diagnosisBody}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {bodySections.map((s, idx) => {
          // symbols·action 은 별도 시각, 동양식·서양식은 일반 본문 + 단락 분할
          if (s.key === 'symbols') {
            return (
              <SectionCollapsible
                key={s.key}
                title={s.label}
                defaultOpen={idx === 0}
                enterDelay={idx * 0.06}
              >
                <div className="flex flex-col gap-2.5">
                  {symbolCards.map((c, ci) => (
                    <div key={ci} style={{
                      padding: '14px 16px',
                      borderRadius: 12,
                      background: 'rgba(124,92,252,0.06)',
                      border: '1px solid rgba(124,92,252,0.20)',
                    }}>
                      <div style={{
                        fontSize: 17, fontWeight: 800,
                        color: 'var(--text-primary)',
                        marginBottom: 8,
                        fontFamily: 'var(--font-title)',
                        letterSpacing: '-0.01em',
                      }}>
                        {c.name}
                      </div>
                      {c.traditional && (
                        <div style={{ marginBottom: c.modern ? 6 : 0, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{
                            flexShrink: 0, padding: '2px 8px', borderRadius: 6,
                            fontSize: 11, fontWeight: 700,
                            color: '#34D399', background: 'rgba(52,211,153,0.12)',
                            lineHeight: 1.4,
                          }}>전통</span>
                          <span style={{
                            fontSize: 14, lineHeight: 1.7,
                            color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-body)',
                          }}>{c.traditional}</span>
                        </div>
                      )}
                      {c.modern && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{
                            flexShrink: 0, padding: '2px 8px', borderRadius: 6,
                            fontSize: 11, fontWeight: 700,
                            color: 'var(--cta-primary)', background: 'rgba(124,92,252,0.12)',
                            lineHeight: 1.4,
                          }}>현대</span>
                          <span style={{
                            fontSize: 14, lineHeight: 1.7,
                            color: 'var(--text-secondary)',
                            fontFamily: 'var(--font-body)',
                          }}>{c.modern}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCollapsible>
            );
          }

          if (s.key === 'advice') {
            // 택일운세의 "이렇게 하면 좋아요" 와 동일 스타일 — 녹색 강조 카드 + 행운 그리드.
            const adviceParas = adviceBody.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
            return (
              <SectionCollapsible
                key={s.key}
                title={s.label}
                defaultOpen={idx === 0}
                enterDelay={idx * 0.06}
              >
                <div style={{
                  padding: '20px 20px',
                  borderRadius: 14,
                  background: 'rgba(52,211,153,0.08)',
                  border: '1px solid rgba(52,211,153,0.28)',
                }}>
                  <div style={{
                    fontSize: 24, fontWeight: 900,
                    color: '#34D399',
                    letterSpacing: '-0.02em',
                    marginBottom: 14,
                    fontFamily: 'var(--font-title)',
                    lineHeight: 1.3,
                  }}>
                    이렇게 하면 좋아요
                  </div>
                  <div style={{
                    fontSize: 22, lineHeight: 1.85,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                  }} className="space-y-3">
                    {adviceParas.map((para, pi) => (
                      <p key={pi} className="whitespace-pre-line">{renderEmphasis(para)}</p>
                    ))}
                  </div>
                </div>
                {adviceItems.length > 0 && (
                  <div style={{
                    marginTop: 18, padding: 16,
                    background: 'rgba(124,92,252,0.06)',
                    border: '1px solid rgba(124,92,252,0.20)',
                    borderRadius: 12,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 12,
                  }}>
                    {adviceItems.map((it, ii) => (
                      <div key={ii} style={{
                        padding: '16px 18px',
                        background: 'rgba(20,12,38,0.5)',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <div style={{
                          fontSize: 16, fontWeight: 800,
                          color: 'var(--cta-primary)',
                          letterSpacing: '-0.01em',
                          marginBottom: 8,
                          fontFamily: 'var(--font-title)',
                          lineHeight: 1.3,
                        }}>
                          {it.key}
                        </div>
                        <div style={{
                          fontSize: 19, fontWeight: 600,
                          color: 'var(--text-primary)',
                          lineHeight: 1.5,
                          fontFamily: 'var(--font-body)',
                        }}>
                          {it.value}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCollapsible>
            );
          }

          if (s.key === 'caution') {
            // 택일운세의 "주의할 점" 과 동일 스타일 — 적색 강조 카드.
            const cautionParas = s.text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
            return (
              <SectionCollapsible
                key={s.key}
                title={s.label}
                defaultOpen={idx === 0}
                enterDelay={idx * 0.06}
              >
                <div style={{
                  padding: '20px 20px',
                  borderRadius: 14,
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.28)',
                }}>
                  <div style={{
                    fontSize: 24, fontWeight: 900,
                    color: '#F87171',
                    letterSpacing: '-0.02em',
                    marginBottom: 14,
                    fontFamily: 'var(--font-title)',
                    lineHeight: 1.3,
                  }}>
                    주의할 점
                  </div>
                  <div style={{
                    fontSize: 22, lineHeight: 1.85,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 500,
                  }} className="space-y-3">
                    {cautionParas.map((para, pi) => (
                      <p key={pi} className="whitespace-pre-line">{renderEmphasis(para)}</p>
                    ))}
                  </div>
                </div>
              </SectionCollapsible>
            );
          }

          // 동양식·서양식 — 일반 본문 단락 분할 (은유 제목 + 본문)
          const { metaphorTitle, bodyText } = extractMetaphor(s.text);
          const paragraphs = bodyText.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
          return (
            <SectionCollapsible
              key={s.key}
              title={s.label}
              metaphorTitle={metaphorTitle}
              defaultOpen={idx === 0}
              enterDelay={idx * 0.06}
            >
              <div className="text-[17px] text-text-secondary leading-[1.9] tracking-[-0.005em] space-y-3">
                {paragraphs.map((para, pi) => {
                  const lines = para.split('\n');
                  const items: { type: 'text' | 'bullet'; content: string }[] = [];
                  for (const line of lines) {
                    const t = line.trim();
                    if (!t) continue;
                    const m = t.match(/^[-·•∙]\s*(.+)$/);
                    if (m) {
                      items.push({ type: 'bullet', content: m[1].trim() });
                    } else if (items.length > 0 && items[items.length - 1].type === 'text') {
                      items[items.length - 1].content += ' ' + t;
                    } else {
                      items.push({ type: 'text', content: t });
                    }
                  }
                  return (
                    <div key={pi} className="space-y-2.5">
                      {items.map((it, ii) =>
                        it.type === 'bullet' ? (
                          <div key={ii} className="flex items-start gap-2 pl-1">
                            <span className="text-cta shrink-0 mt-[6px] leading-none">·</span>
                            <span className="flex-1">{renderEmphasis(it.content)}</span>
                          </div>
                        ) : (
                          <p key={ii} className="whitespace-pre-line">{renderEmphasis(it.content)}</p>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCollapsible>
          );
        })}
      </div>

      {/* 하단 액션 */}
      {!isArchiveMode && (
        <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
          <button
            onClick={onReset}
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: 10,
              color: 'var(--text-secondary)',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            다른 꿈 풀이받기
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 섹션 기반 결과 카드 (학업·자녀·성격 전용)
//   각 섹션을 SectionCollapsible 로 분리 표시. 첫 섹션의 첫 줄은 은유 제목으로
//   카드 헤더에 노출하고 본문은 그 다음부터.
// ─────────────────────────────────────────────────────────────────────────────
function MoreFortuneSectionedCard({
  title,
  sections,
  category,
  isArchiveMode,
  onReset,
  nameVisualContext,
}: {
  title: string;
  sections: Record<string, string>;
  category: 'study' | 'children' | 'personality' | 'name';
  isArchiveMode: boolean;
  onReset: () => void;
  nameVisualContext?: {
    chars: string[];
    elements: string[];
    sounds: string[];
    hanjas: Array<{ char: string; meaning: string; radical: string; strokes: number; jawon: string }>;
    yongSinEl: string;
    giSinEl: string;
    jawonElements: string[];
  } | null;
}) {
  const keys =
    category === 'study' ? STUDY_SECTION_KEYS
    : category === 'children' ? CHILDREN_SECTION_KEYS
    : category === 'personality' ? PERSONALITY_SECTION_KEYS
    : NAME_SECTION_KEYS;
  const labels =
    category === 'study' ? STUDY_SECTION_LABELS as Record<string, string>
    : category === 'children' ? CHILDREN_SECTION_LABELS as Record<string, string>
    : category === 'personality' ? PERSONALITY_SECTION_LABELS as Record<string, string>
    : NAME_SECTION_LABELS as Record<string, string>;

  // 본문 잔여 섹션 마커 strip 패턴
  // AI 가 가이드 어겨 본문 안에 [aptitude] / [strengths] 같은 자기 마커를 또
  // 출력하는 사고가 발생 — parseStudySections 가 split 으로 분리해도 본문 내부
  // 추가 등장은 strip 안 되어 화면에 그대로 노출되던 사고 차단.
  const markerStripPattern = new RegExp(`^\\s*\\[(${keys.join('|')})\\]\\s*$`, 'gm');

  return (
    <motion.div
      key="sectioned"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      style={{ paddingTop: 4 }}
    >
      {/* 섹션별 collapsible 카드 — 정통사주와 동일 스펙 (extractMetaphor + metaphorTitle prop + 17px 본문) */}
      <div className="flex flex-col gap-3">
        {keys.map((key, idx) => {
          const raw = (sections[key] || '').trim();
          if (!raw) return null;
          // 본문 안 잔여 카테고리 마커 strip → extractMetaphor 로 [은유] 마커 + 부제 추출
          const stripped = raw.replace(markerStripPattern, '').replace(/\n{3,}/g, '\n\n').trim();
          const { metaphorTitle, bodyText } = extractMetaphor(stripped);
          // name 카테고리: 섹션별 시각 컴포넌트 + 본문에서 불릿 분리 (advice 만)
          const nameVisualNode = category === 'name' && nameVisualContext ? (() => {
            const ctx = nameVisualContext;
            switch (key) {
              case 'eum_ryeong':
                return <EumRyeongVisual chars={ctx.chars} elements={ctx.elements} yongSinEl={ctx.yongSinEl} giSinEl={ctx.giSinEl} />;
              case 'ja_won':
                return ctx.hanjas.length > 0 ? <JaWonVisual hanjas={ctx.hanjas} /> : null;
              case 'harmony':
                return <HarmonyVisual yongSinEl={ctx.yongSinEl} giSinEl={ctx.giSinEl} eumElements={ctx.elements} jawonElements={ctx.jawonElements} />;
              case 'numerology':
                return ctx.hanjas.length > 0 ? <NumerologyVisual chars={ctx.hanjas.map(h => h.char)} sounds={ctx.sounds} /> : null;
              default:
                return null;
            }
          })() : null;

          // advice 본문에서 불릿 추출 → AdviceVisual 로 카드 변환
          let renderBody: string = bodyText;
          let nameAdviceBullets: string[] = [];
          if (category === 'name' && key === 'advice') {
            const ex = extractBullets(bodyText);
            nameAdviceBullets = ex.bullets;
            renderBody = ex.rest;
          }

          return (
            <SectionCollapsible
              key={key}
              title={labels[key]}
              metaphorTitle={metaphorTitle}
              defaultOpen={idx === 0}
              enterDelay={idx * 0.05}
            >
              {nameVisualNode}
              {category === 'name' && key === 'advice' && nameAdviceBullets.length > 0 && (
                <AdviceVisual bullets={nameAdviceBullets} />
              )}
              <div className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
                {(() => {
                  // 단락 분리 + 단락 안에서 "- " "· " 같은 불릿 라인은 별도 리스트로 렌더
                  // name+advice 는 위에서 AdviceVisual 로 분리했으므로 renderBody 사용
                  const sourceText = (category === 'name' && key === 'advice') ? renderBody : bodyText;
                  const paras = sourceText.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
                  return paras.map((para, pi) => {
                    const lines = para.split('\n');
                    const items: { type: 'text' | 'bullet'; content: string }[] = [];
                    for (const line of lines) {
                      const t = line.trim();
                      if (!t) continue;
                      const m = t.match(/^[-·•∙]\s*(.+)$/);
                      if (m) {
                        items.push({ type: 'bullet', content: m[1].trim() });
                      } else {
                        // 이전 항목이 text 면 같은 텍스트 블록으로 합침
                        if (items.length > 0 && items[items.length - 1].type === 'text') {
                          items[items.length - 1].content += ' ' + t;
                        } else {
                          items.push({ type: 'text', content: t });
                        }
                      }
                    }
                    return (
                      <div key={pi} className="space-y-2.5">
                        {items.map((it, ii) =>
                          it.type === 'bullet' ? (
                            <div key={ii} className="flex items-start gap-2 pl-1">
                              <span className="text-text-tertiary shrink-0 mt-[6px] leading-none">·</span>
                              <span className="flex-1">{it.content}</span>
                            </div>
                          ) : (
                            <p key={ii} className="whitespace-pre-line">{it.content}</p>
                          )
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </SectionCollapsible>
          );
        })}
      </div>

      {/* 다시 풀이 버튼 */}
      {!isArchiveMode && (
        <div style={{ marginTop: 22, padding: '0 4px' }}>
          <button
            type="button"
            onClick={onReset}
            style={{
              width: '100%',
              padding: '14px',
              background: 'var(--cta-primary)',
              border: 'none',
              borderRadius: 12,
              color: 'white',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            다시 풀이 받기
          </button>
        </div>
      )}
    </motion.div>
  );
}
