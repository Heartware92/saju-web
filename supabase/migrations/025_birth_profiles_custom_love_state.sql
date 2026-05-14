-- birth_profiles 에 연애 직접 입력 컬럼 추가
-- 칩 선택 시 NULL, 직접 입력 시 사용자 텍스트 (최대 30자 권장)

alter table birth_profiles
  add column if not exists custom_love_state text;
