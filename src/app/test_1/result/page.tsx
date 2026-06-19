import { Suspense } from 'react';
import type { Metadata } from 'next';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Test1ResultPage from '@/pages/test/Test1ResultPage';

// 개발자 전용 미러 — 검색엔진 색인 차단(어디에도 링크하지 않음 + noindex)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function Test1Result() {
  return (
    <Layout>
      <ProtectedRoute>
        <Suspense fallback={<LoadingSpinner />}>
          <Test1ResultPage />
        </Suspense>
      </ProtectedRoute>
    </Layout>
  );
}
