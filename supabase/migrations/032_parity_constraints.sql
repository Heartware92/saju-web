-- 옛 Mumbai 프로젝트와 1:1 일치를 위한 누락 제약 보완
-- 028에서 legacy 참조 테이블 만들 때 UNIQUE/FK 일부 빠뜨림

-- ── UNIQUE 제약 (참조 데이터 무결성)
alter table public.heavenly_stems add constraint heavenly_stems_name_key unique (name);
alter table public.heavenly_stems add constraint heavenly_stems_order_num_key unique (order_num);

alter table public.earthly_branches add constraint earthly_branches_name_key unique (name);
alter table public.earthly_branches add constraint earthly_branches_order_num_key unique (order_num);

alter table public.gapja add constraint gapja_name_key unique (name);
alter table public.gapja add constraint gapja_number_key unique (number);

alter table public.locations add constraint locations_key_key unique (key);

alter table public.month_branches add constraint month_branches_month_num_key unique (month_num);

alter table public.solar_terms add constraint solar_terms_year_month_key unique (year, month);

alter table public.wuho_formula add constraint wuho_formula_year_gan_month_num_key unique (year_gan, month_num);

alter table public.wuseo_formula add constraint wuseo_formula_day_gan_hour_branch_key unique (day_gan, hour_branch);

-- ── FK 제약 (legacy saju 결과/프로필 카스케이드)
alter table public.user_saju_profiles
  add constraint user_saju_profiles_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.saju_results
  add constraint saju_results_profile_id_fkey
  foreign key (profile_id) references public.user_saju_profiles(id) on delete cascade;
