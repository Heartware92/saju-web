import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { CreditPurchasePage } from '@/features/credit/pages/CreditPurchasePage';

// 게스트 결제 허용 시(NEXT_PUBLIC_PAYMENT_ALLOW_GUEST=true) 로그인 게이트 우회
const ALLOW_GUEST_PAYMENT = process.env.NEXT_PUBLIC_PAYMENT_ALLOW_GUEST === 'true';

export default function Credit() {
  return (
    <Layout>
      {ALLOW_GUEST_PAYMENT ? (
        <CreditPurchasePage />
      ) : (
        <ProtectedRoute>
          <CreditPurchasePage />
        </ProtectedRoute>
      )}
    </Layout>
  );
}
