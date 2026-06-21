// src/services/tojeongJob.server.ts
// 토정비결(tojeong) 백그라운드 잡 처리기 — server-only.
// 옛 getTojeongReading 의 2-pass 흐름. 4단 폴백은 제거 (실패 시 자동 환불로 보호).

import { callAI, SPIRIT_SYSTEM_PROMPT } from '@/lib/ai/aiClients';
import {
  generateTojeongPass1Prompt,
  generateTojeongPass2Prompt,
  SPIRIT_TONE_RULE,
  TOJEONG_SECTION_KEYS,
  type TojeongSectionKey,
} from '@/constants/prompts';
import { sanitizeAIOutput } from './jungtongsajuShared';
import { supabaseAdmin } from './supabaseAdmin';
import type { SajuResult } from '@/utils/sajuCalculator';
import type { TojeongResult } from '@/engine/tojeong';

const PASS1_MAX_TOKENS = 8000;
const PASS2_MAX_TOKENS = 8500;

function parseTojeongSections(raw: string): Partial<Record<TojeongSectionKey, string>> {
  const out: Partial<Record<TojeongSectionKey, string>> = {};
  const pattern = TOJEONG_SECTION_KEYS.join('|');
  const parts = raw.split(new RegExp(`^\\s*\\[(${pattern})\\]\\s*$`, 'm'));
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i] as TojeongSectionKey;
    const body = (parts[i + 1] || '').trim();
    if (TOJEONG_SECTION_KEYS.includes(key) && body) out[key] = body;
  }
  return out;
}

export interface RunTojeongJobInput {
  recordId: string;
  userId: string;
  tojeongResult: TojeongResult;
  sajuResult?: SajuResult;
  userCtx?: {
    jobState?: string | null;
    customJobState?: string | null;
    loveState?: string | null;
    customLoveState?: string | null;
  };
  consumeIdempotencyKey: string;
  creditAmount: number;
}

export async function runTojeongJob(input: RunTojeongJobInput): Promise<void> {
  const {
    recordId,
    userId,
    tojeongResult,
    sajuResult,
    userCtx,
    consumeIdempotencyKey,
    creditAmount,
  } = input;

  const startedAt = new Date().toISOString();
  const { error: markError } = await supabaseAdmin
    .from('saju_records')
    .update({ status: 'processing', started_at: startedAt })
    .eq('id', recordId);
  if (markError) {
    console.error('[tojeongJob] processing 마킹 실패:', markError);
    await failJob(recordId, userId, consumeIdempotencyKey, creditAmount, 'PROCESSING_MARK_FAIL');
    return;
  }

  try {
    // ── 1차: 총운 + 월별 12달 (TOJEONG_SECTION_KEYS 중 일부) ──
    const pass1Prompt = generateTojeongPass1Prompt(tojeongResult, sajuResult, userCtx);
    const pass1Raw = await callAI(SPIRIT_TONE_RULE + '\n\n' + pass1Prompt, PASS1_MAX_TOKENS, { temperature: 0.75, systemPrompt: SPIRIT_SYSTEM_PROMPT });
    const pass1Content = sanitizeAIOutput(pass1Raw.content);

    if (pass1Content.length < 300) {
      throw new Error('1차 응답이 비정상적으로 짧아요. 잠시 후 다시 시도해주세요.');
    }

    // 1차 partial UPDATE — 클라이언트가 부분 렌더
    await markPartial(recordId, pass1Content);

    // ── 2차: 7섹션 (재물·연애·학업·창업·건강·주의·조언) ──
    let pass2Content = '';
    try {
      const pass2Prompt = generateTojeongPass2Prompt(tojeongResult, pass1Content, sajuResult, userCtx);
      const pass2Raw = await callAI(SPIRIT_TONE_RULE + '\n\n' + pass2Prompt, PASS2_MAX_TOKENS, { temperature: 0.75, systemPrompt: SPIRIT_SYSTEM_PROMPT });
      pass2Content = sanitizeAIOutput(pass2Raw.content);
    } catch (e) {
      console.warn('[tojeongJob] 2차 실패. 1차만으로 done:', e);
    }

    const fullContent = pass2Content ? `${pass1Content}\n\n${pass2Content}` : pass1Content;
    await markDone(recordId, fullContent, pass1Content);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '토정비결 처리 중 알 수 없는 오류';
    console.error('[tojeongJob] 치명적 에러:', msg);
    await failJob(recordId, userId, consumeIdempotencyKey, creditAmount, msg);
  }
}

async function markPartial(recordId: string, coreContent: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('saju_records')
    .update({ interpretation_basic: coreContent })
    .eq('id', recordId);
  if (error) console.warn('[tojeongJob] 1차 partial UPDATE 실패:', error);
}

async function markDone(
  recordId: string,
  fullContent: string,
  basicContent: string,
): Promise<void> {
  const completedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('saju_records')
    .update({
      status: 'done',
      interpretation_detailed: fullContent,
      interpretation_basic: basicContent,
      completed_at: completedAt,
      error_message: null,
    })
    .eq('id', recordId);
  if (error) console.error('[tojeongJob] done 마킹 실패:', error);
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
  if (updateError) console.error('[tojeongJob] failed 마킹 에러:', updateError);

  try {
    const { error: refundError } = await supabaseAdmin.rpc('refund_credit_atomic', {
      p_user_id: userId,
      p_credit_type: 'moon',
      p_amount: creditAmount,
      p_reason: '토정비결 분석 실패 자동 환불',
      p_idempotency_key: `refund:${consumeIdempotencyKey}`,
    });
    if (refundError) console.error('[tojeongJob] 환불 RPC 에러:', refundError);
  } catch (refundErr) {
    console.error('[tojeongJob] 환불 예외:', refundErr);
  }
}
