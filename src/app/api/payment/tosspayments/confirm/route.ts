/**
 * POST /api/payment/tosspayments/confirm
 *
 * 토스페이먼츠(TossPayments) PG 직연동 — 결제 승인 단계. (토스페이 간편결제와 별개 서비스)
 * 사용자가 토스페이먼츠 결제창 인증을 마치고 successUrl(/payment/tosspayments/callback)로
 * 복귀하면 콜백 페이지가 이 라우트를 호출한다. 서버는 금액을 검증한 뒤 승인 API를 호출하고,
 * 기존 grantCreditsForOrder() 멱등 로직으로 달 크레딧을 지급한다.
 *
 * 토스페이먼츠 승인 API:
 *   POST https://api.tosspayments.com/v1/payments/confirm
 *   Authorization: Basic base64(secretKey + ':')
 *   Body: { paymentKey, orderId, amount }
 *
 * Body: { orderId: string, paymentKey?: string, amount?: number, canceled?: boolean, failMessage?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { getPackageById } from '@/constants/pricing';
import { grantCreditsForOrder } from '../../verify/route';

const TOSSPAYMENTS_SECRET_KEY = process.env.TOSSPAYMENTS_SECRET_KEY || '';
const TOSSPAYMENTS_API_BASE = 'https://api.tosspayments.com/v1';

export async function POST(req: NextRequest) {
  try {
    const { orderId, paymentKey, amount, canceled, failMessage } = (await req.json()) as {
      orderId?: string;
      paymentKey?: string;
      amount?: number;
      canceled?: boolean;
      failMessage?: string;
    };
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId가 필요합니다.' }, { status: 400 });
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ success: false, error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 이미 완료 → 멱등 성공
    if (order.status === 'completed') {
      return NextResponse.json({ success: true, alreadyCompleted: true, orderId: order.id });
    }

    // 사용자가 결제창에서 취소/실패로 돌아온 경우 (failUrl 복귀)
    if (canceled || !paymentKey) {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id)
        .in('status', ['pending']);
      return NextResponse.json({
        success: false,
        canceled: true,
        error: failMessage || '결제를 취소하였습니다.',
      });
    }

    if (!TOSSPAYMENTS_SECRET_KEY) {
      return NextResponse.json(
        { success: false, error: '토스페이먼츠 시크릿 키가 서버에 설정되지 않았습니다.' },
        { status: 500 },
      );
    }

    const pkg = getPackageById(order.package_id);
    if (!pkg) {
      return NextResponse.json({ success: false, error: '알 수 없는 패키지입니다.' }, { status: 400 });
    }

    // 1) 승인 전 금액 검증 (토스페이먼츠 필수 절차) — successUrl 쿼리의 amount 와 패키지 정가 대조
    if (Number(amount) !== pkg.price) {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'failed', payment_method: 'tosspayments_amount_mismatch' })
        .eq('id', order.id)
        .in('status', ['pending']);
      return NextResponse.json(
        { success: false, error: '결제 금액이 주문 금액과 일치하지 않습니다.', expected: pkg.price, actual: amount },
        { status: 400 },
      );
    }

    // 2) 동시 confirm 이중 승인 방지 — 승인 전에 주문을 원자적으로 선점 (toss/confirm 과 동일한 CAS 락 패턴).
    //    주문 생성 시 payment_method='tosspayments' 로 만들어지므로 그 값을 선점 조건으로 사용한다.
    const { data: claimed } = await supabaseAdmin
      .from('orders')
      .update({ payment_method: 'tosspayments:confirming' })
      .eq('id', order.id)
      .eq('status', 'pending')
      .eq('payment_method', 'tosspayments')
      .select('id')
      .maybeSingle();
    if (!claimed) {
      const { data: cur } = await supabaseAdmin
        .from('orders').select('status').eq('id', order.id).maybeSingle();
      if (cur?.status === 'completed') {
        return NextResponse.json({ success: true, alreadyCompleted: true, orderId: order.id });
      }
      return NextResponse.json(
        { success: false, error: '결제가 처리 중입니다. 잠시 후 다시 확인해 주세요.', processing: true },
        { status: 409 },
      );
    }

    // 3) 결제 승인 (실제 캡처) — 위 CAS 락을 획득한 요청만 도달
    const basic = Buffer.from(`${TOSSPAYMENTS_SECRET_KEY}:`).toString('base64');
    const confirmRes = await fetch(`${TOSSPAYMENTS_API_BASE}/payments/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basic}`,
      },
      cache: 'no-store',
      body: JSON.stringify({ paymentKey, orderId: order.id, amount: pkg.price }),
    });

    const confirm = await confirmRes.json().catch(() => null);

    if (!confirmRes.ok || confirm?.status !== 'DONE') {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'failed', payment_method: 'tosspayments_confirm_failed' })
        .eq('id', order.id)
        .in('status', ['pending']);
      return NextResponse.json(
        {
          success: false,
          error: confirm?.message || '토스페이먼츠 결제 승인에 실패했습니다.',
          code: confirm?.code ?? null,
        },
        { status: 502 },
      );
    }

    // 4) 승인 응답 금액 재검증 (이중 안전장치)
    if (Number(confirm.totalAmount) !== pkg.price) {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'failed', payment_method: 'tosspayments_amount_mismatch' })
        .eq('id', order.id);
      return NextResponse.json(
        { success: false, error: '승인 금액이 주문 금액과 일치하지 않습니다.', expected: pkg.price, actual: confirm.totalAmount },
        { status: 400 },
      );
    }

    // 5) 주문 완료 + 크레딧 지급 (기존 멱등 로직 재사용)
    //    paymentKey 를 보존한다(payment_key·portone_payment_id) — 토스페이먼츠 취소(/payments/{paymentKey}/cancel)가 사용.
    const granted = await grantCreditsForOrder(order, paymentKey, 'tosspayments');

    if (!granted.ok) {
      return NextResponse.json(
        { success: false, error: granted.error ?? '크레딧 지급에 실패했습니다.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      creditsGranted: granted.credits,
    });
  } catch (e: any) {
    console.error('[payment/tosspayments/confirm]', e);
    return NextResponse.json(
      { success: false, error: '결제 승인 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
