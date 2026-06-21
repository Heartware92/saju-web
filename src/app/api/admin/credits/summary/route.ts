/**
 * GET /api/admin/credits/summary
 * 크레딧 흐름: reason별 소비, 발행-소비-잔여 폭포, 미소비 부채, 월별 흐름
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../../_auth';
import { cached, shouldForce } from '../../_cache';
import { excludedUserIds, excludeUsers } from '../../_excluded';
import { resolveAudience, includeAudience } from '../../_audience';

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

interface TxnRow {
  user_id: string | null;
  type: string;
  amount: number | null;
  created_at: string;
}

/**
 * "충전한 달을 다 쓰기까지 걸린 평균 일수" (충전 배치 FIFO 소진).
 *  - 유저별 거래를 시간순으로 보며 FIFO 큐(lot)를 굴린다. 양수 거래 = 적립 lot, consume = 소비.
 *  - 소비는 가장 오래된 lot 부터 차감하고, lot 이 0 이 되는 순간 "소진 완료"로 본다.
 *  - 일수는 충전(purchase) lot 에 대해서만 기록한다(가입보너스/조정 lot 은 소비순서엔 반영하되 집계 제외).
 *  - 아직 다 못 쓴 충전 lot 은 진행중(outstanding)으로 분리.
 */
function computeDepletion(txns: TxnRow[]) {
  const DAY = 86_400_000;
  const byUser = new Map<string, TxnRow[]>();
  for (const t of txns) {
    if (!t.user_id) continue;
    const arr = byUser.get(t.user_id);
    if (arr) arr.push(t);
    else byUser.set(t.user_id, [t]);
  }

  const depletionDays: number[] = [];
  let outstandingPurchaseLots = 0; // 아직 소진중인 충전 배치 수

  for (const list of byUser.values()) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    // FIFO 큐: 적립 lot {remaining, time, isPurchase}
    const lots: { remaining: number; time: number; isPurchase: boolean }[] = [];
    for (const t of sorted) {
      const amt = t.amount ?? 0;
      const isDrain = t.type === 'consume' || amt < 0; // 소비 또는 음수(환불·조정 회수)
      const isRealConsume = t.type === 'consume';       // 실제 서비스 이용 소비만 "소진"으로 인정
      const ts = new Date(t.created_at).getTime();
      if (isDrain) {
        let need = Math.abs(amt);
        while (need > 0 && lots.length > 0) {
          const lot = lots[0];
          const take = Math.min(lot.remaining, need);
          lot.remaining -= take;
          need -= take;
          if (lot.remaining <= 1e-9) {
            // 충전 lot 이 '소비'로 완전히 비워질 때만 소진일 기록. 환불·관리자회수는 제외.
            if (lot.isPurchase && isRealConsume) depletionDays.push((ts - lot.time) / DAY);
            lots.shift();
          }
        }
      } else if (amt > 0) {
        lots.push({ remaining: amt, time: ts, isPurchase: t.type === 'purchase' });
      }
    }
    outstandingPurchaseLots += lots.filter((l) => l.isPurchase).length;
  }

  const n = depletionDays.length;
  const avg = n ? depletionDays.reduce((s, d) => s + d, 0) / n : 0;
  const sortedDays = [...depletionDays].sort((a, b) => a - b);
  const median = n ? sortedDays[Math.floor((n - 1) / 2)] : 0;
  return {
    avgDepletionDays: Math.round(avg * 10) / 10,
    medianDepletionDays: Math.round(median * 10) / 10,
    depletedLots: n,             // 완전 소진된 충전 배치 수(표본)
    outstandingPurchaseLots,     // 아직 소진중인 충전 배치 수
  };
}

async function computeSummary(audience: Set<string> | null) {
  // 슈퍼/테스트 계정 제외 + (선택) 오디언스 코호트로 한정
  const ex = await excludedUserIds();

  const [creditsRes, txnRes] = await Promise.all([
    includeAudience(excludeUsers(supabaseAdmin.from('user_credits').select('user_id, moon_balance, total_moon_purchased, total_moon_consumed, updated_at'), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('credit_transactions').select('user_id, credit_type, type, amount, reason, created_at, order_id').eq('credit_type', 'moon'), ex), audience),
  ]);

  const credits = creditsRes.data ?? [];
  const txns = txnRes.data ?? [];

  const moonIssued = credits.reduce((s, c) => s + (c.total_moon_purchased ?? 0), 0);
  const moonConsumed = credits.reduce((s, c) => s + (c.total_moon_consumed ?? 0), 0);
  const moonBalance = credits.reduce((s, c) => s + (c.moon_balance ?? 0), 0);

  // reason별: moon=소비 달 갯수(금액 합), count=소비 횟수(거래 건수). 둘 다 노출.
  const reasonMap = new Map<string, { moon: number; count: number }>();
  for (const t of txns) {
    if (t.type !== 'consume') continue;
    const key = t.reason ?? '(미상)';
    const e = reasonMap.get(key) ?? { moon: 0, count: 0 };
    e.moon += Math.abs(t.amount ?? 0);
    e.count += 1;
    reasonMap.set(key, e);
  }
  const reasonBreakdown = [...reasonMap.entries()]
    .map(([reason, v]) => ({ reason, moon: v.moon, count: v.count, total: v.moon }))
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
    else if (t.type === 'consume' || t.type === 'expire') moonConsumedMo[idx] += abs;
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

  // 충전 후 평균 소진 일수 (FIFO 배치 소진)
  const depletion = computeDepletion(txns as TxnRow[]);

  return {
    kpi: {
      moonIssued, moonConsumed, moonBalance,
      moonConsumeRate,
      debtWon,
      withMoon,
      txnCount: txns.length,
      ...depletion,
    },
    reasonBreakdown,
    monthly,
    txnTypes,
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
