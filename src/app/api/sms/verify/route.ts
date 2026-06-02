import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { checkRateLimit } from '@/services/rateLimitGeneric';

export async function POST(req: NextRequest) {
  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return NextResponse.json(
        { error: '휴대폰 번호와 인증번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 어뷰징 방어 — OTP 무차별 대입 차단. phone 기준(fail-open). 정상 사용자 오타 여유 허용.
    const rate = await checkRateLimit(`sms-verify:phone:${phone}`, [
      { windowSec: 300, max: 10 },
      { windowSec: 3600, max: 30 },
    ]);
    if (!rate.ok) {
      return NextResponse.json(
        { error: '인증 시도가 너무 잦아요. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      );
    }

    const { data, error: dbError } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('phone', phone)
      .eq('code', code)
      .eq('verified', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (dbError || !data) {
      return NextResponse.json(
        { error: '인증번호가 올바르지 않거나 만료되었습니다.' },
        { status: 400 }
      );
    }

    // 인증 완료 처리
    await supabaseAdmin
      .from('otp_codes')
      .update({ verified: true })
      .eq('id', data.id);

    return NextResponse.json({ success: true, verified: true });
  } catch (err: any) {
    console.error('[SMS] Verify error:', err);
    return NextResponse.json(
      { error: '인증 확인에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
