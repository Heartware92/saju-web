/**
 * 크레딧 잔액 표시 위젯 - 코스믹 테마
 * 2026-05-16 단일 달 크레딧으로 통합
 */

'use client';

import React from 'react';
import { useCreditStore } from '../../../store/useCreditStore';
import { useRouter } from 'next/navigation';

interface CreditBalanceProps {
  showAddButton?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const CreditBalance: React.FC<CreditBalanceProps> = ({
  showAddButton = true,
  size = 'md'
}) => {
  const { moonBalance } = useCreditStore();
  const router = useRouter();

  const sizeConfig = {
    sm: { text: '0.85rem', padding: '0.3rem 0.6rem', gap: '0.35rem' },
    md: { text: '0.95rem', padding: '0.4rem 0.8rem', gap: '0.4rem' },
    lg: { text: '1.15rem', padding: '0.5rem 1rem', gap: '0.5rem' }
  };
  const config = sizeConfig[size];

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center rounded-lg bg-space-elevated/60 border border-[var(--border-subtle)]"
        style={{ gap: config.gap, padding: config.padding }}
      >
        <span style={{ fontSize: config.text }}>🌙</span>
        <span className="font-bold text-text-primary" style={{ fontSize: config.text }}>
          {moonBalance}
        </span>
      </div>

      {showAddButton && (
        <button
          onClick={() => router.push('/credit')}
          className="rounded-lg bg-cta/10 border border-cta/30 text-cta font-semibold text-sm hover:bg-cta/20 transition-colors whitespace-nowrap"
          style={{ padding: config.padding, fontSize: config.text }}
        >
          충전
        </button>
      )}
    </div>
  );
};

/**
 * 크레딧 필요 알림 (인라인) — 단일 달 단위
 */
interface CreditRequiredProps {
  amount: number;
  description?: string;
  /** @deprecated 단일 달 시스템 — prop 무시 (호환용) */
  creditType?: 'sun' | 'moon';
}

export const CreditRequired: React.FC<CreditRequiredProps> = ({
  amount,
  description,
}) => {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-space-elevated/60 border border-[var(--border-subtle)] rounded-full">
      <span>🌙</span>
      <span className="font-bold text-text-primary">{amount}</span>
      {description && (
        <span className="text-sm text-text-secondary">· {description}</span>
      )}
    </div>
  );
};
