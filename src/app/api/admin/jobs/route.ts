/**
 * GET /api/admin/jobs?status=&type=&page=1
 * saju_records + tarot_records 의 진행 중·실패 잡 통합 뷰
 * - status: 'pending' | 'processing' | 'failed' | 'all-stuck' (기본)
 *   'all-stuck' = pending + processing + failed
 * - type: 'saju' | 'tarot' | '' (전체)
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../_auth';
import { cachedEmailMap } from '../_emailMap';
import { shouldForce } from '../_cache';

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 500;
type JobStatus = 'pending' | 'processing' | 'failed';

interface UnifiedJob {
  kind: 'saju' | 'tarot';
  id: string;
  user_id: string;
  userEmail?: string;
  status: string;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  detail: string;
  credit_used: number;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE))));
  const statusFilter = searchParams.get('status') ?? 'all-stuck';
  const typeFilter = searchParams.get('type') ?? '';

  const stuckStatuses: JobStatus[] = ['pending', 'processing', 'failed'];
  const targetStatuses: JobStatus[] = statusFilter === 'all-stuck'
    ? stuckStatuses
    : stuckStatuses.includes(statusFilter as JobStatus)
      ? [statusFilter as JobStatus]
      : stuckStatuses;

  const [sajuRes, tarotRes, sajuCountsRes, tarotCountsRes] = await Promise.all([
    typeFilter === 'tarot'
      ? Promise.resolve({ data: [], error: null })
      : supabaseAdmin
          .from('saju_records')
          .select('id, user_id, category, status, error_message, started_at, completed_at, created_at, credit_used')
          .in('status', targetStatuses)
          .order('created_at', { ascending: false })
          .limit(MAX_PAGE_SIZE),
    typeFilter === 'saju'
      ? Promise.resolve({ data: [], error: null })
      : supabaseAdmin
          .from('tarot_records')
          .select('id, user_id, spread_type, status, error_message, started_at, completed_at, created_at, credit_used')
          .in('status', targetStatuses)
          .order('created_at', { ascending: false })
          .limit(MAX_PAGE_SIZE),
    supabaseAdmin.from('saju_records').select('status'),
    supabaseAdmin.from('tarot_records').select('status'),
  ]);

  const emailMap = await cachedEmailMap({ force: shouldForce(request) });

  const sajuJobs: UnifiedJob[] = (sajuRes.data ?? []).map(r => ({
    kind: 'saju',
    id: r.id,
    user_id: r.user_id,
    userEmail: emailMap.get(r.user_id) ?? '',
    status: r.status,
    error_message: r.error_message,
    started_at: r.started_at,
    completed_at: r.completed_at,
    created_at: r.created_at,
    detail: r.category ?? '',
    credit_used: r.credit_used ?? 0,
  }));
  const tarotJobs: UnifiedJob[] = (tarotRes.data ?? []).map(r => ({
    kind: 'tarot',
    id: r.id,
    user_id: r.user_id,
    userEmail: emailMap.get(r.user_id) ?? '',
    status: r.status,
    error_message: r.error_message,
    started_at: r.started_at,
    completed_at: r.completed_at,
    created_at: r.created_at,
    detail: r.spread_type ?? '',
    credit_used: r.credit_used ?? 0,
  }));

  const merged = [...sajuJobs, ...tarotJobs]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const from = (page - 1) * pageSize;
  const slice = merged.slice(from, from + pageSize);

  const countByStatus = (rows: { status: string }[] | null, target: JobStatus) =>
    (rows ?? []).filter(r => r.status === target).length;

  const counts = {
    saju: {
      pending: countByStatus(sajuCountsRes.data, 'pending'),
      processing: countByStatus(sajuCountsRes.data, 'processing'),
      failed: countByStatus(sajuCountsRes.data, 'failed'),
    },
    tarot: {
      pending: countByStatus(tarotCountsRes.data, 'pending'),
      processing: countByStatus(tarotCountsRes.data, 'processing'),
      failed: countByStatus(tarotCountsRes.data, 'failed'),
    },
  };

  return NextResponse.json({
    jobs: slice,
    total: merged.length,
    page, pageSize,
    counts,
  });
}
