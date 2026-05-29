/**
 * 관리자 감사 로그 유틸 — /api/admin/* 의 상태 변경 액션에서 호출.
 * 실패해도 본 액션은 성공 처리(로깅은 best-effort). 단 에러는 console에 남김.
 */
import { supabaseAdmin } from '@/services/supabaseAdmin';

export type AuditAction = 'credit_adjust' | 'note_update' | 'ban' | 'unban' | 'payment_gateway_switch';

export interface AuditEntry {
  actorUserId?: string;
  actorEmail: string;
  targetUserId?: string | null;
  targetEmail?: string | null;
  action: AuditAction;
  creditType?: 'moon';
  amount?: number;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('admin_audit_logs').insert({
      actor_user_id: entry.actorUserId ?? null,
      actor_email: entry.actorEmail,
      target_user_id: entry.targetUserId ?? null,
      target_email: entry.targetEmail ?? null,
      action: entry.action,
      credit_type: entry.creditType ?? null,
      amount: entry.amount ?? null,
      before_value: entry.before ?? null,
      after_value: entry.after ?? null,
      reason: entry.reason ?? null,
      ip_address: entry.ipAddress ?? null,
      user_agent: entry.userAgent ?? null,
    });
    if (error) {
      // 감사 로그가 실패해도 API 응답은 성공 처리. 단 로그는 남김.
      console.error('[writeAudit] insert failed:', error.message, entry);
    }
  } catch (e) {
    console.error('[writeAudit] unexpected:', e);
  }
}

/** Request 에서 클라이언트 IP·UA 추출 */
export function clientMeta(request: Request): { ipAddress: string | null; userAgent: string | null } {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const realIp = request.headers.get('x-real-ip') ?? '';
  const ipAddress = (forwarded.split(',')[0] || realIp || '').trim() || null;
  const userAgent = request.headers.get('user-agent');
  return { ipAddress, userAgent };
}
