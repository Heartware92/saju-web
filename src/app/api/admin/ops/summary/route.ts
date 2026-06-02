/**
 * GET /api/admin/ops/summary
 * 운영 탭: 최근 관리자 크레딧 조정 + 차단된 회원 + 관리자 메모가 있는 회원
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../../_auth';
import { cached, shouldForce } from '../../_cache';
import { excludedUserIds, excludeUsers, filterExcludedUsers } from '../../_excluded';

const CACHE_KEY = 'admin:ops:summary:v1';
const TTL_SECONDS = 30;

async function computeOps() {
  // 슈퍼/테스트 계정 제외
  const ex = await excludedUserIds();

  const [adjustRes, authList] = await Promise.all([
    excludeUsers(supabaseAdmin.from('credit_transactions')
      .select('user_id, credit_type, amount, balance_after, reason, created_at')
      .eq('type', 'admin_adjust')
      .order('created_at', { ascending: false })
      .limit(100), ex),
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const users = filterExcludedUsers(authList.data?.users ?? [], ex);
  const emailById = new Map(users.map(u => [u.id, u.email ?? '']));

  const adjustments = (adjustRes.data ?? []).map(a => ({
    ...a,
    userEmail: emailById.get(a.user_id) ?? a.user_id,
  }));

  const now = new Date();
  const banned = users
    .filter(u => {
      const bu = (u as any).banned_until as string | null | undefined;
      if (!bu) return false;
      return new Date(bu) > now;
    })
    .map(u => ({
      id: u.id,
      email: u.email ?? '',
      bannedUntil: (u as any).banned_until as string,
      createdAt: u.created_at,
    }));

  const noted = users
    .filter(u => {
      const note = u.user_metadata?.admin_note as string | undefined;
      return !!note && note.trim().length > 0;
    })
    .map(u => ({
      id: u.id,
      email: u.email ?? '',
      note: (u.user_metadata?.admin_note as string) ?? '',
      notedAt: (u.user_metadata?.admin_note_at as string) ?? null,
    }))
    .sort((a, b) => (b.notedAt ?? '').localeCompare(a.notedAt ?? ''));

  return {
    adjustments,
    banned,
    noted,
    kpi: {
      adjustmentCount: adjustments.length,
      bannedCount: banned.length,
      notedCount: noted.length,
    },
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const data = await cached(CACHE_KEY, computeOps, {
    ttl: TTL_SECONDS,
    force: shouldForce(request),
  });

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
  });
}
