import type { Metadata } from 'next';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Test1Console from '@/pages/test/Test1Console';

// 개발자 전용 테스트 콘솔 — 검색엔진 색인 차단
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Test1ConsolePage() {
  return (
    <Layout>
      <ProtectedRoute>
        <Test1Console />
      </ProtectedRoute>
    </Layout>
  );
}
