-- 037_saju_records_job_state.sql
-- 백그라운드 잡 시스템: saju_records 에 비동기 처리 상태 추가
-- 정통사주(category='traditional')를 시작으로 점진 전환. 옛 row 는 status='done' 유지.

-- status: 잡 처리 상태
--   'pending'     : 잡 생성됨, AI 호출 시작 전
--   'processing'  : AI 호출 진행 중
--   'done'        : 정상 완료 (default, 옛 row 호환)
--   'failed'      : AI 호출 실패 또는 결과 저장 실패
alter table saju_records
  add column if not exists status text not null default 'done'
    check (status in ('pending', 'processing', 'done', 'failed'));

alter table saju_records
  add column if not exists error_message text;

alter table saju_records
  add column if not exists started_at timestamptz;

alter table saju_records
  add column if not exists completed_at timestamptz;

-- 진행 중 잡 빠른 조회 (보관함 모래시계 표시용)
create index if not exists idx_saju_records_user_status
  on saju_records(user_id, status)
  where status in ('pending', 'processing', 'failed');

-- Realtime publication 에 추가 (status·interpretation 변경 push)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename = 'saju_records'
  ) then
    alter publication supabase_realtime add table saju_records;
  end if;
end $$;
