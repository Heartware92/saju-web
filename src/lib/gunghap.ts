import type { FortuneGrade } from '@/engine/periodFortune';

export const GRADE_COLOR: Record<FortuneGrade, string> = {
  '대길': '#34D399',
  '길': '#86EFAC',
  '중길': '#FBBF24',
  '평': '#CBD5E1',
  '중흉': '#FB923C',
  '흉': '#F87171',
};

export function scoreToGrade(s: number): FortuneGrade {
  if (s >= 90) return '대길';
  if (s >= 82) return '길';
  if (s >= 72) return '중길';
  if (s >= 65) return '평';
  if (s >= 60) return '중흉';
  return '흉';
}

export const GUNGHAP_DOMAINS = [
  { key: 'emotion', label: '정서적 교감' },
  { key: 'communication', label: '소통과 이해' },
  { key: 'values', label: '가치관 조화' },
  { key: 'growth', label: '성장 가능성' },
  { key: 'conflict', label: '갈등 해소력' },
] as const;

export type GunghapDomainKey = typeof GUNGHAP_DOMAINS[number]['key'];
export type GunghapDomainScores = Partial<Record<GunghapDomainKey, number>>;

/** 관계가 시간에 따라 흐르는 추이 — 라벨(만남·6개월·N년차)별 점수 */
export interface GunghapTimelinePoint {
  label: string;
  score: number;
}

/**
 * 궁합 풀이 텍스트의 [gunghap_header] / [gunghap_scores] / [gunghap_timeline] 블록을 파싱.
 * - header: "은유 제목 | 점수"
 * - scores: "정서교감:n|소통이해:n|가치관:n|성장발전:n|갈등해소:n"
 * - timeline: "만남:n|6개월:n|1년차:n|2년차:n|3년차:n|5년차:n"
 * 반환된 body 는 세 블록이 모두 제거된 상태.
 */
export function parseGunghapHeader(text: string): {
  title: string;
  score: number | null;
  domainScores: GunghapDomainScores;
  timeline: GunghapTimelinePoint[];
  body: string;
} {
  let title = '';
  let score: number | null = null;
  const domainScores: GunghapDomainScores = {};
  const timeline: GunghapTimelinePoint[] = [];
  let body = text;

  // 닫는 태그 [/gunghap_header] 는 sanitizeAIOutput 이 제거할 수 있어 optional 처리.
  // 여는 태그 + "제목 | 점수" 한 줄 → 닫는 태그 OR 줄끝 OR 개행까지 매칭.
  const headerMatch = text.match(
    /\[gunghap[_\s]?header\]\s*(.+?)\s*\|\s*(\d{1,3})\s*(?:\[\/gunghap[_\s]?header\]|\n|$)/,
  );
  if (headerMatch) {
    title = headerMatch[1].trim();
    // 종합 점수 floor 60 / ceiling 97 — 다른 카테고리와 일관 (사용자 경험 보호)
    score = Math.min(97, Math.max(60, parseInt(headerMatch[2], 10)));
    body = body
      .replace(/\[gunghap[_\s]?header\][\s\S]*?(?:\[\/gunghap[_\s]?header\]|\n|$)/, '')
      .trim();
  }

  const scoresMatch = body.match(
    /\[gunghap[_\s]?scores\]\s*(.+?)\s*(?:\[\/gunghap[_\s]?scores\]|\n|$)/,
  );
  if (scoresMatch) {
    const pairs = scoresMatch[1].split('|').map(s => s.trim());
    const keyMap: Record<string, GunghapDomainKey> = {
      '정서교감': 'emotion',
      '소통이해': 'communication',
      '가치관': 'values',
      '성장발전': 'growth',
      '갈등해소': 'conflict',
    };
    for (const pair of pairs) {
      const [k, v] = pair.split(':').map(s => s.trim());
      const domainKey = keyMap[k];
      if (domainKey && v) {
        // 영역별 점수 floor 55 / ceiling 97 — 종합보다 약간 더 변동성 허용
        domainScores[domainKey] = Math.min(97, Math.max(55, parseInt(v, 10)));
      }
    }
    body = body
      .replace(/\[gunghap[_\s]?scores\][\s\S]*?(?:\[\/gunghap[_\s]?scores\]|\n|$)/, '')
      .trim();
  }

  // [gunghap_timeline] — "라벨:점수" 쌍을 | 로 구분. 라벨은 한글·숫자 자유.
  const timelineMatch = body.match(
    /\[gunghap[_\s]?timeline\]\s*(.+?)\s*(?:\[\/gunghap[_\s]?timeline\]|\n|$)/,
  );
  if (timelineMatch) {
    const pairs = timelineMatch[1].split('|').map(s => s.trim());
    for (const pair of pairs) {
      // 라벨에 콜론이 없다고 가정 — 마지막 콜론 기준으로 분리해 안전하게 점수 추출
      const idx = pair.lastIndexOf(':');
      if (idx === -1) continue;
      const label = pair.slice(0, idx).trim();
      const v = parseInt(pair.slice(idx + 1).trim(), 10);
      if (label && Number.isFinite(v)) {
        // 추이 점수 floor 45 / ceiling 98 — 흐름의 기복이 보이도록
        timeline.push({ label, score: Math.min(98, Math.max(45, v)) });
      }
    }
    body = body
      .replace(/\[gunghap[_\s]?timeline\][\s\S]*?(?:\[\/gunghap[_\s]?timeline\]|\n|$)/, '')
      .trim();
  }

  return { title, score, domainScores, timeline, body };
}
