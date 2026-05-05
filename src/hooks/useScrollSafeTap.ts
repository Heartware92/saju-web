'use client';

import { useEffect } from 'react';

/**
 * 모바일 웹에서 스크롤 도중 손가락이 버튼 위를 스쳐 지나가면
 * iOS Safari·Chrome 이 click 이벤트를 발화시켜 모달이 떠 버리는 문제를
 * 전역 capture-phase 핸들러로 한 번에 차단한다.
 *
 * 동작:
 *  1) touchstart → 시작점·시각 기록
 *  2) touchmove → 임계치(10px) 이상 이동하면 "스크롤" 로 판단
 *  3) click(capture) → 같은 터치 시퀀스에서 스크롤이 있었으면 preventDefault·stopPropagation
 *
 * 데스크탑 마우스 클릭은 영향 없음(touchstart 이벤트가 발생하지 않음).
 */
export function useScrollSafeTap() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('ontouchstart' in window)) return;

    const MOVE_THRESHOLD_PX = 10;
    const SUPPRESS_WINDOW_MS = 700;

    let startX = 0;
    let startY = 0;
    let startScrollY = 0;
    let startTime = 0;
    let moved = false;
    let lastTouchEndTime = 0;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      startScrollY = window.scrollY;
      startTime = performance.now();
      moved = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (moved) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = Math.abs(t.clientX - startX);
      const dy = Math.abs(t.clientY - startY);
      if (dx > MOVE_THRESHOLD_PX || dy > MOVE_THRESHOLD_PX) moved = true;
    };

    const onTouchEnd = () => {
      lastTouchEndTime = performance.now();
      // 모멘텀 스크롤로 위치가 바뀐 경우도 movement 로 간주
      if (Math.abs(window.scrollY - startScrollY) > MOVE_THRESHOLD_PX) {
        moved = true;
      }
    };

    const onTouchCancel = () => {
      moved = true;
      lastTouchEndTime = performance.now();
    };

    const onClickCapture = (e: MouseEvent) => {
      if (!moved) return;
      // 같은 터치 시퀀스의 click 인지 확인
      const since = performance.now() - (lastTouchEndTime || startTime);
      if (since > SUPPRESS_WINDOW_MS) return;
      e.preventDefault();
      e.stopPropagation();
      // 다음 click 부터는 다시 정상 동작하도록 초기화
      moved = false;
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true, capture: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true, capture: true });
    window.addEventListener('click', onClickCapture, true);

    return () => {
      window.removeEventListener('touchstart', onTouchStart, true);
      window.removeEventListener('touchmove', onTouchMove, true);
      window.removeEventListener('touchend', onTouchEnd, true);
      window.removeEventListener('touchcancel', onTouchCancel, true);
      window.removeEventListener('click', onClickCapture, true);
    };
  }, []);
}
