'use client';

/**
 * 결과 페이지 API 호출 게이트 — 결제 사고(새로고침 자동 재호출) 차단.
 *
 * 동작:
 *   1) 진입 시 URL ?fresh=1 검출 → ref 에 기록 (wasFreshOnEntry)
 *   2) 동시에 router.replace 로 fresh 쿼리 즉시 제거 → 새로고침 시 wasFresh=false
 *   3) 호출자가 wasFresh 값으로 분기:
 *        · cache hit → cache 표시
 *        · cache miss + wasFresh=true → API 호출 (정상)
 *        · cache miss + wasFresh=false + 보관함 미발견 → 만료 안내 UI
 *
 * 단순한 ref 기반이라 SSR/CSR 양쪽 안전, 추가 state·useEffect 의존성 충돌 없음.
 */

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export function useWasFreshOnEntry(): boolean {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const wasFreshRef = useRef<boolean | null>(null);

  // 첫 평가에 동기적으로 fresh 값 캡쳐 (이후 URL 변경 무관)
  if (wasFreshRef.current === null) {
    wasFreshRef.current = searchParams?.get('fresh') === '1';
  }

  useEffect(() => {
    if (wasFreshRef.current !== true) return;
    // fresh 가 아직 URL 에 남아있다면 즉시 제거
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (params.get('fresh') !== '1') return;
    params.delete('fresh');
    const q = params.toString();
    const next = q ? `${pathname}?${q}` : (pathname || '/');
    router.replace(next, { scroll: false });
    // 한 번만 실행 — searchParams 변화는 우리가 일으킨 replace 이므로 의존성에 안 넣음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return wasFreshRef.current === true;
}
