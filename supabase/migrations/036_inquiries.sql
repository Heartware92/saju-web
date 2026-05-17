-- 문의하기 — 햄버거 메뉴 → 문의하기
-- 5 카테고리: payment / bug / account / feedback / other
-- MVP: 본문 + 휴대폰 + 이메일 + 카테고리. 관리자 답변 컬럼은 향후 어드민 확장 시 사용.

create table if not exists public.inquiries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  category     text not null check (category in ('payment','bug','account','feedback','other')),
  content      text not null check (length(content) between 1 and 2000),
  contact_phone text,
  contact_email text,
  status       text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  admin_reply  text,
  admin_replied_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists inquiries_user_id_idx on public.inquiries(user_id);
create index if not exists inquiries_status_idx on public.inquiries(status);
create index if not exists inquiries_created_at_idx on public.inquiries(created_at desc);

alter table public.inquiries enable row level security;

-- 본인 문의만 조회
create policy "Users can read own inquiries"
  on public.inquiries for select
  using (auth.uid() = user_id);

-- 로그인 사용자만 본인 명의로 insert
create policy "Users can create own inquiries"
  on public.inquiries for insert
  with check (auth.uid() = user_id);

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_inquiries_updated_at on public.inquiries;
create trigger trg_inquiries_updated_at
  before update on public.inquiries
  for each row execute function public.set_updated_at();
