'use client';

/**
 * 환불 문의 — 토스페이먼츠 등 PG 심사 대응 + 사용자 환불 흐름 명확화.
 *
 * 사주키드 환불 폼 패턴 흡수 + 우리 단일 달 크레딧 / 7패키지 기준 재구성.
 * - 상단 정책 박스 5줄 (결제 후 7일·미사용·결제수단 환불·부분 환불·자동 차감)
 * - 결제 수단 라디오 (간편결제·카드 / 해외카드 / 계좌이체)
 * - 결제 금액 드롭다운 (7패키지)
 * - 결제 일자 (date input)
 * - 환불 사유 (선택, textarea)
 * - 제출 → /api/inquiries 에 category='payment' + content 구조화 텍스트로 저장
 *   어드민은 content 첫 줄 [환불 요청] 마커로 환불 케이스 식별.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUserStore } from '../../../store/useUserStore';
import { supabase } from '../../../services/supabase';
import Layout from '../../../components/Layout';
import { CREDIT_PACKAGES } from '../../../constants/pricing';

type PaymentMethod = 'simple_card' | 'foreign_card' | 'bank_transfer';

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  simple_card: '간편결제 / 국내 카드',
  foreign_card: '해외 카드',
  bank_transfer: '계좌이체',
};

function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  let local = d;
  if (d.startsWith('82')) local = '0' + d.slice(2);
  if (local.length === 11) return `${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  return raw;
}

export default function RefundInquiryPage() {
  const router = useRouter();
  const { user } = useUserStore();

  const [method, setMethod] = useState<PaymentMethod>('simple_card');
  const [packageId, setPackageId] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [reason, setReason] = useState('');
  const [memo, setMemo] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (user === null) {
      router.replace('/login?from=/inquiry/refund');
    }
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    setEmail((prev) => prev || user.email || '');
    const userPhone = (user as { phone?: string }).phone;
    if (userPhone) setPhone((prev) => prev || formatPhone(userPhone));
  }, [user]);

  const selectedPackage = useMemo(
    () => CREDIT_PACKAGES.find((p) => p.id === packageId) ?? null,
    [packageId],
  );

  const submit = async () => {
    setError('');
    setSuccessMsg('');
    if (!selectedPackage) {
      setError('환불 요청하실 결제 패키지를 선택해주세요.');
      return;
    }
    if (!purchaseDate) {
      setError('결제 일자를 입력해주세요.');
      return;
    }
    // 결제 일자 7일 초과 사전 안내 (서버는 별도 검증 X — 어드민이 최종 판단)
    const daysAgo = Math.floor(
      (Date.now() - new Date(purchaseDate).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysAgo > 7) {
      const ok = window.confirm(
        '결제일로부터 7일이 지난 결제는 청약철회 기간이 경과되어 환불이 어려울 수 있어요.\n\n그래도 문의를 접수하시겠어요?',
      );
      if (!ok) return;
    }

    const lines = [
      '[환불 요청]',
      `결제 수단: ${PAYMENT_METHOD_LABEL[method]}`,
      `결제 금액: ${selectedPackage.name} (${selectedPackage.price.toLocaleString()}원)`,
      `결제 일자: ${purchaseDate}`,
    ];
    if (reason.trim()) lines.push(`환불 사유: ${reason.trim()}`);
    if (memo.trim()) {
      lines.push('');
      lines.push('[추가 메모]');
      lines.push(memo.trim());
    }
    const content = lines.join('\n');

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        router.replace('/login?from=/inquiry/refund');
        return;
      }
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          category: 'payment',
          content,
          contact_phone: phone.trim() || undefined,
          contact_email: email.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? '환불 문의 접수에 실패했어요. 잠시 후 다시 시도해주세요.');
        return;
      }
      setSuccessMsg('환불 문의가 정상 접수되었어요. 영업일 기준 3일 이내에 처리해드릴게요.');
      // 입력 초기화
      setPackageId('');
      setPurchaseDate('');
      setReason('');
      setMemo('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="px-4 pt-4 pb-12">
        {/* 헤더 */}
        <div className="flex items-center justify-center relative mb-5 pt-3 px-1">
          <Link
            href="/inquiry"
            className="absolute left-0 text-text-secondary hover:text-text-primary"
            aria-label="문의하기로 돌아가기"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            환불 문의
          </h1>
        </div>

        {/* 환불 정책 박스 */}
        <div className="rounded-2xl p-4 mb-4 bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.35)]">
          <ul className="space-y-1.5 text-[13.5px] text-text-primary leading-relaxed">
            <li className="flex gap-2">
              <span className="text-amber-300/80">·</span>
              <span><strong className="text-amber-200">사용하지 않은 달 크레딧</strong>만 환불 가능합니다.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-300/80">·</span>
              <span>회원가입 보너스·이벤트 등 무료로 지급된 크레딧은 환불 대상이 아닙니다.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-300/80">·</span>
              <span>결제일로부터 <strong className="text-amber-200">7일 이내</strong>에 요청하셔야 환불이 가능합니다.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-300/80">·</span>
              <span>일부만 사용하셨다면 <strong className="text-amber-200">미사용 분에 대해 부분 환불</strong>도 가능합니다.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-300/80">·</span>
              <span>환불 시 결제하신 패키지의 달 크레딧은 잔액에서 차감됩니다.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-amber-300/80">·</span>
              <span>환불 처리는 결제 시 사용한 수단으로만 가능하며 영업일 기준 3일 이내에 완료됩니다.</span>
            </li>
          </ul>
        </div>

        {/* 폼 */}
        <div className="space-y-5 rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          {/* 결제 수단 */}
          <div>
            <label className="block text-[14px] font-semibold text-text-primary mb-2">
              결제 수단 <span className="text-red-400">*</span>
            </label>
            <div className="space-y-2">
              {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
                <label
                  key={m}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer"
                  style={{
                    background: method === m ? 'rgba(124,92,252,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${method === m ? 'var(--cta-primary)' : 'rgba(255,255,255,0.10)'}`,
                  }}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={m}
                    checked={method === m}
                    onChange={() => setMethod(m)}
                    className="accent-cta"
                  />
                  <span className="text-[13.5px] text-text-primary">{PAYMENT_METHOD_LABEL[m]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 결제 금액 (패키지) */}
          <div>
            <label className="block text-[14px] font-semibold text-text-primary mb-2">
              결제 금액 <span className="text-red-400">*</span>
            </label>
            <select
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[14px] text-text-primary"
            >
              <option value="">— 결제하신 패키지를 선택해주세요 —</option>
              {CREDIT_PACKAGES.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} ({pkg.price.toLocaleString()}원 · 달 {pkg.moonCredit}개)
                </option>
              ))}
            </select>
          </div>

          {/* 결제 일자 */}
          <div>
            <label className="block text-[14px] font-semibold text-text-primary mb-2">
              결제 일자 <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full px-3 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[14px] text-text-primary"
            />
            <p className="text-[11.5px] text-text-tertiary mt-1.5">결제일로부터 7일 이내여야 환불 가능합니다.</p>
          </div>

          {/* 환불 사유 */}
          <div>
            <label className="block text-[14px] font-semibold text-text-primary mb-2">
              환불 사유 <span className="text-text-tertiary text-[12px] font-normal">(선택)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 200))}
              placeholder="사유를 입력해주시면 서비스 개선에 큰 도움이 됩니다."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[13.5px] text-text-primary placeholder-text-tertiary resize-none"
            />
            <p className="text-[11px] text-text-tertiary mt-1 text-right">{reason.length} / 200</p>
          </div>

          {/* 추가 메모 */}
          <div>
            <label className="block text-[14px] font-semibold text-text-primary mb-2">
              추가 메모 <span className="text-text-tertiary text-[12px] font-normal">(선택)</span>
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value.slice(0, 1000))}
              placeholder="주문번호, 결제 화면 캡처 첨부 안내 등 추가 정보가 있다면 자유롭게 작성해주세요."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[13.5px] text-text-primary placeholder-text-tertiary resize-none"
            />
            <p className="text-[11px] text-text-tertiary mt-1 text-right">{memo.length} / 1000</p>
          </div>

          {/* 연락처 */}
          <div className="grid grid-cols-1 gap-3 pt-2 border-t border-[var(--border-subtle)]">
            <div>
              <label className="block text-[14px] font-semibold text-text-primary mb-2">
                휴대폰 번호 <span className="text-text-tertiary text-[12px] font-normal">(선택)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                autoComplete="tel"
                className="w-full px-3 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[14px] text-text-primary placeholder-text-tertiary"
              />
            </div>
            <div>
              <label className="block text-[14px] font-semibold text-text-primary mb-2">
                이메일 <span className="text-text-tertiary text-[12px] font-normal">(선택)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                autoComplete="email"
                className="w-full px-3 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[14px] text-text-primary placeholder-text-tertiary"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg px-3 py-2.5 bg-red-500/10 border border-red-500/40 text-[13px] text-red-200">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="rounded-lg px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/40 text-[13px] text-emerald-200">
              {successMsg}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="w-full py-3 rounded-xl font-bold text-[15px] transition-all"
            style={{
              background: submitting ? 'rgba(124,92,252,0.3)' : 'var(--cta-primary)',
              color: '#fff',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? '접수 중...' : '환불 문의 접수하기'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
