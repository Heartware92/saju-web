# 관리자 크레딧(달) 지급 프로세스

> Claude가 "특정 회원에게 크레딧 N개 지급" 요청을 받았을 때 읽는 운영 문서.
> 크레딧은 **달(moon) 단일 통화**(해/sun은 폐지, 마이그 033) + **lot 기반 1년 만료 회계**(마이그 054).

## 핵심 원칙
- **임의 INSERT/UPDATE 금지.** 반드시 아래 정규 경로를 써야 lot 회계·잔액·감사로그가 일관된다.
- **`grant_credit_atomic` RPC를 관리자 지급에 쓰지 말 것.** 이 RPC는 거래 type을 `'purchase'`로 하드코딩 → 매출 애널리틱스 오염. (결제 적립 전용.)
- 관리자 지급의 정규 type은 **`admin_adjust`**.
- [[feedback_no_duplicate_credit_charge]] — 중복 지급/차감은 서비스 종료급 사고. 재실행 가드 필수.

## 정규 경로 A — 어드민 UI / API (운영 표준)
`POST /api/admin/users/[id]/adjust-credit`  (`src/app/api/admin/users/[id]/adjust-credit/route.ts`)

```jsonc
// body
{ "delta": 20, "reason": "관리자 지급" }   // delta +지급 / -차감 (0 불가, |delta|≤10000)
```
- requireAdmin 인증 필요(어드민 토큰).
- 다수 회원 일괄: `POST /api/admin/users/bulk` `{ userIds[], action:'credit', delta, reason }` (최대 200명).
- **사람이 어드민 화면에서 줄 수 있으면 이 경로가 1순위.**

## 정규 경로 B — service_role 스크립트 (어드민 토큰 없이 Claude가 직접 처리할 때)
엔드포인트 로직을 **그대로 replicate**한다. 순서·필드 고정:

1. `user_credits` 행 존재 확인 + 현재 `moon_balance` 조회 (없으면 404 — 지급 불가, 회원 가입/크레딧초기화 안 된 상태).
2. `user_credits.moon_balance = 현재 + delta` UPDATE. (음수 결과면 중단.)
3. `credit_transactions` INSERT:
   ```
   { user_id, credit_type:'moon', type:'admin_adjust', amount:delta, balance_after:newBalance, reason }
   ```
4. **여기서 끝.** `after insert` 트리거 `trg_maintain_credit_lots`가 자동으로:
   - amount>0 → `credit_lots`에 새 lot 생성 (`source_type=거래type='admin_adjust'`, `amount_granted=amount`, `amount_remaining=amount`, `expires_at = created_at + 1년`, `status='active'`).
   - amount<0 → FIFO(만료 임박 순)로 기존 lot 차감.
   - **트리거는 moon_balance를 건드리지 않는다** → 2번에서 직접 갱신해야 함(이중계산 아님).

### 재실행 가드(중복 지급 방지)
지급 전, 동일 `(user_id, type='admin_adjust', amount, reason)` 거래가 이미 있으면 **중단**. (엔드포인트엔 idempotency_key가 없으므로 스크립트가 직접 가드.)

### 환경
- 운영 DB = **2000-saju / ref `ebrkalrixwxdyhzekkwt`** (Seoul). 로컬 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`(=ebrk) + `SUPABASE_SERVICE_ROLE_KEY` 사용.
- 일회성 스크립트는 `scripts/_*.mjs`로 만들고 **실행 후 반드시 삭제**.

## 검증(지급 후)
```sql
-- 잔액
select moon_balance from user_credits where user_id = :uid;
-- 최신 lot (admin_adjust, +1년 만료, active 인지)
select amount_granted, amount_remaining, source_type, expires_at, status
  from credit_lots where user_id=:uid and credit_type='moon'
  order by granted_at desc limit 1;
-- 불변식: sum(amount_remaining where status in active/exhausted) ≈ moon_balance
```

## 관련 파일 / 마이그레이션
- API: `src/app/api/admin/users/[id]/adjust-credit/route.ts`, `src/app/api/admin/users/bulk/route.ts`
- 감사로그: `src/app/api/admin/_audit.ts` (action `credit_adjust`)
- RPC: `supabase/migrations/016_grant_credit_atomic.sql` (결제 전용, 관리자 지급 금지)
- 타입 추가: `051_credit_txn_type_admin_adjust.sql`
- lot 회계·트리거·만료: `054_credit_expiry_lots.sql`  (관련 메모리 [[project_credit_expiry_lots]])
- 달 단일화: `033_unify_to_moon_credit.sql`
- 만료 크론: `src/app/api/cron/expire-credits/route.ts` (매일 03:00 KST, `expire_credit_lots()`)

## credit_transactions.type / credit_lots.source_type 값
`purchase | consume | bonus | refund | admin_adjust | signup_bonus | expire`
- 관리자 수동 지급/차감 = **admin_adjust**
- 가입 보너스 = signup_bonus / 결제 = purchase / 이벤트 = bonus

## 실행 이력
- 2026-06-17: `mylovenst@naver.com`(user_id `6fb9c4f3-31b7-4fb3-9dc7-0a17caa24152`)에 +20 달 지급(경로 B). 0 → 20, lot active(만료 2027-06-17). **1회성 특이 케이스 — 이 계정에 추가 지급 예정 없음(재요청 시 의도 재확인).**
