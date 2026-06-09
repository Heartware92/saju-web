-- 053_enable_rls_security_advisor.sql
-- Supabase Security Advisor 경고 해소: rls_disabled_in_public (Critical)
--
-- 배경: anon 키(브라우저 공개 키)만으로 외부에서 아래 11개 테이블을 읽을 수 있었음.
--   - otp_codes: 휴대폰 인증코드/전화번호 노출 (민감) — 인증 우회 위험
--   - 만세력 상수 10개: 공개 상수지만 anon 쓰기 가능 → 계산 데이터 변조 위험
-- 검증(2026-06-10):
--   - otp_codes 접근은 전부 supabaseAdmin(service_role) → RLS 우회하므로 켜도 인증흐름 무영향
--   - 만세력 상수 테이블은 앱 코드에서 .from() 참조 0건 (런타임은 src/lib/data TS 사용)
--   => 정책 없이 RLS만 켜서 전면 잠금해도 앱 동작에 영향 없음. service_role은 RLS를 우회.
--
-- 나머지 회원/결제/크레딧/기록 테이블은 이미 RLS 적용·정상 작동(anon 0행) 확인됨.

-- 1) 민감: 휴대폰 OTP — 서버(service_role)만 접근. anon/authenticated 전면 차단.
alter table public.otp_codes enable row level security;

-- 2) 만세력 reference 상수 테이블 — 전면 잠금(앱은 로컬 TS 데이터 사용).
alter table public.gapja                   enable row level security;
alter table public.heavenly_stems          enable row level security;
alter table public.earthly_branches        enable row level security;
alter table public.hour_branches           enable row level security;
alter table public.month_branches          enable row level security;
alter table public.solar_terms             enable row level security;
alter table public.locations               enable row level security;
alter table public.wuho_formula            enable row level security;
alter table public.wuseo_formula           enable row level security;
alter table public.daylight_saving_periods enable row level security;
