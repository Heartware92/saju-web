// POST /api/fortune/jobs/create
// 정통사주(traditional) 백그라운드 잡 생성.
//
// 흐름:
//   1. Authorization: Bearer <access_token> 검증 → user 확인
//   2. consume_credit_atomic — 잔액 부족 시 402, 중복 idempotency 시 통과
//   3. saju_records INSERT (status='pending', result_data=sajuResult)
//   4. after(runJungtongsajuJob(...)) — 응답 반환 후 백그라운드 실행
//   5. { jobId } 즉시 반환
//
// 클라이언트는 jobId 받자마자 결과 페이지(?jobId=xxx) 로 이동, Realtime 으로 진행 추적.

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { runJungtongsajuJob } from '@/services/jungtongsajuJob.server';
import type { SajuResult } from '@/utils/sajuCalculator';

// Vercel Fluid Compute — 정통사주 2-pass 60~120초 + retry 여유
export const maxDuration = 300;

interface CreateJobBody {
  category: 'traditional';
  sajuResult: SajuResult;
  /** birth_profiles.id (보관함 프로필 매칭용, 옵션) */
  profileId?: string;
  /** 사주 입력의 원본 (보관함 birth 매칭용) */
  sourceBirth: {
    birthDate: string;
    birthTime: string | null;
    birthPlace: string | null;
    gender: 'male' | 'female';
    calendarType: 'solar' | 'lunar';
  };
  /** 클라이언트가 생성한 멱등 키 — 네트워크 재시도 시 중복 잡 방지 */
  idempotencyKey: string;
}

const TRADITIONAL_CREDIT_COST = 10; // MOON_COST_BIG
const TRADITIONAL_REASON = '정통 사주';
const CREDIT_TYPE = 'moon';

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth: Bearer 토큰 검증 ──
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: '인증이 필요해요.' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: '로그인이 만료됐어요. 다시 로그인해 주세요.' }, { status: 401 });
    }
    const userId = userData.user.id;

    // ── 2. Body 파싱·검증 ──
    let body: CreateJobBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: '잘못된 요청 형식이에요.' }, { status: 400 });
    }

    if (body.category !== 'traditional') {
      return NextResponse.json(
        { error: '아직 정통사주만 지원해요.' },
        { status: 400 },
      );
    }
    if (!body.sajuResult || !body.sourceBirth || !body.idempotencyKey) {
      return NextResponse.json({ error: '필수 정보가 부족해요.' }, { status: 400 });
    }

    // ── 3. 크레딧 차감 (idempotency 보장) ──
    const consumeKey = `traditional:${body.idempotencyKey}`;
    const { data: consumeResult, error: consumeError } = await supabaseAdmin.rpc(
      'consume_credit_atomic',
      {
        p_user_id: userId,
        p_credit_type: CREDIT_TYPE,
        p_amount: TRADITIONAL_CREDIT_COST,
        p_reason: TRADITIONAL_REASON,
        p_idempotency_key: consumeKey,
      },
    );

    if (consumeError) {
      console.error('[jobs/create] consume RPC 에러:', consumeError);
      return NextResponse.json({ error: '결제 처리 중 오류가 발생했어요.' }, { status: 500 });
    }

    // 'ok' = 신규 차감, 'duplicate' = 같은 idempotency_key 로 이미 차감됨 → 이미 잡이 있을 가능성
    if (consumeResult === 'insufficient') {
      return NextResponse.json(
        { error: '달 크레딧이 부족해요. 충전 후 다시 시도해주세요.' },
        { status: 402 },
      );
    }
    if (consumeResult !== 'ok' && consumeResult !== 'duplicate') {
      console.error('[jobs/create] consume 실패:', consumeResult);
      return NextResponse.json({ error: '결제 처리에 실패했어요.' }, { status: 500 });
    }

    // duplicate 인 경우 — 같은 idempotency 로 이미 만든 잡이 있는지 확인
    if (consumeResult === 'duplicate') {
      const { data: existing } = await supabaseAdmin
        .from('saju_records')
        .select('id, status')
        .eq('user_id', userId)
        .eq('category', 'traditional')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        // 이미 진행 중이거나 완료된 잡 — 동일 jobId 반환 (재처리 없음)
        return NextResponse.json({ jobId: existing.id, deduplicated: true });
      }
      // 차감은 됐는데 잡 record 가 없는 비정상 케이스 — 아래로 진행해 record 생성
    }

    // ── 4. 프로필 매칭 (보관함 정렬용) ──
    let resolvedProfileId: string | null = body.profileId ?? null;
    if (!resolvedProfileId) {
      const { data: profile } = await supabaseAdmin
        .from('birth_profiles')
        .select('id')
        .eq('user_id', userId)
        .eq('birth_date', body.sourceBirth.birthDate)
        .eq('gender', body.sourceBirth.gender)
        .limit(1)
        .maybeSingle();
      resolvedProfileId = profile?.id ?? null;
    }

    // ── 5. saju_records INSERT (status='pending') ──
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('saju_records')
      .insert({
        user_id: userId,
        category: 'traditional',
        birth_date: body.sourceBirth.birthDate,
        birth_time: body.sourceBirth.birthTime,
        birth_place: body.sourceBirth.birthPlace,
        gender: body.sourceBirth.gender,
        calendar_type: body.sourceBirth.calendarType,
        result_data: body.sajuResult as unknown as Record<string, unknown>,
        engine_result: resolvedProfileId ? { profile_id: resolvedProfileId } : null,
        credit_type: CREDIT_TYPE,
        credit_used: TRADITIONAL_CREDIT_COST,
        is_detailed: true,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error('[jobs/create] saju_records INSERT 에러:', insertError);
      // 차감 환불
      await supabaseAdmin.rpc('refund_credit_atomic', {
        p_user_id: userId,
        p_credit_type: CREDIT_TYPE,
        p_amount: TRADITIONAL_CREDIT_COST,
        p_reason: '정통사주 잡 생성 실패 자동 환불',
        p_idempotency_key: `refund:${consumeKey}`,
      });
      return NextResponse.json({ error: '잡 생성에 실패했어요.' }, { status: 500 });
    }

    const jobId = inserted.id;

    // ── 6. 백그라운드 잡 시작 — after() 로 응답 후에도 실행 보장 ──
    after(async () => {
      try {
        await runJungtongsajuJob({
          recordId: jobId,
          userId,
          sajuResult: body.sajuResult,
          consumeIdempotencyKey: consumeKey,
          creditAmount: TRADITIONAL_CREDIT_COST,
        });
      } catch (e) {
        // runJungtongsajuJob 내부에서 모든 에러를 status='failed' + 환불로 처리하지만
        // 마지막 안전망 — 여기까지 throw 되면 로그만 남김
        console.error('[jobs/create] runJungtongsajuJob 치명적 누락 에러:', e);
      }
    });

    return NextResponse.json({ jobId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '서버 오류';
    console.error('[jobs/create] 알 수 없는 오류:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
