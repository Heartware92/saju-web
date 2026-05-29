/**
 * GET /api/admin/credits/summary
 * 크레딧 흐름: reason별 소비, 발행-소비-잔여 폭포, 미소비 부채, 월별 흐름
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../../_auth';
import { cached, shouldForce } from '../../_cache';

const CACHE_KEY = 'admin:credits:summary:v1';
const TTL_SECONDS = 30;
const KST_OFFSET_MIN = 540;

function monthKey(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + KST_OFFSET_MIN * 60_000);
  return kst.toISOString().slice(0, 7);
}

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

async function computeSummary() {
  const [creditsRes, txnRes] = await Promise.all([
    supabaseAdmin.from('user_credits').select('user_id, moon_balance, total_moon_purchased, total_moon_consumed, updated_at'),
    supabaseAdmin.from('credit_transactions').select('credit_type, type, amount, reason, created_at, order_id').eq('credit_type', 'moon'),
  ]);

  const credits = creditsRes.data ?? [];
  const txns = txnRes.data ?? [];

  const moonIssued = credits.reduce((s, c) => s + (c.total_moon_purchased ?? 0), 0);
  const moonConsumed = credits.reduce((s, c) => s + (c.total_moon_consumed ?? 0), 0);
  const moonBalance = credits.reduce((s, c) => s + (c.moon_balance ?? 0), 0);

  const reasonMap = new Map<string, number>();
  for (const t of txns) {
    if (t.type !== 'consume') continue;
    const key = t.reason ?? '(미상)';
    reasonMap.set(key, (reasonMap.get(key) ?? 0) + Math.abs(t.amount ?? 0));
  }
  const reasonBreakdown = [...reasonMap.entries()]
    .map(([reason, moon]) => ({ reason, moon, total: moon }))
    .sort((a, b) => b.total - a.total);

  const months = lastNMonths(12);
  const mi = new Map(months.map((m, i) => [m, i]));
  const moonIssuedMo = new Array(12).fill(0);
  const moonConsumedMo = new Array(12).fill(0);
  for (const t of txns) {
    const idx = mi.get(monthKey(t.created_at));
    if (idx === undefined) continue;
    const abs = Math.abs(t.amount ?? 0);
    if (t.type === 'purchase' || t.type === 'signup_bonus' || t.type === 'admin_adjust') moonIssuedMo[idx] += (t.amount ?? 0) > 0 ? abs : 0;
    else if (t.type === 'consume') moonConsumedMo[idx] += abs;
  }
  const monthly = months.map((m, i) => ({
    month: m,
    moonIssued: moonIssuedMo[i],
    moonConsumed: moonConsumedMo[i],
    netMoon: moonIssuedMo[i] - moonConsumedMo[i],
  }));

  // 추정 단가 — 달 1개 ≈ 300원 (현재 패키지 평균 기준, 튜닝 가능)
  const ESTIMATED_MOON_COST_WON = 300;
  const debtWon = moonBalance * ESTIMATED_MOON_COST_WON;

  const moonConsumeRate = moonIssued > 0 ? Math.round((moonConsumed / moonIssued) * 100) : 0;

  const withMoon = credits.filter(c => (c.moon_balance ?? 0) > 0).length;

  const typeMap = new Map<string, number>();
  for (const t of txns) {
    typeMap.set(t.type, (typeMap.get(t.type) ?? 0) + 1);
  }
  const txnTypes = [...typeMap.entries()].map(([type, count]) => ({ type, count }));

  return {
    kpi: {
      moonIssued, moonConsumed, moonBalance,
      moonConsumeRate,
      debtWon,
      withMoon,
      txnCount: txns.length,
    },
    reasonBreakdown,
    monthly,
    txnTypes,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const data = await cached(CACHE_KEY, computeSummary, {
    ttl: TTL_SECONDS,
    force: shouldForce(request),
  });

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  });
}
