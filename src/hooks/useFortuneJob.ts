// src/hooks/useFortuneJob.ts
// 백그라운드 풀이 잡(saju_records row)의 상태를 Realtime 으로 구독하는 hook.
//
// 사용처:
//   - 결과 페이지: ?jobId=xxx 진입 시 → 모래시계/풀이 표시 전환
//   - (향후) 보관함: 진행 중 row 의 상태 변화 추적
//
// 패턴:
//   1. 마운트 시 supabase channel subscribe (postgres_changes UPDATE)
//   2. 직후 .select() 으로 현재 상태 1회 fetch (race condition 방지)
//   3. status·interpretation_detailed·error_message 변경 시 state 갱신
//   4. 언마운트 시 unsubscribe

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';

export type FortuneJobStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface FortuneJobSnapshot {
  jobId: string;
  status: FortuneJobStatus;
  interpretationDetailed: string | null;
  interpretationBasic: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  /** result_data 컬럼 — 결과 페이지가 만세력 다시 계산 없이 사용 */
  resultData: Record<string, unknown> | null;
  /** category — 미래 다른 운세 확장 시 분기용 */
  category: string;
  /** 본인 birth 정보 (잡 모드에서 보관함처럼 두 사람·만세력 복원용) */
  birthDate: string | null;
  birthTime: string | null;
  birthPlace: string | null;
  gender: 'male' | 'female' | null;
  calendarType: 'solar' | 'lunar' | null;
  profileName: string | null;
  /** 상대 정보 — gunghap·궁합류 카테고리에서 필수 */
  partnerName: string | null;
  partnerBirthDate: string | null;
  /** engine_result — 카테고리별 메타 (gunghapCategory·역할·custom 라벨·pet 등) */
  engineResult: Record<string, unknown> | null;
}

interface UseFortuneJobReturn {
  job: FortuneJobSnapshot | null;
  loading: boolean;
  /** 잡이 존재하지 않음(권한 없음/잘못된 id 등) */
  notFound: boolean;
}

/** 잡이 저장되는 테이블. 타로는 별도 tarot_records 사용. 기본 saju_records. */
export type FortuneJobTable = 'saju_records' | 'tarot_records';

// 테이블별 SELECT 컬럼 — tarot_records 는 interpretation 단일 컬럼 (saju 의 detailed/basic 대응)
const SELECT_COLUMNS: Record<FortuneJobTable, string> = {
  saju_records:
    'id, status, interpretation_detailed, interpretation_basic, error_message, started_at, completed_at, result_data, category, birth_date, birth_time, birth_place, gender, calendar_type, profile_name, partner_name, partner_birth_date, engine_result',
  tarot_records:
    'id, status, interpretation, error_message, started_at, completed_at, spread_type, question, cards',
};

export function useFortuneJob(
  jobId: string | null,
  table: FortuneJobTable = 'saju_records',
): UseFortuneJobReturn {
  const [job, setJob] = useState<FortuneJobSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(!!jobId);
  const [notFound, setNotFound] = useState<boolean>(false);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setLoading(false);
      setNotFound(false);
      return;
    }

    let cancelled = false;
    let terminal = false; // done/failed 도달 시 재조회 불필요
    let pollId: ReturnType<typeof setInterval> | null = null;
    const stopPoll = () => { if (pollId) { clearInterval(pollId); pollId = null; } };
    setLoading(true);
    setNotFound(false);

    const applyRow = (row: Record<string, unknown>) => {
      const st = row.status as string | undefined;
      // ★ 상태 역행 방지 — 이미 done/failed 에 도달했으면, 뒤늦게 도착한 비종료(pending/processing)
      //   이벤트는 무시한다. 모바일(Safari) 백그라운드 동안 Realtime WebSocket 이 버퍼링한 옛 'processing'
      //   UPDATE 가 복귀 후 done 보다 늦게 재생되어 결과→로딩으로 되돌아가는 현상(결과 0.5초 깜빡임 후
      //   93% 로딩 멈춤)을 차단한다.
      if (terminal && st !== 'done' && st !== 'failed') return;
      if (st === 'done' || st === 'failed') { terminal = true; stopPoll(); }
      setJob((prev) => mergeRow(prev, jobId, row, table));
    };

    // 1) 먼저 channel subscribe — 마운트 직후 변경 이벤트 놓치지 않게
    const channel = supabase
      .channel(`fortune-job:${table}:${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table,
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          if (cancelled) return;
          applyRow(payload.new as Record<string, unknown>);
        },
      )
      .subscribe();

    // 2) 현재 상태 fetch (subscribe race 방지 + 탭 복귀/폴링 시 재조회로 재사용)
    const fetchOnce = async (isInitial = false) => {
      const { data, error } = await supabase
        .from(table)
        .select(SELECT_COLUMNS[table])
        .eq('id', jobId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        // 최초 조회 실패만 notFound 처리(RLS 로 다른 사용자 row 등).
        // 폴링 중 일시적 네트워크 오류는 무시하고 다음 틱에 재시도 — 진행 중 화면이 깨지지 않게.
        if (isInitial) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      applyRow(data as unknown as Record<string, unknown>);
      setLoading(false);
    };
    void fetchOnce(true);

    // 2-b) 폴링 폴백 — Realtime UPDATE 를 놓쳐도(채널 미구독/WS 끊김/이벤트 누락) 같은 탭에
    //      머무는 동안 done/failed 로 전환되도록 주기적으로 재조회한다.
    //      증상: 로딩 게이지가 100% 찬 채 결과로 안 넘어가는데 보관함엔 결과가 있음 → 이 폴백으로 해소.
    pollId = setInterval(() => {
      if (!cancelled && !terminal) void fetchOnce(false);
    }, 4000);

    // 3) 백그라운드 탭 복귀 시 재조회 — realtime WebSocket 이 끊기고 setInterval 이 모바일에서
    //    얼어 done UPDATE 를 놓쳐도, 복귀 즉시 1회 재조회해 상태를 보정한다.
    //    ★ 모바일(특히 iOS Safari)은 앱 전환 복귀 시 visibilitychange/focus 가 불안정하고
    //      pageshow(bfcache 복원)로 돌아오는 경우가 많아 함께 구독한다. online(네트워크 복구)도 포함.
    //      (증상: 모바일에서 생성 중 다른 앱 갔다 오면 결과로 안 넘어가고 로딩에서 멈춤 → 이 보정으로 해소)
    const kick = () => { if (!cancelled && !terminal) void fetchOnce(false); };
    const onVisible = () => { if (document.visibilityState === 'visible') kick(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', kick);
    window.addEventListener('pageshow', kick);
    window.addEventListener('online', kick);

    return () => {
      cancelled = true;
      stopPoll();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', kick);
      window.removeEventListener('pageshow', kick);
      window.removeEventListener('online', kick);
      void supabase.removeChannel(channel);
    };
  }, [jobId, table]);

  return { job, loading, notFound };
}

function mergeRow(
  prev: FortuneJobSnapshot | null,
  jobId: string,
  row: Record<string, unknown>,
  table: FortuneJobTable = 'saju_records',
): FortuneJobSnapshot {
  // tarot_records 는 interpretation 단일 컬럼 — saju 의 detailed/basic 양쪽에 매핑.
  const interpDetailed =
    table === 'tarot_records'
      ? (row.interpretation as string | null)
      : (row.interpretation_detailed as string | null);
  const interpBasic =
    table === 'tarot_records'
      ? (row.interpretation as string | null)
      : (row.interpretation_basic as string | null);
  return {
    jobId,
    status: (row.status as FortuneJobStatus) ?? prev?.status ?? 'pending',
    interpretationDetailed: interpDetailed ?? prev?.interpretationDetailed ?? null,
    interpretationBasic: interpBasic ?? prev?.interpretationBasic ?? null,
    errorMessage: (row.error_message as string | null) ?? prev?.errorMessage ?? null,
    startedAt: (row.started_at as string | null) ?? prev?.startedAt ?? null,
    completedAt: (row.completed_at as string | null) ?? prev?.completedAt ?? null,
    resultData: (row.result_data as Record<string, unknown> | null) ?? prev?.resultData ?? null,
    category: (row.category as string) ?? prev?.category ?? 'traditional',
    birthDate: (row.birth_date as string | null) ?? prev?.birthDate ?? null,
    birthTime: (row.birth_time as string | null) ?? prev?.birthTime ?? null,
    birthPlace: (row.birth_place as string | null) ?? prev?.birthPlace ?? null,
    gender: (row.gender as 'male' | 'female' | null) ?? prev?.gender ?? null,
    calendarType:
      (row.calendar_type as 'solar' | 'lunar' | null) ?? prev?.calendarType ?? null,
    profileName: (row.profile_name as string | null) ?? prev?.profileName ?? null,
    partnerName: (row.partner_name as string | null) ?? prev?.partnerName ?? null,
    partnerBirthDate:
      (row.partner_birth_date as string | null) ?? prev?.partnerBirthDate ?? null,
    engineResult:
      (row.engine_result as Record<string, unknown> | null) ?? prev?.engineResult ?? null,
  };
}
