/**
 * DAU/WAU/MAU 드릴다운 패널 — 기간 내 접속한 회원 전체 목록.
 * DemographicsSummary 의 DAU/WAU/MAU 카드 클릭으로 열리는 전체 화면 오버레이.
 * /api/admin/users/active?period= 를 자체 조회. 행 클릭 → 회원 상세 Drawer(onOpenUser).
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { GENDER_LABEL, SEGMENT_LABEL, AGE_BUCKETS, type UserSegment, type AgeBucketKey } from '@/constants/adminLabels';
import { pathLabel } from '@/constants/adminLabels';

export type ActivePeriod = 'today' | 'week' | 'month';

interface ActiveUser {
  id: string; email: string;
  gender: 'male' | 'female' | 'unknown';
  ageBucket: AgeBucketKey;
  segments: UserSegment[];
  moonBalance: number; totalSpent: number;
  sajuCount: number; tarotCount: number;
  eventCount: number;
  firstActiveAt: string; lastActiveAt: string; lastPath: string | null;
}

const PERIOD_LABEL: Record<ActivePeriod, { title: string; desc: string }> = {
  today: { title: 'DAU — 오늘 접속 회원', desc: '오늘(KST 자정 이후) 로그인 상태로 활동한 회원' },
  week: { title: 'WAU — 최근 7일 접속 회원', desc: '최근 7일(오늘 포함) 로그인 상태로 활동한 회원' },
  month: { title: 'MAU — 최근 30일 접속 회원', desc: '최근 30일(오늘 포함) 로그인 상태로 활동한 회원' },
};

const fmtDT = (s: string) => new Date(s).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const ageLabel = (k: AgeBucketKey) => AGE_BUCKETS.find((b) => b.key === k)?.label ?? k;

export function ActiveUsersPanel({
  period, token, onClose, onChangePeriod, onOpenUser,
}: {
  period: ActivePeriod;
  token: string | null;
  onClose: () => void;
  onChangePeriod: (p: ActivePeriod) => void;
  onOpenUser: (id: string) => void;
}) {
  const [data, setData] = useState<{ count: number; users: ActiveUser[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/users/active?period=${period}`, { headers: { 'x-admin-key': token } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '조회 실패');
      setData(json);
    } catch (e) { setError(e instanceof Error ? e.message : '오류'); }
    finally { setLoading(false); }
  }, [token, period]);

  useEffect(() => { void fetchList(); }, [fetchList]);

  return (
    <div className="fixed inset-0 z-[55] bg-[#0a0614] overflow-y-auto">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-[#0a0614]/95 backdrop-blur border-b border-white/10 px-6 py-4">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-[13px] text-text-secondary hover:text-text-primary border border-white/15 hover:border-white/30 px-3 py-1.5 rounded-lg">← 뒤로</button>
            <div>
              <h2 className="text-[16px] font-bold text-text-primary">{PERIOD_LABEL[period].title}</h2>
              <p className="text-[12px] text-text-tertiary">{PERIOD_LABEL[period].desc} · 접속 기준: 로그인 상태 페이지 활동(analytics)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
              {(['today', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => onChangePeriod(p)}
                  className={`px-3 py-1.5 rounded text-[13px] font-medium transition-colors ${period === p ? 'bg-cta text-white' : 'text-text-tertiary hover:text-text-secondary'}`}
                >
                  {p === 'today' ? 'DAU' : p === 'week' ? 'WAU' : 'MAU'}
                </button>
              ))}
            </div>
            <span className="text-[14px] text-text-primary font-semibold">{data ? `${data.count}명` : '…'}</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-6 py-5">
        {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-[14px] text-red-300">{error}</div>}
        {loading && !data && <p className="text-[14px] text-text-tertiary">불러오는 중…</p>}

        {data && (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/3 text-[11px] text-text-tertiary uppercase">
                  {['이메일', '최근 접속', '활동수', '마지막 화면', '성별/연령', '세그먼트', '달 잔액', '누적 결제', '이용(사주/타로)'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => onOpenUser(u.id)}
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5 text-text-primary max-w-[220px] truncate">{u.email}</td>
                    <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap">{fmtDT(u.lastActiveAt)}</td>
                    <td className="px-3 py-2.5 text-text-secondary tabular-nums">{u.eventCount}</td>
                    <td className="px-3 py-2.5 text-text-tertiary max-w-[140px] truncate">{pathLabel(u.lastPath)}</td>
                    <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap">
                      {GENDER_LABEL[u.gender] ?? u.gender} · {ageLabel(u.ageBucket)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {u.segments.map((s) => (
                          <span key={s} className={`px-1.5 py-0.5 rounded-full text-[10px] border ${SEGMENT_LABEL[s]?.cls ?? 'bg-white/10 text-text-tertiary border-white/15'}`}>
                            {SEGMENT_LABEL[s]?.text ?? s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-indigo-300 tabular-nums">달 {u.moonBalance}</td>
                    <td className="px-3 py-2.5 text-text-secondary tabular-nums whitespace-nowrap">{u.totalSpent > 0 ? `${u.totalSpent.toLocaleString()}원` : '-'}</td>
                    <td className="px-3 py-2.5 text-text-tertiary tabular-nums whitespace-nowrap">{u.sajuCount} / {u.tarotCount}</td>
                  </tr>
                ))}
                {data.users.length === 0 && !loading && (
                  <tr><td colSpan={9} className="px-3 py-10 text-center text-text-tertiary">해당 기간 접속 회원 없음</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-text-tertiary mt-3">
          행 클릭 시 회원 상세. 비로그인(익명) 방문은 회원 식별이 불가해 포함되지 않습니다 — 전체 방문자 수는 분석 → 유입·이탈 탭 참조.
        </p>
      </div>
    </div>
  );
}
