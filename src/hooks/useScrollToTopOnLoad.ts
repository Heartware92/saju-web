import { useEffect } from 'react';

/**
 * 결과 페이지 공통: 로딩이 끝나고 결과가 표시될 때 스크롤을 최상단으로 이동.
 *
 * Layout.tsx 의 main 이 자체 overflow-y-auto 컨테이너이므로 window.scrollTo 만으로는
 * 잡히지 않는다. main 의 scrollTop 을 0으로 + window 도 함께 리셋한다.
 *
 * 사용 예) useScrollToTopOnLoad(!!result && !loading)
 */
export function useScrollToTopOnLoad(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    const main = document.querySelector('main');
    if (main) main.scrollTop = 0;
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  }, [ready]);
}
