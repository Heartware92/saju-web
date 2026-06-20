/**
 * 정통사주 TEST — 섹션 단건 생성 엔드포인트 (프롬프트 섹션별 튜닝용).
 *
 * 전체(2-pass) 대신 한 섹션만 빠르게 재생성한다.
 *  · core(general/daymaster/element/interaction) → Core 프롬프트 사용
 *  · app(character/career/.../advice)           → App 프롬프트 사용(1차 맥락 없이 단건)
 *  · 끝에 "이 섹션만 출력" 오버라이드를 붙여 해당 섹션만 받는다.
 *  · 크레딧·DB 미반영, 로그인 가드.
 *
 * 호출: POST /api/test/jungtongsaju/section  { sajuResult, section }
 * 트레이드오프: 단건이라 섹션 간 중복 회피(1차↔2차)는 약함 — 톤 튜닝 단계 전용.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { callAI, JUNGTONGSAJU_SYSTEM_PROMPT } from '@/lib/ai/aiClients';
import {
  parseJungtongsaju,
  sanitizeAIOutput,
  type JungtongsajuSectionKey,
} from '@/services/jungtongsajuShared';
import {
  generateJungtongsajuCorePromptTest,
  generateJungtongsajuApplicationPromptTest,
} from '@/constants/test/jungtongsajuPrompt.test';
import { parseAdviceMeta } from '@/services/fortuneService';
import type { SajuResult } from '@/utils/sajuCalculator';

export const preferredRegion = 'icn1';
export const maxDuration = 300;

const CORE_KEYS = ['general', 'daymaster', 'element', 'interaction'];

export async function POST(req: NextRequest) {
  // ── 로그인 가드 ──
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: '인증이 필요해요.' }, { status: 401 });
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }

  let sajuResult: SajuResult;
  let section: JungtongsajuSectionKey;
  let priorSections: Array<{ label: string; text: string }> = [];
  try {
    const body = await req.json();
    sajuResult = body.sajuResult;
    section = body.section;
    if (Array.isArray(body.priorSections)) priorSections = body.priorSections;
    if (!sajuResult || !section) {
      return NextResponse.json({ error: 'sajuResult·section 필요' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }

  // 기준 프롬프트 — core/app 분기
  const basePrompt = CORE_KEYS.includes(section)
    ? generateJungtongsajuCorePromptTest(sajuResult)
    : generateJungtongsajuApplicationPromptTest(sajuResult, '', []);

  // 이미 생성된 다른 섹션들 — 같은 만세력이라 도입·표현이 겹치기 쉬우니 반복 금지 컨텍스트로 주입
  const priorBlock = priorSections.length > 0
    ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[이미 다른 섹션에 쓴 글 — 도입·표현·은유·문장 구조를 반복하지 말 것]
같은 사람의 사주라 비슷해지기 쉽습니다. 아래 글들과 ★다르게★ 쓰세요. 특히:
- ★ 아래 섹션들의 '첫 문장·도입 단어'를 보고, 이번 섹션은 그것들과 겹치지 않는 완전히 다른 방식·다른 첫 단어로 시작할 것. (밤하늘·어둠·고요·별빛·달빛·호수 등 이미 쓴 도입 이미지·단어 재사용 금지)
- "제가 곁에서 지켜보니 / 다 봤어요 / 봤는걸요" 같은 '지켜봤다' 류 도입, "음," 같은 감탄사 도입 반복 금지.
- 같은 은유·같은 비유·같은 표현을 재사용 금지. 겹친다 싶으면 다른 어휘·다른 장면으로.

${priorSections.map(p => `[${p.label}]\n${p.text}`).join('\n\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    : '';

  const override = `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[★★★ 이번 호출 한정 — 위의 '출력 순서·전체 섹션 작성' 지침은 모두 무시]
이번에는 오직 [${section}] 섹션 하나만 작성합니다.
- 출력은 [${section}] 마커 한 줄로 시작해, 그 섹션 본문만 쓰고 즉시 끝냅니다.
- 다른 섹션([general]·[character] 등) 마커나 본문은 절대 출력하지 마세요.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  try {
    const raw = await callAI(basePrompt + priorBlock + override, 6000, { systemPrompt: JUNGTONGSAJU_SYSTEM_PROMPT });
    const content = sanitizeAIOutput(raw.content);
    const parsed = parseJungtongsaju(content);
    const text = parsed[section] ?? content; // 마커 누락 시 통짜 fallback

    const adviceMeta = section === 'advice' && text ? parseAdviceMeta(text) : undefined;

    return NextResponse.json({ success: true, section, text, adviceMeta });
  } catch (e) {
    const message = e instanceof Error ? e.message : '생성 중 오류';
    console.error(`[test/jungtongsaju/section:${section}] 실패:`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
