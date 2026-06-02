/**
 * 범용 레이트리밋 — 어뷰징/비용 방어용.
 *
 * 설계 원칙 (안전 최우선 — 기존 서비스 절대 안 깨지게):
 *  - Fail-OPEN: 조회/기록이 실패하면 요청을 "통과"시킨다(서비스 가용성 우선).
 *    기존 services/rateLimit.ts(SMS)와 동일 철학. 리밋 인프라가 죽어도 서비스는 멈추지 않음.
 *  - 저장소: Postgres public.rate_limit_events (마이그레이션 043). Redis 미사용(원자적 INCR 부재).
 *  - 임계값은 실사용보다 넉넉하게 — 정상 유저 오탐 방지.
 *  - 크레딧/결제 로직과 완전 분리 — 차감에는 일절 관여하지 않음(중복 차감 위험 0).
 *
 * 사용 예:
 *   const r = await checkRateLimit(`ai:ip:${clientIp(request)}`, [
 *     { windowSec: 60, max: 15 }, { windowSec: 3600, max: 100 },
 *   ]);
 *   if (!r.ok) return NextResponse.json({ error: r.message }, { status: 429 });
 */
import { supabaseAdmin } from '@/services/supabaseAdmin';

export interface RateRule {
  /** 윈도우 길이(초) */
  windowSec: number;
  /** 윈도우 내 허용 최대 횟수 */
  max: number;
}

export interface RateLimitResult {
  ok: boolean;
  message?: string;
  /** 가장 빡빡한 룰 기준 남은 횟수(근사, 디버그용) */
  remaining?: number;
}

const DEFAULT_MESSAGE = '요청이 너무 잦아요. 잠시 후 다시 시도해주세요.';

/**
 * key 에 대해 rules(여러 시간윈도우)를 모두 만족하는지 검사하고, 통과 시 이벤트 1건 기록.
 * 차단 시에는 기록하지 않는다(윈도우 연장 방지).
 * 어떤 실패에서도 throw 하지 않고 fail-open 으로 통과시킨다.
 */
export async function checkRateLimit(
  key: string,
  rules: RateRule[],
  message: string = DEFAULT_MESSAGE,
): Promise<RateLimitResult> {
  if (rules.length === 0) return { ok: true };
  try {
    const now = Date.now();
    const maxWindowSec = Math.max(...rules.map((r) => r.windowSec));
    const sinceIso = new Date(now - maxWindowSec * 1000).toISOString();

    // 오래된 행 정리(키 한정) — 테이블 무한 증가 방지. 실패해도 무시.
    await supabaseAdmin
      .from('rate_limit_events')
      .delete()
      .eq('key', key)
      .lt('created_at', sinceIso);

    const { data, error } = await supabaseAdmin
      .from('rate_limit_events')
      .select('created_at')
      .eq('key', key)
      .gte('created_at', sinceIso);

    if (error) {
      console.error('[rateLimit] 조회 실패 — fail-open 통과:', error.message);
      return { ok: true };
    }

    const times = (data ?? []).map((r) => new Date(r.created_at as string).getTime());
    let minRemaining = Number.POSITIVE_INFINITY;
    for (const rule of rules) {
      const windowStart = now - rule.windowSec * 1000;
      const count = times.filter((t) => t >= windowStart).length;
      const remaining = rule.max - count;
      if (remaining <= 0) {
        return { ok: false, message };
      }
      if (remaining < minRemaining) minRemaining = remaining;
    }

    // 통과 — 이벤트 기록(베스트에포트). 실패해도 통과 유지.
    const { error: insErr } = await supabaseAdmin
      .from('rate_limit_events')
      .insert({ key });
    if (insErr) console.error('[rateLimit] 기록 실패(무시):', insErr.message);

    return {
      ok: true,
      remaining: Number.isFinite(minRemaining) ? minRemaining : undefined,
    };
  } catch (e) {
    console.error('[rateLimit] 예외 — fail-open 통과:', e);
    return { ok: true };
  }
}

/**
 * 프록시 뒤 클라이언트 IP 추출 (x-forwarded-for 우선).
 * 주의: 클라이언트가 위조 가능 — public 엔드포인트의 "보조" 가드로만 사용.
 * 완전한 봇 차단은 추후 Turnstile 로 보강.
 */
export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for') ?? '';
  const real = request.headers.get('x-real-ip') ?? '';
  return (fwd.split(',')[0] || real || '').trim() || 'unknown';
}
