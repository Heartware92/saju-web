import { Suspense } from 'react';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import CreditTestClient from './CreditTestClient';

// 내부 전용 — 검색 색인 금지
export const metadata = {
  title: '결제 테스트 (내부)',
  robots: { index: false, follow: false },
};

export default function CreditTestRoute() {
  return (
    <Layout>
      <ProtectedRoute>
        <Suspense fallback={null}>
          <CreditTestClient />
        </Suspense>
      </ProtectedRoute>
    </Layout>
  );
}
