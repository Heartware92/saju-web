/**
 * 회원 탈퇴 API.
 * - 로그인한 본인의 access_token 을 헤더로 받아 Supabase 에서 user 검증
 * - account_deletion_logs 에 사유·이메일·user_id INSERT
 * - supabase.auth.admin.deleteUser(user_id) 호출 → auth.users + 연관 RLS CASCADE 삭제
 *
 * Vercel maxDuration 기본 사용 (수 초 내 완료).
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';

export const maxDuration = 30;

interface DeleteAccountBody {
  reasonCode?: 'not_useful' | 'rarely_used' | 'hard_to_use' | 'other';
  reason?: string;
}

export async function POST(req: NextRequest) {
  try {
    // ── 1) Authorization 헤더에서 access_token 추출 ──
    const authHeader = req.headers.get('authorization') || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!accessToken) {
      return NextResponse.json({ error: '인증 토큰이 없어요.' }, { status: 401 });
    }

    // ── 2) Supabase 로 user 검증 (service role 로 토큰 검증) ──
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: '유효하지 않은 인증 토큰이에요.' }, { status: 401 });
    }
    const user = userData.user;
    if (!user.email) {
      return NextResponse.json({ error: '이메일 정보가 없는 계정이에요.' }, { status: 400 });
    }

    // ── 3) body 파싱 (사유) ──
    let body: DeleteAccountBody = {};
    try {
      body = await req.json();
    } catch {
      // body 없어도 OK (사유 미입력)
    }

    // ── 4) 통계용 메타데이터 수집 (가입일·총 결제 등) ──
    let metadata: Record<string, unknown> = {
      created_at: user.created_at,
    };
    try {
      // 총 충전·총 소비 등 통계 (테이블 있는 경우만)
      const [{ data: credit }, { data: orderCount }] = await Promise.all([
        supabaseAdmin.from('user_credits').select('total_sun_purchased, total_moon_purchased, total_sun_consumed, total_moon_consumed').eq('user_id', user.id).maybeSingle(),
        supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);
      metadata = { ...metadata, credit, order_count: orderCount };
    } catch (e) {
      console.warn('[delete-account] metadata collect failed (non-critical):', e);
    }

    // ── 5) 탈퇴 로그 INSERT (먼저 로그를 저장 — 사용자 삭제 후엔 user_id 참조 못함) ──
    const { data: logRow, error: logErr } = await supabaseAdmin
      .from('account_deletion_logs')
      .insert({
        user_id: user.id,
        email: user.email,
        reason: body.reason ?? null,
        reason_code: body.reasonCode ?? null,
        metadata,
      })
      .select('id')
      .maybeSingle();
    if (logErr) {
      console.error('[delete-account] log insert failed:', logErr);
      // 로그 실패해도 탈퇴는 진행 (사용자 권리 보호 우선)
    }

    // ── 5.5) 거래 기록 보존 (분쟁/차지백 대응 + 전자상거래법 5년 보존) ──
    // auth.users 삭제 시 orders·credit_transactions 가 CASCADE 로 사라지므로,
    // 삭제 직전 결제·거래 원장을 preserved_transactions 로 스냅샷한다.
    try {
      const [{ data: orders }, { data: creditTx }] = await Promise.all([
        supabaseAdmin.from('orders').select('*').eq('user_id', user.id),
        supabaseAdmin.from('credit_transactions').select('*').eq('user_id', user.id),
      ]);

      const preserved = [
        ...(orders ?? []).map((o: any) => ({
          deletion_log_id: logRow?.id ?? null,
          original_user_id: user.id,
          email: user.email,
          kind: 'order' as const,
          original_id: o.id,
          amount: o.amount ?? null,
          status: o.status ?? null,
          payment_method: o.payment_method ?? null,
          portone_payment_id: o.portone_payment_id ?? null,
          occurred_at: o.created_at ?? null,
          payload: o,
        })),
        ...(creditTx ?? []).map((t: any) => ({
          deletion_log_id: logRow?.id ?? null,
          original_user_id: user.id,
          email: user.email,
          kind: 'credit_transaction' as const,
          original_id: t.id,
          amount: t.amount ?? null,
          status: null,
          payment_method: null,
          portone_payment_id: null,
          occurred_at: t.created_at ?? null,
          payload: t,
        })),
      ];

      if (preserved.length > 0) {
        const { error: preserveErr } = await supabaseAdmin
          .from('preserved_transactions')
          .insert(preserved);
        if (preserveErr) {
          // 보존 실패는 탈퇴를 막지 않되, 결제 기록 유실 위험이므로 강하게 로깅
          console.error('[delete-account] preserve transactions failed:', preserveErr);
        }
      }
    } catch (e) {
      console.error('[delete-account] preserve transactions threw (non-blocking):', e);
    }

    // ── 6) Supabase auth user 삭제 — RLS CASCADE 로 연관 데이터(profiles, records, ...) 같이 삭제 ──
    const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (deleteErr) {
      console.error('[delete-account] auth.admin.deleteUser failed:', deleteErr);
      return NextResponse.json(
        { error: '탈퇴 처리 중 오류가 발생했어요. 잠시 후 다시 시도하거나 고객센터로 문의해주세요.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[delete-account] unexpected error:', error);
    return NextResponse.json(
      { error: '탈퇴 처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    );
  }
}
