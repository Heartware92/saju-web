/**
 * 배포 버전 식별 — 클라이언트 캐시 버스터.
 * 사용자 브라우저가 옛 deployment 의 JS chunk 를 들고 있는 상태에서
 * 새 deployment 가 올라간 사고를 감지하기 위해 사용.
 *
 * 클라이언트는 주기적으로 이 endpoint 의 version 을 polling 하다가
 * 페이지 로드 시점의 version 과 달라지면 "새 버전" 배너를 띄움.
 *
 * Vercel 빌드 시점에 GIT_COMMIT_SHA 가 환경변수로 자동 주입됨.
 */
export const dynamic = 'force-static';
export const revalidate = false;

const VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  process.env.NEXT_PUBLIC_BUILD_ID ??
  process.env.GIT_COMMIT_SHA ??
  String(Date.now());

const BUILT_AT = new Date().toISOString();

export function GET() {
  return Response.json(
    { version: VERSION, builtAt: BUILT_AT },
    {
      headers: {
        // 짧은 캐시로 polling 비용 최소화. 새 배포 시 함수 자체가 재생성되어
        // VERSION 이 자동 갱신.
        'cache-control': 'public, max-age=60, s-maxage=60',
      },
    }
  );
}
