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
function VisualCaption({ title, desc, hideTitle = false }: { title: string; desc: string; hideTitle?: boolean }) {
  return (
    <div className="mb-3 pl-0.5">
      {!hideTitle && (
        <div
          className="text-[16px] font-bold mb-1"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)', letterSpacing: '0.01em' }}
        >
          {title}
        </div>
      )}
      <div
        className="text-[14px] text-text-secondary leading-[1.65]"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        {desc}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 0) 이름 카드 — meaning 섹션의 은유 표현 아래에 표기.
//    한자 모드: 한자 + 한글 음 + 한자 뜻 (글자별 카드)
//    한글 모드: 한글 글자 + 음령오행 (글자별 카드)
// ─────────────────────────────────────────────────────────────────────────────
export function NameMeaningVisual({
  chars,
  elements,
  hanjas,
}: {
  /** 한글 글자 배열 (예: ["허", "진", "우"]) */
  chars: string[];
  /** 한글 초성 음령오행 (chars 와 같은 길이) */
  elements: string[];
  /** 한자 정보 — 한자 모드에서만 채워짐. 비어있으면 한글 모드 카드 */
  hanjas: Array<{ char: string; meaning: string; radical: string; strokes: number; jawon: string }>;
}) {
  const isHanjaMode = hanjas.length > 0;
  if (chars.length === 0) return null;
  // 복성(4글자) 케이스에서도 한 줄 배치 — 글자 수 따라 컬럼 동적.
  // Tailwind JIT 정적 매칭을 위해 명시적 분기.
  const colsCls =
    chars.length >= 4 ? 'grid-cols-4' :
    chars.length === 3 ? 'grid-cols-3' :
    chars.length === 2 ? 'grid-cols-2' :
    'grid-cols-1 max-w-[120px] mx-auto';
  return (
    <div className="mb-3">
      <div className={`grid gap-2 ${colsCls}`}>
        {chars.map((ch, i) => {
          if (isHanjaMode) {
            const h = hanjas[i];
            if (!h) return null;
            const color = ELEMENT_COLOR[h.jawon] ?? 'rgba(255,255,255,0.10)';
            const bg = ELEMENT_BG[h.jawon] ?? 'rgba(255,255,255,0.03)';
            return (
              <div
                key={i}
                className="flex flex-col items-center justify-center px-2 py-2.5 rounded-xl border"
                style={{ background: bg, borderColor: `${color}55` }}
              >
                <span
                  className="text-[32px] font-bold leading-none"
                  style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}
                >
                  {h.char}
                </span>
                <span
                  className="text-[12px] font-semibold mt-1"
                  style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}
                >
                  {ch}
                </span>
                <span
                  className="text-[13px] font-semibold text-text-secondary mt-1 text-center leading-tight"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {h.meaning}
                </span>
              </div>
            );
          }
          const el = elements[i] ?? '';
          const color = ELEMENT_COLOR[el] ?? 'rgba(255,255,255,0.10)';
          const bg = ELEMENT_BG[el] ?? 'rgba(255,255,255,0.03)';
          return (
            <div
              key={i}
              className="flex flex-col items-center justify-center px-2 py-3 rounded-xl border"
              style={{ background: bg, borderColor: `${color}55` }}
            >
              <span
                className="text-[28px] font-bold leading-none"
                style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}
              >
                {ch}
              </span>
              {el && (
                <span
                  className="text-[12px] font-bold mt-1.5"
                  style={{ color, letterSpacing: '0.04em' }}
                >
                  음령 {el}
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
// 1) 음령오행 — 음절별 카드 + 5오행 분포 막대
// ─────────────────────────────────────────────────────────────────────────────
export function EumRyeongVisual({
  chars,
  elements,
  yongSinEl,
  giSinEl,
  hideCaptionTitle = false,
}: {
  chars: string[];
  elements: string[];
  yongSinEl: string;
  giSinEl?: string;
  hideCaptionTitle?: boolean;
}) {
  const counts = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 } as Record<string, number>;
  elements.forEach(e => { if (counts[e] !== undefined) counts[e]++; });
  const maxC = Math.max(1, ...Object.values(counts));

  return (
    <div className="space-y-3 mb-3">
      <VisualCaption
        title="음령오행"
        desc="한글 초성을 5오행으로 본 발음의 결입니다. 용신 오행이 포함되면 발음이 사주를 보강해요."
        hideTitle={hideCaptionTitle}
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
      <div className="rounded-xl p-4 bg-white/[0.03] border border-white/10">
        <div className="text-[15px] font-semibold text-text-secondary mb-3">오행 분포</div>
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
  hideCaptionTitle = false,
}: {
  hanjas: Array<{ char: string; meaning: string; radical: string; strokes: number; jawon: string }>;
  hideCaptionTitle?: boolean;
}) {
  if (hanjas.length === 0) return null;
  // 복성(4글자) 케이스에서도 한 줄 배치 — 글자 수 따라 컬럼 동적.
  const jawonColsCls =
    hanjas.length >= 4 ? 'grid-cols-4' :
    hanjas.length === 3 ? 'grid-cols-3' :
    hanjas.length === 2 ? 'grid-cols-2' :
    'grid-cols-1 max-w-[120px] mx-auto';
  return (
    <div className="mb-3">
      <VisualCaption
        title="자원오행"
        desc="한자 부수가 품은 오행이에요. 카드 좌상단 점이 그 오행 색입니다."
        hideTitle={hideCaptionTitle}
      />
    <div className={`grid gap-2 ${jawonColsCls}`}>
      {hanjas.map((h, i) => {
        const color = ELEMENT_COLOR[h.jawon] ?? 'transparent';
        const bg = ELEMENT_BG[h.jawon] ?? 'rgba(255,255,255,0.04)';
        return (
          <div
            key={i}
            className="relative flex flex-col items-center justify-center px-2 py-2.5 rounded-xl border"
            style={{ background: bg, borderColor: `${color}55` }}
          >
            {h.jawon && (
              <span
                className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full"
                style={{ background: color, boxShadow: `0 0 5px ${color}aa` }}
                aria-hidden
              />
            )}
            <span
              className="text-[32px] font-bold leading-none"
              style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}
            >
              {h.char}
            </span>
            <span
              className="text-[13px] font-semibold text-text-secondary mt-1.5 text-center leading-tight"
              style={{ fontFamily: 'var(--font-body)', letterSpacing: '-0.005em' }}
            >
              {h.meaning}
            </span>
            <span
              className="text-[11px] text-text-tertiary mt-0.5"
              style={{ fontFamily: 'var(--font-body)', letterSpacing: '-0.005em' }}
            >
              {h.radical || '?'}부 · {h.strokes}획
            </span>
            {h.jawon && (
              <span
                className="text-[11px] font-bold mt-0.5"
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

/**
 * 4축 등급 → 100점 정량 점수 + 종합 등급 안내.
 *
 * 점수 매핑 (축당 25점 만점):
 *   보강 = 25 / 중립 = 15 / 거스름 = 5 / 미분석 = 12.5 (중간값)
 *
 * 종합 등급:
 *   85~100: 매우 좋음
 *   70~84:  좋음
 *   55~69:  나쁘지 않음
 *   40~54:  보통
 *   0~39:   주의
 */
/**
 * 축당 25점 (4축 × 25점 = 100점 만점).
 *   보강 = 25 / 중립 = 15 / 거스름 = 5 / 미분석 = 12.5 (중간값)
 *
 * [BACKLOG] 5축 부활 시 20/12/4/10 으로 조정.
 */
const SCORE_PER_GRADE: Record<AxisGrade, number> = {
  '보강':   25,
  '중립':   15,
  '거스름': 5,
  '미분석': 12.5,
};
type OverallTier = { label: string; color: string; bg: string; border: string };
function computeScore(grades: AxisGrade[]): { score: number; tier: OverallTier; axisScores: number[] } {
  const axisScores = grades.map(g => SCORE_PER_GRADE[g]);
  const score = Math.round(axisScores.reduce((s, v) => s + v, 0));
  let tier: OverallTier;
  if (score >= 85)      tier = { label: '매우 좋음', color: '#34D399', bg: 'rgba(52,211,153,0.14)',  border: 'rgba(52,211,153,0.45)' };
  else if (score >= 70) tier = { label: '좋음',     color: '#86EFAC', bg: 'rgba(134,239,172,0.12)', border: 'rgba(134,239,172,0.40)' };
  else if (score >= 55) tier = { label: '나쁘지 않음', color: '#FCD34D', bg: 'rgba(252,211,77,0.12)',  border: 'rgba(252,211,77,0.40)' };
  else if (score >= 40) tier = { label: '보통',     color: '#CBD5E1', bg: 'rgba(203,213,225,0.12)', border: 'rgba(203,213,225,0.40)' };
  else                  tier = { label: '주의',     color: '#F87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.40)' };
  return { score, tier, axisScores };
}

export function SummaryScoreVisual({
  yongSinEl,
  giSinEl,
  eumElements,
  jawonElements,
  hanjas,
  sounds,
  sajuElementCount,
  dayMasterElement,
  surnameLength = 1,
}: {
  yongSinEl: string;
  giSinEl?: string;
  eumElements: string[];
  jawonElements: string[];
  hanjas: Array<{ char: string; meaning: string; radical: string; strokes: number; jawon: string }>;
  sounds: string[];
  sajuElementCount?: { 목: number; 화: number; 토: number; 금: number; 수: number };
  dayMasterElement?: string;
  surnameLength?: 1 | 2;
}) {
  const isHanjaMode = hanjas.length > 0;
  const suri = isHanjaMode ? calc4Gyeok(hanjas.map(h => h.char), sounds, surnameLength) : null;

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
  // [BACKLOG] 5축 부활 시 음양 등급 활성화
  // const eumyangGrade: AxisGrade = (() => {
  //   if (!isHanjaMode) return '미분석';
  //   const yang = hanjas.filter(h => h.strokes % 2 === 1).length;
  //   const eum = hanjas.length - yang;
  //   if (yang === hanjas.length || eum === hanjas.length) return '거스름';
  //   if (Math.abs(yang - eum) <= Math.max(1, Math.floor(hanjas.length / 2))) return '보강';
  //   return '중립';
  // })();

  const axes: Array<{ label: string; sub: string; grade: AxisGrade }> = [
    { label: '음령',   sub: '한글 발음', grade: eumGrade },
    { label: '자원',   sub: '한자 부수', grade: jawonGrade },
    { label: '수리',   sub: '수리오행',  grade: suriElGrade },
    { label: '81수리', sub: '4격 길흉',  grade: suriGyeokGrade },
    // { label: '음양',   sub: '획수 홀짝', grade: eumyangGrade },  // [BACKLOG] 5축
  ];

  // 종합 별점 + 점수 근거 — 사용자가 별의 출처를 직접 보고 납득하도록
  const rating = computeStarRating(axes.map(a => a.grade));
  // 100점 정량 점수 + 종합 등급 (청월당 스타일)
  const { score, tier, axisScores } = computeScore(axes.map(a => a.grade));

  return (
    <div
      className="rounded-2xl p-4 border mb-3"
      style={{
        background: 'linear-gradient(135deg, rgba(20,12,38,0.65) 0%, rgba(124,92,252,0.10) 50%, rgba(20,12,38,0.55) 100%)',
        borderColor: 'rgba(124,92,252,0.30)',
      }}
    >
      {/* 종합 점수 카드 — 큰 숫자 + 등급 칩 + 별점 */}
      <div
        className="rounded-2xl p-4 mb-3 border flex items-center gap-4"
        style={{
          background: `linear-gradient(135deg, ${tier.bg} 0%, rgba(20,12,38,0.4) 100%)`,
          borderColor: tier.border,
        }}
      >
        {/* 큰 점수 */}
        <div className="flex flex-col items-center shrink-0">
          <div className="flex items-baseline gap-0.5 leading-none">
            <span
              className="text-[42px] font-bold leading-none"
              style={{ color: tier.color, fontFamily: 'var(--font-serif)' }}
            >
              {score}
            </span>
            <span
              className="text-[16px] font-semibold leading-none"
              style={{ color: tier.color, opacity: 0.7 }}
            >
              /100
            </span>
          </div>
          <span
            className="text-[10px] text-text-tertiary mt-1"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            4축 종합 점수
          </span>
        </div>
        {/* 등급 + 별점 + 분포 */}
        <div className="flex flex-col flex-1 min-w-0 gap-1.5">
          <span
            className="text-[15px] font-bold px-2.5 py-1 rounded-md self-start"
            style={{
              color: tier.color,
              background: tier.bg,
              border: `1px solid ${tier.border}`,
              fontFamily: 'var(--font-title)',
            }}
          >
            {tier.label}
          </span>
          <div className="flex gap-0.5">
            {[0, 1, 2, 3, 4].map(i => (
              <span
                key={i}
                className="text-[16px] leading-none"
                style={{ color: i < rating.stars ? '#FBBF24' : 'rgba(255,255,255,0.18)' }}
              >
                ★
              </span>
            ))}
          </div>
          {rating.analyzedCount > 0 ? (
            <span
              className="text-[12px] text-text-secondary leading-tight"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              보강 {rating.bonusCount} · 중립 {rating.neutralCount} · 거스름 {rating.penaltyCount}
            </span>
          ) : (
            <span className="text-[12px] text-text-secondary leading-tight" style={{ fontFamily: 'var(--font-body)' }}>
              한자 정보가 없어 음령만 분석돼요
            </span>
          )}
        </div>
      </div>

      {/* 사주 오행 분포 — 청월당 스타일 5칸 그리드 (용신·기신·일주 강조) */}
      {sajuElementCount && (
        <div
          className="rounded-xl p-3 mb-3 border"
          style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-baseline justify-between mb-2">
            <span
              className="text-[13px] font-bold"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}
            >
              내 사주 오행 분포
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {(['목', '화', '토', '금', '수'] as const).map((el) => {
              const cnt = sajuElementCount[el] ?? 0;
              const color = ELEMENT_COLOR[el];
              const bg = ELEMENT_BG[el];
              const isYong = el === yongSinEl;
              const isGi = el === giSinEl;
              const isDay = el === dayMasterElement;
              return (
                <div
                  key={el}
                  className="flex flex-col items-center justify-center rounded-lg px-1 py-2 border"
                  style={{
                    background: bg,
                    borderColor: isYong
                      ? 'rgba(52,211,153,0.5)'
                      : isGi
                        ? 'rgba(248,113,113,0.5)'
                        : `${color}55`,
                    boxShadow: isYong ? '0 0 8px rgba(52,211,153,0.18)' : 'none',
                  }}
                >
                  <span
                    className="text-[15px] font-bold leading-tight"
                    style={{ color, fontFamily: 'var(--font-serif)' }}
                  >
                    {el}
                  </span>
                  <span
                    className="text-[15px] font-bold leading-tight mt-0.5"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}
                  >
                    {cnt}
                  </span>
                  <span
                    className="text-[9px] font-bold mt-0.5 leading-none whitespace-nowrap"
                    style={{
                      color: isYong
                        ? '#34D399'
                        : isGi
                          ? '#F87171'
                          : isDay
                            ? '#FBBF24'
                            : 'transparent',
                    }}
                  >
                    {isYong ? '용신' : isGi ? '기신' : isDay ? '일주' : '·'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4축 등급칩 + 축별 점수 — 박스 좁아도 줄바꿈 방지 (whitespace-nowrap) */}
      <div className="grid grid-cols-4 gap-1.5">
        {axes.map((a, i) => {
          const badge = GRADE_BADGE[a.grade];
          return (
            <div
              key={i}
              className="rounded-xl px-1.5 py-2.5 flex flex-col items-center justify-center border"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <span
                className="text-[14px] font-bold mb-0.5 whitespace-nowrap"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}
              >
                {a.label}
              </span>
              <span
                className="text-[11px] text-text-tertiary mb-1 text-center leading-tight whitespace-nowrap"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {a.sub}
              </span>
              <span
                className="text-[12px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap mb-1"
                style={{
                  background: badge.bg,
                  color: badge.fg,
                  border: `1px solid ${badge.border}`,
                }}
              >
                {badge.label}
              </span>
              <span
                className="text-[11px] font-semibold whitespace-nowrap"
                style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', opacity: 0.85 }}
              >
                {axisScores[i] % 1 === 0 ? axisScores[i] : axisScores[i].toFixed(1)}<span className="opacity-50">/25</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* 등급 의미 안내 — 한 줄에 컬러 키 + 설명 (모바일 좁은 폭에서 줄바꿈 자연스럽게) */}
      <div
        className="mt-3 pt-3 space-y-1.5 text-[13px] text-text-secondary leading-[1.55] border-t"
        style={{ borderColor: 'rgba(255,255,255,0.08)', fontFamily: 'var(--font-body)' }}
      >
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-[14px] shrink-0" style={{ color: '#34D399' }}>보강</span>
          <span>사주 용신을 도와줘요</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-[14px] shrink-0" style={{ color: '#CBD5E1' }}>중립</span>
          <span>도움도 거스름도 약해요</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-[14px] shrink-0" style={{ color: '#F87171' }}>거스름</span>
          <span>사주 기신을 자극해요</span>
        </div>
      </div>

      {!isHanjaMode && (
        <p
          className="text-[13px] text-text-tertiary text-center mt-3 leading-[1.6]"
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
/**
 * 5오행 의미 nuance — fallback 시그널에 결의 결을 풍부하게 안내할 때 활용.
 * 너무 추상적이지 않게 일상 영역에서의 결을 한 줄로.
 */
const ELEMENT_STRENGTH_NUANCE: Record<string, string> = {
  '목': '성장과 뻗어나가는 의지',
  '화': '표현과 따뜻한 열정',
  '토': '안정과 중심을 잡는 신뢰',
  '금': '결단력과 정밀한 판단',
  '수': '깊은 사유와 유연한 적응',
};

/**
 * 이름의 강점 신호 추출 — 음령·자원·분포 3축에서 사주 용신 매칭 결을 자동 분석.
 * 단순 매칭 여부만이 아니라 "어느 글자/한자에 어떤 강점이 깃들어 있는지" 구체 묘사.
 *
 * fallback (직접 매칭 0 케이스) 도 빈약한 메시지 대신
 * 음령 dominant 오행 → 5오행 의미 → 본문 연결 안내로 신뢰감 톤 유지.
 */
function buildStrengthSignals(
  yongSinEl: string,
  eumElements: string[],
  jawonElements: string[],
  chars: string[],
  hanjas: Array<{ char: string; jawon: string }>,
): Array<{ headline: string; detail: string }> {
  const out: Array<{ headline: string; detail: string }> = [];

  // 1. 음령 용신 매칭 — 어느 한글 음절(들)에 용신 오행이 깃들어 있는지
  if (yongSinEl && eumElements.includes(yongSinEl)) {
    const matchingChars = chars
      .map((c, i) => (eumElements[i] === yongSinEl ? c : null))
      .filter((c): c is string => !!c);
    out.push({
      headline: `이름 발음에 용신 ${yongSinEl} 오행이 들어있어요`,
      detail: matchingChars.length > 0
        ? `"${matchingChars.join('·')}" 글자의 한글 초성이 ${yongSinEl} 오행이라 부를 때마다 사주의 부족한 기운을 보태줘요.`
        : `한글 발음이 사주에서 가장 필요한 ${yongSinEl} 오행을 보강해요.`,
    });
  }

  // 2. 자원오행 용신 매칭 — 어느 한자(들)의 부수가 용신 오행인지
  if (yongSinEl && hanjas.length > 0) {
    const matching = hanjas.filter(h => h.jawon === yongSinEl);
    if (matching.length > 0) {
      out.push({
        headline: `한자 부수에 용신 ${yongSinEl} 오행이 들어있어요`,
        detail: `한자 "${matching.map(h => h.char).join('·')}"의 부수가 ${yongSinEl} 오행이라 사주의 부족한 기운을 한자 차원에서도 받쳐줘요.`,
      });
    }
  }

  // 3. 음령 분포 균형 — 5오행 중 3개 이상에 골고루 흩어진 이름
  const eumDistinct = new Set(eumElements.filter(Boolean)).size;
  if (eumDistinct >= 3) {
    out.push({
      headline: `이름 발음에 ${eumDistinct}가지 오행이 골고루 깔려요`,
      detail: `한 기운에 쏠리지 않고 여러 영역의 결을 균형 있게 품은 이름이에요. 어느 한 영역으로 치우치지 않아 다양한 상황에 안정적으로 흐르기 좋아요.`,
    });
  }

  // 4. fallback — 직접 용신 매칭이 없을 때는 이름 발음의 우세 오행 결로 강점 안내
  if (out.length === 0) {
    const eumCounts: Record<string, number> = {};
    eumElements.forEach(e => { if (e) eumCounts[e] = (eumCounts[e] ?? 0) + 1; });
    const sorted = Object.entries(eumCounts).sort((a, b) => b[1] - a[1]);
    const dominant = sorted[0]?.[0];

    if (dominant && ELEMENT_STRENGTH_NUANCE[dominant]) {
      out.push({
        headline: `이름 발음에 ${dominant} 기운이 우세해요`,
        detail: `한글 초성을 5오행으로 봤을 때 ${dominant} 오행이 가장 많이 깔려 있어요. 이는 ${ELEMENT_STRENGTH_NUANCE[dominant]}의 결을 일상에 스며들게 해줘요.`,
      });
    } else {
      out.push({
        headline: '이름의 깊은 강점은 본문에서 다뤘어요',
        detail: '시각 카드는 4축의 직접 매칭만 자동 추출해요. 위 본문 풀이에 사주와 이름이 어떻게 어울리는지 결을 자세히 풀어드렸어요.',
      });
    }
  }

  return out;
}

/**
 * 이름의 약점·주의 신호 추출 — 음령·자원·편중 3축에서 사주 기신 자극 결을 자동 분석.
 */
function buildShadowSignals(
  giSinEl: string | undefined,
  eumElements: string[],
  jawonElements: string[],
  chars: string[],
  hanjas: Array<{ char: string; jawon: string }>,
): Array<{ headline: string; detail: string }> {
  const out: Array<{ headline: string; detail: string }> = [];

  // 1. 음령 기신 매칭
  if (giSinEl && eumElements.includes(giSinEl)) {
    const matchingChars = chars
      .map((c, i) => (eumElements[i] === giSinEl ? c : null))
      .filter((c): c is string => !!c);
    out.push({
      headline: `이름 발음에 기신 ${giSinEl} 오행이 들어있어요`,
      detail: matchingChars.length > 0
        ? `"${matchingChars.join('·')}" 글자의 한글 초성이 ${giSinEl} 오행이라 부를 때마다 사주에서 주의해야 할 기운을 자극해 마찰이 생길 수 있어요.`
        : `한글 발음이 사주에서 주의해야 할 ${giSinEl} 오행을 자극해 마찰이 생길 수 있어요.`,
    });
  }

  // 2. 자원오행 기신 매칭
  if (giSinEl && hanjas.length > 0) {
    const matching = hanjas.filter(h => h.jawon === giSinEl);
    if (matching.length > 0) {
      out.push({
        headline: `한자 부수에 기신 ${giSinEl} 오행이 들어있어요`,
        detail: `한자 "${matching.map(h => h.char).join('·')}"의 부수가 ${giSinEl} 오행이라 사주의 주의 영역을 한자 차원에서도 자극해요.`,
      });
    }
  }

  // 3. 음령 편중 — 한 오행에 3개 이상 쏠림
  const eumCounts: Record<string, number> = {};
  eumElements.forEach(e => { if (e) eumCounts[e] = (eumCounts[e] ?? 0) + 1; });
  const entries = Object.entries(eumCounts);
  const maxEntry = entries.reduce<[string, number] | null>(
    (best, cur) => (best === null || cur[1] > best[1] ? cur : best),
    null,
  );
  if (maxEntry && maxEntry[1] >= 3) {
    out.push({
      headline: `이름 발음이 ${maxEntry[0]} 한 기운에 치우쳐 있어요`,
      detail: `초성 ${maxEntry[1]}개가 모두 ${maxEntry[0]} 오행이라 한 영역만 강하게 흐르고 다른 영역의 결은 부족해요. 균형이 한쪽으로 쏠려 보일 수 있어요.`,
    });
  }

  // 4. fallback — 직접 기신 매칭이 없을 때도 신뢰감 톤 + 본문 안내
  if (out.length === 0) {
    out.push({
      headline: '사주와 큰 마찰은 없어요',
      detail: giSinEl
        ? `사주에서 가장 주의해야 할 오행은 ${giSinEl}이지만, 다행히 이 이름의 발음·한자 부수 어디에도 ${giSinEl} 오행 글자가 들어있지 않아 큰 충돌은 없는 흐름이에요.`
        : '시각 카드 기준 직접 자극되는 자리는 없어요. 큰 부담 없이 흐르는 이름이에요.',
    });
    out.push({
      headline: '미세한 그늘은 본문에서 짚어드려요',
      detail: '4축 시각 카드는 명확한 매칭만 자동 추출해요. 일상에서 무심코 새어 나오는 약점·주의 결은 위 본문 풀이에서 자세히 분석해 드렸어요.',
    });
  }

  return out;
}

export function StrengthVisual({
  yongSinEl,
  eumElements,
  jawonElements,
  chars,
  hanjas,
}: {
  yongSinEl: string;
  eumElements: string[];
  jawonElements: string[];
  chars: string[];
  hanjas: Array<{ char: string; jawon: string }>;
}) {
  const signals = buildStrengthSignals(yongSinEl, eumElements, jawonElements, chars, hanjas);
  return (
    <div
      className="rounded-2xl p-4 border mb-3"
      style={{ background: 'rgba(52,211,153,0.06)', borderColor: 'rgba(52,211,153,0.30)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[17px] font-bold" style={{ color: '#34D399' }}>이름의 강점 신호</span>
      </div>
      <ul className="space-y-3">
        {signals.map((s, i) => (
          <li
            key={i}
            className="leading-[1.65] tracking-[-0.005em]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <div className="text-[16px] font-bold text-text-primary mb-1">{s.headline}</div>
            <div className="text-[15px] text-text-secondary">{s.detail}</div>
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
  chars,
  hanjas,
}: {
  giSinEl?: string;
  eumElements: string[];
  jawonElements: string[];
  chars: string[];
  hanjas: Array<{ char: string; jawon: string }>;
}) {
  const signals = buildShadowSignals(giSinEl, eumElements, jawonElements, chars, hanjas);
  return (
    <div
      className="rounded-2xl p-4 border mb-3"
      style={{ background: 'rgba(248,113,113,0.06)', borderColor: 'rgba(248,113,113,0.30)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[17px] font-bold" style={{ color: '#F87171' }}>주의 신호</span>
      </div>
      <ul className="space-y-3">
        {signals.map((s, i) => (
          <li
            key={i}
            className="leading-[1.65] tracking-[-0.005em]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <div className="text-[16px] font-bold text-text-primary mb-1">{s.headline}</div>
            <div className="text-[15px] text-text-secondary">{s.detail}</div>
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
// 4a) 수리오행 — 4격 끝자리 오행만 작은 칩으로 (NumerologyVisual 의 81수리 4격
//     큰 카드와 분리해서 four_axis 섹션의 "수리오행 파티션" 에 사용)
// ─────────────────────────────────────────────────────────────────────────────
export function SuriElementVisual({
  chars,
  sounds,
  yongSinEl,
  giSinEl,
  hideCaptionTitle = false,
  surnameLength = 1,
}: {
  chars: string[];
  sounds: string[];
  yongSinEl?: string;
  giSinEl?: string;
  hideCaptionTitle?: boolean;
  surnameLength?: 1 | 2;
}) {
  const result = calc4Gyeok(chars, sounds, surnameLength);
  if (!result) return null;
  const items = [
    { label: '원격', area: '초년',         data: result.won },
    { label: '형격', area: '중년',         data: result.hyeong },
    { label: '이격', area: '사회',         data: result.i },
    { label: '정격', area: '평생',         data: result.jeong },
  ];
  return (
    <div className="mb-3">
      <VisualCaption
        title="수리오행"
        desc="4격 끝자리 숫자가 어떤 오행인지 표시해요. 용신 오행과 맞물리면 사주를 보강해요."
        hideTitle={hideCaptionTitle}
      />
    <div className="grid grid-cols-4 gap-2">
      {items.map((it, i) => {
        const elKor = SURI_ELEMENT_KOREAN[it.data.entry.element] ?? '';
        const color = ELEMENT_COLOR[elKor] ?? '#CBD5E1';
        const bg = ELEMENT_BG[elKor] ?? 'rgba(255,255,255,0.04)';
        const isYong = !!yongSinEl && elKor === yongSinEl;
        const isGi = !!giSinEl && elKor === giSinEl;
        return (
          <div
            key={i}
            className="rounded-xl p-2.5 flex flex-col items-center border"
            style={{ background: bg, borderColor: `${color}55` }}
          >
            <span
              className="text-[13px] font-bold mb-0.5"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}
            >
              {it.label}
            </span>
            <span className="text-[10px] text-text-tertiary mb-1.5">{it.area}</span>
            <span
              className="text-[16px] font-bold"
              style={{ color, fontFamily: 'var(--font-serif)' }}
            >
              {elKor || '?'}
            </span>
            {(isYong || isGi) && (
              <span
                className="text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded"
                style={{
                  color: isYong ? '#34D399' : '#F87171',
                  background: isYong ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                }}
              >
                {isYong ? '용신' : '기신'}
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
// 4b) 수리 음양 — 한자 획수 홀짝 = 양/음 배열 + 균형 평가
// ─────────────────────────────────────────────────────────────────────────────
export function EumYangVisual({
  hanjas,
  hideCaptionTitle = false,
}: {
  hanjas: Array<{ char: string; strokes: number }>;
  hideCaptionTitle?: boolean;
}) {
  if (hanjas.length === 0) return null;
  const items = hanjas.map(h => ({ char: h.char, strokes: h.strokes, eumyang: h.strokes % 2 === 1 ? '양' : '음' as '양' | '음' }));
  const yangCount = items.filter(i => i.eumyang === '양').length;
  const eumCount = items.length - yangCount;
  const balanced = Math.abs(yangCount - eumCount) <= Math.max(1, Math.floor(items.length / 2));
  const verdict = items.length === 0
    ? { label: '분석 불가', color: '#94A3B8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.30)' }
    : yangCount === items.length
      ? { label: '양 편중', color: '#F87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.30)' }
      : eumCount === items.length
        ? { label: '음 편중', color: '#3B82F6', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.30)' }
        : balanced
          ? { label: '음양 균형', color: '#34D399', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.30)' }
          : { label: '한쪽 우세', color: '#FCD34D', bg: 'rgba(252,211,77,0.10)', border: 'rgba(252,211,77,0.30)' };

  return (
    <div className="mb-3 space-y-3">
      <VisualCaption
        title="수리 음양"
        desc="한자 획수의 홀짝으로 음양을 봐요. 홀수=양(밝음·움직임), 짝수=음(고요·안정). 두 결이 어우러질 때 균형이 좋아요."
        hideTitle={hideCaptionTitle}
      />
      {/* 한자별 양/음 칩 */}
      <div className="flex flex-wrap gap-2 justify-center">
        {items.map((it, i) => {
          const isYang = it.eumyang === '양';
          const color = isYang ? '#F59E0B' : '#60A5FA';
          const bg = isYang ? 'rgba(245,158,11,0.10)' : 'rgba(96,165,250,0.10)';
          return (
            <div
              key={i}
              className="flex flex-col items-center justify-center px-3 py-2.5 rounded-xl border"
              style={{ background: bg, borderColor: `${color}55`, minWidth: 60 }}
            >
              <span className="text-[22px] font-bold leading-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>{it.char}</span>
              <span className="text-[11px] text-text-tertiary mt-0.5">{it.strokes}획</span>
              <span className="text-[13px] font-bold mt-0.5" style={{ color }}>{it.eumyang}</span>
            </div>
          );
        })}
      </div>
      {/* 음양 분포 + 종합 평가 */}
      <div className="rounded-xl p-3 bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[13px] text-text-secondary" style={{ fontFamily: 'var(--font-body)' }}>
          <span><span className="font-bold" style={{ color: '#F59E0B' }}>양</span> {yangCount}</span>
          <span className="text-text-tertiary">·</span>
          <span><span className="font-bold" style={{ color: '#60A5FA' }}>음</span> {eumCount}</span>
        </div>
        <span
          className="text-[12px] font-bold px-2 py-1 rounded-md whitespace-nowrap"
          style={{ background: verdict.bg, color: verdict.color, border: `1px solid ${verdict.border}` }}
        >
          {verdict.label}
        </span>
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
  hideCaptionTitle = false,
  surnameLength = 1,
}: {
  chars: string[]; // 한자
  sounds: string[]; // 한국 음
  /** 사주 용신 오행 (한글: '목'/'화'/'토'/'금'/'수') — 수리오행 매칭 강조용 */
  yongSinEl?: string;
  giSinEl?: string;
  hideCaptionTitle?: boolean;
  surnameLength?: 1 | 2;
}) {
  const result = calc4Gyeok(chars, sounds, surnameLength);
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
        desc="한자 획수로 보는 인생 4단계(초년·중년·사회·평생) 길흉입니다. 등급과 수리오행이 사주 용신과 맞물리는지 표시돼요."
        hideTitle={hideCaptionTitle}
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

            {/* 우측: 칩 줄 (등급·수리) + 명칭 줄 (한자·한글) + 의미 줄
               ★ 좁은 박스에서 "한자명 (한글)" 이 칩 옆에 같이 wrap 되면서 "(건창수)"
                 같이 괄호만 떨어져 보이던 문제. 명칭을 칩 줄에서 분리해 별도 줄로 둠. */}
            <div className="flex-1 min-w-0">
              {/* 첫째 줄 — 등급 칩 + 수리오행 칩 */}
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
                      className="text-[11px] font-bold px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 whitespace-nowrap"
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
              </div>
              {/* 둘째 줄 — 한자명 + 한글 풀이 (좁은 박스에서도 함께 wrap 자연스럽게) */}
              <div className="mb-1.5 leading-snug">
                <span
                  className="text-[15px] font-bold mr-1.5"
                  style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}
                >
                  {it.data.entry.name}
                </span>
                {SURI_NAME_KOREAN[it.data.entry.name] && (
                  <span
                    className="text-[12px] text-text-tertiary whitespace-nowrap"
                    style={{ fontFamily: 'var(--font-body)', letterSpacing: '-0.005em' }}
                  >
                    ({SURI_NAME_KOREAN[it.data.entry.name]})
                  </span>
                )}
              </div>
              {/* 셋째 줄 — 의미 본문 */}
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
      {/* 헤더만 표시 (desc 제거 — "본문에서 추출한 실천 항목입니다" 문구 빠짐) */}
      <div
        className="text-[16px] font-bold mb-3 pl-0.5"
        style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)', letterSpacing: '0.01em' }}
      >
        실천 가이드
      </div>
      <div className="space-y-2">
        {bullets.map((b, i) => (
          <div
            key={i}
            className="rounded-xl p-4 bg-white/[0.04] border border-white/10"
          >
            {/* 번호 칩 — 한 줄 단독 (상단). 본문은 그 아래 전체 너비로 흘려 들여쓰기 회피 */}
            <div
              className="inline-flex items-center justify-center text-[13px] font-bold text-cta mb-2 px-2.5 py-0.5 rounded-md"
              style={{ background: 'rgba(124,92,252,0.15)', border: '1px solid rgba(124,92,252,0.40)' }}
            >
              {i + 1}
            </div>
            <div
              className="text-[17px] text-text-secondary leading-[1.75] tracking-[-0.005em]"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {b}
            </div>
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
