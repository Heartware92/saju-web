import type { Metadata } from 'next';
import Link from 'next/link';
import Layout from '@/components/Layout';

export const metadata: Metadata = {
  title: '회사 정보 — 이천점',
  description: '(주)하트웨어 사업자·연락처·민원 처리 안내',
};

export default function CompanyPage() {
  return (
    <Layout>
      <div className="px-5 pt-3 pb-12">
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
          <Row label="사업장 주소" value="대구광역시 북구 옥산로 111, 5층 유니콘랩 대구 남서편 핫데스크 오피스(대구 귀환청년창업공간)" />
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

      {/* 약관·정책·copyright 는 햄버거 메뉴 하단에 상시 노출되므로 페이지 내 중복 제거 */}
      </div>
    </Layout>
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

