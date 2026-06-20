import { ReactNode } from 'react';

/**
 * TEST 전용 강조 렌더러 — 라이브 renderEmphasizedBody 무영향.
 *
 * 2단계 강조:
 *  · `**문장**`   → 섹션 핵심 문장 콜아웃 (굵게 + 19px). (기존 동작 유지)
 *  · `==키워드==` → 문장 속 중요 구절·단어 (굵게 + 포인트 색, 본문 크기). 신규.
 *
 * + 한자 괄호 묶음 보호:
 *  · "편인격(偏印格)", "신강(身强)" 같은 한자 병기가 줄 끝에서 쪼개지지 않게
 *    해당 묶음만 white-space:nowrap 으로 통째 유지. (indents.md 의 "특수 라벨 nowrap 예외")
 *  · 한국어 본문 자체는 정책대로 단어 중간 줄바꿈 허용(건드리지 않음).
 *
 * 마커(`**`, `==`)는 제거되어 렌더된다. 정통사주 test 결과 페이지 전용.
 */
const EMPHASIS_RE = /\*\*([\s\S]+?)\*\*|==([\s\S]+?)==/g;

// "(漢字…)" — 괄호 안이 한자·중점·공백으로만 이뤄진 부분만 nowrap.
// 앞 단어까지 묶으면(예: "계사(癸巳)") 덩어리가 길어져 줄 끝에 빈칸이 생기므로
// 괄호 부분만 묶어 한자 내부 쪼개짐만 막는다. 앞 단어는 본문과 자연스럽게 흐름.
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
      <span key={`${keyBase}-h-${m.index}`} style={{ whiteSpace: 'nowrap' }}>
        {m[1]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
}

export function renderEmphasizedBodyTest(text: string): ReactNode[] {
  if (!text) return [text];

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(EMPHASIS_RE.source, 'g');

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushTextWithHanjaGuard(nodes, text.slice(lastIndex, match.index), `t-${match.index}`);
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
    pushTextWithHanjaGuard(nodes, text.slice(lastIndex), 't-end');
  }

  return nodes.length > 0 ? nodes : [text];
}
