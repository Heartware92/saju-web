import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { CreditPurchasePage } from '@/features/credit/pages/CreditPurchasePage';

export default function Credit() {
  return (
    <Layout>
      <ProtectedRoute>
        <CreditPurchasePage />
      </ProtectedRoute>
    </Layout>
  );
}
