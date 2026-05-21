'use client';

/**
 * 학업·시험운 결과 페이지의 각 섹션 본문 위에 박히는 시각 데이터 카드.
 *
 * 정통사주 JungtongsajuSectionVisuals · 자녀출산운 ChildrenSectionVisuals 와
 * 같은 코스믹 톤. 본문 줄글의 결정값을 한눈 시각 박스로 빼낸다.
 *
 * ★ 사용자 강조 — 공부 시간대(environment)·대운세운 흐름(timing) 시각화 강화.
 */

import { useState } from 'react';
import type { SajuResult, DaeWoon } from '../../utils/sajuCalculator';

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

/** 색칩 — 강점/약점/과목 등. */
function StudyChip({ label, color, subtle }: { label: string; color: string; subtle?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1.5 text-[14px] font-bold border"
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

/** 신살 칩 리스트 — 칩 3열 + 탭 시 인라인 펼침 (정통사주 SinsalChipList 패턴). */
function StudySinsalChips({
  items,
  accent,
}: {
  items: { name: string; desc: string }[];
  accent: string;
}) {
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

// ─────────────────────────────────────────────────────────────────────────────
// 1) 학업 체질 — 흡수(인성)·표현(식상)·집중(관성)·경쟁(비겁) 4축
// ─────────────────────────────────────────────────────────────────────────────
function AptitudeVisual({ saju }: { saju: SajuResult }) {
  const c = countTenGods(saju);
  const rows = [
    { label: '흡수력 (인성)', value: c.정인 + c.편인 },
    { label: '표현력 (식상)', value: c.식신 + c.상관 },
    { label: '집중력 (관성)', value: c.정관 + c.편관 },
    { label: '경쟁심 (비겁)', value: c.비견 + c.겁재 },
  ];
  const dominant = [...rows].sort((a, b) => b.value - a.value)[0];
  const typeLabel: Record<string, string> = {
    '흡수력 (인성)': '흡수형 — 이론·개념을 빨아들이는 결',
    '표현력 (식상)': '표현형 — 풀어내고 설명하며 익히는 결',
    '집중력 (관성)': '집중형 — 규율 속에서 몰입하는 결',
    '경쟁심 (비겁)': '경쟁형 — 라이벌·동기와 함께 크는 결',
  };
  return (
    <SectionCardWrap accent={SIGNAL.info} title="학업 4축 체질">
      <BarRows rows={rows} highlight={dominant.label} color={SIGNAL.info} />
      <div className="mt-3 pt-3 border-t border-white/10">
        <span className="text-[15px] font-semibold" style={{ color: SIGNAL.info }}>
          {typeLabel[dominant.label] ?? dominant.label}
        </span>
      </div>
    </SectionCardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) 강점·약점 — 십성 그룹 최강 2 / 최약 1
// ─────────────────────────────────────────────────────────────────────────────
function StrengthsVisual({ saju }: { saju: SajuResult }) {
  const c = countTenGods(saju);
  const groups: { key: string; label: string; value: number }[] = [
    { key: '인성', label: '이론 흡수', value: c.정인 + c.편인 },
    { key: '식상', label: '표현·논술', value: c.식신 + c.상관 },
    { key: '관성', label: '집중·규율', value: c.정관 + c.편관 },
    { key: '재성', label: '실용·계산', value: c.정재 + c.편재 },
    { key: '비겁', label: '경쟁·끈기', value: c.비견 + c.겁재 },
  ];
  const sorted = [...groups].sort((a, b) => b.value - a.value);
  const strengths = sorted.slice(0, 2);
  const weakness = sorted[sorted.length - 1];
  return (
    <SectionCardWrap accent={SIGNAL.good} title="강점·약점 한눈에">
      <div className="flex flex-col gap-3">
        <div>
          <span className="text-[13px] font-bold mb-2 block" style={{ color: SIGNAL.good }}>강점</span>
          <div className="flex flex-wrap gap-2">
            {strengths.map((s) => (
              <StudyChip key={s.key} label={`${s.label} (${s.key})`} color={SIGNAL.good} />
            ))}
          </div>
        </div>
        <div>
          <span className="text-[13px] font-bold mb-2 block" style={{ color: SIGNAL.warn }}>보완점</span>
          <div className="flex flex-wrap gap-2">
            <StudyChip label={`${weakness.label} (${weakness.key})`} color={SIGNAL.warn} subtle />
          </div>
        </div>
      </div>
    </SectionCardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) 시험 유형 적성 — 객관식·논술·면접·실기
// ─────────────────────────────────────────────────────────────────────────────
function ExamTypeVisual({ saju }: { saju: SajuResult }) {
  const c = countTenGods(saju);
  const hasDohwa = saju.sinSals.some((s) => s.name.includes('도화'));
  const rows = [
    { label: '객관식', value: c.정인 + c.편인 + c.식신 },
    { label: '논술·서술', value: c.상관 * 2 + c.식신 },
    { label: '면접·구술', value: c.상관 + (hasDohwa ? 2 : 0) + c.정관 },
    { label: '실기·실전', value: c.편관 + c.식신 + c.상관 },
  ];
  const dominant = [...rows].sort((a, b) => b.value - a.value)[0];
  return (
    <SectionCardWrap accent={SIGNAL.cta} title="시험 유형 적성">
      <BarRows rows={rows} highlight={dominant.label} color={SIGNAL.cta} labelWidth={72} />
      <div className="mt-3 pt-3 border-t border-white/10">
        <span className="text-[15px] font-semibold" style={{ color: SIGNAL.cta }}>
          가장 강한 유형 — {dominant.label}
        </span>
      </div>
    </SectionCardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) ★ 공부 환경·시간대 — 용신 오행 기준 24시간 최적 구간 띠
// ─────────────────────────────────────────────────────────────────────────────
const TIME_BY_ELEMENT: Record<string, { label: string; start: number; end: number }> = {
  // end 가 24 초과면 익일 (예: 수 = 21~25 → 21시~익일 1시)
  '목': { label: '오전 5~9시', start: 5, end: 9 },
  '화': { label: '오전 11시~오후 3시', start: 11, end: 15 },
  '토': { label: '오후 1~5시', start: 13, end: 17 },
  '금': { label: '오후 3~7시', start: 15, end: 19 },
  '수': { label: '밤 9시~새벽 1시', start: 21, end: 25 },
};
function EnvironmentVisual({ saju }: { saju: SajuResult }) {
  const el = saju.yongSinElement;
  const slot = TIME_BY_ELEMENT[el] ?? TIME_BY_ELEMENT['목'];
  const color = ELEMENT_COLOR[el] ?? SIGNAL.info;
  // 24칸 — 각 시간(0~23) 이 최적 구간이면 색칠
  const isPeak = (h: number): boolean => {
    if (slot.end <= 24) return h >= slot.start && h < slot.end;
    // 익일로 넘어가는 경우 (수)
    return h >= slot.start || h < slot.end - 24;
  };
  return (
    <SectionCardWrap accent={color} title="최적 공부 시간대" titleSub={`용신 ${el}`}>
      {/* 24시간 띠 */}
      <div className="flex gap-[2px] mb-2">
        {Array.from({ length: 24 }, (_, h) => {
          const peak = isPeak(h);
          return (
            <div
              key={h}
              className="flex-1 rounded-[2px]"
              style={{
                height: 22,
                background: peak ? color : 'rgba(255,255,255,0.06)',
                boxShadow: peak ? `0 0 6px ${color}88` : 'none',
              }}
              title={`${h}시`}
            />
          );
        })}
      </div>
      {/* 시각 눈금 — 0·6·12·18·24 */}
      <div className="flex justify-between text-[11px] text-text-tertiary mb-3">
        <span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>24시</span>
      </div>
      <div className="rounded-xl px-3.5 py-2.5 border" style={{ background: `${color}14`, borderColor: `${color}55` }}>
        <span className="text-[15px] font-bold" style={{ color }}>
          집중 황금 시간 — {slot.label}
        </span>
        <p className="text-[13px] text-text-tertiary mt-1 leading-snug">
          용신 {el}의 기운이 오르는 시간대예요. 어려운 과목·암기는 이 구간에 배치하면 흡수율이 높아집니다.
        </p>
      </div>
    </SectionCardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) 강점·약점 과목 — 5오행 분포 + 과목 칩
// ─────────────────────────────────────────────────────────────────────────────
const SUBJECT_BY_ELEMENT: Record<string, string> = {
  '목': '어학·문학·국어',
  '화': '예술·심리·미디어',
  '토': '역사·지리·경영',
  '금': '수학·논리·법학',
  '수': '철학·연구·이공계',
};
function SubjectsVisual({ saju }: { saju: SajuResult }) {
  const order = ['목', '화', '토', '금', '수'] as const;
  const pct = saju.elementPercent;
  const max = Math.max(1, ...order.map((e) => pct[e] ?? 0));
  const strongEl = saju.yongSinElement;
  const weakEl = saju.weakElement;
  return (
    <SectionCardWrap accent={SIGNAL.info} title="과목 강·약 지도">
      <div className="space-y-2 mb-3">
        {order.map((e) => {
          const v = pct[e] ?? 0;
          const color = ELEMENT_COLOR[e];
          const isStrong = e === strongEl;
          const isWeak = e === weakEl;
          return (
            <div key={e} className="flex items-center gap-2.5">
              <span className="text-[13px] font-bold w-4 text-center" style={{ color }}>{e}</span>
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: color }} />
              </div>
              <span className="text-[12px] text-text-tertiary w-8 text-right">{v}%</span>
              <span className="text-[10px] font-bold w-8 text-right" style={{ color: isStrong ? SIGNAL.good : isWeak ? SIGNAL.warn : 'transparent' }}>
                {isStrong ? '강' : isWeak ? '약' : '·'}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold shrink-0" style={{ color: SIGNAL.good }}>강점 과목</span>
          <StudyChip label={SUBJECT_BY_ELEMENT[strongEl] ?? '-'} color={SIGNAL.good} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold shrink-0" style={{ color: SIGNAL.warn }}>보완 과목</span>
          <StudyChip label={SUBJECT_BY_ELEMENT[weakEl] ?? '-'} color={SIGNAL.warn} subtle />
        </div>
      </div>
    </SectionCardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) 신살이 만드는 학습 패턴 — 학업 관련 신살 칩
// ─────────────────────────────────────────────────────────────────────────────
const STUDY_SINSAL_KEYS = ['문창', '학당', '문곡', '천문', '화개', '천덕', '월덕', '도화', '역마'];
function SinsalVisual({ saju }: { saju: SajuResult }) {
  const hits = saju.sinSals.filter((s) => STUDY_SINSAL_KEYS.some((k) => s.name.includes(k)));
  if (hits.length === 0) {
    return (
      <SectionCardWrap accent={SIGNAL.info} title="학습 신살">
        <span className="text-[17px] text-text-secondary leading-relaxed">
          학업 관련 신살 없음 — 신살에 기대지 않는 꾸준한 학습 결
        </span>
      </SectionCardWrap>
    );
  }
  return (
    <SectionCardWrap accent={SIGNAL.info} title="학습 신살">
      <StudySinsalChips
        accent={SIGNAL.info}
        items={hits.map((s) => ({ name: s.name, desc: s.description }))}
      />
    </SectionCardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) ★ 시험 적기 — 대운 타임라인 + 올해 세운
// ─────────────────────────────────────────────────────────────────────────────
function TimingVisual({ saju }: { saju: SajuResult }) {
  const now = new Date().getFullYear();
  const birthYear = saju.solarDate ? new Date(saju.solarDate).getFullYear() : 0;
  const toAge = (yr: number) => (birthYear > 0 ? yr - birthYear : yr);
  const valid = saju.daeWoon.filter((d) => d.gan && d.zhi);
  const curIdx = valid.findIndex((d) => now >= d.startAge && now <= d.endAge);
  // 현재 + 향후 3개
  const shown = curIdx >= 0 ? valid.slice(curIdx, curIdx + 4) : valid.slice(0, 4);
  const thisYear = saju.currentSeWoon;

  // 대운 십성이 학업에 유리한지 — 인성·식상이면 ★
  const goodForStudy = (d: DaeWoon): boolean =>
    ['정인', '편인', '식신', '상관'].includes(d.tenGod);

  return (
    <SectionCardWrap accent={SIGNAL.cta} title="시험 적기 — 대운 흐름" titleSub="현재 + 향후">
      {/* 올해 세운 */}
      {thisYear && (
        <div className="rounded-xl px-3.5 py-2.5 border mb-2.5" style={{ background: `${SIGNAL.good}14`, borderColor: `${SIGNAL.good}55` }}>
          <span className="text-[13px] font-bold" style={{ color: SIGNAL.good }}>올해 세운 ({thisYear.year}년)</span>
          <div className="text-[15px] font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
            {thisYear.gan}{thisYear.zhi} · {thisYear.tenGod}
            {['정인', '편인', '식신', '상관'].includes(thisYear.tenGod) && (
              <span className="text-[12px] ml-1.5" style={{ color: SIGNAL.good }}>학습 유리</span>
            )}
          </div>
        </div>
      )}
      {/* 대운 타임라인 */}
      {shown.length === 0 ? (
        <span className="text-[15px] text-text-tertiary">대운 데이터 없음</span>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((d, i) => {
            const isCur = i === 0;
            const good = goodForStudy(d);
            const accent = good ? SIGNAL.cta : SIGNAL.info;
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 border"
                style={{
                  background: isCur ? `${accent}26` : `${accent}10`,
                  borderColor: `${accent}${isCur ? '88' : '40'}`,
                }}
              >
                <span className="text-[14px] font-bold shrink-0" style={{ color: accent, width: 78 }}>
                  {toAge(d.startAge)}~{toAge(d.endAge)}세
                </span>
                <span className="text-[14px]" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-serif)' }}>
                  {d.gan}{d.zhi} · {d.tenGod}
                </span>
                {isCur && <span className="text-[11px] font-bold" style={{ color: accent }}>현재</span>}
                {good && <span className="text-[11px] font-bold ml-auto" style={{ color: SIGNAL.cta }}>★ 학습운 좋음</span>}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[12px] text-text-tertiary mt-2.5 leading-snug">
        ★ 표시 대운은 인성·식상 십성이 들어와 공부·시험·자격 취득에 유리한 구간이에요.
      </p>
    </SectionCardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 라우터 — 섹션 키 → 시각 카드. action 은 행동 불릿이라 시각 카드 없음.
// ─────────────────────────────────────────────────────────────────────────────
export function renderStudySectionVisual(key: string, saju: SajuResult | null) {
  if (!saju) return null;
  switch (key) {
    case 'aptitude':
      return <AptitudeVisual saju={saju} />;
    case 'strengths':
      return <StrengthsVisual saju={saju} />;
    case 'exam_type':
      return <ExamTypeVisual saju={saju} />;
    case 'environment':
      return <EnvironmentVisual saju={saju} />;
    case 'subjects':
      return <SubjectsVisual saju={saju} />;
    case 'sinsal':
      return <SinsalVisual saju={saju} />;
    case 'timing':
      return <TimingVisual saju={saju} />;
    default:
      return null;
  }
}
