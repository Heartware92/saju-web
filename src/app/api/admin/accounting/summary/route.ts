/**
 * GET /api/admin/accounting/summary
 *
 * 회계처리용 집계 — 선불 '달' 크레딧을 계약부채(선수금) 모델로 회계처리하기 위한 자료.
 *
 * 회계 모델(2026-07 확정):
 *  - 결제 시점: (차)미수금 / (대)계약부채 + 부가세예수금.  부가세 = 결제금액 × 10/110.
 *  - 사용 시점: (차)계약부채 / (대)매출.  단가는 FIFO lot(패키지 실단가, 공급가액) 기준.
 *  - 무료 크레딧(admin_adjust·회원가입 이벤트): 현금·매출 아님 → 회계 이벤트 없음(통계만).
 *  - 탈퇴 미사용: 계약부채 → 매출(낙전).  탈퇴자 orders 는 CASCADE 삭제되므로 preserved_transactions 사용.
 *  - 정산·PG수수료·부가세대급금: 실입금액 입력 기반(수수료 역산). 이 라우트는 결제총액만 제공.
 *
 * 데이터 특이점(조사 결과):
 *  - credit_transactions.order_id 는 null → 패키지 구분은 reason 텍스트("달 세트 구매" 등)로.
 *  - type='purchase' 이어도 reason 이 "회원가입 환영 보너스" 면 무료(단가 매칭 실패 → free).
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../../_auth';
import { cached, shouldForce } from '../../_cache';
import { excludedUserIds, excludeUsers } from '../../_excluded';
import { loadPreservedOrders } from '../../_preservedRevenue';
import { CREDIT_PACKAGES } from '@/constants/pricing';

const CACHE_KEY = 'admin:accounting:summary:v1';
const TTL_SECONDS = 60;
const KST = 540;

const dayKey = (iso: string) => new Date(new Date(iso).getTime() + KST * 60_000).toISOString().slice(0, 10);
const monthKey = (iso: string) => new Date(new Date(iso).getTime() + KST * 60_000).toISOString().slice(0, 7);

/** 패키지명 → 공급가액(VAT제외) 단가. reason 매칭용. */
const UNIT_BY_NAME: { name: string; unit: number }[] = CREDIT_PACKAGES.map((p) => ({
  name: p.name,
  unit: (p.price * 100) / 110 / p.moonCredit,
}));
function paidUnitOf(reason: string | null): number | null {
  if (!reason || !reason.includes('구매')) return null;
  for (const { name, unit } of UNIT_BY_NAME) if (reason.includes(name)) return unit;
  return null;
}

interface ChargeDay { date: string; amount: number; contractLiab: number; vat: number; count: number; moon: number; }
interface Lot { moon: number; unit: number; paid: boolean; }

async function compute() {
  const ex = await excludedUserIds();

  const [ordersRes, txRes, delRes, refundRes] = await Promise.all([
    excludeUsers(
      supabaseAdmin.from('orders')
        .select('user_id, amount, moon_credit_amount, package_id, package_name, payment_method, status, completed_at, created_at')
        .eq('status', 'completed'),
      ex,
    ),
    excludeUsers(
      supabaseAdmin.from('credit_transactions')
        .select('user_id, type, amount, reason, created_at')
        .eq('credit_type', 'moon'),
      ex,
    ),
    supabaseAdmin.from('account_deletion_logs').select('email, deleted_at'),
    excludeUsers(
      supabaseAdmin.from('orders')
        .select('user_id, amount, moon_credit_amount, completed_at, created_at')
        .eq('status', 'refunded'),
      ex,
    ),
  ]);

  const activeOrders = ordersRes.data ?? [];
  const preserved = await loadPreservedOrders(); // 탈퇴자 결제(제외이메일 이미 필터)
  const delByEmail = new Map<string, string>();
  for (const d of delRes.data ?? []) if (d.email) delByEmail.set(String(d.email).toLowerCase(), d.deleted_at);

  // ── 1) 충전(결제) — 일자별 ──
  const chargeMap = new Map<string, ChargeDay>();
  const pgTotals: Record<string, number> = { tosspay: 0, inicis: 0 };
  const pkgSales = new Map<string, { name: string; count: number; amount: number; moon: number }>();
  const addCharge = (iso: string, amount: number, moon: number) => {
    const dk = dayKey(iso);
    const e = chargeMap.get(dk) ?? { date: dk, amount: 0, contractLiab: 0, vat: 0, count: 0, moon: 0 };
    e.amount += amount; e.moon += moon; e.count += 1;
    e.vat = Math.round(e.amount * 10 / 110);
    e.contractLiab = e.amount - e.vat;
    chargeMap.set(dk, e);
  };
  for (const o of activeOrders) {
    const iso = o.completed_at ?? o.created_at;
    addCharge(iso, o.amount ?? 0, o.moon_credit_amount ?? 0);
    const pg = (o.payment_method ?? '').startsWith('tosspay') ? 'tosspay' : 'inicis';
    pgTotals[pg] += o.amount ?? 0;
    const k = o.package_id ?? '(기타)';
    const ps = pkgSales.get(k) ?? { name: o.package_name ?? k, count: 0, amount: 0, moon: 0 };
    ps.count++; ps.amount += o.amount ?? 0; ps.moon += o.moon_credit_amount ?? 0; pkgSales.set(k, ps);
  }
  for (const p of preserved) {
    if (p.status !== 'completed') continue;
    const iso = p.created_at ?? p.completed_at ?? new Date(0).toISOString();
    addCharge(iso, p.amount ?? 0, 0);
    const pg = (p.payment_method ?? '').startsWith('tosspay') ? 'tosspay' : 'inicis';
    pgTotals[pg] += p.amount ?? 0;
  }
  const charges = [...chargeMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const chargeTotal = charges.reduce((s, c) => s + c.amount, 0);
  const contractLiabIssued = charges.reduce((s, c) => s + c.contractLiab, 0);
  const vatIssued = charges.reduce((s, c) => s + c.vat, 0);

  // ── 2) 매출 인식 — FIFO lot (활성) ──
  const byUser = new Map<string, { type: string; amount: number; reason: string | null; created_at: string }[]>();
  for (const t of txRes.data ?? []) {
    const a = byUser.get(t.user_id) ?? [];
    a.push(t as any); byUser.set(t.user_id, a);
  }
  // 일 단위로 집계(월별은 일별에서 파생) — 일별 운영 현황·일별 매출 인식 모두 지원.
  const revByDay = new Map<string, number>();
  const paidMoonByDay = new Map<string, number>();
  const freeMoonByDay = new Map<string, number>();
  let paidIssuedSupply = 0, freeConsumed = 0, paidUnusedSupply = 0, freeUnused = 0, freeIssued = 0, paidConsumedSupply = 0;
  for (const list of byUser.values()) {
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const lots: Lot[] = [];
    for (const t of list) {
      const a = t.amount ?? 0;
      const unit = paidUnitOf(t.reason);
      const isPaid = t.type === 'purchase' && unit != null;
      const isAdd = a > 0 && (t.type === 'purchase' || t.type === 'bonus' || t.type === 'admin_adjust' || t.type === 'signup_bonus');
      const isDrain = t.type === 'consume' || t.type === 'expire' || a < 0;
      if (isDrain) {
        let need = Math.abs(a); const dk = dayKey(t.created_at);
        while (need > 0 && lots.length) {
          const lot = lots[0]; const take = Math.min(lot.moon, need);
          if (lot.paid) {
            const r = take * lot.unit;
            revByDay.set(dk, (revByDay.get(dk) ?? 0) + r);
            paidMoonByDay.set(dk, (paidMoonByDay.get(dk) ?? 0) + take);
            paidConsumedSupply += r;
          } else {
            freeConsumed += take;
            freeMoonByDay.set(dk, (freeMoonByDay.get(dk) ?? 0) + take);
          }
          lot.moon -= take; need -= take; if (lot.moon <= 1e-9) lots.shift();
        }
      } else if (isAdd) {
        lots.push({ moon: a, unit: isPaid ? (unit as number) : 0, paid: isPaid });
        if (isPaid) paidIssuedSupply += a * (unit as number); else freeIssued += a;
      }
    }
    for (const lot of lots) { if (lot.paid) paidUnusedSupply += lot.moon * lot.unit; else freeUnused += lot.moon; }
  }
  // 월별 매출 = 일별 합산
  const revByMonth = new Map<string, number>();
  for (const [dk, v] of revByDay) {
    const m = dk.slice(0, 7);
    revByMonth.set(m, (revByMonth.get(m) ?? 0) + v);
  }

  // ── 환불 — 일자별 (주의: refunded_at 컬럼이 없어 completed_at ?? created_at 로 근사) ──
  const refundByDay = new Map<string, { count: number; amount: number; moon: number }>();
  let refundTotal = 0, refundCount = 0;
  for (const o of refundRes.data ?? []) {
    const dk = dayKey(o.completed_at ?? o.created_at);
    const e = refundByDay.get(dk) ?? { count: 0, amount: 0, moon: 0 };
    e.count++; e.amount += o.amount ?? 0; e.moon += o.moon_credit_amount ?? 0;
    refundByDay.set(dk, e);
    refundTotal += o.amount ?? 0; refundCount++;
  }

  // ── 3) 탈퇴 낙전 매출 — preserved 전액을 탈퇴월(없으면 결제월) 매출로 ──
  const breakageByMonth = new Map<string, number>();
  let breakageTotal = 0;
  for (const p of preserved) {
    if (p.status !== 'completed') continue;
    const supply = Math.round((p.amount ?? 0) * 100 / 110);
    // preserved 엔 탈퇴일이 없어 결제월에 낙전 매출 인식(탈퇴자는 사용/미사용 무관 전액 매출).
    const m = monthKey(p.created_at ?? p.completed_at ?? new Date(0).toISOString());
    breakageByMonth.set(m, (breakageByMonth.get(m) ?? 0) + supply);
    breakageTotal += supply;
  }

  // ── 매출 월별 합산(활성 FIFO + 탈퇴 낙전) ──
  const months = new Set<string>([...revByMonth.keys(), ...breakageByMonth.keys()]);
  const revenueByMonth = [...months].sort().map((m) => ({
    month: m,
    usage: Math.round(revByMonth.get(m) ?? 0),
    breakage: Math.round(breakageByMonth.get(m) ?? 0),
    total: Math.round((revByMonth.get(m) ?? 0) + (breakageByMonth.get(m) ?? 0)),
  }));
  const revenueTotal = Math.round(paidConsumedSupply) + breakageTotal;

  // ── 계약부채 잔액 = 발행 − 매출(사용+낙전) ──
  const contractLiabBalance = contractLiabIssued - revenueTotal;

  // ── 4) 무료 크레딧 통계 ──
  const free = { issued: freeIssued, consumed: freeConsumed, balance: freeUnused };

  // ── 5) 일별 운영 현황 — 결제·달 사용(유/무료)·사용매출·환불을 한 줄로 ──
  const opsDates = new Set<string>([
    ...chargeMap.keys(), ...paidMoonByDay.keys(), ...freeMoonByDay.keys(), ...refundByDay.keys(),
  ]);
  const dailyOps = [...opsDates].sort().map((d) => ({
    date: d,
    payCount: chargeMap.get(d)?.count ?? 0,
    payAmount: chargeMap.get(d)?.amount ?? 0,
    paidMoonUsed: Math.round((paidMoonByDay.get(d) ?? 0) * 100) / 100,
    freeMoonUsed: Math.round((freeMoonByDay.get(d) ?? 0) * 100) / 100,
    usageRevenue: Math.round(revByDay.get(d) ?? 0),
    refundCount: refundByDay.get(d)?.count ?? 0,
    refundAmount: refundByDay.get(d)?.amount ?? 0,
  }));

  return {
    dailyOps,
    refunds: { count: refundCount, amount: refundTotal },
    generatedAt: new Date().toISOString(),
    charge: {
      byDate: charges,
      total: chargeTotal,
      contractLiab: contractLiabIssued,
      vat: vatIssued,
      pgTotals,
      packages: [...pkgSales.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.amount - a.amount),
    },
    revenue: {
      byMonth: revenueByMonth,
      usageTotal: Math.round(paidConsumedSupply),
      breakageTotal,
      total: revenueTotal,
    },
    contractLiability: {
      issued: contractLiabIssued,
      recognized: revenueTotal,
      balance: contractLiabBalance,
      paidUnusedSupply: Math.round(paidUnusedSupply),
    },
    vat: { payable: vatIssued },
    free,
    unitTable: UNIT_BY_NAME.map((u) => ({ name: u.name, supplyUnit: Math.round(u.unit * 100) / 100 })),
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const data = await cached(CACHE_KEY, compute, { ttl: TTL_SECONDS, force: shouldForce(request) });
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
  });
}
