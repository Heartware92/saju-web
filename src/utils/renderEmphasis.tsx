/**
 * 한글 괄호 강조 변환 — 「...」 → 볼드 + text-primary 화이트
 *
 * SYSTEM_PROMPT 룰: 본문 강조는 「」 〔〕 『』 한글 괄호로 표기.
 * 클라이언트에서 이 마커를 시각적으로 볼드·화이트로 강조 (마커 「」 자체는 유지).
 *
 * PoC 단계 — 사용자 피드백에 따라 마커 제거·색 조정·되돌림 가능.
 */

import React from 'react';

const EMPH_RE = /(「[^「」\n]+?」|〔[^〔〕\n]+?〕|『[^『』\n]+?』)/g;

export function renderEmphasis(text: string): React.ReactNode[] {
  if (!text) return [text];
  const parts = text.split(EMPH_RE);
  return parts.map((part, i) => {
    if (
      (part.startsWith('「') && part.endsWith('」')) ||
      (part.startsWith('〔') && part.endsWith('〕')) ||
      (part.startsWith('『') && part.endsWith('』'))
    ) {
      return (
        <strong
          key={i}
          style={{ color: 'var(--text-primary)', fontWeight: 700 }}
        >
          {part}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
