/**
 * 로그인 페이지 - 코스믹 테마
 */

'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUserStore } from '../../store/useUserStore';
import { BackButton } from '../../components/ui/BackButton';
import { SocialAuthButtons } from '../../components/SocialAuthButtons';

export const LoginPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loading } = useUserStore();

  // 로그인 성공 후 항상 홈으로 (사용자 의도)
  // 이전엔 ?from= 파라미터로 원래 가려던 페이지로 돌아갔지만,
  // 비로그인 홈 카드가 /saju/input 을 from 으로 넘겨 "프로필 수정 화면 같은 곳" 으로 보였음.
  // 단순하게 홈으로 통일.
  void searchParams;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    // Supabase JS deadlock 우회 — 12초 안에 응답 없으면 강제 reset.
    // useUserStore.login 의 loading state 가 영원히 true 로 남는 사고 방지.
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('LOGIN_TIMEOUT')), 12000)
    );

    try {
      await Promise.race([login(email, password), timeoutPromise]);
      router.replace('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'LOGIN_TIMEOUT') {
        // storage 강제 정리 후 안내 — 다음 시도가 깨끗하게 시작되도록
        try {
          Object.keys(localStorage)
            .filter((k) => k.startsWith('sb-') || k.includes('supabase'))
            .forEach((k) => localStorage.removeItem(k));
        } catch {
          /* ignore */
        }
        // useUserStore 의 loading 도 명시적으로 reset (store 안에서는 영원히 멈춰있을 수 있음)
        useUserStore.setState({ loading: false });
        setError('응답이 너무 오래 걸려요. 다시 시도해주세요. (계속 실패 시 새로고침)');
      } else if (msg.includes('Invalid login')) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else if (msg.includes('Email not confirmed')) {
        setError('이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.');
      } else {
        setError('로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    }
  };

  return (
    <div className="app-auth-shell">
      <div className="app-auth-container flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* 뒤로가기 — 최상단 좌측 absolute 고정 (텍스트 없는 아이콘만, 공통 BackButton) */}
      <div className="absolute top-3 left-3 z-20">
        <BackButton to="/" />
      </div>

      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cta/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-moon-halo/5 rounded-full blur-3xl" />

      <div className="w-full relative z-10">
        {/* Card */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-space-surface/80 backdrop-blur-xl p-8 shadow-2xl shadow-black/20">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-text-primary mb-2">로그인</h1>
            <p className="text-text-secondary text-sm">이천점에 오신 것을 환영합니다</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-status-error/10 border border-status-error/20 p-3 text-sm text-status-error">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">이메일</label>
              <input
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 rounded-lg bg-space-elevated/60 border border-[var(--border-default)] px-4 text-text-primary placeholder-text-tertiary text-sm outline-none transition-all focus:border-cta focus:ring-1 focus:ring-cta/30"
                required
              />
            </div>

            {/* Password — 표시·숨김 토글 */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">비밀번호</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="비밀번호 입력"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 rounded-lg bg-space-elevated/60 border border-[var(--border-default)] px-4 pr-12 text-text-primary placeholder-text-tertiary text-sm outline-none transition-all focus:border-cta focus:ring-1 focus:ring-cta/30"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary p-1"
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* 비밀번호 초기화 */}
            <div className="flex justify-end text-sm">
              <Link href="/auth/reset" className="text-text-tertiary hover:text-cta transition-colors">
                비밀번호 초기화
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-lg bg-gradient-to-r from-cta to-cta-active text-white font-bold text-sm cursor-pointer transition-all hover:opacity-90 hover:shadow-lg hover:shadow-cta/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* Bottom link */}
          <div className="mt-6 text-center text-sm">
            <span className="text-text-tertiary">아직 계정이 없으신가요?</span>{' '}
            <Link href="/signup" className="text-cta font-semibold hover:underline">
              회원가입
            </Link>
          </div>

          <div className="mt-6">
            <SocialAuthButtons />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
