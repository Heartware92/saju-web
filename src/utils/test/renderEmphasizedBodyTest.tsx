import { ReactNode } from 'react';

/**
 * TEST 전용 강조 렌더러 — 라이브 renderEmphasizedBody 무영향.
 *
 * 2단계 강조:
 *  · `**문장**`   → 섹션 핵심 문장 콜아웃 (굵게 + 19px). (기존 동작 유지)
 *  · `==키워드==` → 문장 속 중요 구절·단어 (굵게 + 포인트 색, 본문 크기). 신규.
 *
 * 마커(`**`, `==`) 자체는 제거되어 렌더된다.
 * 정통사주 test 결과 페이지(Test1ResultPage) 전용.
 */
const EMPHASIS_RE = /\*\*([\s\S]+?)\*\*|==([\s\S]+?)==/g;

export function renderEmphasizedBodyTest(text: string): ReactNode[] {
  if (!text) return [text];

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(EMPHASIS_RE.source, 'g');

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined) {
      // `**문장**` — 핵심 문장 콜아웃
      nodes.push(
        <strong
          key={`em-s-${match.index}`}
          className="font-bold text-text-primary text-[19px] leading-[1.85]"
        >
          {match[1]}
        </strong>,
      );
    } else {
      // `==키워드==` — 구절·키워드 강조 (포인트 색)
      nodes.push(
        <strong
          key={`em-k-${match.index}`}
          className="font-bold text-cta"
        >
          {match[2]}
        </strong>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}
