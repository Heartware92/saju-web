/**
 * 회원 관리 탭 상단 — KPI 바 + 인구통계 4개 카드.
 * /api/admin/users/summary 응답을 받아 렌더.
 */
'use client';

import { useState } from 'react';
import { DonutChart } from '../charts/DonutChart';
import { HorizontalBarChart } from '../charts/HorizontalBarChart';
import { VerticalBarChart } from '../charts/VerticalBarChart';
import { AGE_BUCKETS, GENDER_LABEL, PROVIDER_LABEL, SEGMENT_LABEL, type UserSegment } from '@/constants/adminLabels';

export interface MemberSummary {
  kpi: {
    totalUsers: number;
    joinedToday: number;
    joinedYesterday: number;
    joined7d: number;
    joined30d: number;
    payingTotal: number;
    conversionRate: number;
    newDaysWindow: number;
  };
  gender: { male: number; female: number; unknown: number };
  ageCounts: Record<string, number>;
  provider: Record<string, number>;
  cohort: Array<{ month: string; count: number }>;
  cohortDaily?: Array<{ date: string; count: number }>;
  segments: Record<UserSegment, number>;
}

interface Props {
  summary: MemberSummary | null;
  activeSegment: UserSegment | '';
  onSegmentChange: (s: UserSegment | '') => void;
}

export function DemographicsSummary({ summary, activeSegment, onSegmentChange }: Props) {
  if (!summary) return null;
  const { kpi, gender, ageCounts, provider, cohort, cohortDaily, segments } = summary;

  const todayDelta = kpi.joinedToday - kpi.joinedYesterday;

  return (
    <div className="space-y-5">
      {/* ── KPI 바 ─────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
        <KpiCell label="총 회원" value={kpi.totalUsers.toLocaleString()} />
        <KpiCell
          label="오늘 가입"
          value={kpi.joinedToday.toLocaleString()}
          sub={todayDelta === 0 ? '어제와 동일' : `어제 대비 ${todayDelta > 0 ? '+' : ''}${todayDelta}`}
          color={kpi.joinedToday > 0 ? 'text-sky-300' : undefined}
        />
        <KpiCell label="7일 신규" value={kpi.joined7d.toLocaleString()} />
        <KpiCell label="30일 신규" value={kpi.joined30d.toLocaleString()} />
        <KpiCell label="결제 회원" value={kpi.payingTotal.toLocaleString()} color="text-amber-300" />
        <KpiCell label="결제 전환율" value={`${kpi.conversionRate}%`} sub="payingTotal / totalUsers" />
      </div>

      {/* ── 세그먼트 필터 칩 ─────────────── */}
      <div className="flex flex-wrap gap-1.5">
        <SegmentChip label="전체" count={kpi.totalUsers} active={activeSegment === ''} onClick={() => onSegmentChange('')} />
        {(['new', 'active', 'dormant', 'vip', 'paying', 'free'] as UserSegment[]).map(key => (
          <SegmentChip
            key={key}
            label={SEGMENT_LABEL[key].text}
            count={segments[key] ?? 0}
            cls={SEGMENT_LABEL[key].cls}
            active={activeSegment === key}
            onClick={() => onSegmentChange(activeSegment === key ? '' : key)}
          />
        ))}
      </div>

      {/* ── 인구통계 4개 카드 ──────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card title="성별 분포">
          <DonutChart
            size={128}
            thickness={20}
            slices={[
              { key: 'male',    label: GENDER_LABEL.male,    value: gender.male,    color: '#60a5fa' },
              { key: 'female',  label: GENDER_LABEL.female,  value: gender.female,  color: '#f472b6' },
              { key: 'unknown', label: GENDER_LABEL.unknown, value: gender.unknown, color: 'rgba(255,255,255,0.25)' },
            ]}
            centerValue={(gender.male + gender.female + gender.unknown).toLocaleString()}
            centerLabel="명"
          />
        </Card>

        <Card title="연령대 분포">
          <HorizontalBarChart
            bars={AGE_BUCKETS
              .filter(b => (ageCounts[b.key] ?? 0) > 0 || ['teens', 'twenties', 'thirties', 'forties', 'fifties', 'sixties'].includes(b.key))
              .map(b => ({
                key: b.key,
                label: b.label,
                value: ageCounts[b.key] ?? 0,
                color: b.key === 'unknown' ? 'rgba(255,255,255,0.2)' : undefined,
              }))}
          />
        </Card>

        <Card title="가입 경로">
          <HorizontalBarChart
            bars={Object.entries(provider)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => ({ key: k, label: PROVIDER_LABEL[k] ?? k, value: v }))}
            defaultColor="rgba(34, 211, 238, 0.65)"
          />
        </Card>

        <CohortCard cohort={cohort} cohortDaily={cohortDaily} />
      </div>
    </div>
  );
}

/** 가입 코호트 — 월별/일별 토글 */
function CohortCard({
  cohort, cohortDaily,
}: {
  cohort: Array<{ month: string; count: number }>;
  cohortDaily?: Array<{ date: string; count: number }>;
}) {
  const [view, setView] = useState<'month' | 'day'>('month');
  const daily = cohortDaily ?? [];
  const showDay = view === 'day' && daily.length > 0;
  const bars = showDay
    ? daily.map(c => ({ key: c.date, label: c.date.slice(5), value: c.count }))
    : cohort.map(c => ({ key: c.month, label: c.month.slice(5), value: c.count }));
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold text-text-secondary uppercase tracking-wider">
          가입 코호트 {showDay ? '(최근 30일)' : '(최근 12개월)'}
        </h3>
        <div className="flex gap-1 p-0.5 bg-white/5 rounded-lg border border-white/10">
          {(['month', 'day'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded text-[12px] font-medium transition-colors ${view === v ? 'bg-cta text-white' : 'text-text-tertiary hover:text-text-secondary'}`}
            >
              {v === 'month' ? '월별' : '일별'}
            </button>
          ))}
        </div>
      </div>
      <VerticalBarChart bars={bars} color="rgba(167, 139, 250, 0.75)" />
    </div>
  );
}

function KpiCell({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5">
      <p className="text-[11px] text-text-tertiary uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-[18px] font-bold ${color ?? 'text-text-primary'}`}>{value}</p>
      {sub && <p className="text-[11px] text-text-tertiary mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function SegmentChip({ label, count, cls, active, onClick }: { label: string; count: number; cls?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[13px] border transition-all ${
        active
          ? (cls ?? 'bg-cta/20 text-cta border-cta/50')
          : 'bg-white/5 text-text-secondary border-white/10 hover:border-white/25'
      }`}
    >
      {label} <span className="text-text-tertiary ml-1">{count.toLocaleString()}</span>
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <h3 className="text-[13px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}
