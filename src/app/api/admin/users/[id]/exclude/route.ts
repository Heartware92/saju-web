/**
 * POST /api/admin/users/[id]/exclude
 * Body: { excluded: boolean, reason?: string }
 *
 * 계정을 어드민 분석 집계에서 제외(체크)/해제(언체크) 토글.
 *  - excluded=true  → admin_excluded_users 에 upsert
 *  - excluded=false → 해당 행 삭제
 * 효과: _excluded.excludedUserIds() 가 env ∪ 이 테이블을 합집합으로 적용하므로
 *       매출·이용·크레딧·유입·코호트 등 모든 분석에서 즉시 빠진다(회원 목록엔 계속 표시).
 *
 * 토글 직후 제외목록/번들 캐시를 무효화해 바로 반영되게 한다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../../../_auth';
import { invalidate } from '../../../_cache';
import { EXCLUDED_IDS_CACHE_KEY } from '../../../_excluded';
import { ADMIN_BUNDLE_CACHE_KEY } from '../../../_userAggregates';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { id: userId } = await params;
  if (!userId || !UUID_RE.test(userId)) {
    return NextResponse.json({ error: '유효한 user id 필요' }, { status: 400 });
  }

  let body: { excluded?: boolean; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const excluded = body.excluded === true;
  const reason = (body.reason ?? '').trim() || null;

  if (excluded) {
    const { error } = await supabaseAdmin
      .from('admin_excluded_users')
      .upsert({ user_id: userId, reason, created_by: 'admin' }, { onConflict: 'user_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabaseAdmin
      .from('admin_excluded_users')
      .delete()
      .eq('user_id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 제외목록·회원번들 캐시 무효화 → 모든 분석/회원목록에 즉시 반영
  await invalidate(EXCLUDED_IDS_CACHE_KEY);
  await invalidate(ADMIN_BUNDLE_CACHE_KEY);

  return NextResponse.json({ ok: true, userId, excluded });
}
