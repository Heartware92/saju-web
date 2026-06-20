import { ReactNode } from 'react';

/**
 * 정통사주 본문 강조 렌더러 — 2단계 강조 + 한자 병기 정리.
 *
 * 2단계 강조:
 *  · `**문장**`   → 섹션 핵심 문장 콜아웃 (굵게 + 19px).
 *  · `==키워드==` → 문장 속 중요 구절 (굵게 + 포인트 색).
 *
 * + 한자 괄호 묶음 정리: "목(木)"→"목", "정재(正財)"→"정재". 한글 풀이 괄호("목(나무)")는 보존.
 * + 문단 첫머리 감탄사 필러("음,"·"흠,"·"아,"·"자,") 제거 (반복 도입 안전망).
 *
 * 정통사주 결과 페이지 + 공유 블록 전용. 마커(`**`,`==`)는 제거되어 렌더된다.
 * 다른 페이지는 renderEmphasis 사용(17px·일반 톤).
 */
const EMPHASIS_RE = /\*\*([\s\S]+?)\*\*|==([\s\S]+?)==/g;

/** 문단·문장 첫머리의 감탄사 필러("음,", "흠,", "아,", "자,") 제거 — 반복 도입 안전망. */
export function stripLeadingFiller(text: string): string {
  if (!text) return text;
  return text.replace(/(^|\n)[ \t]*(음|흠|아|자)[,，][ \t]*/g, '$1');
}

/**
 * 한자-only 괄호 제거 — "목(木)"→"목", "정재(正財)"→"정재", "계묘(癸卯)"→"계묘".
 * 괄호 안이 한자·중점·공백뿐일 때만 제거(=교과서식 한자 병기). 한글 풀이 괄호 "목(나무)",
 * "(생각·배움의 힘)" 는 그대로 보존. 한자 자체를 다 지우진 않고 '병기 괄호'만 정리.
 */
export function stripHanjaParens(text: string): string {
  if (!text) return text;
  return text
    .replace(/\s*[（(][㐀-鿿\s·,]+[）)]/g, '')
    .replace(/[ \t]{2,}/g, ' ');
}

/**
 * 마커 제거 후 순수 텍스트 — 마커(==,**)를 못 푸는 공유 컴포넌트에 넘기기 전 정리용.
 */
export function toPlainTest(text: string, collapseNewlines = false): string {
  if (!text) return text;
  let t = stripHanjaParens(stripLeadingFiller(text))
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/==([\s\S]+?)==/g, '$1');
  if (collapseNewlines) t = t.replace(/[ \t]*\n[ \t]*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return t;
}

/**
 * 마커(==,**)는 그대로 두고 한자병기·필러만 정리 + (옵션) 줄바꿈 정상화.
 * → renderBody(renderEmphasizedBody)로 넘겨 볼드 강조까지 살릴 때 사용.
 */
export function cleanKeepMarkers(text: string, collapseNewlines = false): string {
  if (!text) return text;
  let t = stripHanjaParens(stripLeadingFiller(text));
  if (collapseNewlines) t = t.replace(/[ \t]*\n[ \t]*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
  return t;
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

export function renderEmphasizedBody(text: string): ReactNode[] {
  if (!text) return [text];
  text = stripHanjaParens(stripLeadingFiller(text));

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
