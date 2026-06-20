/**
 * POST /api/credit/kakao-channel-bonus
 * 카카오톡 채널 친구추가 보너스 — 달 5개. 멱등·서버 검증.
 *
 *  - 인증: 본인 access token(Bearer).
 *  - 검증: 카카오 Admin 키로 해당 사용자의 채널 관계를 조회 → relation='ADDED' 일 때만 지급.
 *          (클라이언트의 "추가했다" 주장만으로 지급하지 않음 — 어뷰징 차단)
 *  - 멱등: grant_credit_atomic(idempotency_key=`kakao_friend:<uid>`) 로 유저당 1회.
 *  - 미설정(KAKAO_ADMIN_KEY 없음) 시 'not_configured' 반환 — 기능 비활성, 안전.
 *
 *  ※ 카카오 채널 관계 조회는 사용자가 'plusfriends'(채널 추가상태) 동의를 한 경우에만 됩니다.
 *    동의가 없으면 카카오가 조회를 거부할 수 있어, 그 경우 'check_failed' 로 떨어집니다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';

const BONUS_MOON = 5;
const CHANNEL_ID = process.env.KAKAO_CHANNEL_PUBLIC_ID || '_UCExjX';

export async function POST(req: NextRequest) {
  try {
    const accessToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!accessToken) {
      return NextResponse.json({ status: 'unauthorized' }, { status: 401 });
    }
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return NextResponse.json({ status: 'unauthorized' }, { status: 401 });
    }
    const user = userData.user;

    const adminKey = process.env.KAKAO_ADMIN_KEY;
    if (!adminKey) {
      return NextResponse.json({ status: 'not_configured' });
    }

    // 카카오 사용자 id 추출 (소셜=kakao 사용자만 대상)
    const kakaoId =
      user.identities?.find((i) => i.provider === 'kakao')?.id ||
      (user.user_metadata?.provider_id as string | undefined) ||
      (user.user_metadata?.sub as string | undefined) ||
      null;
    if (!kakaoId) {
      return NextResponse.json({ status: 'not_kakao' });
    }

    // 채널 관계 조회 (Admin 키)
    const url =
      `https://kapi.kakao.com/v1/api/talk/channels` +
      `?target_id_type=user_id&target_id=${encodeURIComponent(kakaoId)}`;
    const kakaoRes = await fetch(url, {
      headers: { Authorization: `KakaoAK ${adminKey}` },
      cache: 'no-store',
    });
    if (!kakaoRes.ok) {
      const body = await kakaoRes.text().catch(() => '');
      console.error('[kakao-channel-bonus] 관계조회 실패', kakaoRes.status, body);
      return NextResponse.json({ status: 'check_failed', httpStatus: kakaoRes.status });
    }
    const data = (await kakaoRes.json()) as {
      channels?: Array<{ channel_public_id?: string; relation?: string }>;
    };
    const channels = data?.channels ?? [];
    // 앱에 연결된 채널만 응답에 오므로, 우리 채널 id 매칭(없으면 ADDED 존재만으로) 판정
    const added = channels.some(
      (c) => (c.channel_public_id ? c.channel_public_id === CHANNEL_ID : true) && c.relation === 'ADDED',
    );
    if (!added) {
      return NextResponse.json({ status: 'not_added' });
    }

    const { data: result, error: rpcErr } = await supabaseAdmin.rpc('grant_credit_atomic', {
      p_user_id: user.id,
      p_credit_type: 'moon',
      p_amount: BONUS_MOON,
      p_reason: '카카오 채널 추가 보너스',
      p_idempotency_key: `kakao_friend:${user.id}`,
    });
    if (rpcErr) {
      console.error('[kakao-channel-bonus] grant RPC 에러:', rpcErr);
      return NextResponse.json({ status: 'grant_failed' }, { status: 500 });
    }
    return NextResponse.json({
      status: result === 'ok' ? 'granted' : result === 'duplicate' ? 'already' : 'grant_failed',
      amount: BONUS_MOON,
    });
  } catch (e) {
    console.error('[kakao-channel-bonus] failed:', e);
    return NextResponse.json({ status: 'error' }, { status: 200 });
  }
}
