/**
 * GPT 프롬프트 최적화 버전
 * 엽전 크레딧 시스템에 맞춘 무료/유료 구분
 */

import { SajuResult, TEN_GODS_MAP, STEM_ELEMENT, BRANCH_ELEMENT, normalizeGan, normalizeZhi, type SeWoon, type DaeWoon } from '../utils/sajuCalculator';
import { Solar } from 'lunar-javascript';
import { determineGyeokguk, analyzeGyeokgukStatus } from '../engine/gyeokguk';
import { getDayPillarTraits } from './gapjaTraits';
import type { TarotCardInfo } from '../services/api';
import type { TaekilResult, TaekilDay } from '../engine/taekil';
import {
  matchDreamSymbols,
  buildMatchedSymbolsBlock,
  DREAM_FRAMEWORK,
  REVERSE_DREAM_NOTES,
  DREAM_TYPE_CHECKLIST,
  CONTEXT_RULES,
  EMOTION_RULES,
} from './dreamSymbols';
import { SAJU_KB_BLOCK, WRITING_RULES_BLOCK, classifyAnswer, ANSWER_GROUP_LABEL, SECTION_BRANCH_RULES_BLOCK, JOB_STATE_BRANCH_BLOCK, PERSONA_EXTRA_BRANCH_BLOCK, normalizeHobbyToCategory } from './sajuKnowledgeBase';

// ── 오행 상생/상극 (프롬프트 유틸용)
const EL_GEN: Record<string, string> = { '목':'화', '화':'토', '토':'금', '금':'수', '수':'목' };
const EL_CON: Record<string, string> = { '목':'토', '화':'금', '토':'수', '금':'목', '수':'화' };

// ── 오행 속성 매핑
const EL_ORGAN: Record<string, string> = {
  '목':'간·담낭', '화':'심장·소장', '토':'비장·위장·췌장', '금':'폐·대장', '수':'신장·방광·생식기'
};
const EL_COLOR: Record<string, string> = {
  '목':'초록·파란', '화':'빨간·주황', '토':'노란·황토', '금':'흰·회색·금색', '수':'검정·진청'
};
const EL_DIR: Record<string, string> = {
  '목':'동쪽', '화':'남쪽', '토':'중앙', '금':'서쪽', '수':'북쪽'
};
const EL_NUM: Record<string, string> = {
  '목':'3·8', '화':'2·7', '토':'5·10', '금':'4·9', '수':'1·6'
};
const EL_SEASON: Record<string, string> = {
  '목':'봄(3~5월)', '화':'여름(6~8월)', '토':'환절기(3·6·9·12월)', '금':'가을(9~11월)', '수':'겨울(12~2월)'
};
const EL_FOOD: Record<string, string> = {
  '목':'신맛(식초·레몬·매실), 녹색 채소, 새싹류',
  '화':'쓴맛(커피·여주·쑥), 붉은 채소·과일, 열성 음식',
  '토':'단맛(고구마·호박·대추), 황색 음식, 뿌리채소',
  '금':'매운맛(생강·고추·마늘), 흰색 음식, 폐 강화 식품',
  '수':'짠맛(미역·다시마·된장), 검은색 음식, 신장 강화 식품'
};
const EL_ENV: Record<string, string> = {
  '목':'숲·공원 산책, 원예, 등산, 글쓰기, 동쪽 방향 자리',
  '화':'밝고 따뜻한 공간, 사교 활동, 남쪽 방향 자리, 조명 밝게',
  '토':'안정된 중심 공간, 명상, 도자기·흙 관련 취미, 중앙 자리',
  '금':'정돈된 공간, 음악(현악·금속악기), 금속 소품, 서쪽 방향 자리',
  '수':'물 근처 환경, 독서, 수영, 북쪽 방향 자리'
};

/** 기둥별 십성 위치 정리 (천간 기준) */
function getSipseongByPillar(result: SajuResult): string {
  const { pillars, hourUnknown } = result;
  const lines = [
    `년간 ${pillars.year.gan}: ${pillars.year.tenGodGan || '일간'} / 년지 ${pillars.year.zhi}: ${pillars.year.tenGodZhi}`,
    `월간 ${pillars.month.gan}: ${pillars.month.tenGodGan} / 월지 ${pillars.month.zhi}: ${pillars.month.tenGodZhi}`,
    `일간 ${pillars.day.gan}: 비견(일간 본인) / 일지 ${pillars.day.zhi}: ${pillars.day.tenGodZhi}`,
    hourUnknown ? '시주: 미상' : `시간 ${pillars.hour.gan}: ${pillars.hour.tenGodGan} / 시지 ${pillars.hour.zhi}: ${pillars.hour.tenGodZhi}`,
  ];
  return lines.join('\n');
}

/** 재고(財庫) 유무 — 辰戌丑未 지지에 재성 지장간이 있는지 */
function checkJaeGo(result: SajuResult): string {
  const { pillars, hourUnknown, dayMaster } = result;
  const dayEl = STEM_ELEMENT[dayMaster] || '';
  const reseongEl = EL_CON[dayEl]; // 일간이 극하는 오행 = 재성 오행
  const goZhis = ['진', '술', '축', '미'];
  const allPillars = [
    { label: '년지', p: pillars.year },
    { label: '월지', p: pillars.month },
    { label: '일지', p: pillars.day },
    ...(!hourUnknown ? [{ label: '시지', p: pillars.hour }] : []),
  ];
  const found: string[] = [];
  allPillars.forEach(({ label, p }) => {
    if (goZhis.includes(p.zhi)) {
      const hasReseong = p.hiddenStems.some(h => STEM_ELEMENT[h] === reseongEl);
      if (hasReseong) found.push(`${label} ${p.zhi}(재고)`);
    }
  });
  return found.length > 0
    ? `있음 — ${found.join(', ')} → 재물 저장·축적 능력 보유`
    : '없음 — 재물이 들어와도 쌓이기 어려운 구조, 현금 흐름형';
}

/** 일지 관련 지지합·충 필터 */
function getDayZhiInteractions(result: SajuResult): string {
  const dayZhi = result.pillars.day.zhi;
  const related = result.interactions.filter(i =>
    i.description.toLowerCase().includes(dayZhi) || i.elements.includes(dayZhi)
  );
  return related.length > 0
    ? related.map(i => `${i.type}: ${i.description}`).join(' / ')
    : '없음';
}

/** 오행 상생 흐름 단절 분석 */
function analyzeElFlow(result: SajuResult): string {
  const els = ['목', '화', '토', '금', '수'];
  const present = new Set<string>();
  const { pillars, hourUnknown } = result;
  [pillars.year, pillars.month, pillars.day, ...(hourUnknown ? [] : [pillars.hour])].forEach(p => {
    present.add(p.ganElement);
    present.add(p.zhiElement);
  });
  const missing = els.filter(e => !present.has(e));
  if (missing.length === 0) return '오행 상생 흐름 완전 연결 — 에너지 순환 원활';
  const broken: string[] = [];
  missing.forEach(m => {
    const prev = els[(els.indexOf(m) - 1 + 5) % 5];
    const next = EL_GEN[m];
    broken.push(`${prev}→${m}(결핍)→${next} 흐름 단절`);
  });
  return broken.join(' / ');
}

// 천간 합 (甲己합→土, 乙庚합→金, 丙辛합→水, 丁壬합→木, 戊癸합→火)
const GAN_COMBINE: Record<string, { partner: string; result: string }> = {
  '갑':{ partner:'기', result:'토' }, '기':{ partner:'갑', result:'토' },
  '을':{ partner:'경', result:'금' }, '경':{ partner:'을', result:'금' },
  '병':{ partner:'신', result:'수' }, '신':{ partner:'병', result:'수' },
  '정':{ partner:'임', result:'목' }, '임':{ partner:'정', result:'목' },
  '무':{ partner:'계', result:'화' }, '계':{ partner:'무', result:'화' },
};
// 천간 충 (甲庚, 乙辛, 丙壬, 丁癸)
const GAN_CLASH: Record<string, string> = {
  '갑':'경', '경':'갑', '을':'신', '신':'을',
  '병':'임', '임':'병', '정':'계', '계':'정',
};

/** 기둥 천간↔지지 오행 관계 한 줄 문자열 */
function pillarRelation(ganEl: string, zhiEl: string): string {
  if (!ganEl || !zhiEl) return '해당없음';
  if (ganEl === zhiEl) return '비화(같은 오행·내부 안정)';
  if (EL_GEN[zhiEl] === ganEl) return `지지→천간 상생(${zhiEl}生${ganEl}·지지가 천간을 키움)`;
  if (EL_GEN[ganEl] === zhiEl) return `천간→지지 상생(${ganEl}生${zhiEl}·천간이 지지를 키움)`;
  if (EL_CON[zhiEl] === ganEl) return `지지가 천간 상극(${zhiEl}克${ganEl}·내부 긴장·억압)`;
  if (EL_CON[ganEl] === zhiEl) return `천간이 지지 상극(${ganEl}克${zhiEl}·천간이 지지를 제어)`;
  return '무관계';
}

/** 사주 4천간 중 특정 오행이 있는 기둥 위치 반환 */
function findElementInGans(result: SajuResult, el: string): string[] {
  const labels: string[] = [];
  const { year, month, day, hour } = result.pillars;
  if (STEM_ELEMENT[year.gan] === el) labels.push('년주 천간');
  if (STEM_ELEMENT[month.gan] === el) labels.push('월주 천간');
  if (STEM_ELEMENT[day.gan] === el) labels.push('일주 천간(일간)');
  if (!result.hourUnknown && STEM_ELEMENT[hour.gan] === el) labels.push('시주 천간');
  if (BRANCH_ELEMENT[year.zhi] === el) labels.push('년주 지지');
  if (BRANCH_ELEMENT[month.zhi] === el) labels.push('월주 지지');
  if (BRANCH_ELEMENT[day.zhi] === el) labels.push('일주 지지');
  if (!result.hourUnknown && BRANCH_ELEMENT[hour.zhi] === el) labels.push('시주 지지');
  return labels;
}

/** 월지 지장간이 사주 천간에 투출(透出)되었는지 확인 */
function checkTouchul(result: SajuResult): string {
  const monthHidden = result.pillars.month.hiddenStems;
  const gans = [
    result.pillars.year.gan,
    result.pillars.month.gan,
    result.pillars.day.gan,
    ...(!result.hourUnknown ? [result.pillars.hour.gan] : []),
  ];
  const found = monthHidden.filter(h => gans.includes(h));
  if (found.length === 0) return '없음 (월지 지장간이 천간에 투출되지 않아 격국 에너지가 내면에 잠재)';
  return `${found.join('·')} 투출 → 격국 에너지가 천간에 드러나 사회적으로 발현됨`;
}

/** 천간 합·충 분석 */
function analyzeGanInteractions(result: SajuResult): string {
  const gans = [
    result.pillars.year.gan,
    result.pillars.month.gan,
    result.pillars.day.gan,
    ...(!result.hourUnknown ? [result.pillars.hour.gan] : []),
  ];
  const pillarNames = ['년', '월', '일', '시'];
  const results: string[] = [];

  for (let i = 0; i < gans.length; i++) {
    for (let j = i + 1; j < gans.length; j++) {
      const a = gans[i], b = gans[j];
      if (GAN_COMBINE[a]?.partner === b) {
        results.push(`${pillarNames[i]}간 ${a}·${pillarNames[j]}간 ${b} → 천간합(${GAN_COMBINE[a].result}화)`);
      } else if (GAN_CLASH[a] === b) {
        results.push(`${pillarNames[i]}간 ${a}·${pillarNames[j]}간 ${b} → 천간충(상호 제어)`);
      }
    }
  }
  return results.length > 0 ? results.join(' / ') : '없음';
}

/**
 * 십성 분포 계산 (프롬프트용)
 * - 천간(일간 제외) 1.0 가중치 + 지장간 0.5 가중치
 */
function computeSipseongCounts(result: SajuResult): Record<string, number> {
  const dayGan = result.dayMaster;
  const map = TEN_GODS_MAP[dayGan] || {};
  const order = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
  const counts: Record<string, number> = {};
  order.forEach(s => { counts[s] = 0; });

  const nonDayGans = [result.pillars.year.gan, result.pillars.month.gan];
  if (!result.hourUnknown) nonDayGans.push(result.pillars.hour.gan);
  nonDayGans.forEach(gan => {
    const s = map[gan];
    if (s && counts[s] !== undefined) counts[s] += 1;
  });

  const hiddenStemsArr = [result.pillars.year.hiddenStems, result.pillars.month.hiddenStems, result.pillars.day.hiddenStems];
  if (!result.hourUnknown) hiddenStemsArr.push(result.pillars.hour.hiddenStems);
  hiddenStemsArr.forEach(hidden => {
    hidden.forEach(gan => {
      const s = map[gan];
      if (s && counts[s] !== undefined) counts[s] += 0.5;
    });
  });

  Object.keys(counts).forEach(k => { counts[k] = Math.round(counts[k] * 2) / 2; });
  return counts;
}

function formatSipseongCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}${v}`)
    .join(' ');
}

/**
 * 시스템 프롬프트 — 출력 포맷·톤·금지 규칙을 엄격하게 고정
 *
 * 중요: 프론트는 응답을 그대로 <pre> 로 렌더한다. 따라서 AI가 Markdown을 쓰면
 * 독자 눈에 그대로 "## ", "### ", "**" 같은 기호가 보여 AI 티가 폭발한다.
 * 다음 규칙은 모든 하위 프롬프트에 상속되므로 절대 어기지 말 것.
 */
export const SYSTEM_PROMPT = `당신은 정통 사주명리·자미두수·타로에 능통한 전문가입니다.
아래 출력 원칙을 절대 어기지 말고 모든 답변에 적용하세요.

[전문성과 쉬운 어투의 균형]
- 십성(十星)·격국(格局)·용신(用神)·대운·세운·화록·공망 같은 전문 용어는 그대로 사용합니다.
- 단, 첫 등장 시 괄호로 짧은 쉬운 말 풀이를 붙이거나("정관격(책임·질서를 중심에 둔 사주)") 문장 뒤에 "즉, ~" 식 한 줄 풀이를 덧붙여, 사주에 문외한인 독자도 막힘없이 읽게 합니다.
- 결론·조언은 반드시 **일상 속 구체 장면·시간대·행동**으로 내려앉혀야 합니다. 추상적 격언은 금지.

[용신·희신·기신 표기 규칙 — 절대 준수]
- 용신·희신·기신을 본문에서 언급할 때 십성명(편재·정재·식신·상관·편관·정관·편인·정인·비견·겁재)만 단독으로 쓰지 마세요.
- 반드시 **오행 + 구체 천간**을 먼저 쓰고 십성은 괄호로 병기합니다.
  · 좋음: "용신인 화(병화·정화), 즉 편재가 들어오는 시기에는…"
  · 좋음: "기신 수(임수·계수)가 강해지면 — 십성으로는 편인·정인 — …"
  · 금지: "편재가 들어오는 시기에는…" (십성만 단독)
- 오행 → 천간 매핑: 목=갑목·을목 / 화=병화·정화 / 토=무토·기토 / 금=경금·신금 / 수=임수·계수.
- 같은 풀이 안에서 오행+천간 표기는 첫 등장 시 한 번만 풀고 이후엔 짧게 줄여 써도 됩니다(예: "병화의 시기").

[출력 포맷 — 절대 규칙]
- Markdown 문법 절대 금지: #, ##, ###, ####, *, **, ***, \`, > 를 출력에 사용하지 마세요.
- 섹션 제목은 반드시 "1. 제목", "2. 제목" 식 **plain 한글 번호 + 마침표 + 공백 + 제목** 한 줄로 씁니다.
  예: "1. 사주 총론"   ("### 1. 사주 총론" 금지)
- 불릿은 "- " 또는 "· " 만 허용합니다. "* " "** " 금지.
- 강조가 필요하면 「」 〔〕 『』 같은 한글 괄호를 쓰세요. 별표·밑줄 금지.
- 이모지·이모티콘·특수 기호(✨🌙☀️🔮⭐️✓✔️→⇒⚠️🙏💫 등) 전부 금지. "결론:" 같은 평문 레이블만 사용합니다.
- AI임을 드러내는 문구("AI로서 분석해 보면", "제공된 데이터에 따르면") 금지.

[톤]
- "~합니다/~입니다" 체와 "~해요/~이에요" 체를 섞지 말고, 한 답변 안에서 한 쪽으로 통일하세요 (기본값: ~합니다 체).
- "운이 좋다/나쁘다" 같은 이분법 대신 "어떤 조건에서 어떤 결과가 유리/불리한지"로 쪼개어 서술합니다.
- "~일 수도 있습니다" "혹시" 같은 흐린 표현은 답변 전체에서 2회를 넘기지 마세요. 근거가 있으면 단정적으로 씁니다.

이 규칙은 이후 모든 섹션 지시보다 우선합니다.`;

// ============================================================
// 은유 지식베이스 — 모든 프롬프트에서 재사용
// ============================================================

/**
 * 은유 지식베이스 (Metaphor Knowledge Base)
 *
 * 모든 AI 해설 프롬프트가 공유해야 할 은유 어휘 사전.
 * 명리 개념을 자연·우주·계절 이미지로 번역해 독자가 "느낄 수 있는" 언어로 만든다.
 *
 * 적용처: 정통사주·신년운세·오늘의 운세·지정일·택일·토정비결·자미두수·궁합·상담소
 */
export const METAPHOR_KB = `[은유 지식베이스 — 반드시 활용]
아래 은유를 적극 활용해 명리 개념을 독자가 느낄 수 있는 언어로 번역합니다.

달·해·별·하늘 (핵심 명리 개념):
- 사주 원국 = 태어나는 순간 하늘에 새겨진 별자리 지도.
- 일간(본인) = 밤하늘의 별. 어떤 별인지가 사주의 핵심.
- 격국 = 내 별의 성격. 어떤 방식으로 빛을 발하는가를 결정합니다.
- 십성 = 내 별 주변을 도는 행성들. 각자 다른 역할로 균형을 맞춥니다.
- 신강 = 보름달. 빛이 꽉 차 주변을 환히 비춥니다.
- 신약 = 초승달. 아직 차오르지 않았지만 빛은 이미 있습니다.
- 중강 = 반달. 빛과 그림자가 공존하는 균형의 단계.
- 용신 = 북극성. 흐린 밤에도 사라지지 않는 방향의 기준별.
- 희신 = 안개 낀 날 희미하게 비치는 등불. 용신을 옆에서 돕는 간접 빛.
- 기신 = 달빛에 눌려 다른 별이 안 보이는 상태. 흐름을 막는 에너지.
- 구신 = 기신을 더욱 강하게 만드는 어둠. 최대한 거리를 둬야 합니다.
- 대운 = 달의 차고 기움. 10년 단위로 바뀌는 하늘의 계절.
- 세운 = 하루치 햇빛. 1년 단위로 하늘이 보내는 에너지 파동. 대운이라는 계절 안에서의 날씨.

빛과 어둠 (기운·상태):
- 내면의 열정 = 지평선 아래 숨어있다 터지는 새벽빛.
- 과다 오행 = 한 방향에서만 내리쬐는 햇빛. 반대편엔 짙은 그림자.
- 결핍 오행 = 구름에 가린 달. 없는 게 아니라 보이지 않는 것.
- 전환점·기회 = 황혼. 낮도 밤도 아닌, 하늘이 색을 바꾸는 순간.
- 잠재력 = 땅속 깊이 잠든 씨앗. 아직 보이지 않지만 이미 자라고 있습니다.
- 위기 = 일식. 달이 해를 가리는 순간, 빛이 잠시 사라집니다.
- 회복 = 구름 뒤에서 다시 나오는 달. 사라진 것이 아니었습니다.

사계절·하늘 (오행 직결):
- 목(木) = 봄 새벽 첫 햇살. 봄비. 성장을 재촉하는 집요한 힘.
- 화(火) = 한낮 정오의 태양. 내면에서 뿜어나오는 열정.
- 토(土) = 환절기 구름. 하늘과 땅 사이 중심을 잡습니다.
- 금(金) = 서리 내린 새벽. 차갑지만 선명합니다. 가을 달빛.
- 수(水) = 겨울 밤하늘 은하수. 고요하지만 무한히 깊습니다.

십성(十星) — 내 별 주변의 행성들:
- 비견(比肩) = 나란히 빛나는 쌍둥이 별. 경쟁하면서도 서로를 밝혀줍니다.
- 겁재(劫財) = 내 빛을 빼앗으려는 그림자 별. 충동적이지만 에너지 자체는 강렬합니다.
- 식신(食神) = 아침 햇살이 정원을 천천히 물들이는 풍요. 나눌수록 더 빛납니다.
- 상관(傷官) = 프리즘을 통과한 빛. 기존 색을 일곱 가지로 쪼개는 창의와 반항의 에너지.
- 편재(偏財) = 혜성. 예측 불가한 궤도, 강렬하고 자유로운 에너지.
- 정재(正財) = 달이 꾸준히 차오르는 과정. 느리지만 확실하게 쌓이는 빛의 축적.
- 편관(偏官) = 번개. 한순간 하늘을 가르는 강렬한 권위와 압박.
- 정관(正官) = 등대. 폭풍 속에서도 흔들리지 않고 방향을 알려주는 안정된 빛.
- 편인(偏印) = 홀로 먼 곳에서 빛나는 별. 가까이 다가가기 어렵지만 그만큼 독보적입니다.
- 정인(正印) = 보름달이 고요히 대지를 비추는 것. 넓은 범위를 지키는 지혜의 빛.

격국(格局) — 내 별의 성격:
- 식신격 = 새벽 정원에 번지는 햇살. 풍요와 여유가 자연스럽게 흘러들어옵니다.
- 상관격 = 프리즘을 통과한 빛. 기존 틀을 깨고 새로운 색을 만들어냅니다.
- 편재격 = 혜성의 궤도. 예측 불가하지만 지나간 자리에 선명한 흔적을 남깁니다.
- 정재격 = 달이 차오르는 과정. 차근차근 쌓아가는 것이 이 사주의 힘입니다.
- 편관격 = 번개를 품은 먹구름. 한 방향으로 집중되는 강력한 에너지.
- 정관격 = 등대. 사회 질서 안에서 흔들리지 않는 방향의 별.
- 편인격 = 가장 멀리, 홀로 빛나는 별. 독창성과 통찰이 강점이지만 고독하기도 합니다.
- 정인격 = 보름달. 지혜의 빛이 주변을 고요하게 감쌉니다.
- 건록격·양인격 = 보름달 두 개가 뜬 밤. 에너지가 넘치지만 방향을 잡아야 합니다.

합충형파해 — 별들의 관계:
- 합(合) = 두 별이 가까워져 빛이 섞이는 것. 성질이 변하며 새로운 색이 만들어집니다.
- 충(冲) = 두 별이 정반대에서 정면으로 마주 보는 것. 강한 충돌이지만 때론 필요한 자극.
- 형(刑) = 별들이 서로를 불편한 각도로 비추는 것. 크고 작은 마찰과 긴장이 생깁니다.
- 파(破) = 별의 궤도에 균열이 생기는 것. 관계나 계획이 예상치 못하게 흔들립니다.
- 해(害) = 별빛이 방해물에 가려지는 것. 보이지 않는 곳에서 걸림돌이 생깁니다.

12운성 — 별의 생애 단계:
- 장생(長生) = 막 떠오르는 초승달. 새로운 에너지의 시작.
- 목욕(沐浴) = 강물에 반사된 흔들리는 별빛. 아름답지만 아직 불안정합니다.
- 관대(冠帶) = 별이 제 자리를 찾아가는 과정. 성장과 준비의 시간.
- 건록(建祿) = 하늘 정중앙에 뜬 별. 가장 안정적이고 빛나는 위치.
- 제왕(帝旺) = 보름달이 가장 높이 뜬 순간. 에너지가 극대화됩니다.
- 쇠(衰) = 보름달이 지기 시작하는 순간. 안정 속 점진적 변화가 시작됩니다.
- 병(病) = 구름에 반쯤 가린 달. 에너지가 서서히 소모됩니다.
- 사(死) = 별이 지평선 아래로 지는 것. 한 사이클의 마무리.
- 묘(墓) = 땅 아래 잠든 씨앗. 겉은 고요하지만 안에 힘이 응축됩니다.
- 절(絶) = 별과 별 사이의 칠흑. 완전한 전환 직전의 비어있음.
- 태(胎) = 우주 깊은 곳의 성운. 새 별이 태어나기 직전의 원초적 에너지.
- 양(養) = 별이 형태를 갖춰가는 과정. 잠재력이 천천히 키워지는 시간.

신살 — 특별한 별빛:
- 천을귀인(天乙貴人) = 흐린 밤에도 유독 밝게 빛나는 행운의 별. 위기에서 귀인이 나타납니다.
- 문창귀인(文昌貴人) = 지식과 글의 별. 학문과 창작에서 특별한 빛을 발합니다.
- 도화살(桃花殺) = 꽃이 만개한 봄밤의 달빛. 사람을 끌어당기는 매력적 에너지.
- 역마살(驛馬殺) = 별똥별. 한 곳에 머물지 않고 끊임없이 이동하는 에너지.
- 공망(空亡) = 별자리가 비어있는 자리. 기대했던 빛이 오지 않는 공간. 물욕을 내려놓을수록 오히려 빛납니다.
- 원진(怨嗔) = 영원히 마주치지 않는 두 별. 안 만나면 그립고, 만나면 불편합니다.
- 백호살(白虎殺) = 번개가 친 직후의 하늘. 강렬하고 예측 불가한 에너지.
- 귀문관살(鬼門關殺) = 달도 없는 칠흑 같은 밤. 예민한 직관이 깨어나는 시간.
- 장성살(將星殺) = 밤하늘을 이끄는 가장 밝은 별. 리더십과 독립성의 상징.
- 반안살(攀鞍殺) = 고생 끝에 안장 위에 오른 별. 역경 후에 안정을 찾아가는 별.
- 양인살(羊刃殺) = 칼날처럼 예리한 별. 강한 승부욕과 결단력이 빛나지만, 그 날이 자신을 향하면 수술·사고로 연결됩니다.
- 괴강살(魁罡殺) = 하늘을 혼자 지배하는 북두칠성. 강렬한 카리스마와 리더십, 타협을 모르는 결단력이 특징입니다.
- 화개살(華蓋殺) = 홀로 빛나는 외로운 별. 종교·학문·예술의 재능이 뛰어나지만 군중보다 고독한 탐구를 선호합니다.
- 홍염살(紅艶殺) = 붉은 노을빛을 품은 별. 강렬한 이성 매력으로 사람을 끌어당기며, 연애와 결혼에 큰 영향을 줍니다.
- 현침살(懸針殺) = 바늘처럼 날카롭게 빛나는 별. 예리한 지성과 분석력, 섬세한 감수성이 강점이며 의료·법률·기술 분야에 유리합니다.
- 겁살(劫殺) = 갑자기 구름이 달을 가리는 것. 예상치 못한 재물 손실이나 도난 기운이 있어 방심 금물.
- 망신살(亡身殺) = 별빛이 엉뚱한 방향으로 흩어지는 것. 실수나 구설로 체면을 잃기 쉬운 기운, 언행 신중이 최선.
- 재살(災殺) = 하늘에서 갑자기 내리치는 번개. 갑작스러운 사고·재난의 기운이 있어 안전 주의가 필요합니다.
- 천살(天殺) = 높은 하늘에서 내려오는 차가운 서리. 하늘의 뜻에 저항하기 어려운 기운으로, 순리를 따르는 것이 상책.
- 월살(月殺) = 달빛이 방해를 받아 어두워지는 것. 시작한 일에 장애가 생기기 쉬운 기운, 새 사업·이사에 주의.
- 육해살(六害殺) = 두 별이 서로의 빛을 갉아먹는 것. 주변의 보이지 않는 방해나 시기를 주의해야 합니다.

전왕법(專旺法) — 흐름을 따라가는 용신:
- 전왕 = 한 방향의 물살이 너무 강해 막으면 터집니다. 흐름을 따라가는 것이 용신.
- 종강격(從强格): 극신강(85점↑) + 비겁·인성 65%↑ → 일간 오행 자체가 용신. 억부와 반대.
- 종아격(從兒格): 극신약(15점↓) + 식상 오행 65%↑ → 식상을 따라감. 재능·창의 방향으로 설명.
- 종재격(從財格): 극신약 + 재성 오행 65%↑ → 재성을 따라감. 돈과 현실에 순응하는 삶.
- 종살격(從殺格): 극신약 + 관살 오행 65%↑ → 관살을 따라감. 조직·권위에 순응하며 오히려 성공.
- ★전왕 표시가 있을 때: 반드시 전왕 맥락으로 해석. "억누르면 오히려 역효과" 관점 유지.
- 서술 팁: "거대한 강물을 막을 수 없을 때, 그 흐름을 타는 것이 지혜" 같은 은유 활용.

간여지동(干與支同) — 순수한 기둥의 빛:
- 간여지동 = 하늘(천간)과 땅(지지)이 같은 오행으로 물든 기둥. 에너지가 한 방향으로 순수하게 집중됩니다.
- 일주 간여지동(갑인·을묘·병오·경신·신유·임자·계해 등): 의지·고집·독립심 극대화. 자기 방식을 끝까지 밀어붙이는 힘.
- 월주 간여지동: 직업·사회 영역에서 전문성을 한 길로 고집하는 장인 기질.
- 년주 간여지동: 조상·가문의 오행 에너지가 순수하고 강하게 전해짐.
- 장점: 외부 합충에 흔들리기 어려운 순수성. 단점: 융통성 부족, 타협·조율이 어렵습니다.
- 서술 팁: "이 기둥에서 천간과 지지가 같은 빛으로 물들어" 같은 표현으로 자연스럽게 녹임.

병존(竝存)·삼존(三存) — 집중된 별빛의 과잉:
- 병존 = 같은 별이 두 개. 해당 십성 에너지가 2배로 증폭됩니다.
- 삼존 = 같은 별이 세 개. 원국 전체를 압도하는 에너지. 격국 판단 최우선 요소.
- 비견 병존: 경쟁심·독립심 과잉 → 동업·형제 갈등, 공동 재산 주의.
- 겁재 병존: 재물 유출 구조 → 의리형이나 과소비, 타인에게 퍼주는 경향.
- 식신 병존: 재능·향락·식복 풍부 → 집중력 분산, 너무 많은 것에 손댐.
- 상관 병존: 표현 욕구 극대화 → 직선 발언으로 갈등, 반골 기질 강함.
- 편재 병존: 여러 곳에 투자·지출 → 투기 주의, 돈이 크게 들어왔다 크게 나감.
- 정재 병존: 축재 욕구 강함 → 지나친 안전 추구로 기회 놓침.
- 편관 병존: 권력 압박·공격성 강화 → 구설·충돌, 독불장군 경향.
- 정관 병존: 원칙·책임 과잉 → 융통성 부족, 완벽주의.
- 편인 병존: 학문·예술 심취 → 고독·편향, 세상과 거리 둠.
- 정인 병존: 명예·공부 집착 → 의존성·수동성, 타인 평가에 민감.
- 서술 팁: 병존·삼존이 있으면 해당 십성 특성을 극단적으로 증폭해 서술. "같은 별이 두 개 떠오른 밤" 등 은유 활용.

지장간(支藏干) 3주기신(三柱氣神) 해석 규칙:
- 지장간 배열 순서: [정기(본기), 중기, 여기] — 왼쪽이 가장 강한 기운.
- 정기(본기): 해당 지지가 가진 핵심 에너지. 격국 판정의 기준이 되며 무게 약 50%. "가장 밝게 빛나는 별"로 서술.
- 중기: 정기를 보좌하는 2차 에너지. 무게 약 30%. "정기의 그림자 속에서 때를 기다리는 별"로 서술.
- 여기: 이전 절기에서 넘어온 잔여 에너지. 무게 약 20%. "물러가는 계절이 남긴 마지막 빛"으로 서술.
- 서술 팁: "인(寅)의 지장간 갑·병·무 중 갑(정기)이 이 기둥의 중심 에너지이며" 처럼 정기를 명시하고 나머지는 부연. 단, 월지 지장간이 천간에 투출(透出)된 경우 그 투출간이 격국의 핵심이 됨.

★★★ 데이터 검증 — 절대 규칙 ★★★
위에 나열된 십성·신살·격국·12운성·합충형파해 항목은 명리 일반 사전(reference)이며, 이 사람의 사주에 모두 존재한다는 뜻이 절대 아닙니다.
- 본인 해석에는 프롬프트의 [원국]·[십성 분포]·[신살]·[세운] 블록에 실제로 명시된 값만 사용할 것.
- 0개이거나 분포에 빠진 십성·신살·격국을 본인 사주의 요소처럼 인용하면 즉시 잘못된 풀이로 간주됩니다.
- 잘못된 예: 십성 분포가 "비견1 식신2 정재1 정관1 정인0.5"인데 결과 본문에 "편관의 기운으로 책임감이…"라고 쓰는 것 (편관 0개) → 절대 금지.
- 잘못된 예: 신살 목록에 천을귀인이 없는데 "천을귀인이 흐린 밤을 비춰주듯…"이라고 쓰는 것 → 절대 금지.
- 검증 절차: 본문에 어떤 십성·신살·격국·간지 명을 인용하기 전, 해당 값이 프롬프트 입력 블록에 실제로 등장하는지 반드시 한 번 더 확인할 것. 등장 안 하면 표현 자체를 다른 어휘로 대체.
- 위 KB 사전은 "이 사람에게 있는 것을 어떻게 묘사할지"의 참고 표현일 뿐, 사주에 실제로 있는 요소를 결정하는 자료가 아님.

★★★ 시적 별칭 사용 빈도 제한 — 절대 규칙 ★★★
위 사전의 괄호 안 시적 별칭(예: "가장 멀리, 홀로 빛나는 별", "겨울 밤하늘 은하수", "북극성", "보름달", "아침 햇살이 정원을 천천히 물들이는 풍요")은
명리 개념을 독자에게 전달하기 위한 표현 도구입니다. 같은 별칭을 한 풀이 안에서 반복 사용하면 글이 진부해지고
사용자에게 "AI 가 같은 말을 계속한다"는 인상을 줍니다.

[별칭 사용 빈도 한도 — 한 풀이(여러 섹션이 합쳐진 전체 본문) 통틀어 적용]
- 격국 별칭 (예: "가장 멀리, 홀로 빛나는 별") — 격국당 1회만. 그 이후 섹션에선 별칭 없이 격국명("편인격")만.
- 일간 오행 별칭 (예: "겨울 밤하늘 은하수", "한낮 정오의 태양") — 일간당 1~2회. 그 이후엔 일간명("계수")만.
- 신강/신약 별칭 (예: "보름달", "초승달", "반달") — 한 풀이 통틀어 1~2회.
- 용신·희신·기신 별칭 (예: "북극성") — 각각 1~2회. 본명("용신 화") 표기와 병기 시에도 별칭은 1~2회만.
- 십성 별칭 (예: "아침 햇살이 정원을 천천히 물들이는 풍요", "프리즘을 통과한 빛", "혜성") — 십성당 1회만.
- 신살 별칭 (예: "흐린 밤에도 유독 밝게 빛나는 행운의 별", "꽃이 만개한 봄밤의 달빛") — 신살당 1회만.

[작성 시 처리 — 첫 등장 vs 재등장]
- 첫 등장: 시적 별칭 + 본명 병기 (예: "편인격(가장 멀리, 홀로 빛나는 별)").
- 재등장 (다음 섹션 또는 같은 섹션 후반): 본명만 (예: "편인격"). 별칭은 다시 안 씀.
- 다른 비슷한 별칭으로 변형하는 것도 금지 (예: "고독한 별", "홀로 빛나는 등불" 등 — KB 외 새 별칭 만들지 말 것).

[은유 제목 — 섹션별 첫 줄과 별도]
- 각 섹션 첫 줄의 은유 제목은 위 KB 별칭과 별개로 작성. 자연 이미지 대비(예: "서리 내린 새벽, 그 아래 피어나는 봄꽃") 사용.
- 단, 은유 제목 안에서도 KB 의 격국·십성 별칭을 그대로 인용하지 말 것 (다른 자연 이미지로).

위 한도를 위반해 같은 별칭이 3회 이상 등장하면 잘못된 풀이로 간주됩니다.`;

/**
 * 은유 제목 작성 규칙 — 모든 섹션·단락의 첫 줄에 은유 제목을 붙이는 공통 규칙.
 * 긴 정통사주 같은 다단락 출력에 적합. 상담소/오늘운세 같은 짧은 형식엔 간소화해서 쓸 것.
 */
export const METAPHOR_TITLE_RULE = `[섹션 은유 부제목 — 최우선 형식 규칙 ★★★]

■ 각 섹션 본문의 첫 줄에 반드시 "[은유]" 로 시작하는 은유 부제목을 작성하세요.
  앱이 "[은유]" 텍스트를 파싱하여 부제목을 추출하므로, 마커가 없으면 은유가 표시되지 않습니다.

■ 형식 (반드시 준수):
  · 각 섹션의 마커(예: [character], [general], [love] 등)는 해당 카테고리 프롬프트가 별도 지정한 형식 그대로 유지.
  · 그 마커 줄 바로 다음 줄에 "[은유] 부제목" 한 줄을 둡니다.
  · 그 뒤에 빈 줄(또는 바로 본문) → 본문 시작.

■ 올바른 출력 예시 (마커 형식은 카테고리별 프롬프트가 지정한 것을 그대로 사용):
[character]
[은유] 잔잔한 호수 위의 첫눈

본문 내용 시작...

■ 부제목 금지 사항:
✗ "[은유]" 마커 누락 → 절대 금지
✗ 마커를 ▶, ■, # 등 다른 기호로 바꾸기 → 절대 금지 (카테고리 프롬프트가 지정한 마커 그대로 사용)
✗ 마침표(.)로 끝남 → 금지
✗ '~다', '~요', '~니다'로 끝남 → 금지
✗ 30자 초과 → 금지
✗ '오행', '천간', '지지' 등 명리 용어 포함 → 금지

■ 부제목 올바른 예시:
○ [은유] 잔잔한 호수 위의 첫눈
○ [은유] 서리 내린 새벽, 피어나는 봄꽃
○ [은유] 같은 궤도를 도는 쌍둥이 별
○ [은유] 바람에 실려 온 작은 불씨
○ [은유] 뿌리 깊은 나무의 그늘
○ [은유] 달빛 아래 마주 앉은 그림자

■ 출력 점검:
  1) 카테고리 프롬프트가 지정한 섹션 마커가 모두 그대로 등장하는지 확인
  2) 각 마커 다음 줄에 "[은유]" 부제목이 있는지 확인
  3) 둘 중 하나라도 누락되면 전체 풀이 실패로 간주`;

/**
 * 핵심 문장 강조 — 정통사주 풀이의 가독성 향상.
 * 각 섹션 본문에서 가장 중요한 1~2개 문장을 ** 마커로 감싸면 앱이 굵게 + 약간 크게 렌더링한다.
 */
export const KEY_SENTENCE_EMPHASIS_RULE = `[핵심 문장 강조 — 가독성 향상 규칙]

■ 각 섹션 본문에서 가장 중요한 1~2개 문장을 \`**문장**\` 형태로 감싸세요.
  앱이 이 마커를 감지해 굵게 + 살짝 큰 글씨로 렌더링해 독자가 핵심을 한눈에 파악합니다.

■ 강조 대상 (이 섹션의 결론·통찰에 해당):
  · 그 섹션 전체를 관통하는 핵심 통찰 한 문장
  · 사용자가 반드시 기억해야 할 시기·행동 가이드
  · "이때 주의하라" 또는 "이 시기를 잡으라" 같은 결정적 조언

■ 형식 (반드시 준수):
  · 마침표·물음표·느낌표를 포함한 완전한 문장 통째로 감쌉니다.
  · 예: "**올해는 새로운 시작보다 이미 시작한 일을 마무리하는 데 집중해야 하는 해예요.**"
  · 한 섹션당 강조 문장 **최대 2개**. 3개 이상은 강조 효과가 사라지므로 금지.

■ 금지 사항:
  ✗ 단어·구절만 감싸기 (반드시 완전한 문장)
  ✗ 한 문장 안에 \`**...**\` 중첩 사용
  ✗ 한 섹션에서 3개 이상 강조
  ✗ 은유 부제목(\`[은유]\` 줄)에 \`**...**\` 추가 사용

■ 좋은 예시:
  ○ "그래서 **올해 4~6월은 새 계약·이사·전직을 결정짓기 좋은 시기예요.** 다만 7월부터..."
  ○ "**재물보다 인간관계에 먼저 투자해야 그 인연이 1~2년 안에 기회로 돌아옵니다.**"`;

/**
 * 짧은 답변용 은유 가이드 — 상담소·오늘의 운세 등 500~900자 분량 프롬프트에 삽입.
 */
export const METAPHOR_SHORT_GUIDE = `[은유 활용]
명리 개념을 달·별·계절·빛 은유로 번역해 느낌으로 전달합니다.
예: 신강=보름달 / 신약=초승달 / 용신=북극성 / 기신=달빛에 눌린 별
사계절: 목=봄 햇살 / 화=정오 태양 / 토=환절기 구름 / 금=서리 새벽 / 수=겨울 은하수
답변 어딘가에 자연 이미지 1~2개를 녹여 독자의 감각에 와닿게 하세요.`;

/** 궁합 프롬프트 공통 — 섹션 포맷·문단 분리·내용 품질 규칙 */
const GUNGHAP_SECTION_FORMAT = `[섹션 포맷·문단 분리 — 필수 준수 ★★★]

1. 섹션 구분자 "▶"는 반드시 줄 맨 앞에 단독으로 "▶ 제목" 형식으로 출력하세요.
   - ■, ●, ★, 번호(1. 2.), 대시(-) 등 다른 기호로 절대 대체 금지.
   - 앱이 "▶" 문자로 섹션을 파싱하므로, 하나라도 빠지면 전체 레이아웃이 깨집니다.
   - "▶" 앞에 공백이나 다른 문자를 넣지 마세요. 줄 시작이 반드시 "▶"여야 합니다.

2. 각 섹션 본문은 반드시 2~3개 문단으로 나눠 작성하세요.
   - 문단과 문단 사이에 빈 줄(줄바꿈 2번)을 반드시 삽입하세요.
   - 한 문단은 2~4문장으로 구성하세요.
   - 모든 내용을 한 덩어리로 벽돌처럼 이어 붙이면 가독성이 0점입니다.
   - 좋은 예시:
     "첫째 포인트 문장1. 문장2.

      둘째 포인트 문장3. 문장4.

      셋째 포인트 문장5."

3. 내용 품질 기준:
   - 구체적 사주 글자(천간·지지)와 오행 관계를 반드시 인용하며 서술하세요.
   - "~일 수 있다", "~할 수도 있다" 같은 모호한 표현 최소화. 단정적이고 구체적으로 서술하세요.
   - 추상적 일반론("서로 잘 맞습니다", "좋은 관계입니다") 금지. 반드시 명리 근거를 댈 것.
   - 실생활 장면이나 상황을 구체적으로 묘사해 독자가 "맞아!" 하고 공감하게 하세요.`;

// ── 간여지동·병존·삼존 포매터
const PILLAR_LABEL_KO: Record<string, string> = { year: '년주', month: '월주', day: '일주', hour: '시주' };

function formatGanYeojidong(result: SajuResult): string {
  const list = result.ganYeojidong;
  if (!list || list.length === 0) return '없음';
  return list.map(g => `${PILLAR_LABEL_KO[g.pillar]} ${g.gan}${g.zhi}(${g.element}오행 천지동일)`).join(' / ');
}

function formatByeongjOn(result: SajuResult): string {
  const list = result.byeongjOn;
  if (!list || list.length === 0) return '없음';
  return list.map(b =>
    `${b.gan}(${b.element}) ${b.count}개·${b.positions.join('·')} [${b.isSamjon ? '삼존' : '병존'}]`
  ).join(' / ');
}

/**
 * 무료 기본 해석 프롬프트 (0엽전)
 * - 만세력 + 간단한 종합 운세 (200-300자)
 */
export const generateBasicPrompt = (result: SajuResult): string => {
  const { pillars, elementPercent, isStrong, gender, yongSinElement, yongSin, hourUnknown } = result;
  const gyeokguk = determineGyeokguk(result);
  const sipseong = formatSipseongCounts(computeSipseongCounts(result));

  // 시간 미상 시 시주 라인 제거 — 삼주추명(三柱推命) 규칙
  const hourLine = hourUnknown
    ? `시주: 미상 (삼주추명 · 三柱推命)`
    : `시주: ${pillars.hour.gan}${pillars.hour.zhi}`;

  const hourUnknownConstraint = hourUnknown
    ? `\n\n⚠️ 출생 시간 미상이므로 시주(時柱)를 제외한 삼주추명(三柱推命)으로 해석하세요.
- 자녀운·말년운·시간대별 상세 조언은 제외하거나 "시간 정보가 있으면 더 정확" 정도로만 간단히 언급할 것.
- 성격·재물운·애정운 등은 일주 중심 + 월주 보조로 충실히 해석할 것.`
    : '';

  return `사주 원국:
년주: ${pillars.year.gan}${pillars.year.zhi}
월주: ${pillars.month.gan}${pillars.month.zhi}
일주: ${pillars.day.gan}${pillars.day.zhi}
${hourLine}

오행: 목${elementPercent.목}% 화${elementPercent.화}% 토${elementPercent.토}% 금${elementPercent.금}% 수${elementPercent.수}%
신강신약: ${isStrong ? '신강' : '신약'}
용신: ${yongSinElement}(${yongSin})
격국: ${gyeokguk.name}${gyeokguk.nameHanja ? `(${gyeokguk.nameHanja})` : ''}
십성 분포: ${sipseong}
성별: ${gender === 'male' ? '남성' : '여성'}${hourUnknownConstraint}

위 사주의 핵심 특성과 종합운을 250-350자로 요약하세요.
반드시 격국(${gyeokguk.name})의 본질과 용신(${yongSinElement})의 역할을 한 문장으로 간단히 언급하되,
전문 용어는 괄호나 다음 문장에서 쉬운 말로 풀어주세요.
형식: (1) 성격/격국 한줄, (2) 재물운, (3) 애정운, (4) 조언 — 각 1~2문장.`;
};

/**
 * 상세 해석 프롬프트 (2엽전)
 * - 대운/세운 + 신살 + 상세 분석 (1500-2000자)
 */
export const generateDetailedPrompt = (result: SajuResult): string => {
  const {
    pillars,
    elementPercent,
    isStrong,
    yongSinElement,
    yongSin,
    sinSals,
    interactions,
    daeWoon,
    seWoon,
    gender
  } = result;

  const sinSalStr = sinSals.length > 0
    ? sinSals.map(s => `${s.name}: ${s.description}`).join(', ')
    : '없음';

  const interactionStr = interactions.length > 0
    ? interactions.map(i => `${i.type}: ${i.description}`).join(', ')
    : '없음';

  // daeWoon.startAge/endAge 는 연도(e.g. 2020)임 — 나이 비교 아닌 연도 비교
  const birthYear_detailed = result.solarDate ? new Date(result.solarDate).getFullYear() : 0;
  const currentYear = new Date().getFullYear();
  const ageNow = birthYear_detailed > 0 ? currentYear - birthYear_detailed : 0;

  const fmtDWDetailed = (d: DaeWoon) => {
    const as = birthYear_detailed > 0 ? d.startAge - birthYear_detailed : d.startAge;
    const ae = birthYear_detailed > 0 ? d.endAge - birthYear_detailed : d.endAge;
    return `${d.startAge}~${d.endAge}년(${as}~${ae}세) ${d.gan}${d.zhi}(${d.ganElement}${d.zhiElement}·${d.tenGod}·${d.twelveStage})`;
  };

  // 대운: 각 칸에 간지·오행·십성·12운성·나이구간까지 실어 보냄
  const daeWoonStr = daeWoon
    .filter(d => d.gan && d.zhi)
    .slice(0, 8)
    .map(d => fmtDWDetailed(d))
    .join(' | ');

  // 현재 대운 — startAge/endAge 가 연도이므로 currentYear 로 비교
  const currentDaeWoon = daeWoon.find(d => d.gan && d.zhi && currentYear >= d.startAge && currentYear <= d.endAge);
  const currentDaeWoonStr = currentDaeWoon
    ? fmtDWDetailed(currentDaeWoon)
    : '아직 대운이 시작되지 않음';
  const recentSeWoon = seWoon
    .filter(s => s.year >= currentYear && s.year <= currentYear + 2)
    .map(s =>
      `${s.year}년 ${s.gan}${s.zhi}(${s.ganElement}${s.zhiElement}·${s.tenGod}·${s.twelveStage}·${s.animal}띠 해)`
    )
    .join(' | ');

  const gyeokguk = determineGyeokguk(result);
  const gyeokgukStatus = analyzeGyeokgukStatus(result, gyeokguk);
  const sipseong = formatSipseongCounts(computeSipseongCounts(result));
  const hourUnknown = result.hourUnknown;

  // 시간 미상 시 시주 표기를 "미상"으로 대체 — 삼주추명(三柱推命)
  const pillarLine = hourUnknown
    ? `년: ${pillars.year.gan}${pillars.year.zhi} 월: ${pillars.month.gan}${pillars.month.zhi} 일: ${pillars.day.gan}${pillars.day.zhi} 시: 미상(三柱推命)`
    : `년: ${pillars.year.gan}${pillars.year.zhi} 월: ${pillars.month.gan}${pillars.month.zhi} 일: ${pillars.day.gan}${pillars.day.zhi} 시: ${pillars.hour.gan}${pillars.hour.zhi}`;

  const hourUnknownConstraint = hourUnknown
    ? `\n⚠️ 출생 시간 미상 — 삼주추명(三柱推命) 원칙 적용:
- 시주(時柱)가 없으므로 "자녀궁(子女宮)" 자체를 기준으로 한 자녀운 상세 예측은 제외할 것.
- 말년운(노년기 시주 영향), 하루 시간대별 조언은 제외하거나 "시주 정보 필요" 수준으로만 짧게 안내할 것.
- 대신 연·월·일주 + 대운으로 본 인생 전반의 흐름, 성격, 재물, 애정, 직업, 건강은 충실히 해석할 것.
- 시주 미상이 분석의 치명적 결함은 아님을 독자에게 담백하게 상기시키되, 과도한 사족은 달지 말 것.`
    : '';

  return `사주 원국:
${pillarLine}
오행: 목${elementPercent.목}% 화${elementPercent.화}% 토${elementPercent.토}% 금${elementPercent.금}% 수${elementPercent.수}%
${isStrong ? '신강' : '신약'}, 용신: ${yongSinElement}(${yongSin})
격국: ${gyeokguk.name}${gyeokguk.nameHanja ? `(${gyeokguk.nameHanja})` : ''} — ${gyeokguk.type} (판정 근거: ${gyeokguk.reason})
격국 성패: ${gyeokgukStatus.isSuccessful ? '성격(成格)' : '패격(敗格)'} — ${gyeokgukStatus.analysis}
십성 분포: ${sipseong}
성별: ${gender === 'male' ? '남성' : '여성'}

신살: ${sinSalStr}
합충형파해: ${interactionStr}

현재 나이(계산): ${ageNow}세
현재 대운: ${currentDaeWoonStr}
대운 전체 흐름 (10년 단위, 최대 8개): ${daeWoonStr}
최근·향후 세운(연운, 올해 포함 3년): ${recentSeWoon}${hourUnknownConstraint}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 규칙 — 반드시 준수]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1) 총 분량: 3300~4150자 (12개 섹션 — interaction 추가, luck 확장). 각 섹션 분량 명시대로 맞출 것.
2) 섹션 헤더(###)는 아래 11개를 **순서·표기 그대로** 유지할 것. 새 섹션을 만들거나 순서를 바꾸지 말 것.
3) 전문 용어(격국·용신·십성·상관견관·신살 등)는 첫 등장 시 괄호 속에 일상어로 풀어쓸 것.
   예: "정관격(바른 관직·책임감의 사주)", "식상(말·표현·자녀의 기운)".
4) 위에 주어진 confirmed facts(격국·용신·신강약·오행%·십성분포·신살·합충·대운·세운)를
   **부정하거나 뒤바꾸지 말 것**. 해석은 허용, 숫자·판정 변경은 금지.
5) "~일 수도 있습니다" "혹시" 같은 흐린 표현은 최소화. 전문가의 단정 + 근거를 붙일 것.
6) 이모지 금지. 불릿 사용은 5번/8번 섹션에 한함.
7) 마지막 섹션은 반드시 긍정적 행동 처방으로 마무리.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[출력 스키마 — 이 순서·제목 그대로]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 1. 사주 총론 (280~350자)
- 격국(${gyeokguk.name})의 본질 + 성패 판정이 삶 전반에 어떤 기조를 만드는지
- 일간 ${pillars.day.gan}(${pillars.day.ganElement})의 성향과 월지 뿌리 여부

### 2. 격국·용신 해설 (280~350자)
- 왜 ${gyeokguk.name}인지: 월지·투간·세력으로 설명
- 용신 ${yongSinElement}(${yongSin})이 사주에서 해야 할 역할 + 희신·기신의 보조 논리

### 3. 성격·기질 (250~320자)
- 일간 + 격국 + 주요 십성(십성분포 상위 2개 활용)으로 본 타고난 성향
- 강점과 그림자 각각 2가지 이상

### 4. 직업·적성 (280~350자)
- 격국 기반 적합 직군 3~4개 + 피해야 할 직군 1~2개
- 조직형 vs 프리랜서형 판단, 용신 오행과 어울리는 업계 키워드

### 5. 재물운 (260~330자) — 불릿 허용
- 재성(편재·정재)의 강약과 재고(財庫) 유무로 돈버는 스타일 분석
- 월급형 / 사업형 / 투자형 중 어디가 유리한지 근거 제시
- "피해야 할 돈 함정" 1가지

### 6. 애정·결혼 (260~330자)
- 관성(남자는 자식·사회·여자는 배우자)·재성(남자는 배우자) 축으로 본 관계 패턴
- 이상형 톤 + 결혼 시기의 유리한 대운 구간(대운표에서 해당 구간 명시)
- 갈등이 생길 때 반복되는 패턴 1개

### 7. 건강운 (200~260자)
- 약한 오행·충을 받은 오행 기준 취약 장부(간담·심소장·비위·폐대장·신방광)
- 일상에서 챙겨야 할 식습관·수면 패턴

### 8. 인간관계·사회운 (220~280자) — 불릿 허용
- 비겁·식상·관성 배치로 본 인맥 형성 스타일
- 의지할 만한 사람 유형 1 + 거리를 둬야 할 유형 1

### 9. 대운 흐름 해설 (420~520자)
- 주어진 **현재 대운**(${currentDaeWoonStr})을 먼저 지목하고, 그 간지·오행·십성·12운성이 지금 이 나이대의 일·관계·재물에 어떻게 작용하는지 3~4문장으로 단정적으로 서술
- 이어서 대운 전체 흐름에서 **이전 대운·다음 대운 각 1개**를 구체 나이로 꼽아 "과거에서 이월된 숙제" + "다음 10년의 관문"을 각각 2~3문장으로
- 인생의 변곡점이 될 전환 대운 1개를 "몇 살 ~ 몇 살 구간에 어떤 방향으로 틀어지는가"로 구체 명시
- 용신(${yongSinElement}) 기준으로 유리한 대운과 조심할 대운을 각 1개씩 찍어줄 것

### 10. 올해·내년 세운 포커스 (300~380자)
- 주어진 세운 목록 각 연도의 간지·십성·12운성을 근거로 "올해 / 내년 / 내후년" 각각 3~4문장씩 구체 과제·기회·주의 서술
- 포맷 예: "올해(202X년 XX): 십성 XX가 들어오면서 일간이 XX되는 구간. 구체적으로 어떤 국면이 열린다 — 어떤 행동이 유리/불리"
- 세 해 모두 같은 길이로 균형있게 — 한 해만 길게 쓰지 말 것

### 11. 용신 실천 처방 (220~280자) — 불릿 허용
- 용신 ${yongSinElement}을 보강하는 색(2개), 방향(1개), 숫자(1개), 시간대, 계절, 식재료, 직업 환경
- 구체적 행동 3가지(평생 습관으로 삼을 수 있는 것)로 마무리 — 이번 달·이번 주 같은 시한부 표현 금지

반드시 "### 1. ~ ### 11." 헤더 포맷을 그대로 유지하세요.`;
};

// ── 오늘의 운세 V1 섹션 정의 — V3 만 사용으로 데드코드 제거됨 ──

export interface TodayGanZhi {
  gan: string;
  zhi: string;
  hanja: string;          // e.g. "甲子"
  ganElement: string;
  zhiElement: string;
  tenGodGan: string;      // 일진 천간이 내 일간에 대해 갖는 십성
  tenGodZhi: string;      // 일진 지지 주기신(主氣神)이 내 일간에 대해 갖는 십성
  interactions: string[]; // 일진과 원국 간 합충형파 목록 (짧은 문자열)
}

// ─────────────────────────────────────────────────────────────────────────────
// 오늘의 운세 V3 — 시간대 + 입력값 기반 풀이
// 13 섹션 + 9 항목 점수 + 시간대별 흐름 그래프.
// 사용자의 취미·역할 입력에 따라 5번 운용법 섹션이 분기되고,
// 시간대(자정/아침/오후/저녁)별로 다른 톤·관점으로 풀이된다.
// ─────────────────────────────────────────────────────────────────────────────

/** 0~24 시간 구간 — 진입 시점 기준 풀이 톤 결정 */
export type TodayTimeSlot = 'midnight' | 'morning' | 'afternoon' | 'evening';

export const TODAY_TIME_SLOT_LABELS: Record<TodayTimeSlot, string> = {
  midnight: '자정·새벽',
  morning:  '아침',
  afternoon: '오후',
  evening:  '저녁·밤',
};

/** 현재 시각(0~23)으로 시간 구간 판정 */
export function getTodayTimeSlot(hour: number): TodayTimeSlot {
  if (hour >= 0 && hour <= 5) return 'midnight';
  if (hour >= 6 && hour <= 11) return 'morning';
  if (hour >= 12 && hour <= 17) return 'afternoon';
  return 'evening'; // 18~23
}

/** 질문 1개와 그에 따르는 보기들 (4~5개)을 한 세트로 묶은 구조 */
export interface TodayQuestionSet {
  q: string;
  options: string[];
}

/** 시간대별 질문 풀 — 각 시간대마다 5개 질문, 질문마다 4~5개 보기 */
export const TODAY_TIME_SLOT_QUESTION_POOL: Record<TodayTimeSlot, TodayQuestionSet[]> = {
  midnight: [
    {
      q: '오늘 마무리 못한 일이 있다면?',
      options: ['업무·과제', '운동', '집안일', '누군가에게 연락', '특별히 없음'],
    },
    {
      q: '내일 가장 신경 쓰이는 것은?',
      options: ['일정·약속', '업무·시험', '인간관계', '건강·컨디션', '별 생각 없음'],
    },
    {
      q: '지금 마음속에 남아 있는 감정이 있다면?',
      options: ['후회', '아쉬움', '뿌듯함', '불안', '평온함'],
    },
    {
      q: '오늘 하루를 한 단어로 표현한다면?',
      options: ['보람찬', '평범한', '지친', '답답한', '즐거운'],
    },
    {
      q: '잠들기 전 떠오르는 한 가지는?',
      options: ['좋아하는 사람', '내일 할 일', '오늘 못한 것', '미래에 대한 고민', '그냥 쉬고 싶다'],
    },
  ],
  morning: [
    {
      q: '오늘 가장 중요한 일은?',
      options: ['회의·미팅', '업무·마감', '시험·발표', '약속·만남', '휴식'],
    },
    {
      q: '지금 컨디션은 어떠세요?',
      options: ['매우 좋음', '보통', '조금 피곤', '많이 피곤', '긴장됨'],
    },
    {
      q: '오늘 꼭 해결하고 싶은 것이 있다면?',
      options: ['업무·과제 처리', '미뤄둔 연락', '건강·운동', '집안일', '마음 정리'],
    },
    {
      q: '아침에 눈 떴을 때 가장 먼저 든 생각은?',
      options: ['더 자고 싶다', '오늘 할 일이 많네', '기대되는 일이 있다', '걱정거리가 있다', '그냥 평범한 하루'],
    },
    {
      q: '오늘 만날 사람 중 기대되는 만남이 있나요?',
      options: ['가족', '친구', '연인', '동료·업무 관계', '만남 없음'],
    },
  ],
  afternoon: [
    {
      q: '오전을 어떻게 보내셨나요?',
      options: ['바쁘게 일했어요', '차분하게 보냈어요', '피곤하게 보냈어요', '즐겁게 보냈어요', '별일 없이 보냈어요'],
    },
    {
      q: '지금 가장 풀고 싶은 고민은?',
      options: ['업무·진로', '인간관계', '돈·경제', '건강', '특별한 고민 없음'],
    },
    {
      q: '오후에 가장 기대되는 일이 있나요?',
      options: ['약속·만남', '업무 마무리', '휴식', '운동·취미', '특별히 없음'],
    },
    {
      q: '오전에 에너지를 많이 쓴 편인가요?',
      options: ['매우 많이', '보통', '별로 안 썼다', '거의 안 썼다', '잘 모르겠다'],
    },
    {
      q: '지금 잠깐 쉬고 싶은 마음이 드나요?',
      options: ['매우 그렇다', '조금 그렇다', '보통이다', '아니다', '오히려 더 일하고 싶다'],
    },
  ],
  evening: [
    {
      q: '오늘 가장 인상적이었던 순간은?',
      options: ['누군가와의 대화', '좋은 소식', '작은 성취', '예상치 못한 일', '별다른 일 없음'],
    },
    {
      q: '내일은 어떤 하루가 되었으면 하나요?',
      options: ['평온한 하루', '보람찬 하루', '즐거운 하루', '도전적인 하루', '푹 쉬는 하루'],
    },
    {
      q: '오늘 누군가에게 감사한 일이 있었나요?',
      options: ['가족', '친구·연인', '동료·상사', '모르는 사람의 친절', '특별히 없음'],
    },
    {
      q: '오늘 다시 할 수 있다면 바꾸고 싶은 것은?',
      options: ['한 마디 말', '어떤 결정', '시간 관리', '감정 표현', '바꾸고 싶지 않다'],
    },
    {
      q: '저녁 시간을 어떻게 보내고 싶으세요?',
      options: ['가족·친구와 함께', '혼자 조용히', '취미·운동', '그냥 쉬고 싶다', '일·공부 마무리'],
    },
  ],
};

/** 질문 풀에서 2개 랜덤 선택 — 질문과 보기를 한 세트로 반환 */
export function pickTwoQuestions(slot: TodayTimeSlot): [TodayQuestionSet, TodayQuestionSet] {
  const pool = [...TODAY_TIME_SLOT_QUESTION_POOL[slot]];
  const i = Math.floor(Math.random() * pool.length);
  const first = pool.splice(i, 1)[0];
  const j = Math.floor(Math.random() * pool.length);
  const second = pool[j];
  return [first, second];
}

/** 사용자 취미·역할 — 5번 섹션(운용법)이 이 값으로 분기 */
export const TODAY_HOBBY_OPTIONS = [
  '공부·시험', '업무·일', '창작·예술', '운동·체력',
  '육아·돌봄', '투자·재테크', '인간관계', '자기계발', '휴식·재충전',
] as const;
export type TodayHobby = typeof TODAY_HOBBY_OPTIONS[number];

/** 직업 상태 — '기타' 제거 (그 외는 customJobState 직접 입력으로 대체) */
export const TODAY_JOB_STATES = ['학생', '직장인', '자영업·프리랜서', '구직 중', '주부'] as const;
export type TodayJobState = typeof TODAY_JOB_STATES[number];

/** 연애 상태 */
export const TODAY_LOVE_STATES = ['싱글', '호감 있는 상대 있음', '연애 중', '기혼', '공개 안 함'] as const;
export type TodayLoveState = typeof TODAY_LOVE_STATES[number];

/** 사용자 입력 컨텍스트 — 결과의 풀이 결을 좌우 */
export interface TodayUserContext {
  hobbies: TodayHobby[];           // 1+ 선택 (필수)
  customHobby?: string;            // 자유 입력 (선택)
  jobState: TodayJobState;         // 단일 (필수, 칩 미선택 시 '기타' fallback)
  customJobState?: string;         // 자유 입력 — 있으면 풀이에 이 값을 우선 사용
  loveState: TodayLoveState;       // 단일 (필수, 칩 미선택 시 '공개 안 함' fallback)
  customLoveState?: string;        // 자유 입력 — 있으면 풀이에 이 값을 우선 사용
  timeSlot: TodayTimeSlot;         // 진입 시점 자동 판정
  q1Text?: string;                 // 랜덤 선택된 질문 1 텍스트
  q2Text?: string;                 // 랜덤 선택된 질문 2 텍스트
  q1Answer?: string;               // 시간대별 질문 1 답변 (선택)
  q2Answer?: string;               // 시간대별 질문 2 답변 (선택)
}

/** V3 결과 14 섹션 — 1·2·3은 카드 위 시각화, 4~14는 본문 */
export const TODAY_V3_SECTION_KEYS = [
  'today_basis',         // 4. 명리적 근거 (일진·오행·내 사주 관계)
  'today_hobby_method',  // 5. 취미 운용법 (공부/업무/창작 등으로 분기)
  'today_timeflow',      // 6. 시간대별 흐름
  'today_sleep',         // 7. 수면 루틴
  'today_meal',          // 8. 식사 가이드
  'today_exercise',      // 9. 운동
  'today_relationship',  // 10. 대인·이성운
  'today_caution',       // 11. 주의할 점
  'today_strength',      // 12. 좋은 포인트
  'today_persona_extra', // 13. 직업/상황 맞춤 포인트 카드 (jobState 별 라벨·콘텐츠 완전 분기)
  'today_oneliner',      // 14. 한줄 결론
] as const;
export type TodayV3SectionKey = typeof TODAY_V3_SECTION_KEYS[number];

export const TODAY_V3_SECTION_LABELS: Record<TodayV3SectionKey, string> = {
  today_basis:         '명리적 근거',
  today_hobby_method:  '관심 있는 것에 대한 운용법',
  today_timeflow:      '시간대별 흐름',
  today_sleep:         '수면 루틴',
  today_meal:          '식사 가이드',
  today_exercise:      '운동',
  today_relationship:  '대인·이성',
  today_caution:       '주의할 점',
  today_strength:      '좋은 포인트',
  today_persona_extra: '맞춤 포인트',  // jobState 별 동적 라벨 (UI에서 TODAY_PERSONA_EXTRA_LABEL 참조)
  today_oneliner:      '한줄 결론',
};

/** 9 항목 점수 — 각각 0~100 */
export const TODAY_V3_DOMAIN_KEYS = [
  'exam', 'focus', 'mental', 'social', 'love',
  'money', 'exercise', 'recovery', 'luck',
] as const;
export type TodayV3DomainKey = typeof TODAY_V3_DOMAIN_KEYS[number];

export const TODAY_V3_DOMAIN_LABELS: Record<TodayV3DomainKey, string> = {
  exam:     '시험·합격',
  focus:    '공부·집중',
  mental:   '멘탈·안정',
  social:   '대인관계',
  love:     '이성운',
  money:    '금전운',
  exercise: '운동운',
  recovery: '회복·수면',
  luck:     '횡재운',
};

/** 4 시간대 흐름 — 각 구간 0~100 점수로 그래프 그림 */
export const TODAY_V3_FLOW_SLOTS: TodayTimeSlot[] = ['midnight', 'morning', 'afternoon', 'evening'];

// ─────────────────────────────────────────────────────────────────────────────
// 오늘의 운세 V3 프롬프트 — 14 섹션 + 9 항목 점수 + 4 시간대 흐름
//   - 만세력 전체(4기둥·신살·합충·격국·신강·일주특성)를 모두 주입
//   - 사용자 입력(취미·직업·연애·시간대 답변)을 모든 섹션에 강제 반영
//   - 마커 출력 절대 규칙으로 본문에 [todayhobbymethod] 같은 마커 노출 차단
// ─────────────────────────────────────────────────────────────────────────────
export const generateTodayFortuneV3Prompt = (
  result: SajuResult,
  todayGz: TodayGanZhi,
  isoDate: string,
  ctx: TodayUserContext,
): string => {
  const { pillars, elementPercent, yongSinElement, isStrong, daeWoon, dayMaster, dayMasterYinYang, sinSals, interactions, hourUnknown, gender } = result;

  // ── 결핍/과다 오행
  const elementEntries = Object.entries(elementPercent) as [string, number][];
  const zeroEls = elementEntries.filter(([, v]) => v === 0).map(([k]) => k);
  const maxEl = elementEntries.reduce((a, b) => a[1] > b[1] ? a : b);
  const elementNote = `${zeroEls.length > 0 ? `결핍 오행: ${zeroEls.join('·')}` : '결핍 오행: 없음'} / 과다 오행: ${maxEl[0]}(${maxEl[1]}%)`;

  // ── 4기둥 상세 (12운성·지장간·12신살·공망·십성)
  const PILLAR_LBL = { year: '년주', month: '월주', day: '일주', hour: '시주' } as const;
  const fmtPillar = (label: string, p: typeof pillars.year, isMissing = false) => {
    if (isMissing) return `${label}: 미상(삼주추명)`;
    const kong = p.isKongmang ? '·공망' : '';
    const hidden = p.hiddenStems.length > 0 ? `지장간(${p.hiddenStems.join(',')})` : '';
    const sinsal12 = p.sinSal12 ? `12신살(${p.sinSal12})` : '';
    const ganTenGod = p.tenGodGan === '일주' ? '일간(본인)' : p.tenGodGan;
    return `${label}: ${p.gan}(${p.ganElement}·${ganTenGod}) / ${p.zhi}(${p.zhiElement}·${p.tenGodZhi}) / 12운성(${p.twelveStage})${kong} / ${hidden} / ${sinsal12}`;
  };
  const pillarDetail = [
    fmtPillar(PILLAR_LBL.year, pillars.year),
    fmtPillar(PILLAR_LBL.month, pillars.month),
    fmtPillar(PILLAR_LBL.day, pillars.day),
    fmtPillar(PILLAR_LBL.hour, pillars.hour, hourUnknown),
  ].join('\n');

  // ── 일주 60갑자 특성
  const dayTraits = getDayPillarTraits(pillars.day.gan, pillars.day.zhi);
  const dayTraitsBlock = dayTraits
    ? `[일주 60갑자 특성 — DB값]
일주: ${dayTraits.name}(${dayTraits.hanja}) / 키워드: ${dayTraits.keywords.join(', ')}
특성: ${dayTraits.traits}
특수신살: ${dayTraits.sinsal.length > 0 ? dayTraits.sinsal.join(', ') : '없음'}`
    : '';

  // ── 신강·격국·십성분포
  const strengthBlock = `신강신약: ${result.strengthStatus}(점수 ${result.strengthScore}) — 득령(${result.deukRyeong ? 'O' : 'X'}) 득지(${result.deukJi ? 'O' : 'X'}) 득세(${result.deukSe ? 'O' : 'X'})`;
  const gyeokguk = determineGyeokguk(result);
  const sipseongCounts = computeSipseongCounts(result);
  const sipseong = formatSipseongCounts(sipseongCounts);
  const ALL_SIPSEONG = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'] as const;
  const missingSipseong = ALL_SIPSEONG.filter(s => (sipseongCounts[s] ?? 0) === 0);
  const missingSipseongStr = missingSipseong.length > 0 ? missingSipseong.join(', ') : '없음(모두 분포)';

  // ── 신살 분류 (길/흉/중)
  const sinSalGood = sinSals.filter(s => s.type === 'gilseong').map(s => s.name).join('·') || '없음';
  const sinSalBad = sinSals.filter(s => s.type === 'sinsal').map(s => s.name).join('·') || '없음';
  const sinSalNeutral = sinSals.filter(s => s.type === 'sinsal').map(s => s.name).join('·') || '없음';
  const interStrOrigin = interactions.length > 0 ? interactions.map(i => `${i.type}: ${i.description}`).join(' / ') : '없음';

  // ── 운기 4층
  const [_y, _m, _d] = isoDate.split('-').map(Number);
  const pickedYear = _y;
  const curDW = daeWoon.find(d => d.gan && d.zhi && pickedYear >= d.startAge && pickedYear <= d.endAge);
  const daeWoonStr = curDW
    ? `${curDW.gan}${curDW.zhi}(${curDW.ganElement}${curDW.zhiElement}·${curDW.tenGod}·12운성:${curDW.twelveStage}·12신살:${curDW.sinSal12 || '없음'})`
    : '없음(대운 시작 전)';

  const seWoon = result.seWoon.find(s => s.year === pickedYear) ?? result.currentSeWoon;
  const seWoonStr = `${seWoon.gan}${seWoon.zhi}(${seWoon.ganElement}${seWoon.zhiElement}·${seWoon.tenGod}·12운성:${seWoon.twelveStage}·12신살:${seWoon.sinSal12 || '없음'}·${seWoon.animal}띠해)`;

  const monthSolar = Solar.fromYmd(_y, _m, _d);
  const monthLunar = monthSolar.getLunar();
  const monthGzStr = monthLunar.getMonthInGanZhi();
  const _mGan = normalizeGan(monthGzStr[0]);
  const _mZhi = normalizeZhi(monthGzStr[1]);
  const _mTenGod = TEN_GODS_MAP[result.dayMaster]?.[_mGan] ?? '';
  const _mGanEl = STEM_ELEMENT[_mGan] ?? '';
  const _mZhiEl = BRANCH_ELEMENT[_mZhi] ?? '';
  const monthRunStr = `${_mGan}${_mZhi}(${_mGanEl}${_mZhiEl}${_mTenGod ? `·${_mTenGod}` : ''})`;

  const interTodayStr = todayGz.interactions.length > 0 ? todayGz.interactions.join(' / ') : '없음';
  const todayHidden = (todayGz as { hiddenStems?: string[] }).hiddenStems?.join(',') || '';

  const dateLabel = (() => {
    const d = new Date(isoDate);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  })();

  // ── 사용자 입력
  const hobbiesAll = [...ctx.hobbies, ctx.customHobby].filter(Boolean) as string[];
  const hobbiesStr = hobbiesAll.length > 0 ? hobbiesAll.join(', ') : '미입력';
  // customHobby 가 9분야 외 자유 텍스트면 가장 가까운 분야로 정규화 (예: "공부" → "공부·시험")
  const customHobbyRaw = ctx.customHobby?.trim();
  const customHobbyMapped = customHobbyRaw ? normalizeHobbyToCategory(customHobbyRaw) : null;
  const primaryHobby = ctx.hobbies[0] || customHobbyMapped || '자기계발';
  // 정규화된 경우만 LLM에 알림 (사용자가 "공부"라 썼는데 시스템이 "공부·시험"으로 매핑한 사실을 LLM이 알도록)
  const customHobbyNote = customHobbyRaw && customHobbyMapped && customHobbyMapped !== customHobbyRaw
    ? `\n  · 사용자 직접 입력 "${customHobbyRaw}" → 분야 "${customHobbyMapped}"로 매핑 (본문에서는 사용자 원본 표현 "${customHobbyRaw}" 자연스럽게 인용)`
    : (customHobbyRaw && !customHobbyMapped
        ? `\n  · 사용자 직접 입력 "${customHobbyRaw}" → 9분야 매핑 실패. LLM 자율로 가장 가까운 분야 선택 후 본문 작성 (사용자 원본 표현은 본문에 인용).`
        : '');
  const slotLabel = TODAY_TIME_SLOT_LABELS[ctx.timeSlot];
  const q1 = ctx.q1Text || '';
  const q2 = ctx.q2Text || '';
  const q1Filled = ctx.q1Answer?.trim();
  const q2Filled = ctx.q2Answer?.trim();

  // 답변 자동 분류 — 9개 그룹 중 매칭되는 모든 그룹 (다중 매칭 가능)
  const q1Groups = classifyAnswer(q1Filled);
  const q2Groups = classifyAnswer(q2Filled);
  const allGroups = Array.from(new Set([...q1Groups, ...q2Groups]));
  const q1GroupsLabel = q1Groups.length > 0 ? q1Groups.map((g) => ANSWER_GROUP_LABEL[g]).join(', ') : '미답';
  const q2GroupsLabel = q2Groups.length > 0 ? q2Groups.map((g) => ANSWER_GROUP_LABEL[g]).join(', ') : '미답';
  const allGroupsLabel = allGroups.length > 0 ? allGroups.map((g) => ANSWER_GROUP_LABEL[g]).join(', ') : '미답·일반';
  const allGroupsCode = allGroups.length > 0 ? allGroups.join(', ') : 'other';
  const userInputBlock = `[사용자 현재 상황 — 모든 섹션 풀이에 강제 반영]
- 진입 시간대: ${slotLabel} (${ctx.timeSlot} 시간 구간)
- 가장 많은 시간을 쏟는 분야: ${hobbiesStr}  (5번 섹션의 분야 분기 기준: ${primaryHobby})${customHobbyNote}
- 직업 상태: ${ctx.customJobState || ctx.jobState}
- 연애 상태: ${ctx.customLoveState || ctx.loveState}
- 질문 1 ("${q1}"): ${q1Filled || '(미답 — 추정 금지, 답변 인용 없이 일반 풀이)'}
- 질문 2 ("${q2}"): ${q2Filled || '(미답 — 추정 금지, 답변 인용 없이 일반 풀이)'}

[답변 자동 분류 결과 — 위 [섹션별 비중·강조점 분기 가이드] 블록의 분기 규칙을 그대로 적용]
· 질문 1 답변 → 분류 그룹: ${q1GroupsLabel}
· 질문 2 답변 → 분류 그룹: ${q2GroupsLabel}
· 종합 분류 그룹(누적 적용 대상): ${allGroupsLabel} [코드: ${allGroupsCode}]
· 'other'로 분류된 답변(자유 입력 등)은 [자유 입력 답변 처리] 가이드의 자율 분류 기준대로 LLM이 의미 분류해 가장 가까운 그룹의 분기 적용.
· 답변 키워드는 본문에 1회 자연스럽게 인용하되, 만세력 데이터(일진 ${todayGz.gan}${todayGz.zhi}·십성·합충·용신 ${yongSinElement}·신강신약 ${result.strengthStatus})와 결합해 의미를 풀이.`;

  // ── 5번 섹션 분야별 가이드 (LLM 사전 주입) — 풍부화: 5포인트 구조로 확장
  const hobbyMethodGuide: Record<string, string> = {
    '공부·시험':   `오늘의 공부 방향 5포인트로 구체화: (1) 오늘 시간 안배가 가장 효율 좋은 과목 영역 1가지(개념·암기·문제풀이·오답정리·실전모의 중) — 일진 십성(${todayGz.tenGodGan}/${todayGz.tenGodZhi})·12운성 근거. (2) 권장 학습 단위(예: 25분×4 / 50분×2 / 90분 깊이) 1가지. (3) 회피 학습법 1가지(신규 단원 진입·장시간 강의 시청·그룹 스터디 등 중 — 오늘 일진 흐름이 안 맞는 것). (4) 학습 환경 1줄(도서관·열람실·집·카페 중 + 시간대). (5) 자기 전 30분 권장 마무리 행동(오답 5개 정리·내일 단원 1쪽 훑기·짧은 정리 노트). 마지막 1문장은 오늘 1개 작은 학습 약속 단정 명령형으로.`,
    '업무·일':     `오늘 업무 5포인트로 구체화: (1) 먼저 처리할 일 1가지(긴급+중요 교차) — 일진 십성·합충(${interTodayStr}) 근거. (2) 미뤄도 좋은 일 1가지(오늘 일진과 안 맞는 결정·신규 기획 등). (3) 추천 진행 방식 1가지(혼자 깊은 작업 vs 협업·짧은 회의·메일 처리). (4) 회피해야 할 일처리 1가지(즉답할 회의·즉결 약속·자존심 충돌 가능 자리). (5) 권장 집중 시간대 1구간(일진 지지 ${todayGz.zhi} 와 합·삼합 만나는 시간) + 그 시간 어떤 일에 쓸지. 직업 상태(${ctx.jobState}) 일상 어휘로 풀이. 마지막 1문장 오늘 1개 실천 행동 단정.`,
    '창작·예술':   `오늘 창작 5포인트로 구체화: (1) 영감이 잘 떠오르는 주제·매체 1가지(글·그림·영상·음악·디자인 중) — 식상(식신·상관) 흐름 + 일진 천간 십성 근거. (2) 권장 작업 단계 1가지(아이디어 스케치 / 초안 작성 / 마무리 다듬기 / 완전 새 시작 중). (3) 창작 흐름이 막히는 함정 1가지(완벽주의·SNS 비교·자기검열 등) + 시간·장소 4요소 ≥2개로 구체화. (4) 창작 환경 1줄(작업실·카페·집 + 시간대). (5) 자기 전 5분 정리 행동(오늘 작업 1줄 메모·내일 시작 지점 표시). 마지막 1문장 오늘의 작은 창작 시도 단정.`,
    '운동·체력':   `오늘 운동 5포인트로 구체화: (1) 권장 강도 1가지(저강도 회복·중간·고강도 중) — 신강신약(${result.strengthStatus})·일주 12운성·일진 합충 근거. (2) 추천 종목 1~2가지(스트레칭·요가·러닝·근력·수영·자전거 중) + 시간 분량(예: 30분). (3) 피해야 할 동작·부위 1가지(오행 결핍 ${zeroEls.length > 0 ? zeroEls.join('·') : '없음'} + 일진 충 근거). (4) 권장 운동 시간대 1구간(아침/오후/저녁 중 일진 지지와 호응). (5) 운동 후 회복 행동 1가지(스트레칭·물·식사). 마지막 1문장 오늘 1개 운동 약속 단정.`,
    '육아·돌봄':   `오늘 육아·돌봄 5포인트로 구체화: (1) 아이/돌봄 대상과 잘 통하는 활동 1가지(독서·산책·놀이·요리 중) — 대인 십성(비견·식상·재성) + 일진 십성 근거. (2) 피하면 좋은 자극 1가지(소음·일정 과밀·낯선 장소·과한 외출). (3) 부모 본인 컨디션 관리 1가지(짧은 자기 시간 확보·식사·수면). (4) 가족 마찰 회피 1가지(말투·체면·즉흥 결정 — 시간·대상 4요소 ≥2개). (5) 자기 전 10분 회복 행동(차·일기·짧은 산책). 마지막 1문장 오늘 1개 작은 약속 단정.`,
    '투자·재테크': `오늘 재테크 5포인트로 구체화: (1) 진입/관망/정리 중 어느 쪽 유리 — 재성(편재·정재) 흐름 + 일진 충(${interTodayStr}) 여부 근거. (2) 회피 신호 1가지(충동 매수·즉결 계약·과한 비중·SNS 정보 추종). (3) 정보 검토에 좋은 시간대 1구간 + 그 시간 무엇을 점검할지(차트·뉴스·포트폴리오 등). (4) 권장 행동 1가지(소액 분할·예산 점검·자동이체 점검·가계부 정리). (5) 큰 금액 의사결정은 다음 날 이후로 미루기 신호 1줄(특히 일진 충 발생 시). 마지막 1문장 오늘 1개 안전 행동 단정.`,
    '인간관계':    `오늘 인간관계 5포인트로 구체화: (1) 잘 풀리는 만남 유형 1가지(가족·친구·동료·연인 중) — 일진 십성·합 근거. (2) 거리를 둘 만한 관계 패턴 1가지(논쟁·SNS 비교·과거 회상 대화 등). (3) 메시지·연락에 좋은 시점 1가지(시간대 + 어떤 톤의 말). (4) 회피 말투·체면 충돌 1가지(시간·장소·대상 4요소 ≥2개). (5) 표현·답례·짧은 안부 1가지 권고(상대·내용 구체화). 마지막 1문장 오늘 1개 관계 행동 단정.`,
    '자기계발':    `오늘 자기계발 5포인트로 구체화: (1) 새 시도 vs 익숙한 것 정리 중 추천 1가지 — 인성(印星)·식상(食傷) 흐름 + 일진 십성 근거. (2) 인풋(독서·강의·정보 수집) vs 아웃풋(실행·기록·발행) 중 효과적인 쪽 1가지. (3) 회피 자기소비 패턴 1가지(SNS·자기계발 영상 폭식·완벽한 계획에만 시간 쓰기). (4) 권장 학습/실행 시간대 1구간 + 어떤 행동에 쓸지. (5) 자기 전 5분 기록 행동(오늘 1줄 회고·내일 1가지 작은 시도 메모). 마지막 1문장 오늘 1개 작은 시도 단정.`,
    '휴식·재충전': `오늘 휴식·재충전 5포인트로 구체화: (1) 권장 휴식 형태 1가지(혼자 조용히 / 가까운 1명과 / 자연 / 실내 중) — 신강신약(${result.strengthStatus}) + 일주 12운성(특히 쇠·병·사·묘·절·태·양 단계인지) + 일진 십성(인성·식신 호응 시 회복 흐름) 근거. (2) 피하면 좋은 자극 1가지(SNS·뉴스·과식·과음·격한 운동·새 자리·즉흥 약속). (3) 회복에 가장 좋은 시간대 1구간(일진 지지 ${todayGz.zhi} 와 육합·삼합 시간) + 그 시간 권장 회복 행동 1가지(낮잠 20~30분·따뜻한 차·짧은 산책 15분·종이책·욕조). (4) 신체 회복 행동 1가지 + 정신 회복 행동 1가지(스트레칭·호흡·일기·식물 돌보기 등). (5) 자기 전 60분 회복 의식 시퀀스(따뜻한 샤워 → 어두운 조명 → 종이책 → 호흡 5분). 마지막 1문장 "오늘은 ~만 하고 푹 쉬어라" 단정 명령형. ★ 새 시도·확장·신규 학습·신규 미팅·고강도 운동 일체 금지로 명시.`,
  };
  // ── 사용자가 선택한 N개 취미 + 직접 입력 모두 본문에 반영 ──
  // 라벨은 "관심 있는 것에 대한 운용법" 고정. N개 모두 별도 미니 가이드.
  const allHobbies = [
    ...ctx.hobbies,
    ...(customHobbyRaw ? [customHobbyRaw] : []),
  ];
  const perHobbyGuides = allHobbies.map((h, i) => {
    // 직접 입력은 매핑 분야 가이드를 fallback 으로 사용하되 원본 단어 그대로 본문에 인용
    const isCustom = h === customHobbyRaw;
    const mapped = isCustom ? (customHobbyMapped ?? '자기계발') : h;
    const baseGuide = hobbyMethodGuide[mapped] ?? hobbyMethodGuide['자기계발'];
    return `  ${i + 1}) 「${h}」${isCustom ? ' (사용자 직접 입력 — 본문에 이 단어 그대로 자연 호칭으로 인용)' : ''}
${baseGuide}`;
  }).join('\n\n');

  const hobbyGuide = allHobbies.length > 0
    ? `사용자가 선택한 ${allHobbies.length}개 관심사 (${allHobbies.join(' / ')}) — 각각에 대해 3~5개 핵심 포인트를 미니 가이드로 풀이. 한 분야로 압축 금지. N개 모두 본문에 명시 인용.\n\n${perHobbyGuides}`
    : hobbyMethodGuide['자기계발'];
  const secondaryGuide = '';
  void primaryHobby; // 마커 변수 — 다른 섹션에서 ${primaryHobby} 인용 호환용으로 유지

  return `당신은 35년 경력의 사주명리·생활처방 전문가입니다. 사용자의 오늘 하루를 만세력 전체 데이터(4기둥·신살·합충·격국·신강·일주특성·운기 4층) + 사용자가 입력한 현재 상황에 근거해 깊고 구체적으로 풀이합니다.

[사고 흐름 — 본문 작성 전 머릿속에서 반드시 거칠 것]

0) ★★★ 사용자 직접 입력 의미 자체 분류 (출력 X, 본문 작성 전 사고만 — 가장 먼저 수행)
   사용자가 직접 입력한 값이 있으면(아래) 그 의미를 LLM 자체 판단으로 분류한다. 예시 목록에 없어도 의미 추론으로 자율 라벨링할 것.

   ▣ 직업 직접 입력: "${ctx.customJobState || '없음'}"
     · 단일 직업·역할인지 / 복수(이중 정체성)인지 먼저 식별. 복수면 [primary, secondary] 두 라벨 모두 추출하고 둘 다 본문에서 다룰 것.
       예) "변호사+부동산" → primary=전문직(법률), secondary=자영업(부동산 투자/운영) — 두 영역의 시간 분배·시너지·갈등을 본문에 녹임.
       예) "의사+음식점 사업" → primary=의료, secondary=요식업 운영 — 본업 컨디션과 사업 운영 사이의 에너지 분배를 본문에 녹임.
       예) "직장인이면서 부업 유튜브" → primary=직장인, secondary=크리에이터 — 양쪽 모두 톤·장면에 등장.
     · 단일이면 → 6개 표준 jobState 중 가장 가까운 것 + 그 분야 특수성 키워드 2~3개 추출 (예: "건설업" → 직장인/자영업 + [현장 안전, 체력, 자격증]).
     · 비표준 상황(이직·창업·휴직·시험 준비·번아웃 등) → 그 상황 자체를 라벨로 (예: "이직 준비중" → [이직기], "창업 초기" → [창업기]).

   ▣ 연애 직접 입력: "${ctx.customLoveState || '없음'}"
     · 5종 표준(싱글/호감/연애중/기혼/공개안함) 매핑이 자연스럽지 않은 비표준 케이스는 별도 라벨로:
       - "양다리걸치는중" → [다중관계] — 두 관계 사이 균형·발각 리스크·시간 분배
       - "바람피는중" → [은밀관계] — 외부 관계 유지·노출 위험·이중 일상
       - "세컨드" → [위치 비대칭] — 정해진 자리 옆·연락 비대칭·자기 위치 자각
       - "썸인데 연인있음" → [정리 미완] — 곁의 사람과 새 끌림 동시·정리 시점
       - "이별 직후 새 사람" → [재정리기]
       - "썸 타는중" → [관계 형성기]
       - "이별 직후" → [회복기]
     · 예시 없는 케이스는 LLM이 자율 라벨링(2~4글자 + 부연 1줄).
     · 도덕 판단·훈계·"멀리하라" 식 어휘 절대 금지 — 명리 흐름 + 사용자 실제 상황 매칭한 객관·실용 조언만.

   ▣ 관심사·시간 쏟는 분야 — 칩 N개 + 직접 입력: 총 ${allHobbies.length}개 ${allHobbies.length > 0 ? `(${allHobbies.join(' / ')})` : '(없음)'}
     · 사용자가 선택한 칩 N개와 직접 입력 1개가 합쳐져 총 ${allHobbies.length}개 분야가 있다. ${allHobbies.length}개 모두 본문에 똑같이 무게 두고 다룰 것 — 1개로 압축 또는 일부만 풀고 나머지 한 줄로 끝내는 행위 금지.
     · 직접 입력은 9분야 자동 매핑 + 사용자 원본 표현 보존. 매핑 어색하면 LLM 자율 분야 선택.
     · ${allHobbies.length}개 분야 각각이 일진(${todayGz.gan}${todayGz.zhi}) 십성·합충과 어떻게 다르게 만나는지 분야별로 다른 결을 잡아낼 것. 같은 행동 권고 복붙 금지.
     · [today_hobby_method] 본문은 ${allHobbies.length}개 미니 단락(각 2~3문장) + 마지막 종합 1문장 구조 강제.

   ▣ 카드 슬롯 사전 배치 (위 분류 결과를 다음 카드에 어떻게 녹일지 본문 작성 전 1줄씩 머릿속으로 미리 결정)
     - [today_persona_extra]: 직업 라벨(복수면 둘 다) 본문 5~6요소에 분배. 복수 직업이면 한쪽만 풀고 끝내지 말 것.
     - [today_relationship]: 연애 비표준 라벨을 자연 호칭으로 1회 + 그 상황 특수 권장 행동·조심할 말투.
     - [today_hobby_method]: 취미 N개 모두 미니 단락.
     - [today_caution]: 비표준 라벨에서 파생되는 함정 1줄 (다중관계 → 발각 가능 자리·말실수 / 복수 직업 → 두 영역 시간 충돌·둘 다 못 챙김 등). 직업·연애 호칭 반복 금지, 의미만 다른 측면으로.
     - [today_strength]: 비표준 라벨에서 운을 쓰는 방향 1줄 (다중관계 → 균형 유지의 명리적 결 / 복수 직업 → 두 영역이 만나 빛나는 순간 등).
     - [today_oneliner]: 라벨 종합한 한 줄 결.

1) 일진(${todayGz.gan}${todayGz.zhi})의 천간·지지·십성·합충을 [명리 의미 KB]에서 의미로 옮긴다.
2) 4층 운기(대운·세운·월운·일진)가 오늘 어떻게 겹쳐 작용하는지 1줄로 정리한다.
3) 사용자 답변(있다면)의 [답변 자동 분류 결과]를 본 후 [섹션별 비중·강조점 분기 가이드] 적용 + jobState 분기 + 'other' 케이스는 [자유 입력 답변 처리] 자율 분류.
4) 각 섹션을 [데이터 인용 → 일상 인과 → 구체 장면 → 행동 권고] 4단 구조로 작성한다.

${SAJU_KB_BLOCK}

${SECTION_BRANCH_RULES_BLOCK}

${JOB_STATE_BRANCH_BLOCK}

${PERSONA_EXTRA_BRANCH_BLOCK}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[사주 원국 — 만세력 전체]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${pillarDetail}

일간: ${dayMaster}(${pillars.day.ganElement}·${dayMasterYinYang}간)  성별: ${gender === 'male' ? '남성' : '여성'}
오행 분포: 목${elementPercent.목}% 화${elementPercent.화}% 토${elementPercent.토}% 금${elementPercent.금}% 수${elementPercent.수}%
${elementNote}
${strengthBlock}
용신: ${yongSinElement}(${result.yongSin})  희신: ${result.heeSin}  기신: ${result.giSin}
격국: ${gyeokguk.name} (${gyeokguk.reason})
십성 분포: ${sipseong}
원국에 0개인 십성: ${missingSipseongStr}
   → "사주에 ~십성이 강하다/있다/약하다"로 서술 금지. "원국에 없는 ~" 또는 "~이(가) 부재한 사주"로만.
길성: ${sinSalGood}
신살: ${sinSalBad}
(※ 신살의 길/흉/중립은 학파마다 다름 — description 어휘로 판단)
원국 합충형파해: ${interStrOrigin}
간여지동: ${formatGanYeojidong(result)}
병존·삼존: ${formatByeongjOn(result)}

${dayTraitsBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[운기 4개 층 — 본문 모든 섹션에서 활용]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
대운(현재 10년): ${daeWoonStr}
세운(올해): ${seWoonStr}
월운(이번 달): ${monthRunStr}
일운(오늘 일진): ${todayGz.gan}${todayGz.zhi}(${todayGz.hanja}) — ${todayGz.ganElement}·${todayGz.zhiElement}
   천간 십성: ${todayGz.tenGodGan} / 지지 십성: ${todayGz.tenGodZhi}${todayHidden ? ` / 일진 지장간: ${todayHidden}` : ''}
일진×원국 합충: ${interTodayStr}

[오늘 날짜] ${dateLabel}

${userInputBlock}

${WRITING_RULES_BLOCK.replace('${todayGz_label}', `${todayGz.gan}${todayGz.zhi}`)}

[추가 — 분량·문단·동적 분기 룰]
· 분량 하한: 14섹션 합산 3300자 이상 목표 (today_persona_extra 추가 + 분기 적용으로 일부 섹션 +25~40%이므로 상향. 토큰 더 쓰더라도 각 섹션을 풍부히).
· 문단 나누기: 서로 다른 주제·항목·시간대는 반드시 빈 줄(줄바꿈 2회)로 문단을 나눈다.
· ★★★ 사용자 입력값 인용 — 카드별 분산 강제 (반복 금지)
  사용자 입력 (취미·직업·연애·시간대·답변) 을 모든 카드에 똑같이 박지 말 것. 카드별로 정해진 슬롯에서만 인용:
  - [today_basis]: 시간대(${slotLabel}) 호칭 1회만 (다른 입력 인용 금지)
  - [today_hobby_method]: 취미 N개 모두 (이미 룰 적용됨)
  - [today_persona_extra]: 직업(${ctx.customJobState || ctx.jobState}) 자연 호칭 1회
  - [today_relationship]: 연애(${ctx.customLoveState || ctx.loveState}) 자연 호칭 1회
  - [today_timeflow / today_sleep / today_meal / today_exercise / today_caution / today_strength / today_oneliner]: 사용자 입력 호칭 반복 인용 금지. 만약 인용하려면 같은 답변/입력을 다른 측면(시간·행동·감정·환경)으로 변형해서만 1회 짧게.
  같은 문장 패턴("당신은 X 하셨으니..." / "X 라고 하셨으니...") 을 여러 카드에서 반복하면 사고로 간주.

· ★★★ 사용자 직접 입력 자연 호칭 변환 — 원형 박기 금지
  사용자가 직접 입력한 단어/문장 (있는 경우만):
  - 취미 직접 입력: ${customHobbyRaw || '없음'}
  - 직업 직접 입력: ${ctx.customJobState || '없음'}
  - 연애 직접 입력: ${ctx.customLoveState || '없음'}
  위 직접 입력 값이 "없음"이 아니면:
  (1) 원형 그대로 박지 말 것. 따옴표·괄호 인용도 금지.
  (2) 한국어 자연 호칭/서술로 변환하여 해당 매핑 카드(아래)에서 1회만 사용.
  (3) 핵심 키워드는 반드시 보존.
  매핑:
  - 취미 직접 입력 → [today_hobby_method] 카드 내 해당 분야 미니 단락 첫 줄
  - 직업 직접 입력 → [today_persona_extra] 카드 첫 줄·본문
  - 연애 직접 입력 → [today_relationship] 카드 첫 1~2 문장
  변환 예시 (단일 직업·일반):
    · "건설업에 일함" → "건설 일을 하고 계시는군요" / "건설 현장에 계신 분께"
    · "이직 준비중" → "이직을 준비하시는 중이군요" / "이직을 준비하는 시기"
    · "필라테스" → "필라테스를 좋아하시는 분께" / "필라테스로 몸을 다듬는 분께"
    · "공무원 준비" → "공무원 시험을 준비하시는 중이군요"
    · "스타트업 운영" → "스타트업을 운영하시는 분께"

  변환 예시 (복수 직업·이중 정체성 — 두 라벨 모두 본문에 등장):
    · "변호사+부동산" → "법률 현장과 부동산을 함께 다루시는 분께" / "재판·계약을 보는 손과 자산을 굴리는 손이 함께 있는 하루"
    · "의사이면서 음식점 사업" → "환자를 보시면서 가게도 함께 운영하시는 분께" / "진료 시간 끝나면 가게가 기다리는 하루"
    · "직장인 + 부업 유튜브" → "회사 일을 마치고 콘텐츠도 만드시는 분께"
    · "교사이면서 작가" → "수업 시간 외에 글도 쓰시는 분께"
    ★ 복수 직업은 한쪽만 풀고 끝내지 말 것. [today_persona_extra] 본문 6요소에 두 영역을 시간 분배·시너지·갈등 관점에서 모두 다룬다.

  변환 예시 (연애 비표준 — 도덕 판단 절대 금지, 객관 호칭만):
    · "바람피는중" → "은밀한 관계를 이어가고 계신 상황" / "공개되지 않은 관계 안에 계신 분"
    · "양다리걸치는중" → "두 관계 사이에 서 계신 상황" / "양쪽을 동시에 마음에 두신 시기" — '두 관계의 균형·발각 가능성·시간 분배' 의미 보존
    · "세컨드" → "정해진 자리 옆에 머무르시는 관계" / "두 번째 자리의 시기"
    · "썸인데 연인있음" → "이미 곁에 있는 사람과 따로 끌리는 마음이 함께 있는 시기"
    · "이별 직후 새 사람" → "지난 관계가 채 정리되지 않은 채 새 인연이 들어온 시기"
    · "썸 타는중" → "썸을 타고 계신 상황"
    · "이별 직후" → "이별을 막 겪으신 시기"
    · "장거리 연애" → "거리를 두고 마음을 잇고 계신 관계"
    · "권태기" → "관계가 잠시 쉼표를 찍은 시기"

  ★ 예시에 없는 입력도 LLM 자체 의미 추론으로 변환 — 핵심 키워드(다중/은밀/거리/정리미완/이중정체성 등)는 호칭에 반드시 보존.
  ★ 직접 입력이 일반 분기(싱글/연애중/기혼/직장인/주부 등) 와 맞지 않으면 일반 분기 우회 금지 — 직접 입력의 실제 상황으로 자율 작성.
  ★ 도덕적 판단·훈계 금지 (특히 연애 비표준 상황) — "멀리하라" / "정리하라" / "옳지 않다" 같은 어휘 절대 사용 금지. 명리 흐름 + 사용자 상황 매칭한 객관·실용 조언만.
  ★ 비표준 라벨이 [today_caution] [today_strength] [today_oneliner] 에도 의미적으로 녹아야 한다 (직접 호칭 반복 금지 — 의미를 다른 측면(시간·환경·말투·균형)으로 변형해 1회씩 짧게).
· 만세력 수치(격국·용신·신강·오행%·십성·신살·합충)는 임의로 뒤집거나 변경 금지.
· ★★ 동적 분기 강제: [답변 자동 분류 결과](${allGroupsCode})에 매칭되는 그룹의 [섹션별 비중·강조점 분기 가이드]를 9개 본문 섹션(today_basis ~ today_persona_extra ~ today_oneliner)에 모두 적용. 그룹이 여럿이면 누적 적용. 같은 사주라도 답변이 다르면 풀이가 확연히 달라야 한다. 분기 미적용 = 사고로 간주.
· ★★ 직업 맞춤 카드 강제: [today_persona_extra] 카드는 jobState=${ctx.jobState} 에 해당하는 [today_persona_extra 직업/상황 맞춤 포인트 카드] 가이드를 그대로 따름. 학생/직장인/자영업/구직중/주부/기타 6종 중 jobState 에 따라 카드 라벨·콘텐츠가 완전히 달라야 한다.
· ★★ 직업 상태 분기 강제: [직업 상태별 본문 톤·장면 분기 가이드]의 jobState=${ctx.jobState} 항목대로 본문 등장 장면을 그 직업 일상으로 맞춤. 답변 칩이 직업과 안 맞으면 jobState 우선으로 톤 변형 (예: 주부 + "회의·미팅" → "가족 모임 자리"로).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[★★★ 마커 출력 절대 규칙 ★★★]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- 본문 텍스트 안에 [today_xxx] 형태의 어떤 마커도 노출되면 안 됩니다 (사용자에게 그대로 보임 = 사고).
- 사용 가능한 마커는 정확히 아래 13개. 다른 어떤 변형도 사용 금지:
  [today_scores] [today_flow] [today_basis] [today_hobby_method] [today_timeflow]
  [today_sleep] [today_meal] [today_exercise] [today_relationship] [today_caution]
  [today_strength] [today_persona_extra] [today_oneliner]
- 마커는 반드시 줄 처음에 단독으로 위치 (앞뒤 \`**\`, \`#\`, \`-\`, \`>\`, 콜론 \`:\` 모두 금지).
- 마커 형식 변형 금지: \`[todayhobbymethod]\` (밑줄 누락), \`[today hobby method]\` (공백), \`[today-hobby-method]\` (하이픈), \`【today_hobby_method】\` (전각괄호) 모두 사고로 간주.
- 마커는 한 번씩만 등장 (각 섹션당 1회). 본문 안에 같은 마커를 다시 인용하지 말 것.
- 섹션 헤더("운용법", "수면 루틴" 등) 텍스트는 본문에 쓰지 말 것 — UI에서 자동 표시됩니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[점수 출력 — 본문 가장 먼저 두 줄, 정확히 이 형식]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
첫 줄(반드시):
[today_scores] 종합:XX 시험:XX 공부:XX 멘탈:XX 대인:XX 이성:XX 금전:XX 운동:XX 회복:XX 횡재:XX
- 종합 점수는 반드시 60~97 정수 범위. 9개 항목별 점수는 55~97 정수 범위.
- ★ 어떤 흉운·어떤 페널티 누적에도 종합은 60 미만으로 내려가지 않는다 (사용자 경험 보호 — 결정론적 엔진과 일관).
- 9개 항목 중 비-종합 점수의 표준편차 8 이상. 비슷한 점수 나열 금지.
- 최고/최저 차이 20 이상.
- 사용자 ${ctx.jobState}·${ctx.loveState}에 의미 있는 항목 가중 (학생→시험·공부, 연애 중→이성·대인, 직장인→금전·멘탈 등).

종합 점수 anchor (반드시 이 분포 내에서 산출):
- 용신(${yongSinElement})이 일진(${todayGz.gan}${todayGz.zhi}) 천간 또는 지지 오행과 일치 → 종합 85~95
- 일진 천간 십성이 정관·정인·정재·식신 또는 합·삼합·반합 多 → 종합 78~88
- 평범한 날(눈에 띄는 보너스·페널티 없음) → 종합 72~80
- 기신(${result.giSin}) 강림·충·형 多·상관/겁재 작용 → 종합 65~73
- 극단적 흉운(다중 충+상관견관+신약+편관 등) → 종합 60~65 (절대 60 미만 금지)

- 질문 답변이 점수에 영향 (소폭 조정만 — 답변 누적 페널티가 종합점수를 흔들지 않도록):
  · 컨디션 답변이 "많이 피곤·조금 피곤·긴장됨" → 회복·멘탈 -3~-7.
  · 컨디션이 "매우 좋음" → 멘탈·운동 +3~+7.
  · 감정이 "후회·불안·답답한·지친" → 멘탈 -3~-6.
  · 감정이 "뿌듯함·즐거운·보람찬·평온함" → 멘탈·횡재 +3~+7.
  · "특별한 고민 없음·별 생각 없음" 등 무난 답변은 점수 영향 미미.
  · 고민이 "돈·경제" → 금전 -3~-5, "건강" → 회복 -3~-5.
  · 답변과 무관한 항목 점수는 영향 없음.
  · ★ 답변 페널티가 누적되어도 종합점수는 60 미만, 항목점수는 55 미만으로 내려가지 않는다.

둘째 줄(반드시):
[today_flow] 자정:XX 아침:XX 오후:XX 저녁:XX
- 각 시간대 50~95 정수. 4개 점수 표준편차 8 이상 (가장 약한 시간대도 50 미만 금지).
- 일진 지지(${todayGz.zhi})·월운·시간 12지 흐름을 반영해 자연스러운 곡선.
- 사용자 진입 시간대(${slotLabel}) 점수가 본문 풀이의 근거가 되도록.
- 진입 시간대 점수는 답변 영향도 받음: 컨디션 "많이 피곤"·"긴장됨"이면 진입 시간대 점수 -5 안팎, "매우 좋음"·"기대되는 일"이면 +5 안팎으로 자연스럽게 반영(누적되어도 50 미만 금지).

[은유 부제목 규칙 — 모든 본문 섹션 공통]
${METAPHOR_KB}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
이제 아래 11개 본문 섹션을 [key] 마커 + 줄바꿈 + 은유 제목 + 줄바꿈 + 본문 형태로 작성합니다.
출력 순서: [today_scores] → [today_flow] → [today_basis] → [today_hobby_method] → [today_timeflow] → [today_sleep] → [today_meal] → [today_exercise] → [today_relationship] → [today_caution] → [today_strength] → [today_persona_extra] → [today_oneliner]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[today_basis] — 분기 분량(아래 ★ 참조)
첫 줄: 은유 제목.
본문 5요소 구조 (모두 포함, 자연스러운 문단으로):
1) 일진(${todayGz.gan}${todayGz.zhi}, ${todayGz.ganElement}·${todayGz.zhiElement}) 천간/지지의 의미를 1~2문장으로 풀이.
2) 그것이 내 일간(${dayMaster}·${pillars.day.ganElement})·용신(${yongSinElement})·기신(${result.giSin})과 어떻게 만나는지 단정 1~2문장.
3) 4층 운기(대운·세운·월운·일진) 중 오늘 가장 강하게 작용하는 층 1개 지목 + 그 이유 1문장.
4) 일진×원국 합충(${interTodayStr}) 또는 일주 12운성(${pillars.day.twelveStage})이 오늘 어떻게 작용하는지 1문장.
5) 신강신약(${result.strengthStatus}) 관점에서 오늘이 일간에 유리/불리한지 + 한 줄 정리(오늘의 명리적 결).
★ 분기 적용(${allGroupsCode}): [섹션 분기 가이드]의 today_basis 항목대로 강조점·관점 변형. 기본 320~420자, 분기에 따라 ±20%.

[today_hobby_method] — 분기 분량(아래 ★ 참조) (관심 있는 것에 대한 운용법 — 사용자가 선택한 N개 분야 모두 풀이)
첫 줄: 은유 제목.
본문: ${hobbyGuide}
${secondaryGuide}
${q1Filled || q2Filled ? `사용자 답변(${q1Filled ? `Q1 "${q1Filled}"` : ''}${q1Filled && q2Filled ? ' / ' : ''}${q2Filled ? `Q2 "${q2Filled}"` : ''}) 중 본 섹션과 직접 관련 있는 답변이 있으면, 그 키워드를 본문에 1회 노출하고 일진 ${todayGz.gan}${todayGz.zhi} 십성(${todayGz.tenGodGan}/${todayGz.tenGodZhi})과 어떻게 맞물리는지 1~2문장으로 풀이. 관련성이 약한 답변은 여기서 다루지 말고 해당 매핑 섹션에서 처리.` : '시간대 질문 답변이 없으므로, 입력하지 않은 부분을 추정해 만들지 말고 일반 가이드로.'}
★★ 분야 N개 모두 풀이 강제: 사용자가 선택한 모든 관심사 (${allHobbies.length > 0 ? allHobbies.join(', ') : '없음'}) 를 본문에 각각 1개 미니 단락(2~3문장)으로 풀이. 한 분야만 길게 쓰고 나머지를 줄여서 마지막에 한 줄 언급하는 방식 금지. 분야별 미니 단락 N개 → 마지막 종합 1문장 형식으로 구성.
★ 각 분야별 미니 가이드의 5포인트는 자연스럽게 압축해 2~3문장으로. 단 핵심 행동·시간대·회피 항목은 누락 금지.
마지막 1문장은 오늘 한 가지 실천 행동을 단정 명령형 문장으로 마무리.
★ 분기 적용(${allGroupsCode}): [섹션 분기 가이드]의 today_hobby_method 항목대로 강도·작업 방식 변형. 기본 420~540자, 분기에 따라 ±25% (rest 그룹 시 +20%, condition_low 시 +15%, 작업 좁히면서 회복 행동까지).

[today_timeflow] — 380~500자 (시간대별 흐름)
첫 줄: 은유 제목.
★ 형식 필수: 4개 시간 구간을 각각 별도 문단(빈 줄로 구분)으로 나눠 쓴다. 한 덩어리로 뭉치지 말 것.

자정(00~06시) — 이 시간대의 기운과 흐름 1~2문장. [today_flow] 점수와 일관.

아침(06~12시) — 이 시간대의 기운과 흐름 2~3문장. 출근·오전 업무 등 실전 장면으로.

오후(12~18시) — 이 시간대의 기운과 흐름 2~3문장. 점심 약속·오후 회의·외출 등 장면으로.

저녁(18~24시) — 이 시간대의 기운과 흐름 2~3문장. 퇴근 후·저녁 식사·하루 마무리 장면으로.

사용자 진입 시간(${slotLabel})에 더 자세히 — 어떤 행동을 하면 좋고 어떤 것을 하면 손해인지 1~2가지 실전 조언. 가장 집중이 잘 되거나 운이 강한 1구간 명시 + 이유 (일진 지지 ${todayGz.zhi} 와의 12지 관계 근거).
★ 분기 적용(${allGroupsCode}): [섹션 분기 가이드]의 today_timeflow 항목대로 권장 활동·집중 시간 변형. 기본 380~500자, 분기에 따라 ±15%.

[today_sleep] — 분기 분량(아래 ★ 참조)
첫 줄: 은유 제목.
본문 4요소 구조:
1) 권장 취침/기상 시각 구체적으로 (예: 23:30~24:00 취침, 06:30~07:00 기상) + 다음날 컨디션 근거 1줄.
2) 잠들기 전 60분 자극 회피 의식 2~3가지(스마트폰·카페인·뉴스·격한 운동 등 명시).
3) 잠들기 좋은 회복 의식 시퀀스 1세트(예: "따뜻한 샤워 → 어두운 조명 → 종이책 → 호흡 5분") — 용신 ${yongSinElement} 또는 결핍 오행(${zeroEls.length > 0 ? zeroEls.join('·') : '없음'})에 맞춘 행동 1개 포함.
4) 침구·환경 1줄(이불 두께·실내 온도·향초·물 한 컵 등).
★ 분기 적용(${allGroupsCode}): [섹션 분기 가이드]의 today_sleep 항목대로 변형. condition_low·concern_health 시 분량 +30%, rest 시 분량 +40%, emotion_negative 시 분량 +25% (취침 시각 더 이르게·이완 의식 상세). 기본 240~320자.

[today_meal] — 분기 분량(아래 ★ 참조)
첫 줄: 은유 제목.
본문 4요소 구조:
1) 용신(${yongSinElement})·결핍 오행(${zeroEls.length > 0 ? zeroEls.join('·') : '없음'})을 보강하는 추천 음식 2가지 — 맛·색·재료 구체적으로(예: "녹색 잎채소·신맛 — 봄나물 무침").
2) 피해야 할 음식 1가지 + 이유(과다 오행 또는 자극 회피).
3) 권장 식사 시간대 1구간 + 식사 톤 1줄(혼자 조용히 / 가족과 / 천천히 30분).
4) 따뜻한 음료·차 1가지 추천(시간대 + 효능 1줄).
★ 분기 적용(${allGroupsCode}): [섹션 분기 가이드]의 today_meal 항목대로 변형. condition_low·concern_health·rest 시 회복 음식 강조 + 자극적 음식 명시 회피, people 시 식사 자리·차 자리 톤 1줄, emotion_negative 시 따뜻한 색·단맛 식재료 권장. 기본 240~320자.

[today_exercise] — 분기 분량(아래 ★ 참조)
첫 줄: 은유 제목.
본문 4요소 구조:
1) 오늘 운동 가능 여부·권장 강도(저강도/중간/고강도) — 신강신약(${result.strengthStatus})·일진 합충(${interTodayStr}) 근거.
2) 추천 종목 1~2가지 + 분량(예: "스트레칭 10분 + 산책 20분", "근력 운동 40분").
3) 피해야 할 동작·종목 1가지 + 이유(오행 결핍·과다 + 일진 충 근거).
4) 일진 ${todayGz.zhiElement} 오행이 신체 어느 부위(간·심·비·폐·신)와 연결되는지 + 그 부위 보호 행동 1줄.
${ctx.jobState} 상황과 무리 없이 어울리도록.
★ 분기 적용(${allGroupsCode}): [섹션 분기 가이드]의 today_exercise 항목대로 강도 변형. condition_low·rest·concern_health 시 저강도 회복(스트레칭·산책)만 — 운동 비추천 시 그 자체가 처방임을 단정. condition_high 시 중강도 권장 가능 + 새 종목 시도 OK. 기본 220~300자.

[today_relationship] — 240~320자 (대인·이성)
첫 줄: 은유 제목.
본문: 오늘 일진 십성(${todayGz.tenGodGan}) 기준 잘 통하는 관계 유형 + 마찰 유형.

★★★ 직접 입력 우선 분기 (customLoveState="${ctx.customLoveState ?? ''}")
${ctx.customLoveState?.trim()
  ? `  · 사용자가 직접 입력한 연애 상황 "${ctx.customLoveState}" 을 그대로 분기 기준으로 사용 (일반 분기 매핑에 끼워 맞추지 말 것).
  · 본 카드 본문 1~2 문장 내에 이 입력을 자연 호칭으로 1회 변환 인용 (예: "바람피는중" → "은밀한 관계를 이어가고 계신 상황", "썸 타는중" → "썸을 타고 계신 상황", "이별 직후" → "이별을 막 겪으신 시기").
  · 그 입력 상황에 맞춰 오늘 권장 행동 1개·조심할 말투/상황 1개를 자율 작성. 도덕적 판단·훈계 금지, 명리 흐름과 사용자 상황을 객관적으로 매칭하여 실용적 조언만 제공.`
  : `  · 일반 연애 상태 분기:
${ctx.loveState === '싱글' ? '    · 인연 들어오기 쉬운 상황·장소 1가지 (구체적으로).' : ''}
${ctx.loveState === '호감 있는 상대 있음' ? '    · 호감 표현·연락 타이밍 1가지 + 조심할 말투.' : ''}
${ctx.loveState === '연애 중' ? '    · 파트너와의 흐름 1문장 + 권장 행동 1개.' : ''}
${ctx.loveState === '기혼' ? '    · 배우자·가족과의 흐름 1문장 + 권장 행동 1개.' : ''}
${ctx.loveState === '공개 안 함' ? '    · 일반적인 인간관계 흐름 + 가까운 사람과의 권장 행동 1개.' : ''}`
}

대인관계에서 오늘 조심할 말투·상황 1개 명시.
★ 분기 적용(${allGroupsCode}): [섹션 분기 가이드]의 today_relationship 항목대로 변형. people 그룹이면 분량 +30% + 답변 관계 유형(가족/친구/연인/동료) 명시 인용. 기본 240~320자.

[today_caution] — 분기 분량(아래 ★ 참조)
첫 줄: 은유 제목.
본문 4요소 구조:
1) 오늘 합충(${interTodayStr})에서 생기는 실수 유발 상황 1가지 — 구체적 장면(시간·장소·대상·말 4요소 ≥3개).
2) 멘탈이 흔들리기 쉬운 포인트 1가지(어떤 상황·말·생각이 무너뜨리는지 — SNS·과거 회상·자책·비교·즉흥 결정 등).
3) 신살(흉성: ${sinSalBad}) 중 1개라도 오늘 일진과 연결되면 그 영향까지 1줄.
4) 위 함정 1·2를 피하는 대처 방법 1문장(실천 가능한 단정 명령형).
★ 분기 적용(${allGroupsCode}): [섹션 분기 가이드]의 today_caution 항목대로 변형. emotion_negative·work_pressure·concern_money·rest 시 분량 +25% + 해당 그룹의 구체 함정 명시. 기본 260~340자.

[today_strength] — 분기 분량(아래 ★ 참조)
첫 줄: 은유 제목.
본문 4요소 구조:
1) 오늘의 운을 가장 잘 쓰는 행동 1가지 — 구체 장면(시간·장소·대상·말 4요소 ≥2개).
2) 그것과 다른 결의 행동 1가지 추가(앞과 다른 시간대·다른 영역).
3) 신살(길성: ${sinSalGood}) 중 오늘 활용 가능한 것이 있으면 짧게 짚기 + 활용 방법 1줄.
4) 사용자 취미(${primaryHobby})·시간대(${slotLabel})와 자연스럽게 연결 1줄.
★ 분기 적용(${allGroupsCode}): [섹션 분기 가이드]의 today_strength 항목대로 변형. emotion_positive·condition_high 시 분량 +30% (적극형 행동·도전·외부 활동·새 만남 권장). condition_low·emotion_negative 시 회복형 행동 1~2개로 단순화하되 시간·장소·분량 더 구체화. rest 시 회복 행동 2~3개로 분량 +30%. 기본 240~320자.

[today_persona_extra] — 300~380자 (직업/상황 맞춤 포인트 카드)

★★★ 직접 입력 우선 분기 (customJobState="${ctx.customJobState ?? ''}")
${ctx.customJobState?.trim()
  ? `사용자가 직접 입력한 직업 상황 "${ctx.customJobState}" 를 그대로 분기 기준으로 사용 (일반 학생/직장인/주부 가이드 우회 금지).
첫 줄: 사용자 직접 입력 상황에 맞는 자연 호칭 1줄 (예: "건설업에 일함" → "건설 현장의 하루를 어떻게 보낼지", "공무원 준비" → "수험 시기의 하루를 어떻게 다질지", "이직 준비중" → "이직을 준비하는 시기의 하루").
본문: 사용자 입력 상황(예: "건설업"·"공무원 준비"·"이직"·"창업" 등)에 실제로 맞는 5~6개 구체 행동 가이드를 LLM 자율 작성 — 일반 직장인 가이드 복붙 금지, 입력 직업/상황의 특수성 반영(현장 안전·체력 관리·자격증 시험·서류 준비·면접 등). 만세력(일진 ${todayGz.gan}${todayGz.zhi}·십성 ${todayGz.tenGodGan}/${todayGz.tenGodZhi}·합충·용신 ${yongSinElement})과 결합.`
  : `jobState=${ctx.jobState} 분기 적용:
첫 줄: jobState=${ctx.jobState} 에 해당하는 [today_persona_extra 직업/상황 맞춤 포인트 카드] 가이드의 카드 첫 줄 라벨을 그대로 또는 한국 자연 결로 짧게 변형해서 1줄 작성. (예: 학생 → "오늘의 학습 습관 한 가지", 주부 → "오늘의 나만의 시간")
본문: 위 [today_persona_extra] 가이드의 jobState=${ctx.jobState} 항목의 5~6개 콘텐츠 요소를 모두 포함해 자연스러운 3~4 문단으로 풀어쓰기. 만세력(일진 ${todayGz.gan}${todayGz.zhi}·십성 ${todayGz.tenGodGan}/${todayGz.tenGodZhi}·합충·용신 ${yongSinElement})과 결합.`
}
다른 섹션과 같은 행동 반복 금지 — 본 카드는 직업·상황 특수 행동 5~6개에 집중.
사용자 답변(${q1Filled || '미답'} / ${q2Filled || '미답'})이 있으면 본문에 1회 자연스럽게 인용.
마지막 1문장은 단정 명령형으로 마무리.

[today_oneliner] — 60~110자 (한줄 결론)
은유 제목 없이 본문만. 직설적으로, 오늘 하루를 관통하는 핵심 한 문장. 사용자 상황(${primaryHobby}·${ctx.jobState}·${ctx.loveState})을 손에 잡힐 듯 짚어주는 어조.
★ 분기 적용(${allGroupsCode}): emotion_positive·condition_high 시 추진형·긍정 톤("오늘은 ~하라" 단정 명령). emotion_negative 시 단정하되 따뜻한 톤("오늘은 ~해도 괜찮다" 결). rest 시 회복 톤. 분량 그대로 60~110자.

[금지 — 한 번 더 강조]
- 본문 안에 [today_xxx] 마커 노출 (사고).
- 마커 형식 변형 ([todayhobbymethod] / [today-hobby-method] 등) 사용.
- 입력하지 않은 정보 추정으로 시나리오 만들기.
- 일반론·격언 풀이.
- 분량 하한 미만.
- 같은 표현·문장 반복.

출력 시작 — [today_scores] 마커부터, 정확히 위 형식대로.`;
};
// 차별 포인트: 오늘운세는 "오늘 흐름 점검", 지정일은 "이 날을 어떻게 보낼지/돌아볼지"의 의도 중심.
// 7섹션 구조 — 핵심 / 시간대 흐름 / 시도하면 좋은 일 / 피하면 좋은 일 / 인연·환경 / 처방 / 마무리
// ─────────────────────────────────────────────

export const PICKED_DATE_SECTION_KEYS = [
  'date_essence',   // 이 날의 핵심 — 일진과 일간의 관계, 기운 한 줄 정수
  'date_timeflow',  // 시간대별 흐름 — 아침·낮·저녁·밤 4구간 길흉 결
  'date_yes',       // 시도하면 좋은 일 — 카테고리 3~4개 구체 권고
  'date_no',        // 피하면 좋은 일 — 함정·실수 패턴
  'date_people',    // 인연·환경 — 도움 되는 사람 유형, 선호 환경 톤
  'date_remedy',    // 부드럽게 하는 처방 — 음식·향·행동 (색·방위는 시각 카드와 중복 금지)
  'date_closing',   // 마무리 한 줄 — 이 날을 어떻게 기억할지
] as const;
export type PickedDateSectionKey = typeof PICKED_DATE_SECTION_KEYS[number];

export const PICKED_DATE_SECTION_LABELS: Record<PickedDateSectionKey, string> = {
  date_essence:  '이 날의 핵심',
  date_timeflow: '시간대별 흐름',
  date_yes:      '시도하면 좋은 일',
  date_no:       '피하면 좋은 일',
  date_people:   '인연과 환경',
  date_remedy:   '부드럽게 하는 처방',
  date_closing:  '이 날을 마무리하는 한 줄',
};

/**
 * 지정일 운세 프롬프트 — generatePickedDateFortunePrompt
 * 입력: 사주 + 지정일 일진(TodayGanZhi 재사용) + 대운/세운/월운 컨텍스트
 * 출력: 7섹션 [key]\n은유 제목\n본문 형식. 총 1500~2000자.
 */
export const generatePickedDateFortunePrompt = (
  result: SajuResult,
  todayGz: TodayGanZhi,
  isoDate: string,
): string => {
  const { pillars, elementPercent, yongSinElement, isStrong, daeWoon } = result;

  const zeroEls = (Object.entries(elementPercent) as [string, number][])
    .filter(([, v]) => v === 0).map(([k]) => k);
  const missingEl = zeroEls.length > 0 ? `결핍: ${zeroEls.join('·')}` : '';

  const [_y, _m, _d] = isoDate.split('-').map(Number);
  const pickedYear = _y;
  const curDW = daeWoon.find(d => d.gan && d.zhi && pickedYear >= d.startAge && pickedYear <= d.endAge);
  const daeWoonStr = curDW
    ? `${curDW.gan}${curDW.zhi}(${curDW.ganElement}${curDW.zhiElement}·${curDW.tenGod}·${curDW.twelveStage})`
    : '없음';

  const seWoon = result.seWoon.find(s => s.year === pickedYear) ?? result.currentSeWoon;
  const interStr = todayGz.interactions.length > 0 ? todayGz.interactions.join(' / ') : '없음';

  const monthSolar = Solar.fromYmd(_y, _m, _d);
  const monthLunar = monthSolar.getLunar();
  const monthGzStr = monthLunar.getMonthInGanZhi();
  const _mGan = normalizeGan(monthGzStr[0]);
  const _mZhi = normalizeZhi(monthGzStr[1]);
  const _mTenGod = TEN_GODS_MAP[result.dayMaster]?.[_mGan] ?? '';
  const _mGanEl = STEM_ELEMENT[_mGan] ?? '';
  const _mZhiEl = BRANCH_ELEMENT[_mZhi] ?? '';
  const monthRunStr = `${_mGan}${_mZhi}(${_mGanEl}${_mZhiEl}${_mTenGod ? `·${_mTenGod}` : ''})`;

  const dateLabel = (() => {
    const d = new Date(isoDate);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  })();

  const today = new Date();
  const isPast = new Date(isoDate).getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const tense = isPast ? '과거 회고' : '미래 점검';

  return `[내 원국]
일간: ${pillars.day.gan}(${pillars.day.ganElement}) / 일주: ${pillars.day.gan}${pillars.day.zhi}
오행: 목${elementPercent.목}% 화${elementPercent.화}% 토${elementPercent.토}% 금${elementPercent.금}% 수${elementPercent.수}% ${missingEl}
용신: ${yongSinElement} / ${isStrong ? '신강' : '신약'}
간여지동: ${formatGanYeojidong(result)} / 병존·삼존: ${formatByeongjOn(result)}

[운기 4개 층 — 모두 본문에서 활용]
대운(10년): ${daeWoonStr}
세운(해당 연도): ${seWoon.gan}${seWoon.zhi}(${seWoon.ganElement}${seWoon.zhiElement}·${seWoon.tenGod})
월운(해당 월): ${monthRunStr}
일운(지정일 일진): ${todayGz.gan}${todayGz.zhi}(${todayGz.hanja}) — ${todayGz.ganElement}·${todayGz.zhiElement} / 천간 십성 ${todayGz.tenGodGan} / 지지 십성 ${todayGz.tenGodZhi}
일진×원국 합충: ${interStr}

[지정 날짜] ${dateLabel}
[관점] ${tense} — ${isPast ? '이 날 어떤 흐름이었는지 명리적으로 돌아보는 톤. 이미 지난 일을 결정론적으로 단정하지 말고, "이런 기운이 있었기 쉬운 날" 정도로.' : '이 날을 어떻게 보내면 좋을지 미리 점검하는 톤. 단정적 행동 권고 OK.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 규칙 — 절대 준수]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1) Markdown·이모지 전부 금지.
2) 총 분량 2000~2800자. 각 섹션 분량 지침을 지키되 한 섹션당 최소 5문장 이상. 내용이 단박에 끝나지 않도록 충분히 풀어서 서술.
3) ★ 핵심 — 본문 전체에서 「대운·세운·월운·일진」 4개 층의 영향을 모두 활용. 일진 한 가지에만 의존하지 말 것.
4) 오늘 운세와 차별 — "오늘 흐름 점검"이 아니라 "이 날을 어떻게 보낼지 / 돌아볼지" 의 의도 중심으로 작성.
5) 일상 장면 구체화 (회의·약속·식사·이동·휴식 등). 추상적 격언·일반론 금지.
6) "운이 좋은 날" "모든 일이 잘 풀립니다" 같은 흔한 칭찬 금지. 어떤 조건에서 어떻게 풀리는지로 쪼개 서술.
7) 출력은 [date_flow] 데이터 줄부터 시작. [date_flow] 다음 줄에 바로 [date_essence] 마커.
8) 아래 7개 본문 마커를 정확히 사용. 마커는 줄 처음에 단독으로 위치, 마커 다음 줄에 은유 제목 1줄, 그 다음 본문 시작.
9) ★ 문단 나누기 — 서로 다른 주제·항목·시간대를 서술할 때 반드시 빈 줄(줄바꿈 2회)로 문단을 나눈다. 한 덩어리로 뭉쳐 쓰지 말 것. 특히 date_timeflow의 4개 시간 구간, date_yes의 3개 항목, date_no의 2개 항목, date_remedy의 4개 처방은 각각 별도 문단으로 분리.

${METAPHOR_SHORT_GUIDE}

[은유 제목 규칙 — 7개 섹션 공통]
- 각 섹션은 [key] 마커 바로 다음 줄에 **은유 제목 1줄**(7~14자, 자연 이미지 대비 형식)을 먼저 씀.
- 제목 다음 빈 줄 없이 본문 시작.
- 본문 첫 문장 또는 마지막 문장에 제목 은유를 자연스럽게 회수.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[데이터 줄 — 반드시 첫 줄에 출력]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[date_flow] 아침:XX 낮:XX 저녁:XX 밤:XX
- 4개 시간대 각각 0~100 정수. 표준편차 10 이상 (평탄 금지).
- 일진 지지(${todayGz.zhi})·용신(${yongSinElement})·월운·합충 흐름을 반영해 자연스러운 곡선.
- 이 점수는 [date_timeflow] 본문 서술과 반드시 일관되어야 함.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[date_essence] — 480~620자
첫 줄: 은유 제목 (이 날 기운의 정수)
★ 형식 필수: 본문을 아래 4문단으로 구성하고 각 문단을 빈 줄(줄바꿈 2회)로 분리. 한 덩어리로 뭉치지 말 것.

1문단(일진의 결): 일진(${todayGz.gan}${todayGz.zhi}, ${todayGz.ganElement}·${todayGz.zhiElement})의 천간·지지 오행이 빚어내는 분위기를 자연 이미지나 계절감으로 풀어낸다(1~2문장). 어떤 결의 하루인지 감각적으로 짚어 독자가 그림이 그려지도록.

2문단(일진×일간 관계): 일진(${todayGz.gan}${todayGz.zhi})과 본인 일간(${pillars.day.gan}·${pillars.day.ganElement})의 십성(${todayGz.tenGodGan}/${todayGz.tenGodZhi}) 관계를 단정적으로 풀이(2~3문장). 이 십성이 본인에게 어떤 동력·기회·위험으로 작용하는지 명확하게. 신강신약(${result.strengthStatus}) 기준으로 일간이 이 일진의 기운을 잘 받아내는지·버거운지 1문장 추가.

3문단(4층 운기의 겹침): 대운(${daeWoonStr.split('(')[0]}) → 세운(${seWoon.gan}${seWoon.zhi}) → 월운(${_mGan}${_mZhi}) → 일진(${todayGz.gan}${todayGz.zhi}) 4개 층이 어떻게 겹쳐 이 날의 기운이 만들어지는지 2~3문장. 4개 층 중 오늘 가장 강하게 작용하는 층 1개를 반드시 명시적으로 지목 + 그 이유 1문장. 일진×원국 합충(${interStr})이 있다면 어느 기둥과 어떤 상호작용인지 1문장 추가.

4문단(한 줄 정수): 이 날의 본질을 한 마디로 단정하며 마무리(1문장).

[date_timeflow] — 360~480자
첫 줄: 은유 제목 (시간의 결을 자연 이미지 대비로)
★ 형식 필수: 4개 시간 구간을 각각 별도 문단(빈 줄로 구분)으로 나눠 쓴다. 한 덩어리로 뭉치지 말 것.

아침(06~12시) — 이 시간대의 기운과 어울리는 활동을 2~3문장으로. 출근길·아침 준비·오전 업무 등 일상 장면으로 구체화.

낮(12~18시) — 이 시간대의 기운과 어울리는 활동을 2~3문장으로. 점심 약속·오후 회의·외출 등 장면으로.

저녁(18~22시) — 이 시간대의 기운과 어울리는 활동을 2~3문장으로. 퇴근 후·저녁 식사·사람 만남 등 장면으로.

밤(22~02시) — 이 시간대의 기운과 어울리는 활동을 2~3문장으로. 하루 마무리·휴식·내일 준비 등 장면으로.

일진(${todayGz.gan}${todayGz.zhi})의 12지지 위치와 용신(${yongSinElement}) 기준으로 가장 좋은 시간대 1개와 가장 약한 시간대 1개를 명시.

[date_yes] — 300~400자
첫 줄: 은유 제목 (이 날 어울리는 행동의 결)
★ 형식 필수: 3가지 항목을 각각 별도 문단(빈 줄로 구분)으로 나눠 쓴다.

본문: 이 날 일진·세운 십성을 근거로 시도하면 좋은 일 3가지를 카테고리별로 (예: 결정·발표·약속·이동·시작·정리·휴식·연락·구매 등).
각 항목마다 어떤 십성·오행 근거로 권하는지 + 구체적인 실행 장면·방법까지 서술. 가장 권장하는 1순위 표시.

[date_no] — 240~320자
첫 줄: 은유 제목 (이 날의 함정·빈틈)
★ 형식 필수: 2가지 항목을 각각 별도 문단(빈 줄로 구분)으로 나눠 쓴다.

본문: 일진×원국 합충(${interStr})을 근거로 피하면 좋은 행동 2가지를 구체 장면으로. 각 항목마다 왜 그런지 명리 근거 + 어떤 상황에서 문제가 되는지 상세히. 만약 어쩔 수 없이 해야 한다면 어떻게 위험을 줄일지 대안 한 마디.

[date_people] — 250~340자
첫 줄: 은유 제목 (이 날의 사람·자리)
본문: 이 날 일진 십성(${todayGz.tenGodGan}) 기준으로 잘 통하는 사람 유형 1~2개와 부담스러운 사람 유형 1개를 구체적으로 (성격·직업·관계 등).

어울리는 환경 톤(혼자 vs 다수, 공식 vs 사적, 실내 vs 야외)을 2~3문장으로 풀어서.

사람 만남 시 좋은 시간대 1구간 + 대화 주제나 분위기 팁.

[date_remedy] — 280~380자
첫 줄: 은유 제목 (이 날을 부드럽게 하는 처방)
본문: 용신(${yongSinElement}) 기운으로 이 날을 보강하는 실천적 처방 — 색상·방위·숫자·시간대는 시각 카드와 중복되므로 절대 본문에 적지 말 것.
★ 형식 필수: 아래 4가지를 각각 별도 문단(빈 줄로 구분)으로 나눠 쓴다.

음식·음료 — 이 날 특히 좋은 구체 식재료 1가지와 왜 이 기운에 어울리는지 효능까지 2문장으로.

향기·아로마 — 추천 향 1가지와 언제·어떻게 사용하면 좋은지 구체적으로.

미니 행동 — 5~10분 안에 할 수 있는 행동 1가지(호흡·산책·정리·기록 중). 구체적 방법과 기대 효과.

마음가짐 — 이 날 하루를 관통하는 태도 한 마디와 그 이유.

[date_closing] — 340~440자
첫 줄: 은유 제목 (이 날을 마무리하는 톤)
★ 형식 필수: 본문을 아래 3문단으로 구성하고 각 문단을 빈 줄(줄바꿈 2회)로 분리.

1문단(전체 흐름 단정): 이 날 전체를 단정적으로 요약 — 어떤 한 가지 흐름이 중심에 있는지 2~3문장. 앞서 풀어낸 핵심 키워드(시간대·시도할 일·인연·처방 중)를 자연스럽게 다시 엮어 독자가 하루의 큰 그림을 한눈에 잡도록.

2문단(가장 가치 있는 1순간 + 한 가지 주의): 이 날에서 가장 가치가 짙어지는 1순간(시간대 1구간 또는 행동 1가지)을 짚고, 그 순간을 어떻게 보내야 의미가 깊어지는지 1~2문장 구체 장면으로. 이어서 반대로 한 가지 조심할 지점을 1문장으로 짧게 짚는다.

3문단(마무리 한 마디): ${isPast ? '과거 날짜이므로 "이 날 이런 흐름이 흘렀을 가능성이 높다"는 회고적 톤' : '미래/오늘이므로 "이렇게 보내면 가장 충실한 하루가 된다"는 점검적 톤'}으로 1~2문장 단정. 마지막 문장에 반드시 첫 번째 섹션 [date_essence]의 은유 제목 키워드 1개를 자연스럽게 다시 호출해 글 전체를 닫는다.

출력 순서: [date_flow] 데이터 줄 → [date_essence] → [date_timeflow] → [date_yes] → [date_no] → [date_people] → [date_remedy] → [date_closing]
[date_flow] 줄 이전에 어떤 텍스트도 없어야 함.`;
};

/**
 * 정통사주 종합 리포트 프롬프트
 * - 원국 전체 분석: 격국·용신·성격·직업·재물·애정·건강·인간관계·대운·처방
 * - 12개 섹션, [key] 구분자 출력 (interaction = 합·충·형·파·해)
 */
// 정통사주 섹션 — 2-pass 호출 구조
// 1차(Core): 사주 원국의 핵심 명리 분석 — 4섹션
export const JUNGTONGSAJU_CORE_KEYS = ['general', 'daymaster', 'element', 'interaction'] as const;
// 2차(Application): 영역별 응용 + 시기 + 처방 — 8섹션. 1차 결과를 컨텍스트로 받아 중복 회피
export const JUNGTONGSAJU_APPLICATION_KEYS = ['character', 'career', 'wealth', 'love', 'health', 'relation', 'luck', 'advice'] as const;

export const JUNGTONGSAJU_SECTION_KEYS = [
  ...JUNGTONGSAJU_CORE_KEYS, ...JUNGTONGSAJU_APPLICATION_KEYS,
] as const;
export type JungtongsajuSectionKey = typeof JUNGTONGSAJU_SECTION_KEYS[number];

export const JUNGTONGSAJU_SECTION_LABELS: Record<JungtongsajuSectionKey, string> = {
  general:     '사주 총론',
  daymaster:   '일주 해석',
  element:     '오행 분포',
  interaction: '합·충·형·파·해',
  character:   '성격·기질',
  career:      '직업·적성',
  wealth:      '재물운',
  love:        '애정·이성운',
  health:      '건강운',
  relation:    '인간관계·가족',
  luck:        '대운·세운 흐름',
  advice:      '용신 처방',
};

/** 오행 → "ㅇㅇ·ㅇㅇ" 천간 텍스트 (프롬프트에서 ${...} 보간용) */
const ELEMENT_TO_STEMS_TEXT: Record<string, string> = {
  '목': '갑목·을목', '화': '병화·정화', '토': '무토·기토',
  '금': '경금·신금', '수': '임수·계수',
};

/**
 * 사주 입력 블록 + 모든 파생 변수 계산 — 1차/2차 프롬프트가 공유.
 * 이 헬퍼가 사주 원국·신살·합충·대운 등 모든 데이터 표현을 책임지며,
 * 두 프롬프트는 이 블록 + 자기 섹션 지침만 추가하면 된다.
 */
function buildJungtongsajuInput(result: SajuResult) {
  const { pillars, elementPercent, isStrong, yongSinElement, yongSin, sinSals, interactions, daeWoon, seWoon, gender, hourUnknown } = result;
  const gyeokguk = determineGyeokguk(result);
  const sipseongCounts = computeSipseongCounts(result);
  const sipseong = formatSipseongCounts(sipseongCounts);
  const ALL_SIPSEONG_JT = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'] as const;
  const missingSipseongList = ALL_SIPSEONG_JT.filter(s => (sipseongCounts[s] ?? 0) === 0);
  const missingSipseongStr = missingSipseongList.length > 0 ? missingSipseongList.join(', ') : '없음(모든 십성이 1개 이상 분포)';

  // ── 60갑자 일주 특성 (DB 조회)
  const dayTraits = getDayPillarTraits(pillars.day.gan, pillars.day.zhi);
  const dayTraitsBlock = dayTraits
    ? `[일주 60갑자 특성 — DB 조회값, 검증된 데이터]
일주: ${dayTraits.name}(${dayTraits.hanja})
키워드: ${dayTraits.keywords.join(', ')}
특성: ${dayTraits.traits}
특수신살: ${dayTraits.sinsal.length > 0 ? dayTraits.sinsal.join(', ') : '없음'}`
    : '';

  // ── 기둥별 상세 (12운성·지장간·12신살·공망)
  const formatPillar = (label: string, p: typeof pillars.year, isMissing = false) => {
    if (isMissing) return `${label}: 미상(삼주추명)`;
    const kong = p.isKongmang ? '·공망' : '';
    const hidden = p.hiddenStems.length > 0 ? `지장간(${p.hiddenStems.join(',')})` : '';
    const sinsal12 = p.sinSal12 ? `12신살(${p.sinSal12})` : '';
    const ganTenGod = p.tenGodGan === '일주' ? '일간(본인)' : p.tenGodGan;
    const parts = [
      `${p.gan}(${p.ganElement}·${ganTenGod})`,
      `${p.zhi}(${p.zhiElement}·${p.tenGodZhi})`,
      `12운성(${p.twelveStage})${kong}`,
      hidden,
      sinsal12,
    ].filter(Boolean);
    return `${label}: ${parts.join(' / ')}`;
  };

  const pillarDetailBlock = [
    formatPillar('년주', pillars.year),
    formatPillar('월주', pillars.month),
    formatPillar('일주', pillars.day),
    hourUnknown ? formatPillar('시주', pillars.hour, true) : formatPillar('시주', pillars.hour),
  ].join('\n');

  // ── 신강신약 5단계 + 득령득지득세
  const strengthBlock = `신강신약: ${result.strengthStatus}(점수 ${result.strengthScore}) — 득령(${result.deukRyeong ? 'O' : 'X'}) 득지(${result.deukJi ? 'O' : 'X'}) 득세(${result.deukSe ? 'O' : 'X'})`;

  // ── 오행 부족·과다 분석
  const elementEntries = Object.entries(elementPercent) as [string, number][];
  const zeroElements = elementEntries.filter(([, v]) => v === 0).map(([k]) => k);
  const maxEl = elementEntries.reduce((a, b) => a[1] > b[1] ? a : b);
  const elementNoteBlock = [
    zeroElements.length > 0 ? `결핍 오행: ${zeroElements.join('·')}` : '결핍 오행: 없음',
    `과다 오행: ${maxEl[0]}(${maxEl[1]}%)`,
  ].join(' / ');

  const sinSalStr = sinSals.length > 0 ? sinSals.map(s => `${s.name}(${s.type === 'gilseong' ? '길성' : '신살'})`).join(' ') : '없음';
  const interactionStr = interactions.length > 0 ? interactions.map(i => `${i.type}: ${i.description}`).join(' / ') : '없음';

  const currentYear = new Date().getFullYear();
  const birthYearJT = result.solarDate ? new Date(result.solarDate).getFullYear() : 0;
  const ageNow = birthYearJT > 0 ? currentYear - birthYearJT : 0;

  const fmtDWJT = (d: DaeWoon) => {
    const as = birthYearJT > 0 ? d.startAge - birthYearJT : d.startAge;
    const ae = birthYearJT > 0 ? d.endAge - birthYearJT : d.endAge;
    return `${d.startAge}~${d.endAge}년(${as}~${ae}세) ${d.gan}${d.zhi}(${d.ganElement}${d.zhiElement}·${d.tenGod}·${d.twelveStage})`;
  };

  const daeWoonStr = daeWoon
    .filter(d => d.gan && d.zhi)
    .slice(0, 8)
    .map(d => fmtDWJT(d))
    .join(' | ');

  const validDaeWoons = daeWoon.filter(d => d.gan && d.zhi);
  const currentDaeWoonIdx = validDaeWoons.findIndex(d => currentYear >= d.startAge && currentYear <= d.endAge);
  const currentDaeWoon = currentDaeWoonIdx >= 0 ? validDaeWoons[currentDaeWoonIdx] : undefined;
  const currentDaeWoonStr = currentDaeWoon ? fmtDWJT(currentDaeWoon) : '대운 시작 전';
  // 직원 피드백: 과거·현재·미래 대운 흐름 입체적 노출 — [luck] 섹션 본문에 활용
  const prevDaeWoon = currentDaeWoonIdx > 0 ? validDaeWoons[currentDaeWoonIdx - 1] : undefined;
  const nextDaeWoon = currentDaeWoonIdx >= 0 && currentDaeWoonIdx + 1 < validDaeWoons.length
    ? validDaeWoons[currentDaeWoonIdx + 1]
    : undefined;
  const nextNextDaeWoon = currentDaeWoonIdx >= 0 && currentDaeWoonIdx + 2 < validDaeWoons.length
    ? validDaeWoons[currentDaeWoonIdx + 2]
    : undefined;
  const prevDaeWoonStr = prevDaeWoon ? fmtDWJT(prevDaeWoon) : '없음(현재가 첫 대운)';
  const nextDaeWoonStr = nextDaeWoon ? fmtDWJT(nextDaeWoon) : '없음(데이터 범위 끝)';
  const nextNextDaeWoonStr = nextNextDaeWoon ? fmtDWJT(nextNextDaeWoon) : '없음';
  // 향후 5년 세운 (올해 포함) — 작성 지침에서 한 줄씩 짚도록
  const recentSeWoon = seWoon
    .filter(s => s.year >= currentYear && s.year <= currentYear + 4)
    .map(s => `${s.year}년 ${s.gan}${s.zhi}(${s.ganElement}${s.zhiElement}·${s.tenGod}·${s.twelveStage})`)
    .join(' | ');

  const hourNote = hourUnknown
    ? '\n출생 시간 미상 — 삼주추명 원칙: 자녀궁·말년·시간대별 상세는 간략히만 처리.'
    : '';

  const inputBlock = `[사주 원국 — 기둥별 상세]
${pillarDetailBlock}

일간: ${pillars.day.gan}(${pillars.day.ganElement}·${result.dayMasterYinYang})
오행: 목${elementPercent.목}% 화${elementPercent.화}% 토${elementPercent.토}% 금${elementPercent.금}% 수${elementPercent.수}%
${elementNoteBlock}
${strengthBlock}
용신: ${yongSinElement}(${yongSin})  희신: ${result.heeSin}  기신: ${result.giSin}${result.strengthScore >= 85 || result.strengthScore <= 15 ? `  ★전왕법 적용(점수 ${result.strengthScore}) — 억부 역전 주의` : ''}
격국: ${gyeokguk.name} (판정 근거: ${gyeokguk.reason})
십성 분포: ${sipseong}
★ 원국에 0개인 십성: ${missingSipseongStr}
   → 본문에서 이 십성을 "사주에 ~십성이 강하다/있다/약하다"고 서술하면 절대 안 됨.
   → 0개인 십성을 언급해야 할 때는 반드시 "원국에 없는 ~" 또는 "~이(가) 부재한 사주"로만 표현.
신살·길성: ${sinSalStr}
합충형파해: ${interactionStr}
간여지동: ${formatGanYeojidong(result)}
병존·삼존: ${formatByeongjOn(result)}
성별: ${gender === 'male' ? '남성' : '여성'}
현재 나이(계산): ${ageNow}세
이전 대운(과거): ${prevDaeWoonStr}
현재 대운: ${currentDaeWoonStr}
다음 대운(미래): ${nextDaeWoonStr}
차차기 대운(미래): ${nextNextDaeWoonStr}
대운 전체(최대 8개): ${daeWoonStr}
최근·향후 세운(3년): ${recentSeWoon}${hourNote}

${dayTraitsBlock}`;

  /** 1차/2차 공통 작성 규칙 — 마커 9·10번만 빼면 동일 (마커 list 는 각 함수에서 채움) */
  const commonRules = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 규칙 — 절대 준수]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1) Markdown 절대 금지. 별표(**), 헤딩(#), 이모지 전부 금지.
2) 불릿은 "- " 또는 "· " 형식만 허용.
3) AI 자기소개 문구("분석 결과", "데이터에 따르면") 금지.
4) 위에 주어진 모든 수치(격국·용신·신강약·오행%·십성·신살·합충·대운·세운·12운성·지장간)를 뒤집거나 임의 변경 금지.
5) 전문 용어 첫 등장 시 괄호로 쉬운 말 병기.
6) "~일 수 있습니다" 흐린 표현은 전체 답변에서 2회 이하. 단정적 어투 유지.
7) 각 섹션 첫 문장에서 결론 먼저, 근거를 이어붙이는 방식.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[★★★ 십성 데이터 무결성 — 최우선 규칙 ★★★]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
원국에 0개인 십성: ${missingSipseongStr}
위 목록의 십성을 본문에서 "사주에 있다/강하다/약하다/작용한다" 형태로 절대 서술 금지.
- 금지 예시: "편관의 기운으로 책임감이…" (편관 0개인데 있는 것처럼 서술) → 즉시 잘못된 풀이.
- 금지 예시: "겁재가 있어 경쟁심이…" (겁재 0개인데 있다고 서술) → 즉시 잘못된 풀이.
- 금지 예시: "정재의 안정적 재물운…" (정재 0개인데 있다고 서술) → 즉시 잘못된 풀이.
- 허용: "원국에 편관이 없어 ~한 경향" / "겁재가 부재하여 ~" (없다는 사실 자체를 서술하는 것은 허용)
검증 절차: 본문에 어떤 십성명을 인용하기 전, "십성 분포: ${sipseong}"에 해당 십성이 1개 이상 있는지 반드시 확인. 없으면 절대 "있다/강하다/작용한다"로 쓰지 말고, "없다/부재하다"로만 표현하거나 다른 어휘로 대체.`;

  return {
    inputBlock,
    commonRules,
    yongSinElement,
    yongSin,
    pillars,
    gyeokguk,
    elementPercent,
    zeroElements,
    maxEl,
    interactionStr,
    dayTraits,
    prevDaeWoonStr,
    currentDaeWoonStr,
    nextDaeWoonStr,
    nextNextDaeWoonStr,
    recentSeWoon,
    strengthStatus: result.strengthStatus,
    missingSipseongStr,
    sipseong,
  };
}

/**
 * 정통사주 1차 (Core) 프롬프트 — 사주 핵심 4섹션
 * general · daymaster · element · interaction
 *
 * 분량: 4섹션 합계 ~3,000자 (이전 ~1,860자의 1.6배)
 * 호출자: getJungtongsajuReport 가 먼저 이 프롬프트로 1번째 callGPT
 */
export const generateJungtongsajuCorePrompt = (result: SajuResult): string => {
  const v = buildJungtongsajuInput(result);
  const { inputBlock, commonRules, yongSinElement, pillars, gyeokguk, elementPercent, zeroElements, maxEl, interactionStr, dayTraits, strengthStatus, missingSipseongStr } = v;

  return `${inputBlock}

${commonRules}
8) 출력은 [general] 마커부터 시작. 마커 이전 텍스트 없어야 함.
9) 아래 4개 마커를 정확히 사용. 마커는 줄 처음에 단독으로 위치.
10) ★ 사주 원국의 가장 핵심을 다루는 1차 분석. 이후 영역별 응용(직업·재물·애정 등)에 재사용될 기반이므로,
    각 섹션이 자기 주제에 충실하게 깊이 풀 것. 다른 섹션 영역(직업·재물·관계·건강·대운)은 1차에서 깊이 다루지 X.
11) 매 섹션 작성 완료 후, 해당 섹션에서 언급한 모든 십성명이 "십성 분포"에 1개 이상 존재하는지 자기 검증할 것. 위반 시 해당 문장 삭제 또는 수정.

${METAPHOR_KB}

${METAPHOR_TITLE_RULE}

${KEY_SENTENCE_EMPHASIS_RULE}

[섹션 지침 — 1차 핵심 4섹션]

[general] — 1000~1200자
작성 순서:
첫 줄: 은유 제목 (위 제목 기술 참고, 「」 없이 평문으로)
빈 줄
본문:
1단락(격국 + 신강신약 통합): 제목 은유를 풀어 격국(${gyeokguk.name})이 이 사람의 삶을 어떤 방향으로 이끄는지 단정적으로 선언. 은유로 시작해 명리 근거(격국)로 착지. 같은 단락 안에서 ${strengthStatus}(신강신약)이 그 격국의 에너지를 어떻게 증폭하거나 제어하는지로 자연스럽게 이어 4~5문장. 두 요소를 분리하지 말고 하나의 흐름으로 엮을 것.
2단락(격국+신강신약이 빛나는 장면): 위 두 요소가 결합해 빛나는 구체 일상 장면 2개 (직업 선택 순간 / 아이디어가 터지는 순간 / 위기에서 빛나는 순간 / 사람을 끌어모으는 순간 중 2개 선택). 장면마다 2~3문장으로 생생하게 묘사 + 에너지가 부족하거나 과할 때 같은 장면이 어떻게 어긋나는지 한 문장씩 짧게 대비.
3단락(용신 + 오행 통합): 용신(${yongSinElement})이 인생 전체에 부여하는 큰 방향성을 먼저 선언한 뒤, 오행 분포(결핍: ${zeroElements.join('·') || '없음'} / 과다: ${maxEl[0]} ${maxEl[1]}%)가 그 방향성을 어떻게 떠받치거나 흔드는지 같은 단락 안에서 연결. 결핍·과다가 만드는 평생을 가로지르는 사고·실행 패턴 + 대인관계 특징을 4~5문장으로. 용신과 오행을 분리해서 다루지 말 것.
4단락(강점·평생 숙제): 이 사주의 가장 큰 강점과 평생 숙제를 각 1~2문장으로 명쾌하게 정리.
5단락(따뜻한 마무리): 첫 줄 제목 은유를 회수하면서, 강점과 숙제를 안고 살아가는 사람에게 보내는 짧고 따뜻한 격려·방향 제시로 마무리 1~2문장. 마음가짐·태도 차원의 부드러운 응원만 다룰 것. **구체 처방·행운 키워드·실행 액션·색·방위·숫자·행동 지침 등은 절대 금지 — 모두 [advice] 섹션 전용이며 여기서 다루면 중복으로 페널티**.

은유 일관성(필수):
- 첫 줄에 정한 제목 은유 하나를 본문 전체에서 일관되게 풀어낼 것 (예: 제목이 "눈 덮인 휴화산"이면 본문에서 "마그마/지각/분화" 같은 같은 계열 이미지로 연결).
- 반달·보름달·초승달, 사계절, 사다리 같은 특정 은유를 미리 정해두고 강제로 끼워 넣지 말 것. 첫 줄 제목 은유에서 자연스럽게 파생되는 표현만 사용.
1000자 미만이면 장면·은유 묘사를 더 구체적으로 늘려서 반드시 채울 것.

[daymaster] — 580~700자
작성 순서:
첫 줄: 은유 제목 (일주 ${pillars.day.gan}${pillars.day.zhi}의 양면 — 겉으로 드러나는 기질과 내면의 본모습을 대비하는 이미지 두 개, 쉼표로 연결)
빈 줄
본문: 제목 은유로 시작해 일주 ${pillars.day.gan}${pillars.day.zhi}(${dayTraits?.hanja ?? ''})의 고유한 에너지를 "이 일주를 타고난 사람은 ~한 방식으로 세상을 경험한다"는 관점에서 깊이 서술. 단락들은 분리된 항목 나열이 아니라 한 편의 글처럼 흐를 것 — "그래서", "그 까닭은", "이 결합 때문에" 같은 연결어로 마디를 이어 붙여 읽는 사람이 한 호흡으로 따라가게 할 것.
- DB 키워드(${dayTraits?.keywords?.join(', ') ?? ''})를 개별 나열 X — 이야기 흐름에 녹여 쓸 것
- **일간 ${pillars.day.gan}과 일지 ${pillars.day.zhi}의 십성 관계 + 일주에 직접 결합되는 월간/월지의 십성 1~2가지를 명시적으로 노출**할 것 (예: "일지의 ◯◯는 정재라 ~", "월지의 ◯◯는 편인이라 ~"). 십성 용어(정재·편인·식신·정관·비견 등) 첫 등장 시 같은 호흡 안에서 일상어로 즉시 풀어 설명. 이 십성 구조가 위 은유·일주 본질과 어떻게 맞물려 사고·행동을 만드는지 흐름의 다음 마디로 자연스럽게 이을 것
- 위 십성 구조가 실생활에서 드러나는 모습 — 강점을 발휘하는 장면과 발목을 잡는 패턴을 분리된 리스트가 아니라 **대비 흐름**("~할 때는 ~하지만, ~할 때는 ~ 한다")으로 묶어 한 단락에 녹여 각 2개씩 구체적 상황으로 묘사
- 특수신살(${dayTraits?.sinsal?.join(', ') || '없음'})의 결을 위 흐름에 얹어 2~3문장 ("이 신살이 있어 ~한 경향이 또렷해진다" 식). 신살을 따로 정의하지 말고 일주 풀이의 결에 자연스럽게 얹을 것
- 다른 일주와 무엇이 결정적으로 다른지 1문장
마지막 문장에서 제목 은유 회수해 일주의 핵심 압축.

중복 회피(중요):
- 사주 전체의 합·충·형·파·해 분석은 [interaction] 섹션 전담. 여기서는 **일주(일간·일지)에 직접 작용하는 십성과 합 1~2가지만** 다루고, 멀리 떨어진 기둥끼리의 합/충은 언급 금지
- 격국·신강신약·용신·오행 분포는 [general]·[element] 섹션 전담 — 여기서는 사용 금지
- 처방·색·방위·숫자·행운 키워드는 [advice] 섹션 전담 — 금지

[element] — 540~660자
작성 순서:
첫 줄: 은유 제목 (오행 과다·결핍의 핵심 인상을 단일 비유로 — 예: "넘치는 들판 한쪽, 메마른 가장자리". 사계절·하늘 이미지에 얽매이지 말 것)
빈 줄
본문: 제목 은유로 시작해 오행 분포(목${elementPercent.목}% 화${elementPercent.화}% 토${elementPercent.토}% 금${elementPercent.금}% 수${elementPercent.수}%)를 풀어 쓴다. 단락들은 분리된 항목 나열이 아니라 한 편의 글처럼 흐를 것 — "그래서", "이 결핍 때문에", "이 과다가 만드는 결과는" 같은 연결어로 마디를 이어 붙여 읽는 사람이 한 호흡으로 따라가게 할 것.

- 첫 줄 제목 은유를 본문 전체에서 일관되게 풀어낼 것. 사계절·하늘 은유(목=봄 새벽, 화=정오 등) 같은 미리 정해진 은유를 강제로 끼워 넣지 말고, 제목에서 자연스럽게 파생되는 표현만 사용
- **오행 결핍/과다를 십성(인성·비겁·식상·재성·관성)의 기능 정지·과잉으로 즉시 번역**할 것. 일간 ${pillars.day.gan} 기준 각 오행이 어떤 십성에 대응하는지를 본문에 명시적으로 노출 (예: "목이 없다는 건 이 사람의 식상 — 표현력·실행력 — 기능이 멈춰 있다는 뜻"). 십성 용어 첫 등장 시 같은 호흡 안에서 일상어로 풀어 설명
- **오행 상생 흐름**(목→화→토→금→수→목)을 활용해 결핍·과다가 만드는 정체·과부하를 묘사할 것 (예: "수생목이 되어야 하는데 목이 없어 물이 고인다", "화생토가 강해 흙이 마르고 굳는다"). 결핍·과다가 단순한 분포 이상이 아니라 흐름의 막힘을 만든다는 인과를 보일 것
- 결핍 오행(${zeroElements.join('·') || '없음'})이 일상에서 만드는 구체 패턴 2~3개 + 과다 오행(${maxEl[0]} ${maxEl[1]}%)의 편향이 드러나는 장면 2개를 분리된 리스트가 아니라 위 흐름의 다음 마디로 자연스럽게 잇기
- 5개 오행의 균형이 만드는 이 사람만의 톤 1~2문장
마지막 문장에서 제목 은유 회수.

중복 회피(중요):
- 색·방위·숫자·식물·소품·구체 행동 처방은 [advice] 섹션 전담 — 여기서는 금지
- 격국·신강신약·용신은 [general] 섹션 전담 — 사용 금지
- 일주(일간·일지)에 직접 결합되는 십성은 [daymaster] 섹션 전담 — 여기는 **사주 전체의 오행·십성 분포**만 다룰 것
- 사주 전체의 합·충·형·파·해는 [interaction] 섹션 전담 — 결핍·과다 묘사에 합·충 언급 금지

[interaction] — 800~960자
작성 순서:
첫 줄: 은유 제목 (지지 사이의 합/충/형/파/해 관계를 자연 현상이나 인간관계 구도로 비유)
빈 줄
본문 작성 지침: 단락들은 분리된 항목 나열이 아니라 한 편의 글처럼 흐를 것 — "그래서", "그 결과", "이 충돌이 만드는 것은" 같은 연결어로 합·충·형·파·해 마디를 이어 붙여 읽는 사람이 한 호흡으로 따라가게 할 것. 첫 줄 제목 은유를 본문 전체에서 일관되게 풀어내고, 각 관계 묘사는 그 은유의 같은 계열 이미지로 연결.
- 입력 데이터의 "합충형파해: ${interactionStr}" 필드의 모든 관계를 빠짐없이 본문에서 명시
- 합(三合·六合·방합): 어떤 에너지가 결합해 어떤 강점을 만드는지 + 그 결합이 인생에서 발현되는 구체 장면 2개 + "이 합의 기운을 살리려면 ~하라" 실천 조언 1가지
- 충(沖): 두 기둥이 부딪히는 구조 + 일상에서 반복되는 갈등 패턴 2가지(직업/관계 각 1개) + "이런 상황에서는 ~하고 ~은 피하라" 구체 행동 지침
- 형(刑): 자형·삼형·상형 유형 명시 + 내적 긴장이 폭발하는 전형적 상황 1개 + 완화하는 습관·태도 1가지
- 파(破)·해(害): 미묘한 마찰 패턴이 어떤 관계에서 반복되는지 + "이 마찰을 줄이려면 ~하라" 조언
- 각 관계마다 "그래서 어떻게 해야 하는가" 실천 행동을 반드시 포함 — 추상적 격언(조화를 이루세요, 균형을 잡으세요) 금지, 구체 상황·행동으로 내려앉힐 것
- "합/충/형/파/해" 한자어 그대로 쓰되 첫 등장 시 괄호로 쉬운 말 병기
- 관계가 없는 항목은 "없음" 명시 후 다음으로
마무리: 모든 관계를 종합해 "이 사주의 내부 역학이 만드는 삶의 리듬" 2~3문장 정리 + 가장 주의할 점 1가지 재강조.
마지막 문장에서 제목 은유 회수.

중복 회피(중요):
- 이 섹션은 **사주 전체의 합·충·형·파·해 지도**가 본업. 일주(일간·일지)에 직접 결합되는 합 1~2가지는 [daymaster] 에서 이미 다뤘으므로, 여기서는 일주 영역과 다른 기둥(연주↔월주, 월주↔시주 등) 의 관계도 빠짐없이 보강할 것. 단, 일주 직결 합·충은 [daymaster] 와 정확히 같은 표현 반복 금지 — 다른 관점(전체 구도 안에서의 의미)으로 풀어낼 것
- 격국·신강신약·용신·오행 분포는 [general]·[element] 섹션 전담 — 여기서는 사용 금지
- 일주의 양면·기질·신살 본질은 [daymaster] 전담 — 여기서는 일주 단독 묘사 금지, 합·충 안에서 일주가 어떻게 작용하는지만
- 처방·색·방위·숫자·행운 키워드는 [advice] 섹션 전담 — 금지

출력은 [general] 마커부터 시작. 마커 이전 텍스트 없어야 함.
4개 섹션 모두 빠짐없이 작성하고 [interaction] 까지 완료한 직후 응답을 끝낸다.`;
};

/**
 * 정통사주 2차 (Application) 프롬프트 — 영역별 응용 8섹션
 * character · career · wealth · love · health · relation · luck · advice
 *
 * 분량: 8섹션 합계 ~5,200자 (이전 ~3,140자의 1.65배)
 * 호출자: getJungtongsajuReport 가 1차 결과를 받은 후 이 프롬프트로 2번째 callGPT
 *
 * @param coreContent       1차 호출 응답 본문 — 절대 반복 금지하라고 컨텍스트로 주입
 * @param forbiddenAliases  (B 옵션) 1차 본문에서 자동 추출한 시적 별칭 리스트.
 *                          예: ["가장 멀리, 홀로 빛나는 별", "겨울 밤하늘 은하수", "보름달"]
 *                          2차에서 이 별칭들을 **절대 0회** 사용 금지로 명시
 */
export const generateJungtongsajuApplicationPrompt = (
  result: SajuResult,
  coreContent: string,
  forbiddenAliases: string[] = [],
): string => {
  const v = buildJungtongsajuInput(result);
  const { inputBlock, commonRules, yongSinElement, yongSin, pillars, gyeokguk, prevDaeWoonStr, currentDaeWoonStr, nextDaeWoonStr, nextNextDaeWoonStr, recentSeWoon, missingSipseongStr, sipseong } = v;

  // B 옵션 — 1차에서 쓴 별칭들을 동적 차단 블록으로 만듦
  const forbiddenBlock = forbiddenAliases.length > 0
    ? `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1차에서 사용한 시적 별칭 — 2차에서 절대 0회 등장 금지]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
다음 시적 별칭/표현은 1차 본문에서 이미 사용되었습니다. 2차 8섹션 어디에도 다시 사용하면 안 됩니다.
유사 변형(예: "가장 멀리 빛나는 별" → "홀로 빛나는 등불")도 금지. 다른 자연 이미지로 완전히 다른 표현을 쓰세요.

금지 별칭/표현:
${forbiddenAliases.map((a, i) => `${i + 1}. "${a}"`).join('\n')}

이 중 어느 하나라도 2차 본문에 등장하면 잘못된 풀이로 간주됩니다.`
    : '';

  return `${inputBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1차 분석 — 이미 작성된 4섹션 본문 (절대 반복 금지)]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${coreContent}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

위 1차 본문에서 이미 다음 주제를 깊이 다뤘습니다 — 2차에서 절대 반복하지 마세요:
- general: 격국이 만드는 인생 큰 방향
- daymaster: 일주 60갑자 고유 기질
- element: 오행 분포 + 결핍/과다
- interaction: 합·충·형·파·해 관계
↑ 위 내용을 인용해야 할 경우 1줄 이하로 짧게만 (예: "앞서 본 ${gyeokguk.name}의 영향이 여기서는…").
${forbiddenBlock}

${commonRules}
8) 출력은 [character] 마커부터 시작. 마커 이전 텍스트 없어야 함.
9) 아래 8개 마커를 정확히 사용. 마커는 줄 처음에 단독으로 위치.
10) ★★★ 1차와의 중복 절대 금지 + 2차 8섹션 간 중복 절대 금지.
11) 매 섹션 작성 완료 후, 해당 섹션에서 언급한 모든 십성명이 "십성 분포"에 1개 이상 존재하는지 자기 검증할 것. 위반 시 해당 문장 삭제 또는 수정.
    특히 [career] [wealth] [love] [relation] 섹션에서 십성 기반 해석 시 원국에 없는 십성을 있는 것처럼 서술하면 신뢰도 치명 타격 — 반드시 확인.

[A 옵션 — 핵심 키워드 등장 횟수 명시 제한]
다음 키워드들은 한 풀이(1차+2차 합쳐) 통틀어 등장 횟수를 엄격히 제한합니다.
이미 1차에서 사용된 횟수를 위 컨텍스트에서 확인하고, 2차에선 한도 내에서만 추가 등장.

- "${gyeokguk.name}" 단어: 2차에서 최대 1회 (career 섹션 또는 다른 1개 섹션 중 1곳만).
  격국 시적 별칭은 0회 (1차 general 에서 이미 사용).
- "${pillars.day.gan}${pillars.day.zhi}" 또는 "${pillars.day.gan}수/일간" 인용: 2차에서 최대 2회.
  일주 기질 묘사("차분/분석적/내면 열정/이중성/겉냉속열") 0회 — 1차 daymaster 에서 다뤘음.
- ★★ "용신인 ${yongSinElement}(천간·천간)" + "${yongSin}" 정형 표기:
  2차 8섹션 통틀어 advice 섹션에서만 1회. character·career·wealth·love·health·relation·luck 0회.
  다른 섹션에서 용신을 언급해야 할 때는 단어 분해 — 예: "이 사주의 용신 기운" 또는 "성장의 에너지" 같이.
- ★★ "결핍 목" + "새로운 시작 부족/실행력 약함/추진력 약함/망설임" 결론:
  2차 8섹션 통틀어 advice 1회만. element/character/wealth 에서 0회. 1차에서 결핍 결론 다뤘으면 2차에서 더 안 다룸.
- ★★ "과도한 분석/완벽주의/지나치게 신중/디테일 갇힘/계획에만 몰두/기회 놓침" 결론:
  2차 8섹션 통틀어 character 1회만. element/wealth/health 에서 0회.
- "보름달", "초승달", "반달" (신강신약 별칭): 0회 — 1차 general 에서 사용.
- "북극성" (용신 별칭): 0회 — 다른 표현으로.

[금지 표현 패턴 — 즉시 잘못된 풀이로 간주]
- "이는 X격(별칭)의 특성으로/영향으로/기운으로" — 격국 별칭이 매번 등장 → 금지
- "용신인 X(천간·천간), 즉 식신/상관" — 동일 정형 표기 → advice 1회만, 그 외 0회
- "겉은 차분, 속은 뜨거운/열정" — 이중성 묘사 → 1차에서 다뤘음, 2차 0회
- "예리한 통찰력", "독창적인 사고/통찰력", "본질을 꿰뚫" — 통찰 강점 묘사 → 1회만
- "결핍 오행 목" 인용 + 같은 결론 (실행력/시작) — 2차 advice 1회만, 그 외 0회

[작성 시 자기 검열 절차]
새 섹션 시작 전에 이 체크리스트를 통과:
1. 1차 본문과 위 [금지 별칭 리스트] 다시 읽기
2. 이번 섹션에서 쓰려는 표현이 거기 있는지 확인
3. 있으면 다른 어휘·다른 자연 이미지로 완전 교체
4. 없을 때만 작성 시작
이 절차를 거쳤다고 가정하고 8섹션 작성합니다.
    각 섹션은 자기 영역에만 집중:
    - character = 성격 (격국·일주는 1차에서 다뤘음, 여기선 일상 행동 패턴만)
    - career    = 직업·적성·조직 역할 (재물 얘기는 wealth 로 미루기)
    - wealth    = 돈 흐름·재물 함정 (직업 얘기는 career 로 미루기)
    - love      = 끌리는 상대·연애·배우자 (가족·친구는 relation 으로)
    - health    = 약한 장부·건강 습관 (성격 스트레스는 character 로)
    - relation  = 인맥·부모·자녀·귀인 (배우자·연애는 love 로)
    - luck      = 대운·세운 흐름 (성향은 1차/character 로)
    - advice    = 용신 보강 실천 행동 (다른 섹션 결론 단순 반복 X, 구체 행동만)

${METAPHOR_KB}

${METAPHOR_TITLE_RULE}

${KEY_SENTENCE_EMPHASIS_RULE}

[섹션 지침 — 2차 응용 8섹션]

[character] — 660~780자
작성 순서:
첫 줄: 은유 제목 (낯선 자리에서의 모습과 가까워진 뒤 본모습을 대비하는 이미지)
빈 줄
본문: 제목 은유로 시작해 일상 행동 패턴 중심으로 서술. 단락들은 분리된 항목 나열이 아니라 한 편의 글처럼 흐를 것 — "그래서", "그 까닭은", "이 구조가 만드는 것은" 같은 연결어로 마디를 이어 붙여 읽는 사람이 한 호흡으로 따라가게 할 것.
- 도입(1단락): 제목 은유 풀이 + **사주 전체의 십성·합 구조가 만든 기질의 큰 그림** 3~4문장 (예: "월지 ◯◯이 편인이라 의심·분석 성향이 강하다", "사주에 합이 많아 갈등을 피하는 평화주의가 자리잡았다", "식상이 비어 있어 나서기를 주저한다"). 십성 용어(편인·정관·식상·관성·비겁·합 多 등) 첫 등장 시 같은 호흡 안에서 일상어로 즉시 풀어 설명
- 환경별 발현(2단락): "낯선 환경에서 처음 보이는 모습" 2문장 (회의·소개팅·면접 등 구체 상황) → 연결어로 자연스럽게 → "친해진 뒤 드러나는 본모습" 2문장 (가까운 사람과의 갈등·기쁜 순간 등)
- **욕구 vs 두려움(3단락)**: 이 사주가 **가장 되고 싶어 하는 모습**과 **가장 피하고 싶어 하는 모습**을 명리 근거(관성=리더 동경, 식상 결핍=실행 주저, 합 多=관계 집착 등)로 대비. 각 1~2문장씩, 추상 격언 금지 — 구체 인상으로 ("시원시원하고 결단력 있는 사람이 되고 싶어 하면서도, 우유부단해 보일까 봐 두려워한다" 식)
- 강점·그림자 + 외부 시선(4단락): 위 욕구·두려움과 자연스럽게 이어 강점 2가지와 그림자 2가지를 일상 장면으로 묶음 + **"이 기질이 주변에 어떤 인상으로 비치는지" 한 문장** ("주변에서는 ~ 라는 말을 자주 듣게 된다" 식)
- 이 기질이 삶의 어떤 선택에서 반복적으로 나타나는가 1~2문장
마지막 문장에서 제목 은유 회수.

중복 회피(중요):
- 격국·신강신약·용신·오행 분포·일주 단독 묘사는 [general]·[element]·[daymaster] 섹션 전담 — 사용 금지
- 사주 전체의 합·충·형·파·해 분석은 [interaction] 섹션 전담 — 여기서는 십성 구조가 만든 기질만 다루고, 합·충 자체의 메커니즘 묘사 금지
- 변화 처방·연습·구체 행동 지침은 [advice] 섹션 전담 — 여기서는 진단·자기인식까지만, "~를 연습하세요/거절을 훈련하세요" 같은 처방 표현 금지

[career] — 630~750자
작성 순서:
첫 줄: 은유 제목 (타고난 적성의 빛나는 면과 맞지 않는 환경의 대비)
빈 줄
본문: 제목 은유로 시작해 직업 영역에서 이 사주가 빛나는 결을 서술. 단락들은 분리된 항목 나열이 아니라 한 편의 글처럼 흐를 것 — "그래서", "이 구조가 만드는 것은", "그 까닭은" 같은 연결어로 마디를 이어 붙여 읽는 사람이 한 호흡으로 따라가게 할 것.
- 도입(1단락): **부적합 직군 + 명리 근거** 2~3문장. "이 사주는 ~ 같은 환경에선 에너지가 마모된다" 식으로 단정 서술체. 추상 격언 금지, 구체 직군명·상황으로 (예: "낯선 사람에게 즉석에서 설득하는 영업·세일즈는 식상이 비어 있어 에너지가 마모된다")
- **십성 명리 근거 + 적합 직군(2단락)**: 사주의 십성 구조(인성·재성·관성·식상·비겁 중 어떤 것이 강하고 약한지)를 명시적으로 노출하면서 **적합 직군 5~6개**를 구체적으로 제시 (예: "IT 개발 중에서도 백엔드·시스템 설계", "금융 중에서도 재무·회계 분야"). 직군마다 "어떤 십성이 작용하기 때문인가" 한 호흡으로 풀이. 십성 용어 첫 등장 시 일상어로 즉시 풀어 설명
- **욕구 진단(3단락)**: 이 사주가 직업에서 **진짜 추구하는 것**을 명리 근거로 진단 — 명예(관) / 돈(재) / 자유(식상) / 안정(인성) / 창작(식상) / 권력(편관) 중 어느 축인지 1~2문장 (예: "관성과 재성이 함께 자리해 명예와 돈을 동시에 추구하는 사주"). 추구하기 어려운 영역도 1문장 ("식상이 비어 창작 결과물은 시간이 걸린다" 식)
- **조직 내 역할 + 직업 운용 전략(4단락)**: 조직 내 역할을 구체 부서·기능 단위로 (리더형·참모형·독립형 분류는 유지하되 "전략기획·재무·연구·감사·기획·실행" 같은 실제 부서·역할 1~2개 명시) + **직업 운용 전략 1~2가지** ("말보다 문서·기획서로 승부", "전문 자격 강화", "혼자 깊이 파는 분야 선택" 등). 이는 명리 처방이 아닌 **직업 운용 차원의 실천**임을 유지
- 이직·전직 적기 1문장 (대운 본격 분석은 luck 으로 미룸)
마지막 문장에서 제목 은유 회수.

중복 회피(중요):
- 격국·신강신약·용신·오행 분포·일주 단독 묘사는 [general]·[element]·[daymaster] 섹션 전담 — 사용 금지
- 사주 전체의 합·충·형·파·해는 [interaction] 섹션 전담 — 여기서는 십성 구조가 만든 직업 적성만 다루고, 합·충 자체의 메커니즘 묘사 금지
- 대운·세운 시기별 흐름은 [luck] 섹션 전담 — 이직 적기 1문장 외 시기 묘사 금지
- 색·방위·숫자·식물·소품·명리 처방은 [advice] 섹션 전담 — 여기는 **직업 운용 전략**(역할·승부 방식·자격 방향)만, 명리 처방 금지

[wealth] — 600~720자
작성 순서:
첫 줄: 은유 제목 (재물이 모이는 방식과 새는 패턴 대비. 빛·물·계절 등 미리 정해진 이미지에 얽매이지 말 것)
빈 줄
본문: 제목 은유로 시작해 재물 영역에서 이 사주가 작동하는 결을 서술. 단락들은 분리된 항목 나열이 아니라 한 편의 글처럼 흐를 것 — "그래서", "이 구조가 만드는 것은", "그 까닭은" 같은 연결어로 마디를 이어 붙여 읽는 사람이 한 호흡으로 따라가게 할 것.
- **재성 위치 + 명리 근거(1단락)**: 재성(편재·정재)이 사주 어느 자리(일지·시지·월간·월지 등)에 있는지 + 재고 포함 여부를 명시적으로 노출. "이 사주는 ◯◯에 재성이 자리 잡아 재물의 뿌리가 ~하다" 식. 추상적 강약 표현 금지
- **돈 버는 방식 + 십성 명시(2단락)**: 월급형·사업형·투자형 중 어느 쪽이 유리한지를 인성·재성·식상 구조로 풀이 (예: "인성이 강하니 자본 소득·문서 자산이 잘 맞고, 식상이 비어 있어 순수 영업형은 맞지 않다"). 십성 용어(편재·정재·인성·식상·관성) 첫 등장 시 같은 호흡 안에서 일상어로 즉시 풀어 설명
- **소비 패턴 + 충동 시점(3단락)**: 모으는 vs 쓰는 성향 + 어떤 상황에서 돈이 새는지를 합·십성 결과로 진단 (예: "시지 편재로 한 번씩 크게 지르는 충동", "◯◯합이 재물 자리에서 만드는 친구·동료 자리에서의 홧김 지출"). 합·충 메커니즘 자체는 [interaction] 전담이므로 여기서는 **결과만** — "이 합이 재물에서 어떻게 발현되는가"
- **자산 운용 권고 + 배우자 재물 연동(4단락)**: **구체 자산 운용 방향** 1~2가지 명시 ("부동산·우량주 같은 문서 형태로 묶기", "현금성 자산보다 자본 자산 우선" 등). 그리고 **사주 주인공의 성별에 따라 배우자-재물 연동** 1~2문장 (입력 헤더의 성별 정보를 보고 분기):
  · 남성 사주이면: 재성이 곧 배우자상이기도 하므로, 일지·시지 재성의 결(정재=현명한 안정 배우자 / 편재=활동적·유동적 인연)이 결혼 후 재물 흐름에 어떤 영향을 미치는지
  · 여성 사주이면: 관성(남편)과 재성(재물)의 관계로 본 결혼 후 재물 흐름 (예: "관성이 재성을 ◯◯하므로 결혼 후 ~")
- 큰 돈 들어오는 환경 단서 1문장 (시기 분석은 [luck] 전담이므로 환경·계기만)
마지막 문장에서 제목 은유 회수.

중복 회피(중요):
- 격국·신강신약·용신·오행 분포·일주 단독 묘사는 [general]·[element]·[daymaster] 섹션 전담 — 사용 금지
- 사주 전체의 합·충·형·파·해 메커니즘 자체는 [interaction] 섹션 전담 — 여기서는 그 결과가 재물에서 어떻게 발현되는지만
- 대운·세운 시기별 재물 흐름은 [luck] 섹션 전담 — 환경 단서 1문장 외 시기 묘사 금지
- 색·방위·숫자·식물·소품·명리 처방은 [advice] 섹션 전담 — 여기는 **자산 운용 권고**(부동산·주식·자본 자산 등 직업 운용과 같은 결의 실천)만, 명리 처방 금지
- **[love] 영역과 분리(필수)**: 여기서는 배우자가 **재물에 미치는 영향**만 1~2문장. 배우자 성격·만남 방식·연애 패턴·갈등 묘사는 [love] 섹션 전담 — 절대 금지

[love] — 600~720자
작성 순서:
첫 줄: 은유 제목 (끌리는 상대의 온도·에너지와 관계에서 반복되는 패턴 대비)
빈 줄
본문: 제목 은유로 시작해 이성·연애·결혼 영역에서 이 사주가 작동하는 결을 서술. 단락들은 분리된 항목 나열이 아니라 한 편의 글처럼 흐를 것 — "그래서", "이 구조가 만드는 것은", "그 까닭은" 같은 연결어로 마디를 이어 붙여 읽는 사람이 한 호흡으로 따라가게 할 것.
- **이성 매력·인기(1단락)**: 사주 주인공의 성별에 따라 분기 (입력 헤더 성별 정보 활용)
  · 남성 사주이면: 재성(편재·정재)이 어디 자리하는지 + 도화살·홍염살 등 매력 신살 명시
  · 여성 사주이면: 관성(편관·정관)이 어디 자리하는지 + 매력 신살 명시
  "이 사주는 ◯◯에 재성/관성이 자리 잡고 도화살까지 있어 이성에게 ~한 인상을 준다" 식. 추상 격언 금지
- **이상형 + 끌림 패턴(2단락)**: 일지·시지 등의 십성·지장간 풀이로 "어떤 분위기·말투·에너지의 사람에게 끌리는가" 구체적으로. 연상·연하 끌림이 있다면 그 명리 근거(합·신살)로 1문장 (예: "무계합이라 성숙한 연상에게 끌릴 수 있다"). 십성 용어 첫 등장 시 일상어 풀이 필수
- **표현·소통 패턴 + 연애 진도(3단락)**: 식상(식신·상관) 유무로 본 로맨틱 표현 능력 + 그게 만드는 연애 진도 패턴 ("식상이 비어 있어 마음은 있어도 말이 안 나와 연애 초반에 흐지부지되기 쉽다" 식). 반복되는 갈등 패턴 1가지를 구체 상황으로 묘사
- **결혼 후 안정성 + 개선 포인트(4단락)**: 결혼 후 관계 안정화 결 1~2문장 (배우자가 어떤 결의 사람이면 잘 맞는지). + 관계 개선 포인트 1~2가지 ("리액션 연습", "작은 표현 자주 하기" 등 — 명리 처방이 아닌 **관계 운용 차원의 실천**)
- 유리한 시기 1문장 (대운 본격 분석은 [luck] 으로 미룸 — 환경·계기만)
마지막 문장에서 제목 은유 회수.

중복 회피(중요):
- 격국·신강신약·용신·오행 분포·일주 단독 묘사는 [general]·[element]·[daymaster] 섹션 전담 — 사용 금지
- 사주 전체의 합·충·형·파·해 메커니즘 자체는 [interaction] 섹션 전담 — 여기서는 그 결과가 관계에서 어떻게 발현되는지만
- 대운·세운 시기별 연애·결혼 흐름은 [luck] 섹션 전담 — 유리 시기 1문장 외 시기 묘사 금지
- 색·방위·숫자·식물·소품·명리 처방은 [advice] 섹션 전담 — 여기는 **관계 운용 실천**(표현·리액션·접근 방식)만, 명리 처방 금지
- **[wealth] 영역과 분리(필수)**: 여기서는 배우자가 만드는 **관계 자체·감정·만남 패턴**만. 결혼 후 재산 흐름·배우자 재물 영향은 [wealth] 섹션 전담 — 절대 금지

[health] — 620~760자
작성 순서:
첫 줄: 은유 제목 (강한 오행과 취약한 오행을 계절·빛으로 대비)
빈 줄
본문: 제목 은유로 시작해 건강 영역에서 이 사주가 작동하는 결을 서술. 단락들은 분리된 항목 나열이 아니라 한 편의 글처럼 흐를 것 — "그래서", "이 구조가 만드는 것은", "그 까닭은" 같은 연결어로 마디를 이어 붙여 읽는 사람이 한 호흡으로 따라가게 할 것.
- **오행 분포 진단 + 양면 묘사(1단락)**: 강한 오행과 약한 오행을 **사주 자리(연·월·일·시 어디에)** 까지 명시적으로 노출. **양면 묘사** 필수 — 강한 오행이 만드는 **활력 강점** 1문장 vs 같은 오행 과다가 만드는 **건강 리스크** 1문장. 추상 격언 금지
- **취약 장부 + 스트레스 증상(2단락)**: 약한 오행·충 받은 오행 기준 취약 장부 명시(목=간담, 화=심장·소장, 토=비위·췌장, 금=폐·대장, 수=신장·방광). 그 장부가 스트레스 상황에서 어떻게 반응하는지 **구체 증상 2~3가지** (예: "긴장하면 명치가 답답해지고 식욕이 떨어짐", "잠들기 어렵고 새벽 4시쯤 깨어남"). 십성 결로 본 정신적 건강 결도 한 호흡 (예: "편관 강세로 신경계 긴장이 누적되기 쉽다", "식상 비어 감정 배출구 부족"). 십성 용어 첫 등장 시 같은 호흡 안에서 일상어로 즉시 풀어 설명
- **일상 습관 + 회피 사항(3단락)**: 챙겨야 할 습관 3가지 (구체 행동 단위, 예: "아침 10분 햇볕 산책", "11시 전 취침", "주 2회 단백질 위주 저녁") + 하지 말아야 할 것 1가지 (예: "공복에 카페인 음료", "밤 12시 이후 자극적인 야식"). 추상 격언 금지
- **사주 기질이 만드는 리스크 + 환절기 주의점(4단락)**: 이 사주 기질(완벽주의·과도한 분석·관계 스트레스 등)이 만드는 **건강 리스크 1~2가지**를 구체 시나리오로 + 환절기·계절별 주의점 1문장 (강한 오행이 왕성한 계절 vs 약한 오행이 위축되는 계절)
마지막 문장에서 제목 은유 회수.

중복 회피(중요):
- 격국·신강신약·용신·오행 분포 단독 묘사는 [general]·[element] 섹션 전담 — 사용 금지 (여기서는 그 분포가 건강에 어떻게 발현되는지만)
- 일주 기질(완벽주의·이중성) 단독 묘사는 [daymaster]·[character] 전담 — 여기서는 그 기질이 만드는 **건강 리스크**만
- 사주 전체의 합·충·형·파·해 메커니즘 자체는 [interaction] 섹션 전담 — 여기서는 그 결과가 건강에서 어떻게 발현되는지만 (충 받은 오행 → 취약 장부 매핑)
- 색·방위·음식·시간대·평생 실천 처방은 [advice] 섹션 전담 — 여기는 **습관·증상·리스크 진단**만, 음식 리스트·방위 처방 금지
- 대운·세운 시기별 건강 흐름은 [luck] 섹션 전담 — 환절기·계절 주의점 1문장 외 시기 묘사 금지

[relation] — 660~820자
작성 순서:
첫 줄: 은유 제목 (넓은 인맥과 깊은 관계, 또는 귀인과 멀리해야 할 유형 대비)
빈 줄
본문: 제목 은유로 시작해 가족·인맥 영역에서 이 사주가 작동하는 결을 서술. 단락들은 분리된 항목 나열이 아니라 한 편의 글처럼 흐를 것 — "그래서", "이 구조가 만드는 것은", "그 까닭은" 같은 연결어로 마디를 이어 붙여 읽는 사람이 한 호흡으로 따라가게 할 것.
- **인맥 형성 + 운용(1단락)**: 비겁·식상·관성 배치로 본 인맥 형성 스타일을 명리 근거로 노출 + "처음 만난 자리에서 보이는 행동" 1문장 + "어떤 관계에서 오래 유지되는가" 1문장. 십성 용어(비겁·식상·관성·인성·재성) 첫 등장 시 같은 호흡 안에서 일상어로 즉시 풀어 설명 (예: "비겁이 강해 친구·동료와 어울리며 에너지를 얻는 사주")
- **어머니 단락(2단락)**: 인성(편인·정인)이 사주 어느 자리(월지·연지·월간 등)에 있는지 + 그 강약을 명시적으로 노출. 어머니의 캐릭터(지혜·학구·신중 등) 1~2문장 + **양면 묘사**(보살핌이 지극 vs 간섭이 강함 / 의지 가능 vs 독립 필요) 1~2문장. 인성이 미약하면 "어머니와의 정서적 거리감" 결로 분기
- **아버지 단락(3단락)**: 재성(편재·정재)이 사주 어느 자리(일지·시지·월간 등)에 있는지 + 위치로 본 부친 관계 1~2문장 (예: "재성이 시지에 있어 아버지보다는 본인의 배우자나 처가 덕이 더 크다", "재성이 월간에 떠 있어 아버지의 활동력이 강하다"). 아버지 캐릭터(활동적·과묵·거리감) + 양면 묘사 1문장. 재성이 미약하면 "일찍 떨어져 지내거나 정서적 거리" 결로 분기
- **형제·동료 + 비겁 양면성(4단락)**: 비겁(비견·겁재) 배치로 본 형제·동료 관계 1~2문장. 무난·경쟁·성장 중 어느 결인지 명리 근거로 노출 + **비겁의 양면성** 1문장 명시 — 비겁은 친구·동료를 의미하는 동시에 **재물을 나누는 경쟁자**이기도 함. 비겁이 강하면 "친구·동료는 늘 곁에 있지만 재물 자리에선 견제·분담의 결이 따라온다" 식으로, 비겁이 약하면 "동료보다 혼자 깊이 쌓는 결" 식으로 분기
- **자녀 단락(5단락)**: 시간 정보 있을 때 — 시주 관성·식상이 어떻게 배치되어 있는지 + 시지(자녀 자리) 글자가 어떤 기운인지 명시적으로 인용. 자식 캐릭터(반듯·총명·활동적 등) 1문장 + **양면 묘사**(자식복 vs 교육열·기대 압박) 1~2문장. 시간 미상이면 "시주 미상으로 자녀궁 제한적" 한 줄만
- **결혼 후 가족 역학(6단락)**: 결혼 후 가족 관계의 무게중심을 1~2문장 (예: "재성이 시지에 있어 처가와 가깝게 지내는 것이 가정의 평화", "어머니와 아내 사이 중재자 역할이 중요"). 이는 배우자 자체 묘사가 아닌 **가족 구성원 간 역학**임을 유지 — [love] 영역과 절대 겹치지 않게
- **귀인 vs 거리 두기 + 작용 메커니즘(7단락)**: 의지하면 좋은 사람 유형 1개 + 거리 두어야 하는 유형 1개를 **십성·오행 + 띠** 근거로 정밀하게 (예: "목 기운이 강한 사람 — 호랑이띠·토끼띠 또는 사주에 목이 많은 사람이 귀인", "금 기운이 강한 사람 — 원숭이띠·닭띠는 적당히 거리"). 각각 **어떤 작용으로 도와주거나 소모시키는지** 한 호흡씩 풀이 (예: "막힌 표현력을 뚫어주고 생각을 행동으로 옮기게 도와줌", "생각을 더 복잡하게 만들고 에너지를 가라앉힘"). 추상 격언 금지
- **관계 운용 조언(8단락)**: 실제 행동 단위로 1~2가지 명시 — "이해타산 자제, 작은 손해 감수", "감정 공감 한 박자 먼저", "진심으로 마음 열 깊은 친구 한두 명 유지" 같은 결. 명리 처방이 아닌 **관계 운용 차원의 실천**임을 유지
마지막 문장에서 제목 은유 회수.

중복 회피(중요):
- 격국·신강신약·용신·오행 분포·일주 단독 묘사는 [general]·[element]·[daymaster] 섹션 전담 — 사용 금지
- 사주 전체의 합·충·형·파·해 메커니즘 자체는 [interaction] 섹션 전담 — 여기서는 그 결과가 관계에서 어떻게 발현되는지만
- 대운·세운 시기별 인간관계 흐름은 [luck] 섹션 전담 — 시기 묘사 금지
- 색·방위·숫자·식물·소품·명리 처방은 [advice] 섹션 전담 — 여기는 **관계 운용 차원의 통찰**(귀인·거리 두기 유형, 중재자 역할)만, 명리 처방 금지
- **[love] 영역과 분리(필수)**: 배우자 성격·만남 방식·연애 패턴·결혼 안정성은 [love] 섹션 전담 — 여기서는 **가족 구성원으로서의 처가·시댁·중재자 역할**만 1~2문장. 배우자 자체 묘사 절대 금지
- **[character] 영역과 분리(필수)**: 본인 성격·기질 묘사는 [character] 전담 — 여기서는 **관계 행동·가족 역학**만

[luck] — 1080~1320자 (대운 흐름 입체적, 가장 깊이)
작성 순서:
첫 줄: 은유 제목 (대운 흐름의 과거·현재·미래를 달의 차고 기움·계절 전환으로 대비)
빈 줄
본문 4단락 구조 필수. 단락들은 분리된 시기 나열이 아니라 한 편의 글처럼 흐를 것 — "그 흐름이 이어져", "그 기반 위에서", "그 다음으로 열리는 국면은" 같은 연결어로 시기 사이를 부드럽게 잇고, 십성 용어 첫 등장 시 같은 호흡 안에서 일상어로 즉시 풀어 설명.

[1단락 — 과거 대운 회고] 150~220자
이전 대운(${prevDaeWoonStr})이 어떤 시기였는지를 **간지·오행·십성** 중 적어도 1개로 명리 근거를 노출하면서 진단. 그 시기 형성된 **기반(긍정 자산) 1가지** + **미해결 과제(부정 자산) 1가지**를 양면 묘사로. 추상 격언("힘든 시기였다") 금지, 구체적 영역(일·관계·재물 중 무엇이 어떻게)으로 묘사. 첫 대운이라 이전 없으면 "대운 시작 전 청소년기는 사주 원국이 그대로 발현되던 잠재기"로 시작 후 그 잠재기의 결을 사주 원국 결로 풀이.

[2단락 — 현재 대운 본론] 480~600자
1단락 마무리 호흡을 받아 자연스럽게 이어 시작. 현재 대운(${currentDaeWoonStr})의 **간지·오행·십성·12운성**을 명시적으로 노출하면서, 그 대운이 일·관계·재물 각각에 미치는 영향을 5~6문장으로 입체 묘사. 각 영역마다 **유리한 조건 vs 불리한 조건** 양면 명시 (예: "재성 대운이라 사업·투자 활동이 활발해지지만, 동시에 비겁이 강한 사주라면 동업·합작에서 분쟁 가능성 증가"). 향후 5년 세운(${recentSeWoon}) 5개 연도 각각 한 줄씩 "YYYY년 OO(간지·십성)은 ~한 흐름이 들어와 ~을 우선해야 한다" 형식 (5줄 모두 필수). 5개년 간 **단순 나열 X**, 흐름이 어떻게 변하는지(예: "전반기 ~ 후 후반기 ~로 전환") 한 호흡으로 묶기.

[3단락 — 미래 대운 예고] 320~400자
2단락 마무리 호흡을 받아 자연스럽게 이어 시작. 다음 대운(${nextDaeWoonStr})의 간지·오행·십성을 노출하면서, 어떤 국면이 열리는지 3~4문장 입체 묘사. **유리한 영역 vs 도전 영역** 양면 명시. 그 대운에서 가장 중요한 준비 한 가지를 **지금부터 무엇으로 시작해야 하는지** 구체 행동 단위로 (예: "다음 대운 진입 전 자격증·인맥·자본 중 ~를 미리 확보"). 차차기 대운(${nextNextDaeWoonStr})까지 데이터 있으면 "그 다음 대운에선 ~" 한 줄로 예고. 데이터 끝이면 "그 너머는 본 사주 데이터 범위 밖" 명시.

[4단락 — 마무리] 80자 내외
3단락 마무리 호흡을 자연스럽게 이어받아 제목 은유 회수 + "대운은 10년 단위로 바뀌는 하늘의 계절"임을 한 줄로 정리.

중복 회피(중요):
- 격국·신강신약·용신·오행 분포·일주 단독 묘사는 [general]·[element]·[daymaster] 섹션 전담 — 사용 금지 (여기서는 대운·세운이 그 결과에 어떻게 영향을 주는지만)
- 본인 성격·기질 단독 묘사는 [character] 전담 — 여기서는 시기별 변화만
- 직업·재물·연애·건강·관계의 **원국 진단**은 [career]·[wealth]·[love]·[health]·[relation] 전담 — 여기서는 **시기별 흐름**만
- 사주 전체의 합·충·형·파·해 메커니즘 자체는 [interaction] 전담 — 여기서는 대운·세운과 원국의 충합 결과만
- 색·방위·음식·시간대 처방은 [advice] 전담 — 여기는 **시기별 운용 전략**만, 명리 처방 금지

[advice] — 구조화 포맷 필수 (파싱에 사용됩니다)
반드시 아래 순서·형식 정확히 지킵니다.

첫 줄: 은유 제목 (용신 오행의 개운 방향을 자연 이미지로)
빈 줄
시간대: (하루 중 유리한 1구간, 예: 오전 6시~9시)
음식: (용신 ${yongSinElement} 오행 보강 식재료 2개, 쉼표 구분, 예: 부추, 시금치)
빈 줄
(본문 810~970자, 아래 3단락 + 마무리 구조 필수)

[1단락 — 용신 보강의 의미·일상 적용] 250~330자
제목 은유로 시작해 용신 ${yongSinElement} 보강의 의미와 일상 적용을 깊이 서술. 다른 섹션 결론 단순 반복 X, 처방 행동의 명리 근거에 집중.
 ★ 본문에서 용신 인용 시 반드시 「${yongSinElement}」 + 그 오행 두 천간(목=갑목·을목, 화=병화·정화, 토=무토·기토, 금=경금·신금, 수=임수·계수)을 우선 표기하고 십성(${yongSin})은 괄호로만 병기. 예: "용신인 ${yongSinElement}(${ELEMENT_TO_STEMS_TEXT[yongSinElement] ?? '해당 천간'}), 즉 ${yongSin}이 들어오는 시기에는…"

[2단락 — 거주·이사·해외·주거 환경] 350~420자
용신 ${yongSinElement} 오행의 방위·환경 처방을 구체 지역명까지 풀어 서술. 추상 격언·UI 카드 단순 반복 금지.
다음 4가지 모두 다룰 것 (순서·연결어 자유, 한 편의 글처럼 흐르게):

  ① **국내 방향 + 구체 지역**: 용신 오행 방위(목=동쪽, 화=남쪽, 토=중앙, 금=서쪽, 수=북쪽)를 짧게 언급한 뒤 **서울 기준 자치구 1~2개**(목=성동·강동·광진, 화=강남·서초, 토=중구·종로, 금=서대문·은평·강서, 수=마포·용산 한강변 등) + **지방 라인 1개**(목=강원 동해안·강릉, 화=부산·울산·제주 남부, 토=충청 내륙, 금=서해안, 수=경기 북부·인천 해안)를 구체적으로 명시. 그 지역이 왜 그 사람에게 좋은지 한 호흡 풀이

  ② **해외 방향**: 용신 강한 국가 1~2개(목=일본·동남아, 화=중남미·동남아 적도권·호주 북부, 토=중국 내륙, 금=유럽·미국 동부, 수=북유럽·캐나다)와 피해야 할 방향(기신 오행 강한 곳) 1개를 명시. 피해야 할 곳에 **작용 메커니즘** 한 호흡 (예: "금 기운이 너무 강해 생각이 더 복잡해지고 활력이 가라앉음")

  ③ **재물 활동지 추가 단서** (선택, 1문장 이내): 용신 방위와 별개로 **재성 오행 방위**로 본 재물 활동에 유리한 지역. 단, [wealth] 섹션 자산 운용과 영역 분리 — 여기는 **공간·환경** 차원만

  ④ **집·주거 환경**: 채광·층수·향(예: 남향·동향) + 자연 환경(숲세권·공원·강변·산뷰 등 용신 오행과 연동) 1~2가지. "이런 집을 고르세요" 단정 어조

★ 영역 분리 가드(필수):
 - [career]·[wealth] 영역 침범 금지 — 직군 추천·자산 운용 방향 서술 X. 여기는 **공간·방위·환경** 처방만
 - [relation] 영역 침범 금지 — 띠·사람 유형 인용 X. 여기는 **장소·환경**만
 - UI 카드 단순 반복 금지 — 카드는 색·방위 핵심만 표시되므로, 본문에선 **구체 지역명·해외·집** 결로 풍부화
 - 추상 격언("좋은 곳으로 가세요") 금지 — 모든 추천에 구체 지명·환경 묘사 필수

[3단락 — 추천 취미 + 인생 격려] 150~210자
2단락 마무리 호흡을 받아 자연스럽게 이어 작성. "그리고", "또한" 같은 연결어로.
다음 2가지 모두 포함:
  ① **추천 취미 4~5개** — 용신 ${yongSinElement} 오행과 연동된 활동을 구체적으로 (목=등산·원예·식물 가꾸기·글쓰기·산림욕 / 화=노래·춤·악기 연주·요리·캠프파이어 / 토=요리·도예·캠핑·정원 가꾸기·등산 / 금=금속공예·악기·정리정돈·캘리그라피·헬스 / 수=수영·낚시·명상·여행·차 마시기). 그 취미가 왜 이 사주에 맞는지 한 호흡 풀이
  ② **인생 격려 한 줄** — 사주 구조의 강점·결핍을 근거로 ("부족한 건 ~ 뿐", "이제 ~ 멈추고 ~ 할 때" 식). 추상 격언 금지, 이 사주만의 결로

★ 행운의 숫자는 별도 UI 카드("행운 숫자")로 표시되므로 본문에서 언급 금지 (UI 단순 반복 방지)

빈 줄
평생 실천:
- (구체 행동 1 — 일상에서 꾸준히 반복할 수 있는 습관, 추상 격언 금지)
- (구체 행동 2)
- (구체 행동 3)
- (구체 행동 4)

[마무리 — 잠재력 응원 + 제목 은유 회수] 60~90자
"당신의 잠재력은 아직 ~", "이제 ~ 해제하고, ~만의 결로 ~" 같은 결로 1~2문장 응원 + 마지막 문장에서 제목 은유 회수. 진심 어린 격려 톤, 과장된 단언 금지.

출력은 [character] 마커부터 시작. 마커 이전 텍스트 없어야 함.
8개 섹션 모두 빠짐없이 작성하고 [advice] 까지 완료한 직후 응답을 끝낸다.`;
};

/**
 * 기간 운세 영역별 상세 (신년/오늘/지정일 공통)
 * - 사주 원국 + 대상 기간 간지 + 엔진이 계산한 도메인 점수를 프롬프트에 주입
 * - 5개 영역(재물·직업·애정·건강·학업)에 대해 각 7문장 분석 생성 (직원 피드백)
 * - 응답은 [key] 델리미터로 구분되어 프론트에서 파싱
 */
export interface PeriodDomainBrief {
  key: 'wealth' | 'career' | 'love' | 'health' | 'study';
  label: string;
  score: number;
  grade: string;
}

export const generatePeriodDomainsPrompt = (
  result: SajuResult,
  opts: {
    scopeLabel: string;       // "2026년 신년운세" / "오늘(2026-04-16)" / "2026-05-03 지정일"
    targetGanZhi: string;     // "을사" / "경오" 등
    overallHeadline: string;  // 엔진이 만든 한줄 총평
    domains: PeriodDomainBrief[];
  }
): string => {
  const { pillars, elementPercent, yongSinElement, isStrong } = result;
  const domainList = opts.domains
    .map(d => `- ${d.label}(${d.key}): ${d.score}점 · ${d.grade}`)
    .join('\n');

  return `[내 사주 원국]
일주: ${pillars.day.gan}${pillars.day.zhi} (${pillars.day.ganElement}일간)
오행: 목${elementPercent.목}% 화${elementPercent.화}% 토${elementPercent.토}% 금${elementPercent.금}% 수${elementPercent.수}%
${isStrong ? '신강' : '신약'} · 용신: ${yongSinElement}

[분석 대상]
기간: ${opts.scopeLabel}
간지: ${opts.targetGanZhi}
총평: ${opts.overallHeadline}

[엔진이 산출한 영역별 점수]
${domainList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 규칙]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1) 위 5개 영역 각각에 대해 정확히 7문장 설명을 작성합니다.
   (직원 피드백: 지정일 운세 콘텐츠 깊이 부족 — 5문장 → 7문장 확장)
2) 각 영역 설명은 다음 구조로:
   - 1문장: 대상 기간 간지(${opts.targetGanZhi})와 일간(${pillars.day.gan})의 십성·용신 관계 — 현재 기운의 자리
   - 2문장: 이 기운이 해당 영역에서 구체적으로 어떻게 드러나는지 (구체 장면)
   - 3문장: 유리한 시간대 또는 조건 1가지 명시 (오전/오후/저녁 + 어떤 행동)
   - 4문장: 함께 있으면 도움 되는 사람 유형 또는 환경 1가지
   - 5문장: 조심할 함정 (구체적 상황/실수)
   - 6문장: 실천 가능한 구체 행동 1가지 (오늘 안 시작 가능)
   - 7문장: 이 날의 핵심을 한 줄로 압축 (격언 X, 단정형)
3) 점수가 높으면 낙관, 낮으면 비관으로 단순화하지 말고, 어떤 조건에서 유리/불리한지로 쪼개 서술합니다.
4) 일상 장면으로 내려앉혀 서술 (회의·연락·구매·식사·운동 등). 추상적 격언 금지.
5) 출력 형식은 반드시 아래 델리미터를 사용합니다. 다른 머리말·설명·요약 금지.

${METAPHOR_SHORT_GUIDE}

[wealth]
(재물 7문장 — 위 1~7문장 구조 준수)

[career]
(직업 7문장 — 위 1~7문장 구조 준수)

[love]
(애정 7문장 — 위 1~7문장 구조 준수)

[health]
(건강 7문장 — 위 1~7문장 구조 준수)

[study]
(학업 7문장 — 위 1~7문장 구조 준수)`;
};

/**
 * 신년운세 종합 리포트 프롬프트
 * - 원국 + 세운 + 대운 + 월별흐름 + 도메인 점수를 통합해 8개 섹션 내러티브 생성
 * - AI 티 없는 자연스러운 한국어 서술, 마크다운·이모지 금지
 */

export const NEWYEAR_SECTION_KEYS = ['general', 'wealth', 'career', 'love', 'health', 'relation', 'monthly', 'lucky'] as const;
export type NewyearSectionKey = typeof NEWYEAR_SECTION_KEYS[number];

export const NEWYEAR_SECTION_LABELS: Record<NewyearSectionKey, string> = {
  general: '총운',
  wealth: '재물운',
  career: '직장·사업운',
  love: '연애·결혼운',
  health: '건강운',
  relation: '인간관계운',
  monthly: '월별 흐름',
  // 직원 피드백: 상단 시각 카드("연간 행운 처방")와 라벨 통일 — 역할 = 텍스트 추천
  lucky: '행운 처방',
};

export const generateNewyearReportPrompt = (
  result: SajuResult,
  opts: {
    year: number;
    seWoon: SeWoon;
    currentDaeWoon: DaeWoon | null;
    monthlyFlow: { month: number; grade: string; keyword: string }[];
    domains: { key: string; label: string; score: number; grade: string }[];
    overallScore: number;
    overallGrade: string;
  }
): string => {
  const { pillars, elementPercent, isStrong, yongSinElement, yongSin, hourUnknown, gender, dayMasterYinYang } = result;
  const { year, seWoon, currentDaeWoon, monthlyFlow, domains, overallScore, overallGrade } = opts;
  const gyeokguk = determineGyeokguk(result);
  const sipseongCounts = computeSipseongCounts(result);
  const sipseong = formatSipseongCounts(sipseongCounts);
  // 직원 피드백: 사주에 없는 십성(예: 편관 0개)이 본문에 등장하는 오류 방지.
  // 0개 십성 목록을 명시 + 작성 규칙에서 해당 십성 사용 금지 강제.
  const ALL_SIPSEONG = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'] as const;
  const missingSipseongList = ALL_SIPSEONG.filter(s => (sipseongCounts[s] ?? 0) === 0);
  const missingSipseongStr = missingSipseongList.length > 0 ? missingSipseongList.join(', ') : '없음(모든 십성이 1개 이상 분포)';
  // 세운으로 들어오는 십성은 별도 — 본문에서 "올해 들어오는 ~십성"으로만 사용 가능
  const seWoonTenGod = seWoon.tenGod;

  const pillarLine = hourUnknown
    ? `년주: ${pillars.year.gan}${pillars.year.zhi}  월주: ${pillars.month.gan}${pillars.month.zhi}  일주: ${pillars.day.gan}${pillars.day.zhi}  시주: 미상`
    : `년주: ${pillars.year.gan}${pillars.year.zhi}  월주: ${pillars.month.gan}${pillars.month.zhi}  일주: ${pillars.day.gan}${pillars.day.zhi}  시주: ${pillars.hour.gan}${pillars.hour.zhi}`;

  const daeWoonLine = currentDaeWoon
    ? `${currentDaeWoon.startAge}~${currentDaeWoon.endAge}년  ${currentDaeWoon.gan}${currentDaeWoon.zhi}(${currentDaeWoon.ganElement}·${currentDaeWoon.zhiElement})  십성: ${currentDaeWoon.tenGod}  12운성: ${currentDaeWoon.twelveStage}`
    : '아직 대운 시작 전';

  const monthlyLine = monthlyFlow
    .map(m => `${m.month}월: ${m.grade}(${m.keyword})`)
    .join(' / ');

  const domainLine = domains
    .filter(d => d.key !== 'overall')
    .map(d => `${d.label} ${d.score}점·${d.grade}`)
    .join(' / ');

  const wealthDomain = domains.find(d => d.key === 'wealth');
  const hourNote = hourUnknown
    ? '\n출생 시간 미상 — 시주(時柱) 관련 자녀운·말년운·시간대 해석은 간략히 처리.'
    : '';

  return `[내 사주 원국]
${pillarLine}
일간: ${pillars.day.gan}(${pillars.day.ganElement} · ${dayMasterYinYang})
오행: 목${elementPercent.목}% 화${elementPercent.화}% 토${elementPercent.토}% 금${elementPercent.금}% 수${elementPercent.수}%
신강신약: ${isStrong ? '신강' : '신약'}
용신: ${yongSinElement}(${yongSin})  희신: ${result.heeSin}  기신: ${result.giSin}
격국: ${gyeokguk.name} (판정 근거: ${gyeokguk.reason})
십성 분포: ${sipseong}
★ 원국에 0개인 십성: ${missingSipseongStr}
   → 본문에서 이 십성을 "사주에 ~십성이 강하다/있다"고 서술하면 절대 안 됨.
   → 단 세운 천간 십성(${seWoonTenGod})은 "올해 ~이 들어온다"로 사용 허용.
간여지동: ${formatGanYeojidong(result)} / 병존·삼존: ${formatByeongjOn(result)}
성별: ${gender === 'male' ? '남성' : '여성'}${hourNote}

[${year}년 세운 — ${seWoon.gan}${seWoon.zhi}(${seWoon.animal}년)]
세운 천간: ${seWoon.gan}(${seWoon.ganElement}) — 일간 ${pillars.day.gan} 기준 십성: ${seWoon.tenGod}
세운 지지: ${seWoon.zhi}(${seWoon.zhiElement})
세운 12운성: ${seWoon.twelveStage}

[현재 대운]
${daeWoonLine}

[엔진 계산 점수 — 이 방향성 유지 필수]
총운: ${overallScore}점·${overallGrade}
${domainLine}

[${year}년 월별 흐름]
${monthlyLine}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 규칙 — 절대 준수]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1) Markdown 절대 금지. 별표(**), 헤딩(#), 이모지 전부 금지.
2) 불릿은 "- " 또는 "· " 형식만 허용.
3) AI임을 드러내는 문구("분석 결과", "데이터에 따르면", "제가 보기에") 금지.
4) 위 엔진 점수의 길흉 방향성을 뒤집지 말 것. 해석은 허용, 등급 변경은 금지.
5) 각 섹션 첫 문장에서 결론을 먼저 말하고 근거를 이어붙이는 방식.
6) 전문 용어(십성·격국·용신·대운 등)는 첫 등장 시 괄호로 쉬운 말 병기.
7) "~일 수 있습니다" "혹시" 같은 흐린 표현은 전체 답변에서 2회 이하. 단정적 어투 유지.
8) 출력은 [general] 마커부터 시작. 마커 이전에 어떤 텍스트도 없어야 함.
9) 아래 8개 마커를 빠짐없이 정확히 사용. 마커는 줄 처음에 단독으로 위치. 마커 뒤 바로 내용 시작.
   반드시 포함해야 하는 마커 체크리스트: [general] [wealth] [career] [love] [health] [relation] [monthly] [lucky] — 하나라도 빠지면 실패.
10) ★ 데이터 무결성 — 위 "원국에 0개인 십성" 목록의 십성을 본문에서 "사주에 있다/강하다/약하다" 형태로 서술 절대 금지.
    예시 금지: "당신 사주의 편관이 강해…" / "정관이 부족한 사주라…"
    (단 세운으로 들어오는 ${seWoonTenGod}는 "올해 ${seWoonTenGod}(쉬운말)이 들어와…"로 사용 가능)
11) [lucky] 섹션은 색상·방위·숫자·시간대를 본문에 절대 적지 말 것. 별도 시각 카드(LuckyVisualCard)에 이미 표시되므로 텍스트 중복 금지.
12) ★ 줄바꿈 규칙 — 같은 단락 내 문장 사이에는 줄바꿈(\\n) 금지. 문장을 이어 붙여 자연스러운 문단으로 작성. 단락 전환 시에만 빈 줄(\\n\\n) 사용. [monthly]는 월과 월 사이에만 빈 줄 사용, 같은 월 내 문장은 줄바꿈 없이 이어 작성.

${METAPHOR_KB}

${METAPHOR_TITLE_RULE}

[섹션별 지침]

[general]
${year}년 전체 기조 — 320~430자
첫 줄: 이 해 전체를 관통하는 은유적 제목(7~12자) 1줄.
세운 ${seWoon.gan}${seWoon.zhi}이 일간 ${pillars.day.gan}에 ${seWoon.tenGod}으로 작용하는 구체적 의미 1단락. 대운 흐름과 겹쳐 어떤 국면(도약기·축적기·전환기·수성기)인지 명확히 판정. 이 해에 가장 도드라지는 축(재물·직장·관계·건강) 중 2가지를 선정해 왜 그런지 설명. 올 한 해 핵심 주제 문장 1개로 마무리.

[wealth]
재물운 — 280~360자
첫 줄: 재물운을 상징하는 은유적 제목(7~12자) 1줄.
세운 십성(${seWoon.tenGod})과 용신(${yongSinElement})의 관계로 수입이 들어오는 경로·시기 1단락. 지출 위험 구간과 조심할 금전 결정 1가지 구체적으로. 재테크 방향 1가지(주식·부동산·저축·사업 중 어떤 방향이 유리한지). 엔진 점수 ${wealthDomain?.score ?? '?'}점(${wealthDomain?.grade ?? '?'}) 방향성 유지.

[career]
직장·사업운 — 280~360자
첫 줄: 커리어 기운을 상징하는 은유적 제목(7~12자) 1줄.
직장인과 사업자를 구분해 각각 1~2문장씩 풀이. 세운과 원국의 관성·재성 관계로 승진·이직·계약·파트너십 중 유리한 것 명시. 결정 내리기 좋은 월 1~2개 구체 명시 (월별 흐름 참고). 조심할 직장 내 함정 1가지.

[love]
연애·결혼운 — 280~360자
첫 줄: 인연·관계 기운을 상징하는 은유적 제목(7~12자) 1줄.
기혼자와 미혼자를 구분해 각각 핵심 기운 1단락씩. 이 해 가장 좋은 인연 시기를 월별 흐름 참고해 구체 월로 명시. 관계 갈등이 생기기 쉬운 패턴 1가지와 해소 방향. 사랑·결혼 결정을 내리기 좋은 조건 1가지.

[health]
건강운 — 220~290자
첫 줄: 건강 기운을 상징하는 은유적 제목(7~12자) 1줄.
오행 분포와 세운 오행으로 취약 장부 판단 (구체 장부명 명시). 이 해 특히 주의할 건강 위험 계절·시기 1개. 일상에서 챙겨야 할 구체 습관 2가지 (음식·운동·수면·환경 중). "이 해의 건강 함정" — 가장 조심해야 할 생활 패턴 1가지.

[relation]
인간관계운 — 220~290자
첫 줄: 인간관계 기운을 상징하는 은유적 제목(7~12자) 1줄.
비겁·식상·관성 배치로 본 ${year}년 인간관계 전반적 기운. 의지할 관계 유형 1가지 (구체적 직업·성격 유형). 멀리해야 할 관계 유형 1가지 (왜 그런지 이유 포함). 이 해 특별히 도움이 되는 인연 특징 1가지.

[monthly]
월별 흐름 — 총 720~900자
첫 줄: 한 해의 월별 리듬을 관통하는 은유적 제목(7~12자) 1줄.
빈 줄 후 1월부터 12월까지 순서대로. 위 월별 등급·키워드를 근거로 각 월의 핵심 기운을 서술.
각 월 60~75자(2~3문장), 줄바꿈 없이 이어서 작성. 각 월에 다음을 포함:
1) 그 달 핵심 기운과 일상 장면 (1~2문장)
2) 우선 행동 또는 조심할 함정 (1문장)
★ 월과 월 사이에 반드시 빈 줄(empty line) 1개 삽입. 같은 월 내 문장 사이에는 줄바꿈 금지.
★ 각 월의 서술은 반드시 해당 월의 등급·키워드만 참고. 이전 월 내용이 다음 월에 반복·침범 금지.
포맷 — 반드시 "N월(등급·키워드): " 형태로 시작하고 해당 월 고유 기운만 서술. 예시:

5월(길·확장): 편재가 들어오며 투자·사업 확장 흐름이 열린다. 새로운 파트너나 거래처가 눈에 들어오는 시기이니 과감하게 한 발 내딛되 계약 조건은 꼼꼼히 볼 것.

6월(평·유지): 지난달의 흐름을 이어가되 새로운 시도보다는 안정을 우선한다. 주변 관계를 돌보는 데 에너지를 쏟는 것이 현명하다.

[lucky]
행운 처방 — 280~360자, 텍스트 본문만 (시각 카드는 별도 컴포넌트로 자동 표시됨)
첫 줄: ${year}년을 관통하는 행운 테마를 은유적 제목(7~12자) 1줄.
빈 줄 후 본문 — 용신(${yongSinElement}) 기준 불릿(- ) 형식, 색상·방위·숫자·시간대 언급 절대 금지:
- 보강 음식 2가지 (구체적 식재료·요리명 + 왜 도움이 되는지 한 마디)
- 추천 향기·아로마 1가지 (언제 사용하면 좋은지)
- ${year}년 개운 활동 2가지 (용신 오행 원소와 연결된 구체 취미·습관)
- 보석·소품 1가지 (어떻게 활용하면 좋은지)
- 이 해 특히 길한 계절·달 (이유 1문장)

출력은 [general] 마커부터 시작. 마커 이전에 어떤 텍스트도 없어야 함.`;
};

/**
 * 자미두수 프롬프트 (3엽전)
 * - 12궁 + 14주성 + 명궁/신궁/오행국 + 사화 기반 종합 해석
 * - 불변 지식(주성/보좌성/사화/궁 의미)은 knowledge.ts에서 뽑아 주입
 *   AI는 "무슨 별이 무슨 뜻인지"를 창작하지 않고, 주입된 해설만 엮어 서술한다
 */
import type { ZamidusuResult } from '../engine/zamidusu';
import { collectKnowledge } from '../engine/zamidusu/knowledge';

// 자미두수 결과 섹션 키 — 결과 페이지에서 파싱해 카드별 렌더
export const ZAMIDUSU_SECTION_KEYS = [
  'overview',     // 명반 첫 인상 (은유 헤드라인 + 명주·신주·오행국 요약)
  'core',         // 명궁·신궁 핵심 (주인공별)
  'relations',    // 부처·자녀·형제·노복·부모 (5개 관계궁 묶음)
  'wealth',       // 재백·관록·전택 (3개 재물·일 묶음)
  'body_mind',    // 질액·복덕·천이 (3개 몸·마음·이동 묶음)
  'mutagen',      // 사화
  'daehan',       // 대한 흐름
  'advice',       // 마지막 조언
] as const;
export type ZamidusuSectionKey = typeof ZAMIDUSU_SECTION_KEYS[number];

export const ZAMIDUSU_SECTION_LABELS: Record<ZamidusuSectionKey, string> = {
  overview:  '첫 인상',
  core:      '주인공 별',
  relations: '관계 하늘',
  wealth:    '재물·일의 하늘',
  body_mind: '몸과 마음의 하늘',
  mutagen:   '사화 — 별의 변주',
  daehan:    '대한 — 10년 리듬',
  advice:    '별이 건네는 조언',
};

export const generateZamidusuPrompt = (z: ZamidusuResult): string => {
  const palaceSummary = z.palaces.map((p) => {
    const majors = p.majorStars.map((s) => {
      const mut = s.mutagen ? `·${s.mutagen}` : '';
      const br = s.brightness ? `(${s.brightness})` : '';
      return `${s.name}${br}${mut}`;
    }).join(' ');
    const minors = p.minorStars.slice(0, 4).map((s) => s.name).join(' ');
    return `${p.name}[${p.heavenlyStem}${p.earthlyBranch}${p.isBodyPalace ? '·신궁' : ''}] 주성: ${majors || '(공궁)'}${minors ? ` 보조: ${minors}` : ''}`;
  }).join('\n');

  // 명반에 실제 등장한 별만 뽑아 해설 주입
  const knowledge = collectKnowledge(z);

  const majorDesc = knowledge.majorStars.map(({ palace, meta, mutagen }) => {
    const mut = mutagen ? ` [${mutagen.name}(${mutagen.hanja}): ${mutagen.effect} (+)${mutagen.positive} (-)${mutagen.caution}]` : '';
    return `- ${palace}의 ${meta.name}(${meta.hanja}): ${meta.theme} | 키워드: ${meta.keywords.join(', ')} | 강점: ${meta.strength} | 약점: ${meta.weakness}${mut}`;
  }).join('\n') || '(명반에 14주성 해설 데이터 없음)';

  const minorDesc = knowledge.minorStars.map(({ palace, meta }) => {
    return `- ${palace}의 ${meta.name}(${meta.hanja}) [${meta.category}]: ${meta.effect}`;
  }).join('\n') || '(보좌성 없음)';

  const palaceRoleDesc = knowledge.palaceRoles.map((r) => {
    return `- ${r.name}: ${r.domain} — ${r.focus}`;
  }).join('\n');

  return `당신은 자미두수(紫微斗數) 전문가입니다. 아래 명반을 바탕으로 ${z.gender === '남' ? '한 남성' : '한 여성'}의 인생 별자리를 읽어줍니다.

[의뢰인 명반 기본 정보]
양력 생년월일: ${z.solarDate} ${z.timeRange}(${z.time}) / 음력: ${z.lunarDate} / 간지: ${z.chineseDate}
띠: ${z.zodiac} / 별자리: ${z.sign}
명주(命主): ${z.soul}  |  신주(身主): ${z.body}  |  오행국: ${z.fiveElementsClass}
명궁 지지: ${z.soulBranch}  |  신궁 지지: ${z.bodyBranch}

[12궁 명반]
${palaceSummary}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[불변 지식 — 반드시 아래 해설만 근거로 사용할 것]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▣ 14주성 해설 (이 명반에 실제 등장한 별)
${majorDesc}

▣ 보좌성 해설 (이 명반에 실제 등장한 별)
${minorDesc}

▣ 12궁 역할
${palaceRoleDesc}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[자미두수 전용 은유 — 반드시 활용]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

자미두수는 **하늘의 별자리 지도**로 인생을 읽는 법입니다. 다음 은유를 자연스럽게 본문에 녹여 쓰세요:
- 명반(命盤) = 태어날 때 하늘에 새겨진 나만의 별자리 지도
- 12궁(十二宮) = 인생이라는 집의 12개 방 — 각 방마다 다른 영역을 주관
- 주성(主星) = 각 방의 주인공 별. 그 방의 성격을 결정
- 보좌성(輔星) = 주인공 옆에서 돕는 별 (좌보·우필 등)
- 자미(紫微) = 황제별 — 왕좌에 앉은 사람
- 천기(天機) = 지혜의 별 — 참모·책사
- 무곡(武曲) = 장수별 — 결단과 재물
- 염정(廉貞)·탐랑(貪狼) = 매혹과 욕망의 별
- 거문(巨門) = 말의 별 — 칼이 되기도 약이 되기도
- 천부(天府) = 창고별 — 쌓고 지키는 힘
- 태음(太陰) = 달의 별 — 고요한 저축
- 칠살(七殺)·파군(破軍) = 선봉별 — 개척과 변혁
- 명궁 = 나 자신이 앉은 왕좌의 방
- 신궁 = 나의 또 다른 페르소나가 머무는 방
- 사화(四化) = 별의 변주 — 같은 별이 4가지 다른 노래를 부름
  · 화록(化祿) = 복과 재물이 흐르는 문 열림
  · 화권(化權) = 권세의 지팡이를 쥔 순간
  · 화과(化科) = 이름이 하늘에 새겨지는 순간
  · 화기(化忌) = 별이 가려지는 일식의 순간 — 경계 필요
- 대한(大限) = 10년마다 바뀌는 내 인생 무대 조명

${METAPHOR_SHORT_GUIDE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 규칙 — 절대 준수]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1) **Markdown 절대 금지**: #, ##, ###, **, \`\`, > 같은 기호 전부 금지. 본문은 평서문 문장으로만.
2) **이모지 금지**.
3) **AI 티 제거**: "AI로서", "분석 결과", "제공된 데이터에 따르면", "자미두수 AI가" 같은 표현 절대 금지. 35년 경력 도사가 직접 말하듯이 쓰세요.
4) **반드시 제공된 별 해설과 궁 역할을 근거로만 풀이할 것**. 위 목록에 없는 별 이름·사화를 창작하지 말 것.
5) **각 섹션은 첫 줄에 은유 제목을 쓰세요** (대비되는 두 이미지를 쉼표로 연결. 「」 기호 없이 평문. 예: "황제의 별이 왕좌에 앉은 하늘, 그러나 보좌가 부족한 밤"). 본문은 제목 은유로 시작해 명리 근거로 착지.
6) **전문 용어**(주성·사화·대한 등) 첫 등장 시 괄호로 쉬운 말 병기.
7) **단락 나눔 필수**: 각 섹션 본문은 의미 단위로 **2~4개의 단락**으로 나누어 쓰세요. 단락 사이에는 반드시 빈 줄 한 줄(연속 줄바꿈 두 번)을 넣으세요. 한 단락은 2~4문장이 적당합니다. 길게 한 덩어리로 쓰지 말 것.
8) **출력 형식**: 아래 8개 섹션을 [key] 델리미터로 구분. 각 섹션은 "[key]" 줄 뒤 빈 줄 없이 바로 본문 시작. 마커 이전 텍스트는 없어야 함.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[섹션 지침]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

(직원 피드백: 자미두수 풀이 깊이 부족 → 각 섹션 분량 확장 + 명리 근거 구체화 + 일상 장면 강화)

[overview] — 명반 첫 인상 (450~580자)
첫 줄: 은유 제목 (예: "${z.soul}과 ${z.body}가 만난 밤하늘, 그리고 ${z.fiveElementsClass}으로 흐르는 강물" 같은 느낌)
본문: 명주(${z.soul})·신주(${z.body})·오행국(${z.fiveElementsClass})을 풀이. 명주는 인생의 주제곡, 신주는 숨은 페르소나, 오행국은 별들이 배치된 무대.
다음을 모두 포함:
- 명주가 어떤 운명적 과제를 부여하는지 1문장
- 신주가 어떤 숨은 페르소나·재능을 가져오는지 1문장
- 오행국이 어떤 시간 흐름(빠른 발현 vs 만성장)을 만드는지 1문장
- 세 요소가 충돌하는지 조화하는지 분명히 선언
- 마지막 문장에서 제목 은유 회수

[core] — 명궁·신궁 핵심 (600~780자)
첫 줄: 은유 제목 (명궁에 좌한 주성의 성격을 대비 이미지로. 예: "왕좌에 앉은 별, 홀로 빛나는 고독")
본문: 명궁에 좌한 주성들(이름·한자 병기)과 보좌성의 조합이 만드는 기본 성향을 풀이.
다음을 모두 포함:
- 명궁 주성의 키워드 2개를 일상 장면 3개로 묘사 (회의 / 연애 / 위기 대처 등)
- 보좌성이 주성을 어떻게 보강·약화시키는지
- 신궁이 명궁과 같은 위치인지 다른 위치인지에 따라 삶이 어떻게 이중 축으로 움직이는지
- 명궁 사화가 있다면 그 별의 성격이 어떻게 변주되는지 (없으면 "명궁 사화는 없다"고 한 줄)
- 명궁 좌한 주성의 강점 1개와 함정 1개를 명시
- 마지막 문장에 제목 은유 회수

[relations] — 관계 영역 (560~720자)
첫 줄: 은유 제목 (관계의 깊이·갈등 양상을 자연 이미지 대비로)
본문: 부처궁(배우자)·자녀궁·형제궁·노복궁·부모궁 다섯 개 방을 순서대로 풀이.
각 궁마다 다음을 한 문장씩 포함 (총 5개 미니 단락):
- 부처궁: 어떤 별이 앉았고, 끌리는 이성 성향은 어떤 모습인지
- 자녀궁: 자녀와의 관계 패턴, 자녀 복의 유형
- 형제궁: 형제·자매와의 거리감, 평생 동행 가능성
- 노복궁: 친구·후배·부하 복, 누가 도와주는지
- 부모궁: 부모와의 인연 깊이, 효도·갈등 분기점
마지막에 갈등 가능 포인트 1개와 관계 복의 유형 1개를 종합 한 문장으로 정리.

[wealth] — 재물·일의 하늘 (520~680자)
첫 줄: 은유 제목 (재물이 흐르는 방식·커리어의 모양을 자연 이미지 대비로)
본문: 재백궁(돈 흐름)·관록궁(직업)·전택궁(부동산) 세 개 방을 순서대로 풀이.
다음을 모두 포함:
- 재백궁: 수입 스타일을 "꾸준히 쌓이는 달빛 같은 돈" vs "혜성처럼 들어왔다 빠지는 돈" 식의 이미지로 1문장 + 어떤 별이 그렇게 만드는지 1문장
- 관록궁: 적합 직군 2~3개를 별의 성격에 근거해 제시 + 승진·이직 흐름의 모양
- 전택궁: 부동산·자산 축적 패턴 + 첫 집·큰 자산 마련 시기 단서
- 주의할 재물 함정 1개 (별·사화 근거 명시)
- 권할 재물 행동 1개 (저축·투자·분산 중 1)

[body_mind] — 몸·마음·이동 (480~620자)
첫 줄: 은유 제목 (약한 곳·회복 방식을 자연 이미지 대비로)
본문: 질액궁(건강)·복덕궁(정신·취미)·천이궁(이동·해외)을 묶어 풀이.
다음을 모두 포함:
- 질액궁: 취약한 장부(목=간담/화=심장/토=비위/금=폐/수=신장) 1~2개 + 어느 계절·시기에 무리하면 위험한지
- 복덕궁: 스트레스 쌓이는 방식 + 회복에 좋은 취미·환경 1가지
- 천이궁: 해외·출장·이사·이민의 길흉 + 어느 방향이 유리한지
- 정신 건강 신호 1개와 대응법 1개
- 마음에 쉼이 필요한 순간 묘사 1문장

[mutagen] — 사화의 변주 (440~560자)
첫 줄: 은유 제목 (별이 다른 노래를 부르는 이미지)
본문: 화록·화권·화과·화기 각각이 어느 궁에서 작동하는지, 인생에서 어떻게 드러나는지.
다음을 모두 포함:
- 화록: 어느 궁에서 어떤 복·재물이 흐르는지 (없으면 "이 명반에는 화록이 없다" 한 줄)
- 화권: 어느 영역에서 권세·주도권을 쥐게 되는지
- 화과: 어느 영역에서 명예·인정을 받는지
- **화기는 반드시 주의 신호로 강조** + 어느 궁이 막히는지 + 대응법 1개
- 4개 사화의 균형이 인생에 어떤 톤을 주는지 마지막 1문장
- 마지막 문장 은유 회수

[daehan] — 대한 10년 리듬 (420~540자)
첫 줄: 은유 제목 (무대 조명이 바뀌는 이미지)
본문: 10년 단위로 주인공 궁이 바뀌는 흐름.
다음을 모두 포함:
- 주요 전환점 3개를 나이로 명시(예: "28~37세에 접어드는 재백궁 대한")
- 각 전환점에서 어떤 별·궁이 활성화되어 무엇을 결단해야 하는지 (3개 모두 1문장씩)
- 현재 대한의 주제 1문장
- 가장 빛날 대한 1개와 가장 신중해야 할 대한 1개를 짚어 마무리

[advice] — 별이 건네는 조언 (360~460자)
첫 줄: 은유 제목 (나아갈 방향을 자연 이미지로)
본문 3문장으로 핵심 메시지 — 이 명반의 사람은 어떻게 살면 빛나고 어떤 함정을 조심해야 하는지.
마지막에 "- " 불릿 4줄로 실천 조언 4가지:
- 구체적 행동 1개 (오늘 시작 가능)
- 길한 색 1개 (왜 그 색인지 별 근거)
- 길한 방향 1개 (왜 그 방향인지)
- 가장 좋은 시기 1개 (몇 살 또는 어느 계절)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

출력은 [overview] 마커부터 시작. 마커 이전에 어떤 텍스트도 없어야 함.
총 8개 섹션, 약 4800~6200자. (직원 피드백 반영 — 깊이 강화, 2-pass 분할 출력)`;
};

/**
 * 토정비결 프롬프트 (2엽전)
 * - 상/중/하 괘 메타 + 괘번호 기반 1년 총운 + 12개월 월운
 * - 144괘 테이블(gwae-table.ts)에서 결정론적 길흉등급·총평·월별키워드를 주입
 *   AI는 이 고정된 틀을 벗어난 길흉을 창작하지 않는다
 */
import type { TojeongResult } from '../engine/tojeong';
import { getGwaeEntry } from '../engine/tojeong/gwae-table';

const ZHI_KO = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
const ZHI_ANIMAL = ['쥐','소','호랑이','토끼','용','뱀','말','양','원숭이','닭','개','돼지'];
const GAN_ELEMENT_MAP: Record<string, string> = { '갑':'목','을':'목','병':'화','정':'화','무':'토','기':'토','경':'금','신':'금','임':'수','계':'수' };
const ZHI_ELEMENT_MAP: Record<string, string> = { '자':'수','축':'토','인':'목','묘':'목','진':'토','사':'화','오':'화','미':'토','신':'금','유':'금','술':'토','해':'수' };

function getBirthZhi(solarYear: number): string {
  const idx = ((solarYear - 1900) % 12 + 12) % 12;
  return ZHI_KO[idx];
}

function getZhiRelation(zhi1: string, zhi2: string): string {
  if (zhi1 === zhi2) return `비화(比和) — 띠해와 올해가 같은 지지(${zhi1}), 자신의 기운이 강화됨`;
  const CHUNG = [['자','오'],['축','미'],['인','신'],['묘','유'],['진','술'],['사','해']];
  if (CHUNG.some(p => (p[0]===zhi1&&p[1]===zhi2)||(p[1]===zhi1&&p[0]===zhi2))) return `상충(相冲) — 생년 지지(${zhi1})와 세운 지지(${zhi2})가 충돌, 변동·충격 주의`;
  const HAP = [['자','축'],['인','해'],['묘','술'],['진','유'],['사','신'],['오','미']];
  if (HAP.some(p => (p[0]===zhi1&&p[1]===zhi2)||(p[1]===zhi1&&p[0]===zhi2))) return `육합(六合) — 생년 지지(${zhi1})와 세운 지지(${zhi2})가 합, 협력·인연 길함`;
  const SAMHAP3 = [['신','자','진'],['인','오','술'],['사','유','축'],['해','묘','미']];
  for (const g of SAMHAP3) {
    if (g.includes(zhi1) && g.includes(zhi2)) return `삼합(三合)군 — 생년(${zhi1})·세운(${zhi2}) 같은 삼합 그룹, 기운이 융성하게 어울림`;
  }
  return `평(平) — 생년 지지(${zhi1})와 세운 지지(${zhi2}) 사이 특별한 충·합 없음`;
}

/** @deprecated 레거시 단일호출 프롬프트 — 캐시 호환용으로 보존. 새 호출은 pass1/pass2 사용. */
export const generateTojeongPrompt = (tj: TojeongResult): string => {
  const { targetYear, age, upperGwae, middleGwae, lowerGwae, gwaeNumber, formula } = tj;
  const entry = getGwaeEntry(tj.upper, tj.middle, tj.lower);
  const monthlyList = entry.monthlyHints
    .map((kw, i) => `  · ${i + 1}월: ${kw}`)
    .join('\n');

  // 세운 오행 — lunar-javascript 는 한자(丙午) 반환, 매핑 키는 한글(병/오) 이므로 normalize 필수
  const yearGanZhi = tj.yearGanZhi.ganZhi;
  const yearGan = yearGanZhi[0] ?? '';
  const yearZhi = yearGanZhi[1] ?? '';
  const yearGanKor = normalizeGan(yearGan);
  const yearZhiKor = normalizeZhi(yearZhi);
  const seunGanElement = GAN_ELEMENT_MAP[yearGanKor] ?? '목';
  const seunZhiElement = ZHI_ELEMENT_MAP[yearZhiKor] ?? '토';

  // 생년 지지 × 세운 지지
  const birthZhi = getBirthZhi(tj.birthSolar.year);
  const birthZhiIdx = ZHI_KO.indexOf(birthZhi);
  const birthAnimal = birthZhiIdx >= 0 ? ZHI_ANIMAL[birthZhiIdx] : '';
  const zhiRelation = getZhiRelation(birthZhi, yearZhiKor);

  // 원문 한문 괘사
  const hanjaSaBlock = entry.hanjaSa
    ? `▣ 원문 괘사 (卦辭)
  표제: ${entry.hanjaSa.title}
  ${entry.hanjaSa.lines.join(' / ')}
  뜻: ${entry.hanjaSa.translation}`
    : '';

  return `토정비결 풀이 요청
대상 해: ${targetYear}년 (${tj.yearGanZhi.ganZhi}년)
세는 나이: ${age}세
음력 생년월일: ${tj.birthLunar.year}년 ${tj.birthLunar.month}월 ${tj.birthLunar.day}일${tj.birthLunar.isLeap ? ' (윤달)' : ''}
생년 지지(띠): ${birthZhi}(${birthAnimal})
올해 세운 오행: 천간 ${yearGan}(${seunGanElement}) · 지지 ${yearZhi}(${seunZhiElement})
생년 띠 × 세운 지지 관계: ${zhiRelation}

계산된 괘: ${gwaeNumber} (상괘 ${tj.upper} · 중괘 ${tj.middle} · 하괘 ${tj.lower})

상괘 ${upperGwae.num} ${upperGwae.name}(${upperGwae.hanja}) ${upperGwae.symbol}
  · 상징: ${upperGwae.meaning}
  · 오행: ${upperGwae.element}
  · ${formula.upper}

중괘 ${middleGwae.num} ${middleGwae.position}
  · 의미: ${middleGwae.meaning}
  · ${formula.middle}

하괘 ${lowerGwae.num} ${lowerGwae.name}
  · 의미: ${lowerGwae.meaning}
  · ${formula.lower}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[확정된 길흉 — 반드시 아래 등급·키워드·총평의 범위 안에서 풀이]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▣ 괘 등급: ${entry.grade}
▣ 한줄 표제: ${entry.headline}
▣ 핵심 키워드: ${entry.keywords.join(', ')}
▣ 고정 총평(한 해의 틀):
${entry.summary}
${hanjaSaBlock ? `\n${hanjaSaBlock}` : ''}
▣ 12개월 기운 흐름 (월별 키워드 — 이 틀 안에서 확장)
${monthlyList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 규칙]
1) 위에 확정된 등급(${entry.grade})과 총평의 방향성을 반드시 유지. 길흉을 임의로 바꾸지 말 것.
2) 월별 운은 위 12개 월별 키워드를 기반으로만 확장할 것. 해당 월의 톤을 뒤집지 말 것.
3) 제공된 상괘·중괘·하괘 의미에서 벗어난 상징을 새로 만들지 말 것.
4) 전통 토정 어법의 시(詩)적 개운 문구 1~2줄은 허용하나, 실제 길흉 판단은 위 등급을 벗어나지 말 것.
5) 원문 괘사(표제·한문 구절)의 상징과 뜻을 풀이 서두에 자연스럽게 녹여낼 것.
6) 생년 띠(${birthZhi})와 올해 세운(${yearGanZhi}) 지지 관계(${zhiRelation})를 총운·분야별 운세에 반드시 1회 이상 언급할 것.
7) 올해 세운 오행(천간 ${seunGanElement}·지지 ${seunZhiElement})이 개인 운세에 미치는 영향을 구체적으로 서술할 것.

${METAPHOR_SHORT_GUIDE}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

위 정보를 바탕으로 ${targetYear}년 토정비결 풀이를 다음 구조로 작성하세요 (총 2900~3500자).
(직원 피드백: 분야별 운세를 4개 별도 섹션으로 세분화하여 재물·애정·건강·직장학업 각각이 독립 섹션이 되도록 구성)

반드시 전통 토정비결 어법(예: "용이 여의주를 얻은 격", "나무에 꽃이 피는 상")으로 시(詩)적인 개운 문구 1~2줄을 먼저 제시한 뒤, 현대인도 이해하기 쉽게 풀어 설명하세요.

1. 올해의 총운 (220~280자)
- 상중하괘 조합의 상징을 엮어 한 해의 큰 흐름 (등급: ${entry.grade})
- 핵심 메시지와 경계할 점, 이 한 해의 결이 어떤 감각인지

2. 괘의 의미 (180~240자)
- 왜 이 괘가 나왔는지 상징 해석
- 상괘(${upperGwae.name})·중괘(${middleGwae.position})·하괘(${lowerGwae.name})의 조화와 긴장

3. 월별 운세 (1월~12월, 각 월 3~4문장·약 90~130자)
- 각 월의 키워드(위 월별 키워드 고정)를 근거로 1문장 풀이
- 그 달에 해야 할 일 1가지 + 조심할 일 1가지를 반드시 포함
- 포맷: "N월 — [월별 키워드]" 이어서 본문 (예: "1월 — 준비")
- 정월부터 12월까지 빠짐없이 12개 소섹션으로 작성

4. 재물운 (160~210자)
- 들어오는 시기·새는 시기를 분기로 구분 (상반기/하반기 또는 봄·여름·가을·겨울)
- 본업 수입 vs 부수입의 흐름
- 재테크 방향 1개 (저축 강화·분산투자·신중 보류 등)
- 큰 지출 시 주의해야 할 달 1개 명시

5. 애정·가정운 (160~210자)
- 미혼: 인연 들어오는 흐름과 이상형 단서
- 기혼: 부부·자녀·부모 중 이달 테마와 주의 장면
- 관계 회복·갈등 분기점 시기 1개
- 가정 안에서 권할 행동 1가지

6. 건강운 (140~190자)
- 취약 장부 또는 신체 부위 (오장육부·오행 기준)
- 유의할 계절·환절기와 그 이유
- 권장 운동·식습관 1가지
- 정신 건강·스트레스 관리 한마디

7. 직장·학업운 (160~210자)
- 직장: 승진·이직·평가·인간관계 중 유리한 흐름 1개와 시기
- 학업·시험: 합격운·집중력·자격증 운
- 조심할 덫 1개 (구설·실수·과로 등)
- 협력자 또는 조력자가 누구인지 (선배·후배·이성·동료 등)

8. 개운 조언 (160~220자) — 불릿 5개
- 올해의 길한 방향 1개
- 길한 색 2개
- 행운 숫자·요일 각 1개
- 이달 안에 실천할 개운 행동 2개

섹션 제목은 위 번호(1. 2. 3. 4. 5. 6. 7. 8.) 형식 그대로 유지하고, 월별 소섹션은 12개를 모두 작성하세요. Markdown # 헤더는 절대 사용하지 마세요.`;
};

// ─────────────────────────────────────────────
// 토정비결 2-pass 프롬프트 (v2 — 섹션 깊이 확장 + 도메인 점수)
// ─────────────────────────────────────────────

export type TojeongSectionKey = 'chongun' | 'gwae' | 'monthly' | 'wealth' | 'love' | 'health' | 'career' | 'advice';

export const TOJEONG_SECTION_KEYS: TojeongSectionKey[] = ['chongun', 'gwae', 'monthly', 'wealth', 'love', 'health', 'career', 'advice'];

export const TOJEONG_SECTION_LABELS: Record<TojeongSectionKey, string> = {
  chongun: '올해의 총운',
  gwae: '괘의 의미',
  monthly: '월별 운세',
  wealth: '재물운',
  love: '애정·가정운',
  health: '건강운',
  career: '직장·학업운',
  advice: '개운 조언',
};

/** 토정비결 공통 데이터 블록 (괘 정보 + 확정된 길흉 + 작성 규칙 + 은유) */
function buildTojeongBaseBlock(tj: TojeongResult): string {
  const { targetYear, age, upperGwae, middleGwae, lowerGwae, gwaeNumber, formula } = tj;
  const entry = getGwaeEntry(tj.upper, tj.middle, tj.lower);
  const monthlyList = entry.monthlyHints
    .map((kw, i) => `  · ${i + 1}월: ${kw}`)
    .join('\n');

  const yearGanZhi = tj.yearGanZhi.ganZhi;
  const yearGan = yearGanZhi[0] ?? '';
  const yearZhi = yearGanZhi[1] ?? '';
  // lunar-javascript 는 한자(丙午) 반환, 매핑 키는 한글(병/오) 이므로 normalize 필수
  const yearGanKor = normalizeGan(yearGan);
  const yearZhiKor = normalizeZhi(yearZhi);
  const seunGanElement = GAN_ELEMENT_MAP[yearGanKor] ?? '목';
  const seunZhiElement = ZHI_ELEMENT_MAP[yearZhiKor] ?? '토';

  const birthZhi = getBirthZhi(tj.birthSolar.year);
  const birthZhiIdx = ZHI_KO.indexOf(birthZhi);
  const birthAnimal = birthZhiIdx >= 0 ? ZHI_ANIMAL[birthZhiIdx] : '';
  const zhiRelation = getZhiRelation(birthZhi, yearZhiKor);

  const hanjaSaBlock = entry.hanjaSa
    ? `▣ 원문 괘사 (卦辭)
  표제: ${entry.hanjaSa.title}
  ${entry.hanjaSa.lines.join(' / ')}
  뜻: ${entry.hanjaSa.translation}`
    : '';

  return `토정비결 풀이 요청
대상 해: ${targetYear}년 (${yearGanZhi}년)
세는 나이: ${age}세
음력 생년월일: ${tj.birthLunar.year}년 ${tj.birthLunar.month}월 ${tj.birthLunar.day}일${tj.birthLunar.isLeap ? ' (윤달)' : ''}
생년 지지(띠): ${birthZhi}(${birthAnimal})
올해 세운 오행: 천간 ${yearGan}(${seunGanElement}) · 지지 ${yearZhi}(${seunZhiElement})
생년 띠 × 세운 지지 관계: ${zhiRelation}

계산된 괘: ${gwaeNumber} (상괘 ${tj.upper} · 중괘 ${tj.middle} · 하괘 ${tj.lower})

상괘 ${upperGwae.num} ${upperGwae.name}(${upperGwae.hanja}) ${upperGwae.symbol}
  · 상징: ${upperGwae.meaning}
  · 오행: ${upperGwae.element}
  · ${formula.upper}

중괘 ${middleGwae.num} ${middleGwae.position}
  · 의미: ${middleGwae.meaning}
  · ${formula.middle}

하괘 ${lowerGwae.num} ${lowerGwae.name}
  · 의미: ${lowerGwae.meaning}
  · ${formula.lower}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[확정된 길흉 — 반드시 아래 등급·키워드·총평의 범위 안에서 풀이]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▣ 괘 등급: ${entry.grade}
▣ 한줄 표제: ${entry.headline}
▣ 핵심 키워드: ${entry.keywords.join(', ')}
▣ 고정 총평(한 해의 틀):
${entry.summary}
${hanjaSaBlock ? `\n${hanjaSaBlock}` : ''}
▣ 12개월 기운 흐름 (월별 키워드 — 이 틀 안에서 확장)
${monthlyList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 규칙]
1) 위에 확정된 등급(${entry.grade})과 총평의 방향성을 반드시 유지. 길흉을 임의로 바꾸지 말 것.
2) 월별 운은 위 12개 월별 키워드를 기반으로만 확장할 것. 해당 월의 톤을 뒤집지 말 것.
3) 제공된 상괘·중괘·하괘 의미에서 벗어난 상징을 새로 만들지 말 것.
4) 전통 토정 어법의 시(詩)적 개운 문구 1~2줄은 허용하나, 실제 길흉 판단은 위 등급을 벗어나지 말 것.
5) 원문 괘사(표제·한문 구절)의 상징과 뜻을 풀이 서두에 자연스럽게 녹여낼 것.
6) 생년 띠(${birthZhi})와 올해 세운(${yearGanZhi}) 지지 관계(${zhiRelation})를 총운·분야별 운세에 반드시 1회 이상 언급할 것.
7) 올해 세운 오행(천간 ${seunGanElement}·지지 ${seunZhiElement})이 개인 운세에 미치는 영향을 구체적으로 서술할 것.

${METAPHOR_SHORT_GUIDE}

반드시 전통 토정비결 어법(예: "용이 여의주를 얻은 격", "나무에 꽃이 피는 상")으로 시(詩)적인 개운 문구 1~2줄을 먼저 제시한 뒤, 현대인도 이해하기 쉽게 풀어 설명하세요.
8) 모든 섹션의 첫 줄에 반드시 은유적 소제목 한 문장을 작성하세요. 이 소제목은 해당 영역의 핵심을 비유로 요약하는 짧은 문장입니다. 소제목 다음 줄부터 본문을 시작하세요.
Markdown # 헤더는 절대 사용하지 마세요.`;
}

/**
 * 토정비결 Pass 1 프롬프트 — 점수 + 총운 + 괘의미 + 월별운세
 * maxTokens: 6000
 */
export function generateTojeongPass1Prompt(tj: TojeongResult): string {
  const entry = getGwaeEntry(tj.upper, tj.middle, tj.lower);
  const { upperGwae, middleGwae, lowerGwae, targetYear } = tj;
  const base = buildTojeongBaseBlock(tj);

  return `${base}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[출력 지시 — 1차 응답: 점수 + 총운 + 괘의미 + 월별운세]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

응답의 가장 첫 줄에 아래 형식을 정확히 지켜 한 줄로 출력하세요:
[tojeong_scores] 재물:점수 | 애정:점수 | 건강:점수 | 직장:점수 [/tojeong_scores]
점수는 각 60~97 정수 (★ 어떤 흉운에도 60 미만 금지 — 다른 운세 카테고리와 일관). 괘 등급(${entry.grade})과 핵심 키워드를 근거로 영역별 차등을 두세요:
- 대길이면 80~95, 중길이면 75~88, 평이면 68~80, 중흉이면 63~73, 대흉이면 60~68 범위.
- 4개 영역 중 최고/최저 차이 8 이상 (비슷한 점수 나열 금지).

그 다음 줄부터 아래 3개 섹션을 [key] 태그로 구분하여 작성:

[chongun]
올해의 총운 (300~400자)
- 첫 줄: 은유적 소제목 한 문장 (예: "봄바람 속에 씨앗을 뿌리는 한 해")
- 상중하괘 조합의 상징을 엮어 한 해의 큰 흐름 (등급: ${entry.grade})
- 핵심 메시지와 경계할 점, 이 한 해의 결이 어떤 감각인지
- 괘사의 상징을 서두에 자연스럽게 녹일 것

[gwae]
괘의 의미 (250~320자)
- 첫 줄: 은유적 소제목 한 문장 (예: "세 기운이 빚어낸 올해의 그릇")
- 왜 이 괘가 나왔는지 상징 해석
- 상괘(${upperGwae.name})·중괘(${middleGwae.position})·하괘(${lowerGwae.name})의 조화와 긴장
- 세 괘의 오행·상징이 어떻게 맞물려 올해 운세의 뼈대를 이루는지

[monthly]
월별 운세 — ${targetYear}년 1월~12월 (각 월 4~5문장, 120~160자)
- 각 월의 키워드(위 월별 키워드 고정)를 근거로 풀이
- 그 달에 해야 할 일 1가지 + 조심할 일 1가지를 반드시 포함
- 포맷: "N월 — [월별 키워드]" 이어서 본문 (예: "1월 — 준비")
- 정월부터 12월까지 빠짐없이 12개 소섹션으로 작성

[chongun], [gwae], [monthly] 태그를 반드시 각 섹션 시작에 한 줄로 적어주세요. 이 3개 섹션만 작성하고, 재물·애정·건강·직장·개운은 다음 호출에서 작성합니다.`;
}

/**
 * 토정비결 Pass 2 프롬프트 — 재물 + 애정 + 건강 + 직장 + 개운
 * maxTokens: 4500
 */
export function generateTojeongPass2Prompt(tj: TojeongResult, pass1Content: string): string {
  const entry = getGwaeEntry(tj.upper, tj.middle, tj.lower);
  const { targetYear } = tj;
  const base = buildTojeongBaseBlock(tj);

  return `${base}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[출력 지시 — 2차 응답: 재물 + 애정 + 건강 + 직장 + 개운]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

아래 5개 섹션을 [key] 태그로 구분하여 작성하세요. 1차에서 이미 작성된 총운·괘의미·월별운세의 톤과 어조를 이어가세요.

[wealth]
재물운 (250~320자)
- 첫 줄: 은유적 소제목 한 문장 (예: "씨앗을 심되, 큰 나무는 내년을 기약하라")
- 들어오는 시기·새는 시기를 분기로 구분 (상반기/하반기 또는 봄·여름·가을·겨울)
- 본업 수입 vs 부수입의 흐름
- 재테크 방향 1개 (저축 강화·분산투자·신중 보류 등)
- 큰 지출 시 주의해야 할 달 1개 명시
- 괘 등급(${entry.grade}) 기준으로 재물의 전반적 흐름 판단

[love]
애정·가정운 (250~320자)
- 첫 줄: 은유적 소제목 한 문장 (예: "잔잔한 호수에 돌 하나가 파문을 만들다")
- 미혼: 인연 들어오는 흐름과 이상형 단서
- 기혼: 부부·자녀·부모 중 올해 테마와 주의 장면
- 관계 회복·갈등 분기점 시기 1개
- 가정 안에서 권할 행동 1가지
- 올해 인연 전반의 기운과 소통 포인트

[health]
건강운 (220~280자)
- 첫 줄: 은유적 소제목 한 문장 (예: "뿌리가 마르면 잎이 먼저 시든다")
- 취약 장부 또는 신체 부위 (오장육부·오행 기준)
- 유의할 계절·환절기와 그 이유
- 권장 운동·식습관 1가지
- 정신 건강·스트레스 관리 한마디
- 예방적 건강 관리 행동 1가지

[career]
직장·학업운 (250~320자)
- 첫 줄: 은유적 소제목 한 문장 (예: "조용히 칼을 가는 자가 기회를 잡는다")
- 직장: 승진·이직·평가·인간관계 중 유리한 흐름 1개와 시기
- 학업·시험: 합격운·집중력·자격증 운
- 조심할 덫 1개 (구설·실수·과로 등)
- 협력자 또는 조력자가 누구인지 (선배·후배·이성·동료 등)
- 올해 커리어 전략의 핵심 방향

[advice]
개운 조언 (400~550자) — 아래 항목을 모두 포함하여 풍부하게 작성
- 첫 줄: 은유적 소제목 한 문장 (예: "작은 물줄기를 따라가면 큰 강을 만난다")
- 올해의 길한 방위 1개 (동서남북 또는 세부 방위) + 왜 그 방위인지 한 줄 근거
- 올해의 길한 색 2~3개 + 일상에서 활용법 (옷·소품·인테리어 등)
- 행운 숫자 2개 + 행운 요일 1개 + 활용 팁
- 당장 이번 달 실천할 개운 행동 2~3가지 (구체적으로: 산책 장소, 음식, 습관 등)
- 올해 피해야 할 행동·습관 1~2가지
- 대인관계에서 의식할 점 1가지 (조력자 유형 또는 갈등 회피법)
- 하반기로 갈수록 유의할 흐름 전환 포인트 1가지
- ${targetYear}년 전체를 관통하는 마음가짐·자세 한마디

[wealth], [love], [health], [career], [advice] 태그를 반드시 각 섹션 시작에 한 줄로 적어주세요. 총운·괘의미·월별운세는 이미 완료 — 출력하지 마세요.

[이미 작성된 1차 내용 — 참고만, 출력하지 말 것]
${pass1Content}`;
}

/**
 * 타로 단독 해석 (질문 타로, 1엽전)
 */
export const generateTarotPrompt = (
  card: TarotCardInfo,
  question?: string
): string => {
  const direction = card.isReversed ? '역방향' : '정방향';

  return `[뽑은 카드]
${card.nameKr} (${card.name}) — ${direction}
속성 오행: ${card.element}
키워드: ${card.keywords.join(', ')}
카드 본의: ${card.meaning}

${question ? `[질문]\n${question}\n` : '[질문]\n(자유 질문 — 카드 자체의 메시지로 풀이)\n'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 규칙]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1) 총 750~950자. 아래 5개 섹션 헤더 그대로 유지.
2) ${direction}의 의미를 반드시 중심에 둘 것. 정방향 의미를 역방향에 섞지 말 것.
3) 카드 본의에서 벗어난 상징을 창작하지 말 것. 키워드 바깥 개념은 최소화.
4) "~일 수 있어요"는 2회 이하. 가능하면 단정적으로.
5) 이모지 금지. 현대인이 쓰는 자연스런 한국어 어투(~해요/~이에요).
6) **일상 생활에서 바로 써먹을 수 있는** 구체 장면·대사·시간대·행동으로 예시. 추상어 금지.
   좋은 예: "퇴근 후 30분 산책하며 한 주 복기", "회의에서 반론 꺼내기 전 3초 침묵 두기"
   나쁜 예: "자신을 돌보세요", "긍정적 태도를 가지세요"

### 카드의 현재 메시지 (140~180자)
- ${card.nameKr}(${direction})가 이 순간 보내는 핵심 신호 한 문장 + 그 의미 풀이 2~3문장
- 질문자가 지금 어떤 심리적·상황적 국면에 있는지를 카드로부터 추정하여 한 문장

### 질문에 대한 해석 (180~230자)
- ${question ? '주어진 질문에 카드가 어떻게 답하는지' : '사용자가 마음에 품은 주제에 카드가 어떻게 답하는지'} 구체적으로
- 카드 키워드(${card.keywords.slice(0, 3).join('·')})와 질문을 엮어 분석
- "예/아니오"로 환원 가능한 질문이면 반드시 방향성(Yes/No/조건부)을 명시하고 근거 한 줄

### 일상 속 적용 장면 (180~230자)
- 오늘~이번 주 안에 마주칠 법한 **구체 상황 3개**를 골라, 각 상황에서 이 카드 에너지로 어떻게 반응할지 한 줄씩
- 상황 예시 풀(골라서 변주): "회의/발표/보고", "갈등 대화/사과/거절", "집안일/정리/운동", "새 프로젝트 착수/마감", "친구 약속/가족 연락", "돈 쓸까 말까 순간", "SNS 올리기 전 순간"

### 행동 조언 (150~190자)
- 이번 주 안에 실행 가능한 구체 행동 2가지 — 반드시 **언제·어디서·무엇을** 세트로
- ${direction === '역방향' ? '역방향은 "멈춤·점검·내면 돌아보기" 방향으로' : '정방향은 "나아감·실행·확장" 방향으로'} 프레이밍

### 주의점 (100~130자)
- 카드 의미에 내포된 함정 1개 — 과몰입·성급·회피 중 무엇인지 명시
- 함정에 빠지기 쉬운 **구체 장면 1개**를 예시로 짧게`;
};

/**
 * 오늘의 타로 (달 1엽전)
 * - 하루 1장 고정 (날짜 시드 기반, 같은 날 같은 카드 반환)
 * - 하루를 움직이는 실용형 리포트
 */
export const generateTodayTarotPrompt = (
  card: TarotCardInfo,
  dateStr: string
): string => {
  const direction = card.isReversed ? '역방향' : '정방향';

  return `[오늘 뽑힌 카드]
날짜: ${dateStr}
${card.nameKr} (${card.name}) — ${direction}
속성 오행: ${card.element}
키워드: ${card.keywords.join(', ')}
카드 본의: ${card.meaning}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 규칙 — 반드시 준수]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1) 총 1000~1300자. 아래 6개 섹션 헤더·순서 그대로.
2) **오늘 하루**에만 적용되는 조언. "앞으로" "장기적으로" 같은 시야 확장 금지.
3) 카드의 ${direction} 의미에 충실. 반대 방향 뉘앙스를 섞지 말 것.
4) "운이 좋다/나쁘다" 이분법 금지. "어떤 장면에서 어떻게 유리/불리한지"로 쪼갤 것.
5) 섹션 3·4·6은 반드시 불릿 리스트. 나머지는 서술형.
6) 이모지 금지. 신비주의적 수사 최소화. 현대인 어투(~해요/~이에요).
7) **모든 조언은 구체적 생활 장면·시간대·대사·행동과 묶을 것.**
   - 좋은 예: "오전 10~11시 집중 업무 블록에 이 카드 에너지가 가장 쓰인다", "점심 후 동료와의 가벼운 대화에서 먼저 근황을 물어볼 것"
   - 나쁜 예: "집중하세요", "사람들과 잘 지내세요"
8) 추상적 "마음가짐" 충고 금지. "몇 시에 / 어디서 / 누구와 / 무엇을"이 드러나야 함.

### 오늘의 카드 한 줄 (60~90자)
- ${card.nameKr}(${direction})가 이 날에 가져온 기운을 한 문장으로 요약 + 한 문장 풀이

### 오늘 잘 풀리는 영역 (200~260자)
- 카드 키워드(${card.keywords.slice(0, 3).join('·')})와 오늘의 흐름을 엮어 **구체 장면 3개** 제시 — 각 장면에 "언제·무엇을·왜"가 들어가야 함
- 활용 가능한 장면 풀(여기서 골라 변주): "오전 업무 블록(9~11시) 집중", "회의에서 반론 꺼내기", "점심 시간 산책/대화", "오후 나른한 구간의 정리 작업", "퇴근 후 30분 개인 시간 활용", "저녁 약속/가족 대화", "미뤄둔 연락 한 건"

### 오늘 주의할 함정 (150~200자) — 불릿 4개
- 카드에 담긴 그림자(${direction === '역방향' ? '역방향의 경고' : '정방향의 과잉'})를 근거로
- "~하지 말 것" 형식으로 구체 행동 4개 — 각 1~2줄. 반드시 **어떤 순간에 그 행동이 튀어나오는지**를 함께 적을 것 (예: "피곤이 몰려오는 3시 30분경, 충동구매 앱 열지 말 것")

### 관계·소통 포인트 (180~240자)
- 오늘 이 카드 에너지와 맞는 **대화 톤과 말문 예시** — 한 문장 정도 실제 사용 가능한 워딩 포함
- 연락하면 좋은 사람 유형 1 + 거리를 둘 상황 1 (상황은 구체적으로: "상사가 즉답을 요구하는 순간" 식)
- 오늘 오고갈 메시지·SNS에서 조심할 표현 1개

### 오늘의 시간대 포인트 (140~180자) — 불릿 4개
- "오전(9~12시)": 이 시간대에 이 카드 기운이 어떻게 작용하는지 한 줄 + 권장 행동 1
- "점심·오후 초(12~15시)": 같은 포맷
- "오후·저녁(15~19시)": 같은 포맷
- "밤(19시 이후)": 같은 포맷

### 하루를 빛낼 작은 의식 (170~220자) — 불릿 4개
- 행운의 색 1개 (어디에 활용할지까지 — 옷/소품/배경화면 등)
- 유리한 시간대 1구간 (해당 시간에 뭘 할지)
- 오행 ${card.element}의 기운을 살리는 구체 음식·음료 1개
- 잠들기 전 1분짜리 마무리 행동 1개`;
};

/**
 * 이달의 타로 (해 2엽전)
 * - 3장 스프레드: 상순(1~10일) / 중순(11~20일) / 하순(21~말일)
 * - 월단위 전략형 리포트
 */
export const generateMonthlyTarotPrompt = (
  cards: {
    early: TarotCardInfo;   // 상순
    middle: TarotCardInfo;  // 중순
    late: TarotCardInfo;    // 하순
  },
  monthStr: string
): string => {
  const fmt = (c: TarotCardInfo, label: string) => {
    const dir = c.isReversed ? '역방향' : '정방향';
    return `- ${label}: ${c.nameKr}(${c.name}) · ${dir} · 오행 ${c.element} · 키워드 ${c.keywords.slice(0, 3).join('·')} · 본의 "${c.meaning}"`;
  };

  return `[이달 뽑힌 3장 스프레드]
대상 월: ${monthStr}
${fmt(cards.early, '상순(1~10일)')}
${fmt(cards.middle, '중순(11~20일)')}
${fmt(cards.late, '하순(21~말일)')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 규칙 — 반드시 준수]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1) 총 1800~2200자. 아래 7개 섹션 헤더·순서 그대로.
2) 세 장의 **순차적 흐름**을 반드시 이야기로 엮을 것 — "상순이 이래서 중순이 이렇게, 그래서 하순이 이렇게 마무리된다".
3) 세 카드의 **방향(정/역)** 조합 의미를 한 번은 명시적으로 짚을 것.
4) 각 카드의 본의/키워드에서 벗어난 상징을 창작하지 말 것.
5) 이달 안에 실행 가능한 행동만. "향후 몇 년" 같은 장기 관점 금지.
6) 이모지 금지. 서술형 본문 + 섹션 5·7만 불릿 허용.
7) **모든 조언은 일상 속 구체 장면으로 내려앉을 것.** "이번 주 수요일 저녁 운동 루틴 점검", "월말 카드값 들어오기 전 쇼핑 앱 삭제" 같은 눈높이.
   추상어("성장", "균형", "긍정적")만으로 문장을 끝내지 말 것 — 반드시 구체 행동과 짝지을 것.
8) 각 순(상·중·하) 섹션에는 반드시 **그 10일 동안 마주칠 장면 2개 + 실행 행동 2개**를 넣을 것.

### 이달의 전체 테마 (220~280자)
- 3장의 조합이 그리는 큰 그림 한 문장 + 해석 2~3문장
- 정/역 방향 비율(3장 중 정방향 N장·역방향 M장)이 만드는 전체 톤 한 문장
- 이달 안에 반복될 "한 문장 질문"(나 자신에게 계속 묻게 될 질문) 1개를 제시

### 상순(1~10일) — ${cards.early.nameKr}(${cards.early.isReversed ? '역' : '정'}방향) (240~310자)
- 이 시기의 에너지와 첫 열흘 동안 해야 할 핵심 과제 1개 (근거 포함)
- 구체 장면 2개 (예: "첫 주 월요일 아침 회의에서 방향 잡기", "주말 이전 마감 1개 끝내기")
- 실행 행동 2개 — 언제·무엇을·왜를 붙여서

### 중순(11~20일) — ${cards.middle.nameKr}(${cards.middle.isReversed ? '역' : '정'}방향) (240~310자)
- 상순의 흐름이 이달 중간에 어떻게 변주되는지
- 전환 국면이 필요한지 유지 국면인지 판단 + 구체 장면 2개
- 실행 행동 2개 (상순과 겹치지 않는 방향성으로)

### 하순(21~말일) — ${cards.late.nameKr}(${cards.late.isReversed ? '역' : '정'}방향) (240~310자)
- 이달을 어떻게 닫을 것인가 — 수확·정리·준비 중 무엇인지
- 구체 장면 2개 + 다음 달로 넘기기 전 해둘 일 2개
- 월말 회고할 때 스스로에게 체크할 질문 1개

### 이달의 주력 과제 (180~230자) — 불릿 3개
- 세 카드의 합의에서 도출된 "이달 안에 반드시 해낼 것" 3가지
- 각 항목: 목표 + 왜 필요한지 + 구체 체크 기준 한 줄 (예: "월말까지 이력서 1장 마감 → 금요일 저녁 30분씩 3회")

### 피해야 할 함정 (180~230자)
- 역방향이 있다면 그 카드가 경고하는 지점 중심으로 구체 장면 2개
- 정방향만이라면 과잉이 될 수 있는 지점 2개 — 언제 그 과잉이 터지는지 함께
- 각 함정에 "이럴 때 잠시 멈춰야 할 신호" 1개 포함

### 이달의 실천 의식 (200~260자) — 불릿 5개
- 행운 색 1개 (활용처: 옷/포인트/노트 등)
- 이달의 숫자 1개 + 어디에 사용할지 (저축 목표/반복 루틴 횟수 등)
- 힘을 보태는 요일 1개 + 그 요일에 할 한 가지
- 피해야 할 요일 1개 + 그 요일에 금지할 한 가지
- 세 카드의 오행(${cards.early.element}·${cards.middle.element}·${cards.late.element})을 고려하여 부족한 기운을 채우는 한 달 짜리 "반복 루틴" 1개 (예: "매일 아침 7시 5분 스트레칭", "주 2회 수요일/일요일 저녁 책 30분")`;
};

/**
 * 사주 × 타로 하이브리드 (3엽전)
 */
export const generateHybridPrompt = (
  sajuResult: SajuResult,
  tarotCard: TarotCardInfo,
  question?: string
): string => {
  const { pillars, elementPercent, yongSinElement, yongSin, isStrong } = sajuResult;
  const direction = tarotCard.isReversed ? '역방향' : '정방향';
  // Air→木, Water→水, Fire→火, Earth→土, Spirit→金
  const tarotSajuElement: Record<string, string> = {
    Fire: '화', Water: '수', Air: '목', Earth: '토', Spirit: '금'
  };
  const cardElementInSaju = tarotSajuElement[tarotCard.element];

  return `[내 사주]
일주: ${pillars.day.gan}${pillars.day.zhi} (${pillars.day.ganElement}일간) · ${isStrong ? '신강' : '신약'}
오행 분포: 목${elementPercent.목}% 화${elementPercent.화}% 토${elementPercent.토}% 금${elementPercent.금}% 수${elementPercent.수}%
용신: ${yongSinElement}(${yongSin})

[뽑은 타로]
${tarotCard.nameKr}(${tarotCard.name}) — ${direction}
타로 오행: ${tarotCard.element} → 사주 오행 ${cardElementInSaju}
키워드: ${tarotCard.keywords.join(', ')}

${question ? `[질문]\n${question}\n` : '[질문]\n(자유 질문)\n'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 규칙]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1) 총 1200~1600자. 아래 6개 섹션 헤더 그대로.
2) 타로 오행(${cardElementInSaju})과 내 용신(${yongSinElement})의 관계를 반드시 한 번 명시.
   - 같은 오행 → 기운 강화 / 상생 → 보완 / 상극 → 경고 중 어디인지.
3) 사주 확정 사실(격국·용신·신강약)과 모순되지 않게.
4) 이모지 금지. 신비주의 수사 최소화.

### 1. 사주와 타로의 교차점 (200~260자)
- 타로 ${cardElementInSaju}와 내 용신 ${yongSinElement}의 관계 해석
- 사주 오행 분포가 이 카드의 기운을 받아들이기에 부족한지/넘치는지

### 2. 카드가 전하는 오늘의 상황 (200~260자)
- ${tarotCard.nameKr}(${direction})가 사용자 인생의 어느 지점을 비추고 있는지
- 사주 구조 위에서 이 카드가 강조하는 주제

### 3. 질문에 대한 통합 답 (220~280자)
- 사주 근거 + 타로 메시지를 엮어 답
- 지금 움직이기 좋은지 / 멈출 때인지 판단

### 4. 행동 처방 (180~230자) — 불릿 3개
- 이번 주 실행 1개
- 이달 안 실행 1개
- 올해 안 실행 1개

### 5. 오행 보완 (160~210자)
- 용신 ${yongSinElement}을 기르는 생활 속 보완책 2개
- 타로 오행 ${cardElementInSaju}이 과잉될 경우 눌러줄 보완책 1개

### 6. 마무리 메시지 (120~160자)
- 한 줄 핵심 + 독자를 북돋우는 단정적 문장으로 마무리`;
};

/**
 * 애정운 특화 분석 (2엽전) — 타이트 + 상세
 */
export const generateLoveFortunePrompt = (result: SajuResult): string => {
  const { pillars, gender, elementPercent, yongSinElement, yongSin, isStrong, daeWoon } = result;
  const sipseong = formatSipseongCounts(computeSipseongCounts(result));
  const nextDaewoon = daeWoon.slice(0, 5).map(d => `${d.startAge}년 ${d.gan}${d.zhi}(${d.tenGod})`).join(', ');

  return `[내 사주 — 애정 분석용 추출]
일주: ${pillars.day.gan}${pillars.day.zhi} (${pillars.day.ganElement}일간)
성별: ${gender === 'male' ? '남성' : '여성'}  · ${isStrong ? '신강' : '신약'} · 용신: ${yongSinElement}(${yongSin})
오행 분포: 목${elementPercent.목}% 화${elementPercent.화}% 토${elementPercent.토}% 금${elementPercent.금}% 수${elementPercent.수}%
십성 분포: ${sipseong}
배우자궁(일지): ${pillars.day.zhi} (${pillars.day.zhiElement})
향후 대운 5개: ${nextDaewoon}

[관계성 규칙]
- 남자: 재성(편재·정재)=여자·배우자, 관성=사회·자식
- 여자: 관성(편관·정관)=남자·배우자, 식상=자식·표현
- 일지(배우자궁)의 합·충 여부가 결혼운의 기반

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 규칙]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1) 총 1400~1800자. 아래 7개 섹션 헤더 그대로.
2) 성별에 맞는 관계성 규칙을 반드시 적용.
3) 막연한 "좋은 사람 만날 것"류 금지. 어떤 유형·왜·언제·어떻게를 구체화.
4) 이모지 금지. 불릿은 섹션 5·7에만.

### 1. 타고난 연애 성향 (220~280자)
- 일간·배우자궁·십성 배치로 본 핵심 기질
- 연애 시 드러나는 매력 2개와 약점 2개

### 2. 이상형·잘 맞는 타입 (200~260자)
- 상대 사주 유형 2개(어떤 일간·오행·성향인지 구체적으로)
- 심리적으로 끌리는 모습 + 장기 안정에 필요한 모습 구분

### 3. 조심할 타입·관계 패턴 (180~230자)
- 배우자궁의 충/형을 근거로 반복될 수 있는 갈등 패턴 1~2개
- "첫눈에 반하지만 빠르게 식는" 같은 관계 신호

### 4. 결혼 시기·유리한 구간 (200~260자)
- 향후 대운 목록에서 혼인에 유리한 대운 1~2개 집어 나이 구간 명시
- 세운에서 결혼 촉진 지지(배우자궁과 합·삼합) 관점 간단 설명

### 5. 연애 단계별 전략 (180~230자) — 불릿 3개
- 초반(썸~연애 초): 1줄
- 중반(연애 안정기): 1줄
- 장기(결혼·동거 준비): 1줄

### 6. 감정 성장 포인트 (180~230자)
- 나 자신이 관계에서 키워야 할 내면의 힘 1개
- 상대에게 표현해야 할 사랑 언어(${gender === 'male' ? '남성' : '여성'} 관점) 1개

### 7. 애정 개운 처방 (140~190자) — 불릿 4개
- 용신 오행(${yongSinElement})을 살리는 데이트 색/장소 2개
- 행운 요일·시간대 1
- 관계를 막는 사주 함정을 피할 행동 1
- 이달 안에 해볼 애정 의식 1`;
};

/**
 * 재물운 특화 분석 (2엽전) — 타이트 + 상세
 */
export const generateWealthFortunePrompt = (result: SajuResult): string => {
  const { pillars, elementPercent, yongSinElement, yongSin, isStrong, daeWoon } = result;
  const sipseong = formatSipseongCounts(computeSipseongCounts(result));
  const upcomingDaewoon = daeWoon.slice(0, 5).map(d => `${d.startAge}년 ${d.gan}${d.zhi}(${d.tenGod})`).join(', ');

  return `[내 사주 — 재물 분석용 추출]
일주: ${pillars.day.gan}${pillars.day.zhi} (${pillars.day.ganElement}일간) · ${isStrong ? '신강' : '신약'}
오행 분포: 목${elementPercent.목}% 화${elementPercent.화}% 토${elementPercent.토}% 금${elementPercent.금}% 수${elementPercent.수}%
용신: ${yongSinElement}(${yongSin})
십성 분포: ${sipseong}
향후 대운: ${upcomingDaewoon}

[재물 규칙 요약]
- 편재(偏財)=사업·투자·유동재, 정재(正財)=월급·안정재
- 식상(식신·상관)=돈 버는 도구(재능·기술)
- 재성이 너무 많으면 신약일 때 재다신약(재물 무게에 눌림)
- 신강일 땐 재성이 힘 있어야 재복 구현

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 규칙]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1) 총 1400~1800자. 아래 7개 섹션 헤더 그대로.
2) 재성·식상·비겁 구조로 근거를 매번 짚을 것.
3) "부자가 됩니다"류 단정 금지 — "어떤 조건에서 어떤 규모로"로 쪼갤 것.
4) 이모지 금지. 불릿은 섹션 5·7에만.

### 1. 타고난 재복 유형 (220~280자)
- 편재형 / 정재형 / 식상생재형 / 재고형 중 이 사주는 어디에 속하는지 판정 + 근거
- 신강·신약 맥락에서 재성이 얼마나 힘을 쓸 수 있는지

### 2. 돈 버는 스타일 (220~280자)
- 월급형 / 사업형 / 투자형 / 전문기술형 중 유리·불리 순위
- 내가 돈을 끌어오는 방식 2가지 + 누수 패턴 1가지

### 3. 재물 대운의 흐름 (200~260자)
- 위 대운 목록에서 재운 상승 구간·침체 구간을 나이로 명시
- 앞으로 10~20년 내 핵심 재테크 결정 시점

### 4. 올해·내년 재물 포커스 (180~230자)
- 최근 세운의 오행이 재성과 어떻게 반응하는지
- 집중할 것 1개 / 지연할 것 1개 / 손대지 말 것 1개

### 5. 재테크 전략 (180~230자) — 불릿 3개
- 적합한 자산군 2개(부동산·주식·채권·사업 등 중)
- 피해야 할 자산군 1개 — 이유 포함

### 6. 돈 함정·리스크 (160~210자)
- 사주에 내재된 재물 리스크 1~2개(재다신약 / 비겁탈재 / 상관견관 등 해당 시)
- 평생 반복되는 재정 실수 1개 + 교정 방향

### 7. 재물 개운 처방 (140~190자) — 불릿 4개
- 용신(${yongSinElement}) 기운의 돈 관련 색 1
- 행운 방향 1 · 금고·지갑 보관법 1
- 이번 달 실천 가능한 저축·투자 습관 1`;
};

// ══════════════════════════════════════════════════════
// 택일 운세 AI 추천 프롬프트
// ══════════════════════════════════════════════════════

/**
 * 택일 AI 추천 프롬프트
 * - 엔진이 계산한 길흉 날 목록 → AI가 명리 이유를 담아 추천 내러티브 생성
 * - 일반: 350~450자 / 출산 택일: 500~650자 (산모·태아 안전 강조)
 * - 후보 비교 모드: days.length <= 7 이면 사용자가 직접 고른 후보 셋으로 간주, Top 3 비교 풀이로 분기
 *   (직원 피드백: 다중 날짜 입력 → 점수 기반 Top 3 + 명리 근거)
 */
// 카테고리별 명리 지식베이스 — 택일 전용 (6 묶음 + 기타)
// 각 묶음은 명리적 에너지 결이 비슷한 상황을 함께 다룸. 사용자에게 보여주는 라벨과
// 묶음 안에서 다뤄야 할 구체 행사 모두 명시 — AI 가 본문에서 사용자의 실제 상황을 짚을 때 활용.
const TAEKIL_KNOWLEDGE: Record<string, string> = {
  settle: `[터를 잡다 — 이사·입주·창업·개업·신축 택일 명리 지식]
이 묶음은 "공간·기반을 새로 정하는 행사" — 이사, 입주, 새 집, 가게 오픈, 사업 시작, 사무실 이전, 신축, 인테리어 마무리 등.
정인(印星) = 집·터전·뿌리·문서 에너지. 부동산·계약 서류와도 직결. 가장 핵심 길성.
편재 = 유동 자금·사업 수완. 개업·창업·인테리어 비용 모두 활성화.
정재 = 안정적 수입·꾸준한 매출. 입주 후 살림·매출 안정.
식신 = 생활 풍요·생산성. 새 공간에서의 일상이 풍족.
상관 = 혁신·차별화 에너지(창업엔 가능). 단 규제·관청과 충돌 주의.
겁재 = 재성 극탈. 비용 폭증·경쟁자 출현. 강한 감점.
편관 = 인허가 지연·외부 압박·이웃 갈등. 강한 감점.
천덕귀인 = 터전의 재앙 소멸, 새 시작의 안정.
12운성 건록·관대·제왕 = 기반이 튼튼해지는 날.
삼합 수국(신자진) = 재물 흐름 원활.
육충(특히 일지 충) = 뿌리가 흔들림, 정착 어려움.
공망일 = 시작이 허함, 오픈해도 사람이 안 옴.`,

  bond: `[마음을 묶다 — 혼례·약혼·상견례·고백·재회 택일 명리 지식]
이 묶음은 "두 사람의 결합·합의를 공식화하는 행사" — 결혼식, 약혼, 상견례, 프러포즈, 고백, 재회, 다시 만나기로 약속하는 날.
정재(남자 기준)/정관(여자 기준) = 배우자·공식 인연 에너지 왕성. 핵심 길성.
식신 = 가정 풍요·자녀복. 혼례 후 안정적 가정.
편재 = 매력·외향 인연. 고백·재회처럼 마음을 끌어내는 행사에 유리.
천덕·월덕귀인 = 재앙 소멸, 결합에 대길.
육합(원국 지지 + 일진 지지) = 두 사람 화합·조화.
삼합 완성 = 주변 축복 결집, 하객·가족 운.
도화살(자오묘유) = 매력 상승. 단 기혼·재회엔 외도 에너지 동반 주의.
상관 = 정관 극함. 배우자·가족 갈등 에너지. 혼례에 강한 감점.
겁재 = 재성 극탈. 신혼 재정 불안.
편관 = 압박·갈등. 상견례·집안 어른 만남에 부담.
공망일 = 빈 혼사, 약속이 허해짐. 강하게 기피.
육충 = 결합이 깨짐. 중대한 약속에 부적합.`,

  decision: `[획을 긋다 — 큰 계약·매매·차량·이별·퇴사·관계 정리 택일 명리 지식]
이 묶음은 "큰 결정·결단을 공식화하는 날" — 부동산 매매, 큰 계약, 차량 구매, 이별·이혼·퇴사 통보, 관계 정리, 단호한 마무리.
정재 = 안정적 거래·확실한 수익. 계약 최적.
정관 = 법적 보호·서류 효력. 공정한 거래·정당한 절차.
정인 = 문서운 양호·서류 하자 없음. 결단의 명분이 명확해짐.
식신 = 결단 후 마음의 평온·후련함.
편관 = 불리한 조건·숨은 함정·뒷탈. 강한 감점.
겁재 = 상대방에게 빼앗김·불리한 협상.
상관 = 계약 파기·분쟁·뒷말 에너지.
육합 = 거래 상대와 원만한 합의(계약). 단 정리·이별엔 미련 남기기 쉬움.
육충 = 의견 충돌·협상 결렬. 단 정리·이별에는 오히려 단절 에너지로 작용 가능.
공망일 = 결정이 공허·이행되지 않음. 계약 강하게 기피.
12운성 절 = 끊음·종결 — 정리·이별엔 오히려 의미 있는 날일 수 있음.
정리 행사(이별·퇴사)는 일반 길흉 기준에 더해 "단호함·뒷탈 없음·번복 금지" 관점으로도 해석.`,

  journey: `[길을 나서다 — 여행·해외 출장·이주·유학·면접·시험 택일 명리 지식]
이 묶음은 "공간·환경을 일시·장기적으로 옮기는 행사" — 여행, 해외 출장, 이주, 유학 출국, 면접, 시험, 발표·PT, 큰 자리 입장.
식신 = 먹을복·유흥·즐거움. 여행에 최적.
정인 = 학습·문화·안전한 이동. 유학·시험에 핵심.
정관 = 공식 절차·규율. 면접·시험·공식 발표에 강한 길성.
편재 = 현지 활동·소비·기회. 여행지·출장지에서의 활약.
역마살(인신사해) = 이동 에너지 폭발. 출행 자체 순조.
편관 = 사고·도난·지연·압박. 출행에 강한 감점. 면접 불합격 시그널도.
겁재 = 동행자 갈등·금전 분쟁.
상관 = 자유분방함, 시험·면접 같은 격식 자리엔 감점.
삼합 화국(인오술) = 열정적 여행·강한 추진력.
육충(특히 역마 충) = 교통사고·일정 차질·중도 좌절.
공망일 = 출발은 했으나 결과 허함. 시험·면접 결과 흐려짐.
시험·면접 행사는 일반 길흉에 더해 "정관·정인이 만나는 날", "상관·편관 충돌 없는 날" 관점 추가 강조.`,

  heal: `[몸을 보살피다 — 수술·시술·치유 택일 명리 지식]
이 묶음은 "몸의 회복을 도모하는 행사" — 수술, 시술, 큰 치료 시작, 회복기 진입.
정인 = 보호·회복 에너지. 핵심 길성.
식신 = 체력·면역. 수술 후 경과 좋음.
편인 = 식신 극(도식·倒食). 회복력 저하·부작용 주의. 강한 감점.
편관 = 칼·수술도구 에너지. 단 과도하면 합병증 위험. 강한 감점.
상관 = 의료진·환자 간 소통 문제·과민 반응.
천덕·월덕귀인 = 의료 사고 방지·명의 만남.
12운성 장생·관대 = 회복 빠름.
12운성 사(死)·절(絶) = 생명력 최약. 강하게 기피.
공망일 = 수술 효과 허함·재수술 위험.
면책 권고: 의학적 결정은 담당의와 상의 — 본 분석은 명리적 참고.`,

  birth: `[새 생명을 맞다 — 출산·제왕절개 택일 명리 지식]
식신(食神) = 자녀 에너지 핵심·아이 생명력이 가장 강한 날.
정인 = 어머니의 보호·양육 에너지·순산.
편인(偏印) = 식신을 극함(倒食). 모자 에너지 심각 충돌. 절대 기피.
편관(七殺) = 산모·태아에 과도한 압박. 난산 위험.
12운성 장생 = 새 생명의 시작점·출산 최길.
12운성 제왕·건록 = 생명력 최강·건강한 아이.
12운성 사(死)·절(絶) = 생명 에너지 최약·강력 기피.
삼합 완성 = 가족 전체 기운 결집·가정에 복.
공망일 = 허한 출생·아이 기반 불안정.
면책 문구 필수: "이 분석은 명리학적 참고 자료이며, 최종 출산 날짜는 담당 의사와 상의해 결정해 주세요."`,

  // 기타: 사용자가 입력한 행사 이름을 기반으로 동적 분석 — 강력한 룰베이스로 결을 잡음
  custom: `[기타 — 사용자 직접 입력 행사 택일 명리 지식]
사용자가 입력한 행사 이름(아래 [사용자 입력 행사] 블록)을 분석해 가장 가까운 명리적 결을 적용하세요.

[행사 결 분류 룰베이스]
사용자 입력 텍스트의 핵심 단어(2~5어절)에서 아래 결을 추출해 가중치 적용:
1) 시작·새출발 결 (오픈·런칭·발표·론칭·창립·첫·새 시작·시작·개막·축제·전시·콘서트):
   → 정인·편재·식신·정재 길성. 겁재·편관 감점.
2) 결합·약속 결 (혼례·약혼·고백·재회·맞선·소개팅·만남·결의·약속·서약):
   → 정재(남)/정관(여)·식신·편재 길성. 상관·겁재·편관 감점. 육합 가산.
3) 결단·정리 결 (이별·이혼·퇴사·해지·환불·정리·종결·마무리·작별·청산):
   → 정관·정인 길성. 12운성 절(絶) 가산(끊음). 육합 감점(미련).
4) 거래·계약 결 (계약·매매·구매·청약·투자·입찰·서명·합의):
   → 정재·정관·정인 길성. 편관·겁재·상관 감점. 공망 강하게 감점.
5) 도전·시험 결 (면접·시험·심사·오디션·심판·발표·PT·콘테스트·경연):
   → 정관·정인·정재 길성. 상관·편관·겁재 감점. 역마살·삼합 화국 가산.
6) 이동·여정 결 (여행·출장·이주·이민·유학·출국·등산·트레킹·캠핑):
   → 식신·정인·편재·역마살 길성. 편관·육충 강한 감점.
7) 치유·돌봄 결 (수술·시술·치료·검진·재활·요양·다이어트 시작):
   → 정인·식신·천덕귀인 길성. 편인·편관·상관·12운성 사절 감점.
8) 인연·관계 결 (친목·모임·동창회·동아리 결성·팀빌딩):
   → 식신·정관·정인 길성. 상관·겁재 감점. 삼합 가산.

[적용 절차]
가) 입력 텍스트에서 위 8결 중 가장 강한 1~2개 결 식별. 본문에 "이 행사는 ~결에 가깝습니다"로 결을 명시.
나) 식별한 결의 길성·흉성을 기준으로 엔진이 점수화한 Top 날짜들을 풀이.
다) 사용자 입력 그대로 본문에 인용 ("입력하신 ~행사를 위해서는…"). 함부로 행사명을 바꾸지 말 것.
라) 만약 8결 중 어느 것에도 명확히 속하지 않으면 "범용 행사" 로 처리 — 정관·정인·식신·정재 4 길성, 편관·겁재·상관 3 흉성 기준.

[금지 룰]
- 입력 텍스트에 명시되지 않은 정황(인물·장소·금액·관계 디테일)을 추측해서 풀이에 끼워넣지 말 것.
- 사용자가 부정적 행사(이별·정리)를 입력했다면 "안 하는 게 좋다"는 식의 가치 판단 금지. 행사 자체는 사용자가 결정함, 명리는 그 날의 길흉만 짚음.
- 입력이 짧고 모호해도(예: "그 일") 추측 시나리오 금지. 그 경우 "범용 행사" 로 처리하고 일반 길흉만 풀이.

[안전장치]
- 욕설·혐오·범죄·자해 등 부적절 단어 감지 시: 풀이를 거부하고 "이 입력으로는 풀이를 드리기 어려워요. 행사 이름을 다시 적어주세요."로만 응답.
- 너무 추상적·시적인 입력(예: "오늘") 시: "행사 이름을 좀 더 구체적으로 적어주시면 정확한 풀이가 가능해요"로 안내 + 일반 길흉 짧게.`,
};

export const generateTaekilAdvicePrompt = (
  saju: SajuResult,
  taekil: TaekilResult,
): string => {
  const isBirth = taekil.category === 'birth';
  const isCustom = taekil.category === 'custom';
  const isCompareMode = taekil.days.length >= 2 && taekil.days.length <= 7;
  const topDays = isCompareMode
    ? [...taekil.days].sort((a, b) => b.score - a.score).slice(0, 3)
    : taekil.bestDays.slice(0, 3);
  const worstDays = isCompareMode
    ? [...taekil.days].sort((a, b) => a.score - b.score).slice(0, 1)
    : taekil.days
        .filter(d => d.grade === '흉')
        .sort((a, b) => a.score - b.score)
        .slice(0, 2);

  const formatDay = (d: TaekilDay) => {
    const elEnergy = d.elementEnergy
      ? ` / 오행에너지(목${d.elementEnergy['목']} 화${d.elementEnergy['화']} 토${d.elementEnergy['토']} 금${d.elementEnergy['금']} 수${d.elementEnergy['수']})`
      : '';
    const peakSlots = d.timeSlots
      ? d.timeSlots.filter(t => t.energy >= 7).map(t => `${t.name}(${t.energy})`).join(',')
      : '';
    const peakInfo = peakSlots ? ` / 고에너지시간: ${peakSlots}` : '';
    return `${d.date}(${d.lunarLabel.split(' ')[2] ?? d.lunarLabel}) ${d.dayGan}${d.dayZhi} ${d.grade}(${d.score}점) — ${d.reasons.slice(0, 4).join(', ')}${d.luckyTime ? ` / 길시: ${d.luckyTime}` : ''}${elEnergy}${peakInfo}`;
  };

  const topList = topDays.map((d, i) => `${i + 1}위: ${formatDay(d)}`).join('\n');
  const worstList = worstDays.length > 0 ? worstDays.map(formatDay).join('\n') : '없음';

  const elPct = saju.elementPercent;
  const gyeokguk = determineGyeokguk(saju);
  const topCount = topDays.length;

  const categoryKB = TAEKIL_KNOWLEDGE[taekil.category] || '';

  const birthBlock = isBirth ? `
[출산 택일 명리 분석 인풋]
산모 일주: ${saju.pillars.day.gan}${saju.pillars.day.zhi} / 일간 오행: ${saju.dayMasterElement}
격국: ${gyeokguk.name}(${gyeokguk.traits?.slice(0, 3).join('·') || ''})
신강신약: ${saju.strengthStatus} / 용신: ${saju.yongSinElement}(${saju.yongSin}) / 기신: ${saju.giSin}
식신 강도: ${computeSipseongCounts(saju)['식신']?.toFixed(1) || '0'} (자녀·출산 에너지)
편인 강도: ${computeSipseongCounts(saju)['편인']?.toFixed(1) || '0'} (식신 극하는 기운)
일지 지지: ${saju.pillars.day.zhi} / 오행: ${saju.pillars.day.zhiElement}
` : '';

  // 기타(custom) 입력 시: 사용자 입력 행사명 + 강제 인용 룰 + 안전장치
  const customBlock = isCustom ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[사용자 입력 행사 — 풀이의 핵심 컨텍스트]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
입력된 행사 이름: "${taekil.customLabel ?? '(없음)'}"

★ 이 행사 이름은 본문 모든 [topN] 섹션에서 최소 1회 이상 그대로 인용하세요.
   인용 예: "${taekil.customLabel ?? '입력하신 행사'} 을(를) 위해서는…"
★ 위 [기타 — 사용자 직접 입력 행사 택일 명리 지식] 의 [행사 결 분류 룰베이스] 8결 중
   이 행사가 가장 가까운 1~2개 결을 식별해 본문 첫 [top1] 섹션 1문장으로 명시하세요.
   예: "이 행사는 '거래·계약 결' 에 가장 가깝습니다."
★ 입력 텍스트에 없는 정황(인물·장소·금액·관계)을 추측해 시나리오 만들지 말 것.
★ 안전장치 발동 조건:
   - 입력에 욕설·혐오·범죄·자해 단어가 있으면 → "이 입력으로는 풀이를 드리기 어려워요.
     행사 이름을 다시 적어주세요." 한 줄만 출력하고 종료. [topN] 마커도 출력하지 말 것.
   - 입력이 너무 추상적·모호하면(2글자 이하 / "그것" / "오늘" 류) → 본문 첫 줄에 "입력이
     너무 짧아 일반 길흉만 풀이드려요. 행사 이름을 좀 더 구체적으로 적어주시면 더 정확한
     풀이가 가능해요." 한 문장 추가 후 일반 길흉 풀이.
` : '';

  return `[사주 원국${isBirth ? ' — 산모' : ''}]
일간: ${saju.dayMaster}(${saju.dayMasterElement}) / 일주: ${saju.pillars.day.gan}${saju.pillars.day.zhi}
사주: ${saju.pillars.year.gan}${saju.pillars.year.zhi} ${saju.pillars.month.gan}${saju.pillars.month.zhi} ${saju.pillars.day.gan}${saju.pillars.day.zhi} ${saju.hourUnknown ? '시주미상' : saju.pillars.hour.gan + saju.pillars.hour.zhi}
오행: 목${elPct.목}% 화${elPct.화}% 토${elPct.토}% 금${elPct.금}% 수${elPct.수}%
신강신약: ${saju.strengthStatus} / 용신: ${saju.yongSinElement} / 기신: ${saju.giSin}
격국: ${gyeokguk.name}
${birthBlock}
[택일 정보]
카테고리: ${taekil.categoryLabel}${taekil.subItem ? `\n구체적 행사: ${taekil.subItem}` : ''}
기간: ${taekil.startDate} ~ ${taekil.endDate}

[엔진 계산 — Top ${topCount}]
${topList}

[엔진 계산 — 흉일]
${worstList}

${categoryKB}
${customBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[작성 규칙 — 반드시 준수]
1) Markdown 절대 금지 (**볼드**, ## 헤딩, - 불릿 모두 금지). 이모지 금지.
2) [top1] [top2] [top3] 마커로 각 날짜별 섹션을 구분하여 출력.
3) 각 [topN] 섹션 내부 구조:
   종합: 이 날이 ${taekil.subItem ?? taekil.categoryLabel}에 적합한 이유를 명리학적 근거와 함께 풍부하게 서술합니다.${taekil.subItem ? ` 반드시 '${taekil.subItem}'이라는 구체적 행사에 맞춰 서술하세요.` : ''}
   반드시 포함할 내용:
   가) 일진의 천간·지지 오행 특성과 원국과의 관계 (생극 관계, 합충형 유무)
   나) 핵심 십성이 ${taekil.subItem ?? taekil.categoryLabel}에 미치는 구체적 영향 (위 지식베이스 참고)
   다) 12운성 상태가 행사 에너지에 주는 의미
   라) 이 날 특별히 유리하거나 주의할 구체적 행동 지침 (시간대·방위·색상·행동 등)
   마) 이 날의 약점이나 주의사항도 자연스럽게 문장 안에 포함
   5~7문장(250~350자). 추상적 격언 금지, 일상 행동으로 내려앉히세요.
   키워드: 이 날의 핵심 특성 3개. 쉼표 구분. 4글자 이내의 함축적 표현.
   (예: "정인안정, 천덕길일, 수기조화" / "편재활성, 식신풍요, 삼합결집")
4) 총 ${isBirth ? '1200~1600' : '1100~1500'}자.
5) 추천일은 위 엔진 계산 결과에서만 고를 것. 임의 다른 날 추천 금지.
6) 피해야 할 날이 있으면 [avoid] 마커 뒤에 날짜 + 이유 2~3문장 추가.
7) 용신·기신 언급 시 반드시 "오행(천간) — 십성" 형태로 쓸 것.
   (예: "용신인 화(병화·정화), 즉 편재가…")
8) 같은 표현 반복 금지. 각 날짜마다 다른 관점·어휘로 서술.
${METAPHOR_SHORT_GUIDE}

[taekil_advice]
Top ${topCount} 길일을 각각 [top1]${topCount >= 2 ? ' [top2]' : ''}${topCount >= 3 ? ' [top3]' : ''} 마커 안에 분석하세요. 각 마커 안에는 "종합:" 과 "키워드:" 라벨만 사용합니다.${worstDays.length > 0 ? ' 흉일은 [avoid] 마커로 경고하세요.' : ''}${isBirth ? ' 마지막 줄에 면책 문구 필수.' : ''}`;
};

// ============================================================
// 궁합 (관계별 독립 프롬프트)
// ============================================================

export type GunghapCategory =
  | 'secret_crush' // 짝사랑
  | 'som'          // 썸남/썸녀
  | 'lover'        // 연인
  | 'spouse'       // 배우자
  | 'ex_lover'     // 전여친/전남친
  | 'ex_spouse'    // 전남편/전아내
  | 'soulmate'     // 소울메이트
  | 'rival'        // 라이벌
  | 'friend'       // 친구
  | 'mentor'       // 멘토·멘티
  | 'parent_child' // 부모와 자녀
  | 'sibling'      // 형제/자매
  | 'work'         // 직장 동료
  | 'business'     // 사업 파트너
  | 'idol_fan'     // 유명인과의 궁합
  | 'pet'          // 나와 반려동물
  | 'custom';      // 직접 입력

/** 두 사람 사주 공통 요약 블록 생성 */
function buildPersonBlock(result: SajuResult, name: string): string {
  const p = result.pillars;
  const gyeokguk = determineGyeokguk(result);
  const gyeokgukTraits = gyeokguk.traits && gyeokguk.traits.length > 0
    ? gyeokguk.traits.slice(0, 4).join('·')
    : '';

  // 기둥별 십성 (일간 제외)
  const sipseongByPillar = [
    `년간 ${p.year.gan}:${p.year.tenGodGan || '일간'} 년지 ${p.year.zhi}:${p.year.tenGodZhi}`,
    `월간 ${p.month.gan}:${p.month.tenGodGan} 월지 ${p.month.zhi}:${p.month.tenGodZhi}`,
    `일지 ${p.day.zhi}:${p.day.tenGodZhi}`,
    result.hourUnknown ? '시주:미상' : `시간 ${p.hour.gan}:${p.hour.tenGodGan} 시지 ${p.hour.zhi}:${p.hour.tenGodZhi}`,
  ].join(' / ');

  // 공망 기둥
  const kongmangList: string[] = [];
  const kongmangPillars: { label: string; p: typeof p.year }[] = [
    { label: '년주', p: p.year }, { label: '월주', p: p.month }, { label: '일주', p: p.day },
    ...(!result.hourUnknown ? [{ label: '시주', p: p.hour }] : []),
  ];
  kongmangPillars.forEach(({ label, p: pl }) => {
    if ((pl as typeof p.year & { isKongmang?: boolean }).isKongmang) kongmangList.push(label);
  });
  const kongmangStr = kongmangList.length > 0 ? kongmangList.join('·') : '없음';

  // 신살 요약
  const sinSalGood = result.sinSals.filter(s => s.type === 'gilseong').map(s => s.name).join('·') || '없음';
  const sinSalBad = result.sinSals.filter(s => s.type === 'sinsal').map(s => s.name).join('·') || '없음';

  // 신강신약 세부
  const sd = (result as typeof result & { strengthDetail?: { bijeopScore?: number; inseongScore?: number } }).strengthDetail;
  const sdStr = sd
    ? ` (비겁점${(sd.bijeopScore ?? 0).toFixed(1)} 인성점${(sd.inseongScore ?? 0).toFixed(1)})`
    : '';

  const lines = [
    `이름: ${name}`,
    `일주: ${p.day.gan}${p.day.zhi}(${p.day.ganElement}·${result.dayMasterYinYang}간) / 12운성: ${p.day.twelveStage}`,
    `오행: 목${result.elementPercent.목}% 화${result.elementPercent.화}% 토${result.elementPercent.토}% 금${result.elementPercent.금}% 수${result.elementPercent.수}%`,
    `신강신약: ${result.strengthStatus}${sdStr} / 용신: ${result.yongSinElement}(${result.yongSin}) / 기신: ${result.giSin}`,
    `격국: ${gyeokguk.name}${gyeokgukTraits ? `(${gyeokgukTraits})` : ''}`,
    `기둥별 십성: ${sipseongByPillar}`,
    `일지 합·충: ${result.interactions.filter(i => i.description.includes(p.day.zhi)).map(i => `${i.type}:${i.description}`).join(' / ') || '없음'}`,
    `간여지동: ${formatGanYeojidong(result)} / 병존·삼존: ${formatByeongjOn(result)}`,
    `공망: ${kongmangStr}`,
    `길성: ${sinSalGood} / 신살: ${sinSalBad}`,
  ];
  return lines.join('\n');
}

/** 두 일간 사이 오행 관계 */
function twoPersonElRelation(elA: string, elB: string): string {
  if (elA === elB) return '비화(같은 오행 — 공명·경쟁 공존)';
  if (EL_GEN[elA] === elB) return `A→B 상생(${elA}生${elB} — A가 B를 키움)`;
  if (EL_GEN[elB] === elA) return `B→A 상생(${elB}生${elA} — B가 A를 키움)`;
  if (EL_CON[elA] === elB) return `A→B 상극(${elA}克${elB} — A가 B를 제어·부담)`;
  if (EL_CON[elB] === elA) return `B→A 상극(${elB}克${elA} — B가 A를 제어·부담)`;
  return '무관계';
}

/** 일지 음양합 여부 (子丑·寅亥·卯戌·辰酉·巳申·午未) */
function checkEumYangHap(zhiA: string, zhiB: string): string {
  const pairs: [string, string][] = [
    ['자','축'], ['인','해'], ['묘','술'], ['진','유'], ['사','신'], ['오','미']
  ];
  const found = pairs.find(([a, b]) => (zhiA === a && zhiB === b) || (zhiA === b && zhiB === a));
  return found ? `일지 음양합(${found[0]}·${found[1]}) — 자연스럽게 당기는 인연` : '없음';
}

/** 사주 4기둥 지지 목록 추출 */
function getAllPillarZhis(result: SajuResult): { label: string; zhi: string }[] {
  const p = result.pillars;
  const list: { label: string; zhi: string }[] = [
    { label: '년지', zhi: p.year.zhi },
    { label: '월지', zhi: p.month.zhi },
    { label: '일지', zhi: p.day.zhi },
  ];
  if (!result.hourUnknown) list.push({ label: '시지', zhi: p.hour.zhi });
  return list;
}

/** 두 사람 간 지지 합·충·형·삼합 교차 분석 */
function buildCrossJiziInteractions(
  me: SajuResult, other: SajuResult,
  myName: string, otherName: string
): string {
  const myZhis = getAllPillarZhis(me);
  const otherZhis = getAllPillarZhis(other);
  const LIUHE: [string, string, string][] = [
    ['자','축','토화'], ['인','해','목화'], ['묘','술','화화'],
    ['진','유','금화'], ['사','신','수화'], ['오','미','화화'],
  ];
  const CHONG: [string, string][] = [
    ['자','오'], ['축','미'], ['인','신'], ['묘','유'], ['진','술'], ['사','해']
  ];
  const SANHE: [string[], string][] = [
    [['인','오','술'], '화국(열정·추진력)'], [['신','자','진'], '수국(지혜·유연성)'],
    [['사','유','축'], '금국(의지·결단력)'], [['해','묘','미'], '목국(성장·창의력)'],
  ];
  const results: string[] = [];

  for (const mz of myZhis) {
    for (const oz of otherZhis) {
      for (const [a, b, res] of LIUHE) {
        if ((mz.zhi === a && oz.zhi === b) || (mz.zhi === b && oz.zhi === a)) {
          results.push(`${myName} ${mz.label}(${mz.zhi}) × ${otherName} ${oz.label}(${oz.zhi}) 지지합(${a}${b}합·${res}) — 자연스러운 인연`);
        }
      }
      for (const [a, b] of CHONG) {
        if ((mz.zhi === a && oz.zhi === b) || (mz.zhi === b && oz.zhi === a)) {
          results.push(`${myName} ${mz.label}(${mz.zhi}) × ${otherName} ${oz.label}(${oz.zhi}) 지지충(${mz.zhi}${oz.zhi}충) — 마찰·변화 에너지`);
        }
      }
    }
  }

  const allMy = myZhis.map(z => z.zhi);
  const allOther = otherZhis.map(z => z.zhi);

  // 자묘형(무례지형) cross-person
  if ((allMy.includes('자') && allOther.includes('묘')) || (allMy.includes('묘') && allOther.includes('자'))) {
    results.push('두 사람 합산 자묘형(무례지형) 성립 — 감정 표현 방식 충돌, 언행 주의');
  }
  // 인사신(무은지형) cross-person — 3지 중 2지가 두 사람 사이에 걸쳐있을 때
  {
    const INHA = ['인','사','신'];
    const myHas = INHA.filter(z => allMy.includes(z));
    const otherHas = INHA.filter(z => allOther.includes(z));
    if (myHas.length > 0 && otherHas.length > 0 && myHas.some(z => !otherHas.includes(z))) {
      results.push(`두 사람 합산 인사신 무은지형(${[...myHas, ...otherHas].join('·')}) 성립 — 은혜를 모른다는 형, 기대·보상 어긋남 주의`);
    }
  }
  // 축술미(지세지형) cross-person
  {
    const JISE = ['축','술','미'];
    const myHas = JISE.filter(z => allMy.includes(z));
    const otherHas = JISE.filter(z => allOther.includes(z));
    if (myHas.length > 0 && otherHas.length > 0 && myHas.some(z => !otherHas.includes(z))) {
      results.push(`두 사람 합산 축술미 지세지형(${[...myHas, ...otherHas].join('·')}) 성립 — 자존심 충돌·고집 부딪힘 주의`);
    }
  }

  for (const [members, label] of SANHE) {
    const combined = [...allMy, ...allOther];
    const matched = members.filter(m => combined.includes(m));
    if (matched.length >= 2 && members.some(m => allMy.includes(m)) && members.some(m => allOther.includes(m))) {
      results.push(`${matched.join('·')} ${label} 반합/삼합 — 함께할 때 강력한 시너지`);
    }
  }

  return results.length > 0 ? results.join('\n') : '두 사람 간 특기할 지지 합·충·형 없음';
}

/** 두 사람 주요 십성 분포 비교 */
function buildGunghapSipseong(
  me: SajuResult, other: SajuResult,
  myName: string, otherName: string
): string {
  const myCounts = computeSipseongCounts(me);
  const otherCounts = computeSipseongCounts(other);
  const keys = ['정재','편재','정관','편관','정인','편인','식신','상관','비견','겁재'];
  const fmt = (counts: Record<string, number>) =>
    keys.filter(k => (counts[k] || 0) > 0)
      .sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
      .slice(0, 4).map(k => `${k}(${counts[k].toFixed(1)})`)
      .join(' > ');
  return `${myName} 십성: ${fmt(myCounts) || '없음'}\n${otherName} 십성: ${fmt(otherCounts) || '없음'}`;
}

/** 두 사람 오행 분포 비교 및 상보 관계 */
function buildOhaengCompare(
  me: SajuResult, other: SajuResult,
  myName: string, otherName: string
): string {
  const els = ['목','화','토','금','수'] as const;
  const myRow = els.map(e => `${e}${me.elementPercent[e]}%`).join(' ');
  const otherRow = els.map(e => `${e}${other.elementPercent[e]}%`).join(' ');
  const comps: string[] = [];
  for (const e of els) {
    if (me.elementPercent[e] === 0 && other.elementPercent[e] >= 20)
      comps.push(`${otherName}의 ${e}기운이 ${myName}의 결핍 보충`);
    if (other.elementPercent[e] === 0 && me.elementPercent[e] >= 20)
      comps.push(`${myName}의 ${e}기운이 ${otherName}의 결핍 보충`);
  }
  const complementStr = comps.length > 0 ? comps.join(' / ') : '오행 결핍 상호보완 없음 (독립적 구성)';
  return `${myName}: ${myRow}\n${otherName}: ${otherRow}\n상보관계: ${complementStr}`;
}

// ─────────────────────────────────────────────
// 궁합 전용 관계 해석 지식베이스
// ─────────────────────────────────────────────
const GUNGHAP_RELATION_KB = `[궁합 명리 해석 지식베이스 — 반드시 참고]

★ 일간 오행 관계별 궁합 해석 프레임:
- 비화(같은 오행): 거울 관계. 깊은 공감과 이해, 동시에 서로의 약점도 비추는 관계. 갈등이 생기면 자존심 싸움으로 번지기 쉬움. 해결법: 경쟁이 아닌 공명으로 전환.
- 상생(A→B): A가 에너지를 주는 관계. A는 자연스럽게 B를 돌보고, B는 A에게 편안함을 느낌. 위험: A의 에너지 고갈, B의 의존. 해결법: 감사를 표현하고 되돌려주는 순환 만들기.
- 상극(A→B): A가 B를 제어하는 긴장 관계. 초기엔 끌림(권위·보호)으로 느껴지나, 장기적으로 B가 숨막힘을 느낄 수 있음. 해결법: 제어가 아닌 보호로 전환, B의 자율성 존중.

★ 일지 관계가 궁합에 미치는 영향:
- 일지 합: 무의식적 끌림, 말하지 않아도 통하는 감각. 일상 속 자연스러운 동조.
- 일지 충: 강한 자극과 갈등. 매력적이나 지속적 마찰. 충돌을 통한 성장이 가능한 관계.
- 일지 형: 은근한 불편함. 표면적으론 괜찮아 보이나 내면에 쌓이는 스트레스. 직접적 소통이 해결책.

★ 신강신약 조합별 관계 역학:
- 신강+신강: 두 사람 모두 주도권을 원함. 각자의 영역을 명확히 나누면 최고의 파트너, 침범하면 충돌.
- 신강+신약: 자연스러운 리더-서포터 구조. 위험: 신강 쪽의 일방적 지배. 신약 쪽의 의견을 의식적으로 물어야 함.
- 신약+신약: 서로 기대며 따뜻하게 가는 관계. 외부 도전 앞에서 함께 약해질 수 있음. 공동의 목표가 이 관계를 단단하게 함.

★ 용신·기신 교차 영향:
- 내 용신 = 상대 일간: 상대와 함께 있으면 에너지가 차오름. 강력한 인연.
- 내 기신 = 상대 일간: 상대가 내 에너지를 소진시키는 구조. 의식적 거리 조절 필요.
- 동일 용신: 같은 방향을 바라보는 관계. 함께 성장하기 좋음.
- 용신 상충: 서로 다른 방향을 원하는 구조. 각자의 길을 존중하는 것이 핵심.

★ 십성으로 보는 관계 패턴:
- 비견 과다 커플: 경쟁적이나 동지적. 함께 도전하면 강해짐.
- 식상 과다 커플: 표현이 풍부하고 재미있으나, 감정 소모 큼. 침묵의 시간도 필요.
- 재성 과다 커플: 현실적이고 안정적이나, 감정 표현 부족할 수 있음. 물질 외의 사랑 표현 중요.
- 관성 과다 커플: 책임감 강하고 체계적이나, 서로를 통제하려는 경향. 자유 시간 보장.
- 인성 과다 커플: 지적 교감 풍부, 대화가 깊음. 행동력 부족할 수 있어 함께 실행하는 습관 필요.

★ 궁합 점수 산출 기준 (종합 점수는 반드시 60~97 범위 내에서 산출 — 다른 운세 카테고리와 일관성):
- 90~97: 일지합 + 용신 상호충족 + 오행 상보 + 충·형 없음 (대길)
- 82~89: 일간 상생 + 지지합 1개 이상 + 약한 충돌 있으나 보완 가능 (길)
- 72~81: 특별한 합 없으나 충돌도 약함 + 부분적 오행 보완 (중길)
- 65~71: 일지충 또는 용신·기신 일부 충돌 + 오행 편향 겹침 (평)
- 60~64: 다중 충·형 + 기신 직접 충돌 (중흉)
※ ★ 어떤 흉운에도 종합 점수는 60 미만으로 산출하지 말 것. 항상 긍정적 가능성을 함께 제시. 낮은 점수도 "불가능"이 아닌 "다른 방식으로 풀어야 할 관계"로 서술.
※ 영역별 세부 점수도 동일한 60~97 범위 내에서 산출 (절대 60 미만 금지).

★ 영역별 세부 점수 산출 프레임:
- 정서교감: 일지합/충, 일간 음양 조화, 식상·인성 분포로 감정 교류 능력 평가
- 소통이해: 십성 분포 유사도, 지지 합, 비겁 균형으로 의사소통 적합도 평가
- 가치관: 격국 유사·보완 관계, 용신 방향 일치도, 오행 분포 상보성으로 평가
- 성장발전: 용신 상호 충족 여부, 삼합·반합 존재, 상생 흐름으로 평가
- 갈등해소: 충·형 개수와 강도, 기신 충돌 유무, 신강신약 조합으로 평가`;

// ─────────────────────────────────────────────
// 카테고리별 특화 지식베이스
// ─────────────────────────────────────────────

const LOVER_KB = `[연인 궁합 특화 지식베이스]

★ 연인 궁합에서 가장 중요한 3대 축:
1. 일지 합(六合): 무의식적 끌림·성적 케미의 근거. 일지가 합이면 설명할 수 없는 당김이 존재.
2. 배우자성 오행 대응: 남자의 재성 오행=여자 일간, 여자의 관성 오행=남자 일간이면 본능적 배우자 인연.
3. 용신 상호충족: 함께 있을수록 에너지가 차오르는 관계. 장기 연애의 핵심 동력.

★ 도화살·홍염살의 연인 궁합 영향:
- 도화살(자·오·묘·유)이 서로의 일지·월지에 있으면 강한 이성적 끌림 존재.
- 양쪽 모두 도화살이 강하면 초기 열정은 폭발적이나 감정 기복 주의.
- 홍염살이 있으면 감성적·예술적 교감이 깊음. 단, 감정에 휩쓸리는 패턴 주의.

★ 연애 단계별 명리 해석:
- 초기(0~6개월): 일지 합·도화살이 주도. 끌림·설렘·열정의 근거.
- 중기(6개월~2년): 일간 상생·상극이 드러남. 소통 방식의 차이 부각.
- 장기(2년~): 용신·기신 충돌이 관계 지속성을 결정. 일상의 에너지 흐름이 핵심.

★ 십성으로 보는 연애 스타일:
- 식신 많은 사람: 표현 풍부, 서프라이즈 잘함, 감정을 말로 풀어냄.
- 편인 많은 사람: 속마음을 잘 안 보임, 혼자만의 시간 필요, 깊은 대화 선호.
- 겁재 많은 사람: 독점욕 강함, 질투 표현 직접적, 주도권 필요.
- 정재 많은 사람: 안정 추구, 계획적 연애, 물질적 표현으로 사랑 전달.
- 편관 많은 사람: 밀당 능숙, 긴장감 있는 관계 선호, 통제력 강함.`;

const FRIEND_KB = `[친구 궁합 특화 지식베이스]

★ 우정의 명리학적 핵심 요소:
1. 비겁(비견·겁재) 관계: 동류 에너지. 비겁이 서로 강하면 형제같은 우정이나 경쟁·질투 발생 가능.
2. 식상(식신·상관) 교류: 함께 있을 때 대화·놀이·창작이 풍부한지 결정.
3. 오행 보완: 내 결핍 오행을 친구가 채워주면 "이 친구와 있으면 왜 편한지" 설명.

★ 오래가는 우정의 명리 조건:
- 일간 상생 + 지지 합 1개 이상: 자연스러운 조화, 무리 없는 지속.
- 동일 용신: 같은 방향을 바라보는 동지. 함께 성장하고 함께 기뻐함.
- 식신 에너지 공유: 함께 먹고·놀고·웃는 에너지가 풍부할수록 오래감.

★ 우정을 깨는 구조:
- 겁재 과다 + 재성 충돌: 돈·이성·기회를 두고 경쟁하면 우정 파괴.
- 편관 상호작용: 서로를 통제하려 들면 숨막히는 관계로 변질.
- 기신 직접 충돌: 함께 있으면 피곤해지는 구조. 적절한 거리가 약.

★ 친구 유형별 명리 패턴:
- 비견 친구: 가장 잘 이해하는 친구. 거울 같은 관계. 같은 취미·가치관 공유.
- 식신 친구: 함께 있으면 즐거운 친구. 맛집·여행·취미 동반자.
- 인성 친구: 조언을 잘 해주는 친구. 힘들 때 찾게 되는 인생 멘토형.
- 재성 친구: 현실적 도움을 주는 친구. 정보·네트워크·실질 지원.`;

const FAMILY_KB = `[가족 궁합 특화 지식베이스]

★ 가족 관계의 명리학적 핵심:
1. 년주(年柱): 조상·가문의 에너지. 두 사람의 년주 관계가 가족 인연의 깊이를 보여줌.
2. 인성(정인·편인): 돌봄·보호·교육의 에너지. 부모-자녀 관계의 핵심 축.
3. 세대 간 상생 흐름: 목→화→토→금→수 순환에서 위 세대가 아래 세대를 생하면 자연스러운 양육 구조.

★ 부모-자녀 관계 명리 해석:
- 부모 일간이 자녀를 생(상생): 자연스러운 양육 에너지. 아낌없이 줌.
- 부모 일간이 자녀를 극(상극): 엄격한 교육관. 기대와 압박이 공존.
- 자녀 일간이 부모를 생: 효도형 자녀. 부모를 기쁘게 하려는 본능.
- 자녀 일간이 부모를 극: 반항기 강하나, 성장하면 부모를 넘어서는 인물.

★ 형제·자매 관계:
- 비견 에너지: 동질감 + 경쟁. 어릴 땐 다투지만 어른이 되면 가장 강한 유대.
- 겁재 에너지: 소유 경쟁. 부모의 사랑·자원을 두고 마찰 후 성숙.

★ 가족 갈등의 명리 구조:
- 상극이 강한 가족: 갈등이 반복되지만, 이를 통해 서로를 단련시키는 관계.
- 충(冲)이 있는 가족: 세대 차이가 명리 구조에 각인. 소통 방식의 번역이 필요.
- 형(刑)이 있는 가족: 미세한 불편함이 쌓임. 정기적 대화와 감정 표현이 해독제.`;

const WORK_KB = `[직장동료 궁합 특화 지식베이스]

★ 업무 궁합의 3대 축:
1. 관성(정관·편관): 체계·규칙·목표 의식. 관성이 강한 사람은 마감·규율 중심.
2. 식상(식신·상관): 아이디어·표현·창의력. 식상이 강한 사람은 혁신·기획 중심.
3. 재성(정재·편재): 실리·성과·자원 관리. 재성이 강한 사람은 결과·효율 중심.

★ 업무 스타일 충돌 패턴:
- 관성 vs 식상: 체계파 vs 자유파 충돌. "규칙대로 해" vs "새로 해보자" 마찰.
- 비겁 과다 조합: 두 사람 모두 주도하려 함. 의사결정에서 반복 교착.
- 인성 vs 재성: 학습·준비 우선파 vs 실행·성과 우선파. 속도 차이 갈등.

★ 시너지가 나는 조합:
- 식상(기획) + 관성(실행): 한 쪽이 그리고 한 쪽이 만드는 이상적 역할 분담.
- 신강(주도) + 신약(지원): 리더-서포터 구조. 역할이 명확할 때 효율 극대화.
- 동일 용신: 같은 목표를 향하므로 방향성 갈등 최소화.

★ 직장 관계의 건강 지표:
- 용신·기신 충돌 없음: 장기 협업 지속 가능. 에너지 소진 없이 성과 축적.
- 지지 합 있음: 무의식적 신뢰. 위기 상황에서 자연스럽게 서로 커버.
- 오행 보완: 각자 못하는 영역을 상대가 채움. 팀 성과 극대화.`;

const SOM_KB = `[썸 관계 특화 지식베이스]

★ 썸 단계의 명리학적 특성:
- 썸은 "아직 확정되지 않은 인연"을 탐색하는 시간. 일지 합·도화살이 초기 당김을 주도.
- 용신 충족 여부가 "이 설렘이 진짜인지, 일시적 착각인지" 판별 기준.
- 상대방 사주에서 내가 배우자성(재성/관성) 오행에 해당하면 상대도 나를 이성으로 인식할 확률 높음.

★ 끌림의 종류 구분:
- 일지 합 기반 끌림: 본능적·무의식적. "왜 좋은지 모르겠는데 좋다"의 구조.
- 용신 충족 기반 끌림: 함께 있으면 에너지가 차오르는 느낌. "이 사람과 있으면 나답다."
- 도화살 기반 끌림: 외모·분위기·매력에 대한 이끌림. 강렬하나 지속성 검증 필요.
- 비화(동일 오행) 끌림: "나를 이해해주는 사람" 느낌. 공감은 깊으나 발전 동력 부족 가능.

★ 썸이 연애로 발전하는 명리 조건:
- 일간 상생 또는 합: 소통의 기본 구조 성립.
- 지지 합 1개 이상: 만남이 자연스럽게 이어지는 흐름.
- 용신 상호충족: 만날수록 좋아지는 구조. 장기 발전 가능.

★ 썸이 끊기는 패턴:
- 기신 직접 충돌: 3~5회 만남 후 "뭔가 피곤하다" 느낌. 연락 빈도 감소.
- 지지 충: 스케줄·생활패턴 불일치. 만남 자체가 어려워짐.
- 배우자성 불일치: 상대가 나를 이성으로 인식 못하는 구조. 친구존 고착.`;

const SPOUSE_KB = `[배우자 궁합 특화 지식베이스]

★ 배우자 궁합에서 가장 중요한 5대 요소:
1. 일주(日柱) 전체: 일간은 나, 일지는 배우자궁. 일지의 상태가 결혼 생활 만족도 좌우.
2. 일지 합(六合): 가장 강력한 부부 인연 지표. 무의식적 유대와 일상의 동조.
3. 신강신약 조합: 가정 내 의사결정·역할 분담의 자연 구조를 결정.
4. 재성·관성 균형: 경제력·사회적 지위에 대한 두 사람의 태도 결정.
5. 용신 상호충족: 오래 사랑하는 부부의 가장 큰 비밀. 함께할수록 좋아지는 에너지.

★ 장기 동거에서의 오행 영향:
- 상생 관계: 안정적이나 일방이 에너지를 소진할 수 있음. 되돌려주는 의식 필요.
- 상극 관계: 긴장감은 관계에 활력을 주지만, 누적되면 폭발. 정기적 해소 루틴 필수.
- 비화 관계: 깊은 이해와 동시에 성장 정체 위험. 각자의 영역이 관계를 살림.

★ 가정 경제 명리:
- 재성 과다 부부: 돈은 잘 벌지만 소비 충동도 큼. 재정 회의 루틴 필요.
- 재성 결핍 부부: 정신적 풍요는 있으나 현실 불안. 외부 재정 시스템 활용.
- 한쪽만 재성 강함: 역할 분담 명확. 단, 돈 쥔 쪽의 독주 주의.

★ 자녀 인연:
- 여성 식상(식신·상관): 자녀궁. 식상이 용신이면 자녀에게 기쁨, 기신이면 양육 스트레스.
- 남성 관성(정관·편관): 자녀궁. 관성이 용신이면 자녀가 사회적 성취, 기신이면 부담.`;

const EX_KB = `[전 연인/전 배우자 특화 지식베이스]

★ 이별의 명리학적 구조:
- 기신 직접 충돌: 상대방의 존재 자체가 내 에너지를 소진시키는 구조. "함께 있으면 내가 나답지 못해진다."
- 지지 충의 누적: 일상의 마찰이 쌓여 폭발한 이별. 가치관·생활습관의 근본적 불일치.
- 용신 충족→기신 전환: 초기엔 에너지를 주던 상대가 관계가 깊어지면서 오히려 소진원이 되는 구조.

★ 재결합 판단의 명리 기준:
- 재결합 가능(구조 변화 전제): 일지 합 + 용신 충족이 살아있으나, 기신 충돌이 환경(직업·거리·소통 방식)에서 비롯된 경우.
- 재결합 위험: 기신 직접 충돌 + 지지 충. 구조적 문제가 해결 불가. 같은 패턴 반복.
- 냉각 후 재회 가능: 오행 보완 구조가 강하되, 타이밍(대운·세운)이 맞지 않았던 경우.

★ 이별 후 에너지 회복:
- 용신 오행 활동 집중: 소진된 에너지를 채우는 가장 빠른 방법.
- 기신 오행 환경 최소화: 전 연인과의 공통 공간·습관·사람 관계 정리.
- 새 인연의 조건: 기신 충돌 없는 구조 + 용신 충족하는 상대가 건강한 다음 인연.

★ 감정 vs 명리:
- "보고 싶다"는 일지 합의 잔재일 수 있음. 인연이 아닌 익숙함의 당김.
- "내가 잘못했다"는 기신 충돌로 인한 자기 소진의 결과일 수 있음.
- 명리는 감정의 원인을 구조로 보여줌. 감정에 휘둘리지 않고 판단하게 돕는 도구.`;

const BUSINESS_KB = `[사업 파트너 특화 지식베이스]

★ 사업 궁합의 핵심 축:
1. 재성 균형: 돈에 대한 감각이 맞아야 함. 한쪽은 투자, 한쪽은 아끼기만 하면 충돌.
2. 관성·식상 역할 분담: 기획(식상)과 실행(관성)이 명확히 나뉠 때 시너지 극대화.
3. 신강 조합: 두 사람 모두 신강이면 의사결정 충돌. 권한 범위 사전 명문화 필수.

★ 파트너십 파괴 패턴:
- 재성 vs 재성 과다: 돈 배분에서 끊임없는 갈등. "내가 더 했는데" 논쟁.
- 용신·기신 충돌: 한쪽이 밀어붙일수록 다른 한쪽은 소진. 의사결정 불균형.
- 비겁 과다 + 관성 과다: 주도권 싸움이 사업 방향 흔듦. 역할 침범 빈발.

★ 성공하는 파트너십의 명리 조건:
- 오행 보완 구조: 각자 못하는 영역이 명확하고, 상대가 그걸 채움.
- 동일 용신 또는 용신 상생: 사업의 방향성에 근본 합의 가능.
- 지지 합 1개 이상: 위기 상황에서도 신뢰가 무너지지 않는 무의식적 유대.

★ 금전 운용 명리:
- 정재 강한 사람: 보수적·안정적 재정 관리. 저축형.
- 편재 강한 사람: 투자형·모험형. 큰 판을 벌이려는 성향.
- 재성 없는 사람: 돈 자체에 관심 약함. 돈 관리를 맡기는 것이 현명.`;

const CRUSH_KB = `[짝사랑 특화 지식베이스]

★ 짝사랑의 명리학적 구조:
- 짝사랑은 "내 사주에서 상대방이 용신·배우자성 위치에 있는데, 상대 사주에서 나는 그렇지 않은" 비대칭 구조.
- 한쪽만 끌리는 이유: 내 용신=상대 일간이면 나는 상대에게 에너지를 받지만, 상대는 나에게 특별한 에너지를 못 느끼는 구조.

★ 마음이 통할 가능성 판단:
- 높음: 일지 합 + 상대 사주에서 내가 재성/관성 오행. 상대도 나를 이성으로 인식.
- 보통: 지지 합 1개 있으나 배우자성 불일치. 호감은 가능하나 결정적 끌림 부족.
- 낮음: 기신 충돌 + 배우자성 불일치 + 지지 충. 구조적으로 상대의 관심 밖.

★ 상대방의 마음을 여는 명리 전략:
- 상대의 용신 오행 환경을 함께 경험: 상대가 에너지를 받는 상황에 내가 있으면 긍정 연결.
- 상대의 식신 오행과 동조: 상대가 표현하고 즐기는 것에 공감하면 호감 상승.
- 상대의 기신 오행 자극 금지: 상대가 불편해하는 방식으로 접근하면 역효과.

★ 짝사랑 지속 vs 포기 판단:
- 지속 근거: 일지 합·지지 합 존재 + 용신 방향 일치. 타이밍 문제일 수 있음.
- 포기 근거: 기신 직접 충돌 + 배우자성 완전 불일치 + 충 다수. 구조적 불가.
- 핵심: 감정이 아닌 명리 구조로 객관적 판단을 돕되, 최종 선택은 본인의 몫임을 존중.`;

const SOULMATE_KB = `[소울메이트 특화 지식베이스]

★ 소울메이트의 명리학적 정의:
- 단순히 "잘 맞는 관계"가 아닌, "서로의 존재가 서로를 완성시키는 구조."
- 핵심 지표: 용신 상호충족 + 오행 결핍 상보 + 일지 합. 이 3가지가 겹칠수록 강력한 소울메이트.
- 소울메이트는 반드시 편안하지만은 않음. "함께 성장하도록 설계된 인연"이므로 갈등도 포함.

★ 소울메이트 vs 카르마 인연:
- 소울메이트: 합(合) 위주. 함께 있으면 에너지 순환이 돌아감. 더 나은 나로 성장.
- 카르마 인연: 충·형·기신 충돌 위주. 강렬한 끌림 후 반복적 상처. 배움 후 분리.
- 구분법: 오랜 시간 함께할수록 더 좋아지면 소울메이트, 점점 소진되면 카르마.

★ 소울메이트 명리 지표 (3개 이상 해당 시 강력):
- 일지 육합(六合) 성립
- 용신 상호충족 (내 용신=상대 일간 또는 역)
- 오행 결핍 상호보완 (내 0% 오행을 상대가 20%+ 보유, 또는 역)
- 일간 천간합 (갑기·을경·병신·정임·무계)
- 동일 격국 또는 보완 격국
- 삼합 구조 형성 (두 사람의 지지가 합쳐 삼합 완성)

★ 소울메이트 관계의 그림자:
- 너무 깊은 이해가 오히려 상처: "아는 만큼 찌르는" 구조. 감정적 무기화 주의.
- 의존 패턴: 상대 없이는 불완전하다는 착각. 각자의 독립성 유지가 관계의 생명.
- 성장 속도 차이: 한쪽이 빠르게 변할 때 관계가 흔들림. 서로의 속도 존중이 핵심.`;

const RIVAL_KB = `[라이벌 특화 지식베이스]

★ 라이벌 관계의 명리학적 유형:
- 비화(비견) 라이벌: 같은 오행, 같은 방식. 가장 정통적 경쟁. 거울을 보는 듯한 자극.
- 상극 라이벌: 서로 다른 방식의 충돌. "왜 저렇게 하지?"라는 불편함이 성장 동력.
- 상생 라이벌: 한쪽이 다른 쪽을 키워주면서 경쟁. 의도치 않게 서로를 강하게 만듦.

★ 건강한 경쟁 vs 소진 경쟁:
- 건강: 용신 방향 다름 + 오행 보완. 각자의 영역에서 자극받으며 성장.
- 소진: 기신 직접 충돌 + 관성 과다 쌍방. 이기려는 욕구가 에너지를 태움.
- 판단 기준: 경쟁 후 에너지가 차오르면 건강, 경쟁 후 탈진하면 소진.

★ 라이벌을 성장 도구로 전환:
- 상대의 강점 = 내가 배울 오행. 시기가 아닌 학습 대상으로 전환.
- 경쟁 영역 한정: 모든 것에서 이기려 하면 소진. 핵심 1~2개만 경쟁.
- 정기적 거리 조절: 라이벌과의 밀착은 관성·비겁 과부하. 각자의 시간 필수.

★ 비겁·관성과 경쟁 에너지:
- 비겁 과다: 경쟁심 자체가 삶의 동력. 라이벌이 없으면 무기력.
- 관성 과다: 목표 의식 강함. "반드시 이겨야 한다"는 압박이 자신을 조임.
- 식상 과다: 경쟁보다 창작·표현으로 승부. 다른 방식으로 이기는 전략 필요.`;

const MENTOR_KB = `[멘토·멘티 특화 지식베이스]

★ 멘토십의 명리학적 구조:
- 상생(生) 관계가 멘토십의 자연 구조. 생하는 쪽이 멘토, 받는 쪽이 멘티.
- 인성(정인·편인): 지식 수용·학습 능력. 인성이 강한 사람은 빠르게 흡수.
- 식상(식신·상관): 배운 것을 소화해 자기 것으로 표현. 멘티의 독립 지표.

★ 효과적 멘토십 조합:
- 멘토 식상 강함 + 멘티 인성 강함: 가르치는 능력 + 배우는 능력 최적 매치.
- 멘토 관성 강함 + 멘티 비겁 강함: 체계와 규율 전수. 구조적 성장 유도.
- 동일 용신: 같은 방향 추구. 멘토의 경험이 멘티에게 직접 적용 가능.

★ 멘토십의 위험 구조:
- 멘토 관성 과다 + 멘티 식상 강함: 멘토의 통제가 멘티의 창의성 억압.
- 멘토 = 멘티의 기신: 가르칠수록 멘티 에너지 소진. 독이 되는 가르침.
- 멘티 성장 > 멘토: 역전 시점에서 관계 재정의 필요. 동료로 전환하는 성숙함.

★ 멘토십에서의 에너지 흐름:
- 신강 멘토 + 신약 멘티: 자연스러운 이끔. 단, 멘티의 의견 청취 의식 필요.
- 신약 멘토 + 신강 멘티: 부드러운 조언형 멘토십. 멘티가 주도하되 방향을 잡아줌.
- 대등 신강: 수평적 성장 파트너. 분야를 나눠 번갈아 가르치는 구조 최적.`;

// ─────────────────────────────────────────────
// 연인·배우자 궁합
// ─────────────────────────────────────────────
export const generateLoverGunghapPrompt = (
  me: SajuResult, other: SajuResult,
  myName: string, otherName: string
): string => {
  const myEl = me.pillars.day.ganElement;
  const otherEl = other.pillars.day.ganElement;
  const elRel = twoPersonElRelation(myEl, otherEl);
  const eumYangHap = checkEumYangHap(me.pillars.day.zhi, other.pillars.day.zhi);

  // 내가 상대 배우자성에 해당하는지 (남성 기준: 상대 여성의 관성=나 / 여성 기준: 상대 남성의 재성=나)
  const mySpouseCheck = (() => {
    if (other.gender === 'female') {
      // 상대(여) 관성 오행 = 상대 일간을 극하는 오행
      const otherGuanEl = Object.entries(EL_CON).find(([, v]) => v === other.pillars.day.ganElement)?.[0] || '';
      return myEl === otherGuanEl ? `${myName}의 오행(${myEl})이 ${otherName}의 관성 오행 — 배우자 인연 강함` : `배우자성 오행 불일치(관성 ${otherGuanEl} vs ${myName} ${myEl})`;
    } else {
      const otherJaeEl = EL_CON[other.pillars.day.ganElement] || '';
      return myEl === otherJaeEl ? `${myName}의 오행(${myEl})이 ${otherName}의 재성 오행 — 배우자 인연 강함` : `배우자성 오행 불일치(재성 ${otherJaeEl} vs ${myName} ${myEl})`;
    }
  })();

  const crossInteractions = buildCrossJiziInteractions(me, other, myName, otherName);
  const sipseongCompare = buildGunghapSipseong(me, other, myName, otherName);
  const ohaengCompare = buildOhaengCompare(me, other, myName, otherName);
  const yongSinClash = [
    `${myName} 용신(${me.yongSinElement}) vs ${otherName} 기신(${other.giSin}): ${me.yongSinElement === other.giSin ? '충돌 — 에너지 소진 주의' : '충돌 없음'}`,
    `${otherName} 용신(${other.yongSinElement}) vs ${myName} 기신(${me.giSin}): ${other.yongSinElement === me.giSin ? '충돌 — 에너지 소진 주의' : '충돌 없음'}`,
  ].join('\n');

  return `당신은 사주명리 전문가입니다. 두 사람의 연인 궁합을 아래 10개 섹션으로 풀이하세요.

[절대 규칙]
- Markdown·이모지 금지. 섹션 제목은 반드시 "▶ 제목" 형식으로만.
- 수치·판정 변경 금지. 흐린 표현 2회 이하. 각 섹션 본문은 2~3문단으로 나누고 문단 사이 빈 줄 필수.
- ★ 각 ▶ 섹션의 첫 줄은 반드시 은유 부제목(7~20자)만 단독 한 줄 출력. 마침표·'다/요/니다' 종결·'두 사람' 시작·명리 용어(오행/천간/지지)·숫자 시작 모두 금지. 명사구·체언 종결만 허용. 예: "잔잔한 호수 위의 첫눈" / "바람에 실려 온 불씨". 본문은 반드시 다음 줄부터.
- 출력은 첫 줄에 관계를 상징하는 은유 제목(7~14자)으로 시작. 대괄호·섹션 태그·식별자는 절대 출력하지 말 것. 총 분량: 3,800~4,800자.
- 모든 분석은 반드시 제공된 사주 데이터를 근거로 서술. 추상적·일반론 금지. "이 두 사람의 사주에서 구체적으로 어떤 글자가 어떻게 작용하는지" 명시.

[${myName} 사주]
${buildPersonBlock(me, myName)}

[${otherName} 사주]
${buildPersonBlock(other, otherName)}

▶ 일간 오행 관계
${elRel}

▶ 일지 음양합
${eumYangHap}

▶ 두 사람 지지 합·충·형
${crossInteractions}

▶ 오행 분포 비교
${ohaengCompare}

▶ 십성 분포 비교
${sipseongCompare}

▶ 배우자성 오행 대응
${mySpouseCheck}

▶ 용신·기신 충돌
${yongSinClash}

${GUNGHAP_RELATION_KB}
${LOVER_KB}
${METAPHOR_KB}
${METAPHOR_TITLE_RULE}
${GUNGHAP_SECTION_FORMAT}

[작성 지침 — 아래 10개 섹션을 순서대로 빠짐없이 작성하세요]

▶ 핵심 요약 (350~450자)
첫 줄은 반드시 은유 부제목(7~20자, 명사구 종결, 마침표·서술형 종결 금지)만 단독 한 줄. 본문은 다음 줄부터. 아래 5가지를 모두 종합적으로 담으세요: ① 일간 오행 관계(${elRel})가 만드는 에너지 구조 — "상생이라 자연스럽게 흐르는 관계인지, 상극이라 끌어당기면서 부딪히는 관계인지" 한마디 선언. ② 일지 음양합(${eumYangHap}) 여부로 감정적 교감의 깊이를 평가. ③ 배우자성 오행 대응(${mySpouseCheck})으로 "사주 구조상 결혼까지 갈 수 있는 인연인지, 연애 인연에 머무는 구조인지" 판정. ④ 용신·기신 충돌 여부로 "함께할수록 서로를 살리는지, 소진하는지" 에너지 방향 제시. ⑤ 이 관계의 가장 큰 강점 1가지와 가장 조심해야 할 포인트 1가지를 명확히 대비시키세요. 마지막 줄에 이 관계의 핵심 키워드 3개를 짧게 나열.

▶ 공명과 끌림 (300~380자)
두 사람이 처음 만났을 때 왜 끌렸는지 명리적 근거 3~4가지로 서술하세요. 지지 합·삼합 결과(${crossInteractions})를 구체적으로 활용해 "어떤 에너지가 둘을 당겼는지" 장면으로 묘사. 일간이 동일하다면 비화(비견) 공명의 양면성(강렬한 동질감 + 내면 경쟁)을 언급. 배우자성 오행 대응 여부로 "본능적 끌림인지 이성적 선택인지" 구분 서술. 첫 만남에서 서로에게 느꼈을 감정을 구체적 상황("카페에서 눈이 마주쳤을 때", "대화 중 갑자기 심장이 뛴 순간")으로 묘사하세요.

▶ 오행 상보 관계 (300~380자)
두 사람의 오행 분포를 비교해 서로가 어떻게 채워주는지 서술하세요. 결핍 오행 상보 관계를 실생활 장면("함께 있을 때 ${myName}은 ~해지고, ${otherName}은 ~해진다")으로 구체적으로 묘사. 두 사람이 함께할 때 강해지는 오행과 과잉이 될 수 있는 오행을 모두 언급. 일상생활에서 이 보완 관계가 드러나는 구체적 순간 2가지를 묘사. "이 사람이 없으면 내게 부족해지는 것"을 각자 입장에서 1문장씩.

▶ 갈등·마찰 포인트 (320~400자)
두 사람 사이에서 반복될 수 있는 갈등 패턴을 3가지 구체 장면으로 묘사하세요. 지지 충·형·용신 기신 충돌 근거를 활용. 단순한 성격 차이가 아닌 "명리 구조가 만드는 필연적 충돌 구조"로 설명. 각 갈등마다: ① 어떤 상황에서 터지는지, ② 서로가 느끼는 감정, ③ 구체적 처방 1문장을 반드시 포함. 신강신약 조합에서 오는 주도권 문제도 1가지 언급하세요.

▶ 운명의 연결고리 (260~340자)
지지 합·삼합·간합 구조에서 드러나는 인연의 깊이를 서술. "만약 이 둘이 만나지 않았다면 사주에서 채워지지 않았을 것"을 구체적으로 묘사. 천간합·지지합 중 성립하는 것이 있다면 그것이 만드는 정서적 끈을 장면으로 그리세요. 이 관계만이 가진 대체 불가능한 인연의 근거 2가지.

▶ 연애 방식과 역학 (320~400자)
십성 분포를 근거로 두 사람의 연애 스타일을 심층 분석하세요. ${myName}의 연애 언어(어떻게 사랑을 표현하는지)와 ${otherName}의 연애 언어를 각각 분석. "누가 더 표현하고 누가 더 받는지", "사랑을 어떻게 주고받는지" 구체적으로 서술. 재성·식신·관성·인성 분포로 연애 초기/중기/장기에 각각 어떤 변화가 오는지 시간축으로 묘사. 연애가 깊어질수록 주의해야 할 반복 패턴 2가지와 관계를 오래 유지하는 핵심 비결 2가지로 마무리.

▶ 서로의 속마음 (260~340자)
${myName}이 ${otherName}에게 말 못 하는 내면 욕구, ${otherName}이 ${myName}에게 진짜 원하는 것을 십성 구조로 분석하세요. 각자의 속마음을 1인칭 화법으로 생생하게 대변("나는 사실 당신이 ~해줬으면 해. 왜냐하면 나는 ~한 사주라서..."). 상대방이 오해하기 쉬운 행동 패턴 각각 1가지씩 설명하고, 그 행동의 진짜 의미("겉으로는 ~처럼 보이지만, 실은 ~라는 뜻")까지 풀어주세요.

▶ 일상 속 케미 (260~340자)
동거·데이트·일상 생활에서 두 사람의 궁합이 드러나는 구체적 장면 3가지를 묘사하세요. 식사 스타일(식신·상관 분포), 여가 활동 선호(용신 오행), 집안일 분담(신강신약) 등을 명리 근거로 풀어내세요. "함께 살 때 가장 행복한 순간"과 "사소한 짜증이 쌓이는 순간"을 대비시키세요.

▶ 이 사랑의 미래 (260~340자)
세월이 흐를수록 이 관계가 어떻게 변하는지 명리 구조로 예측하세요. 연애 초기·중기·장기에 각각 어떤 에너지 변화가 오는지 서술. 신강신약 조합과 용신 방향으로 "10년 후 이 커플의 모습"을 구체적으로 그려주세요. 이 사랑이 오래가기 위한 핵심 조건 1가지를 선언하세요.

▶ 개운법·처방 (260~340자)
이 두 사람이 함께 운을 높이는 실용 처방 5가지를 제시하세요: 1) 용신 오행에 맞는 데이트 장소·활동 2가지(구체적 장소명 수준으로), 2) 함께 있을 때 피해야 할 상황이나 장소 2가지, 3) 갈등이 생겼을 때 화해 방법(누가 먼저 어떻게), 4) 관계를 더 깊게 만드는 주간 루틴 1가지, 5) 이 관계가 가진 가장 아름다운 가능성을 한 문장으로 선언.

`;
};

// ─────────────────────────────────────────────
// 친구 궁합
// ─────────────────────────────────────────────
export const generateFriendGunghapPrompt = (
  me: SajuResult, other: SajuResult,
  myName: string, otherName: string
): string => {
  const myEl = me.pillars.day.ganElement;
  const otherEl = other.pillars.day.ganElement;
  const elRel = twoPersonElRelation(myEl, otherEl);

  // 비겁 개수 (동류 에너지 공명 여부)
  const myBijeop = (computeSipseongCounts(me)['비견'] || 0) + (computeSipseongCounts(me)['겁재'] || 0);
  const otherBijeop = (computeSipseongCounts(other)['비견'] || 0) + (computeSipseongCounts(other)['겁재'] || 0);

  // 오행 보완 (결핍 오행 상호 충족)
  const myMissing = Object.entries(me.elementPercent).filter(([, v]) => v === 0).map(([k]) => k);
  const complement = myMissing.filter(el => other.elementPercent[el as keyof typeof other.elementPercent] > 20);
  const complementStr = complement.length > 0
    ? `${myName}의 결핍 오행(${complement.join('·')})을 ${otherName}이 채워줌 — 보완 관계`
    : '오행 결핍 상호보완 없음';

  const crossInteractions = buildCrossJiziInteractions(me, other, myName, otherName);
  const ohaengCompare = buildOhaengCompare(me, other, myName, otherName);

  return `당신은 사주명리 전문가입니다. 두 사람의 친구 궁합을 아래 10개 섹션으로 풀이하세요.

[절대 규칙]
- Markdown·이모지 금지. 섹션 제목은 "▶ 제목" 형식으로만.
- 수치·판정 변경 금지. 흐린 표현 2회 이하. 각 섹션 본문은 2~3문단으로 나누고 문단 사이 빈 줄 필수.
- ★ 각 ▶ 섹션의 첫 줄은 반드시 은유 부제목(7~20자)만 단독 한 줄 출력. 마침표·'다/요/니다' 종결·'두 사람' 시작·명리 용어(오행/천간/지지)·숫자 시작 모두 금지. 명사구·체언 종결만 허용. 예: "잔잔한 호수 위의 첫눈" / "바람에 실려 온 불씨". 본문은 반드시 다음 줄부터.
- 출력은 첫 줄에 관계를 상징하는 은유 제목(7~14자)으로 시작. 대괄호·섹션 태그·식별자는 절대 출력하지 말 것. 총 분량: 3,800~4,800자.
- 모든 분석은 반드시 제공된 사주 데이터를 근거로 서술. 추상적·일반론 금지.

[${myName} 사주]
${buildPersonBlock(me, myName)}

[${otherName} 사주]
${buildPersonBlock(other, otherName)}

▶ 일간 오행 관계
${elRel}

▶ 두 사람 지지 합·충
${crossInteractions}

▶ 오행 분포 비교
${ohaengCompare}

▶ 비겁 에너지 (동류 공명)
${myName} 비겁: ${myBijeop}개 / ${otherName} 비겁: ${otherBijeop}개
${myBijeop + otherBijeop >= 4 ? '비겁 과다 — 경쟁·질투 주의, 이해관계 충돌 가능' : '비겁 적정 — 균형 잡힌 우정 가능'}

▶ 용신 방향
${me.yongSinElement === other.yongSinElement ? '동일 용신 — 같은 방향으로 함께 성장 가능' : '다른 용신 — 서로 다른 강점으로 보완 우정 가능'}

${GUNGHAP_RELATION_KB}
${FRIEND_KB}
${METAPHOR_KB}
${METAPHOR_TITLE_RULE}
${GUNGHAP_SECTION_FORMAT}

[작성 지침 — 아래 10개 섹션을 순서대로 작성하세요]

▶ 핵심 요약 (300~380자)
일간 오행 관계(${elRel})로 이 우정의 구조를 한마디로 선언. "이 두 사람은 ~한 친구다"로 시작. 비겁 에너지(동류 공명)와 지지 합충 결과를 종합해 이 우정의 강점과 약점을 대비시키세요. 오행 보완 관계(${complementStr})를 일상에서 느끼는 장면으로 1가지 묘사. 이 우정의 핵심 키워드 3개로 마무리.

▶ 이 우정의 에너지 구조 (300~380자)
일간 오행 관계(${elRel})를 근거로 두 사람이 함께 있을 때의 에너지 흐름을 묘사하세요. "누가 활력을 주고 누가 안정을 주는지", "이 두 사람이 오래 친구로 지내는 명리적 이유"를 서술. 지지 합 결과(${crossInteractions})가 있다면 이 우정의 특별한 연결 고리로 활용. 비겁(비견·겁재) 에너지가 둘 사이에서 어떻게 작동하는지 — 동류 에너지가 공명하는 순간과 경쟁으로 변하는 순간을 각각 묘사하세요.

▶ 서로에게 어떤 친구인가 (320~400자)
십성 분포를 근거로 ${myName}이 ${otherName}에게 어떤 유형의 친구인지(조언형/함께노는형/든든한형/자극형), ${otherName}이 ${myName}에게 어떤 존재인지 각각 분석하세요. 오행 보완 관계(${complementStr})를 실생활 장면으로 묘사: "힘든 일이 생겼을 때 이 친구가 해주는 것", "여행·취미를 함께할 때 느끼는 시너지", "혼자 못했을 일을 이 친구와 하면 되는 이유"를 구체적으로. 이 우정에서 서로가 은연중에 의지하는 부분 1가지씩도 서술하세요.

▶ 오행 상보 관계 (280~360자)
두 사람의 오행 분포를 비교해 서로가 어떻게 채워주는지 서술하세요. ${myName}에게 부족한 오행을 ${otherName}이 어떻게 보충하는지, 반대도 마찬가지. 이 보완이 일상에서 드러나는 장면 2가지("힘들 때 이 친구가 해주는 것", "놀 때 시너지가 나는 이유")를 구체적으로 묘사하세요.

▶ 서로의 속마음 (280~360자)
${myName}이 ${otherName}에게 말 못 하는 내면 욕구, ${otherName}이 ${myName}에게 진짜 바라는 것을 십성 구조로 분석하세요. 각자의 속마음을 1인칭 화법으로 대변. 상대가 오해하기 쉬운 행동 패턴 1가지씩 설명하고 그 진짜 의미를 풀어주세요.

▶ 갈등과 마찰 포인트 (320~400자)
비겁 에너지(${myName} ${myBijeop}개/${otherName} ${otherBijeop}개)와 지지 충 구조를 근거로 두 사람 사이에서 반복될 수 있는 갈등 패턴 3가지를 구체적으로 묘사하세요: ① 돈·이성·기회를 둘러싼 경쟁 패턴, ② 가치관·생활방식 차이에서 오는 마찰, ③ 서로에 대한 기대 불일치. 각 패턴마다 어떤 상황에서 터지는지 + 처방 1문장. 이 우정이 절대 하면 안 되는 금기 행동 1가지를 경고로 제시하세요.

▶ 우정이 빛나는 순간 (280~360자)
이 두 사람이 함께할 때 가장 빛나는 구체적 상황 3가지를 묘사하세요. 위기 때 서로를 지켜주는 장면, 축하할 때 함께하는 모습, 아무 말 없이도 편한 순간을 오행·십성 근거로 설명하세요.

▶ 함께 성장하는 방법 (300~380자)
두 사람이 함께할 때 시너지가 나는 분야와 활동을 구체적으로 서술하세요. 서로의 용신 방향이 같다면 함께 성장하는 방향과 목표를 제시, 다르다면 각자의 강점이 서로를 어떻게 보완하는지 2가지 장면으로. 우정이 더 깊어지는 핵심 비결 3가지: 소통 방식, 만남의 빈도, 서로의 영역 존중 방법을 각각 서술하세요.

▶ 이 우정의 미래 (260~340자)
세월이 흐를수록 이 우정이 어떻게 변하는지 예측하세요. 20대·30대·40대 각 시기에 이 우정의 의미가 어떻게 달라지는지. 인생의 전환점(결혼·이직·위기)에서 이 친구의 역할을 서술. 이 우정의 내구성을 한 문장으로 선언하세요.

▶ 오래가는 우정을 위한 처방 (280~360자)
이 두 사람의 우정이 오래 유지되려면: 1) 절대 피해야 할 상황·행동 2가지(명리 근거), 2) 함께 하면 운이 오르는 활동·장소(용신 오행 기반) 2가지, 3) 이 우정에서 서로가 반드시 지켜야 할 원칙 1가지, 4) 10년 후에도 이 우정이 유지되는 이유 — 명리 구조상 이 관계가 가진 내구성을 한 문장으로 선언.

`;
};

// ─────────────────────────────────────────────
// 가족(부모자식) 궁합
// ─────────────────────────────────────────────
export const generateFamilyGunghapPrompt = (
  me: SajuResult, other: SajuResult,
  myName: string, otherName: string,
  relation: string // '부모-자녀', '형제자매', '조부모-손자'
): string => {
  const myEl = me.pillars.day.ganElement;
  const otherEl = other.pillars.day.ganElement;
  const elRel = twoPersonElRelation(myEl, otherEl);

  // 년주(조상·뿌리) 연결
  const yearRel = twoPersonElRelation(me.pillars.year.ganElement, other.pillars.year.ganElement);

  // 부모자식 관계에서의 십성 분석
  // 부모 입장: 자녀 = 남자는 관성, 여자는 식상
  // 자녀 입장: 부모 = 인성
  const parentChildAnalysis = (() => {
    const myCounts = computeSipseongCounts(me);
    const otherCounts = computeSipseongCounts(other);
    const myInseong = (myCounts['정인'] || 0) + (myCounts['편인'] || 0);
    const otherInseong = (otherCounts['정인'] || 0) + (otherCounts['편인'] || 0);
    return `${myName} 인성: ${myInseong}개 / ${otherName} 인성: ${otherInseong}개`;
  })();

  // 오행 세대 흐름
  const generationFlow = EL_GEN[myEl] === otherEl
    ? `${myEl}→${otherEl} 상생 흐름 — 윗 세대가 아랫 세대 에너지를 기름`
    : EL_GEN[otherEl] === myEl
    ? `${otherEl}→${myEl} 상생 흐름 — 아랫 세대 오행이 윗 세대를 보완`
    : elRel;

  const crossInteractions = buildCrossJiziInteractions(me, other, myName, otherName);

  return `당신은 사주명리 전문가입니다. 두 사람의 가족 궁합(${relation})을 아래 10개 섹션으로 풀이하세요.

[절대 규칙]
- Markdown·이모지 금지. 섹션 제목은 "▶ 제목" 형식으로만.
- 수치·판정 변경 금지. 흐린 표현 2회 이하. 각 섹션 본문은 2~3문단으로 나누고 문단 사이 빈 줄 필수.
- ★ 각 ▶ 섹션의 첫 줄은 반드시 은유 부제목(7~20자)만 단독 한 줄 출력. 마침표·'다/요/니다' 종결·'두 사람' 시작·명리 용어(오행/천간/지지)·숫자 시작 모두 금지. 명사구·체언 종결만 허용. 예: "잔잔한 호수 위의 첫눈" / "바람에 실려 온 불씨". 본문은 반드시 다음 줄부터.
- 출력은 첫 줄에 관계를 상징하는 은유 제목(7~14자)으로 시작. 대괄호·섹션 태그·식별자는 절대 출력하지 말 것. 총 분량: 3,800~4,800자.
- 모든 분석은 반드시 제공된 사주 데이터를 근거로 서술. 추상적·일반론 금지. 구체적 글자(천간·지지)와 오행 관계를 인용할 것.

[${myName} 사주]
${buildPersonBlock(me, myName)}

[${otherName} 사주]
${buildPersonBlock(other, otherName)}

▶ 관계 유형: ${relation}

▶ 일간 오행 관계 (세대 흐름)
${generationFlow}

▶ 두 사람 지지 합·충
${crossInteractions}

▶ 인성 분포
${parentChildAnalysis}

▶ 신강신약
${myName}: ${me.strengthStatus} / ${otherName}: ${other.strengthStatus}

${GUNGHAP_RELATION_KB}
${FAMILY_KB}
${METAPHOR_KB}
${METAPHOR_TITLE_RULE}
${GUNGHAP_SECTION_FORMAT}

[작성 지침 — 아래 10개 섹션을 순서대로 작성하세요]

▶ 핵심 요약 (280~360자)
${relation} 관계의 오행 세대 흐름(${generationFlow})으로 이 가족 관계를 한마디로 선언. "이 두 사람은 ~한 가족이다"로 시작. 지지 합충 결과와 인성 분포를 종합해 이 가족 관계의 핵심 색깔을 묘사. 키워드 3개.

▶ 이 가족 관계의 명리 구조 (260~340자)
${relation} 관계에서 오행 세대 흐름(${generationFlow})이 어떤 가족 역학을 만드는지 서술하세요. 지지 합 결과(${crossInteractions})가 있다면 이 가족 관계의 특별한 연결 고리로 활용. "이 두 사람이 한 가족인 명리적 이유"를 따뜻하게 풀어내세요.

▶ 각자의 역할과 에너지 (260~340자)
신강신약 조합을 근거로 두 사람의 에너지 역할("누가 이끌고 누가 따르는지", "누가 더 보호하고 누가 더 의지하는지")을 ${relation} 상황에 맞게 묘사하세요. 인성 분포(${parentChildAnalysis})로 돌봄 에너지의 방향도 분석하세요.

▶ 오행 상보 관계 (260~340자)
두 사람의 오행 분포를 비교해 가족 안에서 서로가 어떤 에너지를 보충하는지 서술. 윗세대와 아랫세대가 서로에게 채워주는 오행을 실생활 장면으로 묘사하세요.

▶ 세대 간 에너지 흐름 (260~340자)
년주(조상)와 일주(본인)의 연결로 세대 간 에너지가 어떻게 이어지는지 분석. 가풍·가치관·습관 중 사주 구조에서 전승되는 것과 충돌하는 것을 각각 서술하세요.

▶ 갈등과 오해 패턴 (280~360자)
이 가족 관계에서 반복될 수 있는 갈등 패턴 2가지를 구체 장면으로 묘사하세요. "세대 차이"나 "기대의 차이"가 명리 구조상 어떻게 생겨나는지 설명. 충 관계(${crossInteractions})가 있다면 갈등의 명리적 근거로 활용. 각 패턴마다 처방 1문장.

▶ 서로의 속마음 (260~340자)
가족이라 오히려 말 못 하는 것을 십성·신강신약 구조로 분석. 각자가 상대에게 진짜 바라는 것을 1인칭 화법으로 대변. "겉으로는 ~하지만 속으로는 ~"의 구조로.

▶ 서로에게 주는 선물 (280~360자)
이 가족 관계에서 두 사람이 서로에게 자연스럽게 주는 것을 오행 보완 구조로 서술하세요. "윗세대가 아랫세대에게, 또는 아랫세대가 윗세대에게 채워주는 것"을 구체적으로 묘사. 이 가족 관계가 가진 가장 아름다운 측면을 부각하세요.

▶ 가족의 미래 전망 (260~340자)
시간이 흐르면서 이 가족 관계가 어떻게 깊어지는지 예측. 인생의 전환점(독립·결혼·노후)에서 서로의 역할 변화를 서술. 이 가족 관계의 내구성을 한 문장으로.

▶ 관계를 더 깊게 하는 처방 (260~340자)
이 가족 관계를 더 따뜻하게 유지하기 위한 실용 처방 3가지: 1) 함께하면 좋은 활동, 2) 갈등이 생겼을 때 화해 방법, 3) 이 관계가 앞으로 더 강해지는 시기나 계기.

`;
};

// ─────────────────────────────────────────────
// 직장동료 궁합
// ─────────────────────────────────────────────
export const generateWorkGunghapPrompt = (
  me: SajuResult, other: SajuResult,
  myName: string, otherName: string
): string => {
  const myEl = me.pillars.day.ganElement;
  const otherEl = other.pillars.day.ganElement;
  const elRel = twoPersonElRelation(myEl, otherEl);

  // 관성·식상 비교 (업무 스타일)
  const myCounts = computeSipseongCounts(me);
  const otherCounts = computeSipseongCounts(other);
  const myGwan = (myCounts['정관'] || 0) + (myCounts['편관'] || 0);
  const otherGwan = (otherCounts['정관'] || 0) + (otherCounts['편관'] || 0);
  const mySiksang = (myCounts['식신'] || 0) + (myCounts['상관'] || 0);
  const otherSiksang = (otherCounts['식신'] || 0) + (otherCounts['상관'] || 0);

  const workStyleA = myGwan >= 2 ? '규칙·체계 중심형' : mySiksang >= 2 ? '아이디어·표현 주도형' : '유연 협력형';
  const workStyleB = otherGwan >= 2 ? '규칙·체계 중심형' : otherSiksang >= 2 ? '아이디어·표현 주도형' : '유연 협력형';

  // 격국 보완 (업무 역할 분담)
  const complementRoles = workStyleA === workStyleB
    ? '동일 스타일 — 같은 업무 방식, 협업 부드럽지만 맹점 공유'
    : `${workStyleA} + ${workStyleB} 조합 — 역할 분담 명확, 서로 보완 가능`;

  const crossInteractions = buildCrossJiziInteractions(me, other, myName, otherName);

  return `당신은 사주명리 전문가입니다. 두 사람의 직장동료 궁합을 아래 10개 섹션으로 풀이하세요.

[절대 규칙]
- Markdown·이모지 금지. 섹션 제목은 "▶ 제목" 형식으로만.
- 수치·판정 변경 금지. 흐린 표현 2회 이하. 각 섹션 본문은 2~3문단으로 나누고 문단 사이 빈 줄 필수.
- ★ 각 ▶ 섹션의 첫 줄은 반드시 은유 부제목(7~20자)만 단독 한 줄 출력. 마침표·'다/요/니다' 종결·'두 사람' 시작·명리 용어(오행/천간/지지)·숫자 시작 모두 금지. 명사구·체언 종결만 허용. 예: "잔잔한 호수 위의 첫눈" / "바람에 실려 온 불씨". 본문은 반드시 다음 줄부터.
- 모든 분석은 반드시 제공된 사주 데이터를 근거로 서술. 추상적·일반론 금지. 구체적 글자(천간·지지)와 오행 관계를 인용할 것.
- 출력은 첫 줄에 관계를 상징하는 은유 제목(7~14자)으로 시작. 대괄호·섹션 태그·식별자는 절대 출력하지 말 것. 총 분량: 3,800~4,800자.

[${myName} 사주]
${buildPersonBlock(me, myName)}

[${otherName} 사주]
${buildPersonBlock(other, otherName)}

▶ 일간 오행 관계
${elRel}

▶ 두 사람 지지 합·충
${crossInteractions}

▶ 업무 스타일
${myName}: 관성 ${myGwan}개·식상 ${mySiksang}개 → ${workStyleA}
${otherName}: 관성 ${otherGwan}개·식상 ${otherSiksang}개 → ${workStyleB}
조합: ${complementRoles}

▶ 신강신약 (주도권)
${myName}: ${me.strengthStatus} / ${otherName}: ${other.strengthStatus}

▶ 용신·기신 충돌
${me.yongSinElement === other.giSin ? `${myName} 용신이 ${otherName} 기신 — 장기 협업 시 에너지 소진 주의` : '용신·기신 충돌 없음 — 에너지 상충 없음'}

${GUNGHAP_RELATION_KB}
${WORK_KB}
${METAPHOR_KB}
${METAPHOR_TITLE_RULE}
${GUNGHAP_SECTION_FORMAT}

[작성 지침 — 아래 10개 섹션을 순서대로 작성하세요]

▶ 핵심 요약 (280~360자)
일간 오행 관계(${elRel})와 업무 스타일 조합(${complementRoles})으로 이 동료 관계를 한마디로 선언. "이 두 사람은 ~한 동료다"로 시작. 신강신약 조합에서 주도권 역학, 용신·기신 충돌 여부를 종합. 키워드 3개.

▶ 업무 에너지 구조 (260~340자)
일간 오행 관계(${elRel})를 근거로 두 사람이 함께 일할 때의 에너지 흐름을 묘사하세요. "누가 방향을 잡고 누가 실행하는지", "업무 현장에서 어떤 역학이 작동하는지" 구체적으로 서술. 지지 합 결과(${crossInteractions})가 있다면 이 관계의 시너지 근거로 활용.

▶ 각자의 업무 스타일과 시너지 (280~360자)
업무 스타일 분석(${workStyleA} + ${workStyleB})을 근거로 두 사람이 프로젝트에서 어떻게 역할 분담하는지 서술하세요. 서로의 강점이 만나는 장면("이런 상황에서 두 사람은 최고의 팀이 된다")을 2가지 묘사. 함께하면 더 빠르게 성과를 내는 분야를 명시하세요.

▶ 의사소통 패턴 (260~340자)
십성 분포(식상·인성·관성)를 근거로 두 사람의 소통 방식을 분석하세요. "보고 스타일", "피드백 주고받는 방식", "의견 충돌 시 각자의 반응"을 구체적 업무 장면으로. 원활한 소통을 위한 핵심 비결 1가지.

▶ 서로의 숨은 능력 (260~340자)
겉으로 드러나지 않지만 상대가 가진 업무 강점을 오행·십성으로 분석. ${myName}이 모르는 ${otherName}의 잠재력, 반대도 마찬가지. 이 능력을 끌어내는 방법 각각 1가지씩.

▶ 갈등·마찰 포인트 (280~360자)
업무 현장에서 반복될 수 있는 갈등 패턴 2~3가지를 구체 장면으로 묘사하세요. 회의·의사결정·마감·평가 상황에서 충돌할 수 있는 지점을 명리 근거로 설명. 갈등이 생겼을 때 빠르게 해소하는 처방 1가지씩.

▶ 성과 극대화 시기 (260~340자)
두 사람이 함께할 때 최고의 성과가 나오는 상황(프로젝트 유형·업무 단계·시간대)을 명리 구조로 분석. 반대로 함께 피해야 할 업무 상황도 서술하세요.

▶ 협업 극대화 전략 (280~360자)
두 사람이 함께 일할 때 최대 시너지를 내는 업무 분담 방식을 제시하세요. "이 사람은 이런 일을, 저 사람은 저런 일을"처럼 구체적 역할 제안. 함께 피해야 할 업무 상황과 서로를 지치지 않게 하는 소통 방법도 포함.

▶ 장기 파트너십 전망 (260~340자)
이 동료 관계가 오래 유지됐을 때 어떤 시너지가 누적되는지 예측. 함께 성장할 수 있는 방향, 조직 내에서 두 사람이 만드는 팀의 가치를 서술. 이 파트너십의 최종 가치를 한 문장으로.

▶ 직장 관계 처방 (260~340자)
이 두 사람이 좋은 동료 관계를 유지하기 위한 실용 처방 3가지: 1) 회의·협업 시 지켜야 할 원칙, 2) 서로의 에너지를 살리는 업무 방식, 3) 이 파트너십이 가진 가장 큰 직업적 가치.

`;
};

// ─────────────────────────────────────────────
// 범용 인간관계 궁합
// ─────────────────────────────────────────────
export const generateGeneralGunghapPrompt = (
  me: SajuResult, other: SajuResult,
  myName: string, otherName: string,
  relationLabel: string
): string => {
  const myEl = me.pillars.day.ganElement;
  const otherEl = other.pillars.day.ganElement;
  const elRel = twoPersonElRelation(myEl, otherEl);
  const eumYangHap = checkEumYangHap(me.pillars.day.zhi, other.pillars.day.zhi);

  const crossInteractions = buildCrossJiziInteractions(me, other, myName, otherName);
  const ohaengCompare = buildOhaengCompare(me, other, myName, otherName);
  const sipseongCompare = buildGunghapSipseong(me, other, myName, otherName);

  return `당신은 사주명리 전문가입니다. 두 사람의 ${relationLabel} 관계 궁합을 아래 10개 섹션으로 풀이하세요.

[절대 규칙]
- Markdown·이모지 금지. 섹션 제목은 "▶ 제목" 형식으로만.
- 수치·판정 변경 금지. 흐린 표현 2회 이하. 각 섹션 본문은 2~3문단으로 나누고 문단 사이 빈 줄 필수.
- ★ 각 ▶ 섹션의 첫 줄은 반드시 은유 부제목(7~20자)만 단독 한 줄 출력. 마침표·'다/요/니다' 종결·'두 사람' 시작·명리 용어(오행/천간/지지)·숫자 시작 모두 금지. 명사구·체언 종결만 허용. 예: "잔잔한 호수 위의 첫눈" / "바람에 실려 온 불씨". 본문은 반드시 다음 줄부터.
- 모든 분석은 반드시 제공된 사주 데이터를 근거로 서술. 추상적·일반론 금지. 구체적 글자(천간·지지)와 오행 관계를 인용할 것.
- 재미·흥미 위주 관계라면 가볍고 유쾌한 톤으로 서술 가능.
- 출력은 첫 줄에 관계를 상징하는 은유 제목(7~14자)으로 시작. 대괄호·섹션 태그·식별자는 절대 출력하지 말 것. 총 분량: 3,800~4,800자.

[${myName} 사주]
${buildPersonBlock(me, myName)}

[${otherName} 사주]
${buildPersonBlock(other, otherName)}

▶ 일간 오행 관계
${elRel}

▶ 일지 음양합
${eumYangHap}

▶ 두 사람 지지 합·충
${crossInteractions}

▶ 오행 분포 비교
${ohaengCompare}

▶ 십성 분포 비교
${sipseongCompare}

▶ 용신·기신 에너지
${myName} 용신(${me.yongSinElement}) vs ${otherName} 기신(${other.giSin}): ${me.yongSinElement === other.giSin ? '충돌 주의' : '충돌 없음'}

${GUNGHAP_RELATION_KB}
${METAPHOR_KB}
${METAPHOR_TITLE_RULE}
${GUNGHAP_SECTION_FORMAT}

[작성 지침 — 아래 10개 섹션을 순서대로 작성하세요]

▶ 핵심 요약 (280~360자)
일간 오행 관계(${elRel})와 일지 음양합(${eumYangHap})으로 이 ${relationLabel} 관계를 한마디로 선언. 지지 합충 결과(${crossInteractions})와 용신·기신 에너지를 종합해 관계의 전체 색깔을 묘사. 핵심 키워드 3개.

▶ 이 관계의 에너지 구조 (260~340자)
일간 오행 관계(${elRel})를 근거로 두 사람이 ${relationLabel}로서 함께할 때의 에너지 흐름을 묘사하세요. 지지 합 결과(${crossInteractions})가 있다면 이 관계의 특별한 연결 고리로 활용. "두 사람이 함께 있을 때 어떤 시너지가 나는지" 구체적으로 서술하세요.

▶ 오행 상보 관계 (260~340자)
두 사람의 오행 분포를 비교해 서로가 어떤 에너지를 채워주는지 서술. 결핍 오행 상호보완이 있다면 실생활 장면으로 묘사. 함께할 때 강해지는 오행과 과잉 위험도.

▶ 서로가 주고받는 것 (280~360자)
오행 분포 비교와 십성 분포(${sipseongCompare})를 근거로 두 사람이 이 관계에서 자연스럽게 주고받는 에너지를 서술하세요. "${myName}이 ${otherName}에게 주는 것"과 "${otherName}이 ${myName}에게 주는 것"을 각각 구체적으로 묘사. 함께 있을 때 더 강해지는 것과 주의해야 할 에너지 과잉도 언급하세요.

▶ 서로의 속마음 (260~340자)
각자가 상대에게 말 못 하는 것을 십성 구조로 분석. 1인칭 화법으로 대변. 오해하기 쉬운 행동 패턴 1가지씩 설명.

▶ 마찰과 주의 포인트 (260~340자)
지지 충·용신 기신 충돌 구조를 근거로 이 관계에서 마찰이 생길 수 있는 포인트 2가지를 서술하세요. 각 마찰 포인트마다 간단한 처방 1문장. 재미 관계라면 유쾌하게 서술 가능.

▶ 관계의 숨은 면 (260~340자)
겉으로 보이는 관계와 실제 에너지 역학의 차이를 분석. "겉으로는 ~한 관계지만 실제로는 ~한 에너지가 흐른다"를 명리 구조로 풀어주세요.

▶ 함께하면 빛나는 순간 (260~340자)
이 두 사람이 함께할 때 가장 시너지가 나는 상황 3가지를 구체적으로 묘사. 오행 보완과 지지 합 구조가 만드는 최고의 순간들.

▶ 이 관계의 미래 (260~340자)
시간이 흐를수록 이 관계가 어떻게 변하는지 예측. 더 깊어지는 면과 주의해야 할 면을 각각 서술. 이 관계의 장기적 가치를 한 문장으로.

▶ 이 관계를 더 좋게 만드는 처방 (260~340자)
두 사람이 더 즐겁고 풍요로운 ${relationLabel} 관계를 유지하기 위한 처방 3가지: 1) 함께하면 좋은 활동, 2) 피해야 할 상황, 3) 이 관계가 가진 가장 유쾌한 가능성 한 문장.

`;
};

// ─────────────────────────────────────────────
// 역할 컨텍스트 삽입 헬퍼
// ─────────────────────────────────────────────
/**
 * 직원 피드백: "관계 입력 기능이 실제 해석에 반영되지 않는 것 같다"
 * → 역할 정보를 단순 명시만 하지 않고, 본문에서 명시적으로 호명·활용하도록 강제 룰 추가.
 */
export function injectRoleContext(
  prompt: string,
  myName: string, myRole: string,
  otherName: string, otherRole: string
): string {
  if (!myRole.trim() && !otherRole.trim()) return prompt;
  const block = `\n▶ 두 사람의 역할 (이 역할 맥락을 반영하여 분석)
${myName}: ${myRole.trim() || '미지정'} / ${otherName}: ${otherRole.trim() || '미지정'}

[역할 활용 강제 규칙]
- 본문 첫 단락 또는 핵심 요약 섹션에서 두 사람의 역할(${myRole.trim() || '미지정'} / ${otherRole.trim() || '미지정'})을 반드시 한 번 이상 명시 인용한다.
- 갈등·마찰 섹션, 처방·개운 섹션에서 역할 차이가 어떻게 작용하는지 구체 장면으로 짚는다.
- 역할이 "미지정"이면 그 사람에 대한 역할 언급은 생략하되, 미지정 자체를 "역할이 정해지지 않은 관계"로 해석에 반영한다.

`;
  // 모든 gunghap 프롬프트는 '[작성 지침 — ...]' 또는 '[작성 지침]' 둘 중 하나로 시작.
  // 부분 일치(라인 시작) 로 찾아 그 라인 직전에 block 삽입 — 14개 프롬프트 모두 호환.
  // (이전 정확 일치 replace 는 '[작성 지침 — ...]' 형태와 매치 실패하여 한 번도 작동하지 않았음 — 회귀 fix)
  const lines = prompt.split('\n');
  const insertIdx = lines.findIndex((ln) => ln.startsWith('[작성 지침'));
  if (insertIdx === -1) {
    // fallback — 매치 실패 시 프롬프트 끝에 추가 (전혀 안 들어가는 것보단 낫다)
    return prompt + block;
  }
  lines.splice(insertIdx, 0, block);
  return lines.join('\n');
}

// ─────────────────────────────────────────────
// 썸남/썸녀 궁합
// ─────────────────────────────────────────────
export const generateSomGunghapPrompt = (
  me: SajuResult, other: SajuResult,
  myName: string, otherName: string
): string => {
  const myEl = me.pillars.day.ganElement;
  const otherEl = other.pillars.day.ganElement;
  const elRel = twoPersonElRelation(myEl, otherEl);
  const eumYangHap = checkEumYangHap(me.pillars.day.zhi, other.pillars.day.zhi);

  const attractionCheck = (() => {
    const male = me.gender === 'male' ? me : other;
    const female = me.gender === 'male' ? other : me;
    const maleName = me.gender === 'male' ? myName : otherName;
    const femaleName = me.gender === 'male' ? otherName : myName;
    const maleJaeEl = EL_CON[male.pillars.day.ganElement] || '';
    return maleJaeEl === female.pillars.day.ganElement
      ? `${maleName}의 재성 오행(${maleJaeEl})이 ${femaleName}의 일간 — 본능적 끌림 강함`
      : `재성 오행 불일치(재성 ${maleJaeEl} vs ${femaleName} ${female.pillars.day.ganElement}) — 감성으로 연결되는 인연`;
  })();

  const developmentCheck = me.yongSinElement === otherEl
    ? `${otherName}의 일간(${otherEl})이 ${myName}의 용신 — 만날수록 에너지 충전, 발전 가능성 높음`
    : other.yongSinElement === myEl
    ? `${myName}의 일간(${myEl})이 ${otherName}의 용신 — 상대도 나를 필요로 하는 관계`
    : '용신 직접 충족 없음 — 감정의 기복과 설렘의 지속성 점검 필요';

  const crossInteractions = buildCrossJiziInteractions(me, other, myName, otherName);
  const ohaengCompare = buildOhaengCompare(me, other, myName, otherName);

  return `당신은 사주명리 전문가입니다. 두 사람의 썸 관계 궁합을 아래 10개 섹션으로 풀이하세요.

[절대 규칙]
- Markdown·이모지 금지. 섹션 제목은 "▶ 제목" 형식으로만.
- 모든 분석은 반드시 제공된 사주 데이터를 근거로 서술. 추상적·일반론 금지. 구체적 글자(천간·지지)와 오행 관계를 인용할 것.
- 수치·판정 변경 금지. 흐린 표현 2회 이하. 각 섹션 본문은 2~3문단으로 나누고 문단 사이 빈 줄 필수.
- ★ 각 ▶ 섹션의 첫 줄은 반드시 은유 부제목(7~20자)만 단독 한 줄 출력. 마침표·'다/요/니다' 종결·'두 사람' 시작·명리 용어(오행/천간/지지)·숫자 시작 모두 금지. 명사구·체언 종결만 허용. 예: "잔잔한 호수 위의 첫눈" / "바람에 실려 온 불씨". 본문은 반드시 다음 줄부터.
- 출력은 첫 줄에 관계를 상징하는 은유 제목(7~14자)으로 시작. 대괄호·섹션 태그·식별자는 절대 출력하지 말 것. 총 분량: 3,800~4,800자.

[${myName} 사주]
${buildPersonBlock(me, myName)}

[${otherName} 사주]
${buildPersonBlock(other, otherName)}

▶ 일간 오행 관계
${elRel}

▶ 일지 음양합
${eumYangHap}

▶ 두 사람 지지 합·충
${crossInteractions}

▶ 오행 분포 비교
${ohaengCompare}

▶ 초기 끌림 분석
${attractionCheck}

▶ 관계 발전 가능성
${developmentCheck}

${GUNGHAP_RELATION_KB}
${SOM_KB}
${METAPHOR_KB}
${METAPHOR_TITLE_RULE}
${GUNGHAP_SECTION_FORMAT}

[작성 지침 — 아래 10개 섹션을 순서대로 작성하세요]

▶ 핵심 요약 (300~380자)
일간 오행 관계와 끌림 분석(${attractionCheck})으로 이 썸의 구조를 한마디로 선언. "이 두 사람 사이에 흐르는 감정의 정체"를 규정. 일지 음양합(${eumYangHap})과 발전 가능성(${developmentCheck})을 종합해 이 썸의 현재 온도와 방향을 판정. 핵심 키워드 3개.

▶ 이 설렘의 정체 (300~380자)
일지 음양합(${eumYangHap})과 끌림 분석(${attractionCheck})으로 두 사람 사이 설렘의 명리적 근거를 서술하세요. "왜 이 사람이 유독 신경 쓰이는지" 오행·지지합 구조로 설명. 이 끌림이 ① 일지 합 기반(본능적/무의식적 당김)인지, ② 용신 충족 기반(에너지 보충형)인지, ③ 배우자성 기반(이성 인식)인지 구분 서술. "처음 의식하게 된 순간"을 상상해서 장면으로 묘사하세요. 이 감정이 일시적 호기심인지, 진짜 인연의 시작인지 명리 구조로 판단.

▶ 오행 상보 관계 (280~360자)
두 사람의 오행 분포(${ohaengCompare})를 비교해 서로에게 끌리는 에너지적 이유를 서술. ${myName}에게 부족한 오행을 ${otherName}이 가지고 있다면 "이 사람 옆에 있으면 괜히 편한 이유"로. 반대도 마찬가지. 이 에너지 보완이 썸 단계에서 어떻게 작동하는지 2가지 장면으로.

▶ 상대방이 나를 보는 시선 (320~400자)
상대방의 십성 분포로 ${myName}이 ${otherName}에게 어떻게 보이는지 심층 분석하세요. 재성·관성으로 "상대가 나를 이성으로 인식하는지" 판단. ${otherName}의 사주에서 배우자성 오행이 무엇이고, ${myName}이 그 오행에 해당하는지 명확히 서술. 상대방이 마음이 열릴 때 보이는 구체적 행동 신호 3가지 제시("연락 빈도가 ~해진다", "이런 주제의 대화를 꺼낸다", "이런 리액션을 한다"). 현재 ${otherName}의 관심도를 높음/보통/낮음으로 판정.

▶ 감정의 온도차 (280~360자)
두 사람 사이 감정 온도의 차이를 십성·신강신약 구조로 분석. "누가 더 적극적이고 누가 더 조심스러운지", "감정 표현 속도의 차이"를 명리 근거로 서술. 이 온도차가 썸을 더 설레게 하는 면과 불안하게 하는 면을 각각 묘사. 온도차를 좁히는 핵심 행동 1가지.

▶ 연애로 발전할 가능성 (320~400자)
관계 발전 가능성(${developmentCheck})과 지지 합충 구조(${crossInteractions})를 근거로 썸이 연애로 이어질 명리적 근거와 장애물을 모두 서술하세요. 긍정 요인(합·용신 충족·배우자성 일치)과 부정 요인(충·기신 충돌·배우자성 불일치)을 각각 나열 후, 종합 발전 가능성을 높음/보통/낮음으로 명확히 판정. "발전하려면 구체적으로 무엇이 필요한지" 3가지 조건 제시. 보통 어느 정도 기간(만남 횟수)이 필요한지 예측.

▶ 데이트 케미 (280~360자)
두 사람이 함께할 때 케미가 터지는 구체적 데이트 상황 3가지를 용신 오행과 지지 합 기반으로 추천. "이런 장소에서 이런 활동을 하면 두 사람 사이 에너지가 폭발한다"는 식으로 구체적으로. 반대로 어색해지는 데이트 상황 1가지도.

▶ 썸 단계의 주의사항 (300~380자)
이 두 사람의 오행·충 구조에서 썸이 끝나버리는 전형적 패턴을 3가지 서술하세요. 각 패턴을 "이런 상황에서 이런 행동을 하면 → 상대는 이렇게 느끼고 → 멀어진다"의 구조로 구체적으로 묘사. 특히 ${myName}의 사주 구조에서 무의식적으로 나오기 쉬운 실수 1가지를 경고. 반대로 "이렇게 하면 상대 마음이 열린다"는 처방도 각각 2가지씩 — 용신 오행 환경을 활용한 데이트 전략으로 제시하세요.

▶ 이 감정의 미래 (280~360자)
이 썸이 발전했을 때 어떤 커플이 되는지, 발전하지 못했을 때 남는 것은 무엇인지 명리 구조로 예측. 연인으로 발전할 경우의 관계 특성 2가지, 친구로 남을 경우의 역학 1가지를 서술. 이 감정의 최종 가치를 한 문장으로.

▶ 고백 타이밍과 개운법 (280~360자)
현재 사주 구조에서 고백하기 좋은 상황과 절대 피해야 할 타이밍을 각각 서술하세요. 좋은 타이밍의 조건(장소·분위기·두 사람의 에너지 상태), 피해야 할 타이밍의 이유(기신 활성화·충 에너지). 두 사람이 함께하면 좋은 데이트 장소나 활동(용신 오행 기반) 3가지를 구체적으로 추천. 상대의 마음을 여는 구체적 행동 처방 3가지("이런 말을 해라", "이런 선물을 해라", "이런 장소에서 만나라")로 마무리.

`;
};

// ─────────────────────────────────────────────
// 배우자 궁합
// ─────────────────────────────────────────────
export const generateSpouseGunghapPrompt = (
  me: SajuResult, other: SajuResult,
  myName: string, otherName: string
): string => {
  const myEl = me.pillars.day.ganElement;
  const otherEl = other.pillars.day.ganElement;
  const elRel = twoPersonElRelation(myEl, otherEl);
  const eumYangHap = checkEumYangHap(me.pillars.day.zhi, other.pillars.day.zhi);

  const householdRole = me.isStrong && !other.isStrong
    ? `${myName}(신강) 주도 + ${otherName}(신약) 지지 — 의사결정 역할 명확`
    : !me.isStrong && other.isStrong
    ? `${otherName}(신강) 주도 + ${myName}(신약) 지지 — 역할 분담 자연스러움`
    : me.isStrong && other.isStrong
    ? '두 사람 모두 신강 — 주도권 마찰 주의, 각자 영역 분담 필요'
    : '두 사람 모두 신약 — 상호 의존 깊음, 외부 지원 함께 구하는 구조';

  const myCounts = computeSipseongCounts(me);
  const otherCounts = computeSipseongCounts(other);
  const myJaeseong = (myCounts['정재'] || 0) + (myCounts['편재'] || 0);
  const otherJaeseong = (otherCounts['정재'] || 0) + (otherCounts['편재'] || 0);
  const financeCheck = myJaeseong + otherJaeseong >= 4
    ? '두 사람 재성 합산 4개 이상 — 재물 집착 주의, 소비 방식 합의 필요'
    : myJaeseong + otherJaeseong === 0
    ? '재성 희박 — 경제 관리 의식적으로 체계화 필요'
    : '재성 균형 — 현실적 경제 감각을 공유하는 가정 꾸리기 가능';

  const crossInteractions = buildCrossJiziInteractions(me, other, myName, otherName);
  const sipseongCompare = buildGunghapSipseong(me, other, myName, otherName);
  const ohaengCompare = buildOhaengCompare(me, other, myName, otherName);

  // 자녀 궁합 (식신/상관 여성, 관성 남성)
  const myCounts2 = computeSipseongCounts(me);
  const otherCounts2 = computeSipseongCounts(other);
  const childStar = (() => {
    const female = me.gender === 'female' ? me : other;
    const femaleName = me.gender === 'female' ? myName : otherName;
    const male = me.gender === 'male' ? me : other;
    const maleName = me.gender === 'male' ? myName : otherName;
    const fCounts = computeSipseongCounts(female);
    const mCounts = computeSipseongCounts(male);
    const fSiksang = (fCounts['식신'] || 0) + (fCounts['상관'] || 0);
    const mGwan = (mCounts['정관'] || 0) + (mCounts['편관'] || 0);
    return `${femaleName} 식상(자녀성): ${fSiksang.toFixed(1)}개 / ${maleName} 관성(자녀성): ${mGwan.toFixed(1)}개`;
  })();

  return `당신은 사주명리 전문가입니다. 두 사람의 배우자 궁합을 아래 10개 섹션으로 풀이하세요.

[절대 규칙]
- 모든 분석은 반드시 제공된 사주 데이터를 근거로 서술. 추상적·일반론 금지. 구체적 글자(천간·지지)와 오행 관계를 인용할 것.
- Markdown·이모지 금지. 섹션 제목은 "▶ 제목" 형식으로만.
- 수치·판정 변경 금지. 흐린 표현 2회 이하. 각 섹션 본문은 2~3문단으로 나누고 문단 사이 빈 줄 필수.
- ★ 각 ▶ 섹션의 첫 줄은 반드시 은유 부제목(7~20자)만 단독 한 줄 출력. 마침표·'다/요/니다' 종결·'두 사람' 시작·명리 용어(오행/천간/지지)·숫자 시작 모두 금지. 명사구·체언 종결만 허용. 예: "잔잔한 호수 위의 첫눈" / "바람에 실려 온 불씨". 본문은 반드시 다음 줄부터.
- 출력은 첫 줄에 관계를 상징하는 은유 제목(7~14자)으로 시작. 대괄호·섹션 태그·식별자는 절대 출력하지 말 것. 총 분량: 3,800~4,800자.

[${myName} 사주]
${buildPersonBlock(me, myName)}

[${otherName} 사주]
${buildPersonBlock(other, otherName)}

▶ 일간 오행 관계
${elRel}

▶ 일지 음양합
${eumYangHap}

▶ 두 사람 지지 합·충·형
${crossInteractions}

▶ 오행 분포 비교
${ohaengCompare}

▶ 십성 분포 비교
${sipseongCompare}

▶ 가정 내 역할 분담
${householdRole}

▶ 경제 궁합
${myName} 재성: ${myJaeseong}개 / ${otherName} 재성: ${otherJaeseong}개 → ${financeCheck}

▶ 자녀 궁합
${childStar}

▶ 용신·기신 충돌
${myName} 용신(${me.yongSinElement}) vs ${otherName} 기신(${other.giSin}): ${me.yongSinElement === other.giSin ? '충돌 — 장기 에너지 소진 주의' : '충돌 없음'}

${GUNGHAP_RELATION_KB}
${SPOUSE_KB}
${METAPHOR_KB}
${METAPHOR_TITLE_RULE}
${GUNGHAP_SECTION_FORMAT}

[작성 지침 — 아래 10개 섹션을 순서대로 빠짐없이 작성하세요]

▶ 핵심 요약 (220~280자)
두 일간 오행 관계(${elRel})와 일지 음양합(${eumYangHap})으로 이 부부의 관계 구조를 한마디로 선언하세요. "이 두 사람은 ~한 부부다"로 시작. 함께 사는 삶의 전체적 색깔을 자연 현상에 비유해 생생하게 묘사. 배우자성 오행 대응 여부로 명리적 배우자 인연 강도를 판정. 핵심 키워드 3개.

▶ 공명과 유대 (280~360자)
지지 합·삼합(${crossInteractions})과 일간 관계를 근거로 두 사람이 처음 끌렸던 이유와 오랫동안 함께할 수 있는 명리적 근거를 서술. "이 두 사람 사이에 작동하는 보이지 않는 끈"이 무엇인지 구체적으로 묘사. 일상에서 유대감이 드러나는 순간 2가지를 장면으로. 이 부부만의 특별한 동조 패턴 1가지.

▶ 오행 상보 관계 (280~360자)
두 사람의 오행 분포 비교를 근거로 결혼 생활에서 서로가 어떻게 보완하는지 서술. ${myName}이 가정에 가져오는 에너지와 ${otherName}이 가져오는 에너지를 각각 명시. 함께할 때 강해지는 오행이 가정의 어떤 영역을 만드는지 구체적으로. 과잉 오행이 만드는 위험 징후 1가지도.

▶ 갈등·마찰 포인트 (320~400자)
결혼 생활에서 반복되는 갈등 패턴 3가지: (1) 의사결정 주도권(신강신약), (2) 소통 방식(식상·인성 차이), (3) 가치관·방향(용신·기신 충돌). 각 갈등마다 "어떤 상황에서 터지는지 → 각자가 느끼는 감정 → 구체적 해결법" 구조로 서술.

▶ 서로의 속마음 (280~360자)
${myName}이 ${otherName}에게 말 못 하는 결혼 생활의 속내, ${otherName}이 ${myName}에게 진짜 바라는 것을 십성 구조로 분석. 배우자에게 기대하는 것과 실제로 받는 것의 차이를 각자 입장에서 1인칭 화법으로 대변. "겉으로는 ~하지만 속으로는 ~"의 구조로 서로의 오해를 풀어주세요.

▶ 가정 역할과 생활 방식 (280~350자)
가정 내 역할 분담(${householdRole})을 근거로 의사결정 방식(큰 결정/작은 결정), 가사 분담(각자 잘하는 영역), 자녀 교육 방향, 외부 사교(부부 모임·개인 시간)를 십성·신강 구조로 분석. 이 부부의 최적 역할 배분 공식을 1문장으로.

▶ 경제·자산 궁합 (260~330자)
재성 분포(${financeCheck})를 근거로 ${myName}의 재정 스타일과 ${otherName}의 스타일을 각각 분석. 재산 관리에서 반복 충돌 상황 2가지. 함께 자산을 쌓는 최적 방식(누가 관리하고 누가 벌고 누가 결정하는지). 경제적 위기 때 빠지기 쉬운 패턴과 탈출법 1가지.

▶ 자녀와 가족 관계 (240~300자)
자녀성(식상·관성) 분포(${childStar})로 자녀 관계를 분석. ${myName}의 양육 스타일과 ${otherName}의 양육 스타일을 각각 서술. 교육 의견 충돌 지점과 시너지 지점. 양가 가족 관계에서 명리 구조상 주의점 2가지.

▶ 이 결혼의 미래 (280~360자)
세월이 흐를수록 이 부부가 어떤 관계로 변하는지 명리 구조로 예측. 신혼기·중년기·노년기에 각각 어떤 에너지 변화가 오는지 서술. 이 결혼이 가장 아름다워지는 시기와 그 이유를 용신·오행 구조로 설명. 함께 늙어가는 이 부부의 모습을 한 문장으로.

▶ 개운법·처방 (240~300자)
이 부부가 함께 행복하게 오래 사는 실용 처방 5가지: 1) 함께하면 운이 오르는 활동·장소(용신 기반, 구체적), 2) 가정에서 용신 오행 활용법(인테리어·색상·방향), 3) 주간 반복 갈등 예방 루틴, 4) 결혼기념일 운 끌어올리는 방법, 5) 이 결혼이 가진 가장 아름다운 가능성 한 문장.

`;
};

// ─────────────────────────────────────────────
// 전 연인·전 배우자 궁합
// ─────────────────────────────────────────────
export const generateExRelationGunghapPrompt = (
  me: SajuResult, other: SajuResult,
  myName: string, otherName: string,
  label: string // '전여친/전남친' | '전남편/전아내'
): string => {
  const myEl = me.pillars.day.ganElement;
  const otherEl = other.pillars.day.ganElement;
  const elRel = twoPersonElRelation(myEl, otherEl);

  const conflictCore = me.giSin === otherEl
    ? `${myName}에게 ${otherName}의 일간(${otherEl})은 기신 — 함께할수록 에너지 소진, 이별 구조 설명 가능`
    : other.giSin === myEl
    ? `${otherName}에게 ${myName}의 일간(${myEl})은 기신 — 상대방도 갈등 에너지 축적`
    : me.yongSinElement === otherEl
    ? `${otherName}의 일간(${otherEl})이 ${myName}의 용신 — 단기 끌림은 강했으나 지속 구조 불안정`
    : `명시적 기신 충돌 없음 — 오행 생극 외 다른 갈등 원인(합충·신살)에서 원인 찾기`;

  const reconnectCheck = checkEumYangHap(me.pillars.day.zhi, other.pillars.day.zhi) !== '없음'
    ? `일지 음양합 성립 — 감정적 재결합 인력 잔재, 재회 후 같은 패턴 반복 주의`
    : `일지 음양합 없음 — 재결합보다 각자 새 출발이 에너지 효율적`;

  const crossInteractions = buildCrossJiziInteractions(me, other, myName, otherName);
  const ohaengCompare = buildOhaengCompare(me, other, myName, otherName);

  return `당신은 사주명리 전문가입니다. 두 사람의 ${label} 관계 궁합을 아래 10개 섹션으로 풀이하세요.

- 모든 분석은 반드시 제공된 사주 데이터를 근거로 서술. 추상적·일반론 금지. 구체적 글자(천간·지지)와 오행 관계를 인용할 것.
[절대 규칙]
- Markdown·이모지 금지. 섹션 제목은 "▶ 제목" 형식으로만.
- 수치·판정 변경 금지. 흐린 표현 2회 이하. 각 섹션 본문은 2~3문단으로 나누고 문단 사이 빈 줄 필수.
- ★ 각 ▶ 섹션의 첫 줄은 반드시 은유 부제목(7~20자)만 단독 한 줄 출력. 마침표·'다/요/니다' 종결·'두 사람' 시작·명리 용어(오행/천간/지지)·숫자 시작 모두 금지. 명사구·체언 종결만 허용. 예: "잔잔한 호수 위의 첫눈" / "바람에 실려 온 불씨". 본문은 반드시 다음 줄부터.
- 출력은 첫 줄에 관계를 상징하는 은유 제목(7~14자)으로 시작. 대괄호·섹션 태그·식별자는 절대 출력하지 말 것. 총 분량: 3,800~4,800자.

[${myName} 사주]
${buildPersonBlock(me, myName)}

[${otherName} 사주]
${buildPersonBlock(other, otherName)}

▶ 일간 오행 관계
${elRel}

▶ 두 사람 지지 합·충
${crossInteractions}

▶ 오행 분포 비교
${ohaengCompare}

▶ 이별 에너지 분석
${conflictCore}

▶ 재결합 인력
${reconnectCheck}

▶ 기신 충돌
${myName} 기신(${me.giSin}) vs ${otherName} 일간(${otherEl}): ${me.giSin === otherEl ? '직접 충돌 — 반복 마찰 패턴' : '직접 충돌 없음'}
${otherName} 기신(${other.giSin}) vs ${myName} 일간(${myEl}): ${other.giSin === myEl ? '직접 충돌 — 반복 마찰 패턴' : '직접 충돌 없음'}

${GUNGHAP_RELATION_KB}
${EX_KB}
${METAPHOR_KB}
${METAPHOR_TITLE_RULE}
${GUNGHAP_SECTION_FORMAT}

[작성 지침 — 아래 10개 섹션을 순서대로 작성하세요]

▶ 핵심 요약 (280~360자)
이별 에너지 분석(${conflictCore})과 재결합 인력(${reconnectCheck})으로 이 이별의 전체 구조를 한마디로 선언. "이 두 사람의 이별은 ~한 이별이다"로 시작. 사주 구조상 이별이 필연이었는지, 타이밍 문제였는지 판정. 핵심 키워드 3개.

▶ 왜 헤어졌는가 (280~360자)
이별 에너지 분석(${conflictCore})과 기신 충돌 구조를 근거로 두 사람이 결국 헤어진 명리적 이유를 서술하세요. "단순한 감정 문제가 아닌 사주 구조가 만들어낸 필연적 패턴"으로 설명. 관계 중 반복됐을 갈등 패턴 2가지를 구체 장면으로 묘사하세요.

▶ 이별의 순환 패턴 (260~340자)
이 두 사람 사이에서 반복됐을 갈등의 순환 구조를 분석. "싸움 → 화해 → 기대 → 실망 → 싸움"의 사이클이 사주 구조에서 어떻게 만들어지는지. 기신 충돌과 지지 충이 이 패턴을 어떻게 고착시켰는지 서술.

▶ 그때 서로에게 어떤 존재였나 (260~340자)
이 관계가 지속됐을 때 두 사람이 서로에게 주었던 것과 빼앗았던 것을 오행·십성 구조로 분석하세요. "이 관계에서 좋았던 점"과 "결국 소진됐던 에너지" 모두 솔직하게 서술. 지지 합 구조(${crossInteractions})가 있다면 "그럼에도 계속 당겼던 이유"로 활용.

▶ 재결합 가능성 (260~340자)
재결합 인력(${reconnectCheck})을 솔직하게 평가하세요. 재결합할 경우 반드시 반복될 갈등 패턴 2가지를 제시. "재결합이 의미 있는 경우"와 "재결합이 또 다른 상처가 될 경우"를 명리 구조로 구분해 서술하세요. 감정이 아닌 사주로 판단하게 해주세요.

▶ 지금 내 안에 남은 것 (260~340자)
이 관계가 ${myName}의 사주에 남긴 에너지적 흔적을 분석. 용신 방향에서 충족됐던 것과 기신 활성화로 소진된 것을 각각 서술. "이 사람 때문에 내 안에 생긴 것"과 "이 사람 때문에 잃어버린 것"을 솔직하게.

▶ 이 관계에서 배운 것 (260~340자)
이 이별이 ${myName}의 사주에 어떤 성장의 계기가 됐는지 분석하세요. "이 관계를 통해 강해진 것", "아직 채워야 할 결핍"을 오행·용신 구조로 설명. 다음 인연에서 반복하지 않아야 할 패턴 1가지를 명확히 제시하세요.

▶ 다음 인연의 청사진 (260~340자)
이 관계의 경험을 바탕으로 ${myName}에게 맞는 다음 인연의 사주 구조를 분석. "다음에 만나면 좋은 사람의 에너지 특성" 3가지와 "피해야 할 패턴" 2가지를 구체적으로 제시.

▶ 진정한 이별의 의미 (260~340자)
이 이별이 ${myName}의 인생 전체에서 어떤 의미를 갖는지 명리 구조로 해석. 단순한 실패가 아닌 "사주가 보낸 성장의 메시지"로 재해석. 이 경험이 향후 대운·세운에서 어떻게 자양분이 되는지 서술.

▶ 감정 정리와 개운법 (260~340자)
지금 이 감정을 잘 정리하기 위한 실용 처방 3가지: 1) 용신 오행 기반의 회복 활동, 2) 피해야 할 상황이나 생각 패턴, 3) 다음 인연을 위해 지금 준비해야 할 것. 마지막은 응원의 한 문장으로 마무리하세요.

`;
};

// ─────────────────────────────────────────────
// 사업 파트너 궁합
// ─────────────────────────────────────────────
export const generateBusinessGunghapPrompt = (
  me: SajuResult, other: SajuResult,
  myName: string, otherName: string
): string => {
  const myEl = me.pillars.day.ganElement;
  const otherEl = other.pillars.day.ganElement;
  const elRel = twoPersonElRelation(myEl, otherEl);

  const myCounts = computeSipseongCounts(me);
  const otherCounts = computeSipseongCounts(other);
  const myJae = (myCounts['정재'] || 0) + (myCounts['편재'] || 0);
  const otherJae = (otherCounts['정재'] || 0) + (otherCounts['편재'] || 0);
  const myGwan = (myCounts['정관'] || 0) + (myCounts['편관'] || 0);
  const otherGwan = (otherCounts['정관'] || 0) + (otherCounts['편관'] || 0);
  const mySiksang = (myCounts['식신'] || 0) + (myCounts['상관'] || 0);
  const otherSiksang = (otherCounts['식신'] || 0) + (otherCounts['상관'] || 0);

  const roleDiv = (() => {
    const myRole = mySiksang >= 2 ? '아이디어·기획 주도' : myGwan >= 2 ? '실행·관리 주도' : '유연 조율형';
    const otherRole = otherSiksang >= 2 ? '아이디어·기획 주도' : otherGwan >= 2 ? '실행·관리 주도' : '유연 조율형';
    return myRole === otherRole
      ? `두 사람 모두 ${myRole} — 같은 방향 강점, 맹점 공유 주의`
      : `${myName}: ${myRole} / ${otherName}: ${otherRole} — 역할 분담 명확, 시너지 가능`;
  })();

  const financeRisk = myJae + otherJae >= 5
    ? '재성 과다 — 단기 수익 집착, 장기 투자 소홀 경계'
    : myJae + otherJae === 0
    ? '재성 결핍 — 돈 관리 외부 전문가 위임 구조 필요'
    : `재성 합산 ${myJae + otherJae}개 — 현실 감각 갖춘 파트너십`;

  const trustCheck = me.yongSinElement === other.yongSinElement
    ? '같은 용신 — 사업 방향성 일치, 신뢰 기반 탄탄'
    : me.yongSinElement === other.giSin || other.yongSinElement === me.giSin
    ? '용신·기신 충돌 — 의사결정 갈등 시 에너지 소진 위험'
    : '용신 방향 다름 — 서로 다른 강점으로 보완, 정기 소통 중요';

  const crossInteractions = buildCrossJiziInteractions(me, other, myName, otherName);

  return `당신은 사주명리 전문가입니다. 두 사람의 사업 파트너 궁합을 아래 10개 섹션으로 풀이하세요.
- 모든 분석은 반드시 제공된 사주 데이터를 근거로 서술. 추상적·일반론 금지. 구체적 글자(천간·지지)와 오행 관계를 인용할 것.

[절대 규칙]
- Markdown·이모지 금지. 섹션 제목은 "▶ 제목" 형식으로만.
- 수치·판정 변경 금지. 흐린 표현 2회 이하. 각 섹션 본문은 2~3문단으로 나누고 문단 사이 빈 줄 필수.
- ★ 각 ▶ 섹션의 첫 줄은 반드시 은유 부제목(7~20자)만 단독 한 줄 출력. 마침표·'다/요/니다' 종결·'두 사람' 시작·명리 용어(오행/천간/지지)·숫자 시작 모두 금지. 명사구·체언 종결만 허용. 예: "잔잔한 호수 위의 첫눈" / "바람에 실려 온 불씨". 본문은 반드시 다음 줄부터.
- 출력은 첫 줄에 관계를 상징하는 은유 제목(7~14자)으로 시작. 대괄호·섹션 태그·식별자는 절대 출력하지 말 것. 총 분량: 3,800~4,800자.

[${myName} 사주]
${buildPersonBlock(me, myName)}

[${otherName} 사주]
${buildPersonBlock(other, otherName)}

▶ 일간 오행 관계
${elRel}

▶ 두 사람 지지 합·충
${crossInteractions}

▶ 역할 분담 구조
${roleDiv}

▶ 금전 궁합
${myName} 재성: ${myJae}개 / ${otherName} 재성: ${otherJae}개 → ${financeRisk}

▶ 신뢰 에너지
${trustCheck}

▶ 신강신약 (의사결정)
${myName}: ${me.strengthStatus}(${me.isStrong ? '주도 성향' : '협력 성향'}) / ${otherName}: ${other.strengthStatus}(${other.isStrong ? '주도 성향' : '협력 성향'})
${me.isStrong && other.isStrong ? '두 사람 모두 신강 — 주도권 충돌 위험, 의사결정 룰 명문화 필요' : ''}

${GUNGHAP_RELATION_KB}
${BUSINESS_KB}
${METAPHOR_KB}
${METAPHOR_TITLE_RULE}
${GUNGHAP_SECTION_FORMAT}

[작성 지침 — 아래 10개 섹션을 순서대로 작성하세요]

▶ 핵심 요약 (280~360자)
일간 오행 관계(${elRel})와 역할 분담(${roleDiv})으로 이 사업 파트너십을 한마디로 선언. "이 두 사람의 사업 시너지는 ~하다"로 시작. 신뢰 에너지(${trustCheck})와 금전 궁합(${financeRisk})을 종합해 파트너십 전체 점수를 부여. 키워드 3개.

▶ 파트너십의 에너지 구조 (260~340자)
일간 오행 관계(${elRel})와 역할 분담 구조(${roleDiv})를 근거로 두 사람이 함께 사업할 때의 에너지 흐름을 서술하세요. "누가 방향을 잡고 누가 실행하는지", "어떤 분야에서 시너지가 나는지" 구체적으로 묘사. 지지 합(${crossInteractions})이 있다면 파트너십의 강점으로 활용.

▶ 최대 시너지 영역 (280~360자)
두 사람의 십성 분포와 오행 구조를 근거로 함께 사업할 때 가장 강점이 나오는 분야와 상황을 2~3가지 서술하세요. "이런 프로젝트는 두 사람이 환상의 파트너다"라는 구체적 업무 시나리오로 묘사. 각자의 강점이 합쳐졌을 때 어떤 결과가 나오는지 설명.

▶ 의사결정 구조 (260~340자)
신강신약 조합과 관성·비겁 분포로 두 사람의 의사결정 패턴을 분석. "큰 결정을 누가 내리는지", "반대 의견이 나왔을 때 어떻게 합의하는지"를 구체적 사업 장면으로. 의사결정 교착 상태 때 탈출법 1가지.

▶ 파트너십의 위험 신호 (280~360자)
이 두 사람이 사업에서 충돌할 수 있는 패턴 2~3가지를 구체 장면으로 묘사하세요. 금전 관리·의사결정·권한 배분에서 명리 구조상 충돌 포인트를 설명. 특히 신강신약 조합에서 주도권 갈등이 어떻게 나타나는지, 미리 방지하는 방법 1가지씩.

▶ 금전과 신뢰 (260~340자)
금전 궁합(${financeRisk})과 신뢰 에너지(${trustCheck})를 근거로 공동 자금 운용에서 주의해야 할 점을 서술하세요. 돈 문제가 파트너십을 망치는 전형적 패턴과 이를 예방하는 계약·약속의 형식 1가지를 구체적으로 제시.

▶ 위기 극복 패턴 (260~340자)
사업 위기(자금·매출·내부갈등)가 왔을 때 두 사람이 보이는 반응 패턴을 신강신약·십성으로 분석. 위기 때 서로를 지지하는 구조인지 소진하는 구조인지 판정. 위기를 함께 넘기는 핵심 전략 2가지.

▶ 성장 시너지 (260~340자)
두 사람이 함께 사업을 키울 때 어떤 영역에서 시너지가 극대화되는지 분석. 신규 사업 발굴(식상), 조직 관리(관성), 재무(재성) 등 역할별 적합도. 함께 진출하면 좋은 사업 분야 2가지 구체적 제시.

▶ 장기 파트너십 전망 (260~340자)
이 사업 파트너십이 5년·10년 후 어떤 모습인지 예측. 시간이 지날수록 강해지는 요소와 위험해지는 요소를 각각 서술. 장기 파트너십을 유지하기 위한 필수 약속 1가지.

▶ 사업 파트너십 처방 (260~340자)
이 파트너십이 성공하는 조건 3가지: 1) 서로의 역할을 명확히 하는 방법, 2) 위기 상황에서 관계를 지키는 원칙, 3) 이 두 사람이 함께라면 가장 잘 해낼 수 있는 사업 분야. 마지막은 이 파트너십의 가능성을 한 문장으로.

`;
};

// ─────────────────────────────────────────────
// 짝사랑 궁합
// ─────────────────────────────────────────────
export const generateSecretCrushGunghapPrompt = (
  me: SajuResult, other: SajuResult,
  myName: string, otherName: string
): string => {
  const myEl = me.pillars.day.ganElement;
  const otherEl = other.pillars.day.ganElement;
  const elRel = twoPersonElRelation(myEl, otherEl);
  const eumYangHap = checkEumYangHap(me.pillars.day.zhi, other.pillars.day.zhi);

  // 나 → 상대방 끌림의 명리 근거
  const crushBasis = (() => {
    if (me.yongSinElement === otherEl) return `${otherName}의 일간(${otherEl})이 나의 용신 — 상대방이 내 에너지를 채워주는 구조, 끌림의 근거 강함`;
    if (EL_CON[me.pillars.day.ganElement] === otherEl) return `상대방 일간(${otherEl})이 나의 재성·관성 오행 — 이성적 끌림 오행 구조 성립`;
    return `직접 용신 충족 없음 — 오행 분위기나 신살에서 끌림 원인 찾기`;
  })();

  // 상대방이 나에게 마음이 생길 가능성
  const reciprocalCheck = (() => {
    if (other.yongSinElement === myEl) return `${myName}의 일간(${myEl})이 ${otherName}의 용신 — 상대방도 내게 에너지 보충 느낌, 상호 인식 가능성 있음`;
    if (EL_CON[other.pillars.day.ganElement] === myEl) return `${myName}의 오행이 ${otherName}의 재성·관성 — 상대방 눈에 매력적으로 보일 구조`;
    return `${otherName} 입장에서 나는 용신·배우자성 오행 아님 — 자연 발생보다 적극 어필이 필요한 구조`;
  })();

  const crossInteractions = buildCrossJiziInteractions(me, other, myName, otherName);
  const sipseongCompare = buildGunghapSipseong(me, other, myName, otherName);
  const ohaengCompare = buildOhaengCompare(me, other, myName, otherName);

  return `당신은 사주명리 전문가입니다. ${myName}이 ${otherName}에게 마음이 있는 짝사랑 상황의 궁합을 아래 10개 섹션으로 풀이하세요.

[절대 규칙]
- Markdown·이모지 금지. 섹션 제목은 "▶ 제목" 형식으로만.
- 수치·판정 변경 금지. 흐린 표현 2회 이하. 각 섹션 본문은 2~3문단으로 나누고 문단 사이 빈 줄 필수.
- ★ 각 ▶ 섹션의 첫 줄은 반드시 은유 부제목(7~20자)만 단독 한 줄 출력. 마침표·'다/요/니다' 종결·'두 사람' 시작·명리 용어(오행/천간/지지)·숫자 시작 모두 금지. 명사구·체언 종결만 허용. 예: "잔잔한 호수 위의 첫눈" / "바람에 실려 온 불씨". 본문은 반드시 다음 줄부터.
- 출력은 첫 줄에 관계를 상징하는 은유 제목(7~14자)으로 시작. 대괄호·섹션 태그·식별자는 절대 출력하지 말 것. 총 분량: 3,800~4,800자.
- 모든 분석은 반드시 제공된 사주 데이터를 근거로 서술. 추상적·일반론 금지. 구체적 글자(천간·지지)와 오행 관계를 인용할 것.

[${myName} 사주 — 마음을 가진 사람]
${buildPersonBlock(me, myName)}

[${otherName} 사주 — 마음을 받는 사람]
${buildPersonBlock(other, otherName)}

▶ 일간 오행 관계
${elRel}

▶ 일지 음양합
${eumYangHap}

▶ 두 사람 지지 합·충
${crossInteractions}

▶ 오행 분포 비교
${ohaengCompare}

▶ 십성 분포 비교
${sipseongCompare}

▶ 끌림의 명리 구조
${crushBasis}

▶ 상대방의 시선
${reciprocalCheck}

${GUNGHAP_RELATION_KB}
${CRUSH_KB}
${METAPHOR_KB}
${METAPHOR_TITLE_RULE}
${GUNGHAP_SECTION_FORMAT}

[작성 지침 — 아래 10개 섹션을 순서대로 작성하세요]

▶ 핵심 요약 (280~360자)
끌림의 명리 구조(${crushBasis})와 상호 인식 가능성(${reciprocalCheck})을 종합해 이 짝사랑의 전체 구도를 선언. "이 마음은 ~한 인연이다"로 시작. 일간 오행 관계(${elRel})와 일지 음양합(${eumYangHap})으로 이 감정의 명리적 무게감을 판정. 핵심 키워드 3개.

▶ 왜 이 사람에게 끌리는가 (260~340자)
끌림의 명리 구조(${crushBasis})를 근거로 ${myName}이 ${otherName}에게 마음이 생긴 명리적 이유를 서술하세요. "단순한 외모나 상황이 아닌, 사주 에너지가 끌어당기는 구조"로 설명. 일지 음양합(${eumYangHap})과 지지 합(${crossInteractions}) 결과를 활용해 "두 사람 사이에 흐르는 보이지 않는 인력"을 묘사하세요.

▶ 감정의 깊이 (260~340자)
${myName}의 십성 분포와 용신 구조에서 이 끌림이 단순 호감인지 깊은 감정인지 분석. 재성·식신이 이 감정에 어떤 역할을 하는지. 이 짝사랑이 ${myName}의 일상에 미치는 에너지 변화(집중력·활력·불안)를 구체적으로 서술.

▶ 상대방 눈에 나는 어떻게 보이는가 (260~340자)
상호 인식 가능성(${reciprocalCheck})을 근거로 ${otherName}이 ${myName}을 어떻게 바라보는지 솔직하게 분석하세요. 십성 분포 비교(${sipseongCompare})를 활용해 "상대방 사주에서 나는 어떤 오행·십성으로 인식되는지" 분석. 상대방이 호감을 느낄 때 보이는 행동 신호 2가지를 구체적으로 제시하세요.

▶ 상대방의 이상형 분석 (260~340자)
${otherName}의 사주에서 배우자성 오행·일지 구조로 이상형 에너지를 분석. ${myName}이 그 이상형에 얼마나 부합하는지 구체적으로 평가. 부합하는 점과 부족한 점을 각각 서술하고, 부족한 부분을 보완하는 전략 1가지.

▶ 마음이 이어질 가능성 (280~360자)
오행 분포 비교와 지지 합충 구조를 근거로 이 감정이 서로의 인연으로 발전할 가능성을 분석하세요. 높음·보통·낮음을 명확히 판정하고 명리적 근거를 제시. 장애가 되는 구조(충·기신 충돌)와 가능성을 높이는 구조(합·용신 충족)를 모두 솔직하게 서술하세요.

▶ 다가가는 전략 (260~340자)
${otherName}의 사주 구조에서 마음이 열리는 상황·분위기를 분석하세요. 식신이 강하면 맛있는 것, 인성이 강하면 지적 대화 등 십성별 접근법 제시. 자연스럽게 거리를 좁히는 3단계 전략(관심 표현→교류 심화→감정 확인)을 구체적으로.

▶ 이런 행동은 멀어지게 한다 (260~340자)
${myName}의 오행·십성 구조에서 ${otherName}을 멀어지게 하는 행동 패턴 2가지를 구체적으로 묘사하세요. "사주에서 이 사람이 무의식적으로 하게 되는 행동 중 상대가 불편해할 것"을 분석. 반대로 "${otherName}의 마음을 여는 구체적 접근법" 2가지도 제시하세요.

▶ 이 마음의 미래 (260~340자)
이 감정이 성취됐을 때와 성취되지 못했을 때 각각을 예측. 연인이 됐을 때의 관계 에너지 특성 2가지, 이루어지지 않을 때 이 경험이 남기는 성장 1가지. 어떤 결과든 이 마음이 가치 있는 이유를 한 문장으로.

▶ 고백 타이밍과 처방 (260~340자)
두 사람의 사주 구조에서 고백하기 좋은 상황의 조건과 피해야 할 타이밍을 서술하세요. 용신 오행 기반으로 함께하면 좋은 장소·활동 2가지를 추천. 마지막은 ${myName}에게 보내는 응원의 한 문장으로 마무리.

`;
};

// ─────────────────────────────────────────────
// 소울메이트 궁합
// ─────────────────────────────────────────────
export const generateSoulmateGunghapPrompt = (
  me: SajuResult, other: SajuResult,
  myName: string, otherName: string
): string => {
  const myEl = me.pillars.day.ganElement;
  const otherEl = other.pillars.day.ganElement;
  const elRel = twoPersonElRelation(myEl, otherEl);
  const eumYangHap = checkEumYangHap(me.pillars.day.zhi, other.pillars.day.zhi);

  const myMissing = Object.entries(me.elementPercent).filter(([, v]) => v === 0).map(([k]) => k);
  const otherMissing = Object.entries(other.elementPercent).filter(([, v]) => v === 0).map(([k]) => k);
  const complementEl = myMissing.filter(el => other.elementPercent[el as keyof typeof other.elementPercent] > 20);
  const complementElOther = otherMissing.filter(el => me.elementPercent[el as keyof typeof me.elementPercent] > 20);

  const soulmateEvidence = [
    eumYangHap !== '없음' ? `일지 음양합(${eumYangHap}) 성립` : null,
    me.yongSinElement === otherEl ? `${otherName}의 일간이 ${myName}의 용신` : null,
    other.yongSinElement === myEl ? `${myName}의 일간이 ${otherName}의 용신` : null,
    complementEl.length > 0 ? `${myName}의 결핍 오행(${complementEl.join('·')})을 ${otherName}이 보충` : null,
    complementElOther.length > 0 ? `${otherName}의 결핍 오행(${complementElOther.join('·')})을 ${myName}이 보충` : null,
  ].filter(Boolean);

  const evidenceStr = soulmateEvidence.length > 0
    ? soulmateEvidence.join(' / ')
    : '명시적 소울메이트 지표 없음 — 에너지 결핍 아닌 성장형 인연';

  const crossInteractions = buildCrossJiziInteractions(me, other, myName, otherName);
  const sipseongCompare = buildGunghapSipseong(me, other, myName, otherName);
  const ohaengCompare = buildOhaengCompare(me, other, myName, otherName);

  return `당신은 사주명리 전문가입니다. 두 사람의 소울메이트 관계를 아래 10개 섹션으로 풀이하세요.

[절대 규칙]
- Markdown·이모지 금지. 섹션 제목은 "▶ 제목" 형식으로만.
- 수치·판정 변경 금지. 흐린 표현 2회 이하. 각 섹션 본문은 2~3문단으로 나누고 문단 사이 빈 줄 필수.
- ★ 각 ▶ 섹션의 첫 줄은 반드시 은유 부제목(7~20자)만 단독 한 줄 출력. 마침표·'다/요/니다' 종결·'두 사람' 시작·명리 용어(오행/천간/지지)·숫자 시작 모두 금지. 명사구·체언 종결만 허용. 예: "잔잔한 호수 위의 첫눈" / "바람에 실려 온 불씨". 본문은 반드시 다음 줄부터.
- 모든 분석은 반드시 제공된 사주 데이터를 근거로 서술. 추상적·일반론 금지. 구체적 글자(천간·지지)와 오행 관계를 인용할 것.
- 출력은 첫 줄에 관계를 상징하는 은유 제목(7~14자)으로 시작. 대괄호·섹션 태그·식별자는 절대 출력하지 말 것. 총 분량: 3,800~4,800자.

[${myName} 사주]
${buildPersonBlock(me, myName)}

[${otherName} 사주]
${buildPersonBlock(other, otherName)}

▶ 일간 오행 관계
${elRel}

▶ 일지 음양합
${eumYangHap}

▶ 두 사람 지지 합·충·삼합
${crossInteractions}

▶ 오행 분포 비교
${ohaengCompare}

▶ 십성 분포 비교
${sipseongCompare}

▶ 소울메이트 명리 지표
${evidenceStr}

▶ 오행 보완 구조
${myName} 결핍: ${myMissing.join('·') || '없음'} / ${otherName} 결핍: ${otherMissing.join('·') || '없음'}

${GUNGHAP_RELATION_KB}
${SOULMATE_KB}
${METAPHOR_KB}
${METAPHOR_TITLE_RULE}
${GUNGHAP_SECTION_FORMAT}

[작성 지침 — 아래 10개 섹션을 순서대로 작성하세요]

▶ 핵심 요약 (280~360자)
소울메이트 명리 지표(${evidenceStr})를 종합해 이 인연의 전체 구도를 선언. "이 두 사람은 ~한 소울메이트다"로 시작. 일간 오행 관계(${elRel})와 일지 음양합(${eumYangHap})으로 인연의 깊이를 판정. 이 소울메이트 관계의 핵심 색깔을 한마디로. 키워드 3개.

▶ 이 인연의 명리적 정체 (260~340자)
소울메이트 명리 지표(${evidenceStr})를 근거로 두 사람이 왜 서로를 "설명할 수 없이 통하는 사람"으로 느끼는지 서술하세요. 일간 오행 관계(${elRel})와 일지 음양합(${eumYangHap})으로 "이 인연의 명리적 정체"를 한마디로 선언. "두 사람은 ~한 인연이다"로 시작하세요.

▶ 영혼의 공명 — 왜 통하는가 (280~360자)
지지 합·삼합 결과(${crossInteractions})를 근거로 두 사람 사이에 흐르는 보이지 않는 연결을 묘사하세요. 일간이 동일하다면 비화(비견)의 공명 구조를, 다르다면 상생·상극에서 나오는 당김의 에너지를 설명. 십성 분포 비교(${sipseongCompare})에서 "서로가 서로를 어떤 존재로 인식하는지"도 분석하세요.

▶ 서로가 서로를 완성하는 구조 (260~340자)
오행 분포 비교와 결핍 오행 상보 관계를 근거로 두 사람이 어떻게 서로를 완성하는지 서술하세요. "${myName}이 ${otherName}에게 주는 것"과 "${otherName}이 ${myName}에게 주는 것"을 각각 구체적으로 묘사. 함께할 때 두 사람이 개인으로서 더 온전해지는 이유를 설명하세요.

▶ 영혼의 거울 (260~340자)
이 두 사람이 서로에게 "거울" 역할을 하는 구조를 분석. 상대를 통해 자기 자신의 숨겨진 면을 발견하는 경험을 십성·오행 구조로 서술. "이 사람이 내게 보여주는 나의 모습"을 각자 입장에서 묘사하세요.

▶ 소울메이트도 겪는 갈등 (260~340자)
이 두 사람 사이에 생길 수 있는 갈등 패턴을 지지 충·형·용신 충돌 구조로 서술하세요. "소울메이트라도 사주 구조상 반복되는 오해나 충돌 패턴"을 2가지 구체적으로 묘사. 단, 단점 지적 후 "이 갈등도 결국 두 사람을 더 깊게 연결한다"는 관점의 처방으로 마무리하세요.

▶ 일상 속 공명 (260~340자)
특별한 사건이 아닌 일상에서 소울메이트 케미가 드러나는 순간 3가지를 구체적으로 묘사. "같은 생각을 동시에 하는 순간", "말하지 않아도 아는 순간", "함께 있으면 시간이 다르게 흐르는 감각"을 명리 구조로 설명.

▶ 이 인연에서 각자가 성장하는 것 (260~340자)
이 소울메이트 관계를 통해 ${myName}이 성장하는 것과 ${otherName}이 성장하는 것을 분석하세요. "이 인연이 단순한 편안함이 아닌 서로를 더 나은 존재로 만드는 이유"를 오행·십성 구조로 설명하세요.

▶ 함께하는 성장의 길 (260~340자)
이 소울메이트가 함께할 때 열리는 인생 방향을 분석. 용신 오행이 같다면 같은 길을, 다르다면 교차하며 확장하는 길을 서술. "둘이 함께이기에 가능한 인생의 모험" 2가지를 구체적으로 제시하세요.

▶ 이 인연을 지키는 처방 (260~340자)
소울메이트 관계가 오래 유지되려면 두 사람이 지켜야 할 것 3가지: 1) 지지 합·충 구조에서 나오는 핵심 조언, 2) 용신 오행 기반 함께하기 좋은 활동, 3) 이 인연이 가진 가장 아름다운 가능성 한 문장.

`;
};

// ─────────────────────────────────────────────
// 라이벌 궁합
// ─────────────────────────────────────────────
export const generateRivalGunghapPrompt = (
  me: SajuResult, other: SajuResult,
  myName: string, otherName: string
): string => {
  const myEl = me.pillars.day.ganElement;
  const otherEl = other.pillars.day.ganElement;
  const elRel = twoPersonElRelation(myEl, otherEl);

  const myCounts = computeSipseongCounts(me);
  const otherCounts = computeSipseongCounts(other);
  const myBijeop = (myCounts['비견'] || 0) + (myCounts['겁재'] || 0);
  const otherBijeop = (otherCounts['비견'] || 0) + (otherCounts['겁재'] || 0);
  const myGwan = (myCounts['정관'] || 0) + (myCounts['편관'] || 0);
  const otherGwan = (otherCounts['정관'] || 0) + (otherCounts['편관'] || 0);

  const rivalDynamic = myEl === otherEl
    ? '일간 동일 — 같은 기질과 방식, 서로를 거울처럼 자극하는 정통 라이벌'
    : EL_CON[myEl] === otherEl || EL_CON[otherEl] === myEl
    ? '일간 오행 상극 — 서로의 방식이 충돌하며 마찰에서 성장 에너지 생성'
    : '일간 상생 구조 — 경쟁 중에도 의도치 않게 서로를 키워주는 라이벌';

  const growthSynergy = me.strengthStatus === other.strengthStatus
    ? `두 사람 모두 ${me.strengthStatus} — 대등한 에너지, 진정한 라이벌 구도`
    : `${myName}(${me.strengthStatus}) vs ${otherName}(${other.strengthStatus}) — 강약 차이가 동기부여 격차로 이어질 수 있음`;

  const winLoseCheck = me.yongSinElement === otherEl
    ? `${otherName}의 기운이 ${myName}의 용신 — 라이벌이지만 상대가 나를 성장시키는 구조`
    : other.yongSinElement === myEl
    ? `${myName}의 기운이 ${otherName}의 용신 — 내가 상대를 자극해 성장시키는 구조`
    : me.giSin === otherEl
    ? `${otherName}의 오행이 ${myName}의 기신 — 이 라이벌 관계는 에너지를 소진시킬 수 있음, 건강한 거리 유지 필요`
    : '서로 직접적인 용신·기신 충돌 없음 — 건강한 경쟁 관계 가능';

  const crossInteractions = buildCrossJiziInteractions(me, other, myName, otherName);
  const ohaengCompare = buildOhaengCompare(me, other, myName, otherName);

  return `당신은 사주명리 전문가입니다. 두 사람의 라이벌 관계를 아래 10개 섹션으로 풀이하세요.

[절대 규칙]
- Markdown·이모지 금지. 섹션 제목은 "▶ 제목" 형식으로만.
- 수치·판정 변경 금지. 흐린 표현 2회 이하. 각 섹션 본문은 2~3문단으로 나누고 문단 사이 빈 줄 필수.
- ★ 각 ▶ 섹션의 첫 줄은 반드시 은유 부제목(7~20자)만 단독 한 줄 출력. 마침표·'다/요/니다' 종결·'두 사람' 시작·명리 용어(오행/천간/지지)·숫자 시작 모두 금지. 명사구·체언 종결만 허용. 예: "잔잔한 호수 위의 첫눈" / "바람에 실려 온 불씨". 본문은 반드시 다음 줄부터.
- 모든 분석은 반드시 제공된 사주 데이터를 근거로 서술. 추상적·일반론 금지. 구체적 글자(천간·지지)와 오행 관계를 인용할 것.
- 출력은 첫 줄에 관계를 상징하는 은유 제목(7~14자)으로 시작. 대괄호·섹션 태그·식별자는 절대 출력하지 말 것. 총 분량: 3,800~4,800자.

[${myName} 사주]
${buildPersonBlock(me, myName)}

[${otherName} 사주]
${buildPersonBlock(other, otherName)}

▶ 일간 오행 관계
${elRel}

▶ 두 사람 지지 합·충
${crossInteractions}

▶ 오행 분포 비교
${ohaengCompare}

▶ 라이벌 역학 구조
${rivalDynamic}

▶ 에너지 균형
${growthSynergy}
비겁: ${myName} ${myBijeop}개 / ${otherName} ${otherBijeop}개

▶ 성장·소진 여부
${winLoseCheck}

▶ 의지력·지속력 (관성)
${myName} 관성: ${myGwan}개 / ${otherName} 관성: ${otherGwan}개
${myGwan + otherGwan >= 4 ? '관성 강함 — 지는 것을 참지 못하는 기질, 과도한 경쟁 소진 주의' : '관성 적정 — 과정 중심 경쟁 가능'}

${GUNGHAP_RELATION_KB}
${RIVAL_KB}
${METAPHOR_KB}
${METAPHOR_TITLE_RULE}
${GUNGHAP_SECTION_FORMAT}

[작성 지침 — 아래 10개 섹션을 순서대로 작성하세요]

▶ 핵심 요약 (280~360자)
라이벌 역학 구조(${rivalDynamic})와 에너지 균형(${growthSynergy})으로 이 경쟁의 전체 구도를 선언. "이 두 사람의 경쟁은 ~한 경쟁이다"로 시작. 성장·소진 여부(${winLoseCheck})를 종합해 이 라이벌 관계의 건강도 판정. 키워드 3개.

▶ 이 라이벌 관계의 정체 (260~340자)
라이벌 역학 구조(${rivalDynamic})를 근거로 두 사람의 경쟁이 어떤 종류인지 한마디로 선언하세요. "이 두 사람은 ~한 방식으로 서로를 자극하는 라이벌이다"로 시작. 일간 오행 관계(${elRel})가 경쟁 방식에 어떤 영향을 미치는지 서술하세요.

▶ 서로가 서로에게 주는 자극 (280~360자)
오행 분포 비교와 지지 합충(${crossInteractions})을 근거로 두 사람이 경쟁하면서 어떻게 서로를 성장시키는지 서술하세요. 에너지 균형(${growthSynergy})으로 "대등한 라이벌인지, 한쪽이 더 강한 라이벌인지" 분석. 경쟁 중에 의도치 않게 서로를 돕게 되는 구조가 있다면 구체적으로 설명하세요.

▶ 경쟁의 열쇠 (260~340자)
각자의 사주에서 경쟁 무기와 약점을 분석. ${myName}의 강점 오행과 ${otherName}의 강점 오행이 부딪힐 때 어떤 역학이 생기는지. 승부를 가르는 핵심 요소(끈기·순발력·전략·인맥)를 십성 분포로 각각 분석.

▶ 라이벌 관계의 그림자 (260~340자)
성장·소진 여부(${winLoseCheck})와 비겁·관성 과다 여부를 근거로 이 경쟁이 어떻게 독이 될 수 있는지 서술하세요. "경쟁심이 지나쳐 서로를 소진시키는 패턴", "이기려는 욕구가 오히려 발목을 잡는 상황"을 2가지 구체 장면으로 묘사. 각 패턴마다 자기 보호 처방 1문장.

▶ 보이지 않는 존경 (260~340자)
경쟁 속에서 서로를 인정하는 숨겨진 감정을 분석. ${myName}이 ${otherName}에게 은연중에 배우는 것, ${otherName}이 ${myName}을 의식하는 부분을 십성 구조로 서술. "겉으로는 경쟁하지만 속으로는 인정하는 점" 각각 1가지.

▶ 라이벌을 활용해 성장하는 전략 (260~340자)
이 라이벌 관계에서 ${myName}이 최대 성장을 이끌어내는 전략 2~3가지를 제시하세요. "상대방의 이런 점에서 자극을 받아라", "이런 분야에서만 경쟁하고 이런 분야는 협력으로 전환하라"는 식의 구체적 조언. 라이벌을 적이 아닌 거울로 활용하는 방법을 서술하세요.

▶ 경쟁이 독이 되는 순간 (260~340자)
건강한 경쟁이 파괴적으로 변하는 임계점을 분석. 기신 활성화·비겁 폭주·관성 과부하가 만드는 소진 패턴을 구체적 장면으로. 이 라인을 넘지 않기 위한 자기 점검 방법 2가지.

▶ 라이벌에서 동료로 (260~340자)
경쟁이 끝난 뒤 이 관계가 어떻게 변하는지 예측. 라이벌이었기에 가능한 깊은 동료 관계의 가능성. 경쟁을 통해 쌓인 신뢰가 만드는 새로운 시너지를 서술.

▶ 이 경쟁의 최종 가치 (260~340자)
이 라이벌 관계가 장기적으로 두 사람에게 주는 가장 큰 가치를 서술하세요. 경쟁을 통해 각자가 더 강해지는 부분, 이 관계가 끝나도 남는 것, 그리고 이 라이벌이 결국 좋은 동료가 될 가능성을 한 문장으로 마무리.

`;
};

// ─────────────────────────────────────────────
// 멘토·멘티 궁합
// ─────────────────────────────────────────────
export const generateMentorGunghapPrompt = (
  me: SajuResult, other: SajuResult,
  myName: string, otherName: string
): string => {
  const myEl = me.pillars.day.ganElement;
  const otherEl = other.pillars.day.ganElement;
  const elRel = twoPersonElRelation(myEl, otherEl);

  const myCounts = computeSipseongCounts(me);
  const otherCounts = computeSipseongCounts(other);
  const myInseong = (myCounts['정인'] || 0) + (myCounts['편인'] || 0);
  const otherInseong = (otherCounts['정인'] || 0) + (otherCounts['편인'] || 0);
  const mySiksang = (myCounts['식신'] || 0) + (myCounts['상관'] || 0);
  const otherSiksang = (otherCounts['식신'] || 0) + (otherCounts['상관'] || 0);

  const mentorStructure = (() => {
    if (EL_GEN[myEl] === otherEl) return `${myName}의 오행(${myEl})이 ${otherName}의 오행(${otherEl})을 생성 — 자연스러운 멘토(${myName}) → 멘티(${otherName}) 구조`;
    if (EL_GEN[otherEl] === myEl) return `${otherName}의 오행(${otherEl})이 ${myName}의 오행(${myEl})을 생성 — ${otherName}이 멘토, ${myName}이 배우는 구조`;
    return `오행 생성 구조 없음 — 역할 기반이 아닌 가치 공유형 멘토십`;
  })();

  const transmissionCheck = myInseong >= 2
    ? `${myName} 인성 ${myInseong}개 — 깊은 지식 전달 능력, 멘토 역할 적합`
    : otherInseong >= 2
    ? `${otherName} 인성 ${otherInseong}개 — 배움을 빠르게 흡수하는 구조`
    : '인성 적음 — 지식 전달보다 경험 공유 방식의 멘토십이 효과적';

  const creativityCheck = mySiksang + otherSiksang >= 3
    ? `식상 합산 ${mySiksang + otherSiksang}개 — 창의적 교류·아이디어 교환 활발, 서로 영감 주는 관계`
    : '식상 적음 — 실용·체계 중심 멘토십이 효과적';

  const crossInteractions = buildCrossJiziInteractions(me, other, myName, otherName);
  const ohaengCompare = buildOhaengCompare(me, other, myName, otherName);
  const sipseongCompare = buildGunghapSipseong(me, other, myName, otherName);
  const energyFlow = me.isStrong && !other.isStrong
    ? `${myName}(신강)이 ${otherName}(신약)을 이끄는 구조 — 자연스러운 멘토(${myName}) 에너지`
    : !me.isStrong && other.isStrong
    ? `${otherName}(신강)이 ${myName}(신약)을 이끄는 구조 — ${otherName}이 멘토 역할 자연스러움`
    : '비슷한 신강신약 — 수평적 성장 파트너십, 서로 다른 분야에서 번갈아 이끔';

  return `당신은 사주명리 전문가입니다. 두 사람의 멘토·멘티 관계를 아래 10개 섹션으로 풀이하세요.

[절대 규칙]
- Markdown·이모지 금지. 섹션 제목은 "▶ 제목" 형식으로만.
- 수치·판정 변경 금지. 흐린 표현 2회 이하. 각 섹션 본문은 2~3문단으로 나누고 문단 사이 빈 줄 필수.
- ★ 각 ▶ 섹션의 첫 줄은 반드시 은유 부제목(7~20자)만 단독 한 줄 출력. 마침표·'다/요/니다' 종결·'두 사람' 시작·명리 용어(오행/천간/지지)·숫자 시작 모두 금지. 명사구·체언 종결만 허용. 예: "잔잔한 호수 위의 첫눈" / "바람에 실려 온 불씨". 본문은 반드시 다음 줄부터.
- 모든 분석은 반드시 제공된 사주 데이터를 근거로 서술. 추상적·일반론 금지. 구체적 글자(천간·지지)와 오행 관계를 인용할 것.
- 출력은 첫 줄에 관계를 상징하는 은유 제목(7~14자)으로 시작. 대괄호·섹션 태그·식별자는 절대 출력하지 말 것. 총 분량: 3,800~4,800자.

[${myName} 사주]
${buildPersonBlock(me, myName)}

[${otherName} 사주]
${buildPersonBlock(other, otherName)}

▶ 일간 오행 관계
${elRel}

▶ 두 사람 지지 합·충
${crossInteractions}

▶ 오행 분포 비교
${ohaengCompare}

▶ 십성 분포 비교
${sipseongCompare}

▶ 멘토·멘티 오행 구조
${mentorStructure}

▶ 지식 전달·학습 역량
${transmissionCheck}

▶ 창의·영감 교류
${creativityCheck}

▶ 에너지 흐름 (신강신약)
${energyFlow}

${GUNGHAP_RELATION_KB}
${MENTOR_KB}
${METAPHOR_KB}
${METAPHOR_TITLE_RULE}
${GUNGHAP_SECTION_FORMAT}

[작성 지침 — 아래 10개 섹션을 순서대로 작성하세요]

▶ 핵심 요약 (280~360자)
멘토·멘티 오행 구조(${mentorStructure})와 에너지 흐름(${energyFlow})으로 이 성장 관계의 전체 구도를 선언. "이 두 사람은 ~한 사제 관계다"로 시작. 지식 전달 역량(${transmissionCheck})과 창의 교류(${creativityCheck})를 종합해 멘토십의 품질을 판정. 키워드 3개.

▶ 이 성장 관계의 명리 구조 (260~340자)
멘토·멘티 오행 구조(${mentorStructure})와 에너지 흐름(${energyFlow})을 근거로 두 사람의 성장 관계가 어떤 방향으로 흐르는지 서술하세요. "누가 가르치고 누가 배우는지", 또는 "서로가 서로의 어떤 부분을 이끄는지"를 명확히 선언하세요. 일간 오행 관계(${elRel})가 이 배움의 관계에 어떤 색을 입히는지도 묘사하세요.

▶ 배움의 방식과 시너지 (280~360자)
지식 전달 역량(${transmissionCheck})과 창의·영감 교류(${creativityCheck})를 근거로 두 사람이 가장 효과적으로 배우고 가르치는 방식을 서술하세요. "이론 전달인지, 경험 공유인지, 아이디어 교환인지"를 십성 분포로 분석. 두 사람이 함께할 때 가장 빠르게 성장하는 분야와 방법론 2가지를 구체적으로 제시하세요.

▶ 가르침의 깊이 (260~340자)
멘토가 멘티에게 전달하는 핵심 가치를 십성·오행으로 분석. 단순한 지식이 아닌 "인생의 방향과 태도"까지 전수되는 구조인지. 멘토의 경험에서 멘티에게 가장 유용한 교훈 2가지를 구체적으로 서술.

▶ 멘토십의 그림자 (260~340자)
이 성장 관계에서 생길 수 있는 갈등 패턴 2가지를 구체적으로 묘사하세요. "멘토의 과한 개입이 멘티의 식신(창의성)을 억압하는 구조", "멘티가 멘토를 넘어설 때 생기는 역학 변화" 등 명리 구조로 설명. 갈등이 생겼을 때 관계를 회복하는 방법 1가지씩 제시하세요.

▶ 서로의 속마음 (260~340자)
멘토가 멘티에게 말 못 하는 기대와 우려, 멘티가 멘토에게 말 못 하는 욕구와 불만을 십성 구조로 분석. 각자의 속마음을 1인칭 화법으로 대변. 이 갭을 해소하는 대화법 1가지.

▶ 성장의 변곡점 (260~340자)
멘티가 멘토의 수준에 도달하거나 넘어서는 시점에 생기는 역학 변화를 분석. 이 변곡점에서 관계가 더 깊어지는 경우와 어색해지는 경우를 각각 서술. 변곡점을 건강하게 넘기는 핵심 태도 1가지.

▶ 각자에게 주는 성장 (260~340자)
이 관계에서 ${myName}이 얻는 것과 ${otherName}이 얻는 것을 각각 분석하세요. "배우는 것"만이 아니라 "가르치면서 성장하는 것"도 포함. 오행 상보 관계와 십성 구조를 근거로 이 멘토십이 두 사람의 인생에 어떤 영향을 미치는지 서술하세요.

▶ 이 관계의 미래 (260~340자)
멘토십이 시간이 지나면서 어떻게 진화하는지 예측. 사제 관계 → 동료 → 친구로 변하는 과정. 멘토십이 끝난 후에도 남는 유산(인생관·가치관·네트워크)을 서술.

▶ 멘토십을 오래 지속하는 처방 (260~340자)
이 성장 관계가 오래 유지되는 3가지 조건: 1) 역할 경계를 지키는 방법, 2) 서로의 에너지를 살리는 소통 방식, 3) 멘티가 멘토를 넘어섰을 때 더 좋은 파트너가 되는 방법. 마지막은 이 관계가 가진 가장 아름다운 가능성 한 문장.

`;
};

// ─────────────────────────────────────────────
// 반려동물 궁합 — 특화 프롬프트 (사주는 주인만 실제 데이터, 동물은 상징 기운 매핑)
// 재미 카테고리이지만 타당성 확보: 주인 사주 해석 기반 + 동물 종별 상징 기운으로 "같이 사는 케미"를 풀어낸다
// ─────────────────────────────────────────────

export type PetSpecies = 'dog' | 'cat' | 'rabbit' | 'hamster' | 'bird' | 'turtle' | 'fish' | 'other';

/** 동물 종별 상징 기운 매핑 — 명리학적 강제는 아니며, 전통 상징·민담·현대 정서 혼합 */
export const PET_SPECIES_VIBE: Record<PetSpecies, {
  label: string;
  emoji: string;
  elements: string[];   // 상징 오행 (1~2개)
  keywords: string[];   // 기운 키워드 3개
  note: string;         // 이 종이 주인에게 주는 에너지 한 줄
}> = {
  dog:     { label: '강아지', emoji: '🐶', elements: ['화','토'], keywords: ['활발','충성','따뜻함'],     note: '무조건적인 애정과 매일의 활력을 주는 작은 태양' },
  cat:     { label: '고양이', emoji: '🐱', elements: ['금','수'], keywords: ['독립','신비','우아'],       note: '고요한 거리감 속에 숨은 깊은 신뢰의 별' },
  rabbit:  { label: '토끼',   emoji: '🐰', elements: ['목','수'], keywords: ['섬세','조심','생명력'],    note: '조용한 봄기운을 품은 작은 달빛' },
  hamster: { label: '햄스터', emoji: '🐹', elements: ['화','목'], keywords: ['빠름','호기심','귀여움'], note: '작지만 빛나는 에너지가 하루를 간지럽히는 별똥별' },
  bird:    { label: '새',     emoji: '🐦', elements: ['화','금'], keywords: ['자유','영감','경쾌'],     note: '창공의 바람처럼 일상에 영감과 노래를 실어주는 존재' },
  turtle:  { label: '거북이', emoji: '🐢', elements: ['수','토'], keywords: ['장수','묵묵함','안정'],   note: '조용한 강물처럼 흐르며 함께 나이 들어가는 동반자' },
  fish:    { label: '물고기', emoji: '🐟', elements: ['수'],     keywords: ['흐름','고요','정화'],     note: '말없는 물의 기운으로 마음을 씻어주는 고요한 벗' },
  other:   { label: '기타',   emoji: '🐾', elements: ['토'],     keywords: ['든든함','고유함','특별함'], note: '세상에 하나뿐인 고유한 기운을 가진 특별한 존재' },
};

/** UI용 성격 키워드 선택지 */
export const PET_PERSONALITY_OPTIONS: string[] = [
  '활발한', '조용한', '장난꾸러기', '겁이 많음', '애교가 많음',
  '독립적', '먹보', '귀염둥이', '호기심 많음', '까다로움',
];

export interface PetInput {
  name: string;
  species: PetSpecies;
  gender: 'male' | 'female' | 'unknown';
  personalityKeywords: string[]; // 0~3개
  birthDate?: string;   // YYYY-MM-DD (선택)
  adoptionDate?: string; // YYYY-MM-DD (선택)
}

/**
 * 반려동물 궁합 프롬프트.
 * - 주인 사주는 실제 명리 데이터(buildPersonBlock 재사용)
 * - 반려동물 쪽은 종별 상징 기운 + 성격 키워드로 주입
 * - 출력 분량 700~900자 (다른 궁합보다 짧게, 가볍게)
 * - 첫 줄 은유 제목 / 섹션 4개 / 마지막 재미 해석 안내
 */
export const generatePetGunghapPrompt = (
  owner: SajuResult,
  ownerName: string,
  pet: PetInput,
): string => {
  const vibe = PET_SPECIES_VIBE[pet.species];
  const speciesLine = `${vibe.label} ${vibe.emoji} · 상징 기운: ${vibe.elements.join('·')}오행 (${vibe.keywords.join('·')})`;
  const genderLine = pet.gender === 'male' ? '수컷' : pet.gender === 'female' ? '암컷' : '성별 모름';
  const personalityLine = pet.personalityKeywords.length > 0
    ? pet.personalityKeywords.join('·')
    : '특별히 표시된 키워드 없음';
  const adoptionLine = pet.adoptionDate
    ? `함께한 날: ${pet.adoptionDate} — 이 시기의 기운이 두 존재의 첫 연결을 상징합니다.`
    : '함께한 날 정보 없음 — 언제 만났든 지금의 인연이 의미 있습니다.';
  const birthLine = pet.birthDate
    ? `${pet.name}의 생일: ${pet.birthDate}`
    : `${pet.name}의 정확한 생일은 모름 (반려동물의 생시는 대부분 불명이라 자연스러운 일입니다)`;

  return `당신은 사주명리 전문가이자 반려동물 라이프스타일 컨설턴트입니다.
주인의 사주와 반려동물의 상징 기운을 엮어 두 존재의 '같이 사는 케미'를 따뜻하고 재미있게 풀어주세요.

[절대 규칙]
- Markdown·이모지 금지. 섹션 제목은 "▶ 제목" 형식으로만.
- 주인(${ownerName})의 사주 데이터는 실제 명리 기반으로 해석. 반려동물(${pet.name})의 기운은 종별 상징 매핑이며, "정통 사주가 아닌 재미 해석"임을 본문 1~2곳에 자연스럽게 녹일 것.
- 출력은 첫 줄에 관계를 상징하는 은유 제목(7~14자)으로 시작. 대괄호·섹션 태그·식별자는 절대 출력하지 말 것.
- 각 섹션 본문에 달·별·계절·자연 이미지 은유 1문장 이상 포함.
- 친근한 말투 허용: "우리 ${pet.name}", "${pet.name}이(가) ~해줘요" 같은 따뜻한 호칭 사용.
- 총 분량: 900~1,200자. 재미 카테고리이므로 과하게 심각하거나 장황하지 않게.
- 예언·경고 어조 금지. 주인-반려동물의 일상 케미·케어 포인트에 집중.
- 각 섹션 본문은 2~3문단으로 나누고 문단 사이 빈 줄 필수. 한 덩어리로 붙이지 말 것.

[주인 ${ownerName} 사주]
${buildPersonBlock(owner, ownerName)}

[반려동물 ${pet.name} 정보]
${speciesLine}
성별: ${genderLine}
성격 키워드: ${personalityLine}
종의 상징 메시지: ${vibe.note}
${birthLine}
${adoptionLine}

${METAPHOR_SHORT_GUIDE}
${METAPHOR_TITLE_RULE}
${GUNGHAP_SECTION_FORMAT}

[작성 지침 — 아래 4개 섹션을 순서대로 작성하세요]

▶ 우리 ${pet.name}이(가) 당신에게 주는 에너지 (200~260자)
주인(${ownerName})의 일간 오행과 ${pet.name}의 상징 기운(${vibe.elements.join('·')})이 만나 어떤 일상의 균형을 만드는지 풀어주세요. 주인의 부족한 오행을 ${pet.name}이 채워준다면 구체적으로. 주인의 신강신약과 ${pet.name}의 ${vibe.keywords[0]}·${vibe.keywords[1]} 기운이 어떻게 서로를 보완하는지 일상 장면 1개로 묘사. 성격 키워드(${personalityLine})가 있다면 그중 1개를 근거로 활용.

▶ 당신이 ${pet.name}에게 맞춰주면 좋은 부분 (180~240자)
주인의 기질(격국·신강신약 기반)로 봤을 때 ${pet.name}에게 혹시 놓치기 쉬운 부분이 뭔지, 그리고 ${vibe.label} 종 특성상 ${pet.name}이 원하는 케어 포인트가 무엇인지 연결해서 풀어주세요. 일상에서 실천할 수 있는 구체 제안 2가지 포함 (예: 놀이 방식, 공간 배치, 교감 시간대).

▶ 함께할 때 빛나는 시간대와 활동 (150~200자)
주인의 용신 오행을 근거로 ${pet.name}과 함께하면 좋은 시간대(오전/오후/저녁 중)와 활동(산책·실내놀이·간식·조용한 시간 등)을 구체적으로 추천. ${vibe.label}의 기본 리듬도 고려해 현실적으로.

▶ 이 관계가 더 깊어지는 개운 팁 (160~220자)
이 관계를 통해 주인이 얻는 정서적·운기적 선물을 한 문장으로. 이어서 관계를 오래 따뜻하게 유지하는 실용 팁 2가지 (예: 사진·기록 남기기, 함께하는 기념일 챙기기, 주기적 건강 체크). 마지막 줄에 "반려동물 궁합은 주인의 사주와 동물 상징 기운으로 엮은 재미 해석이에요" 같은 한 줄을 자연스럽게 녹여 마무리.

`;
};

// ============================================================
// 상담소 — 챗봇 시스템 프롬프트
// ============================================================

export interface ConsultationStatus {
  relationshipStatus?: string;  // 연애상태 (솔로/연애중/결혼/기타)
  job?: string;                 // 직업/일
  concern?: string;             // 요즘 고민 키워드
}

/**
 * SajuResult + Profile + Status를 종합해 상담소 시스템 프롬프트 생성.
 * 사용자의 질문에 대해 사주 데이터 기반으로 친근하고 구체적인 해설을 생성하도록 유도.
 */
function getTenGodForMonth(dayGan: string, targetGan: string): string {
  const map = (TEN_GODS_MAP as Record<string, Record<string, string>>)[dayGan] || {};
  return map[targetGan] || '';
}

// 월지(사주력 월 → 지지)
const _MONTH_BRANCH_MAP: Record<number, string> = {
  1: '인', 2: '묘', 3: '진', 4: '사', 5: '오', 6: '미',
  7: '신', 8: '유', 9: '술', 10: '해', 11: '자', 12: '축',
};

// 오호전환: 연간 → 인월의 천간 (비등간 동일 그룹)
const _WUHO: Record<string, Record<number, string>> = {
  '갑': { 1: '병', 2: '정', 3: '무', 4: '기', 5: '경', 6: '신', 7: '임', 8: '계', 9: '갑', 10: '을', 11: '병', 12: '정' },
  '기': { 1: '병', 2: '정', 3: '무', 4: '기', 5: '경', 6: '신', 7: '임', 8: '계', 9: '갑', 10: '을', 11: '병', 12: '정' },
  '을': { 1: '무', 2: '기', 3: '경', 4: '신', 5: '임', 6: '계', 7: '갑', 8: '을', 9: '병', 10: '정', 11: '무', 12: '기' },
  '경': { 1: '무', 2: '기', 3: '경', 4: '신', 5: '임', 6: '계', 7: '갑', 8: '을', 9: '병', 10: '정', 11: '무', 12: '기' },
  '병': { 1: '경', 2: '신', 3: '임', 4: '계', 5: '갑', 6: '을', 7: '병', 8: '정', 9: '무', 10: '기', 11: '경', 12: '신' },
  '신': { 1: '경', 2: '신', 3: '임', 4: '계', 5: '갑', 6: '을', 7: '병', 8: '정', 9: '무', 10: '기', 11: '경', 12: '신' },
  '정': { 1: '임', 2: '계', 3: '갑', 4: '을', 5: '병', 6: '정', 7: '무', 8: '기', 9: '경', 10: '신', 11: '임', 12: '계' },
  '임': { 1: '임', 2: '계', 3: '갑', 4: '을', 5: '병', 6: '정', 7: '무', 8: '기', 9: '경', 10: '신', 11: '임', 12: '계' },
  '무': { 1: '갑', 2: '을', 3: '병', 4: '정', 5: '무', 6: '기', 7: '경', 8: '신', 9: '임', 10: '계', 11: '갑', 12: '을' },
  '계': { 1: '갑', 2: '을', 3: '병', 4: '정', 5: '무', 6: '기', 7: '경', 8: '신', 9: '임', 10: '계', 11: '갑', 12: '을' },
};

/**
 * 월운 문자열 생성 — 절기 기반으로 정확하게 12개월 나열.
 * 현재 세운(연간) 천간을 WUHO에 넣어 각 사주력 월(인월=1 ~ 축월=12)의 월간을 계산.
 * AI가 "몇 월"을 말할 때 절기 경계를 명시하도록 절기 명·시작일도 함께 제공.
 */
function buildMonthUnsStr(saju: SajuResult, seWoon: SeWoon | undefined): string {
  if (!seWoon?.gan) return '월운 데이터 없음';
  const yearGan = seWoon.gan;
  const year = seWoon.year;

  // JEOLIP_DATA를 런타임에 require하지 않기 위해 직접 임포트된 값을 사용해야 하지만
  // 이 파일은 SajuResult만 다루므로, 간략화: 절기 시작월 대응표(양력월→사주력월)만 사용.
  // 사주력 월 1(인월) = 양력 2월 입춘~3월 경칩 전 … 사주력 월 12(축월) = 양력 1월 소한~2월 입춘 전.
  const SAJU_MONTH_RANGE: Record<number, string> = {
    1: '2월 초순(입춘)~3월 초순(경칩)',
    2: '3월 초순(경칩)~4월 초순(청명)',
    3: '4월 초순(청명)~5월 초순(입하)',
    4: '5월 초순(입하)~6월 초순(망종)',
    5: '6월 초순(망종)~7월 초순(소서)',
    6: '7월 초순(소서)~8월 초순(입추)',
    7: '8월 초순(입추)~9월 초순(백로)',
    8: '9월 초순(백로)~10월 초순(한로)',
    9: '10월 초순(한로)~11월 초순(입동)',
    10: '11월 초순(입동)~12월 초순(대설)',
    11: '12월 초순(대설)~1월 초순(소한)',
    12: '1월 초순(소한)~2월 초순(입춘)',
  };

  const lines: string[] = [];
  for (let sajuMonth = 1; sajuMonth <= 12; sajuMonth++) {
    const gan = _WUHO[yearGan]?.[sajuMonth] || '?';
    const zhi = _MONTH_BRANCH_MAP[sajuMonth];
    const tenGod = getTenGodForMonth(saju.dayMaster, gan);
    lines.push(`${gan}${zhi}(${tenGod}) — ${SAJU_MONTH_RANGE[sajuMonth]}`);
  }
  return `${year}년 월운 (절기 기준):\n${lines.join('\n')}`;
}

export function buildConsultationSystemPrompt(
  saju: SajuResult,
  profile: { name: string; birth_date: string; gender: 'male' | 'female'; calendar_type: 'solar' | 'lunar' },
  status: ConsultationStatus,
): string {
  const p = saju.pillars;
  const sipseongStr = formatSipseongCounts(computeSipseongCounts(saju));
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().getMonth() + 1;

  // 대운 — startAge/endAge는 연도(year)이므로 currentYear로 비교
  const _now = new Date();
  const _birth = new Date(profile.birth_date);
  let currentAge = _now.getFullYear() - _birth.getFullYear();
  const _md = _now.getMonth() - _birth.getMonth();
  if (_md < 0 || (_md === 0 && _now.getDate() < _birth.getDate())) currentAge--;
  const currentYear_consult = _now.getFullYear();
  const birthYear_consult = _birth.getFullYear();
  const currentDaeWoon = saju.daeWoon.find(d => currentYear_consult >= d.startAge && currentYear_consult <= d.endAge);
  const daeWoonStr = currentDaeWoon
    ? `${currentDaeWoon.gan}${currentDaeWoon.zhi} (${currentDaeWoon.startAge}~${currentDaeWoon.endAge}년, ${currentDaeWoon.startAge - birthYear_consult}~${currentDaeWoon.endAge - birthYear_consult}세, 현재 · ${currentDaeWoon.tenGod})`
    : saju.daeWoon.length === 0
    ? '대운 데이터 없음 (시간미상 프로필)'
    : `대운 전 상태 (첫 대운은 ${saju.daeWoonStartAge}세부터 시작)`;

  // 세운 (안전 가드)
  const seWoon = saju.currentSeWoon;
  const seWoonStr = seWoon
    ? `${seWoon.year}년 ${seWoon.gan}${seWoon.zhi}년 (${seWoon.tenGod}, ${seWoon.animal}띠 해)`
    : '세운 데이터 없음';

  // 월운 — 절기 기반으로 정확히 계산 (JEOLIP_DATA + 오호전환)
  const monthStr = buildMonthUnsStr(saju, seWoon);

  // 신살 (type별 그룹핑 — 길신/흉신 구분해서 제공)
  const goodSins = saju.sinSals.filter(s => s.type === 'gilseong').map(s => s.name);
  const badSins = saju.sinSals.filter(s => s.type === 'sinsal').map(s => s.name);
  const neutralSins = saju.sinSals.filter(s => s.type === 'sinsal').map(s => s.name);
  const sinSalLines: string[] = [];
  if (goodSins.length > 0) sinSalLines.push(`길신: ${goodSins.join(', ')}`);
  if (badSins.length > 0) sinSalLines.push(`흉신: ${badSins.join(', ')}`);
  if (neutralSins.length > 0) sinSalLines.push(`중립: ${neutralSins.join(', ')}`);
  const sinSalStr = sinSalLines.length > 0 ? sinSalLines.join(' / ') : '특별 신살 없음';

  // 합·충·형
  const interactionStr = saju.interactions.length > 0
    ? saju.interactions.map(i => `${i.type}: ${i.description}`).join(' / ')
    : '뚜렷한 합충 없음';

  return `당신은 35년 경력의 노련한 사주명리 상담가입니다. ${profile.name}님의 개인 상담소에 방문한 AI 도사로서, 아래 사주 데이터를 바탕으로 질문에 친근하면서도 명리학적으로 정확한 답변을 제공합니다.

[의뢰인 기본 정보]
이름: ${profile.name}
성별: ${profile.gender === 'male' ? '남성' : '여성'}
생년월일: ${profile.birth_date} (${profile.calendar_type === 'solar' ? '양력' : '음력'})
나이: ${currentAge}세
현재 연애상태: ${status.relationshipStatus || '미입력'}
직업/일: ${status.job || '미입력'}
요즘 고민: ${status.concern || '미입력'}
오늘 날짜: ${today} (${currentMonth}월)

[사주 원국 4주]
연주: ${p.year.gan}${p.year.zhi} (${p.year.ganElement}·${p.year.zhiElement}) / 지장간: ${p.year.hiddenStems.join(',')}
월주: ${p.month.gan}${p.month.zhi} (${p.month.ganElement}·${p.month.zhiElement}) / 지장간: ${p.month.hiddenStems.join(',')}
일주: ${p.day.gan}${p.day.zhi} (일간: ${saju.dayMaster} ${saju.dayMasterElement}·${saju.dayMasterYinYang}간) / 지장간: ${p.day.hiddenStems.join(',')}
시주: ${saju.hourUnknown ? '시간미상' : `${p.hour.gan}${p.hour.zhi} (${p.hour.ganElement}·${p.hour.zhiElement}) / 지장간: ${p.hour.hiddenStems.join(',')}`}

[오행 분포]
목 ${saju.elementPercent.목}% / 화 ${saju.elementPercent.화}% / 토 ${saju.elementPercent.토}% / 금 ${saju.elementPercent.금}% / 수 ${saju.elementPercent.수}%
강한 오행: ${saju.strongElement} / 약한 오행: ${saju.weakElement}

[십성 분포]
${sipseongStr}

[신강·신약]
${saju.strengthStatus} (점수 ${saju.strengthScore}): ${saju.strengthAnalysis}
득령: ${saju.deukRyeong ? 'O' : 'X'} / 득지: ${saju.deukJi ? 'O' : 'X'} / 득세: ${saju.deukSe ? 'O' : 'X'}

[격국]
${determineGyeokguk(saju).name}

[용신·희신·기신]
용신: ${saju.yongSin}(${saju.yongSinElement}) — 보충해야 할 핵심 기운
희신: ${saju.heeSin} — 돕는 기운
기신: ${saju.giSin} — 피해야 할 기운

[신살]
${sinSalStr}

[원국 내 합·충·형]
${interactionStr}

[간여지동 / 병존]
${saju.ganYeojidong.length > 0 ? saju.ganYeojidong.map(g => {
  const pMap: Record<string, string> = { year: '연', month: '월', day: '일', hour: '시' };
  return `${pMap[g.pillar] || g.pillar}주 ${g.gan}${g.zhi}(${g.element})`;
}).join(' / ') : '없음'}

[현재 대운]
${daeWoonStr}

[올해 세운]
${seWoonStr}

[이번 해 월운]
${monthStr}

━━━━━━━━━━━━━━━━━━━━━━━━
[답변 작성 규칙 — 절대 준수]

1. **길이**: 500~800자. 너무 짧으면 성의 없어 보이고(사용자가 "에게?"라고 느낌), 너무 길면 읽기 부담. 4~6단락.

2. **구조** (순서대로):
   - 공감 훅 1~2줄 (이름 호명 + 질문 상황 공감)
   - 핵심 결론 1줄 (두괄식)
   - 명리 근거 (원국·세운·십성 구체 인용)
   - 시기 예측 (월운 기반으로 "몇 월에 어떻다")
   - 개운법 1~2가지 (용신 ${saju.yongSinElement} 기반, 색·방향·행동)
   - 따뜻한 마무리 1줄

3. **말투**: 친근한 구어체 ("~시죠", "~예요", "~해보세요"). 반말·욕설 금지.

4. **개인화**:
   - 이름("${profile.name}님")을 자연스럽게 2~3회 호명
   - 연애상태·직업 정보가 있으면 해당 주제에서 자연스럽게 반영
   - "요즘 고민"이 입력되어 있으면: 질문이 모호하거나 "뭐든 봐주세요" 류일 때 해당 고민 주제를 우선적으로 다루되, 사용자가 명시적으로 다른 주제를 물으면 그 질문에 집중. 고민 키워드는 답변의 맥락 참고용이지, 모든 답변에 억지로 끼워넣지 말 것.
   - 막연한 답변 금지. "좋습니다" 대신 "7월에 상관 기운이 들어와 표현력이 강해집니다" 식 구체성

5. **명리 인용 방식**:
   - 원국 글자("일지 ${p.day.zhi}") 또는 십성("정재") 직접 인용
   - 용신·기신 활용해서 "이 기운이 부족해서 이런 현상이 생깁니다" 설명
   - 신살은 관련될 때만 1~2개 언급

6. **개운법**:
   - 용신 오행 ${saju.yongSinElement}에 맞는 색·방향·행동 1가지
   - 질문 주제에 맞는 추가 처방 1가지
   - "${saju.yongSinElement === '목' ? '초록색·동쪽·식물' : saju.yongSinElement === '화' ? '붉은색·남쪽·채광' : saju.yongSinElement === '토' ? '노란색·중앙·흙' : saju.yongSinElement === '금' ? '흰색·서쪽·금속' : '검정색·북쪽·물'}"을 기본 공식으로 활용

7. **금지**:
   - Markdown 기호(##, **, -, > 등) 절대 사용 금지. 일반 문장·단락으로만.
   - 이모지 금지.
   - "AI로서", "챗봇으로서" 같은 자기 정체성 언급 금지.
   - "자세한 건 전문가와 상담" 같은 책임 회피 문구 금지.

8. **시기 질문 ("언제?")**: 반드시 위 "이번 해 월운" 데이터를 근거로 구체적 월을 제시하세요. 양력 월로 표현하되, 위 데이터의 절기 범위(예: "2월 초순~3월 초순")를 보고 실제 해당 기간을 정확히 말하세요. "곧", "조만간" 같은 모호한 표현 금지.

9. **대화 연속성**: 이전 대화 내용이 있으면 참고해서 일관된 페르소나 유지.

${METAPHOR_SHORT_GUIDE}
`;
}

// ============================================================
// 더 많은 운세 — 9개 카테고리별 짧은 형식 프롬프트
// (달 크레딧 1개 소모, 400~700자 본문, 핵심만 집중)
// ============================================================

/** 공통 원국 블록 — 더 많은 운세 프롬프트 재사용 */
function buildMoreFortuneBlock(result: SajuResult): string {
  const p = result.pillars;
  const sipseong = formatSipseongCounts(computeSipseongCounts(result));
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().getMonth() + 1;

  const now = new Date();
  const birth = new Date(result.solarDate);
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
    age--;
  }

  const sinSalStr = result.sinSals.length > 0
    ? result.sinSals.map(s => `${s.name}(${s.type === 'gilseong' ? '길성' : '신살'})`).join(' · ')
    : '특별 신살 없음';

  return `[원국]
연주 ${p.year.gan}${p.year.zhi} / 월주 ${p.month.gan}${p.month.zhi} / 일주 ${p.day.gan}${p.day.zhi} / 시주 ${result.hourUnknown ? '시간미상' : `${p.hour.gan}${p.hour.zhi}`}
일간: ${result.dayMaster} ${result.dayMasterElement}(${result.dayMasterYinYang}간)
오행: 목${result.elementPercent.목}% 화${result.elementPercent.화}% 토${result.elementPercent.토}% 금${result.elementPercent.금}% 수${result.elementPercent.수}%
강한 오행: ${result.strongElement} / 약한 오행: ${result.weakElement}
신강신약: ${result.strengthStatus}(${result.strengthScore})
십성: ${sipseong}
용신: ${result.yongSin}(${result.yongSinElement}) / 기신: ${result.giSin}
신살: ${sinSalStr}
세운(${result.currentSeWoon?.year}): ${result.currentSeWoon?.gan}${result.currentSeWoon?.zhi} (${result.currentSeWoon?.tenGod})
성별: ${result.gender === 'male' ? '남' : '여'} / 나이: ${age}세 / 오늘: ${today} (${currentMonth}월)`;
}

const MORE_COMMON_RULES = `[공통 규칙]
1) Markdown(#, ##, **, \`\`, >) 절대 금지. 이모지 금지. AI 티("AI로서", "분석 결과") 금지.
2) 위 원국 데이터 근거로만 풀이. 없는 데이터 창작 금지.
3) 구어체 "~합니다/~예요". 단정적 톤. "~일 수도 있습니다" 흐린 표현 답변 전체 2회 이하.
4) 첫 줄에 은유 제목 1줄 (대비되는 두 자연 이미지, 쉼표 연결). 본문에서 회수.
5) 시기 질문에는 반드시 구체적 월(양력)을 제시. "곧·조만간" 금지.
6) 마지막에 "- " 불릿 2~3개로 실천 조언.

${METAPHOR_KB}
${METAPHOR_TITLE_RULE}`;

// ─────────────────────────────────────────────
// 1. 애정운 (짧은 버전)
// ─────────────────────────────────────────────
export const generateLoveShortPrompt = (result: SajuResult): string => {
  const p = result.pillars;
  const jaeseongEl = EL_CON[result.dayMasterElement] || ''; // 재성 오행
  const gwanseongEl = Object.entries(EL_CON).find(([, v]) => v === result.dayMasterElement)?.[0] || ''; // 관성 오행

  return `당신은 35년 경력의 사주명리 전문가입니다. 아래 사람의 애정운을 짧고 명확하게 풀어주세요.

${buildMoreFortuneBlock(result)}

[애정 관련 포커스]
- 일지(배우자궁): ${p.day.zhi}
- ${result.gender === 'male' ? `재성 오행(=이성 에너지): ${jaeseongEl}` : `관성 오행(=이성 에너지): ${gwanseongEl}`}
- 도화·홍염·원진 신살 여부: ${result.sinSals.filter(s => ['도화살', '홍염살', '원진살'].includes(s.name)).map(s => s.name).join(', ') || '특별 신살 없음'}

${MORE_COMMON_RULES}

[작성 지침] 400~550자 내외
1단락 — 공감 한 줄 + 핵심 결론(연애 에너지 강/약)
2단락 — 일지 ${p.day.zhi} 배우자궁과 ${result.gender === 'male' ? `재성(${jaeseongEl})` : `관성(${gwanseongEl})`} 분포로 본 "내가 끌리는 상대 유형"
3단락 — 올해 세운 기준 연애·만남이 활성화되는 달 1~2개 (월운 근거)
4단락 — 관계에서 반복되는 패턴 1개 + "- " 불릿 2~3개 실천 조언`;
};

// ─────────────────────────────────────────────
// 2. 재물운 (짧은 버전)
// ─────────────────────────────────────────────
export const generateWealthShortPrompt = (result: SajuResult): string => {
  const counts = computeSipseongCounts(result);
  const jaeTotal = (counts['정재'] || 0) + (counts['편재'] || 0);
  const siksangTotal = (counts['식신'] || 0) + (counts['상관'] || 0);

  return `당신은 35년 경력의 사주명리 전문가입니다. 아래 사람의 재물운을 짧고 명확하게 풀어주세요.

${buildMoreFortuneBlock(result)}

[재물 관련 포커스]
- 재성 합계: ${jaeTotal}개 (정재 ${counts['정재'] || 0} / 편재 ${counts['편재'] || 0})
- 식상(재물 생성): ${siksangTotal}개
- 재고(辰戌丑未): ${['진','술','축','미'].filter(z => [result.pillars.year.zhi, result.pillars.month.zhi, result.pillars.day.zhi, result.pillars.hour.zhi].includes(z)).join('·') || '없음'}

${MORE_COMMON_RULES}

[작성 지침] 400~550자 내외
1단락 — 공감 한 줄 + 재물 에너지 한 줄 결론
2단락 — 재성 구조로 본 돈 버는 스타일(월급형·사업형·투자형 중 선택) + 근거
3단락 — 올해 세운 기준 돈이 들어오는 달 / 새는 달 각 1개씩 월운 근거 포함
4단락 — 반복되는 금전 함정 1개 + "- " 불릿 2~3개 실천 조언`;
};

// ─────────────────────────────────────────────
// 3. 직업·진로운
// ─────────────────────────────────────────────
export const generateCareerShortPrompt = (result: SajuResult): string => {
  const counts = computeSipseongCounts(result);
  const gwan = (counts['정관'] || 0) + (counts['편관'] || 0);
  const siksang = (counts['식신'] || 0) + (counts['상관'] || 0);
  const inseong = (counts['정인'] || 0) + (counts['편인'] || 0);
  const gyeokguk = determineGyeokguk(result).name;

  return `당신은 35년 경력의 사주명리 전문가입니다. 아래 사람의 직업·진로운을 짧고 명확하게 풀어주세요.

${buildMoreFortuneBlock(result)}

[직업 관련 포커스]
- 격국: ${gyeokguk}
- 관성(조직·권위): ${gwan}개 / 식상(창의·기술): ${siksang}개 / 인성(학문·전문성): ${inseong}개
- 일지 12운성: ${result.pillars.day.twelveStage || '—'}

${MORE_COMMON_RULES}

[작성 지침] 400~550자 내외
1단락 — 결론: 조직형인지 독립형인지 + 가장 잘 맞는 직군 2~3개 구체 제시
2단락 — 격국(${gyeokguk})과 관성·식상 비율로 본 적성 근거
3단락 — 이직·승진·창업 중 올해 유리한 행동 + 월운 기반 타이밍 1개
4단락 — 피해야 할 환경 1개 + "- " 불릿 2~3개 실천 조언`;
};

// ─────────────────────────────────────────────
// 4. 건강운
// ─────────────────────────────────────────────
export const generateHealthShortPrompt = (result: SajuResult): string => {
  const organ: Record<string, string> = {
    '목': '간·담(쓸개)', '화': '심장·소장', '토': '비장·위장·췌장',
    '금': '폐·대장', '수': '신장·방광',
  };
  // 지지 → 장부 매핑 (전통 한의학 경락 기준)
  const BRANCH_ORGAN: Record<string, string> = {
    '자': '신장·방광', '축': '비장', '인': '간·담', '묘': '간·담', '진': '비장·위',
    '사': '심장·소장', '오': '심장·소장', '미': '비장', '신': '폐·대장',
    '유': '폐·대장', '술': '위장·비장', '해': '신장·방광',
  };
  const parseOrganImpact = (desc: string): string => {
    const zhis = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
    const found = zhis.filter(z => desc.includes(z));
    if (found.length === 0) return '';
    return ' → ' + found.map(z => `${z}(${BRANCH_ORGAN[z]})`).join(' vs ');
  };
  const weakOrgan = organ[result.weakElement] || '';
  const strongOrgan = organ[result.strongElement] || '';
  // 충·형 구조를 장부 충돌까지 풀어서 제공 (예: "사해충 → 사(심장·소장) vs 해(신장·방광)")
  const chungHyeongDetail = result.interactions
    .filter(i => ['충', '형'].includes(i.type))
    .map(i => `${i.description}${parseOrganImpact(i.description)}`)
    .join(' / ') || '없음';
  // 건강 관련 주의 신살 (혈광/급성)
  const healthRiskKeys = ['백호','양인','겁살','재살','원진','급각','탕화'];
  const healthRisk = result.sinSals
    .filter(s => healthRiskKeys.some(k => s.name.includes(k)))
    .map(s => `${s.name}(${s.type === 'gilseong' ? '길성' : '신살'})`)
    .join(' · ') || '없음';

  return `당신은 35년 경력의 사주명리 전문가입니다. 아래 사람의 건강운을 짧고 명확하게 풀어주세요.

${buildMoreFortuneBlock(result)}

[건강 관련 포커스]
- 약한 오행 ${result.weakElement}(${result.elementPercent[result.weakElement as keyof typeof result.elementPercent]}%) → 취약 장부: ${weakOrgan}
- 강한 오행 ${result.strongElement}(${result.elementPercent[result.strongElement as keyof typeof result.elementPercent]}%) → 과열 장부: ${strongOrgan}
- 주요 충·형(장부 충돌): ${chungHyeongDetail}
- 건강 주의 신살(혈광·급성·돌발): ${healthRisk}
- 올해 세운 오행: ${result.currentSeWoon?.ganElement}·${result.currentSeWoon?.zhiElement}

${MORE_COMMON_RULES}

[작성 지침] 380~520자 내외
1단락 — 결론: 타고난 체질 한 줄 + 올해 특히 주의할 장부 1개 (충·형 장부 충돌 있으면 그걸 우선 지목)
2단락 — 약한 오행(${result.weakElement})이 만드는 증상 2개 구체적 (피로·두통·소화 등 일상 감각으로 묘사)
3단락 — 충·형 장부 충돌 또는 주의 신살이 있으면 그것이 일으킬 수 있는 급성 증상·돌발 상황 1개 구체적으로. 없으면 "특별한 혈광 위험은 없다"고 단정
4단락 — 올해 세운이 건강에 미치는 영향 + 주의할 달 1개
마지막 — "- " 불릿 3개로 실천 습관(피할 음식/추천 음식/생활 리듬)`;
};

// ─────────────────────────────────────────────
// 5. 학업·시험운
// ─────────────────────────────────────────────
export const generateStudyShortPrompt = (result: SajuResult): string => {
  const p = result.pillars;
  const counts = computeSipseongCounts(result);
  const sipseong = formatSipseongCounts(counts);
  const inseong = (counts['정인'] || 0) + (counts['편인'] || 0);
  const siksang = (counts['식신'] || 0) + (counts['상관'] || 0);
  const bigyeop = (counts['비견'] || 0) + (counts['겁재'] || 0);
  const gwanseong = (counts['정관'] || 0) + (counts['편관'] || 0);
  const gyeokguk = determineGyeokguk(result).name;

  const academicSinSals = result.sinSals
    .filter(s => ['문창', '학당', '문곡', '천문', '화개', '천덕', '월덕'].some(k => s.name.includes(k)))
    .map(s => `${s.name}(${s.description})`)
    .join(' · ') || '없음';
  const negSinSals = result.sinSals
    .filter(s => ['도화', '역마', '겁살', '망신'].some(k => s.name.includes(k)))
    .map(s => `${s.name}(${s.description})`)
    .join(' · ') || '없음';

  const interactionStr = result.interactions.length > 0
    ? result.interactions.map(i => `${i.type}: ${i.description}`).join(', ')
    : '없음';

  const birthYear = result.solarDate ? new Date(result.solarDate).getFullYear() : 0;
  const currentYear = new Date().getFullYear();
  const currentDaeWoon = result.daeWoon.find(d => d.gan && d.zhi && currentYear >= d.startAge && currentYear <= d.endAge);
  const fmtDW = (d: DaeWoon) => {
    const as = birthYear > 0 ? d.startAge - birthYear : d.startAge;
    const ae = birthYear > 0 ? d.endAge - birthYear : d.endAge;
    return `${as}~${ae}세 ${d.gan}${d.zhi}(${d.tenGod}·${d.twelveStage})`;
  };
  const currentDaeWoonStr = currentDaeWoon ? fmtDW(currentDaeWoon) : '아직 시작 전';
  const nearDaeWoon = result.daeWoon
    .filter(d => d.gan && d.zhi && d.endAge >= currentYear)
    .slice(0, 3)
    .map(d => fmtDW(d))
    .join(' → ');

  const recentSeWoon = result.seWoon
    .filter(s => s.year >= currentYear && s.year <= currentYear + 2)
    .map(s => `${s.year}년 ${s.gan}${s.zhi}(${s.tenGod}·${s.twelveStage})`)
    .join(' | ');

  return `당신은 35년 경력의 사주명리 전문가입니다. 아래 사람의 학업·시험운을 심층적으로 풀어주세요.

${buildMoreFortuneBlock(result)}

[학업 심층 데이터]
- 격국: ${gyeokguk} / 신강신약: ${result.strengthStatus}(${result.strengthScore})
- 일간 ${result.dayMaster}(${result.dayMasterElement}·${result.dayMasterYinYang}) — 12운성: ${p.day.twelveStage}
- 인성(공부 흡수력 — 정인${counts['정인'] || 0}+편인${counts['편인'] || 0}): 합계 ${inseong}개
  → 정인 높으면 정규 교육·이론 학습, 편인 높으면 독학·자격증·비정규 학습
- 식상(표현·논술·면접 — 식신${counts['식신'] || 0}+상관${counts['상관'] || 0}): 합계 ${siksang}개
  → 식신 높으면 안정적 서술·객관식, 상관 높으면 구술·프레젠테이션·창의 논술
- 관성(집중·규율 — 정관${counts['정관'] || 0}+편관${counts['편관'] || 0}): 합계 ${gwanseong}개
- 비겁(경쟁심·동기부여): ${bigyeop}개
- 십성 전체 분포: ${sipseong}
- 용신: ${result.yongSin}(${result.yongSinElement}) / 기신: ${result.giSin}

[학업 관련 신살]
- 길신(학업 촉진): ${academicSinSals}
  · 문창귀인 → 글쓰기·어학·인문계 강점
  · 학당귀인 → 학벌 좋은 인연·정규 교육 유리
  · 화개살 → 연구직·종교·예술·철학 적성
- 주의 신살(산만·외부 유혹): ${negSinSals}
  · 도화살 → 인간관계에 에너지 빠짐, 혼자 집중하는 환경 필요
  · 역마살 → 한 자리에 오래 못 앉는 구조, 이동·현장 학습형

[원국 합충형파해]
${interactionStr}
→ 충이 인성 위치면 학업 중단·변경 위험 / 합이 인성이면 안정적 학습 환경

[대운·세운 — 학업 시기]
- 현재 대운: ${currentDaeWoonStr}
- 향후 대운 흐름: ${nearDaeWoon}
  → 인성 대운 구간 = 공부로 인생이 바뀌는 시기 / 식상 대운 = 자격·시험 합격 가능
- 세운(올해~2년): ${recentSeWoon}
  → 세운 십성이 인성이면 학습 효율 최고 / 식상이면 표현·시험 발표 유리 / 관성이면 집중력 상승

${MORE_COMMON_RULES}

[작성 지침] 본문 총량 **600~780자** (압축·핵심 위주. 추상 격언 금지, 구체 행동·과목·시기만)
단락들은 한 편의 글처럼 자연스럽게 이어질 것 — "그래서", "그 까닭은" 같은 연결어로 마디 잇기. 다만 각 단락은 짧고 핵심만, 늘어지는 묘사 금지.

★ 첫 줄: 은유 제목 (계절·자연·빛 이미지로 학업 체질 결을 한 줄)
★ 빈 줄
★ 본문 첫 문장은 반드시 위 제목 은유로 시작 (별도 은유 도입 금지 — 두 다른 은유가 동시 등장하면 사고)

1단락 (80~110자) — 제목 은유로 시작해 학업 체질 한 줄 단정 (암기형/사고형/표현형/독학형 중 어떤 유형). 격국·십성 근거 1개만 노출하고 일상어 즉시 풀이. 추가 묘사 금지
2단락 (90~130자) — 인성·식상·관성 비율로 본 강점 영역 1~2개 + 약점 1개. 시험 유형 적성 한 줄 (객관식·논술·면접·실기 중 어느 쪽 강자인지 단정)
3단락 (50~80자) — 학업 관련 신살이 만드는 학습 패턴 핵심만 (문창=어학·글쓰기, 학당=정규교육, 화개=연구, 도화=집중력 저하 등). **있는 신살만** 짧게
4단락 (160~200자) — **실전 학습 매칭** — 4가지를 각 한 줄로 압축:
  · 공부 환경: 혼자 vs 그룹 vs 카페 vs 도서관 중 하나로 단정 (비겁·도화 근거 한 호흡)
  · 공부 시간대: ${result.yongSinElement === '목' ? '오전 5~9시' : result.yongSinElement === '화' ? '오전 11시~오후 3시' : result.yongSinElement === '토' ? '오후 1시~5시' : result.yongSinElement === '금' ? '오후 3시~7시' : '오후 9시~새벽 1시'} (이유 한 호흡)
  · 공부 방법: 시각형(노트) / 청각형(인강) / 토론형 / 필기형 중 하나로 단정
  · 강점 과목 vs 약점 과목: 강한 오행 = ${result.yongSinElement === '목' ? '어학·문학' : result.yongSinElement === '화' ? '예술·심리' : result.yongSinElement === '토' ? '역사·지리' : result.yongSinElement === '금' ? '수학·논리' : '철학·이공계'} 결, 약한 오행 = 의식적 보강. **구체 과목명 명시**
5단락 (70~100자) — 현재 대운 + 올해 세운 영향 한 줄 + 유리한 달 2개만 (월·근거 1줄). 길게 묘사 금지
6단락 (50~70자) — 3년 내 가장 좋은 시기 1개 + 그 시기 핵심 한 줄 (세운·대운 교차 근거)

빈 줄
**이렇게 하면 도움돼요** (헤더 그대로 사용, "결론"·"종합"·"마무리" 금지)
- (시험 직전 루틴 한 줄 — 구체 행동, 추상 격언 금지)
- (약한 과목 보완법 한 줄 — 구체 학습 방법)
- (슬럼프 대처 한 줄 — 구체 활동)
- (유리한 시험 유형 한 줄 — 경쟁 시험 vs 절대평가 vs 자격증 중 단정)

★ 마지막 한 줄 (30~50자): 제목 은유 회수 + 짧은 응원 (긴 격언 금지)`;
};

// ─────────────────────────────────────────────
// 6. 인간관계·귀인운
// ─────────────────────────────────────────────
export const generatePeopleShortPrompt = (result: SajuResult): string => {
  const counts = computeSipseongCounts(result);
  const bigyeop = (counts['비견'] || 0) + (counts['겁재'] || 0);
  const inseong = (counts['정인'] || 0) + (counts['편인'] || 0);
  const hasCheonEul = result.sinSals.some(s => s.name.includes('천을귀인'));
  const hasGongmang = result.sinSals.some(s => s.name.includes('공망'));
  // 관계 주의 신살 — 배신·갈등·고독·극단성
  const relationRiskMap: Record<string, string> = {
    '백호': '배신·칼부림형 갈등',
    '괴강': '극단적 성격·군림',
    '원진': '미움이 쌓이는 관계',
    '양인': '동업·재물 갈등 칼',
    '고신': '인연 박한 자리(남)',
    '과숙': '인연 박한 자리(여)',
    '격각': '가까워도 멀어지는 관계',
    '상문': '장례·이별 관련',
    '조객': '조문·거리감',
  };
  const relationRisk = result.sinSals
    .map(s => {
      const key = Object.keys(relationRiskMap).find(k => s.name.includes(k));
      return key ? `${s.name}(${relationRiskMap[key]})` : null;
    })
    .filter((x): x is string => x !== null)
    .join(' · ') || '없음';
  // 배우자궁 안정성 — 일지(배우자궁) 충·형·공망
  const dayZhi = result.pillars.day.zhi;
  const spouseTension = result.interactions
    .filter(i => ['충', '형', '파', '해'].includes(i.type) && i.description.includes(dayZhi))
    .map(i => `${i.type}(${i.description})`)
    .join(' / ') || '안정';

  return `당신은 35년 경력의 사주명리 전문가입니다. 아래 사람의 인간관계·귀인운을 짧고 명확하게 풀어주세요.

${buildMoreFortuneBlock(result)}

[관계 관련 포커스]
- 비겁(동료·경쟁자): ${bigyeop}개
- 인성(윗사람·멘토): ${inseong}개
- 천을귀인 성립(결정적 조력자): ${hasCheonEul ? '예' : '아니오'}
- 공망 여부: ${hasGongmang ? '있음(인연 박한 자리)' : '없음'}
- 경계 신살(배신·갈등·고독): ${relationRisk}
- 배우자궁(일지 ${dayZhi}) 안정성: ${spouseTension}

${MORE_COMMON_RULES}

[작성 지침] 430~580자 내외
1단락 — 결론: 넓은 인맥형 vs 좁고 깊은 우정형
2단락 — 비겁·인성 배치로 본 올해 나를 돕는 사람 유형(연령·성별·관계 구체적으로). 천을귀인 성립 시 그 귀인의 특성을 꼭 묘사
3단락 — **경계 신살이 있으면** 그 신살 원인으로 **구체적 관계 유형 1~2가지**(동업자·연인·가족 등) 명확히 지목. 없으면 "치명적 악연 흐름은 없다"고 단정. 올해 세운 기준 갈등 유발 가능한 달 1개
${spouseTension !== '안정' ? '4단락 — 배우자궁이 흔들리는 구조라 동거·결혼·동업 같은 "장기 관계"에서 갈라짐·반복 이별이 일어나기 쉬움을 직설적으로 묘사' : ''}
마지막 — "- " 불릿 2~3개로 관계 개선 실천 조언 (경계할 유형·거리 둘 타이밍·의지할 사람 포함)`;
};

// ─────────────────────────────────────────────
// 7. 자녀·출산운
// ─────────────────────────────────────────────
export const generateChildrenShortPrompt = (result: SajuResult): string => {
  const p = result.pillars;
  const counts = computeSipseongCounts(result);
  const sipseong = formatSipseongCounts(counts);
  const gyeokguk = determineGyeokguk(result).name;

  const isMale = result.gender === 'male';
  const jaNyeoStarLabel = isMale ? '관성(정관+편관)' : '식상(식신+상관)';
  const jaNyeoStarDetail = isMale
    ? `정관 ${counts['정관'] || 0} + 편관 ${counts['편관'] || 0}`
    : `식신 ${counts['식신'] || 0} + 상관 ${counts['상관'] || 0}`;
  const jaNyeoTotal = isMale
    ? (counts['정관'] || 0) + (counts['편관'] || 0)
    : (counts['식신'] || 0) + (counts['상관'] || 0);
  const antiStar = isMale
    ? `식상(관성을 극하는 기운 — 상관견관): 식신${counts['식신'] || 0}+상관${counts['상관'] || 0}`
    : `편인(식상을 극하는 기운 — 도식): 편인${counts['편인'] || 0}`;

  const hourInfo = result.hourUnknown
    ? '시간미상 — 자녀궁 직접 해석 불가, 연·월·일주 중심으로 판단'
    : `시주 ${p.hour.gan}${p.hour.zhi}(${p.hour.ganElement}·${p.hour.tenGodGan}) — 12운성: ${p.hour.twelveStage}
  시지 지장간: ${p.hour.hiddenStems.join(', ')} → 자녀궁 내부 에너지 구성
  시주 공망: ${p.hour.isKongmang ? '공망(자녀궁 비어있는 구조 — 인연 박함 / 늦둥이 / 입양·대리 양육 가능성)' : '정상'}`;

  const childSinSals = result.sinSals
    .filter(s => ['천을귀인', '문창', '천덕', '월덕', '학당'].some(k => s.name.includes(k)))
    .map(s => `${s.name}(${s.description})`)
    .join(' · ') || '없음';
  const riskSinSals = result.sinSals
    .filter(s => ['백호', '양인', '겁살', '원진', '고신', '과숙', '공망'].some(k => s.name.includes(k)))
    .map(s => `${s.name}(${s.description})`)
    .join(' · ') || '없음';

  const interactionStr = result.interactions.length > 0
    ? result.interactions.map(i => `${i.type}: ${i.description}`).join(', ')
    : '없음';

  const birthYear = result.solarDate ? new Date(result.solarDate).getFullYear() : 0;
  const currentYear = new Date().getFullYear();
  const currentDaeWoon = result.daeWoon.find(d => d.gan && d.zhi && currentYear >= d.startAge && currentYear <= d.endAge);
  const fmtDW = (d: DaeWoon) => {
    const as = birthYear > 0 ? d.startAge - birthYear : d.startAge;
    const ae = birthYear > 0 ? d.endAge - birthYear : d.endAge;
    return `${as}~${ae}세 ${d.gan}${d.zhi}(${d.tenGod}·${d.twelveStage})`;
  };
  const currentDaeWoonStr = currentDaeWoon ? fmtDW(currentDaeWoon) : '아직 시작 전';
  const nearDaeWoon = result.daeWoon
    .filter(d => d.gan && d.zhi && d.endAge >= currentYear)
    .slice(0, 4)
    .map(d => fmtDW(d))
    .join(' → ');

  const recentSeWoon = result.seWoon
    .filter(s => s.year >= currentYear && s.year <= currentYear + 2)
    .map(s => `${s.year}년 ${s.gan}${s.zhi}(${s.tenGod}·${s.twelveStage})`)
    .join(' | ');

  return `당신은 35년 경력의 사주명리 전문가입니다. 아래 사람의 자녀·출산운을 심층적으로 풀어주세요.

${buildMoreFortuneBlock(result)}

[자녀운 심층 데이터]
- 격국: ${gyeokguk} / 신강신약: ${result.strengthStatus}(${result.strengthScore})
- 일간 ${result.dayMaster}(${result.dayMasterElement}·${result.dayMasterYinYang})
- 십성 전체 분포: ${sipseong}
- 용신: ${result.yongSin}(${result.yongSinElement}) / 기신: ${result.giSin}

[자녀성 분석]
- 자녀성(${jaNyeoStarLabel}): ${jaNyeoStarDetail} = 합계 ${jaNyeoTotal}개
  → 0개: 자녀 인연 박함·만득자·대리 양육 / 1~2개: 보통 / 3개+: 자녀복 풍성·다자
  → ${isMale ? '정관=딸 기운 / 편관=아들 기운 (남성 기준)' : '식신=딸 기운 / 상관=아들 기운 (여성 기준)'}
- 자녀성을 극하는 기운: ${antiStar}
  → ${isMale ? '상관이 관성을 극하면(상관견관) 자녀와의 갈등·양육 어려움' : '편인이 식상을 극하면(도식) 임신 어려움·유산 주의·자녀와의 거리감'}

[자녀궁(시주) 상세]
${hourInfo}

[원국 합충형파해 — 자녀궁 영향]
${interactionStr}
→ 시주 관련 충이 있으면 자녀궁 동요(이별·갈등·변화) / 합이면 자녀 인연 안정

[자녀 관련 신살]
- 길신: ${childSinSals}
- 주의 신살: ${riskSinSals}

[대운·세운 — 출산·임신 시기]
- 현재 대운: ${currentDaeWoonStr}
- 향후 대운: ${nearDaeWoon}
  → ${isMale ? '관성 대운 = 자녀 인연 활성화 / 식상 대운 = 자녀 관련 변화(관을 극하므로 양면적)' : '식상 대운 = 출산·임신 에너지 최고조 / 편인 대운 = 도식(임신 방해)으로 주의'}
- 세운(올해~2년): ${recentSeWoon}
  → 세운 지지가 자녀성 오행을 생하는 해 = 임신·출산 유리

${MORE_COMMON_RULES}

[작성 지침] 850~1100자 내외${result.hourUnknown ? ' (시간미상이므로 자녀궁 직접 해석은 제한하고, 연·월·일주 + 대운·세운 중심으로 풀이)' : ''} — 결제 콘텐츠이므로 풍성하게
단락들은 분리된 항목 나열이 아니라 한 편의 글처럼 흐를 것 — "그래서", "이 구조가 만드는 것은", "그 까닭은" 같은 연결어로 마디를 이어 붙여 읽는 사람이 한 호흡으로 따라가게 할 것.

★ 첫 줄: 은유 제목 (계절·자연·빛 이미지로 자녀복 결을 한 줄)
★ 빈 줄
★ 본문 첫 문장은 반드시 위 제목 은유로 시작 (별도 은유 도입 금지 — 두 다른 은유가 동시 등장하면 사고)

1단락 — 제목 은유로 시작해 자녀복 경향 결론 (다자/소자/만득/귀한 자녀 1명 등 단정). 십성 용어 첫 등장 시 같은 호흡 안에서 일상어로 즉시 풀어 설명.
2단락 — 자녀성 분포와 극하는 기운의 관계로 본 임신·출산 체질 (자연 임신 유리/어려움/시기 중요 등) + **양면 묘사** (자녀복 풍성이라도 양육 부담 양면 / 자녀 인연 박해도 그것이 만드는 자유 양면)
3단락 — ${result.hourUnknown ? '연·월·일주에서 유추 가능한' : '자녀궁(시주)의 12운성·지장간·공망 여부로 본'} 자녀의 타고난 기질과 성향 (활동적/차분/예술적/학구적 등)
4단락 — **양육 스타일 + 자녀 진로·재능 힌트 (신설)** — 다음 3가지 모두 구체적으로:
  · **양육 스타일**: 인성·식상·관성 결로 본 부모 유형 — 인성형(보호·교육 중시) vs 식상형(자유·표현 격려) vs 관성형(규율·책임 강조) vs 재성형(현실 감각 키움). 본인이 자연스럽게 끌리는 양육 방식 + 의식적으로 보완해야 할 방향 1가지
  · **자녀와의 합·충 매칭**: 일주 ${p.day.gan}${p.day.zhi} 기준 자녀의 띠/오행이 잘 맞는 결 1개 + 부딪치기 쉬운 결 1개. 갈등이 예상되는 경우 어떻게 풀어야 하는지 한 호흡
  · **자녀 진로·재능 힌트**: 자녀성 결로 본 — 식상 강한 자녀=예술·표현·창작 / 인성 강한 자녀=학문·연구·교육 / 관성 강한 자녀=리더십·공직 / 재성 강한 자녀=사업·실리 / 비겁 강한 자녀=독립·도전. 추상 격언 금지, 구체 분야명
5단락 — 현재 대운 + 올해 세운이 자녀운에 미치는 영향 (자녀성 강화/약화 판단)
6단락 — 임신·출산에 유리한 구체적 시기 2~3개 (올해 월운 + 향후 세운 교차 근거)
7단락 — "- " 불릿 4개로 실천 조언 (출산 유리한 계절/양육 시 주의할 점/자녀 교육 방향/부모-자녀 관계에서 유의할 점)

★ 마지막 문장에서 제목 은유 회수 (앞에 쓴 자연 이미지 단어를 다시 한 번 가볍게 등장시켜 따뜻한 마무리로 글을 닫기)`;
};

// ─────────────────────────────────────────────
// 8. 성격 심층 분석
// ─────────────────────────────────────────────
export const generatePersonalityShortPrompt = (result: SajuResult): string => {
  const p = result.pillars;
  const counts = computeSipseongCounts(result);
  const sipseong = formatSipseongCounts(counts);
  const gyeokgukObj = determineGyeokguk(result);
  const gyeokguk = gyeokgukObj.name;
  const gyeokgukStatus = analyzeGyeokgukStatus(result, gyeokgukObj);
  const ganYeojidong = formatGanYeojidong(result);
  const byeongjOn = formatByeongjOn(result);

  const dayTraits = getDayPillarTraits(p.day.gan, p.day.zhi);
  const dayTraitsBlock = dayTraits
    ? `60갑자 ${dayTraits.hanja}(${dayTraits.name}) — 키워드: ${dayTraits.keywords.join(', ')}
  특성: ${dayTraits.traits}
  관련 신살: ${dayTraits.sinsal.length > 0 ? dayTraits.sinsal.join(', ') : '없음'}`
    : '(60갑자 특성 데이터 없음)';

  const bigyeop = (counts['비견'] || 0) + (counts['겁재'] || 0);
  const inseong = (counts['정인'] || 0) + (counts['편인'] || 0);
  const siksang = (counts['식신'] || 0) + (counts['상관'] || 0);
  const jaeseong = (counts['정재'] || 0) + (counts['편재'] || 0);
  const gwanseong = (counts['정관'] || 0) + (counts['편관'] || 0);

  const personalitySinSals = result.sinSals
    .filter(s => ['도화', '홍염', '괴강', '백호', '양인', '화개', '역마', '천을귀인', '문창', '학당', '고신', '과숙', '천문', '급각'].some(k => s.name.includes(k)))
    .map(s => `${s.name}(${s.type === 'gilseong' ? '길성' : '신살'}: ${s.description})`)
    .join('\n  · ') || '없음';

  const interactionStr = result.interactions.length > 0
    ? result.interactions.map(i => `${i.type}: ${i.description}`).join(', ')
    : '없음';

  const pillarStages = `년주 ${p.year.gan}${p.year.zhi}(${p.year.twelveStage}) → 월주 ${p.month.gan}${p.month.zhi}(${p.month.twelveStage}) → 일주 ${p.day.gan}${p.day.zhi}(${p.day.twelveStage})${result.hourUnknown ? '' : ` → 시주 ${p.hour.gan}${p.hour.zhi}(${p.hour.twelveStage})`}`;

  const hiddenStemsDetail = [
    `년지 ${p.year.zhi}: ${p.year.hiddenStems.join(', ')}`,
    `월지 ${p.month.zhi}: ${p.month.hiddenStems.join(', ')}`,
    `일지 ${p.day.zhi}: ${p.day.hiddenStems.join(', ')}`,
    ...(result.hourUnknown ? [] : [`시지 ${p.hour.zhi}: ${p.hour.hiddenStems.join(', ')}`]),
  ].join(' / ');

  const birthYear = result.solarDate ? new Date(result.solarDate).getFullYear() : 0;
  const currentYear = new Date().getFullYear();
  const currentDaeWoon = result.daeWoon.find(d => d.gan && d.zhi && currentYear >= d.startAge && currentYear <= d.endAge);
  const fmtDW = (d: DaeWoon) => {
    const as = birthYear > 0 ? d.startAge - birthYear : d.startAge;
    const ae = birthYear > 0 ? d.endAge - birthYear : d.endAge;
    return `${as}~${ae}세 ${d.gan}${d.zhi}(${d.tenGod}·${d.twelveStage})`;
  };
  const daeWoonStr = result.daeWoon
    .filter(d => d.gan && d.zhi)
    .slice(0, 6)
    .map(d => fmtDW(d))
    .join(' → ');
  const currentDaeWoonStr = currentDaeWoon ? fmtDW(currentDaeWoon) : '아직 시작 전';

  return `당신은 35년 경력의 사주명리 전문가입니다. 아래 사람의 타고난 성격을 깊이 있게, 풍성하게 풀어주세요.

${buildMoreFortuneBlock(result)}

[성격 심층 데이터]

▶ 일주 60갑자 특성
${dayTraitsBlock}

▶ 격국·성패
- 격국: ${gyeokguk}${gyeokgukObj.nameHanja ? `(${gyeokgukObj.nameHanja})` : ''} — ${gyeokgukObj.type} (판정 근거: ${gyeokgukObj.reason})
- 격국 성패: ${gyeokgukStatus.isSuccessful ? '성격(成格)' : '패격(敗格)'} — ${gyeokgukStatus.analysis}
- 신강신약: ${result.strengthStatus}(${result.strengthScore}) — 득령: ${result.deukRyeong ? '예' : '아니오'} / 득지: ${result.deukJi ? '예' : '아니오'} / 득세: ${result.deukSe ? '예' : '아니오'}

▶ 십성 배치 (성격의 에너지 구조)
- 전체: ${sipseong}
- 비겁(자아·고집·독립심): ${bigyeop}개 → ${bigyeop >= 3 ? '자기중심적·경쟁적·리더형' : bigyeop >= 1.5 ? '적당한 주관과 사회성' : '협조적이나 자기주장 약함'}
- 인성(지식·사고·내면): ${inseong}개 → ${inseong >= 2.5 ? '지적 탐구·완벽주의·걱정 많음' : inseong >= 1 ? '배움을 즐기되 실용적' : '직관·경험 중시, 이론에 약함'}
- 식상(표현·감성·창의): ${siksang}개 → ${siksang >= 2.5 ? '표현력 폭발·예술적·말많음·감정 기복' : siksang >= 1 ? '적절한 표현력과 감성' : '과묵·절제·표현 서투름'}
- 재성(현실감·실리·활동): ${jaeseong}개 → ${jaeseong >= 2.5 ? '현실적·계획적·돈에 밝음' : jaeseong >= 1 ? '균형 잡힌 현실감' : '이상주의·비현실적·금전관념 약함'}
- 관성(책임·규율·통제): ${gwanseong}개 → ${gwanseong >= 2.5 ? '원칙주의·책임감 과잉·완고' : gwanseong >= 1 ? '적절한 규율과 유연성' : '자유분방·규율 싫어함·방종 위험'}

▶ 특수 구조
- 간여지동: ${ganYeojidong} → 있으면 해당 오행에 에너지 쏠림, 외곬·편향·집요함
- 병존·삼존: ${byeongjOn} → 있으면 같은 기운 과다, 한쪽으로 치우친 성격

▶ 성격 관련 신살
  · ${personalitySinSals}

▶ 4기둥 12운성 흐름 (에너지 라이프사이클)
${pillarStages}
→ 장생·관대·건록·제왕 = 에너지 상승기(활동적·야심·추진력)
→ 쇠·병·사·묘 = 에너지 하강기(내향적·사색·신중함)
→ 태·양 = 미완성 에너지(순수·가능성·변화)

▶ 지장간 (숨겨진 내면 에너지)
${hiddenStemsDetail}
→ 일지 지장간 = 배우자궁 내면 / 월지 지장간 = 사회적 내면

▶ 합충형파해 (갈등 구조)
${interactionStr}
→ 충 = 내면 갈등·급변·스트레스 원인 / 형 = 자기 파괴·자충수 / 합 = 안정 but 변화 저항

▶ 대운 흐름 (성격 변화 궤적)
- 현재 대운: ${currentDaeWoonStr}
- 전체: ${daeWoonStr}
→ 비겁 대운 = 경쟁심·독립 욕구↑ / 인성 대운 = 내면 성장기 / 식상 대운 = 표현·변화 욕구 폭발 / 관성 대운 = 책임·규율·사회 진출

${MORE_COMMON_RULES}

[작성 지침] 1000~1300자 내외 — 성격 분석은 가장 깊어야 함
단락들은 분리된 항목 나열이 아니라 한 편의 글처럼 흐를 것 — "그래서", "이 구조가 만드는 것은", "그 까닭은" 같은 연결어로 마디를 이어 붙여 읽는 사람이 한 호흡으로 따라가게 할 것.

★ 첫 줄: 은유 제목 (낯선 자리에서의 모습과 가까워진 뒤 본모습을 대비하는 이미지)
★ 빈 줄
★ 본문 첫 문장은 반드시 위 제목 은유로 시작 (별도 은유 도입 금지 — 두 다른 은유가 동시 등장하면 사고)

1단락 — 제목 은유로 시작해 일주 ${p.day.gan}${p.day.zhi}(60갑자 ${dayTraits?.hanja || ''})의 핵심 기질 2~3줄 (60갑자 특성 데이터 적극 활용). 십성 용어 첫 등장 시 같은 호흡 안에서 일상어로 즉시 풀어 설명
2단락 — 격국(${gyeokguk}) + 성패(${gyeokgukStatus.isSuccessful ? '성격' : '패격'}) + 신강신약(${result.strengthStatus})이 만드는 인생 기조와 행동 패턴. 성격이면 격의 장점 발현, 패격이면 구조적 갈등·보완 필요 영역 설명
3단락 — 십성 배치로 드러나는 구체적 강점 3개 (직장에서/연애에서/친구 관계에서 각각 어떤 모습인지 구체 상황 묘사) + **외부 시선 한 줄**("주변에서는 ~ 라는 말을 자주 듣게 된다" 식, 본인이 인지하지 못하는 인상)
4단락 — **욕구 vs 두려움 (신설)** — 이 사주가 **가장 되고 싶어 하는 모습**과 **가장 피하고 싶어 하는 모습**을 명리 근거(관성=리더 동경, 식상 결핍=실행 주저, 합 多=관계 집착, 비겁 강세=인정 욕구, 인성 과다=완벽주의 강박 등)로 대비. 각 1~2문장씩, 추상 격언 금지 — 구체 인상으로 ("시원시원하고 결단력 있는 사람이 되고 싶어 하면서도, 우유부단해 보일까 봐 두려워한다" 식)
5단락 — 숨은 그림자 3개 — 간여지동·병존이 있다면 그 편향성 필수 언급. 충·형이 있다면 내면 갈등 패턴 구체적 묘사
6단락 — 성격 관련 신살(도화·괴강·양인·화개·역마 등)이 만드는 독특한 개성과 주의점. **현대적 재해석** 한 호흡 — 과거에 흉살로 보던 것이 현대에는 어떤 강점으로 활용 가능한지 (예: 도화=인기·매력·인플루언서 자질, 역마=글로벌 활동·이동 자유, 양인=결단력·리더십)
7단락 — 스트레스 받을 때 나타나는 패턴 2개 (구체적 상황 + 감정 + 행동으로 묘사) + **회복 패턴** 1문장 (어떤 환경·관계로 충전되는지)
8단락 — 현재 대운이 성격에 미치는 영향 (지금 시기에 강해지는 기질 vs 억눌리는 기질) + 향후 10~20년 성격 변화 궤적 1문장
9단락 — "- " 불릿 5개로 자기관리 종합 조언 (빛나는 환경/피해야 할 환경/관계에서 유의점/직업 적성 힌트/일상 습관)

★ 마지막 문장에서 제목 은유 회수 + **잠재력 응원 한 줄** ("당신만의 결로 ~" 식의 진심 어린 한마디로 글을 닫기)`;
};

// ─────────────────────────────────────────────
// 9. 이름 풀이 — 음령오행 + (선택) 글자별 뜻으로 한자 추정 + 자원오행
//   사용자가 한자를 직접 타이핑하기 어려우므로
//   글자마다 "뜻(예: 넓을) + 음(예: 홍)"을 받아 한자를 역추정한다.
//   (a) 뜻 0개 (또는 charMeanings 미입력) → 순우리말/모름. 음령오행만으로 풀이.
//   (b) 뜻 ≥1개 → LLM이 뜻+음으로 한자를 확정하고 부수 기반 자원오행까지 분석.
// ─────────────────────────────────────────────
export interface NameCharMeaning {
  sound: string;    // 한 글자 음 (예: '홍') — 한글 한 음절
  meaning: string;  // 글자의 뜻 (예: '넓을') — 비어 있으면 순우리말 또는 모름
}

export interface NameAnalysisInput {
  koreanName: string;                 // 필수 — 한글 이름 (성씨 포함, 4글자 이내 권장)
  koreanInitialsElements: string[];   // 초성별 오행 계산 결과 (예: ['土','金','土'])
  charMeanings?: NameCharMeaning[];   // 선택 — 글자별 뜻+음. meaning 채워진 글자가 1개 이상이면 자원오행 분석
  /** @deprecated 이전 보관 기록 호환용 — 신규 입력은 charMeanings 사용 */
  hanjaName?: string;
}

export const generateNameFortunePrompt = (
  result: SajuResult,
  nameInput: NameAnalysisInput,
): string => {
  const { koreanName, koreanInitialsElements, charMeanings, hanjaName } = nameInput;

  // 음령오행 분포 카운트
  const countEls = (els: string[]) => {
    const c: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    els.forEach(e => { if (c[e] !== undefined) c[e]++; });
    return c;
  };
  const eumRyeong = countEls(koreanInitialsElements);

  // 용신·기신 오행
  const yongSinEl = result.yongSinElement;
  const EL_GEN_: Record<string, string> = { '목': '화', '화': '토', '토': '금', '금': '수', '수': '목' };
  const EL_CON_: Record<string, string> = { '목': '토', '화': '금', '토': '수', '금': '목', '수': '화' };
  const EL_PAR_: Record<string, string> = { '목': '수', '화': '목', '토': '화', '금': '토', '수': '금' };
  const EL_BY_:  Record<string, string> = { '목': '금', '화': '수', '토': '목', '금': '화', '수': '토' };
  const giSinElement = (() => {
    const g = result.giSin || '';
    const dayEl = result.dayMasterElement;
    if (g.includes('식신') || g.includes('상관')) return EL_GEN_[dayEl];
    if (g.includes('편재') || g.includes('정재')) return EL_CON_[dayEl];
    if (g.includes('편관') || g.includes('정관')) return EL_BY_[dayEl];
    if (g.includes('편인') || g.includes('정인')) return EL_PAR_[dayEl];
    if (g.includes('비견') || g.includes('겁재')) return dayEl;
    return '';
  })();

  const yongSinInEum = koreanInitialsElements.includes(yongSinEl);
  const giSinInEum = !!giSinElement && koreanInitialsElements.includes(giSinElement);

  // 입력 분기: 글자별 뜻이 1개라도 있으면 한자 추정 모드.
  // 레거시 hanjaName 입력만 있을 때도 동일 모드로 간주.
  const filledMeanings = (charMeanings ?? []).filter(c => c.sound && c.meaning && c.meaning.trim().length > 0);
  const hasAnyMeaning = filledMeanings.length > 0;
  const isHanjaMode = hasAnyMeaning || !!hanjaName;
  const isPureKorean = !isHanjaMode && (charMeanings ?? []).length > 0;

  // 자원오행 판정 규칙 — 부수(部首) 기반 전통 성명학 기준
  // GPT에게 결정적 규칙을 주입해 같은 한자를 매번 동일하게 판정하도록 고정
  const HANJA_RULE_BLOCK = `[자원오행 판정 규칙 — 부수(部首) 기반 전통 성명학]
각 한자의 부수를 식별하고 아래 표로 오행 결정. 창작·추가 규칙 금지.
- 木(목): 木·艸(艹)·竹·禾·米·麻·韭·生·青·香
- 火(화): 火(灬)·日·光·赤·心(忄)·馬·鳥·隹·羽·文·立
- 土(토): 土·山·阝(阜)·宀·穴·田·辶·里·黃·石 일부·玉(일부 금속광물 제외)
- 金(금): 金·刀(刂)·戈·斤·矢·言·皿·車·辛·玉(보석/광물로 볼 때)·石(광석)
- 水(수): 水(氵)·冫·雨·魚·舟·龍·酉·血·耳·月(肉)·雲
부수가 애매하거나 회의문자일 때는 **한자 본의(本義)** 로 판정하고, 판정 근거를 괄호에 명시.`;

  // 한자 추정 룰 — (뜻+음) → 한자 확정 → 자원오행 판정
  const HANJA_INFER_RULE = `[글자별 한자 추정 규칙 — 사용자가 한자를 직접 입력할 수 없으므로 뜻+음으로 역추정]
- 입력 형식: 글자마다 "뜻 + 음" (예: "넓을 홍", "길할 길", "아이 동").
- 각 글자에 대해 (1) 음에 해당하는 한자 후보를 모은 뒤, (2) 사용자가 적은 뜻과 가장 정확히 부합하는 한자 1개를 확정한다.
- 인명용 한자(人名用漢字) 우선 — 이름에 흔히 쓰이는 한자를 우선 채택.
- 뜻이 통상 훈(訓)과 달라 후보가 모호하면 가장 보편적인 인명 한자를 채택하고 본문에 "추정"임을 명시한다.
- 사용자가 적은 뜻이 의미상 분명히 한자가 아니라면(순우리말 어휘) 해당 글자는 "순우리말"로 처리하고 자원오행을 부여하지 않는다 — 음령오행만 적용.
- 한자 확정 후 부수와 자원오행을 위 [자원오행 판정 규칙]에 따라 결정한다.`;

  // 글자별 입력 블록 (사용자 입력을 그대로 노출 — LLM이 그 위에서 추정)
  const charBlock = (() => {
    if (charMeanings && charMeanings.length > 0) {
      const lines = charMeanings.map((c, i) => {
        const meaning = (c.meaning || '').trim();
        const sound = (c.sound || '').trim();
        if (!sound) return null;
        if (meaning) return `  ${i + 1}. 뜻 "${meaning}" + 음 "${sound}" → 추정 한자 / 부수 / 자원오행 판정 필요`;
        return `  ${i + 1}. 음 "${sound}" (뜻 미입력 → 순우리말 또는 모름. 자원오행 미부여)`;
      }).filter(Boolean);
      const header = isHanjaMode
        ? '글자별 입력 (뜻+음으로 한자를 추정해 자원오행을 산출):'
        : '글자별 입력 (뜻 미입력 — 순우리말 이름으로 처리, 음령오행만 분석):';
      return `${header}\n${lines.join('\n')}`;
    }
    if (hanjaName) {
      return `한자 이름(이전 기록): ${hanjaName} — 각 한자별 부수와 자원오행을 직접 판정.`;
    }
    return '한자 정보 미입력 — 음령오행(한글 초성) 기반으로만 분석.';
  })();

  return `당신은 35년 경력의 사주명리·성명학 전문가입니다. 아래 사람의 이름이 사주와 어떻게 어울리는지 풀어주세요.

${buildMoreFortuneBlock(result)}

[이름 분석]
한글 이름: ${koreanName}
초성 음령오행: ${koreanInitialsElements.join(' · ') || '(분석 불가 — 한글 아님)'} (분포 목${eumRyeong.목} 화${eumRyeong.화} 토${eumRyeong.토} 금${eumRyeong.금} 수${eumRyeong.수})
${charBlock}

[사주와 이름 조화 — 음령오행 기준]
- 용신(${yongSinEl})이 한글 이름에 ${yongSinInEum ? '있음 — 음령이 용신 보강' : '없음'}
- 기신(${result.giSin}${giSinElement ? `·${giSinElement}` : ''})이 한글 이름에 ${giSinInEum ? '있음 — 음령에 주의 필요' : '없음'}
${isHanjaMode
  ? '※ 글자별 뜻+음으로 한자를 확정한 뒤 자원오행 기준 용신·기신 일치 여부도 직접 판정해 풀이에 반영할 것.'
  : '※ 한자 정보가 없으므로 자원오행은 절대 임의로 부여하지 말고 음령오행 분석에 충실할 것.'}

${isHanjaMode ? HANJA_INFER_RULE + '\n\n' + HANJA_RULE_BLOCK + '\n' : ''}
${MORE_COMMON_RULES}

[작성 지침] ${isHanjaMode ? '450~620자' : '380~500자'} 내외. 각 단락은 빈 줄로 구분.
${isHanjaMode ? `**첫 줄(필수)**: \`자원오행 판정\` 라인 — 글자별 추정 한자와 부수, 자원오행을 명시.
형식 예시: \`자원오행 판정: 넓을 홍→洪(水부, 水) · 길할 길→吉(口부, 水) · 아이 동→童(立부, 火)\`
뜻이 비어 있던 글자는 \`(순우리말)\`로 표기하고 자원오행 미부여.
` : ''}1단락 — 은유 제목 + 결론 한 줄: 이름이 사주를 돕는가·중립인가·거스르는가 (단정적으로)
2단락 — 한글 음령오행 분포가 사주(용신 ${yongSinEl}·기신 ${result.giSin}·신강신약 ${result.strengthStatus})와 어떻게 맞물리는지 구체 묘사
${isHanjaMode
  ? `3단락 — 추정한 한자의 자원오행이 음령과 조화를 이루는지, 사주의 약한 오행을 어떻게 보강하는지 구체 분석. 추정 근거(뜻과 한자 매칭)도 한 문장 명시.
4단락 — 음령·자원 교차 평가: 둘 다 용신 보강이면 "좋은 이름", 상충하면 이유 설명. 개명·필명 권장 여부 단정`
  : isPureKorean
    ? `3단락 — 순우리말 이름의 정서·울림이 사주의 일주(${result.pillars.day.gan}${result.pillars.day.zhi}) 기질과 어떻게 어울리는지 묘사. 음령 분포만으로 사주 보완이 충분한지, 부족하면 필명·자주 쓰는 색 등 보완책 제안. 개명 권장 여부 단정`
    : `3단락 — 음령 분포만으로 사주 보완이 충분한지, 부족하다면 한자 선택·필명·자주 쓰는 색 등 보완책 제안. 개명 권장 여부 단정`
}
마지막 — "- " 불릿 3개로 실천 조언 (필명·SNS ID·자주 쓰는 색·호칭 등 이름 대안 보완)

[금지]
- 자원오행 판정 규칙에 없는 부수 오행을 창작하지 말 것.
- 글자별 뜻이 입력되지 않았는데 자원오행을 임의로 지어내지 말 것.
- 추정한 한자가 인명에 거의 쓰이지 않는 벽자(僻字)이면 본문에 추정임을 명시하고 보편 한자 후보도 함께 제시할 것.`;
};

// ─────────────────────────────────────────────
// 10. 꿈 해몽 — 사주 무관. 전통 해몽 KB + 맥락 + 감정만으로 해석
// ─────────────────────────────────────────────
function buildContextRulesBlock(): string {
  const lines = CONTEXT_RULES.map(r => `- ${r.action}: ${r.strengthNote}`);
  return `[맥락 규칙 — 같은 상징도 "어떻게 등장했는가"로 의미가 달라진다]\n${lines.join('\n')}`;
}

function buildEmotionRulesBlock(): string {
  const lines = EMOTION_RULES.map(r => `- ${r.emotion} (${r.modifier}): ${r.note}`);
  return `[감정 규칙 — 꿈속 감정이 최종 길흉을 가른다]\n${lines.join('\n')}`;
}

/**
 * 꿈 해몽 프롬프트.
 * 사주 원국·세운과 무관. 순수 꿈 내용만으로 해석한다.
 *
 * @param dreamText 사용자의 꿈 서술(선명 모드 원문 또는 흐릿 모드에서 구조화 → 자연어로 합성된 텍스트)
 */
export const generateDreamInterpretationPrompt = (dreamText: string): string => {
  const trimmed = (dreamText || '').trim().slice(0, 1000);
  const matches = matchDreamSymbols(trimmed, 6);
  const symbolsBlock = buildMatchedSymbolsBlock(matches);
  const reverseNotes = REVERSE_DREAM_NOTES.map((n, i) => `${i + 1}. ${n}`).join('\n');

  return `당신은 35년 경력의 한국 전통 꿈해몽 전문가입니다. 주공해몽·한국 민속 해몽 전통과 현대 심리 해석을 결합해 아래 꿈을 풀어주세요. (사주·생년월일은 사용하지 않습니다. 꿈 자체만으로 해석합니다.)

[사용자가 꾼 꿈]
${trimmed || '(내용 미입력)'}

${symbolsBlock}

${DREAM_TYPE_CHECKLIST}

${buildContextRulesBlock()}

${buildEmotionRulesBlock()}

[역몽(逆夢) 규칙 — 반드시 먼저 점검]
${reverseNotes}

${DREAM_FRAMEWORK}

[출력 규칙]
- Markdown(#, ##, **, \`\`, >) 절대 금지. 이모지 금지. AI 티 나는 표현 금지("AI로서", "분석 결과는", "당신의 꿈을 해석해보면" 등).
- 구어체 "~합니다/~예요". 단정적 톤. "~일 수도 있습니다" 흐린 표현 2회 이하.
- 첫 줄에 은유 제목 1줄 — 대비되는 두 자연 이미지를 쉼표로 연결한 7~16자(예: "흐린 강 너머, 떠오르는 새벽"). 본문에서 한 번 다시 회수.
- 단락 사이는 반드시 빈 줄 1줄로 구분. 한 단락은 평균 3~4문장.
- 마지막에 "- " 불릿 3개로 실천 조언. 불릿 외 본문에는 하이픈 사용 금지.

[작성 지침] 600~850자 내외
1단락 — 은유 제목 (단독 줄). 그 다음 줄에 꿈 종류 판정 1문장 ([꿈 종류 체크리스트] 중 N개 부합 근거 포함, 예: "새벽에 반복해서 꾸셨다고 하셔서 예지몽 경향이 큽니다") + 전체 인상 1줄(길몽/흉몽/혼재 단정)

2단락 — 매칭된 상징 2~3개의 전통 의미를 구체적으로 인용. 사용자가 적은 장면을 그대로 한 번 되짚기("뱀이 몸을 감았는데 따뜻했다고 적으셨어요" 식). 인용한 상징의 [길/흉/혼재] 폴라리티를 한 번 명시.

3단락 — [맥락 규칙]("보았다 vs 품었다 vs 쫓겼다")과 [감정 규칙]("따뜻함은 상징을 길몽으로 전환")이 해석을 어떻게 조정하는지 구체적으로 설명. 감정이 상징과 어긋나면 "전통적으로 감정이 상징보다 우선합니다"라고 명시한 뒤 감정 쪽으로 결론.

4단락 — 꿈이 가리키는 현실의 구체적 국면(재물·관계·건강·일·자기) 중 1가지를 단정적으로 지목하고, 그 영역에서 어떤 변화가 임박했는지 1~2문장으로 묘사. 시점 단서가 있으면 함께 짚어준다(반복몽=장기 신호 / 새벽몽=가까운 미래 / 한밤중몽=내면 메시지).

마지막 단락 — "- " 불릿 3개로 실천 조언: (1) 앞으로 1주~1달간 해야 할 구체적 행동 1개(시점 명시), (2) 피해야 할 행동·말 1개, (3) 길몽이면 운을 활용·증폭하는 방법 / 흉몽이면 가벼운 액막이(소금·청수·환경 정리 등 부드러운 민속 처방) 1개.

[중요 — 어겼을 때 풀이가 무너집니다]
- [역몽 규칙]을 반드시 먼저 점검. 피·죽음·불·똥·무덤은 길몽 가능성을 1순위로 검토.
- 감정이 상징과 반대 방향이면 "감정이 우선"이라는 전통 원칙으로 감정 쪽으로 해석.
- 흉몽 신호가 강해도 사람을 놀라게 하는 표현(예: "큰 화를 입을 것입니다", "사망의 전조")은 절대 쓰지 말 것. 가족 우환·건강 우려는 "조금 더 살피면 좋겠다", "한 번 점검할 시점입니다" 식으로 부드럽게.
- 상징 매칭이 없다면 단정적 길흉 판정을 피하고 사용자가 적은 장면·감정 그대로를 따라가며 보수적으로 풀이.
- 꿈 내용이 5문장 이하로 짧거나 불명확하면 마지막에 "기억나는 장면이 더 떠오르면 추가해서 다시 물어보시면 더 정확하게 풀어드릴게요"로 안내.
- 사용자의 꿈에 등장하지 않은 인물·장면을 임의로 추가해 묘사하지 말 것. 매칭 KB의 일반 설명은 인용하되, 사용자 장면과 다른 시나리오를 만들어내지 말 것.`;
};
