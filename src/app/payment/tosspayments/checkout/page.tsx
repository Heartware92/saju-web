import { Suspense } from 'react';
import type { Metadata } from 'next';
import Layout from '@/components/Layout';
import TossPaymentsCheckoutView from '@/pages/TossPaymentsCheckoutPage';

export const metadata: Metadata = {
  title: '결제하기',
  robots: { index: false, follow: false },
};

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-3 border-cta border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function TossPaymentsCheckoutRoute() {
  return (
    <Layout>
      <Suspense fallback={<LoadingSpinner />}>
        <TossPaymentsCheckoutView />
      </Suspense>
    </Layout>
  );
}
