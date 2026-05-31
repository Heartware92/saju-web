-- 탈퇴 회원 거래 기록 보존 — 분쟁/차지백 대응 + 전자상거래법 보존 의무
--
-- 배경:
--   회원 탈퇴 시 auth.users CASCADE 로 orders·credit_transactions 가 함께 삭제된다.
--   그러나 전자상거래법상 "대금 결제 및 재화 공급에 관한 기록"은 탈퇴와 무관하게
--   5년 보존 의무가 있고, 카드사 차지백/분쟁 대응에도 결제 증빙이 필요하다.
--   따라서 탈퇴 직전 결제·거래 원장을 이 테이블로 스냅샷해 둔다.
--
-- 개인정보 처리:
--   분쟁 대응 실효성을 위해 email 까지 보존(운영자 선택). purge_at(5년 후) 도래분은
--   별도 파기 잡으로 정리한다. 그 외 개인 식별정보는 담지 않는다.

CREATE TABLE IF NOT EXISTS preserved_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deletion_log_id   uuid REFERENCES account_deletion_logs(id) ON DELETE SET NULL, -- 탈퇴 이벤트 연결 (어드민 조회용)
  original_user_id  uuid NOT NULL,                  -- 탈퇴 시점 user.id (FK X — 사용자 삭제됨)
  email             text,                           -- 탈퇴 시점 이메일 (분쟁 대응용, purge_at 후 파기)
  kind              text NOT NULL CHECK (kind IN ('order', 'credit_transaction')),
  original_id       uuid NOT NULL,                  -- 원본 행 id (orders.id 또는 credit_transactions.id)

  -- 분쟁/차지백에 자주 쓰는 핵심 컬럼 추출 (조회 편의용) ---------------------
  amount            int,                            -- 결제/거래 금액
  status            text,                           -- orders.status
  payment_method    text,                           -- 결제 수단
  portone_payment_id text,                          -- PG 거래번호 (차지백 증빙 핵심)
  occurred_at       timestamptz,                    -- 원본 created_at

  -- 원본 전체 스냅샷 (스키마 변경에도 안전하도록 통째 보존) ------------------
  payload           jsonb NOT NULL,

  preserved_at      timestamptz NOT NULL DEFAULT now(),
  purge_at          timestamptz NOT NULL DEFAULT (now() + interval '5 years')
);

-- 탈퇴 이벤트별 거래 조회 (어드민: 특정 탈퇴 회원의 결제 내역)
CREATE INDEX IF NOT EXISTS idx_preserved_transactions_deletion_log
  ON preserved_transactions (deletion_log_id);

-- 사용자/이메일 추적
CREATE INDEX IF NOT EXISTS idx_preserved_transactions_user
  ON preserved_transactions (original_user_id);
CREATE INDEX IF NOT EXISTS idx_preserved_transactions_email
  ON preserved_transactions (email);

-- PG 거래번호 역추적 (차지백 알림 시 거래 특정)
CREATE INDEX IF NOT EXISTS idx_preserved_transactions_portone
  ON preserved_transactions (portone_payment_id);

-- 파기 대상 스캔 (5년 경과분 정리 잡)
CREATE INDEX IF NOT EXISTS idx_preserved_transactions_purge_at
  ON preserved_transactions (purge_at);

-- RLS — 어드민(service_role) 전용. 일반 사용자 접근 불가
ALTER TABLE preserved_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access" ON preserved_transactions;
CREATE POLICY "service role full access"
  ON preserved_transactions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE preserved_transactions IS '탈퇴 회원 거래 보존 — 분쟁/차지백 대응 + 전자상거래법 5년 보존. orders·credit_transactions 스냅샷';
COMMENT ON COLUMN preserved_transactions.payload IS '원본 행 전체 스냅샷 (jsonb) — 스키마 변경 대비';
COMMENT ON COLUMN preserved_transactions.purge_at IS '보존 만료 시점 (preserved_at + 5년). 도래분은 파기 잡으로 정리';
