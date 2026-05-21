/**
 * 토정비결 144괘 엔트리 테이블
 *
 * 전통 토정비결은 상괘(8) × 중괘(6) × 하괘(3) = 144괘이며,
 * 각 괘마다 고유한 4자 표제(예: 靑龍得水), 점사, 월별 운이 정해져 있다.
 *
 * 원전 전문을 그대로 옮기려면 저작권/수집 작업이 크므로,
 * 이 파일은 각 괘의 "구조적 의미"를 결정론적 규칙으로 합성한다:
 *   - 상괘(팔괘) 기본 성질
 *   - 중괘(효 위치) 발전 단계
 *   - 하괘(天地人) 영역
 *
 * 합성된 엔트리는 불변(순수 함수 출력)이며, 프롬프트 주입 시 AI가
 * 이 틀을 벗어난 길흉을 창작하지 않도록 제약 역할을 한다.
 *
 */

import { getHanjaSa } from './gwae-hanja';

export type GwaeGrade =
  | '대길'
  | '길'
  | '중길'
  | '평'
  | '중흉'
  | '흉'
  | '대흉';

export interface GwaeEntry {
  gwaeNumber: number; // 예: 815
  upper: number; // 1~8
  middle: number; // 1~6
  lower: number; // 1~3
  grade: GwaeGrade;
  score: number; // 조합 점수 (내부 참고용)
  headline: string; // 예: "건(乾) × 오효 × 인(人) — 정점에서 인연을 만나다"
  keywords: string[]; // 3~5개
  summary: string; // 2~3문장 총평
  monthlyHints: string[]; // 12개월 키워드
  /**
   * 4영역 mood 키워드 — 같은 등급이어도 영역별 차등을 만들어주는 결정론적 키워드.
   * 토정비결 144괘 × 4영역 = 576개 무드를 sang 오행 + jung 효위치 + ha 영역 + grade 휴리스틱으로 자동 합성.
   * AI 가 영역별로 동일 톤만 반복하는 사고("중흉·중흉·중흉" 반복)를 차단하기 위해 prompt 에 영역별로 주입.
   */
  domainMoods: {
    wealth: string;  // 재물 무드 (sang 오행 + ha 가중)
    love: string;    // 애정·가정 무드 (sang 친화도 + jung 효위치)
    health: string;  // 건강 무드 (sang 오행 → 장부 매핑)
    career: string;  // 직장·학업 무드 (jung 발전 단계 중심)
  };
  hanjaSa?: {
    title: string;       // 4자 한문 표제
    lines: string[];     // 7언 한문 구절 2줄
    translation: string; // 한국어 번역
  };
}

// ============================================
// 상괘(8괘) 기본 메타 + 점수
// ============================================

interface SangMeta {
  num: number;
  name: string; // 건/태/리/진/손/감/간/곤
  hanja: string;
  symbol: string;
  element: string;
  score: number; // 기본 길흉 성향
  keywords: string[];
  essence: string;
}

const SANG: SangMeta[] = [
  { num: 1, name: '건', hanja: '乾', symbol: '☰', element: '金', score: 3, keywords: ['강건', '리더', '창조'], essence: '하늘의 기운 — 강건한 출발과 리더십' },
  { num: 2, name: '태', hanja: '兌', symbol: '☱', element: '金', score: 2, keywords: ['기쁨', '교류', '언변'], essence: '연못의 기운 — 기쁨과 교류' },
  { num: 3, name: '리', hanja: '離', symbol: '☲', element: '火', score: 2, keywords: ['밝음', '명예', '열정'], essence: '불의 기운 — 밝음과 명예' },
  { num: 4, name: '진', hanja: '震', symbol: '☳', element: '木', score: 0, keywords: ['변동', '추진', '충격'], essence: '우레의 기운 — 움직임과 변화' },
  { num: 5, name: '손', hanja: '巽', symbol: '☴', element: '木', score: 1, keywords: ['유연', '전파', '소통'], essence: '바람의 기운 — 부드럽게 스며듦' },
  { num: 6, name: '감', hanja: '坎', symbol: '☵', element: '水', score: -2, keywords: ['험난', '인내', '지혜'], essence: '물의 기운 — 어려움 속의 지혜' },
  { num: 7, name: '간', hanja: '艮', symbol: '☶', element: '土', score: 0, keywords: ['멈춤', '신중', '축적'], essence: '산의 기운 — 멈춰 다지는 때' },
  { num: 8, name: '곤', hanja: '坤', symbol: '☷', element: '土', score: 1, keywords: ['포용', '수용', '결실'], essence: '땅의 기운 — 포용과 결실' },
];

// ============================================
// 중괘(효 위치) 메타 + 점수
// ============================================

interface JungMeta {
  num: number;
  name: string; // 초효/이효/삼효/사효/오효/상효
  score: number;
  stage: string; // 발전 단계
  keywords: string[];
}

const JUNG: JungMeta[] = [
  { num: 1, name: '초효(初爻)', score: 0, stage: '잠재·시작', keywords: ['시작', '준비', '씨앗'] },
  { num: 2, name: '이효(二爻)', score: 1, stage: '기반 다짐', keywords: ['기반', '안정', '내실'] },
  { num: 3, name: '삼효(三爻)', score: -2, stage: '과도기·시험', keywords: ['시험', '전환', '주의'] },
  { num: 4, name: '사효(四爻)', score: 1, stage: '외부 확장', keywords: ['활동', '확장', '도약'] },
  { num: 5, name: '오효(五爻)', score: 2, stage: '정점·성취', keywords: ['성취', '정점', '결실'] },
  { num: 6, name: '상효(上爻)', score: -1, stage: '완성 혹은 쇠퇴', keywords: ['마무리', '전환', '돌아봄'] },
];

// ============================================
// 하괘(天地人) 메타
// ============================================

interface HaMeta {
  num: number;
  name: string; // 天/地/人
  score: number;
  domain: string;
  keywords: string[];
}

const HA: HaMeta[] = [
  { num: 1, name: '天(천)', score: 0, domain: '시운·외부 환경', keywords: ['환경', '시운', '흐름'] },
  { num: 2, name: '地(지)', score: 1, domain: '물질·기반·재물', keywords: ['재물', '기반', '실물'] },
  { num: 3, name: '人(인)', score: 0, domain: '인연·관계', keywords: ['인연', '협력', '사람'] },
];

// ============================================
// 점수 → 등급 매핑
// ============================================

function scoreToGrade(score: number): GwaeGrade {
  if (score >= 5) return '대길';
  if (score >= 3) return '길';
  if (score >= 1) return '중길';
  if (score === 0) return '평';
  if (score >= -2) return '중흉';
  if (score >= -4) return '흉';
  return '대흉';
}

// ============================================
// 월별 힌트 생성
//   상괘 성질(+score)을 기준으로 12개월 리듬을 변주
// ============================================

function buildMonthlyHints(sang: SangMeta, jung: JungMeta): string[] {
  // 12개월 대강의 리듬 템플릿
  // 사용자에게는 단순 키워드로만 주어지며, AI가 이를 바탕으로 문장을 만든다
  const base = sang.keywords;
  const peakMonth = jung.num === 5 ? 5 : jung.num === 2 ? 3 : jung.num * 2;
  const riskMonth = jung.num === 3 ? 7 : jung.num === 6 ? 11 : (jung.num + 3) % 12 || 12;

  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    if (m === peakMonth) return `${base[0]}·상승`;
    if (m === riskMonth) return `주의·${sang.element === '水' ? '인내' : '신중'}`;
    if (sang.score >= 2) {
      return m % 3 === 0 ? '전진·활동' : m % 3 === 1 ? '안정·축적' : '유지·보완';
    }
    if (sang.score <= -1) {
      return m % 3 === 0 ? '내실·보수' : m % 3 === 1 ? '지연·조심' : '재정비';
    }
    return m % 3 === 0 ? '보통·평온' : m % 3 === 1 ? '기다림' : '작은 기회';
  });
}

// ============================================
// 4영역 무드 합성 — sang 오행 + jung 효위치 + ha 영역 + grade
//   "같은 괘 = 같은 등급" 의 토정비결 정통성은 유지하되,
//   각 영역에 다른 키워드·다른 강조점을 부여해 풀이가 영역별로 색깔이 나뉘도록 한다.
//   AI 는 이 키워드를 자연어로 풀어쓰기만 — 환각 차단.
// ============================================

function buildDomainMoods(
  sang: SangMeta,
  jung: JungMeta,
  ha: HaMeta,
  grade: GwaeGrade,
): GwaeEntry['domainMoods'] {
  const isUpper = grade === '대길' || grade === '길';
  const isMid = grade === '중길' || grade === '평';
  const isLower = !isUpper && !isMid; // 중흉·흉·대흉
  const isPeak = jung.num === 5;
  const isTest = jung.num === 3;
  const isStart = jung.num === 1;

  // ── 재물 — sang 오행 + ha 영역 ──
  const wealth = (() => {
    const sangElTone =
      sang.element === '木' ? '확장·새 사업 투자기'
      : sang.element === '火' ? '명예·평판이 수익으로 이어지는 흐름'
      : sang.element === '土' ? '축적·부동산·실물 자산'
      : sang.element === '金' ? '결실·매듭·정리 수익'
      : sang.element === '水' ? '유동성·이동 자금·현금 흐름'
      : '확장과 손실이 함께하니 큰 거래는 주의';
    const haGain =
      ha.num === 2 ? '재물 무대가 정면에 섬'
      : ha.num === 3 ? '인연·소개로 들어오는 수입'
      : '시운·외부 흐름에 따라 변동';
    if (isUpper) return `${sangElTone}, ${haGain}, 들어오는 흐름 우세`;
    if (isMid) return `${sangElTone}, ${haGain}, 무리 없는 보수 운영`;
    return `${sangElTone}, ${haGain}, 새는 지출 단속 + 큰 거래 보류`;
  })();

  // ── 애정·가정 — sang 친화도 + jung 효위치 ──
  const love = (() => {
    const sangLove =
      sang.num === 2 ? '따뜻한 교류와 즐거운 만남'           // 兌
      : sang.num === 3 ? '명예·매력 발산, 새 사람 시선'      // 離
      : sang.num === 6 ? '소통 정체, 오해 쌓임 주의'         // 坎
      : sang.num === 7 ? '잠시 거리 두고 자기 정리'          // 艮
      : sang.num === 8 ? '안정·포용, 가정의 결실'            // 坤
      : sang.num === 1 ? '주도적 결단·청혼·고백 시기'        // 乾
      : sang.num === 4 ? '갑작스러운 변동·이별 또는 새 인연'  // 震
      : '부드러운 교감·은근한 끌림';                        // 巽
    if (isPeak) return `${sangLove}, 결혼·동거·약속 같은 결단 분기점`;
    if (isTest) return `${sangLove}, 관계 시험기 — 갈등·오해 발생 가능`;
    if (isStart) return `${sangLove}, 새 인연의 씨앗이 뿌려지는 시기`;
    if (isUpper) return `${sangLove}, 새 인연 흐름 + 기존 관계 깊어짐`;
    if (isMid) return `${sangLove}, 있는 인연 다지고 작은 다툼 봉합`;
    return `${sangLove}, 말 한마디 조심 + 가족 건강·재정 챙기기`;
  })();

  // ── 건강 — sang 오행 → 장부 매핑 + 등급 ──
  const health = (() => {
    const organ =
      sang.element === '木' ? '간·근육·눈'
      : sang.element === '火' ? '심장·순환·혈압'
      : sang.element === '土' ? '비위·소화·체중'
      : sang.element === '金' ? '폐·기관지·피부'
      : '신장·허리·하체';
    const season =
      sang.element === '木' ? '봄철'
      : sang.element === '火' ? '여름철'
      : sang.element === '土' ? '환절기'
      : sang.element === '金' ? '가을철'
      : '겨울철';
    if (isUpper) return `${organ} 활기, ${season} 과로만 단속`;
    if (isMid) return `${organ} 무난, ${season} 환절기 기본 관리`;
    if (isTest) return `${organ} 시험기, ${season} 환절기 예방 우선`;
    return `${organ} 약화 주의, ${season} 무리 금지와 정기 검진`;
  })();

  // ── 직장·학업 — jung 효위치 중심 + sang 강건성 ──
  const career = (() => {
    const stageTone =
      jung.num === 1 ? '새 시작·기획 준비기'
      : jung.num === 2 ? '기반 다지기·내실 강화'
      : jung.num === 3 ? '평가·시험·이직 시험기'
      : jung.num === 4 ? '외부 확장·도약·발표'
      : jung.num === 5 ? '승진·정점·결실 수확'
      : '마무리·전환·다음 라운드 준비';
    const sangPush =
      sang.score >= 2 ? '추진력 강함'
      : sang.score >= 0 ? '꾸준함이 답'
      : '큰 결정은 보류';
    if (isUpper) return `${stageTone}, ${sangPush}, 기회 적극 잡기`;
    if (isMid) return `${stageTone}, ${sangPush}, 무리 없는 진척`;
    return `${stageTone}, ${sangPush}, 과욕 금물·실수·구설 단속`;
  })();

  return { wealth, love, health, career };
}

// ============================================
// 엔트리 빌더
// ============================================

function buildEntry(upper: number, middle: number, lower: number): GwaeEntry {
  const sang = SANG[upper - 1];
  const jung = JUNG[middle - 1];
  const ha = HA[lower - 1];

  const score = sang.score + jung.score + ha.score;
  const grade = scoreToGrade(score);

  const headline = `${sang.name}(${sang.hanja}) × ${jung.name} × ${ha.name} — ${gradeHeadline(grade, sang, ha)}`;
  const keywords = dedup([...sang.keywords.slice(0, 2), jung.keywords[0], ha.keywords[0]]);

  const summary = buildSummary(sang, jung, ha, grade);

  return {
    gwaeNumber: upper * 100 + middle * 10 + lower,
    upper,
    middle,
    lower,
    grade,
    score,
    headline,
    keywords,
    summary,
    monthlyHints: buildMonthlyHints(sang, jung),
    domainMoods: buildDomainMoods(sang, jung, ha, grade),
  };
}

function gradeHeadline(grade: GwaeGrade, sang: SangMeta, ha: HaMeta): string {
  const gradePart =
    grade === '대길' ? '큰 기운이 활짝 열림'
    : grade === '길' ? '기운이 뻗어나감'
    : grade === '중길' ? '무난히 흐름'
    : grade === '평' ? '담담히 흐름'
    : grade === '중흉' ? '신중히 지나갈 시기'
    : grade === '흉' ? '숨을 고를 시기'
    : '고요히 견디는 시기';
  return `${gradePart} · ${ha.domain}`;
}

function buildSummary(sang: SangMeta, jung: JungMeta, ha: HaMeta, grade: GwaeGrade): string {
  const intro = sang.essence;
  const stage = `지금은 ${jung.stage}의 국면에서 ${ha.domain}이(가) 주요 무대가 된다.`;
  const vibe =
    grade === '대길' || grade === '길'
      ? '흐름을 타면 보람이 크되, 자만하지 말고 인연을 소중히 할 것.'
      : grade === '중길' || grade === '평'
      ? '큰 욕심은 접고 작은 목표를 차곡히 달성하면 좋다.'
      : '무리한 확장보다 기존을 지키며 내실을 다져야 한다.';
  return `${intro}. ${stage} ${vibe}`;
}

function dedup(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

// ============================================
// 메모이즈된 144괘 전체 테이블
// ============================================

const TABLE: Map<number, GwaeEntry> = (() => {
  const map = new Map<number, GwaeEntry>();
  for (let u = 1; u <= 8; u++) {
    for (let m = 1; m <= 6; m++) {
      for (let l = 1; l <= 3; l++) {
        const entry = buildEntry(u, m, l);
        map.set(entry.gwaeNumber, entry);
      }
    }
  }
  return map;
})();

/**
 * 괘 번호 또는 (상/중/하) 인덱스로 엔트리 조회.
 */
export function getGwaeEntry(upper: number, middle: number, lower: number): GwaeEntry {
  const key = upper * 100 + middle * 10 + lower;
  const hit = TABLE.get(key);
  if (!hit) {
    throw new Error(`invalid gwae: ${upper}/${middle}/${lower}`);
  }
  const hanjaSa = getHanjaSa(key);
  return hanjaSa ? { ...hit, hanjaSa } : hit;
}

/** 전체 144괘 엔트리 리스트 (테스트/디버그 용도) */
export function getAllGwaeEntries(): GwaeEntry[] {
  return Array.from(TABLE.values()).sort((a, b) => a.gwaeNumber - b.gwaeNumber);
}
