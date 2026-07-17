/**
 * 회계 탭 — 선불 '달' 크레딧의 계약부채 모델 회계처리.
 *
 * 흐름 순서 그대로 배치해 "위에서 아래로 따라 하면 끝"이 되도록 구성:
 *   KPI → ① 매일 루틴(일별 분개) → ② 월말 루틴(월 마감 분개 + 정산 입금 기록)
 *       → ③ 부가세 신고(기간별) → ④ 검증·조회(크레딧 원장 + 접이식 상세)
 *
 * 정산 입금은 admin_settlements 테이블에 저장(마이그 057) — 재입력 불필요, 수수료 자동 역산.
 * 이카운트 일반전표 기준 표기: 3차=차변, 4대=대변.
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
  liabIncrease: number; liabDecrease: number; liabDelta: number; liabBalance: number;
  moonIssued: number; moonBalance: number;
}
interface Ledger {
  paid: { issuedMoon: number; consumedMoon: number; unusedMoon: number; issuedSupply: number; consumedSupply: number; unusedSupply: number };
  free: { issued: number; consumed: number; balance: number; bySource: { admin: number; event: number; welcome: number } };
  expiredMoon: number;
  total: { issued: number; consumed: number; balance: number };
  dbBalance: number;
  reconciled: boolean;
}
interface VatPeriod {
  key: string; label: string; total: number; supply: number; vat: number;
  inicis: number; inicisVat: number; tosspay: number; tosspayVat: number;
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
  vat: { payable: number; periods: VatPeriod[] };
  free: { issued: number; consumed: number; balance: number };
  unitTable: { name: string; supplyUnit: number }[];
}
interface Settlement { id: string; pg: 'tosspay' | 'inicis'; deposited_on: string; amount: number; memo: string | null; }

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const PG_LABEL: Record<string, string> = { tosspay: '토스페이', inicis: 'KG이니시스(카드)' };
const kstToday = () => new Date(Date.now() + 540 * 60_000).toISOString().slice(0, 10);

export function AccountingSection({ token }: { token: string | null }) {
  const [data, setData] = useState<AccountingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // 정산 입금 기록 (DB 저장)
  const [setl, setSetl] = useState<{ items: Settlement[]; totals: Record<'tosspay' | 'inicis', number> } | null>(null);
  const [setlForm, setSetlForm] = useState<{ pg: 'tosspay' | 'inicis'; date: string; amount: string; memo: string }>({ pg: 'inicis', date: kstToday(), amount: '', memo: '' });
  const [setlBusy, setSetlBusy] = useState(false);
  const [setlError, setSetlError] = useState('');
  // 일별 분개 — 최근 10일 이전 이력 펼침
  const [showOldJournal, setShowOldJournal] = useState(false);

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

  const fetchSettlements = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/accounting/settlements', { headers: { 'x-admin-key': token } });
      const json = await res.json();
      if (res.ok) setSetl(json);
    } catch { /* 목록 실패는 표만 비움 */ }
  }, [token]);

  useEffect(() => { void fetchData(); void fetchSettlements(); }, [fetchData, fetchSettlements]);

  const addSettlement = async () => {
    if (!token) return;
    const amount = parseInt(setlForm.amount, 10);
    if (!amount || amount <= 0) { setSetlError('금액을 입력하세요'); return; }
    setSetlBusy(true); setSetlError('');
    try {
      const res = await fetch('/api/admin/accounting/settlements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': token },
        body: JSON.stringify({ pg: setlForm.pg, depositedOn: setlForm.date, amount, memo: setlForm.memo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '저장 실패');
      setSetlForm((f) => ({ ...f, amount: '', memo: '' }));
      await fetchSettlements();
    } catch (e) { setSetlError(e instanceof Error ? e.message : '오류'); }
    finally { setSetlBusy(false); }
  };

  const deleteSettlement = async (id: string) => {
    if (!token || !confirm('이 입금 기록을 삭제할까요?')) return;
    try {
      await fetch('/api/admin/accounting/settlements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': token },
        body: JSON.stringify({ id }),
      });
      await fetchSettlements();
    } catch { /* ignore */ }
  };

  // 일별 분개 카드 — 최근 10일(KST), 결제 없는 날 포함
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

  // 수수료 역산 — 저장된 입금 합계 기반 (수수료 = 결제총액 − 입금누계)
  const fee = useMemo(() => {
    if (!data) return null;
    const calc = (pg: 'tosspay' | 'inicis') => {
      const sales = data.charge.pgTotals[pg] ?? 0;
      const dep = setl?.totals?.[pg] ?? 0;
      const residual = sales - dep; // 미수금 잔액 = 미입금분 + 수수료
      const vat = Math.round(Math.max(0, residual) * 10 / 110);
      return { sales, dep, residual, supply: Math.max(0, residual) - vat, vat, rate: sales ? (residual / sales) * 100 : 0 };
    };
    return { tosspay: calc('tosspay'), inicis: calc('inicis') };
  }, [data, setl]);

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
    for (const s of setl?.items ?? []) {
      rows.push(['정산입금', s.deposited_on, '보통예금', s.amount, '미수금', s.amount, `${PG_LABEL[s.pg]} 정산${s.memo ? ` — ${s.memo}` : ''}`]);
    }
    downloadCsv(`accounting-${timestampSuffix()}.csv`, toCsv(rows[0] as string[], rows.slice(1)));
  };

  if (loading && !data) return <div className="text-[14px] text-text-tertiary">회계 자료 불러오는 중…</div>;
  if (error) return <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-[14px] text-red-300">{error}</div>;
  if (!data) return null;

  const nowMonth = kstToday().slice(0, 7);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-primary">회계 (계약부채 모델)</h2>
          <p className="text-[12px] text-text-tertiary mt-0.5">결제=계약부채+부가세예수금 · 사용=용역매출(FIFO) · 이카운트 일반전표 3차=차변 4대=대변</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="text-[13px] text-text-secondary hover:text-text-primary border border-white/15 hover:border-white/30 px-3 py-1.5 rounded-lg">이카운트 CSV</button>
          <button onClick={() => { fetchData(true); fetchSettlements(); }} className="text-[13px] text-cta border border-cta/30 hover:border-cta/60 px-3 py-1.5 rounded-lg">새로고침</button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="결제총액(공급대가)" value={won(data.charge.total)} />
        <Kpi label="계약부채 잔액" value={won(data.contractLiability.balance)} color="text-indigo-300" sub="미사용 유료 달 — 이카운트와 대사" />
        <Kpi label="누적 용역매출(공급가)" value={won(data.revenue.total)} sub={`사용 ${won(data.revenue.usageTotal)} · 낙전 ${won(data.revenue.breakageTotal)}`} />
        <Kpi label="부가세예수금 누계" value={won(data.vat.payable)} color="text-amber-300" sub="신고기간별은 ③ 참조" />
      </div>

      {/* ── ① 매일 루틴 ── */}
      <SectionTitle no="①" title="매일 루틴" desc="어제 결제 분개 입력 + 통장 입금 시 아래 ②의 정산 기록" />
      <Card title="일별 분개 — 최근 10일">
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

          {/* 10일 이전 이력 — 결제 있던 날만 분개 형식으로 */}
          {(() => {
            const cutoff = dailyJournal.length ? dailyJournal[dailyJournal.length - 1].date : '';
            const older = data.charge.byDate.filter((c) => c.date < cutoff).slice().reverse();
            if (older.length === 0) return null;
            return (
              <>
                <button
                  onClick={() => setShowOldJournal((v) => !v)}
                  className="w-full text-center text-[12px] text-text-tertiary hover:text-text-secondary border border-white/10 hover:border-white/20 rounded-lg py-1.5 transition-colors"
                >
                  {showOldJournal ? '이전 분개 접기' : `이전 분개 전체 보기 (${older.length}일)`}
                </button>
                {showOldJournal && older.map((c) => (
                  <div key={c.date} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg px-3 py-2 border border-white/5 bg-white/[0.02]">
                    <span className="text-[12px] text-text-tertiary w-[84px] shrink-0">{c.date}</span>
                    <span className="font-mono text-[12px] text-text-secondary">
                      3차 미수금 {c.amount.toLocaleString()} / 4대 계약부채 {c.contractLiab.toLocaleString()} / 4대 부가세예수금 {c.vat.toLocaleString()}
                      <span className="text-text-tertiary"> — 결제 {c.count}건 · 달 {c.moon}</span>
                    </span>
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      </Card>

      {/* ── ② 월말 루틴 ── */}
      <SectionTitle no="②" title="월말 루틴" desc="용역매출 인식 → PG 세금계산서 수취 시 수수료 분개 → LLM 청구서 비용 → 대사(계약부채 잔액 일치 확인)" />
      <Card title="월 마감 분개 (이카운트 일반전표에 그대로 입력)">
        <div className="space-y-3">
          {data.revenue.byMonth.map((m) => {
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
      </Card>

      <Card title="정산 입금 기록 (저장됨 — 수수료 자동 역산)">
        {/* 입력 폼 */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select
            value={setlForm.pg}
            onChange={(e) => setSetlForm((f) => ({ ...f, pg: e.target.value as 'tosspay' | 'inicis' }))}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/15 text-[13px] text-text-primary"
          >
            <option value="inicis">KG이니시스</option>
            <option value="tosspay">토스페이</option>
          </select>
          <input type="date" value={setlForm.date} onChange={(e) => setSetlForm((f) => ({ ...f, date: e.target.value }))}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/15 text-[13px] text-text-primary" />
          <input type="number" placeholder="입금액" value={setlForm.amount} onChange={(e) => setSetlForm((f) => ({ ...f, amount: e.target.value }))}
            className="w-32 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/15 text-[13px] text-text-primary tabular-nums" />
          <input type="text" placeholder="메모(선택)" value={setlForm.memo} onChange={(e) => setSetlForm((f) => ({ ...f, memo: e.target.value }))}
            className="w-40 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/15 text-[13px] text-text-primary" />
          <button onClick={addSettlement} disabled={setlBusy}
            className="px-3 py-1.5 rounded-lg bg-cta text-white text-[13px] font-medium disabled:opacity-40">
            {setlBusy ? '저장 중…' : '입금 추가'}
          </button>
          {setlError && <span className="text-[12px] text-red-300">{setlError}</span>}
        </div>

        {/* PG별 요약 — 결제총액/입금누계/미수금 잔액 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {(['inicis', 'tosspay'] as const).map((pg) => (
            <div key={pg} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[13px]">
              <p className="font-semibold text-text-primary mb-1.5">{PG_LABEL[pg]}</p>
              <div className="space-y-0.5 text-text-secondary">
                <div className="flex justify-between"><span>결제총액</span><span className="tabular-nums">{won(data.charge.pgTotals[pg] ?? 0)}</span></div>
                <div className="flex justify-between"><span>입금누계</span><span className="tabular-nums">{won(fee?.[pg].dep ?? 0)}</span></div>
                <div className="flex justify-between font-medium text-text-primary border-t border-white/10 pt-1 mt-1">
                  <span>미수금 잔액</span><span className="tabular-nums">{won(fee?.[pg].residual ?? 0)}</span>
                </div>
                {(fee?.[pg].residual ?? 0) > 0 && (fee?.[pg].dep ?? 0) > 0 && (
                  <p className="text-[11px] text-text-tertiary pt-1">
                    정산 완료 시 이 잔액이 수수료 — 지급수수료 {won(fee?.[pg].supply ?? 0)} + 부가세대급금 {won(fee?.[pg].vat ?? 0)} ({(fee?.[pg].rate ?? 0).toFixed(2)}%)
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 입금 이력 */}
        {(setl?.items?.length ?? 0) > 0 && (
          <Table head={['입금일', 'PG', '금액', '메모', '분개', '']}>
            {(setl?.items ?? []).map((s) => (
              <tr key={s.id} className="border-t border-white/5">
                <Td>{s.deposited_on}</Td>
                <Td>{PG_LABEL[s.pg]}</Td>
                <Td right>{won(s.amount)}</Td>
                <Td>{s.memo ?? '-'}</Td>
                <Td><span className="font-mono text-[11px] text-text-tertiary">3차 보통예금 / 4대 미수금 {s.amount.toLocaleString()}</span></Td>
                <Td right>
                  <button onClick={() => deleteSettlement(s.id)} className="text-[12px] text-text-tertiary hover:text-red-300">삭제</button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
        <p className="text-[12px] text-text-tertiary mt-2">
          통장에 입금 찍히면 여기 기록 + 이카운트에 같은 분개 입력. 수수료 확정 분개(월말 세금계산서 수취 시):
          <span className="font-mono"> 3차 지급수수료 + 3차 부가세대급금 / 4대 미수금</span> — 금액은 세금계산서 숫자 우선.
        </p>
      </Card>

      {/* ── ③ 부가세 신고 ── */}
      <SectionTitle no="③" title="부가세 신고" desc="분기별 매출세액 — 신고서의 신용카드·현금영수증 발행분 + 기타(토스부담)로 반영" />
      <Card title="신고기간별 매출 집계">
        <Table head={['신고기간', '매출합계(공급대가)', '과세표준(공급가액)', '매출세액(부가세)', '이니시스분', '토스분']}>
          {data.vat.periods.map((p) => (
            <tr key={p.key} className="border-t border-white/5">
              <Td>{p.label}</Td>
              <Td right>{won(p.total)}</Td>
              <Td right><b>{won(p.supply)}</b></Td>
              <Td right><b className="text-amber-300">{won(p.vat)}</b></Td>
              <Td right>{won(p.inicis)} <span className="text-text-tertiary">(세액 {won(p.inicisVat)})</span></Td>
              <Td right>{won(p.tosspay)} <span className="text-text-tertiary">(세액 {won(p.tosspayVat)})</span></Td>
            </tr>
          ))}
        </Table>
        <p className="text-[12px] text-text-tertiary mt-2">
          이니시스분 = 신용카드매출전표 발행분. 토스분은 카드/현금영수증(토스머니)/기타(토스부담)로 나뉨 —
          정확한 3분할은 토스 상점관리자의 "부가세 신고 참고자료" 화면 숫자를 사용. 매입세액은 PG 수수료 세금계산서분(②).
        </p>
      </Card>

      {/* ── ④ 검증·조회 ── */}
      <SectionTitle no="④" title="검증·조회" desc="정합성 확인과 상세 데이터 — 매일 볼 필요 없음, 어긋날 때만" />

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
        </Card>
      )}

      <Fold title="일별 운영 현황 (결제 · 사용 · 환불 · 계약부채 · 달 잔량)">
        <Table head={['날짜', '결제', '환불', '달 사용 (유/무료)', '사용매출', '계약부채 +', '계약부채 −', '증감', '계약부채 잔액', '달 잔량']}>
          {[...(data.dailyOps ?? [])].reverse().map((d) => (
            <tr key={d.date} className="border-t border-white/5">
              <Td>{d.date}</Td>
              <Td right>{d.payAmount > 0 ? `${d.payCount}건 ${won(d.payAmount)}` : '-'}</Td>
              <Td right>{d.refundAmount > 0 ? `${d.refundCount}건 ${won(d.refundAmount)}` : '-'}</Td>
              <Td right>{d.paidMoonUsed > 0 || d.freeMoonUsed > 0 ? `${d.paidMoonUsed} / ${d.freeMoonUsed}` : '-'}</Td>
              <Td right>{d.usageRevenue > 0 ? won(d.usageRevenue) : '-'}</Td>
              <Td right>{d.liabIncrease > 0 ? <span className="text-green-300">+{d.liabIncrease.toLocaleString()}</span> : '-'}</Td>
              <Td right>{d.liabDecrease > 0 ? <span className="text-red-300">−{d.liabDecrease.toLocaleString()}</span> : '-'}</Td>
              <Td right>
                <span className={d.liabDelta > 0 ? 'text-green-300' : d.liabDelta < 0 ? 'text-red-300' : ''}>
                  {d.liabDelta > 0 ? '+' : ''}{d.liabDelta.toLocaleString()}
                </span>
              </Td>
              <Td right><b>{d.liabBalance.toLocaleString()}</b></Td>
              <Td right><b>{d.moonBalance.toLocaleString()}달</b></Td>
            </tr>
          ))}
        </Table>
        <p className="text-[12px] text-text-tertiary mt-2">
          계약부채(공급가): + 충전 / − 사용매출·탈퇴낙전. 최신 행 = 현재 잔액(KPI·원장과 일치해야 정상).
          환불 발생 시 분개: <span className="font-mono">3차 계약부채 + 3차 부가세예수금 / 4대 보통예금(또는 미수금)</span>.
          {data.refunds?.count > 0 && <span className="text-red-300"> 누적 환불 {data.refunds.count}건 · {won(data.refunds.amount)}</span>}
        </p>
      </Fold>

      <Fold title="충전(결제) 전체 이력 — 일자별 분개">
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
      </Fold>

      <Fold title="매출 인식 월별 요약 · 패키지별 판매 · 무료 크레딧">
        <div className="space-y-4">
          <Table head={['월', '사용 매출', '낙전 매출', '합계']}>
            {data.revenue.byMonth.map((m) => (
              <tr key={m.month} className="border-t border-white/5">
                <Td>{m.month}</Td><Td right>{won(m.usage)}</Td><Td right>{won(m.breakage)}</Td><Td right>{won(m.total)}</Td>
              </tr>
            ))}
          </Table>
          <Table head={['패키지', '판매', '금액', '달']}>
            {data.charge.packages.map((p) => (
              <tr key={p.id} className="border-t border-white/5">
                <Td>{p.name}</Td><Td right>{p.count}건</Td><Td right>{won(p.amount)}</Td><Td right>{p.moon}</Td>
              </tr>
            ))}
          </Table>
          <div className="grid grid-cols-3 gap-3">
            <Kpi label="무료 발행" value={`${data.free.issued.toLocaleString()}달`} />
            <Kpi label="무료 소비" value={`${data.free.consumed.toLocaleString()}달`} />
            <Kpi label="무료 잔액" value={`${data.free.balance.toLocaleString()}달`} />
          </div>
        </div>
      </Fold>

      <p className="text-[11px] text-text-tertiary">
        생성 {new Date(data.generatedAt).toLocaleString('ko-KR')} · LLM API 비용은 월 청구서 기준 별도 인식 · 이카운트 장부와 1~2원 끗수 차는 반올림 특성(결산 시 잡손익 정리).
      </p>
    </div>
  );
}

function SectionTitle({ no, title, desc }: { no: string; title: string; desc: string }) {
  return (
    <div className="pt-2">
      <h3 className="text-[15px] font-bold text-text-primary">{no} {title}</h3>
      <p className="text-[12px] text-text-tertiary mt-0.5">{desc}</p>
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
function Fold({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border border-white/10 bg-white/[0.02]">
      <summary className="cursor-pointer select-none px-4 py-3 text-[14px] font-semibold text-text-secondary hover:text-text-primary">
        {title} <span className="text-[12px] text-text-tertiary font-normal">(펼치기)</span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
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
