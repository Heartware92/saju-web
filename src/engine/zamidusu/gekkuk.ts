/**
 * 자미두수 격국(格局) 자동 판정
 *
 * 명반의 명궁 + 삼방사정(대궁·재백궁·관록궁)에 분포한 14주성 조합을
 * 보고 격국을 자동 매칭한다. 격국 메타데이터는 knowledge.ts 의
 * GEKKUK_META 를 참조한다.
 *
 * 한 명반에 여러 격국이 동시에 성립할 수 있다 (예: 자부동궁 + 자부조원).
 * 호출부에서 tier 우선순위로 노출 격국을 선별할 수 있도록 매칭된 모든
 * 격국을 반환한다.
 */

import type { ZamidusuResult } from '../zamidusu';
import { GEKKUK_META, type GekkukMeta } from './knowledge';

/**
 * 명궁 + 삼방사정(대궁·재백궁·관록궁) 4궁을 이름 기준으로 추출.
 * 자미두수 정통 회조 분석 단위.
 */
function getSanhabPalaces(chart: ZamidusuResult) {
  const findByName = (name: string) => chart.palaces.find((p) => p.name === name);
  return {
    명궁: findByName('명궁'),
    천이궁: findByName('천이궁'),
    재백궁: findByName('재백궁'),
    관록궁: findByName('관록궁'),
  };
}

/**
 * 명반에서 성립하는 모든 격국을 판정해 반환한다.
 *
 * 우선순위 정렬 규칙:
 *   1) tier 우선 (top > high > mid > special)
 *   2) 같은 tier 내에서는 GEKKUK_META 정의 순서
 *
 * 공궁(空宮)은 단독 격국으로, 다른 격국과 함께 노출되지 않는다.
 */
export function detectGekkuk(chart: ZamidusuResult): GekkukMeta[] {
  const { 명궁, 천이궁, 재백궁, 관록궁 } = getSanhabPalaces(chart);
  if (!명궁) return [];

  // 1) 명궁 공궁 — 단독 처리, 다른 격국과 함께 노출하지 않음
  if (명궁.majorStars.length === 0) {
    return [GEKKUK_META.명궁공궁];
  }

  // 2) 4궁의 주성 수집
  const myeonggungStars = new Set(명궁.majorStars.map((s) => s.name));
  const cheoniStars = new Set(천이궁?.majorStars.map((s) => s.name) ?? []);
  const jaeBaekStars = new Set(재백궁?.majorStars.map((s) => s.name) ?? []);
  const gwanrokStars = new Set(관록궁?.majorStars.map((s) => s.name) ?? []);

  const allSanhabStars = new Set<string>([
    ...myeonggungStars,
    ...cheoniStars,
    ...jaeBaekStars,
    ...gwanrokStars,
  ]);
  const myAndOpposite = new Set<string>([...myeonggungStars, ...cheoniStars]);

  // 3) 각 격국 매칭
  const matched: GekkukMeta[] = [];

  for (const [key, meta] of Object.entries(GEKKUK_META)) {
    if (key === '명궁공궁') continue;

    let ok = false;
    switch (meta.pattern) {
      case 'same_palace':
        ok = meta.stars.every((s) => myeonggungStars.has(s));
        break;
      case 'sanhab_huijo':
        ok = meta.stars.every((s) => allSanhabStars.has(s));
        break;
      case 'opposite_palace':
        ok = meta.stars.every((s) => myAndOpposite.has(s));
        break;
    }

    if (ok) matched.push(meta);
  }

  // 4) tier 우선 정렬
  const tierWeight: Record<GekkukMeta['tier'], number> = {
    top: 0, high: 1, mid: 2, special: 3,
  };
  matched.sort((a, b) => tierWeight[a.tier] - tierWeight[b.tier]);

  // 5) 중복 격국 정리: 자부동궁이 성립하면 자부조원은 제외 (자부동궁이 자부조원의 강화판)
  if (matched.some((m) => m.name === '자부동궁')) {
    return matched.filter((m) => m.name !== '자부조원');
  }

  return matched;
}
