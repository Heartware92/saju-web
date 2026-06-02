/**
 * GET /api/admin/records?page=1&type=saju|tarot&category=
 * 서비스 이용 기록 (사주 분석 + 타로 분석)
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../_auth';
import { cachedEmailMap } from '../_emailMap';
import { shouldForce } from '../_cache';
import { excludedUserIds, excludeUsers } from '../_excluded';
import { audienceUserIds, includeAudience } from '../_audience';

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 10_000;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE))));
  const type = searchParams.get('type') ?? 'saju';
  const category = searchParams.get('category') ?? '';
  const from = (page - 1) * pageSize;

  // 슈퍼/테스트 계정 제외 + (선택) 오디언스 코호트로 한정
  const ex = await excludedUserIds();
  const audience = await audienceUserIds(request);

  let data: any[] = [];
  let count = 0;

  if (type === 'tarot') {
    let q = includeAudience(excludeUsers(supabaseAdmin
      .from('tarot_records')
      .select('id, user_id, spread_type, credit_type, credit_used, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1), ex), audience);
    if (category) q = q.eq('spread_type', category);
    const res = await q;
    data = res.data ?? [];
    count = res.count ?? 0;
  } else {
    let q = includeAudience(excludeUsers(supabaseAdmin
      .from('saju_records')
      .select('id, user_id, category, gender, calendar_type, credit_type, credit_used, profile_name, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1), ex), audience);
    if (category) q = q.eq('category', category);
    const res = await q;
    data = res.data ?? [];
    count = res.count ?? 0;
  }

  // 이메일 매핑 (30초 공유 캐시)
  const emailMap = await cachedEmailMap({ force: shouldForce(request) });

  // 카테고리별 집계 (페이지 무관)
  const [sajuCatRes, tarotCatRes] = await Promise.all([
    includeAudience(excludeUsers(supabaseAdmin.from('saju_records').select('category'), ex), audience),
    includeAudience(excludeUsers(supabaseAdmin.from('tarot_records').select('spread_type'), ex), audience),
  ]);

  const sajuCategories = countBy(sajuCatRes.data ?? [], 'category');
  const tarotCategories = countBy(tarotCatRes.data ?? [], 'spread_type');

  return NextResponse.json({
    records: data.map(r => ({ ...r, userEmail: emailMap.get(r.user_id) ?? r.user_id })),
    total: count,
    page,
    pageSize,
    categorySummary: type === 'tarot' ? tarotCategories : sajuCategories,
  });
}

function countBy(arr: any[], key: string): Record<string, number> {
  return arr.reduce((acc, item) => {
    const val = item[key] ?? 'unknown';
    acc[val] = (acc[val] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
