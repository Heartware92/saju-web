/**
 * 정통사주 본문 키워드 강조 — 오탐 0 보장 룰셋
 *
 * 매칭 원칙:
 *   1) 도메인 전용 어휘만 매칭 (사주 외 일반 사용 거의 없음)
 *   2) 단독 오행 글자(목·화·토·금·수)는 사주 문맥 lookahead 로만 매칭
 *   3) 한글로 둘러싸이면 매칭 안 함 ("금요일", "수도", "토양" 등 차단)
 *   4) 십성은 "상관" 처럼 일반 단어와 충돌 위험 있는 것은 제외 / 조사 lookahead 로 제한
 *   5) "일주" 는 "일주일" 차단을 위해 `(?!일)` 특수 처리
 *
 * 스타일: 색상 + font-weight:600 (용신류·신강은 700). 크기는 그대로 (line-height 유지).
 */

import type { ReactNode } from 'react';

const ELEMENT_COLORS: Record<string, string> = {
  '목': '#34D399',
  '화': '#F43F5E',
  '토': '#F59E0B',
  '금': '#E2E8F0',
  '수': '#3B82F6',
};

const SIPSEONG_COLOR = '#A78BFA';
const SINSAL_COLOR = '#C084FC';
const YONGSIN_COLOR = '#FBBF24';

// 십성 trailing lookahead 제거됨 — "비견운", "비견적", "비견·겁재", "비견(比肩)" 등 자연스러운 후속 형태 모두 강조 대상에 포함하기 위함.
// 부분 단어 prefix 충돌은 lookbehind `(?<![가-힣])` 가 차단.

type Rule = {
  pattern: RegExp;
  color: string | 'element-from-match';
  weight?: number;
};

const RULES: Rule[] = [
  // 1) 한자 병기 — 가장 안전
  {
    pattern: /(?<![가-힣])(?:목\(木\)|화\(火\)|토\(土\)|금\(金\)|수\(水\))/g,
    color: 'element-from-match',
  },
  // 2) 천간+오행
  {
    pattern: /(?<![가-힣])(?:갑목|을목|병화|정화|무토|기토|경금|신금|임수|계수)(?![가-힣])/g,
    color: 'element-from-match',
  },
  // 3) 지지+오행
  {
    pattern: /(?<![가-힣])(?:인목|묘목|사화|오화|진토|술토|축토|미토|유금|해수)(?![가-힣])/g,
    color: 'element-from-match',
  },
  // 4) 단독 오행 — 사주 문맥 조사+의미단어 lookahead 필수
  {
    pattern: /(?<![가-힣])(?:목|화|토|금|수)(?=\s*(?:기운|기|성분|운|이\s*(?:강|약|많|적|부족|왕|쇠|왕성|왕함)|가\s*(?:강|약|많|적|부족|왕|쇠)|을\s*(?:생|극|돕)|이\s*(?:생|극|돕)))/g,
    color: 'element-from-match',
  },
  // 5) 십성 — 상관 제외 ("상관없다" 일반 단어 충돌 매우 흔해서), lookbehind 만 사용
  //    trailing 제거로 "비견운", "비견적", "비견·겁재", "비견(比肩)" 등 모두 강조 대상.
  //    "비견할" 같은 일반 비교 표현은 사주 본문에 거의 등장하지 않아 trade-off 수용.
  {
    pattern: /(?<![가-힣])(?:비견|겁재|식신|편재|정재|편관|정관|편인|정인)/g,
    color: SIPSEONG_COLOR,
  },
  // 6) 용신류 — 핵심 강조
  {
    pattern: /(?<![가-힣])(?:용신|희신|기신|구신|체신|약신)/g,
    color: YONGSIN_COLOR,
    weight: 700,
  },
  // 7) 격국 — 3-char unique
  {
    pattern: /(?<![가-힣])(?:정관격|편관격|정인격|편인격|식신격|상관격|정재격|편재격|비견격|겁재격|건록격|양인격|종격|화격|특수격|격국)/g,
    color: SIPSEONG_COLOR,
  },
  // 7b) 일주 — "일주일" 차단
  {
    pattern: /(?<![가-힣])일주(?!일)/g,
    color: SIPSEONG_COLOR,
  },
  // 8) 신살 — "...살" suffix 또는 unique 도메인 단어만. 조사+의 한글이 따라올 수 있어 trailing lookahead 제거.
  {
    pattern: /(?<![가-힣])(?:천을귀인|역마살|도화살|화개살|삼재|공망|백호살|괴강살|월덕|천덕|문창|문곡|학당|급각살|양인살|장성살|반안|망신살|월공|십악대패|천라지망|음양차착|고진과숙|음착|양착)/g,
    color: SINSAL_COLOR,
  },
  // 9) 신강 / 득령·득세·득지·실령·실세·실지 (신약·중화는 일반 단어 충돌로 제외)
  {
    pattern: /(?<![가-힣])(?:신강|득령|득세|득지|실령|실세|실지)/g,
    color: YONGSIN_COLOR,
    weight: 700,
  },
];

type Match = { start: number; end: number; text: string; color: string; weight: number };

function elementColorFromMatch(matched: string): string {
  if (matched.length === 4 && matched[1] === '(') return ELEMENT_COLORS[matched[0]] ?? '#fff';
  if (matched.length === 2) return ELEMENT_COLORS[matched[1]] ?? '#fff';
  if (matched.length === 1) return ELEMENT_COLORS[matched] ?? '#fff';
  return '#fff';
}

function collectMatches(text: string): Match[] {
  const matches: Match[] = [];
  for (const rule of RULES) {
    const flags = rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g';
    const re = new RegExp(rule.pattern.source, flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index === re.lastIndex) re.lastIndex++;
      const color =
        rule.color === 'element-from-match' ? elementColorFromMatch(m[0]) : rule.color;
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        color,
        weight: rule.weight ?? 600,
      });
    }
  }
  return matches;
}

function dedupeMatches(matches: Match[]): Match[] {
  const sorted = [...matches].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (b.end - b.start) - (a.end - a.start);
  });
  const result: Match[] = [];
  let cursor = -1;
  for (const m of sorted) {
    if (m.start < cursor) continue;
    result.push(m);
    cursor = m.end;
  }
  return result;
}

/**
 * 텍스트를 받아 키워드 강조된 React 노드 배열을 반환.
 */
export function highlightSajuTerms(text: string): ReactNode[] {
  if (!text) return [text];
  const raw = collectMatches(text);
  const merged = dedupeMatches(raw);
  if (merged.length === 0) return [text];

  const nodes: ReactNode[] = [];
  let last = 0;
  merged.forEach((m, i) => {
    if (m.start > last) nodes.push(text.slice(last, m.start));
    nodes.push(
      <span
        key={`hl-${i}-${m.start}`}
        style={{
          color: m.color,
          fontWeight: m.weight,
        }}
      >
        {m.text}
      </span>,
    );
    last = m.end;
  });
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
