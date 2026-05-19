/**
 * 본문 강조 변환 — `**핵심 문장**` 마커만 매칭.
 *
 * SYSTEM_PROMPT 의 [핵심 문장 강조 규칙] 에 따라 AI 가 한 섹션 최대 1~2 문장만
 * `**...**` 별표로 강조. 클라이언트는 그 마커를 볼드 + text-primary 화이트로 변환
 * (마커 ** 자체는 제거).
 *
 * 일반 인용 ('...' "..." 「」) 은 매칭 안 함 — 의도되지 않은 강조 노이즈 차단.
 */

import React from 'react';

// 비탐욕 매칭. 줄바꿈 허용([\s\S]).
const EMPHASIS_RE = /\*\*([\s\S]+?)\*\*/g;

export function renderEmphasis(text: string): React.ReactNode[] {
  if (!text) return [text];
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(EMPHASIS_RE.source, 'g');

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(
      <strong
        key={`em-${match.index}`}
        style={{ color: 'var(--text-primary)', fontWeight: 700 }}
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
