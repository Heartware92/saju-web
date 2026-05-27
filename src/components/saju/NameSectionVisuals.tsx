'use client';

/**
 * 이름 풀이 결과 페이지의 각 섹션 위에 박히는 시각 카드 컴포넌트들.
 *
 * 본문(줄글)이 길어지지 않도록 결정값(음령오행 분포·자원오행·4격 길흉·실천 조언)을
 * 시각 박스로 빼고, 본문은 "왜 그런가 + 어떻게 활용" 에 집중하게 한다.
 *
 * 신년운세 월별 카드·정통사주 행운 처방 카드와 같은 코스믹 톤.
 */

import type { JSX } from 'react';
import { lookupHanjaBySound, type HanjaCandidate } from '../../lib/data/hanjaByKoreanSound';
import { calc4Gyeok } from '../../utils/numerology';
import { SURI_ELEMENT_KOREAN } from '../../lib/data/numerology81';

// ─────────────────────────────────────────────────────────────────────────────
// 색 매핑
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
const GRADE_COLOR: Record<string, string> = {
  '대길': '#34D399',
  '길':   '#86EFAC',
  '평':   '#CBD5E1',
  '흉':   '#FB923C',
  '대흉': '#F87171',
};

// 81 수리 한자명 → 한글 음 매핑 (사용자 가독성을 위해 한자 옆에 한글 풀이 병기)
// 각 수리 한자명 (예: "太極之數") → "태극지수"
const SURI_NAME_KOREAN: Record<string, string> = {
  '太極之數': '태극수',
  '分離之數': '분리수',
  '福德之數': '복덕수',
  '破滅之數': '파멸수',
  '福壽之數': '복수수',
  '順成之數': '순성수',
  '剛健之數': '강건수',
  '健勝之數': '건승수',
  '困窮之數': '곤궁수',
  '空虛之數': '공허수',
  '興旺之數': '흥왕수',
  '薄弱之數': '박약수',
  '智謀之數': '지모수',
  '離散之數': '이산수',
  '厚德之數': '후덕수',
  '健暢之數': '건창수',
  '發展之數': '발전수',
  '苦難之數': '고난수',
  '自立之數': '자립수',
  '中折之數': '중절수',
  '攻名之數': '공명수',
  '立身之數': '입신수',
  '安康之數': '안강수',
  '變怪之數': '변괴수',
  '波亂之數': '파란수',
  '不安之數': '불안수',
  '興家之數': '흥가수',
  '僥倖之數': '요행수',
  '升天之數': '승천수',
  '變亂之數': '변란수',
  '平和之數': '평화수',
  '義俠之數': '의협수',
  '忠實之數': '충실수',
  '安樂之數': '안락수',
  '退場之數': '퇴장수',
  '高名之數': '고명수',
  '困境之數': '곤경수',
  '散財之數': '산재수',
  '滅亡之數': '멸망수',
  '大智之數': '대지수',
  '困苦之數': '곤고수',
  '出世之數': '출세수',
  '變動之數': '변동수',
  '不時之數': '불시수',
  '浮沈之數': '부침수',
  '達晚之數': '달만수',
  '內憂之數': '내우수',
  '多難之數': '다난수',
  '善惡之數': '선악수',
  '損失之數': '손실수',
  '努力之數': '노력수',
  '災難之數': '재난수',
  '出財之數': '출재수',
  '動搖之數': '동요수',
  '名利之數': '명리수',
  '衰退之數': '쇠퇴수',
  '富榮之數': '부영수',
  '沈淪之數': '침륜수',
  '富貴之數': '부귀수',
  '內外之數': '내외수',
  '通達之數': '통달수',
  '衰敗之數': '쇠패수',
  '健全之數': '건전수',
  '後困之數': '후곤수',
  '平凡之數': '평범수',
  '寂寞之數': '적막수',
  '旺成之數': '왕성수',
  '終末之數': '종말수',
  '還元之數': '환원수',
};

// ─────────────────────────────────────────────────────────────────────────────
// 캡션 헤더 — 모든 시각 카드 공통: 작은 타이틀 + 1줄 설명
// ─────────────────────────────────────────────────────────────────────────────
function VisualCaption({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-2.5 pl-0.5">
      <div
        className="text-[15px] font-bold mb-1"
        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)', letterSpacing: '0.01em' }}
      >
        {title}
      </div>
      <div
        className="text-[13px] text-text-tertiary leading-[1.6]"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        {desc}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) 음령오행 — 음절별 카드 + 5오행 분포 막대
// ─────────────────────────────────────────────────────────────────────────────
export function EumRyeongVisual({
  chars,
  elements,
  yongSinEl,
  giSinEl,
}: {
  chars: string[];
  elements: string[];
  yongSinEl: string;
  giSinEl?: string;
}) {
  const counts = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 } as Record<string, number>;
  elements.forEach(e => { if (counts[e] !== undefined) counts[e]++; });
  const maxC = Math.max(1, ...Object.values(counts));

  return (
    <div className="space-y-3 mb-3">
      <VisualCaption
        title="음령오행"
        desc="한글 초성(ㄱ·ㄴ·ㅁ·ㅅ·ㅇ…)을 5오행으로 본 발음의 결입니다. 사주의 용신 오행이 포함되면 발음이 사주를 보강해요."
      />
      {/* 음절별 카드 */}
      <div className="flex flex-wrap gap-2 justify-center">
        {chars.map((ch, i) => {
          const el = elements[i] ?? '';
          const color = ELEMENT_COLOR[el] ?? 'transparent';
          const bg = ELEMENT_BG[el] ?? 'rgba(255,255,255,0.04)';
          return (
            <div
              key={i}
              className="flex flex-col items-center justify-center px-4 py-3 rounded-xl border"
              style={{ background: bg, borderColor: `${color}55`, minWidth: 64 }}
            >
              <span className="text-[22px] font-bold leading-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>{ch}</span>
              <span className="text-[13px] font-semibold mt-1" style={{ color, letterSpacing: '0.04em' }}>{el || '?'}</span>
            </div>
          );
        })}
      </div>

      {/* 5오행 분포 막대 */}
      <div className="rounded-xl p-3.5 bg-white/[0.03] border border-white/10">
        <div className="text-[14px] font-semibold text-text-tertiary mb-2.5">오행 분포</div>
        <div className="space-y-1.5">
          {(['목', '화', '토', '금', '수'] as const).map((el) => {
            const color = ELEMENT_COLOR[el];
            const n = counts[el];
            const isYong = el === yongSinEl;
            const isGi = el === giSinEl;
            return (
              <div key={el} className="flex items-center gap-2">
                <span className="text-[14px] font-bold w-5 text-center" style={{ color }}>{el}</span>
                <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(n / maxC) * 100}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }} />
                </div>
                <span className="text-[13px] text-text-secondary w-6 text-right">{n}</span>
                <span className="text-[12px] font-bold w-9 text-right" style={{ color: isYong ? '#34D399' : isGi ? '#F87171' : 'transparent' }}>
                  {isYong ? '용신' : isGi ? '기신' : '·'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) 자원오행 — 한자별 카드 그리드
// ─────────────────────────────────────────────────────────────────────────────
export function JaWonVisual({
  hanjas,
}: {
  hanjas: Array<{ char: string; meaning: string; radical: string; strokes: number; jawon: string }>;
}) {
  if (hanjas.length === 0) return null;
  return (
    <div className="mb-3">
      <VisualCaption
        title="자원오행"
        desc="각 한자의 부수가 어떤 오행인지 보여주는 카드예요. 예) 木부 = 목, 火부 = 화. 부수 옆 점은 자원오행 색."
      />
    <div className="grid grid-cols-3 gap-2">
      {hanjas.map((h, i) => {
        const color = ELEMENT_COLOR[h.jawon] ?? 'transparent';
        const bg = ELEMENT_BG[h.jawon] ?? 'rgba(255,255,255,0.04)';
        return (
          <div
            key={i}
            className="relative flex flex-col items-center justify-center px-2 py-3 rounded-2xl border"
            style={{ background: bg, borderColor: `${color}55` }}
          >
            {h.jawon && (
              <span
                className="absolute top-2 left-2 w-2 h-2 rounded-full"
                style={{ background: color, boxShadow: `0 0 6px ${color}aa` }}
                aria-hidden
              />
            )}
            <span
              className="text-[40px] font-bold leading-none"
              style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}
            >
              {h.char}
            </span>
            <span
              className="text-[17px] font-semibold text-text-secondary mt-2 text-center leading-snug"
              style={{ fontFamily: 'var(--font-body)', letterSpacing: '-0.005em' }}
            >
              {h.meaning}
            </span>
            <span
              className="text-[13px] text-text-tertiary mt-1"
              style={{ fontFamily: 'var(--font-body)', letterSpacing: '-0.005em' }}
            >
              {h.radical || '?'}부 · {h.strokes}획
            </span>
            {h.jawon && (
              <span
                className="text-[13px] font-bold mt-1"
                style={{ color, fontFamily: 'var(--font-body)', letterSpacing: '0.02em' }}
              >
                자원 {h.jawon}
              </span>
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 0) 종합 점수 카드 (summary 섹션용)
//    4축(음령·자원·수리오행·81수리) 등급칩 + 종합 별점.
//    한글 모드는 음령만, 한자 모드는 4축 전체 표시.
// ─────────────────────────────────────────────────────────────────────────────
type AxisGrade = '보강' | '중립' | '거스름' | '미분석';
const GRADE_BADGE: Record<AxisGrade, { bg: string; fg: string; border: string; label: string }> = {
  '보강':   { bg: 'rgba(52,211,153,0.10)',  fg: '#34D399', border: 'rgba(52,211,153,0.40)', label: '보강' },
  '중립':   { bg: 'rgba(203,213,225,0.10)', fg: '#CBD5E1', border: 'rgba(203,213,225,0.40)', label: '중립' },
  '거스름': { bg: 'rgba(248,113,113,0.10)', fg: '#F87171', border: 'rgba(248,113,113,0.40)', label: '거스름' },
  '미분석': { bg: 'rgba(148,163,184,0.06)', fg: '#94A3B8', border: 'rgba(148,163,184,0.25)', label: '한자 필요' },
};

function gradeFromElements(elements: string[], yongSinEl: string, giSinEl?: string): AxisGrade {
  const hasYong = !!yongSinEl && elements.includes(yongSinEl);
  const hasGi = !!giSinEl && elements.includes(giSinEl);
  if (hasYong && !hasGi) return '보강';
  if (hasGi && !hasYong) return '거스름';
  return '중립';
}

function gradeFromSuriElements(suriEls: string[], yongSinEl: string, giSinEl?: string): AxisGrade {
  if (suriEls.length === 0) return '미분석';
  const yongHits = yongSinEl ? suriEls.filter(e => e === yongSinEl).length : 0;
  const giHits = giSinEl ? suriEls.filter(e => e === giSinEl).length : 0;
  if (yongHits >= 2 && yongHits > giHits) return '보강';
  if (giHits >= 2 && giHits > yongHits) return '거스름';
  if (yongHits > giHits) return '보강';
  if (giHits > yongHits) return '거스름';
  return '중립';
}

function gradeFromSuriGrades(grades: string[]): AxisGrade {
  if (grades.length === 0) return '미분석';
  const goodCount = grades.filter(g => g === '대길' || g === '길').length;
  const badCount = grades.filter(g => g === '흉' || g === '대흉').length;
  if (goodCount >= 3) return '보강';
  if (badCount >= 2) return '거스름';
  if (goodCount > badCount) return '보강';
  if (badCount > goodCount) return '거스름';
  return '중립';
}

/**
 * 4축 등급 → 5점 만점 별점 + 점수 근거.
 *
 * 매핑 규칙 (선형):
 *   net = (보강 개수 − 거스름 개수) / 분석가능축수
 *   raw = 3 + net × 2        // -1.0 → 1★ / 0 → 3★ / +1.0 → 5★
 *   stars = clamp(round(raw), 1, 5)
 *
 * 검증:
 *   4보강      → 5★
 *   2보강 2거스름 → 3★
 *   4중립      → 3★
 *   4거스름     → 1★  (0★ shame 회피)
 *   미분석만     → 3★  (한글 모드에서 음령만 분석된 경우 등)
 */
function computeStarRating(grades: AxisGrade[]): {
  stars: number;
  bonusCount: number;
  neutralCount: number;
  penaltyCount: number;
  analyzedCount: number;
} {
  const valid = grades.filter(g => g !== '미분석');
  const bonusCount = valid.filter(g => g === '보강').length;
  const penaltyCount = valid.filter(g => g === '거스름').length;
  const neutralCount = valid.length - bonusCount - penaltyCount;
  if (valid.length === 0) {
    return { stars: 3, bonusCount: 0, neutralCount: 0, penaltyCount: 0, analyzedCount: 0 };
  }
  const net = (bonusCount - penaltyCount) / valid.length;
  const stars = Math.max(1, Math.min(5, Math.round(3 + net * 2)));
  return { stars, bonusCount, neutralCount, penaltyCount, analyzedCount: valid.length };
}

export function SummaryScoreVisual({
  yongSinEl,
  giSinEl,
  eumElements,
  jawonElements,
  hanjas,
  sounds,
}: {
  yongSinEl: string;
  giSinEl?: string;
  eumElements: string[];
  jawonElements: string[];
  hanjas: Array<{ char: string; meaning: string; radical: string; strokes: number; jawon: string }>;
  sounds: string[];
}) {
  const isHanjaMode = hanjas.length > 0;
  const suri = isHanjaMode ? calc4Gyeok(hanjas.map(h => h.char), sounds) : null;

  const eumGrade = gradeFromElements(eumElements, yongSinEl, giSinEl);
  const jawonGrade = isHanjaMode ? gradeFromElements(jawonElements, yongSinEl, giSinEl) : '미분석' as AxisGrade;
  const suriElGrade = suri
    ? gradeFromSuriElements(
        [suri.won, suri.hyeong, suri.i, suri.jeong].map(g => SURI_ELEMENT_KOREAN[g.entry.element] ?? ''),
        yongSinEl,
        giSinEl,
      )
    : '미분석' as AxisGrade;
  const suriGyeokGrade = suri
    ? gradeFromSuriGrades([suri.won, suri.hyeong, suri.i, suri.jeong].map(g => g.entry.grade))
    : '미분석' as AxisGrade;

  const axes: Array<{ label: string; sub: string; grade: AxisGrade }> = [
    { label: '음령',   sub: '한글 발음', grade: eumGrade },
    { label: '자원',   sub: '한자 부수', grade: jawonGrade },
    { label: '수리오행', sub: '4격 끝자리', grade: suriElGrade },
    { label: '81수리',  sub: '4격 길흉',  grade: suriGyeokGrade },
  ];

  // 종합 별점 + 점수 근거 — 사용자가 별의 출처를 직접 보고 납득하도록
  const rating = computeStarRating(axes.map(a => a.grade));

  return (
    <div
      className="rounded-2xl p-4 border mb-3"
      style={{
        background: 'linear-gradient(135deg, rgba(20,12,38,0.65) 0%, rgba(124,92,252,0.10) 50%, rgba(20,12,38,0.55) 100%)',
        borderColor: 'rgba(124,92,252,0.30)',
      }}
    >
      {/* 종합 별점 */}
      <div className="flex flex-col items-center mb-3">
        <span className="text-[12px] text-text-tertiary mb-1" style={{ fontFamily: 'var(--font-body)' }}>
          4축 종합
        </span>
        <div className="flex gap-1 mb-1.5">
          {[0, 1, 2, 3, 4].map(i => (
            <span
              key={i}
              className="text-[18px] leading-none"
              style={{ color: i < rating.stars ? '#FBBF24' : 'rgba(255,255,255,0.18)' }}
            >
              ★
            </span>
          ))}
        </div>
        {rating.analyzedCount > 0 ? (
          <span
            className="text-[13px] text-text-tertiary leading-tight text-center"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            보강 {rating.bonusCount} · 중립 {rating.neutralCount} · 거스름 {rating.penaltyCount}
            <span className="ml-1 opacity-60">(분석 {rating.analyzedCount}축)</span>
          </span>
        ) : (
          <span className="text-[13px] text-text-tertiary leading-tight" style={{ fontFamily: 'var(--font-body)' }}>
            분석 가능한 축이 없어 중간값으로 표시
          </span>
        )}
      </div>

      {/* 4축 등급칩 */}
      <div className="grid grid-cols-4 gap-2">
        {axes.map((a, i) => {
          const badge = GRADE_BADGE[a.grade];
          return (
            <div
              key={i}
              className="rounded-xl p-2 flex flex-col items-center justify-center border"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <span
                className="text-[12px] font-bold mb-0.5"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}
              >
                {a.label}
              </span>
              <span className="text-[10px] text-text-tertiary mb-1.5" style={{ fontFamily: 'var(--font-body)' }}>
                {a.sub}
              </span>
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                style={{
                  background: badge.bg,
                  color: badge.fg,
                  border: `1px solid ${badge.border}`,
                }}
              >
                {badge.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* 등급 의미 안내 — 사용자가 "보강/중립/거스름" 의미를 즉시 알 수 있게 */}
      <div
        className="mt-3 pt-3 grid grid-cols-3 gap-2 text-[13px] text-text-tertiary leading-[1.5] border-t"
        style={{ borderColor: 'rgba(255,255,255,0.08)', fontFamily: 'var(--font-body)' }}
      >
        <div className="flex flex-col items-start">
          <span className="font-bold mb-0.5" style={{ color: '#34D399' }}>보강</span>
          <span>사주 용신을<br />도와줘요</span>
        </div>
        <div className="flex flex-col items-start">
          <span className="font-bold mb-0.5" style={{ color: '#CBD5E1' }}>중립</span>
          <span>도움도<br />거스름도 약해요</span>
        </div>
        <div className="flex flex-col items-start">
          <span className="font-bold mb-0.5" style={{ color: '#F87171' }}>거스름</span>
          <span>사주 기신을<br />자극해요</span>
        </div>
      </div>

      {!isHanjaMode && (
        <p
          className="text-[12px] text-text-tertiary text-center mt-2 leading-[1.6]"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          한자 정보를 더하면 자원·수리오행·81수리까지 분석돼요
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3a) 강점 박스 (strength 섹션용) — 사주 매칭 기반 자동 추출
// ─────────────────────────────────────────────────────────────────────────────
function buildStrengthSignals(
  yongSinEl: string,
  eumElements: string[],
  jawonElements: string[],
): string[] {
  const out: string[] = [];
  if (eumElements.includes(yongSinEl)) out.push(`음령에 용신 ${yongSinEl} 포함\n발음이 사주 보강`);
  if (jawonElements.length > 0 && jawonElements.includes(yongSinEl)) {
    out.push(`한자 자원에 용신 ${yongSinEl} 포함\n부수가 사주 보강`);
  }
  if (out.length === 0) out.push('직접적 용신 매칭은 없으나 다른 영역에서 보강');
  return out;
}

function buildShadowSignals(
  giSinEl: string | undefined,
  eumElements: string[],
  jawonElements: string[],
): string[] {
  const out: string[] = [];
  if (giSinEl && eumElements.includes(giSinEl)) {
    out.push(`음령에 기신 ${giSinEl} 포함\n발음에서 마찰 가능`);
  }
  if (giSinEl && jawonElements.length > 0 && jawonElements.includes(giSinEl)) {
    out.push(`한자 자원에 기신 ${giSinEl} 포함\n부수에서 거스름`);
  }
  if (out.length === 0) out.push('치명적 기신 매칭은 없어 큰 부담 없음');
  return out;
}

export function StrengthVisual({
  yongSinEl,
  eumElements,
  jawonElements,
}: {
  yongSinEl: string;
  eumElements: string[];
  jawonElements: string[];
}) {
  const signals = buildStrengthSignals(yongSinEl, eumElements, jawonElements);
  return (
    <div
      className="rounded-2xl p-4 border mb-3"
      style={{ background: 'rgba(52,211,153,0.06)', borderColor: 'rgba(52,211,153,0.30)' }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[16px] font-bold" style={{ color: '#34D399' }}>이름의 강점 신호</span>
      </div>
      <div
        className="text-[13px] text-text-tertiary mb-3 leading-[1.6]"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        이름의 4축 중 사주 용신({yongSinEl || '?'})을 보태는 자리를 자동 추출했어요.
      </div>
      <ul className="space-y-2.5">
        {signals.map((p, i) => (
          <li
            key={i}
            className="text-[16px] text-text-secondary leading-[1.75] tracking-[-0.005em] whitespace-pre-line"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ShadowVisual({
  giSinEl,
  eumElements,
  jawonElements,
}: {
  giSinEl?: string;
  eumElements: string[];
  jawonElements: string[];
}) {
  const signals = buildShadowSignals(giSinEl, eumElements, jawonElements);
  return (
    <div
      className="rounded-2xl p-4 border mb-3"
      style={{ background: 'rgba(248,113,113,0.06)', borderColor: 'rgba(248,113,113,0.30)' }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[16px] font-bold" style={{ color: '#F87171' }}>주의 신호</span>
      </div>
      <div
        className="text-[13px] text-text-tertiary mb-3 leading-[1.6]"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        이름의 4축 중 사주 기신({giSinEl || '?'})을 자극하는 자리를 자동 추출했어요.
      </div>
      <ul className="space-y-2.5">
        {signals.map((c, i) => (
          <li
            key={i}
            className="text-[16px] text-text-secondary leading-[1.75] tracking-[-0.005em] whitespace-pre-line"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) [레거시] 사주와의 조화 — 좋은점·보완점 2단 박스. archive 모드에서만 사용.
// ─────────────────────────────────────────────────────────────────────────────
export function HarmonyVisual({
  yongSinEl,
  giSinEl,
  eumElements,
  jawonElements,
}: {
  yongSinEl: string;
  giSinEl?: string;
  eumElements: string[];
  jawonElements: string[]; // 한자 모드일 때만, 아니면 []
}) {
  const pros: string[] = [];
  const cons: string[] = [];

  // 음령
  if (eumElements.includes(yongSinEl)) pros.push(`음령에 용신 ${yongSinEl} 포함\n발음이 사주 보강`);
  if (giSinEl && eumElements.includes(giSinEl)) cons.push(`음령에 기신 ${giSinEl} 포함\n발음에서 조심`);

  // 자원
  if (jawonElements.length > 0) {
    if (jawonElements.includes(yongSinEl)) pros.push(`한자 자원에 용신 ${yongSinEl} 포함\n부수가 사주 보강`);
    if (giSinEl && jawonElements.includes(giSinEl)) cons.push(`한자 자원에 기신 ${giSinEl} 이 포함돼 한자 영향에 주의`);
  }

  if (pros.length === 0) pros.push('직접적 용신 매칭은 없으나 다른 영역에서 보강');
  if (cons.length === 0) cons.push('치명적 기신 매칭은 없어 큰 부담 없음');

  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      <div
        className="rounded-2xl p-4 border"
        style={{ background: 'rgba(52,211,153,0.06)', borderColor: 'rgba(52,211,153,0.30)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[15px] font-bold" style={{ color: '#34D399' }}>이름의 강점</span>
        </div>
        <ul className="space-y-2">
          {pros.map((p, i) => (
            <li
              key={i}
              className="text-[15px] text-text-secondary leading-[1.7] tracking-[-0.005em] whitespace-pre-line"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div
        className="rounded-2xl p-4 border"
        style={{ background: 'rgba(248,113,113,0.06)', borderColor: 'rgba(248,113,113,0.30)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[15px] font-bold" style={{ color: '#F87171' }}>보완 필요</span>
        </div>
        <ul className="space-y-2">
          {cons.map((c, i) => (
            <li
              key={i}
              className="text-[15px] text-text-secondary leading-[1.7] tracking-[-0.005em] whitespace-pre-line"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {c}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) 81 수리 — 4격(원·형·이·정) 카드 4개
// ─────────────────────────────────────────────────────────────────────────────
export function NumerologyVisual({
  chars,
  sounds,
  yongSinEl,
  giSinEl,
}: {
  chars: string[]; // 한자
  sounds: string[]; // 한국 음
  /** 사주 용신 오행 (한글: '목'/'화'/'토'/'금'/'수') — 수리오행 매칭 강조용 */
  yongSinEl?: string;
  giSinEl?: string;
}) {
  const result = calc4Gyeok(chars, sounds);
  if (!result) return null;

  const items: Array<{ label: string; area: string; data: typeof result.won }> = [
    { label: '원격', area: '초년운',         data: result.won },
    { label: '형격', area: '중년·주운',       data: result.hyeong },
    { label: '이격', area: '사회·인간관계',    data: result.i },
    { label: '정격', area: '평생·총운',       data: result.jeong },
  ];

  return (
    <div className="mb-3">
      <VisualCaption
        title="81수리"
        desc="한자 획수 조합으로 인생 시기별(초년·중년·사회·평생) 길흉을 봅니다. 등급 칩(대길~대흉)과 수리오행이 사주 용신과 맞물리는지 표시돼요."
      />
    <div className="space-y-2">
      {items.map((it, i) => {
        const color = GRADE_COLOR[it.data.entry.grade] ?? '#CBD5E1';
        return (
          <div
            key={i}
            className="rounded-2xl p-4 border flex items-center gap-4"
            style={{
              background: `linear-gradient(135deg, rgba(20,12,38,0.65) 0%, ${color}10 50%, rgba(20,12,38,0.55) 100%)`,
              borderColor: `${color}45`,
              boxShadow: `0 0 18px ${color}10, inset 0 0 1px ${color}40`,
            }}
          >
            {/* 좌측: 격 라벨 + 큰 수 */}
            <div className="flex flex-col items-center justify-center flex-shrink-0" style={{ minWidth: 76 }}>
              <span
                className="text-[13px] font-bold mb-1"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)', letterSpacing: '0.02em' }}
              >
                {it.label}
              </span>
              <span
                className="text-[34px] font-bold leading-none"
                style={{ fontFamily: 'var(--font-serif)', color, textShadow: `0 0 16px ${color}55` }}
              >
                {it.data.sum}
              </span>
              <span className="text-[10px] text-text-tertiary mt-0.5">{it.area}</span>
            </div>

            {/* 우측: 등급 배지 + 한자 명칭 + 수리오행 칩 + 의미 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span
                  className="text-[12px] font-bold px-2 py-0.5 rounded-md"
                  style={{ background: `${color}1f`, color, border: `1px solid ${color}55` }}
                >
                  {it.data.entry.grade}
                </span>
                {(() => {
                  const elKor = SURI_ELEMENT_KOREAN[it.data.entry.element];
                  const elColor = ELEMENT_COLOR[elKor] ?? '#CBD5E1';
                  const isYong = elKor === yongSinEl;
                  const isGi = elKor === giSinEl;
                  return (
                    <span
                      className="text-[11px] font-bold px-1.5 py-0.5 rounded-md inline-flex items-center gap-1"
                      style={{
                        background: ELEMENT_BG[elKor] ?? 'rgba(255,255,255,0.04)',
                        color: elColor,
                        border: `1px solid ${elColor}55`,
                      }}
                      title={isYong ? '사주 용신 보강' : isGi ? '사주 기신 (주의)' : '수리오행'}
                    >
                      수리 {elKor}
                      {isYong && <span style={{ color: '#34D399' }}>·용신</span>}
                      {isGi && <span style={{ color: '#F87171' }}>·기신</span>}
                    </span>
                  );
                })()}
                <span
                  className="text-[14px] font-bold"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}
                >
                  {it.data.entry.name}
                </span>
                {SURI_NAME_KOREAN[it.data.entry.name] && (
                  <span
                    className="text-[12px] text-text-tertiary"
                    style={{ fontFamily: 'var(--font-body)', letterSpacing: '-0.005em' }}
                  >
                    ({SURI_NAME_KOREAN[it.data.entry.name]})
                  </span>
                )}
              </div>
              <p
                className="text-[14px] text-text-secondary leading-[1.7] tracking-[-0.005em]"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {it.data.entry.meaning}
              </p>
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) 실천 조언 — 본문의 "- " 불릿을 카드로 분할 (CSS 전용)
// ─────────────────────────────────────────────────────────────────────────────
export function AdviceVisual({ bullets }: { bullets: string[] }): JSX.Element | null {
  if (bullets.length === 0) return null;
  return (
    <div className="mb-2">
      <VisualCaption
        title="실천 가이드"
        desc="본문에서 추출한 실천 항목입니다. 일상에서 바로 적용해보세요."
      />
    <div className="space-y-2">
      {bullets.map((b, i) => (
        <div
          key={i}
          className="flex items-start gap-2.5 rounded-xl p-3.5 bg-white/[0.04] border border-white/10"
        >
          <span
            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold text-cta"
            style={{ background: 'rgba(124,92,252,0.15)', border: '1px solid rgba(124,92,252,0.40)' }}
          >
            {i + 1}
          </span>
          <span
            className="text-[16px] text-text-secondary leading-[1.75] tracking-[-0.005em]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {b}
          </span>
        </div>
      ))}
    </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 유틸: hanjaName + charMeanings 에서 hanjaResolved 재계산 (archive 모드 호환)
// ─────────────────────────────────────────────────────────────────────────────
export function resolveHanjasForVisual(
  hanjaName: string,
  charMeanings: Array<{ sound?: string; meaning?: string } | undefined>,
): Array<{ char: string; meaning: string; radical: string; strokes: number; jawon: string }> {
  if (!hanjaName) return [];
  const chars = [...hanjaName];
  return chars.map((char, i) => {
    const sound = charMeanings[i]?.sound ?? '';
    const hit = lookupHanjaBySound(sound).find((c: HanjaCandidate) => c.char === char);
    return hit
      ? { char, meaning: hit.meanings[0] ?? '', radical: hit.radical, strokes: hit.strokes, jawon: hit.jawon }
      : { char, meaning: charMeanings[i]?.meaning ?? '', radical: '', strokes: 0, jawon: '' };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 본문에서 "- " 불릿 추출 (advice 섹션용)
// ─────────────────────────────────────────────────────────────────────────────
export function extractBullets(text: string): { bullets: string[]; rest: string } {
  const lines = text.split('\n');
  const bullets: string[] = [];
  const restLines: string[] = [];
  for (const ln of lines) {
    const t = ln.trim();
    const m = t.match(/^[-•·]\s+(.+)$/);
    if (m) bullets.push(m[1].trim());
    else restLines.push(ln);
  }
  return { bullets, rest: restLines.join('\n').trim() };
}
