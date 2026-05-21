'use client';

/**
 * 정통사주 결과 페이지의 각 섹션 본문 위에 박히는 시각 데이터 카드.
 *
 * 줄글 본문이 길어 읽기 어려운 문제를 — 결정값(격국·신강신약·용신·오행 분포·
 * 합충·십성·대운 흐름)을 본문 상단 시각 박스로 빼서 한눈에 보이게 한다.
 *
 * ChildrenSectionVisuals · NameSectionVisuals 와 같은 코스믹 톤
 * (2열 그리드 · 색칩 · 미니 막대 · 라디얼 그라데이션).
 */

import { useState } from 'react';
import type { SajuResult, DaeWoon } from '../../utils/sajuCalculator';
import { determineGyeokguk } from '../../engine/gyeokguk';
import { getDayPillarTraits } from '../../constants/gapjaTraits';

// ─────────────────────────────────────────────────────────────────────────────
// 색 매핑 — 다른 Visuals 와 통일
// ─────────────────────────────────────────────────────────────────────────────
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
  bad: '#F87171',
  info: '#C9A6FF',
  cta: '#FCE8B2',
};

// ─────────────────────────────────────────────────────────────────────────────
// 십성 카운트 — pillar.tenGodGan / tenGodZhi 기반 (지장간 가중 없이 신호 수준)
// ─────────────────────────────────────────────────────────────────────────────
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
function groupSipSeong(c: TenGodCounts) {
  return {
    비겁: c.비견 + c.겁재,
    식상: c.식신 + c.상관,
    재성: c.정재 + c.편재,
    관성: c.정관 + c.편관,
    인성: c.정인 + c.편인,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 공통 작은 부품
// ─────────────────────────────────────────────────────────────────────────────
function Chip({ label, color, subtle, big }: { label: string; color: string; subtle?: boolean; big?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold border ${
        big ? 'px-3.5 py-2 text-[16px]' : 'px-3 py-1.5 text-[14px]'
      }`}
      style={{
        background: subtle ? `${color}15` : `${color}25`,
        color,
        borderColor: `${color}55`,
      }}
    >
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
  valueSize = 20,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  /** 좁은 3열 그리드에서는 17 정도로 낮춰 줄바꿈 깨짐 방지 */
  valueSize?: number;
}) {
  return (
    <div
      className="rounded-2xl p-4 border flex flex-col gap-1.5"
      style={{
        background: `linear-gradient(135deg, rgba(20,12,38,0.65) 0%, ${color}14 60%, rgba(20,12,38,0.55) 100%)`,
        borderColor: `${color}55`,
        boxShadow: `0 0 18px ${color}10`,
      }}
    >
      <span className="text-[13px] font-bold tracking-[0.04em]" style={{ color }}>
        {label}
      </span>
      <span
        className="font-bold leading-tight"
        style={{
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-title)',
          fontSize: valueSize,
          wordBreak: 'keep-all', // 한국어 단어 중간 끊김 방지 — 공백에서만 줄바꿈
        }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[13px] text-text-tertiary leading-snug" style={{ wordBreak: 'keep-all' }}>
          {sub}
        </span>
      )}
    </div>
  );
}

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
        <span className="inline-block w-1 h-5 rounded-full" style={{ background: accent }} />
        <span className="text-[15px] font-bold tracking-[0.04em]" style={{ color: accent }}>
          {title}
          {titleSub && <span className="text-text-tertiary font-normal text-[13px] ml-1.5">{titleSub}</span>}
        </span>
      </div>
      {children}
    </div>
  );
}

/**
 * 신살·길성 칩 리스트 — 칩만 한 줄로 나열, 탭하면 그 아래 설명 인라인 펼침.
 * 쭉 펼쳐 스크롤 잡아먹던 신살 카드 (건강운·인간관계 귀인) 를 컴팩트하게.
 * 택일운세 키워드 칩과 같은 인터랙션 패턴.
 */
function SinsalChipList({
  items,
  accent,
}: {
  items: { name: string; desc: string }[];
  accent: string;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2">
        {items.map((it, i) => {
          const open = openIdx === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setOpenIdx(open ? null : i)}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[16px] font-bold border transition-all active:scale-[0.97]"
              style={{
                background: open ? `${accent}30` : `${accent}14`,
                color: accent,
                borderColor: `${accent}${open ? 'aa' : '55'}`,
              }}
            >
              {it.name}
              <span className="text-[11px] opacity-60">{open ? '▲' : '▼'}</span>
            </button>
          );
        })}
      </div>
      {openIdx !== null && items[openIdx] && (
        <div
          className="rounded-xl px-4 py-3 border"
          style={{ background: `${accent}14`, borderColor: `${accent}55` }}
        >
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

// 십성 5그룹 미니 막대 — character/wealth/relation 공용
function SipSeongBars({
  groups,
  highlight,
  color,
}: {
  groups: Record<string, number>;
  highlight?: string;
  color: string;
}) {
  const max = Math.max(1, ...Object.values(groups));
  return (
    <div className="space-y-2.5">
      {Object.entries(groups).map(([key, v]) => {
        const pct = Math.round((v / max) * 100);
        const isDom = key === highlight;
        const barColor = isDom ? color : '#64748b';
        return (
          <div key={key} className="flex items-center gap-3">
            <span
              className="text-[14px] font-bold w-11 shrink-0"
              style={{ color: isDom ? color : 'var(--text-secondary)' }}
            >
              {key}
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
            <span className="text-[13px] text-text-tertiary w-8 text-right shrink-0">{v}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) 사주 총론 — 격국 · 신강신약 · 용신 3칸
// ─────────────────────────────────────────────────────────────────────────────
function GeneralVisual({ saju }: { saju: SajuResult }) {
  const gyeokguk = determineGyeokguk(saju);
  const strengthColor =
    saju.strengthStatus.includes('강') ? SIGNAL.warn
    : saju.strengthStatus.includes('약') ? SIGNAL.info
    : SIGNAL.good;
  return (
    <div className="grid grid-cols-3 gap-2 mb-3">
      <StatCard label="격국" value={gyeokguk.name} sub={gyeokguk.type} color={SIGNAL.cta} valueSize={17} />
      <StatCard
        label="신강신약"
        value={saju.strengthStatus}
        sub={`점수 ${saju.strengthScore}`}
        color={strengthColor}
        valueSize={17}
      />
      <StatCard
        label="용신"
        value={saju.yongSin}
        sub={`${saju.yongSinElement} 기운`}
        color={ELEMENT_COLOR[saju.yongSinElement] ?? SIGNAL.info}
        /* 용신은 "편인/정인" 처럼 5자 이상이 흔해 1/3 폭에서 슬래시 줄바꿈 — 길이 기준 축소 */
        valueSize={saju.yongSin.length > 3 ? 14 : 17}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) 일주 해석 — 일주 60갑자 큰 카드 + 키워드 칩
// ─────────────────────────────────────────────────────────────────────────────
function DayMasterVisual({ saju }: { saju: SajuResult }) {
  const day = saju.pillars.day;
  const traits = getDayPillarTraits(day.gan, day.zhi);
  const accent = ELEMENT_COLOR[saju.dayMasterElement] ?? SIGNAL.info;
  return (
    <div className="mb-3">
      <div
        className="rounded-2xl p-4 border flex items-center gap-4"
        style={{
          background: `linear-gradient(135deg, rgba(20,12,38,0.65) 0%, ${accent}16 55%, rgba(20,12,38,0.55) 100%)`,
          borderColor: `${accent}55`,
          boxShadow: `0 0 20px ${accent}12`,
        }}
      >
        <div className="flex flex-col items-center shrink-0" style={{ minWidth: 82 }}>
          <span
            className="text-[36px] font-bold leading-none"
            style={{ fontFamily: 'var(--font-serif)', color: accent, textShadow: `0 0 18px ${accent}55` }}
          >
            {day.gan}{day.zhi}
          </span>
          {traits && (
            <span className="text-[14px] text-text-tertiary mt-1.5">{traits.name}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <Chip label={`${saju.dayMaster} ${saju.dayMasterElement}`} color={accent} subtle />
            <Chip label={saju.dayMasterYinYang} color={SIGNAL.info} subtle />
            <Chip label={`12운성 ${day.twelveStage}`} color={SIGNAL.info} subtle />
          </div>
          {traits && traits.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {traits.keywords.slice(0, 4).map((k, i) => (
                <span
                  key={i}
                  className="text-[14px] px-2.5 py-1 rounded-md font-medium"
                  style={{ background: `${accent}1a`, color: 'var(--text-secondary)', border: `1px solid ${accent}33` }}
                >
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) 오행 분포 — 목화토금수 5막대
// ─────────────────────────────────────────────────────────────────────────────
function ElementVisual({ saju }: { saju: SajuResult }) {
  const order = ['목', '화', '토', '금', '수'] as const;
  const percents = saju.elementPercent;
  const max = Math.max(1, ...order.map((e) => percents[e] ?? 0));
  return (
    <SectionCardWrap accent={SIGNAL.info} title="오행 분포">
      <div className="space-y-2.5">
        {order.map((el) => {
          const v = percents[el] ?? 0;
          const pct = Math.round((v / max) * 100);
          const color = ELEMENT_COLOR[el];
          const isStrong = el === saju.strongElement;
          const isWeak = el === saju.weakElement;
          return (
            <div key={el} className="flex items-center gap-3">
              <span className="text-[14px] font-bold w-7 shrink-0" style={{ color }}>
                {el}
              </span>
              <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max(3, pct)}%`, background: color, boxShadow: `0 0 8px ${color}55` }}
                />
              </div>
              <span className="text-[13px] text-text-tertiary w-10 text-right shrink-0">{v}%</span>
              {/* 강/약 뱃지 영역 — 고정폭으로 확보해 뱃지 유무와 무관하게 % 위치 정렬 통일 */}
              <span className="w-8 shrink-0 flex justify-end">
                {(isStrong || isWeak) && (
                  <span
                    className="text-[11px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background: isStrong ? `${SIGNAL.warn}22` : `${SIGNAL.info}22`,
                      color: isStrong ? SIGNAL.warn : SIGNAL.info,
                      border: `1px solid ${(isStrong ? SIGNAL.warn : SIGNAL.info)}55`,
                    }}
                  >
                    {isStrong ? '강' : '약'}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </SectionCardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) 합·충·형·파·해 — 지지 관계 + 일상어 의미
// ─────────────────────────────────────────────────────────────────────────────
// 합충형파해 = 사주 8글자(특히 지지)끼리 서로 영향을 주고받는 5가지 관계.
const INTERACTION_PLAIN: Record<string, { tag: string; desc: string }> = {
  '합': { tag: '결속', desc: '두 글자가 손잡아 협력·안정·끌림이 생기는 관계' },
  '충': { tag: '충돌', desc: '두 글자가 정면으로 부딪쳐 변동·이동·갈등이 생기는 관계' },
  '형': { tag: '마찰', desc: '두 글자가 서로 긁혀 구설·시비·다툼이 생기는 관계' },
  '파': { tag: '깨짐', desc: '두 글자가 어긋나 균열·중단·약속 어긋남이 생기는 관계' },
  '해': { tag: '방해', desc: '두 글자가 은근히 해쳐 시기·질투·삐걱댐이 생기는 관계' },
};

function InteractionItem({ tech, type, accent }: { tech: string; type: string; accent: string }) {
  const plain = INTERACTION_PLAIN[type];
  return (
    <div
      className="rounded-xl px-3.5 py-2.5 border flex flex-col gap-1"
      style={{ background: `${accent}14`, borderColor: `${accent}55` }}
    >
      <span className="flex items-center gap-2">
        <span className="text-[15.5px] font-bold" style={{ color: 'var(--text-primary)' }}>
          {tech}
        </span>
        {plain && (
          <span
            className="text-[11.5px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}
          >
            {plain.tag}
          </span>
        )}
      </span>
      {plain && (
        <span className="text-[13px] text-text-secondary leading-snug" style={{ wordBreak: 'keep-all' }}>
          {plain.desc}
        </span>
      )}
    </div>
  );
}

function InteractionVisual({ saju }: { saju: SajuResult }) {
  const harmony = saju.interactions.filter((i) => i.type === '합');
  const tension = saju.interactions.filter((i) => ['충', '형', '파', '해'].includes(i.type));
  return (
    <div className="grid grid-cols-1 gap-2 mb-3">
      <SectionCardWrap accent={SIGNAL.good} title="합 (결속·조화)">
        <p className="text-[17px] text-text-secondary leading-relaxed mb-2.5" style={{ wordBreak: 'keep-all' }}>
          사주 글자끼리 손을 잡는 관계 — 잘 풀리면 안정과 협력의 힘이 됩니다.
        </p>
        {harmony.length === 0 ? (
          <span className="text-[17px] text-text-secondary leading-relaxed">원국에 합 없음</span>
        ) : (
          <div className="flex flex-col gap-2">
            {harmony.map((h, i) => (
              <InteractionItem key={i} tech={h.description.split(' - ')[0]} type={h.type} accent={SIGNAL.good} />
            ))}
          </div>
        )}
      </SectionCardWrap>
      <SectionCardWrap accent={tension.length > 0 ? SIGNAL.warn : SIGNAL.info} title="충·형·파·해 (변동·긴장)">
        <p className="text-[17px] text-text-secondary leading-relaxed mb-2.5" style={{ wordBreak: 'keep-all' }}>
          사주 글자끼리 부딪치는 관계 — 변화의 자극이자, 잘 다스리면 추진력이 됩니다.
        </p>
        {tension.length === 0 ? (
          <span className="text-[17px] text-text-secondary leading-relaxed">원국에 충·형·파·해 없음 — 안정 구조</span>
        ) : (
          <div className="flex flex-col gap-2">
            {tension.map((t, i) => (
              <InteractionItem key={i} tech={t.description.split(' - ')[0]} type={t.type} accent={SIGNAL.warn} />
            ))}
          </div>
        )}
      </SectionCardWrap>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) 성격·기질 — 십성 5그룹 미니 막대
// ─────────────────────────────────────────────────────────────────────────────
function CharacterVisual({ saju }: { saju: SajuResult }) {
  const groups = groupSipSeong(countTenGods(saju));
  const dominant = Object.entries(groups).sort((a, b) => b[1] - a[1])[0]?.[0];
  return (
    <SectionCardWrap accent={SIGNAL.info} title="십성 분포" titleSub="기질의 무게중심">
      <SipSeongBars groups={groups} highlight={dominant} color={SIGNAL.info} />
    </SectionCardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) 직업·적성 — 격국 + 추천 직군 칩
// ─────────────────────────────────────────────────────────────────────────────
function CareerVisual({ saju }: { saju: SajuResult }) {
  const gyeokguk = determineGyeokguk(saju);
  return (
    <SectionCardWrap accent={SIGNAL.cta} title="격국 기반 적성" titleSub={gyeokguk.name}>
      {gyeokguk.careers.length === 0 ? (
        <span className="text-[17px] text-text-secondary leading-relaxed">본문의 직군 추천 참고</span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {gyeokguk.careers.slice(0, 6).map((c, i) => (
            <Chip key={i} label={c} color={SIGNAL.cta} subtle />
          ))}
        </div>
      )}
    </SectionCardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) 재물운 — 재성(정재·편재) + 신강신약(재물 그릇)
// ─────────────────────────────────────────────────────────────────────────────
function WealthVisual({ saju }: { saju: SajuResult }) {
  const c = countTenGods(saju);
  const jeongJae = c.정재;
  const pyeonJae = c.편재;
  const total = jeongJae + pyeonJae;
  const strong = saju.isStrong;
  const wealthBadge =
    total === 0 ? { label: '재성 무(無)', color: SIGNAL.info, desc: '식상생재·간접 재물 구조' }
    : total <= 2 ? { label: '재성 보통', color: SIGNAL.good, desc: '안정적 재물 흐름' }
    : { label: '재성 풍부', color: SIGNAL.warn, desc: '재물 기회 많음·관리 중요' };
  // 카드 sub — 개수만 나열하지 않고 "이게 무슨 상태인지" 해석형으로 (인간관계 카드 패턴).
  const jaeSeongSub =
    total === 0 ? '식상으로 일구는 간접 재물형'
    : jeongJae > pyeonJae ? `안정적 고정 재물 위주 (정재 ${jeongJae}·편재 ${pyeonJae})`
    : pyeonJae > jeongJae ? `유동적 큰 재물 기회 위주 (정재 ${jeongJae}·편재 ${pyeonJae})`
    : `안정·유동 재물이 고르게 섞인 균형형 (정재 ${jeongJae}·편재 ${pyeonJae})`;
  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      <StatCard
        label="재성 (정재+편재)"
        value={`${total}개`}
        sub={jaeSeongSub}
        color={wealthBadge.color}
      />
      <StatCard
        label="재물 그릇"
        value={strong ? '감당형 (신강)' : '관리 주의 (신약)'}
        sub={strong ? '큰 재물도 너끈히 감당하는 힘' : '재성이 많을수록 분산 관리가 필요한 그릇'}
        color={strong ? SIGNAL.good : SIGNAL.warn}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8) 애정·이성운 — 배우자궁(일지) + 배우자성
// ─────────────────────────────────────────────────────────────────────────────
function LoveVisual({ saju }: { saju: SajuResult }) {
  const day = saju.pillars.day;
  const c = countTenGods(saju);
  // 배우자성 — 남자=재성, 여자=관성
  const isMale = saju.gender === 'male';
  const spouseStarTotal = isMale ? c.정재 + c.편재 : c.정관 + c.편관;
  const spouseStarLabel = isMale ? '재성 (정재·편재)' : '관성 (정관·편관)';
  // 일지(배우자궁) 충·합
  const dayInteractions = saju.interactions.filter((i) => i.description.includes(day.zhi));
  const dayChung = dayInteractions.filter((i) => ['충', '형', '파', '해'].includes(i.type));
  const dayHap = dayInteractions.filter((i) => i.type === '합');
  const gungStatus =
    dayChung.length > 0 ? { label: '동요 (충·형 있음)', color: SIGNAL.warn }
    : dayHap.length > 0 ? { label: '안정 (합 있음)', color: SIGNAL.good }
    : { label: '평이', color: SIGNAL.info };
  return (
    <div className="grid grid-cols-1 gap-2 mb-3">
      <p className="text-[17px] text-text-secondary leading-relaxed px-1" style={{ wordBreak: 'keep-all' }}>
        배우자궁(配偶宮)은 일간(나) 바로 아래 글자인 일지(日支)예요. 배우자가 앉는
        자리라 여겨, 이 글자가 흔들리면 배우자 인연도 출렁인다고 봅니다.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="배우자궁 (일지)"
          value={`${day.zhi} (${day.zhiElement})`}
          sub={gungStatus.label}
          color={gungStatus.color}
        />
        <StatCard
          label={spouseStarLabel}
          value={`${spouseStarTotal}개`}
          sub={
            spouseStarTotal === 0 ? '늦게 또는 노력으로 만들어가는 인연형'
            : spouseStarTotal <= 2 ? '인연 흐름이 적당히 받쳐주는 균형형'
            : '인연 기회가 자주 들어오는 활발형'
          }
          color={spouseStarTotal === 0 ? SIGNAL.info : spouseStarTotal <= 2 ? SIGNAL.good : SIGNAL.warn}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9) 건강운 — 약한 오행 + 건강 주의 신살
// ─────────────────────────────────────────────────────────────────────────────
const ELEMENT_ORGAN: Record<string, string> = {
  '목': '간·담·신경',
  '화': '심장·소장·혈압',
  '토': '비위·소화기',
  '금': '폐·대장·호흡기',
  '수': '신장·방광·생식기',
};
// 건강 관련 신살별 일상어 의미
const HEALTH_SINSAL_MEANING: Record<string, string> = {
  '백호': '사고·수술·출혈을 조심 — 안전 운전·정기 검진 권장',
  '양인': '수술·날카로운 것·과로 주의 — 무리한 추진 자제',
  '괴강': '컨디션 기복이 큼 — 극단적 생활 리듬 피하기',
  '귀문': '신경이 예민하고 불면·정신 피로가 오기 쉬움',
  '현침': '예민한 신경과 잔병치레 — 작은 상처도 방치 금지',
  '탕화': '화상·끓는 것·약물 사고 주의',
};
function healthSinsalDesc(name: string): string {
  const key = Object.keys(HEALTH_SINSAL_MEANING).find((k) => name.includes(k));
  return key ? HEALTH_SINSAL_MEANING[key] : '건강에 영향을 주는 기운 — 본문 설명 참고';
}
function HealthVisual({ saju }: { saju: SajuResult }) {
  const order = ['목', '화', '토', '금', '수'] as const;
  const zeroEls = order.filter((e) => (saju.elementPercent[e] ?? 0) === 0);
  const weakEl = saju.weakElement;
  const healthSinsals = saju.sinSals.filter((s) =>
    ['백호', '양인', '괴강', '귀문', '현침', '탕화'].some((k) => s.name.includes(k)),
  );
  return (
    <div className="grid grid-cols-1 gap-2 mb-3">
      <SectionCardWrap accent={SIGNAL.info} title="취약 오행 → 주의 장부">
        {/* 사용자 요청 — 건강운 박스 안 폰트가 작아 잘 안 보임. 본문·칩·신살 모두 확대. */}
        <p className="text-[17px] text-text-secondary leading-relaxed mb-3" style={{ wordBreak: 'keep-all' }}>
          오행은 각각 우리 몸의 장부와 연결돼요. 부족하거나 없는 오행이 있으면 그 장부의
          기운이 약해 피로·잔병이 그쪽으로 나타나기 쉽습니다.
        </p>
        <div className="flex flex-wrap gap-2">
          <Chip label={`약한 오행 ${weakEl} → ${ELEMENT_ORGAN[weakEl] ?? '-'}`} color={ELEMENT_COLOR[weakEl] ?? SIGNAL.info} subtle big />
          {zeroEls.filter((e) => e !== weakEl).map((e) => (
            <Chip key={e} label={`${e} 부재 → ${ELEMENT_ORGAN[e] ?? '-'}`} color={ELEMENT_COLOR[e] ?? SIGNAL.info} subtle big />
          ))}
        </div>
      </SectionCardWrap>
      <SectionCardWrap
        accent={healthSinsals.length > 0 ? SIGNAL.warn : SIGNAL.good}
        title="건강 주의 신살"
      >
        <p className="text-[17px] text-text-secondary leading-relaxed mb-3" style={{ wordBreak: 'keep-all' }}>
          신살은 사주에 깃든 특정 기운이에요. 아래 신살은 건강·안전 면에서 한 번씩
          살펴두면 좋은 신호입니다 (있다고 꼭 문제가 생기는 건 아니에요).
        </p>
        {healthSinsals.length === 0 ? (
          <span className="text-[17px] text-text-secondary leading-relaxed">건강 관련 주의 신살 없음 — 무난한 구조</span>
        ) : (
          <SinsalChipList
            accent={SIGNAL.warn}
            items={healthSinsals.map((s) => ({ name: s.name, desc: healthSinsalDesc(s.name) }))}
          />
        )}
      </SectionCardWrap>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 10) 인간관계·가족 — 귀인 신살 + 비겁·인성
// ─────────────────────────────────────────────────────────────────────────────
function RelationVisual({ saju }: { saju: SajuResult }) {
  const c = countTenGods(saju);
  const bigyeop = c.비견 + c.겁재;
  const inseong = c.정인 + c.편인;
  const guiSinsals = saju.sinSals.filter((s) => s.type === 'gilseong');
  return (
    <div className="grid grid-cols-1 gap-2 mb-3">
      <p className="text-[17px] text-text-secondary leading-relaxed px-1" style={{ wordBreak: 'keep-all' }}>
        사주 십성 중 비겁과 인성이 인간관계를 좌우해요. 비겁은 나와 같은 위치의 사람,
        인성은 나를 보살피는 윗사람을 뜻합니다.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="비겁 (또래·동료)"
          value={`${bigyeop}개`}
          sub={
            bigyeop >= 3 ? '형제·친구·동료가 인생에 큰 비중을 차지하는 대인 에너지형'
            : bigyeop === 0 ? '혼자 결정하고 움직이는 독립형'
            : '또래 관계가 적당히 받쳐주는 균형형'
          }
          color={SIGNAL.info}
        />
        <StatCard
          label="인성 (윗사람·멘토)"
          value={`${inseong}개`}
          sub={
            inseong >= 3 ? '부모·스승·후원자의 도움이 두터운 귀인·멘토복'
            : inseong === 0 ? '도움보다 스스로 일구는 자수성가형'
            : '윗사람 도움이 적당히 따르는 균형형'
          }
          color={SIGNAL.cta}
        />
      </div>
      <SectionCardWrap accent={guiSinsals.length > 0 ? SIGNAL.good : SIGNAL.info} title="귀인 길성">
        <p className="text-[17px] text-text-secondary leading-relaxed mb-2.5" style={{ wordBreak: 'keep-all' }}>
          길성은 위기 때 도와줄 사람·행운이 따르는 좋은 별이에요. 아래 별들이 어려운 순간
          귀인을 불러옵니다.
        </p>
        {guiSinsals.length === 0 ? (
          <span className="text-[17px] text-text-secondary leading-relaxed">
            귀인 길성 없음 — 인연을 스스로 일구는 자생형
          </span>
        ) : (
          <SinsalChipList
            accent={SIGNAL.good}
            items={guiSinsals.map((s) => ({ name: s.name, desc: s.description }))}
          />
        )}
      </SectionCardWrap>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 11) 대운·세운 흐름 — 현재 대운 강조 + 향후 대운 + 올해 세운
// ─────────────────────────────────────────────────────────────────────────────
function DaeChip({
  d,
  birthYear,
  isCurrent,
}: {
  d: DaeWoon;
  birthYear: number;
  isCurrent?: boolean;
}) {
  const toAge = (yr: number) => (birthYear > 0 ? yr - birthYear : yr);
  const accent = isCurrent ? SIGNAL.cta : SIGNAL.info;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[14px] font-bold border"
      style={{
        background: isCurrent ? `${accent}26` : `${accent}14`,
        color: 'var(--text-primary)',
        borderColor: `${accent}${isCurrent ? '88' : '44'}`,
      }}
    >
      <span style={{ color: accent }}>{toAge(d.startAge)}~{toAge(d.endAge)}세</span>
      <span style={{ fontFamily: 'var(--font-serif)' }}>{d.gan}{d.zhi}</span>
      <span className="text-text-tertiary font-normal">{d.tenGod}</span>
    </span>
  );
}

function LuckVisual({ saju }: { saju: SajuResult }) {
  const now = new Date().getFullYear();
  const birthYear = saju.solarDate ? new Date(saju.solarDate).getFullYear() : 0;
  const current = saju.daeWoon.find((d) => d.gan && now >= d.startAge && now <= d.endAge);
  const upcoming = saju.daeWoon.filter((d) => d.gan && d.startAge > now).slice(0, 3);
  const thisYear = saju.currentSeWoon;

  return (
    <div className="grid grid-cols-1 gap-2 mb-3">
      <SectionCardWrap accent={SIGNAL.cta} title="대운 흐름" titleSub="현재 + 향후 30년">
        <div className="flex flex-wrap gap-2">
          {current && <DaeChip d={current} birthYear={birthYear} isCurrent />}
          {upcoming.map((d, i) => (
            <DaeChip key={i} d={d} birthYear={birthYear} />
          ))}
          {!current && upcoming.length === 0 && (
            <span className="text-[17px] text-text-secondary leading-relaxed">대운 데이터 없음</span>
          )}
        </div>
      </SectionCardWrap>
      {thisYear && (
        <StatCard
          label={`올해 세운 (${thisYear.year}년)`}
          value={`${thisYear.gan}${thisYear.zhi} · ${thisYear.tenGod}`}
          sub={`12운성 ${thisYear.twelveStage}`}
          color={SIGNAL.good}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 통합 라우터 — 섹션 키에 따라 알맞은 시각 카드 반환 (advice 는 AdviceCard 별도)
// ─────────────────────────────────────────────────────────────────────────────
export function renderJungtongsajuSectionVisual(key: string, saju: SajuResult | null) {
  if (!saju) return null;
  switch (key) {
    case 'general':
      return <GeneralVisual saju={saju} />;
    case 'daymaster':
      return <DayMasterVisual saju={saju} />;
    case 'element':
      return <ElementVisual saju={saju} />;
    case 'interaction':
      return <InteractionVisual saju={saju} />;
    case 'character':
      return <CharacterVisual saju={saju} />;
    case 'career':
      return <CareerVisual saju={saju} />;
    case 'wealth':
      return <WealthVisual saju={saju} />;
    case 'love':
      return <LoveVisual saju={saju} />;
    case 'health':
      return <HealthVisual saju={saju} />;
    case 'relation':
      return <RelationVisual saju={saju} />;
    case 'luck':
      return <LuckVisual saju={saju} />;
    default:
      return null;
  }
}
