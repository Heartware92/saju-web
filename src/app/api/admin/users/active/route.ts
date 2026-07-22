/**
 * GET /api/admin/users/active?period=today|week|month
 *
 * DAU/WAU/MAU 드릴다운 — 해당 기간(KST)에 접속(로그인 상태 활동)한 회원 목록.
 *  - 접속 기준: analytics_events 의 user_id 보유 이벤트 (users/summary 의 DAU/WAU/MAU 와 동일 정의).
 *  - 회원 정보는 _userAggregates 번들로 보강(성별/연령/세그먼트/잔액/누적결제).
 *  - 번들에 없는 user_id(미완성 가입 등)는 목록에서 제외 — 카운트 정의와 일치.
 *  - 분석 제외 계정 제외. 30초 캐시.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../../_auth';
import { cached, shouldForce } from '../../_cache';
import { cachedLoadAdminBundle, aggregateUsers } from '../../_userAggregates';

type Period = 'today' | 'week' | 'month';
const KST = 540;

function windowStart(period: Period): number {
  const kstNow = new Date(Date.now() + KST * 60_000);
  const todayStart = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - KST * 60_000;
  if (period === 'today') return todayStart;
  if (period === 'week') return todayStart - 6 * 86_400_000;
  return todayStart - 29 * 86_400_000;
}

async function compute(period: Period) {
  const start = windowStart(period);

  // 기간 내 로그인 상태 이벤트 전량 (user_id, 시각, 경로)
  const PAGE = 1000; const MAX = 50_000;
  const byUser = new Map<string, { count: number; lastAt: string; firstAt: string; lastPath: string | null }>();
  for (let from = 0; from < MAX; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('analytics_events')
      .select('user_id, created_at, path')
      .not('user_id', 'is', null)
      .gte('created_at', new Date(start).toISOString())
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    for (const e of data) {
      if (!e.user_id) continue;
      const cur = byUser.get(e.user_id);
      if (!cur) byUser.set(e.user_id, { count: 1, lastAt: e.created_at, firstAt: e.created_at, lastPath: e.path ?? null });
      else { cur.count++; cur.lastAt = e.created_at; cur.lastPath = e.path ?? cur.lastPath; }
    }
    if (data.length < PAGE) break;
  }

  // 회원 정보 보강 — 번들 회원만 (카운트 정의와 동일)
  const bundle = await cachedLoadAdminBundle();
  const members = aggregateUsers(bundle).filter((u) => !u.analyticsExcluded);
  const users = members
    .filter((m) => byUser.has(m.id))
    .map((m) => {
      const a = byUser.get(m.id)!;
      return {
        id: m.id,
        email: m.email,
        gender: m.gender,
        ageBucket: m.ageBucket,
        segments: m.segments,
        moonBalance: m.moonBalance,
        totalSpent: m.totalSpent,
        sajuCount: m.sajuCount,
        tarotCount: m.tarotCount,
        eventCount: a.count,
        firstActiveAt: a.firstAt,
        lastActiveAt: a.lastAt,
        lastPath: a.lastPath,
      };
    })
    .sort((x, y) => (x.lastActiveAt < y.lastActiveAt ? 1 : -1));

  return { period, windowStart: new Date(start).toISOString(), count: users.length, users };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const period = (new URL(request.url).searchParams.get('period') ?? 'today') as Period;
  if (!['today', 'week', 'month'].includes(period)) {
    return NextResponse.json({ error: 'period는 today|week|month' }, { status: 400 });
  }

  const data = await cached(`admin:users:active:${period}:v1`, () => compute(period), {
    ttl: 30, force: shouldForce(request),
  });
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  });
}
