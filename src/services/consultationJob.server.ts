// src/services/consultationJob.server.ts
// 상담소(consultation) 백그라운드 잡 처리기 — server-only. 1-pass.
//
// 메인풀이/더많은운세와 동일한 잡 패턴으로 전환한 핵심 처리기.
// 기존 클라 SSE 스트리밍을 대체 — 브라우저를 닫거나 폰이 꺼져도 서버가 끝까지 답변을 생성하고
// consultation_records(DB)에 직접 기록한다. 따라서 무중단 + 크로스기기(다른 기기에서도 보임)가 동시 해결.
//
// 흐름:
//   1. saju_records(잡 캐리어) status='processing'
//   2. callAI 로 답변 생성(systemPrompt + history + userMessage)
//   3. (best-effort) 후속 질문 제안 생성
//   4. consultation_records.messages 에 [history + userMsg + assistantMsg] 로 기록(upsert, 멱등)
//   5. saju_records status='done' (useFortuneJob 가 폴링해 클라가 done 인지)
//   6. 실패 시 status='failed' + 자동환불 + consultation_records 의 해당 답변을 실패 표시

import { callAI } from '@/lib/ai/aiClients';
import { sanitizeAIOutput } from './jungtongsajuShared';
import { supabaseAdmin } from './supabaseAdmin';
import { trimToMaxQuestions, type ChatMessage } from '@/lib/consultation';

const ANSWER_MAX_TOKENS = 1500; // 기존 SSE route 의 1200 + 여유
const ANSWER_SYSTEM_PROMPT_SUFFIX = ''; // systemPrompt 는 잡 입력으로 전달됨

export interface RunConsultationJobInput {
  recordId: string;            // saju_records.id (잡 캐리어)
  userId: string;
  systemPrompt: string;        // buildConsultationSystemPrompt 결과
  history: ChatMessage[];      // 이전 대화(이번 질문 제외)
  userMessage: string;         // 이번 질문 본문
  userMessageId: string;       // 이번 질문 메시지 id (멱등·연결용)
  conversationId: string;      // `${profileId}::${elementKey}`
  profileId: string | null;
  profileName: string | null;
  consumeIdempotencyKey: string;
  creditAmount: number;
}

export async function runConsultationJob(input: RunConsultationJobInput): Promise<void> {
  const {
    recordId, userId, systemPrompt, history, userMessage, userMessageId,
    conversationId, profileId, profileName, consumeIdempotencyKey, creditAmount,
  } = input;

  const { error: markError } = await supabaseAdmin
    .from('saju_records')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', recordId);
  if (markError) {
    await failJob(recordId, userId, conversationId, consumeIdempotencyKey, creditAmount, 'PROCESSING_MARK_FAIL');
    return;
  }

  try {
    // ── 답변 생성 ── (멀티턴: systemPrompt + history + 이번 질문)
    const convo = history
      .map((m) => `${m.role === 'user' ? '사용자' : '상담사'}: ${m.content}`)
      .join('\n');
    const prompt = `${convo ? `[이전 대화]\n${convo}\n\n` : ''}[이번 질문]\n${userMessage}\n\n위 질문에 사주 풀이로 답하세요.${ANSWER_SYSTEM_PROMPT_SUFFIX}`;
    const raw = await callAI(prompt, ANSWER_MAX_TOKENS, { temperature: 0.85, systemPrompt });
    const answer = sanitizeAIOutput(raw.content).replace(/\*+/g, '').trim();
    if (!answer || answer.length < 10) throw new Error('상담 답변이 비어 있어요.');

    // ── 후속 질문 제안 (best-effort, 실패해도 답변은 저장) ──
    const followups = await generateFollowups(userMessage, answer, history).catch(() => [] as string[]);

    // ── consultation_records 기록 (서버가 직접 — 무중단·크로스기기 핵심) ──
    const assistantMsg: ChatMessage = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `a-${Date.now()}`,
      role: 'assistant',
      content: answer,
      createdAt: Date.now(),
      ...(followups.length > 0 ? { followups } : {}),
    };
    const userMsg: ChatMessage = { id: userMessageId, role: 'user', content: userMessage, createdAt: Date.now() - 1 };
    await writeConsultationRecord(userId, conversationId, profileId, profileName, history, userMsg, assistantMsg);

    // ── 잡 done (useFortuneJob 폴링용) ──
    await supabaseAdmin
      .from('saju_records')
      .update({ status: 'done', interpretation_detailed: answer, interpretation_basic: answer, completed_at: new Date().toISOString(), error_message: null })
      .eq('id', recordId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '상담소 처리 중 오류';
    console.error('[consultationJob] 치명적 에러:', msg);
    await failJob(recordId, userId, conversationId, consumeIdempotencyKey, creditAmount, msg);
  }
}

/** consultation_records 에 [history + userMsg + assistantMsg] 를 기록(upsert). history 가 진실원본. */
async function writeConsultationRecord(
  userId: string,
  conversationId: string,
  profileId: string | null,
  profileName: string | null,
  history: ChatMessage[],
  userMsg: ChatMessage,
  assistantMsg: ChatMessage,
): Promise<void> {
  // history(이전) + 이번 질문 + 답변. userMessageId 중복 방지(이미 history 에 있으면 제외).
  const base = history.filter((m) => m.id !== userMsg.id);
  const messages = trimToMaxQuestions([...base, userMsg, assistantMsg]);
  const title = '상담';
  const lastAt = new Date(assistantMsg.createdAt).toISOString();
  const { error } = await supabaseAdmin.from('consultation_records').upsert(
    {
      user_id: userId,
      profile_id: profileId,
      profile_name: profileName,
      conversation_id: conversationId,
      title,
      messages,
      message_count: messages.length,
      last_message_at: lastAt,
    },
    { onConflict: 'user_id,conversation_id' },
  );
  if (error) console.error('[consultationJob] consultation_records 기록 실패:', error);
}

/** 후속 질문 3개 — Gemini JSON 모드. 실패 시 throw(상위에서 catch→빈 배열). */
async function generateFollowups(lastQuestion: string, lastAnswer: string, history: ChatMessage[]): Promise<string[]> {
  const prevQuestions = history.filter((m) => m.role === 'user').map((m) => m.content).slice(-10);
  const prompt =
    `방금 사주 상담에서 사용자가 "${lastQuestion.slice(0, 500)}"라고 물었고, 상담사가 다음과 같이 답했습니다:\n"${lastAnswer.slice(0, 1200)}"\n\n` +
    `이 흐름에서 사용자가 이어서 물어볼 만한 질문 3개를 제안하세요. (1)답변을 더 깊이 파고드는 질문, (2)답변 속 다른 요소로 확장하는 질문, (3)완전히 다른 주제로 전환하는 질문. 각 60자 이내.` +
    (prevQuestions.length ? `\n\n이미 물어본 질문(중복 금지): ${prevQuestions.join(' / ')}` : '') +
    `\n\nJSON: {"suggestions": ["...", "...", "..."]}`;
  const raw = await callAI(prompt, 300, { temperature: 0.9, jsonMode: true });
  const parsed = JSON.parse(raw.content) as { suggestions?: string[] };
  return Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3).filter((s) => typeof s === 'string' && s.trim()) : [];
}

async function failJob(
  recordId: string,
  userId: string,
  conversationId: string,
  consumeIdempotencyKey: string,
  creditAmount: number,
  errorMessage: string,
): Promise<void> {
  await supabaseAdmin
    .from('saju_records')
    .update({ status: 'failed', error_message: errorMessage.slice(0, 500), completed_at: new Date().toISOString() })
    .eq('id', recordId);
  // 자동 환불 (멱등: 같은 consumeIdempotencyKey 는 1회만)
  try {
    await supabaseAdmin.rpc('refund_credit_atomic', {
      p_user_id: userId,
      p_credit_type: 'moon',
      p_amount: creditAmount,
      p_reason: '상담소 질문 실패 자동 환불',
      p_idempotency_key: `refund:${consumeIdempotencyKey}`,
    });
  } catch (e) {
    console.error('[consultationJob] 환불 예외:', e);
  }
}
