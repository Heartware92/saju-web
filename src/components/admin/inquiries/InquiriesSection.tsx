/**
 * 문의 관리 — 카테고리/상태 필터 + 답변 등록
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface Inquiry {
  id: string;
  user_id: string | null;
  userEmail: string;
  category: 'payment' | 'bug' | 'account' | 'feedback' | 'other';
  content: string;
  contact_phone: string | null;
  contact_email: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  admin_reply: string | null;
  admin_replied_at: string | null;
  created_at: string;
  updated_at: string;
}

interface StatusCounts {
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
}

const CATEGORY_LABEL: Record<string, string> = {
  payment: '결제',
  bug: '오류 신고',
  account: '계정',
  feedback: '피드백',
  other: '기타',
};

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  open:        { text: '신규',       cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  in_progress: { text: '처리 중',     cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  resolved:    { text: '답변 완료',   cls: 'bg-green-500/20 text-green-300 border-green-500/30' },
  closed:      { text: '종료',        cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

const fmtDate = (s: string | null) => s
  ? new Date(s).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '-';

export function InquiriesSection({ token }: { token: string | null }) {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [counts, setCounts] = useState<StatusCounts>({ open: 0, in_progress: 0, resolved: 0, closed: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'' | Inquiry['status']>('');
  const [category, setCategory] = useState<'' | Inquiry['category']>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Inquiry | null>(null);

  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), status, category, search });
      const res = await fetch(`/api/admin/inquiries?${params}`, { headers: { 'x-admin-key': token } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '실패');
      setItems(json.inquiries);
      setTotal(json.total);
      setCounts(json.statusCounts);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, page, status, category, search]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-5">
      {/* 상태 카운트 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CountCard label="신규" value={counts.open} active={status === 'open'} onClick={() => { setStatus(status === 'open' ? '' : 'open'); setPage(1); }} cls="text-blue-300" />
        <CountCard label="처리 중" value={counts.in_progress} active={status === 'in_progress'} onClick={() => { setStatus(status === 'in_progress' ? '' : 'in_progress'); setPage(1); }} cls="text-amber-300" />
        <CountCard label="답변 완료" value={counts.resolved} active={status === 'resolved'} onClick={() => { setStatus(status === 'resolved' ? '' : 'resolved'); setPage(1); }} cls="text-green-300" />
        <CountCard label="종료" value={counts.closed} active={status === 'closed'} onClick={() => { setStatus(status === 'closed' ? '' : 'closed'); setPage(1); }} cls="text-text-tertiary" />
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-2">
        <select
          value={category}
          onChange={e => { setCategory(e.target.value as any); setPage(1); }}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[13px]"
        >
          <option value="">전체 카테고리</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="이메일·내용·연락처 검색"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[13px]"
        />
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[13px] text-red-300">
          {error}
        </div>
      )}

      {/* 목록 */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-[13px]">
          <thead className="bg-white/3 text-[11px] text-text-tertiary uppercase">
            <tr>
              {['접수일', '카테고리', '회원', '내용', '연락처', '상태', '답변일'].map(h =>
                <th key={h} className="px-2.5 py-2 text-left font-medium">{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map(r => (
              <tr key={r.id} onClick={() => setDetail(r)} className="border-t border-white/5 hover:bg-white/5 cursor-pointer">
                <td className="px-2.5 py-2 text-text-tertiary whitespace-nowrap">{fmtDate(r.created_at)}</td>
                <td className="px-2.5 py-2 text-text-secondary whitespace-nowrap">{CATEGORY_LABEL[r.category]}</td>
                <td className="px-2.5 py-2 text-text-secondary max-w-[180px] truncate">{r.userEmail || '게스트'}</td>
                <td className="px-2.5 py-2 text-text-primary max-w-[280px] truncate">{r.content}</td>
                <td className="px-2.5 py-2 text-text-tertiary whitespace-nowrap">
                  {r.contact_phone ?? r.contact_email ?? '-'}
                </td>
                <td className="px-2.5 py-2 whitespace-nowrap">
                  <span className={`px-1.5 py-0.5 rounded-full text-[11px] border ${STATUS_LABEL[r.status].cls}`}>
                    {STATUS_LABEL[r.status].text}
                  </span>
                </td>
                <td className="px-2.5 py-2 text-text-tertiary whitespace-nowrap">{fmtDate(r.admin_replied_at)}</td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-text-tertiary">문의 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-1">
          {Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, page - 3), page + 2).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1.5 rounded-lg text-[13px] border ${p === page ? 'border-cta text-cta bg-cta/10' : 'border-white/15 text-text-tertiary hover:text-text-secondary'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {detail && (
        <InquiryDetailModal
          inquiry={detail}
          token={token}
          onClose={() => setDetail(null)}
          onUpdated={() => { setDetail(null); fetchList(); }}
        />
      )}
    </div>
  );
}

function CountCard({ label, value, active, onClick, cls }: { label: string; value: number; active: boolean; onClick: () => void; cls: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white/5 border rounded-xl p-4 transition-colors ${active ? 'border-cta' : 'border-white/10 hover:border-white/20'}`}
    >
      <p className="text-[13px] text-text-tertiary uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-[22px] font-bold tabular-nums ${cls}`}>{value.toLocaleString('ko-KR')}</p>
    </button>
  );
}

function InquiryDetailModal({ inquiry, token, onClose, onUpdated }: {
  inquiry: Inquiry; token: string | null; onClose: () => void; onUpdated: () => void;
}) {
  const [reply, setReply] = useState(inquiry.admin_reply ?? '');
  const [status, setStatus] = useState<Inquiry['status']>(inquiry.status);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async () => {
    if (!token) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch(`/api/admin/inquiries/${inquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': token },
        body: JSON.stringify({ status, admin_reply: reply }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '실패');
      onUpdated();
    } catch (e: any) { setMsg(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-primary border border-white/10 rounded-2xl max-w-[640px] w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-text-primary">문의 상세</h3>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">닫기</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <Row label="회원" value={inquiry.userEmail || '게스트'} />
          <Row label="카테고리" value={CATEGORY_LABEL[inquiry.category]} />
          <Row label="접수" value={fmtDate(inquiry.created_at)} />
          <Row label="연락처" value={inquiry.contact_phone ?? inquiry.contact_email ?? '-'} />

          <div>
            <p className="text-[12px] text-text-tertiary mb-1.5">문의 내용</p>
            <div className="px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-[13px] text-text-primary whitespace-pre-wrap">
              {inquiry.content}
            </div>
          </div>

          <div>
            <p className="text-[12px] text-text-tertiary mb-1.5">상태</p>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as Inquiry['status'])}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[13px]"
            >
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v.text}</option>)}
            </select>
          </div>

          <div>
            <p className="text-[12px] text-text-tertiary mb-1.5">관리자 답변</p>
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              rows={5}
              placeholder="답변 입력 (저장 시 상태가 자동으로 답변 완료로 전환됩니다)"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[13px] text-text-primary"
            />
          </div>

          {msg && (
            <p className="text-[13px] text-red-300">{msg}</p>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-white/15 text-[13px] text-text-secondary">취소</button>
            <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-lg bg-cta text-white text-[13px] font-medium disabled:opacity-40">
              {busy ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] items-baseline gap-3">
      <span className="text-[12px] text-text-tertiary">{label}</span>
      <span className="text-[13px] text-text-primary">{value}</span>
    </div>
  );
}
