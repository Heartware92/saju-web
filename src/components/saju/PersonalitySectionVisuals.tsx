'use client';

/**
 * 성격 심층 분석 결과 페이지의 각 섹션 본문 위에 박히는 시각 데이터 카드.
 *
 * 정통사주 JungtongsajuSectionVisuals · 학업 StudySectionVisuals 와 같은 코스믹 톤.
 * 본문 줄글의 결정값(일주 60갑자·격국·십성 에너지·12운성·합충·신살)을 한눈 시각 박스로.
 *
 * 9섹션 중 guide(자기관리 불릿)는 시각 카드 없음 — 나머지 8섹션 카드.
 */

import { useState } from 'react';
import type { SajuResult } from '../../utils/sajuCalculator';
import { determineGyeokguk } from '../../engine/gyeokguk';
import { getDayPillarTraits } from '../../constants/gapjaTraits';

// ─────────────────────────────────────────────────────────────────────────────
// 색 매핑
// ─────────────────────────────────────────────────────────────────────────────
const SIGNAL = {
  good: '#34D399',
  warn: '#FB923C',
  bad: '#F87171',
  info: '#C9A6FF',
  cta: '#FCE8B2',
};

// 십성 카운트 — pillar.tenGodGan / tenGodZhi 기반 (신호 수준)
interface TenGodCounts {
  비견: number; 겁재: number;
  식신: number; 상관: number;
  편재: number; 정재: number;
  편관: number; 정관: number;
  편인: number; 정인: number;
}
function emptyCounts(): TenGodCounts {
  return { 비견: 0, 겁재: 0, 식신: 0, 상관: 0, 편재: 0, 정재: 0, 편관: 0, 정관: 0, 편인: 0, 정인: 0 };
}
function countTenGods(saju: SajuResult): TenGodCounts {
  const c = emptyCounts();
  const pillars = [saju.pillars.year, saju.pillars.month, saju.pillars.day];
  if (!saju.hourUnknown) pillars.push(saju.pillars.hour);
  for (const p of pillars) {
    const gan = p.tenGodGan as keyof TenGodCounts;
    if (gan && c[gan] !== undefined) c[gan] += 1;
    const zhi = p.tenGodZhi as keyof TenGodCounts;
    if (zhi && c[zhi] !== undefined) c[zhi] += 1;
  }
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
// 공통 부품
// ─────────────────────────────────────────────────────────────────────────────
function SectionCardWrap({
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
      style={{ background: 'rgba(20,12,38,0.55)', borderColor: `${accent}45` }}
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

/** 가로 미니 막대 — 라벨 + 바 + 수치. 최강 항목 강조. */
function BarRows({
  rows,
  highlight,
  color,
  labelWidth = 96,
}: {
  rows: { label: string; value: number }[];
  highlight?: string;
  color: string;
  labelWidth?: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const pct = Math.round((r.value / max) * 100);
        const isDom = r.label === highlight;
        const barColor = isDom ? color : '#64748b';
        return (
          <div key={r.label} className="flex items-center gap-3">
            <span
              className="text-[14px] font-bold shrink-0"
              style={{ width: labelWidth, color: isDom ? color : 'var(--text-secondary)' }}
            >
              {r.label}
            </span>
            <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(4, pct)}%`,
                  background: barColor,
                  boxShadow: isDom ? `0 0 8px ${barColor}55` : 'none',
                }}
              />
            </div>
            <span className="text-[13px] text-text-tertiary w-6 text-right shrink-0">{r.value}</span>
          </div>
        );
      })}
    </div>
  );
}

/** 2칸 결정값 카드 */
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div
      className="rounded-2xl p-4 border flex flex-col gap-1.5"
      style={{
        background: `linear-gradient(135deg, rgba(20,12,38,0.65) 0%, ${color}14 60%, rgba(20,12,38,0.55) 100%)`,
        borderColor: `${color}55`,
      }}
    >
      <span className="text-[13px] font-bold tracking-[0.04em]" style={{ color }}>{label}</span>
      <span
        className="font-bold leading-tight text-[17px]"
        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)', wordBreak: 'keep-all' }}
      >
        {value}
      </span>
      {sub && <span className="text-[13px] text-text-tertiary leading-snug" style={{ wordBreak: 'keep-all' }}>{sub}</span>}
    </div>
  );
}

/** 색칩 — full 이면 컨테이너 폭을 꽉 채워 정렬·크기 통일 */
function PChip({ label, color, subtle, full }: { label: string; color: string; subtle?: boolean; full?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-3 py-2 text-[14px] font-bold border ${full ? 'w-full' : ''}`}
      style={{
        background: subtle ? `${color}15` : `${color}25`,
        color,
        borderColor: `${color}55`,
        wordBreak: 'keep-all',
      }}
    >
      {label}
    </span>
  );
}

/** 신살 칩 리스트 — 칩 3열 + 탭 시 인라인 펼침 */
function SinsalChips({ items, accent }: { items: { name: string; desc: string }[]; accent: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-3 gap-2">
        {items.map((it, i) => {
          const open = openIdx === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setOpenIdx(open ? null : i)}
              className="flex w-full items-center justify-center gap-1 rounded-full px-2 py-2 text-[15px] font-bold border transition-all active:scale-[0.97]"
              style={{
                background: open ? `${accent}30` : `${accent}14`,
                color: accent,
                borderColor: `${accent}${open ? 'aa' : '55'}`,
              }}
            >
              <span style={{ wordBreak: 'keep-all' }}>{it.name}</span>
              <span className="text-[10px] opacity-60 shrink-0">{open ? '▲' : '▼'}</span>
            </button>
          );
        })}
      </div>
      {openIdx !== null && items[openIdx] && (
        <div className="rounded-xl px-4 py-3 border" style={{ background: `${accent}14`, borderColor: `${accent}55` }}>
          <span className="text-[18px] font-bold block mb-1.5" style={{ color: 'var(--text-primary)' }}>
            {items[openIdx].name}
          </span>
          <span className="text-[17px] text-text-secondary leading-relaxed" style={{ wordBreak: 'keep-all' }}>
            {items[openIdx].desc}
          </span>
        </div>
      )}
    </div>
  );
}

// 십성 5그룹 — 성격 에너지 축
function sipSeongGroups(saju: SajuResult) {
  const c = countTenGods(saju);
  return {
    '자아 (비겁)': c.비견 + c.겁재,
    '사고 (인성)': c.정인 + c.편인,
    '표현 (식상)': c.식신 + c.상관,
    '현실 (재성)': c.정재 + c.편재,
    '규율 (관성)': c.정관 + c.편관,
  };
}

// 12운성 — 에너지 상승/하강 분류
const STAGE_UP = ['장생', '관대', '건록', '제왕'];
const STAGE_DOWN = ['쇠', '병', '사', '묘', '절'];
function stageEnergy(stage: string): { label: string; color: string } {
  if (STAGE_UP.includes(stage)) return { label: '상승', color: SIGNAL.warn };
  if (STAGE_DOWN.includes(stage)) return { label: '하강', color: SIGNAL.info };
  return { label: '전환', color: SIGNAL.good }; // 태·양·목욕
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) 타고난 성격의 핵심 — 일주 60갑자
// ─────────────────────────────────────────────────────────────────────────────
function DayMasterVisual({ saju }: { saju: SajuResult }) {
  const p = saju.pillars.day;
  const traits = getDayPillarTraits(p.gan, p.zhi);
  const color = SIGNAL.info;
  return (
    <SectionCardWrap accent={color} title="일주 60갑자">
      <div className="flex items-center gap-4">
        <div
          className="flex flex-col items-center justify-center rounded-2xl border shrink-0"
          style={{ width: 88, height: 88, background: `${color}14`, borderColor: `${color}55` }}
        >
          <span className="text-[34px] font-bold leading-none" style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}>
            {traits?.hanja ?? `${p.gan}${p.zhi}`}
          </span>
          <span className="text-[13px] font-semibold mt-1" style={{ color }}>{traits?.name ?? `${p.gan}${p.zhi}`}</span>
        </div>
        {/* 키워드 칩 — 2열 grid 로 크기 통일 (글자 수 달라도 같은 폭) */}
        <div className="grid grid-cols-2 gap-2 flex-1">
          {(traits?.keywords ?? []).map((k) => (
            <PChip key={k} label={k} color={color} subtle full />
          ))}
        </div>
      </div>
    </SectionCardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) 성격이 이끄는 삶의 방향 — 격국 + 신강신약
// ─────────────────────────────────────────────────────────────────────────────
function GyeokgukVisual({ saju }: { saju: SajuResult }) {
  const g = determineGyeokguk(saju);
  const strengthColor =
    saju.strengthStatus.includes('강') ? SIGNAL.warn
    : saju.strengthStatus.includes('약') ? SIGNAL.info
    : SIGNAL.good;
  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      <StatCard label="격국" value={g.name} sub={g.type} color={SIGNAL.cta} />
      <StatCard
        label="신강신약"
        value={saju.strengthStatus}
        sub={`점수 ${saju.strengthScore}`}
        color={strengthColor}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) 상황별 모습 — 성격 에너지 5축
// ─────────────────────────────────────────────────────────────────────────────
function StrengthsVisual({ saju }: { saju: SajuResult }) {
  const groups = sipSeongGroups(saju);
  const rows = Object.entries(groups).map(([label, value]) => ({ label, value }));
  const dominant = [...rows].sort((a, b) => b.value - a.value)[0];
  return (
    <SectionCardWrap accent={SIGNAL.info} title="성격 에너지 5축">
      <BarRows rows={rows} highlight={dominant.label} color={SIGNAL.info} />
      <p className="text-[14px] text-text-secondary mt-3 pt-3 border-t border-white/10 leading-relaxed">
        가장 강한 축은 <span style={{ color: SIGNAL.info, fontWeight: 700 }}>{dominant.label}</span> 기운이에요.
        <br />
        직장·연애·친구 어디서든 이 결이 먼저 드러나요.
      </p>
    </SectionCardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) 외부 시선 — 4기둥 12운성 에너지 흐름 (남에게 비치는 궤적)
// ─────────────────────────────────────────────────────────────────────────────
function OutsideViewVisual({ saju }: { saju: SajuResult }) {
  const p = saju.pillars;
  const pillars = [
    { label: '년주', sub: '뿌리·가문', stage: p.year.twelveStage },
    { label: '월주', sub: '사회·청년', stage: p.month.twelveStage },
    { label: '일주', sub: '본질·나', stage: p.day.twelveStage },
    ...(saju.hourUnknown ? [] : [{ label: '시주', sub: '말년·미래', stage: p.hour.twelveStage }]),
  ];
  return (
    <SectionCardWrap accent={SIGNAL.cta} title="에너지 궤적" titleSub="12운성 흐름">
      <div className="grid grid-cols-2 gap-2">
        {pillars.map((pl) => {
          const e = stageEnergy(pl.stage);
          return (
            <div
              key={pl.label}
              className="rounded-xl px-3 py-3 border flex flex-col items-center gap-1"
              style={{ background: `${e.color}14`, borderColor: `${e.color}55` }}
            >
              <span className="text-[12px] text-text-tertiary">{pl.label} · {pl.sub}</span>
              <span className="text-[24px] font-bold leading-none" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                {pl.stage}
              </span>
              <span
                className="text-[12px] font-bold px-2 py-0.5 rounded-full mt-0.5"
                style={{ color: e.color, background: `${e.color}1f` }}
              >
                에너지 {e.label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[14px] text-text-secondary mt-3 leading-relaxed">
        상승기 기둥은 활동적·야심차게, 하강기 기둥은 신중·내향적으로 비쳐요.
      </p>
    </SectionCardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) 되고 싶은 나 / 피하고 싶은 나 — 강한 십성(욕구) vs 약한 십성(두려움)
// ─────────────────────────────────────────────────────────────────────────────
const DESIRE_BY_GROUP: Record<string, string> = {
  '자아 (비겁)': '인정받는 나',
  '사고 (인성)': '깊이 아는 나',
  '표현 (식상)': '드러내는 나',
  '현실 (재성)': '풍요로운 나',
  '규율 (관성)': '책임지는 나',
};
const FEAR_BY_GROUP: Record<string, string> = {
  '자아 (비겁)': '존재감 없는 나',
  '사고 (인성)': '얕아 보이는 나',
  '표현 (식상)': '표현 못 하는 나',
  '현실 (재성)': '무능해 보이는 나',
  '규율 (관성)': '무책임한 나',
};
function DesireVisual({ saju }: { saju: SajuResult }) {
  const groups = sipSeongGroups(saju);
  const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
  const topGroup = sorted[0][0];
  const lowGroup = sorted[sorted.length - 1][0];
  const sides = [
    { head: '되고 싶은 나', phrase: DESIRE_BY_GROUP[topGroup], group: topGroup, color: SIGNAL.good },
    { head: '피하고 싶은 나', phrase: FEAR_BY_GROUP[lowGroup], group: lowGroup, color: SIGNAL.warn },
  ];
  return (
    <SectionCardWrap accent={SIGNAL.good} title="욕구 vs 두려움">
      <div className="grid grid-cols-2 gap-2.5">
        {sides.map((s) => (
          <div
            key={s.head}
            className="rounded-2xl border px-3 py-3.5 flex flex-col items-center gap-2"
            style={{ background: `${s.color}12`, borderColor: `${s.color}55` }}
          >
            <span className="text-[12px] font-bold tracking-[0.03em]" style={{ color: s.color }}>
              {s.head}
            </span>
            <span
              className="text-[16px] font-bold leading-tight text-center"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)', wordBreak: 'keep-all' }}
            >
              {s.phrase}
            </span>
            <span
              className="text-[12px] font-semibold px-2.5 py-1 rounded-full mt-auto"
              style={{ color: s.color, background: `${s.color}22` }}
            >
              {s.group}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[14px] text-text-secondary mt-3 leading-relaxed">
        가장 강한 기운은 욕구로, 가장 약한 기운은 감추고 싶은 두려움으로 작동해요.
      </p>
    </SectionCardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) 강점 뒤에 숨은 약점 — 합·충·형 갈등 구조
// ─────────────────────────────────────────────────────────────────────────────
function ShadowVisual({ saju }: { saju: SajuResult }) {
  const chung = saju.interactions.filter((i) => i.type === '충');
  const hyeong = saju.interactions.filter((i) => i.type === '형');
  const items: { name: string; desc: string }[] = [
    ...chung.map((i) => ({ name: `충 ${i.description.split(' ')[0] ?? ''}`.trim(), desc: `내면 갈등·급변의 자극점이에요. ${i.description}` })),
    ...hyeong.map((i) => ({ name: `형 ${i.description.split(' ')[0] ?? ''}`.trim(), desc: `스스로 발등 찍기 쉬운 자충수 패턴이에요. ${i.description}` })),
  ];
  if (items.length === 0) {
    return (
      <SectionCardWrap accent={SIGNAL.info} title="내면 갈등 구조">
        <span className="text-[17px] text-text-secondary leading-relaxed">
          원국에 충·형이 없어 큰 내면 충돌 없이 안정적인 결이에요. 그림자는 과다·결핍 십성에서 드러나요.
        </span>
      </SectionCardWrap>
    );
  }
  return (
    <SectionCardWrap accent={SIGNAL.bad} title="내면 갈등 구조" titleSub={`충 ${chung.length} · 형 ${hyeong.length}`}>
      <SinsalChips accent={SIGNAL.bad} items={items} />
    </SectionCardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) 신살의 현대적 재해석 — 성격 신살 칩
// ─────────────────────────────────────────────────────────────────────────────
const PERSONALITY_SINSAL_KEYS = [
  '도화', '홍염', '괴강', '백호', '양인', '화개', '역마',
  '천을귀인', '문창', '학당', '고신', '과숙', '천문', '급각',
];
function SinsalVisual({ saju }: { saju: SajuResult }) {
  const hits = saju.sinSals.filter((s) => PERSONALITY_SINSAL_KEYS.some((k) => s.name.includes(k)));
  if (hits.length === 0) {
    return (
      <SectionCardWrap accent={SIGNAL.info} title="성격 신살">
        <span className="text-[17px] text-text-secondary leading-relaxed">
          특별한 성격 신살이 없어, 신살에 의존하지 않는 균형 잡힌 결이에요
        </span>
      </SectionCardWrap>
    );
  }
  return (
    <SectionCardWrap accent={SIGNAL.info} title="성격 신살">
      <SinsalChips accent={SIGNAL.info} items={hits.map((s) => ({ name: s.name, desc: s.description }))} />
    </SectionCardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8) 스트레스 vs 회복 — 충·형 자극 + 일간 12운성 회복 탄력
// ─────────────────────────────────────────────────────────────────────────────
function StressVisual({ saju }: { saju: SajuResult }) {
  const trigger = saju.interactions.filter((i) => ['충', '형', '파', '해'].includes(i.type)).length;
  const triggerLabel =
    trigger === 0 ? '외부 자극에 둔감한 편'
    : trigger <= 2 ? '적당한 긴장 속에서 균형'
    : '자극에 예민하게 반응';
  const dayStage = saju.pillars.day.twelveStage;
  const e = stageEnergy(dayStage);
  const recoverLabel =
    e.label === '상승' ? '활동하며 빠르게 충전'
    : e.label === '하강' ? '충분한 휴식이 있어야 회복'
    : '환경을 바꾸면 회복이 빨라요';
  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      <StatCard
        label="스트레스 민감도"
        value={trigger === 0 ? '낮음' : trigger <= 2 ? '보통' : '높음'}
        sub={triggerLabel}
        color={trigger >= 3 ? SIGNAL.bad : trigger >= 1 ? SIGNAL.warn : SIGNAL.good}
      />
      <StatCard
        label="회복 탄력"
        value={dayStage}
        sub={recoverLabel}
        color={e.color}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 라우터 — guide(불릿)는 시각 카드 없음
// ─────────────────────────────────────────────────────────────────────────────
export function renderPersonalitySectionVisual(key: string, saju: SajuResult | null) {
  if (!saju) return null;
  switch (key) {
    case 'daymaster':
      return <DayMasterVisual saju={saju} />;
    case 'gyeokguk':
      return <GyeokgukVisual saju={saju} />;
    case 'strengths':
      return <StrengthsVisual saju={saju} />;
    case 'outside_view':
      return <OutsideViewVisual saju={saju} />;
    case 'desire':
      return <DesireVisual saju={saju} />;
    case 'shadow':
      return <ShadowVisual saju={saju} />;
    case 'sinsal':
      return <SinsalVisual saju={saju} />;
    case 'stress':
      return <StressVisual saju={saju} />;
    default:
      return null;
  }
}
