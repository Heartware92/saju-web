'use client';

/**
 * 크레딧 충전 페이지 (2026-05-16 단일 달 크레딧 통합)
 * 패키지: 달 → 화성 → 지구 → 토성 → 목성 → 은하 → 우주
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCreditStore } from '@/store/useCreditStore';
import { CREDIT_PACKAGES } from '@/constants/pricing';
import { processPayment } from '@/services/payment';
import type { CreditPackage } from '@/constants/pricing';

export const CreditPurchasePage: React.FC = () => {
  const router = useRouter();
  const { moonBalance } = useCreditStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [canceledNotice, setCanceledNotice] = useState(false);

  // 모바일: PortOne이 결제창으로 전체 페이지를 리다이렉트하므로, 결제창에서
  // 브라우저 뒤로가기를 누르면 이 페이지가 bfcache에서 복원된다. 이때 loading('...')
  // 상태가 그대로 멈춰 버튼이 눌리지 않으므로, 복원을 감지해 로딩을 해제하고 안내한다.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      setLoading((prev) => {
        if (prev) setCanceledNotice(true);
        return null;
      });
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const handlePurchase = async (pkg: CreditPackage) => {
    setCanceledNotice(false);
    setLoading(pkg.id);
    try {
      const result = await processPayment({
        packageId: pkg.id,
        amount: pkg.price,
        creditAmount: pkg.moonCredit,
      });

      if (result.success) {
        alert(`${pkg.name} 구매 완료! 🌙 ${pkg.moonCredit}개 충전!`);
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
          <h1 className="text-xl font-bold bg-gradient-to-r from-[var(--cta-primary)] to-[var(--cta-secondary)] bg-clip-text text-transparent mb-2">
            크레딧 충전
          </h1>
          <p className="text-text-secondary text-sm mb-4">
            행성의 에너지로 운명을 읽어보세요
          </p>

          {/* Current balance */}
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-space-surface/80 border border-[var(--border-subtle)]">
            <span className="text-base">🌙</span>
            <span className="text-lg font-bold text-text-primary">{moonBalance}</span>
            <span className="text-[12px] text-text-tertiary">달</span>
          </div>
        </div>

        {/* 결제창 뒤로가기(취소) 안내 */}
        {canceledNotice && (
          <div className="mb-4 px-4 py-3 rounded-2xl bg-[rgba(230,57,70,0.08)] border border-[rgba(230,57,70,0.25)] text-[13px] text-text-secondary leading-relaxed">
            결제가 취소되었습니다. 다시 시도해 주세요.
          </div>
        )}

        {/* 소진기한·환불 안내 (PG사 환금성 업종 입점 필수 명시) */}
        <div className="mb-5 px-4 py-3 rounded-2xl bg-[rgba(124,92,252,0.06)] border border-[rgba(124,92,252,0.15)] text-[12.5px] text-text-secondary leading-relaxed">
          <p>
            <strong className="text-text-primary">크레딧 사용 기한 안내</strong>
          </p>
          <ul className="mt-1.5 space-y-1 list-disc pl-4 text-text-tertiary">
            <li>구매하신 크레딧은 <strong className="text-text-secondary">결제일로부터 1년 이내</strong>에 사용해 주세요.</li>
            <li>유효 기간 경과 시 미사용 크레딧은 <strong className="text-text-secondary">자동 소멸</strong>됩니다.</li>
            <li>환불은 <strong className="text-text-secondary">결제 시 사용한 결제 수단으로만</strong> 가능하며, 미사용 상태에서 결제일로부터 7일 이내 청약철회 신청 가능합니다.</li>
            <li>자세한 내용은 <a href="/terms" className="underline text-cta hover:text-cta-active">이용약관 제14조·제16조</a>를 참고해 주세요.</li>
          </ul>
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

    </div>
  );
};

/**
 * 패키지 카드 (단일 달 크레딧)
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
          {pkg.popular ? '인기' : 'Best'}
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Planet icon — 이미지(iconImage) 우선, 없으면 이모지(planet) */}
        <div className="shrink-0 w-9 h-9 flex items-center justify-center">
          {pkg.iconImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pkg.iconImage} alt={pkg.name} width={32} height={32} className="object-contain" />
          ) : (
            <span className="text-3xl">{pkg.planet || ''}</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-text-primary">{pkg.name}</h3>
          <div className="flex items-center gap-1.5 mt-1 text-xs">
            <span className="text-text-primary font-semibold">
              🌙 {pkg.moonCredit}개
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

