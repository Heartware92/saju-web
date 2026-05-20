'use client';

/**
 * 신년운세 · 연도별 운세 결과 페이지의 각 섹션 본문 위에 박히는 시각 데이터 카드.
 *
 * 줄글 본문이 길어 읽기 어려운 문제를 — 결정값(올해 간지·종합 점수·영역별 등급·
 * 월별 흐름·행운 요소)을 본문 상단 시각 박스로 빼서 한눈에 보이게 한다.
 *
 * JungtongsajuSectionVisuals · ChildrenSectionVisuals 와 같은 코스믹 톤.
 */

import type { SajuResult } from '../../utils/sajuCalculator';
import type { PeriodFortune, FortuneGrade, FortuneDomain } from '../../engine/periodFortune';

// ─────────────────────────────────────────────────────────────────────────────
// 색 매핑 — PeriodFortunePage 의 GRADE_COLOR 와 동일
// ─────────────────────────────────────────────────────────────────────────────
const GRADE_COLOR: Record<FortuneGrade, string> = {
  '대길': '#34D399',
  '길': '#86EFAC',
  '중길': '#FBBF24',
  '평': '#CBD5E1',
  '중흉': '#FB923C',
  '흉': '#F87171',
};
const ELEMENT_COLOR: Record<string, string> = {
  '목': '#22c55e',
  '화': '#ef4444',
  '토': '#eab308',
  '금': '#94a3b8',
  '수': '#3b82f6',
};
const SIGNAL = {
  good: '#34D399',
  warn: '#FB923C',
  info: '#C9A6FF',
  cta: '#FCE8B2',
};

// ─────────────────────────────────────────────────────────────────────────────
// 공통 부품
// ─────────────────────────────────────────────────────────────────────────────
function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1.5 text-[13.5px] font-bold border"
      style={{ background: `${color}18`, color, borderColor: `${color}55` }}
    >
      {label}
    </span>
  );
}

// 점수 게이지 — 0~100 가로 막대 + 등급 배지
function ScoreGauge({ score, grade }: { score: number; grade: FortuneGrade }) {
  const color = GRADE_COLOR[grade];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="flex items-baseline gap-1.5">
          <span
            className="text-[30px] font-bold leading-none"
            style={{ fontFamily: 'var(--font-serif)', color, textShadow: `0 0 16px ${color}55` }}
          >
            {score}
          </span>
          <span className="text-[14px] text-text-tertiary">점</span>
        </span>
        <span
          className="text-[15px] font-bold px-2.5 py-1 rounded-lg"
          style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
        >
          {grade}
        </span>
      </div>
      <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.max(4, Math.min(100, score))}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            boxShadow: `0 0 10px ${color}66`,
          }}
        />
      </div>
    </div>
  );
}

function CardWrap({
  accent,
  children,
}: {
  accent: string;
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
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 영역 도메인 카드 — wealth/career/study/love/health/relation 공용
// ─────────────────────────────────────────────────────────────────────────────
function DomainVisual({ domain }: { domain: FortuneDomain }) {
  const color = GRADE_COLOR[domain.grade];
  return (
    <CardWrap accent={color}>
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-block w-1 h-5 rounded-full" style={{ background: color }} />
        <span className="text-[15px] font-bold tracking-[0.04em]" style={{ color }}>
          {domain.label} 한눈 요약
        </span>
      </div>
      <ScoreGauge score={domain.score} grade={domain.grade} />
      {domain.tips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {domain.tips.map((t, i) => (
            <Chip key={i} label={t} color={color} />
          ))}
        </div>
      )}
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) 총운 — 간지 큰 카드 + 종합 점수 + 십성 + 원국 합충
//    periodWord: '올해'(신년·연도별) / '이 날'(지정일) — 문구만 분기
// ─────────────────────────────────────────────────────────────────────────────
function GeneralVisual({
  fortune,
  periodWord = '올해',
}: {
  fortune: PeriodFortune;
  periodWord?: string;
}) {
  const tgz = fortune.targetGanZhi;
  const color = GRADE_COLOR[fortune.overallGrade];
  const ganColor = ELEMENT_COLOR[tgz.ganElement] ?? SIGNAL.info;
  // 간지 ↔ 원국 관계 (좋음/나쁨 분류)
  const goodInter = fortune.interactions.filter((i) => i.nature === 'good');
  const badInter = fortune.interactions.filter((i) => i.nature === 'bad');

  return (
    <div className="mb-3 space-y-2.5">
      {/* 올해 간지 + 종합 점수 */}
      <CardWrap accent={color}>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center shrink-0" style={{ minWidth: 76 }}>
            <span
              className="text-[34px] font-bold leading-none"
              style={{ fontFamily: 'var(--font-serif)', color: ganColor, textShadow: `0 0 18px ${ganColor}55` }}
            >
              {tgz.gan}{tgz.zhi}
            </span>
            <span className="text-[12.5px] text-text-tertiary mt-1.5">{fortune.targetLabel}</span>
          </div>
          <div className="flex-1 min-w-0">
            <ScoreGauge score={fortune.overallScore} grade={fortune.overallGrade} />
          </div>
        </div>
      </CardWrap>

      {/* 올해가 나에게 주는 기운(십성) + 원국 관계 */}
      <div
        className="rounded-2xl p-4 border"
        style={{ background: 'rgba(20,12,38,0.55)', borderColor: `${SIGNAL.info}45` }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <span className="inline-block w-1 h-5 rounded-full" style={{ background: SIGNAL.info }} />
          <span className="text-[15px] font-bold tracking-[0.04em]" style={{ color: SIGNAL.info }}>
            {periodWord}가 나에게 주는 기운
          </span>
        </div>
        <p className="text-[12.5px] text-text-tertiary leading-snug mb-2.5" style={{ wordBreak: 'keep-all' }}>
          {periodWord} 간지가 내 사주(일간)에 어떤 십성으로 작용하는지, 또 내 원국과
          어떻게 맞물리는지 보여줍니다.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Chip label={`천간 ${tgz.tenGodGan}`} color={SIGNAL.info} />
          <Chip label={`지지 ${tgz.tenGodZhi}`} color={SIGNAL.info} />
        </div>
        {(goodInter.length > 0 || badInter.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {goodInter.map((it, i) => (
              <Chip key={`g${i}`} label={`${it.kind} (순작용)`} color={SIGNAL.good} />
            ))}
            {badInter.map((it, i) => (
              <Chip key={`b${i}`} label={`${it.kind} (긴장)`} color={SIGNAL.warn} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8) 월별 흐름 — 12개월 등급 컬러 스트립 (compact)
// ─────────────────────────────────────────────────────────────────────────────
function MonthlyVisual({ fortune }: { fortune: PeriodFortune }) {
  const flow = fortune.monthlyFlow ?? [];
  if (flow.length === 0) return null;
  return (
    <CardWrap accent={SIGNAL.cta}>
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-block w-1 h-5 rounded-full" style={{ background: SIGNAL.cta }} />
        <span className="text-[15px] font-bold tracking-[0.04em]" style={{ color: SIGNAL.cta }}>
          12개월 흐름 한눈에
        </span>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {flow.map((m) => {
          const color = GRADE_COLOR[m.grade];
          return (
            <div
              key={m.month}
              className="rounded-lg py-2 flex flex-col items-center gap-0.5 border"
              style={{ background: `${color}18`, borderColor: `${color}55` }}
            >
              <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                {m.month}월
              </span>
              <span className="text-[11.5px] font-bold" style={{ color }}>
                {m.grade}
              </span>
            </div>
          );
        })}
      </div>
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9) 행운 처방 — 색·숫자·방향·시간 4요소 그리드
// ─────────────────────────────────────────────────────────────────────────────
function LuckyVisual({ fortune, saju }: { fortune: PeriodFortune; saju: SajuResult }) {
  const accent = ELEMENT_COLOR[saju.yongSinElement] ?? SIGNAL.cta;
  const items: Array<{ label: string; value: string }> = [
    { label: '행운 색', value: fortune.luckyColors.join(' · ') || '-' },
    { label: '행운 숫자', value: fortune.luckyNumbers.join(' · ') || '-' },
    { label: '행운 방향', value: fortune.luckyDirection || '-' },
    { label: '행운 시간', value: fortune.luckyTime || '-' },
  ];
  if (fortune.luckyGem) items.push({ label: '행운 보석', value: fortune.luckyGem });
  if (fortune.luckyActivity) items.push({ label: '행운 활동', value: fortune.luckyActivity });

  return (
    <CardWrap accent={accent}>
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-block w-1 h-5 rounded-full" style={{ background: accent }} />
        <span className="text-[15px] font-bold tracking-[0.04em]" style={{ color: accent }}>
          행운 요소 한눈 요약
          <span className="text-text-tertiary font-normal text-[13px] ml-1.5">용신 {saju.yongSinElement} 기준</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <div
            key={it.label}
            className="rounded-xl px-3 py-2.5 border flex flex-col gap-0.5"
            style={{ background: 'rgba(255,255,255,0.03)', borderColor: `${accent}33` }}
          >
            <span className="text-[12.5px] font-bold" style={{ color: accent }}>
              {it.label}
            </span>
            <span
              className="text-[15px] font-bold leading-tight"
              style={{ color: 'var(--text-primary)', wordBreak: 'keep-all' }}
            >
              {it.value}
            </span>
          </div>
        ))}
      </div>
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 통합 라우터 — 섹션 키에 따라 알맞은 시각 카드 반환
// ─────────────────────────────────────────────────────────────────────────────
export function renderNewyearSectionVisual(
  key: string,
  fortune: PeriodFortune | null,
  saju: SajuResult | null,
) {
  if (!fortune) return null;
  switch (key) {
    case 'general':
      return <GeneralVisual fortune={fortune} />;
    case 'wealth':
    case 'career':
    case 'study':
    case 'love':
    case 'health':
    case 'relation': {
      const domain = fortune.domains.find((d) => d.key === key);
      return domain ? <DomainVisual domain={domain} /> : null;
    }
    case 'monthly':
      return <MonthlyVisual fortune={fortune} />;
    case 'lucky':
      return saju ? <LuckyVisual fortune={fortune} saju={saju} /> : null;
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 지정일 운세 라우터 — date_ prefix 키를 동일 시각 컴포넌트에 매핑
//   date scope 의 fortune 도 PeriodFortune (그 날의 간지·도메인 점수 포함)
// ─────────────────────────────────────────────────────────────────────────────
const PICKED_DATE_DOMAIN_MAP: Record<string, FortuneDomain['key']> = {
  date_wealth: 'wealth',
  date_career: 'career',
  date_love: 'love',
  date_health: 'health',
  date_relation: 'relation',
  date_study: 'study',
};

export function renderPickedDateSectionVisual(key: string, fortune: PeriodFortune | null) {
  if (!fortune) return null;
  if (key === 'date_essence') {
    return <GeneralVisual fortune={fortune} periodWord="이 날" />;
  }
  const domainKey = PICKED_DATE_DOMAIN_MAP[key];
  if (domainKey) {
    const domain = fortune.domains.find((d) => d.key === domainKey);
    return domain ? <DomainVisual domain={domain} /> : null;
  }
  return null;
}
