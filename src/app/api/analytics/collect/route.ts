/**
 * 방문/유입/이탈 분석 수집 엔드포인트.
 *
 * 설계 원칙 (안전 최우선 — 기존 서비스 절대 안 깨지게):
 *  - Fail-OPEN: 어떤 실패에서도 throw 하지 않고 항상 204 를 돌려준다.
 *    클라이언트는 fire-and-forget(keepalive)로 호출하므로 응답을 신경쓰지 않음.
 *  - 봇 제외: user-agent 휴리스틱으로 크롤러/프리뷰 봇은 적재하지 않음.
 *  - 로그 폭주 방지: IP 기준 넉넉한 레이트리밋(fail-open).
 *  - 크레딧/결제/인증 로직과 완전 분리 — 차감/세션에 일절 관여하지 않음.
 *  - user_id 는 분석용(비보안). 클라이언트 제공값을 uuid 형태만 검증해 사용.
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { checkRateLimit, clientIp } from '@/services/rateLimitGeneric';

export const runtime = 'nodejs';

// 크롤러/프리뷰/모니터링 봇 — 사람 방문 통계 오염 방지
const BOT_RE =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|headless|lighthouse|pingdom|gtmetrix|monitor|preview|fetch|curl|wget|python-requests|axios/i;
const MOBILE_RE = /mobile|android|iphone|ipad|ipod/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trunc(v: unknown, n: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  return s.length > n ? s.slice(0, n) : s;
}

const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(request: Request) {
  try {
    const ua = request.headers.get('user-agent') ?? '';
    if (!ua || BOT_RE.test(ua)) return noContent(); // 봇/UA없음 제외

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return noContent();
    }

    const sessionId = trunc(body.sessionId, 64);
    const path = trunc(body.path, 500);
    if (!sessionId || !path) return noContent(); // 필수값 없으면 조용히 무시

    // 적재 폭주 방지(베스트에포트, fail-open). 정상 브라우징은 절대 안 걸리게 넉넉히.
    const rl = await checkRateLimit(`analytics:ip:${clientIp(request)}`, [
      { windowSec: 60, max: 300 },
    ]);
    if (!rl.ok) return noContent();

    const device = MOBILE_RE.test(ua) ? 'mobile' : 'desktop';
    const rawUid = trunc(body.userId, 64);
    const userId = rawUid && UUID_RE.test(rawUid) ? rawUid : null;

    const { error } = await supabaseAdmin.from('analytics_events').insert({
      session_id: sessionId,
      visitor_id: trunc(body.visitorId, 64),
      user_id: userId,
      event_type: 'pageview',
      path,
      referrer: trunc(body.referrer, 1000),
      utm_source: trunc(body.utm_source, 200),
      utm_medium: trunc(body.utm_medium, 200),
      utm_campaign: trunc(body.utm_campaign, 200),
      device,
    });
    if (error) console.error('[analytics] insert 실패(무시):', error.message);
  } catch (e) {
    console.error('[analytics] 예외(무시):', e);
  }
  return noContent();
}
