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

export const metadata: Metadata = {
  title: "이천점 — 우주의 기운을 드려요",
  description: "우주의 기운으로 풀어내는 사주·타로·자미두수. 오늘 당신을 위한 한 문장을 받아보세요.",
  icons: {
    icon: '/favicon.png',
  },
  openGraph: {
    title: '이천점 — 우주의 기운을 드려요',
    description: '우주의 기운으로 풀어내는 사주·타로·자미두수',
    siteName: '이천점',
    images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630 }],
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${gowunBatang.variable} ${notoSansKR.variable} antialiased`}>
        <Providers>
          {children}
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
