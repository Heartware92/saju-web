import type { Metadata } from 'next';
import Layout from '@/components/Layout';
import { ManshinImageCompareTest } from '@/components/test/ManshinImageCompareTest';

// 만신 카드 일러스트 비교 페이지 (임시) — 검색엔진 색인 차단(어디에도 링크하지 않음 + noindex)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function TarotTest2Page() {
  return (
    <Layout>
      <ManshinImageCompareTest />
    </Layout>
  );
}
