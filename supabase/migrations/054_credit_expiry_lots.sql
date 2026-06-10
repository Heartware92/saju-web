-- 054: 크레딧 유효기간(1년) 만료 소멸 — 배치(lot) 기반 회계
--
-- 배경: 이용약관 제14조와 결제 페이지 UI 는 "유료 크레딧 결제일로부터 1년,
--       각 결제 건마다 별도 유효기간, 유효기간 경과 시 미사용분 자동 소멸"을 명시하나,
--       실제로는 user_credits.moon_balance 단일 정수만 존재하고 만료 로직·로그·크론이
--       전혀 없었다(약관-동작 불일치). 본 마이그레이션이 이를 일치시킨다.
--
-- 설계: 검증된 결제 RPC(grant/consume/refund_credit_atomic)는 손대지 않는다.
--       대신 credit_transactions INSERT 트리거가 모든 적립/차감 경로에서 lot 을
--       자동 유지한다. 일 1회 크론(/api/cron/expire-credits)이 expire_credit_lots() 호출.
--
-- 불변식: user_credits.moon_balance == SUM(active/exhausted lot 의 amount_remaining)
--         (모든 적립=lot 생성, 모든 차감=FIFO lot 차감, 만료=lot 소멸+잔액 차감으로 유지)
--
-- 안전: 순수 추가(테이블·트리거·함수 신설). 기존 잔액/거래는 백필 1회로 lot 화하며
--       잔액 자체는 변경하지 않는다. 멱등(IF NOT EXISTS, 백필은 NOT EXISTS 가드).

-- ── 1. credit_lots: 배치별 크레딧 회계 ──────────────────────────────
create table if not exists credit_lots (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  credit_type text not null check (credit_type in ('sun', 'moon')),
  source_type text not null,            -- 'purchase'|'bonus'|'admin_adjust'|'refund'|'signup_bonus'|'migration'
  source_txn_id uuid,                   -- credit_transactions.id (적립 거래 연결, 백필은 null)
  amount_granted int not null check (amount_granted > 0),
  amount_remaining int not null check (amount_remaining >= 0),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'exhausted', 'expired')),
  created_at timestamptz not null default now()
);

-- 차감 FIFO(만료 임박 우선)·소멸 스윕 조회 인덱스
create index if not exists idx_credit_lots_fifo
  on credit_lots (user_id, credit_type, expires_at, granted_at)
  where amount_remaining > 0;
create index if not exists idx_credit_lots_sweep
  on credit_lots (expires_at)
  where status = 'active' and amount_remaining > 0;

-- RLS: 본인 lot 만 조회 가능. 쓰기는 SECURITY DEFINER 함수/service_role 만(정책 없음 = 차단).
alter table credit_lots enable row level security;
drop policy if exists "credit_lots own read" on credit_lots;
create policy "credit_lots own read" on credit_lots
  for select using (auth.uid() = user_id);

-- ── 2. credit_transactions.type 에 'expire' 추가 ────────────────────
alter table public.credit_transactions drop constraint if exists credit_transactions_type_check;
alter table public.credit_transactions
  add constraint credit_transactions_type_check
  check (type in ('purchase', 'consume', 'bonus', 'refund', 'admin_adjust', 'signup_bonus', 'expire'));

-- ── 3. 트리거: 모든 거래에서 lot 자동 유지 ──────────────────────────
-- 적립(amount>0) → 새 lot(결제일+1년). 차감(amount<0) → FIFO lot 차감.
-- 'expire' 거래는 expire_credit_lots() 가 lot 을 직접 소멸시킨 뒤 기록하므로 무시.
create or replace function maintain_credit_lots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining int;
  v_draw int;
  r record;
begin
  if new.type = 'expire' then
    return new;
  end if;

  if new.amount > 0 then
    insert into credit_lots
      (user_id, credit_type, source_type, source_txn_id,
       amount_granted, amount_remaining, granted_at, expires_at, status)
    values
      (new.user_id, new.credit_type, new.type, new.id,
       new.amount, new.amount, new.created_at, new.created_at + interval '1 year', 'active');

  elsif new.amount < 0 then
    v_remaining := -new.amount;  -- 차감할 양(양수)
    for r in
      select id, amount_remaining
        from credit_lots
       where user_id = new.user_id
         and credit_type = new.credit_type
         and amount_remaining > 0
       order by expires_at asc, granted_at asc
       for update
    loop
      exit when v_remaining <= 0;
      v_draw := least(r.amount_remaining, v_remaining);
      update credit_lots
         set amount_remaining = amount_remaining - v_draw,
             status = case when amount_remaining - v_draw = 0 then 'exhausted' else status end
       where id = r.id;
      v_remaining := v_remaining - v_draw;
    end loop;
    -- v_remaining > 0(lot 부족, 이론상 불변식상 없음)이면 클램프(무시)
  end if;

  return new;
end;
$$;

drop trigger if exists trg_maintain_credit_lots on credit_transactions;
create trigger trg_maintain_credit_lots
  after insert on credit_transactions
  for each row execute function maintain_credit_lots();

-- ── 4. 스윕: 만료 lot 소멸 + 잔액 차감 + 로그 ───────────────────────
-- 반환: (소멸 lot 수, 소멸 크레딧 합계)
create or replace function expire_credit_lots()
returns table(expired_lots int, expired_amount int)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_bal int;
  v_count int := 0;
  v_total int := 0;
begin
  for r in
    select id, user_id, credit_type, amount_remaining
      from credit_lots
     where status = 'active'
       and amount_remaining > 0
       and expires_at <= now()
     for update
  loop
    -- lot 소멸
    update credit_lots set amount_remaining = 0, status = 'expired' where id = r.id;

    -- 잔액 차감(음수 방어) + 새 잔액
    if r.credit_type = 'sun' then
      update user_credits set sun_balance = greatest(0, sun_balance - r.amount_remaining)
       where user_id = r.user_id returning sun_balance into v_bal;
    else
      update user_credits set moon_balance = greatest(0, moon_balance - r.amount_remaining)
       where user_id = r.user_id returning moon_balance into v_bal;
    end if;

    -- 소멸 로그(type='expire' → 트리거가 무시)
    insert into credit_transactions
      (user_id, credit_type, type, amount, balance_after, reason)
    values
      (r.user_id, r.credit_type, 'expire', -r.amount_remaining, coalesce(v_bal, 0), '유효기간 만료 소멸');

    v_count := v_count + 1;
    v_total := v_total + r.amount_remaining;
  end loop;

  return query select v_count, v_total;
end;
$$;

revoke all on function expire_credit_lots() from public, anon, authenticated;
grant execute on function expire_credit_lots() to service_role;

-- ── 5. 백필: 기존 유통 잔액 = 배포일(now)+1년 단일 lot ──────────────
-- 결정: 기존 잔액은 소급 만료하지 않고 본 마이그레이션 적용 시점부터 1년 유예.
-- 멱등: 이미 lot 이 있는(user_id, credit_type) 은 건너뜀.
insert into credit_lots
  (user_id, credit_type, source_type, amount_granted, amount_remaining, granted_at, expires_at, status)
select uc.user_id, 'moon', 'migration', uc.moon_balance, uc.moon_balance,
       now(), now() + interval '1 year', 'active'
  from user_credits uc
 where uc.moon_balance > 0
   and not exists (
     select 1 from credit_lots cl
      where cl.user_id = uc.user_id and cl.credit_type = 'moon'
   );

insert into credit_lots
  (user_id, credit_type, source_type, amount_granted, amount_remaining, granted_at, expires_at, status)
select uc.user_id, 'sun', 'migration', uc.sun_balance, uc.sun_balance,
       now(), now() + interval '1 year', 'active'
  from user_credits uc
 where uc.sun_balance > 0
   and not exists (
     select 1 from credit_lots cl
      where cl.user_id = uc.user_id and cl.credit_type = 'sun'
   );
