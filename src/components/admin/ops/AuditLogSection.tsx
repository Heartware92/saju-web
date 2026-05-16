/**
 * 관리자 감사 로그 뷰 — 운영 탭 하단에 표시
 */
'use client';

export interface AuditLog {
  id: number;
  actor_user_id: string;
  actor_email: string;
  target_user_id: string | null;
  target_email: string | null;
  action: 'credit_adjust' | 'note_update' | 'ban' | 'unban';
  credit_type: 'sun' | 'moon' | null;
  amount: number | null;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, { text: string; cls: string }> = {
  credit_adjust: { text: '크레딧 조정', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  note_update:   { text: '메모 변경',   cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  ban:           { text: '차단',        cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
  unban:         { text: '차단 해제',   cls: 'bg-green-500/20 text-green-300 border-green-500/30' },
};

const fmtDate = (s: string) => new Date(s).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

export function AuditLogSection({
  logs,
  warning,
  onOpenUser,
}: {
  logs: AuditLog[];
  warning?: string;
  onOpenUser: (id: string) => void;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[14px] font-semibold text-text-primary">📜 관리자 감사 로그</h3>
        <p className="text-[12px] text-text-tertiary">최근 {logs.length}건</p>
      </div>

      {warning && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[12px] text-amber-300">
          ⚠️ {warning}
        </div>
      )}

      {logs.length === 0 ? (
        <p className="text-[13px] text-text-tertiary py-2">
          {warning ? '마이그레이션 실행 후 로그가 수집됩니다.' : '기록된 로그 없음'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-[13px]">
            <thead className="bg-white/3 text-[11px] text-text-tertiary uppercase">
              <tr>
                {['시각', '액션', '관리자', '대상 회원', '내용', '사유/IP'].map(h =>
                  <th key={h} className="px-2.5 py-2 text-left font-medium">{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const s = ACTION_LABEL[log.action] ?? { text: log.action, cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
                const content = log.action === 'credit_adjust'
                  ? `🌙 ${log.amount! > 0 ? '+' : ''}${log.amount}`
                  : log.action === 'note_update'
                  ? `"${(log.after_value?.note as string)?.slice(0, 60) ?? ''}${((log.after_value?.note as string) ?? '').length > 60 ? '…' : ''}"`
                  : log.action === 'ban' ? `~${(log.after_value?.bannedUntil as string)?.slice(0, 10) ?? ''}`
                  : '해제';
                return (
                  <tr key={log.id} className="border-t border-white/5">
                    <td className="px-2.5 py-2 text-text-tertiary whitespace-nowrap">{fmtDate(log.created_at)}</td>
                    <td className="px-2.5 py-2"><span className={`px-1.5 py-0.5 rounded-full text-[11px] border ${s.cls}`}>{s.text}</span></td>
                    <td className="px-2.5 py-2 text-text-secondary truncate max-w-[160px]">{log.actor_email}</td>
                    <td className="px-2.5 py-2 truncate max-w-[160px]">
                      {log.target_user_id ? (
                        <button onClick={() => onOpenUser(log.target_user_id!)} className="text-cta hover:underline truncate">
                          {log.target_email ?? log.target_user_id}
                        </button>
                      ) : <span className="text-text-tertiary">-</span>}
                    </td>
                    <td className="px-2.5 py-2 text-text-primary truncate max-w-[260px]">{content}</td>
                    <td className="px-2.5 py-2 text-text-tertiary truncate max-w-[200px]">
                      {log.reason && <span>{log.reason.slice(0, 40)}</span>}
                      {log.ip_address && <span className="ml-2 font-mono text-[11px]">{log.ip_address}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
