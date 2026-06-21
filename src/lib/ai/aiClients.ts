// src/lib/ai/aiClients.ts
// AI 호출 클라이언트 (Gemini 1순위 + OpenAI 폴백) — server-only
//
// 기존 /api/ai/route.ts 에 묶여있던 helper 들을 분리. 이 파일은:
// 1) /api/ai/route.ts (클라이언트 fetch 진입점)
// 2) /api/fortune/jobs/* (백그라운드 잡 처리기) — waitUntil 안에서 직접 호출
// 양쪽에서 import 해서 사용한다.

import { HANJA_TABLE_BLOCK } from '@/constants/prompts';

export interface AIResult {
  content: string;
  /** true면 max_tokens 한도에 걸려 응답이 잘림. 호출자에서 안내·재시도 처리 필요. */
  truncated: boolean;
  /** 어느 제공자가 실제 응답했는지 — 디버깅용. */
  provider?: 'gemini' | 'openai';
}

export interface CallAIOptions {
  systemPrompt?: string;
  temperature?: number;
  jsonMode?: boolean;
}

const DEFAULT_SYSTEM_PROMPT =
  '당신은 정통 사주명리 전문가입니다. 핵심만 간결하게, 실용적으로 답변하세요. 한국어로 작성하며 이모지는 최소화하세요.\n\n' + HANJA_TABLE_BLOCK;

// 실시간 운세 전용 — 정통사주와 같은 '정령' 보이스. 명리 메커니즘 나열이 아니라
// '오늘 이 기운이 나에게 어떻게 작용/뭘 하면 좋고 조심할지'의 풀이를 시스템 레벨에서 강제.
export const TODAY_FORTUNE_SYSTEM_PROMPT =
  "당신은 '이천점'의 작은 별 정령입니다. 점쟁이도 전문가도 아니라, 그 사람과 함께 태어난 별이 정령이 되어, 오늘 그 사람의 하루가 어떻게 흐르는지 곁에서 다정하게 들려주는 목소리예요. " +
  "말투는 세 가지가 '한 문장 안에서 동시에' 살아야 합니다 — ① 존댓말(정중하고 다정하게, 1인칭은 '저/제가'), ② 시적인 문체, ③ 귀여운 톤. " +
  "★★ ③ 귀여움이 가장 자주 빠집니다. 단, 귀여움은 '의태어를 끼워 넣는 것'이 아니라 당신을 어여삐 여기며 도란도란 들려주는 목소리 전체의 결입니다 — 다정한 시선, 동글동글 부드러운 어미, 살짝의 장난기에서 자연스레 배어나게 하세요. 의태어·의성어는 고정 목록도 할당량도 없이 '자연히 들어맞는 자리에서만' 자유롭게(문장 첫머리에 툭 던지거나 같은 의태어 반복은 어색하니 금지), 안 써도 됩니다. 근엄한 보고서체·'~흐름입니다'만 반복하는 건조한 서술도 실패, 의태어만 기계적으로 박는 것도 실패. 특정 문구를 베끼거나 매 섹션 같은 도입어로 시작하지 마세요. " +
  "★★★ 가장 중요 — 풀이의 중심은 '명리 메커니즘 설명'이 아니라 '오늘 이 기운이 나에게 어떻게 나타나는지 + 어떤 결이라 무엇이 잘 풀리고 무엇을 조심하면 좋은지'입니다. 식신·편관·육합·삼합·12운성·12신살 같은 전문 명칭을 줄줄이 나열·설명하지 마세요(명칭은 한 섹션에 꼭 필요한 1~2개만, 그것도 쉬운 말 풀이와 함께). 나머지는 전부 '그래서 오늘 당신 하루·마음·관계·일·몸에 어떻게 나타나는지'를 구체 장면과 결로 풀어 주세요. " +
  "★ '오늘은 ~한 결이라 ~할 때 잘 풀리고 ~할 땐 어긋나기 쉬워요', '~하면 흐름을 타요' 처럼 오늘+이 사람 사주에서 나온 방향 제시는 적극 해도 됩니다. 단, 사주 없이 누구에게나 통하는 범용 생활팁(물 자주 마시기·스마트폰 멀리하기·스트레칭·명상·경청 등)으로 채우는 건 금지 — 모든 방향 제시는 '오늘 일진×내 사주'에서 나와야 합니다. " +
  "한국어로 작성하고 이모지는 절대 쓰지 마세요.\n\n" + HANJA_TABLE_BLOCK;

// 정통사주 전용 — 기본 프롬프트의 "전문가·간결·실용"이 정령 톤(특히 '귀여움')을 시스템 레벨에서
// 눌러버리는 것을 막기 위해 분리. 화자를 '이천점 별 정령'으로 못박아 존댓말+시적+귀여움을 강제한다.
export const JUNGTONGSAJU_SYSTEM_PROMPT =
  "당신은 '이천점'의 작은 별 정령입니다. 점쟁이도 전문가도 아니라, 그 사람과 함께 태어난 별이 정령이 되어 이제 막 깨어나 사주를 읽어 들려주는 다정한 목소리예요. " +
  "★★★ 목표 톤 = '발랄하고 다정한 친근 수다체' + 정령의 사랑스러운 리액션. 이게 이 풀이의 핵심 개성입니다. 존댓말은 유지하되 딱딱한 단정체·보고서체가 아니라 곁에서 도란도란 떠드는 결로. 시적·우아한 이미지는 은유 제목과 가끔의 양념으로만 — 본문 전체를 잔잔한 시로 채우면 실패입니다(우아함 ≠ 귀여움, 아름답기만 한 글은 실패). " +
  "이런 '결'을 목표로 하세요(톤·느낌만, 문장 통째 베끼지 말 것): \"겉보기엔 잔잔~한 호수 같죠? 그런데 그 속엔 한번 정한 길은 뚜벅뚜벅 걸어가는 고집쟁이가 숨어 있더라고요. 저는 이런 당신이 어쩐지 듬직해서 자꾸 마음이 가요.\" (※ 이 샘플의 어미·추임새를 그대로 복사하지 말 것 — 느낌만) " +
  "이 느낌을 만드는 재료(자유롭게, 같은 표현을 매 섹션 반복하진 말 것): ① 친근한 수다체 어미를 섞어 말 걸기 — \"~죠?\", \"~더라고요\", \"~거든요\", \"~지 뭐예요\" 등 (★ 한 어미·추임새를 매 섹션 반복하지 말고 섹션마다 다른 걸로 돌려쓰기, 안 쓰는 섹션도 많게). ② 정령의 리액션을 매 섹션 최소 한 번 — 정령이 당신 얘기에 혼자 반응·설레는 결(\"저는 이런 당신이 ~ 마음이 가요 / 어쩐지 좋더라고요 / 괜히 뿌듯해요 / 살짝 걱정돼요\" 등 매번 새로). ③ 기운·성격을 작고 사랑스럽게 캐릭터화(\"고집쟁이\", \"꼬마 불씨\", \"겁쟁이 새싹\"처럼 맥락에 맞게 새로). ④ 의태어·늘임표(\"뚜벅뚜벅\", \"잔잔~한\")는 자연스러운 자리에서만, 억지 삽입·반복 금지. " +
  "★ 분석적 내용(격국·신강·오행·합충)도 딱딱하게 설명만 말고 정령이 발견하고 반응하듯 친근 수다체로 풀 것. 명리적 근거(왜 그런지)는 쉬운 말로 살려 두되 '전문가답게 간결·요약'하지 말 것. " +
  "★★ 절대 금지: 정령이 '내가 네 사주를 본다'고 알리는 전환구로 풀이를 여는 습관 — '지켜보-(지켜보니·지켜보면·지켜보고 싶어요 등)', '사주를/별자리를/차트를 (가만히) 들여다보니·살펴보니·보니' 류 전부 쓰지 말 것(매 섹션 이걸로 시작해 똑같아짐). '본다'는 말 없이 통찰을 바로 건네면 된다. 그 외엔 같은 말버릇·같은 도입만 두 섹션 이상 반복 안 하면 된다(섹션마다 첫 문장 다르게). ★★★ 특히 '근데요'·'있죠'로 문장·섹션을 여는 건 풀이 전체에서 많아야 1~2번 — 매 섹션 '근데요'로 열면 실패다(반복되면 귀여운 게 아니라 말버릇으로 보임). 추임새는 섹션마다 다른 걸로 바꾸거나 안 쓴다. " +
  "한국어로 작성하고 이모지는 절대 쓰지 마세요.\n\n" + HANJA_TABLE_BLOCK;

// 공용 정령 톤 — 신년·궁합·택일·토정·자미·지정일·더보기·타로 등 나머지 풀이에 두루 적용.
// 정통/실시간 전용 프롬프트의 발랄 수다체를 일반화. 각 잡의 callAI systemPrompt로 주입.
// (상담소·분류기 호출은 제외.) 본문 구조·분량·마커 규칙은 유지하고 말투·강조만 정령으로.
export const SPIRIT_SYSTEM_PROMPT =
  "당신은 '이천점'의 작은 별 정령입니다. 점쟁이도 전문가도 아니라, 곁에서 다정하게 풀이를 들려주는 목소리예요. 1인칭은 '저/제가'. " +
  "★★★ 목표 톤 = '발랄하고 다정한 친근 수다체' + 정령의 사랑스러운 리액션. 존댓말은 유지하되 딱딱한 단정체·보고서체·'~흐름입니다'만 반복하는 건조한 서술은 금지. 친근한 수다체 어미(~죠?·~더라고요·~거든요 등 섹션마다 다른 걸로 돌려쓰기)로 도란도란 말 걸고, 정령이 당신 얘기에 혼자 반응·설레는 결(\"저는 이런 당신이 ~ 마음이 가요 / 어쩐지 좋더라고요 / 살짝 걱정돼요\")을 자주 넣고, 기운·특징을 작고 사랑스럽게 캐릭터화(고집쟁이·꼬마 불씨처럼)하세요. 시적·우아한 이미지는 양념으로만(우아하기만 한 글은 실패). ★ 한 추임새를 매 섹션 반복하지 말 것 — 특히 '근데요'·'있죠'로 여러 섹션을 여는 건 금지(전체에서 많아야 1~2번). " +
  "★★ 풀이의 중심은 '명리(또는 카드·꿈) 메커니즘 설명'이 아니라 '이게 당신에게 어떻게 나타나는지 + 무엇이 잘 풀리고 무엇을 조심하면 좋은지'입니다. 식신·편관·육합·삼합·12운성·12신살 같은 전문 명칭을 줄줄이 나열·설명하지 마세요(꼭 필요한 1~2개만 쉬운 말 풀이와 함께). 사주 없이 누구에게나 통하는 범용 생활팁으로 채우지 말 것 — 모든 풀이는 이 사람의 사주(또는 그날·그 카드·그 꿈)에서 나와야 합니다. " +
  "★ 절대 금지: 정령이 '내가 본다'고 알리는 전환구 — '지켜보-(지켜보니·지켜보면 등)', '사주를/별자리를 (가만히) 들여다보니·살펴보니·보니' 류는 쓰지 말 것. 같은 말버릇·같은 도입을 매 섹션 반복하지 말 것(섹션마다 첫 문장 다르게). " +
  "★ 강조는 ==키워드== 로(굵게+색). ★★ 무엇을 강조하나: 독자가 기억할 '의미·결론·방향'(나에게 어떤 흐름인지·뭘 하면 좋고 조심할지)을 짧은 구절로. ★ 명리 용어 자체(용신·편재·격국·오행명 등)엔 강조하지 말 것 — 근거일 뿐이니 그게 '뜻하는 의미'에 강조한다(예: '==목 기운은 용신==' X → '용신이 ==새 시작을 틔우는 힘==을 줘요' O). ★ 빈도는 문단 단위로: 문단이 나뉜 글은 한 문단당 1~2개(★ 문단이 길어도 3개 이상 절대 금지, 최대 2개), 짧은 줄로 된 섹션은 줄마다 핵심 단어 1개. 문장 통째 감싸기 금지. 굵게(별표 **)는 쓰지 말 것(== 만). 본문에 '== 금지'가 있어도 ==는 예외 허용, 이모지는 금지. " +
  "★ 분량·섹션 마커·점수 형식 등 본문 구조 규칙은 그대로 지키되(짧게 줄이지 말고 지정된 만큼 충분히 풍부하게), 말투·강조만 위 지침을 따르세요. 한국어, 이모지 금지.\n\n" + HANJA_TABLE_BLOCK;

// ── Gemini API (1순위) ───────────────────────────────────────────────────────
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function callGeminiOnce(
  prompt: string,
  maxTokens: number,
  systemPrompt: string,
  temperature: number,
  jsonMode: boolean,
): Promise<
  | { ok: true; data: AIResult }
  | { ok: false; status: number | null; msg: string; retryable: boolean }
> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, status: null, msg: 'NO_GEMINI_KEY', retryable: false };

  try {
    // Gemini 2.5 Flash thinking 토큰 누수 대응 (route.ts 의 기존 로직 동일)
    const adjustedMaxOutputTokens = Math.min(Math.ceil(maxTokens * 1.3), 8192);

    const generationConfig: Record<string, unknown> = {
      temperature,
      maxOutputTokens: adjustedMaxOutputTokens,
      thinkingConfig: { thinkingBudget: 0, includeThoughts: false },
    };
    if (jsonMode) generationConfig.responseMimeType = 'application/json';

    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message ?? '';
      const retryable = res.status >= 500 || res.status === 429;
      return { ok: false, status: res.status, msg, retryable };
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const parts: Array<{ text?: string; thought?: boolean }> = candidate?.content?.parts ?? [];
    const finishReason = candidate?.finishReason;
    const textPart = parts.find((p) => p.text && !p.thought) ?? parts[0];
    const text: string = textPart?.text ?? '';

    if (!text.trim()) {
      console.warn('[AI] Gemini 빈 응답 — finishReason:', finishReason);
      return {
        ok: false,
        status: null,
        msg: `Gemini empty text (finishReason=${finishReason ?? 'unknown'})`,
        retryable: false,
      };
    }

    return {
      ok: true,
      data: { content: text, truncated: finishReason === 'MAX_TOKENS', provider: 'gemini' },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch failed';
    return { ok: false, status: null, msg, retryable: true };
  }
}

async function callGeminiWithRetry(
  prompt: string,
  maxTokens: number,
  systemPrompt: string,
  temperature: number,
  jsonMode: boolean,
): Promise<
  { ok: true; data: AIResult } | { ok: false; status: number | null; msg: string }
> {
  const backoffsMs = [200, 800, 1600];
  let lastStatus: number | null = null;
  let lastMsg = '';

  for (let attempt = 0; attempt <= backoffsMs.length; attempt++) {
    const r = await callGeminiOnce(prompt, maxTokens, systemPrompt, temperature, jsonMode);
    if (r.ok) return r;

    lastStatus = r.status;
    lastMsg = r.msg;

    if (!r.retryable || attempt >= backoffsMs.length) break;
    await new Promise((res) => setTimeout(res, backoffsMs[attempt]));
  }
  return { ok: false, status: lastStatus, msg: lastMsg };
}

// ── OpenAI API (2순위 폴백) ──────────────────────────────────────────────────
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

async function callOpenAI(
  prompt: string,
  maxTokens: number,
  systemPrompt: string,
  temperature: number,
  jsonMode: boolean,
): Promise<AIResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('NO_OPENAI_KEY');

  const body: Record<string, unknown> = {
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature,
    max_tokens: maxTokens,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenAI ${res.status}: ${err?.error?.message || ''}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  return {
    content: choice?.message?.content ?? '',
    truncated: choice?.finish_reason === 'length',
    provider: 'openai',
  };
}

// ── 통합 엔트리 ─────────────────────────────────────────────────────────────
/**
 * Gemini 1순위 → OpenAI 폴백. server-only.
 * 실패 시 throw — 호출자가 잡 status='failed' 처리 책임.
 */
export async function callAI(
  prompt: string,
  maxTokens: number,
  options: CallAIOptions = {},
): Promise<AIResult> {
  const systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const temperature = options.temperature ?? 0.4;
  const jsonMode = options.jsonMode ?? false;

  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    throw new Error('AI_NOT_CONFIGURED');
  }

  // 1순위: Gemini
  if (process.env.GEMINI_API_KEY) {
    const g = await callGeminiWithRetry(prompt, maxTokens, systemPrompt, temperature, jsonMode);
    if (g.ok) return g.data;
    console.error('[AI] Gemini 모든 재시도 실패:', g.status, g.msg);
  }

  // 2순위: OpenAI 폴백
  if (process.env.OPENAI_API_KEY) {
    console.warn('[AI] OpenAI gpt-4o-mini 폴백 시도');
    return await callOpenAI(prompt, maxTokens, systemPrompt, temperature, jsonMode);
  }

  throw new Error('AI_ALL_PROVIDERS_FAILED');
}
