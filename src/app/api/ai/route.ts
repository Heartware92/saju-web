import { NextRequest, NextResponse } from 'next/server';

// Vercel Serverless — 2-pass 호출(토정비결 등) 시 총 소요 시간 대응
export const maxDuration = 120;

interface AIResult {
  content: string;
  /** true면 max_tokens 한도에 걸려 응답이 잘림. 호출자에서 안내·재시도 처리 필요. */
  truncated: boolean;
  /** 어느 제공자가 실제 응답했는지 — 디버깅용. */
  provider?: 'gemini' | 'openai';
}

// ── Gemini API (1순위) ───────────────────────────────────────────────────────
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/** Gemini 1회 호출 — 5xx/429 재시도는 호출자가 담당. */
async function callGeminiOnce(
  prompt: string,
  maxTokens: number,
  systemPrompt: string,
  temperature: number = 0.4,
): Promise<{ ok: true; data: AIResult } | { ok: false; status: number | null; msg: string; retryable: boolean }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, status: null, msg: 'NO_GEMINI_KEY', retryable: false };

  try {
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          thinkingConfig: { thinkingBudget: 0 },
        },
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
    const parts: any[] = candidate?.content?.parts ?? [];
    // 2.5-flash 의 thinking 파트(thought:true) 가 parts[0] 에 올 수 있어 실제 텍스트 파트 검색
    const textPart = parts.find((p: any) => p.text && !p.thought) ?? parts[0];
    return {
      ok: true,
      data: {
        content: textPart?.text ?? '',
        truncated: candidate?.finishReason === 'MAX_TOKENS',
        provider: 'gemini',
      },
    };
  } catch (e: any) {
    // 네트워크 실패 — 재시도 가능
    return { ok: false, status: null, msg: e?.message ?? 'fetch failed', retryable: true };
  }
}

/** Gemini 호출 + 5xx/429/네트워크 실패 시 백오프 재시도 (총 3회 시도). */
async function callGeminiWithRetry(
  prompt: string,
  maxTokens: number,
  systemPrompt: string,
  temperature: number = 0.4,
): Promise<{ ok: true; data: AIResult } | { ok: false; status: number | null; msg: string }> {
  const backoffsMs = [200, 800, 1600];
  let lastStatus: number | null = null;
  let lastMsg = '';

  for (let attempt = 0; attempt <= backoffsMs.length; attempt++) {
    const r = await callGeminiOnce(prompt, maxTokens, systemPrompt, temperature);
    if (r.ok) return r;

    lastStatus = r.status;
    lastMsg = r.msg;

    if (!r.retryable || attempt >= backoffsMs.length) break;

    const wait = backoffsMs[attempt];
    console.warn(`[AI] Gemini ${r.status ?? 'NET'} 재시도 ${attempt + 1}/${backoffsMs.length} (${wait}ms 대기): ${r.msg}`);
    await new Promise((res) => setTimeout(res, wait));
  }

  return { ok: false, status: lastStatus, msg: lastMsg };
}

// ── OpenAI API (2순위 폴백) ──────────────────────────────────────────────────
// gpt-4o-mini — 한국어 품질 좋고 안정성 매우 높음 (5xx 거의 없음)
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

async function callOpenAI(
  prompt: string,
  maxTokens: number,
  systemPrompt: string,
  temperature: number = 0.4,
): Promise<AIResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('NO_OPENAI_KEY');

  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
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

// ── 메인 핸들러 ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { prompt, maxTokens = 1000, systemPrompt, temperature = 0.4 } = await request.json();
    const sys =
      systemPrompt ||
      '당신은 정통 사주명리 전문가입니다. 핵심만 간결하게, 실용적으로 답변하세요. 한국어로 작성하며 이모지는 최소화하세요.';

    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: '서비스가 설정되어 있지 않아요. 관리자에게 문의해주세요.' },
        { status: 500 },
      );
    }

    // ── 1순위: Gemini (재시도 3회 포함) ──
    if (process.env.GEMINI_API_KEY) {
      const geminiResult = await callGeminiWithRetry(prompt, maxTokens, sys, temperature);
      if (geminiResult.ok) {
        return NextResponse.json({
          content: geminiResult.data.content,
          truncated: geminiResult.data.truncated,
          provider: 'gemini',
        });
      }
      console.error('[AI] Gemini 모든 재시도 실패:', geminiResult.status, geminiResult.msg);
      // → OpenAI 폴백으로 자동 진행
    }

    // ── 2순위: OpenAI gpt-4o-mini 폴백 ──
    if (process.env.OPENAI_API_KEY) {
      try {
        console.warn('[AI] OpenAI gpt-4o-mini 폴백 시도');
        const r = await callOpenAI(prompt, maxTokens, sys, temperature);
        return NextResponse.json({
          content: r.content,
          truncated: r.truncated,
          provider: 'openai',
        });
      } catch (openaiErr: any) {
        console.error('[AI] OpenAI 폴백도 실패:', openaiErr.message);
        return NextResponse.json(
          { error: '서비스가 일시적으로 응답이 없어요. 1~2분 후 다시 시도해주세요. (재시도 시 재차감 없음)' },
          { status: 503 },
        );
      }
    }

    // GEMINI_API_KEY 만 있고 모든 재시도 실패 — OpenAI 키 없음
    return NextResponse.json(
      { error: '서비스가 일시적으로 응답하지 않아요. 잠시 후 다시 시도해주세요. (재시도 시 재차감 없음)' },
      { status: 503 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    );
  }
}
