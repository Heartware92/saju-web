/**
 * POST /api/inquiries — 새 문의 등록
 * GET  /api/inquiries — 본인 문의 목록 (최신순)
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';

const VALID_CATEGORIES = ['payment', 'bug', 'account', 'feedback', 'other'] as const;

async function authUserId(request: NextRequest): Promise<string | null> {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

export async function POST(request: NextRequest) {
  const userId = await authUserId(request);
  if (!userId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { category, content, contact_phone, contact_email } = body as {
    category?: string;
    content?: string;
    contact_phone?: string;
    contact_email?: string;
  };

  if (!category || !VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    return NextResponse.json({ error: '문의 유형을 선택해주세요.' }, { status: 400 });
  }
  const trimmedContent = (content ?? '').trim();
  if (!trimmedContent || trimmedContent.length > 2000) {
    return NextResponse.json(
      { error: trimmedContent ? '내용은 2000자 이내로 작성해주세요.' : '문의 내용을 입력해주세요.' },
      { status: 400 },
    );
  }

  const phone = (contact_phone ?? '').trim().slice(0, 30) || null;
  const email = (contact_email ?? '').trim().slice(0, 254) || null;

  const { data, error } = await supabaseAdmin
    .from('inquiries')
    .insert({
      user_id: userId,
      category,
      content: trimmedContent,
      contact_phone: phone,
      contact_email: email,
    })
    .select('id, created_at')
    .single();

  if (error) {
    console.error('[inquiries:POST]', error);
    return NextResponse.json({ error: '문의 저장에 실패했어요.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id, created_at: data.created_at });
}

export async function GET(request: NextRequest) {
  const userId = await authUserId(request);
  if (!userId) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('inquiries')
    .select('id, category, content, status, admin_reply, admin_replied_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[inquiries:GET]', error);
    return NextResponse.json({ error: '목록을 불러오지 못했어요.' }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}
