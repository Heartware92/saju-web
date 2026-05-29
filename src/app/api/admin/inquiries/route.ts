/**
 * GET /api/admin/inquiries?page=1&status=&category=&search=
 * 문의 목록 + 카테고리/상태 필터 + 검색
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../_auth';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 1000;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE))));
  const status = searchParams.get('status') ?? '';
  const category = searchParams.get('category') ?? '';
  const search = searchParams.get('search')?.trim() ?? '';
  const from = (page - 1) * pageSize;

  let query = supabaseAdmin
    .from('inquiries')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = [...new Set((data ?? []).map(r => r.user_id).filter(Boolean) as string[])];
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map((authUsers?.users ?? []).map(u => [u.id, u.email ?? '']));

  let result = (data ?? []).map(r => ({
    ...r,
    userEmail: r.user_id ? (emailMap.get(r.user_id) ?? '') : '',
  }));

  if (search) {
    const s = search.toLowerCase();
    result = result.filter(r =>
      r.userEmail.toLowerCase().includes(s) ||
      (r.content ?? '').toLowerCase().includes(s) ||
      (r.contact_phone ?? '').toLowerCase().includes(s) ||
      (r.contact_email ?? '').toLowerCase().includes(s)
    );
  }

  // 상태별 카운트 (필터 적용 전 전체 기준)
  const { data: statusCounts } = await supabaseAdmin
    .from('inquiries')
    .select('status');
  const counts = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
  for (const r of statusCounts ?? []) {
    if (r.status in counts) counts[r.status as keyof typeof counts]++;
  }

  return NextResponse.json({
    inquiries: result,
    total: count ?? result.length,
    page, pageSize,
    statusCounts: counts,
  });
}
