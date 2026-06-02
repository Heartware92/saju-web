/**
 * PATCH /api/admin/inquiries/[id]
 * Body: { status?: 'open'|'in_progress'|'resolved'|'closed', admin_reply?: string }
 * 답변 등록 + 상태 변경. admin_reply 변경 시 admin_replied_at 자동 갱신.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../../_auth';
import { sendInquiryAnsweredAlimtalk, normalizePhone } from '@/services/alimtalk';

type InquiryStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
const VALID_STATUSES: InquiryStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

const NOTIFY_EVENT = 'inquiry_answered';
const CATEGORY_LABEL: Record<string, string> = {
  payment: '환불',
  bug: '오류·버그',
  account: '계정·로그인',
  feedback: '제안·피드백',
  other: '기타',
};

/**
 * 답변완료 알림톡 발송 — 멱등·비차단.
 * 답변 저장이 성공한 뒤에만 호출. 알림 실패는 답변 저장을 되돌리지 않는다.
 */
async function notifyInquiryAnswered(inquiryId: string, inquiry: any) {
  try {
    // 멱등성 — 이미 성공 발송된 건이면 스킵 (알림톡 중복 과금 방지)
    const { data: already } = await supabaseAdmin
      .from('notification_log')
      .select('id')
      .eq('inquiry_id', inquiryId)
      .eq('channel', 'alimtalk')
      .eq('event', NOTIFY_EVENT)
      .eq('status', 'sent')
      .maybeSingle();
    if (already) return { status: 'skipped' as const, error: 'already_sent' };

    // 수신 전화 — 문의 작성 시 연락처 우선, 없으면 회원 가입 전화
    let phone: string | null = inquiry?.contact_phone ?? null;
    if (!normalizePhone(phone) && inquiry?.user_id) {
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(inquiry.user_id);
        phone =
          (u?.user?.user_metadata?.phone as string | undefined) ??
          (u?.user?.phone as string | undefined) ??
          null;
      } catch {
        /* 회원 조회 실패 — phone 없는 채로 진행 (skipped 처리됨) */
      }
    }

    const variables: Record<string, string> = {
      '#{카테고리}': CATEGORY_LABEL[inquiry?.category] ?? '문의',
      '#{접수일}': inquiry?.created_at ? String(inquiry.created_at).slice(0, 10) : '',
    };

    const result = await sendInquiryAnsweredAlimtalk(phone, variables);

    // 발송 결과 로깅 (성공/실패/스킵 전부 — 감사·재시도 판단용)
    await supabaseAdmin.from('notification_log').insert({
      inquiry_id: inquiryId,
      user_id: inquiry?.user_id ?? null,
      channel: 'alimtalk',
      event: NOTIFY_EVENT,
      recipient: result.recipient,
      status: result.status,
      provider: 'solapi',
      provider_response: (result.providerResponse ?? null) as any,
      error: result.error ?? null,
    });

    return result;
  } catch (e: any) {
    console.error('[inquiries/notify] failed (non-blocking):', e);
    return { status: 'skipped' as const, error: 'notify_threw' };
  }
}

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

  // 답변이 새로 등록된 경우 → 고객에게 답변완료 알림톡 발송 (멱등·비차단)
  let notification: { status: string; error?: string } | undefined;
  if (body.admin_reply !== undefined && patch.admin_reply) {
    const r = await notifyInquiryAnswered(id, data);
    notification = { status: r.status, error: (r as any).error };
  }

  return NextResponse.json({ ok: true, inquiry: data, notification });
}
