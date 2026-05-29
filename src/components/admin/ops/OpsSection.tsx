/**
 * 운영 탭 — 최근 크레딧 조정 로그 + 차단 회원 + 메모 보유 회원
 */
'use client';

import { CREDIT_REASON_LABEL } from '@/constants/adminLabels';

export interface OpsSummary {
  kpi: { adjustmentCount: number; bannedCount: number; notedCount: number };
  adjustments: {
    user_id: string; userEmail: string;
    credit_type: string; amount: number; balance_after: number;
    reason: string; created_at: string;
  }[];
  banned: { id: string; email: string; bannedUntil: string; createdAt: string }[];
  noted: { id: string; email: string; note: string; notedAt: string | null }[];
}

const fmt = (n: number) => n.toLocaleString('ko-KR');
const fmtDate = (s: string | null) => s
  ? new Date(s).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '-';

export function OpsSection({
  summary, onOpenUser,
}: {
  summary: OpsSummary | null;
  onOpenUser: (id: string) => void;
}) {
  if (!summary) return <div className="text-[14px] text-text-tertiary py-6">로딩 중…</div>;

  const kpi = summary.kpi ?? { adjustmentCount: 0, bannedCount: 0, notedCount: 0 };
  const adjustments = Array.isArray(summary.adjustments) ? summary.adjustments : [];
  const banned = Array.isArray(summary.banned) ? summary.banned : [];
  const noted = Array.isArray(summary.noted) ? summary.noted : [];

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div>
        <h2 className="text-[15px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">운영 현황</h2>
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="최근 크레딧 조정" value={`${fmt(kpi.adjustmentCount)}건`} sub="최근 100건 기준" />
          <Kpi label="차단 회원" value={`${fmt(kpi.bannedCount)}명`} color={kpi.bannedCount > 0 ? 'text-red-300' : undefined} />
          <Kpi label="메모 보유 회원" value={`${fmt(kpi.notedCount)}명`} />
        </div>
      </div>

      {/* 크레딧 조정 로그 */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-[14px] font-semibold text-text-primary mb-3">최근 크레딧 수동 조정</h3>
        {adjustments.length === 0 ? (
          <p className="text-[13px] text-text-tertiary py-2">조정 내역 없음</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full text-[13px]">
              <thead className="bg-white/3 text-[11px] text-text-tertiary uppercase">
                <tr>
                  {['회원', '종류', '변동', '잔액', '사유', '일시'].map(h =>
                    <th key={h} className="px-2.5 py-2 text-left font-medium">{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {adjustments.map((a, i) => (
                  <tr key={i} className="border-t border-white/5 hover:bg-white/3 cursor-pointer" onClick={() => onOpenUser(a.user_id)}>
                    <td className="px-2.5 py-2 text-text-secondary max-w-[200px] truncate">{a.userEmail}</td>
                    <td className="px-2.5 py-2 text-text-secondary">달</td>
                    <td className={`px-2.5 py-2 tabular-nums font-medium ${a.amount > 0 ? 'text-green-300' : 'text-red-300'}`}>
                      {a.amount > 0 ? '+' : ''}{a.amount}
                    </td>
                    <td className="px-2.5 py-2 text-text-secondary tabular-nums">{a.balance_after}</td>
                    <td className="px-2.5 py-2 text-text-tertiary">{CREDIT_REASON_LABEL[a.reason] ?? a.reason}</td>
                    <td className="px-2.5 py-2 text-text-tertiary whitespace-nowrap">{fmtDate(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 차단 회원 */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-[14px] font-semibold text-text-primary mb-3">차단된 회원</h3>
        {banned.length === 0 ? (
          <p className="text-[13px] text-text-tertiary py-2">차단 회원 없음</p>
        ) : (
          <div className="space-y-1.5">
            {banned.map(u => (
              <button
                key={u.id}
                onClick={() => onOpenUser(u.id)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 text-left text-[13px]"
              >
                <span className="text-red-300 font-medium">{u.email}</span>
                <span className="ml-auto text-[11px] text-text-tertiary">해제 예정 {fmtDate(u.bannedUntil)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 메모 보유 회원 */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-[14px] font-semibold text-text-primary mb-3">관리자 메모가 있는 회원</h3>
        {noted.length === 0 ? (
          <p className="text-[13px] text-text-tertiary py-2">메모 없음</p>
        ) : (
          <div className="space-y-2">
            {noted.slice(0, 20).map(u => (
              <button
                key={u.id}
                onClick={() => onOpenUser(u.id)}
                className="w-full px-3 py-2 rounded-lg bg-white/3 border border-white/10 hover:bg-white/5 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] text-text-primary font-medium truncate">{u.email}</span>
                  <span className="text-[11px] text-text-tertiary whitespace-nowrap">{fmtDate(u.notedAt)}</span>
                </div>
                <p className="text-[12px] text-text-secondary mt-0.5 line-clamp-2">{u.note}</p>
              </button>
            ))}
            {noted.length > 20 && (
              <p className="text-[12px] text-text-tertiary text-center pt-1">외 {noted.length - 20}명</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <p className="text-[13px] text-text-tertiary uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-[22px] font-bold ${color ?? 'text-text-primary'}`}>{value}</p>
      {sub && <p className="text-[12px] text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  );
}
