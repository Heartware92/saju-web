/**
 * POST /api/payment/refund
 *
 * 주문의 PortOne 결제를 취소(환불)한다.
 * PortOne V2 REST API:
 *   POST https://api.portone.io/payments/{paymentId}/cancel
 *   Body: { reason: string }
 *
 * 환불 정책 — 미사용 크레딧 전액 환불 원칙:
 *  - 지급된 해/달 크레딧이 현재 잔액에 모두 남아 있는 경우에만 자동 환불 허용.
 *  - 일부라도 사용했다면 반려하고 고객센터 문의 유도.
 *
 * Body: { orderId: string, reason?: string }
 * Auth: Authorization: Bearer <supabase-access-token>  (클라이언트가 세션 토큰을 전달)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';

const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET || '';
const PORTONE_API_BASE = 'https://api.portone.io';
const TOSS_PAY_API_KEY = process.env.TOSS_PAY_API_KEY || '';
const TOSS_PAY_API_BASE = 'https://pay.toss.im/api/v2';

interface RefundRequestBody {
  orderId: string;
  reason?: string;
}

export async function POST(req: NextRequest) {
  try {
    // 사용자 인증 — 서버 설정 누출 방지 위해 auth 먼저 확인
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json(
        { success: false, error: '세션이 만료되었습니다.' },
        { status: 401 }
      );
    }
    const userId = userData.user.id;

    const { orderId, reason } = (await req.json()) as RefundRequestBody;
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId가 필요합니다.' },
        { status: 400 }
      );
    }

    // 1) 주문 조회 — 반드시 요청자 소유여야 함
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!order) {
      return NextResponse.json(
        { success: false, error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (order.status !== 'completed') {
      return NextResponse.json(
        { success: false, error: '환불 가능한 주문이 아닙니다.' },
        { status: 400 }
      );
    }

    // 결제수단별 PG 참조 — 토스페이는 payToken(payment_key), 그 외(포트원)는 portone_payment_id.
    const isToss = order.payment_method === 'tosspay';
    const pgRef: string | null = isToss
      ? (order.payment_key ?? null)
      : (order.portone_payment_id ?? null);
    if (!pgRef) {
      return NextResponse.json(
        { success: false, error: '결제 정보가 없어 환불할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 2) 미사용 검증 — 현재 잔액이 지급분 이상이어야 함
    const { data: userCredit } = await supabaseAdmin
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const sunGranted = order.sun_credit_amount ?? 0;
    const moonGranted = order.moon_credit_amount ?? 0;
    const sunBalance = userCredit?.sun_balance ?? 0;
    const moonBalance = userCredit?.moon_balance ?? 0;

    if (sunBalance < sunGranted || moonBalance < moonGranted) {
      return NextResponse.json(
        {
          success: false,
          error: '이미 사용한 크레딧이 있어 자동 환불이 불가합니다. 고객센터에 문의해 주세요.',
        },
        { status: 400 }
      );
    }

    // 3) PG 환불 API 호출 — 결제수단별 분기
    let pgOk = false;
    let pgDetail = '';
    if (isToss) {
      if (!TOSS_PAY_API_KEY) {
        return NextResponse.json(
          { success: false, error: '토스페이 환불 설정이 없습니다.' },
          { status: 500 }
        );
      }
      // amount 미지정 = 전액 환불. refundNo + idempotent 로 중복 환불 방지.
      const r = await fetch(`${TOSS_PAY_API_BASE}/refunds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          apiKey: TOSS_PAY_API_KEY,
          payToken: pgRef,
          reason: reason || '사용자 요청 환불',
          refundNo: `refund-${orderId}`,
          idempotent: true,
        }),
      });
      const j = await r.json().catch(() => null);
      pgOk = r.ok && j?.code === 0;
      pgDetail = pgOk ? '' : JSON.stringify(j ?? {}).slice(0, 500);
    } else {
      if (!PORTONE_API_SECRET) {
        return NextResponse.json(
          { success: false, error: 'PortOne API secret is not configured.' },
          { status: 500 }
        );
      }
      const r = await fetch(
        `${PORTONE_API_BASE}/payments/${encodeURIComponent(pgRef)}/cancel`,
        {
          method: 'POST',
          headers: {
            Authorization: `PortOne ${PORTONE_API_SECRET}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: reason || '사용자 요청 환불' }),
          cache: 'no-store',
        }
      );
      pgOk = r.ok;
      pgDetail = pgOk ? '' : (await r.text().catch(() => '')).slice(0, 500);
    }

    if (!pgOk) {
      return NextResponse.json(
        { success: false, error: '환불 실패', detail: pgDetail },
        { status: 502 }
      );
    }

    // 4) 환불 처리 — atomic RPC 로 묶음
    //   balance/consumed/purchased counters + order status + credit_transactions
    //   를 단일 트랜잭션 안에서 처리. idempotency 보장 (같은 order 재호출 시 'duplicate').
    const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc(
      'refund_order_atomic',
      {
        p_order_id: orderId,
        p_user_id: userId,
        p_sun_granted: sunGranted,
        p_moon_granted: moonGranted,
        p_package_name: order.package_name ?? '',
        p_idempotency_key: `refund-${orderId}`,
      }
    );

    if (rpcErr) {
      console.error('[payment/refund] RPC error', rpcErr);
      return NextResponse.json(
        { success: false, error: '환불 기록 실패. 고객센터에 문의해 주세요.' },
        { status: 500 }
      );
    }
    if (rpcResult !== 'ok' && rpcResult !== 'duplicate') {
      console.error('[payment/refund] RPC unexpected result:', rpcResult);
      return NextResponse.json(
        { success: false, error: `환불 처리 실패: ${rpcResult}` },
        { status: 500 }
      );
    }
    // 'duplicate' = 이미 환불됨. 멱등 동작이므로 정상 응답.

    return NextResponse.json({ success: true, orderId: order.id });
  } catch (e: any) {
    console.error('[payment/refund]', e);
    return NextResponse.json(
      { success: false, error: '환불 처리 중 오류가 발생했습니다. 고객센터에 문의해주세요.' },
      { status: 500 }
    );
  }
}
