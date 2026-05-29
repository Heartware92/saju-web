/**
 * POST /api/admin/users/[id]/adjust-credit
 * Body: { delta: number, reason: string }
 *   delta: +로 지급, -로 차감 (양수·음수 모두 허용)
 *   reason: 필수 사유
 * 효과: user_credits.moon_balance 갱신 + credit_transactions insert (type='admin_adjust') + admin_audit_logs 기록
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../../../_auth';
import { invalidateAll } from '../../../_cache';
import { writeAudit, clientMeta } from '../../../_audit';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { id: userId } = await params;
  if (!userId) return NextResponse.json({ error: 'id 누락' }, { status: 400 });

  let body: { delta?: number; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const delta = Number(body.delta ?? 0);
  const reason = (body.reason ?? '').trim();

  if (!Number.isFinite(delta) || delta === 0) {
    return NextResponse.json({ error: 'delta는 0이 아닌 정수' }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: '사유 필수' }, { status: 400 });
  }
  if (Math.abs(delta) > 10_000) {
    return NextResponse.json({ error: 'delta 절댓값은 10,000 이하' }, { status: 400 });
  }

  const { data: current, error: cErr } = await supabaseAdmin
    .from('user_credits')
    .select('moon_balance, total_moon_purchased, total_moon_consumed')
    .eq('user_id', userId)
    .single();
  if (cErr || !current) {
    return NextResponse.json({ error: '크레딧 레코드 없음' }, { status: 404 });
  }

  const currentBalance = current.moon_balance as number;
  const newBalance = currentBalance + delta;
  if (newBalance < 0) {
    return NextResponse.json({
      error: `잔액 부족: 현재 ${currentBalance}, 차감 ${delta} → 결과 ${newBalance}`,
    }, { status: 400 });
  }

  const { error: uErr } = await supabaseAdmin
    .from('user_credits')
    .update({ moon_balance: newBalance })
    .eq('user_id', userId);
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  const { error: tErr } = await supabaseAdmin.from('credit_transactions').insert({
    user_id: userId,
    credit_type: 'moon',
    type: 'admin_adjust',
    amount: delta,
    balance_after: newBalance,
    reason,
  });
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  // ── 감사 로그 (best-effort) ──
  const target = await supabaseAdmin.auth.admin.getUserById(userId);
  const { ipAddress, userAgent } = clientMeta(request);
  await writeAudit({
    actorUserId: undefined,
    actorEmail: auth.email,
    targetUserId: userId,
    targetEmail: target.data?.user?.email ?? null,
    action: 'credit_adjust',
    creditType: 'moon',
    amount: delta,
    before: { moon_balance: currentBalance },
    after: { moon_balance: newBalance },
    reason,
    ipAddress,
    userAgent,
  });

  await invalidateAll();

  return NextResponse.json({
    ok: true,
    userId,
    delta,
    newBalance,
    reason,
  });
}
