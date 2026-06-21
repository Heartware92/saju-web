/**
 * 크레딧 흐름 — 발행·소비·잔여·부채, reason별 소비, 12개월 추이
 */
'use client';

import { HorizontalBarChart } from '@/components/admin/charts/HorizontalBarChart';
import { VerticalBarChart } from '@/components/admin/charts/VerticalBarChart';
import { CREDIT_REASON_LABEL } from '@/constants/adminLabels';

export interface CreditsSummary {
  kpi: {
    moonIssued: number; moonConsumed: number; moonBalance: number;
    moonConsumeRate: number;
    debtWon: number;
    withMoon: number;
    txnCount: number;
    avgDepletionDays?: number;
    medianDepletionDays?: number;
    depletedLots?: number;
    outstandingPurchaseLots?: number;
  };
  reasonBreakdown: { reason: string; moon: number; count: number; total: number }[];
  monthly: {
    month: string;
    moonIssued: number; moonConsumed: number;
    netMoon: number;
  }[];
  txnTypes: { type: string; count: number }[];
}

const fmt = (n: number) => n.toLocaleString('ko-KR');
const fmtWon = (n: number) => `${n.toLocaleString('ko-KR')}원`;

const TXN_TYPE_LABEL: Record<string, string> = {
  purchase: '구매',
  consume: '소비',
  refund: '환불',
  signup_bonus: '가입 보너스',
  admin_adjust: '관리자 조정',
  expire: '유효기간 만료',
};

export function CreditsFlowSection({ summary }: { summary: CreditsSummary | null }) {
  if (!summary) return <div className="text-[14px] text-text-tertiary py-6">로딩 중…</div>;

  const kpi = summary.kpi ?? {
    moonIssued: 0, moonConsumed: 0, moonBalance: 0,
    moonConsumeRate: 0,
    debtWon: 0,
    withMoon: 0,
    txnCount: 0,
  };
  const reasonBreakdown = Array.isArray(summary.reasonBreakdown) ? summary.reasonBreakdown : [];
  const monthly = Array.isArray(summary.monthly) ? summary.monthly : [];
  const txnTypes = Array.isArray(summary.txnTypes) ? summary.txnTypes : [];

  const moonNetBars = monthly.map(m => ({
    key: m.month,
    label: m.month.slice(5),
    value: m.netMoon,
  }));

  const typeBars = txnTypes.map(t => ({
    key: t.type,
    label: TXN_TYPE_LABEL[t.type] ?? t.type,
    value: t.count,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[14px] font-semibold text-text-secondary mb-3">달 크레딧</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="발행" value={fmt(kpi.moonIssued)} />
          <Kpi label="소비" value={fmt(kpi.moonConsumed)} sub={`소진율 ${kpi.moonConsumeRate}%`} />
          <Kpi label="잔여" value={fmt(kpi.moonBalance)} sub={`${fmt(kpi.withMoon)}명 보유`} color="text-indigo-300" />
          <Kpi label="추정 부채" value={fmtWon(kpi.debtWon)} sub="달 1 ≈ 300원" />
          <Kpi
            label="충전 후 평균 소진일"
            value={kpi.depletedLots ? `${kpi.avgDepletionDays ?? 0}일` : '-'}
            sub={kpi.depletedLots
              ? `중앙값 ${kpi.medianDepletionDays ?? 0}일 · 표본 ${fmt(kpi.depletedLots)}건 · 진행중 ${fmt(kpi.outstandingPurchaseLots ?? 0)}`
              : '완전 소진된 충전 없음'}
            color="text-emerald-300"
          />
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[14px] font-semibold text-text-primary">총 크레딧 부채 (추정)</h3>
          <p className="text-[22px] font-bold text-amber-300">{fmtWon(kpi.debtWon)}</p>
        </div>
        <p className="text-[12px] text-text-tertiary mt-1">
          잔여 크레딧 × 추정 단가 — 회원이 미소비 상태의 기대 가치. 환불 요청·서비스 종료 시 부담.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-[14px] font-semibold text-text-primary mb-3">달 월별 순증감 (발행-소비)</h3>
          <VerticalBarChart bars={moonNetBars} color="rgba(129, 140, 248, 0.75)" height={120} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-[14px] font-semibold text-text-primary mb-3">
            소비 사유(reason) 랭킹 <span className="text-text-tertiary font-normal text-[12px]">달 갯수 · 횟수</span>
          </h3>
          <ReasonRanking items={reasonBreakdown} />
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-[14px] font-semibold text-text-primary mb-3">거래 유형별 건수</h3>
          <HorizontalBarChart bars={typeBars} defaultColor="rgba(167, 139, 250, 0.7)" />
          <p className="text-[12px] text-text-tertiary mt-3">총 거래 {fmt(kpi.txnCount)}건</p>
        </div>
      </div>
    </div>
  );
}

/** 소비 사유 랭킹 — 막대는 달 갯수 기준, 우측에 갯수+횟수 동시 표기 */
function ReasonRanking({ items }: { items: { reason: string; moon: number; count: number }[] }) {
  const rows = items.slice(0, 12);
  const totalMoon = rows.reduce((s, r) => s + r.moon, 0);
  const maxMoon = Math.max(1, ...rows.map(r => r.moon));
  if (rows.length === 0 || totalMoon === 0) {
    return <p className="text-[13px] text-text-tertiary py-6 text-center">데이터 없음</p>;
  }
  return (
    <div className="space-y-2">
      {rows.map(r => {
        const widthPct = Math.max(2, (r.moon / maxMoon) * 100);
        const pct = Math.round((r.moon / totalMoon) * 100);
        const label = CREDIT_REASON_LABEL[r.reason] ?? r.reason;
        return (
          <div key={r.reason} className="grid grid-cols-[100px_1fr_auto] items-center gap-2 text-[13px]">
            <span className="text-text-secondary truncate" title={label}>{label}</span>
            <div className="h-5 rounded bg-white/5 overflow-hidden">
              <div className="h-full rounded" style={{ width: `${widthPct}%`, background: 'rgba(167, 139, 250, 0.7)' }} />
            </div>
            <span className="text-text-primary font-medium tabular-nums min-w-[140px] text-right whitespace-nowrap">
              {fmt(r.moon)}달 · {fmt(r.count)}회 <span className="text-text-tertiary">({pct}%)</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <p className="text-[13px] text-text-secondary mb-1">{label}</p>
      <p className={`text-[22px] font-bold ${color ?? 'text-text-primary'}`}>{value}</p>
      {sub && <p className="text-[12px] text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  );
}
