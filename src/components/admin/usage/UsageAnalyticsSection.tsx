/**
 * 이용 분석 — 서비스 랭킹, 30일 추이, 시간×요일 히트맵, 달 크레딧 소비
 */
'use client';

import { useState } from 'react';
import { HorizontalBarChart } from '@/components/admin/charts/HorizontalBarChart';
import { VerticalBarChart } from '@/components/admin/charts/VerticalBarChart';
import { HeatmapChart } from '@/components/admin/charts/HeatmapChart';
import {
  SAJU_CATEGORY_LABEL, TAROT_SPREAD_LABEL,
  SAJU_BIG_CATEGORIES, SAJU_MORE_CATEGORIES, lookupServiceLabel,
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
  credit: { moonConsumed: number; moonTxn: number };
  consumptionSeq?: {
    totalConsumers: number;
    maxStep: number;
    steps: { step: number; users: number; distribution: { key: string; count: number }[] }[];
  };
}

const fmt = (n: number) => n.toLocaleString('ko-KR');

const BIG_SET = new Set<string>(SAJU_BIG_CATEGORIES);
const MORE_SET = new Set<string>(SAJU_MORE_CATEGORIES);

/** 달 소비 순서 — 유저가 몇 번째로 어느 서비스에 달을 쓰는지(단계 선택). 보너스·결제 무관 */
function ConsumptionSequenceCard({ seq }: { seq: NonNullable<UsageSummary['consumptionSeq']> }) {
  const [step, setStep] = useState(1);
  if (!seq.steps.length) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-[14px] font-semibold text-text-primary mb-1">달 소비 순서</h3>
        <p className="text-[13px] text-text-tertiary py-6 text-center">아직 달을 소비한 회원이 없습니다</p>
      </div>
    );
  }
  const cur = seq.steps.find((s) => s.step === step) ?? seq.steps[0];
  const bars = cur.distribution.map((d) => ({ key: d.key, label: lookupServiceLabel(d.key), value: d.count }));
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-1 flex-wrap gap-x-3 gap-y-1">
        <h3 className="text-[14px] font-semibold text-text-primary">달 소비 순서 <span className="text-text-tertiary font-normal">(몇 번째로 어디에 쓰는지)</span></h3>
        <p className="text-[12px] text-text-tertiary">보너스·결제 무관 · 전체 기간 · 소비 경험 {fmt(seq.totalConsumers)}명</p>
      </div>
      {/* 단계 버튼 — 괄호 안 인원 = 그 단계까지 도달(드롭오프) */}
      <div className="flex gap-1.5 flex-wrap my-3">
        {seq.steps.map((s) => (
          <button
            key={s.step}
            onClick={() => setStep(s.step)}
            className={`px-2.5 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${
              step === s.step
                ? 'bg-cta text-white border-cta'
                : 'bg-white/5 text-text-secondary border-white/15 hover:bg-white/10'
            }`}
          >
            {s.step}번째 <span className={step === s.step ? 'text-white/80' : 'text-text-tertiary'}>({fmt(s.users)}명)</span>
          </button>
        ))}
      </div>
      <p className="text-[12px] text-text-tertiary mb-2">
        <span className="text-text-primary font-medium">{cur.step}번째</span> 달 소비 — 이 단계까지 온{' '}
        <span className="text-text-primary font-medium">{fmt(cur.users)}명</span>이 쓴 서비스
      </p>
      <HorizontalBarChart bars={bars} defaultColor="rgba(129, 140, 248, 0.7)" />
    </div>
  );
}

export function UsageAnalyticsSection({ summary }: { summary: UsageSummary | null }) {
  if (!summary) return <div className="text-[14px] text-text-tertiary py-6">로딩 중…</div>;

  const kpi = summary.kpi ?? { sajuTotal: 0, tarotTotal: 0, grandTotal: 0, uniqueSajuUsers: 0, uniqueTarotUsers: 0 };
  const sajuRanking = Array.isArray(summary.sajuRanking) ? summary.sajuRanking : [];
  const tarotRanking = Array.isArray(summary.tarotRanking) ? summary.tarotRanking : [];
  const daily = Array.isArray(summary.daily) ? summary.daily : [];
  const heatmap = Array.isArray(summary.heatmap) ? summary.heatmap : [];
  const credit = summary.credit ?? { moonConsumed: 0, moonTxn: 0 };

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
          <Kpi label="달 소비" value={fmt(credit.moonConsumed)} sub={`거래장부 ${fmt(credit.moonTxn)}`} />
        </div>
      </div>

      {/* 달 소비 순서 (첫 소비 → N번째 소비 경로) */}
      {summary.consumptionSeq && <ConsumptionSequenceCard seq={summary.consumptionSeq} />}

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

        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col">
          <h3 className="text-[14px] font-semibold text-text-primary mb-3">달 소비</h3>
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <p className="text-[30px] font-bold text-indigo-300 tabular-nums leading-none">{fmt(credit.moonConsumed)}</p>
            <p className="text-[12px] text-text-tertiary mt-2">최근 30일 소비된 달 · 거래 {fmt(credit.moonTxn)}건</p>
          </div>
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
            본격 운세 랭킹 <span className="text-text-tertiary font-normal">(달 10 소모 · 8종)</span>
          </h3>
          <HorizontalBarChart bars={bigSajuBars} />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-[14px] font-semibold text-text-primary mb-3">
            더 많은 운세 랭킹 <span className="text-text-tertiary font-normal">(달 5 소모 · 10종)</span>
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
      <p className="text-[13px] text-text-secondary mb-1">{label}</p>
      <p className="text-[22px] font-bold text-text-primary">{value}</p>
      {sub && <p className="text-[12px] text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  );
}
