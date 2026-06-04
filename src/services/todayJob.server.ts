// src/services/todayJob.server.ts
// 실시간 운세(today) 백그라운드 잡 처리기 — 1-pass + 3회 retry.

import { callAI } from '@/lib/ai/aiClients';
import { sanitizeAIOutput } from './jungtongsajuShared';
import { supabaseAdmin } from './supabaseAdmin';

const MAX_TOKENS = 9500;
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1500, 2500];

export interface RunTodayJobInput {
  recordId: string;
  userId: string;
  prompt: string;
  consumeIdempotencyKey: string;
  creditAmount: number;
}

export async function runTodayJob(input: RunTodayJobInput): Promise<void> {
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
    let lastContent = '';
    let lastError: string | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        // temperature 상향(0.85) — 실시간 운세는 매일 변주가 중요. 일진×사주 정밀 블록(프롬프트)
        // 으로 매일 다른 명리 근거를 주고, temperature 로 표현·장면 다양성까지 확보.
        const raw = await callAI(prompt, MAX_TOKENS, { temperature: 0.85 });
        const sanitized = sanitizeAIOutput(raw.content);
        if (sanitized.length < 500) {
          lastError = `너무 짧음 (${sanitized.length}자)`;
          if (attempt < MAX_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1] ?? 2000));
            continue;
          }
        }
        lastContent = sanitized;
        lastError = null;
        break;
      } catch (e) {
        lastError = e instanceof Error ? e.message : '호출 실패';
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1] ?? 2000));
          continue;
        }
      }
    }
    if (!lastContent) {
      throw new Error(lastError ?? '실시간 운세 호출 실패');
    }
    await markDone(recordId, lastContent);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '실시간 운세 처리 중 오류';
    console.error('[todayJob] 치명적 에러:', msg);
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
  if (error) console.error('[todayJob] done 마킹 실패:', error);
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
  if (updateError) console.error('[todayJob] failed 마킹 에러:', updateError);
  try {
    await supabaseAdmin.rpc('refund_credit_atomic', {
      p_user_id: userId,
      p_credit_type: 'moon',
      p_amount: creditAmount,
      p_reason: '실시간 운세 분석 실패 자동 환불',
      p_idempotency_key: `refund:${consumeIdempotencyKey}`,
    });
  } catch (e) {
    console.error('[todayJob] 환불 예외:', e);
  }
}
