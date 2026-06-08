/**
 * 회원가입 전화번호 중복 차단 — 예외 허용 리스트 관리 (어드민)
 *
 * 디폴트 = 차단(이미 가입된 번호면 회원가입 불가). 여기 등록된 번호만 중복 가입 허용.
 *
 *  GET    /api/admin/phone-allowlist            → 허용 번호 목록
 *  POST   /api/admin/phone-allowlist {phone,note} → 추가(upsert)
 *  DELETE /api/admin/phone-allowlist {phone}      → 삭제
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../_auth';

const normalize = (p: string) => (p ?? '').replace(/[^0-9]/g, '');

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { data, error } = await supabaseAdmin
    .from('phone_signup_allowlist')
    .select('phone, note, created_by, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  let body: { phone?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const phone = normalize(body.phone ?? '');
  if (!/^01[016789]\d{7,8}$/.test(phone)) {
    return NextResponse.json({ error: '올바른 휴대폰 번호를 입력해주세요.' }, { status: 400 });
  }
  const note = (body.note ?? '').trim() || null;

  const { error } = await supabaseAdmin
    .from('phone_signup_allowlist')
    .upsert({ phone, note, created_by: 'admin' }, { onConflict: 'phone' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, phone });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  let body: { phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const phone = normalize(body.phone ?? '');
  if (!phone) return NextResponse.json({ error: '번호가 필요합니다.' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('phone_signup_allowlist')
    .delete()
    .eq('phone', phone);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, phone });
}
