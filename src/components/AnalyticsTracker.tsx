'use client';

/**
 * 방문/유입/이탈 분석 트래커.
 *
 *  - App Router 경로 변경(usePathname)마다 페이지뷰 1건을 /api/analytics/collect 로 전송.
 *  - session_id: sessionStorage(브라우저 세션 단위) — 세션별 마지막 경로 = 이탈 화면 판정용.
 *  - visitor_id: localStorage(영속) — 고유 방문자 카운트/재방문 판정용.
 *  - first-touch 유입(referrer + UTM)은 세션 시작 시 1회만 캡처해 세션 내 이벤트에 부착.
 *  - fire-and-forget: fetch keepalive, 실패해도 무시. 사용자 UX 에 절대 영향 없음.
 *  - 개인정보: IP 미수집. 익명 식별자만. user_id 는 로그인 시에만(분석용).
 */
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useUserStore } from '@/store/useUserStore';

const ENDPOINT = '/api/analytics/collect';

function makeId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* noop */
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-4000-8000-${Math.random()
    .toString(16)
    .slice(2, 14)}`;
}

function readOrCreate(storage: Storage | undefined, key: string): string | null {
  try {
    if (!storage) return null;
    let v = storage.getItem(key);
    if (!v) {
      v = makeId();
      storage.setItem(key, v);
    }
    return v;
  } catch {
    return null;
  }
}

interface FirstTouch {
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
}

function getFirstTouch(): FirstTouch {
  const empty: FirstTouch = { referrer: '', utm_source: '', utm_medium: '', utm_campaign: '' };
  try {
    const cached = sessionStorage.getItem('_atrk');
    if (cached) return { ...empty, ...(JSON.parse(cached) as Partial<FirstTouch>) };
    const params = new URLSearchParams(window.location.search);
    const data: FirstTouch = {
      referrer: document.referrer || '',
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
    };
    sessionStorage.setItem('_atrk', JSON.stringify(data));
    return data;
  } catch {
    return empty;
  }
}

function send(path: string, userId: string | null) {
  try {
    const sessionId = readOrCreate(window.sessionStorage, '_sid');
    if (!sessionId) return; // 스토리지 차단 환경 → 추적 포기(서비스엔 영향 없음)
    const visitorId = readOrCreate(window.localStorage, '_vid');
    const ft = getFirstTouch();
    const body = JSON.stringify({ sessionId, visitorId, userId, path, ...ft });
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
    /* 어떤 실패도 무시 */
  }
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const last = useRef<string>('');

  useEffect(() => {
    if (!pathname || last.current === pathname) return; // 동일 경로 중복(특히 dev StrictMode) 방지
    last.current = pathname;
    // user_id 는 항상 최신값을 직접 조회(로그인 변경에도 재구독 없이 반영)
    const userId = useUserStore.getState().user?.id ?? null;
    send(pathname, userId);
  }, [pathname]);

  return null;
}
