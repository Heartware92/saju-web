/**
 * 작명 4격(원·형·이·정) 계산 + 81 수리 길흉 lookup
 *
 * 전통 한국 작명학 표준:
 *  - 원격(元格) = 이름 첫 글자 획수 + 이름 끝 글자 획수 → 초년운 (~35세)
 *  - 형격(亨格) = 성씨 획수 + 이름 첫 글자 획수 → 중년운·주운 (35~55)
 *  - 이격(利格) = 성씨 획수 + 이름 끝 글자 획수 → 사회운·대인관계
 *  - 정격(貞格) = 모든 글자 획수 합 → 평생운·총운
 *
 * 외자 이름·외자 성 등 경계 케이스는 표준 룰 적용 (한 글자만 있으면 0 으로 더해 처리).
 */

import { lookupHanjaBySound } from '../lib/data/hanjaByKoreanSound';
import { lookupSuri, SURI_ELEMENT_KOREAN, type SuriEntry } from '../lib/data/numerology81';

export interface FourGyeokResult {
  /** 각 한자의 획수 (이름 글자 순서대로) */
  strokes: number[];
  /** 4격 각각의 합산 수와 길흉 */
  won:    { sum: number; entry: SuriEntry };  // 원격: 초년운
  hyeong: { sum: number; entry: SuriEntry };  // 형격: 중년운·주운
  i:      { sum: number; entry: SuriEntry };  // 이격: 사회운·대인관계
  jeong:  { sum: number; entry: SuriEntry };  // 정격: 평생운·총운
}

/**
 * 한자 1글자에서 획수 조회. 정적 데이터에서 lookup, 없으면 0.
 */
export function strokesOf(char: string, sound: string): number {
  const candidates = lookupHanjaBySound(sound);
  const hit = candidates.find(c => c.char === char);
  return hit?.strokes ?? 0;
}

/**
 * 4격 계산. hanjaName 의 각 한자 + 각 글자의 한국 음을 받아 획수 lookup → 4격 합산.
 *
 * 입력 형식:
 *  - chars: 한자 배열 (예: ['許', '珍', '宇']) — 첫 글자가 성씨로 간주
 *  - sounds: 한국 음 배열 (예: ['허', '진', '우'])
 *
 * 외자 성 + 외자 이름(2글자 전체): 성=1, 이름=1
 * 외자 이름(2글자 전체 = 성1 + 이름1): 원격 = 이름 끝(=1자) → 1글자 강도만
 */
export function calc4Gyeok(chars: string[], sounds: string[]): FourGyeokResult | null {
  if (chars.length === 0 || chars.length !== sounds.length) return null;
  const strokes = chars.map((c, i) => strokesOf(c, sounds[i]));

  // 0 획이 하나라도 있으면 계산 불가 (정적 데이터 외 한자)
  if (strokes.some(s => s === 0)) return null;

  const surname = strokes[0];
  const nameStrokes = strokes.slice(1); // 이름 부분 (성씨 제외)
  if (nameStrokes.length === 0) return null;

  const nameFirst = nameStrokes[0];
  const nameLast = nameStrokes[nameStrokes.length - 1];
  const nameSum = nameStrokes.reduce((a, b) => a + b, 0);

  // 원격 = 이름 첫 + 이름 끝 (외자 이름이면 = 외자 한 번만)
  const wonSum = nameStrokes.length === 1 ? nameFirst : nameFirst + nameLast;
  // 형격 = 성씨 + 이름 첫
  const hyeongSum = surname + nameFirst;
  // 이격 = 성씨 + 이름 끝
  const iSum = surname + nameLast;
  // 정격 = 전체
  const jeongSum = surname + nameSum;

  return {
    strokes,
    won:    { sum: wonSum,    entry: lookupSuri(wonSum) },
    hyeong: { sum: hyeongSum, entry: lookupSuri(hyeongSum) },
    i:      { sum: iSum,      entry: lookupSuri(iSum) },
    jeong:  { sum: jeongSum,  entry: lookupSuri(jeongSum) },
  };
}

/**
 * 4격 종합 점수 (참고용 — 청월당식 0~40점 환산).
 *  대길 10 / 길 8 / 평 5 / 흉 2 / 대흉 0 — 4격 평균.
 */
export function suri4GradeScore(result: FourGyeokResult): number {
  const map: Record<string, number> = { '대길': 10, '길': 8, '평': 5, '흉': 2, '대흉': 0 };
  const grades = [result.won.entry.grade, result.hyeong.entry.grade, result.i.entry.grade, result.jeong.entry.grade];
  const sum = grades.reduce((a, g) => a + (map[g] ?? 0), 0);
  return sum; // 0~40
}

/**
 * 4격 결과를 prompt 주입용 텍스트로 포맷.
 * 수리오행(끝자리 기준)도 함께 노출 — 용신 매칭 판정에 사용.
 */
export function format4GyeokForPrompt(result: FourGyeokResult): string {
  const f = (label: string, area: string, g: { sum: number; entry: SuriEntry }) =>
    `${label}(${area}) = ${g.sum}수 [수리오행 ${SURI_ELEMENT_KOREAN[g.entry.element]}] — ${g.entry.grade} ${g.entry.name}: ${g.entry.meaning}`;
  return [
    f('원격', '초년운',         result.won),
    f('형격', '중년·주운',       result.hyeong),
    f('이격', '사회·인간관계',    result.i),
    f('정격', '평생·총운',       result.jeong),
  ].join('\n');
}
