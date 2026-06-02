'use client';

/**
 * 일반 문의 공통 폼 — 오류·버그 / 제안·피드백 / 기타 페이지에서 재사용.
 *
 * - 로그인 기반: 연락처(휴대폰·이메일)를 따로 받지 않는다.
 *   답변 알림은 계정 정보로 발송되고, "내 문의 내역"에서도 확인 가능.
 * - 환불 문의는 별도 페이지(/inquiry/refund)에서 처리하므로 여기 포함하지 않는다.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/useUserStore';
import { supabase } from '@/services/supabase';
import Layout from '@/components/Layout';

interface GeneralInquiryFormProps {
  category: 'bug' | 'feedback' | 'other';
  title: string;
  intro: string;
  placeholder: string;
}

export default function GeneralInquiryForm({
  category,
  title,
  intro,
  placeholder,
}: GeneralInquiryFormProps) {
  const router = useRouter();
  const { user } = useUserStore();
  const userLoading = useUserStore((s) => s.loading);

  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // loading 끝난 후에만 비로그인 판단 (Supabase 세션 hydration race 방지)
  useEffect(() => {
    if (!userLoading && user === null) {
      router.replace(`/login?from=/inquiry/${category}`);
    }
  }, [user, userLoading, router, category]);

  const submit = async () => {
    setError('');
    setSuccessMsg('');
    const trimmed = content.trim();
    if (trimmed.length < 5) {
      setError('내용을 5자 이상 입력해주세요.');
      return;
    }
    if (trimmed.length > 2000) {
      setError('내용은 2000자 이내로 작성해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        router.replace(`/login?from=/inquiry/${category}`);
        return;
      }
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category, content: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? '문의 저장에 실패했어요. 잠시 후 다시 시도해주세요.');
        return;
      }
      setSuccessMsg('문의가 정상 접수되었어요. 답변은 문의하기의 "내 문의 내역"에서 확인하실 수 있어요.');
      setContent('');
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
            {title}
          </h1>
        </div>

        <p className="text-[13px] text-text-tertiary leading-relaxed mb-4 px-1">{intro}</p>

        <div className="space-y-4 rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <div>
            <label className="block text-[13px] font-medium text-text-secondary mb-2">
              내용 <span className="text-status-error">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={placeholder}
              rows={7}
              maxLength={2000}
              className="w-full px-3 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[14px] text-text-primary placeholder:text-text-tertiary resize-y leading-relaxed focus:outline-none focus:border-cta/60"
            />
            <p className="text-[11px] text-text-tertiary mt-1 text-right">{content.length} / 2000</p>
          </div>

          <p className="text-[11.5px] text-text-tertiary leading-relaxed">
            답변은 로그인하신 계정으로 안내되며, 문의하기의 &ldquo;내 문의 내역&rdquo;에서도 확인하실 수 있어요.
          </p>

          {error && (
            <div className="rounded-lg bg-status-error/10 border border-status-error/30 px-3 py-2 text-[13px] text-status-error">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-[13px] text-emerald-300">
              {successMsg}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={submitting || content.trim().length < 5}
            className="w-full py-3.5 rounded-xl font-bold text-[15px] text-white transition-opacity"
            style={{
              background: 'linear-gradient(135deg, var(--cta-primary), var(--cta-secondary, var(--cta-primary)))',
              opacity: submitting || content.trim().length < 5 ? 0.45 : 1,
              cursor: submitting || content.trim().length < 5 ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 18px rgba(139,92,246,0.25)',
            }}
          >
            {submitting ? '접수 중…' : '문의 보내기'}
          </button>
        </div>

        {successMsg && (
          <div className="text-center mt-5">
            <Link href="/inquiry" className="text-[13px] text-cta hover:underline">
              내 문의 내역 보기
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
