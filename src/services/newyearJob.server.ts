// src/services/newyearJob.server.ts
// 신년운세(newyear) 백그라운드 잡 처리기 — server-only.
//
// 정통사주와 동일한 2-pass + markPartial 패턴. 단 input 이 더 풍부:
// sajuResult 외에 fortune (PeriodFortune)·year·userCtx·isYearFortune 도 받아
// 서버에서 generateNewyearReportPrompt 로 base prompt 생성.

import { callAI, SPIRIT_SYSTEM_PROMPT } from '@/lib/ai/aiClients';
import {
  generateNewyearReportPrompt,
  NEWYEAR_SECTION_KEYS,
  HANJA_TABLE_BLOCK,
  type NewyearSectionKey,
} from '@/constants/prompts';
import { sanitizeAIOutput } from './jungtongsajuShared';
import { supabaseAdmin } from './supabaseAdmin';
import { calculateSeWoonRange } from '@/utils/sajuCalculator';
import type { SajuResult } from '@/utils/sajuCalculator';
import type { PeriodFortune } from '@/engine/periodFortune';

// 섹션 분량 25% 증량(2026-05-20) 반영 — 출력 잘림 방지로 budget 상향.
// PASS2 는 monthly(2250~2900자) 포함이라 특히 넉넉히.
const PASS1_MAX_TOKENS = 6800;
const PASS2_MAX_TOKENS = 8200;

// ★ 신년운세 전용 시스템 프롬프트.
//   기본 시스템 프롬프트(aiClients.DEFAULT_SYSTEM_PROMPT)는 "핵심만 간결하게"를
//   지시해 본문 프롬프트의 글자수 요구(섹션당 400~540자 등)를 눌러버린다.
//   신년운세는 5달 크레딧 상품이므로 "간결" 대신 "분량 충족·풍부함"을 지시.
// 정령 공용 톤으로 통일(발랄 수다체 + 2단계 강조). 분량 유지는 SPIRIT 내부 + buildLengthDirective 가 담당.
const NEWYEAR_SYSTEM_PROMPT = SPIRIT_SYSTEM_PROMPT;
const PASS1_KEYS: NewyearSectionKey[] = ['general', 'wealth', 'career', 'study', 'love'];
const PASS2_KEYS: NewyearSectionKey[] = ['health', 'relation', 'monthly', 'lucky'];

// 섹션별 최소 글자수 — pass 지시에 명시해 다중 섹션 생성 시 분량 희석 방지.
// (한 번에 여러 섹션을 쓰면 AI 가 각 섹션을 짧게 압축하는 경향이 있어, pass
//  경계에서 최소치를 재차 못박는다. 본문 프롬프트 [섹션별 지침]과 동일 수치.)
const SECTION_MIN_CHARS: Record<NewyearSectionKey, number> = {
  general: 400, wealth: 350, career: 350, study: 320, love: 350,
  health: 280, relation: 280, monthly: 2250, lucky: 350,
};
const SECTION_KO: Record<NewyearSectionKey, string> = {
  general: '총운', wealth: '재물운', career: '직장·사업운', study: '학업·시험운',
  love: '연애·결혼운', health: '건강운', relation: '인간관계운', monthly: '월별 흐름',
  lucky: '행운 처방',
};
function buildLengthDirective(keys: NewyearSectionKey[]): string {
  const lines = keys.map(
    (k) => `   · [${k}] ${SECTION_KO[k]} — 최소 ${SECTION_MIN_CHARS[k]}자 이상`,
  );
  return (
    `\n★★ 분량 필수 — 아래 섹션 모두 각각 최소 글자수를 반드시 채울 것. 어느 하나도 짧게 끝내지 말 것:\n` +
    lines.join('\n') +
    `\n   각 섹션은 명리 근거 + 구체적 일상 장면 + 실천 조언을 충실히 풀어 위 최소치를 넘기세요.`
  );
}

// parseNewyearReport — fortuneService.ts 와 동일 로직 (server-safe 복제. archiveService 'use client'
// 회피용. 향후 lib/newyear.ts 로 분리해 DRY 가능).
function parseNewyearReport(raw: string): Partial<Record<NewyearSectionKey, string>> {
  const out: Partial<Record<NewyearSectionKey, string>> = {};
  const keysPattern = NEWYEAR_SECTION_KEYS.join('|');
  const parts = raw.split(new RegExp(`^\\s*\\[(${keysPattern})\\]\\s*$`, 'm'));
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i] as NewyearSectionKey;
    const body = (parts[i + 1] || '').trim();
    if (body) out[key] = body;
  }
  return out;
}

export interface RunNewyearJobInput {
  recordId: string;
  userId: string;
  sajuResult: SajuResult;
  fortune: PeriodFortune;
  year: number;
  userCtx?: {
    jobState?: string | null;
    customJobState?: string | null;
    loveState?: string | null;
    customLoveState?: string | null;
  };
  consumeIdempotencyKey: string;
  creditAmount: number;
}

export async function runNewyearJob(input: RunNewyearJobInput): Promise<void> {
  const {
    recordId,
    userId,
    sajuResult,
    fortune,
    year,
    userCtx,
    consumeIdempotencyKey,
    creditAmount,
  } = input;

  // ── status='processing' 마킹 ──
  const startedAt = new Date().toISOString();
  const { error: markError } = await supabaseAdmin
    .from('saju_records')
    .update({ status: 'processing', started_at: startedAt })
    .eq('id', recordId);
  if (markError) {
    console.error('[newyearJob] processing 마킹 실패:', markError);
    await failJob(recordId, userId, consumeIdempotencyKey, creditAmount, 'PROCESSING_MARK_FAIL');
    return;
  }

  try {
    // ── seWoon / currentDaeWoon 동적 보강 ──
    // saju.seWoon 은 12년 윈도우만 가짐. 연도별 운세에서 윈도우 밖 연도 선택 시 보강.
    let seWoon = sajuResult.seWoon.find((s) => s.year === year);
    if (!seWoon) {
      const dynamicRange = calculateSeWoonRange(
        sajuResult.pillars.day.gan,
        year,
        1,
        sajuResult.pillars.year.zhi,
      );
      seWoon = dynamicRange[0];
      if (!seWoon) {
        throw new Error(`${year}년 세운 데이터가 없습니다.`);
      }
    }
    const currentDaeWoon =
      sajuResult.daeWoon.find(
        (d) => d.gan && d.zhi && year >= d.startAge && year <= d.endAge,
      ) ?? null;
    const domains = fortune.domains.map((d) => ({
      key: d.key,
      label: d.label,
      score: d.score,
      grade: d.grade as string,
    }));

    // ── base prompt 생성 (1차/2차 공통) ──
    const basePrompt = generateNewyearReportPrompt(sajuResult, {
      year,
      seWoon,
      currentDaeWoon,
      monthlyFlow: fortune.monthlyFlow ?? [],
      domains,
      overallScore: fortune.overallScore,
      overallGrade: fortune.overallGrade as string,
      userCtx,
    });

    // ── 1차 호출 (5섹션) ──
    const pass1Prompt =
      basePrompt +
      `\n\n★ 이번 응답에서는 [${PASS1_KEYS.join('] [')}] ${PASS1_KEYS.length}개 섹션만 출력. 나머지 ${PASS2_KEYS.length}개는 다음 호출에서 작성.` +
      buildLengthDirective(PASS1_KEYS);
    const pass1Raw = await callAI(pass1Prompt, PASS1_MAX_TOKENS, { systemPrompt: NEWYEAR_SYSTEM_PROMPT });
    const pass1Content = sanitizeAIOutput(pass1Raw.content);

    if (pass1Raw.truncated || pass1Content.length < 300) {
      throw new Error('1차 응답이 비정상적으로 짧거나 잘렸어요. 잠시 후 다시 시도해주세요.');
    }

    // 1차 partial UPDATE — 클라이언트 즉시 부분 렌더 (정통사주 Phase 1.5 패턴)
    await markPartial(recordId, pass1Content);

    // ── 2차 호출 (4섹션) ──
    const pass2Prompt =
      basePrompt +
      `\n\n★ 이번 응답에서는 [${PASS2_KEYS.join('] [')}] ${PASS2_KEYS.length}개 섹션만 출력. [${PASS1_KEYS.join('] [')}]는 이미 완료.` +
      buildLengthDirective(PASS2_KEYS) +
      `\n\n[이미 작성된 1차 내용 — 참고만, 출력하지 말 것]\n${pass1Content}`;
    const pass2Raw = await callAI(pass2Prompt, PASS2_MAX_TOKENS, { systemPrompt: NEWYEAR_SYSTEM_PROMPT });
    const pass2Content = sanitizeAIOutput(pass2Raw.content);

    // 2차는 부분 누락 허용 (1차만이라도 보존). 다만 빈 응답은 에러.
    if (pass2Content.length < 100) {
      console.warn('[newyearJob] 2차 응답 비정상 짧음. 1차만 저장하고 완료.');
      await markDone(recordId, pass1Content, pass1Content);
      return;
    }

    const fullContent = `${pass1Content}\n\n${pass2Content}`;
    await markDone(recordId, fullContent, pass1Content);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '신년운세 처리 중 알 수 없는 오류';
    console.error('[newyearJob] 치명적 에러:', msg);
    await failJob(recordId, userId, consumeIdempotencyKey, creditAmount, msg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼 — 정통사주 패턴과 동일
// ─────────────────────────────────────────────────────────────────────────────
async function markPartial(recordId: string, coreContent: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('saju_records')
    .update({ interpretation_basic: coreContent })
    .eq('id', recordId);
  if (error) console.warn('[newyearJob] 1차 partial UPDATE 실패 (계속 진행):', error);
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
  if (error) console.error('[newyearJob] done 마킹 실패:', error);
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
  if (updateError) console.error('[newyearJob] failed 마킹 에러:', updateError);

  try {
    const { error: refundError } = await supabaseAdmin.rpc('refund_credit_atomic', {
      p_user_id: userId,
      p_credit_type: 'moon',
      p_amount: creditAmount,
      p_reason: '신년운세 분석 실패 자동 환불',
      p_idempotency_key: `refund:${consumeIdempotencyKey}`,
    });
    if (refundError) console.error('[newyearJob] 환불 RPC 에러:', refundError);
  } catch (refundErr) {
    console.error('[newyearJob] 환불 예외:', refundErr);
  }
}
