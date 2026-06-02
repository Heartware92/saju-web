/**
 * 오디언스 필터 — 인구통계/세그먼트로 "어떤 유저들"만 슬라이스해 모든 어드민 집계에 적용.
 *
 * 배경: 어드민의 매출·이용·크레딧·기록·유입 집계를 "20대 여성", "네이버 유입", "VIP" 같은
 *       코호트로 좁혀서 보고 싶다. _excluded(제외 집합)의 대칭 — 이쪽은 "포함 집합".
 *
 * 동작: 글로벌 필터 바가 보내는 f_* 파라미터를 받아, 조건에 맞는 user_id 집합을 만든다.
 *       유저별 속성(성별/연령대/세그먼트/가입경로/가입일)은 _userAggregates 번들을 재사용
 *       (추가 쿼리 없음). 번들은 이미 슈퍼/테스트 계정을 제외하므로 오디언스도 자동으로 깨끗.
 *
 * 적용: 각 라우트에서 excludeUsers() 가 들어간 자리에 includeAudience(query, ids) 를 같이 건다.
 *       audience=null(필터 없음) 이면 아무것도 안 건다(= 전체).
 *
 * 한계: analytics_events 는 비로그인 페이지뷰의 user_id 가 null 이라, 인구통계 필터를 걸면
 *       로그인 상태 트래픽만 잡힌다(익명 방문은 나이/성별 식별 불가 — 불가피). UI 에 명시.
 *
 * 규모 주의:
 *  1) 모집단 절단: 오디언스는 _userAggregates 번들에서 유도되는데, 그 번들의
 *     auth.admin.listUsers 가 perPage 1000 단일 페이지라 회원이 1000명을 넘으면
 *     1001번째부터 코호트에서 무성 누락된다(코호트 필터가 "앞 1000명"으로 조용히 좁혀짐).
 *     회원 1000 접근 시 listUsers 페이지네이션 + truncated 경고 도입 필요.
 *  2) .in() 크기: user_id 집합을 .in() 으로 거는 단순 방식이라 코호트가 수천 명이면
 *     쿼리가 비대해진다. 그 규모에선 join/RPC 기반으로 전환 필요(지금 규모엔 충분).
 */
import type { NextRequest } from 'next/server';
import { cachedLoadAdminBundle, aggregateUsers } from './_userAggregates';
import { shouldForce } from './_cache';

export interface AudienceFilter {
  gender: string;     // male | female | unknown
  ageBucket: string;  // AgeBucketKey (쉼표구분 복수 허용)
  segment: string;    // new | active | dormant | vip | paying | free
  provider: string;   // email | google | kakao | apple | naver
  joinedFrom: string; // YYYY-MM-DD (가입일 시작)
  joinedTo: string;   // YYYY-MM-DD (가입일 종료, 해당일 포함)
}

export function parseAudience(searchParams: URLSearchParams): AudienceFilter {
  return {
    gender: searchParams.get('f_gender') ?? '',
    ageBucket: searchParams.get('f_ageBucket') ?? '',
    segment: searchParams.get('f_segment') ?? '',
    provider: searchParams.get('f_provider') ?? '',
    joinedFrom: searchParams.get('f_joinedFrom') ?? '',
    joinedTo: searchParams.get('f_joinedTo') ?? '',
  };
}

export function hasAudienceFilter(f: AudienceFilter): boolean {
  return !!(f.gender || f.ageBucket || f.segment || f.provider || f.joinedFrom || f.joinedTo);
}

/** 캐시 키에 붙일 안정적 필터 시그니처. 필터 조합마다 캐시를 분리해 오염 방지. */
export function audienceSignature(f: AudienceFilter): string {
  return [f.gender, f.ageBucket, f.segment, f.provider, f.joinedFrom, f.joinedTo].join('|');
}

/** 라우트에서 한 번에: 캐시 접미사(필터 없으면 '') + 오디언스 집합 */
export async function resolveAudience(req: NextRequest): Promise<{ cacheSuffix: string; audience: Set<string> | null }> {
  const f = parseAudience(new URL(req.url).searchParams);
  if (!hasAudienceFilter(f)) return { cacheSuffix: '', audience: null };
  const audience = await audienceUserIds(req);
  return { cacheSuffix: `:aud:${audienceSignature(f)}`, audience };
}

/**
 * 조건에 맞는 user_id 집합. 필터가 하나도 없으면 null(=전체, 아무 제약 안 검).
 * 번들이 이미 슈퍼/테스트 계정을 제외하므로 결과 집합도 그 계정들을 포함하지 않는다.
 */
export async function audienceUserIds(req: NextRequest): Promise<Set<string> | null> {
  const f = parseAudience(new URL(req.url).searchParams);
  if (!hasAudienceFilter(f)) return null;

  const bundle = await cachedLoadAdminBundle({ force: shouldForce(req) });
  // 분석 제외 계정은 코호트에서 제외(집계 라우트의 excludeUsers 와 이중 안전)
  let users = aggregateUsers(bundle).filter(u => !u.analyticsExcluded);

  if (f.gender) users = users.filter((u) => u.gender === f.gender);
  if (f.ageBucket) {
    const set = new Set(f.ageBucket.split(',').map((s) => s.trim()).filter(Boolean));
    users = users.filter((u) => set.has(u.ageBucket));
  }
  if (f.segment) users = users.filter((u) => u.segments.includes(f.segment as never));
  if (f.provider) users = users.filter((u) => u.provider === f.provider);
  if (f.joinedFrom) users = users.filter((u) => u.createdAt >= f.joinedFrom);
  if (f.joinedTo) users = users.filter((u) => u.createdAt <= `${f.joinedTo}T23:59:59.999Z`);

  return new Set(users.map((u) => u.id));
}

/**
 * 쿼리 빌더에 오디언스(.in('user_id', ...)) 적용.
 *  - audience=null  → 그대로(전체)
 *  - 빈 집합        → 매칭 0건이 되도록 불가능한 uuid 사용
 *  - userIdColumn 으로 컬럼명 지정 가능(기본 user_id)
 */
export function includeAudience<Q>(query: Q, audience: Set<string> | null, column = 'user_id'): Q {
  if (!audience) return query;
  const ids = audience.size ? [...audience] : ['00000000-0000-0000-0000-000000000000'];
  return (query as { in: (c: string, v: string[]) => Q }).in(column, ids);
}
