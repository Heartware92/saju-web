'use client';

/**
 * 내 문의 내역 — 본인이 남긴 문의 목록.
 * 항목 클릭 시 내용 + 첨부 사진 + 관리자 답변 표시.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUserStore } from '../../../store/useUserStore';
import { supabase } from '../../../services/supabase';
import Layout from '../../../components/Layout';

type CategoryKey = 'payment' | 'bug' | 'account' | 'feedback' | 'other';

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
  attachmentUrls?: string[];
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

export default function InquiryHistoryPage() {
  const router = useRouter();
  const { user } = useUserStore();
  const userLoading = useUserStore((s) => s.loading);

  const [items, setItems] = useState<InquiryItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [viewer, setViewer] = useState<{ url: string; index: number } | null>(null);
  const [downloading, setDownloading] = useState(false);

  // 뷰어 열렸을 때 Esc로 닫기 + 바디 스크롤 잠금
  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setViewer(null); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [viewer]);

  const downloadImage = async (url: string, index: number) => {
    setDownloading(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `문의사진-${index + 1}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      window.open(url, '_blank'); // 폴백: 다운로드 실패 시 새 탭
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (!userLoading && user === null) {
      router.replace('/login?from=/inquiry/history');
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
            href="/inquiry"
            aria-label="문의하기로 돌아가기"
            className="absolute left-0 w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            내 문의 내역
          </h1>
        </div>

        {listLoading ? (
          <p className="text-[13px] text-text-tertiary px-1">불러오는 중…</p>
        ) : items.length === 0 ? (
          <div className="text-center mt-10">
            <p className="text-[13px] text-text-tertiary mb-4">아직 문의 내역이 없어요.</p>
            <Link href="/inquiry" className="text-[13px] text-cta hover:underline">문의하러 가기</Link>
          </div>
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
                        <span className={`px-1.5 py-0.5 rounded-full border text-[11px] font-medium ${s.cls}`}>
                          {s.text}
                        </span>
                        {it.attachmentUrls && it.attachmentUrls.length > 0 && (
                          <span className="text-[11px] text-text-tertiary">사진 {it.attachmentUrls.length}</span>
                        )}
                      </div>
                      <p className="text-[12.5px] text-text-tertiary line-clamp-1">{it.content}</p>
                      <p className="text-[11px] text-text-tertiary/80 mt-1">{formatDate(it.created_at)}</p>
                    </div>
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.5" strokeLinecap="round"
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

                      {it.attachmentUrls && it.attachmentUrls.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {it.attachmentUrls.map((url, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setViewer({ url, index: i })}
                              className="block w-24 h-24 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-black/20"
                              aria-label={`첨부 ${i + 1} 크게 보기`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={`첨부 ${i + 1}`} className="w-full h-full object-cover hover:opacity-80 transition-opacity" />
                            </button>
                          ))}
                        </div>
                      )}

                      {it.admin_reply && (
                        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                          <p className="text-[11px] font-semibold text-cta mb-1.5">관리자 답변</p>
                          <p className="text-[13px] text-text-secondary leading-relaxed whitespace-pre-line">
                            {it.admin_reply}
                          </p>
                          {it.admin_replied_at && (
                            <p className="text-[11px] text-text-tertiary mt-1.5">{formatDate(it.admin_replied_at)}</p>
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
      </div>

      {/* 사진 뷰어 (라이트박스) */}
      {viewer && (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          onClick={() => setViewer(null)}
        >
          <div className="relative max-w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewer.url}
              alt={`첨부 ${viewer.index + 1}`}
              className="max-w-full max-h-[72vh] object-contain rounded-lg"
            />
          </div>

          <div className="flex gap-2.5 mt-5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => downloadImage(viewer.url, viewer.index)}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cta text-white text-[13px] font-semibold disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {downloading ? '다운로드 중…' : '다운로드'}
            </button>
            <button
              type="button"
              onClick={() => setViewer(null)}
              className="px-4 py-2.5 rounded-xl border border-white/25 text-white/90 text-[13px] font-medium hover:bg-white/10"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
