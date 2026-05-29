/**
 * 잡 상태 모니터 — saju_records / tarot_records 의 진행 중·실패 잡
 */
'use client';

import { useCallback, useEffect, useState } from 'react';

interface UnifiedJob {
  kind: 'saju' | 'tarot';
  id: string;
  user_id: string;
  userEmail: string;
  status: string;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  detail: string;
  credit_used: number;
}

interface Counts {
  saju: { pending: number; processing: number; failed: number };
  tarot: { pending: number; processing: number; failed: number };
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  pending:    { text: '대기',     cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  processing: { text: '처리 중',  cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  failed:     { text: '실패',     cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

const fmtDate = (s: string | null) => s
  ? new Date(s).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '-';

const fmtDuration = (start: string | null, end: string | null) => {
  if (!start) return '-';
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const sec = Math.floor((e - s) / 1000);
  if (sec < 60) return `${sec}초`;
  return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
};

export function JobsSection({ token, onOpenUser }: { token: string | null; onOpenUser: (id: string) => void }) {
  const [items, setItems] = useState<UnifiedJob[]>([]);
  const [counts, setCounts] = useState<Counts>({
    saju: { pending: 0, processing: 0, failed: 0 },
    tarot: { pending: 0, processing: 0, failed: 0 },
  });
  const [statusFilter, setStatusFilter] = useState<'all-stuck' | 'pending' | 'processing' | 'failed'>('all-stuck');
  const [typeFilter, setTypeFilter] = useState<'' | 'saju' | 'tarot'>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: '1', status: statusFilter, type: typeFilter });
      const res = await fetch(`/api/admin/jobs?${params}`, { headers: { 'x-admin-key': token } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '실패');
      setItems(json.jobs);
      setCounts(json.counts);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, statusFilter, typeFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const totalStuck =
    counts.saju.pending + counts.saju.processing + counts.saju.failed +
    counts.tarot.pending + counts.tarot.processing + counts.tarot.failed;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[14px] font-semibold text-text-primary">잡 상태 모니터</h3>
        <p className="text-[12px] text-text-tertiary">
          {totalStuck > 0 ? <span className="text-amber-300">전체 미완료 {totalStuck}건</span> : '모두 정상'}
        </p>
      </div>

      {/* 카운트 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <CountCard label="사주 대기"     value={counts.saju.pending}     cls="text-text-secondary" />
        <CountCard label="사주 처리 중"  value={counts.saju.processing}  cls="text-blue-300" />
        <CountCard label="사주 실패"     value={counts.saju.failed}      cls="text-red-300" />
        <CountCard label="타로 대기"     value={counts.tarot.pending}    cls="text-text-secondary" />
        <CountCard label="타로 처리 중"  value={counts.tarot.processing} cls="text-blue-300" />
        <CountCard label="타로 실패"     value={counts.tarot.failed}     cls="text-red-300" />
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[13px]"
        >
          <option value="all-stuck">전체 미완료</option>
          <option value="pending">대기만</option>
          <option value="processing">처리 중만</option>
          <option value="failed">실패만</option>
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[13px]"
        >
          <option value="">사주 + 타로</option>
          <option value="saju">사주만</option>
          <option value="tarot">타로만</option>
        </select>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[13px] text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-[13px]">
          <thead className="bg-white/3 text-[11px] text-text-tertiary uppercase">
            <tr>
              {['생성', '종류', '상세', '회원', '상태', '경과', '오류', '달'].map(h =>
                <th key={h} className="px-2.5 py-2 text-left font-medium">{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map(r => {
              const s = STATUS_LABEL[r.status] ?? { text: r.status, cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
              return (
                <tr key={`${r.kind}-${r.id}`} className="border-t border-white/5 hover:bg-white/3">
                  <td className="px-2.5 py-2 text-text-tertiary whitespace-nowrap">{fmtDate(r.created_at)}</td>
                  <td className="px-2.5 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] border ${r.kind === 'saju' ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' : 'bg-pink-500/15 text-pink-300 border-pink-500/30'}`}>
                      {r.kind === 'saju' ? '사주' : '타로'}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-text-primary truncate max-w-[140px]">{r.detail}</td>
                  <td className="px-2.5 py-2">
                    <button onClick={() => onOpenUser(r.user_id)} className="text-cta hover:underline truncate max-w-[180px] inline-block">
                      {r.userEmail || r.user_id}
                    </button>
                  </td>
                  <td className="px-2.5 py-2 whitespace-nowrap">
                    <span className={`px-1.5 py-0.5 rounded-full text-[11px] border ${s.cls}`}>{s.text}</span>
                  </td>
                  <td className="px-2.5 py-2 text-text-tertiary tabular-nums">{fmtDuration(r.started_at, r.completed_at)}</td>
                  <td className="px-2.5 py-2 text-red-300 truncate max-w-[200px]" title={r.error_message ?? ''}>
                    {r.error_message ?? '-'}
                  </td>
                  <td className="px-2.5 py-2 text-text-secondary tabular-nums">{r.credit_used}</td>
                </tr>
              );
            })}
            {!loading && items.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-text-tertiary">미완료 잡 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CountCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
      <p className="text-[12px] text-text-tertiary uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-[20px] font-bold tabular-nums ${cls}`}>{value.toLocaleString('ko-KR')}</p>
    </div>
  );
}
