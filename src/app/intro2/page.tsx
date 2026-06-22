'use client';

/**
 * 온보딩 1장 — 나의 별 찾기 (/intro2)
 * 회원가입/로그인 직후 진입. 생년월일·시간·성별 입력 → "내 별 찾기" → 별똥별 전환 → 2장(/intro3)
 *
 * 별똥별이 떨어지는 연출(.starField) 상시 + 제출 시 큰 별똥별 전환(.heroDash).
 * 배경: BG_IMAGE 가 채워지면 풀블리드 이미지, 없으면 셰이더 우주(임시).
 *
 * NOTE: 샌드박스. 입력값은 쿼리스트링으로 2장 전달. 만세력→정령 계산은 후속.
 *       운영 회원가입 리다이렉트 연결은 온보딩 완성·검증 후.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ShaderSky from '../intro/ShaderSky';
import styles from './intro2.module.css';

// 사용자가 제공할 배경 이미지 경로(예: '/intro/star-find.webp'). 없으면 셰이더 배경.
const BG_IMAGE: string | null = null;

const inputCls =
  'w-full h-12 rounded-xl bg-[rgba(20,12,38,0.6)] border border-[var(--border-default)] px-4 text-text-primary text-[15px] outline-none transition-all focus:border-cta focus:ring-1 focus:ring-cta/30 [color-scheme:dark] backdrop-blur-sm';

// 상시 떨어지는 별똥별 — 위치/각도/딜레이 고정값
const STARS = [
  { top: '6%', left: '12%', rot: 34, delay: '0s' },
  { top: '0%', left: '52%', rot: 40, delay: '1.6s' },
  { top: '14%', left: '70%', rot: 30, delay: '2.7s' },
];

export default function StarFindPage() {
  const router = useRouter();
  const [birthDate, setBirthDate] = useState('');
  const [calendar, setCalendar] = useState<'solar' | 'lunar'>('solar');
  const [birthTime, setBirthTime] = useState('');
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);

  const submit = () => {
    if (birthDate.length !== 8) return setError('생년월일 8자리를 입력해주세요. (예: 19920914)');
    if (!timeUnknown && birthTime && birthTime.length !== 4)
      return setError('시간은 4자리로 입력해주세요. (예: 1322)');
    if (!gender) return setError('성별을 선택해주세요.');
    setError('');
    setLeaving(true);
    const params = new URLSearchParams({
      date: birthDate,
      cal: calendar,
      gender,
      time: timeUnknown ? 'unknown' : birthTime || '',
    });
    setTimeout(() => router.push(`/intro3?${params.toString()}`), 1700);
  };

  return (
    <div className="app-auth-shell">
      <div className="app-auth-container relative flex flex-col overflow-y-auto px-7 pb-10 pt-14">
        {/* 배경 */}
        {BG_IMAGE ? (
          <div className="absolute inset-0 z-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BG_IMAGE} alt="" aria-hidden="true" className="h-full w-full object-cover object-top" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(5,3,14,0.25) 0%, rgba(5,3,14,0.0) 30%, rgba(5,3,14,0.6) 72%, rgba(5,3,14,0.92) 100%)' }} />
          </div>
        ) : (
          <ShaderSky />
        )}

        {/* 별똥별 떨어지는 연출 */}
        <div className={styles.starField} aria-hidden="true">
          {STARS.map((s, i) => (
            <div key={i} className={styles.track} style={{ top: s.top, left: s.left, transform: `rotate(${s.rot}deg)` }}>
              <div className={styles.dash} style={{ animationDelay: s.delay }} />
            </div>
          ))}
        </div>

        {/* 헤드 */}
        <div className="relative z-10 mb-8 text-center" style={{ textShadow: '0 1px 10px rgba(0,0,0,0.6)' }}>
          <p className="text-[20px] leading-[1.7] text-text-primary" style={{ fontFamily: 'var(--font-title)' }}>
            당신이 태어난 순간,
            <br />
            우주에는 하나의 별이 켜졌습니다.
          </p>
          <p className="mt-3 text-[14px] text-text-secondary">
            그 별이 어떤 정령이 되었는지, 함께 찾아볼까요?
          </p>
        </div>

        {/* 입력 */}
        <div className="relative z-10 flex flex-col gap-5">
          <p className="text-center text-[13px] text-text-tertiary">당신이 이 세상에 온 날을 알려주세요.</p>

          <div className="grid grid-cols-2 gap-2">
            {(['solar', 'lunar'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCalendar(c)}
                className={`h-11 rounded-xl border text-[14px] font-medium transition-all ${
                  calendar === c
                    ? 'border-cta bg-cta/15 text-text-primary'
                    : 'border-[var(--border-default)] bg-[rgba(20,12,38,0.4)] text-text-tertiary'
                }`}
              >
                {c === 'solar' ? '양력' : '음력'}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] text-text-secondary">생년월일</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="YYYYMMDD (예: 19920914)"
              className={inputCls}
            />
            <p className="mt-1.5 text-[12px] text-text-tertiary">생년월일 8자리를 숫자로 입력해주세요. (예: 19920914)</p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[13px] text-text-secondary">태어난 시간</label>
              <button
                type="button"
                onClick={() => setTimeUnknown((v) => !v)}
                className="flex items-center gap-1.5 text-[12px] text-text-tertiary"
              >
                <span className={`flex h-4 w-4 items-center justify-center rounded-[5px] border ${timeUnknown ? 'border-cta bg-cta/80' : 'border-[var(--border-default)]'}`}>
                  {timeUnknown && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                시간을 모르시나요?
              </button>
            </div>
            {timeUnknown ? (
              <p className="rounded-xl border border-[var(--border-subtle)] bg-[rgba(20,12,38,0.4)] px-4 py-3 text-[13px] leading-relaxed text-text-secondary">
                괜찮아요. 별은 시간을 몰라도 당신을 알아본답니다.
              </p>
            ) : (
              <>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={birthTime}
                  onChange={(e) => setBirthTime(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="HHMM (예: 1322)"
                  className={inputCls}
                />
                <p className="mt-1.5 text-[12px] text-text-tertiary">
                  오전·오후 없이 24시간 기준으로 입력해주세요. (예: 오후 1시 22분 → 1322)
                </p>
              </>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] text-text-secondary">성별</label>
            <div className="grid grid-cols-2 gap-2">
              {([['male', '남성'], ['female', '여성']] as const).map(([g, label]) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  className={`h-11 rounded-xl border text-[14px] font-medium transition-all ${
                    gender === g
                      ? 'border-cta bg-cta/15 text-text-primary'
                      : 'border-[var(--border-default)] bg-[rgba(20,12,38,0.4)] text-text-tertiary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-center text-[13px] text-[var(--status-error)]">{error}</p>}

          <button
            type="button"
            onClick={submit}
            className="mt-2 w-full rounded-full bg-gradient-to-r from-cta to-cta-active py-3.5 text-[15px] font-bold text-white shadow-lg shadow-cta/20 transition-all hover:opacity-90 active:opacity-80"
          >
            내 별 찾기
          </button>
        </div>
      </div>

      {/* 별똥별 전환 오버레이 */}
      {leaving && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-[#0a0518]/85 backdrop-blur-sm">
          <div className={styles.heroDash} aria-hidden="true" />
          <p className="px-8 text-center text-[17px] leading-relaxed text-text-primary" style={{ fontFamily: 'var(--font-title)' }}>
            별 하나가 당신에게로
            <br />
            떨어지고 있어요…
          </p>
        </div>
      )}
    </div>
  );
}
