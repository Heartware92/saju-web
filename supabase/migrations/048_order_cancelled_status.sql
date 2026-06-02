-- 048: orders.status 에 'cancelled'(취소) 추가
--
-- 배경: 결제창 진입 시 pending 주문을 먼저 만든다. 사용자가 결제창에서 취소하거나
--       뒤로가기/창닫기로 이탈하면 그 시도도 데이터로 남기되, '대기(pending)'가 아니라
--       '취소(cancelled)'로 표기하는 게 정확하다.
--        - 명시적 취소(USER_CANCEL) → cancelled
--        - 이탈로 방치된 오래된 pending → 스윕으로 cancelled 자동 전환
--
-- 안전: status 관련 CHECK 제약을 이름 무관하게 찾아 제거 후 재생성(멱등).
--       기존 데이터(현재 4개 값만 존재)에는 영향 없음.

do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'orders'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.orders drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'completed', 'failed', 'refunded', 'cancelled'));
