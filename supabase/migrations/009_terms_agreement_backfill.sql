-- ============================================================================
-- 009_terms_agreement_backfill.sql
-- 약관 동의 시각을 user_metadata 에 기록하는 체계 도입.
-- 기존 가입자는 created_at 을 동의 시각으로 백필 (재로그인 시 동의 페이지 띄우지 않기 위함).
-- 이후 신규 가입은 클라이언트 단(signUpWithEmail / recordAgreement) 에서 직접 기록한다.
-- ============================================================================

UPDATE auth.users
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object(
       'terms_agreed_at',   COALESCE(raw_user_meta_data->>'terms_agreed_at',   created_at::text),
       'privacy_agreed_at', COALESCE(raw_user_meta_data->>'privacy_agreed_at', created_at::text),
       'age14_agreed_at',   COALESCE(raw_user_meta_data->>'age14_agreed_at',   created_at::text)
     )
WHERE raw_user_meta_data->>'terms_agreed_at' IS NULL;

-- 마케팅 동의는 선택 항목이라 백필하지 않음 (기존 사용자가 마케팅 동의했는지 모르므로).
-- 필요 시 별도 정책으로 마케팅 동의 페이지를 노출시킨다.
