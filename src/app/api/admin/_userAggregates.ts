/**
 * 회원 집계 공통 유틸 — users, users/summary, users/[id] 에서 공유
 *
 * 전체 auth.users + birth_profiles(primary) + orders + credits + saju_records + tarot_records
 * 를 한 번에 불러와 user_id 기준으로 가공한다.
 *
 * 현재 MVP 스케일(수천 명)에서는 메모리 집계로 충분.
 * 유저 수가 수만 명 이상으로 늘면 Supabase RPC/View 로 전환 필요.
 */
import { supabaseAdmin } from '@/services/supabaseAdmin';
import {
  VIP_THRESHOLD_WON, NEW_DAYS, ACTIVE_DAYS, DORMANT_DAYS,
  bucketizeAge, type AgeBucketKey, type UserSegment,
} from '@/constants/adminLabels';
import { cached, type CachedOptions } from './_cache';
import { excludedUserIds, filterExcludedUsers } from './_excluded';

/** loadAdminBundle 캐시 키 — 전역 단일 (어드민 전체 집계는 한 덩어리) */
export const ADMIN_BUNDLE_CACHE_KEY = 'admin:bundle:v1';
/** 30초 TTL — 인스턴스 간 불일치 창 최소화 */
export const ADMIN_BUNDLE_TTL_SECONDS = 30;

export interface AggregatedUser {
  id: string;
  email: string;
  provider: string;
  createdAt: string;
  lastSignIn: string | null;
  // 본인 프로필(is_primary=true) 기준
  gender: 'male' | 'female' | 'unknown';
  birthDate: string | null;
  age: number | null;
  ageBucket: AgeBucketKey;
  birthPlace: string | null;
  profileCount: number;
  // 크레딧 (2026-05-16 달 단일 통합 — sun 필드 제거)
  moonBalance: number;
  totalMoonPurchased: number;
  // 매출
  totalSpent: number;
  orderCount: number;
  lastOrderAt: string | null;
  lastPackage: string | null;
  // 이용
  sajuCount: number;
  tarotCount: number;
  lastAnalysisAt: string | null;
  // 세그먼트
  segments: UserSegment[];
  daysSinceLastActivity: number | null;
}

export interface RawBundle {
  users: any[];                    // auth.users
  profiles: any[];                 // birth_profiles (primary + non-primary 모두)
  credits: Map<string, any>;
  ordersByUser: Map<string, any[]>; // completed만
  sajuCountByUser: Map<string, number>;
  sajuLastAtByUser: Map<string, string>;
  tarotCountByUser: Map<string, number>;
  tarotLastAtByUser: Map<string, string>;
}

/**
 * 캐시된 번들 로드 — 추천. 30초 TTL + in-flight dedup.
 * force: true 면 캐시 무시하고 새로 로드.
 */
export async function cachedLoadAdminBundle(opts?: CachedOptions): Promise<RawBundle> {
  return cached(
    ADMIN_BUNDLE_CACHE_KEY,
    loadAdminBundle,
    { ttl: ADMIN_BUNDLE_TTL_SECONDS, ...opts },
  );
}

/** 전체 데이터를 한 번에 로드 (캐시 미적용 raw 버전 — 테스트/디버그용) */
export async function loadAdminBundle(): Promise<RawBundle> {
  // auth.users — Supabase는 서버사이드 email 검색을 직접 지원하지 않아 전체 가져와 메모리 필터
  const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  // 슈퍼/테스트 계정 제외 — 여기서 걸러내면 회원 목록·인구통계·세그먼트·LTV 등
  // 이 번들을 쓰는 모든 라우트(users, users/summary, users/[id])에 일괄 반영된다.
  const excluded = await excludedUserIds();
  const users = filterExcludedUsers(authList?.users ?? [], excluded);

  const userIds = users.map(u => u.id);
  if (userIds.length === 0) {
    return {
      users: [], profiles: [],
      credits: new Map(), ordersByUser: new Map(),
      sajuCountByUser: new Map(), sajuLastAtByUser: new Map(),
      tarotCountByUser: new Map(), tarotLastAtByUser: new Map(),
    };
  }

  const [profilesRes, creditsRes, ordersRes, sajuRes, tarotRes] = await Promise.all([
    supabaseAdmin.from('birth_profiles')
      .select('user_id, name, relation, birth_date, birth_time, birth_place, gender, calendar_type, is_primary, memo, created_at')
      .in('user_id', userIds),
    supabaseAdmin.from('user_credits')
      .select('user_id, moon_balance, total_moon_purchased, total_moon_consumed, created_at')
      .in('user_id', userIds),
    supabaseAdmin.from('orders')
      .select('user_id, status, amount, package_id, package_name, created_at')
      .in('user_id', userIds)
      .eq('status', 'completed')
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('saju_records')
      .select('user_id, created_at')
      .in('user_id', userIds),
    supabaseAdmin.from('tarot_records')
      .select('user_id, created_at')
      .in('user_id', userIds),
  ]);

  const profiles = profilesRes.data ?? [];

  const credits = new Map<string, any>();
  for (const c of creditsRes.data ?? []) credits.set(c.user_id, c);

  const ordersByUser = new Map<string, any[]>();
  for (const o of ordersRes.data ?? []) {
    if (!ordersByUser.has(o.user_id)) ordersByUser.set(o.user_id, []);
    ordersByUser.get(o.user_id)!.push(o);
  }

  const sajuCountByUser = new Map<string, number>();
  const sajuLastAtByUser = new Map<string, string>();
  for (const r of sajuRes.data ?? []) {
    sajuCountByUser.set(r.user_id, (sajuCountByUser.get(r.user_id) ?? 0) + 1);
    const prev = sajuLastAtByUser.get(r.user_id);
    if (!prev || r.created_at > prev) sajuLastAtByUser.set(r.user_id, r.created_at);
  }

  const tarotCountByUser = new Map<string, number>();
  const tarotLastAtByUser = new Map<string, string>();
  for (const r of tarotRes.data ?? []) {
    tarotCountByUser.set(r.user_id, (tarotCountByUser.get(r.user_id) ?? 0) + 1);
    const prev = tarotLastAtByUser.get(r.user_id);
    if (!prev || r.created_at > prev) tarotLastAtByUser.set(r.user_id, r.created_at);
  }

  return {
    users, profiles,
    credits, ordersByUser,
    sajuCountByUser, sajuLastAtByUser,
    tarotCountByUser, tarotLastAtByUser,
  };
}

/** 원시 번들 → 회원별 집계 */
export function aggregateUsers(bundle: RawBundle): AggregatedUser[] {
  const now = Date.now();

  // user_id → primary profile / profileCount
  const primaryByUser = new Map<string, any>();
  const profileCountByUser = new Map<string, number>();
  for (const p of bundle.profiles) {
    profileCountByUser.set(p.user_id, (profileCountByUser.get(p.user_id) ?? 0) + 1);
    if (p.is_primary && !primaryByUser.has(p.user_id)) {
      primaryByUser.set(p.user_id, p);
    }
  }
  // primary 가 없는 유저는 가장 오래된 프로필을 대체로 사용
  for (const p of bundle.profiles) {
    if (!primaryByUser.has(p.user_id)) primaryByUser.set(p.user_id, p);
  }

  return bundle.users.map(u => {
    const primary = primaryByUser.get(u.id);
    const credit = bundle.credits.get(u.id);
    const orders = bundle.ordersByUser.get(u.id) ?? [];
    const lastOrder = orders[0] ?? null;
    const totalSpent = orders.reduce((s, o) => s + (o.amount ?? 0), 0);

    const sajuCount = bundle.sajuCountByUser.get(u.id) ?? 0;
    const tarotCount = bundle.tarotCountByUser.get(u.id) ?? 0;
    const sajuLast = bundle.sajuLastAtByUser.get(u.id);
    const tarotLast = bundle.tarotLastAtByUser.get(u.id);
    const lastAnalysisAt = [sajuLast, tarotLast].filter(Boolean).sort().reverse()[0] ?? null;

    // 나이 계산
    let age: number | null = null;
    if (primary?.birth_date) {
      const [y, m, d] = (primary.birth_date as string).split('-').map(Number);
      if (y && m && d) {
        const nowDate = new Date();
        age = nowDate.getFullYear() - y;
        const mm = nowDate.getMonth() + 1;
        const dd = nowDate.getDate();
        if (mm < m || (mm === m && dd < d)) age -= 1;
        if (age < 0 || age > 130) age = null;
      }
    }

    // 세그먼트
    const segments: UserSegment[] = [];
    const daysSinceJoin = (now - new Date(u.created_at).getTime()) / 86400000;
    if (daysSinceJoin <= NEW_DAYS) segments.push('new');

    const lastActivity = [lastAnalysisAt, u.last_sign_in_at].filter(Boolean).sort().reverse()[0];
    const daysSinceAct = lastActivity
      ? (now - new Date(lastActivity).getTime()) / 86400000
      : daysSinceJoin;

    if (lastAnalysisAt && (now - new Date(lastAnalysisAt).getTime()) / 86400000 <= ACTIVE_DAYS) {
      segments.push('active');
    }
    if (daysSinceAct >= DORMANT_DAYS) segments.push('dormant');

    if (totalSpent >= VIP_THRESHOLD_WON) segments.push('vip');
    if (orders.length > 0) segments.push('paying');
    else segments.push('free');

    return {
      id: u.id,
      email: u.email ?? '',
      provider: u.app_metadata?.provider ?? 'email',
      createdAt: u.created_at,
      lastSignIn: u.last_sign_in_at ?? null,
      gender: (primary?.gender as 'male' | 'female' | undefined) ?? 'unknown',
      birthDate: primary?.birth_date ?? null,
      age,
      ageBucket: bucketizeAge(primary?.birth_date),
      birthPlace: primary?.birth_place ?? null,
      profileCount: profileCountByUser.get(u.id) ?? 0,
      moonBalance: credit?.moon_balance ?? 0,
      totalMoonPurchased: credit?.total_moon_purchased ?? 0,
      totalSpent,
      orderCount: orders.length,
      lastOrderAt: lastOrder?.created_at ?? null,
      lastPackage: lastOrder?.package_name ?? null,
      sajuCount,
      tarotCount,
      lastAnalysisAt,
      segments,
      daysSinceLastActivity: lastActivity ? Math.floor(daysSinceAct) : null,
    };
  });
}
