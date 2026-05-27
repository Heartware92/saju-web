/**
 * 자미두수 UI 표시 가드 — 별 brightness·mutagen 값 유효성 검사.
 *
 * iztro 한국어 로케일이 가끔 brightness/mutagen 값을 변환하지 못하고
 * 숫자(-1, +1) 또는 영문 코드로 흘려보내는 경우가 있어, UI 표시 시
 * 화이트리스트로 가드한다. 알려진 한글 값만 노출, 나머지는 숨김.
 *
 * 참고: BRIGHTNESS_SCORE(visualization.ts) 키와 화이트리스트는 같은 집합.
 */

export const VALID_BRIGHTNESS = ['묘', '왕', '지', '득', '이', '평', '불', '함'] as const;
export const VALID_MUTAGEN = ['화록', '화권', '화과', '화기'] as const;

export function isValidBrightness(v: string | undefined | null): boolean {
  return !!v && (VALID_BRIGHTNESS as readonly string[]).includes(v);
}

export function isValidMutagen(v: string | undefined | null): boolean {
  return !!v && (VALID_MUTAGEN as readonly string[]).includes(v);
}
