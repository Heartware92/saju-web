import { supabaseAdmin } from '@/services/supabaseAdmin';

/**
 * 이탈로 방치된 오래된 pending(대기) 주문을 cancelled(취소)로 자동 전환.
 *
 * 배경: 결제창 진입 시 pending 주문을 먼저 만든다. 사용자가 뒤로가기/창닫기로
 *       이탈하면 정리 콜백이 안 돌아 pending 이 영구히 남아 어드민에 쌓인다.
 *       카드결제는 동기라 일정 시간 넘게 pending 인 건 사실상 이탈/취소다.
 *
 * 안전:
 *  - 30분 컷오프 — 정상 카드결제(수초)·웹훅(수초~수분)은 이미 completed 가 됨.
 *  - 늦은 결제 성공분 보호: verify/webhook 의 완료 가드가 cancelled→completed 도
 *    허용하므로(금액검증 후), 혹시 자동취소된 뒤 진짜 결제가 확인돼도 크레딧이 지급된다.
 *  - fail-open: 실패해도 호출측 흐름에 영향 없음.
 *  - TODO(가상계좌 등 비동기 수단 도입 시): 해당 payment_method 의 pending 은 제외.
 */
const STALE_MINUTES = 30;

export async function expireStalePendingOrders(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
    await supabaseAdmin
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('status', 'pending')
      .lt('created_at', cutoff);
  } catch (e) {
    console.error('[expireStalePendingOrders] 무시:', e);
  }
}
