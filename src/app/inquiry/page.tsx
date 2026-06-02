'use client';

/**
 * 문의하기 — 햄버거 메뉴 진입.
 * 유형 카드(환불/오류·버그/제안·피드백/기타) → 각 전용 페이지로 이동.
 * 내 문의 내역은 별도 페이지(/inquiry/history)로 진입.
 *
 * UX 원칙:
 * - 이모지 0개. 텍스트 기반 + 우측 chevron.
 * - 인라인 입력 폼 없음. 각 유형은 자체 페이지에서 작성.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUserStore } from '../../store/useUserStore';
import Layout from '../../components/Layout';

interface CategoryCard {
  key: string;
  label: string;
  desc: string;
  href: string;
}

// 선택 가능한 유형(상단 카드). 계정·로그인은 로그인 게이트 특성상 제외.
const CATEGORY_CARDS: CategoryCard[] = [
  {
    key: 'payment',
    label: '환불 문의',
    desc: '결제 후 7일 이내 미사용 크레딧 환불 요청',
    href: '/inquiry/refund',
  },
  {
    key: 'bug',
    label: '오류·버그',
    desc: '풀이가 안 나옴, 화면이 깨짐, 잘못된 결과',
    href: '/inquiry/bug',
  },
  {
    key: 'feedback',
    label: '제안·피드백',
    desc: '서비스 개선 의견, 새 기능 제안, 사용 후기',
    href: '/inquiry/feedback',
  },
  {
    key: 'other',
    label: '기타',
    desc: '위 분류에 해당하지 않는 모든 문의',
    href: '/inquiry/other',
  },
];

export default function InquiryPage() {
  const router = useRouter();
  const { user } = useUserStore();
  const userLoading = useUserStore((s) => s.loading);

  // 비로그인 사용자는 로그인 페이지로 유도 — loading 끝난 후에만 판단 (hydration race 방지)
  useEffect(() => {
    if (!userLoading && user === null) {
      router.replace('/login?from=/inquiry');
    }
  }, [user, userLoading, router]);

  return (
    <Layout>
      <div className="px-5 pt-3 pb-12">
        {/* 헤더 */}
        <div className="relative flex items-center justify-center mb-6 pt-3 px-1">
          <Link
            href="/"
            aria-label="뒤로"
            className="absolute left-0 w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            문의하기
          </h1>
        </div>

        {/* 안내 */}
        <p className="text-[13px] text-text-tertiary leading-relaxed mb-5 px-1">
          어떤 문의든 편하게 남겨주세요. 유형을 선택하면 작성 페이지로 이동해요.
        </p>

        {/* 유형 카드 */}
        <section className="mb-5">
          <div className="space-y-2">
            {CATEGORY_CARDS.map((cat) => (
              <Link
                key={cat.key}
                href={cat.href}
                className="w-full text-left flex items-stretch rounded-xl overflow-hidden bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] hover:border-cta/40 transition-colors"
              >
                <span className="w-1 shrink-0 bg-transparent" />
                <span className="flex-1 px-4 py-3">
                  <span className="block text-[15px] font-semibold text-text-primary">{cat.label}</span>
                  <span className="block text-[12.5px] text-text-tertiary mt-0.5 leading-snug">{cat.desc}</span>
                </span>
                <span className="self-center pr-4 text-text-tertiary">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* 내 문의 내역 진입 */}
        <Link
          href="/inquiry/history"
          className="w-full text-left flex items-center justify-between rounded-xl px-4 py-3.5 bg-[rgba(124,92,252,0.08)] border border-[rgba(124,92,252,0.22)] hover:border-cta/50 transition-colors"
        >
          <span className="text-[14px] font-semibold text-text-primary">내 문의 내역</span>
          <span className="text-text-tertiary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        </Link>
      </div>
    </Layout>
  );
}
