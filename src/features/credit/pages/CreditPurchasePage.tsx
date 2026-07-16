'use client';

/**
 * 크레딧 충전 페이지 (2026-05-16 단일 달 크레딧 통합)
 * 패키지: 달 → 화성 → 지구 → 토성 → 목성 → 은하 → 우주
 */

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCreditStore } from '@/store/useCreditStore';
import { CREDIT_PACKAGES } from '@/constants/pricing';
import { processPayment, processTossPayment, processTossPaymentsCard } from '@/services/payment';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { CreditPackage } from '@/constants/pricing';

// 카카오페이 전용 PortOne 채널키 (간편결제 EASY_PAY). channelKey는 클라이언트 노출 공개값.
// env 우선, 없으면 하드코딩 폴백(2026-07-16 카카오페이 채널 승인분). 토스=직연동/카드=active_channel과 별개 채널.
const KAKAO_CHANNEL_KEY =
  process.env.NEXT_PUBLIC_PORTONE_KAKAO_CHANNEL_KEY ||
  'channel-key-b249efa8-2c72-4b85-b32c-76ea193e5431';

export const CreditPurchasePage: React.FC = () => {
  const router = useRouter();
  const { moonBalance } = useCreditStore();
  const [loading, setLoading] = useState<string | null>(null);
  const [canceledNotice, setCanceledNotice] = useState(false);
  // 결제수단 선택 모달 (구매 버튼 → 토스페이 / 일반카드 중 선택)
  const [methodPkg, setMethodPkg] = useState<CreditPackage | null>(null);
  // 데스크톱 카드결제(KG iframe) 진행 중 브라우저 뒤로가기를 흡수하기 위한 센티넬 플래그
  const cardBackGuard = useRef(false);

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

  // 데스크톱: 일반카드(KG)는 페이지 전환 없이 iframe 오버레이로 뜬다. 이 상태의 브라우저
  // 뒤로가기는 결제 취소 콜백을 거치지 않고 페이지를 이탈시키므로, 카드결제 시작 시
  // history 센티넬을 넣어(payWithCard) 뒤로가기를 흡수하고, 여기서 전체 리로드로
  // /credit?canceled=1 로 복귀시킨다(KG 오버레이 확실히 제거 + 취소 모달 표시).
  useEffect(() => {
    const onPopState = () => {
      if (!cardBackGuard.current) return;
      cardBackGuard.current = false;
      window.location.replace('/credit?canceled=1');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // 토스페이 로고를 페이지 진입 시 미리 받아둔다(캐시 워밍).
  // 결제수단 모달은 클릭 시점에 열려 <img>가 그제서야 마운트되는데, 미리 받아두면 즉시 표시된다.
  useEffect(() => {
    const img = new window.Image();
    img.src = '/icons/tosspay-lockup.png';
  }, []);

  // 결제 미완료로 /credit 에 돌아온 경우 '결제가 취소되었습니다' 모달을 띄운다.
  // (1) 토스 retCancelUrl(/credit?canceled=1) — X/취소 복귀
  // (2) toss_payment_pending 플래그 — 토스 결제창에서 뒤로가기(데스크톱 bfcache 미복원 포함)
  useEffect(() => {
    let canceled = false;

    const params = new URLSearchParams(window.location.search);
    if (params.get('canceled') === '1') {
      canceled = true;
      // 새로고침/뒤로가기 시 모달이 다시 뜨지 않도록 쿼리 정리
      params.delete('canceled');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }

    try {
      if (sessionStorage.getItem('toss_payment_pending')) {
        sessionStorage.removeItem('toss_payment_pending');
        canceled = true;
      }
    } catch { /* noop */ }

    if (canceled) setCanceledNotice(true);
  }, []);

  // 구매 버튼 → 결제수단 선택 모달 열기
  const handlePurchase = (pkg: CreditPackage) => {
    setCanceledNotice(false);
    setMethodPkg(pkg);
  };

  // 토스페이 직연동 — 성공 시 토스 결제창으로 페이지가 이동한다(반환 없이 리다이렉트)
  const payWithToss = async (pkg: CreditPackage) => {
    setMethodPkg(null);
    setLoading(pkg.id);
    try {
      const result = await processTossPayment({
        packageId: pkg.id,
        amount: pkg.price,
        creditAmount: pkg.moonCredit,
      });
      if (!result.success) {
        alert(result.message || '결제창을 여는 데 실패했습니다.');
        setLoading(null);
      }
      // 성공 시에는 window.location 이동 중이므로 로딩 해제하지 않음
    } catch (error) {
      console.error('Toss purchase error:', error);
      alert('결제 처리 중 오류가 발생했습니다.');
      setLoading(null);
    }
  };

  // 카카오페이 — 포트원 간편결제(EASY_PAY). 카카오페이 전용 채널키로 결제(active_channel 무관).
  const payWithKakao = async (pkg: CreditPackage) => {
    setMethodPkg(null);
    setLoading(pkg.id);
    // 결제창 진행 중 뒤로가기 흡수 (카드결제와 동일 가드)
    cardBackGuard.current = true;
    try { window.history.pushState({ paymentOpen: true }, ''); } catch { /* noop */ }
    try {
      const result = await processPayment(
        { packageId: pkg.id, amount: pkg.price, creditAmount: pkg.moonCredit },
        { channelKeyOverride: KAKAO_CHANNEL_KEY, payMethod: 'EASY_PAY', easyPayProvider: 'EASY_PAY_PROVIDER_KAKAOPAY' },
      );
      cardBackGuard.current = false;
      if (result.success) {
        alert(`${pkg.name} 구매 완료! 🌙 ${pkg.moonCredit}개 충전!`);
      } else if (result.canceled) {
        setCanceledNotice(true);
      } else {
        alert(result.message || '결제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Kakao purchase error:', error);
      alert('결제 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(null);
    }
  };

  // 토스페이먼츠 PG 직연동 카드결제 — 계약 심사/테스트용 (2026-07-16)
  const payWithTossPayments = async (pkg: CreditPackage) => {
    setMethodPkg(null);
    setLoading(pkg.id);
    try {
      const result = await processTossPaymentsCard({
        packageId: pkg.id,
        amount: pkg.price,
        creditAmount: pkg.moonCredit,
      });
      if (result.success) {
        // successUrl 로 페이지 이동 중 — 로딩 유지
        return;
      }
      if (result.canceled) {
        setCanceledNotice(true);
      } else {
        alert(result.message || '결제에 실패했습니다.');
      }
      setLoading(null);
    } catch (error) {
      console.error('TossPayments purchase error:', error);
      alert('결제 처리 중 오류가 발생했습니다.');
      setLoading(null);
    }
  };

  // 일반카드 결제 — 기존 포트원(KG이니시스) 플로우
  const payWithCard = async (pkg: CreditPackage) => {
    setMethodPkg(null);
    setLoading(pkg.id);
    // 결제창(iframe)이 열린 동안 브라우저 뒤로가기를 흡수하기 위한 history 센티넬
    cardBackGuard.current = true;
    try { window.history.pushState({ paymentOpen: true }, ''); } catch { /* noop */ }
    try {
      const result = await processPayment({
        packageId: pkg.id,
        amount: pkg.price,
        creditAmount: pkg.moonCredit,
      });
      // 정상 resolve(성공/취소/실패) → 뒤로가기 흡수 해제
      cardBackGuard.current = false;

      if (result.success) {
        alert(`${pkg.name} 구매 완료! 🌙 ${pkg.moonCredit}개 충전!`);
      } else if (result.canceled) {
        // 결제창 X(닫기)/취소 — 뒤로가기와 동일한 취소 모달로 통일
        setCanceledNotice(true);
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

        {/* 결제수단 선택 모달 — 토스페이 / 일반카드 */}
        <Modal
          isOpen={methodPkg !== null}
          onClose={() => setMethodPkg(null)}
          title="결제수단 선택"
          size="sm"
        >
          {methodPkg && (
            <div className="space-y-4">
              <div className="text-center text-sm text-text-secondary">
                <span className="font-bold text-text-primary">{methodPkg.name}</span>
                {' · '}🌙 {methodPkg.moonCredit}개
                {' · '}
                <span className="font-bold text-text-primary">{methodPkg.price.toLocaleString()}원</span>
              </div>

              {/* 토스페이 — 흰 카드 + toss pay 로고 락업 */}
              <button
                onClick={() => payWithToss(methodPkg)}
                className="w-full rounded-xl bg-white border border-[#E5E8EB] py-4 flex items-center justify-center transition-all active:scale-[0.99] hover:border-[#3182F6]"
              >
                <TossPayLogo />
              </button>

              {/* 카카오페이 — 카카오 옐로우 + 말풍선 심볼 */}
              <button
                onClick={() => payWithKakao(methodPkg)}
                className="w-full rounded-xl bg-[#FEE500] py-4 flex items-center justify-center gap-1.5 transition-all active:scale-[0.99] hover:brightness-95"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#191919" aria-hidden="true">
                  <path d="M12 3C6.9 3 3 6.3 3 10.2c0 2.5 1.7 4.7 4.2 5.9-.2.6-.7 2.5-.8 2.9 0 .2.1.4.4.2.2-.1 2.7-1.8 3.7-2.5.5.1 1 .1 1.5.1 5.1 0 9-3.3 9-7.3S17.1 3 12 3z"/>
                </svg>
                <span className="font-bold text-[15px] text-[#191919]">카카오페이</span>
              </button>

              {/* 일반카드 — 포트원(KG이니시스) */}
              <button
                onClick={() => payWithCard(methodPkg)}
                className="w-full rounded-xl bg-white border border-[#E5E8EB] py-4 flex items-center justify-center gap-2 transition-all active:scale-[0.99] hover:border-[#B0B8C1]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4E5968" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="5" width="20" height="14" rx="2.5" />
                  <path d="M2 10h20" />
                </svg>
                <span className="font-bold text-[15px] text-[#191F28]">신용 · 체크카드</span>
              </button>

              <p className="text-[11.5px] text-text-tertiary text-center leading-relaxed">
                토스페이·카카오페이는 각 앱/계좌·카드로, 신용·체크카드는 카드사 결제창으로 진행됩니다.
              </p>

              {/* 토스페이먼츠 테스트 구역 — 계약 심사용 임시 (검증 후 정식 전환) */}
              <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
                <p className="text-[11.5px] text-text-tertiary text-center">토스페이먼츠 테스트 전용입니다.</p>
                <button
                  onClick={() => payWithTossPayments(methodPkg)}
                  className="w-full rounded-xl bg-white border border-[#E5E8EB] py-3.5 flex items-center justify-center gap-2 transition-all active:scale-[0.99] hover:border-[#0064FF]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4E5968" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="5" width="20" height="14" rx="2.5" />
                    <path d="M2 10h20" />
                  </svg>
                  <span className="font-bold text-[14px] text-[#191F28]">신용 · 체크카드 (테스트용)</span>
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* 결제창 뒤로가기(취소) 안내 모달 */}
        <Modal
          isOpen={canceledNotice}
          onClose={() => setCanceledNotice(false)}
          title="결제가 취소되었습니다"
          size="sm"
        >
          <div className="space-y-6">
            <p className="text-text-secondary leading-relaxed">
              결제가 완료되지 않았어요. 다시 시도하시려면 원하는 패키지의 구매 버튼을 눌러 주세요.
            </p>
            <Button variant="primary" fullWidth onClick={() => setCanceledNotice(false)}>
              확인
            </Button>
          </div>
        </Modal>

    </div>
  );
};

/**
 * toss pay 공식 로고 락업 (심볼 + 워드마크) — 토스 제공 에셋.
 * 395x96 (≈4.11:1), 투명 배경. 흰 카드 버튼 위 24px 높이로 표시.
 * width/height 명시로 레이아웃 시프트 방지(페이지 진입 시 프리로드됨).
 */
const TossPayLogo: React.FC = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src="/icons/tosspay-lockup.png"
    alt="toss pay"
    width={99}
    height={24}
    className="h-6 w-auto select-none"
    draggable={false}
  />
);

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

