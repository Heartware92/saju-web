/**
 * GET /api/admin/orders/summary
 * 매출·결제 요약: 패키지 분포, 결제수단, 12개월 추이, 환불률, ARPU, LTV
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../../_auth';
import { cached, shouldForce } from '../../_cache';
import { excludedUserIds, excludeUsers } from '../../_excluded';
import { resolveAudience, includeAudience } from '../../_audience';
import { loadPreservedOrders } from '../../_preservedRevenue';

const CACHE_KEY = 'admin:orders:summary:v1';
const TTL_SECONDS = 30;

function monthKey(iso: string, tzOffsetMin = 540): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + tzOffsetMin * 60_000);
  return kst.toISOString().slice(0, 7); // YYYY-MM
}

function lastNMonths(n: number, tzOffsetMin = 540): string[] {
  const now = new Date();
  const kstNow = new Date(now.getTime() + tzOffsetMin * 60_000);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(kstNow);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

async function computeSummary(audience: Set<string> | null) {
  // 슈퍼/테스트 계정 제외 + (선택) 오디언스 코호트로 한정
  const ex = await excludedUserIds();

  const [ordersRes, usersRes] = await Promise.all([
    includeAudience(excludeUsers(supabaseAdmin.from('orders').select('user_id, status, amount, package_id, package_name, payment_method, created_at, completed_at'), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('birth_profiles').select('user_id', { count: 'exact', head: true }).eq('is_primary', true), ex), audience),
  ]);

  let orders = ordersRes.data ?? [];
  // 탈퇴 회원 보존 주문 합산 — 탈퇴 시 orders 가 CASCADE 삭제되어 매출에서 빠지는 것을 복원.
  // 코호트(오디언스) 필터 시엔 탈퇴자 인구통계 식별 불가라 합산하지 않는다.
  if (!audience) {
    const preserved = await loadPreservedOrders();
    if (preserved.length) orders = [...orders, ...preserved];
  }
  const totalUsers = usersRes.count ?? 0;

  const completed = orders.filter(o => o.status === 'completed');
  const refunded = orders.filter(o => o.status === 'refunded');
  const failed = orders.filter(o => o.status === 'failed');

  const totalRevenue = completed.reduce((s, o) => s + (o.amount ?? 0), 0);
  const refundedAmount = refunded.reduce((s, o) => s + (o.amount ?? 0), 0);
  const netRevenue = totalRevenue - refundedAmount;

  // 패키지별 매출
  const packageMap = new Map<string, { name: string; count: number; revenue: number }>();
  for (const o of completed) {
    const key = o.package_id ?? '(기타)';
    const entry = packageMap.get(key) ?? { name: o.package_name ?? key, count: 0, revenue: 0 };
    entry.count++;
    entry.revenue += o.amount ?? 0;
    packageMap.set(key, entry);
  }
  const packages = [...packageMap.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // 결제수단 분포
  const methodMap = new Map<string, { count: number; revenue: number }>();
  for (const o of completed) {
    const key = o.payment_method ?? '(미상)';
    const entry = methodMap.get(key) ?? { count: 0, revenue: 0 };
    entry.count++;
    entry.revenue += o.amount ?? 0;
    methodMap.set(key, entry);
  }
  const methods = [...methodMap.entries()]
    .map(([method, v]) => ({ method, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  // 12개월 월별 매출·환불
  const months = lastNMonths(12);
  const monthIndex = new Map(months.map((m, i) => [m, i]));
  const monthlyRevenue = new Array(12).fill(0);
  const monthlyRefund = new Array(12).fill(0);
  const monthlyCount = new Array(12).fill(0);
  for (const o of completed) {
    const idx = monthIndex.get(monthKey(o.created_at));
    if (idx !== undefined) {
      monthlyRevenue[idx] += o.amount ?? 0;
      monthlyCount[idx]++;
    }
  }
  for (const o of refunded) {
    const idx = monthIndex.get(monthKey(o.created_at));
    if (idx !== undefined) monthlyRefund[idx] += o.amount ?? 0;
  }
  const monthly = months.map((m, i) => ({
    month: m,
    revenue: monthlyRevenue[i],
    refund: monthlyRefund[i],
    count: monthlyCount[i],
    net: monthlyRevenue[i] - monthlyRefund[i],
  }));

  // 시간대별 결제 분포 (0~23시, KST) — 어느 시간에 결제가 가장 많은지
  const hourly = new Array(24).fill(0);
  for (const o of completed) {
    const iso = o.completed_at ?? o.created_at;
    if (!iso) continue;
    const kst = new Date(new Date(iso).getTime() + 540 * 60_000);
    hourly[kst.getUTCHours()]++;
  }
  const peakHour = completed.length > 0
    ? hourly.reduce((best, c, h) => (c > hourly[best] ? h : best), 0)
    : null;

  // 결제회원 수 (중복 제거)
  const payingUsers = new Set(completed.map(o => o.user_id)).size;
  const arpu = payingUsers > 0 ? Math.round(totalRevenue / payingUsers) : 0;
  const ltv = totalUsers > 0 ? Math.round(totalRevenue / totalUsers) : 0;
  const aov = completed.length > 0 ? Math.round(totalRevenue / completed.length) : 0;

  const denom = completed.length + refunded.length;
  const refundRate = denom > 0 ? Math.round((refunded.length / denom) * 100) : 0;
  const failRate = (completed.length + refunded.length + failed.length) > 0
    ? Math.round((failed.length / (completed.length + refunded.length + failed.length)) * 100)
    : 0;

  return {
    kpi: {
      totalRevenue,
      refundedAmount,
      netRevenue,
      orderCount: completed.length,
      refundCount: refunded.length,
      failCount: failed.length,
      refundRate,
      failRate,
      arpu,
      ltv,
      aov,
      payingUsers,
      totalUsers,
      paidRate: totalUsers > 0 ? Math.round((payingUsers / totalUsers) * 100) : 0,
    },
    packages,
    methods,
    monthly,
    hourly,
    peakHour,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { cacheSuffix, audience } = await resolveAudience(request);
  const data = await cached(`${CACHE_KEY}${cacheSuffix}`, () => computeSummary(audience), {
    ttl: TTL_SECONDS,
    force: shouldForce(request),
  });

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  });
}
