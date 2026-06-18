// POST /api/fortune/jobs/create
// 백그라운드 풀이 잡 생성 endpoint.
//
// 흐름:
//   1. Bearer 토큰 검증 → user 확인
//   2. category 별 body 검증
//   3. consume_credit_atomic — 잔액 부족 시 402, 중복 idempotency 시 통과
//   4. saju_records INSERT (status='pending') — category 별 컬럼 분기
//   5. after(runXxxJob(...)) — 응답 반환 후 백그라운드 실행
//   6. { jobId } 즉시 반환
//
// 카테고리:
//   - 'traditional': 정통사주 (2-pass). prompt 는 서버가 sajuResult 로 생성.
//   - 'gunghap'    : 궁합 (1-pass). prompt 는 클라가 완성해서 전달.
// 새 카테고리 추가 시 docs/ASYNC_FORTUNE_JOBS.md 표준 패턴 참조.

import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { supabaseAdmin } from '@/services/supabaseAdmin';
import { runJungtongsajuJob } from '@/services/jungtongsajuJob.server';
import { runGunghapJob } from '@/services/gunghapJob.server';
import { runNewyearJob } from '@/services/newyearJob.server';
import { runTojeongJob } from '@/services/tojeongJob.server';
import { runZamidusuJob } from '@/services/zamidusuJob.server';
import { runTaekilJob } from '@/services/taekilJob.server';
import { runTodayJob } from '@/services/todayJob.server';
import { runPickedDateJob } from '@/services/pickedDateJob.server';
import { runMoreFortuneJob, type MoreFortuneCategory } from '@/services/moreFortuneJob.server';
import { runTarotJob } from '@/services/tarotJob.server';
import { runConsultationJob } from '@/services/consultationJob.server';
import type { SajuResult } from '@/utils/sajuCalculator';
import type { PeriodFortune } from '@/engine/periodFortune';
import type { TojeongResult } from '@/engine/tojeong';
import type { ZamidusuResult } from '@/engine/zamidusu';

// Vercel Fluid Compute — 정통사주 2-pass 60~120초 + retry 여유
export const maxDuration = 300;

interface SourceBirth {
  birthDate: string;
  birthTime: string | null;
  birthPlace: string | null;
  gender: 'male' | 'female';
  calendarType: 'solar' | 'lunar';
}

interface BaseJobBody {
  /** birth_profiles.id (보관함 프로필 매칭용, 옵션) */
  profileId?: string;
  /** 사주 입력의 원본 (보관함 birth 매칭용) */
  sourceBirth: SourceBirth;
  /** 클라이언트가 생성한 멱등 키 — 네트워크 재시도 시 중복 잡 방지 */
  idempotencyKey: string;
  /** 보관함에 저장될 SajuResult (result_data 컬럼). */
  sajuResult: SajuResult;
}

interface TraditionalJobBody extends BaseJobBody {
  category: 'traditional';
}

interface GunghapJobBody extends BaseJobBody {
  category: 'gunghap';
  /** 클라가 14개 카테고리 분기 + role injection + title/score 래퍼까지 완성한 prompt. */
  prompt: string;
  /** 본인 프로필명 (saju_records.profile_name) — 사주표 라벨에 "나" 대신 표시. */
  profileName?: string;
  /** 상대방 이름 (보관함 partner_name 컬럼). pet 카테고리는 동물 이름. */
  partnerName: string;
  /** 상대방 생년월일 (옵션 — pet 등은 빈). */
  partnerBirthDate: string | null;
  /** 보관함 engine_result — 궁합 카테고리·역할·custom 라벨 등 보존. */
  engineResult: Record<string, unknown>;
}

interface NewyearJobBody extends BaseJobBody {
  category: 'newyear';
  /** PeriodFortune 객체 — server 가 generateNewyearReportPrompt 에 전달 */
  fortune: PeriodFortune;
  /** 대상 연도 — 신년운세 또는 연도별 운세 */
  year: number;
  /** 대표 프로필 사용자 컨텍스트 — 각 섹션 풀이에 분산 인용 (옵션) */
  userCtx?: {
    jobState?: string | null;
    customJobState?: string | null;
    loveState?: string | null;
    customLoveState?: string | null;
  };
  /** 연도별 운세에서 진입한 경우 true — engine_result.source 분기 */
  isYearFortune?: boolean;
}

interface TojeongJobBody extends BaseJobBody {
  category: 'tojeong';
  /** TojeongResult — server 가 generateTojeongPass1/Pass2Prompt 에 전달 */
  tojeongResult: TojeongResult;
  /** 사주+토정 하이브리드 — 분야별 풀이 깊이 ↑ (옵션) */
  saju?: SajuResult;
  /** 사용자 정황 — 분산 인용 매트릭스 (옵션) */
  userCtx?: {
    jobState?: string | null;
    customJobState?: string | null;
    loveState?: string | null;
    customLoveState?: string | null;
  };
}

interface ZamidusuJobBody extends BaseJobBody {
  category: 'zamidusu';
  /** ZamidusuResult — server 가 generateZamidusuPrompt 에 전달 */
  zamidusuResult: ZamidusuResult;
}

interface TaekilJobBody extends BaseJobBody {
  category: 'taekil';
  /** 클라가 완성한 prompt (generateTaekilAdvicePrompt + detail) */
  prompt: string;
  /** archive engine_result 에 저장될 TaekilResult + userDetail */
  engineResult: Record<string, unknown>;
}

interface TodayJobBody extends BaseJobBody {
  category: 'today';
  /** 클라가 완성한 prompt (generateTodayFortuneV3Prompt + classifications) */
  prompt: string;
  /** archive engine_result — isoDate·todayGz 등 */
  engineResult: Record<string, unknown>;
}

interface PickedDateJobBody extends BaseJobBody {
  /** 지정일 운세는 archive category='period' (DB 라벨 호환) */
  category: 'period';
  /** 클라가 완성한 base prompt (generatePickedDateFortunePrompt) */
  prompt: string;
  /** archive engine_result — isoDate·todayGz */
  engineResult: Record<string, unknown>;
}

interface MoreFortuneJobBody extends BaseJobBody {
  category: MoreFortuneCategory;  // 'study' | 'children' | 'personality' | 'name' | 'dream'
  /** 클라가 완성한 prompt (generateXxxShortPrompt / generateNameFortunePrompt / generateDreamInterpretationPrompt) */
  prompt: string;
  /** name 한자 모드처럼 maxTokens 가 동적인 경우 override */
  maxTokens?: number;
  /** archive engine_result — name 의 charMeanings, dream 의 dreamText 등 카테고리별 메타 */
  engineResult?: Record<string, unknown>;
  /** dream 3-pass 전용 입력 — 서버가 1차 분류기 + 2차 동양 + 3차 서양 직접 호출 */
  dreamInput?: {
    dreamText: string;
    timeBandId?: string;
    isRepeating?: boolean;
  };
}

/**
 * 타로 잡 — saju_records 가 아닌 tarot_records 테이블 사용.
 * BaseJobBody(sajuResult·sourceBirth) 를 extends 하지 않음 (타로는 사주 입력 불필요).
 */
interface TarotJobBody {
  category: 'tarot';
  /** 클라가 완성한 prompt (generateHybridPrompt) */
  prompt: string;
  /** 보관함 spread_type — today·monthly·question·hybrid-saju */
  spreadType: string;
  /** cards 페이로드 (재생용 — mode·cards 배열·단일카드·질문) */
  cards: Record<string, unknown>;
  question?: string;
  idempotencyKey: string;
}

// 상담소 — saju_records 를 잡 캐리어로 사용(category='consultation'), 답변은 서버가 consultation_records 에 기록.
// 보관함은 category 별 조회라 consultation 은 보관함에 노출되지 않음.
interface ConsultationJobBody {
  category: 'consultation';
  systemPrompt: string;
  history: { id: string; role: 'user' | 'assistant'; content: string; createdAt: number }[];
  userMessage: string;
  userMessageId: string;
  conversationId: string;       // `${profileId}::${elementKey}`
  profileId: string | null;
  profileName: string | null;
  sourceBirth: SourceBirth;     // 프로필 birth (saju_records NOT NULL 충족)
  idempotencyKey: string;       // 권장: `${conversationId}:${userMessageId}`
}

type CreateJobBody =
  | TraditionalJobBody
  | GunghapJobBody
  | NewyearJobBody
  | TojeongJobBody
  | ZamidusuJobBody
  | TaekilJobBody
  | TodayJobBody
  | PickedDateJobBody
  | MoreFortuneJobBody
  | TarotJobBody
  | ConsultationJobBody;

// 카테고리별 차감 정책 — 다른 운세 추가 시 여기 항목만 추가하면 됨.
// reason 값은 클라이언트의 CHARGE_REASONS.{category} 와 반드시 동일해야 함
// (거래 내역 credit_transactions.reason 라벨 일관성).
const CATEGORY_POLICY: Record<
  CreateJobBody['category'],
  { creditCost: number; reason: string }
> = {
  traditional: { creditCost: 10, reason: '정통사주' },
  gunghap: { creditCost: 10, reason: '궁합' },
  newyear: { creditCost: 10, reason: '신년운세' },
  tojeong: { creditCost: 10, reason: '토정비결' },
  zamidusu: { creditCost: 10, reason: '자미두수' },
  taekil: { creditCost: 10, reason: '택일' },
  today: { creditCost: 5, reason: '실시간 운세' },    // MOON_COST_MORE = 5
  period: { creditCost: 10, reason: '지정일 운세' },  // archive category='period'
  // 더많은 운세 5개 — MOON_COST_MORE = 5 (실시간과 동일)
  study: { creditCost: 5, reason: '학업·시험운' },
  children: { creditCost: 5, reason: '자녀·출산운' },
  personality: { creditCost: 5, reason: '성격 분석' },
  name: { creditCost: 5, reason: '이름 풀이' },
  dream: { creditCost: 5, reason: '꿈해몽' },
  tarot: { creditCost: 1, reason: '타로' },  // MOON_COST_TAROT, CHARGE_REASONS.tarot
  consultation: { creditCost: 1, reason: '상담소 질문' },  // MOON_COST_CONSULTATION_QUESTION, CHARGE_REASONS.consultation
};

const CREDIT_TYPE = 'moon';

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth ──
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

    // ── 타로 전용 흐름 — tarot_records 테이블 사용 (saju_records 와 별개) ──
    if (body.category === 'tarot') {
      return await handleTarotJob(body, userId);
    }

    // ── 상담소 전용 흐름 — saju_records 캐리어 + 답변은 consultation_records 에 기록 ──
    if (body.category === 'consultation') {
      return await handleConsultationJob(body, userId);
    }

    if (!body.sajuResult || !body.sourceBirth || !body.idempotencyKey) {
      return NextResponse.json({ error: '필수 정보가 부족해요.' }, { status: 400 });
    }

    const policy = CATEGORY_POLICY[body.category];
    if (!policy) {
      return NextResponse.json({ error: `지원하지 않는 카테고리예요: ${body.category}` }, { status: 400 });
    }

    if (body.category === 'gunghap') {
      if (!body.prompt || body.prompt.length < 100) {
        return NextResponse.json({ error: '궁합 prompt 가 비어있어요.' }, { status: 400 });
      }
      if (!body.partnerName) {
        return NextResponse.json({ error: '상대방 정보가 부족해요.' }, { status: 400 });
      }
    }
    if (body.category === 'newyear') {
      if (!body.fortune || typeof body.year !== 'number') {
        return NextResponse.json({ error: '신년운세 입력이 부족해요.' }, { status: 400 });
      }
    }
    if (body.category === 'tojeong') {
      if (!body.tojeongResult) {
        return NextResponse.json({ error: '토정비결 입력이 부족해요.' }, { status: 400 });
      }
    }
    if (body.category === 'zamidusu') {
      if (!body.zamidusuResult) {
        return NextResponse.json({ error: '자미두수 입력이 부족해요.' }, { status: 400 });
      }
    }
    if (body.category === 'taekil' || body.category === 'today' || body.category === 'period') {
      if (!body.prompt || body.prompt.length < 100) {
        return NextResponse.json({ error: `${policy.reason} prompt 가 비어있어요.` }, { status: 400 });
      }
    }
    const moreCats: MoreFortuneCategory[] = ['study', 'children', 'personality', 'name', 'dream'];
    if (moreCats.includes(body.category as MoreFortuneCategory)) {
      const moreBody = body as MoreFortuneJobBody;
      // dream 카테고리는 3-pass — 서버가 dreamInput으로 직접 호출.
      // prompt 길이 검증 대신 dreamInput.dreamText 검증.
      if (moreBody.category === 'dream') {
        const dreamText = moreBody.dreamInput?.dreamText?.trim() || '';
        if (dreamText.length < 5) {
          return NextResponse.json({ error: '꿈 내용을 5자 이상 적어주세요.' }, { status: 400 });
        }
      } else if (!moreBody.prompt || moreBody.prompt.length < 50) {
        return NextResponse.json({ error: `${policy.reason} prompt 가 비어있어요.` }, { status: 400 });
      }
    }

    // ── 3. 크레딧 차감 (idempotency 보장) ──
    const consumeKey = `${body.category}:${body.idempotencyKey}`;
    const { data: consumeResult, error: consumeError } = await supabaseAdmin.rpc(
      'consume_credit_atomic',
      {
        p_user_id: userId,
        p_credit_type: CREDIT_TYPE,
        p_amount: policy.creditCost,
        p_reason: policy.reason,
        p_idempotency_key: consumeKey,
      },
    );

    if (consumeError) {
      console.error('[jobs/create] consume RPC 에러:', consumeError);
      return NextResponse.json({ error: '결제 처리 중 오류가 발생했어요.' }, { status: 500 });
    }
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
        .eq('category', body.category)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ jobId: existing.id, deduplicated: true });
      }
    }

    // ── 4. 프로필 매칭 (보관함 정렬·라벨용) ──
    // 보관함은 profile_name 을 우선 라벨로 노출 (없으면 생일 fallback) — 모든 카테고리에서 채운다.
    let resolvedProfileId: string | null = body.profileId ?? null;
    let resolvedProfileName: string | null = null;
    if (resolvedProfileId) {
      const { data: profile } = await supabaseAdmin
        .from('birth_profiles')
        .select('name')
        .eq('id', resolvedProfileId)
        .eq('user_id', userId)
        .maybeSingle();
      resolvedProfileName = profile?.name ?? null;
    } else {
      const { data: profile } = await supabaseAdmin
        .from('birth_profiles')
        .select('id, name')
        .eq('user_id', userId)
        .eq('birth_date', body.sourceBirth.birthDate)
        .eq('gender', body.sourceBirth.gender)
        .limit(1)
        .maybeSingle();
      resolvedProfileId = profile?.id ?? null;
      resolvedProfileName = profile?.name ?? null;
    }

    // ── 5. saju_records INSERT (카테고리별 컬럼 분기) ──
    // profile_id / profile_name — 보관함 라벨·정렬에 사용. 매칭 실패 시 둘 다 null.
    const insertRow: Record<string, unknown> = {
      user_id: userId,
      category: body.category,
      birth_date: body.sourceBirth.birthDate,
      birth_time: body.sourceBirth.birthTime,
      birth_place: body.sourceBirth.birthPlace,
      gender: body.sourceBirth.gender,
      calendar_type: body.sourceBirth.calendarType,
      result_data: body.sajuResult as unknown as Record<string, unknown>,
      credit_type: CREDIT_TYPE,
      credit_used: policy.creditCost,
      is_detailed: true,
      status: 'pending',
      profile_id: resolvedProfileId,
      profile_name: resolvedProfileName,
    };

    if (body.category === 'traditional') {
      insertRow.engine_result = resolvedProfileId ? { profile_id: resolvedProfileId } : null;
    } else if (body.category === 'gunghap') {
      insertRow.engine_result = body.engineResult;
      insertRow.partner_name = body.partnerName;
      insertRow.partner_birth_date = body.partnerBirthDate ?? null;
      if (body.profileName) insertRow.profile_name = body.profileName;
    } else if (body.category === 'newyear') {
      // engine_result — getNewyearReport 의 archiveSaju 분기와 동등.
      // year·isoDate·categoryLabel·source 가 보관함 라벨·정렬·필터에 사용됨.
      insertRow.engine_result = {
        year: body.year,
        isoDate: String(body.year),
        categoryLabel: body.isYearFortune ? `${body.year}년도 운세 풀이` : `${body.year}년 신년운세`,
        source: body.isYearFortune ? 'year-fortune' : 'newyear',
        seWoon: body.sajuResult.seWoon.find((s) => s.year === body.year) ?? null,
      };
    } else if (body.category === 'tojeong') {
      insertRow.engine_result = body.tojeongResult as unknown as Record<string, unknown>;
    } else if (body.category === 'zamidusu') {
      insertRow.engine_result = body.zamidusuResult as unknown as Record<string, unknown>;
    } else if (
      body.category === 'taekil'
      || body.category === 'today'
      || body.category === 'period'
    ) {
      insertRow.engine_result = body.engineResult ?? null;
    } else if (moreCats.includes(body.category as MoreFortuneCategory)) {
      const moreBody = body as MoreFortuneJobBody;
      insertRow.engine_result = moreBody.engineResult ?? null;
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('saju_records')
      .insert(insertRow)
      .select('id')
      .single();

    if (insertError || !inserted) {
      console.error('[jobs/create] saju_records INSERT 에러:', insertError);
      // 차감 환불
      await supabaseAdmin.rpc('refund_credit_atomic', {
        p_user_id: userId,
        p_credit_type: CREDIT_TYPE,
        p_amount: policy.creditCost,
        p_reason: `${policy.reason} 잡 생성 실패 자동 환불`,
        p_idempotency_key: `refund:${consumeKey}`,
      });
      return NextResponse.json({ error: '잡 생성에 실패했어요.' }, { status: 500 });
    }

    const jobId = inserted.id;

    // ── 6. 백그라운드 잡 시작 ──
    after(async () => {
      try {
        if (body.category === 'traditional') {
          await runJungtongsajuJob({
            recordId: jobId,
            userId,
            sajuResult: body.sajuResult,
            consumeIdempotencyKey: consumeKey,
            creditAmount: policy.creditCost,
          });
        } else if (body.category === 'gunghap') {
          await runGunghapJob({
            recordId: jobId,
            userId,
            prompt: body.prompt,
            consumeIdempotencyKey: consumeKey,
            creditAmount: policy.creditCost,
          });
        } else if (body.category === 'newyear') {
          await runNewyearJob({
            recordId: jobId,
            userId,
            sajuResult: body.sajuResult,
            fortune: body.fortune,
            year: body.year,
            userCtx: body.userCtx,
            consumeIdempotencyKey: consumeKey,
            creditAmount: policy.creditCost,
          });
        } else if (body.category === 'tojeong') {
          await runTojeongJob({
            recordId: jobId,
            userId,
            tojeongResult: body.tojeongResult,
            sajuResult: body.saju,
            userCtx: body.userCtx,
            consumeIdempotencyKey: consumeKey,
            creditAmount: policy.creditCost,
          });
        } else if (body.category === 'zamidusu') {
          await runZamidusuJob({
            recordId: jobId,
            userId,
            zamidusuResult: body.zamidusuResult,
            consumeIdempotencyKey: consumeKey,
            creditAmount: policy.creditCost,
          });
        } else if (body.category === 'taekil') {
          await runTaekilJob({
            recordId: jobId,
            userId,
            prompt: body.prompt,
            consumeIdempotencyKey: consumeKey,
            creditAmount: policy.creditCost,
          });
        } else if (body.category === 'today') {
          await runTodayJob({
            recordId: jobId,
            userId,
            prompt: body.prompt,
            consumeIdempotencyKey: consumeKey,
            creditAmount: policy.creditCost,
          });
        } else if (body.category === 'period') {
          await runPickedDateJob({
            recordId: jobId,
            userId,
            prompt: body.prompt,
            consumeIdempotencyKey: consumeKey,
            creditAmount: policy.creditCost,
          });
        } else if (moreCats.includes(body.category as MoreFortuneCategory)) {
          const moreBody = body as MoreFortuneJobBody;
          await runMoreFortuneJob({
            recordId: jobId,
            userId,
            category: moreBody.category as MoreFortuneCategory,
            prompt: moreBody.prompt,
            maxTokens: moreBody.maxTokens,
            consumeIdempotencyKey: consumeKey,
            creditAmount: policy.creditCost,
            dreamInput: moreBody.dreamInput,  // dream 3-pass 전용 입력 (서버가 분류기→동양+서양 직접 호출)
          });
        }
      } catch (e) {
        console.error('[jobs/create] runXxxJob 치명적 누락 에러:', e);
        // 방어선: 잡 러너가 자체 처리하지 못한 채 throw된 경우에도 잡이 pending/processing 으로
        // 멈춰 클라이언트가 타임아웃을 보지 않도록, 여기서 failed 마킹 + 환불(멱등)한다.
        // 러너가 이미 done/failed 로 끝냈으면 status 가드로 덮어쓰지 않고, 환불은 같은 멱등키라 중복 안 됨.
        try {
          await supabaseAdmin
            .from('saju_records')
            .update({
              status: 'failed',
              error_message: (e instanceof Error ? e.message : '처리 중 오류').slice(0, 500),
              completed_at: new Date().toISOString(),
            })
            .eq('id', jobId)
            .in('status', ['pending', 'processing']);
          await supabaseAdmin.rpc('refund_credit_atomic', {
            p_user_id: userId,
            p_credit_type: CREDIT_TYPE,
            p_amount: policy.creditCost,
            p_reason: '분석 실패 자동 환불(누락 방어)',
            p_idempotency_key: `refund:${consumeKey}`,
          });
        } catch (e2) {
          console.error('[jobs/create] 방어 failed 마킹/환불 실패:', e2);
        }
      }
    });

    return NextResponse.json({ jobId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '서버 오류';
    console.error('[jobs/create] 알 수 없는 오류:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * 타로 잡 생성 — tarot_records 테이블 사용.
 * saju_records 흐름과 분리 (다른 컬럼·보관함 별도 탭).
 */
async function handleTarotJob(body: TarotJobBody, userId: string): Promise<NextResponse> {
  if (!body.prompt || body.prompt.length < 50) {
    return NextResponse.json({ error: '타로 prompt 가 비어있어요.' }, { status: 400 });
  }
  if (!body.idempotencyKey) {
    return NextResponse.json({ error: '필수 정보가 부족해요.' }, { status: 400 });
  }
  const policy = CATEGORY_POLICY.tarot;
  const consumeKey = `tarot:${body.idempotencyKey}`;

  // 선(先) 잔액 확인 — 여기서는 차감하지 않는다(게이트 역할). 실제 차감은
  // 풀이가 정상 생성된 뒤(runTarotJob → chargeOnSuccess)에만 멱등하게 일어난다.
  // 잔액 0 사용자가 LLM 호출을 일으키는 어뷰징은 이 게이트 + 레이트리밋으로 막는다.
  const { data: credits, error: balError } = await supabaseAdmin
    .from('user_credits')
    .select('moon_balance')
    .eq('user_id', userId)
    .maybeSingle();
  if (balError) {
    console.error('[jobs/create:tarot] 잔액 조회 에러:', balError);
    return NextResponse.json({ error: '결제 처리 중 오류가 발생했어요.' }, { status: 500 });
  }
  if (!credits || (credits.moon_balance ?? 0) < policy.creditCost) {
    return NextResponse.json(
      { error: '달 크레딧이 부족해요. 충전 후 다시 시도해주세요.' },
      { status: 402 },
    );
  }

  // tarot_records INSERT (status='pending') — 아직 차감하지 않음
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('tarot_records')
    .insert({
      user_id: userId,
      spread_type: body.spreadType,
      cards: body.cards,
      question: body.question ?? null,
      credit_type: CREDIT_TYPE,
      credit_used: policy.creditCost,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    console.error('[jobs/create:tarot] tarot_records INSERT 에러:', insertError);
    // 차감 전이라 환불할 것이 없음.
    return NextResponse.json({ error: '잡 생성에 실패했어요.' }, { status: 500 });
  }

  const jobId = inserted.id;
  after(async () => {
    try {
      await runTarotJob({
        recordId: jobId,
        userId,
        prompt: body.prompt,
        consumeIdempotencyKey: consumeKey,
        creditAmount: policy.creditCost,
        chargeReason: policy.reason,
      });
    } catch (e) {
      console.error('[jobs/create:tarot] runTarotJob 치명적 누락 에러:', e);
    }
  });

  return NextResponse.json({ jobId });
}

async function handleConsultationJob(body: ConsultationJobBody, userId: string): Promise<NextResponse> {
  if (!body.systemPrompt || !body.userMessage?.trim() || !body.userMessageId || !body.conversationId || !body.idempotencyKey) {
    return NextResponse.json({ error: '필수 정보가 부족해요.' }, { status: 400 });
  }
  if (!body.sourceBirth?.birthDate || !body.sourceBirth?.gender) {
    return NextResponse.json({ error: '프로필 정보가 부족해요.' }, { status: 400 });
  }
  const policy = CATEGORY_POLICY.consultation;
  // 멱등키 — 같은 질문(대화ID:메시지ID)은 1회만 차감 (중복차감 원천 차단)
  const consumeKey = `consultation:${body.idempotencyKey}`;

  const { data: consumeResult, error: consumeError } = await supabaseAdmin.rpc('consume_credit_atomic', {
    p_user_id: userId,
    p_credit_type: CREDIT_TYPE,
    p_amount: policy.creditCost,
    p_reason: policy.reason,
    p_idempotency_key: consumeKey,
  });
  if (consumeError) {
    console.error('[jobs/create:consultation] consume RPC 에러:', consumeError);
    return NextResponse.json({ error: '결제 처리 중 오류가 발생했어요.' }, { status: 500 });
  }
  if (consumeResult === 'insufficient') {
    return NextResponse.json({ error: '달 크레딧이 부족해요. 충전 후 다시 시도해주세요.' }, { status: 402 });
  }
  if (consumeResult !== 'ok' && consumeResult !== 'duplicate') {
    return NextResponse.json({ error: '결제 처리에 실패했어요.' }, { status: 500 });
  }
  // 같은 질문 재요청(duplicate) — 기존 잡 반환 (이미 차감·진행됨)
  if (consumeResult === 'duplicate') {
    const { data: existing } = await supabaseAdmin
      .from('saju_records')
      .select('id')
      .eq('user_id', userId)
      .eq('category', 'consultation')
      .eq('result_data->>userMessageId', body.userMessageId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return NextResponse.json({ jobId: existing.id, deduplicated: true });
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('saju_records')
    .insert({
      user_id: userId,
      category: 'consultation',
      birth_date: body.sourceBirth.birthDate,
      birth_time: body.sourceBirth.birthTime,
      birth_place: body.sourceBirth.birthPlace,
      gender: body.sourceBirth.gender,
      calendar_type: body.sourceBirth.calendarType,
      result_data: { conversationId: body.conversationId, userMessageId: body.userMessageId },
      credit_type: CREDIT_TYPE,
      credit_used: policy.creditCost,
      is_detailed: true,
      status: 'pending',
      profile_id: body.profileId,
      profile_name: body.profileName,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    console.error('[jobs/create:consultation] saju_records INSERT 에러:', insertError);
    await supabaseAdmin.rpc('refund_credit_atomic', {
      p_user_id: userId,
      p_credit_type: CREDIT_TYPE,
      p_amount: policy.creditCost,
      p_reason: '상담소 잡 생성 실패 자동 환불',
      p_idempotency_key: `refund:${consumeKey}`,
    });
    return NextResponse.json({ error: '잡 생성에 실패했어요.' }, { status: 500 });
  }

  const jobId = inserted.id;
  after(async () => {
    try {
      await runConsultationJob({
        recordId: jobId,
        userId,
        systemPrompt: body.systemPrompt,
        history: body.history ?? [],
        userMessage: body.userMessage,
        userMessageId: body.userMessageId,
        conversationId: body.conversationId,
        profileId: body.profileId,
        profileName: body.profileName,
        consumeIdempotencyKey: consumeKey,
        creditAmount: policy.creditCost,
      });
    } catch (e) {
      console.error('[jobs/create:consultation] runConsultationJob 치명적 누락 에러:', e);
    }
  });

  return NextResponse.json({ jobId });
}
