-- user_credits 와 credit_transactions 의 INSERT/UPDATE는
-- 무조건 security definer RPC(consume_credit_atomic / refund_credit_atomic /
-- grant_credit_atomic / increment_purchase_totals)를 통해서만 가능.
--
-- 클라이언트가 직접 supabase.from('user_credits').update(...) 호출 시
-- RLS 거부됨. 이걸 명시적으로 차단해 silent fail 방지.
--
-- 만약 새 코드 어디선가 직접 update 시도하고 있다면 콘솔에 명확한 에러 노출.

-- service_role 은 RLS 자동 우회 → verify/route.ts 의 supabaseAdmin upsert 등은 영향 없음
-- authenticated 사용자가 직접 update/insert 시도하면 거부됨 (보안상 정상)

-- 다만 차감 silent fail 사고 차단 위해 RLS 정책 명시.
-- 향후 가시성을 위한 주석.

-- credit_transactions 의 SELECT 정책은 그대로 유지 (본인 거래만 조회)
-- 추가 변경 없음 — 현재 정책이 의도적으로 read-only.

-- 단, 트랜잭션 가시성 강화를 위해 created_at 인덱스만 확인.
-- (이미 idx_credit_transactions_created_at 존재)

select 1;
