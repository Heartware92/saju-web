/**
 * POST /api/payment/toss/confirm
 *
 * 토스페이(TossPay) 간편결제 직연동 — 결제 승인(capture) 단계.
 * 사용자가 토스 결제창 인증을 마치고 retUrl(/payment/toss/callback)로 복귀하면
 * 콜백 페이지가 이 라우트를 호출한다. 서버는 저장해 둔 payToken으로 실제 승인을 진행하고,
 * 금액을 검증한 뒤 기존 grantCreditsForOrder() 멱등 로직으로 달 크레딧을 지급한다.
 *
 * 토스페이 승인 API:
 *   POST https://pay.toss.im/api/v2/execute  Body: { apiKey, payToken, orderNo }
 *
 * Body: { orderId: string, canceled?: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { getPackageById } from '@/constants/pricing';
import { grantCreditsForOrder } from '../../verify/route';

const TOSS_PAY_API_KEY = process.env.TOSS_PAY_API_KEY || '';
const TOSS_PAY_API_BASE = 'https://pay.toss.im/api/v2';

export async function POST(req: NextRequest) {
  try {
    if (!TOSS_PAY_API_KEY) {
      return NextResponse.json(
        { success: false, error: '토스페이 API 키가 서버에 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const { orderId, canceled } = (await req.json()) as { orderId?: string; canceled?: boolean };
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
      return NextResponse.json({
        success: true,
        alreadyCompleted: true,
        orderId: order.id,
      });
    }

    // 사용자가 결제창에서 취소하고 돌아온 경우
    if (canceled) {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id)
        .in('status', ['pending']);
      return NextResponse.json({ success: false, canceled: true, error: '결제를 취소하였습니다.' });
    }

    const payToken: string | null = order.payment_key ?? null;
    if (!payToken) {
      return NextResponse.json(
        { success: false, error: '결제 토큰이 없습니다. 결제를 다시 시도해 주세요.' },
        { status: 400 }
      );
    }

    const pkg = getPackageById(order.package_id);
    if (!pkg) {
      return NextResponse.json({ success: false, error: '알 수 없는 패키지입니다.' }, { status: 400 });
    }
    const amount = pkg.price;

    // 0) 동시 confirm 이중 캡처(이중 청구) 방지 — execute 전에 주문을 원자적으로 선점한다.
    //    orders.status enum 에 'processing' 이 없어, free-text payment_method 를 CAS 락으로 사용한다.
    //    승리한 1건만 execute(실제 캡처)로 진입하고, 나머지는 재실행 없이 멱등 응답한다.
    const { data: claimed } = await supabaseAdmin
      .from('orders')
      .update({ payment_method: 'tosspay:executing' })
      .eq('id', order.id)
      .eq('status', 'pending')
      .eq('payment_method', 'tosspay')
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

    // 1) 결제 승인 (실제 캡처) — 위 CAS 락을 획득한 요청만 도달
    const execRes = await fetch(`${TOSS_PAY_API_BASE}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ apiKey: TOSS_PAY_API_KEY, payToken, orderNo: order.id }),
    });

    const exec = await execRes.json().catch(() => null);

    if (!execRes.ok || exec?.code !== 0) {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'failed', payment_method: 'tosspay_execute_failed' })
        .eq('id', order.id)
        .in('status', ['pending']);
      return NextResponse.json(
        { success: false, error: '토스페이 결제 승인에 실패했습니다.', detail: exec ?? null },
        { status: 502 }
      );
    }

    // 2) 금액 검증 (승인 응답의 amount 와 패키지 정가 대조)
    if (Number(exec.amount) !== amount) {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'failed', payment_method: 'tosspay_amount_mismatch' })
        .eq('id', order.id);
      return NextResponse.json(
        { success: false, error: '결제 금액이 주문 금액과 일치하지 않습니다.', expected: amount, actual: exec.amount },
        { status: 400 }
      );
    }

    // 3) 주문 완료 + 크레딧 지급 (기존 멱등 로직 재사용)
    //    payToken 을 보존한다(payment_key·portone_payment_id) — 토스 환불(/refunds)이 payToken 을 사용.
    const granted = await grantCreditsForOrder(order, payToken, 'tosspay');

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
    console.error('[payment/toss/confirm]', e);
    return NextResponse.json(
      { success: false, error: '결제 승인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
