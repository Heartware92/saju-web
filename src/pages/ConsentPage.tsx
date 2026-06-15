'use client';

/**
 * 약관 동의 페이지 — OAuth 첫 로그인 시 AuthCallback 에서 리다이렉트.
 *
 * 흐름:
 *  - 사용자가 약관 동의 → user_metadata 에 동의 시각 기록
 *  - 휴대폰 미인증 소셜 신규 사용자라면 phone-verify 로
 *  - 그 외엔 next 파라미터(또는 홈) 로
 *
 * "동의하지 않고 나가기" 누르면 즉시 로그아웃 + 홈으로.
 */

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, supabase, agreement } from '../services/supabase';
import { useUserStore } from '../store/useUserStore';
import { trackEvent } from '../lib/analytics/track';

export default function ConsentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get('next') || '/';

  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedAge14, setAgreedAge14] = useState(false);
  const [agreedMarketing, setAgreedMarketing] = useState(false);
  const [showPolicy, setShowPolicy] = useState<'terms' | 'privacy' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const allAgreed = agreedTerms && agreedPrivacy && agreedAge14 && agreedMarketing;
  const allRequiredAgreed = agreedTerms && agreedPrivacy && agreedAge14;

  const toggleAllAgree = (v: boolean) => {
    setAgreedTerms(v);
    setAgreedPrivacy(v);
    setAgreedAge14(v);
    setAgreedMarketing(v);
  };

  const handleAccept = async () => {
    if (!allRequiredAgreed) {
      setError('필수 항목에 모두 동의해주세요.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await agreement.upsertMine(agreedMarketing);

      // 동의 후 라우팅: 소셜 + 휴대폰 미인증이면 phone-verify
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        useUserStore.setState({ user });
        // 전환 분석: OAuth 신규 가입 완료 이벤트(이메일 가입은 useUserStore.signup 에서 발생).
        // 이 페이지는 OAuth 첫 로그인 전용 분기라 여기서 1회 발생 = OAuth 가입 추적. 실패해도 무시.
        trackEvent('signup');
        const isSocial = user.app_metadata?.provider && user.app_metadata.provider !== 'email';
        const hasPhone = !!user.user_metadata?.phone;
        if (isSocial && !hasPhone) {
          router.replace('/auth/phone-verify');
          return;
        }
      }
      router.replace(next);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      setError(msg || '동의 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try { await auth.signOut(); } catch { /* noop */ }
    useUserStore.setState({ user: null });
    router.replace('/');
  };

  return (
    <div className="app-auth-shell">
      <div className="app-auth-container flex items-center justify-center px-4 py-12 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cta/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-moon-halo/5 rounded-full blur-3xl" />

        <div className="w-full relative z-10">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-space-surface/80 backdrop-blur-xl p-7 shadow-2xl shadow-black/20 text-left">
            <div className="mb-5 text-left">
              <h1 className="text-xl font-bold text-text-primary mb-1">약관 동의</h1>
              <p className="text-sm text-text-secondary leading-relaxed">
                이천점 서비스 이용을 위해<br />아래 약관에 동의해주세요.
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-status-error/10 border border-status-error/20 p-3 text-sm text-status-error mb-4">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer pb-3 border-b border-[var(--border-subtle)] text-left">
                <input
                  type="checkbox"
                  checked={allAgreed}
                  onChange={(e) => toggleAllAgree(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded accent-[var(--cta-primary)] cursor-pointer shrink-0"
                />
                <span className="text-sm font-semibold text-text-primary flex-1 text-left">
                  모두 동의 (필수 + 선택 포함)
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer text-left">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded accent-[var(--cta-primary)] cursor-pointer shrink-0"
                />
                <span className="text-sm text-text-secondary flex-1 text-left">
                  <span className="text-status-error font-bold">[필수]</span>{' '}이용약관 동의{' '}
                  <button
                    type="button"
                    onClick={() => setShowPolicy('terms')}
                    className="text-cta hover:underline font-medium"
                  >
                    보기
                  </button>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer text-left">
                <input
                  type="checkbox"
                  checked={agreedPrivacy}
                  onChange={(e) => setAgreedPrivacy(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded accent-[var(--cta-primary)] cursor-pointer shrink-0"
                />
                <span className="text-sm text-text-secondary flex-1 text-left">
                  <span className="text-status-error font-bold">[필수]</span>{' '}개인정보처리방침 동의{' '}
                  <button
                    type="button"
                    onClick={() => setShowPolicy('privacy')}
                    className="text-cta hover:underline font-medium"
                  >
                    보기
                  </button>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer text-left">
                <input
                  type="checkbox"
                  checked={agreedAge14}
                  onChange={(e) => setAgreedAge14(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded accent-[var(--cta-primary)] cursor-pointer shrink-0"
                />
                <span className="text-sm text-text-secondary flex-1 text-left">
                  <span className="text-status-error font-bold">[필수]</span>{' '}만 14세 이상입니다
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer text-left">
                <input
                  type="checkbox"
                  checked={agreedMarketing}
                  onChange={(e) => setAgreedMarketing(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded accent-[var(--cta-primary)] cursor-pointer shrink-0"
                />
                <span className="text-sm text-text-secondary flex-1 text-left">
                  <span className="text-text-tertiary font-bold">[선택]</span>{' '}이벤트·혜택 등 마케팅 정보 수신 동의
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleAccept}
              disabled={!allRequiredAgreed || submitting}
              className="w-full h-12 rounded-lg bg-gradient-to-r from-cta to-cta-active text-white font-bold text-sm mt-6 cursor-pointer transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '처리 중...' : '동의하고 시작하기'}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              disabled={submitting}
              className="w-full mt-3 text-[13px] text-text-tertiary hover:text-text-secondary transition-colors"
            >
              동의하지 않고 나가기
            </button>
          </div>
        </div>

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
      </div>
    </div>
  );
}
