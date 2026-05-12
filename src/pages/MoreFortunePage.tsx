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
import { useWasFreshOnEntry } from '../hooks/useFreshGate';
import { motion, AnimatePresence } from 'framer-motion';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';
import { useCreditStore } from '../store/useCreditStore';
import { useReportCacheStore, sajuKey } from '../store/useReportCacheStore';
import { computeSajuFromProfile } from '../utils/profileSaju';
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
  const wasFresh = useWasFreshOnEntry();
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

  // 꿈 해몽 전용 state — DreamInputPanel에서 onChange로 주입되는 합성 텍스트/유효성
  // dreamInputResetKey: "다른 꿈 풀이받기" 클릭 시 패널을 강제 remount 해 내부 상태(선명/흐릿 모드, 칩 선택 등)를 초기화
  const [dreamText, setDreamText] = useState('');
  const [dreamValid, setDreamValid] = useState(false);
  const [dreamInputResetKey, setDreamInputResetKey] = useState(0);

  // 결과 state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);

  // 결과 준비 완료 시 스크롤 최상단
  useScrollToTopOnLoad(!!result && !loading);

  // 학업/자녀/성격: fresh=1 진입 시 소개 페이지 건너뛰고 바로 풀이 시작
  // manualMode: "다시 풀이 받기" 클릭 시 true → 소개+CTA 페이지로 복귀
  // ★ wasFresh: 진입 시 URL fresh 즉시 제거 → 새로고침 시 wasFresh=false → 자동 호출 차단
  const autoStartedRef = useRef(false);
  const [manualMode, setManualMode] = useState(false);
  const freshParam = wasFresh;
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
  const handleRefetch = () => { setCacheGate(null); };

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
    if (wasFresh) return;

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
      return `dream:${t}`;
    }
    if (!saju) return null;
    const sk = sajuKey(saju);
    if (category === 'name') {
      const meaningsKey = charMeanings.map((m) => (m || '').trim()).join('|');
      return `${sk}:${koreanName.trim()}|${meaningsKey}`;
    }
    return sk;
  };

  // 카테고리/입력 바뀔 때 캐시 silent restore — 탭 이동·새로고침 후 다시 와도 재호출 X
  useEffect(() => {
    if (isArchiveMode) return;
    if (cacheGate) return;
    const cacheKey = buildCacheKey();
    const kindKey = category ? (`more:${category}` as const) : null;
    if (cacheKey && kindKey) {
      const cached = useReportCacheStore.getState().getReport<string>(kindKey, cacheKey);
      if (cached?.data) {
        setResult(cached.data);
        return;
      }
    }
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, saju, koreanName, charMeanings, dreamText, isArchiveMode]);

  // auto-start: 모달에서 "새로 풀이 받기" 클릭 후 소개 페이지 건너뛰고 바로 풀이
  useEffect(() => {
    if (!shouldAutoStart || autoStartedRef.current) return;
    if (!canSubmit || loading || result || error) return;
    autoStartedRef.current = true;
    handleRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoStart, canSubmit, loading, result, error]);

  const handleRead = async () => {
    // 꿈 해몽은 saju 없이도 실행 가능
    if (category !== 'dream' && !saju) return;
    if (!canSubmit || loading) return;

    // 이름풀이 사전 validation: 한글 이름이 실제 한글인지 로딩 시작 전에 확인
    if (category === 'name') {
      const kor = analyzeKoreanName(koreanName);
      if (kor.elements.length === 0) {
        setError('한글 이름은 반드시 한글로 입력해주세요. 한자는 아래 "한자 이름" 칸에 따로 입력하면 됩니다.');
        return;
      }
    }

    // 캐시 우선 — 같은 입력 재진입 시 silent restore
    const cacheKey = buildCacheKey();
    const kindKey = `more:${category}` as const;
    if (cacheKey) {
      const cached = useReportCacheStore.getState().getReport<string>(kindKey, cacheKey);
      if (cached?.error) {
        setError(cached.error);
        return;
      }
      if (cached?.data) {
        setResult(cached.data);
        return;
      }
    }

    if (moonBalance < MOON_COST_PER_FORTUNE) {
      setError('달 크레딧이 부족해요. 크레딧을 충전해주세요.');
      return;
    }

    setError(null);
    setResult(null);
    setLoading(true);

    try {
      type FortuneResp = { success: boolean; content?: string; error?: string };
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
            resp = await getNameFortune(s, {
              koreanName: koreanName.trim(),
              koreanInitialsElements: kor.elements,
              charMeanings: charPairs,
            }, targetProfile?.id);
            break;
          }
        }
      }

      if (!resp || !resp.success || !resp.content) {
        throw new Error(resp?.error || '풀이 생성에 실패했어요.');
      }

      setResult(resp!.content);

      if (cacheKey) {
        const cache = useReportCacheStore.getState();
        // 정상 응답 캐시 저장 — 재진입 시 silent restore
        cache.setReport(kindKey, cacheKey, resp!.content);
        if (!cache.isCharged(kindKey, cacheKey)) {
          cache.markCharged(kindKey, cacheKey);
          const consumed = await chargeForContent('moon', MOON_COST_PER_FORTUNE, `더많은운세:${cfg.title}`);
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
                readOnly={false}
              />
            )}

            <div className={styles.section} style={{ padding: 0, background: 'none', border: 'none' }}>
              <button
                onClick={handleRead}
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
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 6 }}>
                보유 🌙 {moonBalance} · 1회 {MOON_COST_PER_FORTUNE}개 소모
              </p>
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

        {/* 결과 — 정통사주와 동일한 카드 패턴 (레이블 + 은유 제목 + 본문) */}
        <AnimatePresence>
          {result && (
            <MoreFortuneResultCard
              title={`${cfg.title} 풀이`}
              text={result}
              isArchiveMode={isArchiveMode}
              category={category}
              onReset={() => {
                setResult(null);
                setError(null);
                setManualMode(true);
                // 캐시 무효화 — 다시 풀이 시 이전 결과가 복원되지 않도록
                if (category) {
                  useReportCacheStore.getState().invalidate(`more:${category}` as const);
                }
                if (category === 'name') {
                  setKoreanName('');
                  setCharMeanings([]);
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
  readOnly,
}: {
  koreanName: string;
  onKoreanNameChange: (v: string) => void;
  charMeanings: string[];
  onCharMeaningsChange: (v: string[]) => void;
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

  const updateMeaning = (i: number, value: string) => {
    const next = [...charMeanings];
    while (next.length <= i) next.push('');
    next[i] = value;
    onCharMeaningsChange(next);
  };

  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontSize: 14,
    cursor: readOnly ? 'default' : 'text',
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
            style={inputBase}
          />
        </div>

        {chars.length > 0 && (
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>
              글자별 뜻 {readOnly ? '' : '(한자 이름이면 입력 / 순우리말이면 비워두세요)'}
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chars.map((ch, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      flex: '0 0 44px',
                      height: 40,
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
                  <input
                    type="text"
                    value={charMeanings[i] ?? ''}
                    onChange={(e) => updateMeaning(i, e.target.value)}
                    placeholder={
                      i === 0 ? '예: 넓을' : i === 1 ? '예: 길할' : i === 2 ? '예: 아이' : '뜻을 적어주세요'
                    }
                    maxLength={12}
                    readOnly={readOnly}
                    style={{ ...inputBase, flex: 1 }}
                  />
                </div>
              ))}
            </div>
            {!readOnly && (
              <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.55 }}>
                한자를 모르거나 순우리말 이름이면 뜻 칸을 비워두셔도 됩니다. 비워두면 음령오행(초성 오행)만으로 풀이됩니다.
                뜻을 적으시면 그 뜻과 음에 가장 맞는 한자를 추정해 부수 기반 자원오행까지 교차 분석합니다.
              </p>
            )}
          </div>
        )}
      </div>
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
  // 줄 단위 정리 — 빈 줄은 단락 구분으로만 사용
  const rawLines = text.replace(/\r/g, '').split('\n');
  // 첫 번째 의미 있는 줄 = 은유 제목
  let metaphorIdx = rawLines.findIndex((l) => l.trim().length > 0);
  const metaphor = metaphorIdx >= 0 ? rawLines[metaphorIdx].trim() : '';

  // "자원오행 판정:" 라인은 별도 chip 으로 표시 (이름 풀이 한자 모드)
  const restLines = metaphorIdx >= 0 ? rawLines.slice(metaphorIdx + 1) : [];
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
          className="text-[17px] font-medium leading-snug text-cta/90 mb-4 pl-3"
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
            className="text-[16px] text-text-secondary leading-[1.85] whitespace-pre-line tracking-[-0.005em]"
          >
            {p}
          </p>
        ))}
      </div>

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
    </motion.div>
  );
}
