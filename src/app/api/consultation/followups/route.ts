/**
 * POST /api/consultation/followups
 *
 * 상담소 대화에서 방금 나눈 질문·답변을 바탕으로 "후속 질문 3개"를 제안한다.
 * - 꼬리물기: 방금 답변을 더 깊이 파는 질문
 * - 파생:     답변에 언급된 다른 요소로 확장하는 질문
 * - 전환:     완전히 다른 주제로 넘어가는 제안
 *
 * Gemini JSON 모드를 사용해 `{ suggestions: string[] }` 형태로 보장 받는다.
 *
 * Auth: Authorization: Bearer <supabase-access-token>
 * Body: { lastQuestion: string, lastAnswer: string }
 * Response: { suggestions: [string, string, string] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const MAX_LEN = 2000;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API 키 미설정' }, { status: 500 });
  }

  // ── 인증 ──
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: '세션이 만료되었습니다.' }, { status: 401 });
  }

  // ── 입력 ──
  let lastQuestion = '';
  let lastAnswer = '';
  let prevQuestions: string[] = [];
  try {
    const body = await request.json() as { lastQuestion?: string; lastAnswer?: string; prevQuestions?: string[] };
    lastQuestion = (body.lastQuestion ?? '').slice(0, MAX_LEN);
    lastAnswer = (body.lastAnswer ?? '').slice(0, MAX_LEN);
    prevQuestions = Array.isArray(body.prevQuestions)
      ? body.prevQuestions.filter((q): q is string => typeof q === 'string').map(q => q.slice(0, 200)).slice(0, 30)
      : [];
  } catch {
    return NextResponse.json({ error: '요청 형식 오류' }, { status: 400 });
  }
  if (!lastQuestion || !lastAnswer) {
    return NextResponse.json({ error: 'lastQuestion, lastAnswer 필요' }, { status: 400 });
  }

  // 이미 사용자가 이번 세션에서 보낸 질문 목록 — LLM 이 중복 안 만들게
  const avoidBlock = prevQuestions.length > 0
    ? `\n[★ 절대 중복 금지 — 유저가 이미 보낸 질문]\n${prevQuestions.map(q => `- ${q}`).join('\n')}\n\n위 질문과 같거나 비슷한 의미의 질문은 절대 제안 금지. 다른 각도·다른 주제로 제안하세요.`
    : '';

  const prompt = `당신은 사주 상담소의 후속 질문 큐레이터입니다. 유저가 방금 다음과 같이 질문하고 답변을 받았습니다.

[유저 질문]
${lastQuestion}

[AI 답변]
${lastAnswer}${avoidBlock}

이 대화 맥락에서 유저가 이어서 자연스럽게 궁금해할 후속 질문 3개를 제안하세요.

[규칙]
- 1번째: 방금 답변 내용을 "더 깊이" 파는 질문 (꼬리 물기)
- 2번째: 답변에 언급된 다른 요소를 "확장"하는 질문 (파생)
- 3번째: 완전히 다른 주제로 "전환"하는 제안 (이번엔 이걸 물어봐)
- 각 질문은 30자 이내, 유저가 실제로 타이핑할 법한 자연스러운 구어체
- 마크다운·이모지 금지, 질문 그 자체만 (인사말이나 설명 금지)
- 위 [절대 중복 금지] 블록의 질문과 표현·의미 모두 다르게`;

  const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9,
        maxOutputTokens: 300,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            suggestions: {
              type: 'ARRAY',
              items: { type: 'STRING' },
              minItems: 3,
              maxItems: 3,
            },
          },
          required: ['suggestions'],
        },
      },
    }),
  });

  if (!geminiRes.ok) {
    const errData = await geminiRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: `후속 질문 생성 실패: ${errData?.error?.message || geminiRes.status}` },
      { status: geminiRes.status },
    );
  }

  const data = await geminiRes.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  try {
    const parsed = JSON.parse(raw) as { suggestions?: unknown };
    const list = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    const suggestions = list
      .filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
      .map((s: string) => s.trim().slice(0, 60))
      .slice(0, 3);

    if (suggestions.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
