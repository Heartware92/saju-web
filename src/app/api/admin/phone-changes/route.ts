/**
 * GET /api/admin/phone-changes?page=1&search=
 * 휴대폰 번호 변경 이력 + 부정행위 모니터링 시그널
 * - 같은 user 가 24시간 내 2회 이상 변경
 * - 같은 new_phone 이 여러 user 에서 사용 (어뷰징 의심)
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../_auth';

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 1000;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE))));
  const search = searchParams.get('search')?.trim() ?? '';
  const from = (page - 1) * pageSize;

  const { data, count, error } = await supabaseAdmin
    .from('phone_change_history')
    .select('*', { count: 'exact' })
    .order('changed_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = [...new Set((data ?? []).map(r => r.user_id).filter(Boolean) as string[])];
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map((authUsers?.users ?? []).map(u => [u.id, u.email ?? '']));

  let result = (data ?? []).map(r => ({
    ...r,
    userEmail: emailMap.get(r.user_id) ?? '',
  }));

  if (search) {
    const s = search.toLowerCase();
    result = result.filter(r =>
      r.userEmail.toLowerCase().includes(s) ||
      (r.new_phone ?? '').includes(s) ||
      (r.old_phone ?? '').includes(s)
    );
  }

  // ── 어뷰징 시그널 ──
  // 전체 이력에서 새 번호 중복 사용 회원
  const { data: allChanges } = await supabaseAdmin
    .from('phone_change_history')
    .select('user_id, new_phone, changed_at');

  const phoneToUsers = new Map<string, Set<string>>();
  const userToCount24h = new Map<string, number>();
  const now = Date.now();
  for (const c of allChanges ?? []) {
    if (!phoneToUsers.has(c.new_phone)) phoneToUsers.set(c.new_phone, new Set());
    phoneToUsers.get(c.new_phone)!.add(c.user_id);
    if (now - new Date(c.changed_at).getTime() <= 86_400_000) {
      userToCount24h.set(c.user_id, (userToCount24h.get(c.user_id) ?? 0) + 1);
    }
  }
  const suspiciousPhones = [...phoneToUsers.entries()]
    .filter(([, users]) => users.size >= 2)
    .map(([phone, users]) => ({ phone, userCount: users.size }));
  const rapidChangeUsers = [...userToCount24h.entries()]
    .filter(([, n]) => n >= 2)
    .map(([userId, n]) => ({ userId, email: emailMap.get(userId) ?? '', count24h: n }));

  return NextResponse.json({
    changes: result,
    total: count ?? result.length,
    page, pageSize,
    signals: {
      suspiciousPhones,
      rapidChangeUsers,
    },
  });
}
