import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '회사 정보 — 이천점',
  description: '(주)하트웨어 사업자·연락처·민원 처리 안내',
};

export default function CompanyPage() {
  return (
    <div className="min-h-[100dvh] px-5 pt-3 pb-12">
      {/* 헤더 */}
      <div className="flex items-center relative mb-6 pt-3 px-1">
        <Link
          href="/"
          aria-label="뒤로"
          className="absolute left-0 w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            회사 정보
          </h1>
        </div>
        <div className="w-9" />
      </div>

      {/* 사업자 정보 */}
      <section className="rounded-2xl px-5 py-5 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <h2 className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wider mb-4">
          사업자
        </h2>
        <dl className="space-y-3 text-[14px]">
          <Row label="상호" value="(주)하트웨어" />
          <Row label="대표자" value="허진우" />
          <Row label="사업자등록번호" value="136-88-03376" />
          <Row label="통신판매업 신고" value="2026-대구북구-0028" />
          <Row label="주소" value="대구광역시 북구 동북로 117" />
        </dl>
      </section>

      {/* 고객센터 */}
      <section className="rounded-2xl px-5 py-5 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <h2 className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wider mb-4">
          고객센터
        </h2>
        <dl className="space-y-3 text-[14px]">
          <Row
            label="전화"
            value={
              <a href="tel:01059600920" className="text-cta hover:underline">
                010-5960-0920
              </a>
            }
          />
          <Row
            label="이메일"
            value={
              <a href="mailto:heojinwoo@heartware.co.kr" className="text-cta hover:underline break-all">
                heojinwoo@heartware.co.kr
              </a>
            }
          />
          <Row label="운영 시간" value="평일 10:00 ~ 18:00 (점심 12:00 ~ 13:00, 주말·공휴일 휴무)" />
        </dl>
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
          <Link
            href="/inquiry"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-cta hover:underline"
          >
            앱에서 직접 문의하기
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* 책임 / 환불 / 민원 고지 */}
      <section className="rounded-2xl px-5 py-5 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <h2 className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wider mb-4">
          책임 · 환불 · 민원
        </h2>
        <p className="text-[14px] text-text-secondary leading-relaxed mb-4">
          본 서비스의 모든 거래에 대한 책임과 환불, 민원 처리는{' '}
          <span className="text-text-primary font-semibold">(주)하트웨어</span>에서 진행합니다.
        </p>
        <dl className="space-y-3 text-[14px]">
          <Row label="민원 담당자" value="허진우 (대표자 겸임)" />
          <Row
            label="민원 연락처"
            value={
              <a href="tel:01059600920" className="text-cta hover:underline">
                010-5960-0920
              </a>
            }
          />
          <Row
            label="민원 이메일"
            value={
              <a href="mailto:heojinwoo@heartware.co.kr" className="text-cta hover:underline break-all">
                heojinwoo@heartware.co.kr
              </a>
            }
          />
        </dl>
      </section>

      {/* 약관 링크 */}
      <section className="rounded-2xl px-5 py-5 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <h2 className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wider mb-4">
          정책 · 약관
        </h2>
        <div className="flex flex-col gap-2">
          <LinkRow href="/terms" label="이용약관" />
          <LinkRow href="/privacy" label="개인정보처리방침" />
          <LinkRow href="/licenses" label="오픈소스 라이선스" />
        </div>
      </section>

      {/* Copyright */}
      <p className="text-center text-[11px] text-text-tertiary mt-6">
        &copy; 2026 이천점. All rights reserved.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="shrink-0 w-[100px] text-[13px] text-text-tertiary">{label}</dt>
      <dd className="flex-1 text-text-primary break-words">{value}</dd>
    </div>
  );
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between px-3 py-3 -mx-3 rounded-lg text-[14px] text-text-secondary hover:text-text-primary hover:bg-white/[0.03] transition-colors"
    >
      <span>{label}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}
