/**
 * 포트원(PortOne) 결제 통합 — 클라이언트 사이드
 *
 * 흐름:
 *   1. 주문 생성 (Supabase)
 *   2. PortOne V2 SDK로 결제창 호출
 *   3. 결제 응답을 받으면 즉시 /api/payment/verify 로 전송
 *      → 서버가 PortOne REST API로 실제 결제를 검증하고 크레딧을 지급
 *   4. 웹훅(/api/payment/webhook)은 비동기 백업 — 서버가 웹훅으로도 동일 로직 재실행
 *
 * 보안: 클라이언트는 절대 직접 크레딧을 증가시키지 않는다.
 */

import * as PortOne from '@portone/browser-sdk/v2';
import { orderDB, auth, supabase } from './supabase';
import { useCreditStore } from '../store/useCreditStore';
import { getPackageById } from '../constants/pricing';
import type { Order } from '../types/credit';

const PORTONE_STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID || '';
const PORTONE_CHANNEL_KEY = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY || '';
const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

if (
  typeof window !== 'undefined' &&
  (!PORTONE_STORE_ID || !PORTONE_CHANNEL_KEY)
) {
  console.warn('PortOne credentials are not set. Payment will not work.');
}

export interface PaymentRequest {
  packageId: string;
  amount: number;
  /** 표시용 크레딧 총량 — 실제 지급은 서버가 패키지 정의에서 계산 */
  creditAmount: number;
}

export interface PaymentResult {
  success: boolean;
  orderId?: string;
  error?: string;
  message?: string;
}

/**
 * 포트원 결제 처리 (클라이언트 진입점)
 */
export const processPayment = async (
  request: PaymentRequest
): Promise<PaymentResult> => {
  try {
    if (!PORTONE_STORE_ID || !PORTONE_CHANNEL_KEY) {
      return {
        success: false,
        error: 'CONFIG_MISSING',
        message: '결제 설정이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.',
      };
    }

    // 1. 로그인 확인
    const user = await auth.getCurrentUser();
    if (!user) {
      return {
        success: false,
        error: 'LOGIN_REQUIRED',
        message: '로그인이 필요합니다',
      };
    }

    // 2. 패키지 조회
    const packageInfo = getPackageById(request.packageId);
    if (!packageInfo) {
      return {
        success: false,
        error: 'INVALID_PACKAGE',
        message: '올바르지 않은 패키지입니다',
      };
    }

    // 3. 주문 생성 (status=pending)
    const orderData: Omit<Order, 'id' | 'created_at'> = {
      user_id: user.id,
      package_id: request.packageId,
      package_name: packageInfo.name,
      amount: request.amount,
      sun_credit_amount: packageInfo.sunCredit + packageInfo.bonusSun,
      moon_credit_amount: packageInfo.moonCredit + packageInfo.bonusMoon,
      status: 'pending',
    };

    const order = await orderDB.createOrder(orderData);
    const paymentId = `${order.id}-${Date.now()}`;

    // 4. PortOne 결제창 호출
    const response = await PortOne.requestPayment({
      storeId: PORTONE_STORE_ID,
      channelKey: PORTONE_CHANNEL_KEY,
      paymentId,
      orderName: `크레딧 ${request.creditAmount}개 (${packageInfo.name})`,
      totalAmount: request.amount,
      currency: 'CURRENCY_KRW',
      payMethod: 'CARD',
      redirectUrl: `${BASE_URL}/payment/callback`,
      customer: {
        email: user.email || undefined,
      },
      customData: {
        orderId: order.id,
        packageId: request.packageId,
        userId: user.id,
      },
    });

    // 5. 결제 실패
    if (response?.code !== undefined) {
      const isCanceled = response.code === 'PAY_PROCESS_CANCELED' || response.code === 'USER_CANCEL';
      await orderDB.updateOrderStatus(order.id, 'failed');
      return {
        success: false,
        error: response.code,
        message: isCanceled
          ? '결제를 취소하였습니다.'
          : '결제에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      };
    }

    // 6. 서버 검증 요청 (크레딧 지급은 서버가 수행)
    const verifyRes = await fetch('/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId,
        orderId: order.id,
      }),
    });

    const verifyJson = await verifyRes.json();

    if (!verifyRes.ok || !verifyJson?.success) {
      return {
        success: false,
        orderId: order.id,
        error: verifyJson?.error || 'VERIFY_FAILED',
        message:
          verifyJson?.error ||
          '결제가 완료되었지만 검증에 실패했습니다. 고객센터에 문의해 주세요.',
      };
    }

    // 7. 잔액 새로고침
    await useCreditStore.getState().fetchBalance();

    return {
      success: true,
      orderId: order.id,
      message: '결제가 완료되었습니다',
    };
  } catch (error: any) {
    console.error('Payment error:', error);
    return {
      success: false,
      error: 'PAYMENT_ERROR',
      message: '결제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    };
  }
};

/**
 * 리다이렉트 방식 결제 콜백 — /payment/callback 페이지에서 호출.
 * paymentId와 orderId를 받아 서버 verify 라우트를 호출한다.
 */
export const handlePaymentCallback = async (
  paymentId: string,
  orderId: string
): Promise<PaymentResult> => {
  try {
    const res = await fetch('/api/payment/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, orderId }),
    });
    const json = await res.json();

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || 'VERIFY_FAILED',
        message: json?.error || '결제 검증에 실패했습니다.',
      };
    }

    await useCreditStore.getState().fetchBalance();

    return {
      success: true,
      orderId,
      message: '결제가 완료되었습니다',
    };
  } catch (error: any) {
    console.error('Payment callback error:', error);
    return {
      success: false,
      error: 'CALLBACK_ERROR',
      message: '결제 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    };
  }
};

/**
 * 환불 요청 — 서버가 PortOne cancel API를 호출하고 크레딧을 회수한다.
 */
export const requestRefund = async (orderId: string, reason?: string): Promise<PaymentResult> => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      return {
        success: false,
        error: 'LOGIN_REQUIRED',
        message: '로그인이 필요합니다',
      };
    }

    const res = await fetch('/api/payment/refund', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ orderId, reason }),
    });

    const json = await res.json();

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: json?.error || 'REFUND_FAILED',
        message: json?.error || '환불 처리에 실패했습니다.',
      };
    }

    await useCreditStore.getState().fetchBalance();

    return {
      success: true,
      orderId,
      message: '환불이 완료되었습니다',
    };
  } catch (error: any) {
    console.error('Refund error:', error);
    return {
      success: false,
      error: 'REFUND_ERROR',
      message: '환불 처리 중 오류가 발생했습니다. 고객센터에 문의해주세요.',
    };
  }
};
