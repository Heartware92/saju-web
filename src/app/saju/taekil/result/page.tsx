import { Suspense } from 'react';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import TaekilResultPage from '@/pages/TaekilResultPage';

export default function TaekilResult() {
  return (
    <Layout>
      <ProtectedRoute>
        <Suspense fallback={<div className="min-h-screen" />}>
          <TaekilResultPage />
        </Suspense>
      </ProtectedRoute>
    </Layout>
  );
}
