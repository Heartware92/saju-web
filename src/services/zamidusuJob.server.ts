// src/services/zamidusuJob.server.ts
// 자미두수(zamidusu) 백그라운드 잡 처리기 — server-only.
// 단순 2-pass + partial. 옛 getZamidusuReading 의 흐름 그대로.

import { callAI, SPIRIT_SYSTEM_PROMPT } from '@/lib/ai/aiClients';
import {
  generateZamidusuPrompt,
  type ZamidusuSectionKey,
} from '@/constants/prompts';
import { sanitizeAIOutput } from './jungtongsajuShared';
import { supabaseAdmin } from './supabaseAdmin';
import type { ZamidusuResult } from '@/engine/zamidusu';

const PASS1_MAX_TOKENS = 8000;
const PASS2_MAX_TOKENS = 8000;
// 2026-05-27 영역별 13 섹션 재구성: relations·wealth·body_mind 의미 변경,
// career·love 신설, interactions 제거(사화 mutagen 흡수).
const PASS1_KEYS: ZamidusuSectionKey[] = ['overview', 'main_star', 'helper_stars', 'body_palace', 'wealth', 'career', 'love'];
const PASS2_KEYS: ZamidusuSectionKey[] = ['body_mind', 'relations', 'mutagen', 'daehan', 'sohan', 'advice'];

// parseZamidusuSections — fortuneService.ts 와 동일 로직 server-safe 복제
const ZAMIDUSU_KEYS: ZamidusuSectionKey[] = [
  'overview', 'main_star', 'helper_stars', 'body_palace',
  'wealth', 'career', 'love', 'body_mind', 'relations',
  'mutagen', 'daehan', 'sohan', 'advice',
];
function parseZamidusuSections(raw: string): Partial<Record<ZamidusuSectionKey, string>> {
  const out: Partial<Record<ZamidusuSectionKey, string>> = {};
  const parts = raw.split(
    /^\s*\[(overview|main_star|helper_stars|body_palace|wealth|career|love|body_mind|relations|mutagen|daehan|sohan|advice|interactions|core)\]\s*$/m,
  );
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i];
    const body = (parts[i + 1] ?? '').trim();
    // core(레거시) → main_star, interactions(레거시) → mutagen 흡수
    let normalized: ZamidusuSectionKey;
    if (key === 'core') normalized = 'main_star';
    else if (key === 'interactions') normalized = 'mutagen';
    else normalized = key as ZamidusuSectionKey;
    if (ZAMIDUSU_KEYS.includes(normalized) && body) out[normalized] = body;
  }
  return out;
}

export interface RunZamidusuJobInput {
  recordId: string;
  userId: string;
  zamidusuResult: ZamidusuResult;
  consumeIdempotencyKey: string;
  creditAmount: number;
}

export async function runZamidusuJob(input: RunZamidusuJobInput): Promise<void> {
  const { recordId, userId, zamidusuResult, consumeIdempotencyKey, creditAmount } = input;

  const startedAt = new Date().toISOString();
  const { error: markError } = await supabaseAdmin
    .from('saju_records')
    .update({ status: 'processing', started_at: startedAt })
    .eq('id', recordId);
  if (markError) {
    console.error('[zamidusuJob] processing 마킹 실패:', markError);
    await failJob(recordId, userId, consumeIdempotencyKey, creditAmount, 'PROCESSING_MARK_FAIL');
    return;
  }

  try {
    const basePrompt = generateZamidusuPrompt(zamidusuResult);

    // ── 1차: 6섹션 (명궁·외부 관계·재물) ──
    const pass1Prompt =
      basePrompt +
      `\n\n★ 이번 응답에서는 [${PASS1_KEYS.join('] [')}] 6개 섹션만 출력하세요. 나머지 6개는 다음 호출에서 작성합니다. 각 섹션의 분량 지침을 충실히 따라 깊이 있게 작성하세요.`;
    const pass1Raw = await callAI(pass1Prompt, PASS1_MAX_TOKENS, { systemPrompt: SPIRIT_SYSTEM_PROMPT });
    const pass1Content = sanitizeAIOutput(pass1Raw.content);

    if (pass1Content.length < 300) {
      throw new Error('1차 응답이 비정상적으로 짧아요. 잠시 후 다시 시도해주세요.');
    }

    // 1차 partial UPDATE
    await markPartial(recordId, pass1Content);

    // ── 2차: 6섹션 (몸·마음·사화·시간·조언) ──
    let pass2Content = '';
    try {
      const pass2Prompt =
        basePrompt +
        `\n\n★ 이번 응답에서는 [${PASS2_KEYS.join('] [')}] 6개 섹션만 출력하세요. [${PASS1_KEYS.join('] [')}]는 이미 완료되었습니다. 각 섹션의 분량 지침을 충실히 따라 깊이 있게 작성하세요.` +
        `\n\n[이미 작성된 1차 내용 — 참고만, 출력하지 말 것]\n${pass1Content}`;
      const pass2Raw = await callAI(pass2Prompt, PASS2_MAX_TOKENS, { systemPrompt: SPIRIT_SYSTEM_PROMPT });
      pass2Content = sanitizeAIOutput(pass2Raw.content);
    } catch (e) {
      console.warn('[zamidusuJob] 2차 실패. 1차만으로 done:', e);
    }

    const fullContent = pass2Content ? `${pass1Content}\n\n${pass2Content}` : pass1Content;
    await markDone(recordId, fullContent, pass1Content);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '자미두수 처리 중 알 수 없는 오류';
    console.error('[zamidusuJob] 치명적 에러:', msg);
    await failJob(recordId, userId, consumeIdempotencyKey, creditAmount, msg);
  }
}

async function markPartial(recordId: string, coreContent: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('saju_records')
    .update({ interpretation_basic: coreContent })
    .eq('id', recordId);
  if (error) console.warn('[zamidusuJob] 1차 partial UPDATE 실패:', error);
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
  if (error) console.error('[zamidusuJob] done 마킹 실패:', error);
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
  if (updateError) console.error('[zamidusuJob] failed 마킹 에러:', updateError);

  try {
    const { error: refundError } = await supabaseAdmin.rpc('refund_credit_atomic', {
      p_user_id: userId,
      p_credit_type: 'moon',
      p_amount: creditAmount,
      p_reason: '자미두수 분석 실패 자동 환불',
      p_idempotency_key: `refund:${consumeIdempotencyKey}`,
    });
    if (refundError) console.error('[zamidusuJob] 환불 RPC 에러:', refundError);
  } catch (refundErr) {
    console.error('[zamidusuJob] 환불 예외:', refundErr);
  }
}
