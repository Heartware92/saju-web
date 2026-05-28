'use client';

/**
 * 보관함(Archive) 저장 헬퍼
 *
 * 각 풀이 서비스 함수가 성공한 뒤 호출. 내부에서 다음을 자동 처리:
 *  1. 로그인 여부 확인 — 비로그인 유저는 조용히 skip
 *  2. 대표 birth_profile 자동 조회 — 없으면 조용히 skip
 *  3. saju_records / tarot_records INSERT
 *  4. 모든 실패는 catch → console.error 로 끝내고 호출자에게 예외를 던지지 않음
 *     (저장 실패가 풀이 반환을 막지 않도록 완전 격리)
 *
 * 호출 패턴:
 *   archiveSaju({ category: 'newyear', interpretation: content, ... }).catch(() => {});
 *   .catch는 안전망이지만 이미 내부 try-catch 가 있으므로 보통 불필요.
 */

import { auth, sajuDB, tarotDB, supabase } from './supabase';

export type ArchiveCategory =
  | 'traditional'  // 정통 사주
  | 'basic'        // 무료 기본 해석
  | 'today'        // 실시간 운세 (내부 키 today legacy 유지)
  | 'newyear'      // 신년운세
  | 'taekil'       // 택일 운세
  | 'tojeong'      // 토정비결
  | 'zamidusu'     // 자미두수
  | 'period'       // 지정일 운세
  | 'gunghap'      // 궁합
  | 'love'         // 더많은운세: 애정운
  | 'wealth'       // 더많은운세: 재물운
  | 'career'       // 더많은운세: 직업·진로운
  | 'health'       // 더많은운세: 건강운
  | 'study'        // 더많은운세: 학업·시험운
  | 'people'       // 더많은운세: 귀인운
  | 'children'     // 더많은운세: 자녀·출산운
  | 'personality'  // 더많은운세: 성격 심층
  | 'name'         // 더많은운세: 이름 풀이
  | 'dream';       // 더많은운세: 꿈 해몽

interface ArchiveSajuParams {
  category: ArchiveCategory;
  resultData?: Record<string, unknown>;
  engineResult?: Record<string, unknown>;
  interpretation?: string;
  question?: string;
  creditType?: 'sun' | 'moon';
  creditUsed?: number;
  isDetailed?: boolean;
  /** 호출자가 이미 profile_id 를 알고 있으면 직접 전달 — sourceBirth 매칭을 건너뛴다. */
  profileId?: string;
  sourceBirth?: {
    birth_date: string;
    birth_time?: string;
    gender: 'male' | 'female';
    calendar_type?: 'solar' | 'lunar';
  };
  partner?: {
    name: string;
    birth_date: string;
  };
}

/**
 * 사주 기반 풀이 기록 저장 (silent).
 * - sourceBirth 가 있으면 그 birth 로 birth_profiles 매칭 → profile_id/name 자동 기록
 * - 없으면 대표 프로필 사용 (옛날 호출자용)
 * - 둘 다 없으면 skip
 *
 * 매칭 키: user_id + birth_date + gender (calendar_type 까지 일치하면 더 정확).
 * 동일 birth 프로필이 여러 개면 대표 → 생성순으로 첫 번째.
 */
export async function archiveSaju(params: ArchiveSajuParams): Promise<string | null> {
  try {
    const user = await auth.getCurrentUser();
    if (!user) return null;

    type Profile = {
      id: string;
      name: string;
      birth_date: string;
      birth_time?: string | null;
      birth_place?: string | null;
      gender: 'male' | 'female';
      calendar_type: 'solar' | 'lunar';
    };
    let profile: Profile | null = null;

    // 0) 호출자가 profileId 를 직접 전달하면 DB 조회로 바로 확정
    if (params.profileId) {
      const { data } = await supabase
        .from('birth_profiles')
        .select('id, name, birth_date, birth_time, birth_place, gender, calendar_type')
        .eq('id', params.profileId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) profile = data as Profile;
    }

    // 1) sourceBirth 로 매칭 시도
    if (!profile && params.sourceBirth) {
      let q = supabase
        .from('birth_profiles')
        .select('id, name, birth_date, birth_time, birth_place, gender, calendar_type')
        .eq('user_id', user.id)
        .eq('birth_date', params.sourceBirth.birth_date)
        .eq('gender', params.sourceBirth.gender);
      if (params.sourceBirth.calendar_type) {
        q = q.eq('calendar_type', params.sourceBirth.calendar_type);
      }
      const { data: matches } = await q
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1);
      if (matches && matches.length > 0) profile = matches[0] as Profile;
    }

    // 2) 매칭 실패 시 대표 프로필 fallback
    if (!profile) {
      const { data } = await supabase
        .from('birth_profiles')
        .select('id, name, birth_date, birth_time, birth_place, gender, calendar_type')
        .eq('user_id', user.id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) profile = data as Profile;
    }

    // 3) 프로필이 전혀 없으면 sourceBirth 라도 있어야 저장
    const birth = profile ?? (params.sourceBirth
      ? {
          id: '',
          name: '',
          birth_date: params.sourceBirth.birth_date,
          birth_time: params.sourceBirth.birth_time ?? null,
          birth_place: null,
          gender: params.sourceBirth.gender,
          calendar_type: params.sourceBirth.calendar_type ?? 'solar',
        }
      : null);

    if (!birth) return null;

    const payload = {
      user_id: user.id,
      birth_date: birth.birth_date,
      birth_time: birth.birth_time ?? undefined,
      birth_place: birth.birth_place ?? undefined,
      gender: birth.gender,
      calendar_type: birth.calendar_type ?? 'solar',
      category: params.category,
      result_data: (params.resultData ?? {}) as Record<string, unknown>,
      engine_result: params.engineResult,
      interpretation_detailed: params.interpretation,
      credit_type: params.creditType,
      credit_used: params.creditUsed ?? 0,
      is_detailed: params.isDetailed ?? false,
      // 신규 컬럼 — 누구의 풀이인지 식별 가능하게
      profile_id: birth.id || null,
      profile_name: birth.name || null,
      partner_name: params.partner?.name ?? null,
      partner_birth_date: params.partner?.birth_date ?? null,
    };

    const saved = await sajuDB.saveRecord(payload as unknown as Parameters<typeof sajuDB.saveRecord>[0]);
    return saved?.id ?? null;
  } catch (err) {
    console.error('[archive] saju save failed', err);
    return null;
  }
}

/**
 * 보관함에서 같은 카테고리의 같은 사주(+ 컨텍스트) record 가장 최근 1건 조회.
 *
 * 페이지 진입 시 호출 → record 있으면 "이전에 본 풀이가 있어요" 모달 표시 후
 * 사용자가 [기존 결과 보기] 선택 시 ?recordId=... 로 보관함 재생 모드 진입.
 *
 * @param params.context 카테고리별 추가 매칭 키 — engine_result jsonb 안의 필드.
 *   예: 신년운세 { key: 'year', value: '2026' }, 지정일 { key: 'isoDate', value: '2026-04-30' }
 *   생략하면 카테고리+사주만으로 매칭 (정통사주·자미두수·토정비결 등 컨텍스트 없는 풀이용)
 *
 * @returns 매칭 record 정보 또는 null. 비로그인·DB 오류·매칭 실패 모두 null 로 통일.
 */
export async function findRecentArchive(params: {
  category: ArchiveCategory;
  birth_date: string;          // YYYY-MM-DD
  gender: 'male' | 'female';
  context?: { key: string; value: string };
  profile_id?: string;
}): Promise<{ id: string; created_at: string } | null> {
  try {
    const user = await auth.getCurrentUser();
    if (!user) return null;
    let q = supabase
      .from('saju_records')
      .select('id, created_at')
      .eq('user_id', user.id)
      .eq('category', params.category)
      .eq('birth_date', params.birth_date)
      .eq('gender', params.gender)
      .order('created_at', { ascending: false });
    if (params.profile_id) {
      q = q.eq('profile_id', params.profile_id);
    }
    if (params.context) {
      q = q.eq(`engine_result->>${params.context.key}`, params.context.value);
    }
    const { data, error } = await q.limit(1).maybeSingle();
    if (error || !data) return null;
    return { id: (data as { id: string }).id, created_at: (data as { created_at: string }).created_at };
  } catch (err) {
    console.error('[archive] findRecentArchive failed', err);
    return null;
  }
}

/**
 * 지정일 운세 등 같은 카테고리의 모든 기록을 날짜별로 반환.
 * QuickFortuneGate에서 "기존 결과 보기" 날짜 목록 표시에 사용.
 */
export interface ArchiveListItem {
  id: string;
  created_at: string;
  context_date?: string;
  context_category?: string;
  context_category_label?: string;
}

export async function findArchiveList(params: {
  category: ArchiveCategory;
  birth_date: string;
  gender: 'male' | 'female';
  profile_id?: string;
  limit?: number;
  /** engine_result.source 로 필터 — 같은 category 안에서 진입 흐름별 분리 (예: newyear vs year-fortune) */
  sourceFilter?: string;
}): Promise<ArchiveListItem[]> {
  try {
    const user = await auth.getCurrentUser();
    if (!user) return [];
    let q = supabase
      .from('saju_records')
      .select('id, created_at, engine_result')
      .eq('user_id', user.id)
      .eq('category', params.category)
      .eq('birth_date', params.birth_date)
      .eq('gender', params.gender)
      .order('created_at', { ascending: false });
    if (params.profile_id) {
      q = q.eq('profile_id', params.profile_id);
    }
    if (params.sourceFilter) {
      // jsonb engine_result->>source 가 정확히 일치하는 record 만
      q = q.eq('engine_result->>source', params.sourceFilter);
    }
    if (params.limit) {
      q = q.limit(params.limit);
    } else {
      q = q.limit(30);
    }
    const { data, error } = await q;
    if (error || !data) return [];
    return (data as { id: string; created_at: string; engine_result?: Record<string, unknown> }[]).map(row => {
      const eng = row.engine_result ?? {};
      // ★ categoryLabel 옛 record 호환 fallback — 옛 풀이엔 categoryLabel 필드 자체가 없음.
      //   카테고리별로 원본 입력값에서 추출:
      //   · name 카테고리: koreanName
      //   · dream 카테고리: dreamText 첫 15자 + ellipsis
      //   · 기타: undefined (날짜만 표시)
      let categoryLabel = eng.categoryLabel as string | undefined;
      if (!categoryLabel) {
        if (params.category === 'name' && typeof eng.koreanName === 'string') {
          categoryLabel = eng.koreanName;
        } else if (params.category === 'dream' && typeof eng.dreamText === 'string') {
          const dt = eng.dreamText.trim();
          categoryLabel = dt.length > 8 ? `${dt.slice(0, 8)}…` : dt;
        }
      }
      return {
        id: row.id,
        created_at: row.created_at,
        context_date: (eng.isoDate as string) ?? undefined,
        context_category: (eng.category as string) ?? undefined,
        context_category_label: categoryLabel,
      };
    });
  } catch (err) {
    console.error('[archive] findArchiveList failed', err);
    return [];
  }
}

export interface GunghapArchiveItem {
  id: string;
  created_at: string;
  profile_name: string;
  partner_name: string;
  gunghap_category: string;
  custom_label?: string;
}

export async function findGunghapArchives(limit = 20): Promise<GunghapArchiveItem[]> {
  try {
    const user = await auth.getCurrentUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('saju_records')
      .select('id, created_at, profile_name, partner_name, partner_birth_date, engine_result')
      .eq('user_id', user.id)
      .eq('category', 'gunghap')
      // 진행 중·실패 잡은 제외 — 백그라운드 완료(status=done)된 결과만 목록에 노출.
      // 옛 row 는 037 마이그레이션으로 status 기본값 'done'.
      .eq('status', 'done')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    // 마이그레이션된 옛 행은 partner_name·partner_birth_date 가 NULL 인 경우가 많음.
    // 빈 값은 빈 문자열로 그대로 두고, UI 에서 fallback 라벨 표시 (placeholder 도배 방지).
    return (data as { id: string; created_at: string; profile_name?: string; partner_name?: string; partner_birth_date?: string; engine_result?: Record<string, unknown> }[])
      .map(row => ({
        id: row.id,
        created_at: row.created_at,
        profile_name: row.profile_name ?? '나',
        partner_name: row.partner_name
          ?? (row.partner_birth_date ? row.partner_birth_date.replace(/-/g, '.') : ''),
        gunghap_category: (row.engine_result?.gunghapCategory as string) ?? '',
        custom_label: (row.engine_result?.customLabel as string) ?? undefined,
      }));
  } catch (err) {
    console.error('[archive] findGunghapArchives failed', err);
    return [];
  }
}

export async function findRecentArchivesBatch(params: {
  category: ArchiveCategory;
  profileIds: string[];
  context?: { key: string; value: string };
}): Promise<Record<string, { id: string; created_at: string }>> {
  try {
    const user = await auth.getCurrentUser();
    if (!user || params.profileIds.length === 0) return {};

    let q = supabase
      .from('saju_records')
      .select('id, created_at, profile_id')
      .eq('user_id', user.id)
      .eq('category', params.category)
      .in('profile_id', params.profileIds)
      .order('created_at', { ascending: false });

    if (params.context) {
      q = q.eq(`engine_result->>${params.context.key}`, params.context.value);
    }

    const { data, error } = await q;
    if (error || !data) return {};

    const result: Record<string, { id: string; created_at: string }> = {};
    for (const row of data as { id: string; created_at: string; profile_id: string }[]) {
      if (row.profile_id && !result[row.profile_id]) {
        result[row.profile_id] = { id: row.id, created_at: row.created_at };
      }
    }
    return result;
  } catch (err) {
    console.error('[archive] findRecentArchivesBatch failed', err);
    return {};
  }
}

interface ArchiveTarotParams {
  spreadType: string;
  cards: Record<string, unknown>;
  question?: string;
  interpretation?: string;
  creditType?: 'sun' | 'moon';
  creditUsed?: number;
}

/** 타로 풀이 기록 저장. 인증·DB 실패는 콘솔에 명시 로그 (silent X) — 보관함 미저장 디버깅용. */
export async function archiveTarot(params: ArchiveTarotParams): Promise<string | null> {
  try {
    const user = await auth.getCurrentUser();
    if (!user) {
      console.warn('[archive] tarot save SKIPPED — no auth user. spreadType=', params.spreadType);
      return null;
    }

    const payload = {
      user_id: user.id,
      spread_type: params.spreadType,
      cards: params.cards,
      question: params.question,
      interpretation: params.interpretation,
      credit_type: params.creditType,
      credit_used: params.creditUsed ?? 0,
    };

    const saved = await tarotDB.saveRecord(payload as unknown as Parameters<typeof tarotDB.saveRecord>[0]);
    return saved?.id ?? null;
  } catch (err) {
    console.error('[archive] tarot save FAILED', { spreadType: params.spreadType, err });
    return null;
  }
}
