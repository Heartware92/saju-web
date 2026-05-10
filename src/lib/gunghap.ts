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

/**
 * 궁합 풀이 텍스트의 [gunghap_header] / [gunghap_scores] 블록을 파싱.
 * - header: "은유 제목 | 점수"
 * - scores: "정서교감:n|소통이해:n|가치관:n|성장발전:n|갈등해소:n"
 * 반환된 body 는 두 블록이 제거된 상태.
 */
export function parseGunghapHeader(text: string): {
  title: string;
  score: number | null;
  domainScores: GunghapDomainScores;
  body: string;
} {
  let title = '';
  let score: number | null = null;
  const domainScores: GunghapDomainScores = {};
  let body = text;

  const headerMatch = text.match(/\[gunghap[_\s]?header\]\s*(.+?)\s*\|\s*(\d{1,3})\s*\[\/gunghap[_\s]?header\]/);
  if (headerMatch) {
    title = headerMatch[1].trim();
    // 종합 점수 floor 60 / ceiling 97 — 다른 카테고리와 일관 (사용자 경험 보호)
    score = Math.min(97, Math.max(60, parseInt(headerMatch[2], 10)));
    body = body.replace(/\[gunghap[_\s]?header\].*?\[\/gunghap[_\s]?header\]\s*\n?/, '').trim();
  }

  const scoresMatch = body.match(/\[gunghap[_\s]?scores\]\s*(.+?)\s*\[\/gunghap[_\s]?scores\]/);
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
    body = body.replace(/\[gunghap[_\s]?scores\].*?\[\/gunghap[_\s]?scores\]\s*\n?/, '').trim();
  }

  return { title, score, domainScores, body };
}
