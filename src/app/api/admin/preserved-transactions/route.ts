/**
 * GET /api/admin/preserved-transactions
 *   ?deletionLogId=...   (특정 탈퇴 이벤트의 보존 거래)
 *   ?email=...           (이메일 부분 일치)
 *   ?portoneId=...       (PG 거래번호 — 차지백 역추적)
 *   ?kind=order|credit_transaction
 *   &page=1&pageSize=100
 *
 * 탈퇴 회원 보존 거래 조회 — 어드민 전용. 분쟁/차지백 대응.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../_auth';
import { supabaseAdmin } from '@/services/supabaseAdmin';

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

export async function GET(request: NextRequest) {
  const actor = await requireAdmin(request);
  if (actor instanceof Response) return actor;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10)),
    );
    const deletionLogId = searchParams.get('deletionLogId')?.trim() || '';
    const email = searchParams.get('email')?.trim() || '';
    const portoneId = searchParams.get('portoneId')?.trim() || '';
    const kind = searchParams.get('kind')?.trim() || '';

    let query = supabaseAdmin
      .from('preserved_transactions')
      .select(
        'id, deletion_log_id, original_user_id, email, kind, original_id, amount, status, payment_method, portone_payment_id, occurred_at, preserved_at, purge_at, payload',
        { count: 'exact' },
      )
      .order('occurred_at', { ascending: false });

    if (deletionLogId) query = query.eq('deletion_log_id', deletionLogId);
    if (email) query = query.ilike('email', `%${email}%`);
    if (portoneId) query = query.eq('portone_payment_id', portoneId);
    if (kind === 'order' || kind === 'credit_transaction') query = query.eq('kind', kind);

    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize - 1;
    const { data, error, count } = await query.range(startIdx, endIdx);

    if (error) {
      console.error('[admin/preserved-transactions] query failed:', error);
      return NextResponse.json({ error: '데이터 조회에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({
      items: data ?? [],
      total: count ?? 0,
      page,
      pageSize,
    });
  } catch (error: any) {
    console.error('[admin/preserved-transactions] unexpected:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
