import { Suspense } from 'react';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import ConsultationChatPage from '@/pages/ConsultationChatPage';

export default function SangdamsoChatRoute() {
  return (
    <Layout>
      <ProtectedRoute>
        <Suspense fallback={<div className="min-h-screen" />}>
          <ConsultationChatPage />
        </Suspense>
      </ProtectedRoute>
    </Layout>
  );
}
