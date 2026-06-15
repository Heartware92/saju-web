/**
 * GET /api/admin/analytics/summary
 * 유입·이탈 분석: 유입 출처(네이버/구글/직접/SNS) · 일별 방문자 추이 ·
 *                 진입/이탈 경로 · 인기 페이지 · 이탈률(bounce) · 디바이스.
 *
 * 데이터원: public.analytics_events (마이그레이션 046, 익명 페이지뷰 로그).
 * 집계 방식: 최근 30일 행을 페이지네이션으로 모두 읽어 JS 에서 집계(런칭 규모 적정).
 *           무성 절단 금지 — MAX_ROWS 초과 시 truncated=true 로 알림.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../../_auth';
import { cached, shouldForce } from '../../_cache';
import { excludedUserIds, filterExcludedRows, excludeUsers } from '../../_excluded';
import { resolveAudience, includeAudience } from '../../_audience';
import { cachedLoadAdminBundle } from '../../_userAggregates';

const CACHE_KEY = 'admin:analytics:summary:v1';
const TTL_SECONDS = 60;
const KST_OFFSET_MIN = 540;
const WINDOW_DAYS = 30;
const PAGE = 1000;
const MAX_ROWS = 120_000; // 안전 상한(약 30일치 충분). 초과 시 truncated 표시 후 집계.

interface EventRow {
  session_id: string;
  visitor_id: string | null;
  user_id: string | null;
  event_type: string;
  path: string;
  referrer: string | null;
  utm_source: string | null;
  device: string | null;
  created_at: string;
}

function toKst(iso: string) {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MIN * 60_000);
}
function dayKey(iso: string): string {
  return toKst(iso).toISOString().slice(0, 10);
}
function lastNDays(n: number): string[] {
  const kstNow = new Date(Date.now() + KST_OFFSET_MIN * 60_000);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(kstNow);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// 분석 제외 경로 — 내부 테스트/검수용(/temp_*)·어드민(/admin)·인증 플로우(/auth/* — 소셜 로그인 콜백·동의·휴대폰 인증 등 전환용).
// 진입·이탈·인기·공유 집계에서 제외해 실제 콘텐츠 방문 통계만 남긴다.
const EXCLUDED_PATH_RE = /^\/(?:temp_|admin(?:\/|$)|auth\/)/i;

/** first-touch referrer + utm_source 로 유입 채널 분류 */
function classifySource(referrer: string | null, utmSource: string | null): string {
  const u = (utmSource ?? '').toLowerCase();
  if (u) {
    if (u.includes('naver')) return '네이버';
    if (u.includes('google')) return '구글';
    if (u.includes('kakao') || u.includes('daum')) return '카카오/다음';
    if (u.includes('insta') || u.includes('facebook') || u.includes('meta')) return 'SNS';
    return `UTM:${u}`;
  }
  const ref = referrer ?? '';
  if (!ref.trim()) return '직접 유입';
  let host = ref.toLowerCase();
  try {
    host = new URL(ref).hostname.toLowerCase();
  } catch {
    /* URL 파싱 실패 → 원문 일부로 판정 */
  }
  // 자기참조(우리 도메인) + 결제·로그인 리다이렉트 도메인은 외부 유입이 아니므로 '직접 유입'으로 흡수.
  // 네이버/구글 등 실제 검색 유입 판정보다 먼저 걸러야 accounts.google.com(로그인) 등이 '구글'로 오분류되지 않음.
  const INTERNAL_OR_REDIRECT = [
    '2000-saju.com',                                 // 자기참조(self-referral)
    'inicis', 'tosspayments', 'portone', 'iamport',  // 결제(PG) 왕복
    'accounts.google.com', 'kauth.kakao.com', 'accounts.kakao.com', // 소셜 로그인 리다이렉트
    'supabase.co',                                   // 인증 리다이렉트
  ];
  if (INTERNAL_OR_REDIRECT.some((h) => host.includes(h))) return '직접 유입';
  if (host.includes('naver')) return '네이버';
  if (host.includes('google')) return '구글';
  if (host.includes('daum') || host.includes('kakao')) return '카카오/다음';
  if (host.includes('bing')) return 'Bing';
  if (
    host.includes('instagram') || host.includes('facebook') || host.includes('fb.') ||
    host.includes('t.co') || host.includes('twitter') || host.includes('youtube') ||
    host.includes('threads') || host.includes('tiktok')
  ) {
    return 'SNS';
  }
  return `기타(${host})`;
}

async function fetchWindowRows(sinceIso: string): Promise<{ rows: EventRow[]; truncated: boolean }> {
  const rows: EventRow[] = [];
  let truncated = false;
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('analytics_events')
      .select('session_id,visitor_id,user_id,event_type,path,referrer,utm_source,device,created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error('[analytics summary] 조회 실패:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    rows.push(...(data as EventRow[]));
    if (data.length < PAGE) break;
    if (from + PAGE >= MAX_ROWS) truncated = true;
  }
  return { rows, truncated };
}

function topN(counts: Map<string, number>, n: number) {
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/**
 * 범위(range) 재방문율 D7/D30.
 *  - 코호트: 최초 방문(visitor 기준)이 N일 이전이라 N일 관찰창이 확보된 방문자.
 *  - 재방문: 최초 방문일 이후 ~ 최초+N일 사이에 다른 날(달력일) 방문이 1회 이상.
 *  - 데이터: 최근 60일 visitor_id/created_at. (서비스 초기엔 전체 이력과 사실상 동일)
 *  - 한계: 60일보다 오래된 첫 방문은 관측 불가 → 초기에는 표본이 작을 수 있음.
 */
async function computeRetention(excluded: Set<string>, audience: Set<string> | null) {
  const RET_DAYS = 60;
  const sinceIso = new Date(Date.now() - RET_DAYS * 86_400_000).toISOString();
  const rows: { visitor_id: string | null; user_id: string | null; created_at: string }[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('analytics_events')
      .select('visitor_id,user_id,created_at')
      .eq('event_type', 'pageview')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  // visitor 별 방문 타임스탬프 모음 (슈퍼/테스트 계정 제외)
  const byVisitor = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.visitor_id) continue;
    if (r.user_id && excluded.has(r.user_id)) continue;
    // 오디언스 필터 활성 시: 코호트 user_id 만(비로그인 방문은 인구통계 식별 불가 → 제외)
    if (audience && !(r.user_id && audience.has(r.user_id))) continue;
    const ts = new Date(r.created_at).getTime();
    const arr = byVisitor.get(r.visitor_id);
    if (arr) arr.push(ts);
    else byVisitor.set(r.visitor_id, [ts]);
  }
  const dayOf = (ms: number) => Math.floor((ms + KST_OFFSET_MIN * 60_000) / 86_400_000);
  const now = Date.now();
  const calc = (n: number) => {
    let cohort = 0;
    let returned = 0;
    const windowMs = n * 86_400_000;
    for (const visits of byVisitor.values()) {
      const first = Math.min(...visits);
      if (now - first < windowMs) continue; // 관찰창 미확보
      cohort++;
      const firstDay = dayOf(first);
      if (visits.some((t) => t > first && t <= first + windowMs && dayOf(t) !== firstDay)) returned++;
    }
    return { cohort, rate: cohort ? Math.round((returned / cohort) * 1000) / 10 : 0 };
  };
  const d7 = calc(7);
  const d30 = calc(30);
  return {
    d7Rate: d7.rate,
    d7Cohort: d7.cohort,
    d30Rate: d30.rate,
    d30Cohort: d30.cohort,
  };
}

interface FunnelResult {
  windowDays: number;
  /** 방문 → 가입 (visitor 키 · signup 이벤트 기반 · 배포 이후 데이터부터 축적) */
  visitorToSignup: { visitors: number; signedUp: number; rate: number };
  /** 최근 N일 신규 가입자 코호트의 행동 깔때기 (user 키) */
  cohort: {
    signups: number;
    ran: number;       // 풀이(사주/타로) 1회 이상 실행
    attempt: number;   // 결제 1회 이상 시도(상태 무관)
    complete: number;  // 결제 1회 이상 완료
    ranRate: number;
    attemptRate: number;
    completeRate: number;
  };
  /** 최근 N일 생성 주문의 결과 분해 (주문 단위) */
  paymentOutcome: {
    total: number;
    completed: number;
    failed: number;
    cancelled: number;
    pending: number;
    refunded: number;
  };
}

/**
 * 전환 깔때기 — 결제·크레딧 코드를 건드리지 않고 기존 테이블에서만 읽어 집계.
 *  - 방문→가입: analytics_events 의 signup 이벤트(visitor_id 보유)로 동일 키 정확 집계.
 *  - 코호트: 최근 N일 가입자 중 풀이 실행/결제 시도/결제 완료까지 도달한 비율.
 *    (신규 가입자라 saju/tarot 누적 카운트가 사실상 기간 내 활동과 동일)
 *  - 결제 결과: orders 전 상태(완료/실패/취소/대기/환불) 분해 — "결제하다 어디서 이탈" 진단.
 * 제외 계정·오디언스 필터를 모든 단계에 일관 적용. 표본이 적은 베타 단계에 맞춘 단순 집계.
 */
async function computeFunnel(
  audience: Set<string> | null,
  excluded: Set<string>,
  totalVisitors: number,
  filteredRows: EventRow[],
): Promise<FunnelResult> {
  // 기간 경계는 숫자(ms)로 비교 — created_at 이 'Z'/'+00:00' 등 포맷이 섞여도 안전.
  const sinceMs = Date.now() - WINDOW_DAYS * 86_400_000;

  // ── 방문 → 가입 (signup 이벤트의 고유 visitor) ──
  const signupVisitors = new Set<string>();
  for (const r of filteredRows) {
    if (r.event_type === 'signup' && r.visitor_id) signupVisitors.add(r.visitor_id);
  }
  const visitorToSignup = {
    visitors: totalVisitors,
    signedUp: signupVisitors.size,
    rate: totalVisitors ? Math.round((signupVisitors.size / totalVisitors) * 1000) / 10 : 0,
  };

  // ── 코호트(최근 N일 가입자) 행동 + 결제 결과 ──
  const bundle = await cachedLoadAdminBundle();
  // 주문 전 상태 — 제외/오디언스 적용. 시도(상태 무관) 유저 집합 + 기간 내 결과 분해 둘 다에 사용.
  const ordersRes = await includeAudience(
    excludeUsers(supabaseAdmin.from('orders').select('user_id, status, created_at'), excluded),
    audience,
  );
  const allOrders = (ordersRes.data ?? []) as { user_id: string; status: string; created_at: string }[];
  const attemptUsers = new Set<string>();
  for (const o of allOrders) if (o.user_id) attemptUsers.add(o.user_id);

  let signups = 0, ran = 0, attempt = 0, complete = 0;
  for (const u of bundle.users) {
    const createdMs = u.created_at ? new Date(u.created_at).getTime() : 0;
    if (!createdMs || createdMs < sinceMs) continue;        // 최근 N일 가입자만
    if (excluded.has(u.id)) continue;                        // 슈퍼/테스트 계정 제외
    if (audience && !audience.has(u.id)) continue;           // 오디언스 코호트 한정
    signups++;
    const didRun =
      (bundle.sajuCountByUser.get(u.id) ?? 0) > 0 ||
      (bundle.tarotCountByUser.get(u.id) ?? 0) > 0;
    if (didRun) ran++;
    if (attemptUsers.has(u.id)) attempt++;
    if (bundle.ordersByUser.has(u.id)) complete++;           // ordersByUser 는 completed 만 보유
  }
  const pct = (n: number) => (signups ? Math.round((n / signups) * 1000) / 10 : 0);

  // ── 결제 결과 분해 (기간 내 생성 주문, 주문 단위) ──
  const outcome = { total: 0, completed: 0, failed: 0, cancelled: 0, pending: 0, refunded: 0 };
  for (const o of allOrders) {
    if (!o.created_at || new Date(o.created_at).getTime() < sinceMs) continue;
    outcome.total++;
    if (o.status === 'completed') outcome.completed++;
    else if (o.status === 'failed') outcome.failed++;
    else if (o.status === 'cancelled') outcome.cancelled++;
    else if (o.status === 'pending') outcome.pending++;
    else if (o.status === 'refunded') outcome.refunded++;
  }

  return {
    windowDays: WINDOW_DAYS,
    visitorToSignup,
    cohort: {
      signups, ran, attempt, complete,
      ranRate: pct(ran), attemptRate: pct(attempt), completeRate: pct(complete),
    },
    paymentOutcome: outcome,
  };
}

async function computeSummary(audience: Set<string> | null) {
  const sinceIso = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const { rows: allRows, truncated } = await fetchWindowRows(sinceIso);
  // 슈퍼/테스트 계정(로그인 상태)의 페이지뷰 제외. 비로그인(user_id=null)은 식별 불가라 유지.
  const excluded = await excludedUserIds();
  let filtered = filterExcludedRows(allRows, excluded);
  // 오디언스 필터 활성 시: 해당 코호트 user_id 이벤트만. 비로그인(user_id=null)은 인구통계 식별 불가 → 제외.
  if (audience) filtered = filtered.filter((r) => r.user_id !== null && audience.has(r.user_id));
  // 페이지뷰 집계와 공유(상호작용) 이벤트를 분리 — 공유 이벤트가 방문/이탈 통계를 오염시키지 않게.
  const rows = filtered.filter((r) => r.event_type === 'pageview' && !EXCLUDED_PATH_RE.test(r.path));
  const shareRows = filtered.filter(
    (r) => (r.event_type === 'share_kakao' || r.event_type === 'share_url') && !EXCLUDED_PATH_RE.test(r.path),
  );

  // ── 공유 페이지 집계: 어느 화면을 어떤 채널(카톡/URL복사)로 공유하는지 ──
  const sharePageChannel = new Map<string, { kakao: number; url: number }>();
  let shareKakao = 0;
  let shareUrl = 0;
  for (const r of shareRows) {
    const e = sharePageChannel.get(r.path) ?? { kakao: 0, url: 0 };
    if (r.event_type === 'share_kakao') { e.kakao++; shareKakao++; }
    else { e.url++; shareUrl++; }
    sharePageChannel.set(r.path, e);
  }
  // path별 (카톡+URL) 합계 상위 12개 — 채널 분해 포함
  const sharePagesDetailed = [...sharePageChannel.entries()]
    .map(([key, c]) => ({ key, kakao: c.kakao, url: c.url, count: c.kakao + c.url }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // ── 세션별 첫/마지막 이벤트 (rows 는 created_at asc 정렬) ──
  interface Sess { first: EventRow; last: EventRow; count: number; }
  const sessions = new Map<string, Sess>();
  const visitors = new Set<string>();
  const pagePv = new Map<string, number>(); // 페이지별 페이지뷰
  const deviceCount = new Map<string, number>();

  for (const r of rows) {
    const s = sessions.get(r.session_id);
    if (!s) sessions.set(r.session_id, { first: r, last: r, count: 1 });
    else { s.last = r; s.count++; }
    if (r.visitor_id) visitors.add(r.visitor_id);
    pagePv.set(r.path, (pagePv.get(r.path) ?? 0) + 1);
    const dev = r.device ?? 'unknown';
    deviceCount.set(dev, (deviceCount.get(dev) ?? 0) + 1);
  }

  // ── 유입 출처 / 진입·이탈 경로 / 바운스 / 로그인 세션 ──
  const sourceCount = new Map<string, number>();
  const entryCount = new Map<string, number>();
  const exitCount = new Map<string, number>();
  let bounceSessions = 0;
  let loggedInSessions = 0;

  for (const s of sessions.values()) {
    const src = classifySource(s.first.referrer, s.first.utm_source);
    sourceCount.set(src, (sourceCount.get(src) ?? 0) + 1);
    entryCount.set(s.first.path, (entryCount.get(s.first.path) ?? 0) + 1);
    exitCount.set(s.last.path, (exitCount.get(s.last.path) ?? 0) + 1);
    if (s.count === 1) bounceSessions++;
    if (s.first.user_id || s.last.user_id) loggedInSessions++;
  }

  // ── 일별 추이 (KST, 30일) ──
  const days = lastNDays(WINDOW_DAYS);
  const dayAgg = new Map<string, { sessions: Set<string>; visitors: Set<string>; pv: number }>();
  for (const d of days) dayAgg.set(d, { sessions: new Set(), visitors: new Set(), pv: 0 });
  for (const r of rows) {
    const agg = dayAgg.get(dayKey(r.created_at));
    if (!agg) continue;
    agg.sessions.add(r.session_id);
    if (r.visitor_id) agg.visitors.add(r.visitor_id);
    agg.pv++;
  }
  const daily = days.map((d) => {
    const a = dayAgg.get(d)!;
    return { date: d, sessions: a.sessions.size, visitors: a.visitors.size, pageviews: a.pv };
  });

  const totalSessions = sessions.size;
  const retention = await computeRetention(excluded, audience);
  const funnel = await computeFunnel(audience, excluded, visitors.size, filtered);

  return {
    truncated,
    funnel,
    kpi: {
      sessions: totalSessions,
      visitors: visitors.size,
      pageviews: rows.length,
      bounceRate: totalSessions ? Math.round((bounceSessions / totalSessions) * 1000) / 10 : 0,
      loggedInRate: totalSessions ? Math.round((loggedInSessions / totalSessions) * 1000) / 10 : 0,
      ...retention,
    },
    sources: topN(sourceCount, 12),
    daily,
    entryPages: topN(entryCount, 12),
    exitPages: topN(exitCount, 12),
    topPages: topN(pagePv, 12),
    devices: topN(deviceCount, 5),
    sharePages: sharePagesDetailed.map(({ key, count }) => ({ key, count })),
    sharePagesDetailed,
    shareChannels: { kakao: shareKakao, url: shareUrl, total: shareKakao + shareUrl },
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { cacheSuffix, audience } = await resolveAudience(request);
  const data = await cached(`${CACHE_KEY}${cacheSuffix}`, () => computeSummary(audience), {
    ttl: TTL_SECONDS,
    force: shouldForce(request),
  });

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
  });
}
