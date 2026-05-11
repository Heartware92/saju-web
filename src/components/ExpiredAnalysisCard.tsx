'use client';

/**
 * 결과 페이지에서 cache miss + fresh 토큰 없음 케이스에 노출되는 만료 안내 카드.
 *
 * 결제 사고 차단 — 자동 API 호출 대신 사용자가 의도적으로 홈에서 다시 시작하도록 유도.
 */

import Link from 'next/link';
import { BackButton } from './ui/BackButton';

interface Props {
  /** 페이지 헤더에 표시할 카테고리명 — "정통사주", "오늘의 운세" 등 */
  serviceName: string;
}

export function ExpiredAnalysisCard({ serviceName }: Props) {
  return (
    <div className="min-h-screen px-4 pt-4 pb-12 max-w-[480px] mx-auto">
      <div className="flex items-center justify-between mb-6 px-1">
        <BackButton to="/" />
        <h1 className="text-lg font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
          {serviceName}
        </h1>
        <div className="w-9" />
      </div>

      <div className="rounded-2xl p-8 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] backdrop-blur-sm text-center">
        <h2 className="text-[17px] font-bold text-text-primary mb-2">결과가 만료됐어요</h2>
        <p className="text-[14px] text-text-secondary leading-relaxed mb-6">
          새 풀이를 받으시려면 홈에서 다시 카드를 눌러 주세요.<br />
          크레딧은 새로 풀이를 받을 때만 차감돼요.
        </p>

        <Link
          href="/"
          className="block w-full h-12 rounded-lg bg-gradient-to-r from-cta to-cta-active text-white font-bold text-[15px] flex items-center justify-center hover:opacity-90 transition-all"
        >
          홈으로 가기
        </Link>
      </div>
    </div>
  );
}
