/**
 * 정통사주 TEST 생성 엔드포인트 — 프롬프트 실험 전용.
 *
 * ★ 섹션별 개별 생성(12섹션 병렬) — 구식 2-pass(Core 4 + App 8 한 묶음)는 큰 묶음에서
 *   섹션별 은유 도메인·우주 이미지 지시가 묻혀버려, 섹션마다 따로 생성해 각 섹션이 자기
 *   도메인을 지키도록 한다. (크레딧·DB 저장 X, 출력만 Test1ResultPage 로 반환)
 *
 * 호출: POST /api/test/jungtongsaju  { sajuResult }
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { callAI, JUNGTONGSAJU_PERSONA_SYSTEM_PROMPT } from '@/lib/ai/aiClients';
import {
  parseJungtongsaju,
  sanitizeAIOutput,
  sectionOpeningDirective,
  type JungtongsajuSectionKey,
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

const CORE_KEYS: JungtongsajuSectionKey[] = ['general', 'daymaster', 'element', 'interaction'];
const APP_KEYS: JungtongsajuSectionKey[] = ['character', 'career', 'wealth', 'love', 'health', 'relation', 'luck', 'advice'];

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
    const corePrompt = generateJungtongsajuCorePromptTest(sajuResult);
    const appPrompt = generateJungtongsajuApplicationPromptTest(sajuResult, '', []);

    // 섹션별 단건 생성 — 각 섹션이 자기 은유 도메인·우주 이미지를 온전히 지킨다.
    const genSection = async (key: JungtongsajuSectionKey): Promise<[string, string]> => {
      const base = CORE_KEYS.includes(key) ? corePrompt : appPrompt;
      const override = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[★★★ 이번 호출 한정 — 위 '출력 순서·전체 섹션' 지침은 무시]
오직 [${key}] 섹션 하나만 작성. [${key}] 마커 한 줄로 시작해 그 섹션 본문만 쓰고 끝냅니다.
다른 섹션 마커·본문은 출력 금지.${sectionOpeningDirective(key)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      const raw = await callAI(base + override, 6000, { temperature: 0.8, systemPrompt: JUNGTONGSAJU_PERSONA_SYSTEM_PROMPT });
      const content = stripSpiritGaze(sanitizeAIOutput(raw.content));
      const parsed = parseJungtongsaju(content);
      return [key, (parsed[key] ?? content).trim()];
    };

    const allKeys = [...CORE_KEYS, ...APP_KEYS];
    const settled = await Promise.allSettled(allKeys.map(genSection));
    const sections: Record<string, string> = {};
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value[1]) sections[allKeys[i]] = r.value[1];
    });

    if (Object.keys(sections).length === 0) {
      return NextResponse.json({ error: '생성 실패 — 다시 시도해주세요.' }, { status: 502 });
    }

    const adviceMeta = sections.advice ? parseAdviceMeta(sections.advice) : undefined;

    return NextResponse.json({ success: true, sections, adviceMeta });
  } catch (e) {
    const message = e instanceof Error ? e.message : '생성 중 오류';
    console.error('[test/jungtongsaju] 생성 실패:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
