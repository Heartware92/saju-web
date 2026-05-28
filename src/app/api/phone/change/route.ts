/**
 * POST /api/phone/change
 *
 * 흐름 (실패 시 데이터 정합성 유지 순서)
 *   1) 토큰 검증
 *   2) body 파싱 (newPhone, otpCode, idempotencyKey)
 *   3) Rate limit 체크 (사용자 단위)
 *   4) OTP 검증 (otp_codes 테이블)
 *   5) 새 번호 중복 체크 (다른 계정 사용 중?)
 *   6) OTP row verified=true 선제 마킹 — 같은 OTP 재사용 차단
 *   7) auth.users.user_metadata.phone 업데이트 (먼저)
 *        실패 → 4xx/5xx 반환, RPC 안 부름. OTP 는 이미 사용됨.
 *   8) change_phone_atomic RPC 호출 (크레딧 차감)
 *        실패 → metadata 를 oldPhone 으로 롤백 시도 + 5xx 반환
 *
 * 멱등성: phone_change_history.idempotency_key UNIQUE 가 동시 요청 race 의 최종 안전망.
 *         같은 키 재시도 시 RPC 는 'duplicate' 반환 → metadata 도 이미 갱신된 상태.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { checkPhoneChangeRateLimit } from '@/services/rateLimit';

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

    // 3) Rate limit (사용자 단위) — phone 단위는 /api/sms/send 에서 별도 체크
    const rate = await checkPhoneChangeRateLimit(user.id);
    if (!rate.ok) {
      return NextResponse.json(
        { error: rate.message ?? '요청이 너무 잦아요. 잠시 후 다시 시도해주세요.' },
        { status: 429 },
      );
    }

    // 4) OTP 검증
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

    // 5) 새 번호 중복 체크
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

    // 6) OTP 선제 마킹 — 같은 OTP 재사용 차단
    //    이 시점 이후 단계가 실패해도 사용자는 새 OTP 를 받아야 함 (의도).
    const { error: otpMarkErr } = await supabaseAdmin
      .from('otp_codes')
      .update({ verified: true })
      .eq('id', otpRow.id);
    if (otpMarkErr) {
      console.error('[phone/change] OTP mark failed:', otpMarkErr);
      return NextResponse.json({ error: '인증 처리 중 오류가 발생했어요.' }, { status: 500 });
    }

    // 7) metadata 먼저 갱신 — 실패해도 차감 안 됐으므로 사용자 손해 0
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...(user.user_metadata ?? {}), phone: newPhone },
    });
    if (updateErr) {
      console.error('[phone/change] auth metadata update failed:', updateErr);
      return NextResponse.json(
        { error: '번호 갱신에 실패했어요. 인증부터 다시 받아주세요.' },
        { status: 500 },
      );
    }

    // 8) RPC 호출 (크레딧 차감 + 이력 기록)
    const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('change_phone_atomic', {
      p_user_id: user.id,
      p_old_phone: oldPhone,
      p_new_phone: newPhone,
      p_idempotency_key: idempotencyKey,
    });

    if (rpcErr || (rpcData !== 'ok' && rpcData !== 'duplicate')) {
      // metadata 롤백 시도 (best-effort)
      const rollbackMeta = oldPhone
        ? { ...(user.user_metadata ?? {}), phone: oldPhone }
        : (() => {
            const m = { ...(user.user_metadata ?? {}) };
            delete (m as Record<string, unknown>).phone;
            return m;
          })();
      await supabaseAdmin.auth.admin
        .updateUserById(user.id, { user_metadata: rollbackMeta })
        .catch((e) => console.error('[phone/change] metadata rollback failed:', e));

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
      console.error('[phone/change] unexpected RPC result:', rpcData);
      return NextResponse.json({ error: '변경 처리에 실패했어요.' }, { status: 500 });
    }

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
