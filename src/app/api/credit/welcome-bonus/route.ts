/**
 * POST /api/credit/welcome-bonus
 * 회원가입 환영 보너스 — 달 5개 지급. 멱등·비차단.
 *
 *  - 인증: 본인 access token(Bearer) 으로만 호출.
 *  - 멱등성: grant_credit_atomic 의 idempotency_key(`signup_bonus:<uid>`) 로 유저당 1회만.
 *  - 어뷰징/소급 차단: 계정 생성 48시간 이내(신규)만 지급. 기존 회원은 'not_new' 스킵.
 *  - 매출 영향 없음: 어드민 매출은 orders 기반, 본 보너스는 credit_transactions 만 기록.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';

const WELCOME_MOON = 5;
const NEW_ACCOUNT_WINDOW_MS = 48 * 60 * 60 * 1000; // 48시간

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) {
      return NextResponse.json({ granted: false, error: 'no_token' }, { status: 401 });
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return NextResponse.json({ granted: false, error: 'invalid_token' }, { status: 401 });
    }
    const user = userData.user;

    // 신규 계정 게이트 — 기존 회원 소급 지급/어뷰징 차단
    const createdAtMs = user.created_at ? new Date(user.created_at).getTime() : 0;
    if (!createdAtMs || Date.now() - createdAtMs > NEW_ACCOUNT_WINDOW_MS) {
      return NextResponse.json({ granted: false, reason: 'not_new', amount: WELCOME_MOON });
    }

    const { data: result, error: rpcErr } = await supabaseAdmin.rpc('grant_credit_atomic', {
      p_user_id: user.id,
      p_credit_type: 'moon',
      p_amount: WELCOME_MOON,
      p_reason: '회원가입 환영 보너스',
      p_idempotency_key: `signup_bonus:${user.id}`,
    });
    if (rpcErr) {
      console.error('[credit/welcome-bonus] grant RPC 에러:', rpcErr);
      return NextResponse.json({ granted: false, error: 'grant_failed' }, { status: 500 });
    }

    // result: 'ok'(신규 지급) | 'duplicate'(이미 지급) | 그 외(실패)
    return NextResponse.json({
      granted: result === 'ok',
      alreadyGranted: result === 'duplicate',
      amount: WELCOME_MOON,
    });
  } catch (e) {
    console.error('[credit/welcome-bonus] failed (non-blocking):', e);
    return NextResponse.json({ granted: false, error: 'threw' }, { status: 200 });
  }
}
