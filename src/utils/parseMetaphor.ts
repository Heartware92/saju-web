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

// "1. 총운 — 우레 소리 속에 ..." / "2. 괘의 의미 - 그릇" 처럼 번호+섹션라벨+은유 패턴
// (캡처: 라벨 / 부제목 본문). 토정비결·자미두수·신년운세 등 일부 풀이에서 AI 가
// 본문 첫 줄에 이 prefix 를 함께 출력하는 케이스가 잦음.
// 라벨 길이 1~30자 + dash/colon 1개. 본문 본문이 우연히 매칭되는 것 막기 위해
// 라벨 부분에 마침표·종결어미 없음.
const NUMBERED_SECTION_CAPTURE =
  /^\s*\d+\.\s*([^—\-–:：.\n]{1,30}?)\s*[—\-–:：]\s*(.+?)\s*$/;

// 본문 안전망 strip (multiline 전역) — 첫 줄에 남은 "번호. 라벨 — 은유" 한 줄 제거.
const NUMBERED_SECTION_LINE_STRIP =
  /^\s*\d+\.\s*[^—\-–:：.\n]{1,30}?\s*[—\-–:：][^\n]*$/m;

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

  // 추가 fallback — [은유] 마커가 없고 metaphorTitle 도 못 잡았을 때,
  // 본문 첫 줄이 "1. 총운 — 우레 소리 속에..." 같은 번호+섹션라벨+은유 형태면
  // 그 마지막 dash 뒤 부분을 metaphorTitle 로 사용하고 그 줄을 본문에서 제거.
  if (!metaphorTitle) {
    const bodyLines = bodyText.split('\n');
    for (const bl of bodyLines) {
      const stripped = bl.trim();
      if (!stripped) continue;
      const nm = stripped.match(NUMBERED_SECTION_CAPTURE);
      if (nm) {
        const subtitle = (nm[2] ?? '').trim().replace(STRIP_BOLD, '').replace(TRAILING_PUNCT, '').trim();
        if (subtitle && subtitle.length <= 60) {
          metaphorTitle = subtitle;
        }
      }
      break; // 첫 비어있지 않은 줄만 검사
    }
  }

  // 번호+라벨 prefix 줄은 metaphorTitle 추출 여부와 무관하게 본문에서 strip
  bodyText = bodyText.replace(NUMBERED_SECTION_LINE_STRIP, '');

  // 연속 빈 줄 정리
  bodyText = bodyText.replace(/\n{3,}/g, '\n\n').trim();

  return { metaphorTitle, bodyText };
}
