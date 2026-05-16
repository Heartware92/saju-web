-- 옛 프로젝트(Mumbai)에 있던 누락 테이블 schema 추가
-- 1) daylight_saving_periods: 사주 진태양시 보정용 일광절약 시간 (12 행 데이터)
-- 2) otp_codes: 휴대폰 OTP 인증 코드 보관

create table if not exists public.daylight_saving_periods (
  id integer primary key,
  year smallint not null,
  start_date varchar(5) not null,
  end_date varchar(5) not null
);
