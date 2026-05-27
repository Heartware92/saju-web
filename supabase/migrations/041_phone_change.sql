-- 041_phone_change.sql
-- 휴대폰 번호 변경 기능 — 월 1회 무료, 이후 5 moon 크레딧 차감
--
-- 정책
--   - 매월 1회 무료 변경 (KST "YYYY-MM" 비교, 새 달 진입 시 자동 리셋)
--   - 무료 횟수 소진 후엔 5 moon 차감
--   - 모든 변경은 phone_change_history 에 기록 (감사 추적용)
--
-- 멱등성
--   - 클라이언트가 보낸 idempotency_key 가 credit_transactions 에 이미 있으면
--     'duplicate' 반환 → 중복 차감·이중 변경 방지

-- 1) user_credits 에 월별 카운터 추가
alter table public.user_credits
  add column if not exists phone_change_free_count int not null default 1,
  add column if not exists last_phone_change_month text;

comment on column public.user_credits.phone_change_free_count
  is '이번 달 남은 무료 휴대폰 변경 횟수 (월 단위 리셋)';
comment on column public.user_credits.last_phone_change_month
  is 'KST 기준 마지막 변경 월 (YYYY-MM). NULL = 한 번도 변경 없음';

-- 2) 변경 이력 테이블
create table if not exists public.phone_change_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  old_phone text,
  new_phone text not null,
  credit_charged int not null default 0,
  changed_at timestamptz not null default now()
);

create index if not exists idx_phone_change_history_user
  on public.phone_change_history (user_id, changed_at desc);

alter table public.phone_change_history enable row level security;

drop policy if exists "own_phone_history_select" on public.phone_change_history;
create policy "own_phone_history_select"
  on public.phone_change_history for select
  using (auth.uid() = user_id);

-- 2026-10-30 Supabase 정책 변경 대비: 새 테이블은 명시적 GRANT 필요
grant select on table public.phone_change_history to authenticated;

-- 3) 새 번호 중복 체크 RPC
--    auth.users.raw_user_meta_data ->> 'phone' 으로 검색
--    (회원가입 시 user_metadata.phone 에 저장하므로)
create or replace function check_phone_taken(
  p_phone text,
  p_exclude_user_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count
    from auth.users
    where raw_user_meta_data ->> 'phone' = p_phone
      and id <> p_exclude_user_id;
  return v_count > 0;
end;
$$;

grant execute on function check_phone_taken(text, uuid) to service_role;

-- 4) 원자적 휴대폰 변경 RPC
--    반환: 'ok' | 'duplicate' | 'insufficient' | 'no_user' | 'invalid_input'
create or replace function change_phone_atomic(
  p_user_id uuid,
  p_old_phone text,
  p_new_phone text,
  p_idempotency_key text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_month text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');
  v_last_month text;
  v_free_count int;
  v_balance int;
  v_consumed int;
  v_new_balance int;
  v_credit_charged int := 0;
  v_existing_id uuid;
begin
  if p_idempotency_key is null or length(p_idempotency_key) = 0 then
    return 'invalid_input';
  end if;
  if p_new_phone is null or length(p_new_phone) = 0 then
    return 'invalid_input';
  end if;

  -- 멱등성 1차 체크: 같은 키로 차감 기록이 있으면 즉시 duplicate
  select id into v_existing_id
    from credit_transactions
    where idempotency_key = p_idempotency_key
    limit 1;
  if v_existing_id is not null then
    return 'duplicate';
  end if;

  -- 사용자 크레딧/카운터 로우 잠금
  select last_phone_change_month, phone_change_free_count,
         moon_balance, total_moon_consumed
    into v_last_month, v_free_count, v_balance, v_consumed
    from user_credits
    where user_id = p_user_id
    for update;

  if v_balance is null then
    return 'no_user';
  end if;

  -- 새 달이면 무료 카운트 리셋 (cron 불필요)
  if v_last_month is null or v_last_month <> v_current_month then
    v_free_count := 1;
  end if;

  if v_free_count <= 0 then
    -- 무료 소진 — 5 moon 차감
    if v_balance < 5 then
      return 'insufficient';
    end if;
    v_new_balance := v_balance - 5;
    v_credit_charged := 5;

    update user_credits
      set moon_balance = v_new_balance,
          total_moon_consumed = v_consumed + 5,
          last_phone_change_month = v_current_month,
          phone_change_free_count = 0
      where user_id = p_user_id;

    insert into credit_transactions
      (user_id, credit_type, type, amount, balance_after, reason, idempotency_key)
    values
      (p_user_id, 'moon', 'consume', -5, v_new_balance, '휴대폰 번호 변경', p_idempotency_key);
  else
    -- 무료 사용 — 카운트 차감만
    update user_credits
      set last_phone_change_month = v_current_month,
          phone_change_free_count = v_free_count - 1
      where user_id = p_user_id;
  end if;

  -- 이력 기록
  insert into phone_change_history (user_id, old_phone, new_phone, credit_charged)
    values (p_user_id, p_old_phone, p_new_phone, v_credit_charged);

  return 'ok';
exception
  when unique_violation then
    return 'duplicate';
end;
$$;

grant execute on function change_phone_atomic(uuid, text, text, text) to service_role;
