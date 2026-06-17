'use client';

/**
 * OAuth 콜백 페이지 (Google / Kakao)
 *
 * Supabase는 OAuth 성공 시 `?code=...`를 붙여 이 페이지로 리다이렉트한다.
 * PKCE flow에서는 `exchangeCodeForSession`으로 code를 세션으로 교환한다.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase, agreement } from '../services/supabase';
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
        let session = null;
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setStatus('failed');
            setMessage(error.message || '세션 교환 실패');
            return;
          }
          // ★ 교환 결과의 세션을 직접 사용한다. 직후 getSession()을 재조회하면 세션 영속
          //   타이밍 레이스로(특히 안드로이드) null 이 잡혀, 동의 체크를 건너뛰고 홈으로
          //   빠지는 버그가 있었다(첫 시도는 홈, 두 번째에야 동의로).
          session = data.session;
        } else {
          // token-flow (magic link 클릭 직후): 해시에 access_token이 실려 오는 경우
          // supabase-js가 자동으로 세션을 복원하므로 getSession 으로 확인
          const { data } = await supabase.auth.getSession();
          session = data.session;
        }

        // 방어: 세션이 비면 한 번 더 조회(영속 지연 대비)
        if (!session) {
          const { data } = await supabase.auth.getSession();
          session = data.session;
        }

        if (session?.user) {
          // 1이메일 = 1provider 정책. 같은 (인증된) 이메일을 가진 구글·카카오는 Supabase 가
          // 서버에서 자동으로 한 계정에 연결(identity linking)한다. 그 결과 두 번째 provider 로
          // 들어오면 첫 번째(구글)로 만든 계정에 로그인돼 버린다.
          // → identities 가 2개 이상이면, 최초(가장 오래된) provider 만 허용하고 나머지는 차단.
          const identities = session.user.identities ?? [];
          if (identities.length > 1) {
            const oldest = [...identities].sort(
              (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
            )[0];
            const original = oldest?.provider;
            const current = session.user.app_metadata?.provider;
            if (original && current && current !== original) {
              const label: Record<string, string> = { google: '구글', kakao: '카카오' };
              const name = label[original] ?? original;
              try { await supabase.auth.signOut(); } catch { /* noop */ }
              useUserStore.setState({ user: null });
              setStatus('failed');
              setMessage(`이미 ${name}로 가입된 이메일이에요. ${name}로 로그인해주세요.`);
              return;
            }
          }

          useUserStore.setState({ user: session.user });
          await Promise.all([
            useCreditStore.getState().fetchBalance(session.user.id, { force: true }),
            useProfileStore.getState().fetchProfiles({ force: true, userId: session.user.id }),
          ]);

          const next = searchParams.get('next') || '/';
          const dest = encodeURIComponent(next);

          const isSocial = session.user.app_metadata?.provider && session.user.app_metadata.provider !== 'email';
          // ★ 우리 휴대폰 인증 통과 여부 = phone_verified_at(우리 전용 키)로 판단.
          //    phone(자동채움)·phone_verified(카카오가 로그인마다 false 로 덮어씀)는 신뢰 불가.
          //    카카오가 보내지 않는 phone_verified_at 만 재로그인 시에도 보존된다.
          const phoneVerified = !!session.user.user_metadata?.phone_verified_at;

          // 1) 소셜 가입 미완료(휴대폰 미인증) → 휴대폰 인증부터 "이어서"가 아니라
          //    처음(약관 동의)부터 다시 시작. 동의 페이지가 끝나면 휴대폰 인증으로 이어진다.
          //    (가입을 끝내지 않고 이탈했다면 매번 처음부터 재시작 = 일관된 온보딩 깔때기)
          if (isSocial && !phoneVerified) {
            router.replace(`/auth/consent?next=${dest}`);
            return;
          }

          // 2) 그 외 약관 동의 누락(이메일 가입 등 잔여 케이스) → 동의 페이지로
          //    public.user_agreements 테이블에서 조회 (OAuth 가 덮어쓸 수 없는 위치).
          const ag = await agreement.getMine();
          if (!ag?.terms_agreed_at) {
            router.replace(`/auth/consent?next=${dest}`);
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
      <div className="app-auth-shell">
        <div className="app-auth-container flex items-center justify-center px-4">
          <div className="max-w-md w-full rounded-2xl bg-space-surface/70 border border-[var(--border-subtle)] p-8 text-center">
            <h1 className="text-lg font-bold mb-2 text-text-primary">로그인 실패</h1>
            <p className="text-sm text-text-secondary mb-6 leading-relaxed">{message}</p>
            <button
              onClick={() => router.replace('/login')}
              className="px-4 py-2 rounded-lg bg-cta text-white text-sm font-bold"
            >
              로그인 페이지로
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-auth-shell">
      <div className="app-auth-container flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-cta border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}
