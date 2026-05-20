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
function Chip({ label, color, subtle }: { label: string; color: string; subtle?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[14px] font-bold border"
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
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
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
        className="text-[20px] font-bold leading-tight"
        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}
      >
        {value}
      </span>
      {sub && <span className="text-[12.5px] text-text-tertiary leading-snug">{sub}</span>}
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
      <StatCard label="격국" value={gyeokguk.name} sub={gyeokguk.type} color={SIGNAL.cta} />
      <StatCard
        label="신강신약"
        value={saju.strengthStatus}
        sub={`점수 ${saju.strengthScore}`}
        color={strengthColor}
      />
      <StatCard
        label="용신"
        value={saju.yongSin}
        sub={`${saju.yongSinElement} 기운`}
        color={ELEMENT_COLOR[saju.yongSinElement] ?? SIGNAL.info}
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
        <div className="flex flex-col items-center shrink-0" style={{ minWidth: 78 }}>
          <span
            className="text-[34px] font-bold leading-none"
            style={{ fontFamily: 'var(--font-serif)', color: accent, textShadow: `0 0 18px ${accent}55` }}
          >
            {day.gan}{day.zhi}
          </span>
          {traits && (
            <span className="text-[12.5px] text-text-tertiary mt-1.5">{traits.name}</span>
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
                  className="text-[12.5px] px-2 py-0.5 rounded-md font-medium"
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
              {(isStrong || isWeak) && (
                <span
                  className="text-[11px] font-bold px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    background: isStrong ? `${SIGNAL.warn}22` : `${SIGNAL.info}22`,
                    color: isStrong ? SIGNAL.warn : SIGNAL.info,
                    border: `1px solid ${(isStrong ? SIGNAL.warn : SIGNAL.info)}55`,
                  }}
                >
                  {isStrong ? '강' : '약'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </SectionCardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) 합·충·형·파·해 — 칩 그룹
// ─────────────────────────────────────────────────────────────────────────────
function InteractionVisual({ saju }: { saju: SajuResult }) {
  const harmony = saju.interactions.filter((i) => i.type === '합');
  const tension = saju.interactions.filter((i) => ['충', '형', '파', '해'].includes(i.type));
  return (
    <div className="grid grid-cols-1 gap-2 mb-3">
      <SectionCardWrap accent={SIGNAL.good} title="합 (결속·조화)">
        {harmony.length === 0 ? (
          <span className="text-[14px] text-text-tertiary leading-snug">원국에 합 없음</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {harmony.map((h, i) => (
              <Chip key={i} label={h.description.split(' - ')[0]} color={SIGNAL.good} subtle />
            ))}
          </div>
        )}
      </SectionCardWrap>
      <SectionCardWrap accent={tension.length > 0 ? SIGNAL.warn : SIGNAL.info} title="충·형·파·해 (변동·긴장)">
        {tension.length === 0 ? (
          <span className="text-[14px] text-text-tertiary leading-snug">원국에 충·형·파·해 없음 — 안정 구조</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tension.map((t, i) => (
              <Chip key={i} label={`${t.type} ${t.description.split(' - ')[0]}`} color={SIGNAL.warn} subtle />
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
        <span className="text-[14px] text-text-tertiary leading-snug">본문의 직군 추천 참고</span>
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
  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      <StatCard
        label="재성 (정재+편재)"
        value={`${total}개`}
        sub={`정재 ${jeongJae} · 편재 ${pyeonJae}`}
        color={wealthBadge.color}
      />
      <StatCard
        label="재물 그릇"
        value={strong ? '감당형 (신강)' : '관리 주의 (신약)'}
        sub={strong ? '큰 재물도 감당하는 힘' : '재성 과다 시 부담 — 분산 관리'}
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
    <div className="grid grid-cols-2 gap-2 mb-3">
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
          spouseStarTotal === 0 ? '인연성 약함 — 늦은 인연·노력형'
          : spouseStarTotal <= 2 ? '인연 흐름 보통'
          : '인연 기회 많음'
        }
        color={spouseStarTotal === 0 ? SIGNAL.info : spouseStarTotal <= 2 ? SIGNAL.good : SIGNAL.warn}
      />
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
        <div className="flex flex-wrap gap-2">
          <Chip label={`약한 오행 ${weakEl} → ${ELEMENT_ORGAN[weakEl] ?? '-'}`} color={ELEMENT_COLOR[weakEl] ?? SIGNAL.info} subtle />
          {zeroEls.filter((e) => e !== weakEl).map((e) => (
            <Chip key={e} label={`${e} 부재 → ${ELEMENT_ORGAN[e] ?? '-'}`} color={ELEMENT_COLOR[e] ?? SIGNAL.info} subtle />
          ))}
        </div>
      </SectionCardWrap>
      <SectionCardWrap
        accent={healthSinsals.length > 0 ? SIGNAL.warn : SIGNAL.good}
        title="건강 주의 신살"
      >
        {healthSinsals.length === 0 ? (
          <span className="text-[14px] text-text-tertiary leading-snug">건강 관련 주의 신살 없음</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {healthSinsals.map((s, i) => (
              <Chip key={i} label={s.name} color={SIGNAL.warn} subtle />
            ))}
          </div>
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
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="비겁 (동료·경쟁)"
          value={`${bigyeop}개`}
          sub={bigyeop >= 3 ? '대인 에너지 강함' : bigyeop === 0 ? '독립형' : '균형형'}
          color={SIGNAL.info}
        />
        <StatCard
          label="인성 (윗사람·멘토)"
          value={`${inseong}개`}
          sub={inseong >= 3 ? '귀인·멘토복 강함' : inseong === 0 ? '자수성가형' : '균형형'}
          color={SIGNAL.cta}
        />
      </div>
      <SectionCardWrap accent={guiSinsals.length > 0 ? SIGNAL.good : SIGNAL.info} title="귀인 길성">
        {guiSinsals.length === 0 ? (
          <span className="text-[14px] text-text-tertiary leading-snug">귀인 길성 없음 — 스스로 일군 인연 위주</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {guiSinsals.map((s, i) => (
              <Chip key={i} label={s.name} color={SIGNAL.good} subtle />
            ))}
          </div>
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
            <span className="text-[14px] text-text-tertiary leading-snug">대운 데이터 없음</span>
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
