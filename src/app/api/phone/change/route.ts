/**
 * POST /api/phone/change
 *
 * 흐름
 *   1) 토큰 검증
 *   2) body 파싱 (newPhone, otpCode, idempotencyKey)
 *   3) OTP 검증 (otp_codes 테이블 — 회원가입과 동일 방식)
 *   4) 새 번호가 다른 계정에 사용 중인지 체크
 *   5) change_phone_atomic RPC 호출 (월 무료 / 5달 차감 자동 처리)
 *   6) auth.users.user_metadata.phone 업데이트
 *   7) OTP row verified=true 처리
 *
 * 멱등성: idempotencyKey 가 credit_transactions 에 이미 있으면 'duplicate' 반환 → 성공으로 응답
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface ChangePhoneBody {
  newPhone?: string;
  otpCode?: string;
  idempotencyKey?: string;
}

export async function POST(req: NextRequest) {
  try {
    // 1) 인증
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
    const oldPhone = (user.user_metadata?.phone as string | undefined) ?? null;

    // 2) body
    let body: ChangePhoneBody = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: '요청 형식이 잘못됐어요.' }, { status: 400 });
    }
    const newPhone = (body.newPhone ?? '').replace(/[^0-9]/g, '');
    const otpCode = (body.otpCode ?? '').trim();
    const idempotencyKey = (body.idempotencyKey ?? '').trim();

    if (!/^01[016789]\d{7,8}$/.test(newPhone)) {
      return NextResponse.json({ error: '올바른 휴대폰 번호를 입력해주세요.' }, { status: 400 });
    }
    if (!otpCode || otpCode.length !== 6) {
      return NextResponse.json({ error: '6자리 인증번호를 입력해주세요.' }, { status: 400 });
    }
    if (!idempotencyKey || idempotencyKey.length < 8) {
      return NextResponse.json({ error: '요청 식별자가 잘못됐어요.' }, { status: 400 });
    }

    if (oldPhone && oldPhone === newPhone) {
      return NextResponse.json({ error: '현재 사용 중인 번호와 동일해요.' }, { status: 400 });
    }

    // 3) OTP 검증
    const { data: otpRow, error: otpErr } = await supabaseAdmin
      .from('otp_codes')
      .select('id, expires_at')
      .eq('phone', newPhone)
      .eq('code', otpCode)
      .eq('verified', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpErr || !otpRow) {
      return NextResponse.json(
        { error: '인증번호가 올바르지 않거나 만료되었어요.' },
        { status: 400 },
      );
    }

    // 4) 새 번호 중복 체크 (다른 계정에서 사용 중인지)
    const { data: takenData, error: takenErr } = await supabaseAdmin.rpc('check_phone_taken', {
      p_phone: newPhone,
      p_exclude_user_id: user.id,
    });
    if (takenErr) {
      console.error('[phone/change] check_phone_taken error:', takenErr);
      return NextResponse.json({ error: '번호 확인 중 오류가 발생했어요.' }, { status: 500 });
    }
    if (takenData === true) {
      return NextResponse.json(
        { error: '이미 다른 계정에서 사용 중인 번호예요.' },
        { status: 409 },
      );
    }

    // 5) 변경 RPC 호출 (월 무료 / 5달 차감 자동 분기)
    const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('change_phone_atomic', {
      p_user_id: user.id,
      p_old_phone: oldPhone,
      p_new_phone: newPhone,
      p_idempotency_key: idempotencyKey,
    });

    if (rpcErr) {
      console.error('[phone/change] RPC error:', rpcErr);
      return NextResponse.json({ error: '변경 처리 중 오류가 발생했어요.' }, { status: 500 });
    }

    if (rpcData === 'insufficient') {
      return NextResponse.json(
        { error: '달 크레딧이 부족해요. 5달이 필요합니다.', code: 'insufficient' },
        { status: 402 },
      );
    }
    if (rpcData === 'no_user') {
      return NextResponse.json(
        { error: '계정 정보를 찾지 못했어요.', code: 'no_user' },
        { status: 404 },
      );
    }
    if (rpcData !== 'ok' && rpcData !== 'duplicate') {
      console.error('[phone/change] unexpected RPC result:', rpcData);
      return NextResponse.json({ error: '변경 처리에 실패했어요.' }, { status: 500 });
    }

    // 6) auth.users.user_metadata.phone 업데이트
    //    'duplicate' 인 경우엔 이미 처리된 요청이므로 metadata 도 이미 갱신됐을 가능성 ↑
    //    하지만 idempotency 안전망 차원에서 한 번 더 set (덮어쓰기 OK).
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...(user.user_metadata ?? {}), phone: newPhone },
    });
    if (updateErr) {
      console.error('[phone/change] auth metadata update failed:', updateErr);
      // 이미 RPC 가 통과했으므로 (이력·크레딧 차감 완료) — 실패 응답하지 말고 경고만
    }

    // 7) OTP row 사용 처리
    await supabaseAdmin
      .from('otp_codes')
      .update({ verified: true })
      .eq('id', otpRow.id);

    return NextResponse.json({
      success: true,
      duplicate: rpcData === 'duplicate',
    });
  } catch (error: any) {
    console.error('[phone/change] unexpected error:', error);
    return NextResponse.json(
      { error: '변경 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    );
  }
}
