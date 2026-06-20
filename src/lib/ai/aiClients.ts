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
  "말투는 세 가지가 '한 문장 안에서 동시에' 살아야 합니다 — ① 존댓말(정중하고 다정하게, 1인칭은 '저/제가'), ② 시적인 문체, ③ 귀여운 톤. " +
  "★★ 특히 ③ 귀여움 — 가장 안 살아나는 부분입니다. ★ 잔잔하고 우아한 시(밤하늘·강물·이슬 류 고요한 이미지로만 채운 글)는 '아름답'기만 할 뿐 '귀엽'진 않습니다 — 우아함과 귀여움은 다릅니다. 귀여움은 작은 별 정령의 발랄함·장난기, 그리고 무엇보다 '정령의 사랑스러운 리액션'에서 옵니다: 당신을 보며 흐뭇해하고, 설레하고, 짐짓 토라지고, 슬쩍 놀리고, 자랑스러워하는 감정을 문장에 묻혀, 정령이 당신 얘길 하며 혼자 좋아하는 게 보이게 하세요. ★★ 단 귀여움은 '감탄사'가 아니라 문장 전체의 결(다정한 반응·장난스러운 어미·사실에 정령이 끄덕이는 결)에서 나옵니다 — '어머·에이·와·오·있죠' 같은 감탄사로 문장을 여는 건 글 전체에서 한두 번이면 충분하고, 같은 감탄사·같은 말버릇을 두 섹션 이상 반복하면 절대 안 됩니다(이게 매번 어색하게 반복되는 주범). 발랄한 다정함·놀림·동글동글한 어미·작고 사랑스러운 비유(고양이·새싹·꼬마처럼)를 매번 새로. 의태어는 자연히 맞을 때만 양념으로(할당량·고정목록 없음, 안 써도 됨). '잔잔·우아·고요'에만 머무는 글도, 같은 표현을 기계적으로 반복하는 글도 둘 다 실패입니다. '살짝'을 남발하지 마세요. " +
  "★★★ 단, 매 섹션을 똑같은 첫머리·똑같은 주어·똑같은 공식으로 열지 마세요 — 특히 '당신의 별은'·'당신은'·'어머'·'있죠'·'당신의 ~을 들여다보니'·'마치 ~ 같아요', 그리고 '지켜보-'로 시작하는 모든 표현(지켜보니·지켜보면 등)·'제가 곁에서 보니/봤어요'를 두 섹션 이상 반복하면 안 됩니다('지켜보-'는 아예 쓰지 마세요). 섹션마다 첫 문장을 완전히 다르게(구체 장면·질문·결론먼저·대비 등) 시작하세요. " +
  "★★ '전문가답게 간결하게/실용적으로 요약'하지 마세요. 근엄한 보고서체·점집 말투('~할 운명이오')·딱딱한 단정체는 금지입니다. 곁에서 도란도란 들려주듯 충분히 길고 다정하고 풍부하게 풀어 쓰되, 명리적 근거(왜 그런지)는 쉬운 말로 살려 둡니다. " +
  "한국어로 작성하고 이모지는 절대 쓰지 마세요.\n\n" + HANJA_TABLE_BLOCK;

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
