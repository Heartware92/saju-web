/**
 * 유입·이탈 분석 섹션 (어드민).
 * /api/admin/analytics/summary 의 집계 결과를 표시.
 *  - KPI: 방문 세션 / 고유 방문자 / 페이지뷰 / 이탈률 / 로그인 세션 비율
 *  - 유입 출처(네이버·구글·직접·SNS) / 일별 방문자 추이 / 진입·이탈 경로 / 인기 페이지 / 디바이스
 */
'use client';

import { VerticalBarChart } from '@/components/admin/charts/VerticalBarChart';
import { pathLabel } from '@/constants/adminLabels';

interface Counted { key: string; count: number; }

export interface AnalyticsSummary {
  truncated: boolean;
  kpi: {
    sessions: number;
    visitors: number;
    pageviews: number;
    bounceRate: number;
    loggedInRate: number;
    d7Rate: number;
    d7Cohort: number;
    d30Rate: number;
    d30Cohort: number;
  };
  sources: Counted[];
  daily: { date: string; sessions: number; visitors: number; pageviews: number }[];
  entryPages: Counted[];
  exitPages: Counted[];
  topPages: Counted[];
  devices: Counted[];
  sharePages: Counted[];
  shareChannels: { kakao: number; url: number; total: number };
}

const fmt = (n: number) => n.toLocaleString('ko-KR');

function Card({ children, title, sub }: { children: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold text-text-primary">{title}</h3>
        {sub && <p className="text-[12px] text-text-tertiary mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4">
      <p className="text-[12px] text-text-tertiary tracking-wide mb-2">{label}</p>
      <p className={`text-[26px] font-bold leading-tight tabular-nums ${color ?? 'text-text-primary'}`}>{value}</p>
      {sub && <p className="text-[12px] text-text-tertiary mt-1.5 leading-snug">{sub}</p>}
    </div>
  );
}

/** 가로 막대 랭킹 (유입 출처/경로 목록용). labelFn 지정 시 key 를 친화 라벨로 표시(원본은 title 툴팁). */
function RankBars({ items, color, empty, labelFn }: { items: Counted[]; color: string; empty: string; labelFn?: (key: string) => string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (items.length === 0) {
    return <p className="text-[13px] text-text-tertiary py-6 text-center">{empty}</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.key} className="flex items-center gap-3">
          <span className="text-[13px] text-text-secondary w-[42%] truncate" title={it.key}>{labelFn ? labelFn(it.key) : it.key}</span>
          <div className="flex-1 h-[18px] bg-white/5 rounded overflow-hidden">
            <div className="h-full rounded" style={{ width: `${(it.count / max) * 100}%`, background: color }} />
          </div>
          <span className="text-[12px] text-text-tertiary tabular-nums w-12 text-right">{fmt(it.count)}</span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsSection({ summary }: { summary: AnalyticsSummary | null }) {
  if (!summary) {
    return <p className="text-[14px] text-text-tertiary py-10 text-center">데이터를 불러오는 중…</p>;
  }

  const { kpi } = summary;
  const visitorBars = summary.daily.map((d) => ({ key: d.date, label: d.date.slice(5), value: d.visitors }));
  const sharePages = Array.isArray(summary.sharePages) ? summary.sharePages : [];
  const shareChannels = summary.shareChannels ?? { kakao: 0, url: 0, total: 0 };

  return (
    <div className="space-y-6">
      <p className="text-[12px] text-text-tertiary">최근 30일 · 익명 세션 기준 (IP 미수집)</p>

      {summary.truncated && (
        <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[13px] text-amber-300">
          데이터가 집계 상한을 초과해 일부만 반영됐습니다. 보존·롤업 정책 도입이 필요합니다.
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Metric label="방문 세션" value={fmt(kpi.sessions)} />
        <Metric label="고유 방문자" value={fmt(kpi.visitors)} />
        <Metric label="페이지뷰" value={fmt(kpi.pageviews)} />
        <Metric label="이탈률(바운스)" value={`${kpi.bounceRate}%`} sub="단일 페이지뷰 세션" color="text-amber-300" />
        <Metric label="로그인 세션" value={`${kpi.loggedInRate}%`} sub="로그인 상태 방문 비율" color="text-emerald-300" />
      </div>

      {/* 재방문율 (코호트 범위 리텐션) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Metric
          label="재방문율 D7"
          value={`${kpi.d7Rate ?? 0}%`}
          sub={`최초 방문 후 7일 내 재방문 · 대상 ${fmt(kpi.d7Cohort ?? 0)}명`}
          color="text-sky-300"
        />
        <Metric
          label="재방문율 D30"
          value={`${kpi.d30Rate ?? 0}%`}
          sub={`최초 방문 후 30일 내 재방문 · 대상 ${fmt(kpi.d30Cohort ?? 0)}명`}
          color="text-sky-300"
        />
        <Metric
          label="공유 횟수"
          value={fmt(shareChannels.total)}
          sub={`카카오 ${fmt(shareChannels.kakao)} · 링크복사 ${fmt(shareChannels.url)}`}
          color="text-pink-300"
        />
      </div>

      {/* 일별 방문자 추이 */}
      <Card title="일별 방문자 추이" sub="최근 30일 고유 방문자(visitor) 기준">
        <VerticalBarChart bars={visitorBars} color="rgba(96, 165, 250, 0.75)" height={180} />
      </Card>

      {/* 유입 출처 + 디바이스 */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="유입 출처" sub="세션 첫 진입 referrer · UTM 기준">
          <RankBars items={summary.sources} color="rgba(52, 211, 153, 0.7)" empty="유입 데이터 없음" />
        </Card>
        <Card title="디바이스" sub="페이지뷰 기준">
          <RankBars items={summary.devices} color="rgba(167, 139, 250, 0.7)" empty="데이터 없음" />
        </Card>
      </div>

      {/* 진입 / 이탈 경로 */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="진입 경로 (랜딩)" sub="세션이 처음 도착한 화면">
          <RankBars items={summary.entryPages} color="rgba(96, 165, 250, 0.7)" empty="데이터 없음" labelFn={pathLabel} />
        </Card>
        <Card title="이탈 경로" sub="세션의 마지막 화면 = 이탈 지점">
          <RankBars items={summary.exitPages} color="rgba(248, 113, 113, 0.7)" empty="데이터 없음" labelFn={pathLabel} />
        </Card>
      </div>

      {/* 인기 페이지 + 공유 많은 페이지 */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="인기 페이지" sub="페이지뷰 상위">
          <RankBars items={summary.topPages} color="rgba(251, 191, 36, 0.7)" empty="데이터 없음" labelFn={pathLabel} />
        </Card>
        <Card title="공유 많은 페이지" sub="카카오톡·링크복사 공유 버튼 클릭 기준">
          <RankBars items={sharePages} color="rgba(236, 72, 153, 0.7)" empty="공유 데이터 없음" labelFn={pathLabel} />
        </Card>
      </div>
    </div>
  );
}
