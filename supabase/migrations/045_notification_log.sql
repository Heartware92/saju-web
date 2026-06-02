-- 고객 알림 발송 로그 — 문의 답변완료 알림톡 등
--
-- 목적:
--   1) 멱등성: 알림톡은 건당 과금 → 같은 이벤트에 중복 발송 방지 (성공 1건만 허용)
--   2) 감사: 누구에게 언제 어떤 채널로 보냈는지 + 제공자 응답/실패 사유 보존
--   3) 확장: channel 을 alimtalk/sms/email/inapp 로 열어둠 (지금은 alimtalk 만 사용)

CREATE TABLE IF NOT EXISTS notification_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id    uuid REFERENCES inquiries(id) ON DELETE CASCADE,  -- 어떤 문의에 대한 알림인지 (이벤트별 연결)
  user_id       uuid,                                             -- 수신 대상 user (FK X — 탈퇴 대비)
  channel       text NOT NULL CHECK (channel IN ('alimtalk', 'sms', 'email', 'inapp')),
  event         text NOT NULL,                                    -- 예: 'inquiry_answered'
  recipient     text,                                             -- 발송에 쓴 연락처(전화/이메일) — 마스킹 없이 원문(감사용)
  status        text NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  provider      text,                                             -- 'solapi' 등
  provider_response jsonb,                                        -- 제공자 응답/에러 원문
  error         text,                                             -- 실패/스킵 사유 요약
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 멱등성 — (문의, 채널, 이벤트)당 '성공' 발송은 최대 1건. 실패/스킵/대기는 여러 건 허용(재시도 가능)
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_log_sent_once
  ON notification_log (inquiry_id, channel, event)
  WHERE status = 'sent';

-- 조회용
CREATE INDEX IF NOT EXISTS idx_notification_log_inquiry ON notification_log (inquiry_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_created ON notification_log (created_at DESC);

-- RLS — 어드민(service_role) 전용. 일반 사용자 접근 불가
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access" ON notification_log;
CREATE POLICY "service role full access"
  ON notification_log FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE notification_log IS '고객 알림 발송 로그 — 멱등성(중복 과금 방지)+감사. 문의 답변완료 알림톡 등';
COMMENT ON INDEX uq_notification_log_sent_once IS '문의·채널·이벤트당 성공 발송 1건만 허용 (중복 알림톡 방지)';
