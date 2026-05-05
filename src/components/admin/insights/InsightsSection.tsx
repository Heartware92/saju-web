/**
 * 인사이트 섹션 — 시스템 헬스 + 코호트 리텐션 + AI 품질 + 이상치 + 실시간 피드
 * 별도 탭 또는 대시보드 하단에 배치.
 */
'use client';

import { HorizontalBarChart } from '@/components/admin/charts/HorizontalBarChart';
import { SAJU_CATEGORY_LABEL, TAROT_SPREAD_LABEL } from '@/constants/adminLabels';

export interface Insights {
  health: {
    dbLatencyMs: number;
    dbOk: boolean;
    totalAuthUsers: number;
    last24hSignups: number;
    last24hUsage: number;
    last24hOrders: number;
    last30dPaymentFailRate: number;
    last30dRefundRate: number;
    last30dFailCount: number;
    last30dRefundCount: number;
  };
  cohort: { month: string; total: number; d1: number; d7: number; d30: number }[];
  aiQuality: { category: string; count: number; avgCredit: number; zeroCreditCount: number; zeroCreditRate: number }[];
  anomalies: {
    heavyUsers: { userId: string; email: string; count: number }[];
    repeatRefunders: { userId: string; email: string; count: number }[];
    failHeavy: { userId: string; email: string; count: number }[];
  };
  feed: { kind: string; userId: string; email: string; label: string; createdAt: string }[];
  refunds: {
    topRefunders: { userId: string; email: string; count: number; amount: number }[];
    monthly: { month: string; rate: number; refundCount: number; completedCount: number }[];
  };
}

const fmt = (n: number) => n.toLocaleString('ko-KR');
const fmtWon = (n: number) => `${n.toLocaleString('ko-KR')}원`;
const fmtTime = (s: string) => new Date(s).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

const EVENT_STYLE: Record<string, { icon: string; cls: string }> = {
  signup:           { icon: '🟢', cls: 'text-green-300' },
  order_completed:  { icon: '💰', cls: 'text-amber-300' },
  order_failed:     { icon: '❌', cls: 'text-red-300' },
  order_refunded:   { icon: '↩️', cls: 'text-gray-400' },
  saju:             { icon: '🔮', cls: 'text-purple-300' },
  tarot:            { icon: '🃏', cls: 'text-pink-300' },
};

export function InsightsSection({
  insights,
  onOpenUser,
}: {
  insights: Insights | null;
  onOpenUser: (id: string) => void;
}) {
  if (!insights) return <div className="text-[14px] text-text-tertiary py-6">로딩 중…</div>;

  const { health, cohort, aiQuality, anomalies, feed, refunds } = insights;

  const totalAnomalies = (anomalies?.heavyUsers?.length ?? 0) + (anomalies?.repeatRefunders?.length ?? 0) + (anomalies?.failHeavy?.length ?? 0);

  return (
    <div className="space-y-6">
      {/* ── 시스템 헬스 ── */}
      <div>
        <h2 className="text-[15px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">시스템 헬스</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi
            label="DB 상태"
            value={health.dbOk ? '✓ 정상' : '❌ 오류'}
            sub={`응답 ${health.dbLatencyMs}ms`}
            color={health.dbOk ? 'text-green-300' : 'text-red-300'}
          />
          <Kpi label="최근 1일 가입" value={`${fmt(health.last24hSignups)}명`} />
          <Kpi label="최근 1일 이용" value={`${fmt(health.last24hUsage)}건`} />
          <Kpi label="최근 1일 주문" value={`${fmt(health.last24hOrders)}건`} />
          <Kpi
            label="30일 결제 실패율"
            value={`${health.last30dPaymentFailRate}%`}
            sub={`${health.last30dFailCount}건`}
            color={health.last30dPaymentFailRate > 10 ? 'text-red-300' : undefined}
          />
          <Kpi
            label="30일 환불률"
            value={`${health.last30dRefundRate}%`}
            sub={`${health.last30dRefundCount}건`}
            color={health.last30dRefundRate > 15 ? 'text-red-300' : undefined}
          />
          <Kpi label="auth 등록 회원" value={`${fmt(health.totalAuthUsers)}명`} />
        </div>
      </div>

      {/* ── 이상치 경고 ── */}
      {totalAnomalies > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <h2 className="text-[14px] font-semibold text-red-300 mb-3">⚠️ 이상치 감지 ({totalAnomalies}건)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <AnomalyList
              title="🔥 1시간 내 10회+ 풀이"
              items={anomalies.heavyUsers}
              onClick={onOpenUser}
            />
            <AnomalyList
              title="↩️ 30일 내 3회+ 환불"
              items={anomalies.repeatRefunders}
              onClick={onOpenUser}
            />
            <AnomalyList
              title="❌ 24시간 결제 실패 5회+"
              items={anomalies.failHeavy}
              onClick={onOpenUser}
            />
          </div>
        </div>
      )}

      {/* ── 코호트 리텐션 ── */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-[14px] font-semibold text-text-primary mb-3">코호트 리텐션 (최근 3개월)</h3>
        <p className="text-[12px] text-text-tertiary mb-3">각 가입 코호트의 D+1 / D+7 / D+30 사주·타로 재이용률</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-[11px] text-text-tertiary uppercase">
              <tr>
                <th className="px-2.5 py-1.5 text-left">가입 월</th>
                <th className="px-2.5 py-1.5 text-right">가입자</th>
                <th className="px-2.5 py-1.5 text-right">D+1</th>
                <th className="px-2.5 py-1.5 text-right">D+7</th>
                <th className="px-2.5 py-1.5 text-right">D+30</th>
              </tr>
            </thead>
            <tbody>
              {cohort.map(c => (
                <tr key={c.month} className="border-t border-white/5">
                  <td className="px-2.5 py-2 text-text-primary font-medium">{c.month}</td>
                  <td className="px-2.5 py-2 text-right text-text-secondary tabular-nums">{fmt(c.total)}</td>
                  <RetentionCell pct={c.d1} />
                  <RetentionCell pct={c.d7} />
                  <RetentionCell pct={c.d30} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── AI 품질 대리 지표 ── */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-[14px] font-semibold text-text-primary mb-3">풀이 품질 대리 지표 (최근 7일)</h3>
        <p className="text-[12px] text-text-tertiary mb-3">
          credit_used=0은 실패/타임아웃 의심. 평균 크레딧이 기대값 아래면 제대로 소비되지 않은 것일 수 있음.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="text-[11px] text-text-tertiary uppercase">
              <tr>
                <th className="px-2.5 py-1.5 text-left">카테고리</th>
                <th className="px-2.5 py-1.5 text-right">이용 수</th>
                <th className="px-2.5 py-1.5 text-right">평균 크레딧</th>
                <th className="px-2.5 py-1.5 text-right">0크레딧 (실패 의심)</th>
              </tr>
            </thead>
            <tbody>
              {aiQuality.slice(0, 18).map(q => (
                <tr key={q.category} className="border-t border-white/5">
                  <td className="px-2.5 py-2 text-text-primary">
                    {q.category.startsWith('tarot:')
                      ? `🃏 ${TAROT_SPREAD_LABEL[q.category.slice(6)] ?? q.category.slice(6)}`
                      : (SAJU_CATEGORY_LABEL[q.category] ?? q.category)}
                  </td>
                  <td className="px-2.5 py-2 text-right text-text-secondary tabular-nums">{fmt(q.count)}</td>
                  <td className="px-2.5 py-2 text-right text-text-primary tabular-nums">{q.avgCredit}</td>
                  <td className={`px-2.5 py-2 text-right tabular-nums ${q.zeroCreditRate > 20 ? 'text-red-300 font-bold' : 'text-text-tertiary'}`}>
                    {q.zeroCreditCount}건 ({q.zeroCreditRate}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 환불 상세 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-[14px] font-semibold text-text-primary mb-3">월별 환불률 (6개월)</h3>
          <HorizontalBarChart
            bars={refunds.monthly.map(m => ({
              key: m.month,
              label: m.month.slice(5),
              value: m.rate,
            }))}
            defaultColor="rgba(248, 113, 113, 0.7)"
            showPercent={false}
          />
          <p className="text-[11px] text-text-tertiary mt-2">막대 단위: %</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-[14px] font-semibold text-text-primary mb-3">환불 TOP 회원 (90일)</h3>
          {refunds.topRefunders.length === 0 ? (
            <p className="text-[13px] text-text-tertiary py-2">환불 내역 없음</p>
          ) : (
            <div className="space-y-1.5">
              {refunds.topRefunders.map(u => (
                <button
                  key={u.userId}
                  onClick={() => onOpenUser(u.userId)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-white/3 border border-white/10 hover:bg-white/5 text-left text-[13px]"
                >
                  <span className="text-text-primary font-medium truncate flex-1">{u.email}</span>
                  <span className="text-text-tertiary">{u.count}회</span>
                  <span className="text-red-300 tabular-nums">{fmtWon(u.amount)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 실시간 이벤트 피드 ── */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-[14px] font-semibold text-text-primary">실시간 이벤트 (최근 24시간)</h3>
          <p className="text-[12px] text-text-tertiary">총 {fmt(feed.length)}건 중 최신 {Math.min(50, feed.length)}건</p>
        </div>
        {feed.length === 0 ? (
          <p className="text-[13px] text-text-tertiary py-2">이벤트 없음</p>
        ) : (
          <div className="space-y-1 max-h-[520px] overflow-y-auto">
            {feed.map((e, i) => {
              const style = EVENT_STYLE[e.kind] ?? { icon: '•', cls: 'text-text-tertiary' };
              return (
                <button
                  key={`${e.kind}-${i}-${e.createdAt}`}
                  onClick={() => onOpenUser(e.userId)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/5 text-left text-[13px]"
                >
                  <span className="w-5">{style.icon}</span>
                  <span className={`${style.cls} min-w-[60px]`}>
                    {e.kind.startsWith('order_') ? '결제' : e.kind === 'signup' ? '가입' : e.kind === 'saju' ? '사주' : e.kind === 'tarot' ? '타로' : e.kind}
                  </span>
                  <span className="text-text-primary truncate flex-1 min-w-0">{e.email}</span>
                  <span className="text-text-tertiary truncate max-w-[280px]">{e.label}</span>
                  <span className="text-text-tertiary text-[11px] whitespace-nowrap">{fmtTime(e.createdAt)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <p className="text-[13px] text-text-tertiary uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-[22px] font-bold ${color ?? 'text-text-primary'}`}>{value}</p>
      {sub && <p className="text-[12px] text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  );
}

function RetentionCell({ pct }: { pct: number }) {
  const color = pct >= 50 ? 'text-green-300' : pct >= 30 ? 'text-amber-300' : pct >= 15 ? 'text-text-primary' : 'text-text-tertiary';
  return (
    <td className={`px-2.5 py-2 text-right tabular-nums font-medium ${color}`}>
      {pct}%
    </td>
  );
}

function AnomalyList({
  title, items, onClick,
}: {
  title: string;
  items: { userId: string; email: string; count: number }[];
  onClick: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-[12px] text-text-secondary font-medium mb-1.5">{title}</p>
      {items.length === 0 ? (
        <p className="text-[12px] text-text-tertiary">없음</p>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 8).map(u => (
            <button
              key={u.userId}
              onClick={() => onClick(u.userId)}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-left text-[12px]"
            >
              <span className="text-text-primary truncate">{u.email}</span>
              <span className="text-red-300 tabular-nums whitespace-nowrap">{u.count}</span>
            </button>
          ))}
          {items.length > 8 && <p className="text-[11px] text-text-tertiary">외 {items.length - 8}명</p>}
        </div>
      )}
    </div>
  );
}
