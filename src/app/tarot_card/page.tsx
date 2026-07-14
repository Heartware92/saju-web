import type { Metadata } from 'next';
import Layout from '@/components/Layout';
import { ManshinCardGalleryTest } from '@/components/test/ManshinCardGalleryTest';

// 만신 카드 전체 전람 페이지 (내부 양산 관리용) — 검색엔진 색인 차단(어디에도 링크하지 않음 + noindex)
export const metadata: Metadata = {
  title: '만신 카드 전람',
  robots: { index: false, follow: false },
};

export default function TarotCardPage() {
  return (
    <Layout>
      <ManshinCardGalleryTest />
    </Layout>
  );
}
