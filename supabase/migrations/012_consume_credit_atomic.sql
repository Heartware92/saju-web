-- 원자적 크레딧 차감 RPC
-- balance update + transaction insert + idempotency check 가 단일 트랜잭션 내에서 실행
-- 반환: 'ok' | 'insufficient' | 'duplicate' | 'no_user' | 'invalid_type' | 'invalid_amount'

create or replace function consume_credit_atomic(
  p_user_id uuid,
  p_credit_type text,
  p_amount int,
  p_reason text,
  p_idempotency_key text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_balance int;
  v_current_consumed int;
  v_new_balance int;
  v_new_consumed int;
  v_existing_id uuid;
begin
  if p_credit_type not in ('sun', 'moon') then
    return 'invalid_type';
  end if;
  if p_amount <= 0 then
    return 'invalid_amount';
  end if;

  if p_idempotency_key is not null then
    select id into v_existing_id
      from credit_transactions
      where idempotency_key = p_idempotency_key
      limit 1;
    if v_existing_id is not null then
      return 'duplicate';
    end if;
  end if;

  if p_credit_type = 'sun' then
    select sun_balance, total_sun_consumed
      into v_current_balance, v_current_consumed
      from user_credits
      where user_id = p_user_id
      for update;
  else
    select moon_balance, total_moon_consumed
      into v_current_balance, v_current_consumed
      from user_credits
      where user_id = p_user_id
      for update;
  end if;

  if v_current_balance is null then
    return 'no_user';
  end if;

  if v_current_balance < p_amount then
    return 'insufficient';
  end if;

  v_new_balance := v_current_balance - p_amount;
  v_new_consumed := v_current_consumed + p_amount;

  if p_credit_type = 'sun' then
    update user_credits
      set sun_balance = v_new_balance,
          total_sun_consumed = v_new_consumed
      where user_id = p_user_id;
  else
    update user_credits
      set moon_balance = v_new_balance,
          total_moon_consumed = v_new_consumed
      where user_id = p_user_id;
  end if;

  insert into credit_transactions
    (user_id, credit_type, type, amount, balance_after, reason, idempotency_key)
  values
    (p_user_id, p_credit_type, 'consume', -p_amount, v_new_balance, p_reason, p_idempotency_key);

  return 'ok';
exception
  when unique_violation then
    return 'duplicate';
end;
$$;
