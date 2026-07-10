import type { Metadata } from "next";
import { Gowun_Batang, Noto_Sans_KR } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "./providers";

const gowunBatang = Gowun_Batang({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const notoSansKR = Noto_Sans_KR({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.2000-saju.com';

// 검색엔진 소유확인 코드 — Search Console / 네이버 서치어드바이저에서 발급받아 env 로 주입.
// 미설정 시 해당 메타를 렌더하지 않음(코드 변경 없이 env 만 채우면 적용 → 재배포).
const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
const naverSiteVerification = process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "이천점 — 우주의 기운을 드려요",
    template: "%s | 이천점",
  },
  description: "우주의 기운으로 풀어내는 사주·타로·자미두수. 오늘 당신을 위한 한 문장을 받아보세요.",
  applicationName: "이천점",
  keywords: ["이천점", "사주", "타로", "자미두수", "운세", "궁합", "오늘의 운세", "신년운세", "택일"],
  icons: {
    icon: '/favicon.png',
  },
  // 페이지별 self-canonical — apex/www 중복에서 www 를 표준으로 선언 (서치콘솔 "표준 미선택 중복" 대응)
  alternates: {
    canonical: './',
  },
  openGraph: {
    title: '이천점 — 우주의 기운을 드려요',
    description: '우주의 기운으로 풀어내는 사주·타로·자미두수',
    siteName: '이천점',
    url: BASE_URL,
    locale: 'ko_KR',
    images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630 }],
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    ...(googleSiteVerification ? { google: googleSiteVerification } : {}),
    ...(naverSiteVerification
      ? { other: { 'naver-site-verification': naverSiteVerification } }
      : {}),
  },
};

// 브랜드 인식용 구조화 데이터 — Organization + WebSite.
// "이천점"이 이천시 점포가 아니라 사주/운세 서비스(브랜드)임을 검색엔진에 명시.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${BASE_URL}/#organization`,
      name: '이천점',
      alternateName: '이천점 사주',
      url: BASE_URL,
      logo: `${BASE_URL}/og-image.png`,
      description: '우주의 기운으로 풀어내는 사주·타로·자미두수 운세 서비스',
    },
    {
      '@type': 'WebSite',
      '@id': `${BASE_URL}/#website`,
      url: BASE_URL,
      name: '이천점',
      description: '우주의 기운으로 풀어내는 사주·타로·자미두수',
      inLanguage: 'ko-KR',
      publisher: { '@id': `${BASE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${gowunBatang.variable} ${notoSansKR.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
