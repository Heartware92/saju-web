/**
 * 순수 SVG 도넛 차트 — 외부 라이브러리 없음
 * 성별 분포, 세그먼트 분포 등 카테고리 비율 시각화에 사용.
 */
'use client';

interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface Props {
  slices: Slice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({ slices, size = 140, thickness = 22, centerLabel, centerValue }: Props) {
  const total = slices.reduce((s, v) => s + v.value, 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;

  let offset = 0;
  const segs = slices.map(s => {
    const frac = total > 0 ? s.value / total : 0;
    const seg = { ...s, frac, dash: c * frac, offset: c * offset };
    offset += frac;
    return seg;
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={thickness} />
        {total > 0 && segs.map(s => (
          <circle
            key={s.key}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${s.dash} ${c - s.dash}`}
            strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        ))}
        {(centerLabel || centerValue) && (
          <g>
            {centerValue && (
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                className="fill-white font-bold" style={{ fontSize: 20 }}>
                {centerValue}
              </text>
            )}
            {centerLabel && (
              <text x={cx} y={cy + 18} textAnchor="middle" dominantBaseline="central"
                className="fill-white/50" style={{ fontSize: 11 }}>
                {centerLabel}
              </text>
            )}
          </g>
        )}
      </svg>
      <div className="space-y-1.5 text-[13px]">
        {slices.map(s => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
              <span className="text-text-secondary min-w-[56px]">{s.label}</span>
              <span className="text-text-primary font-medium">{s.value.toLocaleString()}</span>
              <span className="text-text-tertiary">({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
