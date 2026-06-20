'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lunar } from 'lunar-javascript';
import { calculateSaju, type SajuResult } from '@/utils/sajuCalculator';
import {
  parseJungtongsaju,
  parseAdviceMeta,
  stripAllSectionTags,
  type JungtongsajuAIResult,
} from '@/services/fortuneService';
import { sajuDB, supabase } from '@/services/supabase';
import { useFortuneJob } from '@/hooks/useFortuneJob';
import { JUNGTONGSAJU_SECTION_KEYS, JUNGTONGSAJU_SECTION_LABELS } from '@/constants/prompts';
import { useProfileStore } from '@/store/useProfileStore';
import { useCreditStore } from '@/store/useCreditStore';
import { useReportCacheStore, sajuKey, type ReportKind } from '@/store/useReportCacheStore';
import { RestoreReportModal } from '@/components/RestoreReportModal';
import { TestFortuneProfileSelect } from '@/components/test/TestFortuneProfileSelect';
import { computeSajuFromProfile, sajuFromRecord } from '@/utils/profileSaju';
import { SUN_COST_BIG, CHARGE_REASONS } from '@/constants/creditCosts';
import { determineGyeokguk } from '@/engine/gyeokguk';
import { stemToHanja, zhiToHanja } from '@/lib/character';
import { AdviceCard } from '@/components/saju/AdviceCard';
import { extractMetaphor } from '@/utils/parseMetaphor';
import { renderEmphasizedBodyTest as renderEmphasizedBody, cleanKeepMarkers } from '@/utils/test/renderEmphasizedBodyTest';
import { LifetimeFortuneChart } from '@/components/saju/LifetimeFortuneChart';
import { SectionCollapsible } from '@/components/saju/SectionCollapsible';
import { renderJungtongsajuSectionVisual } from '@/components/saju/JungtongsajuSectionVisuals';
import SajuReport from '@/components/saju/SajuReport';
import { AILoadingBar } from '@/components/AILoadingBar';
import { BackButton } from '@/components/ui/BackButton';
import { useLoadingGuard } from '@/hooks/useLoadingGuard';
import { useScrollToTopOnLoad } from '@/hooks/useScrollToTopOnLoad';
import { ShareBar } from '@/components/share/ShareBar';
import { ResultFooterActions } from '@/components/ui/ResultFooterActions';

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

export default function Test1ResultPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const profileId = searchParams?.get('profileId') ?? null;
  const recordId = searchParams?.get('recordId') ?? null;
  const urlJobId = searchParams?.get('jobId') ?? null;
  const testGen = searchParams?.get('testgen') === '1'; // 직접 birth로 진입해 test 2-pass 자동 생성
  const isArchiveMode = !!recordId;
  const needsProfileSelect = !profileId && !isArchiveMode && !urlJobId && !(searchParams?.get('year') && searchParams?.get('month') && searchParams?.get('day'));
  const { profiles, fetchProfiles, hydrated, loading: profilesLoading, lastFetchedAt } = useProfileStore();
  const targetProfile = useMemo(() => {
    if (profileId) return profiles.find(p => p.id === profileId) ?? null;
    if (needsProfileSelect) return null;
    // URL year/month/day 로 진입한 경우 birth 가 일치하는 프로필을 찾는다.
    // 대표 프로필로 무조건 fallback 하면, B 의 birth 로 진입한 풀이가 보관함에 A 이름으로 저장되는 사고 발생.
    // 일치하는 프로필이 없으면 null — archiveSaju 가 sourceBirth 매칭(또는 그것도 실패 시 대표 fallback)으로 처리.
    const yStr = searchParams?.get('year');
    const mStr = searchParams?.get('month');
    const dStr = searchParams?.get('day');
    const genderStr = searchParams?.get('gender');
    const calendarTypeStr = (searchParams?.get('calendarType') ?? 'solar') as 'solar' | 'lunar';
    if (yStr && mStr && dStr) {
      const birthDate = `${yStr.padStart(4, '0')}-${mStr.padStart(2, '0')}-${dStr.padStart(2, '0')}`;
      return profiles.find(p =>
        p.birth_date === birthDate &&
        p.gender === genderStr &&
        (p.calendar_type ?? 'solar') === calendarTypeStr
      ) ?? null;
    }
    return profiles.find(p => p.is_primary) ?? null;
  }, [profiles, profileId, needsProfileSelect, searchParams]);

  const [result, setResult] = useState<SajuResult | null>(null);
  // 헤더에 표시할 사용자 입력 원본 시간 (HH:MM). result.solarDate 의 시각은 진태양시 보정 후 값이라
  // 사용자가 입력한 시간과 다르게 보여 혼란을 주므로 별도 state 로 보관.
  const [displayBirthTime, setDisplayBirthTime] = useState<string | null>(null);
  // 보관함 모드 — record 에 박힌 풀이 시점 프로필 이름 스냅샷. 헤더 표시에서 대표 프로필 fallback 차단용.
  const [archiveProfileName, setArchiveProfileName] = useState<string | null>(null);
  const [report, setReport] = useState<JungtongsajuAIResult | null>(null);
  const [reportLoading, setReportLoading] = useState(!isArchiveMode && !needsProfileSelect);
  // ── TEST 프롬프트 생성 (크레딧·DB 미반영, jungtongsajuPrompt.test.ts 사용) ──
  const [testGenLoading, setTestGenLoading] = useState(false);
  // ── 섹션별 단건 재생성 로딩 (현재 재생성 중인 섹션 key) ──
  const [sectionLoading, setSectionLoading] = useState<string | null>(null);
  const testGenRanRef = useRef(false);

  // 2-pass 응답 도착 시 스크롤 점프 방지용 ref —
  // 1차(partial)가 이미 도착해 사용자가 페이지를 보고 있는 상태에서,
  // 2차(.then 의 최종 setReport) 가 reportLoading=false 로 전환하면서
  // useScrollToTopOnLoad 가 트리거되어 스크롤이 맨 위로 튀는 사고를 막는다.
  // 보관함 모드(recordId)나 캐시 복원 등 partial 없이 한 번에 로딩 완료되는 케이스는
  // ref 가 false 상태로 유지되어 스크롤이 정상 동작.
  const firstPassReceivedRef = useRef(false);

  // 결과 준비 완료 시 스크롤 최상단 — 단, 1차 partial 이 이미 도착한 뒤에는 스크롤 안 함
  useScrollToTopOnLoad(!!report && !reportLoading && !firstPassReceivedRef.current);
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

  // ── 백그라운드 잡 시스템 ──
  // urlJobId : ?jobId=xxx 로 직접 진입 (보관함·재방문·새로고침)
  // createdJobId : birth 파라미터로 진입해서 새로 만든 잡
  // 둘 중 effective 한 id 가 있으면 useFortuneJob 이 saju_records 를 Realtime 구독한다.
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const effectiveJobId = urlJobId ?? createdJobId;
  const { job: fortuneJob } = useFortuneJob(effectiveJobId);

  // 잡 결과 → report state 동기화. archive 모드(recordId)는 별도 useEffect 가 처리.
  useEffect(() => {
    if (isArchiveMode) return;
    if (!fortuneJob) return;
    if (fortuneJob.status === 'done') {
      const content = fortuneJob.interpretationDetailed ?? '';
      const sections = parseJungtongsaju(content);
      const adviceMeta = sections.advice ? parseAdviceMeta(sections.advice) : undefined;
      setReport(
        Object.keys(sections).length > 0
          ? { success: true, sections, adviceMeta }
          : { success: true, rawText: content },
      );
      setSavedRecordId(fortuneJob.jobId);
      setReportLoading(false);
    } else if (fortuneJob.status === 'failed') {
      setReport({
        success: false,
        error: fortuneJob.errorMessage ?? '풀이 생성에 실패했어요. 크레딧은 자동 환불됐어요.',
      });
      setReportLoading(false);
    } else if (fortuneJob.status === 'processing' && fortuneJob.interpretationBasic) {
      // Phase 1.5 — 1차(Core 4섹션) partial 도착. 부분 렌더 켜고 2차는 백그라운드 진행.
      // hasAnySections 분기가 partial sections 를 감지해 로딩 화면 → 결과 화면 전환.
      const content = fortuneJob.interpretationBasic;
      const sections = parseJungtongsaju(content);
      if (Object.keys(sections).length > 0) {
        setReport({ success: true, sections });
        firstPassReceivedRef.current = true; // 2차 도착 시 스크롤 점프 방지
      }
      setSavedRecordId(fortuneJob.jobId);
      // reportLoading 은 true 유지 — 2차가 끝나야 완료
      setReportLoading(true);
    } else {
      // pending — 진행 시작 전 모래시계 (또는 1차 마커 파싱 실패로 partial 없음)
      setReportLoading(true);
    }
  }, [
    fortuneJob?.status,
    fortuneJob?.interpretationDetailed,
    fortuneJob?.interpretationBasic,
    fortuneJob?.errorMessage,
    fortuneJob?.jobId,
    isArchiveMode,
  ]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // ── 보관함 재생 모드 — recordId 가 있으면 DB에서 복원, AI 호출·차감 모두 skip ──
  useEffect(() => {
    if (!recordId) return;
    let cancelled = false;
    sajuDB.getRecordById(recordId)
      .then((record) => {
        if (cancelled || !record) return;
        try {
          // ★ 보관함 재생은 생성 시 저장된 result_data 를 그대로 미러링(재계산 X).
          //   → 생성·공유·보관함이 항상 100% 동일. (옛 레코드만 birth 로 fallback 재계산)
          const saju = sajuFromRecord(record);
          if (saju) setResult(saju);
          if (record.birth_time) {
            setDisplayBirthTime(record.birth_time.slice(0, 5));
          }
          // 보관함 풀이의 프로필명 — record.profile_name 스냅샷 우선, 없으면 profile_id 매칭으로 fallback.
          if (record.profile_name) {
            setArchiveProfileName(record.profile_name);
          } else if (record.profile_id) {
            const matched = useProfileStore.getState().profiles.find(p => p.id === record.profile_id);
            if (matched?.name) setArchiveProfileName(matched.name);
          }
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
      if (!unknownTime) {
        const hhStr = String(hour).padStart(2, '0');
        const mmStr = String(minute).padStart(2, '0');
        setDisplayBirthTime(`${hhStr}:${mmStr}`);
      } else {
        setDisplayBirthTime(null);
      }
    } else if (targetProfile) {
      setResult(computeSajuFromProfile(targetProfile));
      // 프로필 기반 진입 — birth_time 이 있으면 그 값을 그대로 노출
      setDisplayBirthTime(targetProfile.birth_time ? targetProfile.birth_time.slice(0, 5) : null);
    }
  }, [searchParams, targetProfile]);

  // ── 로딩 안전장치: 2-pass 정통사주는 최대 120초 허용 ──
  // 정통사주는 1차(~30s) + 2차(~60s) × retry 3회 → 최악 240초 가능
  const [reportTimedOut] = useLoadingGuard(reportLoading, 240_000);
  useEffect(() => {
    if (reportTimedOut) {
      setReportLoading(false);
      if (!report) setReport({ success: false, error: '응답이 너무 오래 걸려요. 새로고침 후 다시 시도해주세요.' });
    }
  }, [reportTimedOut, report]);

  // ── 백그라운드 잡 생성 ──
  // birth 파라미터로 진입했고 아직 잡이 없으면 /api/fortune/jobs/create 호출.
  // 잡 생성 후 URL 을 ?jobId=xxx 로 replace 하여 새로고침·탭 복귀·재진입 시
  // useFortuneJob 이 같은 잡을 재구독 → AI 재호출 0.
  useEffect(() => {
    if (isArchiveMode) return;
    if (testGen) return;              // testgen 모드: 라이브잡 대신 test 2-pass 자동 실행(아래 effect)
    if (!result) return;
    if (effectiveJobId) return;       // 이미 잡 있음 (URL ?jobId 또는 createdJobId)
    if (needsProfileSelect) return;

    const effectKey = `${result.pillars.year.gan}${result.pillars.year.zhi}-${result.pillars.month.gan}${result.pillars.month.zhi}-${result.pillars.day.gan}${result.pillars.day.zhi}`;
    if (apiCalledKeyRef.current === effectKey) return;
    apiCalledKeyRef.current = effectKey;

    let cancelled = false;
    setReportLoading(true);

    const run = async () => {
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

        // birth source — 서버 보관함 매칭에 쓰이는 원본 정보
        const yStr = searchParams?.get('year');
        const mStr = searchParams?.get('month');
        const dStr = searchParams?.get('day');
        const hourStr = searchParams?.get('hour');
        const minuteStr = searchParams?.get('minute');
        const genderStr = (searchParams?.get('gender') || 'male') as 'male' | 'female';
        const calendarType = (searchParams?.get('calendarType') || 'solar') as 'solar' | 'lunar';
        const unknownTime = searchParams?.get('unknownTime') === 'true';

        const birthDate = yStr && mStr && dStr
          ? `${yStr.padStart(4, '0')}-${mStr.padStart(2, '0')}-${dStr.padStart(2, '0')}`
          : targetProfile?.birth_date ?? '';
        const birthTime = unknownTime
          ? null
          : hourStr && minuteStr
            ? `${hourStr.padStart(2, '0')}:${minuteStr.padStart(2, '0')}`
            : targetProfile?.birth_time ?? null;
        const birthPlace = targetProfile?.birth_place ?? '서울';

        // idempotencyKey — birth + 1분 단위 시각. 같은 사용자가 1분 내 같은 birth 로
        // 재요청(예: 더블 클릭, 네트워크 재시도) 시 서버에서 중복 차감 차단.
        const minuteBucket = Math.floor(Date.now() / 60000);
        const idempotencyKey = `${birthDate}:${birthTime ?? 'unknown'}:${genderStr}:${calendarType}:${minuteBucket}`;

        const res = await fetch('/api/fortune/jobs/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            category: 'traditional',
            sajuResult: result,
            profileId: targetProfile?.id,
            sourceBirth: {
              birthDate,
              birthTime,
              birthPlace,
              gender: genderStr,
              calendarType,
            },
            idempotencyKey,
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

        const { jobId } = (await res.json()) as { jobId: string; deduplicated?: boolean };
        if (cancelled) return;

        // URL ?jobId 로 replace — birth 파라미터 제거. 새로고침·재진입 시 같은 잡 재구독.
        const newUrl = new URL(window.location.href);
        ['year', 'month', 'day', 'hour', 'minute', 'gender', 'calendarType', 'longitude', 'unknownTime', 'fresh', 'targetDate']
          .forEach((k) => newUrl.searchParams.delete(k));
        newUrl.searchParams.set('jobId', jobId);
        window.history.replaceState(null, '', newUrl.toString());

        setCreatedJobId(jobId);
        // 이후 useFortuneJob 이 Realtime 구독을 시작하고
        // 결과 동기화 useEffect 가 status='done' 도착 시 setReport.
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : '풀이 요청 중 오류가 발생했어요.';
          setReport({ success: false, error: msg });
          setReportLoading(false);
        }
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [result, isArchiveMode, effectiveJobId, needsProfileSelect, searchParams, targetProfile]);

  // ── TEST 프롬프트로 재생성 — /api/test/jungtongsaju (크레딧·DB 미반영) ──
  const runTestPrompt = async () => {
    if (!result || testGenLoading) return;
    setTestGenLoading(true);
    setReportLoading(true); // 생성 동안 로딩바 표시(2-pass ~1~3분)
    setReport(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setReport({ success: false, error: '로그인이 필요해요.' });
        setTestGenLoading(false);
        setReportLoading(false);
        return;
      }
      const res = await fetch('/api/test/jungtongsaju', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ sajuResult: result }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setReport({ success: false, error: data.error ?? 'TEST 생성 실패' });
      } else {
        setReport({ success: true, sections: data.sections, adviceMeta: data.adviceMeta });
      }
    } catch (e) {
      setReport({ success: false, error: e instanceof Error ? e.message : 'TEST 생성 오류' });
    } finally {
      setTestGenLoading(false);
      setReportLoading(false);
    }
  };

  // ── testgen 다이렉트 모드: 허진우 등 birth 파라미터로 진입 시 라이브잡 대신 test 2-pass 자동 실행 ──
  useEffect(() => {
    if (!testGen || !result || testGenRanRef.current) return;
    testGenRanRef.current = true;
    void runTestAllSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testGen, result]);

  // ── testgen 순차 생성 — 섹션별 집중 생성(톤 강함)으로 위에서부터 채움 + 앞 섹션 중복회피 ──
  const runTestAllSections = async () => {
    if (!result) return;
    setTestGenLoading(true);
    setReportLoading(true);
    setReport({ success: true, sections: {} });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setReport({ success: false, error: '로그인이 필요해요.' });
        return;
      }
      const acc: Record<string, string> = {};
      let adviceMetaAcc: unknown = undefined;
      for (const key of JUNGTONGSAJU_SECTION_KEYS) {
        const priorSections = Object.entries(acc).map(([k, t]) => ({
          label: k === 'advice' ? '개운법' : (JUNGTONGSAJU_SECTION_LABELS[k as keyof typeof JUNGTONGSAJU_SECTION_LABELS] ?? k),
          text: t,
        }));
        try {
          const res = await fetch('/api/test/jungtongsaju/section', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            body: JSON.stringify({ sajuResult: result, section: key, priorSections }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            acc[key] = data.text;
            if (key === 'advice' && data.adviceMeta) adviceMetaAcc = data.adviceMeta;
            // 도착하는 대로 화면에 채움(첫 섹션부터 보임)
            setReport({ success: true, sections: { ...acc }, adviceMeta: adviceMetaAcc as JungtongsajuAIResult['adviceMeta'] });
            if (Object.keys(acc).length === 1) setReportLoading(false);
          }
        } catch (e) {
          console.error('[testgen]', key, e);
        }
      }
      if (Object.keys(acc).length === 0) {
        setReport({ success: false, error: 'TEST 생성 실패' });
      }
    } catch (e) {
      setReport({ success: false, error: e instanceof Error ? e.message : 'TEST 생성 오류' });
    } finally {
      setTestGenLoading(false);
      setReportLoading(false);
    }
  };

  // ── 섹션 단건 재생성 — /api/test/jungtongsaju/section (그 섹션만 교체) ──
  const regenSection = async (key: string) => {
    if (!result || sectionLoading) return;
    setSectionLoading(key);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) { alert('로그인이 필요해요.'); return; }
      // 이미 생성된 다른 섹션들 — 반복 회피 컨텍스트로 함께 전송
      const priorSections = Object.entries(report?.sections ?? {})
        .filter(([k, t]) => k !== key && !!t)
        .map(([k, t]) => ({
          label: k === 'advice' ? '개운법' : (JUNGTONGSAJU_SECTION_LABELS[k as keyof typeof JUNGTONGSAJU_SECTION_LABELS] ?? k),
          text: t as string,
        }));

      const res = await fetch('/api/test/jungtongsaju/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ sajuResult: result, section: key, priorSections }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error ?? '섹션 재생성 실패');
        return;
      }
      setReport(prev => prev ? {
        ...prev,
        sections: { ...(prev.sections ?? {}), [key]: data.text },
        ...(key === 'advice' && data.adviceMeta ? { adviceMeta: data.adviceMeta } : {}),
      } : prev);
    } catch (e) {
      alert(e instanceof Error ? e.message : '섹션 재생성 오류');
    } finally {
      setSectionLoading(null);
    }
  };

  // ── 프로필 선택 가드 ──────────────────────────────────
  if (needsProfileSelect) {
    return (
      <TestFortuneProfileSelect
        serviceName="정통 사주"
        archiveCategory="traditional"
        creditType="moon"
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
        startedAt={fortuneJob?.startedAt}
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
      {/* ── TEST 프롬프트 생성 버튼 (개발자 전용, 크레딧·DB 미반영) ── */}
      <button
        type="button"
        onClick={() => { testGenRanRef.current = true; void runTestAllSections(); }}
        disabled={testGenLoading || !result}
        className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-full bg-black/80 text-white text-sm font-bold shadow-lg backdrop-blur disabled:opacity-50"
      >
        {testGenLoading ? 'TEST 생성 중…' : 'TEST 프롬프트로 생성'}
      </button>

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
        {/* result.solarDate 는 진태양시 보정 후 시각이라 노출 X. 사용자 입력 원본 시간(displayBirthTime) 사용. */}
        {/* 보관함 모드면 record 의 풀이 시점 프로필명 스냅샷(archiveProfileName) 우선 — 대표 프로필 fallback 차단. */}
        {(() => {
          const displayName = isArchiveMode ? archiveProfileName : (targetProfile?.name ?? null);
          return displayName ? `${displayName} · ` : '';
        })()}
        {result.solarDate.slice(0, 10)}{displayBirthTime ? ` ${displayBirthTime}` : ''} (양력) | {result.lunarDateSimple} (음력)
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
        만세력 데이터 보드 — 정통사주에서는 사주원국 + 천간/지지 관계까지만 노출.
        오행/십성·신강신약·용신·격국·대운수는 hideAnalysis 로 숨김 (AI 풀이가 별도 카드로 다룸).
        만세력 페이지(/saju/manseryeok)는 defaultExpanded={true} 로 모두 펼침.
      */}
      <SajuReport result={result} hideAnalysis />

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

      {/* 평생 운세 흐름 그래프 — 1~99세 종합 운세 점수 시각화 (사주 총론 위에 위치) */}
      {result && <LifetimeFortuneChart saju={result} />}

      {/* rawText fallback — 섹션 파싱 실패 시에만 표시 (sections 우선) */}
      {report?.rawText && !report?.sections && (
        <div className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <p className="text-[15px] text-text-secondary leading-relaxed whitespace-pre-line">
            {renderEmphasizedBody(stripAllSectionTags(report.rawText))}
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

            // 은유 부제목 추출 + 본문에서 마커 strip — utils/parseMetaphor 의 견고한 파서로 통일.
            // (이전 단순 정규식은 [은유] / 【은유】 / **[은유]** / 본문 중간 위치 등 변형을 못 잡아
            //  보관함 옛 record 재생 시 본문에 마커가 그대로 노출되는 사고가 있었음)
            const { metaphorTitle, bodyText } = extractMetaphor(text);

            return (
              <SectionCollapsible
                key={key}
                title={key === 'advice' ? '개운법' : JUNGTONGSAJU_SECTION_LABELS[key]}
                metaphorTitle={metaphorTitle}
                defaultOpen={idx === 0}
                enterDelay={0.06 * idx}
              >
                {/* 섹션 단건 재생성 (개발자 전용 — 프롬프트 튜닝) */}
                <button
                  type="button"
                  onClick={() => regenSection(key)}
                  disabled={sectionLoading !== null}
                  className="mb-2 px-2.5 py-1 rounded-md bg-black/40 text-white text-[12px] font-medium border border-white/15 disabled:opacity-50"
                >
                  {sectionLoading === key ? '재생성 중…' : '이 섹션만 재생성'}
                </button>
                {isAdvice && report.adviceMeta ? (
                  /* AdviceCard 에 renderBody 주입 → 마커(==,**) 볼드 렌더. body 는 한자병기만 정리(마커 보존) */
                  <AdviceCard
                    yongSinElement={result.yongSinElement}
                    meta={{ ...report.adviceMeta, body: cleanKeepMarkers(report.adviceMeta.body ?? '') }}
                    renderBody={renderEmphasizedBody}
                  />
                ) : key === 'luck' ? (
                  /* 대운·세운 — LuckVisual 에 renderBody 주입 → 대운별 본문 볼드 렌더.
                     본문은 한자병기 정리 + 줄바꿈 정상화(마커는 보존) */
                  renderJungtongsajuSectionVisual('luck', result, cleanKeepMarkers(bodyText, true), renderEmphasizedBody)
                ) : (
                  <>
                    {/* 섹션별 시각 데이터 카드 — 본문 줄글 위 한눈 요약 */}
                    {renderJungtongsajuSectionVisual(key, result)}
                    <div className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
                      {bodyText.split(/\n\n+/).map((para, pi) => (
                        <p key={pi} className="whitespace-pre-line">{renderEmphasizedBody(para.trim())}</p>
                      ))}
                    </div>
                  </>
                )}
              </SectionCollapsible>
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

      <ResultFooterActions />

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
