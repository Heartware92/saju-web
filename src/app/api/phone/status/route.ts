/**
 * GET /api/phone/status
 *
 * 현재 사용자의 이번 달 휴대폰 번호 변경 상태 조회.
 * - 새 달 진입 시 카운트 리셋 로직은 DB의 change_phone_atomic 과 동일하게
 *   "현재 월(KST) vs last_phone_change_month" 비교로 계산 (DB write 없이 추정).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';

export const runtime = 'nodejs';

function currentMonthKst(): string {
  // KST = UTC+9. 서버 타임존과 무관하게 안전한 포맷.
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) {
      return NextResponse.json({ error: '인증 토큰이 없어요.' }, { status: 401 });
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: '유효하지 않은 인증 토큰이에요.' }, { status: 401 });
    }
    const user = userData.user;

    const { data: credits, error: creditErr } = await supabaseAdmin
      .from('user_credits')
      .select('moon_balance, phone_change_free_count, last_phone_change_month')
      .eq('user_id', user.id)
      .maybeSingle();

    if (creditErr) {
      console.error('[phone/status] credit fetch error:', creditErr);
      return NextResponse.json({ error: '상태 조회에 실패했어요.' }, { status: 500 });
    }

    const currentMonth = currentMonthKst();
    const lastMonth = credits?.last_phone_change_month ?? null;
    const storedFree = credits?.phone_change_free_count ?? 1;

    // 새 달이면 무료 카운트 1로 보임 (DB는 다음 변경 시 갱신)
    const effectiveFree = !lastMonth || lastMonth !== currentMonth ? 1 : storedFree;

    return NextResponse.json({
      freeRemaining: effectiveFree,
      requiresCredit: effectiveFree <= 0,
      creditCost: 5,
      moonBalance: credits?.moon_balance ?? 0,
      hasEnoughCredit: (credits?.moon_balance ?? 0) >= 5,
    });
  } catch (error: any) {
    console.error('[phone/status] unexpected error:', error);
    return NextResponse.json({ error: '상태 조회에 실패했어요.' }, { status: 500 });
  }
}
