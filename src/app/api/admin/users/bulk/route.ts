/**
 * POST /api/admin/users/bulk
 * Body: { userIds: string[], action: 'credit' | 'note' | 'ban' | 'unban',
 *         delta?: number, reason?: string, note?: string }
 *
 * 다수 회원에 일괄 적용. 각 회원마다 동일 내부 로직을 직렬 호출.
 * 최대 200명 제한. 감사 로그 자동 기록.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../../_auth';
import { invalidateAll } from '../../_cache';
import { writeAudit, clientMeta } from '../../_audit';

const MAX_TARGETS = 200;

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  let body: {
    userIds?: string[];
    action?: 'credit' | 'note' | 'ban' | 'unban';
    delta?: number;
    reason?: string;
    note?: string;
  };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const userIds = Array.isArray(body.userIds) ? body.userIds.filter(Boolean) : [];
  if (userIds.length === 0) return NextResponse.json({ error: 'userIds 필요' }, { status: 400 });
  if (userIds.length > MAX_TARGETS) return NextResponse.json({ error: `최대 ${MAX_TARGETS}명` }, { status: 400 });

  const action = body.action;
  if (!action) return NextResponse.json({ error: 'action 필요' }, { status: 400 });

  const { ipAddress, userAgent } = clientMeta(request);
  const results: { userId: string; ok: boolean; error?: string }[] = [];

  for (const uid of userIds) {
    try {
      if (action === 'credit') {
        if (!body.delta || !body.reason?.trim()) {
          results.push({ userId: uid, ok: false, error: 'delta/reason 필요' });
          continue;
        }
        if (Math.abs(body.delta) > 10_000) {
          results.push({ userId: uid, ok: false, error: 'delta 절댓값 10,000 초과' });
          continue;
        }
        const { data: cur } = await supabaseAdmin.from('user_credits')
          .select('moon_balance').eq('user_id', uid).single();
        if (!cur) { results.push({ userId: uid, ok: false, error: '크레딧 없음' }); continue; }
        const before = cur.moon_balance as number;
        const after = before + body.delta;
        if (after < 0) { results.push({ userId: uid, ok: false, error: '잔액 부족' }); continue; }
        await supabaseAdmin.from('user_credits').update({ moon_balance: after }).eq('user_id', uid);
        await supabaseAdmin.from('credit_transactions').insert({
          user_id: uid, credit_type: 'moon', type: 'admin_adjust',
          amount: body.delta, balance_after: after, reason: body.reason,
        });
        const target = await supabaseAdmin.auth.admin.getUserById(uid);
        await writeAudit({
          actorUserId: undefined, actorEmail: auth.email,
          targetUserId: uid, targetEmail: target.data?.user?.email ?? null,
          action: 'credit_adjust', creditType: 'moon', amount: body.delta,
          before: { moon_balance: before }, after: { moon_balance: after },
          reason: `[벌크] ${body.reason}`, ipAddress, userAgent,
        });
      } else if (action === 'note') {
        const { data: ur } = await supabaseAdmin.auth.admin.getUserById(uid);
        if (!ur?.user) { results.push({ userId: uid, ok: false, error: '사용자 없음' }); continue; }
        const prev = (ur.user.user_metadata?.admin_note as string | undefined) ?? '';
        const newNote = (body.note ?? '').slice(0, 2000);
        await supabaseAdmin.auth.admin.updateUserById(uid, {
          user_metadata: { ...(ur.user.user_metadata ?? {}), admin_note: newNote, admin_note_at: new Date().toISOString() },
        });
        await writeAudit({
          actorUserId: undefined, actorEmail: auth.email,
          targetUserId: uid, targetEmail: ur.user.email ?? null,
          action: 'note_update',
          before: { note: prev }, after: { note: newNote },
          reason: `[벌크] ${newNote.slice(0, 100)}`, ipAddress, userAgent,
        });
      } else if (action === 'ban' || action === 'unban') {
        const { data: before } = await supabaseAdmin.auth.admin.getUserById(uid);
        const banDuration = action === 'ban' ? '8760h' : 'none';
        await supabaseAdmin.auth.admin.updateUserById(uid, { ban_duration: banDuration } as any);
        const { data: after } = await supabaseAdmin.auth.admin.getUserById(uid);
        await writeAudit({
          actorUserId: undefined, actorEmail: auth.email,
          targetUserId: uid, targetEmail: after?.user?.email ?? before?.user?.email ?? null,
          action,
          before: { bannedUntil: (before?.user as any)?.banned_until ?? null },
          after: { bannedUntil: (after?.user as any)?.banned_until ?? null },
          reason: body.reason ? `[벌크] ${body.reason}` : '[벌크]',
          ipAddress, userAgent,
        });
      } else {
        results.push({ userId: uid, ok: false, error: 'unknown action' });
        continue;
      }
      results.push({ userId: uid, ok: true });
    } catch (e: any) {
      results.push({ userId: uid, ok: false, error: e.message });
    }
  }

  await invalidateAll();

  const success = results.filter(r => r.ok).length;
  const failed = results.length - success;
  return NextResponse.json({ ok: true, total: results.length, success, failed, results });
}
