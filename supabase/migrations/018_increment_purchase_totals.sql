-- 구매 누적 통계 atomic increment
-- total_*_purchased 컬럼은 통계용. atomic SQL increment 로 race 해결.

create or replace function increment_purchase_totals(
  p_user_id uuid,
  p_sun_amount int,
  p_moon_amount int
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update user_credits set
    total_sun_purchased = coalesce(total_sun_purchased, 0) + greatest(p_sun_amount, 0),
    total_moon_purchased = coalesce(total_moon_purchased, 0) + greatest(p_moon_amount, 0),
    updated_at = now()
  where user_id = p_user_id;
end;
$$;
