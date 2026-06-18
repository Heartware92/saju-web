/**
 * 탈퇴 회원 보존 주문 로더 — 매출 집계에 탈퇴자 결제를 복원하기 위한 공용 유틸.
 *
 * 배경: orders.user_id 는 auth.users on delete CASCADE 라, 회원이 탈퇴하면 그 회원의
 *       orders 행이 물리 삭제된다. 그러면 "실제로 받은 돈"인데도 어드민 매출(stats·
 *       orders/summary)에서 빠진다. 탈퇴 직전 스냅샷한 preserved_transactions(kind='order')
 *       를 다시 읽어 매출 집계에 합산한다.
 *
 * 중복 합산 없음: 활성 회원은 orders 에, 탈퇴 회원은 preserved 에 — 한 회원이 양쪽에
 *       동시에 존재할 수 없으므로 단순 concat 으로 안전하다.
 *
 * 제외: 탈퇴 계정은 user_id→email 매핑(listUsers)이 더 이상 없으므로, PG 심사/내부
 *       제외 계정은 보존된 email 로 직접 거른다(_excluded 의 이메일 집합과 동일 기준).
 *
 * 한계(오디언스): 탈퇴 회원은 성별·연령 등 인구통계를 식별할 수 없다(birth_profiles 도 삭제).
 *       따라서 코호트(오디언스) 필터가 걸린 집계에는 합산하지 않는다 — 호출측에서 audience
 *       활성 시 이 함수를 건너뛴다.
 */
import { supabaseAdmin } from '@/services/supabaseAdmin';

const DEFAULT_EXCLUDED_EMAILS = ['toss@test.com', 'kpn@test.com', 'kakao@test.com', 'kg@test.com'];

function configuredExcludedEmails(): Set<string> {
  const env = (process.env.ADMIN_EXCLUDED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set<string>([...DEFAULT_EXCLUDED_EMAILS, ...env]);
}

/** orders 행과 동일 형태 — 호출측이 활성 orders 와 그대로 concat 할 수 있게 맞춘다. */
export interface PreservedOrder {
  user_id: string | null;
  status: string | null;
  amount: number | null;
  package_id: string | null;
  package_name: string | null;
  payment_method: string | null;
  created_at: string | null;
  completed_at: string | null;
}

/** 탈퇴 회원 보존 주문(kind='order') 전체 상태. 제외 이메일 제거. 실패 시 빈 배열로 degrade. */
export async function loadPreservedOrders(): Promise<PreservedOrder[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('preserved_transactions')
      .select('email, amount, status, payment_method, occurred_at, payload')
      .eq('kind', 'order');
    if (error) {
      console.error('[admin/_preservedRevenue] 조회 실패(무시):', error.message);
      return [];
    }
    const ex = configuredExcludedEmails();
    const out: PreservedOrder[] = [];
    for (const r of data ?? []) {
      if (r.email && ex.has(String(r.email).toLowerCase())) continue;
      const p = (r.payload ?? {}) as Record<string, unknown>;
      out.push({
        user_id: (p.user_id as string) ?? null,
        status: (r.status as string) ?? (p.status as string) ?? null,
        amount: (r.amount as number) ?? (p.amount as number) ?? null,
        package_id: (p.package_id as string) ?? null,
        package_name: (p.package_name as string) ?? null,
        payment_method: (r.payment_method as string) ?? (p.payment_method as string) ?? null,
        created_at: (p.created_at as string) ?? (r.occurred_at as string) ?? null,
        completed_at: (p.completed_at as string) ?? null,
      });
    }
    return out;
  } catch (e) {
    console.error('[admin/_preservedRevenue] 예외(무시):', e);
    return [];
  }
}
