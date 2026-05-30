/**
 * GET /api/admin/consultations?page=1&search=
 * 상담소 대화 기록 목록 (어드민 전용)
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../_auth';
import { cachedEmailMap } from '../_emailMap';
import { shouldForce } from '../_cache';

const PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 10_000;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('pageSize') ?? String(PAGE_SIZE))));
  const search = searchParams.get('search') ?? '';
  const from = (page - 1) * pageSize;

  let q = supabaseAdmin
    .from('consultation_records')
    .select('id, user_id, profile_id, profile_name, conversation_id, title, message_count, last_message_at, created_at, updated_at', { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (search) {
    q = q.or(`title.ilike.%${search}%,profile_name.ilike.%${search}%`);
  }

  const { data, count, error } = await q;
  if (error) {
    console.error('[admin/consultations] query error:', error);
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }

  const records = data ?? [];
  const emailMap = await cachedEmailMap({ force: shouldForce(request) });

  const totalRes = await supabaseAdmin
    .from('consultation_records')
    .select('id', { count: 'exact', head: true });

  return NextResponse.json({
    records: records.map(r => ({
      ...r,
      userEmail: emailMap.get(r.user_id) ?? r.user_id,
    })),
    total: count ?? 0,
    grandTotal: totalRes.count ?? 0,
    page,
    pageSize,
  });
}
