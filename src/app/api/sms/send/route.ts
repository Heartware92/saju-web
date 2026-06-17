import { NextRequest, NextResponse } from 'next/server';
import { SolapiMessageService } from 'solapi';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { checkSmsSendRateLimit } from '@/services/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const { phone, intent } = await req.json();

    if (!phone || !/^01[016789]\d{7,8}$/.test(phone)) {
      return NextResponse.json(
        { error: '올바른 휴대폰 번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // intent='phone-change' 면 솔라피 호출 전에 새 번호 중복 체크 (비용 절감)
    //   - 토큰에서 user.id 추출 후 check_phone_taken RPC 호출
    //   - 다른 계정 사용 중이면 SMS 발송하지 않고 409 반환
    if (intent === 'phone-change') {
      const authHeader = req.headers.get('authorization') || '';
      const accessToken = authHeader.replace(/^Bearer\s+/i, '');
      if (!accessToken) {
        return NextResponse.json({ error: '인증 토큰이 없어요.' }, { status: 401 });
      }
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
      if (userErr || !userData?.user) {
        return NextResponse.json({ error: '유효하지 않은 인증 토큰이에요.' }, { status: 401 });
      }
      // 현재 본인 번호와 동일하면 변경 의미 없음
      const myPhone = (userData.user.user_metadata?.phone as string | undefined) ?? null;
      if (myPhone && myPhone === phone) {
        return NextResponse.json(
          { error: '현재 사용 중인 번호와 동일해요.' },
          { status: 400 },
        );
      }
      const { data: takenData, error: takenErr } = await supabaseAdmin.rpc('check_phone_taken', {
        p_phone: phone,
        p_exclude_user_id: userData.user.id,
      });
      if (takenErr) {
        console.error('[sms/send] check_phone_taken error:', takenErr);
        return NextResponse.json({ error: '번호 확인 중 오류가 발생했어요.' }, { status: 500 });
      }
      if (takenData === true) {
        return NextResponse.json(
          { error: '이미 다른 계정에서 사용 중인 번호예요.' },
          { status: 409 },
        );
      }
    } else {
      // 회원가입(이메일 가입 / 소셜 첫 휴대폰 등록) — 이미 가입된 번호면 차단(한 번호 = 한 계정).
      //   단, 예외 허용 리스트(phone_signup_allowlist)에 등록된 번호는 중복 가입 허용.
      //   OTP 발송 전에 막아 어뷰징 차단 + 솔라피 SMS 비용 절감.
      const { data: takenData, error: takenErr } = await supabaseAdmin.rpc('check_phone_taken', {
        p_phone: phone,
        p_exclude_user_id: null,
      });
      if (takenErr) {
        console.error('[sms/send] check_phone_taken (signup) error:', takenErr);
        return NextResponse.json({ error: '번호 확인 중 오류가 발생했어요.' }, { status: 500 });
      }
      if (takenData === true) {
        const { data: allow } = await supabaseAdmin
          .from('phone_signup_allowlist')
          .select('phone')
          .eq('phone', phone)
          .maybeSingle();
        if (!allow) {
          return NextResponse.json(
            { error: '이미 가입된 휴대폰 번호입니다.' },
            { status: 409 },
          );
        }
      }
    }

    // Rate limit — 솔라피 비용 폭주·스팸 차단. 회원가입·번호변경 공통 적용.
    const rate = await checkSmsSendRateLimit(phone);
    if (!rate.ok) {
      return NextResponse.json(
        { error: rate.message ?? '요청이 너무 잦아요. 잠시 후 다시 시도해주세요.' },
        { status: 429 },
      );
    }

    const apiKey = process.env.SOLAPI_API_KEY?.trim();
    const apiSecret = process.env.SOLAPI_API_SECRET?.trim();
    const senderPhone = process.env.SOLAPI_SENDER_PHONE?.trim();

    if (!apiKey || !apiSecret || !senderPhone) {
      return NextResponse.json(
        { error: 'SMS 설정이 완료되지 않았습니다.' },
        { status: 500 }
      );
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // 기존 미사용 코드 무효화
    await supabaseAdmin
      .from('otp_codes')
      .update({ verified: true })
      .eq('phone', phone)
      .eq('verified', false);

    // 새 코드 저장
    const { error: dbError } = await supabaseAdmin
      .from('otp_codes')
      .insert({ phone, code, expires_at: expiresAt, verified: false });

    if (dbError) {
      console.error('[SMS] DB error:', dbError);
      return NextResponse.json(
        { error: '인증번호 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    // Solapi SMS 발송
    const solapi = new SolapiMessageService(apiKey, apiSecret);
    await solapi.send([
      {
        to: phone,
        from: senderPhone,
        // 마지막 줄 `@<도메인> #<코드>` 는 안드로이드 WebOTP 자동입력용(바운드 포맷).
        // iOS 는 이 줄을 무시하고 본문의 6자리를 휴리스틱으로 인식한다.
        text: `[이천점] 인증번호 ${code}를 입력해주세요. (5분 이내)\n\n@2000-saju.com #${code}`,
      },
    ]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[SMS] Send error:', err);
    return NextResponse.json(
      { error: '인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
}
