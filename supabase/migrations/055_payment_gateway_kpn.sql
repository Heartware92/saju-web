-- 055_payment_gateway_kpn.sql
-- 결제 게이트웨이 스위처에 KPN(한국결제네트웍스 / FirstPay) 채널 추가.
-- 기존 토스페이먼츠 ↔ KG이니시스 2채널 → 3채널(+KPN)로 확장.
-- 컬럼은 기본값과 함께 추가하여 기존 단일 row(primary)에 무손상 적용.

alter table public.payment_gateway_config
  add column if not exists kpn_channel_key text not null default '',
  add column if not exists kpn_enabled boolean not null default true;

-- active_channel CHECK 에 'kpn' 추가 (기존 인라인 제약 교체)
alter table public.payment_gateway_config
  drop constraint if exists payment_gateway_config_active_channel_check;
alter table public.payment_gateway_config
  add constraint payment_gateway_config_active_channel_check
  check (active_channel in ('tosspayments', 'inicis', 'kpn'));

comment on column public.payment_gateway_config.kpn_channel_key is 'KPN(한국결제네트웍스) PortOne 채널 키';
