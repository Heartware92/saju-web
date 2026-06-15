/**
 * GET /api/admin/stats
 * 어드민 대시보드 핵심 지표 + 30일 일별 시계열
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../_auth';
import { cached, shouldForce } from '../_cache';
import { excludedUserIds, excludeUsers } from '../_excluded';
import { resolveAudience, includeAudience } from '../_audience';

const STATS_CACHE_KEY = 'admin:stats:v1';
const STATS_TTL_SECONDS = 30;

/** YYYY-MM-DD (KST 기준) */
function dayKey(iso: string, tzOffsetMin = 540): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + tzOffsetMin * 60_000);
  return kst.toISOString().slice(0, 10);
}

/** 오늘 포함 N일 치 YYYY-MM-DD 역순 나열 (옛→최신) */
function lastNDays(n: number, tzOffsetMin = 540): string[] {
  const now = new Date();
  const kstNow = new Date(now.getTime() + tzOffsetMin * 60_000);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(kstNow);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

async function computeStats(audience: Set<string> | null) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

  // 슈퍼/테스트 계정 제외 — 모든 카운트/합산/시계열 쿼리에 user_id not-in 필터 적용
  const ex = await excludedUserIds();

  const [
    usersRes,
    todayUsersRes,
    monthUsersRes,
    ordersRes,
    monthRevenueRes,
    prevMonthRevenueRes,
    sajuRes,
    todaySajuRes,
    tarotRes,
    todayTarotRes,
    creditsRes,
    consultRes,
    todayConsultRes,
    // 30일 시계열용
    dailyOrdersRes,
    dailySignupsRes,
    dailySajuRes,
    dailyTarotRes,
  ] = await Promise.all([
    // 총 회원/신규 = 가입 완료(약관 동의) 기준. user_credits(가입 보너스)는 신뢰 불가 — 보너스 폐지 + 미완성 가입도 행 생성됨.
    includeAudience(excludeUsers(supabaseAdmin.from('user_agreements').select('user_id', { count: 'exact', head: true }), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('user_agreements').select('user_id', { count: 'exact', head: true }).gte('terms_agreed_at', todayStart), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('user_agreements').select('user_id', { count: 'exact', head: true }).gte('terms_agreed_at', monthStart), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('orders').select('status, amount').not('status', 'eq', 'pending'), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('orders').select('amount').eq('status', 'completed').gte('created_at', monthStart), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('orders').select('amount').eq('status', 'completed').gte('created_at', prevMonthStart).lt('created_at', monthStart), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('saju_records').select('id', { count: 'exact', head: true }), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('saju_records').select('id', { count: 'exact', head: true }).gte('created_at', todayStart), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('tarot_records').select('id', { count: 'exact', head: true }), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('tarot_records').select('id', { count: 'exact', head: true }).gte('created_at', todayStart), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('user_credits').select('total_moon_purchased, total_moon_consumed, moon_balance'), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('consultation_records').select('id', { count: 'exact', head: true }), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('consultation_records').select('id', { count: 'exact', head: true }).gte('created_at', todayStart), ex), audience),
    // 30일 시계열
    includeAudience(excludeUsers(supabaseAdmin.from('orders').select('amount, created_at').eq('status', 'completed').gte('created_at', thirtyDaysAgo), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('user_agreements').select('terms_agreed_at').gte('terms_agreed_at', thirtyDaysAgo), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('saju_records').select('created_at').gte('created_at', thirtyDaysAgo), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('tarot_records').select('created_at').gte('created_at', thirtyDaysAgo), ex), audience),
  ]);

  const orders = ordersRes.data ?? [];
  const completedOrders = orders.filter(o => o.status === 'completed');
  const refundedOrders = orders.filter(o => o.status === 'refunded');
  const totalRevenue = completedOrders.reduce((s, o) => s + (o.amount ?? 0), 0);
  const thisMonthRevenue = (monthRevenueRes.data ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);
  const prevMonthRevenue = (prevMonthRevenueRes.data ?? []).reduce((s, o) => s + (o.amount ?? 0), 0);
  const refundedRevenue = refundedOrders.reduce((s, o) => s + (o.amount ?? 0), 0);

  const credits = creditsRes.data ?? [];
  const totalMoonIssued = credits.reduce((s, c) => s + (c.total_moon_purchased ?? 0), 0);
  const totalMoonConsumed = credits.reduce((s, c) => s + (c.total_moon_consumed ?? 0), 0);
  const totalMoonBalance = credits.reduce((s, c) => s + (c.moon_balance ?? 0), 0);

  // ── 30일 일별 시계열 집계 (KST 기준) ──
  const days = lastNDays(30);
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const revenueByDay = new Array(30).fill(0);
  const signupsByDay = new Array(30).fill(0);
  const sajuByDay = new Array(30).fill(0);
  const tarotByDay = new Array(30).fill(0);

  for (const o of dailyOrdersRes.data ?? []) {
    const idx = dayIndex.get(dayKey(o.created_at));
    if (idx !== undefined) revenueByDay[idx] += o.amount ?? 0;
  }
  for (const c of dailySignupsRes.data ?? []) {
    const idx = dayIndex.get(dayKey(c.terms_agreed_at));
    if (idx !== undefined) signupsByDay[idx]++;
  }
  for (const r of dailySajuRes.data ?? []) {
    const idx = dayIndex.get(dayKey(r.created_at));
    if (idx !== undefined) sajuByDay[idx]++;
  }
  for (const r of dailyTarotRes.data ?? []) {
    const idx = dayIndex.get(dayKey(r.created_at));
    if (idx !== undefined) tarotByDay[idx]++;
  }

  const daily = days.map((d, i) => ({
    date: d,
    revenue: revenueByDay[i],
    signups: signupsByDay[i],
    saju: sajuByDay[i],
    tarot: tarotByDay[i],
    usage: sajuByDay[i] + tarotByDay[i],
  }));

  return {
    users: {
      total: usersRes.count ?? 0,
      today: todayUsersRes.count ?? 0,
      thisMonth: monthUsersRes.count ?? 0,
    },
    orders: {
      completed: completedOrders.length,
      refunded: refundedOrders.length,
      refundRate: completedOrders.length > 0
        ? Math.round((refundedOrders.length / (completedOrders.length + refundedOrders.length)) * 100)
        : 0,
    },
    revenue: {
      total: totalRevenue,
      thisMonth: thisMonthRevenue,
      prevMonth: prevMonthRevenue,
      refunded: refundedRevenue,
      growth: prevMonthRevenue > 0
        ? Math.round(((thisMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
        : null,
    },
    usage: {
      sajuTotal: sajuRes.count ?? 0,
      sajuToday: todaySajuRes.count ?? 0,
      tarotTotal: tarotRes.count ?? 0,
      tarotToday: todayTarotRes.count ?? 0,
      consultTotal: consultRes.count ?? 0,
      consultToday: todayConsultRes.count ?? 0,
    },
    credits: {
      moon: { issued: totalMoonIssued, consumed: totalMoonConsumed, balance: totalMoonBalance },
    },
    daily,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { cacheSuffix, audience } = await resolveAudience(request);
  const stats = await cached(`${STATS_CACHE_KEY}${cacheSuffix}`, () => computeStats(audience), {
    ttl: STATS_TTL_SECONDS,
    force: shouldForce(request),
  });

  return NextResponse.json(stats, {
    headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  });
}
