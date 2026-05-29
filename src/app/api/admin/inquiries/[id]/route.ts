/**
 * PATCH /api/admin/inquiries/[id]
 * Body: { status?: 'open'|'in_progress'|'resolved'|'closed', admin_reply?: string }
 * 답변 등록 + 상태 변경. admin_reply 변경 시 admin_replied_at 자동 갱신.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../../_auth';

type InquiryStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
const VALID_STATUSES: InquiryStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id 누락' }, { status: 400 });

  let body: { status?: InquiryStatus; admin_reply?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const patch: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    }
    patch.status = body.status;
  }

  if (body.admin_reply !== undefined) {
    const reply = body.admin_reply.trim();
    patch.admin_reply = reply || null;
    patch.admin_replied_at = reply ? new Date().toISOString() : null;
    if (reply && body.status === undefined) {
      patch.status = 'resolved';
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('inquiries')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, inquiry: data });
}
