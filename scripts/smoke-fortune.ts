/**
 * 운세 풀이 체인 스모크 테스트 — "엔진 + 크레딧 + LLM + 잡"이 카테고리별로 도는지 자동 점검.
 *
 * 실행: cd saju-web && npx tsx scripts/smoke-fortune.ts
 *   (옵션) SMOKE_BASE_URL=http://localhost:3000  대상 서버
 *   (옵션) SMOKE_CATEGORIES=traditional,tarot     쉼표구분 카테고리 (기본: traditional)
 *
 * 동작: 테스트 계정 생성/재사용 → 크레딧 지급(grant_credit_atomic) → 토큰 발급 →
 *       /api/fortune/jobs/create 호출 → saju_records/tarot_records 잡 완료 폴링 → 결과 검증.
 *
 * 검증(객관): 잡 status=done/completed, 결과 텍스트 존재, 에러 없음. (품질 판단은 사람 몫)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { calculateSaju } from '../src/utils/sajuCalculator';

// ── .env.local 수동 로드 (tsx 는 자동 로드 안 함) ──
try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  console.warn('[smoke] .env.local 로드 실패 — 환경변수가 이미 있다고 가정');
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';
const CATEGORIES = (process.env.SMOKE_CATEGORIES ?? 'traditional').split(',').map((s) => s.trim());

const TEST_EMAIL = 'smoke-test@heartware.local';
const TEST_PW = 'SmokeTest!2026#qa';

if (!URL || !ANON || !SERVICE) {
  console.error('[smoke] 필수 env 누락 (URL/ANON/SERVICE). 중단.');
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitServer(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/api/payment/active-channel`, { method: 'GET' });
      if (r.status > 0) return true; // 응답만 오면 서버 준비됨
    } catch { /* 아직 기동 중 */ }
    await sleep(2000);
  }
  return false;
}

async function ensureUser(): Promise<string> {
  const { data } = await admin.auth.admin.createUser({
    email: TEST_EMAIL, password: TEST_PW, email_confirm: true,
  });
  if (data?.user) return data.user.id;
  // 이미 존재 → 조회
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const u = list?.users.find((x) => x.email === TEST_EMAIL);
  if (!u) throw new Error('테스트 유저 생성/조회 실패');
  return u.id;
}

async function grant(userId: string, amount: number) {
  const { data, error } = await admin.rpc('grant_credit_atomic', {
    p_user_id: userId, p_credit_type: 'moon', p_amount: amount,
    p_reason: '스모크 테스트 지급', p_idempotency_key: `smoke-grant:${Date.now()}`,
  });
  if (error) throw new Error('크레딧 지급 실패: ' + error.message);
  console.log(`  크레딧 지급: ${data} (+${amount}달)`);
}

async function getToken(): Promise<string> {
  const { data, error } = await anon.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PW });
  if (error || !data.session) throw new Error('로그인 실패: ' + (error?.message ?? ''));
  return data.session.access_token;
}

async function pollSaju(jobId: string, timeoutMs = 200000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await admin
      .from('saju_records')
      .select('id,status,error_message,interpretation_detailed,interpretation_basic')
      .eq('id', jobId)
      .maybeSingle();
    if (data && ['done', 'completed', 'failed'].includes(data.status)) return data;
    await sleep(3000);
  }
  return { status: 'timeout' as const };
}

const SAJU = calculateSaju(1992, 9, 14, 13, 22, 'male', false);
const SOURCE_BIRTH = {
  birthDate: '1992-09-14', birthTime: '13:22', birthPlace: '서울',
  gender: 'male' as const, calendarType: 'solar' as const,
};

function buildBody(category: string) {
  // v1: 서버가 prompt 를 만드는 카테고리(traditional)만. 나머지는 추후 prompt 빌더 연결.
  if (category === 'traditional') {
    return {
      category: 'traditional',
      sourceBirth: SOURCE_BIRTH,
      sajuResult: SAJU,
      idempotencyKey: `smoke-traditional-${Date.now()}`,
    };
  }
  throw new Error(`아직 미지원 카테고리(v1): ${category}`);
}

async function runOne(category: string, token: string) {
  console.log(`\n[${category}] 잡 생성 요청...`);
  let body: unknown;
  try { body = buildBody(category); } catch (e) {
    console.log(`  ⏭️  건너뜀: ${(e as Error).message}`);
    return { category, ok: false, skipped: true };
  }
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/fortune/jobs/create`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  console.log(`  생성 응답: ${res.status} ${JSON.stringify(json).slice(0, 160)}`);
  if (!res.ok || !json.jobId) {
    console.log(`  ❌ 잡 생성 실패`);
    return { category, ok: false };
  }
  console.log(`  폴링 중 (최대 ~3분)...`);
  const rec = await pollSaju(json.jobId);
  const text = (rec as any).interpretation_detailed || (rec as any).interpretation_basic || '';
  const secs = Math.round((Date.now() - t0) / 1000);
  console.log(`  상태=${rec.status} 결과길이=${text.length} 에러=${(rec as any).error_message ?? '없음'} (${secs}s)`);
  const ok = (rec.status === 'done' || rec.status === 'completed') && text.length > 100;
  console.log(ok ? `  ✅ ${category} 통과` : `  ❌ ${category} 실패`);
  return { category, ok };
}

async function main() {
  console.log('=== 운세 스모크 테스트 시작 ===');
  console.log(`대상: ${BASE} / 카테고리: ${CATEGORIES.join(', ')}`);
  console.log('서버 준비 대기...');
  if (!(await waitServer())) { console.error('❌ 서버가 준비되지 않음 (dev 서버 확인)'); process.exit(1); }
  console.log('서버 OK');

  const userId = await ensureUser();
  console.log('테스트 유저:', userId);
  await grant(userId, 100);
  const token = await getToken();
  console.log('토큰 발급 OK');

  const results = [];
  for (const c of CATEGORIES) results.push(await runOne(c, token));

  console.log('\n=== 요약 ===');
  for (const r of results) {
    console.log(`  ${r.ok ? '✅' : (r as any).skipped ? '⏭️ ' : '❌'} ${r.category}`);
  }
  const failed = results.filter((r) => !r.ok && !(r as any).skipped);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error('치명 오류:', e); process.exit(1); });
