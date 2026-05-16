-- 026에서 daylight_saving_periods 의 id를 integer로만 선언해 시퀀스가 없음
-- 옛 프로젝트 데이터 임포트가 setval('daylight_saving_periods_id_seq') 호출하므로 시퀀스 부착

create sequence if not exists public.daylight_saving_periods_id_seq
  as integer
  owned by public.daylight_saving_periods.id;

alter table public.daylight_saving_periods
  alter column id set default nextval('public.daylight_saving_periods_id_seq');
