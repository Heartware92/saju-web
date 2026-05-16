-- 결제 환불을 단일 트랜잭션으로 처리하는 RPC
-- 기존: user_credits update + orders update 두 단계 분리 → 중간 실패 시 silent 불일치
-- 신규: balance/consumed/purchased counters + order status + credit_transactions 모두 atomic
--
-- 반환: 'ok' | 'duplicate' | 'no_order' | 'no_user' | 'invalid_status'

create or replace function refund_order_atomic(
  p_order_id uuid,
  p_user_id uuid,
  p_sun_granted int,
  p_moon_granted int,
  p_package_name text,
  p_idempotency_key text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_credit record;
  v_existing_id uuid;
  v_new_sun int;
  v_new_moon int;
begin
  -- idempotency check
  if p_idempotency_key is null or p_idempotency_key = '' then
    return 'invalid_amount';
  end if;
  select id into v_existing_id
    from credit_transactions
    where idempotency_key = p_idempotency_key
    limit 1;
  if v_existing_id is not null then
    return 'duplicate';
  end if;

  -- order lock + 상태 확인
  select * into v_order
    from orders
    where id = p_order_id and user_id = p_user_id
    for update;
  if v_order is null then
    return 'no_order';
  end if;
  if v_order.status = 'refunded' then
    return 'duplicate';
  end if;
  if v_order.status not in ('completed', 'paid') then
    return 'invalid_status';
  end if;

  -- user_credits lock + 차감
  select * into v_credit
    from user_credits
    where user_id = p_user_id
    for update;
  if v_credit is null then
    return 'no_user';
  end if;

  v_new_sun  := greatest(0, v_credit.sun_balance  - p_sun_granted);
  v_new_moon := greatest(0, v_credit.moon_balance - p_moon_granted);

  update user_credits
    set sun_balance         = v_new_sun,
        moon_balance        = v_new_moon,
        total_sun_purchased = greatest(0, total_sun_purchased - p_sun_granted),
        total_moon_purchased= greatest(0, total_moon_purchased - p_moon_granted),
        updated_at          = now()
    where user_id = p_user_id;

  -- order 상태 업데이트
  update orders
    set status = 'refunded',
        updated_at = now()
    where id = p_order_id;

  -- 거래 기록 — sun/moon 각각 row
  if p_sun_granted > 0 then
    insert into credit_transactions
      (user_id, credit_type, type, amount, balance_after, reason, order_id, idempotency_key)
    values
      (p_user_id, 'sun', 'refund', -p_sun_granted, v_new_sun, '[환불] ' || p_package_name, p_order_id, p_idempotency_key || ':sun');
  end if;
  if p_moon_granted > 0 then
    insert into credit_transactions
      (user_id, credit_type, type, amount, balance_after, reason, order_id, idempotency_key)
    values
      (p_user_id, 'moon', 'refund', -p_moon_granted, v_new_moon, '[환불] ' || p_package_name, p_order_id, p_idempotency_key || ':moon');
  end if;

  -- idempotency marker (sun/moon 둘 다 없는 케이스 대비)
  if p_sun_granted = 0 and p_moon_granted = 0 then
    insert into credit_transactions
      (user_id, credit_type, type, amount, balance_after, reason, order_id, idempotency_key)
    values
      (p_user_id, 'moon', 'refund', 0, v_new_moon, '[환불-크레딧없음] ' || p_package_name, p_order_id, p_idempotency_key);
  end if;

  return 'ok';
exception
  when unique_violation then
    return 'duplicate';
end;
$$;

