import { Suspense } from 'react';
import Layout from '@/components/Layout';
import TossPaymentCallbackView from '@/pages/TossPaymentCallbackPage';

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-3 border-cta border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function TossPaymentCallbackRoute() {
  return (
    <Layout>
      <Suspense fallback={<LoadingSpinner />}>
        <TossPaymentCallbackView />
      </Suspense>
    </Layout>
  );
}
