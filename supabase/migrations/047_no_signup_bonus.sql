-- 047: 회원가입 환영 보너스 폐지 (가입 시 크레딧 0개 지급)
--
-- 정책 변경: 신규 가입 시 달 크레딧을 일절 지급하지 않는다.
--  - 기존: handle_new_user() 가 user_credits.moon_balance 에 보너스(운영=1)를 넣고
--          credit_transactions 에 '회원가입 환영 보너스' 거래를 기록했음.
--  - 변경: user_credits 행은 잔액 0 으로만 생성(다운스트림 코드가 행 존재를 기대),
--          보너스 거래는 더 이상 기록하지 않음.
--
-- 안전: create or replace 라 멱등. 트리거(on_auth_user_created)는 그대로 유지.
--       기존 회원의 잔액/거래에는 영향 없음(이 함수는 신규 INSERT 시에만 실행).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 크레딧 레코드만 생성(잔액 0). 환영 보너스 없음.
  insert into public.user_credits (user_id, moon_balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  return new;
exception
  when others then
    -- 트리거 실패가 회원가입 자체를 막지 않도록 안전망
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;
