-- 049: 어드민 분석 제외 계정 (UI 토글)
--
-- 배경: 슈퍼/테스트/내부 계정을 분석 집계에서 빼는 걸 그동안 ADMIN_EXCLUDED_EMAILS env 로만
--       관리했다. 운영자가 어드민 회원목록에서 직접 계정을 체크해 제외/해제할 수 있게 DB 토글을 둔다.
--       env 제외와 이 테이블은 합집합으로 적용된다(_excluded.ts).
--
-- 안전: 순수 추가 테이블. service_role 전용(RLS on, 정책 없음). 회원 데이터는 안 건드린다.

create table if not exists public.admin_excluded_users (
  user_id    uuid primary key,
  reason     text,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.admin_excluded_users enable row level security;

comment on table public.admin_excluded_users is
  '어드민 분석 집계에서 제외할 계정(UI 토글). _excluded.ts 가 env 제외와 합집합으로 적용.';
