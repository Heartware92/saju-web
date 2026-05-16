'use client';

/**
 * 배포 버전 감시 + 새 버전 안내 배너.
 *
 * 동작:
 * - 페이지 로드 시 /api/version 호출 → 현재 deployment 의 version 저장
 * - 그 후 5분마다 polling
 * - version 이 바뀌면 "새 버전이 배포됐어요" 배너 노출
 * - 사용자가 "새로고침" 클릭하면 hard reload (location.reload(true) 대체로 ?v= 쿼리)
 *
 * 사용자가 새 배포 직후 일시적으로 JS chunk 불일치로 동작 안 되는 사고를
 * 자가 진단해서 해소 가능하게 함.
 */

import { useEffect, useState } from 'react';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5분

export function VersionWatcher() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let initialVersion: string | null = null;
    let cancelled = false;
    let timer: NodeJS.Timeout | null = null;

    const checkVersion = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const j = (await res.json()) as { version?: string };
        if (!j.version || cancelled) return;
        if (initialVersion === null) {
          initialVersion = j.version;
        } else if (j.version !== initialVersion) {
          setStale(true);
        }
      } catch {
        /* network blip — 다음 주기 재시도 */
      }
    };

    checkVersion();
    timer = setInterval(checkVersion, POLL_INTERVAL_MS);

    // 탭이 다시 활성화되면 즉시 체크 (long-idle 후 stale 감지 빠름)
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkVersion();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!stale) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] px-4 py-3 rounded-xl
                 bg-[rgba(124,92,252,0.95)] border border-white/15 shadow-lg
                 flex items-center gap-3 text-white text-[14px] max-w-[92vw]"
    >
      <span>새 버전이 배포되었어요</span>
      <button
        onClick={() => {
          // 쿼리 파라미터로 cache bypass — Service Worker·CDN edge 다 우회
          const url = new URL(window.location.href);
          url.searchParams.set('_v', Date.now().toString());
          window.location.replace(url.toString());
        }}
        className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 font-semibold text-[13px]"
      >
        새로고침
      </button>
    </div>
  );
}
