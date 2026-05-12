/**
 * AI 출력에서 "[은유] 부제목" 마커를 견고하게 추출하고, 본문에서 잔존 마커 줄을 제거.
 *
 * 단순 정규식(`^\[은유\]\s*(.+)`)으로는 다음 케이스를 모두 잡지 못해 보관함 옛 record 재생 시
 * 본문에 [은유] 마커가 그대로 노출되는 사고가 있었음. 모든 변형을 한 곳에서 처리한다.
 *
 * 지원 변형:
 *   [은유] 호수 위의 첫눈
 *   【은유】 호수 위의 첫눈      (전각 대괄호)
 *   『은유』 호수 위의 첫눈      (전각 겹낫표)
 *   [은유:] 호수 위의 첫눈       (콜론 포함)
 *   [은유 : ] 호수 위의 첫눈     (공백 콜론)
 *   **[은유]** 호수 위의 첫눈    (markdown bold)
 *   ▶ [은유] 호수 위의 첫눈      (잔여 기호 prefix)
 *   [은유]: 호수 위의 첫눈       (닫는 대괄호 뒤 콜론)
 *   첫 3줄 너머에 위치           (검색 범위를 텍스트 전체로 확장)
 *
 * 본문 안전망:
 *   매칭된 마커 줄을 본문 전체에서 strip → metaphorTitle 추출 실패 케이스도 본문에 마커가 절대 노출되지 않음.
 */

// 한 줄이 통째로 "[은유] 부제목" 형태인지 매칭 (캡처: 부제목 본문)
const METAPHOR_LINE_CAPTURE =
  /^[\s*▶■#·•\-]*[[【『]\s*은유\s*[:：]?\s*[\]】』][\s*]*[:：]?\s*(.*)$/;

// 본문 strip 용 — multiline 전역. 마커 줄 통째로 제거.
const METAPHOR_LINE_STRIP =
  /^[\s*▶■#·•\-]*[[【『]\s*은유\s*[:：]?\s*[\]】』].*$/gm;

// metaphorTitle 후처리: 양끝 markdown bold (**) 및 잔여 굵게 기호 제거
const STRIP_BOLD = /[*]+/g;

// 부제목 끝의 구두점 (마침표/물음표/느낌표 + 종결어미 직전 등) — 룰 위반이지만 출력 종종 발생
const TRAILING_PUNCT = /[.。,，;；:：!！?？\s]+$/;

export interface MetaphorParsed {
  metaphorTitle: string;
  bodyText: string;
}

export function extractMetaphor(text: string | null | undefined): MetaphorParsed {
  if (!text) return { metaphorTitle: '', bodyText: '' };

  const trimmed = text.trim();
  if (!trimmed) return { metaphorTitle: '', bodyText: '' };

  const lines = trimmed.split('\n');

  let metaphorTitle = '';
  // 첫 3줄이 아니라 전체 줄 검색 — 옛 record 가 카테고리 마커 + 빈 줄 + [은유] 식으로 4줄째에 위치할 수 있음
  for (const line of lines) {
    const stripped = line.trim();
    if (!stripped) continue;

    const m = stripped.match(METAPHOR_LINE_CAPTURE);
    if (m) {
      let title = (m[1] ?? '').trim().replace(STRIP_BOLD, '').trim();
      title = title.replace(TRAILING_PUNCT, '').trim();
      if (title) {
        metaphorTitle = title;
        break;
      }
      // 부제목이 같은 줄이 아니라 다음 줄에 적힌 변형 케이스
      // ex) 마커 줄 ── 빈 줄 ── 다음 줄에 부제목
      const idx = lines.indexOf(line);
      for (let j = idx + 1; j < Math.min(lines.length, idx + 3); j++) {
        const next = lines[j]?.trim();
        if (next && !METAPHOR_LINE_CAPTURE.test(next)) {
          const candidate = next.replace(STRIP_BOLD, '').replace(TRAILING_PUNCT, '').trim();
          // 부제목 휴리스틱: 30자 이내 + 종결어미 없음
          if (candidate.length > 0 && candidate.length <= 40) {
            metaphorTitle = candidate;
          }
          break;
        }
      }
      break;
    }
  }

  // 안전망: 마커 줄을 본문 전체에서 strip (옛 record 잔존 마커 차단)
  let bodyText = trimmed.replace(METAPHOR_LINE_STRIP, '');
  // 연속 빈 줄 정리
  bodyText = bodyText.replace(/\n{3,}/g, '\n\n').trim();

  return { metaphorTitle, bodyText };
}
