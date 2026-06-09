'use client';

/**
 * /temp_test — 실시간 운세 결과 4열 비교 (검증용, 끝나면 제거 권장)
 * 사전 생성된 4일(6/7~6/10) × 4시간대(오전/오후/저녁/새벽) = 16개 결과를 public/temp-test-data.json 에서 읽어,
 * A·B·C·D 4개 열에서 각각 날짜·시간대를 골라 비교.
 * ★ 실제 제품 결과 페이지(TodayFortunePage)와 1:1 동일한 TodayResultView 를 그대로 렌더 →
 *   각 축(일진 카드·입력 요약·종합 점수·항목별·시간대 흐름·11섹션+시각카드)이 픽셀 단위로 같다.
 */

import { useEffect, useMemo, useState } from 'react';
import { TodayResultView } from '../../components/saju/TodayResultView';
import {
  parseTodayV3Sections, parseTodayV3DomainScores, parseTodayV3FlowScores,
  type TodayFortuneV3AIResult,
} from '../../services/fortuneService';
import { computeSajuFromProfile } from '../../utils/profileSaju';
import { TODAY_TIME_SLOT_LABELS, type TodayTimeSlot } from '../../constants/prompts';
import type { BirthProfile } from '../../types/credit';

const SLOTS = [
  { v: 'morning', label: '오전' }, { v: 'afternoon', label: '오후' },
  { v: 'evening', label: '저녁' }, { v: 'midnight', label: '새벽' },
];
const COL_LABELS = ['A', 'B', 'C', 'D'];

interface Item { date: string; slot: string; slotLabel: string; iljin: string; record: Record<string, any>; }

// record(JSON) → 제품과 동일한 report/result 로 변환해 TodayResultView 그대로 렌더
function TempColumn({ record }: { record: Record<string, any> }) {
  const content: string = record.interpretation_detailed || record.interpretation_basic || '';
  const eng = (record.engine_result ?? {}) as any;
  const todayGz = eng.todayGz;
  const userContext = eng.userContext;
  const isoDate = eng.isoDate as string | undefined;

  const profile: BirthProfile = {
    id: record.profile_id ?? 'temp', user_id: '', name: record.profile_name ?? '',
    birth_date: record.birth_date, birth_time: record.birth_time ?? undefined,
    birth_place: record.birth_place ?? 'seoul', gender: record.gender,
    calendar_type: record.calendar_type ?? 'solar', is_primary: false, created_at: '', updated_at: '',
  };
  const result = computeSajuFromProfile(profile);
  if (!result) return <p className="text-[13px] text-text-tertiary p-4">사주 계산 실패</p>;

  const report = {
    success: true,
    sections: parseTodayV3Sections(content),
    domainScores: parseTodayV3DomainScores(content),
    flowScores: parseTodayV3FlowScores(content),
    todayGz, isoDate, userContext,
  } as unknown as TodayFortuneV3AIResult;

  const reportDateStr = isoDate
    ? new Date(isoDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })
    : '';
  const slot: TodayTimeSlot = userContext?.timeSlot ?? 'morning';
  const ctxLabel = userContext
    ? `${TODAY_TIME_SLOT_LABELS[slot]} · ${userContext.hobbies?.[0] ?? userContext.customHobby ?? '자기계발'}`
    : null;

  return (
    <TodayResultView report={report} result={result} reportDateStr={reportDateStr} ctxLabel={ctxLabel} initialSlot={slot} />
  );
}

export default function TempTestPage() {
  const [data, setData] = useState<{ profile?: { name?: string }; items: Item[] } | null>(null);
  const [err, setErr] = useState('');
  const [cols, setCols] = useState([
    { date: '2026-06-01', slot: 'morning' },
    { date: '2026-06-03', slot: 'morning' },
    { date: '2026-06-08', slot: 'morning' },
    { date: '2026-06-19', slot: 'morning' },
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
                {item ? <TempColumn record={item.record} /> : <p className="text-[13px] text-text-tertiary p-4">해당 날짜·시간대 데이터 없음</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
