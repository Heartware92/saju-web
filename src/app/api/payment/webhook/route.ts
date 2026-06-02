/**
 * POST /api/payment/webhook
 *
 * PortOne V2 웹훅 수신 엔드포인트.
 * Standard Webhooks (https://www.standardwebhooks.com/) 규격에 따라 다음 헤더를 검증한다.
 *   - webhook-id
 *   - webhook-timestamp
 *   - webhook-signature  (형식: "v1,<base64>")
 *
 * 서명은 HMAC-SHA256(secret, `${id}.${timestamp}.${rawBody}`)를 base64 인코딩한 값이다.
 * 비밀 키는 PortOne 콘솔에서 발급받은 Webhook Secret(whsec_...).
 *
 * 웹훅은 결제 완료/실패/취소 이벤트의 비동기 백업 경로 역할을 한다.
 * 클라이언트 verify 라우트와 상관없이 멱등하게 처리된다.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { grantCreditsForOrder } from '../verify/route';

const WEBHOOK_SECRET = process.env.PORTONE_WEBHOOK_SECRET || '';
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET || '';
const PORTONE_API_BASE = 'https://api.portone.io';

// 재처리 방지를 위한 최대 허용 타임스탬프 (5분)
const MAX_TIMESTAMP_SKEW_SEC = 300;

export async function POST(req: NextRequest) {
  try {
    if (!WEBHOOK_SECRET) {
      console.error('[webhook] PORTONE_WEBHOOK_SECRET is not set.');
      return NextResponse.json({ ok: false, error: 'webhook_not_configured' }, { status: 500 });
    }

    const rawBody = await req.text();
    const webhookId = req.headers.get('webhook-id') ?? '';
    const webhookTimestamp = req.headers.get('webhook-timestamp') ?? '';
    const webhookSignatureHeader = req.headers.get('webhook-signature') ?? '';

    if (!webhookId || !webhookTimestamp || !webhookSignatureHeader) {
      return NextResponse.json({ ok: false, error: 'missing_headers' }, { status: 400 });
    }

    // 타임스탬프 검증 (재전송 공격 방지)
    const tsNum = Number(webhookTimestamp);
    if (!Number.isFinite(tsNum)) {
      return NextResponse.json({ ok: false, error: 'invalid_timestamp' }, { status: 400 });
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - tsNum) > MAX_TIMESTAMP_SKEW_SEC) {
      return NextResponse.json({ ok: false, error: 'stale_timestamp' }, { status: 400 });
    }

    // 서명 검증 (Standard Webhooks)
    if (!verifySignature(rawBody, webhookId, webhookTimestamp, webhookSignatureHeader)) {
      return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 401 });
    }

    // 이벤트 파싱
    const event = JSON.parse(rawBody);
    // PortOne 웹훅 본문 예: { type: "Transaction.Paid", data: { paymentId, storeId, transactionId, ... } }
    const type: string = event?.type ?? '';
    const paymentId: string | undefined = event?.data?.paymentId;

    if (!paymentId) {
      return NextResponse.json({ ok: true, ignored: 'no_paymentId' });
    }

    // paymentId 형식: "<orderId>-<timestamp>"
    const orderId = paymentId.split('-')[0];

    if (!orderId) {
      return NextResponse.json({ ok: true, ignored: 'no_orderId' });
    }

    // 이벤트 타입별 처리
    if (type === 'Transaction.Paid') {
      return await handlePaid(paymentId, orderId);
    }
    if (type === 'Transaction.Failed' || type === 'Transaction.Cancelled') {
      return await handleFailedOrCancelled(orderId, type);
    }

    // 그 외 이벤트는 로깅 후 200 반환
    return NextResponse.json({ ok: true, ignored: type });
  } catch (e: any) {
    console.error('[webhook]', e);
    return NextResponse.json({ ok: false, error: '웹훅 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

function verifySignature(
  rawBody: string,
  webhookId: string,
  webhookTimestamp: string,
  signatureHeader: string
): boolean {
  // signatureHeader: "v1,<base64> [v1,<base64> ...]"  — 키 로테이션 대응
  const secret = WEBHOOK_SECRET.startsWith('whsec_')
    ? WEBHOOK_SECRET.slice(6)
    : WEBHOOK_SECRET;

  let secretKey: Buffer;
  try {
    secretKey = Buffer.from(secret, 'base64');
  } catch {
    secretKey = Buffer.from(secret, 'utf8');
  }

  const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', secretKey)
    .update(signedPayload)
    .digest('base64');

  const provided = signatureHeader
    .split(' ')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('v1,'))
    .map((s) => s.slice(3));

  if (provided.length === 0) return false;

  // 타이밍 공격 방지 — constant-time 비교
  return provided.some((sig) => {
    try {
      const a = Buffer.from(sig, 'base64');
      const b = Buffer.from(expected, 'base64');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

async function handlePaid(paymentId: string, orderId: string) {
  // 주문 조회
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ ok: true, ignored: 'order_not_found' });
  }
  if (order.status === 'completed') {
    return NextResponse.json({ ok: true, alreadyCompleted: true });
  }

  // PortOne에서 결제 내역 재조회 (금액 검증 위해)
  if (!PORTONE_API_SECRET) {
    return NextResponse.json({ ok: false, error: 'api_secret_missing' }, { status: 500 });
  }

  const res = await fetch(
    `${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`,
    {
      method: 'GET',
      headers: { Authorization: `PortOne ${PORTONE_API_SECRET}` },
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: 'portone_lookup_failed' }, { status: 502 });
  }

  const payment = await res.json();
  const paid: number | undefined =
    payment?.amount?.total ?? payment?.amount?.paid ?? undefined;

  if (payment?.status !== 'PAID' || paid !== Number(order.amount)) {
    return NextResponse.json({ ok: false, error: 'verification_mismatch' }, { status: 400 });
  }

  const result = await grantCreditsForOrder(order, paymentId, payment?.method?.type);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, credits: result.credits });
}

async function handleFailedOrCancelled(orderId: string, type: string) {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ ok: true, ignored: 'order_not_found' });
  }

  // 이미 환불 처리된 주문은 멱등하게 무시
  if (order.status === 'refunded') {
    return NextResponse.json({ ok: true, alreadyRefunded: true });
  }

  // 결제 취소(Transaction.Cancelled)인데 이미 크레딧이 지급된(completed) 주문이면
  // 지급된 크레딧을 원자적으로 회수한다. (PG 콘솔 직접 취소·차지백 등 외부 취소 자동 대응)
  // refund_order_atomic 이 내부에서 주문 상태를 'refunded'로 갱신한다.
  if (type === 'Transaction.Cancelled' && order.status === 'completed') {
    const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc('refund_order_atomic', {
      p_order_id: orderId,
      p_user_id: order.user_id,
      p_sun_granted: order.sun_credit_amount ?? 0,
      p_moon_granted: order.moon_credit_amount ?? 0,
      p_package_name: order.package_name ?? '',
      p_idempotency_key: `refund-${orderId}`,
    });

    if (rpcErr) {
      console.error('[webhook] refund_order_atomic error', rpcErr);
      return NextResponse.json({ ok: false, error: 'refund_failed' }, { status: 500 });
    }
    // 'ok'(회수 완료) | 'duplicate'(앱 환불 등으로 이미 회수됨) 만 정상으로 간주.
    // 그 외(no_user 등)는 비정상 → 500 반환으로 PortOne 재시도를 유도한다.
    if (rpcResult !== 'ok' && rpcResult !== 'duplicate') {
      console.error('[webhook] refund_order_atomic unexpected result:', rpcResult);
      return NextResponse.json({ ok: false, error: `refund_${rpcResult}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, refunded: true, rpc: rpcResult });
  }

  // 크레딧 지급 전(pending) 주문의 취소/실패는 상태만 정리한다.
  //  - 명시적 취소(Transaction.Cancelled) → 'cancelled'
  //  - 기술적 실패(Transaction.Failed)     → 'failed'
  // (completed → 'cancelled' 으로 잘못 떨어뜨려 크레딧이 남는 일이 없도록 pending 만 대상으로 한다)
  const newStatus = type === 'Transaction.Cancelled' ? 'cancelled' : 'failed';
  await supabaseAdmin
    .from('orders')
    .update({ status: newStatus })
    .eq('id', orderId)
    .eq('status', 'pending');

  return NextResponse.json({ ok: true });
}
