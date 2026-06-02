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
import { excludedUserIds, filterExcludedRows } from '../../_excluded';

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
      .select('session_id,visitor_id,user_id,path,referrer,utm_source,device,created_at')
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

async function computeSummary() {
  const sinceIso = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const { rows: allRows, truncated } = await fetchWindowRows(sinceIso);
  // 슈퍼/테스트 계정(로그인 상태)의 페이지뷰 제외. 비로그인(user_id=null)은 식별 불가라 유지.
  const excluded = await excludedUserIds();
  const rows = filterExcludedRows(allRows, excluded);

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

  return {
    truncated,
    kpi: {
      sessions: totalSessions,
      visitors: visitors.size,
      pageviews: rows.length,
      bounceRate: totalSessions ? Math.round((bounceSessions / totalSessions) * 1000) / 10 : 0,
      loggedInRate: totalSessions ? Math.round((loggedInSessions / totalSessions) * 1000) / 10 : 0,
    },
    sources: topN(sourceCount, 12),
    daily,
    entryPages: topN(entryCount, 12),
    exitPages: topN(exitCount, 12),
    topPages: topN(pagePv, 12),
    devices: topN(deviceCount, 5),
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const data = await cached(CACHE_KEY, computeSummary, {
    ttl: TTL_SECONDS,
    force: shouldForce(request),
  });

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
  });
}
