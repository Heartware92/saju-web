'use client';

/**
 * 직업·연애 상태 입력 폼 — 프로필 생성·수정 시 사용.
 *
 * 데이터 흐름:
 * - jobState: 칩 선택 시 string 값, 직접 입력 시 빈 문자열 (custom 으로 이동)
 * - customJobState: 직접 입력 텍스트 (chip 미선택 시에만 사용)
 * - 같은 패턴: loveState / customLoveState
 *
 * 저장 시 호출자는 다음 매핑으로 DB 에 넣음:
 *   job_state: customJobState.trim() ? '직접 입력' : jobState  // 또는 chip 값을 그대로
 *   custom_job_state: customJobState.trim() || null
 */

import { useState } from 'react';
import { TODAY_JOB_STATES, TODAY_LOVE_STATES } from '@/constants/prompts';

interface Props {
  jobState: string;
  customJobState: string;
  loveState: string;
  customLoveState: string;
  onJobStateChange: (value: string) => void;
  onCustomJobStateChange: (value: string) => void;
  onLoveStateChange: (value: string) => void;
  onCustomLoveStateChange: (value: string) => void;
}

export function JobLoveStateInput({
  jobState,
  customJobState,
  loveState,
  customLoveState,
  onJobStateChange,
  onCustomJobStateChange,
  onLoveStateChange,
  onCustomLoveStateChange,
}: Props) {
  // 직접 입력 모드 — customXxxState 가 비어있지 않으면 true, 아니면 사용자가 토글
  const [jobCustomOpen, setJobCustomOpen] = useState(customJobState.length > 0);
  const [loveCustomOpen, setLoveCustomOpen] = useState(customLoveState.length > 0);

  return (
    <div className="space-y-5">
      {/* 직업 상태 */}
      <div>
        <label className="block text-[14px] font-semibold text-text-secondary mb-2">
          직업 상태
        </label>
        <div className="flex flex-wrap gap-2">
          {TODAY_JOB_STATES.map((s) => {
            const on = !jobCustomOpen && jobState === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  // 이미 선택된 칩을 다시 클릭하면 선택 해제 (저장 시 DB DEFAULT '직장인' 으로 채워짐)
                  onJobStateChange(on ? '' : s);
                  onCustomJobStateChange('');
                  setJobCustomOpen(false);
                }}
                className="px-3.5 py-2 rounded-full text-[13px] font-medium transition-all"
                style={{
                  border: `1.5px solid ${on ? 'var(--cta-primary)' : 'rgba(255,255,255,0.18)'}`,
                  background: on ? 'rgba(139,92,246,0.20)' : 'rgba(255,255,255,0.04)',
                  color: on ? '#E9D5FF' : 'var(--text-primary)',
                }}
              >
                {s}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setJobCustomOpen((prev) => {
                const next = !prev;
                if (next) {
                  onJobStateChange('');
                } else {
                  onCustomJobStateChange('');
                  onJobStateChange('직장인');
                }
                return next;
              });
            }}
            className="px-3.5 py-2 rounded-full text-[13px] font-medium transition-all"
            style={{
              border: `1.5px solid ${jobCustomOpen ? 'var(--cta-primary)' : 'rgba(255,255,255,0.18)'}`,
              background: jobCustomOpen ? 'rgba(139,92,246,0.20)' : 'rgba(255,255,255,0.04)',
              color: jobCustomOpen ? '#E9D5FF' : 'var(--text-tertiary)',
            }}
          >
            직접 입력
          </button>
        </div>
        {jobCustomOpen && (
          <input
            type="text"
            value={customJobState}
            onChange={(e) => onCustomJobStateChange(e.target.value.slice(0, 10))}
            maxLength={10}
            placeholder="10자 이내로 적어주세요"
            className="mt-2 w-full px-3 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[14px] text-text-primary placeholder-text-tertiary"
          />
        )}
      </div>

      {/* 연애 상태 */}
      <div>
        <label className="block text-[14px] font-semibold text-text-secondary mb-2">
          연애 상태
        </label>
        <div className="flex flex-wrap gap-2">
          {TODAY_LOVE_STATES.map((s) => {
            const on = !loveCustomOpen && loveState === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  // 이미 선택된 칩을 다시 클릭하면 선택 해제 (저장 시 DB DEFAULT '연애 중' 으로 채워짐)
                  onLoveStateChange(on ? '' : s);
                  onCustomLoveStateChange('');
                  setLoveCustomOpen(false);
                }}
                className="px-3.5 py-2 rounded-full text-[13px] font-medium transition-all"
                style={{
                  border: `1.5px solid ${on ? 'var(--cta-primary)' : 'rgba(255,255,255,0.18)'}`,
                  background: on ? 'rgba(139,92,246,0.20)' : 'rgba(255,255,255,0.04)',
                  color: on ? '#E9D5FF' : 'var(--text-primary)',
                }}
              >
                {s}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setLoveCustomOpen((prev) => {
                const next = !prev;
                if (next) {
                  onLoveStateChange('');
                } else {
                  onCustomLoveStateChange('');
                  onLoveStateChange('연애 중');
                }
                return next;
              });
            }}
            className="px-3.5 py-2 rounded-full text-[13px] font-medium transition-all"
            style={{
              border: `1.5px solid ${loveCustomOpen ? 'var(--cta-primary)' : 'rgba(255,255,255,0.18)'}`,
              background: loveCustomOpen ? 'rgba(139,92,246,0.20)' : 'rgba(255,255,255,0.04)',
              color: loveCustomOpen ? '#E9D5FF' : 'var(--text-tertiary)',
            }}
          >
            직접 입력
          </button>
        </div>
        {loveCustomOpen && (
          <input
            type="text"
            value={customLoveState}
            onChange={(e) => onCustomLoveStateChange(e.target.value.slice(0, 10))}
            maxLength={10}
            placeholder="10자 이내로 적어주세요"
            className="mt-2 w-full px-3 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[14px] text-text-primary placeholder-text-tertiary"
          />
        )}
      </div>
    </div>
  );
}
