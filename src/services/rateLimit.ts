/**
 * Rate limit — Postgres 기반 (외부 인프라 의존성 없음)
 *
 * - SMS 발송: phone 단위. 솔라피 비용 폭주 + 스팸 통로 차단.
 *   otp_codes.created_at 으로 카운트.
 * - 휴대폰 번호 변경: user 단위. 한 사용자가 같은 번호를 반복 변경하는 시도 방지.
 *   phone_change_history.changed_at 으로 카운트 (성공한 변경만 기록됨).
 *
 * 안전 우선: 카운트 쿼리가 실패하면 통과시킴 (가용성 우선) — 실패 시 로그만 남김.
 */

import { supabaseAdmin } from './supabaseAdmin';

export interface RateResult {
  ok: boolean;
  message?: string;
}

const ISO = (ms: number) => new Date(Date.now() - ms).toISOString();
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * SMS 발송 빈도 제한 — phone 단위.
 *   1분 1회 / 1시간 5회 / 1일 10회
 */
export async function checkSmsSendRateLimit(phone: string): Promise<RateResult> {
  const oneDayAgo = ISO(DAY);
  const oneHourAgo = ISO(HOUR);
  const oneMinAgo = ISO(MIN);

  const { data, error } = await supabaseAdmin
    .from('otp_codes')
    .select('created_at')
    .eq('phone', phone)
    .gte('created_at', oneDayAgo);

  if (error) {
    console.error('[rate/sms] query error:', error);
    return { ok: true };
  }

  const list = data ?? [];
  const lastMin = list.filter((r) => r.created_at >= oneMinAgo).length;
  const lastHour = list.filter((r) => r.created_at >= oneHourAgo).length;
  const lastDay = list.length;

  if (lastMin >= 1) {
    return { ok: false, message: '잠시 후 다시 요청해주세요. (1분에 1회 제한)' };
  }
  if (lastHour >= 5) {
    return { ok: false, message: '인증 요청이 너무 잦아요. 잠시 후 다시 시도해주세요.' };
  }
  if (lastDay >= 10) {
    return { ok: false, message: '오늘 인증 요청 한도를 초과했어요. 내일 다시 시도해주세요.' };
  }
  return { ok: true };
}

/**
 * 휴대폰 번호 변경 빈도 제한 — user 단위.
 *   1시간 3회 / 1일 10회 (성공한 변경 기준)
 */
export async function checkPhoneChangeRateLimit(userId: string): Promise<RateResult> {
  const oneDayAgo = ISO(DAY);
  const oneHourAgo = ISO(HOUR);

  const { data, error } = await supabaseAdmin
    .from('phone_change_history')
    .select('changed_at')
    .eq('user_id', userId)
    .gte('changed_at', oneDayAgo);

  if (error) {
    console.error('[rate/phone-change] query error:', error);
    return { ok: true };
  }

  const list = data ?? [];
  const lastHour = list.filter((r) => r.changed_at >= oneHourAgo).length;
  const lastDay = list.length;

  if (lastHour >= 3) {
    return { ok: false, message: '변경 시도가 너무 잦아요. 잠시 후 다시 시도해주세요.' };
  }
  if (lastDay >= 10) {
    return { ok: false, message: '오늘 변경 한도를 초과했어요. 내일 다시 시도해주세요.' };
  }
  return { ok: true };
}
