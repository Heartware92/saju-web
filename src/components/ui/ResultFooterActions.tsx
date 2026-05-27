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
  // redo 버튼은 사용자가 다른 입력으로 새 결제·풀이를 받는 핵심 액션이라 보라 그래디언트로 강조.
  // 홈으로 버튼은 보조 톤. 사용자가 "결과 페이지에 홈만 보인다"는 피드백 반영해 시인성 강화.
  const redoBtnClass =
    'flex-1 py-3.5 rounded-2xl text-white text-[15px] font-bold ' +
    'transition-all active:scale-[0.98] shadow-lg';
  const homeBtnClass =
    'flex-1 py-3.5 rounded-2xl bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] ' +
    'text-text-secondary text-[15px] font-medium hover:text-cta hover:border-cta/30 ' +
    'transition-all active:scale-[0.98]';
  return (
    <div className={`mt-4 flex items-center gap-2 ${className}`}>
      {redo && (
        <button
          type="button"
          onClick={redo.onClick}
          className={redoBtnClass}
          style={{
            background: 'linear-gradient(135deg, var(--cta-primary), var(--cta-secondary, var(--cta-primary)))',
            boxShadow: '0 4px 20px rgba(139,92,246,0.3)',
          }}
        >
          {redo.label}
        </button>
      )}
      <button type="button" onClick={() => router.push('/')} className={homeBtnClass}>
        홈으로
      </button>
    </div>
  );
}
