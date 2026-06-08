/**
 * 회원가입 전화번호 예외 허용 리스트 (어드민)
 *
 * 디폴트 = 차단(이미 가입된 번호면 회원가입 시 "이미 가입한 전화번호입니다").
 * 여기에 등록한 번호만 같은 번호로 중복 가입을 허용한다(테스트·가족 공용 번호 등).
 */
'use client';

import { useCallback, useEffect, useState } from 'react';

interface AllowItem {
  phone: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

const fmtPhone = (p: string) => (p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : p);

export function PhoneAllowlistSection({ token }: { token: string | null }) {
  const [items, setItems] = useState<AllowItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/phone-allowlist', { headers: { 'x-admin-key': token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '불러오기에 실패했습니다.');
      setItems(data.items ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const add = async () => {
    if (!token) return;
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (!/^01[016789]\d{7,8}$/.test(cleaned)) {
      setError('올바른 휴대폰 번호를 입력해주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/phone-allowlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': token },
        body: JSON.stringify({ phone: cleaned, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '추가에 실패했습니다.');
      setPhone('');
      setNote('');
      await fetchList();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: string) => {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/phone-allowlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': token },
        body: JSON.stringify({ phone: p }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '삭제에 실패했습니다.');
      await fetchList();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
      <h3 className="text-[15px] font-bold text-text-primary">전화번호 중복가입 예외 허용</h3>
      <p className="text-[12px] text-text-tertiary mt-1 mb-4">
        기본은 한 번호 = 한 계정으로 중복 가입을 차단합니다. 아래에 등록한 번호만 같은 번호로 추가 가입을 허용합니다(테스트·가족 공용 등).
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <input
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="휴대폰 번호 (예: 01012345678)"
          className="px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[14px] text-text-primary placeholder-text-tertiary w-[200px]"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="메모(사유) — 선택"
          className="px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[14px] text-text-primary placeholder-text-tertiary flex-1 min-w-[160px]"
        />
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-[var(--cta-primary)] disabled:opacity-50"
        >
          추가
        </button>
      </div>

      {error && <p className="text-[12px] text-status-error mb-2">{error}</p>}

      {loading ? (
        <p className="text-[13px] text-text-tertiary py-3">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-text-tertiary py-3">등록된 예외 번호가 없습니다. (모든 번호 중복가입 차단)</p>
      ) : (
        <table className="w-full text-[13px] mt-1">
          <thead>
            <tr className="text-text-tertiary border-b border-[var(--border-subtle)]">
              <th className="text-left py-2 font-medium">번호</th>
              <th className="text-left py-2 font-medium">메모</th>
              <th className="text-left py-2 font-medium">등록일</th>
              <th className="text-right py-2 font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.phone} className="border-b border-[rgba(255,255,255,0.06)]">
                <td className="py-2 text-text-primary tabular-nums">{fmtPhone(it.phone)}</td>
                <td className="py-2 text-text-secondary break-words">{it.note ?? '-'}</td>
                <td className="py-2 text-text-tertiary">{fmtDate(it.created_at)}</td>
                <td className="py-2 text-right">
                  <button
                    type="button"
                    onClick={() => remove(it.phone)}
                    disabled={busy}
                    className="px-2.5 py-1 rounded-md text-[12px] text-status-error border border-[rgba(248,113,113,0.4)] disabled:opacity-50"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
