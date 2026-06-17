'use client';

/**
 * 소셜 가입 미완료 가드.
 *
 * OAuth(구글·카카오) 로그인은 `exchangeCodeForSession` 시점에 세션이 즉시 커밋된다.
 * 이후 약관 동의(/auth/consent)·휴대폰 인증(/auth/phone-verify)을 거쳐야 가입이 완료되는데,
 * 사용자가 동의/인증 화면에서 뒤로가기로 빠져나오면 세션만 남아 "로그인된 상태"가 되어버린다.
 *
 * 소셜 가입자는 마지막 단계(휴대폰 인증) 전까지 항상 휴대폰 번호(user_metadata.phone)가 없으므로,
 * "소셜 + 휴대폰 미인증" 상태로 인증 플로우(/auth/*)를 벗어나면 가입을 포기한 것으로 보고
 * 로그아웃 후 홈으로 보낸다. (이메일 가입은 폼에서 동의를 함께 받으므로 해당 없음)
 */

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useUserStore } from '@/store/useUserStore';

export function SignupGuard() {
  const user = useUserStore((s) => s.user);
  const loading = useUserStore((s) => s.loading);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;

    const provider = user.app_metadata?.provider;
    const isSocial = !!provider && provider !== 'email';
    // 우리 휴대폰 인증 통과 = phone_verified_at(우리 전용 키). 카카오가 phone_verified 를
    // 로그인마다 false 로 덮어쓰므로, 그 키로 판단하면 완료된 카카오 유저가 로그아웃돼 버린다.
    const phoneVerified = !!user.user_metadata?.phone_verified_at;
    const inAuthFlow = !!pathname && pathname.startsWith('/auth/');

    if (isSocial && !phoneVerified && !inAuthFlow) {
      void (async () => {
        try {
          await useUserStore.getState().logout();
        } finally {
          router.replace('/');
        }
      })();
    }
  }, [user, loading, pathname, router]);

  return null;
}
