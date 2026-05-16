# 배포 가이드

## 항상 안전하게 배포하려면

```bash
npm run deploy:prod
```

이 스크립트는 자동으로:

1. **stale env 파일 제거** — `.vercel/.env.production.local` 삭제
2. **최신 Vercel env pull** — Vercel 대시보드의 현재 환경변수 다운로드
3. **빌드 cache 완전 정리** — `.next`·`.vercel/output`·`node_modules/.cache`
4. **fresh build** — `vercel build --prod` (옛 chunk 재사용 방지)
5. **deploy** — `vercel deploy --prebuilt --prod`

## 왜 필요한가 — 2026-05-16 사고 회고

**증상**: 사용자가 마이그레이션 후 모든 페이지에서 "로그인 중…" 무한 멈춤.

**진짜 원인**:
- `.vercel/.env.production.local` 파일이 5월 12일 첫 vercel link 시 생성된 후 갱신 안 됨
- 그 파일에는 마이그레이션 전 Mumbai 프로젝트 URL(`qfnbjbtxxrwyqvhdehgw`)이 박혀있음
- `vercel build --prod` 가 이 stale local env 를 우선 사용 → 옛 URL inline 된 JS chunk 생성
- 5월 15일 마이그레이션 + Mumbai pause → 24시간 후 (5월 16일 19:30) DNS 완전 제거
- 사용자 브라우저가 chunk 의 옛 URL 로 refresh_token 호출 → `ERR_NAME_NOT_RESOLVED` → 무한 retry hang

→ Vercel 대시보드 env 가 새 URL 로 변경됐어도 `.vercel/.env.production.local` 은 **명시 갱신 안 하면 stale**. 이 파일은 `.gitignore` 라서 git 추적도 안 됨.

## 환경변수 변경 시 절대 잊지 말기

Vercel 대시보드에서 env 수정 후 **반드시** 로컬 `.vercel/.env.production.local` 도 갱신:

```bash
rm -f .vercel/.env.production.local
vercel env pull .vercel/.env.production.local --environment=production --yes
```

또는 그냥 `npm run deploy:prod` — 자동 처리됨.

## 점검 — 빌드된 chunk 가 올바른 URL 박혔는지

```bash
# 새 빌드 후
grep -l "ebrkalrixwxdyhzekkwt" .vercel/output/static/_next/static/chunks/*.js | wc -l
# (1 이상 — 새 URL 박힘 확인)

grep -l "qfnbjbtxxrwyqvhdehgw" .vercel/output/static/_next/static/chunks/*.js | wc -l
# (0 — 옛 URL 박힘 없음)
```

## 운영 안전망

- **Supabase JS 버전 고정**: `@supabase/supabase-js@2.88.0` — v2.89.0+ 의 `signInWithPassword` deadlock 버그 회피
- **로그인 12초 timeout**: `LoginPage.tsx` 의 `Promise.race` — 응답 없으면 자동 해제 + storage 정리
- **환불 atomic RPC**: `refund_order_atomic` — balance·purchased counters + order status 단일 트랜잭션
- **RLS 정책**: user_credits·birth_profiles·saju_records·orders 모두 `auth.uid()` 기반 보호

## Supabase 마이그레이션 시 체크리스트

1. 새 프로젝트 생성 + 마이그레이션 적용
2. **Vercel 대시보드 → Settings → Environment Variables → `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` 모두 갱신**
3. `.env.local` 도 새 값으로 (개발 환경 일관성)
4. **`npm run deploy:prod`** — stale env 자동 정리 + fresh build
5. **Google·Kakao Console 의 redirect URI 갱신** — `https://새URL.supabase.co/auth/v1/callback`
6. Supabase Authentication > URL Configuration: Site URL · Redirect URLs 등록
7. OAuth Provider Client Secret 재입력 (마이그레이션 도구가 비밀값 안 옮김)
8. 옛 프로젝트는 **최소 7일 이상 유지** — pause 후 DNS 완전 제거되기 전에 충분히 catch-up
