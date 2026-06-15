/**
 * 가로 막대 — 연령대 분포 / 가입 경로 등.
 * 각 행: 라벨 + 수치 + 막대. 최대값 대비 비율로 너비 계산.
 */
'use client';

interface Bar {
  key: string;
  label: string;
  value: number;
  color?: string;
}

interface Props {
  bars: Bar[];
  defaultColor?: string;
  showPercent?: boolean;
  emptyMessage?: string;
}

export function HorizontalBarChart({
  bars,
  defaultColor = 'rgba(167, 139, 250, 0.7)',
  showPercent = true,
  emptyMessage = '데이터 없음',
}: Props) {
  const total = bars.reduce((s, b) => s + b.value, 0);
  const max = Math.max(1, ...bars.map(b => b.value));

  if (bars.length === 0 || total === 0) {
    return <p className="text-[13px] text-text-tertiary py-6 text-center">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {bars.map(b => {
        const widthPct = Math.max(2, (b.value / max) * 100);
        const pct = total > 0 ? Math.round((b.value / total) * 100) : 0;
        return (
          <div key={b.key} className="grid grid-cols-[120px_1fr_auto] items-center gap-2 text-[13px]">
            <span className="text-text-secondary truncate" title={b.label}>{b.label}</span>
            <div className="h-5 rounded bg-white/5 overflow-hidden relative">
              <div
                className="h-full rounded transition-all"
                style={{ width: `${widthPct}%`, background: b.color ?? defaultColor }}
              />
            </div>
            <span className="text-text-primary font-medium tabular-nums min-w-[60px] text-right">
              {b.value.toLocaleString()}
              {showPercent && <span className="text-text-tertiary ml-1">({pct}%)</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
