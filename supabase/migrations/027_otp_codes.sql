create table if not exists public.otp_codes (
  id uuid default gen_random_uuid() primary key,
  phone text not null,
  code text not null,
  verified boolean default false,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now()
);
