import { ReactNode } from 'react';

/**
 * TEST 전용 강조 렌더러 — 라이브 renderEmphasizedBody 무영향.
 *
 * 2단계 강조:
 *  · `**문장**`   → 섹션 핵심 문장 콜아웃 (굵게 + 19px).
 *  · `==키워드==` → 문장 속 중요 구절 (굵게 + 포인트 색).
 *
 * + 한자(漢字) 제거 안전망(stripHanjaTest):
 *  · 프롬프트가 "한자 0"을 지시하지만, LLM 누수 대비로 렌더 단계에서 한 번 더 제거.
 *  · "계사(癸巳)" → "계사", "용신 木" → "용신". 빠진 빈 괄호도 정리.
 *
 * 마커(`**`, `==`)는 제거되어 렌더된다. 정통사주 test 전용.
 */
const EMPHASIS_RE = /\*\*([\s\S]+?)\*\*|==([\s\S]+?)==/g;

/** 한자 제거 안전망 — 화면에 한자가 단 한 글자도 안 뜨게 보장. */
export function stripHanjaTest(text: string): string {
  if (!text) return text;
  return text
    .replace(/[㐀-鿿]+/g, '')       // CJK 한자 제거
    .replace(/[（(]\s*[）)]/g, '')   // 한자가 빠져 비게 된 괄호 제거
    .replace(/[ \t]{2,}/g, ' ');     // 중복 공백 정리(줄바꿈은 보존)
}

export function renderEmphasizedBodyTest(text: string): ReactNode[] {
  if (!text) return [text];
  text = stripHanjaTest(text);

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(EMPHASIS_RE.source, 'g');

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));

    if (match[1] !== undefined) {
      // `**문장**` — 핵심 문장 콜아웃
      nodes.push(
        <strong key={`em-s-${match.index}`} className="font-bold text-text-primary text-[19px] leading-[1.85]">
          {match[1]}
        </strong>,
      );
    } else {
      // `==키워드==` — 구절 강조 (포인트 색)
      nodes.push(
        <strong key={`em-k-${match.index}`} className="font-bold text-cta">
          {match[2]}
        </strong>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));

  return nodes.length > 0 ? nodes : [text];
}
