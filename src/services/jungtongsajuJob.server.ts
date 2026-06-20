// src/services/jungtongsajuJob.server.ts
// 정통사주 백그라운드 잡 처리기 — server-only.
//
// /api/fortune/jobs/create 의 waitUntil 안에서 호출된다.
// 클라이언트는 만세력(SajuResult) 까지 계산해서 보내고, 잡 처리기는 AI 호출 →
// 결과 파싱 → saju_records UPDATE 만 수행. 클라이언트 fetch 와 분리돼 있어
// 브라우저를 닫아도 끝까지 진행된다.
//
// ★ 생성 방식: "섹션별 순차 생성 + priorBlock 중복회피" (2-pass 아님).
//   2-pass(4+8 묶음)는 정령 톤이 희석되는 것이 검증됐다. 섹션을 하나씩 생성하되,
//   이미 만든 섹션들을 다음 섹션 프롬프트에 "이 표현들과 겹치지 말라"는 컨텍스트로 넘겨
//   톤은 살리고 반복은 억제한다. (test_1 에서 36섹션 전수 검증한 그 방식 그대로)
//
// 흐름:
//   1. UPDATE status='processing', started_at=now()
//   2. 12섹션을 순서대로 생성(섹션당 callAI 1회, 실패 시 1회 재시도)
//   3. 핵심 4섹션(core) 완료 시점에 interpretation_basic 으로 partial 노출
//   4. 12섹션 마커 재구성 → UPDATE status='done'
//   5. core 가 하나도 안 나오면 status='failed' + 환불

import { callAI, JUNGTONGSAJU_SYSTEM_PROMPT } from '@/lib/ai/aiClients';
import {
  generateJungtongsajuCorePrompt,
  generateJungtongsajuApplicationPrompt,
  JUNGTONGSAJU_SECTION_KEYS,
  JUNGTONGSAJU_SECTION_LABELS,
} from '@/constants/prompts';
import {
  parseJungtongsaju,
  sanitizeAIOutput,
  sectionOpeningDirective,
  type JungtongsajuSectionKey,
} from './jungtongsajuShared';
import { supabaseAdmin } from './supabaseAdmin';
import type { SajuResult } from '@/utils/sajuCalculator';

const CORE_KEYS: JungtongsajuSectionKey[] = ['general', 'daymaster', 'element', 'interaction'];
const APPLICATION_KEYS: JungtongsajuSectionKey[] = [
  'character', 'career', 'wealth', 'love', 'health', 'relation', 'luck', 'advice',
];

const MAX_SECTION_ATTEMPTS = 2;
const SECTION_RETRY_BACKOFF_MS = 1500;

export interface RunJungtongsajuJobInput {
  recordId: string;
  userId: string;
  sajuResult: SajuResult;
  /** 실패 시 환불에 쓸 idempotency_key. /api/fortune/jobs/create 가 차감 시 사용한 키와 동일. */
  consumeIdempotencyKey: string;
  /** 차감된 크레딧 (환불 시 동일 금액). */
  creditAmount: number;
}

/**
 * 정통사주 백그라운드 잡 — 실패해도 throw 안 함.
 * 모든 상태는 saju_records.status 로 표현되므로 호출자(waitUntil) 는
 * 결과를 기다리거나 확인할 필요 없음.
 */
export async function runJungtongsajuJob(input: RunJungtongsajuJobInput): Promise<void> {
  const { recordId, userId, sajuResult, consumeIdempotencyKey, creditAmount } = input;

  // ── status='processing' 마킹 ──
  const startedAt = new Date().toISOString();
  const { error: markError } = await supabaseAdmin
    .from('saju_records')
    .update({ status: 'processing', started_at: startedAt })
    .eq('id', recordId);
  if (markError) {
    console.error('[jungtongsajuJob] processing 마킹 실패:', markError);
    await failJob(recordId, userId, consumeIdempotencyKey, creditAmount, 'PROCESSING_MARK_FAIL');
    return;
  }

  try {
    // ── 베이스 프롬프트(만세력·톤·섹션지침 포함) — core/app 분기, 1회만 생성해 재사용 ──
    const corePrompt = generateJungtongsajuCorePrompt(sajuResult);
    const appPrompt = generateJungtongsajuApplicationPrompt(sajuResult, '', []);

    const acc: Partial<Record<JungtongsajuSectionKey, string>> = {};
    let corePartialSent = false;

    for (const key of JUNGTONGSAJU_SECTION_KEYS) {
      const isCore = CORE_KEYS.includes(key);
      const base = isCore ? corePrompt : appPrompt;
      const priorBlock = buildPriorBlock(acc);
      const override = buildSectionOverride(key);

      const text = await generateSection(base + priorBlock + override, key);
      if (text) acc[key] = text;

      // ── 핵심 4섹션 완료 시점에 partial 노출 (옛 1차 partial UX 유지) ──
      if (!corePartialSent && CORE_KEYS.every((k) => acc[k])) {
        corePartialSent = true;
        await markPartial(recordId, assembleContent(CORE_KEYS, acc));
      }
    }

    const corePresent = CORE_KEYS.filter((k) => acc[k]).length;
    if (corePresent === 0) {
      // 핵심 섹션이 하나도 안 나옴 → 실패 처리 + 환불
      throw new Error('CORE_EMPTY: 핵심 섹션 생성에 모두 실패');
    }

    // ── 전체 마커 재구성 → 저장 ──
    const fullContent = assembleContent(JUNGTONGSAJU_SECTION_KEYS, acc);
    const missingApp = APPLICATION_KEYS.filter((k) => !acc[k]);
    const partialMessage =
      missingApp.length >= 5
        ? '핵심 분석은 완료했어요. 일부 영역 섹션은 일시 오류로 생성되지 못했어요.'
        : null;

    // partial 을 아직 못 보냈으면(core 일부 실패 등) basic 에 현재까지 결과라도 채움
    const basicContent = corePartialSent ? assembleContent(CORE_KEYS, acc) : fullContent;
    await markDone(recordId, fullContent, basicContent, partialMessage);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '정통사주 처리 중 알 수 없는 오류';
    console.error('[jungtongsajuJob] 치명적 에러:', msg);
    await failJob(recordId, userId, consumeIdempotencyKey, creditAmount, msg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 섹션 생성
// ─────────────────────────────────────────────────────────────────────────────

/** 한 섹션 생성 — 최대 2회 시도. 실패 시 null(해당 섹션 스킵, 잡 전체는 계속). */
async function generateSection(prompt: string, key: JungtongsajuSectionKey): Promise<string | null> {
  for (let attempt = 1; attempt <= MAX_SECTION_ATTEMPTS; attempt++) {
    try {
      const raw = await callAI(prompt, 6000, { systemPrompt: JUNGTONGSAJU_SYSTEM_PROMPT });
      const content = sanitizeAIOutput(raw.content);
      const parsed = parseJungtongsaju(content);
      const text = parsed[key] ?? content; // 마커 누락 시 통짜 fallback
      if (text && text.trim()) {
        if (attempt > 1) console.log(`[jungtongsajuJob] ${key} ${attempt}회차 성공`);
        return text.trim();
      }
      throw new Error('EMPTY_SECTION');
    } catch (e) {
      const m = e instanceof Error ? e.message : '오류';
      console.warn(`[jungtongsajuJob] ${key} ${attempt}회차 실패:`, m);
      if (attempt < MAX_SECTION_ATTEMPTS) await sleep(SECTION_RETRY_BACKOFF_MS);
    }
  }
  return null;
}

/** 이미 생성된 다른 섹션들 — 도입·표현 반복 금지 컨텍스트로 주입(priorBlock). */
function buildPriorBlock(acc: Partial<Record<JungtongsajuSectionKey, string>>): string {
  const prior = JUNGTONGSAJU_SECTION_KEYS
    .filter((k) => acc[k])
    .map((k) => ({ label: sectionLabel(k), text: acc[k] as string }));
  if (prior.length === 0) return '';
  return `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[이미 다른 섹션에 쓴 글 — 도입·표현·은유·문장 구조를 반복하지 말 것]
같은 사람의 사주라 비슷해지기 쉽습니다. 아래 글들과 ★다르게★ 쓰세요. 특히:
- ★ 아래 섹션들의 '첫 문장·도입 단어'를 보고, 이번 섹션은 그것들과 겹치지 않는 완전히 다른 방식·다른 첫 단어로 시작할 것. (밤하늘·어둠·고요·별빛·달빛·호수 등 이미 쓴 도입 이미지·단어 재사용 금지)
- ★★ 특히 '당신의 별은'·'당신은' 으로 시작하지 말 것 — 아래 섹션들이 이미 그렇게 열었다면 이번엔 반드시 다른 주어·다른 첫 단어로 시작(구체 장면·질문·감탄 등).
- "제가 곁에서 지켜보니 / 다 봤어요 / 봤는걸요" 같은 '지켜봤다' 류 도입, "음," 같은 감탄사 도입 반복 금지.
- 같은 은유·같은 비유·같은 표현을 재사용 금지. 겹친다 싶으면 다른 어휘·다른 장면으로.

${prior.map((p) => `[${p.label}]\n${p.text}`).join('\n\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

/** 이번 호출은 한 섹션만 출력하도록 강제하는 오버라이드. */
function buildSectionOverride(key: JungtongsajuSectionKey): string {
  return `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[★★★ 이번 호출 한정 — 위의 '출력 순서·전체 섹션 작성' 지침은 모두 무시]
이번에는 오직 [${key}] 섹션 하나만 작성합니다.
- 출력은 [${key}] 마커 한 줄로 시작해, 그 섹션 본문만 쓰고 즉시 끝냅니다.
- 다른 섹션([general]·[character] 등) 마커나 본문은 절대 출력하지 마세요.${sectionOpeningDirective(key)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

function sectionLabel(k: JungtongsajuSectionKey): string {
  return k === 'advice' ? '개운법' : (JUNGTONGSAJU_SECTION_LABELS[k] ?? k);
}

/** 섹션 본문들을 [key] 마커와 함께 재조립 — 클라이언트 parseJungtongsaju 가 다시 파싱. */
function assembleContent(
  keys: readonly JungtongsajuSectionKey[],
  acc: Partial<Record<JungtongsajuSectionKey, string>>,
): string {
  return keys
    .filter((k) => acc[k])
    .map((k) => `[${k}]\n${acc[k]}`)
    .join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────────────────
async function markPartial(recordId: string, coreContent: string): Promise<void> {
  // 핵심 4섹션 결과를 interpretation_basic 에 저장 — status 는 'processing' 유지.
  // 클라이언트 Realtime 구독이 즉시 받아 부분 렌더.
  const { error } = await supabaseAdmin
    .from('saju_records')
    .update({ interpretation_basic: coreContent })
    .eq('id', recordId);
  if (error) {
    // partial 실패는 치명적이지 않음 — 최종 markDone 으로도 결과 표시 가능
    console.warn('[jungtongsajuJob] partial UPDATE 실패 (계속 진행):', error);
  }
}

async function markDone(
  recordId: string,
  fullContent: string,
  basicContent: string,
  errorMessage: string | null,
): Promise<void> {
  const completedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('saju_records')
    .update({
      status: 'done',
      interpretation_detailed: fullContent,
      interpretation_basic: basicContent,
      completed_at: completedAt,
      error_message: errorMessage,
    })
    .eq('id', recordId);
  if (error) {
    console.error('[jungtongsajuJob] done 마킹 실패:', error);
  }
}

async function failJob(
  recordId: string,
  userId: string,
  consumeIdempotencyKey: string,
  creditAmount: number,
  errorMessage: string,
): Promise<void> {
  const completedAt = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from('saju_records')
    .update({
      status: 'failed',
      error_message: errorMessage.slice(0, 500),
      completed_at: completedAt,
    })
    .eq('id', recordId);
  if (updateError) console.error('[jungtongsajuJob] failed 마킹 에러:', updateError);

  // 환불 — RPC idempotency_key 는 차감 키와 동일하게 ('refund:' prefix 추가해 구분)
  try {
    const { error: refundError } = await supabaseAdmin.rpc('refund_credit_atomic', {
      p_user_id: userId,
      p_credit_type: 'moon',
      p_amount: creditAmount,
      p_reason: '정통사주 분석 실패 자동 환불',
      p_idempotency_key: `refund:${consumeIdempotencyKey}`,
    });
    if (refundError) {
      console.error('[jungtongsajuJob] 환불 RPC 에러:', refundError);
    }
  } catch (refundErr) {
    console.error('[jungtongsajuJob] 환불 예외:', refundErr);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
