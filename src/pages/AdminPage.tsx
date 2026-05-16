'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { DemographicsSummary, type MemberSummary } from '@/components/admin/members/DemographicsSummary';
import { MembersFilterBar } from '@/components/admin/members/MembersFilterBar';
import { MembersTable, type MemberRow } from '@/components/admin/members/MembersTable';
import { MemberDetailDrawer } from '@/components/admin/members/MemberDetailDrawer';
import { BulkActionBar } from '@/components/admin/members/BulkActionBar';
import { VerticalBarChart } from '@/components/admin/charts/VerticalBarChart';
import { OrdersSummarySection, type OrdersSummary } from '@/components/admin/orders/OrdersSummarySection';
import { UsageAnalyticsSection, type UsageSummary } from '@/components/admin/usage/UsageAnalyticsSection';
import { CreditsFlowSection, type CreditsSummary } from '@/components/admin/credits/CreditsFlowSection';
import { OpsSection, type OpsSummary } from '@/components/admin/ops/OpsSection';
import { InsightsSection, type Insights } from '@/components/admin/insights/InsightsSection';
import { AuditLogSection, type AuditLog } from '@/components/admin/ops/AuditLogSection';
import { toCsv, downloadCsv, timestampSuffix } from '@/components/admin/csvExport';
import { SAJU_CATEGORY_LABEL, TAROT_SPREAD_LABEL, ORDER_STATUS_LABEL, GENDER_LABEL, PROVIDER_LABEL, CREDIT_REASON_LABEL, DELETION_REASON_LABEL, type UserSegment, type AgeBucketKey } from '@/constants/adminLabels';

// ── 타입 ──────────────────────────────────────────────────
interface DailyPoint {
  date: string;
  revenue: number;
  signups: number;
  saju: number;
  tarot: number;
  usage: number;
}

interface Stats {
  users: { total: number; today: number; thisMonth: number };
  orders: { completed: number; refunded: number; refundRate: number };
  revenue: { total: number; thisMonth: number; prevMonth: number; refunded: number; growth: number | null };
  usage: { sajuTotal: number; sajuToday: number; tarotTotal: number; tarotToday: number; consultTotal?: number; consultToday?: number };
  credits: {
    sun: { issued: number; consumed: number; balance: number };
    moon: { issued: number; consumed: number; balance: number };
  };
  daily?: DailyPoint[];
}

interface Order {
  id: string; user_id: string; userEmail: string; package_name: string; package_id: string;
  amount: number; status: string; payment_method: string; created_at: string; completed_at: string | null;
  sun_credit_amount: number; moon_credit_amount: number;
}

interface UsageRecord {
  id: string; user_id: string; userEmail: string;
  category?: string; spread_type?: string;
  profile_name?: string;
  credit_type: string; credit_used: number; created_at: string;
}

interface ConsultationRecord {
  id: string; user_id: string; userEmail: string;
  profile_name: string | null; conversation_id: string;
  title: string; message_count: number;
  last_message_at: string | null; created_at: string; updated_at: string;
}

interface DeletedMemberCredit {
  total_sun_purchased: number;
  total_moon_purchased: number;
  total_sun_consumed: number;
  total_moon_consumed: number;
}

interface DeletedMemberMetadata {
  created_at?: string | null;
  credit?: DeletedMemberCredit;
  order_count?: number;
}

interface DeletedMember {
  id: string;
  user_id: string;
  email: string;
  reason: string | null;
  reason_code: string | null;
  metadata: DeletedMemberMetadata | null;
  deleted_at: string;
}

type Tab = 'overview' | 'members' | 'orders' | 'usage' | 'credits' | 'records' | 'consultations' | 'ops' | 'insights';
type SortKey = 'joined' | 'lastSeen' | 'totalSpent' | 'analysisCount' | 'orderCount';

// ── 유틸 ──────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('ko-KR');
const fmtWon = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <p className="text-[13px] text-text-tertiary uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-[22px] font-bold ${color ?? 'text-text-primary'}`}>{value}</p>
      {sub && <p className="text-[13px] text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  );
}

function TrendCard({
  title, unit, data, field, color, totalLabel, sub,
}: {
  title: string;
  unit: string;
  data: DailyPoint[];
  field: 'revenue' | 'signups' | 'usage';
  color: string;
  totalLabel: string;
  sub?: (data: DailyPoint[]) => string;
}) {
  const total = data.reduce((s, d) => s + d[field], 0);
  const bars = data.map(d => ({
    key: d.date,
    label: d.date.slice(5), // MM-DD
    value: d[field],
  }));
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[14px] font-semibold text-text-primary">{title}</h3>
        <p className="text-[13px] text-text-tertiary">
          {totalLabel} <span className="text-text-primary font-medium">{total.toLocaleString()}{unit}</span>
        </p>
      </div>
      <VerticalBarChart bars={bars} color={color} height={120} />
      {sub && <p className="text-[12px] text-text-tertiary mt-2 text-right">{sub(data)}</p>}
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const s = ORDER_STATUS_LABEL[status] ?? { text: status, cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
  return <span className={`px-2 py-0.5 text-[12px] rounded-full border ${s.cls}`}>{s.text}</span>;
}

// ── 컴포넌트 ──────────────────────────────────────────────
export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Overview
  const [stats, setStats] = useState<Stats | null>(null);
  const [dailyRange, setDailyRange] = useState<7 | 30>(7);

  // Members
  const [memberSubTab, setMemberSubTab] = useState<'active' | 'deleted'>('active');
  const [memberSummary, setMemberSummary] = useState<MemberSummary | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [memberPage, setMemberPage] = useState(1);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberGender, setMemberGender] = useState<'male' | 'female' | 'unknown' | ''>('');
  const [memberAgeBucket, setMemberAgeBucket] = useState<AgeBucketKey | ''>('');
  const [memberSegment, setMemberSegment] = useState<UserSegment | ''>('');
  const [memberProvider, setMemberProvider] = useState('');
  const [memberSort, setMemberSort] = useState<SortKey>('joined');
  const [memberOrder, setMemberOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Deleted Members
  const [deletedMembers, setDeletedMembers] = useState<DeletedMember[]>([]);
  const [deletedTotal, setDeletedTotal] = useState(0);
  const [deletedPage, setDeletedPage] = useState(1);
  const [deletedSearch, setDeletedSearch] = useState('');
  const [deletedReasonCounts, setDeletedReasonCounts] = useState<Record<string, number>>({});

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderPage, setOrderPage] = useState(1);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderStatus, setOrderStatus] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [ordersSummary, setOrdersSummary] = useState<OrdersSummary | null>(null);

  // Usage
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);

  // Credits
  const [creditsSummary, setCreditsSummary] = useState<CreditsSummary | null>(null);

  // Ops
  const [opsSummary, setOpsSummary] = useState<OpsSummary | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditWarning, setAuditWarning] = useState<string | undefined>();

  // Insights
  const [insights, setInsights] = useState<Insights | null>(null);

  // Records
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [recordPage, setRecordPage] = useState(1);
  const [recordTotal, setRecordTotal] = useState(0);
  const [recordType, setRecordType] = useState<'saju' | 'tarot'>('saju');
  const [recordCategory, setRecordCategory] = useState('');
  const [categorySummary, setCategorySummary] = useState<{ [k: string]: number }>({});

  // Consultations
  const [consultations, setConsultations] = useState<ConsultationRecord[]>([]);
  const [consultPage, setConsultPage] = useState(1);
  const [consultTotal, setConsultTotal] = useState(0);
  const [consultSearch, setConsultSearch] = useState('');
  const [consultDetailId, setConsultDetailId] = useState<string | null>(null);
  const [consultDetail, setConsultDetail] = useState<any>(null);

  // API key 입력 상태
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');

  // CSV export — 훅 순서 보존을 위해 early return 앞에서 선언
  const [exporting, setExporting] = useState(false);

  // sessionStorage에서 저장된 API key 복원
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('admin:apiKey');
      if (saved) setToken(saved);
    } catch { /* ignore */ }
  }, []);

  /**
   * 공통 어드민 fetcher — sessionStorage 경유.
   *  - force=true: 캐시 무시 + 서버 캐시도 force=1 로 무효화
   *  - force=false: stale sessionStorage 를 즉시 반영 + 백그라운드 갱신
   */
  const adminFetch = useCallback(async <T,>(path: string, force = false): Promise<T | null> => {
    if (!token) return null;
    const cacheKey = `admin:${path}`;
    const STALE_MS = 30_000;

    // 1) sessionStorage 히트 — fresh 면 즉시 반환, stale 이면 일단 표시하고 백그라운드 재호출
    let staleData: T | null = null;
    if (!force) {
      try {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          const { data, savedAt } = JSON.parse(raw);
          const age = Date.now() - savedAt;
          if (age <= STALE_MS) return data as T;
          staleData = data as T;
        }
      } catch { /* ignore */ }
    }

    const url = force ? path + (path.includes('?') ? '&' : '?') + 'force=1' : path;
    const res = await fetch(url, { headers: { 'x-admin-key': token } });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ data: json, savedAt: Date.now() }));
    } catch { /* storage quota */ }
    // staleData 가 있었다면 이미 UI 에 표시됐을 수 있음 — 어쨌든 최신으로 덮어씀
    return (json ?? staleData) as T;
  }, [token]);

  const fetchStats = useCallback(async (force = false) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminFetch<Stats>('/api/admin/stats', force);
      if (data) setStats(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, adminFetch]);

  const fetchMemberSummary = useCallback(async (force = false) => {
    if (!token) return;
    try {
      const data = await adminFetch<MemberSummary>('/api/admin/users/summary', force);
      if (data) setMemberSummary(data);
    } catch (e: any) { setError(e.message); }
  }, [token, adminFetch]);

  const fetchMembers = useCallback(async (force = false) => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(memberPage),
        search: memberSearch,
        gender: memberGender,
        ageBucket: memberAgeBucket,
        segment: memberSegment,
        provider: memberProvider,
        sort: memberSort,
        order: memberOrder,
      });
      const data = await adminFetch<{ users: MemberRow[]; total: number }>(`/api/admin/users?${params}`, force);
      if (data) { setMembers(data.users); setMemberTotal(data.total); }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, adminFetch, memberPage, memberSearch, memberGender, memberAgeBucket, memberSegment, memberProvider, memberSort, memberOrder]);

  const fetchDeletedMembers = useCallback(async (force = false) => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(deletedPage), search: deletedSearch });
      const data = await adminFetch<{ items: DeletedMember[]; total: number; reasonCounts: Record<string, number> }>(`/api/admin/account-deletions?${params}`, force);
      if (data) {
        setDeletedMembers(data.items);
        setDeletedTotal(data.total);
        setDeletedReasonCounts(data.reasonCounts ?? {});
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, adminFetch, deletedPage, deletedSearch]);

  const fetchOrders = useCallback(async (force = false) => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(orderPage), status: orderStatus, search: orderSearch });
      const data = await adminFetch<{ orders: Order[]; total: number }>(`/api/admin/orders?${params}`, force);
      if (data) { setOrders(data.orders); setOrderTotal(data.total); }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, adminFetch, orderPage, orderStatus, orderSearch]);

  const fetchOrdersSummary = useCallback(async (force = false) => {
    if (!token) return;
    try {
      const data = await adminFetch<OrdersSummary>('/api/admin/orders/summary', force);
      if (data) setOrdersSummary(data);
    } catch (e: any) { setError(e.message); }
  }, [token, adminFetch]);

  const fetchUsageSummary = useCallback(async (force = false) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminFetch<UsageSummary>('/api/admin/usage/summary', force);
      if (data) setUsageSummary(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, adminFetch]);

  const fetchCreditsSummary = useCallback(async (force = false) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminFetch<CreditsSummary>('/api/admin/credits/summary', force);
      if (data) setCreditsSummary(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, adminFetch]);

  const fetchOpsSummary = useCallback(async (force = false) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminFetch<OpsSummary>('/api/admin/ops/summary', force);
      if (data) setOpsSummary(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, adminFetch]);

  const fetchAuditLogs = useCallback(async (force = false) => {
    if (!token) return;
    try {
      const data = await adminFetch<{ logs: AuditLog[]; total: number; warning?: string }>('/api/admin/audit?pageSize=50', force);
      if (data) {
        setAuditLogs(data.logs ?? []);
        setAuditWarning(data.warning);
      }
    } catch (e: any) { setError(e.message); }
  }, [token, adminFetch]);

  const fetchInsights = useCallback(async (force = false) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminFetch<Insights>('/api/admin/insights', force);
      if (data) setInsights(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, adminFetch]);

  const fetchConsultations = useCallback(async (force = false) => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(consultPage), search: consultSearch });
      const data = await adminFetch<{ records: ConsultationRecord[]; total: number; grandTotal: number }>(`/api/admin/consultations?${params}`, force);
      if (data) { setConsultations(data.records); setConsultTotal(data.total); }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, adminFetch, consultPage, consultSearch]);

  const fetchConsultDetail = useCallback(async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/consultations/${id}`, { headers: { 'x-admin-key': token ?? '' } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setConsultDetail(json);
    } catch (e: any) { setError(e.message); }
  }, [token]);

  const fetchRecords = useCallback(async (force = false) => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(recordPage), type: recordType, category: recordCategory });
      const data = await adminFetch<{ records: UsageRecord[]; total: number; categorySummary: Record<string, number> }>(`/api/admin/records?${params}`, force);
      if (data) { setRecords(data.records); setRecordTotal(data.total); setCategorySummary(data.categorySummary ?? {}); }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, adminFetch, recordPage, recordType, recordCategory]);

  // ── 탭 진입 시: 이미 state 에 데이터 있으면 스킵, 없으면 fetch
  useEffect(() => { if (tab === 'overview' && !stats) fetchStats(); }, [tab, stats, fetchStats]);
  useEffect(() => {
    if (tab !== 'members') return;
    if (memberSubTab === 'active') {
      if (!memberSummary) fetchMemberSummary();
      if (members.length === 0) fetchMembers();
    } else {
      if (deletedMembers.length === 0) fetchDeletedMembers();
    }
  }, [tab, memberSubTab, memberSummary, members.length, deletedMembers.length, fetchMemberSummary, fetchMembers, fetchDeletedMembers]);
  useEffect(() => {
    if (tab !== 'orders') return;
    if (!ordersSummary) fetchOrdersSummary();
    if (orders.length === 0) fetchOrders();
  }, [tab, ordersSummary, orders.length, fetchOrdersSummary, fetchOrders]);
  useEffect(() => { if (tab === 'usage' && !usageSummary) fetchUsageSummary(); }, [tab, usageSummary, fetchUsageSummary]);
  useEffect(() => { if (tab === 'credits' && !creditsSummary) fetchCreditsSummary(); }, [tab, creditsSummary, fetchCreditsSummary]);
  useEffect(() => {
    if (tab !== 'ops') return;
    if (!opsSummary) fetchOpsSummary();
    if (auditLogs.length === 0 && !auditWarning) fetchAuditLogs();
  }, [tab, opsSummary, auditLogs.length, auditWarning, fetchOpsSummary, fetchAuditLogs]);
  useEffect(() => { if (tab === 'insights' && !insights) fetchInsights(); }, [tab, insights, fetchInsights]);
  useEffect(() => { if (tab === 'records' && records.length === 0) fetchRecords(); }, [tab, records.length, fetchRecords]);
  useEffect(() => { if (tab === 'consultations' && consultations.length === 0) fetchConsultations(); }, [tab, consultations.length, fetchConsultations]);

  // ── 필터·정렬 변경 시 members 재호출
  const memberFilterKey = `${memberSearch}|${memberGender}|${memberAgeBucket}|${memberSegment}|${memberProvider}|${memberSort}|${memberOrder}|${memberPage}`;
  const lastMemberFilterKey = useRef<string>('');
  useEffect(() => {
    if (tab !== 'members') return;
    if (lastMemberFilterKey.current === memberFilterKey) return;
    lastMemberFilterKey.current = memberFilterKey;
    fetchMembers();
  }, [tab, memberFilterKey, fetchMembers]);

  // ── deleted members 필터 변경 시 재호출
  const deletedFilterKey = `${deletedSearch}|${deletedPage}`;
  const lastDeletedFilterKey = useRef<string>('');
  useEffect(() => {
    if (tab !== 'members' || memberSubTab !== 'deleted') return;
    if (lastDeletedFilterKey.current === deletedFilterKey) return;
    lastDeletedFilterKey.current = deletedFilterKey;
    fetchDeletedMembers();
  }, [tab, memberSubTab, deletedFilterKey, fetchDeletedMembers]);

  // ── orders 필터 변경 시 재호출
  const orderFilterKey = `${orderStatus}|${orderSearch}|${orderPage}`;
  const lastOrderFilterKey = useRef<string>('');
  useEffect(() => {
    if (tab !== 'orders') return;
    if (lastOrderFilterKey.current === orderFilterKey) return;
    lastOrderFilterKey.current = orderFilterKey;
    fetchOrders();
  }, [tab, orderFilterKey, fetchOrders]);

  // ── records 필터 변경 시 재호출
  const recordFilterKey = `${recordType}|${recordCategory}|${recordPage}`;
  const lastRecordFilterKey = useRef<string>('');
  useEffect(() => {
    if (tab !== 'records') return;
    if (lastRecordFilterKey.current === recordFilterKey) return;
    lastRecordFilterKey.current = recordFilterKey;
    fetchRecords();
  }, [tab, recordFilterKey, fetchRecords]);

  // ── consultations 필터 변경 시 재호출
  const consultFilterKey = `${consultSearch}|${consultPage}`;
  const lastConsultFilterKey = useRef<string>('');
  useEffect(() => {
    if (tab !== 'consultations') return;
    if (lastConsultFilterKey.current === consultFilterKey) return;
    lastConsultFilterKey.current = consultFilterKey;
    fetchConsultations();
  }, [tab, consultFilterKey, fetchConsultations]);

  // 검색·필터 바뀌면 1페이지로
  useEffect(() => { setMemberPage(1); }, [memberSearch, memberGender, memberAgeBucket, memberSegment, memberProvider, memberSort, memberOrder]);
  useEffect(() => { setDeletedPage(1); }, [deletedSearch]);

  const handleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setKeyError('');
    if (!keyInput.trim()) { setKeyError('인증키를 입력해주세요.'); return; }
    try {
      const res = await fetch('/api/admin/stats', { headers: { 'x-admin-key': keyInput.trim() } });
      if (res.ok) {
        setToken(keyInput.trim());
        try { sessionStorage.setItem('admin:apiKey', keyInput.trim()); } catch {}
      } else {
        const json = await res.json().catch(() => ({}));
        setKeyError(json.error || '인증에 실패했습니다.');
      }
    } catch {
      setKeyError('서버에 연결할 수 없습니다.');
    }
  };

  const handleLogoutAdmin = () => {
    setToken(null);
    try { sessionStorage.removeItem('admin:apiKey'); } catch {}
  };

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0614]">
      <form onSubmit={handleKeySubmit} className="w-full max-w-[380px] p-6 rounded-2xl bg-white/5 border border-white/10">
        <h1 className="text-[18px] font-bold text-text-primary mb-1">사주 어드민</h1>
        <p className="text-[13px] text-text-tertiary mb-5">관리자 인증키를 입력하세요.</p>
        {keyError && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[13px] text-red-300">
            {keyError}
          </div>
        )}
        <input
          type="password"
          value={keyInput}
          onChange={e => setKeyInput(e.target.value)}
          placeholder="Admin API Key"
          autoFocus
          className="w-full h-11 rounded-lg bg-white/5 border border-white/15 px-3 text-text-primary text-sm outline-none focus:border-cta/50 focus:ring-1 focus:ring-cta/30 mb-3"
        />
        <button
          type="submit"
          className="w-full h-11 rounded-lg bg-cta text-white font-bold text-sm hover:opacity-90 transition-all"
        >
          접속
        </button>
      </form>
    </div>
  );

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: '대시보드' },
    { key: 'members',  label: `회원 관리${memberSummary?.kpi?.totalUsers !== undefined ? ` (${memberSummary.kpi.totalUsers})` : ''}` },
    { key: 'orders',   label: `매출·결제 (${orderTotal || '…'})` },
    { key: 'usage',    label: `이용 분석${usageSummary?.kpi?.grandTotal !== undefined ? ` (${usageSummary.kpi.grandTotal})` : ''}` },
    { key: 'credits',  label: `크레딧 흐름${creditsSummary?.kpi?.txnCount !== undefined ? ` (${creditsSummary.kpi.txnCount})` : ''}` },
    { key: 'records',  label: `이용 기록 (${recordTotal || '…'})` },
    { key: 'consultations', label: `상담소 (${consultTotal || '…'})` },
    { key: 'ops',      label: `운영${opsSummary?.kpi ? ` (${(opsSummary.kpi.bannedCount ?? 0) + (opsSummary.kpi.notedCount ?? 0)})` : ''}` },
    { key: 'insights', label: '인사이트' },
  ];

  // ── CSV export ──
  const exportMembersCsv = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const params = new URLSearchParams({
        page: '1', pageSize: '5000',
        search: memberSearch, gender: memberGender,
        ageBucket: memberAgeBucket, segment: memberSegment,
        provider: memberProvider,
        sort: memberSort, order: memberOrder,
      });
      const res = await fetch(`/api/admin/users?${params}`, { headers: { 'x-admin-key': token ?? '' } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '실패');
      const rows = (json.users as MemberRow[]).map(u => [
        u.email, PROVIDER_LABEL[u.provider] ?? u.provider,
        GENDER_LABEL[u.gender] ?? u.gender, u.age ?? '', u.birthDate ?? '',
        u.ageBucket, u.segments?.join('|') ?? '',
        u.moonBalance,
        u.totalSpent, u.orderCount, u.sajuCount, u.tarotCount,
        u.createdAt, u.lastSignIn ?? '', u.lastAnalysisAt ?? '',
        u.daysSinceLastActivity ?? '',
      ]);
      const csv = toCsv(
        ['이메일', '가입경로', '성별', '나이', '생년월일', '연령대', '세그먼트',
         '🌙 잔액', '누적결제', '주문수', '사주이용', '타로이용',
         '가입일', '최종로그인', '최종이용', '미접속일'],
        rows,
      );
      downloadCsv(`members-${timestampSuffix()}.csv`, csv);
    } catch (e: any) { setError(e.message); }
    finally { setExporting(false); }
  };

  const exportOrdersCsv = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '10000', status: orderStatus, search: orderSearch });
      const res = await fetch(`/api/admin/orders?${params}`, { headers: { 'x-admin-key': token ?? '' } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '실패');
      const rows = (json.orders as Order[]).map(o => [
        o.id, o.userEmail,
        ORDER_STATUS_LABEL[o.status]?.text ?? o.status,
        o.package_name, o.package_id,
        o.amount, o.moon_credit_amount,
        o.payment_method ?? '', o.created_at, o.completed_at ?? '',
      ]);
      const csv = toCsv(
        ['주문ID', '이메일', '상태', '패키지', '패키지ID', '금액', '🌙', '결제수단', '생성일', '완료일'],
        rows,
      );
      downloadCsv(`orders-${timestampSuffix()}.csv`, csv);
    } catch (e: any) { setError(e.message); }
    finally { setExporting(false); }
  };

  const exportRecordsCsv = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '10000', type: recordType, category: recordCategory });
      const res = await fetch(`/api/admin/records?${params}`, { headers: { 'x-admin-key': token ?? '' } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '실패');
      const rows = (json.records as UsageRecord[]).map(r => [
        r.userEmail,
        recordType === 'saju'
          ? (SAJU_CATEGORY_LABEL[r.category ?? ''] ?? r.category ?? '')
          : (TAROT_SPREAD_LABEL[r.spread_type ?? ''] ?? r.spread_type ?? ''),
        r.credit_used, r.created_at,
      ]);
      const csv = toCsv(['이메일', '서비스', '🌙 소비량', '일시'], rows);
      downloadCsv(`${recordType}-records-${timestampSuffix()}.csv`, csv);
    } catch (e: any) { setError(e.message); }
    finally { setExporting(false); }
  };

  const refreshCurrentTab = () => {
    setError('');
    if (tab === 'overview') fetchStats(true);
    else if (tab === 'members') {
      if (memberSubTab === 'active') { fetchMemberSummary(true); fetchMembers(true); }
      else fetchDeletedMembers(true);
    }
    else if (tab === 'orders') { fetchOrdersSummary(true); fetchOrders(true); }
    else if (tab === 'usage') fetchUsageSummary(true);
    else if (tab === 'credits') fetchCreditsSummary(true);
    else if (tab === 'consultations') fetchConsultations(true);
    else if (tab === 'ops') { fetchOpsSummary(true); fetchAuditLogs(true); }
    else if (tab === 'insights') fetchInsights(true);
    else fetchRecords(true);
  };

  return (
    <div className="min-h-screen bg-[#0a0614] text-text-primary">
      {/* 헤더 — 뒤로가기 + 타이틀 */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* 어드민 → 홈 빠른 이동. (단순 a 태그 — 이 파일에서 router 미참조라 의존 추가 안 함) */}
          <a
            href="/"
            aria-label="홈으로"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary -ml-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </a>
          <div>
            <h1 className="text-[18px] font-bold text-text-primary">사주 어드민</h1>
            <p className="text-[13px] text-text-tertiary mt-0.5">Admin Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(tab === 'members' || tab === 'orders' || tab === 'records' || tab === 'consultations') && (
            <button
              onClick={tab === 'members' ? exportMembersCsv : tab === 'orders' ? exportOrdersCsv : tab === 'consultations' ? exportRecordsCsv : exportRecordsCsv}
              disabled={exporting}
              className="text-[13px] text-text-secondary hover:text-text-primary border border-white/15 hover:border-white/30 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
            >
              {exporting ? '다운로드 중…' : '📥 CSV 다운로드'}
            </button>
          )}
          <button
            onClick={refreshCurrentTab}
            className="text-[14px] text-cta hover:text-cta/80 border border-cta/30 hover:border-cta/60 px-3 py-1.5 rounded-lg transition-all"
          >
            새로고침
          </button>
          <button
            onClick={handleLogoutAdmin}
            className="text-[13px] text-text-tertiary hover:text-red-300 border border-white/10 hover:border-red-500/30 px-3 py-1.5 rounded-lg transition-all"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className="border-b border-white/10 px-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setError(''); }}
            className={`px-4 py-3 text-[15px] font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.key ? 'border-cta text-cta' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-6 py-6 max-w-[1400px] mx-auto">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-[15px] text-red-300">
            {error}
          </div>
        )}
        {loading && (
          <div className="mb-4 text-[14px] text-text-tertiary">로딩 중…</div>
        )}

        {/* ── 대시보드 ── */}
        {tab === 'overview' && stats && (
          <div className="space-y-6">
            <div>
              <h2 className="text-[15px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">사용자</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="총 사용자" value={fmt(stats.users.total)} />
                <MetricCard label="오늘 신규" value={fmt(stats.users.today)} color="text-cta" />
                <MetricCard label="이번 달 신규" value={fmt(stats.users.thisMonth)} />
                <MetricCard label="총 결제 완료" value={fmt(stats.orders.completed)} sub={`환불 ${stats.orders.refunded}건 (${stats.orders.refundRate}%)`} />
              </div>
            </div>

            <div>
              <h2 className="text-[15px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">매출</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="총 매출" value={fmtWon(stats.revenue.total)} />
                <MetricCard
                  label="이번 달 매출"
                  value={fmtWon(stats.revenue.thisMonth)}
                  sub={stats.revenue.growth !== null ? `전월 대비 ${stats.revenue.growth > 0 ? '+' : ''}${stats.revenue.growth}%` : undefined}
                  color={stats.revenue.growth !== null && stats.revenue.growth > 0 ? 'text-green-300' : undefined}
                />
                <MetricCard label="지난 달 매출" value={fmtWon(stats.revenue.prevMonth)} />
                <MetricCard label="환불 금액" value={fmtWon(stats.revenue.refunded)} color="text-red-300" />
              </div>
            </div>

            <div>
              <h2 className="text-[15px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">서비스 이용</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <MetricCard label="사주 분석 (누적)" value={fmt(stats.usage.sajuTotal)} sub={`오늘 ${fmt(stats.usage.sajuToday)}`} />
                <MetricCard label="타로 분석 (누적)" value={fmt(stats.usage.tarotTotal)} sub={`오늘 ${fmt(stats.usage.tarotToday)}`} />
                <MetricCard label="상담소 대화 (누적)" value={fmt(stats.usage.consultTotal ?? 0)} sub={`오늘 ${fmt(stats.usage.consultToday ?? 0)}`} />
              </div>
            </div>

            <div>
              <h2 className="text-[15px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">크레딧 현황 (🌙 단일 단위)</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <MetricCard label="🌙 달 발행" value={fmt(stats.credits.moon.issued)} sub={`소비 ${fmt(stats.credits.moon.consumed)} / 잔여 ${fmt(stats.credits.moon.balance)}`} />
                <MetricCard
                  label="크레딧 소비율"
                  value={stats.credits.moon.issued > 0 ? `🌙 ${Math.round(stats.credits.moon.consumed / stats.credits.moon.issued * 100)}%` : '-'}
                />
              </div>
            </div>

            {/* ── 일별 시계열 ── */}
            {stats.daily && stats.daily.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-[15px] font-semibold text-text-secondary uppercase tracking-wider">일별 추이</h2>
                  <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
                    {([7, 30] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => setDailyRange(r)}
                        className={`px-3 py-1 rounded text-[13px] font-medium transition-colors ${dailyRange === r ? 'bg-cta text-white' : 'text-text-tertiary hover:text-text-secondary'}`}
                      >
                        {r}일
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <TrendCard
                    title="매출"
                    unit="원"
                    data={stats.daily.slice(-dailyRange)}
                    field="revenue"
                    color="rgba(52, 211, 153, 0.75)"
                    totalLabel="합계"
                  />
                  <TrendCard
                    title="신규 가입"
                    unit="명"
                    data={stats.daily.slice(-dailyRange)}
                    field="signups"
                    color="rgba(96, 165, 250, 0.75)"
                    totalLabel="합계"
                  />
                  <TrendCard
                    title="서비스 이용"
                    unit="건"
                    data={stats.daily.slice(-dailyRange)}
                    field="usage"
                    color="rgba(251, 191, 36, 0.75)"
                    totalLabel="합계"
                    sub={(data) => {
                      const saju = data.reduce((s, d) => s + d.saju, 0);
                      const tarot = data.reduce((s, d) => s + d.tarot, 0);
                      return `사주 ${saju.toLocaleString()} · 타로 ${tarot.toLocaleString()}`;
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 회원 관리 ── */}
        {tab === 'members' && (
          <div className="space-y-6">
            {/* 서브탭 토글 */}
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10 w-fit">
              {(['active', 'deleted'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setMemberSubTab(st)}
                  className={`px-4 py-1.5 rounded text-[14px] font-medium transition-colors ${memberSubTab === st ? 'bg-cta text-white' : 'text-text-tertiary hover:text-text-secondary'}`}
                >
                  {st === 'active' ? '활성 회원' : '탈퇴 회원'}
                </button>
              ))}
            </div>

            {/* ── 활성 회원 ── */}
            {memberSubTab === 'active' && (
              <>
                <DemographicsSummary
                  summary={memberSummary}
                  activeSegment={memberSegment}
                  onSegmentChange={setMemberSegment}
                />

                <BulkActionBar
                  selectedIds={selectedIds}
                  token={token}
                  onClearSelection={() => setSelectedIds(new Set())}
                  onDone={() => { setSelectedIds(new Set()); fetchMembers(true); fetchMemberSummary(true); }}
                />

                <div className="space-y-3">
                  <MembersFilterBar
                    search={memberSearch} onSearchChange={setMemberSearch}
                    gender={memberGender} onGenderChange={setMemberGender}
                    ageBucket={memberAgeBucket} onAgeBucketChange={setMemberAgeBucket}
                    provider={memberProvider} onProviderChange={setMemberProvider}
                    totalCount={memberTotal}
                  />
                  <MembersTable
                    rows={members}
                    loading={loading}
                    sort={memberSort}
                    order={memberOrder}
                    onSortChange={(s, o) => { setMemberSort(s); setMemberOrder(o); }}
                    onRowClick={setSelectedUserId}
                    selectedIds={selectedIds}
                    onToggleSelect={id => {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id); else next.add(id);
                        return next;
                      });
                    }}
                    onToggleAll={() => {
                      setSelectedIds(prev => {
                        const allVisible = members.every(m => prev.has(m.id));
                        if (allVisible) {
                          const next = new Set(prev);
                          for (const m of members) next.delete(m.id);
                          return next;
                        }
                        const next = new Set(prev);
                        for (const m of members) next.add(m.id);
                        return next;
                      });
                    }}
                  />
                  <Pagination page={memberPage} total={memberTotal} pageSize={20} onChange={setMemberPage} />
                </div>
              </>
            )}

            {/* ── 탈퇴 회원 ── */}
            {memberSubTab === 'deleted' && (
              <DeletedMembersPanel
                items={deletedMembers}
                total={deletedTotal}
                page={deletedPage}
                search={deletedSearch}
                reasonCounts={deletedReasonCounts}
                loading={loading}
                onSearchChange={v => { setDeletedSearch(v); setDeletedPage(1); }}
                onPageChange={setDeletedPage}
              />
            )}
          </div>
        )}

        {/* ── 주문 ── */}
        {tab === 'orders' && (
          <div className="space-y-6">
            <OrdersSummarySection summary={ordersSummary} />

            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder="이메일 / 주문 ID 검색"
                value={orderSearch}
                onChange={e => { setOrderSearch(e.target.value); setOrderPage(1); }}
                className="flex-1 max-w-sm px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[15px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-cta/50"
              />
              <select
                value={orderStatus}
                onChange={e => { setOrderStatus(e.target.value); setOrderPage(1); }}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[15px] text-text-primary focus:outline-none focus:border-cta/50"
              >
                <option value="">전체 상태</option>
                <option value="completed">완료</option>
                <option value="pending">대기</option>
                <option value="refunded">환불</option>
                <option value="failed">실패</option>
              </select>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3">
                    {['상태', '사용자', '패키지', '결제금액', '🌙 크레딧', '결제수단', '결제일시'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[12px] text-text-tertiary uppercase tracking-wider font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-3 py-2.5"><Badge status={o.status} /></td>
                      <td className="px-3 py-2.5 text-text-secondary max-w-[180px] truncate">{o.userEmail}</td>
                      <td className="px-3 py-2.5 text-text-primary">{o.package_name}</td>
                      <td className="px-3 py-2.5 text-text-primary font-medium">{fmtWon(o.amount)}</td>
                      <td className="px-3 py-2.5 text-indigo-300">🌙 {o.moon_credit_amount}</td>
                      <td className="px-3 py-2.5 text-text-tertiary">{o.payment_method ?? '-'}</td>
                      <td className="px-3 py-2.5 text-text-tertiary">{fmtDate(o.created_at)}</td>
                    </tr>
                  ))}
                  {orders.length === 0 && !loading && (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-text-tertiary">데이터 없음</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination page={orderPage} total={orderTotal} pageSize={20} onChange={setOrderPage} />
          </div>
        )}

        {/* ── 이용 분석 ── */}
        {tab === 'usage' && (
          <UsageAnalyticsSection summary={usageSummary} />
        )}

        {/* ── 크레딧 흐름 ── */}
        {tab === 'credits' && (
          <CreditsFlowSection summary={creditsSummary} />
        )}

        {/* ── 운영 ── */}
        {tab === 'ops' && (
          <div className="space-y-6">
            <OpsSection summary={opsSummary} onOpenUser={setSelectedUserId} />
            <AuditLogSection logs={auditLogs} warning={auditWarning} onOpenUser={setSelectedUserId} />
          </div>
        )}

        {/* ── 인사이트 ── */}
        {tab === 'insights' && (
          <InsightsSection insights={insights} onOpenUser={setSelectedUserId} />
        )}

        {/* ── 이용 기록 ── */}
        {tab === 'records' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
                {(['saju', 'tarot'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setRecordType(t); setRecordCategory(''); setRecordPage(1); }}
                    className={`px-3 py-1.5 rounded text-[14px] font-medium transition-colors ${recordType === t ? 'bg-cta text-white' : 'text-text-tertiary hover:text-text-secondary'}`}
                  >
                    {t === 'saju' ? '사주 분석' : '타로 분석'}
                  </button>
                ))}
              </div>

              {Object.keys(categorySummary).length > 0 && (
                <select
                  value={recordCategory}
                  onChange={e => { setRecordCategory(e.target.value); setRecordPage(1); }}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[15px] text-text-primary focus:outline-none focus:border-cta/50"
                >
                  <option value="">전체 카테고리</option>
                  {Object.entries(categorySummary).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([cat, cnt]) => (
                    <option key={cat} value={cat}>
                      {(recordType === 'tarot' ? TAROT_SPREAD_LABEL[cat] : SAJU_CATEGORY_LABEL[cat]) ?? cat} ({fmt(cnt as number)})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 카테고리 분포 */}
            {Object.keys(categorySummary).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(categorySummary).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([cat, cnt]) => {
                  const total = Object.values(categorySummary).reduce((s: number, v) => s + (v as number), 0);
                  const label = (recordType === 'tarot' ? TAROT_SPREAD_LABEL[cat] : SAJU_CATEGORY_LABEL[cat]) ?? cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => { setRecordCategory(recordCategory === cat ? '' : cat); setRecordPage(1); }}
                      className={`px-2.5 py-1 rounded-full text-[13px] border transition-all ${recordCategory === cat ? 'bg-cta/20 border-cta/50 text-cta' : 'bg-white/5 border-white/10 text-text-secondary hover:border-white/20'}`}
                    >
                      {label} <span className="text-text-tertiary">{Math.round((cnt as number) / total * 100)}%</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3">
                    {['사용자', '프로필', '서비스', '🌙 소비', '일시'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[12px] text-text-tertiary uppercase tracking-wider font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-3 py-2.5 text-text-secondary max-w-[180px] truncate">{r.userEmail}</td>
                      <td className="px-3 py-2.5 text-text-tertiary max-w-[100px] truncate">{r.profile_name ?? '-'}</td>
                      <td className="px-3 py-2.5 text-text-primary">
                        {SAJU_CATEGORY_LABEL[r.category ?? ''] ?? TAROT_SPREAD_LABEL[r.spread_type ?? ''] ?? (r.category ?? r.spread_type ?? '-')}
                      </td>
                      <td className="px-3 py-2.5 text-text-secondary tabular-nums">🌙 {r.credit_used}</td>
                      <td className="px-3 py-2.5 text-text-tertiary">{fmtDate(r.created_at)}</td>
                    </tr>
                  ))}
                  {records.length === 0 && !loading && (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-text-tertiary">데이터 없음</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination page={recordPage} total={recordTotal} pageSize={30} onChange={setRecordPage} />
          </div>
        )}

        {/* ── 상담소 ── */}
        {tab === 'consultations' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder="프로필명 / 대화 제목 검색"
                value={consultSearch}
                onChange={e => { setConsultSearch(e.target.value); setConsultPage(1); }}
                className="flex-1 max-w-sm px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[15px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-cta/50"
              />
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3">
                    {['사용자', '프로필', '대화 제목', '메시지 수', '마지막 메시지', '생성일'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[12px] text-text-tertiary uppercase tracking-wider font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {consultations.map(c => (
                    <tr
                      key={c.id}
                      onClick={() => { setConsultDetailId(c.id); fetchConsultDetail(c.id); }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <td className="px-3 py-2.5 text-text-secondary max-w-[200px] truncate">{c.userEmail}</td>
                      <td className="px-3 py-2.5 text-text-primary">{c.profile_name ?? '-'}</td>
                      <td className="px-3 py-2.5 text-text-primary font-medium max-w-[200px] truncate">{c.title}</td>
                      <td className="px-3 py-2.5 text-center text-text-secondary tabular-nums">{c.message_count}</td>
                      <td className="px-3 py-2.5 text-text-tertiary">{fmtDate(c.last_message_at)}</td>
                      <td className="px-3 py-2.5 text-text-tertiary">{fmtDate(c.created_at)}</td>
                    </tr>
                  ))}
                  {consultations.length === 0 && !loading && (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-text-tertiary">상담 기록 없음</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination page={consultPage} total={consultTotal} pageSize={30} onChange={setConsultPage} />
          </div>
        )}

        {/* ── 상담 상세 모달 ── */}
        {consultDetailId && consultDetail && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => { setConsultDetailId(null); setConsultDetail(null); }} />
            <div className="relative w-full max-w-[640px] max-h-[80vh] bg-[#0a0614] border border-white/15 rounded-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div>
                  <p className="text-[12px] text-text-tertiary uppercase tracking-wider">상담 대화 상세</p>
                  <h3 className="text-[16px] font-bold text-text-primary">{consultDetail.title}</h3>
                  <p className="text-[12px] text-text-tertiary mt-0.5">
                    {consultDetail.userEmail} · {consultDetail.profile_name ?? '프로필 미등록'} · {consultDetail.message_count}개 메시지
                  </p>
                </div>
                <button onClick={() => { setConsultDetailId(null); setConsultDetail(null); }} className="text-text-tertiary hover:text-text-primary text-[20px] px-2">×</button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {(consultDetail.messages ?? []).map((msg: any, idx: number) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-cta/80 text-white rounded-tr-sm'
                        : 'bg-white/5 border border-white/10 text-text-secondary rounded-tl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {(!consultDetail.messages || consultDetail.messages.length === 0) && (
                  <p className="text-center text-text-tertiary text-[13px]">메시지 없음</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 회원 상세 Drawer ── */}
      {selectedUserId && (
        <MemberDetailDrawer
          userId={selectedUserId}
          token={token}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}

// ── 이용기간 포맷 ──────────────────────────────────────────────
function fmtDuration(from: string | null | undefined, to: string): string {
  if (!from) return '-';
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (isNaN(ms) || ms < 0) return '-';
  const days = Math.floor(ms / 86_400_000);
  if (days < 30) return `${days}일`;
  const months = Math.floor(days / 30);
  const rem = days % 30;
  return rem > 0 ? `${months}개월 ${rem}일` : `${months}개월`;
}

// ── 탈퇴 회원 패널 ─────────────────────────────────────────────
interface DeletedMembersPanelProps {
  items: DeletedMember[];
  total: number;
  page: number;
  search: string;
  reasonCounts: Record<string, number>;
  loading: boolean;
  onSearchChange: (v: string) => void;
  onPageChange: (p: number) => void;
}

function DeletedMembersPanel({
  items, total, page, search, reasonCounts, loading, onSearchChange, onPageChange,
}: DeletedMembersPanelProps) {
  const grandTotal = Object.values(reasonCounts).reduce((s, n) => s + n, 0);
  const reasonOrder = ['not_useful', 'rarely_used', 'hard_to_use', 'other', 'too_expensive', 'privacy', 'unknown'];
  const sortedReasons = Object.entries(reasonCounts).sort(([a], [b]) => {
    const ai = reasonOrder.indexOf(a);
    const bi = reasonOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="space-y-5">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 col-span-2 md:col-span-1">
          <p className="text-[13px] text-text-tertiary uppercase tracking-wider mb-1">총 탈퇴 수</p>
          <p className="text-[22px] font-bold text-text-primary">{grandTotal.toLocaleString('ko-KR')}</p>
        </div>
        {sortedReasons.map(([code, cnt]) => {
          const pct = grandTotal > 0 ? Math.round(cnt / grandTotal * 100) : 0;
          return (
            <div key={code} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-[13px] text-text-tertiary uppercase tracking-wider mb-1 truncate">
                {DELETION_REASON_LABEL[code] ?? code}
              </p>
              <p className="text-[22px] font-bold text-text-primary">{cnt.toLocaleString('ko-KR')}</p>
              <p className="text-[13px] text-text-tertiary mt-0.5">{pct}%</p>
            </div>
          );
        })}
      </div>

      {/* 검색 */}
      <input
        type="text"
        placeholder="이메일 검색"
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        className="w-full max-w-sm px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[15px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-cta/50"
      />

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-white/10 bg-white/3">
              {['이메일', '탈퇴 사유', '가입일', '탈퇴일', '이용기간', '누적결제', '크레딧 사용'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-[12px] text-text-tertiary uppercase tracking-wider font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(m => {
              const credit = m.metadata?.credit;
              const totalPurchased = credit ? credit.total_sun_purchased + credit.total_moon_purchased : 0;
              const totalConsumed = credit ? credit.total_sun_consumed + credit.total_moon_consumed : 0;
              const orderCount = m.metadata?.order_count ?? 0;
              const joinedAt = m.metadata?.created_at ?? null;
              return (
                <tr key={m.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-3 py-2.5 text-text-secondary max-w-[200px] truncate">{m.email}</td>
                  <td className="px-3 py-2.5 text-text-primary whitespace-nowrap">
                    {DELETION_REASON_LABEL[m.reason_code ?? 'unknown'] ?? (m.reason_code ?? '미선택')}
                  </td>
                  <td className="px-3 py-2.5 text-text-tertiary whitespace-nowrap">
                    {joinedAt ? new Date(joinedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-text-tertiary whitespace-nowrap">
                    {new Date(m.deleted_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                  </td>
                  <td className="px-3 py-2.5 text-text-secondary tabular-nums whitespace-nowrap">
                    {fmtDuration(joinedAt, m.deleted_at)}
                  </td>
                  <td className="px-3 py-2.5 text-text-secondary tabular-nums whitespace-nowrap">
                    {orderCount > 0 ? `${orderCount}건` : '-'}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {totalPurchased > 0 || totalConsumed > 0 ? (
                      <span className="text-indigo-300 tabular-nums">
                        🌙{credit?.total_moon_consumed ?? 0}
                      </span>
                    ) : (
                      <span className="text-text-tertiary">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-text-tertiary">탈퇴 회원 데이터 없음</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} pageSize={50} onChange={onPageChange} />
    </div>
  );
}

function Pagination({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2 justify-center pt-2">
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg text-[14px] bg-white/5 border border-white/10 text-text-secondary disabled:opacity-30 hover:border-white/20 transition-colors">이전</button>
      <span className="text-[14px] text-text-tertiary">{page} / {totalPages} (총 {total.toLocaleString()}건)</span>
      <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg text-[14px] bg-white/5 border border-white/10 text-text-secondary disabled:opacity-30 hover:border-white/20 transition-colors">다음</button>
    </div>
  );
}
