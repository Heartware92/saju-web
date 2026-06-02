/**
 * 클라이언트 분석 이벤트 전송 (페이지뷰 외 상호작용 이벤트용).
 *
 * 현재 용도: 공유 버튼 클릭 추적 — "어느 페이지를 가장 많이 공유하는지" 집계.
 *  - 카카오톡 공유: 'share_kakao', 링크 복사: 'share_url'.
 *  - path 는 공유 시점의 현재 화면 경로(window.location.pathname).
 *  - session_id/visitor_id 는 AnalyticsTracker 가 페이지뷰에서 만들어 둔 값을 재사용.
 *  - fire-and-forget: 실패해도 무시. 공유 UX 에 절대 영향 주지 않음.
 */
import { useUserStore } from '@/store/useUserStore';

const ENDPOINT = '/api/analytics/collect';

export type TrackEventType = 'share_kakao' | 'share_url';

function readId(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** 상호작용 이벤트 1건 전송. 어떤 실패도 무시(서비스 영향 0). */
export function trackEvent(eventType: TrackEventType, path?: string): void {
  try {
    if (typeof window === 'undefined') return;
    const sessionId = readId(window.sessionStorage, '_sid');
    if (!sessionId) return; // 스토리지 차단/페이지뷰 미발생 → 추적 포기
    const visitorId = readId(window.localStorage, '_vid');
    const userId = useUserStore.getState().user?.id ?? null;
    const body = JSON.stringify({
      sessionId,
      visitorId,
      userId,
      eventType,
      path: path ?? window.location.pathname,
    });
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      cache: 'no-store',
    }).catch(() => {
      /* fire-and-forget */
    });
  } catch {
    /* 무시 */
  }
}
