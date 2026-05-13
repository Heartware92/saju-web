-- PostgREST schema cache reload — 새 RPC 함수 인식 보장
-- 마이그레이션 적용 후에도 PostgREST 가 함수 정의를 캐시한 채라 호출 실패 가능.
-- NOTIFY 로 즉시 reload 트리거.

notify pgrst, 'reload schema';
