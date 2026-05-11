-- ============================================================================
-- 010_user_agreements.sql
-- 약관 동의 정보를 public.user_agreements 로 분리.
--
-- 이유: auth.users.raw_user_meta_data 에 저장하면 OAuth 재로그인 시 provider
--       프로필로 user_metadata 가 부분 갱신/덮어쓰기 되면서 우리가 기록한
--       terms_agreed_at 등이 유실될 수 있음. 별도 테이블로 옮겨 안정화.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_agreements (
  user_id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_agreed_at    timestamptz NOT NULL,
  privacy_agreed_at  timestamptz NOT NULL,
  age14_agreed_at    timestamptz NOT NULL,
  marketing_agreed_at timestamptz NULL,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user reads own agreement" ON public.user_agreements;
CREATE POLICY "user reads own agreement"
  ON public.user_agreements
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user inserts own agreement" ON public.user_agreements;
CREATE POLICY "user inserts own agreement"
  ON public.user_agreements
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user updates own agreement" ON public.user_agreements;
CREATE POLICY "user updates own agreement"
  ON public.user_agreements
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 기존 가입자 백필 ─────────────────────────────────────────────
-- user_metadata 에 terms_agreed_at 이 있으면 그 값, 없으면 created_at 으로.
INSERT INTO public.user_agreements (
  user_id, terms_agreed_at, privacy_agreed_at, age14_agreed_at, marketing_agreed_at
)
SELECT
  id,
  COALESCE(NULLIF(raw_user_meta_data->>'terms_agreed_at', '')::timestamptz,   created_at),
  COALESCE(NULLIF(raw_user_meta_data->>'privacy_agreed_at', '')::timestamptz, created_at),
  COALESCE(NULLIF(raw_user_meta_data->>'age14_agreed_at', '')::timestamptz,   created_at),
  NULLIF(raw_user_meta_data->>'marketing_agreed_at', '')::timestamptz
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
