'use client';

/**
 * 온보딩 2장 — 캐릭터 카드 생성 (/intro3, 자리 placeholder)
 *
 * 기획서 VI-4 [2장]: "정령이 깨어났어요!" → "당신은 [OOO]입니다" 세로 카드
 * TODO: 1장 입력 → 만세력 → 일간 → 물상 정령(10종) 배정. 지금은 입력값 표시 골격.
 */

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ShaderSky from '../intro/ShaderSky';

function CardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const date = params?.get('date') ?? '';
  const time = params?.get('time') ?? '';
  const gender = params?.get('gender') ?? '';
  const cal = params?.get('cal') ?? 'solar';

  return (
    <div className="app-auth-shell">
      <div className="app-auth-container relative flex flex-col items-center justify-center px-7 py-12">
        <ShaderSky />

        <div className="relative z-10 flex w-full flex-col items-center text-center">
          <p className="mb-6 text-[15px] text-text-secondary" style={{ fontFamily: 'var(--font-title)' }}>
            정령이 깨어났어요!
          </p>

          <div className="w-full max-w-[300px] rounded-3xl border border-[var(--border-default)] bg-[rgba(20,12,38,0.55)] p-7 backdrop-blur-sm">
            <div className="mx-auto mb-5 flex h-40 w-40 items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] text-[13px] text-text-tertiary">
              정령 일러스트
            </div>
            <p className="text-[19px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-title)' }}>
              당신은 ○○○ 입니다
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
              (만세력 계산 → 정령 배정 연결 예정)
            </p>

            <div className="mt-5 space-y-1 border-t border-[var(--border-subtle)] pt-4 text-left text-[12px] text-text-tertiary">
              <p>생년월일 · {cal === 'lunar' ? '음력' : '양력'} {date || '-'}</p>
              <p>태어난 시간 · {time === 'unknown' ? '모름' : time || '-'}</p>
              <p>성별 · {gender === 'female' ? '여성' : gender === 'male' ? '남성' : '-'}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push('/')}
            className="mt-9 w-full max-w-[300px] rounded-full bg-gradient-to-r from-cta to-cta-active py-3.5 text-[15px] font-bold text-white shadow-lg shadow-cta/20 transition-all hover:opacity-90 active:opacity-80"
          >
            내 운명의 문 열기
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
