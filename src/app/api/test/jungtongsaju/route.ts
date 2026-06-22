/**
 * 정통사주 TEST 생성 엔드포인트 — 프롬프트 실험 전용.
 *
 * 라이브 runJungtongsajuJob 의 2-pass 생성 로직을 그대로 따르되:
 *  · TEST 프롬프트(jungtongsajuPrompt.test.ts) 사용
 *  · 크레딧 차감 X / saju_records 저장 X (프론트 출력만 다르게)
 *  · 결과 9섹션을 그대로 JSON 반환 → Test1ResultPage 가 렌더
 *
 * 호출: POST /api/test/jungtongsaju  { sajuResult }
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { callAI, JUNGTONGSAJU_PERSONA_SYSTEM_PROMPT } from '@/lib/ai/aiClients';
import {
  parseJungtongsaju,
  extractMetaphorAliases,
  sanitizeAIOutput,
} from '@/services/jungtongsajuShared';
import {
  generateJungtongsajuCorePromptTest,
  generateJungtongsajuApplicationPromptTest,
  stripSpiritGaze,
} from '@/constants/test/jungtongsajuPrompt.test';
import { parseAdviceMeta } from '@/services/fortuneService';
import type { SajuResult } from '@/utils/sajuCalculator';

// Supabase(Seoul) 와 같은 리전 — 라이브 함수 규칙 준수
export const preferredRegion = 'icn1';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // ── 로그인 가드 — 인증된 사용자만 (AI 토큰 무단 소진 방지) ──
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: '인증이 필요해요.' }, { status: 401 });
  }
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }

  let sajuResult: SajuResult;
  try {
    const body = await req.json();
    sajuResult = body.sajuResult;
    if (!sajuResult) {
      return NextResponse.json({ error: 'sajuResult 필요' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }

  try {
    // ── 1차: Core 4섹션 ──
    const corePrompt = generateJungtongsajuCorePromptTest(sajuResult);
    const coreRaw = await callAI(corePrompt, 7000, { temperature: 0.75, systemPrompt: JUNGTONGSAJU_PERSONA_SYSTEM_PROMPT });
    const coreContent = stripSpiritGaze(sanitizeAIOutput(coreRaw.content));
    const coreSections = parseJungtongsaju(coreContent);

    if (Object.keys(coreSections).length === 0) {
      return NextResponse.json(
        { error: '1차 마커 파싱 실패', raw: coreContent },
        { status: 502 },
      );
    }

    // ── 1차 별칭 추출 (2차 차단용) ──
    const forbiddenAliases = extractMetaphorAliases(coreContent);

    // ── 2차: Application 8섹션 ──
    const appPrompt = generateJungtongsajuApplicationPromptTest(
      sajuResult,
      coreContent,
      forbiddenAliases,
    );
    const appRaw = await callAI(appPrompt, 14000, { temperature: 0.75, systemPrompt: JUNGTONGSAJU_PERSONA_SYSTEM_PROMPT });
    const appContent = stripSpiritGaze(sanitizeAIOutput(appRaw.content));
    const appSections = parseJungtongsaju(appContent);

    // ── 용신처방(advice) 카드용 메타 파싱 — 라이브와 동일하게 AdviceCard UI 렌더 ──
    const sections = { ...coreSections, ...appSections };
    const adviceMeta = sections.advice ? parseAdviceMeta(sections.advice) : undefined;

    return NextResponse.json({
      success: true,
      sections,
      adviceMeta,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : '생성 중 오류';
    console.error('[test/jungtongsaju] 생성 실패:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
