-- birth_profiles 에 연애 상태 컬럼 추가
-- 기존 row 는 NOT NULL DEFAULT '연애 중' 으로 자동 채워짐

alter table birth_profiles
  add column if not exists love_state text not null default '연애 중';
