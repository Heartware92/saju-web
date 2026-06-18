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
  /** 성공 시 차감에 쓰는 멱등키 (`tarot:${idempotencyKey}`) */
  consumeIdempotencyKey: string;
  creditAmount: number;
  chargeReason: string;
}

export async function runTarotJob(input: RunTarotJobInput): Promise<void> {
  const { recordId, userId, prompt, consumeIdempotencyKey, creditAmount, chargeReason } = input;

  const startedAt = new Date().toISOString();
  const { error: markError } = await supabaseAdmin
    .from('tarot_records')
    .update({ status: 'processing', started_at: startedAt })
    .eq('id', recordId);
  if (markError) {
    console.error('[tarotJob] processing 마킹 실패:', markError);
    await failJob(recordId, 'PROCESSING_MARK_FAIL'); // 아직 차감 전 → 환불 불필요
    return;
  }

  try {
    const raw = await callAI(prompt, MAX_TOKENS);
    const content = sanitizeAIOutput(raw.content);
    if (content.length < MIN_CONTENT_LENGTH) {
      throw new Error('타로 응답이 비정상적으로 짧아요. 잠시 후 다시 시도해주세요.');
    }
    // 결과 저장을 먼저, 차감을 그 다음에 한다.
    // 이 순서면 "차감됐는데 결과 없음"은 절대 생기지 않고, 차감 RPC가 실패/누락돼도
    // 무료 풀이(매출 손실)만 발생할 뿐 사용자 피해는 없다.
    await markDone(recordId, content);
    await chargeOnSuccess(userId, consumeIdempotencyKey, creditAmount, chargeReason);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '타로 처리 중 오류';
    console.error('[tarotJob] 치명적 에러:', msg);
    await failJob(recordId, msg); // 차감 전 실패 → 환불 불필요
  }
}

// 결과가 정상 생성된 뒤에만 차감. 멱등키로 재시도·중복 완료 시 이중 차감을 막는다.
async function chargeOnSuccess(
  userId: string,
  idempotencyKey: string,
  amount: number,
  reason: string,
): Promise<void> {
  try {
    const { data: result, error } = await supabaseAdmin.rpc('consume_credit_atomic', {
      p_user_id: userId,
      p_credit_type: 'moon',
      p_amount: amount,
      p_reason: reason,
      p_idempotency_key: idempotencyKey,
    });
    if (error) {
      console.error('[tarotJob] 성공 차감 RPC 에러 (무료 제공됨):', error);
      return;
    }
    if (result === 'insufficient') {
      // 진입 게이트 통과 후 동시 사용 등으로 잔액이 소진된 레이스. 결과는 이미 제공됨.
      console.warn('[tarotJob] 성공 차감 insufficient — 무료 제공됨. user=', userId);
    }
  } catch (e) {
    console.error('[tarotJob] 성공 차감 예외 (무료 제공됨):', e);
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

// 차감은 성공(markDone) 직후에만 일어나므로, 실패 경로에서는 환불할 것이 없다.
// 상태만 failed 로 기록한다.
async function failJob(recordId: string, errorMessage: string): Promise<void> {
  const { error: updateError } = await supabaseAdmin
    .from('tarot_records')
    .update({
      status: 'failed',
      error_message: errorMessage.slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq('id', recordId);
  if (updateError) console.error('[tarotJob] failed 마킹 에러:', updateError);
}
