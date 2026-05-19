import { NextRequest, NextResponse } from 'next/server';
import { callAI } from '@/lib/ai/aiClients';

// Vercel Pro 플랜 maxDuration 한도 활용 — 300s 무료
// 정통사주 2차(8섹션 동시) + Gemini stall + retry + OpenAI 폴백 모두 수용
export const maxDuration = 300;

// ── 메인 핸들러 — 클라이언트 호출용 단순 wrapper ────────────────────────────
// 백그라운드 잡 처리기는 이 route 를 거치지 않고 callAI() 를 직접 import 해서 호출.
export async function POST(request: NextRequest) {
  try {
    const { prompt, maxTokens = 1000, systemPrompt, temperature = 0.4, jsonMode = false } =
      await request.json();

    const result = await callAI(prompt, maxTokens, { systemPrompt, temperature, jsonMode });
    return NextResponse.json({
      content: result.content,
      truncated: result.truncated,
      provider: result.provider,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '서버 오류가 발생했어요.';
    if (msg === 'AI_NOT_CONFIGURED') {
      return NextResponse.json(
        { error: '서비스가 설정되어 있지 않아요. 관리자에게 문의해주세요.' },
        { status: 500 },
      );
    }
    if (msg === 'AI_ALL_PROVIDERS_FAILED' || msg.startsWith('OpenAI ')) {
      return NextResponse.json(
        { error: '서비스가 일시적으로 응답이 없어요. 1~2분 후 다시 시도해주세요. (재시도 시 재차감 없음)' },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: msg || '서버 오류가 발생했어요. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    );
  }
}
