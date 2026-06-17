'use client';

/**
 * 결제 콜백 페이지
 * PortOne 리다이렉트 모드에서 결제 완료 후 이 페이지로 돌아온다.
 * 쿼리 파라미터:
 *   - paymentId: 포트원 결제 ID
 *   - code, message: 실패 시 오류 코드 (선택)
 * customData에 담아둔 orderId는 URL에 포함되지 않으므로
 *   paymentId = "<orderId>-<timestamp>" 규약에서 orderId를 추출한다.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { handlePaymentCallback } from '../services/payment';

type Status = 'verifying' | 'success' | 'failed';

export default function PaymentCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('결제 결과를 확인 중입니다...');

  useEffect(() => {
    if (!searchParams) return;

    const paymentId = searchParams.get('paymentId') || '';
    const code = searchParams.get('code');
    const msg = searchParams.get('message');

    // 코드가 실려 돌아온 경우: 사용자 취소(닫기/뒤로)면 /credit 의 취소 모달로 통일,
    // 그 외 기술적 실패는 기존 실패 화면 유지.
    if (code) {
      if (/cancel/i.test(code)) {
        router.replace('/credit?canceled=1');
        return;
      }
      setStatus('failed');
      setMessage(msg || '결제가 취소되었거나 실패했습니다.');
      return;
    }

    if (!paymentId) {
      setStatus('failed');
      setMessage('결제 정보를 확인할 수 없습니다.');
      return;
    }

    const orderId = paymentId.split('-')[0];
    if (!orderId) {
      setStatus('failed');
      setMessage('주문 정보를 확인할 수 없습니다.');
      return;
    }

    (async () => {
      const result = await handlePaymentCallback(paymentId, orderId);
      if (result.success) {
        setStatus('success');
        setMessage('결제가 완료되었습니다. 크레딧이 충전되었어요.');
      } else {
        setStatus('failed');
        setMessage(result.message || '결제 검증에 실패했습니다.');
      }
    })();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl bg-space-surface/70 border border-[var(--border-subtle)] p-8 text-center">
        <div className="text-5xl mb-4">
          {status === 'verifying' && '⏳'}
          {status === 'success' && '✅'}
          {status === 'failed' && '⚠️'}
        </div>
        <h1 className="text-lg font-bold mb-2 text-text-primary">
          {status === 'verifying' && '결제 확인 중'}
          {status === 'success' && '결제 완료'}
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
          {status === 'failed' && (
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
