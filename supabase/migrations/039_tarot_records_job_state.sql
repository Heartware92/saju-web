-- 039_tarot_records_job_state.sql
-- 백그라운드 잡 시스템을 tarot_records 로 확장.
-- saju_records 037 과 동일한 패턴 — status·error·시간 컬럼 + Realtime publication.
-- 타로는 별도 테이블이라 useFortuneJob hook 이 table 파라미터로 분기 구독한다.

alter table tarot_records
  add column if not exists status text not null default 'done'
    check (status in ('pending', 'processing', 'done', 'failed'));

alter table tarot_records
  add column if not exists error_message text;

alter table tarot_records
  add column if not exists started_at timestamptz;

alter table tarot_records
  add column if not exists completed_at timestamptz;

-- 진행 중 잡 빠른 조회 (보관함 모래시계 표시용)
create index if not exists idx_tarot_records_user_status
  on tarot_records(user_id, status)
  where status in ('pending', 'processing', 'failed');

-- Realtime publication 에 추가 (status·interpretation 변경 push)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename = 'tarot_records'
  ) then
    alter publication supabase_realtime add table tarot_records;
  end if;
end $$;
