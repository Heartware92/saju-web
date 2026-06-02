'use client';

/**
 * 문의하기 — 햄버거 메뉴 진입.
 * 유형 카드(환불/오류·버그/제안·피드백/기타) → 각 전용 페이지로 이동.
 * 하단에 내 문의 내역.
 *
 * UX 원칙:
 * - 이모지 0개. 텍스트 기반 + 좌측 4px CTA 띠로 카테고리 표시.
 * - 인라인 입력 폼 없음. 각 유형은 자체 페이지에서 작성.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUserStore } from '../../store/useUserStore';
import { supabase } from '../../services/supabase';
import Layout from '../../components/Layout';

type CategoryKey = 'payment' | 'bug' | 'account' | 'feedback' | 'other';

interface CategoryCard {
  key: CategoryKey;
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

// 내 문의 내역 표시용 라벨 — 과거에 쌓인 'account' 등 모든 키 커버.
const CATEGORY_LABEL: Record<CategoryKey, string> = {
  payment: '환불 문의',
  bug: '오류·버그',
  account: '계정·로그인',
  feedback: '제안·피드백',
  other: '기타',
};

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function InquiryPage() {
  const router = useRouter();
  const { user } = useUserStore();
  const userLoading = useUserStore((s) => s.loading);

  const [items, setItems] = useState<InquiryItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  // 비로그인 사용자는 로그인 페이지로 유도 — loading 끝난 후에만 판단 (hydration race 방지)
  useEffect(() => {
    if (!userLoading && user === null) {
      router.replace('/login?from=/inquiry');
    }
  }, [user, userLoading, router]);

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
        <section className="mb-7">
          <div className="space-y-2">
            {CATEGORY_CARDS.map((cat) => (
              <Link
                key={cat.key}
                href={cat.href}
                className="w-full text-left flex items-stretch rounded-xl overflow-hidden bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] hover:border-cta/40 transition-colors"
              >
                <span className="w-1 shrink-0 bg-transparent" />
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
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </section>

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
                            {CATEGORY_LABEL[it.category] ?? it.category}
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
      </div>
    </Layout>
  );
}
