/**
 * 어드민 집계 제외 계정 — 내부/테스트/슈퍼 계정을 모든 통계에서 빼기 위한 공용 유틸.
 *
 * 배경: 어드민 인증은 API 키 기반(_auth.ts)이라 test@test.com 같은 슈퍼/테스트 계정은
 *       DB 상으론 평범한 일반 유저다. 이 계정의 테스트 활동(운세 풀이·크레딧 소비·페이지뷰
 *       ·결제 시도 등)이 매출/이용/유입 집계에 섞이면 지표가 오염된다.
 *       → 모든 어드민 집계 라우트에서 user_id 기준으로 제외한다.
 *
 * 식별: 기본 제외 이메일은 test@test.com. 환경변수 ADMIN_EXCLUDED_EMAILS(쉼표구분)로 추가 가능.
 *       이메일 → user_id 해석은 listUsers 기반 cachedEmailMap 을 재사용(추가 왕복 없음).
 *
 * 주의(익명 페이지뷰): analytics_events 는 비로그인 시 user_id 가 null 이므로,
 *       슈퍼계정이 "로그아웃 상태"로 둘러본 트래픽은 식별 불가 → 제외 못 한다(불가피).
 *       로그인 상태 활동은 정상 제외된다.
 */
import { cached, type CachedOptions } from './_cache';
import { cachedEmailMap } from './_emailMap';
import { supabaseAdmin } from '@/services/supabaseAdmin';

/** 코드 기본 제외 계정 */
const DEFAULT_EXCLUDED_EMAILS = ['test@test.com'];

function configuredEmails(): Set<string> {
  const env = (process.env.ADMIN_EXCLUDED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set<string>([...DEFAULT_EXCLUDED_EMAILS.map((e) => e.toLowerCase()), ...env]);
}

export const EXCLUDED_IDS_CACHE_KEY = 'admin:excluded-ids:v1';
const TTL_SECONDS = 30;

/**
 * 제외 대상 user_id 집합 = (env/기본 이메일 → id) ∪ (admin_excluded_users 테이블, UI 토글).
 * 30초 캐시. 토글 시 invalidate(EXCLUDED_IDS_CACHE_KEY) 로 즉시 갱신.
 * 해석 실패해도 집계는 동작해야 하므로 빈 집합으로 degrade.
 */
export async function excludedUserIds(opts?: CachedOptions): Promise<Set<string>> {
  try {
    const ids = await cached<string[]>(
      EXCLUDED_IDS_CACHE_KEY,
      async () => {
        const out = new Set<string>();
        // 1) env/기본 이메일 → user_id
        const emails = configuredEmails();
        if (emails.size > 0) {
          const map = await cachedEmailMap(opts); // Map<id, email>
          for (const [id, email] of map) {
            if (email && emails.has(email.toLowerCase())) out.add(id);
          }
        }
        // 2) DB 토글(admin_excluded_users)
        const { data, error } = await supabaseAdmin.from('admin_excluded_users').select('user_id');
        if (error) console.error('[admin/_excluded] DB 제외목록 조회 실패(무시):', error.message);
        for (const r of data ?? []) if (r.user_id) out.add(r.user_id as string);
        return [...out];
      },
      { ttl: TTL_SECONDS, ...opts },
    );
    return new Set(ids);
  } catch (e) {
    console.error('[admin/_excluded] user_id 해석 실패 — 제외 미적용:', e);
    return new Set();
  }
}

/**
 * PostgREST 쿼리 빌더에 제외 필터(.not user_id in (...))를 적용.
 * ids 가 비면 쿼리를 그대로 반환(no-op). 체이닝 유지 위해 입력 타입 그대로 반환.
 */
export function excludeUsers<Q>(query: Q, ids: Set<string>, column = 'user_id'): Q {
  if (!ids.size) return query;
  // UUID 목록은 따옴표 없이 (a,b,c) 형식으로 전달
  return (query as { not: (c: string, op: string, v: string) => Q }).not(
    column,
    'in',
    `(${[...ids].join(',')})`,
  );
}

/** 이미 메모리에 올라온 행 배열에서 제외 user_id 를 거른다(JS 필터). */
export function filterExcludedRows<T extends { user_id?: string | null }>(rows: T[], ids: Set<string>): T[] {
  if (!ids.size) return rows;
  return rows.filter((r) => !(r.user_id && ids.has(r.user_id)));
}

/** auth.users 배열에서 제외 계정을 거른다(id 기준). */
export function filterExcludedUsers<T extends { id: string }>(users: T[], ids: Set<string>): T[] {
  if (!ids.size) return users;
  return users.filter((u) => !ids.has(u.id));
}
