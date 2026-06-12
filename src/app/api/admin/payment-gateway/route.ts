/**
 * GET  /api/admin/payment-gateway — 현재 설정 조회
 * POST /api/admin/payment-gateway — 채널 전환 또는 키 업데이트
 *   Body: {
 *     activeChannel?: 'tosspayments' | 'inicis' | 'kpn',
 *     tossChannelKey?: string,
 *     inicisChannelKey?: string,
 *     kpnChannelKey?: string,
 *     tossEnabled?: boolean,
 *     inicisEnabled?: boolean,
 *     kpnEnabled?: boolean,
 *     note?: string,
 *   }
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { requireAdmin } from '../_auth';
import { writeAudit, clientMeta } from '../_audit';

type Channel = 'tosspayments' | 'inicis' | 'kpn';
const VALID_CHANNELS: Channel[] = ['tosspayments', 'inicis', 'kpn'];
const CHANNEL_NAME: Record<Channel, string> = {
  tosspayments: '토스페이먼츠',
  inicis: 'KG이니시스',
  kpn: '한국결제네트웍스(KPN)',
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const { data, error } = await supabaseAdmin
    .from('payment_gateway_config')
    .select('*')
    .eq('id', 'primary')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data) {
    return NextResponse.json({
      config: null,
      fallback: {
        activeChannel: 'tosspayments',
        envChannelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? '',
      },
    });
  }

  return NextResponse.json({
    config: {
      activeChannel: data.active_channel,
      tossChannelKey: data.toss_channel_key,
      inicisChannelKey: data.inicis_channel_key,
      kpnChannelKey: data.kpn_channel_key ?? '',
      tossEnabled: data.toss_enabled,
      inicisEnabled: data.inicis_enabled,
      kpnEnabled: data.kpn_enabled ?? true,
      note: data.note,
      updatedBy: data.updated_by,
      updatedAt: data.updated_at,
    },
    fallback: {
      envChannelKey: process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? '',
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  let body: {
    activeChannel?: Channel;
    tossChannelKey?: string;
    inicisChannelKey?: string;
    kpnChannelKey?: string;
    tossEnabled?: boolean;
    inicisEnabled?: boolean;
    kpnEnabled?: boolean;
    note?: string;
  };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }); }

  if (body.activeChannel !== undefined && !VALID_CHANNELS.includes(body.activeChannel)) {
    return NextResponse.json({ error: 'invalid activeChannel' }, { status: 400 });
  }

  // 현재 상태 조회 (감사 로그용)
  const { data: before } = await supabaseAdmin
    .from('payment_gateway_config')
    .select('*')
    .eq('id', 'primary')
    .maybeSingle();

  // 전환 가드: 활성 전환 대상 채널이 비활성이거나 키가 비어있으면 차단
  if (body.activeChannel !== undefined) {
    const ch = body.activeChannel;
    const willBeEnabled: Record<Channel, boolean> = {
      tosspayments: body.tossEnabled ?? before?.toss_enabled ?? true,
      inicis: body.inicisEnabled ?? before?.inicis_enabled ?? true,
      kpn: body.kpnEnabled ?? before?.kpn_enabled ?? true,
    };
    const finalKey: Record<Channel, string> = {
      tosspayments: body.tossChannelKey ?? before?.toss_channel_key ?? '',
      inicis: body.inicisChannelKey ?? before?.inicis_channel_key ?? '',
      kpn: body.kpnChannelKey ?? before?.kpn_channel_key ?? '',
    };
    if (!willBeEnabled[ch]) {
      return NextResponse.json({ error: `${CHANNEL_NAME[ch]}가 비활성 상태입니다. 먼저 활성화하세요.` }, { status: 400 });
    }
    if (!finalKey[ch].trim()) {
      return NextResponse.json({ error: `${CHANNEL_NAME[ch]} 채널 키가 비어있습니다.` }, { status: 400 });
    }
  }

  const patch: Record<string, unknown> = { updated_by: auth.email };
  if (body.activeChannel !== undefined) patch.active_channel = body.activeChannel;
  if (body.tossChannelKey !== undefined) patch.toss_channel_key = body.tossChannelKey.trim();
  if (body.inicisChannelKey !== undefined) patch.inicis_channel_key = body.inicisChannelKey.trim();
  if (body.kpnChannelKey !== undefined) patch.kpn_channel_key = body.kpnChannelKey.trim();
  if (body.tossEnabled !== undefined) patch.toss_enabled = body.tossEnabled;
  if (body.inicisEnabled !== undefined) patch.inicis_enabled = body.inicisEnabled;
  if (body.kpnEnabled !== undefined) patch.kpn_enabled = body.kpnEnabled;
  if (body.note !== undefined) patch.note = body.note;

  // upsert (row 없으면 생성)
  const { data: after, error } = await supabaseAdmin
    .from('payment_gateway_config')
    .upsert({
      id: 'primary',
      active_channel: body.activeChannel ?? before?.active_channel ?? 'tosspayments',
      toss_channel_key: body.tossChannelKey ?? before?.toss_channel_key ?? '',
      inicis_channel_key: body.inicisChannelKey ?? before?.inicis_channel_key ?? '',
      kpn_channel_key: body.kpnChannelKey ?? before?.kpn_channel_key ?? '',
      toss_enabled: body.tossEnabled ?? before?.toss_enabled ?? true,
      inicis_enabled: body.inicisEnabled ?? before?.inicis_enabled ?? true,
      kpn_enabled: body.kpnEnabled ?? before?.kpn_enabled ?? true,
      note: body.note ?? before?.note ?? null,
      updated_by: auth.email,
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 감사 로그 — 채널 키는 마스킹
  const { ipAddress, userAgent } = clientMeta(request);
  const mask = (k: string | null | undefined) => k ? `${k.slice(0, 8)}…` : null;
  await writeAudit({
    actorEmail: auth.email,
    action: 'payment_gateway_switch',
    before: before ? {
      active: before.active_channel,
      tossKey: mask(before.toss_channel_key),
      inicisKey: mask(before.inicis_channel_key),
      kpnKey: mask(before.kpn_channel_key),
      tossEnabled: before.toss_enabled,
      inicisEnabled: before.inicis_enabled,
      kpnEnabled: before.kpn_enabled,
    } : null,
    after: {
      active: after.active_channel,
      tossKey: mask(after.toss_channel_key),
      inicisKey: mask(after.inicis_channel_key),
      kpnKey: mask(after.kpn_channel_key),
      tossEnabled: after.toss_enabled,
      inicisEnabled: after.inicis_enabled,
      kpnEnabled: after.kpn_enabled,
    },
    reason: body.note ?? undefined,
    ipAddress,
    userAgent,
  });

  return NextResponse.json({
    ok: true,
    config: {
      activeChannel: after.active_channel,
      tossChannelKey: after.toss_channel_key,
      inicisChannelKey: after.inicis_channel_key,
      kpnChannelKey: after.kpn_channel_key ?? '',
      tossEnabled: after.toss_enabled,
      inicisEnabled: after.inicis_enabled,
      kpnEnabled: after.kpn_enabled ?? true,
      note: after.note,
      updatedBy: after.updated_by,
      updatedAt: after.updated_at,
    },
  });
}
