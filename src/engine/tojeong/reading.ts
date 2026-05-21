/**
 * 토정비결 무료 풀이 합성기
 * - gwae-table 의 구조적 엔트리를 받아 세부 서사를 결정론적으로 생성
 * - AI 없이 완전한 길이의 독립 풀이 문장 생산
 */

import type { TojeongResult } from '../tojeong';
import { getGwaeEntry, type GwaeEntry, type GwaeGrade } from './gwae-table';

export interface TojeongReading {
  entry: GwaeEntry;
  title: string;
  headline: string;
  grade: GwaeGrade;
  paragraphs: string[];    // 총평 문단들
  monthly: { month: number; keyword: string; text: string }[];
  advice: string[];
  warnings: string[];
}

const DIRECTION_FOR_ELEMENT: Record<string, string> = {
  '목': '동쪽', '화': '남쪽', '토': '중앙', '금': '서쪽', '수': '북쪽',
};

const COLOR_FOR_ELEMENT: Record<string, string> = {
  '목': '초록·연두', '화': '빨강·주황', '토': '노랑·베이지', '금': '흰색·은색', '수': '파랑·검정',
};

function gradeTone(grade: GwaeGrade): string {
  return {
    '대길': '활짝 열리는',
    '길': '순풍이 부는',
    '중길': '차분히 흐르는',
    '평': '담담한',
    '중흉': '신중히 돌아갈',
    '흉': '몸을 낮출',
    '대흉': '크게 물러서야 할',
  }[grade];
}

// ────────────────────────────────────────────────
// 월별 본문 생성
//   기존엔 tail 이 1년 등급으로만 정해져 12달이 같은 문장으로 끝나는 문제가 있어,
//   월 키워드별로 톤이 다른 tail 후보군을 두고 월 번호로 회전 사용한다.
// ────────────────────────────────────────────────

const TAIL_BY_KEYWORD: Record<string, string[]> = {
  // ── 평이 흐름군 ───────────────────────────────
  '기다림': [
    '결정을 미루고 정보를 모으는 시기로 활용하세요.',
    '바로 움직이지 말고 신호를 한 번 더 살펴보세요.',
    '준비가 무르익을 때까지 한 박자 늦추는 편이 좋습니다.',
    '서두르지 말고 명분이 분명해질 때를 기다리세요.',
  ],
  '작은 기회': [
    '눈에 띄지 않는 작은 제안에도 귀를 기울여 보세요.',
    '큰 결단보다 사이드 프로젝트나 부수입에 시선을 두세요.',
    '주변에서 들어오는 소소한 권유 중 한두 개는 잡아볼 만합니다.',
    '작게 시작해 흐름을 키우는 달이 됩니다.',
  ],
  '보통·평온': [
    '큰 굴곡 없이 평소 루틴을 지키기 좋은 달입니다.',
    '리듬이 평탄하니 미뤄둔 정비·운동·청소를 마무리하세요.',
    '잔잔히 흘려보내며 마음을 정돈하는 달로 쓰세요.',
    '특별한 도전보다 기존 일을 다듬는 데 시간을 쓰세요.',
  ],
  // ── 양호 흐름군 (sang.score >= 2) ─────────────
  '전진·활동': [
    '미뤄둔 일을 실행으로 옮기기 좋은 달입니다.',
    '체력과 의욕이 받쳐주니 한두 가지에 집중해 밀어붙이세요.',
    '제안·발표·교섭처럼 적극적 행동이 잘 풀리는 시기입니다.',
    '활동량이 늘어도 무리 없이 소화되는 흐름이에요.',
  ],
  '안정·축적': [
    '눈에 띄는 변화보다 차곡차곡 쌓는 달이 됩니다.',
    '저축·실력 축적처럼 미래를 위한 투자에 좋은 시기입니다.',
    '꾸준함이 큰 결과로 돌아오는 달입니다.',
    '관계도 일도 신뢰가 쌓이는 시기로 활용하세요.',
  ],
  '유지·보완': [
    '큰 변화는 미루고 지금 가진 것을 다듬으세요.',
    '구멍 난 부분을 메우는 작업에 시간을 쓰세요.',
    '기존 흐름을 잘 지키는 것이 가장 큰 성과인 달입니다.',
    '약속·일정·관계 관리에서 점수를 얻는 달입니다.',
  ],
  // ── 약한 흐름군 (sang.score <= -1) ─────────────
  '내실·보수': [
    '눈에 보이는 성과보다 내부를 단단히 하는 달입니다.',
    '재정·건강·관계의 기본기를 점검하기 좋은 시기입니다.',
    '확장은 미루고 살림을 빈틈없이 다지세요.',
    '문서·계약·자산을 한번 정리해 두면 큰 도움이 됩니다.',
  ],
  '지연·조심': [
    '일이 예상보다 늦어지더라도 무리하게 끌고 가지 마세요.',
    '계약·금전 거래는 한 번 더 확인하면 손해를 줄입니다.',
    '결정 직전에 한 박자 쉬어가는 신중함이 필요합니다.',
    '사소한 말실수가 일을 더디게 만들 수 있어 표현을 다듬으세요.',
  ],
  '재정비': [
    '흐트러진 일과·관계를 다시 정렬하는 달로 쓰세요.',
    '계획을 점검하고 불필요한 일을 정리할 시기입니다.',
    '구조를 다시 짜면 다음 달부터 흐름이 가벼워집니다.',
    '비워내는 결정이 채우는 결정보다 큰 효과를 봅니다.',
  ],
};

// peakMonth 는 "${sang.keywords[0]}·상승" 형태 — 핵심 키워드가 다양해 키워드별로 못 맞춤
const PEAK_TAILS = [
  '흐름을 적극 활용해 큰 한 걸음을 내딛기 좋은 달입니다.',
  '평소보다 과감히 움직여도 충분히 받쳐주는 시기입니다.',
  '좋은 기회가 압축적으로 들어올 수 있으니 놓치지 마세요.',
  '이 달의 결단이 한 해 흐름을 좌우할 수 있어요.',
];

// riskMonth 는 "주의·인내" 또는 "주의·신중" 형태
const RISK_TAILS = [
  '큰 결정·계약·이동은 다음 달로 미루는 편이 좋습니다.',
  '말과 문서에서 사소한 실수가 큰 손해로 이어질 수 있어요.',
  '낯선 제안·금전 거래는 한 번 더 검증하세요.',
  '이 달은 한 박자 늦추는 것이 결과적으로 빠른 길입니다.',
];

// 키워드 매칭 실패 시 등급 기반 fallback (각 월마다 다르게 회전)
const FALLBACK_POSITIVE = [
  '흐름을 타고 차분히 나아가기 좋은 달입니다.',
  '주변 상황이 우호적으로 풀리는 시기입니다.',
  '결단을 미뤄두지 말고 한 걸음 내딛어 보세요.',
];
const FALLBACK_NEUTRAL = [
  '평소 리듬을 지키며 작은 일을 다듬어 보세요.',
  '큰 변동 없이 일상 페이스를 유지하기 좋은 달입니다.',
  '잔잔하게 흘려보내며 정돈에 시간을 쓰세요.',
];
const FALLBACK_NEGATIVE = [
  '결정은 한 박자 늦추고 안을 단단히 하세요.',
  '욕심을 줄이고 손에 든 것을 잘 지키는 달이에요.',
  '말·돈·이동을 신중히 — 작은 손실을 미리 막는 게 큰 이득입니다.',
];

function pickTail(keyword: string, month: number, grade: GwaeGrade): string {
  if (keyword.endsWith('·상승')) {
    return PEAK_TAILS[month % PEAK_TAILS.length];
  }
  if (keyword.startsWith('주의·')) {
    return RISK_TAILS[month % RISK_TAILS.length];
  }
  const tails = TAIL_BY_KEYWORD[keyword];
  if (tails && tails.length > 0) {
    return tails[month % tails.length];
  }
  if (grade === '대길' || grade === '길' || grade === '중길') {
    return FALLBACK_POSITIVE[month % FALLBACK_POSITIVE.length];
  }
  if (grade === '평') {
    return FALLBACK_NEUTRAL[month % FALLBACK_NEUTRAL.length];
  }
  return FALLBACK_NEGATIVE[month % FALLBACK_NEGATIVE.length];
}

// 마지막 글자에 받침이 있으면 "이", 없으면 "가" — 한국어 조사 규칙
function eunNeun(word: string): '은' | '는' {
  const ch = word.charCodeAt(word.length - 1);
  if (ch < 0xac00 || ch > 0xd7a3) return '는';
  const hasJongseong = (ch - 0xac00) % 28 !== 0;
  return hasJongseong ? '은' : '는';
}

// 첫 문장의 동사·연결도 단조롭지 않게 회전
const HEAD_VARIANTS = [
  (prefix: string, base: string) => `${prefix}${base}의 기운이 돈다.`,
  (prefix: string, base: string) => `${prefix}${base}의 흐름이 두드러진다.`,
  (prefix: string, base: string) => `${prefix}${base}의 결이 강해진다.`,
  (prefix: string, base: string) => `${prefix}${base}${eunNeun(base)} 한 달의 리듬을 끌어간다.`,
];

function buildMonthlyText(month: number, keyword: string, grade: GwaeGrade): string {
  const phrasing: Record<number, string[]> = {
    1: ['한 해의 시작은 ', '정월에는 '],
    2: ['이월의 기운은 ', '겨울 끝자락에 '],
    3: ['봄기운이 오며 ', '삼월에는 '],
    4: ['꽃이 필 무렵 ', '사월에는 '],
    5: ['오월의 기운은 ', '여름을 맞으며 '],
    6: ['반년의 중간 ', '유월에는 '],
    7: ['여름 정점에 ', '칠월에는 '],
    8: ['팔월의 기운은 ', '무더위 끝에 '],
    9: ['가을 초입에 ', '구월에는 '],
    10: ['시월에는 ', '결실의 때에 '],
    11: ['동짓달의 기운은 ', '겨울 초입에 '],
    12: ['한 해를 마무리하는 ', '동지에는 '],
  };
  const prefix = phrasing[month]?.[month % 2] ?? `${month}월에는 `;
  const head = HEAD_VARIANTS[month % HEAD_VARIANTS.length](prefix, keyword);
  const tail = pickTail(keyword, month, grade);
  return `${head} ${tail}`;
}

export function buildTojeongReading(result: TojeongResult): TojeongReading {
  const entry = getGwaeEntry(result.upper, result.middle, result.lower);
  const tone = gradeTone(entry.grade);
  const title = `${result.targetYear}년 ${entry.grade} — ${entry.headline}`;

  const headline =
    entry.grade === '대길' || entry.grade === '길'
      ? `올해는 ${tone} 한 해가 될 기세입니다`
      : entry.grade === '중길' || entry.grade === '평'
      ? `올해는 ${tone} 흐름으로 지나갑니다`
      : `올해는 ${tone} 때 — 몸과 마음을 다스리세요`;

  const upperElement = result.upperGwae.element;
  const lucky = `행운의 방위는 ${DIRECTION_FOR_ELEMENT[upperElement] || '동쪽'}이며, 도움이 되는 색은 ${COLOR_FOR_ELEMENT[upperElement] || '초록'}입니다.`;

  // 문단 3~4개 합성
  const p1 = entry.summary;
  const p2 = `상괘는 ${result.upperGwae.name}(${result.upperGwae.hanja}) — ${result.upperGwae.meaning}. ` +
             `중괘는 ${result.middleGwae.position} — ${result.middleGwae.meaning}. ` +
             `하괘는 ${result.lowerGwae.name} — ${result.lowerGwae.meaning}.`;
  const p3 =
    entry.grade === '대길' || entry.grade === '길'
      ? `전반적으로 기운이 뻗어 나가는 해입니다. 준비한 일을 결행할 수 있으며, 인연과 기회가 스스로 찾아옵니다. 다만 ${entry.keywords[0]}의 흐름이 강해 자신감이 지나쳐 독주하지 않도록 주의하세요.`
      : entry.grade === '중길' || entry.grade === '평'
      ? `큰 돌풍도 벼락도 없이 차분히 흘러가는 해입니다. 작은 성취를 쌓고 인간관계를 정돈하는 데에 좋은 시기이니, 무리하게 확장하기보다 내실을 다지세요.`
      : `올 한 해는 ${entry.keywords[0]}의 기운이 강해 내 뜻대로 풀리지 않는 장면이 많을 수 있습니다. 억지로 밀어붙이면 손해가 크니, 멈춰 서서 주변을 살피고 장기적 관점을 유지하세요.`;
  const p4 = lucky;

  const monthly = entry.monthlyHints.map((hint, i) => ({
    month: i + 1,
    keyword: hint,
    text: buildMonthlyText(i + 1, hint, entry.grade),
  }));

  const advice: string[] = [];
  const warnings: string[] = [];
  if (entry.grade === '대길' || entry.grade === '길') {
    advice.push('중요한 결단·시도·투자는 상반기에 몰아서 진행');
    advice.push('믿을 만한 인연에게 협력을 제안하면 결실 가능성이 커요');
    advice.push('건강한 습관을 정착시키기에도 좋은 해');
    warnings.push('자만하거나 독주하지 말고 주변 의견을 경청하기');
  } else if (entry.grade === '중길' || entry.grade === '평') {
    advice.push('작은 목표를 설정하고 꾸준히 달성');
    advice.push('가족·지인과의 관계 정돈에 시간 투자');
    advice.push('재정 상태 점검과 절약 습관 형성');
    warnings.push('큰 투자나 이직은 신중하게, 근거 없는 결단은 금물');
  } else {
    advice.push('몸을 낮추고 공부·정비에 힘쓰기');
    advice.push('지출 축소 및 비상 자금 확보');
    advice.push('건강 검진으로 작은 증상도 조기에 대응하기');
    warnings.push('말·문서 관련 문제 주의');
    warnings.push('낯선 사람과의 금전 거래 금물');
  }

  return {
    entry,
    title,
    headline,
    grade: entry.grade,
    paragraphs: [p1, p2, p3, p4],
    monthly,
    advice,
    warnings,
  };
}
