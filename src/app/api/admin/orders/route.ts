/**
 * GET /api/admin/orders?page=1&status=&search=&limit=20
 * 주문/결제 목록
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../_auth';
import { cachedEmailMap } from '../_emailMap';
import { shouldForce } from '../_cache';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 10_000;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE))));
  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search')?.trim() ?? '';
  const from = (page - 1) * pageSize;

  let query = supabaseAdmin
    .from('orders')
    .select('*, user_id', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (status) query = query.eq('status', status);

  const { data: orders, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 사용자 이메일 조회 (30초 공유 캐시)
  const emailMap = await cachedEmailMap({ force: shouldForce(request) });

  // search 필터 (email 기반)
  let result = (orders ?? []).map(o => ({
    ...o,
    userEmail: emailMap.get(o.user_id) ?? o.user_id,
  }));

  if (search) {
    result = result.filter(o =>
      o.userEmail.toLowerCase().includes(search.toLowerCase()) ||
      (o.id ?? '').toLowerCase().includes(search.toLowerCase())
    );
  }

  return NextResponse.json({ orders: result, total: count ?? result.length, page, pageSize });
}
