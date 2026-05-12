import { ReactNode } from 'react';

/**
 * AI 풀이 본문에서 `**핵심 문장**` 마커를 강조 렌더로 변환.
 *
 * 정통사주 프롬프트에 "각 섹션 본문 핵심 문장 1~2개를 `**...**` 형태로 표기" 룰을 넣어
 * LLM 이 생성 단계에서 직접 핵심 문장을 마킹하게 한 뒤, 이 유틸이 마커를 시각 강조로 변환한다.
 *
 * - 기존 색상 강조(`highlightSajuTerms`) 대신 사용. 키워드 단위 색상 분산 → 의미 단위 강조 한 곳 집중.
 * - 마커가 없는 옛 record 는 plain 텍스트로 그대로 렌더 (호환).
 * - 중첩 마커는 첫 매치만 인정.
 */

// `**문장**` — 비탐욕 매칭. 줄바꿈 허용(s flag 대신 [\s\S]).
const EMPHASIS_PATTERN = /\*\*([\s\S]+?)\*\*/g;

export function renderEmphasizedBody(text: string): ReactNode[] {
  if (!text) return [text];

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  // 새 RegExp 인스턴스 — exec 의 lastIndex 가 함수 호출 사이에 누수되지 않게.
  const re = new RegExp(EMPHASIS_PATTERN.source, 'g');

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(
      <strong
        key={`em-${match.index}`}
        className="font-bold text-text-primary text-[19px] leading-[1.85]"
      >
        {match[1]}
      </strong>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}
