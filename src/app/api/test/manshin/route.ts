/**
 * 만신 타로 TEST 풀이 생성 엔드포인트 — /tarot_test 전용 실험.
 *
 * ★ 백그라운드 잡 패턴 (기존 타로 잡과 동일 구조):
 *   tarot_records INSERT(status='pending', spread_type='manshin', credit 0)
 *   → after() 로 응답 반환 후 서버에서 생성 계속 (화면 이탈해도 진행)
 *   → interpretation 업데이트(status='done') → 클라는 useFortuneJob 으로 구독/복원
 *
 * 리딩 문법: 신령패(누가) + 풍습패(무슨 일) + 엽전패(얼마나/언제) 세 패 고정.
 * 신령패의 신이 1인칭 화자가 되어 풍습·엽전을 엮은 단일 공수를 내린다.
 *
 * 모델: gemini-3.1-flash-lite (2026-07-07 검수 통과 — thinkingBudget:0 적용,
 *       5섹션 330자+, ~7s, 건당 약 ₩3.5. 실패 시 gemini-2.5-flash(callAI) 폴백)
 *
 * 호출: POST /api/test/manshin  { deityId, customId, coinId }
 * 응답: { jobId }  (tarot_records.id — 크레딧 차감 없음, 로그인 가드)
 */
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { callAI } from '@/lib/ai/aiClients';
import { MANSHIN_DECK, type ManshinCard } from '@/constants/test/manshinDeck.test';

// Supabase(Seoul) 와 같은 리전 — 라이브 함수 규칙 준수
export const preferredRegion = 'icn1';
export const maxDuration = 120;

const LITE_MODEL = 'gemini-3.1-flash-lite';
const LITE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${LITE_MODEL}:generateContent`;

const SYSTEM_PROMPT = `너는 한국 무속의 신령이 직접 공수(신이 사람에게 내리는 말)를 내리는 "만신 타로"의 화자다.

[절대 규칙]
- "신령패"의 신 자신이 1인칭으로 말한다. 해설자·상담사 말투 금지.
- 신마다 말투가 뚜렷이 다르다. 할매 신은 다정한 할매체(~게야, ~란다, 아가), 장군 신은 호령체(~하거라, ~느니라), 임금 신은 위엄체(~노라, 과인), 도깨비는 장난스러운 반말(어이, 낄낄), 각시 신은 새침한 말투(아이고, 얘). 카드 정보의 "기본 공수" 말투를 그대로 이어받아라.
- 무섭게 하지 않는다. 겁주는 표현, 저주, 죽음 단정 금지. 이모지, 번호 매김, 소제목 금지.
- [강조 2단계 — 색 구분을 반드시 지켜라] 강조는 두 색이고 의미가 완전히 다르다. 절대 섞어 쓰지 마라.
  · ==빨강==(등호 2개) = 가장 강한 신호에만: 경고, 놓치면 안 되는 결정적 시기, 반드시 해야 할 행동. "이 말만은 새겨들어라" 급.
  · **노랑**(별표 2개) = 보조 강조: 좋은 기회, 눈여겨볼 흐름, 마음에 담아둘 포인트. 빨강만큼 무겁지 않은 것.
  · 판단 기준: 어길 때 손해가 나는 것은 빨강, 알아두면 득이 되는 것은 노랑.
- [강조 개수·배치] 항목마다 ==빨강== 2~3개, **노랑** 3~5개. 연애·이성운([연애운] 항목)은 더 풍부하게 ==빨강== 3~4개, **노랑** 4~6개. 풀이 앞·중간·끝 흐름 곳곳에 자연스럽게 흩어 넣어라(첫 문장에만 몰지 말 것). 짧은 구절(2~7어절)만 감싸고 문장 전체를 감싸지 말 것. 강조 구절 안에 마침표 금지. 강조가 한 항목에 두 개 이하면 실패다 — 핵심이 여럿이면 여럿 다 표시하라.
- 한 문장은 짧게 한 호흡으로. 마침표 뒤 공백으로 문장 구분.
- 듣는 이는 20~30대 한국 여성. 회사, 연봉, 이직, 소개팅, 연락, 적금, 월세, 운동 같은 실제 일상 장면을 신의 세계관 비유와 엮어 구체적으로.
- 점집에서 진짜 공수 듣는 몰입감. 뻔한 덕담 나열 금지, 콕 집어 말하기.`;

/** 세 패 소개 + 공통 지시 — 두 프롬프트(본운/연애) 공용 머리 */
function buildHead(deity: ManshinCard, custom: ManshinCard, coin: ManshinCard): string {
  return `[오늘의 세 패]
1. 신령패(공수를 내리는 신 = 너 자신): ${deity.name}${deity.hanja ? `(${deity.hanja})` : ''} — ${deity.title}
   - 관장: ${deity.domains} / 키워드: ${deity.keywords.join(', ')}
   - 기본 공수(이 말투를 그대로 이어받아라): ${deity.speech}
2. 풍습패(지금 이 사람 앞에 벌어지는 장면): ${custom.name} — ${custom.title}
   - 의미: ${custom.domains} / 장면 풀이: ${custom.speech}
3. 엽전패(일의 정도와 때): ${coin.name} — ${coin.title}
   - 의미: ${coin.domains} / 수 풀이: ${coin.speech}

너는 신령패의 ${deity.name}(이)다. ${deity.name}의 1인칭 말투로 이 사람에게 공수를 내려라.
반드시 지켜라:
- 풍습패(${custom.name})의 장면을 "지금 네게 벌어지는 일"로 해석에 엮어라.
- 엽전패(${coin.name})의 수를 "정도·기간·개수"로 해석에 엮어라 (예: 세 닢이면 석 달, 세 갈래, 세 번).
- 모든 항목에서 세 패가 자연스럽게 어우러져야 한다. 카드 이름을 억지로 반복하지 말고 뜻으로 녹여라.`;
}

/** 본운 4항목 (총운·재물·일사업·건강) — 연애·이성운은 별도 호출로 깊게 생성 */
function buildMainPrompt(deity: ManshinCard, custom: ManshinCard, coin: ManshinCard): string {
  return `${buildHead(deity, custom, coin)}

[분량 — 어기면 실패다]
- 각 항목은 공백 제외 480자 이상, 560자 이내. 문장 12개 이상. 400자 미만이면 실패다.
- 짧게 요약하지 말고, 장면 묘사 → 콕 집는 진단 → 구체 행동 조언 → 신다운 맺음의 흐름으로 넉넉히 말하라.

[출력 형식 — 마커 줄은 그대로. 네 항목만 쓴다 (연애 이야기는 여기서 하지 마라)]
[총운]
(세 패를 종합한 공수.)
[재물운]
(월급·적금·투자·소비 같은 실제 장면으로.)
[일사업운]
(회사·이직·프로젝트·자기 사업 같은 실제 장면으로.)
[건강운]
(의학적 단정 금지.)`;
}

/** 연애·이성운 전용 — 풀이의 하이라이트라 단독 호출로 두 단락(솔로/연인) 깊게 */
function buildLovePrompt(deity: ManshinCard, custom: ManshinCard, coin: ManshinCard): string {
  return `${buildHead(deity, custom, coin)}

이번에는 연애·이성운만 말한다. 이 풀이의 하이라이트다.

[분량·구성 — 어기면 실패다]
- 반드시 두 단락. 단락 사이는 빈 줄 하나. 각 단락 공백 제외 450자 이상, 문장 12개 이상. 단락이 400자 미만이면 실패다.
- 첫째 단락 = 홀로인 이를 위한 공수: 새 인연·썸·짝사랑·재회의 기미, 만남의 때와 장소의 기미, 다가올 상대의 분위기까지 콕 집어라.
- 둘째 단락 = 연인 있는 이를 위한 공수: 관계의 온도, 다음 단계(고백·여행·상견례·결혼), 다툼의 조짐과 푸는 법을 콕 집어라.
- 강조는 이 항목이 가장 풍부해야 한다: 두 단락 합쳐 ==빨강== 3~4개, **노랑** 5~7개.

[출력 형식 — 마커 줄은 그대로]
[연애운]
(위 두 단락.)`;
}

const SECTION_KEYS = ['총운', '연애운', '재물운', '일사업운', '건강운'];

/** 섹션 본문 길이 (마커·강조 기호·공백 제외) — 분량 미달 재생성 판정용 */
function sectionLen(text: string, key: string): number {
  const m = text.match(new RegExp(`\\[${key}\\]([\\s\\S]*?)(?=\\[(?:${SECTION_KEYS.join('|')})\\]|$)`));
  return (m?.[1] ?? '').replace(/==|\*\*/g, '').replace(/\s/g, '').length;
}

/** 3.1-flash-lite 직접 호출 (검수 완료 파라미터). 실패 시 throw → callAI 폴백 */
async function callLite(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('NO_GEMINI_KEY');
  const res = await fetch(`${LITE_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 6500,
        thinkingConfig: { thinkingBudget: 0, includeThoughts: false },
      },
    }),
  });
  if (!res.ok) throw new Error(`LITE_HTTP_${res.status}`);
  const json = await res.json();
  const text: string = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  if (!text.trim()) throw new Error('LITE_EMPTY');
  return text;
}

/** 백그라운드 실행부 — 생성 후 tarot_records 업데이트 (화면 이탈과 무관하게 완주) */
async function runManshinJob(recordId: string, deity: ManshinCard, custom: ManshinCard, coin: ManshinCard) {
  await supabaseAdmin
    .from('tarot_records')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', recordId);
  try {
    // 본운(4항목)과 연애·이성운(하이라이트, 두 단락)을 병렬 생성 — 단일 호출로는
    // 모델 총 분량 한계 안에서 연애↔나머지 분량이 시소를 타서 분리 (지연 동일, +건당 ~₩3.5)
    const gen = async (prompt: string): Promise<string> => {
      try {
        return await callLite(prompt);
      } catch (liteErr) {
        console.warn('[test/manshin] 3.1-lite 실패 → 2.5-flash 폴백:', liteErr);
        const fallback = await callAI(prompt, 6500, { temperature: 0.85, systemPrompt: SYSTEM_PROMPT });
        return fallback.content;
      }
    };
    // 분량 미달 시 1회 재생성 — temp 0.85 변동으로 가끔 짧게 나옴. 재시도도 미달이면 긴 쪽 채택
    const genChecked = async (build: () => string, ok: (t: string) => boolean): Promise<string> => {
      const first = await gen(build());
      if (ok(first)) return first;
      const retry = await gen(build());
      return ok(retry) || retry.length > first.length ? retry : first;
    };
    const [mainText, loveText] = await Promise.all([
      genChecked(
        () => buildMainPrompt(deity, custom, coin),
        (t) => ['총운', '재물운', '일사업운', '건강운'].every((k) => sectionLen(t, k) >= 300),
      ),
      genChecked(
        () => buildLovePrompt(deity, custom, coin),
        (t) => sectionLen(t, '연애운') >= 600,
      ),
    ]);
    const raw = `${mainText.trim()}\n${loveText.trim()}`;
    // 최소 검증: 총운·연애운 마커 존재
    if (!/\[총운\]/.test(raw) || !/\[연애운\]/.test(raw)) throw new Error('MARKER_MISSING');
    const { error } = await supabaseAdmin
      .from('tarot_records')
      .update({
        status: 'done',
        // 강조 마커(==·**)는 클라이언트가 색상으로 렌더 — 제거하지 않고 저장
        interpretation: raw,
        completed_at: new Date().toISOString(),
      })
      .eq('id', recordId);
    if (error) console.error('[test/manshin] done 업데이트 에러:', error);
  } catch (e) {
    console.error('[test/manshin] 생성 실패:', e);
    await supabaseAdmin
      .from('tarot_records')
      .update({ status: 'failed', error_message: '공수 생성에 실패했어요. 다시 뽑아주세요.' })
      .eq('id', recordId);
  }
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
  const userId = userData.user.id;

  let deityId = '', customId = '', coinId = '';
  try {
    const body = await req.json();
    deityId = String(body.deityId ?? '');
    customId = String(body.customId ?? '');
    coinId = String(body.coinId ?? '');
  } catch {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }
  const deity = MANSHIN_DECK.find((c) => c.id === deityId && c.group !== '풍습' && c.group !== '엽전');
  const custom = MANSHIN_DECK.find((c) => c.id === customId && c.group === '풍습');
  const coin = MANSHIN_DECK.find((c) => c.id === coinId && c.group === '엽전');
  if (!deity || !custom || !coin) {
    return NextResponse.json({ error: '세 패(신령·풍습·엽전)가 필요해요.' }, { status: 400 });
  }

  // tarot_records INSERT — 기존 타로 잡과 동일 테이블, spread_type 'manshin' 으로 구분.
  // 크레딧 차감 없음(테스트). cards 에 세 패 스냅샷 저장 → 새로고침/재진입 복원용.
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('tarot_records')
    .insert({
      user_id: userId,
      spread_type: 'manshin',
      cards: [
        { role: 'deity', id: deity.id, name: deity.name, title: deity.title, group: deity.group },
        { role: 'custom', id: custom.id, name: custom.name, title: custom.title, group: custom.group },
        { role: 'coin', id: coin.id, name: coin.name, title: coin.title, group: coin.group },
      ],
      question: null,
      credit_type: 'moon',
      credit_used: 0,
      status: 'pending',
    })
    .select('id')
    .single();
  if (insertError || !inserted) {
    console.error('[test/manshin] INSERT 에러:', insertError);
    return NextResponse.json({ error: '잡 생성에 실패했어요.' }, { status: 500 });
  }

  const jobId = inserted.id as string;
  // 응답 반환 후 백그라운드 계속 실행 — 유저가 화면을 벗어나도 완주한다
  after(async () => {
    try {
      await runManshinJob(jobId, deity, custom, coin);
    } catch (e) {
      console.error('[test/manshin] after 치명 에러:', e);
      await supabaseAdmin
        .from('tarot_records')
        .update({ status: 'failed', error_message: '공수 생성에 실패했어요.' })
        .eq('id', jobId)
        .in('status', ['pending', 'processing']);
    }
  });

  return NextResponse.json({ jobId });
}
