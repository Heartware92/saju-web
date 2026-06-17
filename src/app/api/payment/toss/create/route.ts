/**
 * POST /api/payment/toss/create
 *
 * 토스페이(TossPay) 간편결제 직연동 — 결제 생성 단계.
 * 클라이언트가 pending 주문을 만든 뒤 orderId를 보내면,
 * 서버가 토스페이 결제 생성 API를 호출해 결제창(checkoutPage) URL을 돌려준다.
 *
 * 흐름:
 *   1. (클라) pending 주문 생성 → 이 라우트 호출
 *   2. (서버) POST https://pay.toss.im/api/v2/payments → checkoutPage, payToken
 *   3. (클라) checkoutPage 로 브라우저 이동 → 사용자 인증
 *   4. 인증완료 → retUrl(/payment/toss/callback) 로 복귀 → /confirm 에서 승인
 *
 * 금액은 클라이언트 전달값을 신뢰하지 않고 패키지 정의(pricing)에서 산출한다.
 *
 * Body: { orderId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { getPackageById } from '@/constants/pricing';

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

    const { orderId } = (await req.json()) as { orderId?: string };
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId가 필요합니다.' }, { status: 400 });
    }

    // 1) 주문 조회 — pending 만 결제 생성 허용
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ success: false, error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }
    if (order.status !== 'pending') {
      return NextResponse.json({ success: false, error: '이미 처리된 주문입니다.' }, { status: 400 });
    }

    const pkg = getPackageById(order.package_id);
    if (!pkg) {
      return NextResponse.json({ success: false, error: '알 수 없는 패키지입니다.' }, { status: 400 });
    }
    // 금액은 패키지 정의에서 산출 (클라이언트 위변조 방지)
    const amount = pkg.price;

    // 2) 토스페이 결제 생성. retUrl/retCancelUrl 은 요청 origin 기준(로컬 테스트가 운영으로 새지 않도록).
    const origin = req.nextUrl.origin;
    const retUrl = `${origin}/payment/toss/callback?orderId=${order.id}`;
    // 취소 시에는 카드결제와 동일하게 /credit 의 '결제 취소' 모달로 복귀(UX 통일)
    const retCancelUrl = `${origin}/credit?canceled=1`;

    const createRes = await fetch(`${TOSS_PAY_API_BASE}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({
        apiKey: TOSS_PAY_API_KEY,
        orderNo: order.id,
        amount,
        amountTaxFree: 0, // 전액 과세 (부가세 포함 가격)
        productDesc: `크레딧 ${pkg.moonCredit}개 (${pkg.name})`,
        autoExecute: false, // 수동 승인 — retUrl 복귀 후 /confirm 에서 금액 검증 뒤 execute
        retUrl,
        retCancelUrl,
      }),
    });

    const json = await createRes.json().catch(() => null);

    if (!createRes.ok || json?.code !== 0 || !json?.checkoutPage || !json?.payToken) {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'failed', payment_method: 'tosspay_create_failed' })
        .eq('id', order.id);
      return NextResponse.json(
        { success: false, error: '토스페이 결제 생성에 실패했습니다.', detail: json ?? null },
        { status: 502 }
      );
    }

    // 3) payToken 저장 (confirm 단계에서 승인에 사용) + 금액/결제수단 동기화
    await supabaseAdmin
      .from('orders')
      .update({ payment_key: json.payToken, payment_method: 'tosspay', amount })
      .eq('id', order.id);

    return NextResponse.json({
      success: true,
      checkoutPage: json.checkoutPage as string,
      payToken: json.payToken as string,
    });
  } catch (e: any) {
    console.error('[payment/toss/create]', e);
    return NextResponse.json(
      { success: false, error: '결제 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
