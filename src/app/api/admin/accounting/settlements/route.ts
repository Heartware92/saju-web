/**
 * PG 정산 실입금 기록 — 어드민 회계 탭 전용 (마이그레이션 057 admin_settlements)
 *
 *  GET    /api/admin/accounting/settlements            → 입금 목록(최신순) + PG별 합계
 *  POST   /api/admin/accounting/settlements {pg, depositedOn, amount, memo?} → 추가
 *  DELETE /api/admin/accounting/settlements {id}       → 삭제(오입력 정정)
 *
 * 저장된 입금 합계로 수수료(결제총액 − 입금누계)를 화면 재입력 없이 역산한다.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../../_auth';

type Pg = 'tosspay' | 'inicis';
const VALID_PG: Pg[] = ['tosspay', 'inicis'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { data, error } = await supabaseAdmin
    .from('admin_settlements')
    .select('id, pg, deposited_on, amount, memo, created_at')
    .order('deposited_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totals: Record<Pg, number> = { tosspay: 0, inicis: 0 };
  for (const r of data ?? []) {
    if (r.pg === 'tosspay' || r.pg === 'inicis') totals[r.pg as Pg] += r.amount ?? 0;
  }
  return NextResponse.json({ items: data ?? [], totals });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  let body: { pg?: string; depositedOn?: string; amount?: number; memo?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  const pg = body.pg as Pg;
  if (!VALID_PG.includes(pg)) return NextResponse.json({ error: 'pg는 tosspay 또는 inicis' }, { status: 400 });
  const depositedOn = (body.depositedOn ?? '').trim();
  if (!DATE_RE.test(depositedOn)) return NextResponse.json({ error: '입금일은 YYYY-MM-DD' }, { status: 400 });
  const amount = Number(body.amount ?? 0);
  if (!Number.isInteger(amount) || amount <= 0) return NextResponse.json({ error: '금액은 양의 정수' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('admin_settlements')
    .insert({ pg, deposited_on: depositedOn, amount, memo: (body.memo ?? '').trim() || null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  let body: { id?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });

  const { error } = await supabaseAdmin.from('admin_settlements').delete().eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
