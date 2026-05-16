-- 옛 Mumbai 프로젝트 비교 결과 handle_new_user() 함수에 SET search_path 가 누락되어
-- 새 Seoul 프로젝트에서 auth.users INSERT 시 트리거가 user_credits 테이블을 찾지 못해
-- "Database error saving new user" 오류 발생 → 옛것과 동일하게 search_path 설정

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 크레딧 레코드 생성 (달 1개 환영 보너스)
  insert into public.user_credits (user_id, moon_balance)
  values (new.id, 1)
  on conflict (user_id) do nothing;

  -- 거래 내역 기록
  insert into public.credit_transactions (user_id, credit_type, type, amount, balance_after, reason)
  values (new.id, 'moon', 'bonus', 1, 1, '회원가입 환영 보너스');

  return new;
exception
  when others then
    -- 트리거 실패가 회원가입 자체를 막지 않도록 안전망
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

-- 트리거 재생성 (auth.users 에 부착)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
