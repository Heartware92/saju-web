'use client';

/**
 * /temp_test — 실시간 운세 결과 4열 비교 (검증용, 끝나면 제거 권장)
 * 사전 생성된 4일(6/7~6/10) × 4시간대(오전/오후/저녁/새벽) = 16개 결과를 public/temp-test-data.json 에서 읽어,
 * A·B·C·D 4개 열에서 각각 날짜·시간대를 골라 실제 결과 페이지 UI(TodayResultBlock) 그대로 나란히 비교.
 */

import { useEffect, useMemo, useState } from 'react';
import { TodayResultBlock } from '../../components/share/blocks/TodayResultBlock';

const SLOTS = [
  { v: 'morning', label: '오전' }, { v: 'afternoon', label: '오후' },
  { v: 'evening', label: '저녁' }, { v: 'midnight', label: '새벽' },
];
const COL_LABELS = ['A', 'B', 'C', 'D'];

interface Item { date: string; slot: string; slotLabel: string; iljin: string; record: Record<string, unknown>; }

export default function TempTestPage() {
  const [data, setData] = useState<{ profile?: { name?: string }; items: Item[] } | null>(null);
  const [err, setErr] = useState('');
  const [cols, setCols] = useState([
    { date: '2026-06-07', slot: 'morning' },
    { date: '2026-06-08', slot: 'morning' },
    { date: '2026-06-09', slot: 'morning' },
    { date: '2026-06-10', slot: 'morning' },
  ]);

  useEffect(() => {
    fetch('/temp-test-data.json', { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('데이터 파일 없음(아직 생성 중일 수 있음)')))
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  const dates = useMemo(() => data ? Array.from(new Set(data.items.map((i) => i.date))) : [], [data]);
  const find = (date: string, slot: string) => data?.items.find((i) => i.date === date && i.slot === slot);
  const setCol = (idx: number, patch: Partial<{ date: string; slot: string }>) =>
    setCols((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));

  return (
    <div className="min-h-screen bg-space-deep text-text-primary px-3 py-4">
      <h1 className="text-lg font-bold mb-1">실시간 운세 결과 4열 비교 (임시)</h1>
      <p className="text-[12.5px] text-text-tertiary mb-3">
        대표 프로필 {data?.profile?.name ?? '허진우'} · 분야=업무·일 · 직업/연애 미입력. 각 열에서 날짜·시간대를 골라 일진별 차이를 비교하세요. (사전 생성, 크레딧 차감 없음)
      </p>
      {err && <div className="mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[13px] text-amber-200">{err}</div>}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {cols.map((c, idx) => {
          const item = find(c.date, c.slot);
          return (
            <div key={idx} className="shrink-0 w-[360px] border border-[var(--border-subtle)] rounded-2xl overflow-hidden bg-[rgba(20,12,38,0.4)]">
              <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 bg-space-surface/95 border-b border-[var(--border-subtle)] backdrop-blur">
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-cta text-white text-[12px] font-bold">{COL_LABELS[idx]}</span>
                <select value={c.date} onChange={(e) => setCol(idx, { date: e.target.value })}
                  className="px-2 py-1 rounded bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.12)] text-[12px]">
                  {dates.map((d) => <option key={d} value={d}>{d.slice(5)}</option>)}
                </select>
                <select value={c.slot} onChange={(e) => setCol(idx, { slot: e.target.value })}
                  className="px-2 py-1 rounded bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.12)] text-[12px]">
                  {SLOTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                </select>
                {item && <span className="ml-auto text-[11px] text-text-tertiary">일진 {item.iljin}</span>}
              </div>
              <div className="p-2">
                {item ? <TodayResultBlock record={item.record as never} showSectionVisuals /> : <p className="text-[13px] text-text-tertiary p-4">해당 날짜·시간대 데이터 없음</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
