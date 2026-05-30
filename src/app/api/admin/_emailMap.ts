/**
 * user_id → email 매핑 — 어드민 목록 라우트 공용.
 *
 * records / consultations / orders / inquiries / phone-changes / jobs 등
 * 여러 라우트가 각자 supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }) 를
 * 매 요청마다 호출하던 것을 하나의 30초 공유 캐시 + in-flight dedup 으로 묶는다.
 *
 *  - 백엔드는 _cache.ts (메모리 또는 Upstash Redis) 를 그대로 사용.
 *  - 회원 정보 변경(크레딧/정지/메모/일괄)이 일어나면 해당 라우트들이 invalidateAll() 을
 *    호출하므로 이 캐시도 함께 비워진다.
 *  - Map 은 직렬화가 안 되므로 캐시에는 [id, email][] 배열로 저장하고 호출부에서 Map 으로 복원.
 *
 *  ⚠️ perPage: 1000 — Supabase auth 는 한 번에 최대 1000명. 회원이 1000명을 넘으면
 *     페이지네이션(listUsers page 순회)으로 확장 필요. (현재 MVP 스케일에서는 충분)
 */
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { cached, type CachedOptions } from './_cache';

export const EMAIL_MAP_CACHE_KEY = 'admin:emailmap:v1';
const EMAIL_MAP_TTL_SECONDS = 30;

export async function cachedEmailMap(opts?: CachedOptions): Promise<Map<string, string>> {
  const entries = await cached<[string, string][]>(
    EMAIL_MAP_CACHE_KEY,
    async () => {
      const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      return (data?.users ?? []).map(u => [u.id, u.email ?? ''] as [string, string]);
    },
    { ttl: EMAIL_MAP_TTL_SECONDS, ...opts },
  );
  return new Map(entries);
}
