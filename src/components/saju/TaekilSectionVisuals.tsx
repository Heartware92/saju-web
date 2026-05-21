'use client';

/**
 * 택일 운세 결과 페이지의 각 섹션 본문 위에 박히는 시각 데이터 카드.
 *
 * 줄글 본문 위에 결정값(후보 날짜 등급 분포·피할 날·베스트 추천일)을 시각 박스로
 * 빼서 한눈에 보이게 한다. 정통사주 JungtongsajuSectionVisuals 와 같은 코스믹 톤.
 */

import type { TaekilDay, TaekilResult, TaekilGrade } from '../../engine/taekil';

const GRADE_COLOR: Record<TaekilGrade, string> = {
  '대길': '#34D399',
  '길': '#86EFAC',
  '평': '#94A3B8',
  '흉': '#F87171',
};
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-');
  const dow = WEEKDAYS[new Date(iso).getDay()] ?? '';
  return `${parseInt(m, 10)}/${parseInt(d, 10)}(${dow})`;
}

function CardWrap({
  accent,
  title,
  titleSub,
  children,
}: {
  accent: string;
  title: string;
  titleSub?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-4 border mb-3"
      style={{
        background: `linear-gradient(135deg, rgba(20,12,38,0.62) 0%, ${accent}10 60%, rgba(20,12,38,0.55) 100%)`,
        borderColor: `${accent}50`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[15px] font-bold tracking-[0.04em]" style={{ color: accent }}>
          {title}
          {titleSub && <span className="text-text-tertiary font-normal text-[13px] ml-1.5">{titleSub}</span>}
        </span>
      </div>
      {children}
    </div>
  );
}

// 날짜 칩 — 날짜 + 등급 + 점수
function DayChip({ day, rank }: { day: TaekilDay; rank?: number }) {
  const color = GRADE_COLOR[day.grade];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[14px] font-bold border"
      style={{ background: `${color}18`, borderColor: `${color}55`, color: 'var(--text-primary)' }}
    >
      {rank != null && (
        <span
          className="inline-flex items-center justify-center rounded-full text-[11px] w-4 h-4"
          style={{ background: color, color: '#1a1230' }}
        >
          {rank}
        </span>
      )}
      <span>{fmtDate(day.date)}</span>
      <span style={{ color }}>{day.grade}</span>
      <span className="text-text-tertiary font-normal text-[12.5px]">{day.score}점</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) 종합 분석 — 행사 + 후보 날짜 등급 분포
// ─────────────────────────────────────────────────────────────────────────────
function ComprehensiveVisual({ result, days }: { result: TaekilResult; days: TaekilDay[] }) {
  const eventLabel = result.subItem || result.customLabel || result.categoryLabel || '행사';
  const counts: Record<TaekilGrade, number> = { 대길: 0, 길: 0, 평: 0, 흉: 0 };
  days.forEach((d) => { counts[d.grade] += 1; });
  const best = days[0]; // 점수순 정렬 가정 (pickedDays)
  const max = Math.max(1, ...Object.values(counts));

  return (
    <CardWrap accent="#FCE8B2" title="택일 한눈 요약">
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span
          className="inline-flex items-center rounded-full px-3 py-1.5 text-[13.5px] font-bold border"
          style={{ background: 'rgba(252,232,178,0.15)', color: '#FCE8B2', borderColor: 'rgba(252,232,178,0.45)' }}
        >
          행사 · {eventLabel}
        </span>
        <span
          className="inline-flex items-center rounded-full px-3 py-1.5 text-[13.5px] font-bold border"
          style={{ background: 'rgba(201,166,255,0.15)', color: '#C9A6FF', borderColor: 'rgba(201,166,255,0.45)' }}
        >
          후보 {days.length}일 분석
        </span>
        {best && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13.5px] font-bold border"
            style={{ background: `${GRADE_COLOR[best.grade]}22`, color: GRADE_COLOR[best.grade], borderColor: `${GRADE_COLOR[best.grade]}55` }}
          >
            최고 추천 {fmtDate(best.date)}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {(['대길', '길', '평', '흉'] as const).map((g) => (
          <div key={g} className="flex items-center gap-2">
            <span className="text-[13px] font-bold w-9 shrink-0" style={{ color: GRADE_COLOR[g] }}>{g}</span>
            <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(counts[g] > 0 ? 8 : 0, (counts[g] / max) * 100)}%`, background: GRADE_COLOR[g] }}
              />
            </div>
            <span className="text-[12.5px] text-text-tertiary w-8 text-right shrink-0">{counts[g]}일</span>
          </div>
        ))}
      </div>
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) 피해야 할 날 — 후보 중 흉·평 등급 날짜
// ─────────────────────────────────────────────────────────────────────────────
function AvoidVisual({ days }: { days: TaekilDay[] }) {
  const bad = days.filter((d) => d.grade === '흉' || d.grade === '평');
  return (
    <CardWrap accent="#F87171" title="후보 중 조심할 날">
      {bad.length === 0 ? (
        <span className="text-[14px] text-text-tertiary leading-snug whitespace-pre-line">
          {'선택한 후보 날짜 중 흉·평 등급은 없어요\n비교적 안전한 후보들입니다.'}
        </span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {bad.map((d) => (
            <DayChip key={d.date} day={d} />
          ))}
        </div>
      )}
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) 행사 조언 — 베스트 추천일 1·2·3위
// ─────────────────────────────────────────────────────────────────────────────
function OverallVisual({ days }: { days: TaekilDay[] }) {
  const top = days.slice(0, 3);
  return (
    <CardWrap accent="#34D399" title="베스트 추천일" titleSub="점수 높은 순">
      {top.length === 0 ? (
        <span className="text-[14px] text-text-tertiary leading-snug">추천일 데이터 없음</span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {top.map((d, i) => (
            <DayChip key={d.date} day={d} rank={i + 1} />
          ))}
        </div>
      )}
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) 추천 대체 방법 — 베스트 3일 외 차선 후보
// ─────────────────────────────────────────────────────────────────────────────
function AlternativeVisual({ days }: { days: TaekilDay[] }) {
  const rest = days.slice(3);
  return (
    <CardWrap accent="#C9A6FF" title="차선 후보일" titleSub="베스트 3일 외">
      {rest.length === 0 ? (
        <span className="text-[14px] text-text-tertiary leading-snug whitespace-pre-line">
          {'선택한 후보가 3일 이하예요\n더 많은 날을 비교하려면 다시 풀이받아 날짜를 추가해 보세요.'}
        </span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {rest.map((d) => (
            <DayChip key={d.date} day={d} />
          ))}
        </div>
      )}
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 통합 라우터
// ─────────────────────────────────────────────────────────────────────────────
export function renderTaekilSectionVisual(
  key: 'comprehensive' | 'avoid' | 'overall' | 'alternative',
  result: TaekilResult | null,
  days: TaekilDay[],
) {
  if (days.length === 0) return null;
  switch (key) {
    case 'comprehensive':
      return result ? <ComprehensiveVisual result={result} days={days} /> : null;
    case 'avoid':
      return <AvoidVisual days={days} />;
    case 'overall':
      return <OverallVisual days={days} />;
    case 'alternative':
      return <AlternativeVisual days={days} />;
    default:
      return null;
  }
}
