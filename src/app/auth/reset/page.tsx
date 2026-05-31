'use client';

/**
 * 비밀번호 초기화 — 1단계: 이메일 입력 → 재설정 메일 발송
 * Supabase resetPasswordForEmail() 호출
 * 메일 링크 클릭 시 /auth/update-password 로 이동
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '../../../services/supabase';
import { BackButton } from '../../../components/ui/BackButton';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) {
      setError('가입한 이메일을 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      await auth.resetPasswordForEmail(email);
      setSent(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError('메일 발송 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-auth-shell">
      <div className="app-auth-container flex items-center justify-center px-4 py-12 relative overflow-hidden">
        <div className="absolute top-3 left-3 z-20">
          <BackButton to="/login" />
        </div>

        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cta/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-moon-halo/5 rounded-full blur-3xl" />

        <div className="w-full relative z-10 max-w-[460px]">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-space-surface/80 backdrop-blur-xl p-8 shadow-2xl shadow-black/20">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-text-primary mb-2">비밀번호 초기화</h1>
              <p className="text-text-secondary text-sm leading-relaxed">
                가입하신 이메일로 초기화 링크를 보내드려요.<br />
                링크를 누르면 새 비밀번호를 설정할 수 있어요.
              </p>
            </div>

            {sent ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-status-success/10 border border-status-success/20 p-4 text-center">
                  <p className="text-status-success font-semibold mb-2">메일을 보냈어요!</p>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    <strong className="block text-text-primary mb-0.5 break-all">{email}</strong>
                    받은편지함을 확인해 주세요.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="w-full h-12 rounded-lg bg-gradient-to-r from-cta to-cta-active text-white font-bold text-sm"
                >
                  로그인 페이지로
                </button>
                <p className="text-xs text-text-tertiary text-center leading-relaxed">
                  메일이 안 오면 스팸함도 확인해 주세요.<br />
                  1~2분 후에도 안 오면 다시 시도해 주세요.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-lg bg-status-error/10 border border-status-error/20 p-3 text-sm text-status-error">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">이메일</label>
                  <input
                    type="email"
                    placeholder="가입한 이메일 주소"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 rounded-lg bg-space-elevated/60 border border-[var(--border-default)] px-4 text-text-primary placeholder-text-tertiary text-sm outline-none transition-all focus:border-cta focus:ring-1 focus:ring-cta/30"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-lg bg-gradient-to-r from-cta to-cta-active text-white font-bold text-sm cursor-pointer transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {loading ? '메일 보내는 중...' : '초기화 메일 받기'}
                </button>
              </form>
            )}

            <div className="mt-6 text-center text-sm">
              <Link href="/login" className="text-text-tertiary hover:text-cta transition-colors">
                로그인으로 돌아가기
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
