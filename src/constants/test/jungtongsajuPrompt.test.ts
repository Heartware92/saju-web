/**
 * 정통사주 프롬프트 — TEST 사본 (test_1 미러 전용).
 *
 * 라이브 프롬프트(@/constants/prompts)를 그대로 쓰되:
 *  ① 톤 레이어를 '별 정령 발랄 페르소나(SPIRIT_PERSONA_RULE)'로 치환
 *  ② 섹션별 은유 소재 '도메인'을 구조적으로 배정(물·불 원소 비유 반복 차단 — 결정론적 가드)
 * 라이브(/saju/*)는 영향 없음. 검증 끝나면 라이브 이식.
 * 호출처: /api/test/jungtongsaju, /api/test/jungtongsaju/section
 */
import {
  generateJungtongsajuCorePrompt,
  generateJungtongsajuApplicationPrompt,
  SPIRIT_TONE_RULE,
  SPIRIT_PERSONA_RULE,
} from '@/constants/prompts';
import type { SajuResult } from '@/utils/sajuCalculator';

// ② 섹션마다 '서로 다른 은유 소재군' 강제 — 같은 원소(물/불) 비유로 수렴하는 문제를 구조적으로 차단.
const METAPHOR_DOMAINS = `

[★ 은유 제목 소재 — 섹션마다 아래 '지정 소재군'에서만 (서로 겹치지 말 것, 물/불 같은 일간 원소 비유 반복 금지)]
[general]=계절·날씨 / [daymaster]=사물·도구 / [element]=색·빛 / [interaction]=길·여정 / [character]=음식·맛 / [career]=공간·건축 / [wealth]=그릇·살림 / [love]=꽃·정원 / [health]=몸·움직임 / [relation]=악기·소리 / [luck]=여행·장소 / [advice]=문·시작`;

const toPersona = (prompt: string): string => {
  const swapped = prompt.includes(SPIRIT_TONE_RULE)
    ? prompt.replace(SPIRIT_TONE_RULE, SPIRIT_PERSONA_RULE)
    : `${SPIRIT_PERSONA_RULE}\n\n${prompt}`;
  return swapped + METAPHOR_DOMAINS;
};

export const generateJungtongsajuCorePromptTest = (result: SajuResult): string =>
  toPersona(generateJungtongsajuCorePrompt(result));

export const generateJungtongsajuApplicationPromptTest = (
  result: SajuResult,
  coreContext: string = '',
  forbiddenAliases: string[] = [],
): string =>
  toPersona(generateJungtongsajuApplicationPrompt(result, coreContext, forbiddenAliases));

/**
 * ③ 결정론적 가드 — '정령이 내가 본다'는 전환구를 생성 후 제거.
 *   프롬프트 금지로도 계속 새어나오는 패턴이라 코드로 직접 strip(test_1 전용).
 *   '당신을/사주를 지켜보니·들여다보니·살펴보니' 류 관찰 도입절만 제거('두고 지켜보다' 등 일반 용법은 목적어가 없어 안전).
 */
export function stripSpiritGaze(text: string): string {
  return text.replace(
    /(^|\n|[.!?]\s|["“'']?\s*)(?:제가\s*|저도\s*|저는\s*)?(?:가만히\s*|문득\s*|곰곰이\s*|살며시\s*|옆에서\s*)*(?:당신을|당신의\s*사주를|사주를|당신의\s*별자리를|명반을|[가-힣]{2,8}\s*님을)\s*(?:가만히\s*|곰곰이\s*)*(?:지켜보|들여다보|살펴보)(?:니|면서|면|다가|았더니|고는|곤\s*해요)?\S*[,\s]*/g,
    '$1',
  );
}
