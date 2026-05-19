import { ReactNode } from 'react';

/**
 * AI 풀이 본문에서 `**핵심 문장**` 마커를 강조 렌더로 변환.
 *
 * SYSTEM_PROMPT 의 [핵심 문장 강조 규칙] 에 따라 AI 가 한 섹션 최대 1~2 문장만
 * `**...**` 별표로 강조. 정통사주 결과 페이지 전용 (큰 폰트 19px 강조).
 *
 * 다른 페이지는 renderEmphasis 사용 (17px·일반 톤). 마커 ** 자체는 제거.
 */

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
