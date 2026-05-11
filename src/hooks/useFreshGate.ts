'use client';

/**
 * 결과 페이지 API 호출 게이트 — 결제 사고(새로고침 자동 재호출) 차단.
 *
 * 동작:
 *   1) 렌더마다 URL ?fresh=1 검사 → 한 번이라도 보이면 ref 에 true 래치
 *      (mount 시 직접 진입이든, 마운트 후 FortuneProfileSelect "새로 풀이 받기"로
 *       같은 컴포넌트에 fresh 가 붙어 들어오는 경우든 모두 캐치)
 *   2) 동시에 router.replace 로 fresh 쿼리 즉시 제거 → 새로고침 시 wasFresh=false
 *   3) 호출자가 wasFresh 값으로 분기:
 *        · cache hit → cache 표시
 *        · cache miss + wasFresh=true → API 호출 (정상)
 *        · cache miss + wasFresh=false + 보관함 미발견 → 만료 안내 UI
 *
 * useRef 라 mount 단위로 리셋 → 새로고침 시 자동으로 false 로 복귀.
 */

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export function useWasFreshOnEntry(): boolean {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const wasFreshRef = useRef(false);

  // URL 에 fresh=1 이 등장하면 래치 true — mount 시점이든 그 이후든 모두 캐치
  if (searchParams?.get('fresh') === '1') {
    wasFreshRef.current = true;
  }

  // fresh=1 이 보일 때마다 URL 에서 제거 → 새로고침 시 다시 호출되는 사고 차단
  useEffect(() => {
    if (searchParams?.get('fresh') !== '1') return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('fresh');
    const q = params.toString();
    const next = q ? `${pathname}?${q}` : (pathname || '/');
    router.replace(next, { scroll: false });
  }, [searchParams, pathname, router]);

  return wasFreshRef.current;
}
