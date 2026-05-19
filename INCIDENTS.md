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

## 2026-05-19 16:31 — 꿈해몽 5섹션 확장 작업 — 파일 분할 push 로 인한 prod 빌드 fail `[git]` `[재발]`

### 증상
- 사용자: 종합 분석 fix (9d5594e defaultOpen=true) 가 prod 에 반영 안 됨
- 사용자 화면에 여전히 종합 풀이 안 보임. "강력새로고침 + 새 풀이 + 보관함 다 안 보임"
- 본 세션이 3번 fix 시도 후에야 prod 빌드 실패 확인 — 너무 늦게 발견

### 영향 범위
- 9d5594e (defaultOpen=true), c812b17 (번호+한글 마커), e2f082b 등 본 세션의 모든 후속 fix 가 prod 반영 안 됨
- prod 사이트는 직전 ready 빌드 그대로 노출 — 새 변경 미반영
- 본 세션이 데이터·파싱·UI 만 의심하고 prod 빌드 상태를 처음부터 확인 안 한 게 진단 지연

### 진단 과정
1. Supabase MCP/CLI 로 raw 직접 조회 — `[comprehensive_analysis]` 마커 정상 확인 (3번)
2. Node.js 로 parseTaekilStructuredAdvice 시뮬레이션 — comprehensiveAnalysis 446자 추출 정상
3. SectionCollapsible defaultOpen=false 의심 → true 변경 (9d5594e) — 이것도 prod 반영 안 됨
4. **마지막에야** `vercel ls --prod` 로 빌드 상태 확인 — 최신 배포 Error 발견
5. `vercel inspect --logs` 로 에러 메시지:
   ```
   ./src/pages/MoreFortunePage.tsx:45:3
   Type error: Module '"../services/fortuneService"' has no exported member 'parseDreamSymbols'.
   ```
6. `git log -S "parseDreamSymbols"` → 780b993 (강조 변환 확장) 에 MoreFortunePage.tsx 만 들어가고 fortuneService.ts 누락
7. `git diff src/services/fortuneService.ts` → 워킹 디렉토리에 parseDreamSymbols/parseDreamAction/parseDreamSections 새 시그니처 모두 존재. **즉 다른 세션이 push 단계에서 fortuneService.ts 누락**

### 진짜 원인
**파일 분할 push 재발** — 직전 사고 (2026-05-19 00:40) 와 동일 패턴.
- A 파일 (MoreFortunePage.tsx) 이 B 파일 (fortuneService.ts) 의 새 export 사용
- A 만 push, B 는 워킹 디렉토리에 남음
- [[feedback_multi_session_git]] 메모에 적힌 패턴 — INCIDENTS.md 직전 entry 와 같은 사고

본 세션은 이 사고가 있는 줄도 모르고 데이터·파싱·UI 만 의심 — Vercel 빌드 상태 확인이 1순위 진단 항목이어야 했음.

### 해결
```bash
git add src/services/fortuneService.ts  # 다른 세션 작업이지만 빌드 막혀 비상 fix
npm run build  # 통과 확인
git commit -m "fix(build): fortuneService.ts 미푸시로 인한 prod 빌드 깨짐 복구"
git push
```

### 재발 방지
1. **"prod 에 fix 반영 안 됨" 신고 시 1순위 확인: Vercel 빌드 상태**
   - 데이터·파싱·UI 의심 전에 `vercel ls --prod` 부터.
   - 본 세션 INCIDENTS.md 룰 강화 후보.
2. push 전 체크 (이전 사고 재발 방지 룰):
   - `git status` 로 워킹 디렉토리 비었는지 확인
   - 새로 추가한 함수/export 가 import 측 파일과 함께 staged 됐는지 확인
3. 멀티 세션 작업 시 한 기능의 모든 파일을 한 커밋에 묶을 것

### 관련
- 커밋: 9d5594e (본 세션 fix), 780b993 (분할 push 사고 commit), 82db25c (꿈해몽 작업 시작)
- 파일: src/services/fortuneService.ts, src/pages/MoreFortunePage.tsx
- 이전 동일 사고: 본 파일 직전 entry (2026-05-19 00:40)
- 관련 메모: [[feedback_multi_session_git]]

---

## 2026-05-19 00:40 — 택일운세 흉신 모듈 작업 — 파일 분할 push 로 인한 prod 빌드 fail `[git]`

### 증상
- 사용자: "방금 배포 오류난거 같은데 어쩔때 한번씩 이렇게 배포 오류 나는 이유가 뭐지"
- Vercel 대시보드: 최신 production deployment (commit 32d161b) `● Error` 50s 후 fail
- prod 사이트는 직전 ready(22m 전) 빌드 그대로 노출 — 새 변경 미반영

### 영향 범위
- prod 배포 1회 fail (즉시 hotfix 가능했음)
- prod 사이트 자체는 직전 빌드 정상 운영 중이라 사용자 체감 영향 없음
- 단 우리가 작업한 글씨 크기·SectionCollapsible·종합 분석 마커가 prod 에 반영 안 됨

### 진단 과정
1. `vercel ls --prod` 로 최신 deployment 확인 — 50s 만에 Error
2. `vercel inspect <url> --logs` 로 빌드 로그 수집:
   ```
   ./src/constants/prompts.ts:4007:26
   Type error: Property 'sinsalHits' does not exist on type 'TaekilDay'.
   ```
3. `engine/taekil.ts` 의 TaekilDay 인터페이스 확인 → 우리 작업으로 `sinsalHits?: SinsalHit[]` 추가돼 있음 (workdir)
4. `git show 32d161b -- src/constants/prompts.ts | grep -c sinsalHits` → 2개 (sinsalHits 사용 코드 push 됨)
5. `git show 32d161b -- src/engine/taekil.ts | grep -c sinsalHits` → **0개** (인터페이스 정의 push 안 됨)
6. `git status` → engine/taekil.ts·engine/taekilSinsal.ts·TaekilPage·TaekilResultPage·fortuneService·taekilDetailHints 모두 **uncommitted 상태**

### 진짜 원인
**파일 분할 push** — A 파일(prompts.ts)이 B 파일(engine/taekil.ts)의 새 필드를 사용하는데, A 만 commit·push 되고 B 는 workdir 에만 남음.

세션 도중 사용자가 별도로 다른 작업(picked-date UI) 을 진행하며 commit 했고, 그 과정에서 prompts.ts 의 우리 변경이 일부 들어갔지만 인터페이스 정의가 있는 engine/taekil.ts 는 함께 staging 되지 않음. 32d161b commit 메시지는 우리 작업과 무관한 "시도/피하기 카드 본문 단어 박힘 해결" — 즉 다른 세션 commit 에 우리 변경 일부가 끼어들어 push 된 결과.

[[feedback_multi_session_git]] 메모에 적힌 그 패턴 그대로.

### 해결
1. workdir 의 남은 변경 모두 명시적 path 로 add (git add -A 금지 메모 준수):
   - `git add src/engine/taekil.ts src/engine/taekilSinsal.ts src/constants/taekilDetailHints.ts src/pages/TaekilPage.tsx src/pages/TaekilResultPage.tsx src/services/fortuneService.ts`
2. 하나의 commit 으로 묶어 push — 인터페이스 + 모듈 + 사용처가 같은 deployment 에 들어가도록.

### 재발 방지
- **A 파일이 B 파일의 새 타입을 사용하면 두 파일은 반드시 같은 commit**. 분할 금지.
- 작업 마무리 시 `git status` 로 modified 전체 확인 후 일괄 add (path 명시).
- 멀티 세션·멀티 터미널에서 동시 작업 시: 각 세션이 자기 변경 파일만 path 로 add. GUI 의 stage all 금지.
- 큰 변경 push 전 로컬 `npm run build` 로 prod 빌드 검증 (tsc --noEmit 만으로는 next build 의 strict 모드 차이를 못 잡을 수 있음 → 이번 사고처럼).

### 관련
- 32d161b — 빌드 fail 한 commit (prompts.ts 의 sinsalHits 만 들어감)
- 복구 commit — 본 entry hotfix
- [feedback_multi_session_git.md] — 동일 패턴 메모

---

## 2026-05-18 20:55 — 이름 풀이 6 섹션 카드 분리 실패 — AI 마커 누락 사고 `[code]`

### 증상
- 사용자: "또 텍스트 쭉~ 나오고 [summary] 같은 마커도 보여, 진짜 서비스 장애가 된다"
- 이름 풀이 결과가 6 섹션 카드(시각 컴포넌트 포함)로 분리되지 않고 단일 텍스트 블록으로 노출
- 본문에 `[summary]` 같은 마커가 그대로 보이는 케이스
- "다른 이름 풀이받기" 누르면 한자 선택 화면 없이 즉시 옛 결과로 가는 사고
- 어느 시점엔 입력조차 안 됨 (한글 타이핑이 즉시 빈 칸으로 리셋)

### 영향 범위
- 더많은운세 — 이름 풀이 카테고리 전부
- 신규 풀이 + 옛 보관함 record 양쪽 모두 깨져 보임
- 81 수리 4격 시각 컴포넌트(`NumerologyVisual`), 한자 자원오행 카드(`JaWonVisual`), 음령오행 분포(`EumRyeongVisual`), 강점·보완 박스(`HarmonyVisual`), 조언 카드(`AdviceVisual`) 5개 시각이 전부 작동 안 함 (sections 비어서 fallback 진입)
- 사용자 신뢰 큰 손상 — "같은 사고 또 났네" 반복 보고

### 진단 과정 — 잘못된 가설도 다 기록 (다음 trace 회피용)
1. ❌ **옛 캐시가 silent restore** 라고 추정 → `buildCacheKey` 에 `v2:` prefix 추가
   - 효과 없음. 새 풀이에도 사고 재발
2. ❌ **localStorage `report-cache` 잔재** 라고 추정 → handleRefetch 의 invalidate 강화
   - 효과 없음. fresh URL reload 후에도 동일
3. ❌ **archive 자동 진입** 으로 추정 → `findRecentArchive` 분기 검토
   - fresh=1 면 모달 skip 분기 정상 동작. 무관
4. ❌ **shouldAutoStart 에 name 잘못 포함** → 제거
   - 일부 해결. 하지만 fresh URL 진입 후에도 결과 화면 표시 계속됨
5. ❌ **silent restore useEffect 의 fresh 분기에 input state 리셋 추가**
   - 회귀 사고: useEffect deps 에 `koreanName` 있어 무한 리셋 루프 → 사용자가 타이핑하면 즉시 ''로 리셋 → 화면 멈춤
6. ❌ **`parseMarkerSections` 정규식 매칭 실패** 추정 → 대소문자·공백·콜론 변형 흡수 정규식 강화
   - 부분 효과. 그래도 사고 재발
7. ❌ **`MoreFortuneResultCard` fallback 의 마커 strip 부족** → strip 정규식 확장
   - fallback 깔끔하게 보이긴 함. 근데 6 카드 분리 자체는 안 됨
8. ✅ **사용자가 붙여준 raw 텍스트** 직접 분석 → 본문은 6 섹션 순서대로 정확히 쓰여 있는데 **마커 자체가 완전히 누락**
   - Gemini 가 prompt 의 [key] 형식 규칙 무시. 마커 안 박고 단락만 죽 출력
   - 1~7번 가설 모두 잘못 — 캐시·정규식 문제 아니라 **AI 응답 자체에 마커가 없는 것**

### 진짜 원인
**Gemini 가 prompt 의 마커 출력 규칙을 안 따름.** [summary]/[eum_ryeong]/[ja_won]/[harmony]/[numerology]/[advice] 6 마커를 본문 단락 앞에 줄 단독으로 출력해야 하는데, Gemini 가 마커 없이 단락만 쭉 작성. 본문은 가이드대로 6 섹션 순서 지키지만 마커가 없으니 `parseMarkerSections` 가 빈 객체 반환 → `setResultSections(null)` → 분기 조건 실패 → `MoreFortuneResultCard` 단일 카드 fallback.

### 해결
**3중 방어 + 1 회귀 fix**:

1. **`parseNameSections` 본문 키워드 fallback** (`fortuneService.ts`)
   - 1차: 마커 매칭. 3 섹션 미만 잡히면 2차 발동
   - 2차: 빈 줄로 단락 분리 → 키워드로 섹션 추론
     - "음령오행/초성/발음" → eum_ryeong
     - "자원오행/부수/확정 한자" → ja_won
     - "81 수리/원격/형격/N수 대길|대흉" → numerology
     - "조화/사주와/용신.*기신/보완/개명" → harmony
     - "- " 불릿 또는 "조언/실천/습관" (마지막 단락) → advice
     - 첫 단락 또는 결론 톤 → summary
   - summary 비면 첫 단락 강제

2. **Prompt 최상위 강제** (`prompts.ts:generateNameFortunePrompt`)
   ```
   ★★★★★ 최우선 절대 규칙 — 응답의 첫 글자가 반드시 "[summary]" 마커여야 합니다.
   ```
   - 응답 첫 줄을 [summary] 로 시작 강제
   - 마커 누락 시 풀이가 무너진다고 직접 경고
   - 영문 소문자 대괄호 [key] 고정

3. **`parseMarkerSections` 정규식 완화** — `i` flag + 마커 안팎 공백 + 콜론·기호 흡수. 마커는 박는데 형식이 살짝 다른 케이스 대비

4. **회귀 fix**: silent restore useEffect 에 input state 리셋을 절대 넣지 말 것. deps 에 input state 가 있어 무한 리셋 루프 발생. **별도 useEffect + ref 가드** 로 1회만 발동

### 재발 방지
- **AI 응답이 prompt 형식을 따른다고 가정하지 말 것** — Gemini·OpenAI 둘 다 마커 형식 종종 무시. 마커 + 본문 패턴 + 키워드 fallback 3중 안전망 표준화
- **새 prompt 도입 시 keyword fallback 미리 준비** — 학업·자녀·성격 등 다른 sectioned 풀이도 같은 위험. 마커 매칭 실패 케이스 fallback 추가 권장
- **사용자 raw 텍스트를 가장 먼저 분석** — 정규식·캐시 추측보다 raw 응답 직접 읽기가 5분이면 끝남. 1~7번 가설 trace 가 1시간 이상 소비됨
- **useEffect deps 와 setState 충돌 패턴 룰** — useEffect 안에서 state 를 reset 할 때, 그 state 가 같은 useEffect 의 deps 에 있으면 무한 루프. 별도 useEffect + ref 가드 필수
- **검증 우선** — 5초로 raw text 그렙해서 마커 유무 확인했으면 1번 시도에 해결됐을 사고. "정규식 강화"·"캐시 무효화" 같은 추정 trace 자제

### 관련
- 해결 커밋: `67393cd` (키워드 fallback + prompt ★★★★★)
- 추가 커밋: `9f2790a` (정규식 완화), `b581453` (무한 리셋 회귀 fix), `ad159ff` (fresh URL 입력 강제 + 코스트 문구 제거), `eb65ccb` (cacheKey v2 prefix + fallback strip)
- 관련 파일: `src/services/fortuneService.ts` (parseNameSections), `src/constants/prompts.ts` (generateNameFortunePrompt), `src/pages/MoreFortunePage.tsx` (silent restore useEffect)

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
