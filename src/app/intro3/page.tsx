'use client';

/**
 * 온보딩 2장 — 캐릭터 카드 생성 (/intro3)
 *
 * 1장(/intro2) 입력(생년월일·시간·성별) → 만세력 일간 계산 → 물상 정령(10종) 배정 → 카드.
 * 기획서 VI-4 [2장]: "정령이 깨어났어요!" → 세로 카드 → "내 운명의 문 열기".
 */

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ShaderSky from '../intro/ShaderSky';
import SpiritCard from '@/components/SpiritCard';
import { SPIRITS, type Spirit } from '@/data/spirits';
import { calculateManseryeok } from '@/lib/saju/manseryeok';

function resolveSpirit(params: URLSearchParams | null): Spirit | null {
  const date = params?.get('date') ?? '';
  if (date.length !== 8) return null;
  const birthDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  const timeRaw = params?.get('time') ?? '';
  const birthTime = timeRaw && timeRaw !== 'unknown' && timeRaw.length === 4
    ? `${timeRaw.slice(0, 2)}:${timeRaw.slice(2, 4)}`
    : '12:00'; // 시 모름/미입력 → 정오(일간엔 영향 적음)
  const gender = params?.get('gender') === 'female' ? '여' : '남';
  const calendarType = params?.get('cal') === 'lunar' ? '음력' : '양력';

  try {
    const res = calculateManseryeok({ birthDate, birthTime, birthPlace: '서울', gender, calendarType });
    return SPIRITS[res.manseryeok.day.gan] ?? null;
  } catch {
    return null;
  }
}

function CardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const spirit = useMemo(() => resolveSpirit(params), [params]);

  return (
    <div className="app-auth-shell">
      <div className="app-auth-container relative flex flex-col items-center justify-center overflow-y-auto px-6 py-10">
        <ShaderSky />

        <div className="relative z-10 flex w-full flex-col items-center text-center">
          <p className="mb-5 text-[15px] text-text-secondary" style={{ fontFamily: 'var(--font-title)' }}>
            정령이 깨어났어요!
          </p>

          {spirit ? (
            <>
              <p className="mb-5 text-[18px] text-text-primary" style={{ fontFamily: 'var(--font-title)' }}>
                당신은 <span className="font-bold">{spirit.name}</span>입니다
              </p>
              <SpiritCard spirit={spirit} />
            </>
          ) : (
            <div className="w-full max-w-[320px] rounded-3xl border border-[var(--border-default)] bg-[rgba(20,12,38,0.55)] p-7 text-[14px] text-text-secondary">
              생년월일 정보가 없어 정령을 불러올 수 없어요.
              <br />
              먼저 별을 찾아주세요.
            </div>
          )}

          <button
            type="button"
            onClick={() => router.push(spirit ? '/' : '/intro2')}
            className="mt-8 w-full max-w-[330px] rounded-full bg-gradient-to-r from-cta to-cta-active py-3.5 text-[15px] font-bold text-white shadow-lg shadow-cta/20 transition-all hover:opacity-90 active:opacity-80"
          >
            {spirit ? '내 운명의 문 열기' : '내 별 찾으러 가기'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingCardPage() {
  return (
    <Suspense fallback={null}>
      <CardInner />
    </Suspense>
  );
}
