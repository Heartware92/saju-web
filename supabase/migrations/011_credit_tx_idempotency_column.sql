-- credit_transactions 에 idempotency_key UNIQUE 컬럼 추가
-- 재시도·동시 호출 시 이중 차감 차단 (DB 레벨 안전망)

alter table credit_transactions
  add column if not exists idempotency_key text;

create unique index if not exists uniq_credit_tx_idem
  on credit_transactions (idempotency_key)
  where idempotency_key is not null;
