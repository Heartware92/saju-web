-- 038_user_credits_realtime.sql
-- user_credits 를 Realtime publication 에 추가.
--
-- 목적: 새 백그라운드 잡 시스템(/api/fortune/jobs/*)이 RPC 로 직접 차감하면
-- 클라이언트의 useCreditStore.moonBalance 가 stale 해진다. STALE_MS=30초
-- 캐시 + auth state change 트리거에만 의존하면 사용자가 잠시 옛 잔액을
-- 본 채로 다른 풀이를 시도해 클라이언트 사전 체크가 잘못 통과/차단되는
-- 사고 가능.
--
-- Realtime push 로 어디서 차감/충전/환불되든(서버 RPC, 결제 webhook, 환불 등)
-- 클라이언트가 즉시 새 balance 받음. RLS 가 본인 row 만 SELECT 허용하므로
-- (001 initial_schema 의 "Users can view own credits") 다른 사용자 변경은
-- 자동으로 차단됨.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename = 'user_credits'
  ) then
    alter publication supabase_realtime add table user_credits;
  end if;
end $$;
