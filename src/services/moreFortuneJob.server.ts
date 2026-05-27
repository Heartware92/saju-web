// src/services/moreFortuneJob.server.ts
// 더많은 운세(study·children·personality·name·dream) 통합 백그라운드 잡 처리기.
//
// 카테고리별 처리:
// - study·children·personality·name : 1-pass. 클라가 prompt 완성해서 보냄.
// - dream                            : 3-pass. 1차 분류기 → 2차 동양 + 3차 서양 (병렬).
//   클라가 dreamInput(text, timeBandId, isRepeating)을 보내면 서버가 3개 호출 직접 실행.

import { callAI } from '@/lib/ai/aiClients';
import { sanitizeAIOutput } from './jungtongsajuShared';
import { supabaseAdmin } from './supabaseAdmin';
import {
  generateDreamClassifierPrompt,
  generateDreamOrientalPrompt,
  generateDreamWesternPrompt,
  type DreamClassification,
  type DreamPromptOptions,
} from '@/constants/prompts';
import { parseDreamClassification } from './fortuneService';

export type MoreFortuneCategory = 'study' | 'children' | 'personality' | 'name' | 'dream';

const DEFAULT_MAX_TOKENS: Record<MoreFortuneCategory, number> = {
  study: 5000,
  children: 5000,
  personality: 5000,
  name: 6000,
  dream: 14000,  // (1-pass 폴백 한도 — 3-pass 본 경로는 각 호출별 별도)
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

// dream 3-pass 호출별 토큰 한도 (각자 Gemini 8192 한도 안에서 충분 분량)
const DREAM_CLASSIFIER_TOKENS = 1500;   // JSON 작은 응답
const DREAM_ORIENTAL_TOKENS = 8000;     // 6 섹션 풍부 분량 (Gemini 8192 한도 풀)
const DREAM_WESTERN_TOKENS = 8000;      // 5 섹션 풍부 분량 (Gemini 8192 한도 풀)

export interface DreamJobInput {
  dreamText: string;
  timeBandId?: string;
  isRepeating?: boolean;
}

export interface RunMoreFortuneJobInput {
  recordId: string;
  userId: string;
  category: MoreFortuneCategory;
  /** 1-pass 카테고리: 클라가 완성한 prompt. dream 3-pass는 빈 문자열 가능 (서버가 dreamInput 사용). */
  prompt: string;
  /** dream 카테고리 3-pass 전용 입력 — text/timeBandId/isRepeating */
  dreamInput?: DreamJobInput;
  /** 카테고리별 maxTokens — 클라가 override 가능 (예: name 한자 모드) */
  maxTokens?: number;
  consumeIdempotencyKey: string;
  creditAmount: number;
}

export async function runMoreFortuneJob(input: RunMoreFortuneJobInput): Promise<void> {
  const { recordId, userId, category, prompt, dreamInput, maxTokens, consumeIdempotencyKey, creditAmount } = input;

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
    let sanitized: string;
    if (category === 'dream' && dreamInput) {
      // 3-pass: 분류기 → (동양 + 서양 병렬)
      sanitized = await runDream3Pass(dreamInput);
    } else {
      // 1-pass: study / children / personality / name 또는 dream 폴백
      const tokens = maxTokens ?? DEFAULT_MAX_TOKENS[category];
      const raw = await callAI(prompt, tokens);
      sanitized = sanitizeAIOutput(raw.content);
    }

    const minLen = DEFAULT_MIN_LENGTH[category];
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

/**
 * 꿈해몽 3-pass 실행.
 *  1) 분류기 호출 (JSON) → DreamClassification
 *  2) 동양·서양 풀이를 분류 결과 받아 병렬 호출
 *  3) 두 응답 합쳐서 반환 (parseDreamV4가 합쳐진 마커들을 모두 파싱)
 *
 * 분류기 실패 시 → classification=null 로 폴백 (풀이 호출은 진행).
 * 동양·서양 중 하나 실패 시 → 성공한 쪽만 반환 (부분 결과라도 사용자에게).
 */
async function runDream3Pass(input: DreamJobInput): Promise<string> {
  const promptOptions: DreamPromptOptions = {
    timeBandId: input.timeBandId,
    isRepeating: input.isRepeating,
  };

  // ── 1차: 분류 ──────────────────────────────────────
  let classification: DreamClassification | null = null;
  try {
    const classifierPrompt = generateDreamClassifierPrompt(input.dreamText, promptOptions);
    const classifierRaw = await callAI(classifierPrompt, DREAM_CLASSIFIER_TOKENS);
    const parsed = parseDreamClassification(classifierRaw.content);
    if (parsed) {
      classification = parsed as DreamClassification;
      console.log('[dream:classify]', {
        kind: parsed.primary_kind,
        polarity: parsed.polarity_hint,
        clinical: parsed.clinical_hint,
        domains: parsed.strong_domains,
        taemong: parsed.is_taemong_alert,
      });
    } else {
      console.warn('[dream:classify] JSON 파싱 실패 — classification 없이 진행');
    }
  } catch (e) {
    console.warn('[dream:classify] 호출 실패 — classification 없이 진행:', e);
  }

  // ── 2,3차: 동양 + 서양 병렬 ─────────────────────────
  const orientalPrompt = generateDreamOrientalPrompt(input.dreamText, promptOptions, classification);
  const westernPrompt = generateDreamWesternPrompt(input.dreamText, promptOptions, classification);

  const [orientalRes, westernRes] = await Promise.allSettled([
    callAI(orientalPrompt, DREAM_ORIENTAL_TOKENS),
    callAI(westernPrompt, DREAM_WESTERN_TOKENS),
  ]);

  const orientalContent = orientalRes.status === 'fulfilled' ? sanitizeAIOutput(orientalRes.value.content) : '';
  const westernContent = westernRes.status === 'fulfilled' ? sanitizeAIOutput(westernRes.value.content) : '';

  if (!orientalContent && !westernContent) {
    throw new Error('꿈해몽 동양·서양 풀이 모두 실패했어요. 잠시 후 다시 시도해주세요.');
  }
  if (orientalRes.status === 'rejected') {
    console.error('[dream:oriental] 실패:', orientalRes.reason);
  }
  if (westernRes.status === 'rejected') {
    console.error('[dream:western] 실패:', westernRes.reason);
  }

  // 두 응답 합치기 — parseDreamV4 가 11 마커 모두 인식
  return [orientalContent, westernContent].filter(Boolean).join('\n\n');
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
  if (error) console.error('[moreFortuneJob] done 마킹 실패:', error);
}

async function failJob(
  recordId: string,
  userId: string,
  category: MoreFortuneCategory,
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
  if (updateError) console.error(`[moreFortuneJob:${category}] failed 마킹 에러:`, updateError);
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
