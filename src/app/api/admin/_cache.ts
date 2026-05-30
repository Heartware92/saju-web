/**
 * 어드민 서버 캐시 — 과한 복잡도 없이 2가지를 해결
 *
 *  (1) TTL 메모리 캐시
 *      같은 요청이 30초 내 반복될 때 Supabase 왕복을 제거.
 *  (2) in-flight dedup (request collapsing)
 *      /api/admin/users 와 /api/admin/users/summary 가 동시에 진입해도
 *      loadAdminBundle 은 promise 1개로 공유됨.
 *
 *  ── Upstash Redis 백엔드 내장 (2026-05-30):
 *     UPSTASH_REDIS_REST_URL/TOKEN (또는 Vercel KV 의 KV_REST_API_URL/TOKEN) 환경변수가
 *     있으면 자동으로 Redis 백엔드로 동작하고, 없으면 메모리 백엔드로 폴백한다.
 *     별도 코드 변경/의존성 설치 없이 env 만 추가하면 인스턴스 간 공유 캐시가 켜진다.
 *
 *  ── 메모리 백엔드: Vercel serverless 인스턴스별로 캐시가 분리됨 + invalidateAll() 도
 *     현재 인스턴스만 비움. TTL 을 30초로 짧게 두어 불일치 창을 최소화.
 *  ── Redis 백엔드: 모든 인스턴스가 캐시를 공유하므로 적중률↑ + 쓰기 후 invalidate 가
 *     전 인스턴스에 즉시 반영됨 (정합성↑).
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export interface KVBackend {
  get<T>(key: string): Promise<CacheEntry<T> | null>;
  set<T>(key: string, value: CacheEntry<T>): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

/** 프로세스 로컬 메모리 백엔드 (Vercel serverless 인스턴스 수명 내 유효) */
class MemoryBackend implements KVBackend {
  private store = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return e as CacheEntry<T>;
  }
  async set<T>(key: string, value: CacheEntry<T>): Promise<void> {
    this.store.set(key, value as CacheEntry<unknown>);
  }
  async delete(key: string): Promise<void> { this.store.delete(key); }
  async clear(): Promise<void> { this.store.clear(); }
}

/**
 * Upstash Redis 백엔드 — 모든 인스턴스가 공유하는 KV 캐시.
 * 의존성 없이 Upstash REST API 를 fetch 로 직접 호출한다.
 * 모든 키는 NS 프리픽스로 격리 → clear() 가 공유 DB 의 다른 키를 건드리지 않음.
 * Redis 장애 시에는 throw 하지 않고 캐시 미스로 degrade (어드민이 멈추지 않도록).
 */
const REDIS_NS = 'sajuadmin:';

class RedisBackend implements KVBackend {
  constructor(private url: string, private token: string) {}

  private async cmd<R = unknown>(command: (string | number)[]): Promise<R | null> {
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
        cache: 'no-store',
      });
      if (!res.ok) {
        console.error(`[admin-cache] Upstash ${command[0]} 실패: HTTP ${res.status}`);
        return null;
      }
      const json = await res.json();
      return (json.result ?? null) as R;
    } catch (e) {
      console.error('[admin-cache] Upstash 호출 오류:', e);
      return null;
    }
  }

  async get<T>(key: string): Promise<CacheEntry<T> | null> {
    const raw = await this.cmd<string>(['GET', REDIS_NS + key]);
    if (!raw) return null;
    try {
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (entry.expiresAt <= Date.now()) {
        await this.delete(key);
        return null;
      }
      return entry;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: CacheEntry<T>): Promise<void> {
    const ttlSec = Math.max(1, Math.ceil((value.expiresAt - Date.now()) / 1000));
    await this.cmd(['SET', REDIS_NS + key, JSON.stringify(value), 'EX', ttlSec]);
  }

  async delete(key: string): Promise<void> {
    await this.cmd(['DEL', REDIS_NS + key]);
  }

  async clear(): Promise<void> {
    // FLUSHDB 금지 (공유 DB 보호) — 네임스페이스 키만 SCAN 하여 삭제
    let cursor = '0';
    do {
      const result = await this.cmd<[string, string[]]>([
        'SCAN', cursor, 'MATCH', REDIS_NS + '*', 'COUNT', 200,
      ]);
      if (!result) break;
      const [next, keys] = result;
      cursor = next;
      if (keys && keys.length) await this.cmd(['DEL', ...keys]);
    } while (cursor !== '0');
  }
}

/** 환경변수 유무로 Redis ↔ 메모리 백엔드를 자동 선택 */
function resolveBackend(): KVBackend {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? '';
  if (url && token) {
    console.log('[admin-cache] Upstash Redis 공유 캐시 백엔드 활성화');
    return new RedisBackend(url, token);
  }
  return new MemoryBackend();
}

const defaultBackend: KVBackend = resolveBackend();

// ── in-flight dedup ────────────────────────────────────────
// 같은 key 로 동시에 들어온 fetcher 호출은 promise 를 공유.
const inflight = new Map<string, Promise<unknown>>();

export interface CachedOptions {
  /** 기본 TTL(초) */
  ttl?: number;
  /** true 면 캐시 무시하고 새로 로드 후 저장 */
  force?: boolean;
}

/**
 * TTL 캐시 + in-flight dedup.
 *
 * @example
 *   const bundle = await cached('admin:bundle', loadAdminBundle, { ttl: 30 });
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: CachedOptions = {},
): Promise<T> {
  const ttl = opts.ttl ?? 30;

  if (!opts.force) {
    const hit = await defaultBackend.get<T>(key);
    if (hit) return hit.data;
  }

  // in-flight dedup
  const existing = inflight.get(key);
  if (existing && !opts.force) return existing as Promise<T>;

  const p = (async () => {
    try {
      const data = await fetcher();
      await defaultBackend.set<T>(key, {
        data,
        expiresAt: Date.now() + ttl * 1000,
      });
      return data;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

export async function invalidate(key: string): Promise<void> {
  await defaultBackend.delete(key);
  inflight.delete(key);
}

export async function invalidateAll(): Promise<void> {
  await defaultBackend.clear();
  inflight.clear();
}

/** Request 에서 force=1 / nocache=1 파라미터로 캐시 무시 여부 판단 */
export function shouldForce(request: Request): boolean {
  const url = new URL(request.url);
  return url.searchParams.get('force') === '1' || url.searchParams.get('nocache') === '1';
}
