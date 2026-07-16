'use client';

/**
 * 토스페이먼츠(TossPayments) PG 결제 콜백 페이지 (토스페이 간편결제 콜백과 별개)
 * 결제창 인증 완료/실패 후 successUrl·failUrl 로 돌아오는 곳.
 * 쿼리 파라미터:
 *   - 성공: paymentKey, orderId, amount (+paymentType)
 *   - 실패: code, message, orderId
 * 서버 /api/payment/tosspayments/confirm 을 호출해 승인 + 크레딧 지급을 마친다.
 */

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCreditStore } from '@/store/useCreditStore';

type Status = 'verifying' | 'success' | 'failed' | 'canceled';

export default function TossPaymentsCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ran = useRef(false);

  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('결제 결과를 확인 중입니다...');

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // 콜백에 도달했으면 결제창을 정상 통과한 것 — 미완료 플래그 정리.
    try { sessionStorage.removeItem('toss_payment_pending'); } catch { /* noop */ }

    const orderId = searchParams?.get('orderId') || '';
    const paymentKey = searchParams?.get('paymentKey') || '';
    const amount = searchParams?.get('amount') || '';
    const failCode = searchParams?.get('code') || '';
    const failMessage = searchParams?.get('message') || '';

    if (!orderId) {
      setStatus('failed');
      setMessage('주문 정보를 확인할 수 없습니다.');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/payment/tosspayments/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            paymentKey
              ? { orderId, paymentKey, amount: Number(amount) }
              : { orderId, canceled: true, failMessage: failMessage || failCode || undefined },
          ),
        });
        const json = await res.json().catch(() => null);

        if (json?.success) {
          await useCreditStore.getState().fetchBalance(undefined, { force: true });
          setStatus('success');
          setMessage('결제가 완료되었습니다. 크레딧이 충전되었어요.');
        } else if (json?.canceled) {
          setStatus('canceled');
          setMessage(json?.error || '결제가 취소되었습니다.');
        } else {
          setStatus('failed');
          setMessage(json?.error || '결제 확인에 실패했습니다.');
        }
      } catch {
        setStatus('failed');
        setMessage('결제 처리 중 오류가 발생했습니다.');
      }
    })();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl bg-space-surface/70 border border-[var(--border-subtle)] p-8 text-center">
        <div className="text-5xl mb-4">
          {status === 'verifying' && '⏳'}
          {status === 'success' && '✅'}
          {status === 'canceled' && '🚫'}
          {status === 'failed' && '⚠️'}
        </div>
        <h1 className="text-lg font-bold mb-2 text-text-primary">
          {status === 'verifying' && '결제 확인 중'}
          {status === 'success' && '결제 완료'}
          {status === 'canceled' && '결제 취소'}
          {status === 'failed' && '결제 실패'}
        </h1>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">{message}</p>

        <div className="flex gap-2 justify-center">
          {status === 'success' && (
            <button
              onClick={() => router.replace('/')}
              className="px-4 py-2 rounded-lg bg-cta text-white text-sm font-bold"
            >
              홈으로
            </button>
          )}
          {(status === 'failed' || status === 'canceled') && (
            <>
              <button
                onClick={() => router.replace('/credit')}
                className="px-4 py-2 rounded-lg bg-cta text-white text-sm font-bold"
              >
                다시 시도
              </button>
              <button
                onClick={() => router.replace('/')}
                className="px-4 py-2 rounded-lg bg-space-elevated text-text-primary border border-[var(--border-default)] text-sm"
              >
                홈으로
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
