/**
 * 본문 강조 변환 — 다양한 인용 마커 → 볼드 + text-primary 화이트
 *
 * 매칭 패턴:
 *  · 한글 괄호: 「」 〔〕 『』  (SYSTEM_PROMPT 권장 — 자주 안 지켜짐)
 *  · 작은따옴표: '...' '...' (AI 가 한국어에서 자연 인용으로 가장 많이 씀)
 *  · 큰따옴표: "..." "..." (직접 인용 — 강조 의도일 때만 짧은 길이)
 *
 * 길이 제한 — 2~40자: 너무 짧거나 긴 건 강조 아닌 일반 인용일 가능성.
 * 마커 자체는 유지 (제거 X).
 */

import React from 'react';

// 한글 괄호 — 항상 매칭
const KOREAN_BRACKET_RE = /(「[^「」\n]+?」|〔[^〔〕\n]+?〕|『[^『』\n]+?』)/g;
// 작은따옴표 (ASCII ' + curly ' ') — 길이 2~40자
const SINGLE_QUOTE_RE = /(['‘][^'’\n]{2,40}['’])/g;
// 큰따옴표 (ASCII " + curly " ") — 길이 2~40자
const DOUBLE_QUOTE_RE = /(["“][^"”\n]{2,40}["”])/g;

const COMBINED_RE = new RegExp(
  `(${KOREAN_BRACKET_RE.source}|${SINGLE_QUOTE_RE.source}|${DOUBLE_QUOTE_RE.source})`,
  'g'
);

function isEmphasisPart(part: string): boolean {
  if (!part) return false;
  const first = part[0];
  const last = part[part.length - 1];
  if (first === '「' && last === '」') return true;
  if (first === '〔' && last === '〕') return true;
  if (first === '『' && last === '』') return true;
  if ((first === "'" || first === '‘') && (last === "'" || last === '’')) return true;
  if ((first === '"' || first === '“') && (last === '"' || last === '”')) return true;
  return false;
}

export function renderEmphasis(text: string): React.ReactNode[] {
  if (!text) return [text];
  const parts = text.split(COMBINED_RE).filter(Boolean);
  return parts.map((part, i) => {
    if (isEmphasisPart(part)) {
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
