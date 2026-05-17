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
  /**
   * 카드 본연의 6맥락 의미 — 정/역방향 중 해당하는 쪽 전체.
   * prompt 에 주입돼 AI 가 카드 의미를 본질로 다루도록 강제.
   * (legacy 호출자 호환 위해 optional)
   */
  contexts?: {
    overall: string;
    love: string;
    career: string;
    money: string;
    health: string;
    advice: string;
  };
}
