/**
 * Protected Route - 로그인 필요한 페이지 보호
 *
 * 비로그인 진입 시 자동 리다이렉트 X — 친화 안내 카드 + 로그인 버튼 노출.
 * (자동 리다이렉트는 컨텍스트 잃기 쉬워 사용자 혼란. 안내 카드가 명확)
 */

'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useUserStore } from '../store/useUserStore';
import { BackButton } from './ui/BackButton';
import { SocialAuthButtons } from './SocialAuthButtons';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** 안내 카드의 메시지 커스텀 — 기본: "로그인이 필요한 서비스예요" */
  message?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, message }) => {
  const { user, loading } = useUserStore();
  const pathname = usePathname();

  // 1) 사용자 정보 로딩 중 — 잠시 스피너 (초기값 loading=true → initialize() 완료 시 false)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-cta border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-text-secondary text-sm">잠시만요...</p>
        </div>
      </div>
    );
  }

  // 2) 비로그인 — 친화 안내 카드 (자동 리다이렉트 X)
  if (!user) {
    const fromQuery = pathname ? `?from=${encodeURIComponent(pathname)}` : '';
    return (
      <div className="min-h-screen px-4 pt-4 pb-12 max-w-[480px] mx-auto">
        <div className="flex items-center justify-between mb-6 px-1">
          <BackButton to="/" />
          <h1 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            로그인 필요
          </h1>
          <div className="w-9" />
        </div>

        <div className="rounded-2xl p-8 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] backdrop-blur-sm text-center">
          <h2 className="text-[17px] font-bold text-text-primary mb-2">
            {message || '로그인이 필요한 서비스예요'}
          </h2>
          <p className="text-[14px] text-text-secondary leading-relaxed mb-6">
            로그인 후 이용하시면 결과가 보관함에 저장되고<br />
            언제든 다시 볼 수 있어요.
          </p>

          <div className="space-y-2.5">
            <Link
              href={`/login${fromQuery}`}
              className="block w-full h-12 rounded-lg bg-gradient-to-r from-cta to-cta-active text-white font-bold text-[15px] flex items-center justify-center hover:opacity-90 transition-all"
            >
              로그인하기
            </Link>
            <Link
              href="/signup"
              className="block w-full h-12 rounded-lg border border-cta/40 text-cta font-semibold text-[15px] flex items-center justify-center hover:bg-cta/10 transition-all"
            >
              회원가입
            </Link>
          </div>

          <div className="mt-6 pt-5 border-t border-[var(--border-subtle)]">
            <SocialAuthButtons label="간편 로그인" />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

/**
 * Guest Route - 로그인 시 접근 불가 (로그인/회원가입 페이지용)
 */
interface GuestRouteProps {
  children: React.ReactNode;
}

export const GuestRoute: React.FC<GuestRouteProps> = ({ children }) => {
  const { user, loading } = useUserStore();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && user) {
      // replace — 이미 로그인된 유저가 로그인/가입 페이지 진입 시 history에 남기지 않음
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-cta border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-text-secondary text-sm">잠시만요...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <>{children}</>;
};
