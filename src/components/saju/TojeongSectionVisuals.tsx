'use client';

/**
 * 토정비결 결과 페이지의 각 섹션 본문 위에 박히는 시각 데이터 카드.
 *
 * 줄글 본문 위에 결정값(올해 등급·괘 구조·영역별 기운·주의 항목)을 시각 박스로
 * 빼서 한눈에 보이게 한다. 정통사주 JungtongsajuSectionVisuals 와 같은 코스믹 톤.
 *
 * 영역별 카드(재물·애정·직장·건강·창업이전)는 144괘 테이블의 결정론적
 * domainMoods 를 쓰므로 AI 응답과 무관하게 항상 렌더된다.
 * 월별 흐름(monthly)·개운 조언(advice)은 페이지에 별도 시각 카드가 이미 있어 제외.
 */

import type { TojeongResult } from '../../engine/tojeong';
import type { TojeongReading } from '../../engine/tojeong/reading';
import type { GwaeGrade } from '../../engine/tojeong/gwae-table';
import type { TojeongSectionKey } from '../../constants/prompts';

type DomainScores = { wealth: number; love: number; health: number; career: number };

const GRADE_COLOR: Record<GwaeGrade, string> = {
  대길: '#34D399',
  길: '#86EFAC',
  중길: '#FBBF24',
  평: '#CBD5E1',
  중흉: '#FB923C',
  흉: '#F87171',
  대흉: '#EF4444',
};

// 오행 한자 → 색 + 한글 표기
const ELEMENT_COLOR: Record<string, string> = {
  木: '#34D399', 火: '#F87171', 土: '#FBBF24', 金: '#E5E7EB', 水: '#60A5FA',
};
const ELEMENT_KOR: Record<string, string> = {
  木: '목', 火: '화', 土: '토', 金: '금', 水: '수',
};

function splitMood(mood: string): string[] {
  return mood
    .split(/\s*,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// 공통 래퍼
// ─────────────────────────────────────────────────────────────────────────────
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
          {titleSub && (
            <span className="text-text-tertiary font-normal text-[13px] ml-1.5">{titleSub}</span>
          )}
        </span>
      </div>
      {children}
    </div>
  );
}

// 기운 키워드 칩 묶음
function MoodChips({ phrases, color }: { phrases: string[]; color: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {phrases.map((p, i) => (
        <span
          key={i}
          className="text-[13px] font-semibold px-2.5 py-1.5 rounded-lg border text-text-secondary"
          style={{ background: `${color}14`, borderColor: `${color}45`, wordBreak: 'keep-all' }}
        >
          {p}
        </span>
      ))}
    </div>
  );
}

// 등급 알약 배지
function GradeBadge({ grade }: { grade: GwaeGrade }) {
  const color = GRADE_COLOR[grade];
  return (
    <span
      className="text-[13px] font-bold px-2.5 py-1 rounded-full shrink-0"
      style={{ color, background: `${color}22` }}
    >
      {grade}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) 올해의 총운 — 괘 번호 + 등급 + 4분야 평균 + 최고·보완 분야
// ─────────────────────────────────────────────────────────────────────────────
function ChongunVisual({
  tojeong,
  reading,
  scores,
}: {
  tojeong: TojeongResult;
  reading: TojeongReading;
  scores: DomainScores | null;
}) {
  const gColor = GRADE_COLOR[reading.grade];
  const domains = scores
    ? [
        { label: '재물운', score: scores.wealth },
        { label: '애정·가정', score: scores.love },
        { label: '건강운', score: scores.health },
        { label: '직장·학업', score: scores.career },
      ]
    : [];
  const avg =
    scores != null
      ? Math.round((scores.wealth + scores.love + scores.health + scores.career) / 4)
      : null;
  const sorted = [...domains].sort((a, b) => b.score - a.score);
  const best = sorted[0] ?? null;
  const worst = sorted.length > 1 ? sorted[sorted.length - 1] : null;

  return (
    <CardWrap accent={gColor} title="올해 운세 한눈 요약">
      {/* 헤로 — 등급을 가운데 크게, 괘 번호·평균은 보조 라인 */}
      <div className="flex flex-col items-center text-center">
        <span className="text-[12px] text-text-tertiary mb-1.5">올해의 운세 등급</span>
        <span
          className="text-[30px] font-bold leading-none px-6 py-2.5 rounded-2xl border"
          style={{
            color: gColor,
            background: `${gColor}1a`,
            borderColor: `${gColor}55`,
            fontFamily: 'var(--font-serif)',
          }}
        >
          {reading.grade}
        </span>
        <span className="text-[12.5px] text-text-tertiary mt-2">
          144괘 중 {tojeong.gwaeNumber}괘
          {avg != null && (
            <>
              {' · 분야 평균 '}
              <span className="font-bold" style={{ color: gColor }}>
                {avg}점
              </span>
            </>
          )}
        </span>
      </div>

      {/* 최고·보완 분야 — 동일 크기 셀 2칸 */}
      {best && worst && (
        <div className="grid grid-cols-2 gap-2 mt-3.5">
          {[
            { tag: '가장 빛나는 분야', d: best, c: '#34D399', arrow: '▲' },
            { tag: '살펴야 할 분야', d: worst, c: '#FB923C', arrow: '▼' },
          ].map(({ tag, d, c, arrow }) => (
            <div
              key={tag}
              className="rounded-xl px-3 py-2.5 border flex flex-col gap-1.5"
              style={{ background: `${c}12`, borderColor: `${c}40` }}
            >
              <span className="text-[11.5px] text-text-tertiary">{tag}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-[11px]" style={{ color: c }}>
                  {arrow}
                </span>
                <span className="text-[15px] font-bold text-text-primary">{d.label}</span>
                <span className="text-[14px] font-bold ml-auto" style={{ color: c }}>
                  {d.score}점
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) 괘의 의미 — 상괘·중괘·하괘 3층 구조
// ─────────────────────────────────────────────────────────────────────────────
function GwaeVisual({ tojeong }: { tojeong: TojeongResult }) {
  const up = tojeong.upperGwae;
  const mid = tojeong.middleGwae;
  const low = tojeong.lowerGwae;
  const upColor = ELEMENT_COLOR[up.element] ?? '#C9A6FF';
  const elKor = ELEMENT_KOR[up.element] ?? up.element;

  const rows = [
    {
      tag: '상괘',
      main: `${up.symbol} ${up.name}(${up.hanja})`,
      sub: `${elKor}의 기운 · ${up.meaning}`,
      color: upColor,
    },
    { tag: '중괘', main: mid.position, sub: mid.meaning, color: '#C9A6FF' },
    { tag: '하괘', main: low.name, sub: low.meaning, color: '#94A3B8' },
  ];

  return (
    <CardWrap accent="#C9A6FF" title="괘 구조" titleSub={`${tojeong.gwaeNumber}괘`}>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div
            key={r.tag}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 border"
            style={{ background: `${r.color}10`, borderColor: `${r.color}45` }}
          >
            <span
              className="text-[12px] font-bold w-10 shrink-0 text-center px-1.5 py-1 rounded-md"
              style={{ color: r.color, background: `${r.color}22` }}
            >
              {r.tag}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-bold text-text-primary leading-tight">{r.main}</div>
              <div className="text-[12.5px] text-text-tertiary leading-snug mt-0.5">{r.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) 영역별 기운 — 144괘 결정론적 domainMoods 키워드 칩 (재물·애정·직장·건강)
// ─────────────────────────────────────────────────────────────────────────────
function DomainMoodVisual({
  title,
  grade,
  mood,
}: {
  title: string;
  grade: GwaeGrade;
  mood: string;
}) {
  const color = GRADE_COLOR[grade];
  return (
    <CardWrap accent={color} title={title}>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[12.5px] text-text-tertiary">올해 이 분야에 흐르는 기운</span>
        <span className="ml-auto" />
        <GradeBadge grade={grade} />
      </div>
      <MoodChips phrases={splitMood(mood)} color={color} />
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) 창업·이전운 — 재물·직장 두 측면의 결정론적 기운 묶음
// ─────────────────────────────────────────────────────────────────────────────
function BusinessMoveVisual({
  grade,
  wealthMood,
  careerMood,
}: {
  grade: GwaeGrade;
  wealthMood: string;
  careerMood: string;
}) {
  const color = GRADE_COLOR[grade];
  return (
    <CardWrap accent={color} title="창업·이전 흐름" titleSub="재물운·직장운 기반">
      <div className="flex items-center mb-2.5">
        <span className="text-[12.5px] text-text-tertiary">도전과 이동을 받쳐 주는 두 기운</span>
        <span className="ml-auto" />
        <GradeBadge grade={grade} />
      </div>
      <div className="flex flex-col gap-3">
        <div>
          <div className="text-[12px] font-bold mb-1.5" style={{ color }}>
            재물 측면
          </div>
          <MoodChips phrases={splitMood(wealthMood)} color={color} />
        </div>
        <div>
          <div className="text-[12px] font-bold mb-1.5" style={{ color }}>
            직장·도약 측면
          </div>
          <MoodChips phrases={splitMood(careerMood)} color={color} />
        </div>
      </div>
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) 주의해야 할 점 — 결정론적 주의 항목 칩 리스트
// ─────────────────────────────────────────────────────────────────────────────
function WarningVisual({ reading }: { reading: TojeongReading }) {
  const items = reading.warnings;
  if (!items.length) return null;
  return (
    <CardWrap accent="#F87171" title="올해 조심할 점" titleSub={`${items.length}가지`}>
      <div className="flex flex-col gap-2">
        {items.map((w, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 border"
            style={{ background: '#F8717110', borderColor: '#F8717140' }}
          >
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0 text-[12px] font-bold"
              style={{ background: '#F8717128', color: '#F87171' }}
            >
              !
            </span>
            <span className="text-[14px] text-text-secondary leading-snug">{w}</span>
          </div>
        ))}
      </div>
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 통합 라우터 — 섹션 키에 맞는 시각 카드 반환
// ─────────────────────────────────────────────────────────────────────────────
export function renderTojeongSectionVisual(
  key: TojeongSectionKey,
  tojeong: TojeongResult,
  reading: TojeongReading,
  scores: DomainScores | null,
) {
  const moods = reading.entry.domainMoods;
  switch (key) {
    case 'chongun':
      return <ChongunVisual tojeong={tojeong} reading={reading} scores={scores} />;
    case 'gwae':
      return <GwaeVisual tojeong={tojeong} />;
    case 'wealth':
      return <DomainMoodVisual title="재물·성공운" grade={reading.grade} mood={moods.wealth} />;
    case 'love':
      return <DomainMoodVisual title="가정·애정운" grade={reading.grade} mood={moods.love} />;
    case 'career':
      return <DomainMoodVisual title="학업·대인운" grade={reading.grade} mood={moods.career} />;
    case 'health':
      return <DomainMoodVisual title="건강·소망운" grade={reading.grade} mood={moods.health} />;
    case 'business_move':
      return (
        <BusinessMoveVisual
          grade={reading.grade}
          wealthMood={moods.wealth}
          careerMood={moods.career}
        />
      );
    case 'warning':
      return <WarningVisual reading={reading} />;
    default:
      // monthly·advice 는 페이지에 별도 시각 카드가 이미 있어 제외
      return null;
  }
}
