/**
 * POST /api/notify/signup-welcome
 * 회원가입 완료(휴대폰 확정) 직후 '회원가입 환영' 알림톡 발송 — 멱등·비차단.
 *
 *  - 인증: 본인 access token(Bearer) 으로만 호출. 토큰의 user 기준으로만 발송.
 *  - 멱등성: user_id 당 'sent' 1건만 — 중복 알림톡(과금) 방지.
 *            (DB 056 마이그레이션의 부분 유니크 인덱스가 하드 가드, 여기선 선검사)
 *  - 비차단: 어떤 실패도 200 으로 흡수 — 가입 흐름을 막지 않는다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { sendSignupWelcomeAlimtalk } from '@/services/alimtalk';

const EVENT = 'signup_welcome';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) {
      return NextResponse.json({ status: 'skipped', error: 'no_token' }, { status: 401 });
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return NextResponse.json({ status: 'skipped', error: 'invalid_token' }, { status: 401 });
    }
    const user = userData.user;

    // 멱등성 선검사 — 이미 성공 발송된 유저면 스킵
    const { data: already } = await supabaseAdmin
      .from('notification_log')
      .select('id')
      .eq('user_id', user.id)
      .eq('channel', 'alimtalk')
      .eq('event', EVENT)
      .eq('status', 'sent')
      .maybeSingle();
    if (already) {
      return NextResponse.json({ status: 'skipped', error: 'already_sent' });
    }

    const phone =
      (user.user_metadata?.phone as string | undefined) ??
      (user.phone as string | undefined) ??
      null;

    const result = await sendSignupWelcomeAlimtalk(phone);

    // 발송 결과 로깅 (성공/실패/스킵 전부 — 감사·재시도 판단용)
    await supabaseAdmin.from('notification_log').insert({
      inquiry_id: null,
      user_id: user.id,
      channel: 'alimtalk',
      event: EVENT,
      recipient: result.recipient,
      status: result.status,
      provider: 'solapi',
      provider_response: (result.providerResponse ?? null) as any,
      error: result.error ?? null,
    });

    return NextResponse.json({ status: result.status, error: result.error });
  } catch (e: any) {
    console.error('[notify/signup-welcome] failed (non-blocking):', e);
    return NextResponse.json({ status: 'skipped', error: 'threw' });
  }
}
