import { ReactNode } from 'react';

/**
 * TEST 전용 강조 렌더러 — 라이브 renderEmphasizedBody 무영향.
 *
 * 2단계 강조:
 *  · `**문장**`   → 섹션 핵심 문장 콜아웃 (굵게 + 19px).
 *  · `==키워드==` → 문장 속 중요 구절 (굵게 + 포인트 색).
 *
 * + 한자 괄호 묶음 보호: "편인격(偏印格)" 같은 한자가 줄 끝에서 쪼개지지 않게
 *   괄호 부분만 nowrap (앞 단어는 본문과 자연스럽게 흐름). 한자는 제거하지 않음.
 *
 * 마커(`**`, `==`)는 제거되어 렌더된다. 정통사주 test 전용.
 */
const EMPHASIS_RE = /\*\*([\s\S]+?)\*\*|==([\s\S]+?)==/g;

/** 문단·문장 첫머리의 감탄사 필러("음,", "흠,", "아,", "자,") 제거 — 반복 도입 안전망. */
export function stripLeadingFiller(text: string): string {
  if (!text) return text;
  return text.replace(/(^|\n)[ \t]*(음|흠|아|자)[,，][ \t]*/g, '$1');
}

// "(漢字…)" — 괄호 안이 한자·중점·공백으로만 이뤄진 부분만 nowrap.
const HANJA_GROUP_RE = /([（(][㐀-鿿·\s]+[）)])/g;

/** 일반 텍스트 조각에서 한자 괄호 묶음만 nowrap 으로 감싸 nodes 에 push. */
function pushTextWithHanjaGuard(nodes: ReactNode[], text: string, keyBase: string): void {
  if (!text) return;
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(HANJA_GROUP_RE.source, 'g');
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(
      <span key={`${keyBase}-h-${m.index}`} style={{ whiteSpace: 'nowrap' }}>{m[1]}</span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
}

export function renderEmphasizedBodyTest(text: string): ReactNode[] {
  if (!text) return [text];
  text = stripLeadingFiller(text);

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(EMPHASIS_RE.source, 'g');

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushTextWithHanjaGuard(nodes, text.slice(lastIndex, match.index), `t-${match.index}`);
    }

    if (match[1] !== undefined) {
      nodes.push(
        <strong key={`em-s-${match.index}`} className="font-bold text-text-primary text-[19px] leading-[1.85]">
          {match[1]}
        </strong>,
      );
    } else {
      nodes.push(
        <strong key={`em-k-${match.index}`} className="font-bold text-cta">
          {match[2]}
        </strong>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    pushTextWithHanjaGuard(nodes, text.slice(lastIndex), 't-end');
  }

  return nodes.length > 0 ? nodes : [text];
}
