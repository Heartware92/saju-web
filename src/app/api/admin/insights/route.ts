/**
 * GET /api/admin/insights
 * 통합 인사이트: 시스템 헬스·코호트 리텐션·AI 품질·이상치·실시간 이벤트 피드
 *
 * 집계 비용이 크므로 별도 30초 TTL 캐시.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../_auth';
import { cached, shouldForce } from '../_cache';
import { excludedUserIds, excludeUsers, filterExcludedUsers } from '../_excluded';
import { resolveAudience, includeAudience } from '../_audience';

const CACHE_KEY = 'admin:insights:v1';
const TTL_SECONDS = 30;
const KST_OFFSET_MIN = 540;

function toKst(iso: string) {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MIN * 60_000);
}
function monthKey(iso: string): string { return toKst(iso).toISOString().slice(0, 7); }
function lastNMonths(n: number): string[] {
  const now = new Date();
  const kstNow = new Date(now.getTime() + KST_OFFSET_MIN * 60_000);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(kstNow);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

async function compute(audience: Set<string> | null) {
  const now = Date.now();
  const h1  = new Date(now - 1 * 3600_000).toISOString();
  const h24 = new Date(now - 24 * 3600_000).toISOString();
  const d7  = new Date(now - 7 * 86400_000).toISOString();
  const d30 = new Date(now - 30 * 86400_000).toISOString();
  const d90 = new Date(now - 90 * 86400_000).toISOString();

  // DB 응답시간 간이 측정
  const dbStart = Date.now();
  const dbPing = await supabaseAdmin.from('user_credits').select('user_id', { count: 'exact', head: true });
  const dbLatencyMs = Date.now() - dbStart;

  // 슈퍼/테스트 계정 제외 — 모든 활동/주문 쿼리 + 회원 배열에 적용
  const ex = await excludedUserIds();

  const [
    authListRes, recentSajuRes, recentTarotRes, last24hSajuRes, last24hTarotRes,
    recentOrdersRes, recentFailedRes, last24hSignupsRes,
    cohortUsersRes, allSajuRes, allTarotRes, allOrdersRes,
  ] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    includeAudience(excludeUsers(supabaseAdmin.from('saju_records')
      .select('user_id, category, credit_type, credit_used, created_at')
      .gte('created_at', d7)
      .order('created_at', { ascending: false }), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('tarot_records')
      .select('user_id, spread_type, credit_type, credit_used, created_at')
      .gte('created_at', d7)
      .order('created_at', { ascending: false }), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('saju_records').select('user_id, category, credit_used, created_at').gte('created_at', h24), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('tarot_records').select('user_id, spread_type, credit_used, created_at').gte('created_at', h24), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('orders')
      .select('user_id, status, amount, package_name, created_at')
      .gte('created_at', h24)
      .order('created_at', { ascending: false }), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('orders').select('user_id, status, created_at').gte('created_at', d30), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('user_credits').select('user_id, created_at').gte('created_at', h24), ex), audience),
    // 코호트: 90일치 가입자 + 전체 활동
    includeAudience(excludeUsers(supabaseAdmin.from('user_credits').select('user_id, created_at').gte('created_at', d90), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('saju_records').select('user_id, created_at').gte('created_at', d90), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('tarot_records').select('user_id, created_at').gte('created_at', d90), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('orders').select('user_id, status, amount, created_at').gte('created_at', d90), ex), audience),
  ]);

  const users = filterExcludedUsers(authListRes.data?.users ?? [], ex);
  const emailById = new Map(users.map(u => [u.id, u.email ?? '']));

  // ── 1. 시스템 헬스 ──
  const recentFailed = (recentFailedRes.data ?? []).filter(o => o.status === 'failed').length;
  const recentCompleted = (recentFailedRes.data ?? []).filter(o => o.status === 'completed').length;
  const recentRefunded = (recentFailedRes.data ?? []).filter(o => o.status === 'refunded').length;
  const failRate = (recentCompleted + recentFailed) > 0
    ? Math.round((recentFailed / (recentCompleted + recentFailed)) * 100)
    : 0;
  const refundRate = (recentCompleted + recentRefunded) > 0
    ? Math.round((recentRefunded / (recentCompleted + recentRefunded)) * 100)
    : 0;

  const health = {
    dbLatencyMs,
    dbOk: !dbPing.error,
    totalAuthUsers: users.length,
    last24hSignups: last24hSignupsRes.data?.length ?? 0,
    last24hUsage: (last24hSajuRes.data?.length ?? 0) + (last24hTarotRes.data?.length ?? 0),
    last24hOrders: recentOrdersRes.data?.length ?? 0,
    last30dPaymentFailRate: failRate,
    last30dRefundRate: refundRate,
    last30dFailCount: recentFailed,
    last30dRefundCount: recentRefunded,
  };

  // ── 2. 코호트 리텐션 (월별 가입 코호트의 D+7, D+30 잔존율) ──
  const cohortUsers = cohortUsersRes.data ?? [];
  const cohortActivity = [
    ...(allSajuRes.data ?? []).map(r => ({ user_id: r.user_id, created_at: r.created_at })),
    ...(allTarotRes.data ?? []).map(r => ({ user_id: r.user_id, created_at: r.created_at })),
  ];
  // user_id → 가입일
  const joinByUser = new Map<string, string>();
  for (const c of cohortUsers) joinByUser.set(c.user_id, c.created_at);
  // user_id → 활동 시각들
  const actByUser = new Map<string, number[]>();
  for (const a of cohortActivity) {
    const join = joinByUser.get(a.user_id);
    if (!join) continue;
    const days = (new Date(a.created_at).getTime() - new Date(join).getTime()) / 86400_000;
    if (!actByUser.has(a.user_id)) actByUser.set(a.user_id, []);
    actByUser.get(a.user_id)!.push(days);
  }
  // 월별 코호트 버킷
  const months = lastNMonths(3); // 최근 3개월 코호트 (D+30까지 채워지려면 최소 한 달 전)
  const cohortMap = new Map<string, { total: number; d1: number; d7: number; d30: number }>();
  for (const m of months) cohortMap.set(m, { total: 0, d1: 0, d7: 0, d30: 0 });
  for (const c of cohortUsers) {
    const mk = monthKey(c.created_at);
    const entry = cohortMap.get(mk);
    if (!entry) continue;
    entry.total++;
    const acts = actByUser.get(c.user_id) ?? [];
    if (acts.some(d => d <= 1)) entry.d1++;
    if (acts.some(d => d <= 7)) entry.d7++;
    if (acts.some(d => d <= 30)) entry.d30++;
  }
  const cohort = [...cohortMap.entries()].map(([month, v]) => ({
    month,
    total: v.total,
    d1: v.total > 0 ? Math.round((v.d1 / v.total) * 100) : 0,
    d7: v.total > 0 ? Math.round((v.d7 / v.total) * 100) : 0,
    d30: v.total > 0 ? Math.round((v.d30 / v.total) * 100) : 0,
  }));

  // ── 3. AI 품질 대리 지표 (카테고리별 평균 소비 크레딧 · 실패 의심 = credit_used=0) ──
  const sajuAll = recentSajuRes.data ?? [];
  const tarotAll = recentTarotRes.data ?? [];
  const catQualityMap = new Map<string, { count: number; totalCredit: number; zeroCredit: number }>();
  for (const r of sajuAll) {
    const key = r.category ?? '(미상)';
    const e = catQualityMap.get(key) ?? { count: 0, totalCredit: 0, zeroCredit: 0 };
    e.count++;
    e.totalCredit += r.credit_used ?? 0;
    if (!r.credit_used || r.credit_used === 0) e.zeroCredit++;
    catQualityMap.set(key, e);
  }
  for (const r of tarotAll) {
    const key = `tarot:${r.spread_type ?? '(미상)'}`;
    const e = catQualityMap.get(key) ?? { count: 0, totalCredit: 0, zeroCredit: 0 };
    e.count++;
    e.totalCredit += r.credit_used ?? 0;
    if (!r.credit_used || r.credit_used === 0) e.zeroCredit++;
    catQualityMap.set(key, e);
  }
  const aiQuality = [...catQualityMap.entries()]
    .map(([category, v]) => ({
      category,
      count: v.count,
      avgCredit: v.count > 0 ? +(v.totalCredit / v.count).toFixed(2) : 0,
      zeroCreditCount: v.zeroCredit,
      zeroCreditRate: v.count > 0 ? Math.round((v.zeroCredit / v.count) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // ── 4. 이상치 감지 ──
  // (a) 1시간내 10회 이상 풀이
  const heavyUsersMap = new Map<string, number>();
  for (const r of [...sajuAll, ...tarotAll]) {
    if (!r.created_at) continue;
    if (new Date(r.created_at).toISOString() < h1) continue;
    heavyUsersMap.set(r.user_id, (heavyUsersMap.get(r.user_id) ?? 0) + 1);
  }
  const heavyUsers = [...heavyUsersMap.entries()]
    .filter(([, n]) => n >= 10)
    .map(([id, count]) => ({ userId: id, email: emailById.get(id) ?? id, count }))
    .sort((a, b) => b.count - a.count);

  // (b) 30일내 3회 이상 환불
  const refundMap = new Map<string, number>();
  for (const o of allOrdersRes.data ?? []) {
    if (o.status !== 'refunded') continue;
    refundMap.set(o.user_id, (refundMap.get(o.user_id) ?? 0) + 1);
  }
  const repeatRefunders = [...refundMap.entries()]
    .filter(([, n]) => n >= 3)
    .map(([id, count]) => ({ userId: id, email: emailById.get(id) ?? id, count }))
    .sort((a, b) => b.count - a.count);

  // (c) 24시간내 결제 실패 5회 이상
  const failMap = new Map<string, number>();
  for (const o of recentOrdersRes.data ?? []) {
    if (o.status !== 'failed') continue;
    failMap.set(o.user_id, (failMap.get(o.user_id) ?? 0) + 1);
  }
  const failHeavy = [...failMap.entries()]
    .filter(([, n]) => n >= 5)
    .map(([id, count]) => ({ userId: id, email: emailById.get(id) ?? id, count }))
    .sort((a, b) => b.count - a.count);

  const anomalies = {
    heavyUsers,        // 1h 대량 풀이
    repeatRefunders,   // 30일 반복 환불
    failHeavy,         // 24h 결제 실패 다수
  };

  // ── 5. 실시간 이벤트 피드 (최근 24h, 최대 50건) ──
  const feed: {
    kind: 'signup' | 'order_completed' | 'order_failed' | 'order_refunded' | 'saju' | 'tarot';
    userId: string;
    email: string;
    label: string;
    createdAt: string;
    meta?: Record<string, unknown>;
  }[] = [];

  for (const s of last24hSignupsRes.data ?? []) {
    feed.push({ kind: 'signup', userId: s.user_id, email: emailById.get(s.user_id) ?? s.user_id, label: '신규 가입', createdAt: s.created_at });
  }
  for (const o of recentOrdersRes.data ?? []) {
    const kind: 'order_completed' | 'order_failed' | 'order_refunded' =
      o.status === 'completed' ? 'order_completed' : o.status === 'failed' ? 'order_failed' : 'order_refunded';
    const label = o.status === 'completed' ? `결제 완료 · ${o.package_name ?? ''} · ${(o.amount ?? 0).toLocaleString()}원`
      : o.status === 'failed' ? `결제 실패 · ${o.package_name ?? ''}`
      : `환불 · ${o.package_name ?? ''} · ${(o.amount ?? 0).toLocaleString()}원`;
    feed.push({ kind, userId: o.user_id, email: emailById.get(o.user_id) ?? o.user_id, label, createdAt: o.created_at });
  }
  for (const r of last24hSajuRes.data ?? []) {
    feed.push({
      kind: 'saju', userId: r.user_id, email: emailById.get(r.user_id) ?? r.user_id,
      label: `사주 · ${r.category ?? ''} · ${(r.credit_used ?? 0)}`, createdAt: r.created_at,
    });
  }
  for (const r of last24hTarotRes.data ?? []) {
    feed.push({
      kind: 'tarot', userId: r.user_id, email: emailById.get(r.user_id) ?? r.user_id,
      label: `타로 · ${r.spread_type ?? ''} · ${(r.credit_used ?? 0)}`, createdAt: r.created_at,
    });
  }
  feed.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const feedTop = feed.slice(0, 50);

  // ── 6. 환불 패턴 ──
  const refunds = (allOrdersRes.data ?? []).filter(o => o.status === 'refunded');
  const refundUserMap = new Map<string, { count: number; amount: number }>();
  for (const r of refunds) {
    const e = refundUserMap.get(r.user_id) ?? { count: 0, amount: 0 };
    e.count++;
    e.amount += r.amount ?? 0;
    refundUserMap.set(r.user_id, e);
  }
  const topRefunders = [...refundUserMap.entries()]
    .map(([id, v]) => ({ userId: id, email: emailById.get(id) ?? id, count: v.count, amount: v.amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20);

  // 월별 환불률
  const refundMonthly = lastNMonths(6);
  const refundMonthMap = new Map(refundMonthly.map((m, i) => [m, i]));
  const refCount = new Array(6).fill(0);
  const compCount = new Array(6).fill(0);
  for (const o of allOrdersRes.data ?? []) {
    const idx = refundMonthMap.get(monthKey(o.created_at));
    if (idx === undefined) continue;
    if (o.status === 'refunded') refCount[idx]++;
    else if (o.status === 'completed') compCount[idx]++;
  }
  const refundRateMonthly = refundMonthly.map((m, i) => ({
    month: m,
    rate: (refCount[i] + compCount[i]) > 0 ? Math.round((refCount[i] / (refCount[i] + compCount[i])) * 100) : 0,
    refundCount: refCount[i],
    completedCount: compCount[i],
  }));

  return {
    health,
    cohort,
    aiQuality,
    anomalies,
    feed: feedTop,
    refunds: {
      topRefunders,
      monthly: refundRateMonthly,
    },
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { cacheSuffix, audience } = await resolveAudience(request);
  const data = await cached(`${CACHE_KEY}${cacheSuffix}`, () => compute(audience), {
    ttl: TTL_SECONDS,
    force: shouldForce(request),
  });

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  });
}
