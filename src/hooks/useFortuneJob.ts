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

export function useFortuneJob(jobId: string | null): UseFortuneJobReturn {
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
    setLoading(true);
    setNotFound(false);

    // 1) 먼저 channel subscribe — 마운트 직후 변경 이벤트 놓치지 않게
    const channel = supabase
      .channel(`fortune-job:${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'saju_records',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          if (cancelled) return;
          const row = payload.new as Record<string, unknown>;
          setJob((prev) => mergeRow(prev, jobId, row));
        },
      )
      .subscribe();

    // 2) 직후 현재 상태 1회 fetch (subscribe race 방지)
    void (async () => {
      const { data, error } = await supabase
        .from('saju_records')
        .select(
          'id, status, interpretation_detailed, interpretation_basic, error_message, started_at, completed_at, result_data, category, birth_date, birth_time, birth_place, gender, calendar_type, profile_name, partner_name, partner_birth_date, engine_result',
        )
        .eq('id', jobId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        // RLS 로 다른 사용자 row 인 경우도 여기로 떨어짐
        setNotFound(true);
        setLoading(false);
        return;
      }

      setJob(mergeRow(null, jobId, data as Record<string, unknown>));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [jobId]);

  return { job, loading, notFound };
}

function mergeRow(
  prev: FortuneJobSnapshot | null,
  jobId: string,
  row: Record<string, unknown>,
): FortuneJobSnapshot {
  return {
    jobId,
    status: (row.status as FortuneJobStatus) ?? prev?.status ?? 'pending',
    interpretationDetailed:
      (row.interpretation_detailed as string | null) ?? prev?.interpretationDetailed ?? null,
    interpretationBasic:
      (row.interpretation_basic as string | null) ?? prev?.interpretationBasic ?? null,
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
