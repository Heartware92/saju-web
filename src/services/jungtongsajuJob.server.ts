// src/services/jungtongsajuJob.server.ts
// 정통사주 백그라운드 잡 처리기 — server-only.
//
// /api/fortune/jobs/create 의 waitUntil 안에서 호출된다.
// 클라이언트는 만세력(SajuResult) 까지 계산해서 보내고, 잡 처리기는 AI 호출 →
// 결과 파싱 → saju_records UPDATE 만 수행. 클라이언트 fetch 와 분리돼 있어
// 브라우저를 닫아도 끝까지 진행된다.
//
// 흐름:
//   1. UPDATE status='processing', started_at=now()
//   2. 1차 AI 호출 (Core 4섹션) → parseJungtongsaju
//   3. extractMetaphorAliases — 2차 차단 별칭
//   4. 2차 AI 호출 (Application 8섹션) — 최대 3회 retry + 점진 백오프
//   5. UPDATE status='done', interpretation_detailed=full, completed_at=now()
//   6. 실패 시 status='failed', error_message + refund_credit_atomic 호출

import { callAI } from '@/lib/ai/aiClients';
import {
  generateJungtongsajuCorePrompt,
  generateJungtongsajuApplicationPrompt,
} from '@/constants/prompts';
import {
  parseJungtongsaju,
  extractMetaphorAliases,
  sanitizeAIOutput,
  type JungtongsajuSectionKey,
} from './jungtongsajuShared';
import { supabaseAdmin } from './supabaseAdmin';
import type { SajuResult } from '@/utils/sajuCalculator';

const APPLICATION_KEYS: JungtongsajuSectionKey[] = [
  'character',
  'career',
  'wealth',
  'love',
  'health',
  'relation',
  'luck',
  'advice',
];

const MAX_APP_ATTEMPTS = 3;
const APP_RETRY_BACKOFFS_MS = [1500, 2500];

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
 * 정통사주 백그라운드 잡 — 실패 시도 throw 안 함.
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
    // ── 1차: Core 4섹션 ──
    const corePrompt = generateJungtongsajuCorePrompt(sajuResult);
    const coreRaw = await callAI(corePrompt, 7000);
    const coreContent = sanitizeAIOutput(coreRaw.content);
    const coreSections = parseJungtongsaju(coreContent);

    if (Object.keys(coreSections).length === 0) {
      console.error('[jungtongsajuJob] 1차 마커 파싱 실패. rawText fallback 으로 저장');
      // 1차 본문만 저장 — UI 가 rawText 로 표시
      await markDone(recordId, coreContent, coreContent, null);
      return;
    }

    // ── 1차 별칭 추출 (2차 차단용) ──
    const forbiddenAliases = extractMetaphorAliases(coreContent);

    // ── 2차: Application 8섹션 (최대 3회 retry) ──
    const appPrompt = generateJungtongsajuApplicationPrompt(
      sajuResult,
      coreContent,
      forbiddenAliases,
    );

    let appContent = '';
    let appSections: Partial<Record<JungtongsajuSectionKey, string>> = {};
    let appError: string | null = null;

    for (let attempt = 1; attempt <= MAX_APP_ATTEMPTS; attempt++) {
      try {
        const raw = await callAI(appPrompt, 14000);
        const content = sanitizeAIOutput(raw.content);
        const sections = parseJungtongsaju(content);
        const parsedKeys = Object.keys(sections) as JungtongsajuSectionKey[];

        if (parsedKeys.length === 0) {
          throw new Error('PARSE_EMPTY: 2차 응답에서 섹션 마커를 하나도 찾지 못함');
        }
        const missing = APPLICATION_KEYS.filter((k) => !sections[k]);
        if (missing.length >= 5) {
          throw new Error(
            `PARSE_PARTIAL: 2차 응답 ${parsedKeys.length}/8 섹션만 파싱됨 (누락: ${missing.join(',')})`,
          );
        }
        if (!sections.advice) {
          throw new Error('TRUNCATED: 2차 응답에 advice 섹션 누락(응답 잘림 의심)');
        }

        appContent = content;
        appSections = sections;
        appError = null;
        if (attempt > 1) console.log(`[jungtongsajuJob] 2차 ${attempt}회차 성공`);
        break;
      } catch (e) {
        appError = e instanceof Error ? e.message : '2차 분석 중 오류';
        console.warn(`[jungtongsajuJob] 2차 ${attempt}회차 실패:`, appError);
        if (attempt < MAX_APP_ATTEMPTS) {
          await sleep(APP_RETRY_BACKOFFS_MS[attempt - 1] ?? 2000);
        }
      }
    }

    // ── 머지 + UPDATE ──
    const fullContent = appContent ? `${coreContent}\n\n${appContent}` : coreContent;
    const partialMessage =
      appError && Object.keys(appSections).length === 0
        ? '핵심 4섹션은 분석 완료. 나머지 8섹션은 3회 재시도 후에도 일시 오류가 지속됐어요.'
        : null;

    await markDone(recordId, fullContent, coreContent, partialMessage);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '정통사주 처리 중 알 수 없는 오류';
    console.error('[jungtongsajuJob] 치명적 에러:', msg);
    await failJob(recordId, userId, consumeIdempotencyKey, creditAmount, msg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────────────────
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
