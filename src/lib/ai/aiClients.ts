// src/lib/ai/aiClients.ts
// AI 호출 클라이언트 (Gemini 1순위 + OpenAI 폴백) — server-only
//
// 기존 /api/ai/route.ts 에 묶여있던 helper 들을 분리. 이 파일은:
// 1) /api/ai/route.ts (클라이언트 fetch 진입점)
// 2) /api/fortune/jobs/* (백그라운드 잡 처리기) — waitUntil 안에서 직접 호출
// 양쪽에서 import 해서 사용한다.

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
  '당신은 정통 사주명리 전문가입니다. 핵심만 간결하게, 실용적으로 답변하세요. 한국어로 작성하며 이모지는 최소화하세요.';

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
