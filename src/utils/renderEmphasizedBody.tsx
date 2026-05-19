import { ReactNode } from 'react';

/**
 * AI 풀이 본문에서 다양한 강조 마커를 시각 렌더로 변환.
 *
 * 정통사주(SajuResultPage) 본문 전용. 두 스타일:
 *  1) `**문장**` — 큰 강조 (19px 볼드). 정통사주 KEY_SENTENCE_EMPHASIS_RULE 룰.
 *  2) 「」 / 〔〕 / 『』 / '...' / "..." — 일반 강조 (17px 볼드 + text-primary 화이트).
 *
 * AI 가 SYSTEM_PROMPT 의 「」 룰을 자주 어기고 한국어 자연 인용으로 '...' 를 쓰는
 * 현실 반영. 마커 「」 '...' "..." 자체는 유지 (제거 X). 별표는 제거.
 */

// 별표 마커 — 큰 강조 (정통사주 핵심 문장)
const BIG_EMPHASIS_RE = /\*\*([\s\S]+?)\*\*/g;
// 일반 강조 마커 — 한글 괄호 + 작은/큰 따옴표 (ASCII + curly), 길이 2~40자
const SMALL_EMPHASIS_RE = /(「[^「」\n]+?」|〔[^〔〕\n]+?〕|『[^『』\n]+?』|['‘][^'’\n]{2,40}['’]|["“][^"”\n]{2,40}["”])/g;

// 통합 — alternation. 별표를 먼저 두어 우선 매칭.
const COMBINED_RE = new RegExp(
  `(${BIG_EMPHASIS_RE.source}|${SMALL_EMPHASIS_RE.source})`,
  'g',
);

function isSmallEmphasis(part: string): boolean {
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

export function renderEmphasizedBody(text: string): ReactNode[] {
  if (!text) return [text];

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  // 새 RegExp 인스턴스 — exec 의 lastIndex 가 함수 호출 사이에 누수되지 않게.
  const re = new RegExp(COMBINED_RE.source, 'g');

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const full = match[0];
    if (full.startsWith('**') && full.endsWith('**')) {
      // 별표 마커 — 큰 강조. 마커 제거 + 19px 볼드.
      nodes.push(
        <strong
          key={`big-${match.index}`}
          className="font-bold text-text-primary text-[19px] leading-[1.85]"
        >
          {full.slice(2, -2)}
        </strong>,
      );
    } else if (isSmallEmphasis(full)) {
      // 한글괄호·따옴표 — 일반 강조. 마커 유지 + 17px 볼드 + 화이트.
      nodes.push(
        <strong
          key={`sm-${match.index}`}
          style={{ color: 'var(--text-primary)', fontWeight: 700 }}
        >
          {full}
        </strong>,
      );
    } else {
      // 매칭은 됐는데 분류 안 됨 — 안전망: 원문 그대로.
      nodes.push(full);
    }
    lastIndex = match.index + full.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}
