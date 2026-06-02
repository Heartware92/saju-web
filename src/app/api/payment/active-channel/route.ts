/**
 * GET /api/payment/active-channel
 * 클라이언트가 결제창을 띄울 때 활성 채널 키를 조회.
 * 환경변수 fallback: DB row 가 없거나 채널 키가 비어있으면 NEXT_PUBLIC_PORTONE_CHANNEL_KEY 사용.
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';

// 결제 채널은 어드민에서 전환 시 즉시 반영돼야 하므로 정적 프리렌더/캐시 금지 (항상 라이브 DB 조회)
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('payment_gateway_config')
      .select('active_channel, toss_channel_key, inicis_channel_key, toss_enabled, inicis_enabled')
      .eq('id', 'primary')
      .maybeSingle();

    const fallbackKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? '';

    if (error || !data) {
      return NextResponse.json(
        { activeChannel: 'tosspayments', channelKey: fallbackKey, source: 'env-fallback' },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const active = data.active_channel;
    const enabled = active === 'tosspayments' ? data.toss_enabled : data.inicis_enabled;
    const channelKey = active === 'tosspayments' ? data.toss_channel_key : data.inicis_channel_key;
    const finalKey = (enabled && channelKey) ? channelKey : fallbackKey;

    return NextResponse.json(
      {
        activeChannel: active,
        channelKey: finalKey,
        source: (enabled && channelKey) ? 'db' : 'env-fallback',
      },
      { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } },
    );
  } catch (e) {
    const fallbackKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? '';
    return NextResponse.json(
      { activeChannel: 'tosspayments', channelKey: fallbackKey, source: 'error-fallback' },
      { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } },
    );
  }
}
