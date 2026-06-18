/**
 * 매출·결제 요약 — KPI + 패키지 도넛 + 결제수단 + 12개월 추이
 */
'use client';

import { DonutChart } from '@/components/admin/charts/DonutChart';
import { HorizontalBarChart } from '@/components/admin/charts/HorizontalBarChart';
import { VerticalBarChart } from '@/components/admin/charts/VerticalBarChart';

export interface OrdersSummary {
  kpi: {
    totalRevenue: number;
    refundedAmount: number;
    netRevenue: number;
    orderCount: number;
    refundCount: number;
    failCount: number;
    refundRate: number;
    failRate: number;
    arpu: number;
    ltv: number;
    aov: number;
    payingUsers: number;
    totalUsers: number;
    paidRate: number;
  };
  packages: { id: string; name: string; count: number; revenue: number }[];
  methods: { method: string; count: number; revenue: number }[];
  monthly: { month: string; revenue: number; refund: number; count: number; net: number }[];
  hourly?: number[];      // 0~23시(KST) 결제 건수
  peakHour?: number | null;
}

const DONUT_COLORS = [
  'rgba(96, 165, 250, 0.85)',   // blue
  'rgba(167, 139, 250, 0.85)',  // violet
  'rgba(52, 211, 153, 0.85)',   // emerald
  'rgba(251, 191, 36, 0.85)',   // amber
  'rgba(248, 113, 113, 0.85)',  // red
  'rgba(244, 114, 182, 0.85)',  // pink
  'rgba(129, 140, 248, 0.85)',  // indigo
];

const METHOD_LABEL: Record<string, string> = {
  CARD: '카드',
  VIRTUAL_ACCOUNT: '가상계좌',
  TRANSFER: '계좌이체',
  EASY_PAY: '간편결제',
  MOBILE: '휴대폰',
  card: '카드',
  kakaopay: '카카오페이',
  naverpay: '네이버페이',
  tosspay: '토스페이',
  payco: '페이코',
  '(미상)': '(미상)',
};

const fmt = (n: number) => n.toLocaleString('ko-KR');
const fmtWon = (n: number) => `${n.toLocaleString('ko-KR')}원`;

export function OrdersSummarySection({ summary }: { summary: OrdersSummary | null }) {
  if (!summary) {
    return (
      <div className="text-[14px] text-text-tertiary py-6">요약 데이터 로딩 중…</div>
    );
  }

  const kpi = summary.kpi ?? {
    totalRevenue: 0, refundedAmount: 0, netRevenue: 0,
    orderCount: 0, refundCount: 0, failCount: 0,
    refundRate: 0, failRate: 0,
    arpu: 0, ltv: 0, aov: 0,
    payingUsers: 0, totalUsers: 0, paidRate: 0,
  };
  const packages = Array.isArray(summary.packages) ? summary.packages : [];
  const methods = Array.isArray(summary.methods) ? summary.methods : [];
  const monthly = Array.isArray(summary.monthly) ? summary.monthly : [];

  // 패키지별 도넛 = 판매 "건수" 기준(어느 패키지가 가장 많이 팔리는지). 금액 아님.
  const totalPackageCount = packages.reduce((s, p) => s + p.count, 0);
  const packageSlices = [...packages]
    .sort((a, b) => b.count - a.count)
    .slice(0, 7)
    .map((p, i) => ({
      key: p.id,
      label: p.name,
      value: p.count,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    }));

  const methodBars = methods.map((m, i) => ({
    key: m.method,
    label: METHOD_LABEL[m.method] ?? m.method,
    value: m.revenue,
    color: DONUT_COLORS[i % DONUT_COLORS.length],
  }));

  const monthlyBars = monthly.map(m => ({
    key: m.month,
    label: m.month.slice(5), // MM
    value: m.net,
  }));

  const hourly = Array.isArray(summary.hourly) && summary.hourly.length === 24
    ? summary.hourly
    : new Array(24).fill(0);
  const hourlyBars = hourly.map((c, h) => ({
    key: String(h),
    label: h % 3 === 0 ? `${h}시` : '', // 3시간 간격만 라벨(가독성)
    value: c,
  }));
  const peakHour = summary.peakHour ?? null;

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div>
        <h2 className="text-[14px] font-semibold text-text-secondary mb-3">매출 지표</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="순매출" value={fmtWon(kpi.netRevenue)} sub={`총 ${fmtWon(kpi.totalRevenue)} - 환불 ${fmtWon(kpi.refundedAmount)}`} />
          <KpiCard label="결제 건수" value={`${fmt(kpi.orderCount)}건`} sub={`환불 ${kpi.refundCount}건 · 실패 ${kpi.failCount}건`} />
          <KpiCard label="환불률" value={`${kpi.refundRate}%`} color={kpi.refundRate > 10 ? 'text-red-300' : undefined} sub={`실패율 ${kpi.failRate}%`} />
          <KpiCard label="평균 주문 금액" value={fmtWon(kpi.aov)} sub="AOV" />
          <KpiCard label="결제 회원" value={`${fmt(kpi.payingUsers)}명`} sub={`전체 ${fmt(kpi.totalUsers)}명의 ${kpi.paidRate}%`} />
          <KpiCard label="ARPU" value={fmtWon(kpi.arpu)} sub="결제회원 1인당 매출" />
          <KpiCard label="LTV" value={fmtWon(kpi.ltv)} sub="전체회원 1인당 매출" />
          <KpiCard label="순매출/결제회원" value={kpi.payingUsers > 0 ? fmtWon(Math.round(kpi.netRevenue / kpi.payingUsers)) : '-'} sub="환불 차감 후" />
        </div>
      </div>

      {/* 패키지 + 결제수단 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-[14px] font-semibold text-text-primary mb-3">패키지별 판매 비중 (건수)</h3>
          {packageSlices.length === 0
            ? <p className="text-[13px] text-text-tertiary py-6 text-center">데이터 없음</p>
            : <DonutChart
                slices={packageSlices}
                centerValue={fmt(totalPackageCount)}
                centerLabel="총 판매(건)"
              />}
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-[14px] font-semibold text-text-primary mb-3">결제수단 분포</h3>
          <HorizontalBarChart bars={methodBars} />
        </div>
      </div>

      {/* 12개월 추이 */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-[14px] font-semibold text-text-primary">월별 순매출 (12개월)</h3>
          <p className="text-[13px] text-text-tertiary">
            합계 <span className="text-text-primary font-medium">{fmtWon(monthly.reduce((s, m) => s + m.net, 0))}</span>
          </p>
        </div>
        <VerticalBarChart bars={monthlyBars} color="rgba(52, 211, 153, 0.75)" height={140} />
      </div>

      {/* 시간대별 결제 분포 (24시간, KST) */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-[14px] font-semibold text-text-primary">시간대별 결제 분포</h3>
          <p className="text-[13px] text-text-tertiary">
            {peakHour !== null
              ? <>피크 <span className="text-text-primary font-medium">{peakHour}시대</span> · 완료 결제 기준(KST)</>
              : '완료 결제 기준(KST)'}
          </p>
        </div>
        <VerticalBarChart bars={hourlyBars} color="rgba(96, 165, 250, 0.75)" height={140} />
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <p className="text-[13px] text-text-secondary mb-1">{label}</p>
      <p className={`text-[22px] font-bold ${color ?? 'text-text-primary'}`}>{value}</p>
      {sub && <p className="text-[12px] text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  );
}
