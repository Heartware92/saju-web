/**
 * /temp_terms · /temp_privacy 비교용 테이블 (검토용, 런칭 전 제거 권장)
 * 5개 서비스(이천점 + 경쟁 4사)를 가로 5축으로 나란히 비교.
 * 좌측 항목열·상단 서비스명 고정, 우리(이천점) 열 하이라이트.
 */
import React from 'react';

export type CmpStatus = 'O' | 'X' | 'P' | 'I';
export interface CmpCell { s: CmpStatus; t: string }
export interface CmpRow { topic: string; cells: CmpCell[] }
export interface LegalComparisonProps {
  title: string;
  subtitle?: string;
  services: string[];
  highlightIndex?: number;
  rows: CmpRow[];
}

const STATUS: Record<CmpStatus, { label: string; cls: string }> = {
  O: { label: 'O', cls: 'text-green-400 bg-green-500/15 border-green-500/30' },
  X: { label: 'X', cls: 'text-red-400 bg-red-500/15 border-red-500/30' },
  P: { label: '△', cls: 'text-amber-300 bg-amber-500/15 border-amber-500/30' },
  I: { label: '·', cls: 'text-text-tertiary bg-white/5 border-white/10' },
};

export function LegalComparison({ title, subtitle, services, highlightIndex = 0, rows }: LegalComparisonProps) {
  const STICKY = '#140c28';
  return (
    <div className="max-w-[1500px] mx-auto px-4 py-8">
      <h1 className="text-[22px] font-bold text-text-primary">{title}</h1>
      {subtitle && <p className="text-[13px] text-text-tertiary mt-1 leading-relaxed">{subtitle}</p>}

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12px] text-text-tertiary">
        <span><span className="text-green-400 font-bold">O</span> 조항 있음</span>
        <span><span className="text-amber-300 font-bold">△</span> 부분/약함</span>
        <span><span className="text-red-400 font-bold">X</span> 없음</span>
        <span className="text-cta">파란 열 = 우리(이천점)</span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
        <table className="border-collapse text-[12.5px]" style={{ minWidth: 960 }}>
          <thead>
            <tr>
              <th
                className="sticky left-0 z-20 text-left px-3 py-3 text-text-tertiary font-medium align-bottom"
                style={{ background: STICKY, width: 140, minWidth: 140 }}
              >
                비교 항목
              </th>
              {services.map((s, i) => (
                <th
                  key={s}
                  className={`text-left px-3 py-3 font-semibold align-bottom ${i === highlightIndex ? 'text-cta' : 'text-text-secondary'}`}
                  style={{ width: 248, minWidth: 248, background: i === highlightIndex ? 'rgba(124,92,252,0.12)' : 'rgba(124,92,252,0.05)' }}
                >
                  {s}{i === highlightIndex ? ' (우리)' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-t border-[var(--border-subtle)] align-top">
                <th
                  className="sticky left-0 z-10 text-left px-3 py-2.5 text-text-secondary font-medium"
                  style={{ background: STICKY, width: 140, minWidth: 140 }}
                >
                  {row.topic}
                </th>
                {row.cells.map((c, ci) => (
                  <td
                    key={ci}
                    className="px-3 py-2.5 leading-snug"
                    style={{ width: 248, minWidth: 248, background: ci === highlightIndex ? 'rgba(124,92,252,0.06)' : undefined }}
                  >
                    <span className={`inline-flex items-center justify-center rounded border mr-1.5 font-bold align-top ${STATUS[c.s].cls}`} style={{ width: 18, height: 18, fontSize: 11 }}>
                      {STATUS[c.s].label}
                    </span>
                    <span className="text-text-secondary">{c.t}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] text-text-tertiary">
        ※ 검토용 임시 페이지입니다. 출처: 4사 공개 약관/방침(2026-06 수집) + 우리 운영본. 런칭 전 제거 예정.
      </p>
    </div>
  );
}
