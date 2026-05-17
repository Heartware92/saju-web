/**
 * 회원 상세 Drawer — 테이블 행 클릭 시 우측에서 슬라이드 등장.
 * 기본정보 / 프로필 리스트 / 주문 / 사주·타로 기록 / 크레딧 거래내역
 * /api/admin/users/[id] 1회 호출로 모두 받아옴.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  GENDER_LABEL, PROVIDER_LABEL, ORDER_STATUS_LABEL,
  SAJU_CATEGORY_LABEL, TAROT_SPREAD_LABEL, CREDIT_REASON_LABEL,
  lookupServiceLabel,
} from '@/constants/adminLabels';
import { HorizontalBarChart } from '../charts/HorizontalBarChart';

interface Props {
  userId: string | null;
  token: string | null;
  onClose: () => void;
}

interface ConsultationRecordItem {
  id: string; profile_name: string | null; conversation_id: string;
  title: string; message_count: number;
  last_message_at: string | null; created_at: string; updated_at: string;
}

interface DetailData {
  user: {
    id: string; email: string; provider: string;
    createdAt: string; lastSignIn: string | null;
    emailConfirmed: boolean; phone: string | null;
    bannedUntil?: string | null;
    adminNote?: string;
  };
  primary: {
    name: string; gender: string;
    birthDate: string; birthTime: string | null;
    birthPlace: string; calendarType: string;
    age: number | null; ageBucket: string;
  } | null;
  profiles: any[];
  credit: any;
  orders: any[];
  sajuRecords: any[];
  tarotRecords: any[];
  consultationRecords: ConsultationRecordItem[];
  transactions: any[];
  aggregates: {
    totalSpent: number; orderCount: number; refundCount: number; isVip: boolean;
    sajuTotal: number; tarotTotal: number; consultationTotal: number;
    sajuByCategory: Record<string, number>;
    tarotBySpread: Record<string, number>;
  };
}

type DrawerTab = 'overview' | 'profiles' | 'orders' | 'records' | 'consultations' | 'transactions' | 'ops';

const fmtWon = (n: number) => `${(n ?? 0).toLocaleString('ko-KR')}원`;
const fmtDate = (s: string | null) => s
  ? new Date(s).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '-';

export function MemberDetailDrawer({ userId, token, onClose }: Props) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<DrawerTab>('overview');

  const reloadDetail = useCallback(async () => {
    if (!userId || !token) return;
    setError(''); setLoading(true);
    try {
      const r = await fetch(`/api/admin/users/${userId}?force=1`, { headers: { 'x-admin-key': token ?? '' } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setData(j);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [userId, token]);

  useEffect(() => {
    if (!userId || !token) return;
    setData(null); setError(''); setTab('overview'); setLoading(true);
    fetch(`/api/admin/users/${userId}`, { headers: { 'x-admin-key': token ?? '' } })
      .then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setData(j);
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId, token]);

  if (!userId) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="relative w-full max-w-[720px] h-[100dvh] bg-[#0a0614] border-l border-white/10 overflow-y-auto pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
        {/* 헤더 */}
        <header className="sticky top-0 z-10 bg-[#0a0614]/95 backdrop-blur border-b border-white/10 px-5 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[11px] text-text-tertiary uppercase tracking-wider">회원 상세</p>
            <h2 className="text-[16px] font-bold text-text-primary truncate">
              {data?.user.email ?? (loading ? '로딩 중…' : '로드 실패')}
            </h2>
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-[20px] px-2">×</button>
        </header>

        {error && (
          <div className="mx-5 mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-[14px] text-red-300">
            {error}
          </div>
        )}

        {loading && !data && <p className="px-5 py-8 text-text-tertiary text-[14px]">불러오는 중…</p>}

        {data && (
          <>
            {/* 탭 */}
            <nav className="border-b border-white/10 px-5 flex gap-1 overflow-x-auto">
              {([
                ['overview', '요약'],
                ['profiles', `프로필 (${data.profiles.length})`],
                ['orders', `주문 (${data.orders.length})`],
                ['records', `이용 (${data.sajuRecords.length + data.tarotRecords.length})`],
                ['consultations', `상담 (${(data.consultationRecords ?? []).length})`],
                ['transactions', `거래 (${data.transactions.length})`],
                ['ops', '관리자 작업'],
              ] as [DrawerTab, string][]).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={`px-3 py-2.5 text-[13px] font-medium border-b-2 whitespace-nowrap transition-colors ${
                    tab === k ? 'border-cta text-cta' : 'border-transparent text-text-tertiary hover:text-text-secondary'
                  }`}
                >{label}</button>
              ))}
            </nav>

            <div className="p-5 space-y-5">
              {tab === 'overview' && <OverviewTab data={data} />}
              {tab === 'profiles' && <ProfilesTab data={data} />}
              {tab === 'orders' && <OrdersTab data={data} />}
              {tab === 'records' && <RecordsTab data={data} />}
              {tab === 'consultations' && <ConsultationsTab data={data} token={token} />}
              {tab === 'transactions' && <TransactionsTab data={data} />}
              {tab === 'ops' && <OpsTab data={data} token={token} onRefresh={() => reloadDetail()} />}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

// ── 탭별 ─────────────────────────────────────────────

function OverviewTab({ data }: { data: DetailData }) {
  const { user, primary, credit, aggregates } = data;
  return (
    <div className="space-y-4">
      <Section title="기본 정보">
        <Grid>
          <Row label="이메일" value={user.email} />
          <Row label="가입 경로" value={PROVIDER_LABEL[user.provider] ?? user.provider} />
          <Row label="가입일" value={fmtDate(user.createdAt)} />
          <Row label="마지막 접속" value={fmtDate(user.lastSignIn)} />
          <Row label="이메일 인증" value={user.emailConfirmed ? '완료' : '미완료'} />
          <Row label="전화" value={user.phone ?? '-'} />
          <Row label="user_id" value={<span className="font-mono text-[11px] break-all">{user.id}</span>} />
        </Grid>
      </Section>

      {primary ? (
        <Section title="대표 프로필">
          <Grid>
            <Row label="이름" value={primary.name} />
            <Row label="성별" value={GENDER_LABEL[primary.gender] ?? primary.gender} />
            <Row label="나이" value={primary.age !== null ? `${primary.age}세 (${primary.ageBucket})` : '-'} />
            <Row label="생년월일" value={`${primary.birthDate}${primary.calendarType === 'lunar' ? ' (음력)' : ''}`} />
            <Row label="출생시간" value={primary.birthTime ?? '시간 모름'} />
            <Row label="출생지" value={primary.birthPlace} />
          </Grid>
        </Section>
      ) : (
        <Section title="대표 프로필">
          <p className="text-[13px] text-text-tertiary">등록된 프로필 없음</p>
        </Section>
      )}

      <Section title="결제·이용 요약">
        <Grid>
          <Row label="누적 결제" value={<span className={aggregates.isVip ? 'text-amber-300 font-bold' : ''}>{fmtWon(aggregates.totalSpent)}{aggregates.isVip && ' (VIP)'}</span>} />
          <Row label="주문 수" value={`${aggregates.orderCount}건 (환불 ${aggregates.refundCount}건)`} />
          <Row label="사주 분석" value={`${aggregates.sajuTotal}회`} />
          <Row label="타로" value={`${aggregates.tarotTotal}회`} />
          <Row label="상담소" value={`${aggregates.consultationTotal ?? 0}건`} />
          {credit && (
            <Row label="🌙 달" value={<>잔액 <b>{credit.moon_balance}</b> · 발행 {credit.total_moon_purchased} · 소비 {credit.total_moon_consumed}</>} />
          )}
        </Grid>
      </Section>

      {Object.keys(aggregates.sajuByCategory).length > 0 && (
        <Section title="카테고리별 이용 분포">
          <HorizontalBarChart
            bars={Object.entries(aggregates.sajuByCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => ({ key: k, label: SAJU_CATEGORY_LABEL[k] ?? k, value: v }))}
          />
        </Section>
      )}

      {Object.keys(aggregates.tarotBySpread).length > 0 && (
        <Section title="타로 스프레드 분포">
          <HorizontalBarChart
            bars={Object.entries(aggregates.tarotBySpread)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => ({ key: k, label: TAROT_SPREAD_LABEL[k] ?? k, value: v }))}
            defaultColor="rgba(244, 114, 182, 0.65)"
          />
        </Section>
      )}
    </div>
  );
}

function ProfilesTab({ data }: { data: DetailData }) {
  if (data.profiles.length === 0) return <p className="text-[13px] text-text-tertiary">등록된 프로필 없음</p>;
  return (
    <div className="space-y-2">
      {data.profiles.map(p => (
        <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[15px] font-medium text-text-primary">{p.name}</span>
            {p.is_primary && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cta/20 text-cta border border-cta/30">대표</span>}
            {p.relation && <span className="text-[11px] text-text-tertiary">· {p.relation}</span>}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-text-secondary">
            <span>{GENDER_LABEL[p.gender] ?? p.gender}</span>
            <span>{p.calendar_type === 'lunar' ? '음력' : '양력'} {p.birth_date}</span>
            <span>{p.birth_time ?? '시간 모름'}</span>
            <span>{p.birth_place ?? '-'}</span>
          </div>
          {p.memo && <p className="mt-1.5 text-[11px] text-text-tertiary italic">{p.memo}</p>}
        </div>
      ))}
    </div>
  );
}

function OrdersTab({ data }: { data: DetailData }) {
  if (data.orders.length === 0) return <p className="text-[13px] text-text-tertiary">주문 내역 없음</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-[13px]">
        <thead className="bg-white/3 text-[11px] text-text-tertiary uppercase">
          <tr>
            {['상태', '패키지', '금액', '🌙', '결제수단', '일시'].map(h =>
              <th key={h} className="px-2.5 py-2 text-left font-medium">{h}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.orders.map(o => {
            const s = ORDER_STATUS_LABEL[o.status] ?? { text: o.status, cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
            return (
              <tr key={o.id} className="border-t border-white/5">
                <td className="px-2.5 py-2"><span className={`px-1.5 py-0.5 rounded-full text-[11px] border ${s.cls}`}>{s.text}</span></td>
                <td className="px-2.5 py-2 text-text-primary">{o.package_name}</td>
                <td className="px-2.5 py-2 text-text-primary tabular-nums">{fmtWon(o.amount)}</td>
                <td className="px-2.5 py-2 text-indigo-300 tabular-nums">{o.moon_credit_amount}</td>
                <td className="px-2.5 py-2 text-text-tertiary">{o.payment_method ?? '-'}</td>
                <td className="px-2.5 py-2 text-text-tertiary whitespace-nowrap">{fmtDate(o.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RecordsTab({ data }: { data: DetailData }) {
  const merged = [
    ...data.sajuRecords.map(r => ({ ...r, _kind: 'saju' as const })),
    ...data.tarotRecords.map(r => ({ ...r, _kind: 'tarot' as const })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  if (merged.length === 0) return <p className="text-[13px] text-text-tertiary">이용 기록 없음</p>;

  return (
    <div className="space-y-1.5">
      {merged.map(r => {
        const label = r._kind === 'saju'
          ? (SAJU_CATEGORY_LABEL[r.category] ?? r.category)
          : (TAROT_SPREAD_LABEL[r.spread_type] ?? r.spread_type);
        return (
          <div key={`${r._kind}-${r.id}`} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-white/3 border border-white/5 text-[13px]">
            <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${r._kind === 'saju' ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' : 'bg-pink-500/15 text-pink-300 border-pink-500/30'}`}>
              {r._kind === 'saju' ? '사주' : '타로'}
            </span>
            <span className="text-text-primary font-medium">{label}</span>
            {r.profile_name && <span className="text-[11px] text-text-tertiary">({r.profile_name})</span>}
            <span className="text-text-tertiary">
              🌙{r.credit_used}
            </span>
            <span className="ml-auto text-text-tertiary text-[11px] whitespace-nowrap">{fmtDate(r.created_at)}</span>
          </div>
        );
      })}
    </div>
  );
}

function ConsultationsTab({ data, token }: { data: DetailData; token: string | null }) {
  const records = data.consultationRecords ?? [];
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadDetail = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/consultations/${id}`, { headers: { 'x-admin-key': token ?? '' } });
      const json = await res.json();
      if (res.ok) setDetail(json);
    } catch { /* ignore */ }
    finally { setDetailLoading(false); }
  };

  if (records.length === 0) return <p className="text-[13px] text-text-tertiary">상담 기록 없음</p>;

  return (
    <div className="space-y-2">
      {records.map(r => (
        <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <button
            onClick={() => loadDetail(r.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
          >
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30">상담</span>
            <span className="text-[13px] text-text-primary font-medium truncate flex-1">{r.title}</span>
            <span className="text-[11px] text-text-tertiary">{r.message_count}개</span>
            <span className="text-[11px] text-text-tertiary">{r.profile_name ?? '-'}</span>
            <span className="text-[11px] text-text-tertiary whitespace-nowrap">{fmtDate(r.updated_at)}</span>
          </button>
          {expandedId === r.id && (
            <div className="border-t border-white/10 px-3 py-3 max-h-[300px] overflow-y-auto space-y-2">
              {detailLoading && <p className="text-[12px] text-text-tertiary">불러오는 중…</p>}
              {detail?.messages?.map((msg: any, idx: number) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-[12px] leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-cta/60 text-white'
                      : 'bg-white/5 border border-white/10 text-text-secondary'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TransactionsTab({ data }: { data: DetailData }) {
  if (data.transactions.length === 0) return <p className="text-[13px] text-text-tertiary">거래 내역 없음</p>;
  const typeLabel: Record<string, { text: string; cls: string }> = {
    purchase: { text: '구매', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    consume:  { text: '소비', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
    bonus:    { text: '보너스', cls: 'bg-green-500/15 text-green-300 border-green-500/30' },
    refund:   { text: '환불', cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  };
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-[13px]">
        <thead className="bg-white/3 text-[11px] text-text-tertiary uppercase">
          <tr>
            {['유형', '종류', '금액', '잔액', '사유', '일시'].map(h =>
              <th key={h} className="px-2.5 py-2 text-left font-medium">{h}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.transactions.map(t => {
            const s = typeLabel[t.type] ?? { text: t.type, cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
            return (
              <tr key={t.id} className="border-t border-white/5">
                <td className="px-2.5 py-2"><span className={`px-1.5 py-0.5 rounded-full text-[11px] border ${s.cls}`}>{s.text}</span></td>
                <td className="px-2.5 py-2">{t.credit_type === 'sun' ? '☀ 해' : '🌙 달'}</td>
                <td className={`px-2.5 py-2 tabular-nums font-medium ${t.type === 'consume' ? 'text-red-300' : 'text-green-300'}`}>
                  {t.type === 'consume' ? '-' : '+'}{t.amount}
                </td>
                <td className="px-2.5 py-2 text-text-secondary tabular-nums">{t.balance_after}</td>
                <td className="px-2.5 py-2 text-text-tertiary">{CREDIT_REASON_LABEL[t.reason] ?? lookupServiceLabel(t.reason) ?? t.reason ?? '-'}</td>
                <td className="px-2.5 py-2 text-text-tertiary whitespace-nowrap">{fmtDate(t.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── 관리자 작업 ──────────────────────────────────────

function OpsTab({ data, token, onRefresh }: { data: DetailData; token: string | null; onRefresh: () => void }) {
  // 단일 달 크레딧 통합(2026-05-16) 이후 sun 조정 UI 폐기. moon 만 처리.
  const creditType = 'moon' as const;
  const [delta, setDelta] = useState<number>(1);
  const [creditReason, setCreditReason] = useState('');
  const [note, setNote] = useState(data.user.adminNote ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const isBanned = !!data.user.bannedUntil && new Date(data.user.bannedUntil) > new Date();

  const run = async (label: string, fn: () => Promise<Response>) => {
    if (!token) return;
    setBusy(label); setMsg(null);
    try {
      const r = await fn();
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setMsg({ type: 'ok', text: `${label} 성공` });
      onRefresh();
    } catch (e: any) {
      setMsg({ type: 'err', text: `${label} 실패: ${e.message}` });
    } finally {
      setBusy(null);
    }
  };

  const submitCredit = () => {
    if (!creditReason.trim()) {
      setMsg({ type: 'err', text: '사유를 입력하세요' });
      return;
    }
    run('크레딧 조정', () => fetch(`/api/admin/users/${data.user.id}/adjust-credit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': token ?? '' },
      body: JSON.stringify({ creditType, delta, reason: creditReason }),
    }));
  };

  const submitNote = () => {
    run('메모 저장', () => fetch(`/api/admin/users/${data.user.id}/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': token ?? '' },
      body: JSON.stringify({ note }),
    }));
  };

  const toggleBan = () => {
    const action = isBanned ? 'unban' : 'ban';
    if (!confirm(isBanned ? '차단을 해제하시겠습니까?' : '1년 차단을 적용하시겠습니까?')) return;
    run(isBanned ? '차단 해제' : '차단', () => fetch(`/api/admin/users/${data.user.id}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': token ?? '' },
      body: JSON.stringify({ action }),
    }));
  };

  return (
    <div className="space-y-5">
      {msg && (
        <div className={`px-3 py-2 rounded-lg text-[13px] border ${
          msg.type === 'ok' ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>{msg.text}</div>
      )}

      {/* 크레딧 수동 조정 */}
      <Section title="크레딧 수동 조정">
        <div className="space-y-2.5">
          <div className="flex gap-2">
            <span className="px-3 py-1.5 rounded text-[13px] font-medium bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">🌙 달 크레딧</span>
            <input
              type="number"
              value={delta}
              onChange={e => setDelta(parseInt(e.target.value) || 0)}
              placeholder="+10 또는 -5"
              className="w-32 px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[14px] text-text-primary tabular-nums focus:outline-none focus:border-cta/50"
            />
            <p className="self-center text-[12px] text-text-tertiary">
              현재 {data.credit?.moon_balance ?? 0} →{' '}
              <b className="text-text-primary">{(data.credit?.moon_balance ?? 0) + delta}</b>
            </p>
          </div>
          <input
            type="text"
            value={creditReason}
            onChange={e => setCreditReason(e.target.value)}
            placeholder="사유 (필수) — 예: 이벤트 보상, 오류 보상"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-cta/50"
          />
          <button
            onClick={submitCredit}
            disabled={busy !== null || delta === 0 || !creditReason.trim()}
            className="px-4 py-2 rounded-lg bg-cta text-white text-[13px] font-medium disabled:opacity-40 hover:bg-cta/90 transition-colors"
          >
            {busy === '크레딧 조정' ? '처리 중…' : '크레딧 조정 적용'}
          </button>
        </div>
      </Section>

      {/* 관리자 메모 */}
      <Section title="관리자 메모">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="내부용 메모 — 2000자 이내"
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-cta/50 resize-y"
        />
        <div className="flex justify-between items-center mt-2">
          <p className="text-[11px] text-text-tertiary">{note.length} / 2000</p>
          <button
            onClick={submitNote}
            disabled={busy !== null}
            className="px-3 py-1.5 rounded-lg bg-white/10 text-text-primary text-[13px] font-medium disabled:opacity-40 hover:bg-white/15 transition-colors"
          >
            {busy === '메모 저장' ? '저장 중…' : '메모 저장'}
          </button>
        </div>
      </Section>

      {/* 계정 차단 */}
      <Section title="계정 차단">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] text-text-primary font-medium">
              {isBanned ? '⛔ 차단됨' : '✓ 정상'}
            </p>
            {isBanned && data.user.bannedUntil && (
              <p className="text-[11px] text-text-tertiary mt-0.5">해제일: {fmtDate(data.user.bannedUntil)}</p>
            )}
            <p className="text-[11px] text-text-tertiary mt-0.5">차단 시 1년간 로그인 불가</p>
          </div>
          <button
            onClick={toggleBan}
            disabled={busy !== null}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium disabled:opacity-40 transition-colors ${
              isBanned
                ? 'bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30'
                : 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30'
            }`}
          >
            {busy?.includes('차단') ? '처리 중…' : isBanned ? '차단 해제' : '계정 차단'}
          </button>
        </div>
      </Section>
    </div>
  );
}

// ── 유틸 UI ─────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[12px] font-semibold text-text-secondary mb-2 uppercase tracking-wider">{title}</h3>
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">{children}</div>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-[13px]">
      <span className="text-text-tertiary min-w-[72px]">{label}</span>
      <span className="text-text-secondary break-words">{value}</span>
    </div>
  );
}
