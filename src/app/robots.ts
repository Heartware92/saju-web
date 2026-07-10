import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.2000-saju.com';

/**
 * robots.txt — 크롤링 규칙.
 *  - 공개/마케팅 페이지는 허용
 *  - 개인 결과·로그인 게이트·관리/검수/콜백 경로는 차단(색인 가치 없거나 개인정보)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/temp_test',
          '/temp_test2',
          '/temp_terms',     // 약관 비교 검토용 임시 페이지 (/terms 와 중복 방지)
          '/temp_privacy',   // 방침 비교 검토용 임시 페이지 (/privacy 와 중복 방지)
          '/tarot_test',     // 만신 타로 실험
          '/tarot_test2',    // 만신 일러스트 비교
          '/test_1',         // 정통 프롬프트 미러 (임시)
          '/test_2',
          '/credit_test',
          '/intro',          // 오프닝 시안 (미연결)
          '/intro1',
          '/intro2',
          '/intro3',
          '/intro4',
          '/login2',
          '/auth/',          // 콜백·동의·휴대폰인증 등
          '/payment/',       // 결제 콜백
          '/login',
          '/signup',
          '/mypage',
          '/credit',
          '/inquiry',        // 문의 폼·내역
          '/archive',
          '/share/',         // 개인 공유 결과(토큰별)
          '/saju/result',
          '/saju/input',
          '/saju/date',
          '/saju/today',
          '/saju/tojeong',
          '/saju/zamidusu',
          '/saju/newyear',
          '/saju/more/',
          '/saju/taekil/result',
          '/tarot/result',
          '/sangdamso/chat',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
