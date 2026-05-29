/**
 * 회원 벌크 액션 바 — 선택된 회원에 크레딧/메모/차단/해제 일괄 적용
 */
'use client';

import { useState } from 'react';

interface Props {
  selectedIds: Set<string>;
  token: string | null;
  onClearSelection: () => void;
  onDone: () => void; // 성공 후 refresh
}

type Mode = null | 'credit' | 'note' | 'ban' | 'unban';

export function BulkActionBar({ selectedIds, token, onClearSelection, onDone }: Props) {
  const [mode, setMode] = useState<Mode>(null);
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  const count = selectedIds.size;
  if (count === 0) return null;

  const run = async (body: Record<string, unknown>) => {
    if (!token) return;
    setBusy(true); setResult(null);
    try {
      const r = await fetch('/api/admin/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': token ?? '' },
        body: JSON.stringify({ userIds: [...selectedIds], ...body }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? '실패');
      setResult({ success: j.success, failed: j.failed });
      setMode(null);
      onDone();
    } catch (e: any) {
      setResult({ success: 0, failed: count });
      alert('처리에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (count >= 10) {
      if (!confirm(`${count}명에게 일괄 적용합니다. 정말 진행하시겠습니까?`)) return;
    }
    if (mode === 'credit') {
      if (!reason.trim()) return alert('사유 필수');
      run({ action: 'credit', delta, reason });
    } else if (mode === 'note') {
      run({ action: 'note', note });
    } else if (mode === 'ban' || mode === 'unban') {
      if (!confirm(mode === 'ban' ? `${count}명을 1년 차단합니다. 확실합니까?` : `${count}명의 차단을 해제합니다.`)) return;
      run({ action: mode, reason });
    }
  };

  return (
    <div className="sticky top-0 z-30 rounded-xl border border-cta/30 bg-cta/10 backdrop-blur p-3 shadow-lg">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-cta">{count}명 선택됨</span>
          <button onClick={onClearSelection} className="text-[12px] text-text-tertiary hover:text-text-primary underline">
            해제
          </button>
        </div>

        <div className="flex gap-1 ml-auto">
          <BulkBtn active={mode === 'credit'} onClick={() => setMode(mode === 'credit' ? null : 'credit')}>크레딧</BulkBtn>
          <BulkBtn active={mode === 'note'} onClick={() => setMode(mode === 'note' ? null : 'note')}>메모</BulkBtn>
          <BulkBtn active={mode === 'ban'} onClick={() => setMode(mode === 'ban' ? null : 'ban')} variant="danger">차단</BulkBtn>
          <BulkBtn active={mode === 'unban'} onClick={() => setMode(mode === 'unban' ? null : 'unban')} variant="success">해제</BulkBtn>
        </div>
      </div>

      {mode === 'credit' && (
        <div className="mt-3 flex gap-2 flex-wrap items-center">
          <span className="px-3 py-1 rounded text-[12px] bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">달 크레딧</span>
          <input type="number" value={delta} onChange={e => setDelta(parseInt(e.target.value) || 0)}
            className="w-24 px-2 py-1 rounded-lg bg-white/5 border border-white/15 text-[13px] tabular-nums"
            placeholder="+10 / -5" />
          <input type="text" value={reason} onChange={e => setReason(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-1 rounded-lg bg-white/5 border border-white/15 text-[13px]"
            placeholder="사유 (필수)" />
          <button onClick={submit} disabled={busy || delta === 0 || !reason.trim()}
            className="px-4 py-1.5 rounded-lg bg-cta text-white text-[13px] font-medium disabled:opacity-40">
            {busy ? '처리 중…' : `${count}명 적용`}
          </button>
        </div>
      )}

      {mode === 'note' && (
        <div className="mt-3 flex gap-2 flex-wrap items-start">
          <textarea value={note} onChange={e => setNote(e.target.value)}
            rows={2} maxLength={2000}
            className="flex-1 min-w-[300px] px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-[13px] resize-y"
            placeholder="공통 메모 — 빈 값이면 기존 메모 초기화" />
          <button onClick={submit} disabled={busy}
            className="px-4 py-1.5 rounded-lg bg-cta text-white text-[13px] font-medium disabled:opacity-40">
            {busy ? '처리 중…' : `${count}명 적용`}
          </button>
        </div>
      )}

      {(mode === 'ban' || mode === 'unban') && (
        <div className="mt-3 flex gap-2 flex-wrap items-center">
          <input type="text" value={reason} onChange={e => setReason(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-1 rounded-lg bg-white/5 border border-white/15 text-[13px]"
            placeholder={mode === 'ban' ? '차단 사유 (감사 로그에 기록됨)' : '해제 사유 (선택)'} />
          <button onClick={submit} disabled={busy}
            className={`px-4 py-1.5 rounded-lg text-white text-[13px] font-medium disabled:opacity-40 ${mode === 'ban' ? 'bg-red-500' : 'bg-green-500'}`}>
            {busy ? '처리 중…' : mode === 'ban' ? `${count}명 차단` : `${count}명 해제`}
          </button>
        </div>
      )}

      {result && (
        <p className="mt-2 text-[12px] text-text-tertiary">
          성공 {result.success} / 실패 {result.failed}
        </p>
      )}
    </div>
  );
}

function BulkBtn({
  children, active, onClick, variant = 'default',
}: {
  children: React.ReactNode; active: boolean; onClick: () => void;
  variant?: 'default' | 'danger' | 'success';
}) {
  const base = active
    ? variant === 'danger' ? 'bg-red-500/30 text-red-200 border-red-500/50'
    : variant === 'success' ? 'bg-green-500/30 text-green-200 border-green-500/50'
    : 'bg-cta text-white border-cta'
    : 'bg-white/5 text-text-secondary border-white/15 hover:bg-white/10';
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${base}`}>
      {children}
    </button>
  );
}
