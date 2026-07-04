/**
 * GET /api/admin/users/summary
 * 전체 회원 인구통계 + 세그먼트 카운트 + 월별 가입 코호트.
 * KPI 바 + 도넛/막대 차트용 집계 전용.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../_auth';
import { cachedLoadAdminBundle, aggregateUsers } from '../../_userAggregates';
import { shouldForce } from '../../_cache';
import { AGE_BUCKETS, NEW_DAYS } from '@/constants/adminLabels';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const bundle = await cachedLoadAdminBundle({ force: shouldForce(request) });
  // 분석 제외 계정은 회원 KPI/인구통계 집계에서 빼고, 회원 목록 라우트에서만 보인다.
  const users = aggregateUsers(bundle).filter(u => !u.analyticsExcluded);
  const now = Date.now();

  // ── 성별 분포 ─────────────────────────────
  const gender = { male: 0, female: 0, unknown: 0 };
  for (const u of users) gender[u.gender] += 1;

  // ── 연령대 분포 ───────────────────────────
  const ageCounts: Record<string, number> = {};
  for (const b of AGE_BUCKETS) ageCounts[b.key] = 0;
  for (const u of users) ageCounts[u.ageBucket] = (ageCounts[u.ageBucket] ?? 0) + 1;

  // ── 가입 경로 ────────────────────────────
  const provider: Record<string, number> = {};
  for (const u of users) provider[u.provider] = (provider[u.provider] ?? 0) + 1;

  // ── 월별 가입 코호트 (최근 12개월) ─────────
  const cohort: Array<{ month: string; count: number }> = [];
  const cohortMap = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    cohortMap.set(key, 0);
  }
  for (const u of users) {
    const d = new Date(u.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (cohortMap.has(key)) cohortMap.set(key, (cohortMap.get(key) ?? 0) + 1);
  }
  for (const [month, count] of cohortMap) cohort.push({ month, count });

  // ── 일별 가입 코호트 (최근 30일, KST) ─────
  const KST_OFFSET_MIN = 540;
  const dayKeyKst = (iso: string) => new Date(new Date(iso).getTime() + KST_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
  const kstNow = new Date(Date.now() + KST_OFFSET_MIN * 60_000);
  const dayMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(kstNow);
    d.setUTCDate(d.getUTCDate() - i);
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const u of users) {
    const key = dayKeyKst(u.createdAt);
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
  }
  const cohortDaily = [...dayMap.entries()].map(([date, count]) => ({ date, count }));

  // ── 세그먼트 카운트 ───────────────────────
  const segments = { new: 0, active: 0, dormant: 0, vip: 0, paying: 0, free: 0 };
  for (const u of users) {
    for (const s of u.segments) segments[s] += 1;
  }

  // ── KPI ─────────────────────────────────
  const totalUsers = users.length;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 86400000);

  const joinedToday = users.filter(u => new Date(u.createdAt) >= todayStart).length;
  const joinedYesterday = users.filter(u => {
    const t = new Date(u.createdAt);
    return t >= yesterdayStart && t < todayStart;
  }).length;
  const joined7d = users.filter(u => new Date(u.createdAt) >= sevenDaysAgo).length;
  const joined30d = users.filter(u => new Date(u.createdAt) >= thirtyDaysAgo).length;
  const payingTotal = users.filter(u => u.orderCount > 0).length;
  const conversionRate = totalUsers > 0 ? Math.round((payingTotal / totalUsers) * 1000) / 10 : 0;

  return NextResponse.json(
    {
      kpi: {
        totalUsers, joinedToday, joinedYesterday, joined7d, joined30d,
        payingTotal, conversionRate, newDaysWindow: NEW_DAYS,
      },
      gender, ageCounts, provider, cohort, cohortDaily, segments,
    },
    { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } },
  );
}
