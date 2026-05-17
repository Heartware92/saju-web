'use client';

/**
 * 문의하기 — 햄버거 메뉴 진입.
 * 5 카테고리 카드 → 본문/연락처 폼 → 제출 → 내 문의 내역 갱신.
 *
 * UX 원칙:
 * - 이모지 0개. 텍스트 기반 + 좌측 4px CTA 띠로 카테고리 표시.
 * - 휴대폰·이메일은 가입 시점 값을 디폴트로 채움 (수정 가능).
 * - 한 페이지 안에 카테고리 선택 + 폼 + 내 내역 모두.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUserStore } from '../../store/useUserStore';
import { supabase } from '../../services/supabase';
import Layout from '../../components/Layout';

type CategoryKey = 'payment' | 'bug' | 'account' | 'feedback' | 'other';

interface CategoryInfo {
  key: CategoryKey;
  label: string;
  desc: string;
  placeholder: string;
}

const CATEGORIES: CategoryInfo[] = [
  {
    key: 'payment',
    label: '환불 문의',
    desc: '결제 후 7일 이내 미사용 크레딧 환불 요청',
    placeholder: '', // 클릭 즉시 /inquiry/refund 로 라우팅, textarea 미사용
  },
  {
    key: 'bug',
    label: '오류·버그',
    desc: '풀이가 안 나옴, 화면이 깨짐, 잘못된 결과',
    placeholder: '예: 신년운세를 받았는데 5번 항목부터 글자가 깨져 보여요. 사용 중인 기기는…',
  },
  {
    key: 'account',
    label: '계정·로그인',
    desc: '소셜 로그인 실패, 비밀번호 재설정, 회원 탈퇴',
    placeholder: '예: 카카오 로그인 누르면 다음 화면으로 안 넘어가요. 어제부터 발생합니다.',
  },
  {
    key: 'feedback',
    label: '제안·피드백',
    desc: '서비스 개선 의견, 새 기능 제안, 사용 후기',
    placeholder: '예: 실시간 운세 결과를 친구에게 카톡으로 공유할 수 있으면 좋겠어요.',
  },
  {
    key: 'other',
    label: '기타',
    desc: '위 분류에 해당하지 않는 모든 문의',
    placeholder: '문의 내용을 자유롭게 작성해주세요.',
  },
];

interface InquiryItem {
  id: string;
  category: CategoryKey;
  content: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  admin_reply: string | null;
  admin_replied_at: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<InquiryItem['status'], { text: string; cls: string }> = {
  open: { text: '접수', cls: 'bg-amber-500/15 border-amber-500/40 text-amber-200' },
  in_progress: { text: '확인 중', cls: 'bg-sky-500/15 border-sky-500/40 text-sky-200' },
  resolved: { text: '답변 완료', cls: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200' },
  closed: { text: '종료', cls: 'bg-white/8 border-white/15 text-text-tertiary' },
};

function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  // 국제 표기 (+8210...) 또는 010... 모두 받아 010-xxxx-xxxx 로
  const d = raw.replace(/\D/g, '');
  let local = d;
  if (d.startsWith('82')) local = '0' + d.slice(2);
  if (local.length === 11) return `${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  return raw;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function InquiryPage() {
  const router = useRouter();
  const { user } = useUserStore();

  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
  const [content, setContent] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [items, setItems] = useState<InquiryItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  // 가입 시점 값 디폴트 — user.phone 우선, 없으면 user_metadata.phone
  useEffect(() => {
    if (!user) return;
    const meta = (user.user_metadata ?? {}) as { phone?: string };
    setPhone((prev) => prev || formatPhone(user.phone ?? meta.phone ?? ''));
    setEmail((prev) => prev || (user.email ?? ''));
  }, [user]);

  // 비로그인 사용자는 로그인 페이지로 유도
  useEffect(() => {
    if (user === null) {
      router.replace('/login?from=/inquiry');
    }
  }, [user, router]);

  const loadInquiries = useCallback(async () => {
    setListLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        setItems([]);
        return;
      }
      const res = await fetch('/api/inquiries', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) setItems(json.items ?? []);
    } catch {
      /* ignore */
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadInquiries();
  }, [user, loadInquiries]);

  const selected = useMemo(
    () => CATEGORIES.find((c) => c.key === selectedCategory) ?? null,
    [selectedCategory],
  );

  const submit = async () => {
    setError('');
    setSuccessMsg('');
    if (!selectedCategory) {
      setError('문의 유형을 선택해주세요.');
      return;
    }
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
        router.replace('/login?from=/inquiry');
        return;
      }
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          category: selectedCategory,
          content: trimmed,
          contact_phone: phone.trim() || undefined,
          contact_email: email.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? '문의 저장에 실패했어요. 잠시 후 다시 시도해주세요.');
        return;
      }
      setSuccessMsg('문의가 정상 접수되었어요. 답변까지 1~2 영업일 정도 소요될 수 있어요.');
      setContent('');
      setSelectedCategory(null);
      loadInquiries();
    } finally {
      setSubmitting(false);
    }
  };

  const toggleOpen = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
            문의하기
          </h1>
        </div>
        <div className="w-9" />
      </div>

      {/* 안내 */}
      <p className="text-[13px] text-text-tertiary leading-relaxed mb-5 px-1">
        결제·계정·오류 등 어떤 문의든 편하게 남겨주세요. 평일 기준 1~2 영업일 안에 답변드려요.
      </p>

      {/* 카테고리 선택 */}
      <section className="mb-5">
        <h2 className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wider mb-3 px-1">
          1. 문의 유형
        </h2>
        <div className="space-y-2">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => {
                  // 환불 문의는 전용 페이지로 즉시 라우팅 — 카테고리 선택·본문 폼 안 거침
                  if (cat.key === 'payment') {
                    router.push('/inquiry/refund');
                    return;
                  }
                  setSelectedCategory(cat.key);
                  setError('');
                  setSuccessMsg('');
                }}
                className="w-full text-left flex items-stretch rounded-xl overflow-hidden bg-[rgba(20,12,38,0.55)] border transition-colors"
                style={{
                  borderColor: isSelected ? 'var(--cta-primary)' : 'var(--border-subtle)',
                  background: isSelected ? 'rgba(139,92,246,0.10)' : undefined,
                }}
              >
                <span
                  className="w-1 shrink-0"
                  style={{ background: isSelected ? 'var(--cta-primary)' : 'transparent' }}
                />
                <span className="flex-1 px-4 py-3">
                  <span className="block text-[15px] font-semibold text-text-primary">
                    {cat.label}
                  </span>
                  <span className="block text-[12.5px] text-text-tertiary mt-0.5 leading-snug">
                    {cat.desc}
                  </span>
                </span>
                <span className="self-center pr-4 text-text-tertiary">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d={isSelected ? 'M5 12l5 5L20 7' : 'M9 18l6-6-6-6'} />
                  </svg>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 본문 + 연락처 — 카테고리 선택해야 노출 */}
      {selected && (
        <section className="mb-5">
          <h2 className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wider mb-3 px-1">
            2. 문의 내용
          </h2>

          <div className="rounded-2xl px-5 py-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] space-y-4">
            {/* 본문 */}
            <div>
              <label className="block text-[13px] font-medium text-text-secondary mb-2">
                내용 <span className="text-status-error">*</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={selected.placeholder}
                rows={6}
                maxLength={2000}
                className="w-full px-3 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[14px] text-text-primary placeholder:text-text-tertiary resize-y leading-relaxed focus:outline-none focus:border-cta/60"
              />
              <p className="text-[11px] text-text-tertiary mt-1 text-right">
                {content.length} / 2000
              </p>
            </div>

            {/* 연락처 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-2">
                  휴대폰
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-1234-5678"
                  className="w-full px-3 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[14px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-cta/60"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-2">
                  이메일
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full px-3 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[14px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-cta/60"
                />
              </div>
            </div>
            <p className="text-[11px] text-text-tertiary">
              답변을 받을 연락처입니다. 가입 시 입력한 정보가 기본값으로 채워졌어요. 필요하면 수정해주세요.
            </p>

            {/* 에러 / 성공 메시지 */}
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

            {/* 제출 */}
            <button
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
        </section>
      )}

      {/* 내 문의 내역 */}
      <section>
        <h2 className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wider mb-3 px-1">
          내 문의 내역
        </h2>
        {listLoading ? (
          <p className="text-[13px] text-text-tertiary px-1">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="text-[13px] text-text-tertiary px-1">아직 문의 내역이 없어요.</p>
        ) : (
          <div className="space-y-2">
            {items.map((it) => {
              const cat = CATEGORIES.find((c) => c.key === it.category);
              const s = STATUS_LABEL[it.status];
              const open = openIds.has(it.id);
              return (
                <div
                  key={it.id}
                  className="rounded-xl bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] overflow-hidden"
                >
                  <button
                    onClick={() => toggleOpen(it.id)}
                    className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-semibold text-text-primary">
                          {cat?.label ?? it.category}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded-full border text-[11px] font-medium ${s.cls}`}
                        >
                          {s.text}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-text-tertiary line-clamp-1">
                        {it.content}
                      </p>
                      <p className="text-[11px] text-text-tertiary/80 mt-1">
                        {formatDate(it.created_at)}
                      </p>
                    </div>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      className="text-text-tertiary mt-1 shrink-0"
                      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {open && (
                    <div className="border-t border-[var(--border-subtle)] px-4 py-3 bg-white/[0.02]">
                      <p className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-line">
                        {it.content}
                      </p>
                      {it.admin_reply && (
                        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                          <p className="text-[11px] font-semibold text-cta mb-1.5">관리자 답변</p>
                          <p className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-line">
                            {it.admin_reply}
                          </p>
                          {it.admin_replied_at && (
                            <p className="text-[11px] text-text-tertiary mt-1.5">
                              {formatDate(it.admin_replied_at)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 회사정보 진입 안내 */}
      <p className="text-center text-[12px] text-text-tertiary mt-8">
        고객센터 운영 시간·이메일은{' '}
        <Link href="/company" className="text-cta hover:underline">
          회사 정보
        </Link>
        에서 확인하실 수 있어요.
      </p>
      </div>
    </Layout>
  );
}
