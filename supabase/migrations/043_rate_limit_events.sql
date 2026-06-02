-- 043: 범용 레이트리밋 이벤트 테이블 (어뷰징/비용 방어)
--
-- 목적: 무인증·무차감 LLM 엔드포인트(/api/ai, /api/gunghap/classify-relation 등)와
--       OTP 무차별 대입(/api/sms/verify) 같은 곳에서 (key, created_at) 기준으로
--       최근 시간윈도우 내 요청 수를 세어 과도한 호출을 차단한다.
--
-- 안전: 기존 테이블/데이터 변경 없음 — 순수 추가.
--       앱은 fail-open(이 테이블 조회 실패 시 요청 통과)으로 동작하므로
--       이 마이그레이션 적용 전에 코드가 배포돼도 서비스는 깨지지 않는다(보호만 비활성).

create table if not exists public.rate_limit_events (
  id         bigint generated always as identity primary key,
  key        text        not null,
  created_at timestamptz not null default now()
);

-- 키별 시간윈도우 카운트/정리 최적화
create index if not exists idx_rate_limit_events_key_created
  on public.rate_limit_events (key, created_at desc);

-- service_role 전용. RLS 활성 + 정책 없음 = 익명/일반유저 직접 접근 차단
-- (앱은 supabaseAdmin = service_role 로 접근하므로 RLS 우회).
alter table public.rate_limit_events enable row level security;

comment on table public.rate_limit_events is
  '범용 레이트리밋 이벤트 로그 (어뷰징 방어). 앱이 윈도우별 카운트, fail-open. 오래된 행은 앱이 키 단위로 opportunistic 삭제.';
