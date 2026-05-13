/**
 * POST /api/payment/verify
 *
 * 클라이언트가 PortOne V2 결제창에서 성공 응답을 받은 직후 호출한다.
 * 서버에서 PortOne REST API로 실제 결제 내역을 조회하여 주문 금액과 일치하는지 검증하고,
 * 일치할 경우에만 주문 상태를 completed로 전환하면서 크레딧을 지급한다.
 *
 * Body: { paymentId: string, orderId: string }
 *
 * PortOne V2 REST API:
 *   GET https://api.portone.io/payments/{paymentId}
 *   Header: Authorization: PortOne {API_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { getPackageById } from '@/constants/pricing';

const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET || '';
const PORTONE_API_BASE = 'https://api.portone.io';

interface VerifyRequestBody {
  paymentId: string;
  orderId: string;
}

export async function POST(req: NextRequest) {
  try {
    if (!PORTONE_API_SECRET) {
      return NextResponse.json(
        { success: false, error: 'PortOne API secret is not configured on the server.' },
        { status: 500 }
      );
    }

    const body = (await req.json()) as VerifyRequestBody;
    const { paymentId, orderId } = body;

    if (!paymentId || !orderId) {
      return NextResponse.json(
        { success: false, error: 'paymentId and orderId are required.' },
        { status: 400 }
      );
    }

    // 1) 주문 조회
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이미 처리된 주문은 멱등성 보장
    if (order.status === 'completed') {
      return NextResponse.json({
        success: true,
        message: '이미 처리된 결제입니다.',
        orderId: order.id,
        alreadyCompleted: true,
      });
    }

    // 2) PortOne에서 실제 결제 정보 조회
    const portOneRes = await fetch(
      `${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `PortOne ${PORTONE_API_SECRET}`,
        },
        // 서버 사이드 fetch — 캐시 금지
        cache: 'no-store',
      }
    );

    if (!portOneRes.ok) {
      const errText = await portOneRes.text().catch(() => '');
      await markOrderFailed(order.id, 'portone_lookup_failed');
      return NextResponse.json(
        {
          success: false,
          error: 'PortOne 결제 조회 실패',
          detail: errText.slice(0, 500),
        },
        { status: 502 }
      );
    }

    const payment = await portOneRes.json();

    // 3) 결제 상태 및 금액 검증
    const paidAmount: number | undefined =
      payment?.amount?.total ?? payment?.amount?.paid ?? undefined;
    const paymentStatus: string | undefined = payment?.status;

    if (paymentStatus !== 'PAID') {
      await markOrderFailed(order.id, `status_${paymentStatus ?? 'unknown'}`);
      return NextResponse.json(
        {
          success: false,
          error: `결제가 완료되지 않은 상태입니다 (status=${paymentStatus}).`,
        },
        { status: 400 }
      );
    }

    if (typeof paidAmount !== 'number' || paidAmount !== Number(order.amount)) {
      await markOrderFailed(order.id, 'amount_mismatch');
      return NextResponse.json(
        {
          success: false,
          error: '결제 금액이 주문 금액과 일치하지 않습니다.',
          expected: order.amount,
          actual: paidAmount,
        },
        { status: 400 }
      );
    }

    // 4) 주문 업데이트 + 크레딧 지급 (트랜잭션 대용 — 순차 처리)
    const granted = await grantCreditsForOrder(order, paymentId, payment?.method?.type);

    if (!granted.ok) {
      return NextResponse.json(
        { success: false, error: granted.error ?? '크레딧 지급에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      creditsGranted: granted.credits,
    });
  } catch (e: any) {
    console.error('[payment/verify]', e);
    return NextResponse.json(
      { success: false, error: '결제 검증 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

async function markOrderFailed(orderId: string, reason: string) {
  await supabaseAdmin
    .from('orders')
    .update({ status: 'failed', payment_method: reason })
    .eq('id', orderId);
}

/**
 * 주문 완료 처리 + 해/달 크레딧 지급 + 거래 기록.
 * 이미 completed면 아무 것도 하지 않는다 (멱등성).
 */
export async function grantCreditsForOrder(
  order: any,
  portOnePaymentId: string,
  paymentMethod?: string
): Promise<{ ok: boolean; credits?: { sun: number; moon: number }; error?: string }> {
  const pkg = getPackageById(order.package_id);
  if (!pkg) {
    return { ok: false, error: `알 수 없는 패키지: ${order.package_id}` };
  }

  const sunTotal = pkg.sunCredit + pkg.bonusSun;
  const moonTotal = pkg.moonCredit + pkg.bonusMoon;

  // 1) 주문을 completed로 전환 (status='pending'인 경우에만 — 경합 방지)
  const { data: updated, error: updErr } = await supabaseAdmin
    .from('orders')
    .update({
      status: 'completed',
      payment_key: portOnePaymentId,
      portone_payment_id: portOnePaymentId,
      payment_method: paymentMethod ?? null,
      completed_at: new Date().toISOString(),
      sun_credit_amount: sunTotal,
      moon_credit_amount: moonTotal,
    })
    .eq('id', order.id)
    .eq('status', 'pending') // pending → completed 에만 허용
    .select()
    .maybeSingle();

  if (updErr) {
    return { ok: false, error: updErr.message };
  }
  if (!updated) {
    // 이미 다른 요청이 처리했을 수 있음 (멱등)
    return { ok: true, credits: { sun: sunTotal, moon: moonTotal } };
  }

  // 2) 잔액 추가 — 원자적 RPC (read-modify-write race 차단, idempotency_key=order.id)
  //    동시 두 결제가 같은 currentSun 을 읽고 각자 더해서 한 쪽이 손실되던 사고 방지.
  if (sunTotal > 0) {
    const { data: rSun, error: errSun } = await supabaseAdmin.rpc('grant_credit_atomic', {
      p_user_id: order.user_id,
      p_credit_type: 'sun',
      p_amount: sunTotal,
      p_reason: `${pkg.name} 구매`,
      p_idempotency_key: `purchase-sun-${order.id}`,
    });
    if (errSun) {
      return { ok: false, error: `sun 적립 실패: ${errSun.message}` };
    }
    if (rSun !== 'ok' && rSun !== 'duplicate') {
      return { ok: false, error: `sun 적립 거부: ${rSun}` };
    }
  }
  if (moonTotal > 0) {
    const { data: rMoon, error: errMoon } = await supabaseAdmin.rpc('grant_credit_atomic', {
      p_user_id: order.user_id,
      p_credit_type: 'moon',
      p_amount: moonTotal,
      p_reason: `${pkg.name} 구매`,
      p_idempotency_key: `purchase-moon-${order.id}`,
    });
    if (errMoon) {
      return { ok: false, error: `moon 적립 실패: ${errMoon.message}` };
    }
    if (rMoon !== 'ok' && rMoon !== 'duplicate') {
      return { ok: false, error: `moon 적립 거부: ${rMoon}` };
    }
  }

  // 3) total_*_purchased 통계 누적 (atomic SQL increment — 단일 컬럼이라 단순 update OK)
  if (sunTotal > 0 || moonTotal > 0) {
    await supabaseAdmin.rpc('increment_purchase_totals', {
      p_user_id: order.user_id,
      p_sun_amount: sunTotal,
      p_moon_amount: moonTotal,
    }).then(() => undefined, () => undefined);
  }

  return { ok: true, credits: { sun: sunTotal, moon: moonTotal } };
}
