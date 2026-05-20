// src/services/tarotJob.server.ts
// 타로(tarot) 백그라운드 잡 처리기 — server-only. 1-pass.
// saju_records 가 아닌 tarot_records 테이블 사용 (별도 보관함 탭).

import { callAI } from '@/lib/ai/aiClients';
import { sanitizeAIOutput } from './jungtongsajuShared';
import { supabaseAdmin } from './supabaseAdmin';

const MAX_TOKENS = 4000;
const MIN_CONTENT_LENGTH = 200;

export interface RunTarotJobInput {
  /** tarot_records.id */
  recordId: string;
  userId: string;
  prompt: string;
  consumeIdempotencyKey: string;
  creditAmount: number;
}

export async function runTarotJob(input: RunTarotJobInput): Promise<void> {
  const { recordId, userId, prompt, consumeIdempotencyKey, creditAmount } = input;

  const startedAt = new Date().toISOString();
  const { error: markError } = await supabaseAdmin
    .from('tarot_records')
    .update({ status: 'processing', started_at: startedAt })
    .eq('id', recordId);
  if (markError) {
    console.error('[tarotJob] processing 마킹 실패:', markError);
    await failJob(recordId, userId, consumeIdempotencyKey, creditAmount, 'PROCESSING_MARK_FAIL');
    return;
  }

  try {
    const raw = await callAI(prompt, MAX_TOKENS);
    const content = sanitizeAIOutput(raw.content);
    if (content.length < MIN_CONTENT_LENGTH) {
      throw new Error('타로 응답이 비정상적으로 짧아요. 잠시 후 다시 시도해주세요.');
    }
    await markDone(recordId, content);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '타로 처리 중 오류';
    console.error('[tarotJob] 치명적 에러:', msg);
    await failJob(recordId, userId, consumeIdempotencyKey, creditAmount, msg);
  }
}

async function markDone(recordId: string, content: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('tarot_records')
    .update({
      status: 'done',
      interpretation: content,
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', recordId);
  if (error) console.error('[tarotJob] done 마킹 실패:', error);
}

async function failJob(
  recordId: string,
  userId: string,
  consumeIdempotencyKey: string,
  creditAmount: number,
  errorMessage: string,
): Promise<void> {
  const { error: updateError } = await supabaseAdmin
    .from('tarot_records')
    .update({
      status: 'failed',
      error_message: errorMessage.slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq('id', recordId);
  if (updateError) console.error('[tarotJob] failed 마킹 에러:', updateError);

  try {
    const { error: refundError } = await supabaseAdmin.rpc('refund_credit_atomic', {
      p_user_id: userId,
      p_credit_type: 'moon',
      p_amount: creditAmount,
      p_reason: '타로 분석 실패 자동 환불',
      p_idempotency_key: `refund:${consumeIdempotencyKey}`,
    });
    if (refundError) console.error('[tarotJob] 환불 RPC 에러:', refundError);
  } catch (refundErr) {
    console.error('[tarotJob] 환불 예외:', refundErr);
  }
}
