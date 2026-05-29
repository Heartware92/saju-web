/**
 * 휴대폰 변경 이력 + 부정행위 시그널
 */
'use client';

import { useCallback, useEffect, useState } from 'react';

interface PhoneChange {
  id: string;
  user_id: string;
  userEmail: string;
  old_phone: string | null;
  new_phone: string;
  credit_charged: number;
  changed_at: string;
}

interface Signals {
  suspiciousPhones: { phone: string; userCount: number }[];
  rapidChangeUsers: { userId: string; email: string; count24h: number }[];
}

const fmtDate = (s: string) => new Date(s).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const maskPhone = (p: string | null) => {
  if (!p) return '-';
  if (p.length < 7) return p;
  return p.slice(0, 3) + '-****-' + p.slice(-4);
};

export function PhoneChangesSection({ token, onOpenUser }: { token: string | null; onOpenUser: (id: string) => void }) {
  const [items, setItems] = useState<PhoneChange[]>([]);
  const [signals, setSignals] = useState<Signals>({ suspiciousPhones: [], rapidChangeUsers: [] });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: String(page), search });
      const res = await fetch(`/api/admin/phone-changes?${params}`, { headers: { 'x-admin-key': token } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '실패');
      setItems(json.changes);
      setTotal(json.total);
      setSignals(json.signals);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, page, search]);

  useEffect(() => { fetchList(); }, [fetchList]);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[14px] font-semibold text-text-primary">휴대폰 번호 변경 이력</h3>
        <p className="text-[12px] text-text-tertiary">총 {total.toLocaleString('ko-KR')}건</p>
      </div>

      {/* 부정행위 시그널 */}
      {(signals.suspiciousPhones.length > 0 || signals.rapidChangeUsers.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {signals.suspiciousPhones.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <p className="text-[13px] font-semibold text-amber-300 mb-2">
                중복 번호 사용 — {signals.suspiciousPhones.length}건
              </p>
              <ul className="space-y-1 text-[12px] text-text-secondary">
                {signals.suspiciousPhones.slice(0, 5).map(s => (
                  <li key={s.phone} className="flex justify-between">
                    <span className="font-mono">{maskPhone(s.phone)}</span>
                    <span className="text-amber-300">{s.userCount}명 사용</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {signals.rapidChangeUsers.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-[13px] font-semibold text-red-300 mb-2">
                24시간 내 다중 변경 — {signals.rapidChangeUsers.length}명
              </p>
              <ul className="space-y-1 text-[12px] text-text-secondary">
                {signals.rapidChangeUsers.slice(0, 5).map(u => (
                  <li key={u.userId} className="flex justify-between">
                    <button onClick={() => onOpenUser(u.userId)} className="text-cta hover:underline truncate max-w-[200px]">
                      {u.email || u.userId}
                    </button>
                    <span className="text-red-300">{u.count24h}회</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <input
        type="text"
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
        placeholder="이메일·번호 검색"
        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[13px]"
      />

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[13px] text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-[13px]">
          <thead className="bg-white/3 text-[11px] text-text-tertiary uppercase">
            <tr>
              {['일시', '회원', '이전 번호', '새 번호', '차감', ''].map(h =>
                <th key={h} className="px-2.5 py-2 text-left font-medium">{h}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map(r => (
              <tr key={r.id} className="border-t border-white/5 hover:bg-white/3">
                <td className="px-2.5 py-2 text-text-tertiary whitespace-nowrap">{fmtDate(r.changed_at)}</td>
                <td className="px-2.5 py-2">
                  <button onClick={() => onOpenUser(r.user_id)} className="text-cta hover:underline truncate max-w-[200px] inline-block">
                    {r.userEmail || r.user_id}
                  </button>
                </td>
                <td className="px-2.5 py-2 text-text-secondary font-mono">{maskPhone(r.old_phone)}</td>
                <td className="px-2.5 py-2 text-text-primary font-mono">{maskPhone(r.new_phone)}</td>
                <td className="px-2.5 py-2 tabular-nums">
                  {r.credit_charged > 0 ? (
                    <span className="text-amber-300">달 -{r.credit_charged}</span>
                  ) : (
                    <span className="text-green-300">무료</span>
                  )}
                </td>
                <td className="px-2.5 py-2 text-right text-text-tertiary text-[11px]">{r.id.slice(0, 8)}</td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-text-tertiary">변경 이력 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
