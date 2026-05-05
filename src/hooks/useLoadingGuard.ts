import { useEffect, useRef, useState } from 'react';

const TIMEOUT_ERROR = '응답이 너무 오래 걸려요. 새로고침 후 다시 시도해주세요.';

/**
 * 풀이 로딩이 maxMs 이상 지속되면 강제 해제하고 에러 표시.
 * callGPT의 55초 AbortController와 별개로, 페이지 레벨의 최종 안전망.
 *
 * @returns [timedOut, timeoutError] — timedOut이 true가 되면 호출자가
 *          loading을 false로 돌리고 에러 메시지를 표시해야 한다.
 */
export function useLoadingGuard(
  loading: boolean,
  maxMs: number = 70_000,
): [boolean, string] {
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (loading) {
      setTimedOut(false);
      timerRef.current = setTimeout(() => setTimedOut(true), maxMs);
    } else {
      setTimedOut(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [loading, maxMs]);

  return [timedOut, TIMEOUT_ERROR];
}
