/**
 * POST /api/consultation
 *
 * 상담소 챗봇 — 사주 데이터 기반 AI 응답 생성 (스트리밍).
 * Gemini streamGenerateContent 엔드포인트를 SSE로 받아 클라이언트에 그대로 프록시.
 * 클라이언트는 ReadableStream을 읽어가며 타이핑 효과로 렌더링.
 *
 * Auth: Authorization: Bearer <supabase-access-token>
 * Body: { systemPrompt: string, history: ChatMessage[], userMessage: string }
 * Response: text/event-stream
 *   data: { "delta": "..." }  (텍스트 청크)
 *   data: { "done": true }    (종료)
 *   data: { "error": "..." }  (오류)
 */

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';

export const runtime = 'edge';

const GEMINI_STREAM_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent';

const MAX_HISTORY_TURNS = 10;
const MAX_SYSTEM_PROMPT = 8000;
const MAX_USER_MESSAGE = 500;

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

function encodeSSE(data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Gemini API 키가 서버에 설정되지 않았습니다.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── 사용자 인증 ──
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return new Response(JSON.stringify({ error: '로그인이 필요합니다.' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: '세션이 만료되었습니다.' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── 입력 파싱 + 검증 ──
  let systemPrompt = '';
  let history: ChatMessage[] = [];
  let userMessage = '';
  try {
    const body = await request.json() as {
      systemPrompt?: string;
      history?: ChatMessage[];
      userMessage?: string;
    };
    systemPrompt = body.systemPrompt ?? '';
    history = body.history ?? [];
    userMessage = body.userMessage ?? '';
  } catch {
    return new Response(JSON.stringify({ error: '요청 형식이 올바르지 않습니다.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!systemPrompt || !userMessage) {
    return new Response(JSON.stringify({ error: '시스템 프롬프트와 질문이 필요합니다.' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (systemPrompt.length > MAX_SYSTEM_PROMPT) {
    return new Response(JSON.stringify({ error: `시스템 프롬프트 과대(최대 ${MAX_SYSTEM_PROMPT}자).` }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (userMessage.length > MAX_USER_MESSAGE) {
    return new Response(JSON.stringify({ error: `질문은 최대 ${MAX_USER_MESSAGE}자까지 가능해요.` }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const trimmedHistory = history.slice(-MAX_HISTORY_TURNS * 2);
  const contents = [
    ...trimmedHistory.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  // ── Gemini 스트리밍 호출 (인증과 병렬로 시작) ──
  const geminiRes = await fetch(`${GEMINI_STREAM_URL}?alt=sse&key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 1200,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!geminiRes.ok || !geminiRes.body) {
    const errorData = await geminiRes.json().catch(() => ({}));
    return new Response(
      JSON.stringify({ error: `응답 오류: ${geminiRes.status} - ${errorData?.error?.message || ''}` }),
      { status: geminiRes.status, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── SSE 프록시 스트림 생성 ──
  const stream = new ReadableStream({
    async start(controller) {
      const reader = geminiRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let emittedAny = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // CRLF → LF 정규화 (Gemini SSE는 \r\n\r\n 사용)
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

          // SSE 프레임(`data: {...}\n\n`) 단위로 분리
          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 2);
            if (!frame.startsWith('data:')) continue;

            const jsonStr = frame.slice(5).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (typeof text === 'string' && text.length > 0) {
                emittedAny = true;
                controller.enqueue(encodeSSE({ delta: text }));
              }
            } catch {
              // JSON 파싱 실패는 무시 (keep-alive 등)
            }
          }
        }

        if (!emittedAny) {
          controller.enqueue(encodeSSE({ error: '응답이 비어 있어요.' }));
        } else {
          controller.enqueue(encodeSSE({ done: true }));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '스트림 오류';
        controller.enqueue(encodeSSE({ error: msg }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
