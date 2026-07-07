import type { Metadata } from 'next';
import Layout from '@/components/Layout';
import { ManshinOracleTest } from '@/components/test/ManshinOracleTest';

// 만신 오라클 실험 페이지 — 검색엔진 색인 차단(어디에도 링크하지 않음 + noindex)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function TarotTestPage() {
  return (
    <Layout>
      <ManshinOracleTest />
    </Layout>
  );
}
