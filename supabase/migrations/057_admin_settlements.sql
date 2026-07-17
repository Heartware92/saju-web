-- 057: 어드민 회계 — PG 정산 실입금 기록
-- 목적: 정산 입금액을 저장해 수수료 역산·미수금 대사를 화면 재입력 없이 지속.
-- 접근: RLS 활성 + 정책 없음 → anon/authenticated 접근 불가, service_role(어드민 API)만 사용.

create table if not exists public.admin_settlements (
  id uuid primary key default gen_random_uuid(),
  pg text not null check (pg in ('tosspay', 'inicis')),
  deposited_on date not null,
  amount integer not null check (amount > 0),
  memo text,
  created_at timestamptz not null default now()
);

alter table public.admin_settlements enable row level security;

comment on table public.admin_settlements is '어드민 회계: PG 정산 실입금 기록(수수료 역산·미수금 대사용)';

create index if not exists idx_admin_settlements_pg_date on public.admin_settlements (pg, deposited_on desc);
