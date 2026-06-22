// src/services/gunghapJob.server.ts
// 궁합(gunghap) 백그라운드 잡 처리기 — server-only.
//
// 정통사주(jungtongsajuJob.server.ts)와 동일 패턴이지만 1-pass 호출 + parseGunghapHeader 처리.
// 클라이언트가 prompt 까지 완성해서 보낸다 (14개 카테고리 분기·custom resolve·role injection
// 모두 GunghapPage 에 검증된 채 유지). 서버는 callAI + sanitize + DB update 만.

import { callAI, SPIRIT_SYSTEM_PROMPT } from '@/lib/ai/aiClients';
import { SPIRIT_TONE_RULE, SPIRIT_IMAGERY_RULE } from '@/constants/prompts';
import { sanitizeAIOutput, stripSpiritGaze } from './jungtongsajuShared';
import { supabaseAdmin } from './supabaseAdmin';

// 궁합 본문 최소치 — GunghapPage.callGunghapGPT 와 동일 (700자 미만은 거부 응답·garbage)
const MIN_CONTENT_LENGTH = 700;
const MAX_TOKENS = 6000;

// 모든 14가지 + pet + general 카테고리 prefix tag 제거. 옛 응답 패턴 잔재 방어.
const GUNGHAP_TAG_REGEX =
  /^\s*\[?(?:pet|secret_crush|som|lover|spouse|ex|soulmate|rival|friend|mentor|family|parent_child|sibling|work|business|general)_gunghap\]?\s*\n?/i;

export interface RunGunghapJobInput {
  recordId: string;
  userId: string;
  prompt: string;
  consumeIdempotencyKey: string;
  creditAmount: number;
}

export async function runGunghapJob(input: RunGunghapJobInput): Promise<void> {
  const { recordId, userId, prompt, consumeIdempotencyKey, creditAmount } = input;

  // ── status='processing' 마킹 ──
  const startedAt = new Date().toISOString();
  const { error: markError } = await supabaseAdmin
    .from('saju_records')
    .update({ status: 'processing', started_at: startedAt })
    .eq('id', recordId);
  if (markError) {
    console.error('[gunghapJob] processing 마킹 실패:', markError);
    await failJob(recordId, userId, consumeIdempotencyKey, creditAmount, 'PROCESSING_MARK_FAIL');
    return;
  }

  try {
    // ── AI 호출 (1-pass) ──
    const raw = await callAI(SPIRIT_TONE_RULE + '\n' + SPIRIT_IMAGERY_RULE + '\n\n' + prompt, MAX_TOKENS, { temperature: 0.8, systemPrompt: SPIRIT_SYSTEM_PROMPT });

    if (raw.truncated) {
      throw new Error('응답이 길어서 일부 잘렸어요. 잠시 후 다시 시도해주세요.');
    }
    const sanitized = stripSpiritGaze(sanitizeAIOutput(raw.content));
    const tagCleaned = sanitized.replace(GUNGHAP_TAG_REGEX, '').trim();

    if (tagCleaned.length < MIN_CONTENT_LENGTH) {
      throw new Error('풀이 결과가 비정상적으로 짧아요. 잠시 후 다시 시도해주세요.');
    }

    // ── 완료 마킹 ──
    await markDone(recordId, tagCleaned);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '궁합 처리 중 알 수 없는 오류';
    console.error('[gunghapJob] 치명적 에러:', msg);
    await failJob(recordId, userId, consumeIdempotencyKey, creditAmount, msg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼 — 정통사주 잡 처리기와 동일 패턴
// ─────────────────────────────────────────────────────────────────────────────
async function markDone(recordId: string, fullContent: string): Promise<void> {
  const completedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('saju_records')
    .update({
      status: 'done',
      interpretation_detailed: fullContent,
      // 궁합은 1-pass 라 basic = detailed (보관함 재생용 fallback 호환)
      interpretation_basic: fullContent,
      completed_at: completedAt,
      error_message: null,
    })
    .eq('id', recordId);
  if (error) console.error('[gunghapJob] done 마킹 실패:', error);
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
  if (updateError) console.error('[gunghapJob] failed 마킹 에러:', updateError);

  try {
    const { error: refundError } = await supabaseAdmin.rpc('refund_credit_atomic', {
      p_user_id: userId,
      p_credit_type: 'moon',
      p_amount: creditAmount,
      p_reason: '궁합 분석 실패 자동 환불',
      p_idempotency_key: `refund:${consumeIdempotencyKey}`,
    });
    if (refundError) console.error('[gunghapJob] 환불 RPC 에러:', refundError);
  } catch (refundErr) {
    console.error('[gunghapJob] 환불 예외:', refundErr);
  }
}
