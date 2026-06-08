-- 052: 회원가입 전화번호 중복 차단 + 예외 허용 리스트
--
-- 배경: 회원가입(이메일 가입 / 소셜 첫 휴대폰 등록) 시 한 번호로 여러 계정을 만드는
--       어뷰징을 막는다. 기본은 차단(이미 가입된 번호면 "이미 가입한 전화번호입니다").
--       단, 운영자가 지정한 특정 번호는 예외로 중복 가입을 허용한다.
--       (디폴트 = 차단. 예외 리스트에 넣은 번호만 허용)
--
-- 안전: 순수 추가 테이블 + 기존 RPC NULL 처리 보강. 회원/인증 데이터는 건드리지 않는다.

-- 1) 예외 허용 리스트 (비어있으면 전부 차단 = 디폴트)
create table if not exists public.phone_signup_allowlist (
  phone      text primary key,
  note       text,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.phone_signup_allowlist enable row level security;

comment on table public.phone_signup_allowlist is
  '회원가입 전화번호 중복 차단의 예외 허용 번호. 여기 있는 번호만 중복 가입 허용(디폴트=차단). service_role 전용.';

-- 2) check_phone_taken — p_exclude_user_id 가 NULL(회원가입, 제외할 본인 계정 없음)인 경우 처리 보강
--    기존: `id <> NULL` 은 항상 NULL 평가라 회원가입 검사가 무력화됐음(항상 false). → NULL 가드 추가.
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
      and (p_exclude_user_id is null or id <> p_exclude_user_id);
  return v_count > 0;
end;
$$;

grant execute on function check_phone_taken(text, uuid) to service_role;
