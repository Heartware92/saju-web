'use client';

/**
 * 토스페이먼츠 결제위젯 체크아웃 페이지 (계약 심사/테스트용 — 2026-07-16)
 * /credit 결제수단 모달의 "신용·체크카드 (테스트용)" → pending 주문 생성 후 이 페이지로 온다.
 * 위젯(결제수단 선택 UI + 약관)을 렌더하고, 결제하기 버튼으로 토스 결제창을 띄운다.
 * 완료 시 successUrl(/payment/tosspayments/callback) → /api/payment/tosspayments/confirm 승인.
 *
 * 금액은 서버가 승인 단계에서 패키지 정가와 재검증하므로, 여기 표시값이 변조돼도 승인은 실패한다.
 */

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase, auth, orderDB } from '@/services/supabase';
import type { Order } from '@/types/credit';

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY || '';

export default function TossPaymentsCheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ran = useRef(false);
  // widgets 인스턴스 (SDK 타입은 동적 import 라 any 로 보관)
  const widgetsRef = useRef<any>(null);

  const [order, setOrder] = useState<Order | null>(null);
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const orderId = searchParams?.get('orderId') || '';

    (async () => {
      try {
        if (!CLIENT_KEY) {
          setError('토스페이먼츠 키가 아직 설정되지 않았습니다.');
          return;
        }
        if (!orderId) {
          setError('주문 정보를 확인할 수 없습니다.');
          return;
        }
        const user = await auth.getCurrentUser();
        if (!user) {
          router.replace(`/login?from=${encodeURIComponent('/credit')}`);
          return;
        }

        // 본인 주문 조회 (RLS: 소유자만 읽힘) — pending 이 아니면 결제 진행 불가
        const { data: ord, error: ordErr } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .maybeSingle();
        if (ordErr || !ord) {
          setError('주문을 찾을 수 없습니다.');
          return;
        }
        if (ord.status !== 'pending') {
          router.replace('/credit');
          return;
        }
        setOrder(ord as Order);

        // 결제위젯 렌더
        const { loadTossPayments, ANONYMOUS } = await import('@tosspayments/tosspayments-sdk');
        const tossPayments = await loadTossPayments(CLIENT_KEY);
        const widgets = tossPayments.widgets({ customerKey: ANONYMOUS });
        widgetsRef.current = widgets;

        await widgets.setAmount({ currency: 'KRW', value: ord.amount });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: '#tp-methods', variantKey: 'DEFAULT' }),
          widgets.renderAgreement({ selector: '#tp-agreement', variantKey: 'AGREEMENT' }),
        ]);
        setReady(true);
      } catch (e: any) {
        console.error('[tosspayments/checkout]', e);
        setError(e?.message || '결제 화면을 여는 데 실패했습니다.');
      }
    })();
  }, [searchParams, router]);

  const pay = async () => {
    if (!order || !widgetsRef.current || paying) return;
    setPaying(true);
    try {
      const user = await auth.getCurrentUser();
      // 모바일 리다이렉트 대비 미완료 플래그 (기존 토스페이와 동일한 취소 모달 로직 재사용)
      try { sessionStorage.setItem('toss_payment_pending', order.id); } catch { /* noop */ }
      await widgetsRef.current.requestPayment({
        orderId: order.id,
        orderName: `크레딧 ${order.moon_credit_amount}개 (${order.package_name})`,
        successUrl: `${window.location.origin}/payment/tosspayments/callback`,
        failUrl: `${window.location.origin}/payment/tosspayments/callback`,
        customerEmail: user?.email || undefined,
        customerName: user?.user_metadata?.name || user?.user_metadata?.full_name || '구매자',
      });
      // 성공 시 successUrl 로 이동한다 (여기 도달해도 곧 페이지 전환)
    } catch (e: any) {
      // 사용자가 결제창을 닫음/취소 — 주문은 유지(pending)하고 재시도 가능하게 둔다
      try { sessionStorage.removeItem('toss_payment_pending'); } catch { /* noop */ }
      const code = e?.code as string | undefined;
      if (code !== 'USER_CANCEL' && code !== 'PAY_PROCESS_CANCELED') {
        alert(e?.message || '결제에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      }
      setPaying(false);
    }
  };

  const cancelAndBack = async () => {
    if (order) {
      await orderDB.updateOrderStatus(order.id, 'cancelled').catch(() => undefined);
    }
    router.replace('/credit');
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl bg-space-surface/70 border border-[var(--border-subtle)] p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-lg font-bold mb-2 text-text-primary">결제를 진행할 수 없습니다</h1>
          <p className="text-sm text-text-secondary mb-6 leading-relaxed">{error}</p>
          <button
            onClick={() => router.replace('/credit')}
            className="px-4 py-2 rounded-lg bg-cta text-white text-sm font-bold"
          >
            충전 페이지로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-6 max-w-[560px] mx-auto">
      <h1 className="text-[19px] font-bold text-text-primary mb-1">결제하기</h1>
      <p className="text-[12.5px] text-text-tertiary mb-4">토스페이먼츠 테스트 전용입니다.</p>

      {order && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-space-surface/80 border border-[var(--border-subtle)] text-sm text-text-secondary text-center">
          <span className="font-bold text-text-primary">{order.package_name}</span>
          {' · '}🌙 {order.moon_credit_amount}개{' · '}
          <span className="font-bold text-text-primary">{order.amount.toLocaleString()}원</span>
        </div>
      )}

      {/* 위젯은 밝은 UI 라 흰 카드로 감싼다 */}
      <div className="rounded-2xl bg-white overflow-hidden mb-4">
        <div id="tp-methods" />
        <div id="tp-agreement" />
      </div>

      {!ready && !error && (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-3 border-cta border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <button
        onClick={pay}
        disabled={!ready || paying}
        className="w-full h-12 rounded-xl bg-cta text-white font-bold text-[15px] disabled:opacity-40 transition-opacity"
      >
        {paying ? '결제 진행 중…' : '결제하기'}
      </button>
      <button
        onClick={cancelAndBack}
        disabled={paying}
        className="w-full h-11 mt-2 rounded-xl bg-space-elevated text-text-secondary border border-[var(--border-default)] text-sm disabled:opacity-40"
      >
        취소하고 돌아가기
      </button>
    </div>
  );
}
