/**
 * 글로벌 오디언스 필터 바 — 인구통계/세그먼트로 모든 분석을 같은 코호트로 슬라이스.
 * 값이 바뀌면 onChange 로 상위(AdminPage)에 알리고, AdminPage 가 현재 탭을 재조회한다.
 * 서버에서는 _audience.ts 가 f_* 파라미터를 받아 user_id 집합으로 변환해 집계에 적용.
 */
'use client';

import { AGE_BUCKETS, GENDER_LABEL, PROVIDER_LABEL, SEGMENT_LABEL } from '@/constants/adminLabels';

export interface AudienceFilterValue {
  gender: string;
  ageBucket: string;
  segment: string;
  provider: string;
  joinedFrom: string;
  joinedTo: string;
}

export const EMPTY_AUDIENCE: AudienceFilterValue = {
  gender: '', ageBucket: '', segment: '', provider: '', joinedFrom: '', joinedTo: '',
};

export function isAudienceActive(v: AudienceFilterValue): boolean {
  return !!(v.gender || v.ageBucket || v.segment || v.provider || v.joinedFrom || v.joinedTo);
}

const selCls =
  'px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/15 text-[13px] text-text-primary focus:outline-none focus:border-cta/50';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[12px] text-text-tertiary whitespace-nowrap">{label}</span>
      {children}
    </label>
  );
}

export function AudienceFilterBar({
  value,
  onChange,
  note,
}: {
  value: AudienceFilterValue;
  onChange: (next: AudienceFilterValue) => void;
  note?: string;
}) {
  const set = (patch: Partial<AudienceFilterValue>) => onChange({ ...value, ...patch });
  const active = isAudienceActive(value);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 mb-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`text-[12px] font-semibold ${active ? 'text-cta' : 'text-text-secondary'}`}>
          코호트 필터{active ? ' · 적용중' : ''}
        </span>

        <Field label="성별">
          <select className={selCls} value={value.gender} onChange={(e) => set({ gender: e.target.value })}>
            <option value="">전체</option>
            {Object.entries(GENDER_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>

        <Field label="연령대">
          <select className={selCls} value={value.ageBucket} onChange={(e) => set({ ageBucket: e.target.value })}>
            <option value="">전체</option>
            {AGE_BUCKETS.map((b) => (
              <option key={b.key} value={b.key}>{b.label}</option>
            ))}
          </select>
        </Field>

        <Field label="세그먼트">
          <select className={selCls} value={value.segment} onChange={(e) => set({ segment: e.target.value })}>
            <option value="">전체</option>
            {Object.entries(SEGMENT_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v.text}</option>
            ))}
          </select>
        </Field>

        <Field label="가입경로">
          <select className={selCls} value={value.provider} onChange={(e) => set({ provider: e.target.value })}>
            <option value="">전체</option>
            {Object.entries(PROVIDER_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>

        <Field label="가입일">
          <input type="date" className={selCls} value={value.joinedFrom} onChange={(e) => set({ joinedFrom: e.target.value })} />
          <span className="text-[12px] text-text-tertiary">~</span>
          <input type="date" className={selCls} value={value.joinedTo} onChange={(e) => set({ joinedTo: e.target.value })} />
        </Field>

        {active && (
          <button
            onClick={() => onChange(EMPTY_AUDIENCE)}
            className="px-2.5 py-1.5 rounded-lg text-[12px] text-text-tertiary border border-white/15 hover:text-text-primary hover:border-white/30 transition-colors"
          >
            초기화
          </button>
        )}
      </div>
      {note && <p className="text-[11px] text-text-tertiary mt-2">{note}</p>}
    </div>
  );
}
