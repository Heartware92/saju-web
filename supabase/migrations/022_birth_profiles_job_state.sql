-- birth_profiles 에 직업 상태 컬럼 추가
-- 기존 row 는 NOT NULL DEFAULT '직장인' 으로 자동 채워짐

alter table birth_profiles
  add column if not exists job_state text not null default '직장인';
