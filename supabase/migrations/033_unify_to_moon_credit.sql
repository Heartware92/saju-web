-- 2026-05-16 단일 달 크레딧 통합 마이그레이션
-- 해(sun) 시스템 제거 → 모든 크레딧을 달(moon) 단일 단위로 통합
--
-- 환산 규칙: 옛 해 1개 = ₩2,000 = 새 시스템에서 달 10개
-- (1달 = ₩200, 본격 풀이 1번 = 10달 = ₩2,000)

-- ── 1. 기존 사용자 잔액 환산 ───────────────────────────────────
-- sun_balance × 10을 moon_balance 로 이전, sun_balance 0으로
update public.user_credits
set
  moon_balance = moon_balance + (sun_balance * 10),
  sun_balance = 0,
  total_moon_purchased = total_moon_purchased + (total_sun_purchased * 10),
  total_sun_purchased = 0,
  total_moon_consumed = total_moon_consumed + (total_sun_consumed * 10),
  total_sun_consumed = 0,
  updated_at = now()
where sun_balance > 0
   or total_sun_purchased > 0
   or total_sun_consumed > 0;

-- ── 2. 회원가입 보너스 조정 ─────────────────────────────────────
-- 옛: 달 1개 (= ₩670 가치, 옛 시스템 기준)
-- 신: 달 5개 (= ₩1,000 가치) — 가벼운 풀이 1번 또는 타로 5번 체험 가능
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_credits (user_id, moon_balance)
  values (new.id, 5)
  on conflict (user_id) do nothing;

  insert into public.credit_transactions (user_id, credit_type, type, amount, balance_after, reason)
  values (new.id, 'moon', 'bonus', 5, 5, '회원가입 환영 보너스');

  return new;
exception
  when others then
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

-- ── 3. credit_transactions credit_type CHECK 그대로 유지 ────────
-- 옛 거래 기록은 credit_type='sun' 으로 남아 있어도 무방 (히스토리).
-- 신규 거래는 항상 'moon' 으로 기록.

-- ── 4. consume_credit_atomic / grant_credit_atomic / refund_credit_atomic
-- 기존 함수는 그대로 두되, 호출 측에서 항상 p_credit_type='moon' 으로 호출.
-- (코드 측 useCreditStore 가 'moon' 만 사용하도록 변경)
