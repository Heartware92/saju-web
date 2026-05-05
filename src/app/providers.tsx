'use client';

import { useEffect } from 'react';
import { useUserStore } from '@/store/useUserStore';
import { useScrollSafeTap } from '@/hooks/useScrollSafeTap';

export function Providers({ children }: { children: React.ReactNode }) {
  const { initialize } = useUserStore();

  useScrollSafeTap();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <>{children}</>;
}
