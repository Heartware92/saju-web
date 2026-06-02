/**
 * 세로 막대 — 시계열 시각화(월별 코호트, 일별 추이, 시간대 분포 등).
 * 막대가 많으면(>14) 막대 위 숫자를 숨기고 x축 라벨을 일정 간격으로만 표시해 가독성 확보.
 * 값은 hover(title)로 확인. 적은 막대(≤14)는 기존처럼 숫자+전체 라벨 표시.
 */
'use client';

interface Bar {
  key: string;
  label: string;
  value: number;
}

interface Props {
  bars: Bar[];
  color?: string;
  height?: number;
  emptyMessage?: string;
}

export function VerticalBarChart({
  bars,
  color = 'rgba(96, 165, 250, 0.75)',
  height = 160,
  emptyMessage = '데이터 없음',
}: Props) {
  const total = bars.reduce((s, b) => s + b.value, 0);
  const max = Math.max(1, ...bars.map(b => b.value));

  if (bars.length === 0 || total === 0) {
    return <p className="text-[13px] text-text-tertiary py-6 text-center">{emptyMessage}</p>;
  }

  // 막대가 많으면 빽빽해지므로 숫자 숨김 + 라벨 솎아내기
  const many = bars.length > 14;
  // x축 라벨은 최대 ~7개만(처음·마지막 포함) 노출
  const step = many ? Math.ceil(bars.length / 7) : 1;
  const showLabel = (i: number) => i === 0 || i === bars.length - 1 || i % step === 0;

  return (
    <div className="w-full">
      <div className={`flex items-end ${many ? 'gap-px' : 'gap-1.5'} px-2`} style={{ height }}>
        {bars.map(b => {
          const h = (b.value / max) * (height - (many ? 8 : 28));
          return (
            <div key={b.key} className="flex-1 flex flex-col items-center justify-end min-w-0">
              {!many && (
                <span className="text-[11px] text-text-tertiary mb-1 tabular-nums">
                  {b.value > 0 ? b.value : ''}
                </span>
              )}
              <div
                className="w-full rounded-t transition-all min-h-[2px] hover:brightness-125"
                style={{ height: Math.max(2, h), background: color }}
                title={`${b.label}: ${b.value.toLocaleString('ko-KR')}`}
              />
            </div>
          );
        })}
      </div>
      <div className={`flex ${many ? 'gap-px' : 'gap-1.5'} px-2 pt-1 border-t border-white/5`}>
        {bars.map((b, i) => (
          <div key={b.key} className="flex-1 text-center text-[10px] text-text-tertiary truncate whitespace-nowrap">
            {showLabel(i) ? b.label : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
