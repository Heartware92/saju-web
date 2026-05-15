'use client';

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
        <div className="text-4xl mb-2">{pkg.planet}</div>
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
          <span className="text-text-secondary">☀️ 해</span>
          <span className="font-bold text-sun-core">
            {pkg.sunCredit}{pkg.bonusSun > 0 && <span className="text-sun-corona"> +{pkg.bonusSun}</span>}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-text-secondary">🌙 달</span>
          <span className="font-bold text-moon-halo">
            {pkg.moonCredit}{pkg.bonusMoon > 0 && <span className="text-moon-shadow"> +{pkg.bonusMoon}</span>}
          </span>
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
  // 실제 차감 정책과 동일 — src/constants/creditCosts.ts 의 SUN_COST_BIG/MOON_COST_MORE/MOON_COST_TAROT 기준
  const items = [
    { name: '만세력 확인 + 기본 해석', cost: '무료', type: 'free' },
    { name: '정통사주 (12섹션 풀이)', cost: '☀️ 1', type: 'sun' },
    { name: '신년운세 / 평생·시기 운세 / 지정일 운세', cost: '☀️ 1', type: 'sun' },
    { name: '실시간 운세', cost: '☀️ 1', type: 'sun' },
    { name: '궁합', cost: '☀️ 1', type: 'sun' },
    { name: '토정비결 · 자미두수 · 택일', cost: '☀️ 1', type: 'sun' },
    { name: '더 많은 운세 10종', cost: '🌙 1', type: 'moon' },
    { name: '타로 리딩 (단독·사주 하이브리드)', cost: '🌙 1', type: 'moon' },
    { name: '상담소 질문팩 (3질문)', cost: '☀️ 1 또는 🌙 3', type: 'sun' },
  ];

  return (
    <div className="rounded-2xl bg-space-surface/60 border border-[var(--border-subtle)] p-6 backdrop-blur-sm">
      <h3 className="text-lg font-bold text-text-primary mb-4">크레딧 사용 안내</h3>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)] last:border-0">
            <span className="text-sm text-text-secondary">{item.name}</span>
            <span className={`text-sm font-bold ${
              item.type === 'sun' ? 'text-sun-core' :
              item.type === 'moon' ? 'text-moon-halo' :
              'text-cta'
            }`}>
              {item.cost}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
