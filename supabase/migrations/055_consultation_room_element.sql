-- 055_consultation_room_element.sql
-- 상담소를 "오행 5방(房)" 구조로 전환한다.
--   · 프로필 1명당 목·화·토·금·수 5개의 고정 대화방을 가진다.
--   · 각 방의 conversation_id 는 결정적 ID `${profileId}::${elementKey}` (elementKey: wood|fire|earth|metal|water).
--   · 본인 물상(일간 오행)의 방만 디폴트로 열리고 나머지는 잠금(달 크레딧 해제 — 추후).
--
-- 본 마이그레이션은 "추가형(비파괴)" 이다.
--   · element 컬럼만 추가하며 기존 행/데이터는 손대지 않는다.
--   · 코드 배포는 이 컬럼 없이도 동작한다(element 는 conversation_id 접미사로 도출 가능).
--     → 배포와 마이그레이션 적용 순서에 의존성이 없다.
--   · 기존(레거시) 자유대화 행은 element = NULL 로 남아 어드민에서 그대로 조회된다.
--
-- 채우기(backfill)는 톤앤매너 구현 시 conversation_id 접미사에서 일괄 추출해 진행 예정.

alter table consultation_records
  add column if not exists element text;

comment on column consultation_records.element is
  '오행 방 구분: wood|fire|earth|metal|water. NULL = 레거시 자유대화(5방 전환 이전).';
