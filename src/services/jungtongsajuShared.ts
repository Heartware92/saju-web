// src/services/jungtongsajuShared.ts
// 정통사주(jungtongsaju) 관련 *순수 함수* — server/client 양쪽 안전.
//
// fortuneService.ts 는 archiveService('use client') 를 import 하므로 서버 환경에서
// import 할 수 없다. 백그라운드 잡 처리기(/api/fortune/jobs/*)가 정통사주를
// 처리하려면 parse/sanitize/extract 같은 helper 가 필요한데, 이걸 별도 모듈로
// 분리해서 양쪽이 안전하게 import 한다.

import { JUNGTONGSAJU_SECTION_KEYS, type JungtongsajuSectionKey } from '@/constants/prompts';

export { JUNGTONGSAJU_SECTION_KEYS };
export type { JungtongsajuSectionKey };

// ─────────────────────────────────────────────────────────────────────────────
// 섹션별 '도입 방식' 지정 — 모든 섹션이 같은 도입 공식("어머, 당신의 ~을 들여다보니
// 마치 ~ 같아요")으로 열리는 것을 구조적으로 차단. 섹션마다 다른 도입을 강제한다.
// ─────────────────────────────────────────────────────────────────────────────
const SECTION_OPENING_HINTS: Partial<Record<JungtongsajuSectionKey, string>> = {
  general:     '삶의 큰 방향을 보여주는 구체적 인상·장면으로 바로 시작(정령·풍경 묘사 없이)',
  daymaster:   '정령이 당신에게 건네는 다정하거나 짓궂은 질문으로 시작',
  element:     '핵심 결론(어느 기운이 넘치고 모자란지의 의미)을 첫 문장에 툭 던지고 풀기',
  interaction: '겉과 속, 또는 이 기운과 저 기운을 대비하는 문장으로 시작',
  character:   '낯선 자리(회의·소개팅 등)에서의 구체적 행동 장면으로 바로 시작',
  career:      '잘 맞는/안 맞는 일의 결을 단도직입으로 시작',
  wealth:      '돈이 들어오고 나가는 구체적 순간·행동으로 시작',
  love:        '끌림·매력의 구체적 인상이나 장면으로 시작',
  health:      '몸이 보내는 구체적 신호·감각으로 시작',
  relation:    '사람들 사이에서의 한 장면으로 시작',
  // advice(개운법)는 은유제목+시간대+음식 구조화 포맷, luck은 대운별 소섹션이라 도입 지정 제외
};

/** 해당 섹션의 도입 강제 지침(없으면 빈 문자열). 잡·테스트 라우트 공용. */
export function sectionOpeningDirective(key: JungtongsajuSectionKey): string {
  const hint = SECTION_OPENING_HINTS[key];
  if (!hint) return '';
  return `\n[★ 이번 섹션 도입 방식 — 다른 섹션과 절대 겹치지 않게]\n${hint}.\n★ 금지(다른 섹션들이 이미 이렇게 열었음): "어머/에이/와" 류 감탄사로 열기, "당신의/당신 안의 ~을 (가만히) 들여다보니" 도입, "마치 ~ 같아요" 비유 공식. 첫 문장을 위 지정 방식으로, 앞 섹션들과 완전히 다른 첫 단어로 시작할 것.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// sanitizeAIOutput — AI 응답에서 마크다운·이모지·자기소개 문구 등 잔해 제거
// ─────────────────────────────────────────────────────────────────────────────
const STRIP_EMOJI_REGEX =
  /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F02F}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25B5}\u{25B7}-\u{25FF}]/gu;

export const sanitizeAIOutput = (raw: string): string => {
  if (!raw) return '';
  let text = raw;

  // 1) 코드펜스 블록 전체 제거
  text = text.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, '').trim());
  // 2) 줄머리 헤딩 마커
  text = text.replace(/^\s*#{1,6}\s+/gm, '');
  // 3) 줄머리 blockquote
  text = text.replace(/^\s*>\s+/gm, '');
  // 4) 이탤릭만 제거 — ★ '**문장**' 굵게 강조는 렌더러(renderEmphasis/renderEmphasizedBody)가
  //    소비하는 강조 마커이므로 여기서 지우면 안 된다(지우면 강조가 렌더 전에 죽음). 단일 * _ 만 정리.
  text = text.replace(/__(.+?)__/g, '$1');
  text = text.replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1$2');
  text = text.replace(/(^|[^_])_(?!\s)([^_\n]+?)_(?!_)/g, '$1$2');
  // 5) 인라인 백틱
  text = text.replace(/`([^`\n]+?)`/g, '$1');
  // 6) 줄머리 불릿 `* ` → `- `
  text = text.replace(/^\s*\*\s+/gm, '- ');
  // 7) 이모지·장식 기호
  text = text.replace(STRIP_EMOJI_REGEX, '');
  // 8) 닫는 태그 [/xxx]
  text = text.replace(/\[\/[a-zA-Z_]+\]/g, '');
  // 9) AI 자기소개 문구
  text = text.replace(/^\s*(?:AI로서|인공지능으로서|챗봇으로서|저는 AI)[^\n]*\n?/gm, '');
  text = text.replace(/제공된 (?:데이터|정보)에 (?:따르면|근거하여)[^,.\n]*[,.]?/g, '');
  // 10) 공백·개행 정리
  text = text.replace(/[ \t]+\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/^[ \t]+/gm, (m) => m.replace(/\t/g, '  '));

  return text.trim();
};

// ─────────────────────────────────────────────────────────────────────────────
// stripAllSectionTags — 섹션 파싱 실패 시 모든 구조적 태그를 제거한 평문 반환
// ─────────────────────────────────────────────────────────────────────────────
export const stripAllSectionTags = (text: string): string =>
  text
    .replace(/\[\/?[a-zA-Z_]+\]/g, '')
    .replace(/^[\s*▶■#·•\-]*[[【『]\s*은유\s*[:：]?\s*[\]】』].*$/gm, '')
    .replace(/[\s*]*[[【『]\s*은유\s*[:：]?\s*[\]】』][\s*]*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// ─────────────────────────────────────────────────────────────────────────────
// parseJungtongsaju — AI 응답을 섹션별 dict 로 파싱
// ─────────────────────────────────────────────────────────────────────────────
export const parseJungtongsaju = (
  raw: string,
): Partial<Record<JungtongsajuSectionKey, string>> => {
  const out: Partial<Record<JungtongsajuSectionKey, string>> = {};
  const keysPattern = JUNGTONGSAJU_SECTION_KEYS.join('|');

  // AI 가 마커 주변에 markdown·prefix 기호를 끼우는 케이스 흡수 — 줄 통째가 마커이면
  // 양옆 장식을 깎아 [key] 단독 줄로 정규화.
  const normalized = raw.replace(
    new RegExp(`^[\\s*#▶■·•\\-]*\\[(${keysPattern})\\][\\s*#]*$`, 'gm'),
    '[$1]',
  );

  const parts = normalized.split(new RegExp(`^\\s*\\[(${keysPattern})\\]\\s*$`, 'm'));
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i] as JungtongsajuSectionKey;
    const body = (parts[i + 1] || '').trim();
    if (body) out[key] = body;
  }

  // 마커 파싱 실패 fallback — "1. 사주 총론" 형식 번호 헤딩으로 split
  if (Object.keys(out).length === 0) {
    const numericParts = raw.split(/^(?:#{1,3}\s+)?\s*(\d{1,2})\.?\s+[가-힣·\s]{2,30}\s*$/m);
    if (numericParts.length >= 3) {
      for (let i = 1; i < numericParts.length; i += 2) {
        const sectionIdx = parseInt(numericParts[i], 10);
        const body = (numericParts[i + 1] || '').trim();
        const key = JUNGTONGSAJU_SECTION_KEYS[sectionIdx - 1];
        if (key && body) out[key] = body;
      }
    }
  }

  return out;
};

// ─────────────────────────────────────────────────────────────────────────────
// extractMetaphorAliases — 1차 본문에서 시적 별칭을 자동 추출 (2차 차단용)
// ─────────────────────────────────────────────────────────────────────────────
export const extractMetaphorAliases = (coreContent: string): string[] => {
  const found = new Set<string>();

  // 1) 괄호 안 시적 별칭
  const parenRegex = /\(([가-힣 ,·]{6,40})\)/g;
  let m;
  while ((m = parenRegex.exec(coreContent)) !== null) {
    const inner = m[1].trim();
    if (/[ ,]/.test(inner) && !inner.includes('점') && !inner.includes('년')) {
      found.add(inner);
    }
  }

  // 2) KB 의 핵심 시적 별칭 (직접 매칭)
  const kbAliases = [
    '가장 멀리, 홀로 빛나는 별', '가장 멀리 홀로 빛나는 별', '홀로 먼 곳에서 빛나는 별',
    '겨울 밤하늘 은하수', '겨울 밤 은하수', '겨울 밤하늘',
    '한낮 정오의 태양', '정오의 태양', '정오 태양',
    '봄 새벽 첫 햇살', '봄 새벽 햇살', '봄 새벽',
    '서리 내린 새벽',
    '환절기 구름',
    '보름달처럼', '보름달', '초승달', '반달',
    '북극성',
    '아침 햇살이 정원을', '프리즘을 통과한 빛',
    '혜성처럼', '혜성', '달이 꾸준히 차오르는',
    '나란히 빛나는 쌍둥이 별', '내 빛을 빼앗으려는 그림자 별', '그림자 별',
    '흐린 밤에도 유독 밝게 빛나는', '꽃이 만개한 봄밤의 달빛',
    '별똥별', '하늘 정중앙에 뜬 별',
  ];
  kbAliases.forEach((alias) => {
    if (coreContent.includes(alias)) found.add(alias);
  });

  // 3) 정형 표기 패턴
  const formulaicPatterns = [
    /용신인 [목화토금수]\([가-힣·]+\)[,，]?\s*즉 [가-힣·/]+/g,
    /결핍 오행인 [목화토금수]\([가-힣·]+\)/g,
    /과다 오행인 [목화토금수]\([가-힣·]+\)/g,
    /격국이 만드는 인생 [가-힣 ]+/g,
  ];
  formulaicPatterns.forEach((re) => {
    let mm;
    while ((mm = re.exec(coreContent)) !== null) {
      found.add(mm[0].trim());
    }
  });

  // 4) 결론 표현
  const conclusionPatterns = [
    '새로운 시작에 대한 망설임',
    '실행력이 부족',
    '실행력 부족',
    '계획만 세우고',
    '실제 행동으로 옮기는 데 어려움',
    '과도한 분석',
    '지나치게 신중하고 완벽',
    '완벽주의로 이어',
    '기회를 놓치',
    '계획에만 몰두',
    '디테일에 갇혀',
    '겉냉속열', '겉은 차분, 속은 열정', '겉은 차분하고', '속은 뜨거운',
  ];
  conclusionPatterns.forEach((p) => {
    if (coreContent.includes(p)) found.add(p);
  });

  return Array.from(found).filter((s) => s.length >= 4 && s.length <= 60);
};
