/**
 * 정통사주 프롬프트 — TEST 사본 (이제 라이브와 단일 출처).
 *
 * 별 정령 페르소나(SPIRIT_PERSONA_RULE + METAPHOR_DOMAINS)와 stripSpiritGaze 가 라이브로 이식돼,
 * test_1 도 라이브(@/constants/prompts, jungtongsajuJob)와 100% 동일한 프롬프트·가드로 동작한다.
 * 호출처: /api/test/jungtongsaju, /api/test/jungtongsaju/section
 */
export {
  generateJungtongsajuCorePrompt as generateJungtongsajuCorePromptTest,
  generateJungtongsajuApplicationPrompt as generateJungtongsajuApplicationPromptTest,
} from '@/constants/prompts';
export { stripSpiritGaze } from '@/services/jungtongsajuShared';
