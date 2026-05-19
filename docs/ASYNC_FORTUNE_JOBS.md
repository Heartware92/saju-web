# 백그라운드 잡 시스템 마이그레이션 가이드

> **목적**: 클라이언트 fetch 의존 AI 호출을 *서버 백그라운드 잡* 으로 전환.
> 브라우저를 닫거나 탭을 벗어나도 풀이가 끝까지 진행되고 보관함에 자동 저장되며,
> 재진입 시 AI 재호출 없이 결과 표시.

기준 구현: **정통사주(traditional)** — Phase 1·1.5 (commit `9af15f3`, `25520d0`, `a483187`).
이후 모든 운세 카테고리는 이 가이드를 따라 이전한다.

---

## 0. 사전 점검 (시작 전 반드시 확인)

작업 시작 전 다음을 확인하지 않으면 production 에서 작동 안 함.

### 0.1 Vercel 환경변수 (Production · Preview 양쪽)
```bash
npx vercel env ls
```
다음 5개가 모두 등록돼있어야 함:
- `SUPABASE_SERVICE_ROLE_KEY` ← **백그라운드 잡 처리기 절대 필수**
- `GEMINI_API_KEY`
- `OPENAI_API_KEY` (Gemini 폴백)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> ⚠️ feature branch 의 preview deployment 에서 테스트하려면 Preview 환경에도 모두 등록 필요. 정통사주 작업 시 Preview 등록이 부족해 main 으로 바로 merge 한 사례 있음.

### 0.2 Supabase CLI 상태
```bash
npx supabase migration list
```
로컬과 remote 가 sync 돼있어야 함. 우리 프로젝트는 `99999999999999_data_import.sql` 이 마지막 번호라 일반 `db push` 가 거부됨 → **`--include-all` 플래그 필수**:
```bash
npx supabase db push --include-all
```

### 0.3 인프라 (이미 구축됨 — 새로 만들지 말 것)
- `src/lib/ai/aiClients.ts` — `callAI(prompt, maxTokens, opts)` (Gemini + OpenAI 폴백)
- `src/app/api/fortune/jobs/create/route.ts` — 진입 endpoint
- `src/services/supabaseAdmin.ts` — service_role 클라이언트
- `src/hooks/useFortuneJob.ts` — Realtime 구독 hook (**모든 카테고리 공용 — 새 hook 만들지 말 것**)
- `037_saju_records_job_state.sql` — status·error·시간 컬럼 + Realtime publication
- `038_user_credits_realtime.sql` — 차감/충전 자동 UI 반영

### 0.4 새 publication SQL 만들지 말 것
saju_records 는 037 에서 이미 publication 에 추가됨. 새 카테고리는 *같은 테이블* 을 사용하므로 추가 마이그레이션 SQL 불필요. status·error_message 컬럼도 이미 있음.

---

## 1. 아키텍처

```
[클라이언트]                                          [서버]
풀이보기 클릭
  │ POST /api/fortune/jobs/create
  │ Bearer access_token
  │ body: { category, sajuResult, prompt?, partnerName?, ..., idempotencyKey }
  └──────────────────────────────────────────────────►
                                                consume_credit_atomic (서버 RPC, 즉시 차감)
                                                saju_records INSERT (status='pending')
                                                after(runXxxJob(...))   ← 백그라운드 시작
                  jobId 즉시 반환                ◄──────────────────────
  │ URL ?jobId 로 history.replaceState           runXxxJob:
  │ useFortuneJob(jobId) Realtime 구독              ├─ UPDATE status='processing', started_at
                                                  ├─ callAI(prompt, maxTokens)
                                                  ├─ sanitize + 파싱
                                                  ├─ (2-pass) markPartial → interpretation_basic
                                                  ├─ (2-pass) 2차 callAI
                                                  └─ UPDATE status='done', interpretation_detailed, completed_at
                  saju_records UPDATE push    ◄──
  │ status 별 분기 렌더
  │   processing (interp_basic 없음) → 모래시계
  │   processing + interp_basic → 1차 partial 렌더
  │   done → 전체 결과
  │   failed → 자동 환불 메시지
```

**status 전이는 단방향**:
- `pending` → `processing` → `done` (성공)
- `pending` → `processing` → `failed` (자동 환불 트리거)
- partial 도중에도 status 는 `processing` 유지 (`interpretation_basic` 만 UPDATE)

---

## 2. 표준 마이그레이션 단계 (체크리스트)

각 카테고리마다 아래 단계를 순서대로 진행한다.

### Step 1 — 의존성 파악
- [ ] 현재 `src/services/fortuneService.ts` 또는 페이지 안의 entry function
  - 예: `getJungtongsajuReport`, `callGunghapGPT`
- [ ] 핵심 helper 위치 (parse·sanitize·prompt generator)
- [ ] **server import 가능한지** — `'use client'`, `archiveService` 의존성 있으면 분리 필요
  - 안전 모듈 예: `src/lib/gunghap.ts`, `src/services/jungtongsajuShared.ts`
- [ ] 1-pass vs 2-pass 여부
- [ ] 최소 응답 길이 (`MIN_CONTENT_LENGTH`)
- [ ] maxTokens
- [ ] sourceBirth · partner 정보 · engine_result 에 들어갈 컬럼 정리
- [ ] 현재 차감 호출처 (chargeForContent reason = `CHARGE_REASONS.{category}`)
- [ ] 현재 archiveSaju 호출 위치 (제거 대상)

### Step 2 — server-side helper 분리 (필요 시)
- [ ] `'use client'` / 클라이언트 supabase 의존성 있는 helper 를 server-safe 모듈로 분리
  - 패턴 A: 새 파일 `xxxShared.ts` 생성 (정통사주 패턴)
  - 패턴 B: 기존 server-safe 모듈에 추가 (`lib/gunghap.ts` 같은)
- [ ] 클라이언트 fortuneService.ts 도 같은 helper 재import (re-export) — 외부 호환 유지

### Step 3 — `xxxJob.server.ts` 작성
- [ ] `src/services/{category}Job.server.ts` 생성
- [ ] 시그니처:
  ```ts
  runXxxJob({ recordId, userId, prompt|sajuResult, consumeIdempotencyKey, creditAmount, ... }): Promise<void>
  ```
- [ ] 흐름:
  1. `UPDATE status='processing', started_at=now()`
  2. `callAI(prompt, maxTokens)`
  3. (2-pass) 1차 후 `markPartial(recordId, coreContent)` → status='processing' 유지, interpretation_basic 만 UPDATE
  4. sanitize + 길이 검증 + tag 제거
  5. (선택) parse 검증 — 섹션 마커 누락 시 retry
  6. 성공: `markDone` → UPDATE status='done', interpretation_detailed, completed_at
  7. 실패: `failJob` → UPDATE status='failed', error_message + `refund_credit_atomic` 호출
- [ ] 환불 idempotency_key: `refund:${consumeIdempotencyKey}`
- [ ] **throw 안 함** — 모든 에러를 status='failed' 로 표현

### Step 4 — `/api/fortune/jobs/create` route 에 카테고리 추가
- [ ] `CATEGORY_POLICY` 객체에 항목 추가:
  ```ts
  CATEGORY_POLICY: {
    {newCategory}: { creditCost: 10, reason: '카테고리명' }
  }
  ```
  > reason 값은 클라이언트의 `CHARGE_REASONS.{category}` 와 **반드시 동일** — 거래 내역 라벨 일관성
- [ ] body 인터페이스 추가 (Union):
  ```ts
  interface XxxJobBody extends BaseJobBody {
    category: 'newCategory';
    // 카테고리 전용 필드 (prompt, partnerName, engineResult 등)
  }
  ```
- [ ] body 검증 분기 추가 (필수 필드 누락 시 400)
- [ ] INSERT 컬럼 분기:
  - **공통**: user_id, category, birth_*, gender, calendar_type, result_data, credit_*, is_detailed, status='pending'
  - **카테고리별** (분기로):
    - `engine_result` — 카테고리 메타 (gunghapCategory·역할·custom 라벨)
    - `partner_name`, `partner_birth_date` — gunghap·궁합류만
- [ ] `after(runXxxJob({...}))` 분기 추가
- [ ] 같은 idempotencyKey 로 이미 만든 잡 있으면 그 jobId 반환 (`deduplicated: true`)

### Step 5 — 페이지 수정

**입력+결과 한 페이지** (`GunghapPage` 같은 단일 페이지 패턴):
- [ ] handleAnalyze 의 callGPT 호출을 `POST /api/fortune/jobs/create` 로 교체
- [ ] body 구성:
  ```ts
  { category, sajuResult, prompt|..., profileId, sourceBirth, idempotencyKey, partnerName, partnerBirthDate, engineResult }
  ```
- [ ] Bearer 토큰: `supabase.auth.getSession().data.session.access_token`
- [ ] 응답 `{ jobId }` 받으면 `history.replaceState` 로 URL `?jobId=xxx` 추가
- [ ] 페이지에 ?jobId 감지 분기 추가 → `useFortuneJob(jobId)` 구독
- [ ] 상태별 렌더:
  - pending/processing (interpretation_basic 없음) → 모래시계
  - processing + interpretation_basic → partial 렌더 (옵션, 2-pass 만)
  - done → 전체 결과 + parse·setReport
  - failed → 오류 + 환불 안내
- [ ] **`archiveSaju` 호출 제거** — 서버가 자동 INSERT
- [ ] **`chargeForContent` 호출 제거** — 서버에서 RPC 직접 차감
- [ ] **`useReportCacheStore` 정책 결정**:
  - 옵션 A: 통째 제거 (정통사주 패턴) — DB 가 단일 source of truth
  - 옵션 B: 캐시 hit 시 옛 동작 유지 (궁합 패턴) — 옛 결과 즉시 표시 + 캐시 miss 시만 새 잡

**입력·결과 분리** (`SajuInputPage` → `SajuResultPage` 패턴):
- [ ] 입력 페이지는 그대로 (URL 파라미터 push)
- [ ] 결과 페이지의 AI 호출 useEffect 만 새 잡 생성으로 교체
- [ ] 옛 archive 모드(?recordId) 분기 100% 보존 — 별도 useEffect

### Step 6 — `ArchivePage` 분기 추가
- [ ] `getSajuRoute(record)` 의 카테고리 분기에 추가:
  ```ts
  if (cat === '{새카테고리}' && (record.status === 'pending' || record.status === 'processing' || record.status === 'failed')) {
    return `/saju/{path}?jobId=${record.id}`;
  }
  ```
- [ ] 카드 status 배지 (모래시계·실패) 는 이미 적용됨 (정통사주 Phase 1 에서 일괄 추가)

### Step 7 — TypeScript 검증
- [ ] `npx tsc --noEmit` — 0 error 필수
- [ ] unused import warning 정리 (옛 chargeForContent·archiveSaju 등이 자동으로 unused 됨)

### Step 8 — 한 묶음 commit + push + 배포
- [ ] **모든 변경 (마이그레이션·서버·클라이언트) 한 commit**
- [ ] `git add` 는 **명시적 path 만** (메모리: 분할 push 금지)
- [ ] commit 메시지: `feat(async-fortune): {카테고리} 백그라운드 잡 시스템 마이그레이션`
- [ ] `git push origin main`
- [ ] SQL 있으면 (보통 없음): `npx supabase db push --include-all`

### Step 9 — 실측 검증
본인 슈퍼계정으로 실제 결제·실행. 다음 모두 통과해야 마무리:

- [ ] **검증 1**: 풀이보기 클릭 → URL `?jobId=...` 로 바뀜 (history.replaceState)
- [ ] **검증 2**: 상단 크레딧 ~2~3초 안 `-N` 자동 갱신 (Realtime credits 정상 범주)
- [ ] **검증 3**: 모래시계 (또는 partial) 화면
- [ ] **검증 4**: 30~90초 후 결과 도착
- [ ] **검증 5**: **다른 탭 갔다 돌아옴** → 재호출 없음, 같은 결과
- [ ] **검증 6**: **새로고침 (F5)** → 같은 결과 (URL ?jobId 살아있음)
- [ ] **검증 7**: **브라우저 닫고 보관함 진입** → 정상 표시 또는 모래시계
- [ ] **검증 8**: 일부러 실패 시키기 어려우면 status='failed' 케이스는 서버 로그만 확인

---

## 3. 카테고리별 차이 (이미 마이그레이션된 것)

### 정통사주 (`traditional`) — Phase 1·1.5 완료
| 항목 | 값 |
|---|---|
| 호출 방식 | 2-pass (Core 4섹션 + Application 8섹션) |
| Retry | 2차 3회 + 점진 백오프 |
| 1차 partial | ✅ markPartial — interpretation_basic 에 1차 본문 |
| maxTokens | 1차 7000, 2차 14000 |
| 분량 | ~8200자 |
| MIN_CONTENT_LENGTH | (parse 단계에서 검증) |
| 서버가 받는 것 | `sajuResult` (prompt 는 서버가 생성) |
| 페이지 패턴 | 입력·결과 분리 (`SajuInputPage` → `SajuResultPage`) |
| 캐시 정책 | 통째 제거 (옛 `useReportCacheStore` 흐름 삭제) |
| 추가 컬럼 | engine_result 에 profile_id |

### 궁합 (`gunghap`) — Phase 2 작업 중
| 항목 | 값 |
|---|---|
| 호출 방식 | 1-pass |
| Retry | 0회 (실패 즉시 환불) |
| 1차 partial | 없음 (1-pass) |
| maxTokens | 6000 |
| MIN_CONTENT_LENGTH | 700자 |
| 서버가 받는 것 | `prompt` 완성본 (14개 카테고리 + role injection + title/score 래퍼) |
| 페이지 패턴 | 입력+결과 한 페이지 (`GunghapPage`) |
| 캐시 정책 | hit 시 옛 동작 유지, miss 시만 새 잡 (변경 최소화) |
| 추가 컬럼 | partner_name, partner_birth_date, engine_result (gunghapCategory·역할·custom 라벨·pet) |

---

## 4. 잠재 사고 패턴 (꼭 확인)

### 4.1 분할 push 사고 (메모리 `feedback_multi_session_git`)
- 한 PR 안에서 서버 API + 클라이언트 페이지 + 마이그레이션이 모두 묶여야 함
- `git add -A` 금지 — 명시적 path 만
- 빌드 실패 발생하면 `vercel ls --prod` 로 deployment 상태 먼저 확인 (1순위 진단)

### 4.2 옛 archive 모드 호환성 깨짐
- 새 잡 추가하면서 옛 `?recordId` 흐름 깨지면 안 됨
- 페이지에 `recordId` 분기 (별도 useEffect) 가 그대로 유지되는지 확인
- 옛 보관함 풀이는 status='done' (default) 이라 그대로 작동

### 4.3 unused import warning 누적
- 옛 함수(`getXxxReport`, `chargeForContent`, `archiveSaju`, `useReportCacheStore`) 등 import 가 사용처 사라지면서 unused 됨
- 빌드 통과는 되지만 dead code 누적 — 카테고리 마이그레이션 1~2개 끝나면 일괄 cleanup commit 권장

### 4.4 차감 UI 지연
- 새 잡 시스템은 서버에서 차감 → 클라 useCreditStore 가 stale 가능
- `038_user_credits_realtime` 이 user_credits Realtime push 책임 (이미 적용됨)
- 페이지 새로고침 1회로 새 코드(subscribeToBalance) 활성화 필요
- 정상 latency: **2~3초** (Supabase Realtime push 의 표준)

### 4.5 idempotencyKey 충돌
- 카테고리별 prefix 필수: `${category}:${...}` 패턴
- 정통사주: `traditional:${birthDate}:${birthTime}:${gender}:${calendarType}:${minuteBucket}`
- 궁합: `gunghap:${sajuKey(myResult)}:${sajuKey(otherResult)}:${gunghapCategory}:${minuteBucket}`
- 같은 사용자가 1분 내 동일 입력으로 더블 클릭 → duplicate 반환 + 기존 jobId 재사용

### 4.6 카테고리별 컬럼 분기 누락
- `partner_name`/`partner_birth_date` 는 saju_records 의 별도 컬럼 — engine_result 가 아님
- 보관함 ArchivePage 의 `getProfileLabel` 가 partner_* 컬럼을 직접 읽음
- engine_result 에만 넣으면 보관함 라벨 깨짐

### 4.7 CHARGE_REASONS 와 CATEGORY_POLICY.reason 불일치
- 같은 카테고리에 두 값이 다르면 거래 내역(credit_transactions.reason) 라벨이 혼란
- 항상 동일 문자열 유지 — `CHARGE_REASONS.gunghap === '궁합'` ↔ `CATEGORY_POLICY.gunghap.reason === '궁합'`

---

## 5. INCIDENTS 와 연결

`INCIDENTS.md` 에 다음 사고 패턴 이미 기록됨:
- 2026-05-19 — 분할 push 사고 (택일 흉신, 꿈해몽 5섹션)
- 2026-05-19 — handleRead cache hit 사고

이번 잡 시스템은 그 사고들을 **구조적으로 차단**:
- 결과는 saju_records 가 단일 source of truth → cache 불일치 사고 0
- 차감은 서버 RPC 원자적 → 클라이언트 의존 사고 0

---

## 6. 진행 현황

| 카테고리 | 상태 | commit |
|---|---|---|
| traditional (정통사주) | ✅ Phase 1.5 완료 | `9af15f3` → `25520d0` → `a483187` (Realtime credits) |
| gunghap (궁합) | 🔄 Phase 2 작업 중 | — |
| newyear (신년) | ⏳ pending | — |
| tojeong (토정) | ⏳ pending | — |
| zamidusu (자미두수) | ⏳ pending | — |
| taekil (택일) | ⏳ pending | — |
| today (실시간) | ⏳ pending | — |
| date (지정일) | ⏳ pending | — |
| 더많은운세 (love·wealth·career·health·study·people·children·personality·name·dream) | ⏳ pending | — |
| 타로 (3종) | ⏳ pending | — |

새 카테고리 마이그레이션 완료 시:
1. 이 표 업데이트
2. `## 3. 카테고리별 차이` 에 entry 추가 (호출 방식·maxTokens·캐시 정책 등)
3. 새 잠재 사고 발견하면 `## 4. 잠재 사고 패턴` 에 추가

---

## 7. 차감 정책 정리

**새 잡 시스템 = 선결제 + 자동 환불 패턴** (카드 hold/release 와 동일):

| 시점 | 동작 |
|---|---|
| 풀이보기 클릭 직후 (~500ms) | 서버 RPC 로 즉시 차감 |
| 잡 성공 (status='done') | 차감 유지 |
| 잡 실패 (status='failed') | 자동 환불 (refund_credit_atomic) |
| 같은 idempotencyKey 재요청 | duplicate 반환, 추가 차감 0 |
| 브라우저 닫음 | 서버 백그라운드 진행 — 차감 유지·결과 보장 |

옛 시스템(클라이언트 chargeForContent 호출) 패턴을 그대로 두면 안 됨. 새 카테고리 마이그레이션 시 차감 호출처를 **반드시 클라이언트에서 제거**.
