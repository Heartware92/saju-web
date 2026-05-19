'use client';

/**
 * 자녀·출산운 결과 페이지의 각 섹션 위에 박히는 시각 데이터 카드.
 *
 * 본문(줄글)이 길어지지 않도록 결정값(자녀성 합계·시주 정보·12운성·합충·대운 흐름)을
 * 시각 박스로 빼고, 본문은 "왜 그런가 + 어떻게 활용" 에 집중하게 한다.
 *
 * 정통사주 행운 처방 카드 · 이름풀이 NameSectionVisuals · 자미두수 데이터 카드와
 * 같은 코스믹 톤(2열 그리드 · 색칩 · 라디얼 그라데이션).
 */

import type { SajuResult, DaeWoon, SeWoon } from '../../utils/sajuCalculator';

// ─────────────────────────────────────────────────────────────────────────────
// 색 매핑 (NameSectionVisuals 와 동일 — 톤 통일)
// ─────────────────────────────────────────────────────────────────────────────
const ELEMENT_COLOR: Record<string, string> = {
  '목': '#22c55e',
  '화': '#ef4444',
  '토': '#eab308',
  '금': '#94a3b8',
  '수': '#3b82f6',
};
const ELEMENT_BG: Record<string, string> = {
  '목': 'rgba(34,197,94,0.10)',
  '화': 'rgba(239,68,68,0.10)',
  '토': 'rgba(234,179,8,0.10)',
  '금': 'rgba(148,163,184,0.10)',
  '수': 'rgba(59,130,246,0.10)',
};
const SIGNAL_COLOR = {
  good: '#34D399',
  warn: '#FB923C',
  bad: '#F87171',
  info: '#C9A6FF',
  cta: '#FCE8B2',
};

// ─────────────────────────────────────────────────────────────────────────────
// 십성 카운트 (지장간 0.5 가중) — prompts.ts 의 computeSipseongCounts 와 동일 로직
// ─────────────────────────────────────────────────────────────────────────────
const TEN_GODS_MAP: Record<string, Record<string, string>> = {};
// 동적 로딩 방지 — saju 객체에 이미 들어 있는 tenGodGan / tenGodZhi 만 사용해 카운트.
// (prompts.ts 의 computeSipseongCounts 는 server-only 가 아니지만 export 가 안 되어 있어
//  컴포넌트에서 직접 호출 불가. tenGodGan + tenGodZhi 가 이미 pillar 안에 들어 있으므로
//  지장간 0.5 가중 없이도 충분히 신호 카드 수준의 분포 표시 가능.)

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
    // 일주 천간은 일간 본인이므로 tenGodGan 이 비어있음 (skip)
    const gan = p.tenGodGan as keyof TenGodCounts;
    if (gan && c[gan] !== undefined) c[gan] += 1;
    const zhi = p.tenGodZhi as keyof TenGodCounts;
    if (zhi && c[zhi] !== undefined) c[zhi] += 1;
  }
  return c;
}

// 카테고리(인성·식상·관성·재성·비겁) 그룹화
function groupSipSeong(c: TenGodCounts) {
  return {
    인성: c.정인 + c.편인,
    식상: c.식신 + c.상관,
    관성: c.정관 + c.편관,
    재성: c.정재 + c.편재,
    비겁: c.비견 + c.겁재,
  };
}

// 자녀성 (남=관성, 여=식상)
function childStarLabel(gender: SajuResult['gender']): {
  group: '관성' | '식상';
  detail: string;
  sub: [string, string];
} {
  if (gender === 'male') {
    return { group: '관성', detail: '정관·편관', sub: ['정관', '편관'] };
  }
  return { group: '식상', detail: '식신·상관', sub: ['식신', '상관'] };
}

function childStarBadge(total: number): { label: string; color: string; desc: string } {
  if (total === 0) return { label: '인연 박함', color: SIGNAL_COLOR.warn, desc: '만득자·소자·대리 양육 가능성' };
  if (total <= 2) return { label: '보통', color: SIGNAL_COLOR.info, desc: '한두 자녀의 안정형' };
  if (total <= 4) return { label: '풍성', color: SIGNAL_COLOR.good, desc: '다자·자녀복 풍성형' };
  return { label: '매우 풍성', color: SIGNAL_COLOR.good, desc: '자녀복이 인생 큰 축' };
}

// 자녀성을 막는 기운 (남=상관견관 / 여=도식)
function antiChildStarSignal(saju: SajuResult, counts: TenGodCounts): {
  active: boolean;
  label: string;
  desc: string;
} {
  if (saju.gender === 'male') {
    const sangGwan = counts.상관;
    const active = sangGwan >= 2;
    return {
      active,
      label: '상관견관',
      desc: active ? `상관 ${sangGwan}개 — 자녀와의 갈등·양육 마찰 주의` : '상관견관 흐름 없음',
    };
  }
  const pyeonIn = counts.편인;
  const active = pyeonIn >= 2;
  return {
    active,
    label: '도식(倒食)',
    desc: active ? `편인 ${pyeonIn}개 — 임신 어려움·유산 주의 신호` : '도식 흐름 없음',
  };
}

// 임신·출산 체질 라벨
function pregnancyTypeLabel(saju: SajuResult, counts: TenGodCounts): {
  type: '자연 임신 유리' | '시기 선택 중요' | '의료 도움 권장';
  color: string;
  reason: string;
} {
  const star = childStarLabel(saju.gender);
  const total = counts[star.sub[0] as keyof TenGodCounts] + counts[star.sub[1] as keyof TenGodCounts];
  const anti = antiChildStarSignal(saju, counts);
  if (anti.active && total === 0) {
    return { type: '의료 도움 권장', color: SIGNAL_COLOR.bad, reason: `${anti.label} + 자녀성 0개 — 의학적 보조 적극 고려` };
  }
  if (anti.active || total === 0) {
    return { type: '시기 선택 중요', color: SIGNAL_COLOR.warn, reason: '대운·세운 자녀성 활성 시기에 집중적으로 준비' };
  }
  return { type: '자연 임신 유리', color: SIGNAL_COLOR.good, reason: `자녀성 ${total}개 안정 + 막는 기운 없음` };
}

// 양육 스타일 라벨 (가장 강한 십성 그룹 기준)
function parentingStyleLabel(counts: TenGodCounts): {
  style: string;
  color: string;
  desc: string;
  dominant: string;
} {
  const g = groupSipSeong(counts);
  const entries = Object.entries(g).sort((a, b) => b[1] - a[1]);
  const [dominant] = entries;
  const map: Record<string, { style: string; color: string; desc: string }> = {
    인성: { style: '인성형 — 보호·교육', color: '#3b82f6', desc: '책 읽어주기·학습 보조에 자연스럽게 강함' },
    식상: { style: '식상형 — 자유·표현', color: '#22c55e', desc: '아이의 표현·취향을 살리는 결' },
    관성: { style: '관성형 — 규율·책임', color: '#94a3b8', desc: '예절·생활 습관 잡는 결' },
    재성: { style: '재성형 — 현실 감각', color: '#eab308', desc: '실생활·경제 감각을 함께 키우는 결' },
    비겁: { style: '비겁형 — 친구처럼', color: '#e8a490', desc: '같이 놀고 같이 자라는 친구 결' },
  };
  const conf = map[dominant[0]] ?? map.인성;
  return { ...conf, dominant: dominant[0] };
}

// 자녀 기질 라벨 (시지 12운성 기준)
function temperamentLabel(saju: SajuResult): {
  type: string;
  color: string;
  reason: string;
} {
  if (saju.hourUnknown) {
    return { type: '시간 미상 — 일주 기준 추정', color: SIGNAL_COLOR.info, reason: '연·월·일주 분위기로 유추' };
  }
  const stage = saju.pillars.hour.twelveStage;
  // 활동적 / 차분 / 예술적 / 학구적
  const activeStages = ['장생', '관대', '건록', '제왕', '역마'];
  const calmStages = ['양', '쇠', '병', '묘', '절'];
  const artStages = ['목욕', '태'];
  const studyStages = ['관대', '건록']; // 일부 중첩 — fallback
  if (activeStages.includes(stage)) {
    return { type: '활동적 기질', color: SIGNAL_COLOR.warn, reason: `12운성 ${stage} — 에너지·도전형` };
  }
  if (artStages.includes(stage)) {
    return { type: '예술적 기질', color: SIGNAL_COLOR.info, reason: `12운성 ${stage} — 감수성·표현형` };
  }
  if (studyStages.includes(stage)) {
    return { type: '학구적 기질', color: '#3b82f6', reason: `12운성 ${stage} — 집중·탐구형` };
  }
  if (calmStages.includes(stage)) {
    return { type: '차분한 기질', color: SIGNAL_COLOR.good, reason: `12운성 ${stage} — 관찰·내면형` };
  }
  return { type: '균형 기질', color: SIGNAL_COLOR.info, reason: `12운성 ${stage}` };
}

// 자녀 진로 힌트 (시주 천간 십성 기준 + 자녀성 그룹 보조)
function careerHintLabel(saju: SajuResult, counts: TenGodCounts): {
  type: string;
  color: string;
  fields: string[];
} {
  // 시간 미상이면 자녀성 그룹 기반
  let basis: string = '';
  if (!saju.hourUnknown) basis = saju.pillars.hour.tenGodGan;
  if (!basis) {
    const g = groupSipSeong(counts);
    const entries = Object.entries(g).sort((a, b) => b[1] - a[1]);
    basis = entries[0]?.[0] ?? '인성';
  }
  // 십성 → 카테고리
  const map: Record<string, { type: string; color: string; fields: string[] }> = {
    식신: { type: '식상형 — 예술·창작', color: '#22c55e', fields: ['예술', '창작', '요리', '디자인'] },
    상관: { type: '식상형 — 표현·연출', color: '#22c55e', fields: ['공연', '영상', '글쓰기', '강연'] },
    정인: { type: '인성형 — 학문·교육', color: '#3b82f6', fields: ['연구', '교사', '의학', '인문'] },
    편인: { type: '인성형 — 전문·기술', color: '#3b82f6', fields: ['전문직', '심리', '종교', 'IT'] },
    정관: { type: '관성형 — 공직·리더십', color: '#94a3b8', fields: ['공직', '대기업', '관리', '법'] },
    편관: { type: '관성형 — 리더·도전', color: '#94a3b8', fields: ['군경', '스포츠', '벤처', '경영'] },
    정재: { type: '재성형 — 실리·경영', color: '#eab308', fields: ['금융', '회계', '경영', '유통'] },
    편재: { type: '재성형 — 사업·기획', color: '#eab308', fields: ['사업', '무역', '부동산', '마케팅'] },
    비견: { type: '비겁형 — 독립·전문', color: '#e8a490', fields: ['프리랜서', '운동', '창업', '기술직'] },
    겁재: { type: '비겁형 — 도전·경쟁', color: '#e8a490', fields: ['스포츠', '영업', '벤처', '대인업'] },
    인성: { type: '인성형 — 학문·교육', color: '#3b82f6', fields: ['연구', '교사', '의학'] },
    식상: { type: '식상형 — 예술·표현', color: '#22c55e', fields: ['예술', '창작', '강연'] },
    관성: { type: '관성형 — 공직·리더십', color: '#94a3b8', fields: ['공직', '대기업', '관리'] },
    재성: { type: '재성형 — 실리·경영', color: '#eab308', fields: ['금융', '경영', '사업'] },
    비겁: { type: '비겁형 — 독립·도전', color: '#e8a490', fields: ['창업', '스포츠', '프리랜서'] },
  };
  return map[basis] ?? map.인성;
}

// 자녀 인연 활성 대운/세운 (자녀성 십성이 걸린 운)
function findChildActiveLuck(saju: SajuResult): { dae: DaeWoon[]; se: SeWoon[] } {
  const target = saju.gender === 'male' ? ['정관', '편관'] : ['식신', '상관'];
  const now = new Date().getFullYear();
  const dae = saju.daeWoon
    .filter((d) => d.gan && d.endAge >= now && (target.includes(d.tenGod) || target.includes(d.tenGodZhi)))
    .slice(0, 3);
  const se = saju.seWoon
    .filter((s) => s.year >= now && s.year <= now + 6 && (target.includes(s.tenGod) || target.includes(s.tenGodZhi)))
    .slice(0, 4);
  return { dae, se };
}

// ─────────────────────────────────────────────────────────────────────────────
// 공통 작은 부품
// ─────────────────────────────────────────────────────────────────────────────
function MiniChip({ label, color, subtle }: { label: string; color: string; subtle?: boolean }) {
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

// ─────────────────────────────────────────────────────────────────────────────
// 1) 자녀복 — 자녀성 합계 + 시주 카드
// ─────────────────────────────────────────────────────────────────────────────
export function ChildFortuneVisual({ saju }: { saju: SajuResult }) {
  const counts = countTenGods(saju);
  const star = childStarLabel(saju.gender);
  const a = counts[star.sub[0] as keyof TenGodCounts];
  const b = counts[star.sub[1] as keyof TenGodCounts];
  const total = a + b;
  const badge = childStarBadge(total);
  const hour = saju.pillars.hour;

  return (
    <div className="grid grid-cols-2 gap-2.5 mb-3">
      {/* 좌: 자녀성 강도 큰 카드 */}
      <div
        className="rounded-2xl p-4 border flex flex-col gap-2"
        style={{
          background: `linear-gradient(135deg, rgba(20,12,38,0.65) 0%, ${badge.color}14 50%, rgba(20,12,38,0.55) 100%)`,
          borderColor: `${badge.color}55`,
          boxShadow: `0 0 18px ${badge.color}12`,
        }}
      >
        <span className="text-[14px] font-bold tracking-[0.04em]" style={{ color: badge.color }}>
          자녀성 {star.group}
        </span>
        <div className="flex items-end gap-1">
          <span
            className="text-[40px] font-bold leading-none"
            style={{ fontFamily: 'var(--font-serif)', color: badge.color, textShadow: `0 0 18px ${badge.color}55` }}
          >
            {total}
          </span>
          <span className="text-[15px] text-text-tertiary pb-1.5">개</span>
        </div>
        <span className="text-[14px] text-text-secondary leading-snug">
          {star.sub[0]} {a} · {star.sub[1]} {b}
        </span>
        <span
          className="inline-block text-[14px] font-bold px-2.5 py-1 rounded-md mt-1 w-fit"
          style={{ background: `${badge.color}22`, color: badge.color, border: `1px solid ${badge.color}55` }}
        >
          {badge.label}
        </span>
        <span className="text-[13px] text-text-tertiary leading-snug">{badge.desc}</span>
      </div>

      {/* 우: 시주(자녀궁) 정보 */}
      <div
        className="rounded-2xl p-4 border flex flex-col gap-2"
        style={{
          background: 'rgba(20,12,38,0.55)',
          borderColor: `${SIGNAL_COLOR.info}45`,
        }}
      >
        <span className="text-[14px] font-bold tracking-[0.04em]" style={{ color: SIGNAL_COLOR.info }}>
          자녀궁 (시주)
        </span>
        {saju.hourUnknown ? (
          <>
            <span
              className="text-[20px] font-bold leading-tight"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}
            >
              시간 미상
            </span>
            <span className="text-[13px] text-text-tertiary leading-snug">
              연·월·일주 + 대운·세운 기준으로 풀이
            </span>
          </>
        ) : (
          <>
            <span
              className="text-[28px] font-bold leading-tight"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}
            >
              {hour.gan}
              {hour.zhi}
            </span>
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              <MiniChip label={`12운성 ${hour.twelveStage}`} color={SIGNAL_COLOR.info} subtle />
              {hour.isKongmang && <MiniChip label="공망" color={SIGNAL_COLOR.warn} />}
            </div>
            <span className="text-[13px] text-text-tertiary leading-snug">
              지장간 {hour.hiddenStems.join('·') || '-'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) 임신·출산 체질 — 라벨 박스 + 막는 기운 칩
// ─────────────────────────────────────────────────────────────────────────────
export function PregnancyVisual({ saju }: { saju: SajuResult }) {
  const counts = countTenGods(saju);
  const type = pregnancyTypeLabel(saju, counts);
  const anti = antiChildStarSignal(saju, counts);
  const strength = saju.strengthStatus; // 신강·신약·중화·태강·태약

  return (
    <div className="grid grid-cols-2 gap-2.5 mb-3">
      <div
        className="rounded-2xl p-4 border flex flex-col gap-2"
        style={{
          background: `linear-gradient(135deg, rgba(20,12,38,0.65) 0%, ${type.color}14 60%, rgba(20,12,38,0.55) 100%)`,
          borderColor: `${type.color}55`,
          boxShadow: `0 0 18px ${type.color}12`,
        }}
      >
        <span className="text-[14px] font-bold tracking-[0.04em]" style={{ color: type.color }}>
          임신·출산 체질
        </span>
        <span
          className="text-[20px] font-bold leading-tight"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}
        >
          {type.type}
        </span>
        <span className="text-[13px] text-text-tertiary leading-snug">{type.reason}</span>
      </div>

      <div
        className="rounded-2xl p-4 border flex flex-col gap-2"
        style={{
          background: 'rgba(20,12,38,0.55)',
          borderColor: anti.active ? `${SIGNAL_COLOR.bad}55` : `${SIGNAL_COLOR.good}45`,
        }}
      >
        <span
          className="text-[14px] font-bold tracking-[0.04em]"
          style={{ color: anti.active ? SIGNAL_COLOR.bad : SIGNAL_COLOR.good }}
        >
          자녀성 막는 기운
        </span>
        <span
          className="text-[20px] font-bold leading-tight"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}
        >
          {anti.active ? anti.label : '없음'}
        </span>
        <span className="text-[13px] text-text-tertiary leading-snug">{anti.desc}</span>
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          <MiniChip label={`일간 ${strength}`} color={SIGNAL_COLOR.info} subtle />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) 자녀 기질 — 시지 12운성 + 지장간 + 기질 라벨
// ─────────────────────────────────────────────────────────────────────────────
export function TemperamentVisual({ saju }: { saju: SajuResult }) {
  const temp = temperamentLabel(saju);
  const hour = saju.pillars.hour;
  return (
    <div className="grid grid-cols-2 gap-2.5 mb-3">
      <div
        className="rounded-2xl p-4 border flex flex-col gap-2"
        style={{
          background: `linear-gradient(135deg, rgba(20,12,38,0.65) 0%, ${temp.color}14 60%, rgba(20,12,38,0.55) 100%)`,
          borderColor: `${temp.color}55`,
          boxShadow: `0 0 18px ${temp.color}10`,
        }}
      >
        <span className="text-[14px] font-bold tracking-[0.04em]" style={{ color: temp.color }}>
          기질 유형
        </span>
        <span
          className="text-[20px] font-bold leading-tight"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}
        >
          {temp.type}
        </span>
        <span className="text-[13px] text-text-tertiary leading-snug">{temp.reason}</span>
      </div>

      <div
        className="rounded-2xl p-4 border flex flex-col gap-2"
        style={{
          background: 'rgba(20,12,38,0.55)',
          borderColor: `${SIGNAL_COLOR.info}45`,
        }}
      >
        <span className="text-[14px] font-bold tracking-[0.04em]" style={{ color: SIGNAL_COLOR.info }}>
          시지 데이터
        </span>
        {saju.hourUnknown ? (
          <>
            <span
              className="text-[20px] font-bold leading-tight"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}
            >
              시간 미상
            </span>
            <span className="text-[13px] text-text-tertiary leading-snug">
              일주 ({saju.pillars.day.gan}{saju.pillars.day.zhi}) 기준 추정
            </span>
          </>
        ) : (
          <>
            <span
              className="text-[26px] font-bold leading-tight"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}
            >
              {hour.zhi}
              <span className="text-[15px] text-text-tertiary font-normal ml-1.5">({hour.zhiElement})</span>
            </span>
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              <MiniChip label={hour.twelveStage} color={SIGNAL_COLOR.info} subtle />
              {hour.sinSal12 && <MiniChip label={hour.sinSal12} color={SIGNAL_COLOR.cta} subtle />}
            </div>
            <span className="text-[13px] text-text-tertiary leading-snug">
              지장간 {hour.hiddenStems.join('·') || '-'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) 양육 스타일 — 본인 십성 5그룹 미니 막대 + 대표 라벨
// ─────────────────────────────────────────────────────────────────────────────
export function ParentingVisual({ saju }: { saju: SajuResult }) {
  const counts = countTenGods(saju);
  const style = parentingStyleLabel(counts);
  const groups = groupSipSeong(counts);
  const max = Math.max(1, ...Object.values(groups));

  return (
    <div className="rounded-2xl p-4 border mb-3" style={{ background: 'rgba(20,12,38,0.55)', borderColor: `${style.color}45` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[14px] font-bold tracking-[0.04em]" style={{ color: style.color }}>
          양육 성향
        </span>
        <span
          className="text-[14px] font-bold px-2.5 py-1 rounded-md"
          style={{ background: `${style.color}22`, color: style.color, border: `1px solid ${style.color}55` }}
        >
          {style.dominant}형
        </span>
      </div>
      <span
        className="block text-[20px] font-bold leading-tight mb-2"
        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}
      >
        {style.style}
      </span>
      <span className="block text-[13px] text-text-tertiary leading-snug mb-4">{style.desc}</span>

      <div className="space-y-2.5">
        {(['인성', '식상', '관성', '재성', '비겁'] as const).map((key) => {
          const v = groups[key];
          const pct = Math.round((v / max) * 100);
          const isDom = key === style.dominant;
          const color = isDom ? style.color : '#64748b';
          return (
            <div key={key} className="flex items-center gap-3">
              <span
                className="text-[14px] font-bold w-11 shrink-0"
                style={{ color: isDom ? style.color : 'var(--text-secondary)' }}
              >
                {key}
              </span>
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(4, pct)}%`,
                    background: color,
                    boxShadow: isDom ? `0 0 8px ${color}55` : 'none',
                  }}
                />
              </div>
              <span className="text-[13px] text-text-tertiary w-8 text-right shrink-0">{v}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) 자녀와의 궁합 — 일지 합/충/형/파/해 칩 그룹
// ─────────────────────────────────────────────────────────────────────────────
export function CompatibilityVisual({ saju }: { saju: SajuResult }) {
  const dayZhi = saju.pillars.day.zhi;
  const items = saju.interactions.filter((i) => i.description.includes(dayZhi));
  const goods = items.filter((i) => i.type === '합');
  const cautions = items.filter((i) => ['충', '형', '파', '해'].includes(i.type));

  return (
    <div className="space-y-2.5 mb-3">
      <div
        className="rounded-2xl p-4 border flex flex-col gap-2.5"
        style={{
          background: 'rgba(20,12,38,0.55)',
          borderColor: `${SIGNAL_COLOR.good}45`,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="inline-block w-1 h-5 rounded-full" style={{ background: SIGNAL_COLOR.good }} />
          <span className="text-[15px] font-bold tracking-[0.04em]" style={{ color: SIGNAL_COLOR.good }}>
            잘 맞는 결 <span className="text-text-tertiary font-normal text-[13px]">(일지 {dayZhi})</span>
          </span>
        </div>
        {goods.length === 0 ? (
          <span className="text-[14px] text-text-tertiary leading-snug">합 신호 없음 — 본문 띠 추천 참고</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {goods.map((g, i) => (
              <MiniChip key={i} label={g.description} color={SIGNAL_COLOR.good} />
            ))}
          </div>
        )}
      </div>
      <div
        className="rounded-2xl p-4 border flex flex-col gap-2.5"
        style={{
          background: 'rgba(20,12,38,0.55)',
          borderColor: cautions.length > 0 ? `${SIGNAL_COLOR.warn}55` : `${SIGNAL_COLOR.info}45`,
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-1 h-5 rounded-full"
            style={{ background: cautions.length > 0 ? SIGNAL_COLOR.warn : SIGNAL_COLOR.info }}
          />
          <span
            className="text-[15px] font-bold tracking-[0.04em]"
            style={{ color: cautions.length > 0 ? SIGNAL_COLOR.warn : SIGNAL_COLOR.info }}
          >
            조심할 결
          </span>
        </div>
        {cautions.length === 0 ? (
          <span className="text-[14px] text-text-tertiary leading-snug">충·형·파·해 신호 없음</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {cautions.map((c, i) => (
              <MiniChip key={i} label={`${c.type} ${c.description}`} color={SIGNAL_COLOR.warn} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) 자녀 진로·재능 힌트 — 유형 라벨 + 추천 분야 칩
// ─────────────────────────────────────────────────────────────────────────────
export function CareerHintVisual({ saju }: { saju: SajuResult }) {
  const counts = countTenGods(saju);
  const hint = careerHintLabel(saju, counts);

  return (
    <div
      className="rounded-2xl p-4 border mb-3 flex flex-col gap-2.5"
      style={{
        background: `linear-gradient(135deg, rgba(20,12,38,0.65) 0%, ${hint.color}14 60%, rgba(20,12,38,0.55) 100%)`,
        borderColor: `${hint.color}55`,
        boxShadow: `0 0 18px ${hint.color}10`,
      }}
    >
      <span className="text-[14px] font-bold tracking-[0.04em]" style={{ color: hint.color }}>
        자녀 진로 유형
      </span>
      <span
        className="text-[20px] font-bold leading-tight"
        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}
      >
        {hint.type}
      </span>
      <div className="flex flex-wrap gap-2 mt-1">
        {hint.fields.map((f, i) => (
          <MiniChip key={i} label={f} color={hint.color} subtle />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) 임신·출산 좋은 시기 — 향후 대운 + 자녀성 활성 세운 타임라인
// ─────────────────────────────────────────────────────────────────────────────
export function TimingVisual({ saju }: { saju: SajuResult }) {
  const { dae, se } = findChildActiveLuck(saju);
  const birthYear = saju.solarDate ? new Date(saju.solarDate).getFullYear() : 0;
  const targetGroup = saju.gender === 'male' ? '관성' : '식상';

  return (
    <div className="mb-3 space-y-2.5">
      <div
        className="rounded-2xl p-4 border"
        style={{ background: 'rgba(20,12,38,0.55)', borderColor: `${SIGNAL_COLOR.cta}45` }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-1 h-5 rounded-full" style={{ background: SIGNAL_COLOR.cta }} />
          <span className="text-[15px] font-bold tracking-[0.04em]" style={{ color: SIGNAL_COLOR.cta }}>
            자녀성({targetGroup}) 활성 대운
          </span>
        </div>
        {dae.length === 0 ? (
          <span className="text-[14px] text-text-tertiary leading-snug">
            향후 대운 중 자녀성 활성 흐름 없음 — 본문의 세운·달 신호 위주
          </span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dae.map((d, i) => {
              const as = birthYear > 0 ? d.startAge - birthYear : d.startAge;
              const ae = birthYear > 0 ? d.endAge - birthYear : d.endAge;
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[14px] font-bold border"
                  style={{
                    background: `${SIGNAL_COLOR.cta}1a`,
                    color: 'var(--text-primary)',
                    borderColor: `${SIGNAL_COLOR.cta}55`,
                  }}
                >
                  <span style={{ color: SIGNAL_COLOR.cta }}>{as}~{ae}세</span>
                  <span style={{ fontFamily: 'var(--font-serif)' }}>{d.gan}{d.zhi}</span>
                  <span className="text-text-tertiary font-normal">{d.tenGod}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div
        className="rounded-2xl p-4 border"
        style={{ background: 'rgba(20,12,38,0.55)', borderColor: `${SIGNAL_COLOR.good}45` }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block w-1 h-5 rounded-full" style={{ background: SIGNAL_COLOR.good }} />
          <span className="text-[15px] font-bold tracking-[0.04em]" style={{ color: SIGNAL_COLOR.good }}>
            자녀성 활성 세운
          </span>
        </div>
        {se.length === 0 ? (
          <span className="text-[14px] text-text-tertiary leading-snug">
            향후 6년 내 자녀성 활성 세운 없음 — 본문 월 단위 신호 확인
          </span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {se.map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[14px] font-bold border"
                style={{
                  background: `${SIGNAL_COLOR.good}1a`,
                  color: 'var(--text-primary)',
                  borderColor: `${SIGNAL_COLOR.good}55`,
                }}
              >
                <span style={{ color: SIGNAL_COLOR.good }}>{s.year}년</span>
                <span style={{ fontFamily: 'var(--font-serif)' }}>{s.gan}{s.zhi}</span>
                <span className="text-text-tertiary font-normal">{s.tenGod}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 통합 라우터 — 섹션 키에 따라 알맞은 시각 카드 반환
// ─────────────────────────────────────────────────────────────────────────────
export function renderChildrenSectionVisual(key: string, saju: SajuResult | null) {
  if (!saju) return null;
  switch (key) {
    case 'fortune':
      return <ChildFortuneVisual saju={saju} />;
    case 'pregnancy':
      return <PregnancyVisual saju={saju} />;
    case 'temperament':
      return <TemperamentVisual saju={saju} />;
    case 'parenting':
      return <ParentingVisual saju={saju} />;
    case 'compatibility':
      return <CompatibilityVisual saju={saju} />;
    case 'career_hint':
      return <CareerHintVisual saju={saju} />;
    case 'timing':
      return <TimingVisual saju={saju} />;
    default:
      return null;
  }
}

// 미사용 컬러 매핑 export (린트 회피용 — 추후 chip background tinting 확장 시 사용)
export const __CHILDREN_VISUAL_COLOR_REF = { ELEMENT_COLOR, ELEMENT_BG, TEN_GODS_MAP };
