'use client';

import React, { useState } from 'react';
import { auth } from '../services/supabase';

interface SocialAuthButtonsProps {
  /** 버튼 위 라벨 텍스트 — 기본: "소셜 계정으로 로그인" */
  label?: string;
}

export const SocialAuthButtons: React.FC<SocialAuthButtonsProps> = ({ label }) => {
  const [pendingProvider, setPendingProvider] = useState<'google' | 'kakao' | null>(null);
  const [error, setError] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedAge14, setAgreedAge14] = useState(false);
  const [agreedMarketing, setAgreedMarketing] = useState(false);
  const [showPolicy, setShowPolicy] = useState<'terms' | 'privacy' | null>(null);

  const allAgreed = agreedTerms && agreedPrivacy && agreedAge14 && agreedMarketing;
  const allRequiredAgreed = agreedTerms && agreedPrivacy && agreedAge14;

  const toggleAllAgree = (v: boolean) => {
    setAgreedTerms(v);
    setAgreedPrivacy(v);
    setAgreedAge14(v);
    setAgreedMarketing(v);
  };

  const handleClick = (provider: 'google' | 'kakao') => {
    setError('');
    setPendingProvider(provider);
  };

  const handleProceed = async () => {
    if (!pendingProvider) return;
    if (!allRequiredAgreed) {
      setError('필수 항목에 모두 동의해주세요.');
      return;
    }
    setError('');
    try {
      await auth.signInWithProvider(pendingProvider);
    } catch (err) {
      console.error('Social login error:', err);
      setError('소셜 로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
    setPendingProvider(null);
  };

  return (
    <>
      <div className="text-center mb-4">
        <span className="text-xs text-text-tertiary">
          {label || '소셜 계정으로 로그인'}
        </span>
      </div>

      {error && (
        <div className="rounded-lg bg-status-error/10 border border-status-error/20 p-3 text-sm text-status-error mb-3">
          {error}
        </div>
      )}

      <div className="flex justify-center gap-4">
        <button
          type="button"
          onClick={() => handleClick('google')}
          className="w-14 h-14 rounded-full border border-[var(--border-default)] bg-space-elevated/40 flex items-center justify-center transition-all hover:scale-105 hover:border-[var(--border-strong)] hover:bg-space-elevated"
          title="구글로 시작하기"
          aria-label="구글로 시작하기"
        >
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        </button>

        <button
          type="button"
          onClick={() => handleClick('kakao')}
          className="w-14 h-14 rounded-full bg-[#FEE500] flex items-center justify-center transition-all hover:scale-105 hover:shadow-lg hover:shadow-[#FEE500]/20"
          title="카카오로 시작하기"
          aria-label="카카오로 시작하기"
        >
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="#000000" d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3zm5.907 8.06l1.47-1.424a.472.472 0 0 0-.656-.678l-1.928 1.866V9.282a.472.472 0 0 0-.944 0v2.557a.471.471 0 0 0 0 .222V13.5a.472.472 0 0 0 .944 0v-1.363l.427-.413 1.428 2.033a.472.472 0 1 0 .773-.543l-1.514-2.155zm-2.958 1.924h-1.46V9.297a.472.472 0 0 0-.943 0v4.159c0 .26.21.472.471.472h1.932a.472.472 0 1 0 0-.944zm-5.857-1.092l.696-1.707.638 1.707H9.092zm2.523.488l.002-.016a.469.469 0 0 0-.127-.32l-1.046-2.8a.69.69 0 0 0-.627-.474.696.696 0 0 0-.653.447l-1.661 4.075a.472.472 0 0 0 .874.357l.33-.813h2.07l.299.8a.472.472 0 1 0 .884-.33l-.345-.926zM8.293 9.302a.472.472 0 0 0-.471-.472H4.577a.472.472 0 1 0 0 .944h1.16v3.736a.472.472 0 0 0 .944 0V9.774h1.14c.26 0 .472-.212.472-.472z"/>
          </svg>
        </button>
      </div>

      {/* 약관 동의 모달 */}
      {pendingProvider && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPendingProvider(null)} />
          <div className="flex min-h-full items-end sm:items-center justify-center">
            <div onClick={(e) => e.stopPropagation()} className="relative w-full sm:max-w-[420px] rounded-t-2xl sm:rounded-2xl p-6 bg-space-surface border border-[var(--border-subtle)] animate-slideUp">
              <button type="button" onClick={() => setPendingProvider(null)} className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/5 text-[var(--text-tertiary)] hover:bg-white/10 hover:text-[var(--text-primary)] transition-colors" aria-label="닫기">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
              </button>
              <h3 className="text-base font-bold text-text-primary mb-1">약관 동의</h3>
              <p className="text-xs text-text-secondary mb-4">서비스 이용을 위해 약관에 동의해주세요.</p>

              <div className="space-y-2.5">
                <label className="flex items-center gap-3 cursor-pointer pb-2 border-b border-[var(--border-subtle)]">
                  <input type="checkbox" checked={allAgreed} onChange={(e) => toggleAllAgree(e.target.checked)} className="w-5 h-5 rounded accent-[var(--cta-primary)] cursor-pointer" />
                  <span className="text-sm font-semibold text-text-primary">모두 동의 (필수 + 선택 포함)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="w-5 h-5 rounded accent-[var(--cta-primary)] cursor-pointer" />
                  <span className="text-sm text-text-secondary flex-1">
                    <span className="text-status-error font-bold">[필수]</span>{' '}이용약관 동의{' '}
                    <button type="button" onClick={() => setShowPolicy('terms')} className="text-cta hover:underline font-medium">보기</button>
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={agreedPrivacy} onChange={(e) => setAgreedPrivacy(e.target.checked)} className="w-5 h-5 rounded accent-[var(--cta-primary)] cursor-pointer" />
                  <span className="text-sm text-text-secondary flex-1">
                    <span className="text-status-error font-bold">[필수]</span>{' '}개인정보처리방침 동의{' '}
                    <button type="button" onClick={() => setShowPolicy('privacy')} className="text-cta hover:underline font-medium">보기</button>
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={agreedAge14} onChange={(e) => setAgreedAge14(e.target.checked)} className="w-5 h-5 rounded accent-[var(--cta-primary)] cursor-pointer" />
                  <span className="text-sm text-text-secondary flex-1">
                    <span className="text-status-error font-bold">[필수]</span>{' '}만 14세 이상입니다
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={agreedMarketing} onChange={(e) => setAgreedMarketing(e.target.checked)} className="w-5 h-5 rounded accent-[var(--cta-primary)] cursor-pointer" />
                  <span className="text-sm text-text-secondary flex-1">
                    <span className="text-text-tertiary font-bold">[선택]</span>{' '}이벤트·혜택 등 마케팅 정보 수신 동의
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleProceed}
                disabled={!allRequiredAgreed}
                className="w-full h-12 rounded-lg bg-gradient-to-r from-cta to-cta-active text-white font-bold text-sm mt-4 cursor-pointer transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                동의하고 로그인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이용약관 / 개인정보처리방침 뷰어 모달 */}
      {showPolicy && (
        <div className="fixed inset-0 z-[70] bg-space-deep flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-space-surface/90 backdrop-blur-sm shrink-0">
            <button
              type="button"
              onClick={() => setShowPolicy(null)}
              className="text-text-secondary hover:text-text-primary text-sm flex items-center gap-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              닫기
            </button>
            <h2 className="text-sm font-bold text-text-primary">
              {showPolicy === 'terms' ? '이용약관' : '개인정보처리방침'}
            </h2>
            <div className="w-12" />
          </div>
          <iframe
            src={`/${showPolicy}?embed=1`}
            className="flex-1 w-full border-none"
            title={showPolicy === 'terms' ? '이용약관' : '개인정보처리방침'}
          />
        </div>
      )}
    </>
  );
};
