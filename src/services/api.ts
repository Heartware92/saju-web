/**
 * 타로 카드 정보 타입 정의 (legacy 위치)
 *
 * 옛 직접 OpenAI 호출/프롬프트 함수들은 /api/ai 라우트로 이관되어
 * 모두 제거됨 (2026-05-15). TarotCardInfo 인터페이스만 prompts·TarotPage·
 * fortuneService 에서 import 하므로 유지.
 */

export type TarotElement = 'Fire' | 'Water' | 'Air' | 'Earth' | 'Spirit';

export interface TarotCardInfo {
  name: string;
  nameKr: string;
  element: TarotElement;
  isReversed: boolean;
  keywords: string[];
  meaning: string;
}
