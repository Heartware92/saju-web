-- 옛 Mumbai 프로젝트 데이터 임포트 위해 누락 테이블 스키마 보완
-- 만세력/명리 계산용 참조 테이블 + 사주 결과/프로필 테이블

-- ── 천간 (10 행)
create table if not exists public.heavenly_stems (
  id serial primary key,
  name varchar(2) not null,
  hanja varchar(2) not null,
  element varchar(2) not null,
  yin_yang varchar(2) not null,
  order_num smallint not null
);

-- ── 지지 (12 행)
create table if not exists public.earthly_branches (
  id serial primary key,
  name varchar(2) not null,
  hanja varchar(2) not null,
  element varchar(2) not null,
  yin_yang varchar(2) not null,
  animal varchar(10) not null,
  hidden_stems varchar(20),
  order_num smallint not null
);

-- ── 60갑자
create table if not exists public.gapja (
  id serial primary key,
  number smallint not null,
  name varchar(4) not null,
  gan varchar(2) not null,
  ji varchar(2) not null,
  gan_element varchar(2) not null,
  ji_element varchar(2) not null
);

-- ── 시지 (시간 → 지지 매핑)
create table if not exists public.hour_branches (
  id serial primary key,
  hour smallint not null,
  branch varchar(2) not null
);

-- ── 월지 (월 → 지지 + 절기 매핑)
create table if not exists public.month_branches (
  id serial primary key,
  month_num smallint not null,
  branch varchar(2) not null,
  solar_term varchar(4) not null
);

-- ── 절기 데이터
create table if not exists public.solar_terms (
  id serial primary key,
  year smallint not null,
  month smallint not null,
  solar_term_name varchar(4) not null,
  datetime timestamp with time zone not null,
  saju_month smallint not null
);

-- ── 지역 (시간 보정용)
create table if not exists public.locations (
  id serial primary key,
  key varchar(50) not null,
  name varchar(50) not null,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  time_offset_minutes smallint not null,
  category varchar(20) not null
);

-- ── 오호전환 (年干 → 月干)
create table if not exists public.wuho_formula (
  id serial primary key,
  year_gan varchar(2) not null,
  month_num smallint not null,
  month_gan varchar(2) not null
);

-- ── 오서전환 (日干 → 時干)
create table if not exists public.wuseo_formula (
  id serial primary key,
  day_gan varchar(2) not null,
  hour_branch varchar(2) not null,
  hour_gan varchar(2) not null
);

-- ── 사용자 사주 프로필 (legacy)
create table if not exists public.user_saju_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid,
  name varchar(50) not null,
  birth_date date not null,
  birth_time time without time zone,
  birth_place varchar(50),
  gender varchar(2) not null,
  calendar_type varchar(4) default '양력' not null,
  is_leap_month boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- ── 사주 결과 (legacy)
create table if not exists public.saju_results (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid,
  year_gan varchar(2) not null,
  year_ji varchar(2) not null,
  month_gan varchar(2) not null,
  month_ji varchar(2) not null,
  day_gan varchar(2) not null,
  day_ji varchar(2) not null,
  hour_gan varchar(2),
  hour_ji varchar(2),
  meta jsonb,
  created_at timestamp with time zone default now()
);
