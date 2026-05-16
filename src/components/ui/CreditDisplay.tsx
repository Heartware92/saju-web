'use client';

import React from 'react';

interface CreditDisplayProps {
  /** 달(🌙) 잔액 — 단일 크레딧 시스템 (2026-05-16 이후) */
  moonBalance: number;
  /** @deprecated 해 시스템 폐지. 호환을 위해 prop은 받되 무시 */
  sunBalance?: number;
  compact?: boolean;
  onClick?: () => void;
}

export const CreditDisplay: React.FC<CreditDisplayProps> = ({
  moonBalance,
  compact = false,
  onClick,
}) => {
  if (compact) {
    return (
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[rgba(36,20,63,0.88)] border border-[rgba(61,41,96,0.35)] cursor-pointer transition-none"
        aria-label={`달 ${moonBalance}개 — 충전하기`}
      >
        <MoonIcon size={16} />
        <span className="text-sm font-bold text-text-primary">{moonBalance}</span>
      </button>
    );
  }

  return (
    <div className="flex" onClick={onClick}>
      <div className="flex-1 rounded-xl p-4 bg-[var(--moon-glow,rgba(255,193,7,0.08))] border border-[rgba(255,193,7,0.2)]">
        <div className="flex items-center gap-2 mb-1">
          <MoonIcon size={24} />
          <span className="text-sm text-text-secondary">달</span>
        </div>
        <span className="text-2xl font-bold text-text-primary">{moonBalance}</span>
      </div>
    </div>
  );
};

/**
 * 노란 초승달 아이콘 — 사용자 캡처 톤(2026-05-16) 기준 노란 계열 색감
 * 표준 이모지 🌙과 동일 인상.
 */
export const MoonIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <path
      d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
      fill="url(#moonGrad)"
      stroke="none"
    />
    <defs>
      <linearGradient id="moonGrad" x1="11" y1="3" x2="21" y2="13">
        <stop offset="0%" stopColor="#FFD54F" />
        <stop offset="100%" stopColor="#FFB300" />
      </linearGradient>
    </defs>
  </svg>
);

/**
 * @deprecated 해 시스템 폐지 (2026-05-16). 호환 위해 잠시 유지.
 * 사용처가 모두 제거되면 함께 삭제.
 */
export const SunIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
    <circle cx="12" cy="12" r="5" fill="#FFD700" />
  </svg>
);
