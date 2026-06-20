/**
 * TEST 강조 렌더러 — 이제 라이브와 단일 출처.
 * 검증 후 라이브 renderEmphasizedBody 가 2단계 강조(==/**)·한자정리를 모두 흡수했으므로,
 * test 는 라이브를 그대로 가리킨다(드리프트 방지).
 */
export {
  renderEmphasizedBody as renderEmphasizedBodyTest,
  stripLeadingFiller,
  stripHanjaParens,
  toPlainTest,
  cleanKeepMarkers,
} from '@/utils/renderEmphasizedBody';
