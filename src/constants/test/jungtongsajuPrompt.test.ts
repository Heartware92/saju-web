/**
 * 정통사주 프롬프트 — TEST 사본 (test_1 미러 전용).
 *
 * 라이브 프롬프트(@/constants/prompts)를 그대로 쓰되, 톤 레이어만 '별 정령 페르소나 카드'로
 * 치환해 test_1 에서 새 말투를 실험한다. 라이브(/saju/*)는 영향 없음.
 * 검증이 끝나면 SPIRIT_PERSONA_RULE 을 라이브로 이식.
 * 호출처: /api/test/jungtongsaju, /api/test/jungtongsaju/section
 */
import {
  generateJungtongsajuCorePrompt,
  generateJungtongsajuApplicationPrompt,
  SPIRIT_TONE_RULE,
  SPIRIT_PERSONA_RULE,
} from '@/constants/prompts';
import type { SajuResult } from '@/utils/sajuCalculator';

const toPersona = (prompt: string): string =>
  prompt.includes(SPIRIT_TONE_RULE)
    ? prompt.replace(SPIRIT_TONE_RULE, SPIRIT_PERSONA_RULE)
    : `${SPIRIT_PERSONA_RULE}\n\n${prompt}`;

export const generateJungtongsajuCorePromptTest = (result: SajuResult): string =>
  toPersona(generateJungtongsajuCorePrompt(result));

export const generateJungtongsajuApplicationPromptTest = (
  result: SajuResult,
  coreContext: string = '',
  forbiddenAliases: string[] = [],
): string =>
  toPersona(generateJungtongsajuApplicationPrompt(result, coreContext, forbiddenAliases));
