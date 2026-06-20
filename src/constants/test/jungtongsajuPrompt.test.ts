/**
 * 정통사주 프롬프트 — TEST 사본 (이제 라이브와 단일 출처).
 *
 * 검증이 끝나 라이브(`@/constants/prompts`)로 이식된 뒤로는, test 도 라이브 함수를
 * 그대로 가리킨다(드리프트 방지). test_1 환경은 라이브와 100% 동일한 프롬프트로 동작한다.
 * 호출처: /api/test/jungtongsaju, /api/test/jungtongsaju/section
 */
export {
  generateJungtongsajuCorePrompt as generateJungtongsajuCorePromptTest,
  generateJungtongsajuApplicationPrompt as generateJungtongsajuApplicationPromptTest,
} from '@/constants/prompts';
