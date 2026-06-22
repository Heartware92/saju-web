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

[★ 은유·비유 소재 — 섹션마다 아래 '오행 만물 패밀리'를 주 소재로 (다섯 기운을 골고루, 같은 소재 두 섹션 반복 금지)]
[general]=빛·하늘·노을 / [daymaster]=물·이슬·수정·강 / [element]=흙·산·들·정원 / [interaction]=나무·숲·덩굴·길 / [character]=불·불꽃·화로 / [career]=금·보석·거울·연장 / [wealth]=흙·곳간·열매·샘 / [love]=꽃·정원·새싹 / [health]=물·바다·바람 / [relation]=소리·울림·악기 / [luck]=무지개·별빛·보석 / [advice]=여명·새싹·문`;

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
