import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';

/**
 * 이메일 가입 여부 조회 — 회원가입 폼 "중복 자동검사"용.
 *
 * 같은 이메일이 구글·카카오·이메일 중 무엇으로든 이미 가입돼 있으면,
 * 사용자가 모든 칸을 다 채우기 전에 미리 막아준다.
 * (Supabase 는 같은 이메일을 한 계정으로 자동 연결하므로, 다 적고 제출하면
 *  "이미 가입된 이메일" 에러가 나서 헛수고가 되는 걸 방지)
 *
 * 반환: { available: boolean, provider?: 'google'|'kakao'|'email' }
 *
 * NOTE(규모): 현재는 admin.listUsers 페이지네이션으로 이메일을 찾는다.
 *   가오픈~초기 규모(수천 명 이하)에선 충분. 사용자가 크게 늘면
 *   auth.users(email) 인덱스 기반 SECURITY DEFINER RPC 로 교체 권장.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PER_PAGE = 1000;
const MAX_PAGES = 50; // 안전 상한(최대 5만 명까지 스캔)

async function findUserByEmail(email: string) {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw error;
    const found = data.users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (found) return found;
    if (data.users.length < PER_PAGE) break; // 마지막 페이지
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: '올바른 이메일 형식이 아니에요.' }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ available: true });
    }

    const provider = (user.app_metadata?.provider as string | undefined) ?? 'email';
    return NextResponse.json({ available: false, provider });
  } catch (err) {
    console.error('[auth/check-email] error:', err);
    // 조회 실패 시엔 차단하지 않고 통과(가용성 우선). 최종 방어는 가입 제출 시 Supabase 에러.
    return NextResponse.json({ available: true });
  }
}
