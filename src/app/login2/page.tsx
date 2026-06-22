import { Suspense } from 'react';
import { LoginPage2 } from '@/features/auth/LoginPage2';

export default function Login2() {
  // useSearchParams 는 Suspense 경계 필요 (App Router prerender 대응)
  return (
    <Suspense fallback={null}>
      <LoginPage2 />
    </Suspense>
  );
}
