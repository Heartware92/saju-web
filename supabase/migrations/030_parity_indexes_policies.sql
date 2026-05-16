-- 옛 Mumbai 프로젝트에는 있고 새 Seoul 프로젝트에는 없는 인덱스/정책 보완

-- ── 성능 인덱스
create index if not exists idx_gapja_gan_ji on public.gapja using btree (gan, ji);
create index if not exists idx_locations_name on public.locations using btree (name);
create index if not exists idx_otp_codes_phone_code on public.otp_codes using btree (phone, code, verified);
create index if not exists idx_solar_terms_datetime on public.solar_terms using btree (datetime);
create index if not exists idx_solar_terms_year on public.solar_terms using btree (year);

-- ── RLS 정책 (legacy 호환)
-- service role은 자동 우회되지만 옛 프로젝트와 동일한 정책으로 맞춤
alter table public.user_saju_profiles enable row level security;
alter table public.saju_results enable row level security;

drop policy if exists "Service can insert transactions" on public.credit_transactions;
create policy "Service can insert transactions"
  on public.credit_transactions
  for insert
  with check (true);

drop policy if exists "Service can insert user credits" on public.user_credits;
create policy "Service can insert user credits"
  on public.user_credits
  for insert
  with check (true);

drop policy if exists "Users can view own profiles" on public.user_saju_profiles;
create policy "Users can view own profiles"
  on public.user_saju_profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can view own results" on public.saju_results;
create policy "Users can view own results"
  on public.saju_results
  for select
  using (profile_id in (select id from public.user_saju_profiles where user_id = auth.uid()));
