// src/services/moreFortuneJob.server.ts
// 더많은 운세(study·children·personality·name·dream) 통합 백그라운드 잡 처리기.
// 1-pass. 카테고리별 maxTokens 만 다름. 클라가 prompt 완성해서 보냄.

import { callAI } from '@/lib/ai/aiClients';
import { sanitizeAIOutput } from './jungtongsajuShared';
import { supabaseAdmin } from './supabaseAdmin';

export type MoreFortuneCategory = 'study' | 'children' | 'personality' | 'name' | 'dream';

// 카테고리별 maxTokens — MORE_FORTUNE_CONFIGS 와 일치. name 은 한자 모드 시 클라가 *1.5 적용해서 보냄.
const DEFAULT_MAX_TOKENS: Record<MoreFortuneCategory, number> = {
  study: 5000,
  children: 5000,
  personality: 5000,
  name: 6000,
  dream: 10000,
};
const DEFAULT_MIN_LENGTH: Record<MoreFortuneCategory, number> = {
  study: 500,
  children: 500,
  personality: 500,
  name: 500,
  dream: 1000,
};
const CATEGORY_LABEL: Record<MoreFortuneCategory, string> = {
  study: '학업·시험운',
  children: '자녀·출산운',
  personality: '성격 분석',
  name: '이름 풀이',
  dream: '꿈해몽',
};

export interface RunMoreFortuneJobInput {
  recordId: string;
  userId: string;
  category: MoreFortuneCategory;
  prompt: string;
  /** 카테고리별 maxTokens — 클라가 override 가능 (예: name 한자 모드) */
  maxTokens?: number;
  consumeIdempotencyKey: string;
  creditAmount: number;
}

export async function runMoreFortuneJob(input: RunMoreFortuneJobInput): Promise<void> {
  const { recordId, userId, category, prompt, maxTokens, consumeIdempotencyKey, creditAmount } = input;

  const startedAt = new Date().toISOString();
  const { error: markError } = await supabaseAdmin
    .from('saju_records')
    .update({ status: 'processing', started_at: startedAt })
    .eq('id', recordId);
  if (markError) {
    await failJob(recordId, userId, category, consumeIdempotencyKey, creditAmount, 'PROCESSING_MARK_FAIL');
    return;
  }

  try {
    const tokens = maxTokens ?? DEFAULT_MAX_TOKENS[category];
    const minLen = DEFAULT_MIN_LENGTH[category];
    const raw = await callAI(prompt, tokens);
    const sanitized = sanitizeAIOutput(raw.content);
    if (sanitized.length < minLen) {
      throw new Error(`${CATEGORY_LABEL[category]} 응답이 비정상적으로 짧아요. 잠시 후 다시 시도해주세요.`);
    }
    await markDone(recordId, sanitized);
  } catch (e) {
    const msg = e instanceof Error ? e.message : `${CATEGORY_LABEL[category]} 처리 중 오류`;
    console.error(`[moreFortuneJob:${category}] 치명적 에러:`, msg);
    await failJob(recordId, userId, category, consumeIdempotencyKey, creditAmount, msg);
  }
}

async function markDone(recordId: string, fullContent: string): Promise<void> {
  await supabaseAdmin
    .from('saju_records')
    .update({
      status: 'done',
      interpretation_detailed: fullContent,
      interpretation_basic: fullContent,
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', recordId);
}

async function failJob(
  recordId: string,
  userId: string,
  category: MoreFortuneCategory,
  consumeIdempotencyKey: string,
  creditAmount: number,
  errorMessage: string,
): Promise<void> {
  await supabaseAdmin
    .from('saju_records')
    .update({
      status: 'failed',
      error_message: errorMessage.slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq('id', recordId);
  try {
    await supabaseAdmin.rpc('refund_credit_atomic', {
      p_user_id: userId,
      p_credit_type: 'moon',
      p_amount: creditAmount,
      p_reason: `${CATEGORY_LABEL[category]} 분석 실패 자동 환불`,
      p_idempotency_key: `refund:${consumeIdempotencyKey}`,
    });
  } catch (e) {
    console.error(`[moreFortuneJob:${category}] 환불 예외:`, e);
  }
}
