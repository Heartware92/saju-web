'use client';

/**
 * OAuth 콜백 페이지 (Google / Kakao)
 *
 * Supabase는 OAuth 성공 시 `?code=...`를 붙여 이 페이지로 리다이렉트한다.
 * PKCE flow에서는 `exchangeCodeForSession`으로 code를 세션으로 교환한다.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../services/supabase';
import { useCreditStore } from '../store/useCreditStore';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';

type Status = 'processing' | 'failed';

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<Status>('processing');
  const [message, setMessage] = useState('로그인 처리 중...');

  useEffect(() => {
    if (!searchParams) return;

    (async () => {
      try {
        // 오류가 쿼리에 실려 돌아온 경우 (사용자 취소 등)
        const oauthError = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        if (oauthError) {
          setStatus('failed');
          setMessage(errorDescription || '로그인이 취소되었거나 실패했습니다.');
          return;
        }

        // code-flow: ?code=
        const code = searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setStatus('failed');
            setMessage(error.message || '세션 교환 실패');
            return;
          }
        } else {
          // token-flow (magic link 클릭 직후): 해시에 access_token이 실려 오는 경우
          // supabase-js가 자동으로 세션을 복원하므로 getSession만 확인
          await supabase.auth.getSession();
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          useUserStore.setState({ user: session.user });
          await Promise.all([
            useCreditStore.getState().fetchBalance(session.user.id, { force: true }),
            useProfileStore.getState().fetchProfiles({ force: true, userId: session.user.id }),
          ]);

          const next = searchParams.get('next') || '/';

          // 1) 약관 동의 누락된 OAuth 신규 사용자 → 동의 페이지로
          //    (이메일 가입은 signUpWithEmail 단계에서 이미 기록됨)
          const hasTermsAgreed = !!session.user.user_metadata?.terms_agreed_at;
          if (!hasTermsAgreed) {
            const dest = encodeURIComponent(next);
            router.replace(`/auth/consent?next=${dest}`);
            return;
          }

          // 2) 소셜 신규 사용자 + 휴대폰 미인증 → 휴대폰 인증
          const isSocial = session.user.app_metadata?.provider && session.user.app_metadata.provider !== 'email';
          const hasPhone = !!session.user.user_metadata?.phone;
          if (isSocial && !hasPhone) {
            router.replace('/auth/phone-verify');
            return;
          }

          router.replace(next);
          return;
        }

        const next = searchParams.get('next') || '/';
        router.replace(next);
        return;
      } catch (e: any) {
        setStatus('failed');
        setMessage(e?.message || '로그인 처리 중 오류가 발생했습니다.');
      }
    })();
  }, [searchParams, router]);

  if (status === 'failed') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl bg-space-surface/70 border border-[var(--border-subtle)] p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-lg font-bold mb-2 text-text-primary">로그인 실패</h1>
          <p className="text-sm text-text-secondary mb-6 leading-relaxed">{message}</p>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 rounded-lg bg-cta text-white text-sm font-bold"
          >
            로그인 페이지로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-3 border-cta border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
