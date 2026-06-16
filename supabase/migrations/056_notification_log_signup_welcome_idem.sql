-- 056: 회원가입 환영 알림톡 멱등성 가드
--
-- 기존 045 의 유니크 인덱스 uq_notification_log_sent_once 는 (inquiry_id, channel, event) 기준이라
-- 가입 알림(inquiry_id IS NULL)에는 작동하지 않는다. Postgres 는 NULL 을 서로 다른 값으로 취급하므로
-- 같은 user 에게 'sent' 가 여러 번 들어갈 수 있다 → 중복 알림톡(과금) 위험.
--
-- 가입 등 inquiry 와 무관한 알림은 (user_id, channel, event) 당 'sent' 1건만 허용한다.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_log_user_sent_once
  ON notification_log (user_id, channel, event)
  WHERE status = 'sent' AND inquiry_id IS NULL;

COMMENT ON INDEX uq_notification_log_user_sent_once IS
  '문의와 무관한 알림(가입 환영 등) — user·채널·이벤트당 성공 발송 1건만 허용 (중복 알림톡 방지)';
