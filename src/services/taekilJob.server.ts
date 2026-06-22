// src/services/taekilJob.server.ts
// 택일(taekil) 백그라운드 잡 처리기 — server-only. 1-pass.

import { callAI, SPIRIT_SYSTEM_PROMPT } from '@/lib/ai/aiClients';
import { SPIRIT_TONE_RULE, SPIRIT_IMAGERY_RULE } from '@/constants/prompts';
import { sanitizeAIOutput, stripSpiritGaze } from './jungtongsajuShared';
import { supabaseAdmin } from './supabaseAdmin';

const MAX_TOKENS = 12000;
const MIN_CONTENT_LENGTH = 1500;

export interface RunTaekilJobInput {
  recordId: string;
  userId: string;
  prompt: string;
  consumeIdempotencyKey: string;
  creditAmount: number;
}

export async function runTaekilJob(input: RunTaekilJobInput): Promise<void> {
  const { recordId, userId, prompt, consumeIdempotencyKey, creditAmount } = input;
  const startedAt = new Date().toISOString();
  const { error: markError } = await supabaseAdmin
    .from('saju_records')
    .update({ status: 'processing', started_at: startedAt })
    .eq('id', recordId);
  if (markError) {
    await failJob(recordId, userId, consumeIdempotencyKey, creditAmount, 'PROCESSING_MARK_FAIL');
    return;
  }

  try {
    const raw = await callAI(SPIRIT_TONE_RULE + '\n' + SPIRIT_IMAGERY_RULE + '\n\n' + prompt, MAX_TOKENS, { temperature: 0.8, systemPrompt: SPIRIT_SYSTEM_PROMPT });
    if (raw.truncated) {
      throw new Error('응답이 길어서 일부 잘렸어요. 잠시 후 다시 시도해주세요.');
    }
    const sanitized = stripSpiritGaze(sanitizeAIOutput(raw.content));
    const match = sanitized.match(/\[taekil_advice\]\s*([\s\S]+)/);
    const advice = match ? match[1].trim() : sanitized.trim();
    if (advice.length < MIN_CONTENT_LENGTH) {
      throw new Error('택일 응답이 비정상적으로 짧아요. 잠시 후 다시 시도해주세요.');
    }
    await markDone(recordId, advice);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '택일 처리 중 오류';
    console.error('[taekilJob] 치명적 에러:', msg);
    await failJob(recordId, userId, consumeIdempotencyKey, creditAmount, msg);
  }
}

async function markDone(recordId: string, fullContent: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('saju_records')
    .update({
      status: 'done',
      interpretation_detailed: fullContent,
      interpretation_basic: fullContent,
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', recordId);
  if (error) console.error('[taekilJob] done 마킹 실패:', error);
}

async function failJob(
  recordId: string,
  userId: string,
  consumeIdempotencyKey: string,
  creditAmount: number,
  errorMessage: string,
): Promise<void> {
  const { error: updateError } = await supabaseAdmin
    .from('saju_records')
    .update({
      status: 'failed',
      error_message: errorMessage.slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq('id', recordId);
  if (updateError) console.error('[taekilJob] failed 마킹 에러:', updateError);
  try {
    await supabaseAdmin.rpc('refund_credit_atomic', {
      p_user_id: userId,
      p_credit_type: 'moon',
      p_amount: creditAmount,
      p_reason: '택일 분석 실패 자동 환불',
      p_idempotency_key: `refund:${consumeIdempotencyKey}`,
    });
  } catch (e) {
    console.error('[taekilJob] 환불 예외:', e);
  }
}
