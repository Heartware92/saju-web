'use client';

import { useRouter } from 'next/navigation';

interface ResultFooterActionsProps {
  /** "다시 풀이 받기" 계열 버튼 — 선택·입력 화면이 있는 운세에만 전달. 없으면 "홈으로" 단독 */
  redo?: { label: string; onClick: () => void };
  className?: string;
}

/**
 * 모든 운세 결과 페이지 맨 하단 공통 액션 (ShareBar 아래).
 * - redo 있음: "다시 풀이 받기" 계열 + "홈으로" 2버튼
 * - redo 없음: "홈으로" 단독
 */
export function ResultFooterActions({ redo, className = '' }: ResultFooterActionsProps) {
  const router = useRouter();
  const btnClass =
    'flex-1 py-3 rounded-2xl bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] ' +
    'text-text-secondary text-sm font-medium hover:text-cta hover:border-cta/30 ' +
    'transition-all active:scale-[0.98]';
  return (
    <div className={`mt-3 flex items-center gap-2 ${className}`}>
      {redo && (
        <button type="button" onClick={redo.onClick} className={btnClass}>
          {redo.label}
        </button>
      )}
      <button type="button" onClick={() => router.push('/')} className={btnClass}>
        홈으로
      </button>
    </div>
  );
}
