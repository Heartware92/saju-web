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

// 2단계 강조. **문장** → 굵게(흰색), ==키워드== → 굵게+포인트색(cta). 비탐욕·줄바꿈 허용.
const EMPHASIS_RE = /\*\*([\s\S]+?)\*\*|==([\s\S]+?)==/g;

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
    if (match[1] !== undefined) {
      // **문장** — 섹션 핵심 문장
      nodes.push(
        <strong key={`em-s-${match.index}`} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
          {match[1]}
        </strong>,
      );
    } else {
      // ==키워드== — 중요 단어/구절 (포인트색)
      nodes.push(
        <strong key={`em-k-${match.index}`} className="font-bold text-cta">
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
