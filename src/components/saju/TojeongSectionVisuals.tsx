'use client';

/**
 * 토정비결 결과 페이지의 각 섹션 본문 위에 박히는 시각 데이터 카드.
 *
 * 줄글 본문 위에 결정값(올해 등급·분야별 점수·괘 구조·주의 항목)을 시각 박스로
 * 빼서 한눈에 보이게 한다. 정통사주 JungtongsajuSectionVisuals 와 같은 코스믹 톤.
 *
 * 월별 흐름(monthly)·개운 조언(advice)은 페이지에 별도 시각 카드(TojeongMonthlyCards,
 * LuckyVisualCard)가 이미 있어 여기서는 다루지 않는다.
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

const FORTUNE_GRADE_COLOR: Record<string, string> = {
  대길: '#34D399',
  길: '#86EFAC',
  중길: '#FBBF24',
  평: '#CBD5E1',
  중흉: '#FB923C',
  흉: '#F87171',
};

function scoreToGrade(s: number): string {
  if (s >= 90) return '대길';
  if (s >= 82) return '길';
  if (s >= 72) return '중길';
  if (s >= 65) return '평';
  if (s >= 60) return '중흉';
  return '흉';
}

// 오행 한자/한글 → 색 + 한글 표기
const ELEMENT_COLOR: Record<string, string> = {
  木: '#34D399', 火: '#F87171', 土: '#FBBF24', 金: '#E5E7EB', 水: '#60A5FA',
};
const ELEMENT_KOR: Record<string, string> = {
  木: '목', 火: '화', 土: '토', 金: '금', 水: '수',
};

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

function GaugeBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, Math.max(4, score))}%`, background: color }}
      />
    </div>
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
      <div className="flex items-center gap-3 mb-3">
        <div
          className="flex flex-col items-center justify-center rounded-xl px-3 py-2 border shrink-0"
          style={{ background: `${gColor}18`, borderColor: `${gColor}55` }}
        >
          <span className="text-[11px] text-text-tertiary leading-none mb-1">올해의 괘</span>
          <span
            className="text-[22px] font-bold leading-none"
            style={{ color: gColor, fontFamily: 'var(--font-serif)' }}
          >
            {tojeong.gwaeNumber}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-text-tertiary mb-0.5">144괘 중 {tojeong.gwaeNumber}괘</div>
          <div className="text-[20px] font-bold leading-tight" style={{ color: gColor }}>
            {reading.grade}
          </div>
        </div>
        {avg != null && (
          <div className="text-right shrink-0">
            <div className="text-[11px] text-text-tertiary leading-none mb-1">분야 평균</div>
            <div className="text-[24px] font-bold leading-none" style={{ color: gColor }}>
              {avg}
              <span className="text-[13px] text-text-tertiary font-normal ml-0.5">점</span>
            </div>
          </div>
        )}
      </div>
      {best && worst && (
        <div className="grid grid-cols-2 gap-2">
          <div
            className="rounded-xl px-3 py-2.5 border"
            style={{ background: '#34D39912', borderColor: '#34D39945' }}
          >
            <div className="text-[12px] text-text-tertiary mb-1">가장 빛나는 분야</div>
            <div className="text-[14px] font-bold" style={{ color: '#34D399' }}>
              {best.label} {best.score}점
            </div>
          </div>
          <div
            className="rounded-xl px-3 py-2.5 border"
            style={{ background: '#FB923C12', borderColor: '#FB923C45' }}
          >
            <div className="text-[12px] text-text-tertiary mb-1">살펴야 할 분야</div>
            <div className="text-[14px] font-bold" style={{ color: '#FB923C' }}>
              {worst.label} {worst.score}점
            </div>
          </div>
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
// 3) 분야별 점수 게이지 — 재물·애정·직장·건강·창업이전 공용
// ─────────────────────────────────────────────────────────────────────────────
const DOMAIN_INTERP: Record<string, [string, string, string]> = {
  // [좋음 대길·길, 보통 중길·평, 주의 중흉·흉]
  wealth: [
    '재물이 들어오고 불어나는 흐름이에요',
    '큰 기복 없이 차분하게 지킬 수 있는 해예요',
    '지출 관리와 신중한 결정이 필요한 해예요',
  ],
  love: [
    '인연과 가정에 따뜻한 기운이 가득한 해예요',
    '무난하게 관계를 이어 갈 수 있는 해예요',
    '감정 표현과 배려에 더 신경 써야 하는 해예요',
  ],
  career: [
    '배움과 사람 모두 순조롭게 풀리는 해예요',
    '꾸준함이 결실로 이어지는 흐름이에요',
    '조급함을 내려놓고 기초를 다질 때예요',
  ],
  health: [
    '몸과 마음이 활기로 채워지는 해예요',
    '큰 탈 없이 컨디션을 유지할 수 있는 해예요',
    '무리를 피하고 휴식을 충분히 챙겨야 해요',
  ],
  business_move: [
    '새 도전과 이동에 길이 활짝 열리는 해예요',
    '준비를 갖추면 무리 없이 옮길 수 있는 해예요',
    '지금은 자리를 지키며 때를 기다릴 때예요',
  ],
};

function gradeBucket(grade: string): 0 | 1 | 2 {
  if (grade === '대길' || grade === '길') return 0;
  if (grade === '중길' || grade === '평') return 1;
  return 2;
}

function DomainGaugeVisual({
  domain,
  title,
  scoreSub,
  score,
}: {
  domain: keyof typeof DOMAIN_INTERP;
  title: string;
  scoreSub?: string;
  score: number;
}) {
  const grade = scoreToGrade(score);
  const color = FORTUNE_GRADE_COLOR[grade] ?? '#CBD5E1';
  const interp = DOMAIN_INTERP[domain][gradeBucket(grade)];
  return (
    <CardWrap accent={color} title={title} titleSub={scoreSub}>
      <div className="flex items-end gap-2 mb-2.5">
        <span className="text-[30px] font-bold leading-none" style={{ color }}>
          {score}
        </span>
        <span className="text-[14px] text-text-tertiary mb-0.5">점</span>
        <span
          className="ml-auto text-[14px] font-bold px-2.5 py-1 rounded-full"
          style={{ color, background: `${color}22` }}
        >
          {grade}
        </span>
      </div>
      <GaugeBar score={score} color={color} />
      <p className="text-[14px] text-text-secondary mt-2.5 leading-relaxed">{interp}</p>
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) 주의해야 할 점 — 결정론적 주의 항목 칩 리스트
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
  switch (key) {
    case 'chongun':
      return <ChongunVisual tojeong={tojeong} reading={reading} scores={scores} />;
    case 'gwae':
      return <GwaeVisual tojeong={tojeong} />;
    case 'wealth':
      return scores ? (
        <DomainGaugeVisual domain="wealth" title="재물·성공운 점수" score={scores.wealth} />
      ) : null;
    case 'love':
      return scores ? (
        <DomainGaugeVisual domain="love" title="가정·애정운 점수" score={scores.love} />
      ) : null;
    case 'career':
      return scores ? (
        <DomainGaugeVisual domain="career" title="학업·대인운 점수" score={scores.career} />
      ) : null;
    case 'health':
      return scores ? (
        <DomainGaugeVisual domain="health" title="건강·소망운 점수" score={scores.health} />
      ) : null;
    case 'business_move':
      return scores ? (
        <DomainGaugeVisual
          domain="business_move"
          title="창업·이전 적합도"
          scoreSub="재물운·직장운 종합"
          score={Math.round((scores.wealth + scores.career) / 2)}
        />
      ) : null;
    case 'warning':
      return <WarningVisual reading={reading} />;
    default:
      // monthly·advice 는 페이지에 별도 시각 카드가 이미 있어 제외
      return null;
  }
}
