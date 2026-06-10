/**
 * GET /api/cron/expire-credits
 *
 * 유효기간(1년) 경과한 미사용 크레딧 lot 을 소멸시키고 거래내역에 로그를 남긴다.
 * (이용약관 제14조 / credit_lots 만료 회계 — 마이그 054)
 *
 * 트리거: Vercel Cron (vercel.json crons, 매일 03:00 KST = 18:00 UTC).
 * 인증: Vercel 은 CRON_SECRET 환경변수가 있으면 Authorization: Bearer <CRON_SECRET>
 *       헤더를 자동으로 붙인다. 이를 검증해 외부 호출을 차단한다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/expire-credits] CRON_SECRET 미설정 — 실행 거부');
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 });
  }
  const auth = req.headers.get('authorization') || '';
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.rpc('expire_credit_lots');
  if (error) {
    console.error('[cron/expire-credits] RPC 실패:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // rpc 는 단일 행 (expired_lots, expired_amount) 반환
  const row = Array.isArray(data) ? data[0] : data;
  const expiredLots = row?.expired_lots ?? 0;
  const expiredAmount = row?.expired_amount ?? 0;
  console.log(`[cron/expire-credits] 소멸 lot=${expiredLots} 크레딧=${expiredAmount}`);

  return NextResponse.json({ ok: true, expiredLots, expiredAmount });
}
