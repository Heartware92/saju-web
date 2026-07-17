/**
 * 회계 탭 — 선불 '달' 크레딧의 계약부채 모델 회계처리 자료.
 * /api/admin/accounting/summary 를 조회해 충전·매출·계약부채·부가세·무료통계를 표시하고,
 * 정산 입금액(수동 입력)으로 PG 수수료·부가세대급금을 역산한다. 이카운트 전표 CSV 내보내기.
 *
 * 순수 표시 + 로컬 입력만. 서버 상태 변경 없음(읽기 전용 라우트).
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toCsv, downloadCsv, timestampSuffix } from '../csvExport';

interface ChargeDay { date: string; amount: number; contractLiab: number; vat: number; count: number; moon: number; }
interface RevMonth { month: string; usage: number; breakage: number; total: number; }
export interface AccountingSummary {
  generatedAt: string;
  charge: {
    byDate: ChargeDay[]; total: number; contractLiab: number; vat: number;
    pgTotals: Record<string, number>;
    packages: { id: string; name: string; count: number; amount: number; moon: number }[];
  };
  revenue: { byMonth: RevMonth[]; usageTotal: number; breakageTotal: number; total: number };
  contractLiability: { issued: number; recognized: number; balance: number; paidUnusedSupply: number };
  vat: { payable: number };
  free: { issued: number; consumed: number; balance: number };
  unitTable: { name: string; supplyUnit: number }[];
}

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const PG_LABEL: Record<string, string> = { tosspay: '토스페이', inicis: 'KG이니시스(카드)' };

export function AccountingSection({ token }: { token: string | null }) {
  const [data, setData] = useState<AccountingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // 정산 실입금액(수동 입력) — PG별
  const [deposit, setDeposit] = useState<{ tosspay: string; inicis: string }>({ tosspay: '', inicis: '' });

  const fetchData = useCallback(async (force = false) => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/accounting/summary${force ? '?force=1' : ''}`, { headers: { 'x-admin-key': token } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '조회 실패');
      setData(json);
    } catch (e) { setError(e instanceof Error ? e.message : '오류'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // 수수료 역산: 수수료(총액,VAT포함) = 결제총액 − 실입금 · 부가세대급금 = 수수료 × 10/110
  const fee = useMemo(() => {
    if (!data) return null;
    const calc = (pg: 'tosspay' | 'inicis') => {
      const sales = data.charge.pgTotals[pg] ?? 0;
      const dep = parseInt(deposit[pg] || '0', 10) || 0;
      const total = dep > 0 ? sales - dep : 0;
      const vat = Math.round(total * 10 / 110);
      return { sales, dep, total, supply: total - vat, vat, rate: sales ? (total / sales) * 100 : 0 };
    };
    return { tosspay: calc('tosspay'), inicis: calc('inicis') };
  }, [data, deposit]);

  const exportCsv = () => {
    if (!data) return;
    const rows: (string | number)[][] = [];
    rows.push(['구분', '일자/월', '차변계정', '차변금액', '대변계정', '대변금액', '적요']);
    for (const c of data.charge.byDate) {
      rows.push(['충전', c.date, '미수금', c.amount, '계약부채', c.contractLiab, `달 크레딧 판매 ${c.count}건`]);
      rows.push(['충전', c.date, '', '', '부가세예수금', c.vat, '매출부가세(결제시)']);
    }
    for (const m of data.revenue.byMonth) {
      if (m.usage > 0) rows.push(['매출(사용)', m.month, '계약부채', m.usage, '매출', m.usage, 'FIFO 유료 소비분']);
      if (m.breakage > 0) rows.push(['매출(낙전)', m.month, '계약부채', m.breakage, '매출', m.breakage, '탈퇴 미사용']);
    }
    if (fee) for (const pg of ['tosspay', 'inicis'] as const) {
      if (fee[pg].total > 0) {
        rows.push(['PG수수료', pg, '지급수수료', fee[pg].supply, '미수금', fee[pg].total, `${PG_LABEL[pg]} 수수료`]);
        rows.push(['PG수수료', pg, '부가세대급금', fee[pg].vat, '', '', '매입세액']);
      }
    }
    downloadCsv(`accounting-${timestampSuffix()}.csv`, toCsv(rows[0] as string[], rows.slice(1)));
  };

  if (loading && !data) return <div className="text-[14px] text-text-tertiary">회계 자료 불러오는 중…</div>;
  if (error) return <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-[14px] text-red-300">{error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-primary">회계 (계약부채 모델)</h2>
          <p className="text-[12px] text-text-tertiary mt-0.5">선불 달 크레딧을 결제=계약부채, 사용=매출(FIFO)로 처리. 부가세는 결제 시점.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="text-[13px] text-text-secondary hover:text-text-primary border border-white/15 hover:border-white/30 px-3 py-1.5 rounded-lg">이카운트 CSV</button>
          <button onClick={() => fetchData(true)} className="text-[13px] text-cta border border-cta/30 hover:border-cta/60 px-3 py-1.5 rounded-lg">새로고침</button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="결제총액(공급대가)" value={won(data.charge.total)} />
        <Kpi label="계약부채 잔액" value={won(data.contractLiability.balance)} color="text-indigo-300" sub="미사용 유료 달" />
        <Kpi label="누적 매출(공급가)" value={won(data.revenue.total)} sub={`사용 ${won(data.revenue.usageTotal)} · 낙전 ${won(data.revenue.breakageTotal)}`} />
        <Kpi label="부가세예수금" value={won(data.vat.payable)} color="text-amber-300" sub="매출세액(결제시)" />
      </div>

      {/* 충전 일자별 + 분개 */}
      <Card title="충전(결제) — 일자별 분개">
        <Table head={['결제일', '결제총액', '(대)계약부채', '(대)부가세예수금', '건수', '발행 달']}>
          {data.charge.byDate.map((c) => (
            <tr key={c.date} className="border-t border-white/5">
              <Td>{c.date}</Td><Td right>{won(c.amount)}</Td><Td right>{won(c.contractLiab)}</Td>
              <Td right>{won(c.vat)}</Td><Td right>{c.count}</Td><Td right>{c.moon}</Td>
            </tr>
          ))}
          <tr className="border-t border-white/15 font-semibold">
            <Td>합계</Td><Td right>{won(data.charge.total)}</Td><Td right>{won(data.charge.contractLiab)}</Td>
            <Td right>{won(data.charge.vat)}</Td><Td right></Td><Td right></Td>
          </tr>
        </Table>
        <p className="text-[12px] text-text-tertiary mt-2">분개: (차)미수금 결제총액 / (대)계약부채 + 부가세예수금. 부가세는 결제금액 × 10/110.</p>
      </Card>

      {/* 매출 월별 */}
      <Card title="매출 인식 — 월별 (FIFO 유료 소비 + 탈퇴 낙전)">
        <Table head={['월', '사용 매출', '낙전 매출', '합계']}>
          {data.revenue.byMonth.map((m) => (
            <tr key={m.month} className="border-t border-white/5">
              <Td>{m.month}</Td><Td right>{won(m.usage)}</Td><Td right>{won(m.breakage)}</Td><Td right>{won(m.total)}</Td>
            </tr>
          ))}
          <tr className="border-t border-white/15 font-semibold">
            <Td>합계</Td><Td right>{won(data.revenue.usageTotal)}</Td><Td right>{won(data.revenue.breakageTotal)}</Td><Td right>{won(data.revenue.total)}</Td>
          </tr>
        </Table>
        <p className="text-[12px] text-text-tertiary mt-2">분개: (차)계약부채 / (대)매출. 부가세 없음(결제 시 이미 예수금).</p>
      </Card>

      {/* 정산 입금 → 수수료 역산 */}
      <Card title="정산·PG수수료 (실입금액 입력)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['tosspay', 'inicis'] as const).map((pg) => (
            <div key={pg} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[13px] font-semibold text-text-primary mb-2">{PG_LABEL[pg]}</p>
              <div className="flex items-center gap-2 text-[13px] mb-2">
                <span className="text-text-tertiary w-20">결제총액</span>
                <span className="text-text-primary tabular-nums">{won(data.charge.pgTotals[pg] ?? 0)}</span>
              </div>
              <div className="flex items-center gap-2 text-[13px] mb-2">
                <span className="text-text-tertiary w-20">실입금액</span>
                <input
                  type="number" value={deposit[pg]}
                  onChange={(e) => setDeposit((d) => ({ ...d, [pg]: e.target.value }))}
                  placeholder="계좌 입금액 합계"
                  className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/15 text-text-primary tabular-nums text-[13px] focus:outline-none focus:border-cta/50"
                />
              </div>
              {fee && fee[pg].dep > 0 && (
                <div className="text-[12px] text-text-secondary space-y-0.5 mt-2 pt-2 border-t border-white/10">
                  <div className="flex justify-between"><span>수수료(총액)</span><span className="tabular-nums">{won(fee[pg].total)} ({fee[pg].rate.toFixed(2)}%)</span></div>
                  <div className="flex justify-between"><span>└ 지급수수료(공급가)</span><span className="tabular-nums">{won(fee[pg].supply)}</span></div>
                  <div className="flex justify-between"><span>└ 부가세대급금</span><span className="tabular-nums text-amber-300">{won(fee[pg].vat)}</span></div>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-[12px] text-text-tertiary mt-3">
          분개(입금일): (차)보통예금+지급수수료 / (대)미수금. 부가세대급금은 <b>월말 PG 세금계산서 수취 시</b> 한 번: (차)부가세대급금 / (대)지급수수료.
        </p>
      </Card>

      {/* 무료 크레딧 통계 */}
      <Card title="무료 크레딧 (회계 무분개 · 통계만)">
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="무료 발행" value={`${data.free.issued.toLocaleString()}달`} />
          <Kpi label="무료 소비" value={`${data.free.consumed.toLocaleString()}달`} />
          <Kpi label="무료 잔액" value={`${data.free.balance.toLocaleString()}달`} />
        </div>
        <p className="text-[12px] text-text-tertiary mt-2">무료 지급·소비는 현금·용역대가가 아니므로 회계 이벤트 없음. FIFO로 유료/무료 소비를 분리해 매출에서 자동 제외.</p>
      </Card>

      <p className="text-[11px] text-text-tertiary">생성 {new Date(data.generatedAt).toLocaleString('ko-KR')} · LLM API 비용은 월 청구서 기준 별도 인식.</p>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4">
      <p className="text-[12px] text-text-secondary mb-1.5">{label}</p>
      <p className={`text-[20px] font-bold tabular-nums ${color ?? 'text-text-primary'}`}>{value}</p>
      {sub && <p className="text-[11px] text-text-tertiary mt-1">{sub}</p>}
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <h3 className="text-[14px] font-semibold text-text-primary mb-3">{title}</h3>
      {children}
    </div>
  );
}
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-[13px]">
        <thead><tr className="bg-white/3 text-[11px] text-text-tertiary uppercase">
          {head.map((h, i) => <th key={h} className={`px-3 py-2 font-medium ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>)}
        </tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Td({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <td className={`px-3 py-2 ${right ? 'text-right tabular-nums text-text-secondary' : 'text-left text-text-primary'}`}>{children}</td>;
}
