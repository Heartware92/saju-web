/**
 * 유입·이탈 분석 섹션 (어드민).
 * /api/admin/analytics/summary 의 집계 결과를 표시.
 *  - KPI: 방문 세션 / 고유 방문자 / 페이지뷰 / 이탈률 / 로그인 세션 비율
 *  - 유입 출처(네이버·구글·직접·SNS) / 일별 방문자 추이 / 진입·이탈 경로 / 인기 페이지 / 디바이스
 */
'use client';

import { useMemo, useState } from 'react';
import { VerticalBarChart } from '@/components/admin/charts/VerticalBarChart';
import { pathLabel, SAJU_CATEGORY_LABEL, TAROT_SPREAD_LABEL } from '@/constants/adminLabels';

interface Counted { key: string; count: number; }

export interface ConversionFunnel {
  windowDays: number;
  visitorToSignup: { visitors: number; signedUp: number; rate: number };
  cohort: {
    signups: number;
    ran: number;
    attempt: number;
    complete: number;
    ranRate: number;
    attemptRate: number;
    completeRate: number;
  };
  paymentOutcome: {
    total: number;
    completed: number;
    failed: number;
    cancelled: number;
    pending: number;
    refunded: number;
  };
}

export interface AnalyticsSummary {
  truncated: boolean;
  funnel?: ConversionFunnel;
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
  daily: { date: string; sessions: number; visitors: number; pageviews: number; signups?: number }[];
  entryPages: Counted[];
  exitPages: Counted[];
  topPages: Counted[];
  devices: Counted[];
  sharePages: Counted[];
  sharePagesDetailed?: { key: string; kakao: number; url: number; count: number }[];
  shareChannels: { kakao: number; url: number; total: number };
  pageFlows?: { path: string; total: number; exitCount: number; exitRate: number; next: Counted[] }[];
  firstReading?: {
    totalSignups: number;
    activated: number;
    activationRate: number;
    avgHoursToFirst: number;
    medianHoursToFirst: number;
    distribution: Counted[];
  };
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
      <p className="text-[13px] text-text-secondary mb-2">{label}</p>
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

/** 공유 페이지 × 채널(카톡/URL복사) 누적 막대 — 어떤 결과를 무슨 채널로 공유하는지 */
function ShareChannelBars({ items }: { items: { key: string; kakao: number; url: number; count: number }[] }) {
  if (!items.length) {
    return <p className="text-[13px] text-text-tertiary py-6 text-center">공유 데이터 없음</p>;
  }
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.key} className="flex items-center gap-3">
          <span className="text-[13px] text-text-secondary w-[34%] truncate" title={it.key}>{pathLabel(it.key)}</span>
          <div className="flex-1 h-[18px] bg-white/5 rounded overflow-hidden flex">
            <div className="h-full" style={{ width: `${(it.kakao / max) * 100}%`, background: 'rgba(250, 204, 21, 0.85)' }} title={`카카오톡 ${it.kakao}`} />
            <div className="h-full" style={{ width: `${(it.url / max) * 100}%`, background: 'rgba(96, 165, 250, 0.85)' }} title={`URL복사 ${it.url}`} />
          </div>
          <span className="text-[12px] text-text-tertiary tabular-nums w-[104px] text-right shrink-0">
            카톡 {fmt(it.kakao)}·URL {fmt(it.url)}
          </span>
        </div>
      ))}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3 text-center">
      <p className="text-[12px] text-text-secondary mb-1">{label}</p>
      <p className={`text-[20px] font-bold tabular-nums leading-tight ${color ?? 'text-text-primary'}`}>{value}</p>
    </div>
  );
}

/** 전환 깔때기 — 신규 가입자 행동 / 방문→가입 / 결제 결과 */
function FunnelCards({ funnel }: { funnel: ConversionFunnel }) {
  const { visitorToSignup: v, cohort: c, paymentOutcome: p } = funnel;
  const steps = [
    { label: '가입', value: c.signups, rate: 100, color: 'rgba(96, 165, 250, 0.85)' },
    { label: '풀이 실행', value: c.ran, rate: c.ranRate, color: 'rgba(52, 211, 153, 0.85)' },
    { label: '결제 시도', value: c.attempt, rate: c.attemptRate, color: 'rgba(251, 191, 36, 0.85)' },
    { label: '결제 완료', value: c.complete, rate: c.completeRate, color: 'rgba(236, 72, 153, 0.85)' },
  ];
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card
        title="신규 가입자 전환 깔때기"
        sub={`최근 ${funnel.windowDays}일 가입자 ${fmt(c.signups)}명 기준 · 가입 후 도달 단계`}
      >
        {c.signups === 0 ? (
          <p className="text-[13px] text-text-tertiary py-6 text-center">최근 {funnel.windowDays}일 신규 가입자가 없습니다</p>
        ) : (
          <div className="space-y-2.5">
            {steps.map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="w-[68px] text-[13px] text-text-secondary shrink-0">{s.label}</span>
                <div className="flex-1 h-[22px] bg-white/5 rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${Math.max(s.rate, 1.5)}%`, background: s.color }} />
                </div>
                <span className="w-[96px] text-right text-[12px] tabular-nums text-text-tertiary shrink-0">
                  {fmt(s.value)}명 · {s.rate}%
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="space-y-4">
        <Card title="방문 → 가입 전환" sub="가입 이벤트 배포 이후 수집된 방문자 기준 (visitor 단위)">
          <div className="grid grid-cols-3 gap-2.5">
            <MiniStat label="고유 방문자" value={fmt(v.visitors)} />
            <MiniStat label="가입 전환" value={fmt(v.signedUp)} />
            <MiniStat label="전환율" value={`${v.rate}%`} color="text-emerald-300" />
          </div>
        </Card>

        <Card title="결제 시도 결과" sub={`최근 ${funnel.windowDays}일 생성 주문 ${fmt(p.total)}건 · 어디서 이탈하는지`}>
          <RankBars
            items={[
              { key: '완료', count: p.completed },
              { key: '실패', count: p.failed },
              { key: '취소', count: p.cancelled },
              { key: '대기', count: p.pending },
              { key: '환불', count: p.refunded },
            ].filter((i) => i.count > 0)}
            color="rgba(248, 113, 113, 0.65)"
            empty="결제 시도 없음"
          />
        </Card>
      </div>
    </div>
  );
}

/** 페이지 흐름 — 선택한 화면에서 바로 다음에 간 곳(+이탈). 기본 선택은 홈 */
function PageFlowCard({ flows }: { flows: NonNullable<AnalyticsSummary['pageFlows']> }) {
  const [path, setPath] = useState<string>('');
  const selected = useMemo(
    () => flows.find((f) => f.path === path) ?? flows.find((f) => f.path === '/') ?? flows[0] ?? null,
    [flows, path],
  );
  if (!flows.length || !selected) {
    return (
      <Card title="페이지 흐름" sub="선택한 화면을 본 세션이 바로 다음에 간 화면">
        <p className="text-[13px] text-text-tertiary py-6 text-center">흐름 데이터 없음 (2026-06-02부터 수집)</p>
      </Card>
    );
  }
  const flowLabel = (key: string) => (key === '(이탈)' ? '여기서 이탈(나감)' : pathLabel(key));
  return (
    <Card title="페이지 흐름" sub="선택한 화면을 본 세션이 바로 다음에 간 화면(+이탈) · 2026-06-02부터">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select
          value={selected.path}
          onChange={(e) => setPath(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[14px] text-text-primary focus:outline-none focus:border-cta/50 max-w-[280px]"
        >
          {flows.map((f) => (
            <option key={f.path} value={f.path}>
              {pathLabel(f.path)} ({fmt(f.total)})
            </option>
          ))}
        </select>
        <span className="text-[12px] text-text-tertiary">
          총 {fmt(selected.total)}회 · 이 화면에서 바로 이탈 {selected.exitRate}%
        </span>
      </div>
      <RankBars items={selected.next} color="rgba(96, 165, 250, 0.7)" empty="다음 행동 데이터 없음" labelFn={flowLabel} />
    </Card>
  );
}

/** 가입 후 첫 운세 — 첫 풀이 카테고리 분포 + 활성화율 + 소요시간 */
function FirstReadingCard({ data }: { data: NonNullable<AnalyticsSummary['firstReading']> }) {
  const fmtDur = (h: number) => {
    if (!h) return '-';
    if (h < 1) return `${Math.round(h * 60)}분`;
    if (h < 48) return `${h}시간`;
    return `${Math.round((h / 24) * 10) / 10}일`;
  };
  const readingLabel = (key: string) => {
    if (key.startsWith('tarot:')) {
      const s = key.slice(6);
      return `타로 · ${TAROT_SPREAD_LABEL[s] ?? s}`;
    }
    return SAJU_CATEGORY_LABEL[key] ?? key;
  };
  return (
    <Card title="가입 후 첫 운세" sub="회원이 가입하고 처음 본 풀이 분포 · 사주+타로 통합 · 전체 회원 기준">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
        <MiniStat label="가입자" value={fmt(data.totalSignups)} />
        <MiniStat label="첫 풀이 실행" value={fmt(data.activated)} />
        <MiniStat label="활성화율" value={`${data.activationRate}%`} color="text-emerald-300" />
        <MiniStat label="가입→첫풀이(중앙)" value={fmtDur(data.medianHoursToFirst)} color="text-sky-300" />
      </div>
      <RankBars items={data.distribution} color="rgba(52, 211, 153, 0.7)" empty="첫 운세 데이터 없음" labelFn={readingLabel} />
    </Card>
  );
}

export function AnalyticsSection({ summary }: { summary: AnalyticsSummary | null }) {
  if (!summary) {
    return <p className="text-[14px] text-text-tertiary py-10 text-center">데이터를 불러오는 중…</p>;
  }

  const { kpi } = summary;
  const visitorBars = summary.daily.map((d) => ({ key: d.date, label: d.date.slice(5), value: d.visitors }));
  const signupBars = summary.daily.map((d) => ({ key: d.date, label: d.date.slice(5), value: d.signups ?? 0 }));
  const signupTotal = summary.daily.reduce((s, d) => s + (d.signups ?? 0), 0);
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
          value={kpi.d7Cohort ? `${kpi.d7Rate ?? 0}%` : '-'}
          sub={kpi.d7Cohort ? `최초 방문 후 7일 내 재방문 · 대상 ${fmt(kpi.d7Cohort)}명` : '7일 코호트 데이터 부족'}
          color="text-sky-300"
        />
        <Metric
          label="재방문율 D30"
          value={kpi.d30Cohort ? `${kpi.d30Rate ?? 0}%` : '-'}
          sub={kpi.d30Cohort ? `최초 방문 후 30일 내 재방문 · 대상 ${fmt(kpi.d30Cohort)}명` : '30일 코호트 데이터 부족'}
          color="text-sky-300"
        />
        <Metric
          label="공유 횟수"
          value={fmt(shareChannels.total)}
          sub={`카카오 ${fmt(shareChannels.kakao)} · 링크복사 ${fmt(shareChannels.url)}`}
          color="text-pink-300"
        />
      </div>

      {/* 전환 깔때기 (가입 → 풀이 → 결제) */}
      {summary.funnel && <FunnelCards funnel={summary.funnel} />}

      {/* 가입 후 첫 운세 (온보딩 활성화) */}
      {summary.firstReading && <FirstReadingCard data={summary.firstReading} />}

      {/* 일별 방문자 추이 + 일별 가입자 추이 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="일별 방문자 추이" sub="최근 30일 고유 방문자(visitor) 기준">
          <VerticalBarChart bars={visitorBars} color="rgba(96, 165, 250, 0.75)" height={180} />
        </Card>
        <Card title="일별 가입자 추이" sub={`최근 30일 · 합계 ${fmt(signupTotal)}명 (약관 동의 기준)`}>
          <VerticalBarChart bars={signupBars} color="rgba(52, 211, 153, 0.75)" height={180} />
        </Card>
      </div>

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

      {/* 페이지 흐름 (홈에서 어디로 갔는지 등) */}
      {summary.pageFlows && <PageFlowCard flows={summary.pageFlows} />}

      {/* 인기 페이지 + 공유 많은 페이지 */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="인기 페이지" sub="페이지뷰 상위">
          <RankBars items={summary.topPages} color="rgba(251, 191, 36, 0.7)" empty="데이터 없음" labelFn={pathLabel} />
        </Card>
        <Card title="공유 많은 페이지" sub="결과별 채널 분해 · 노랑=카카오톡, 파랑=URL복사">
          {Array.isArray(summary.sharePagesDetailed)
            ? <ShareChannelBars items={summary.sharePagesDetailed} />
            : <RankBars items={sharePages} color="rgba(236, 72, 153, 0.7)" empty="공유 데이터 없음" labelFn={pathLabel} />}
        </Card>
      </div>
    </div>
  );
}
