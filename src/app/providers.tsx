'use client';

import { useEffect } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { useScrollSafeTap } from '@/hooks/useScrollSafeTap';
import { AnalyticsTracker } from '@/components/AnalyticsTracker';
import { SignupGuard } from '@/components/SignupGuard';

export function Providers({ children }: { children: React.ReactNode }) {
  const { initialize } = useUserStore();

  useScrollSafeTap();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <>
      <AnalyticsTracker />
      <SignupGuard />
      {children}
    </>
  );
}
