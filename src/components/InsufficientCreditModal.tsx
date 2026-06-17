'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

/**
 * 크레딧 부족 안내 모달 — 0(또는 부족) 크레딧으로 풀이에 진입했을 때 띄운다.
 * "크레딧 충전하기"(확인) → /credit (홈 상단 달 클릭과 동일한 충전 화면).
 *
 * QuickFortuneGate / FortuneProfileSelect 의 insufficient 모달과 동일 디자인.
 * 게이트가 약했던 궁합·이름풀이·꿈해몽 진입부에서 공통 사용.
 */
interface InsufficientCreditModalProps {
  /** 서비스 이름 — "○○에는 🌙 N개가 필요해요" */
  serviceName: string;
  /** 필요한 달 크레딧 수 */
  creditCost: number;
  /** 현재 잔액 */
  balance: number;
  /** 취소/닫기 콜백 — 미지정 시 router.back() */
  onClose?: () => void;
}

export function InsufficientCreditModal({
  serviceName,
  creditCost,
  balance,
  onClose,
}: InsufficientCreditModalProps) {
  const router = useRouter();
  const creditLabel = '🌙';

  const handleClose = () => {
    if (onClose) onClose();
    else router.back();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full max-w-[380px] rounded-2xl bg-[rgba(20,12,38,0.97)] border border-[var(--border-subtle)] p-6 text-center shadow-2xl"
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary hover:bg-white/10 transition-colors"
          aria-label="닫기"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <h3 className="text-[17px] font-bold text-text-primary mb-2">크레딧이 부족해요</h3>
        <p className="text-[14px] text-text-secondary leading-relaxed mb-5">
          {serviceName}에는 {creditLabel} {creditCost}개가 필요해요.
          <br />현재 잔액: {creditLabel} {balance}개
        </p>
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => router.push('/credit')}
            className="block w-full h-12 rounded-lg bg-gradient-to-r from-cta to-cta-active text-white font-bold text-[15px] hover:opacity-90 transition-all"
          >
            크레딧 충전하기
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="block w-full h-12 rounded-lg border border-[var(--border-subtle)] text-text-secondary font-medium text-[15px] hover:bg-white/5 transition-all"
          >
            취소
          </button>
        </div>
      </motion.div>
    </div>
  );
}
