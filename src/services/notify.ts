/**
 * 클라이언트 알림 트리거 (fire-and-forget).
 * 가입 흐름을 절대 막지 않도록 모든 에러를 삼킨다.
 */
import { supabase } from './supabase';

/**
 * 회원가입 환영 알림톡 발송 요청.
 * 이메일/소셜 가입 완료(휴대폰 확정) 직후 호출. 멱등은 서버에서 보장.
 */
export async function notifySignupWelcome(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    await fetch('/api/notify/signup-welcome', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    /* 비차단 — 가입 흐름을 막지 않는다 */
  }
}
