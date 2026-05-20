// src/services/pickedDateJob.server.ts
// 지정일 운세(date / category='period') 백그라운드 잡 처리기 — 2-pass + partial.

import { callAI } from '@/lib/ai/aiClients';
import { sanitizeAIOutput } from './jungtongsajuShared';
import { supabaseAdmin } from './supabaseAdmin';

const PASS1_MAX_TOKENS = 7000;
const PASS2_MAX_TOKENS = 6000;
const PASS1_KEYS = ['date_flow', 'date_essence', 'date_timeflow', 'date_wealth', 'date_career', 'date_love', 'date_health', 'date_relation'];
const PASS2_KEYS = ['date_study', 'date_yes', 'date_no', 'date_people', 'date_remedy', 'date_closing'];

export interface RunPickedDateJobInput {
  recordId: string;
  userId: string;
  /** 클라가 완성한 base prompt (generatePickedDateFortunePrompt 호출 결과) */
  prompt: string;
  consumeIdempotencyKey: string;
  creditAmount: number;
}

export async function runPickedDateJob(input: RunPickedDateJobInput): Promise<void> {
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
    const pass1Prompt =
      prompt +
      `\n\n★ 이번 응답에서는 [date_flow] 데이터 줄과 [${PASS1_KEYS.slice(1).join('] [')}] 섹션만 출력하세요. 나머지는 다음 호출에서 작성합니다. 각 섹션 분량 지침을 충실히 따라 깊이 있게 작성하세요.`;
    const pass1Raw = await callAI(pass1Prompt, PASS1_MAX_TOKENS);
    const pass1Content = sanitizeAIOutput(pass1Raw.content);
    if (pass1Content.length < 300) {
      throw new Error('1차 응답이 비정상적으로 짧아요. 잠시 후 다시 시도해주세요.');
    }
    await markPartial(recordId, pass1Content);

    let pass2Content = '';
    try {
      const pass2Prompt =
        prompt +
        `\n\n★ 이번 응답에서는 [${PASS2_KEYS.join('] [')}] 섹션만 출력하세요. 앞의 섹션들은 이미 완료되었습니다. 각 섹션 분량 지침을 충실히 따라 깊이 있게 작성하세요.` +
        `\n\n[이미 작성된 1차 내용 — 참고만, 출력하지 말 것]\n${pass1Content}`;
      const pass2Raw = await callAI(pass2Prompt, PASS2_MAX_TOKENS);
      pass2Content = sanitizeAIOutput(pass2Raw.content);
    } catch (e) {
      console.warn('[pickedDateJob] 2차 실패. 1차만 done:', e);
    }

    const fullContent = pass2Content ? `${pass1Content}\n\n${pass2Content}` : pass1Content;
    await markDone(recordId, fullContent, pass1Content);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '지정일 운세 처리 중 오류';
    console.error('[pickedDateJob] 치명적 에러:', msg);
    await failJob(recordId, userId, consumeIdempotencyKey, creditAmount, msg);
  }
}

async function markPartial(recordId: string, coreContent: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('saju_records')
    .update({ interpretation_basic: coreContent })
    .eq('id', recordId);
  if (error) console.warn('[pickedDateJob] 1차 partial UPDATE 실패:', error);
}

async function markDone(
  recordId: string,
  fullContent: string,
  basicContent: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('saju_records')
    .update({
      status: 'done',
      interpretation_detailed: fullContent,
      interpretation_basic: basicContent,
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', recordId);
  if (error) console.error('[pickedDateJob] done 마킹 실패:', error);
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
  if (updateError) console.error('[pickedDateJob] failed 마킹 에러:', updateError);
  try {
    await supabaseAdmin.rpc('refund_credit_atomic', {
      p_user_id: userId,
      p_credit_type: 'moon',
      p_amount: creditAmount,
      p_reason: '지정일 운세 분석 실패 자동 환불',
      p_idempotency_key: `refund:${consumeIdempotencyKey}`,
    });
  } catch (e) {
    console.error('[pickedDateJob] 환불 예외:', e);
  }
}
