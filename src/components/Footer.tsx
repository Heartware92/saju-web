'use client';

/**
 * 사이트 푸터 — PG사 환금성 업종 입점 조건 충족용
 *
 * KG이니시스 요구사항:
 *  - 민원 책임 고지 ("모든 거래에 대한 책임과 환불, 민원 등은 [상호명]에서 진행")
 *  - 민원 담당자 이름 + 연락처 명시
 *  - 사업자 기본 정보 (상호·대표·사업자번호·통신판매업 신고번호)
 *
 * 현재 일부 정보(사업자등록번호·통신판매업 신고번호·연락처)는 [추후 기재] 상태.
 * 사업자 등록·통신판매업 신고 완료 시 해당 값 채우면 됨.
 */

import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-12 pt-6 pb-8 px-4 border-t border-[var(--border-subtle)] bg-[rgba(20,12,38,0.55)]">
      <div className="max-w-[480px] mx-auto space-y-4 text-[12px] text-text-tertiary leading-relaxed">
        {/* 사업자 정보 */}
        <div className="space-y-1">
          <p className="text-text-secondary font-medium">(주)하트웨어</p>
          <p>대표자: 허진우 · 사업자등록번호: [추후 기재]</p>
          <p>통신판매업 신고번호: [추후 기재]</p>
          <p>주소: [추후 기재]</p>
          <p>고객센터: [추후 기재] · 이메일: heojinwoo@heartware.co.kr</p>
        </div>

        {/* 민원 책임 고지 — KG이니시스 환금성 업종 입점 필수 문구 */}
        <div className="pt-3 border-t border-[var(--border-subtle)] space-y-1">
          <p className="text-text-secondary">
            본 서비스의 모든 거래에 대한 책임과 환불, 민원 등은 <strong className="text-text-primary">(주)하트웨어</strong>에서 진행합니다.
          </p>
          <p>
            민원 담당자: 허진우 (대표자 겸임) · heojinwoo@heartware.co.kr · 연락처 [추후 기재]
          </p>
        </div>

        {/* 정책 링크 */}
        <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap gap-x-3 gap-y-1">
          <Link href="/terms" className="hover:text-text-secondary transition-colors">
            이용약관
          </Link>
          <span className="text-text-tertiary/40">·</span>
          <Link href="/privacy" className="hover:text-text-secondary transition-colors">
            개인정보처리방침
          </Link>
          <span className="text-text-tertiary/40">·</span>
          <Link href="/licenses" className="hover:text-text-secondary transition-colors">
            오픈소스 라이선스
          </Link>
        </div>

        {/* Copyright */}
        <p className="text-[11px] text-text-tertiary/60 pt-2">
          © {new Date().getFullYear()} (주)하트웨어. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
