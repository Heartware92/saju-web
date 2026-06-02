-- 046: 방문/유입/이탈 분석 이벤트 테이블 (자체 웹 애널리틱스)
--
-- 목적: 익명 세션 기반 페이지뷰 로그. 어드민 "유입·이탈 분석" 탭에서
--       1) 유입 출처(네이버/구글/직접/SNS) 2) 일별 방문자 수
--       3) 세션별 마지막 경로(=이탈 화면) / 퍼널 단계별 도달률을 집계한다.
--
-- 개인정보: IP·정밀 위치는 저장하지 않는다(익명 우선). session_id/visitor_id 는
--           클라이언트가 생성한 임의 식별자. user_id 는 로그인 시에만 연계(분석용).
--
-- 안전: 순수 추가 — 기존 테이블/데이터 변경 없음.
--       수집 엔드포인트(/api/analytics/collect)는 fail-open(이 테이블 쓰기 실패해도
--       사용자 응답은 항상 204) 이므로, 이 마이그레이션 적용 전 코드가 배포돼도
--       서비스는 깨지지 않는다(수집만 비활성).

create table if not exists public.analytics_events (
  id           bigint generated always as identity primary key,
  session_id   text        not null,                       -- 세션 식별자(sessionStorage)
  visitor_id   text,                                       -- 방문자 식별자(localStorage, 고유 방문자 카운트용)
  user_id      uuid,                                       -- 로그인 시에만(분석용, 비보안)
  event_type   text        not null default 'pageview',    -- 'pageview' | (추후 퍼널 단계명)
  path         text        not null,                       -- 페이지 경로
  referrer     text,                                       -- 세션 첫 진입 referrer (first-touch)
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  device       text,                                       -- 'mobile' | 'desktop' (UA 기반, 서버 판정)
  created_at   timestamptz not null default now()
);

-- 기간 집계(최근 N일)
create index if not exists idx_analytics_events_created
  on public.analytics_events (created_at desc);
-- 세션별 경로 시퀀스(이탈 화면 판정) / 세션 카운트
create index if not exists idx_analytics_events_session
  on public.analytics_events (session_id, created_at);
-- 이벤트 타입별 집계
create index if not exists idx_analytics_events_type_created
  on public.analytics_events (event_type, created_at desc);

-- service_role 전용. RLS 활성 + 정책 없음 = 익명/일반유저 직접 접근 차단
-- (앱은 supabaseAdmin = service_role 로만 접근).
alter table public.analytics_events enable row level security;

comment on table public.analytics_events is
  '웹 방문/유입/이탈 분석 이벤트 로그(익명, IP 미저장). 수집 fail-open. 집계는 어드민 analytics 탭.';
