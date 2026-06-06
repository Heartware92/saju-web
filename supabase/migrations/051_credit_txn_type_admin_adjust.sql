-- 050: credit_transactions.type CHECK 에 'admin_adjust', 'signup_bonus' 추가
--
-- 배경: 001 의 type CHECK 가 ('purchase','consume','bonus','refund') 뿐인데,
--       앱 코드는 어드민 크레딧 조정(/api/admin/users/[id]/adjust-credit)에서 type='admin_adjust'를,
--       통계(credits/summary)는 'signup_bonus'를 기대한다. 운영 DB 제약이 이를 막아
--       어드민 "크레딧 조정"이 실제로는 CHECK 위반으로 실패하던 문제(드리프트) 수정.
--
-- 안전: 순수 확장(허용값 추가). 기존 데이터 영향 없음. 멱등(IF EXISTS / 동일 이름 재생성).

alter table public.credit_transactions drop constraint if exists credit_transactions_type_check;

alter table public.credit_transactions
  add constraint credit_transactions_type_check
  check (type in ('purchase', 'consume', 'bonus', 'refund', 'admin_adjust', 'signup_bonus'));
