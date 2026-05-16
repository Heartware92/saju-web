'use client';

/**
 * 2026-05-16 단일 달 크레딧 통합. 옛 "엽전" 명칭은 legacy 컴포넌트명으로만 유지.
 */

import React from 'react';
import { Button } from '../../../components/ui/Button';
import type { CreditPackage } from '../../../constants/pricing';

interface PackageCardProps {
  package: CreditPackage;
  onPurchase: (pkg: CreditPackage) => void;
  loading?: boolean;
}

export const YeopjeonPackage: React.FC<PackageCardProps> = ({
  package: pkg,
  onPurchase,
  loading = false,
}) => {
  const isHighlighted = pkg.popular || pkg.bestValue;

  return (
    <div className={`
      relative rounded-2xl p-5 flex flex-col h-full transition-all duration-200
      border bg-space-surface/60 backdrop-blur-sm
      ${isHighlighted
        ? 'border-cta shadow-lg shadow-cta/10 ring-1 ring-cta/20'
        : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'
      }
    `}>
      {isHighlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-cta to-cta-active whitespace-nowrap">
          {pkg.popular ? '인기' : '최고 가성비'}
        </div>
      )}

      <div className="text-center mb-4 pt-2">
        <div className="h-12 mb-2 flex items-center justify-center">
          {pkg.iconImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pkg.iconImage} alt={pkg.name} width={40} height={40} className="object-contain" />
          ) : (
            <span className="text-4xl">{pkg.planet || '🌙'}</span>
          )}
        </div>
        <h3 className="text-lg font-bold text-text-primary">{pkg.name}</h3>
        <p className="text-xs text-text-tertiary mt-1">{pkg.description}</p>
      </div>

      <div className="text-center mb-4">
        <div className="text-2xl font-bold text-text-primary">
          {pkg.price.toLocaleString()}<span className="text-sm font-normal text-text-secondary">원</span>
        </div>
      </div>

      <div className="rounded-xl bg-space-elevated/40 p-3 mb-4 space-y-2 text-sm flex-1">
        <div className="flex justify-between items-center">
          <span className="text-text-secondary">🌙 달</span>
          <span className="font-bold text-text-primary">{pkg.moonCredit}개</span>
        </div>
      </div>

      <Button
        variant={isHighlighted ? 'sun' : 'secondary'}
        fullWidth
        loading={loading}
        onClick={() => onPurchase(pkg)}
      >
        구매하기
      </Button>
    </div>
  );
};

export const PackageComparison: React.FC = () => {
  // 2026-05-16 단일 달 크레딧 통합 기준 — creditCosts.ts 의 MOON_COST_BIG/MOON_COST_MORE/MOON_COST_TAROT 와 동기화
  const items = [
    { name: '만세력 확인 + 기본 해석', cost: '무료' },
    { name: '정통사주 (12섹션 풀이)', cost: '🌙 10' },
    { name: '신년운세 / 평생·시기 운세 / 지정일 운세', cost: '🌙 10' },
    { name: '궁합', cost: '🌙 10' },
    { name: '토정비결 · 자미두수 · 택일', cost: '🌙 10' },
    { name: '실시간 운세', cost: '🌙 5' },
    { name: '더 많은 운세 (성격·자녀·학업·이름·꿈)', cost: '🌙 5' },
    { name: '타로 (오늘 · 이달 · 질문)', cost: '🌙 1' },
    { name: '상담소 (질문 1개당)', cost: '🌙 1' },
  ];

  return (
    <div className="rounded-2xl bg-space-surface/60 border border-[var(--border-subtle)] p-6 backdrop-blur-sm">
      <h3 className="text-lg font-bold text-text-primary mb-4">🌙 달로 할 수 있는 일</h3>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)] last:border-0">
            <span className="text-sm text-text-secondary">{item.name}</span>
            <span className="text-sm font-bold text-text-primary">{item.cost}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
