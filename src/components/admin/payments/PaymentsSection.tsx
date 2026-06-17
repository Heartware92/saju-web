'use client';

// 결제내역 + 환불 — 시스템 탭. 주문 목록 조회 후 완료 주문을 관리자가 직접 환불(PG 취소 + 크레딧 회수).
import { useCallback, useEffect, useState } from 'react';

interface OrderRow {
  id: string;
  user_id: string;
  userEmail: string;
  package_name: string;
  amount: number;
  status: string;
  payment_method: string;
  moon_credit_amount: number;
  created_at: string;
  completed_at: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  completed: '완료', pending: '대기', failed: '실패', refunded: '환불', cancelled: '취소',
};
const STATUS_COLOR: Record<string, string> = {
  completed: 'text-emerald-300', refunded: 'text-red-300', failed: 'text-red-400',
  pending: 'text-amber-300', cancelled: 'text-text-tertiary',
};
const PAY_LABEL: Record<string, string> = {
  tosspay: '토스페이', tosspayments: '토스페이먼츠', inicis: '이니시스', card: '카드',
};
const won = (n: number) => `₩${(n ?? 0).toLocaleString()}`;
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '-');

export function PaymentsSection({ token }: { token: string | null }) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '30', search, status });
      const res = await fetch(`/api/admin/orders?${params}`, { headers: { 'x-admin-key': token } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '조회 실패');
      setOrders(json.orders ?? []);
      setTotal(json.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : '조회 중 오류');
    } finally {
      setLoading(false);
    }
  }, [token, page, search, status]);

  useEffect(() => { void fetchOrders(); }, [fetchOrders]);

  const handleRefund = async (o: OrderRow) => {
    if (!token) return;
    const reason = window.prompt(
      `[환불] ${o.userEmail}\n${o.package_name} · ${won(o.amount)} (${PAY_LABEL[o.payment_method] ?? o.payment_method})\n\nPG 취소 + 지급 크레딧(달 ${o.moon_credit_amount}) 회수가 진행됩니다. 환불 사유를 입력하세요.`,
      '관리자 환불',
    );
    if (reason === null) return; // 취소
    setRefundingId(o.id);
    setNotice('');
    setError('');
    try {
      const res = await fetch(`/api/admin/orders/${o.id}/refund`, {
        method: 'POST',
        headers: { 'x-admin-key': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.detail ? `${json.error} — ${json.detail}` : (json.error ?? '환불 실패'));
      }
      setNotice(json.deduplicated ? '이미 환불된 주문이에요.' : '환불 완료(PG 취소 + 크레딧 회수).');
      await fetchOrders();
    } catch (e) {
      setError(e instanceof Error ? e.message : '환불 중 오류');
    } finally {
      setRefundingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 30));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-text-primary">결제내역</h2>
        <p className="text-[13px] text-text-tertiary mt-0.5">완료 주문을 직접 환불(PG 취소 + 크레딧 회수)할 수 있어요. 미사용 여부와 무관하게 처리됩니다.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); void fetchOrders(); } }}
          placeholder="이메일·주문ID 검색"
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[14px] text-text-primary placeholder-text-tertiary focus:border-cta/50 focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[14px] text-text-primary"
        >
          <option value="">전체 상태</option>
          <option value="completed">완료</option>
          <option value="refunded">환불</option>
          <option value="pending">대기</option>
          <option value="failed">실패</option>
        </select>
        <button onClick={() => { setPage(1); void fetchOrders(); }} className="px-3 py-2 rounded-lg bg-cta/15 border border-cta/40 text-cta text-[14px] font-semibold">조회</button>
      </div>

      {notice && <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[13px] text-emerald-300">{notice}</div>}
      {error && <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[13px] text-red-400">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-text-tertiary border-b border-white/10 bg-white/[0.03]">
              <th className="text-left font-semibold px-3 py-2.5">결제일</th>
              <th className="text-left font-semibold px-3 py-2.5">이메일</th>
              <th className="text-left font-semibold px-3 py-2.5">패키지</th>
              <th className="text-right font-semibold px-3 py-2.5">금액</th>
              <th className="text-left font-semibold px-3 py-2.5">수단</th>
              <th className="text-left font-semibold px-3 py-2.5">상태</th>
              <th className="text-right font-semibold px-3 py-2.5">환불</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                <td className="px-3 py-2.5 text-text-tertiary whitespace-nowrap">{fmtDate(o.completed_at ?? o.created_at)}</td>
                <td className="px-3 py-2.5 text-text-secondary max-w-[180px] truncate" title={o.userEmail}>{o.userEmail}</td>
                <td className="px-3 py-2.5 text-text-primary">{o.package_name}</td>
                <td className="px-3 py-2.5 text-right text-text-primary whitespace-nowrap">{won(o.amount)}</td>
                <td className="px-3 py-2.5 text-text-tertiary whitespace-nowrap">{PAY_LABEL[o.payment_method] ?? o.payment_method ?? '-'}</td>
                <td className={`px-3 py-2.5 whitespace-nowrap font-semibold ${STATUS_COLOR[o.status] ?? 'text-text-secondary'}`}>{STATUS_LABEL[o.status] ?? o.status}</td>
                <td className="px-3 py-2.5 text-right">
                  {o.status === 'completed' ? (
                    <button
                      onClick={() => handleRefund(o)}
                      disabled={refundingId === o.id}
                      className="px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-[12px] font-semibold hover:bg-red-500/25 disabled:opacity-40"
                    >
                      {refundingId === o.id ? '처리 중…' : '환불'}
                    </button>
                  ) : (
                    <span className="text-text-tertiary/50 text-[12px]">-</span>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-text-tertiary">결제내역이 없어요.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[12px] text-text-tertiary">총 {total.toLocaleString()}건 · {page}/{totalPages}p</span>
        <div className="flex gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[13px] disabled:opacity-30">이전</button>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[13px] disabled:opacity-30">다음</button>
        </div>
      </div>
    </div>
  );
}
