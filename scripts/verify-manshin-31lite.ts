/**
 * 만신 타로 — gemini-3.1-flash-lite 검수 스크립트 (1회성)
 * 새 구조: 신령1 + 풍습1 + 엽전1 → 신령이 화자, 풍습(장면)·엽전(정도/때)을 엮은 단일 공수
 * 검증: ① 모델 호출(thinkingBudget:0 허용) ② 5섹션 마커 파싱 ③ 길이 300자+
 *      ④ 말투/세 패 결합 품질 ⑤ 토큰·비용 ⑥ 지연시간
 */
import * as fs from 'fs';
import { MANSHIN_DECK, type ManshinCard } from '../src/constants/test/manshinDeck.test';

const env = fs.readFileSync('.env.local', 'utf8');
const KEY = (env.match(/^GEMINI_API_KEY=(.*)$/m)?.[1] || '').trim().replace(/^["']|["']$/g, '');
const MODEL = 'gemini-3.1-flash-lite';

const SYSTEM_PROMPT = `너는 한국 무속의 신령이 직접 공수(신이 사람에게 내리는 말)를 내리는 "만신 타로"의 화자다.

[절대 규칙]
- "신령패"의 신 자신이 1인칭으로 말한다. 해설자·상담사 말투 금지.
- 신마다 말투가 뚜렷이 다르다. 할매 신은 다정한 할매체(~게야, ~란다, 아가), 장군 신은 호령체(~하거라, ~느니라), 임금 신은 위엄체(~노라, 과인), 도깨비는 장난스러운 반말(어이, 낄낄), 각시 신은 새침한 말투(아이고, 얘). 카드 정보의 "기본 공수" 말투를 그대로 이어받아라.
- 무섭게 하지 않는다. 겁주는 표현, 저주, 죽음 단정 금지. 이모지, 별표(**), 등호(==), 번호 매김, 소제목 금지.
- 한 문장은 짧게 한 호흡으로. 마침표 뒤 공백으로 문장 구분.
- 듣는 이는 20~30대 한국 여성. 회사, 연봉, 이직, 소개팅, 연락, 적금, 월세, 운동 같은 실제 일상 장면을 신의 세계관 비유와 엮어 구체적으로.
- 점집에서 진짜 공수 듣는 몰입감. 뻔한 덕담 나열 금지, 콕 집어 말하기.`;

function buildPrompt(deity: ManshinCard, custom: ManshinCard, coin: ManshinCard) {
  return `[오늘의 세 패]
1. 신령패(공수를 내리는 신 = 너 자신): ${deity.name}${deity.hanja ? `(${deity.hanja})` : ''} — ${deity.title}
   - 관장: ${deity.domains} / 키워드: ${deity.keywords.join(', ')}
   - 기본 공수(이 말투를 그대로 이어받아라): ${deity.speech}
2. 풍습패(지금 이 사람 앞에 벌어지는 장면): ${custom.name} — ${custom.title}
   - 의미: ${custom.domains} / 장면 풀이: ${custom.speech}
3. 엽전패(일의 정도와 때): ${coin.name} — ${coin.title}
   - 의미: ${coin.domains} / 수 풀이: ${coin.speech}

너는 신령패의 ${deity.name}(이)다. ${deity.name}의 1인칭 말투로 이 사람에게 공수를 내려라.
반드시 지켜라:
- 풍습패(${custom.name})의 장면을 "지금 네게 벌어지는 일"로 해석에 엮어라.
- 엽전패(${coin.name})의 수를 "정도·기간·개수"로 해석에 엮어라 (예: 세 닢이면 석 달, 세 갈래, 세 번).
- 다섯 부분 모두에서 세 패가 자연스럽게 어우러져야 한다. 카드 이름을 억지로 반복하지 말고 뜻으로 녹여라.

[분량 — 어기면 실패다]
- 각 항목은 공백 제외 350자 이상, 450자 이내. 문장 10개 이상.
- 짧게 요약하지 말고, 장면 묘사 → 콕 집는 진단 → 구체 행동 조언 → 신다운 맺음의 흐름으로 넉넉히 말하라.

[출력 형식 — 마커 줄은 그대로]
[총운]
(세 패를 종합한 공수. 350자 이상.)
[연애운]
(350자 이상. 솔로/연인 둘 다 짚기.)
[재물운]
(350자 이상.)
[일사업운]
(350자 이상.)
[건강운]
(350자 이상. 의학적 단정 금지.)`;
}

async function call(useThinkingConfig: boolean) {
  const deity = MANSHIN_DECK.find((c) => c.id === 'samsin')!;
  const custom = MANSHIN_DECK.find((c) => c.id === 'ssireum')!;
  const coin = MANSHIN_DECK.find((c) => c.id === 'yeopjeon3')!;
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: buildPrompt(deity, custom, coin) }] }],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: {
      temperature: 0.85,
      maxOutputTokens: 5500,
      ...(useThinkingConfig ? { thinkingConfig: { thinkingBudget: 0, includeThoughts: false } } : {}),
    },
  };
  const t0 = Date.now();
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const ms = Date.now() - t0;
  const j: any = await r.json();
  return { status: r.status, ms, j };
}

(async () => {
  let res = await call(true);
  console.log(`[thinkingConfig 포함] status=${res.status} latency=${res.ms}ms`);
  if (res.status !== 200) {
    console.log('  에러:', JSON.stringify(res.j?.error).slice(0, 250));
    console.log('→ thinkingConfig 없이 재시도');
    res = await call(false);
    console.log(`[thinkingConfig 제외] status=${res.status} latency=${res.ms}ms`);
    if (res.status !== 200) { console.log('  에러:', JSON.stringify(res.j?.error).slice(0, 300)); process.exit(1); }
  }
  const text: string = res.j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '';
  const usage = res.j?.usageMetadata;
  console.log('usage:', JSON.stringify(usage));
  if (usage) {
    const cost = (usage.promptTokenCount * 0.25 + (usage.candidatesTokenCount ?? 0) * 1.5) / 1e6;
    console.log(`예상 비용: $${cost.toFixed(5)} (약 ₩${(cost * 1380).toFixed(1)})`);
    if (usage.thoughtsTokenCount) console.log(`⚠ 사고토큰 발생: ${usage.thoughtsTokenCount}개 — thinkingBudget:0 미적용!`);
  }
  const MARKERS = ['총운', '연애운', '재물운', '일사업운', '건강운'];
  let pass = true;
  for (const m of MARKERS) {
    const sec = text.match(new RegExp(`\\[${m}\\]([\\s\\S]*?)(?=\\[(?:${MARKERS.join('|')})\\]|$)`))?.[1]?.trim() ?? '';
    const len = sec.replace(/\s/g, '').length;
    console.log(`  [${m}] ${len}자 ${len >= 250 ? 'OK' : '✗ 짧음'}`);
    if (len < 250) pass = false;
  }
  console.log('\n===== 샘플: 총운 (삼신할매가 씨름판+엽전세닢을 엮는가) =====');
  console.log(text.match(/\[총운\]([\s\S]*?)\[연애운\]/)?.[1]?.trim());
  console.log('\n===== 샘플: 재물운 =====');
  console.log(text.match(/\[재물운\]([\s\S]*?)\[일사업운\]/)?.[1]?.trim()?.slice(0, 350));
  console.log(`\n검수 결과: ${pass ? '전체 통과' : '실패 항목 있음'}`);
})();
