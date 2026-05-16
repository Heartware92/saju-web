/**
 * 이용 분석 — 서비스 랭킹, 30일 추이, 시간×요일 히트맵, 해/달 비중
 */
'use client';

import { HorizontalBarChart } from '@/components/admin/charts/HorizontalBarChart';
import { VerticalBarChart } from '@/components/admin/charts/VerticalBarChart';
import { DonutChart } from '@/components/admin/charts/DonutChart';
import { HeatmapChart } from '@/components/admin/charts/HeatmapChart';
import {
  SAJU_CATEGORY_LABEL, TAROT_SPREAD_LABEL,
  SAJU_BIG_CATEGORIES, SAJU_MORE_CATEGORIES,
} from '@/constants/adminLabels';

export interface UsageSummary {
  kpi: {
    sajuTotal: number;
    tarotTotal: number;
    consultTotal?: number;
    consultMessages?: number;
    grandTotal: number;
    uniqueSajuUsers: number;
    uniqueTarotUsers: number;
    uniqueConsultUsers?: number;
  };
  sajuRanking: { category: string; count: number; uniqueUsers: number }[];
  tarotRanking: { spread: string; count: number; uniqueUsers: number }[];
  daily: { date: string; saju: number; tarot: number; consult?: number; total: number }[];
  heatmap: number[][];
  credit: { sunConsumed: number; moonConsumed: number; sunTxn: number; moonTxn: number };
}

const fmt = (n: number) => n.toLocaleString('ko-KR');

const BIG_SET = new Set<string>(SAJU_BIG_CATEGORIES);
const MORE_SET = new Set<string>(SAJU_MORE_CATEGORIES);

export function UsageAnalyticsSection({ summary }: { summary: UsageSummary | null }) {
  if (!summary) return <div className="text-[14px] text-text-tertiary py-6">로딩 중…</div>;

  const kpi = summary.kpi ?? { sajuTotal: 0, tarotTotal: 0, grandTotal: 0, uniqueSajuUsers: 0, uniqueTarotUsers: 0 };
  const sajuRanking = Array.isArray(summary.sajuRanking) ? summary.sajuRanking : [];
  const tarotRanking = Array.isArray(summary.tarotRanking) ? summary.tarotRanking : [];
  const daily = Array.isArray(summary.daily) ? summary.daily : [];
  const heatmap = Array.isArray(summary.heatmap) ? summary.heatmap : [];
  const credit = summary.credit ?? { sunConsumed: 0, moonConsumed: 0, sunTxn: 0, moonTxn: 0 };

  // 사주 랭킹 분리 (큰 8 vs 더많은 10)
  const bigSajuBars = sajuRanking
    .filter(r => BIG_SET.has(r.category))
    .map(r => ({
      key: r.category,
      label: SAJU_CATEGORY_LABEL[r.category] ?? r.category,
      value: r.count,
    }));
  const moreSajuBars = sajuRanking
    .filter(r => MORE_SET.has(r.category))
    .map(r => ({
      key: r.category,
      label: SAJU_CATEGORY_LABEL[r.category] ?? r.category,
      value: r.count,
      color: 'rgba(129, 140, 248, 0.7)',
    }));
  const tarotBars = tarotRanking.map(r => ({
    key: r.spread,
    label: TAROT_SPREAD_LABEL[r.spread] ?? r.spread,
    value: r.count,
    color: 'rgba(244, 114, 182, 0.7)',
  }));

  const dailyBars = daily.map(d => ({
    key: d.date,
    label: d.date.slice(5),
    value: d.total,
  }));

  const creditSlices = [
    { key: 'moon', label: '🌙 달', value: credit.moonConsumed, color: 'rgba(129, 140, 248, 0.85)' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div>
        <h2 className="text-[15px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">이용 요약</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Kpi label="총 이용" value={fmt(kpi.grandTotal)} sub="사주 + 타로 + 상담" />
          <Kpi label="사주 이용" value={fmt(kpi.sajuTotal)} sub={`${fmt(kpi.uniqueSajuUsers)}명`} />
          <Kpi label="타로 이용" value={fmt(kpi.tarotTotal)} sub={`${fmt(kpi.uniqueTarotUsers)}명`} />
          <Kpi label="상담소 대화" value={fmt(kpi.consultTotal ?? 0)} sub={`${fmt(kpi.uniqueConsultUsers ?? 0)}명 · ${fmt(kpi.consultMessages ?? 0)}메시지`} />
          <Kpi label="🌙 달 소비" value={fmt(credit.moonConsumed)} sub={`거래장부 ${fmt(credit.moonTxn)}`} />
        </div>
      </div>

      {/* 30일 추이 + 해/달 비중 */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-[14px] font-semibold text-text-primary">30일 이용 추이</h3>
            <p className="text-[13px] text-text-tertiary">
              합계 <span className="text-text-primary font-medium">{fmt(daily.reduce((s, d) => s + d.total, 0))}건</span>
            </p>
          </div>
          <VerticalBarChart bars={dailyBars} color="rgba(96, 165, 250, 0.75)" height={140} />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-[14px] font-semibold text-text-primary mb-3">🌙 달 소비</h3>
          <DonutChart
            slices={creditSlices}
            centerValue={fmt(credit.moonConsumed)}
            centerLabel="총 소비"
          />
        </div>
      </div>

      {/* 시간×요일 히트맵 */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-[14px] font-semibold text-text-primary mb-3">시간대 × 요일 히트맵 (KST)</h3>
        <HeatmapChart matrix={heatmap} />
      </div>

      {/* 서비스 랭킹 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-[14px] font-semibold text-text-primary mb-3">
            큰 운세 랭킹 <span className="text-text-tertiary font-normal">(해 1 소모 · 8종)</span>
          </h3>
          <HorizontalBarChart bars={bigSajuBars} />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-[14px] font-semibold text-text-primary mb-3">
            더 많은 운세 랭킹 <span className="text-text-tertiary font-normal">(달 1 소모 · 10종)</span>
          </h3>
          <HorizontalBarChart bars={moreSajuBars} defaultColor="rgba(129, 140, 248, 0.7)" />
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-[14px] font-semibold text-text-primary mb-3">타로 스프레드 랭킹</h3>
        <HorizontalBarChart bars={tarotBars} defaultColor="rgba(244, 114, 182, 0.7)" />
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <p className="text-[13px] text-text-tertiary uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[22px] font-bold text-text-primary">{value}</p>
      {sub && <p className="text-[12px] text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  );
}
