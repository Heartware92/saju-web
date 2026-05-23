-- 040_birth_profiles_state_nullable.sql
-- birth_profiles.job_state / love_state 를 nullable 로 변경 + DEFAULT 제거.
--
-- 사용 시나리오:
--   사용자가 가족·친구가 아닌 반려동물 등 비인간(또는 직업·연애 개념 자체가
--   부적절한) 프로필을 등록할 때, 미선택 = NULL 로 저장되도록 한다.
--   기존엔 DEFAULT '직장인'/'연애 중' 이 강제로 들어가 부적절한 정보가 채워졌음.
--
-- 기존 row 영향:
--   이미 채워진 '직장인'/'연애 중' 값은 그대로 유지 (NULL 변경 없음).
--   이번 ALTER 는 신규 INSERT 동작만 바꾼다.

alter table public.birth_profiles
  alter column job_state drop not null;

alter table public.birth_profiles
  alter column job_state drop default;

alter table public.birth_profiles
  alter column love_state drop not null;

alter table public.birth_profiles
  alter column love_state drop default;
