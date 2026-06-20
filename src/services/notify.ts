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

export interface WelcomeBonusResult {
  granted: boolean;
  alreadyGranted?: boolean;
  amount: number;
}

/**
 * 회원가입 환영 보너스(달 5개) 지급 요청. 멱등은 서버 보장(유저당 1회).
 * 가입 완료 직후 + 홈 첫 진입(모달 표시 시) 양쪽에서 호출해도 안전(멱등).
 */
export async function requestWelcomeBonus(): Promise<WelcomeBonusResult | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;
    const res = await fetch('/api/credit/welcome-bonus', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as WelcomeBonusResult;
  } catch {
    return null;
  }
}

export interface KakaoChannelBonusResult {
  /** granted | already | not_added | not_kakao | not_configured | check_failed | grant_failed | error */
  status: string;
  amount?: number;
}

/**
 * 카카오 채널 추가 보너스(달 5개) 검증·지급 요청.
 * 서버가 카카오 채널 관계(ADDED)를 확인한 경우에만 지급. 멱등은 서버 보장.
 */
export async function requestKakaoChannelBonus(): Promise<KakaoChannelBonusResult | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;
    const res = await fetch('/api/credit/kakao-channel-bonus', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as KakaoChannelBonusResult;
  } catch {
    return null;
  }
}
