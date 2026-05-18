# 장애 대응 기록 (INCIDENTS)

> 사고가 날 때마다 **최신 사고를 상단**에 추가. 한 사고 = 한 entry.

## entry 작성 규칙

각 사고마다 다음 항목 모두 기록:

1. **헤더** — `## YYYY-MM-DD HH:MM — 한 줄 요약`
2. **증상** — 사용자/운영자가 본 화면·메시지·동작
3. **영향 범위** — 어느 사용자/페이지/기능에 어떤 영향
4. **진단 과정** — 시간순 시도한 가설·검증·잘못된 경로
5. **진짜 원인** — 1줄 결론 + 기술적 디테일
6. **해결** — 실제 적용한 명령·코드·설정 변경
7. **재발 방지** — 매뉴얼화·자동화·룰 추가
8. **관련** — 커밋 해시·관련 파일·외부 링크

---

## 2026-05-18 19:09 — Vercel 빌드 Initializing 단계 hang + 큐 적체

### 증상
- 사용자: "초기화에서 머물러 있는 거 아니야?" — Vercel 대시보드의 새 배포가 6분 이상 `Initializing` 상태에서 진행 안 됨
- 후속 push 도 `Queued` 상태로 대기, 빌드 자체 시작 안 됨
- prod 서비스 (`2000-saju.com`) 자체는 직전 Ready 배포가 정상 서빙 중 → 사용자 체감 영향 없음

### 영향 범위
- 새 기능 (연도별 운세 메뉴, 6섹션 카드 분리) prod 반영 지연 ~6분
- 사용자 서비스 down 없음 (prod alias 가 직전 Ready 배포에 연결)

### 진단 과정
1. ✗ "Vercel 측 장애" 가설 → vercel-status.com 확인 → **All Systems Operational** (99.93~100% 가동)
2. ✗ "Pro 플랜 동시 빌드 슬롯 부족" 가설 → Pro 플랜은 12개 동시 빌드 가능, 현재 1~2개라 슬롯 충분
3. ✗ "코드/설정 문제" 가설 → 빌드 로그가 비어있음 (`vercel inspect --logs`) — 빌드 자체가 시작 안 됨
4. ✓ **빌드 환경 spawn 단계에서 Vercel 내부 hang** — Initializing = git clone·env setup·container spawn 단계. 보통 1~2분 안에 완료되어야 정상
5. ✓ hung 된 deployment 가 큐를 잡고 안 놔줘서 후속 push 도 Queued 대기

### 진짜 원인
**Vercel 내부 인프라의 일시적 빌드 환경 spawn 실패.** 자동 timeout/fail 로직이 작동 안 해 hang 상태 유지. 우리 코드/설정 무관.

### 해결
```bash
# 1. hung 된 deployment 제거
npx vercel rm saju-hws8gl12u-heartwares-projects.vercel.app --yes

# 2. 후속 Queued 배포가 자동으로 Building 진입 확인
npx vercel ls --yes | head -3
```

`vercel rm` 은 destructive 명령이지만 prod alias 가 직전 Ready 배포에 있으면 안전.

### 재발 방지
- **운영 룰**: Initializing 상태가 **5분 이상 정체** 시 `vercel rm <deployment-url> --yes` 즉시 실행
- prod alias 가 다른 Ready 배포에 있는지 먼저 확인 (`vercel inspect <url>` 의 Aliases 섹션)
- 단순히 새 commit 또는 빈 commit 으로 새 build 트리거하는 건 효과 없음 — hung 된 build 가 큐 점유 중이라 새 build 도 Queued 됨. 반드시 hung deployment 제거 필요
- Vercel 은 항상 최신 commit 만 빌드하므로 중간 commit 의 build 가 실패/제거돼도 변경분은 다음 build 에 누적 포함됨 → 재push 불필요

### 관련
- 사고 시 commit: `93af1ba` (연도별 운세 신메뉴) — 빌드 hang
- 해결 후 정상 빌드된 commit: `e50ae3f` (6섹션 카드 분리, 누적 변경분 포함)
- 사용자 push 9개 이후 인프라 부하 가능성도 있으나 확정 불가

---

## 2026-05-16 19:30 — Mumbai→Seoul 마이그레이션 후 로그인 무한 hang

### 증상
- 5/16 19:30 경부터 모든 사용자·모든 페이지에서 "로그인 중…" 무한 멈춤
- 시크릿 창에서도 재현
- 크레딧·운세풀이·내정보 등 모든 인증 필요 페이지 동일

### 영향 범위
- **prod 서비스 전체 down** — 신규/기존 사용자 모두 로그인 불가
- 약 1~2시간 (해결 진단 시간) 영향

### 진단 과정
1. ✗ "마이그레이션 후 stale auth token" 가설 (b4b0f04) → revert
2. ✗ "새 버전 배너 캐시 버스터" 가설 (0034fe4) → revert
3. ✗ "env var throw 가드" 가설 → placeholder fallback 으로 복원
4. ✗ "Supabase JS v2.97 deadlock 버그" 가설 → v2.88 다운그레이드 (실제 원인은 아니었으나 안전 이득으로 유지)
5. ✓ 로그인 12초 timeout 안전망 (9fa6eaa) — 부분 효과, 안전망으로 유지
6. ✓ **`.vercel/.env.production.local` 파일이 stale** — 5월 12일 첫 `vercel link` 시 생성된 이후 갱신 안 됨. 그 파일에 마이그레이션 전 Mumbai 프로젝트 URL (`qfnbjbtxxrwyqvhdehgw`) 박혀있었음

### 진짜 원인
- `vercel build --prod` 가 stale local env 를 우선 사용 → 옛 URL inline 된 JS chunk (`5045645345149a12.js`) 생성
- Vercel 대시보드 env 가 새 URL (`ebrkalrixwxdyhzekkwt`) 로 바뀌어도 로컬 파일은 stale
- 5/15 사용자가 Mumbai 프로젝트 pause → 24시간 후(5/16 19:30) DNS 완전 제거 → ERR_NAME_NOT_RESOLVED → 무한 retry hang

### 해결
```bash
rm -f .vercel/.env.production.local
vercel env pull .vercel/.env.production.local --environment=production --yes
rm -rf .next .vercel/output node_modules/.cache
vercel build --prod
vercel deploy --prebuilt --prod
```

검증: 새 chunk 에 옛 URL 0개 / 새 URL 3개 ✓

### 재발 방지
- **`npm run deploy:prod` 안전 스크립트 신설** (60fa1a8)
  - stale env 자동 삭제 → env pull → 캐시 정리 → fresh build → deploy
- **`DEPLOY.md` 매뉴얼화** — 환경변수 변경 시 반드시 npm run deploy:prod
- **`.vercel/.env.production.local` 은 stale 됨을 기억** — Vercel CLI 가 한 번 pull 한 후 자동 갱신 안 함. 환경변수 바뀌면 명시 갱신 필수. `.gitignore` 라 git 추적도 안 됨
- **Supabase 옛 프로젝트 pause 후 DNS 24시간 grace period** — pause 즉시가 아닌 24시간 후 DNS 완전 제거. 그 사이 옛 URL 호출은 빠른 fail 응답 → 사용자 입장 정상 보임. 24시간 후 DNS 자체 사라져 retry loop
- **Supabase JS v2.88.0 고정** — v2.89+ `_acquireLock` deadlock 버그 (GitHub issue #2013) 회피
- **진단 시 추정보다 직접 검증 우선** — production chunk 의 정확한 URL grep 5초로 root cause 드러남. 그 전 1~2시간 추정 트레이스가 비효율

### 관련
- 해결 커밋: `60fa1a8` (npm run deploy:prod 스크립트 + DEPLOY.md 가이드)
- 안전망 커밋: `9fa6eaa` (로그인 12초 timeout), `0c2b19f` (Supabase v2.88 고정)
- 관련 파일: `package.json`, `DEPLOY.md`, `src/features/auth/LoginPage.tsx`, `src/services/supabase.ts`

---

## 작성 가이드

### 새 사고 발생 시
1. **이 파일 최상단** (헤더 바로 아래) 에 새 entry 추가
2. 8개 항목 (증상·영향·진단·원인·해결·재발방지·관련) 모두 채움
3. 진단 과정의 **잘못된 가설도 기록** — 다음 사고 시 같은 trace 회피
4. 시간·커밋·명령어 등 구체 데이터 기록

### entry 작성 톤
- "사용자가 ~를 봤다" 형태로 증상 객관 서술
- 진단 과정은 시간순·시도순 정리
- 진짜 원인은 1줄로 결론 명확히
- 해결 명령은 복붙 가능한 형태로

### 사고 분류 태그 (선택)
- `[infra]` — Vercel/Supabase/PG 등 외부 인프라
- `[code]` — 우리 코드 버그
- `[config]` — 환경변수·빌드 설정
- `[data]` — DB 데이터 무결성
- `[security]` — 인증·권한·보안
- `[ui]` — 화면 깨짐·표시 오류
