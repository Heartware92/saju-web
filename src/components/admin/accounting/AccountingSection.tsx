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
interface DailyOps {
  date: string;
  payCount: number; payAmount: number;
  paidMoonUsed: number; freeMoonUsed: number;
  usageRevenue: number;
  refundCount: number; refundAmount: number;
}
interface Ledger {
  paid: { issuedMoon: number; consumedMoon: number; unusedMoon: number; issuedSupply: number; consumedSupply: number; unusedSupply: number };
  free: { issued: number; consumed: number; balance: number; bySource: { admin: number; event: number; welcome: number } };
  expiredMoon: number;
  total: { issued: number; consumed: number; balance: number };
  dbBalance: number;
  reconciled: boolean;
}
export interface AccountingSummary {
  generatedAt: string;
  dailyOps: DailyOps[];
  ledger: Ledger;
  refunds: { count: number; amount: number };
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
      if (m.usage > 0) rows.push(['매출(사용)', m.month, '계약부채', m.usage, '용역매출', m.usage, 'FIFO 유료 소비분']);
      if (m.breakage > 0) rows.push(['매출(낙전)', m.month, '계약부채', m.breakage, '용역매출', m.breakage, '탈퇴 미사용']);
    }
    if (fee) for (const pg of ['tosspay', 'inicis'] as const) {
      if (fee[pg].total > 0) {
        rows.push(['PG수수료', pg, '지급수수료', fee[pg].supply, '미수금', fee[pg].total, `${PG_LABEL[pg]} 수수료`]);
        rows.push(['PG수수료', pg, '부가세대급금', fee[pg].vat, '', '', '매입세액']);
      }
    }
    downloadCsv(`accounting-${timestampSuffix()}.csv`, toCsv(rows[0] as string[], rows.slice(1)));
  };

  // 일별 분개 카드용 — 최근 10일(KST), 결제 없는 날 포함
  const dailyJournal = useMemo(() => {
    if (!data) return [];
    const map = new Map(data.charge.byDate.map((c) => [c.date, c]));
    const kstNow = new Date(Date.now() + 540 * 60_000);
    const days: { date: string; c?: ChargeDay; isToday: boolean }[] = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date(kstNow);
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, c: map.get(key), isToday: i === 0 });
    }
    return days;
  }, [data]);

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

      {/* 크레딧 원장 (FIFO) — 유료/무료 발행·사용·잔액 + DB 대조 */}
      {data.ledger && (
        <Card title="크레딧 원장 (FIFO 기준)">
          <Table head={['구분', '발행', '사용', '소멸', '잔액', '금액(공급가)']}>
            <tr className="border-t border-white/5">
              <Td>유료 (결제)</Td>
              <Td right>{data.ledger.paid.issuedMoon.toLocaleString()}달</Td>
              <Td right>{data.ledger.paid.consumedMoon.toLocaleString()}달</Td>
              <Td right>-</Td>
              <Td right>{data.ledger.paid.unusedMoon.toLocaleString()}달</Td>
              <Td right>
                발행 {won(data.ledger.paid.issuedSupply)} · 매출 {won(data.ledger.paid.consumedSupply)} · 잔여 {won(data.ledger.paid.unusedSupply)}
              </Td>
            </tr>
            <tr className="border-t border-white/5">
              <Td>무료</Td>
              <Td right>{data.ledger.free.issued.toLocaleString()}달</Td>
              <Td right>{data.ledger.free.consumed.toLocaleString()}달</Td>
              <Td right>-</Td>
              <Td right>{data.ledger.free.balance.toLocaleString()}달</Td>
              <Td right><span className="text-text-tertiary">회계 무분개 (매출 아님)</span></Td>
            </tr>
            <tr className="border-t border-white/15 font-semibold">
              <Td>합계</Td>
              <Td right>{data.ledger.total.issued.toLocaleString()}달</Td>
              <Td right>{data.ledger.total.consumed.toLocaleString()}달</Td>
              <Td right>{data.ledger.expiredMoon.toLocaleString()}달</Td>
              <Td right>{data.ledger.total.balance.toLocaleString()}달</Td>
              <Td right></Td>
            </tr>
          </Table>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[12px]">
            <span className={data.ledger.reconciled ? 'text-green-300' : 'text-red-300 font-semibold'}>
              {data.ledger.reconciled
                ? `정합성 OK — 원장 잔액 = DB 잔액 (${data.ledger.dbBalance.toLocaleString()}달)`
                : `정합성 불일치! 원장 ${data.ledger.total.balance.toLocaleString()}달 vs DB ${data.ledger.dbBalance.toLocaleString()}달 — 조사 필요`}
            </span>
            <span className="text-text-tertiary">
              무료 출처: 수동지급 {data.ledger.free.bySource.admin.toLocaleString()} · 가입이벤트 {data.ledger.free.bySource.event.toLocaleString()} · 환영보너스 {data.ledger.free.bySource.welcome.toLocaleString()}
            </span>
          </div>
          <p className="text-[12px] text-text-tertiary mt-1.5">
            유료 잔여 {won(data.ledger.paid.unusedSupply)} = 활성회원 계약부채. (KPI의 계약부채 잔액은 탈퇴 낙전 반영분)
          </p>
        </Card>
      )}

      {/* 회계 루틴 가이드 */}
      <Card title="회계 루틴 (이카운트 일반전표 · 3차=차변 4대=대변)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px] text-text-secondary leading-relaxed">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[13px] font-semibold text-text-primary mb-1.5">매일 (전일분)</p>
            <p>1. 아래 "일별 분개"에서 어제 결제 확인 → 있으면 그대로 입력</p>
            <p>2. 통장에 PG 정산 입금 시: <span className="font-mono">3차 보통예금 / 4대 미수금</span> (입금액 그대로)</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[13px] font-semibold text-text-primary mb-1.5">매월 말일</p>
            <p>1. "월 마감 분개" 카드 → 용역매출 인식</p>
            <p>2. PG 세금계산서 수취: <span className="font-mono">3차 지급수수료+부가세대급금 / 4대 미수금</span></p>
            <p>3. LLM API 청구서 비용 인식</p>
            <p>4. 대사: 이카운트 계약부채 잔액 = 이 탭의 "계약부채 잔액"</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[13px] font-semibold text-text-primary mb-1.5">분기 (부가세 신고)</p>
            <p>매출세액 = 이 탭 부가세예수금 누계(신고기간분)</p>
            <p>신고서 반영: 신용카드·현금영수증 발행분 + 기타(토스부담). 매입세액 = PG 수수료 세금계산서분</p>
          </div>
        </div>
      </Card>

      {/* 일별 분개 (최근 10일) */}
      <Card title="일별 분개 — 최근 10일 (매일 이것만 입력)">
        <div className="space-y-1.5">
          {dailyJournal.map((d) => (
            <div key={d.date} className={`flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg px-3 py-2 border ${d.isToday ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
              <span className="text-[12px] text-text-tertiary w-[84px] shrink-0">{d.date}{d.isToday ? ' (오늘)' : ''}</span>
              {d.c ? (
                <span className="font-mono text-[12px] text-text-secondary">
                  3차 미수금 {d.c.amount.toLocaleString()} / 4대 계약부채 {d.c.contractLiab.toLocaleString()} / 4대 부가세예수금 {d.c.vat.toLocaleString()}
                  <span className="text-text-tertiary"> — 결제 {d.c.count}건 · 달 {d.c.moon}</span>
                  {d.isToday && <span className="text-amber-300"> (진행중 — 내일 확정치로 입력)</span>}
                </span>
              ) : (
                <span className="text-[12px] text-text-tertiary">결제 없음 — 분개 불필요</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* 일별 운영 현황 — 결제·사용·환불 */}
      <Card title="일별 운영 현황 (결제 · 달 사용 · 환불)">
        <Table head={['날짜', '결제', '결제액', '환불', '환불액', '유료 달 사용', '무료 달 사용', '사용매출(공급가)']}>
          {[...(data.dailyOps ?? [])].reverse().map((d) => (
            <tr key={d.date} className="border-t border-white/5">
              <Td>{d.date}</Td>
              <Td right>{d.payCount > 0 ? `${d.payCount}건` : '-'}</Td>
              <Td right>{d.payAmount > 0 ? won(d.payAmount) : '-'}</Td>
              <Td right>{d.refundCount > 0 ? `${d.refundCount}건` : '-'}</Td>
              <Td right>{d.refundAmount > 0 ? won(d.refundAmount) : '-'}</Td>
              <Td right>{d.paidMoonUsed > 0 ? `${d.paidMoonUsed}달` : '-'}</Td>
              <Td right>{d.freeMoonUsed > 0 ? `${d.freeMoonUsed}달` : '-'}</Td>
              <Td right>{d.usageRevenue > 0 ? won(d.usageRevenue) : '-'}</Td>
            </tr>
          ))}
        </Table>
        <p className="text-[12px] text-text-tertiary mt-2">
          사용매출 = 유료 달 소비분(FIFO)의 공급가액 — 월 합계가 "월 마감 분개"의 사용 매출과 일치.
          환불 발생 시 분개: <span className="font-mono">3차 계약부채 + 3차 부가세예수금 / 4대 보통예금(또는 미수금)</span>.
          {data.refunds?.count > 0 && <span className="text-red-300"> 누적 환불 {data.refunds.count}건 · {won(data.refunds.amount)}</span>}
        </p>
      </Card>

      {/* 충전 일자별 + 분개 */}
      <Card title="충전(결제) — 일자별 분개 (전체 이력)">
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
        <p className="text-[12px] text-text-tertiary mt-2">분개: (차)계약부채 / (대)용역매출. 부가세 없음(결제 시 이미 예수금).</p>
      </Card>

      {/* 월 마감 분개 — 이카운트 일반전표 그대로 옮겨 적는 용도 */}
      <Card title="월 마감 분개 (월 1회 · 이카운트 일반전표용)">
        <div className="space-y-3">
          {data.revenue.byMonth.map((m) => {
            const nowMonth = new Date(Date.now() + 540 * 60_000).toISOString().slice(0, 7);
            const isOpen = m.month === nowMonth;
            const lastDay = new Date(Number(m.month.slice(0, 4)), Number(m.month.slice(5, 7)), 0).getDate();
            return (
              <div key={m.month} className={`rounded-lg border p-3 ${isOpen ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-white/[0.03]'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[13px] font-semibold text-text-primary">
                    {m.month} <span className="text-text-tertiary font-normal">(전표일자 {m.month}-{String(lastDay).padStart(2, '0')})</span>
                  </p>
                  {isOpen && <span className="text-[11px] text-amber-300">진행중 — 월말 새로고침 후 확정치로 입력</span>}
                </div>
                <div className="font-mono text-[12px] text-text-secondary space-y-1">
                  {m.usage > 0 && (
                    <p>3차 계약부채 {m.usage.toLocaleString()} / 4대 용역매출 {m.usage.toLocaleString()} <span className="text-text-tertiary">— 크레딧 사용(FIFO)</span></p>
                  )}
                  {m.breakage > 0 && (
                    <p>3차 계약부채 {m.breakage.toLocaleString()} / 4대 용역매출 {m.breakage.toLocaleString()} <span className="text-text-tertiary">— 탈퇴 미사용 낙전</span></p>
                  )}
                  {m.total === 0 && <p className="text-text-tertiary">인식할 매출 없음</p>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[12px] text-text-tertiary mt-3">
          매월 말일: 새로고침 → 해당 월 카드의 분개를 이카운트 일반전표에 그대로 입력. 함께 할 것: PG 세금계산서 수취 시 (차)지급수수료+부가세대급금 / (대)미수금, LLM API 월 청구서 비용 인식.
        </p>
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
