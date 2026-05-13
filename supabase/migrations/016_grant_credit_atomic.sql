-- 원자적 크레딧 충전 RPC (결제 완료 → 크레딧 적립)
-- 동시 두 결제 시 read-modify-write race 로 충전이 손실되는 P1 사고 차단.
-- idempotency_key 권장: order_id 사용 (한 주문은 1회만 충전)
-- 반환: 'ok' | 'duplicate' | 'no_user' | 'invalid_type' | 'invalid_amount'

create or replace function grant_credit_atomic(
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
  v_new_balance int;
  v_existing_id uuid;
begin
  if p_credit_type not in ('sun', 'moon') then
    return 'invalid_type';
  end if;
  if p_amount <= 0 then
    return 'invalid_amount';
  end if;

  -- idempotency 사전 체크
  if p_idempotency_key is not null then
    select id into v_existing_id
      from credit_transactions
      where idempotency_key = p_idempotency_key
      limit 1;
    if v_existing_id is not null then
      return 'duplicate';
    end if;
  end if;

  -- 잔액 조회 + row lock (race 차단)
  if p_credit_type = 'sun' then
    select sun_balance into v_current_balance
      from user_credits
      where user_id = p_user_id
      for update;
  else
    select moon_balance into v_current_balance
      from user_credits
      where user_id = p_user_id
      for update;
  end if;

  -- 사용자 행이 없으면 새로 생성
  if v_current_balance is null then
    insert into user_credits (user_id, sun_balance, moon_balance, total_sun_consumed, total_moon_consumed)
    values (
      p_user_id,
      case when p_credit_type = 'sun' then p_amount else 0 end,
      case when p_credit_type = 'moon' then p_amount else 0 end,
      0, 0
    )
    on conflict (user_id) do update set
      sun_balance = user_credits.sun_balance + case when p_credit_type = 'sun' then p_amount else 0 end,
      moon_balance = user_credits.moon_balance + case when p_credit_type = 'moon' then p_amount else 0 end;

    if p_credit_type = 'sun' then
      select sun_balance into v_new_balance from user_credits where user_id = p_user_id;
    else
      select moon_balance into v_new_balance from user_credits where user_id = p_user_id;
    end if;
  else
    v_new_balance := v_current_balance + p_amount;
    if p_credit_type = 'sun' then
      update user_credits set sun_balance = v_new_balance where user_id = p_user_id;
    else
      update user_credits set moon_balance = v_new_balance where user_id = p_user_id;
    end if;
  end if;

  -- 거래 기록 (idempotency UNIQUE 위반 시 자동 ROLLBACK)
  insert into credit_transactions
    (user_id, credit_type, type, amount, balance_after, reason, idempotency_key)
  values
    (p_user_id, p_credit_type, 'purchase', p_amount, v_new_balance, p_reason, p_idempotency_key);

  return 'ok';
exception
  when unique_violation then
    return 'duplicate';
end;
$$;
