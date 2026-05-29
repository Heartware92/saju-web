-- payment_gateway_config: 어드민에서 결제 게이트웨이 채널을 런타임 전환하기 위한 설정 테이블
-- 단일 row (id='primary') 만 유지. 토스페이먼츠/KG이니시스 두 PG 의 PortOne 채널 키를 모두 보관.
-- 활성 채널만 active_channel 로 표시되며, 결제 진입 시 /api/payment/active-channel 이 해당 채널 키를 반환.

CREATE TABLE IF NOT EXISTS payment_gateway_config (
  id text PRIMARY KEY DEFAULT 'primary' CHECK (id = 'primary'),
  active_channel text NOT NULL CHECK (active_channel IN ('tosspayments', 'inicis')),
  toss_channel_key text NOT NULL DEFAULT '',
  inicis_channel_key text NOT NULL DEFAULT '',
  toss_enabled boolean NOT NULL DEFAULT true,
  inicis_enabled boolean NOT NULL DEFAULT true,
  note text,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 단일 row 보장
CREATE UNIQUE INDEX IF NOT EXISTS payment_gateway_config_singleton
  ON payment_gateway_config ((id));

-- 초기 row 삽입 (기존 환경변수 값으로 부트스트랩 필요 — 운영자가 수동으로 채워야 함)
INSERT INTO payment_gateway_config (id, active_channel, toss_channel_key, inicis_channel_key, note)
VALUES ('primary', 'tosspayments', '', '', '초기값 — 어드민에서 실제 채널 키 입력 필요')
ON CONFLICT (id) DO NOTHING;

-- updated_at 트리거
CREATE TRIGGER trg_payment_gateway_config_updated_at
  BEFORE UPDATE ON payment_gateway_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS — service_role 만 접근. 클라이언트는 직접 보지 않고 /api/payment/active-channel 경유로 active 채널 키만 받음.
-- 비활성 채널 키·메모·updated_by 같은 운영 정보를 anon 에 노출하지 않기 위해 SELECT 도 막음.
ALTER TABLE payment_gateway_config ENABLE ROW LEVEL SECURITY;

-- 감사 로그 action 확장 — admin_audit_logs.action 에 'payment_gateway_switch' 추가 (CHECK 제약 없으므로 자동 허용)
COMMENT ON TABLE payment_gateway_config IS '결제 게이트웨이 런타임 설정 — 어드민에서 토스 ↔ KG이니시스 즉시 전환';
