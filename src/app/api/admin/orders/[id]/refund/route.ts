/**
 * POST /api/admin/orders/[id]/refund
 *
 * 관리자가 어드민에서 직접 주문을 환불(PG 취소 + 크레딧/주문 정리)한다.
 * 사용자 자가환불(/api/payment/refund)과 달리:
 *   - 관리자 인증(requireAdmin) 기반.
 *   - 미사용 크레딧 제약 없음(관리자 재량 — 환불 문의 처리 등). refund_order_atomic 이 크레딧 회수.
 *
 * 결제수단별 PG 취소:
 *   - 토스페이(payment_method='tosspay'): POST https://pay.toss.im/api/v2/refunds (payToken=payment_key)
 *   - 그 외(PortOne/이니시스): POST https://api.portone.io/payments/{portone_payment_id}/cancel
 *
 * 안전: PG 취소 성공 후에만 refund_order_atomic 호출(멱등키 refund-<orderId>). PG 실패 시 DB 무변경.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../../../_auth';

const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET || '';
const PORTONE_API_BASE = 'https://api.portone.io';
const TOSS_PAY_API_BASE = 'https://pay.toss.im/api/v2';
const TOSS_PAY_API_KEY = process.env.TOSS_PAY_API_KEY || '';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const { id: orderId } = await params;

  const body = (await request.json().catch(() => ({}))) as { reason?: string };

  // 1) 주문 조회 (관리자 — 소유 제한 없음)
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ success: false, error: '주문을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (order.status !== 'completed') {
    return NextResponse.json({ success: false, error: '완료된 주문만 환불할 수 있어요.' }, { status: 400 });
  }

  const isToss = order.payment_method === 'tosspay';
  const pgRef: string | null = isToss ? (order.payment_key ?? null) : (order.portone_payment_id ?? null);
  if (!pgRef) {
    return NextResponse.json({ success: false, error: 'PG 결제 식별자가 없어 환불할 수 없습니다.' }, { status: 400 });
  }
  const refundReason = body.reason?.trim() || `관리자 환불 (${auth.email})`;

  // 2) PG 취소 — 결제수단별 분기
  let pgOk = false;
  let pgDetail = '';
  if (isToss) {
    if (!TOSS_PAY_API_KEY) {
      return NextResponse.json({ success: false, error: '토스페이 환불 설정이 없습니다.' }, { status: 500 });
    }
    const r = await fetch(`${TOSS_PAY_API_BASE}/refunds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        apiKey: TOSS_PAY_API_KEY,
        payToken: pgRef,
        reason: refundReason,
        // 토스 refundNo 는 최대 36자 — `refund-${UUID}`(43자)는 길이 초과로 거부됨.
        // 하이픈 제거 UUID(32자) + 'r' 프리픽스(33자)로 주문당 고정·멱등.
        refundNo: `r${orderId.replace(/-/g, '')}`,
        idempotent: true,
      }),
    });
    const j = await r.json().catch(() => null);
    pgOk = r.ok && j?.code === 0;
    pgDetail = pgOk ? '' : JSON.stringify(j ?? {}).slice(0, 500);
  } else {
    if (!PORTONE_API_SECRET) {
      return NextResponse.json({ success: false, error: 'PortOne 환불 설정이 없습니다.' }, { status: 500 });
    }
    const r = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(pgRef)}/cancel`, {
      method: 'POST',
      headers: { Authorization: `PortOne ${PORTONE_API_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: refundReason }),
      cache: 'no-store',
    });
    pgOk = r.ok;
    pgDetail = pgOk ? '' : (await r.text().catch(() => '')).slice(0, 500);
  }

  if (!pgOk) {
    return NextResponse.json({ success: false, error: 'PG 환불 실패', detail: pgDetail }, { status: 502 });
  }

  // 3) 크레딧 회수 + 주문 상태 + 거래 기록 (단일 트랜잭션, 멱등)
  const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc('refund_order_atomic', {
    p_order_id: orderId,
    p_user_id: order.user_id,
    p_sun_granted: order.sun_credit_amount ?? 0,
    p_moon_granted: order.moon_credit_amount ?? 0,
    p_package_name: order.package_name ?? '',
    p_idempotency_key: `refund-${orderId}`,
  });

  if (rpcErr) {
    console.error('[admin/refund] RPC error', rpcErr);
    return NextResponse.json(
      { success: false, error: 'PG는 취소됐지만 크레딧/주문 정리에 실패했어요. 수동 확인이 필요합니다.', detail: rpcErr.message },
      { status: 500 },
    );
  }
  if (rpcResult !== 'ok' && rpcResult !== 'duplicate') {
    return NextResponse.json(
      { success: false, error: `PG는 취소됐지만 환불 처리 실패: ${rpcResult}. 수동 확인 필요.` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, orderId, deduplicated: rpcResult === 'duplicate' });
}
