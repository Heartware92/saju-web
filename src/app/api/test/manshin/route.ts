/**
 * 만신 오라클 TEST 풀이 생성 엔드포인트 — /tarot_test 전용 실험.
 *
 * 구조: 덱 데이터(manshinDeck.test)는 "의미 씨앗"이고, 실제 300자+ 풀이는
 * 여기서 Gemini 가 카드별 "그 신의 1인칭 말투"로 생성한다. (크레딧·DB 저장 X)
 *
 * 호출: POST /api/test/manshin  { cardIds: string[] }  (1장 또는 3장)
 * 응답: { readings: { [cardId]: { total, love, money, work, health } } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { callAI } from '@/lib/ai/aiClients';
import { MANSHIN_DECK, type ManshinCard } from '@/constants/test/manshinDeck.test';

// Supabase(Seoul) 와 같은 리전 — 라이브 함수 규칙 준수
export const preferredRegion = 'icn1';
export const maxDuration = 120;

const SECTION_KEYS = ['total', 'love', 'money', 'work', 'health'] as const;
type SectionKey = (typeof SECTION_KEYS)[number];
const SECTION_MARKERS: Record<SectionKey, string> = {
  total: '총운',
  love: '연애운',
  money: '재물운',
  work: '일사업운',
  health: '건강운',
};

const SYSTEM_PROMPT = `너는 한국 무속의 신령들이 직접 공수(신이 사람에게 내리는 말)를 내리는 "만신 오라클"의 화자다.

[절대 규칙]
- 각 카드마다 "그 신령 자신"이 1인칭으로 말한다. 해설자·상담사 말투 금지.
- 신마다 말투가 뚜렷이 달라야 한다. 할매 신은 다정한 할매체(~게야, ~란다, 아가), 장군 신은 기개 있는 호령체(~하거라, ~느니라), 임금 신은 위엄체(~노라, 과인), 도깨비는 장난스러운 반말(어이, 낄낄), 각시 신은 새침하고 情 많은 말투(아이고, 얘). 카드 정보의 "기본 공수" 말투를 그대로 이어받아라.
- 무섭게 하지 않는다. 저승사자·염라대왕도 다정하고 든든하게. 겁주는 표현, 저주, 불치병·죽음 단정 금지.
- 이모지, 별표(**), 등호(==), 번호 매김, 소제목 금지. 오직 문장으로만.
- 한 문장은 짧게 한 호흡으로. 문장이 끝나면 마침표 뒤 공백으로 구분한다 (화면에서 문장 단위 줄바꿈됨).
- 듣는 이는 20~30대 한국 여성. 회사, 연봉, 이직, 소개팅, 연락 문제, 적금, 월세, 운동, 잠 같은 실제 일상 장면을 그 신의 세계관 비유(산·물길·곳간·장터·바람 등)와 엮어 구체적으로 말한다.
- 점집에서 진짜 공수 듣는 몰입감이 나야 한다. 뻔한 덕담 나열 금지. 콕 집어 말하는 느낌으로.`;

function buildPrompt(cards: ManshinCard[]): string {
  const cardBlocks = cards
    .map(
      (c) => `### 카드 ${c.no}. ${c.name}${c.hanja ? `(${c.hanja})` : ''} — ${c.title}
- 소속: ${c.group} / 관장: ${c.domains} / 키워드: ${c.keywords.join(', ')}
- 기본 공수(이 말투를 이어받아라): ${c.speech}
- 기본 의미 씨앗: 연애(${c.fortunes.love}) 재물(${c.fortunes.money}) 일(${c.fortunes.work}) 건강(${c.fortunes.health})`,
    )
    .join('\n\n');

  return `아래 ${cards.length}장의 카드 각각에 대해, 그 신령이 직접 내리는 공수를 써라.

${cardBlocks}

[출력 형식 — 정확히 지켜라]
카드마다 아래 형식. 마커 줄은 그대로, 내용은 문장으로만.

===카드:{카드id}===
[총운]
(이 신이 지금 이 사람에게 내리는 총평 공수. 300~400자. 기본 공수를 그대로 반복하지 말고 더 깊고 구체적으로.)
[연애운]
(300~400자. 솔로/연인 상황 둘 다 짚어주기.)
[재물운]
(300~400자.)
[일사업운]
(300~400자.)
[건강운]
(300~400자. 의학적 단정 금지, 생활 습관 조언 중심.)

카드id 목록: ${cards.map((c) => c.id).join(', ')}`;
}

function sanitize(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/==/g, '')
    .replace(/^[\s\-·•]+/, '')
    .trim();
}

function parseReadings(raw: string, cards: ManshinCard[]) {
  const readings: Record<string, Partial<Record<SectionKey, string>>> = {};
  for (const card of cards) {
    // ===카드:id=== 블록 추출
    const blockRe = new RegExp(`===\\s*카드\\s*:\\s*${card.id}\\s*===([\\s\\S]*?)(?====\\s*카드|$)`);
    const block = raw.match(blockRe)?.[1];
    if (!block) continue;
    const sections: Partial<Record<SectionKey, string>> = {};
    for (const key of SECTION_KEYS) {
      const marker = SECTION_MARKERS[key];
      const secRe = new RegExp(`\\[${marker}\\]([\\s\\S]*?)(?=\\[(?:${Object.values(SECTION_MARKERS).join('|')})\\]|$)`);
      const sec = block.match(secRe)?.[1];
      if (sec && sanitize(sec).length >= 50) sections[key] = sanitize(sec);
    }
    if (Object.keys(sections).length > 0) readings[card.id] = sections;
  }
  return readings;
}

export async function POST(req: NextRequest) {
  // ── 로그인 가드 — 인증된 사용자만 (AI 토큰 무단 소진 방지) ──
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: '인증이 필요해요.' }, { status: 401 });
  }
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
  }

  let cardIds: string[];
  try {
    const body = await req.json();
    cardIds = Array.isArray(body.cardIds) ? body.cardIds.slice(0, 3) : [];
  } catch {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }
  const cards = cardIds
    .map((id) => MANSHIN_DECK.find((c) => c.id === id))
    .filter((c): c is ManshinCard => !!c);
  if (cards.length === 0) {
    return NextResponse.json({ error: 'cardIds 필요' }, { status: 400 });
  }

  try {
    const prompt = buildPrompt(cards);
    const maxTokens = 1200 + cards.length * 2600; // 카드당 5섹션 × ~400자 + 여유
    const raw = await callAI(prompt, maxTokens, { temperature: 0.85, systemPrompt: SYSTEM_PROMPT });
    const readings = parseReadings(raw.content, cards);
    if (Object.keys(readings).length === 0) {
      return NextResponse.json({ error: '풀이 생성에 실패했어요. 다시 시도해 주세요.' }, { status: 502 });
    }
    return NextResponse.json({ readings });
  } catch (e) {
    console.error('[test/manshin] 생성 실패:', e);
    return NextResponse.json({ error: '풀이 생성 중 오류가 났어요.' }, { status: 500 });
  }
}
