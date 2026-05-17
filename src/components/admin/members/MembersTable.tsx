/**
 * 회원 관리 테이블 — 확장된 열.
 * 열: 이메일·provider / 성별·나이 / 가입일·마지막접속·경과일 / 프로필수 / 🌙 / 누적결제·주문수·마지막구매 / 분석수 / 세그먼트
 * 단일 달 크레딧 통합(2026-05-16) 이후 sun 표시 없음. sunBalance 필드는 API 응답 호환 유지.
 */
'use client';

import {
  GENDER_LABEL, PROVIDER_LABEL, SEGMENT_LABEL, type UserSegment, type AgeBucketKey,
} from '@/constants/adminLabels';

export interface MemberRow {
  id: string;
  email: string;
  provider: string;
  createdAt: string;
  lastSignIn: string | null;
  gender: 'male' | 'female' | 'unknown';
  birthDate: string | null;
  age: number | null;
  ageBucket: AgeBucketKey;
  birthPlace: string | null;
  profileCount: number;
  sunBalance: number;
  moonBalance: number;
  totalSpent: number;
  orderCount: number;
  lastOrderAt: string | null;
  lastPackage: string | null;
  sajuCount: number;
  tarotCount: number;
  lastAnalysisAt: string | null;
  segments: UserSegment[];
  daysSinceLastActivity: number | null;
}

type SortKey = 'joined' | 'lastSeen' | 'totalSpent' | 'analysisCount' | 'orderCount';

interface Props {
  rows: MemberRow[];
  loading: boolean;
  sort: SortKey;
  order: 'asc' | 'desc';
  onSortChange: (sort: SortKey, order: 'asc' | 'desc') => void;
  onRowClick: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleAll?: () => void;
}

const fmt = (n: number) => n.toLocaleString('ko-KR');
const fmtWon = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const fmtDate = (s: string | null) => s
  ? new Date(s).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })
  : '-';

export function MembersTable({ rows, loading, sort, order, onSortChange, onRowClick, selectedIds, onToggleSelect, onToggleAll }: Props) {
  const toggleSort = (key: SortKey) => {
    if (sort === key) onSortChange(key, order === 'asc' ? 'desc' : 'asc');
    else onSortChange(key, 'desc');
  };
  const showCheckbox = !!selectedIds && !!onToggleSelect;
  const allSelected = showCheckbox && rows.length > 0 && rows.every(r => selectedIds!.has(r.id));

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-white/10 bg-white/3 text-[11px] text-text-tertiary uppercase tracking-wider">
            {showCheckbox && (
              <th className="px-3 py-2 w-[36px]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onToggleAll?.()}
                  className="accent-cta cursor-pointer"
                  aria-label="전체 선택"
                />
              </th>
            )}
            <Th>이메일 / 가입</Th>
            <Th>성별·나이</Th>
            <Th sortable active={sort === 'joined'} order={order} onClick={() => toggleSort('joined')}>가입일</Th>
            <Th sortable active={sort === 'lastSeen'} order={order} onClick={() => toggleSort('lastSeen')}>마지막 접속</Th>
            <Th>프로필</Th>
            <Th>🌙</Th>
            <Th sortable active={sort === 'totalSpent'} order={order} onClick={() => toggleSort('totalSpent')}>누적 결제</Th>
            <Th sortable active={sort === 'orderCount'} order={order} onClick={() => toggleSort('orderCount')}>주문</Th>
            <Th sortable active={sort === 'analysisCount'} order={order} onClick={() => toggleSort('analysisCount')}>분석</Th>
            <Th>세그먼트</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(u => (
            <tr
              key={u.id}
              onClick={() => onRowClick(u.id)}
              className={`border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${selectedIds?.has(u.id) ? 'bg-cta/5' : ''}`}
            >
              {showCheckbox && (
                <td className="px-3 py-2.5 w-[36px]" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds!.has(u.id)}
                    onChange={() => onToggleSelect!(u.id)}
                    className="accent-cta cursor-pointer"
                    aria-label="선택"
                  />
                </td>
              )}
              <td className="px-3 py-2.5">
                <div className="font-medium text-text-primary truncate max-w-[200px]">{u.email}</div>
                <div className="text-[11px] text-text-tertiary mt-0.5">
                  <span className="px-1.5 py-0.5 rounded bg-white/8 text-text-secondary">
                    {PROVIDER_LABEL[u.provider] ?? u.provider}
                  </span>
                </div>
              </td>

              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1">
                  <GenderIcon gender={u.gender} />
                  <span className="text-text-secondary">{GENDER_LABEL[u.gender]}</span>
                </div>
                <div className="text-[11px] text-text-tertiary mt-0.5">
                  {u.age !== null ? `${u.age}세` : '-'}
                </div>
              </td>

              <td className="px-3 py-2.5 text-text-tertiary whitespace-nowrap">{fmtDate(u.createdAt)}</td>

              <td className="px-3 py-2.5">
                <div className="text-text-secondary whitespace-nowrap">{fmtDate(u.lastSignIn)}</div>
                {u.daysSinceLastActivity !== null && (
                  <div className={`text-[11px] mt-0.5 ${u.daysSinceLastActivity > 60 ? 'text-red-300/70' : 'text-text-tertiary'}`}>
                    {u.daysSinceLastActivity}일 전
                  </div>
                )}
              </td>

              <td className="px-3 py-2.5 text-center text-text-secondary tabular-nums">{u.profileCount}</td>

              <td className="px-3 py-2.5 whitespace-nowrap">
                <span className="text-indigo-300 tabular-nums">🌙{u.moonBalance}</span>
              </td>

              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                <div className="text-text-primary font-medium tabular-nums">{fmtWon(u.totalSpent)}</div>
                {u.lastPackage && <div className="text-[11px] text-text-tertiary mt-0.5 truncate max-w-[140px]">{u.lastPackage}</div>}
              </td>

              <td className="px-3 py-2.5 text-center text-text-secondary tabular-nums">{u.orderCount}</td>

              <td className="px-3 py-2.5 tabular-nums">
                <div className="text-text-primary">{fmt(u.sajuCount + u.tarotCount)}</div>
                <div className="text-[11px] text-text-tertiary mt-0.5">
                  사주 {u.sajuCount} · 타로 {u.tarotCount}
                </div>
              </td>

              <td className="px-3 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {u.segments.map(s => (
                    <span key={s} className={`px-1.5 py-0.5 text-[10px] rounded-full border ${SEGMENT_LABEL[s].cls}`}>
                      {SEGMENT_LABEL[s].text}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && !loading && (
            <tr><td colSpan={10} className="px-3 py-8 text-center text-text-tertiary">데이터 없음</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children, sortable, active, order, onClick,
}: {
  children: React.ReactNode;
  sortable?: boolean; active?: boolean; order?: 'asc' | 'desc';
  onClick?: () => void;
}) {
  if (!sortable) {
    return <th className="px-3 py-2.5 text-left font-medium">{children}</th>;
  }
  return (
    <th className="px-3 py-2.5 text-left font-medium">
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-text-secondary transition-colors ${active ? 'text-cta' : ''}`}
      >
        {children}
        <span className="text-[9px]">
          {active ? (order === 'asc' ? '▲' : '▼') : '⇵'}
        </span>
      </button>
    </th>
  );
}

function GenderIcon({ gender }: { gender: 'male' | 'female' | 'unknown' }) {
  if (gender === 'male') return <span className="text-blue-300">♂</span>;
  if (gender === 'female') return <span className="text-pink-300">♀</span>;
  return <span className="text-text-tertiary">·</span>;
}
