'use client';

/**
 * 크레딧 충전 페이지 - 코스믹 테마
 * 행성 세트: 별 → 지구 → 화성 → 수성 → 금성
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreditStore } from '@/store/useCreditStore';
import { CREDIT_PACKAGES, CREDIT_COST } from '@/constants/pricing';
import { processPayment } from '@/services/payment';
import type { CreditPackage } from '@/constants/pricing';

export const CreditPurchasePage: React.FC = () => {
  const router = useRouter();
  const { sunBalance, moonBalance } = useCreditStore();
  const [loading, setLoading] = useState<string | null>(null);

  const handlePurchase = async (pkg: CreditPackage) => {
    setLoading(pkg.id);
    try {
      const result = await processPayment({
        packageId: pkg.id,
        amount: pkg.price,
        creditAmount: pkg.sunCredit + pkg.moonCredit + pkg.bonusSun + pkg.bonusMoon,
      });

      if (result.success) {
        alert(`${pkg.name} 구매 완료!\n☀️ 해 ${pkg.sunCredit + pkg.bonusSun}개 + 🌙 달 ${pkg.moonCredit + pkg.bonusMoon}개 충전!`);
      } else {
        alert(result.message || '결제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      alert('결제 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-space-deep px-4 pt-4 pb-8">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-4 text-sm font-medium"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          뒤로
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold bg-gradient-to-r from-sun-core via-cta to-moon-halo bg-clip-text text-transparent mb-2">
            크레딧 충전
          </h1>
          <p className="text-text-secondary text-sm mb-4">
            행성의 에너지로 운명을 읽어보세요
          </p>

          {/* Current balance */}
          <div className="inline-flex items-center gap-4 px-5 py-2.5 rounded-2xl bg-space-surface/80 border border-[var(--border-subtle)]">
            <div className="flex items-center gap-1.5">
              <span className="text-base">☀️</span>
              <span className="text-lg font-bold text-sun-core">{sunBalance}</span>
              <span className="text-[12px] text-text-tertiary">해</span>
            </div>
            <div className="w-px h-5 bg-[var(--border-subtle)]" />
            <div className="flex items-center gap-1.5">
              <span className="text-base">🌙</span>
              <span className="text-lg font-bold text-moon-halo">{moonBalance}</span>
              <span className="text-[12px] text-text-tertiary">달</span>
            </div>
          </div>
        </div>

        {/* Package list */}
        <div className="flex flex-col gap-3 mb-8">
          {CREDIT_PACKAGES.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              onPurchase={handlePurchase}
              loading={loading === pkg.id}
            />
          ))}
        </div>

        {/* Usage guide */}
        <div className="mb-6">
          <UsageGuide />
        </div>

        {/* FAQ */}
        <div className="mb-4">
          <FAQ />
        </div>
    </div>
  );
};

/**
 * 패키지 카드
 */
const PackageCard: React.FC<{
  pkg: CreditPackage;
  onPurchase: (pkg: CreditPackage) => void;
  loading: boolean;
}> = ({ pkg, onPurchase, loading }) => {
  const isHighlighted = pkg.popular || pkg.bestValue;

  return (
    <div className={`
      relative rounded-2xl p-4 transition-all duration-200
      border bg-space-surface/60
      ${isHighlighted
        ? 'border-cta shadow-lg shadow-cta/10 ring-1 ring-cta/20'
        : 'border-[var(--border-subtle)]'
      }
    `}>
      {/* Badge */}
      {isHighlighted && (
        <div className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full text-[12px] font-bold text-white bg-gradient-to-r from-cta to-cta-active">
          {pkg.popular ? '인기' : '최고 가성비'}
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Planet icon */}
        <div className="text-3xl shrink-0">{pkg.planet}</div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-text-primary">{pkg.name}</h3>
          <p className="text-[13px] text-text-tertiary">{pkg.description}</p>
          <div className="flex items-center gap-3 mt-1 text-xs">
            <span className="text-sun-core font-semibold">
              ☀️ {pkg.sunCredit}{pkg.bonusSun > 0 && `+${pkg.bonusSun}`}
            </span>
            <span className="text-moon-halo font-semibold">
              🌙 {pkg.moonCredit}{pkg.bonusMoon > 0 && `+${pkg.bonusMoon}`}
            </span>
          </div>
        </div>

        {/* Price + Buy */}
        <div className="text-right shrink-0">
          <div className="text-base font-bold text-text-primary mb-1">
            {pkg.price.toLocaleString()}<span className="text-[12px] font-normal text-text-tertiary">원</span>
          </div>
          <button
            onClick={() => onPurchase(pkg)}
            disabled={loading}
            className={`
              px-4 py-1.5 rounded-lg font-bold text-xs transition-all
              ${isHighlighted
                ? 'bg-gradient-to-r from-cta to-cta-active text-white'
                : 'bg-space-elevated text-text-primary border border-[var(--border-default)]'
              }
              disabled:opacity-50
            `}
          >
            {loading ? '...' : '구매'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * 사용 안내
 */
const UsageGuide: React.FC = () => {
  const items = [
    { name: '만세력 확인 + 기본 해석', cost: '무료', icon: '🆓' },
    { name: '실시간 운세', cost: '🌙 1', icon: '' },
    { name: '타로 리딩', cost: '🌙 1', icon: '' },
    { name: '사주 상세 해석', cost: '☀️ 2', icon: '' },
    { name: '애정운 / 재물운 특화', cost: '☀️ 2', icon: '' },
    { name: '사주 × 타로 하이브리드', cost: '☀️ 3', icon: '' },
  ];

  return (
    <div className="rounded-2xl bg-space-surface/60 border border-[var(--border-subtle)] p-4">
      <h3 className="text-sm font-bold text-text-primary mb-3">해와 달로 할 수 있는 일</h3>
      <div className="space-y-0">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex justify-between items-center py-3 border-b border-[var(--border-subtle)] last:border-0"
          >
            <span className="text-text-secondary text-xs">{item.name}</span>
            <span className="font-semibold text-xs text-text-primary">{item.cost}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * FAQ
 */
const FAQ: React.FC = () => {
  const faqs = [
    {
      q: '해와 달은 환불이 가능한가요?',
      a: '구매 후 7일 이내, 미사용분에 한해 전액 환불이 가능합니다.',
    },
    {
      q: '해와 달에 유효기간이 있나요?',
      a: '구매하신 크레딧의 유효기간은 구매일로부터 3개월 미만이며, 기간 경과 시 미사용 크레딧은 자동 소멸됩니다. 자세한 내용은 이용약관 제14조 및 제16조를 참고해주세요.',
    },
    {
      q: '어떤 결제 방법을 지원하나요?',
      a: '카카오페이, 네이버페이, 토스, 신용카드 등 다양한 결제 수단을 지원합니다.',
    },
    {
      q: '보너스 크레딧도 같은 기능으로 사용 가능한가요?',
      a: '네, 보너스로 받은 크레딧도 구매한 것과 동일하게 모든 기능에 사용 가능합니다.',
    },
  ];

  return (
    <div className="rounded-2xl bg-space-surface/60 border border-[var(--border-subtle)] p-4">
      <h3 className="text-sm font-bold text-text-primary mb-3">자주 묻는 질문</h3>
      {faqs.map((faq, idx) => (
        <div key={idx} className={idx < faqs.length - 1 ? 'mb-4' : ''}>
          <h4 className="text-xs font-semibold text-text-primary mb-1">Q. {faq.q}</h4>
          <p className="text-xs text-text-secondary leading-relaxed">{faq.a}</p>
        </div>
      ))}
    </div>
  );
};
