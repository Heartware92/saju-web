/**
 * POST /api/temp-test/today  (임시 테스트 전용 — 크레딧 차감 없음, 로그인 필요)
 * 로그인 사용자의 대표 프로필로 임의 날짜의 실시간 운세를 동기 생성해 record 형태로 반환.
 * /temp_test 페이지가 TodayResultBlock 으로 실제 결과와 똑같이 렌더.
 * ※ 임시 페이지 — 검증 끝나면 제거 권장.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Solar } from 'lunar-javascript';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import {
  normalizeGan, normalizeZhi, TEN_GODS_MAP, STEM_ELEMENT, BRANCH_ELEMENT,
  BRANCH_HIDDEN_STEMS, EARTHLY_BRANCHES, type SajuResult,
} from '@/utils/sajuCalculator';
import { computeSajuFromProfile } from '@/utils/profileSaju';
import { generateTodayFortuneV3Prompt } from '@/constants/prompts';
import { callAI } from '@/lib/ai/aiClients';
import type { BirthProfile } from '@/types/credit';

export const maxDuration = 300;

async function authUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

// calcTodayGanZhi 복제 (fortuneService self-contained 로직 — 클라 의존 회피)
function calcTodayGz(result: SajuResult, isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dayGz = Solar.fromYmd(y, m, d).getLunar().getDayInGanZhi();
  const gan = normalizeGan(dayGz[0]); const zhi = normalizeZhi(dayGz[1]);
  const map = TEN_GODS_MAP[result.dayMaster] || {};
  const mainHidden = BRANCH_HIDDEN_STEMS[zhi]?.[0] || '';
  const origZhis = [result.pillars.year.zhi, result.pillars.month.zhi, result.pillars.day.zhi,
    ...(result.hourUnknown ? [] : [result.pillars.hour.zhi])];
  const interactions: string[] = [];
  const ti = EARTHLY_BRANCHES.indexOf(zhi);
  const hex: [string, string][] = [['자','축'],['인','해'],['묘','술'],['진','유'],['사','신'],['오','미']];
  origZhis.forEach((oz) => { const oi = EARTHLY_BRANCHES.indexOf(oz); if (oi < 0 || ti < 0) return;
    const md = Math.min(Math.abs(ti - oi), 12 - Math.abs(ti - oi));
    if (md === 6) interactions.push(`일진${zhi}×${oz} 충(沖)`); else if (md === 0) interactions.push(`일진${zhi}×${oz} 동(同)`);
    hex.forEach(([a, b]) => { if ((zhi === a && oz === b) || (zhi === b && oz === a)) interactions.push(`일진${zhi}×${oz} 합(合)`); });
  });
  return { gan, zhi, hanja: `${gan}${zhi}`, ganElement: STEM_ELEMENT[gan] || '', zhiElement: BRANCH_ELEMENT[zhi] || '',
    tenGodGan: map[gan] || '', tenGodZhi: mainHidden ? (map[mainHidden] || '') : '', interactions };
}

export async function POST(req: NextRequest) {
  const userId = await authUserId(req);
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const isoDate: string = body.isoDate || new Date().toISOString().slice(0, 10);
  const profileId: string | undefined = body.profileId;

  // 프로필: 지정 id 우선, 없으면 대표(is_primary)
  let q = supabaseAdmin.from('birth_profiles').select('*').eq('user_id', userId);
  q = profileId ? q.eq('id', profileId) : q.order('is_primary', { ascending: false });
  const { data: prof } = await q.limit(1).maybeSingle();
  if (!prof) return NextResponse.json({ error: '프로필이 없습니다.' }, { status: 400 });

  const result = computeSajuFromProfile(prof as unknown as BirthProfile);
  if (!result) return NextResponse.json({ error: '만세력 계산 실패' }, { status: 500 });

  const ctx = {
    hobbies: Array.isArray(body.hobbies) && body.hobbies.length ? body.hobbies : ['업무·일'],
    jobState: prof.job_state ?? null,
    customJobState: prof.custom_job_state ?? undefined,
    loveState: prof.love_state ?? null,
    customLoveState: prof.custom_love_state ?? undefined,
    timeSlot: body.timeSlot || 'afternoon',
    q1Text: body.q1Text || '', q2Text: body.q2Text || '',
    q1Answer: body.q1Answer || undefined, q2Answer: body.q2Answer || undefined,
  } as never;

  const todayGz = calcTodayGz(result, isoDate);
  const prompt = generateTodayFortuneV3Prompt(result, todayGz as never, isoDate, ctx, null);
  const ai = await callAI(prompt, 9500, { temperature: 0.85 }); // prod today 와 동일
  const raw = ai.content;

  const record = {
    profile_id: prof.id,
    profile_name: prof.name,
    birth_date: prof.birth_date,
    birth_time: prof.birth_time,
    birth_place: prof.birth_place,
    gender: prof.gender,
    calendar_type: prof.calendar_type,
    interpretation_detailed: raw,
    interpretation_basic: raw,
    engine_result: { todayGz, userContext: ctx, isoDate, version: 'v3' },
    category: 'today',
  };
  return NextResponse.json({ record, iljin: `${todayGz.gan}${todayGz.zhi}` });
}
