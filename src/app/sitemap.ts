import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.2000-saju.com';

/**
 * sitemap.xml — 검색엔진에 알릴 공개 페이지 목록.
 * 개인 결과·로그인 게이트 페이지는 제외(robots 와 일관). 홈 우선.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: Array<{
    path: string;
    priority: number;
    changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  }> = [
    { path: '/', priority: 1.0, changeFrequency: 'daily' },
    { path: '/saju/gunghap', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/tarot', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/sangdamso', priority: 0.7, changeFrequency: 'weekly' },
    { path: '/saju/taekil', priority: 0.6, changeFrequency: 'weekly' },
    { path: '/saju/year-fortune', priority: 0.6, changeFrequency: 'weekly' },
    { path: '/company', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/terms', priority: 0.2, changeFrequency: 'yearly' },
    { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' },
    { path: '/licenses', priority: 0.2, changeFrequency: 'yearly' },
  ];

  return entries.map((e) => ({
    url: `${BASE_URL}${e.path}`,
    lastModified: now,
    changeFrequency: e.changeFrequency,
    priority: e.priority,
  }));
}
