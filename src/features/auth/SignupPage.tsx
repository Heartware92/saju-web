/**
 * 회원가입 페이지 - 코스믹 테마
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUserStore } from '../../store/useUserStore';
import { BackButton } from '../../components/ui/BackButton';
import { AlertModal } from '../../components/ui/Modal';

export const SignupPage: React.FC = () => {
  const router = useRouter();
  const { signup, loading } = useUserStore();

  const [email, setEmail] = useState('');
  // 이메일 중복 자동검사 — 입력칸을 벗어날 때 검사. 통과(available) 전까지 가입 버튼 비활성화.
  type EmailCheck = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';
  const [emailCheck, setEmailCheck] = useState<EmailCheck>('idle');
  const [emailTakenProvider, setEmailTakenProvider] = useState<string>('');
  const lastCheckedEmail = useRef<string>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // 비밀번호 표시·숨김 토글 — 입력 실수 줄임
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // SMS OTP 인증
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  // 한국 법규 + KISA 가이드 — 동의 항목 3개로 분리
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedAge14, setAgreedAge14] = useState(false);
  const [agreedMarketing, setAgreedMarketing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPolicy, setShowPolicy] = useState<'terms' | 'privacy' | null>(null);

  // 모두 동의 — 필수 3개 + 선택 1개
  const allAgreed = agreedTerms && agreedPrivacy && agreedAge14 && agreedMarketing;
  const toggleAllAgree = (v: boolean) => {
    setAgreedTerms(v);
    setAgreedPrivacy(v);
    setAgreedAge14(v);
    setAgreedMarketing(v);
  };

  // 비밀번호 강도 평가 — 0(없음)~4(강함). UI 바 시각화 + 색상.
  const passwordStrength = (() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
    return score; // 0~4
  })();
  const strengthLabel = ['', '매우 약함', '약함', '보통', '강함'][passwordStrength];
  const strengthColor = ['', '#F87171', '#FB923C', '#FBBF24', '#34D399'][passwordStrength];

  // OTP 타이머
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (otpTimer > 0) {
      timerRef.current = setInterval(() => setOtpTimer((t) => t - 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [otpTimer > 0]);

  const formatTimer = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const providerLabel = (p: string) =>
    p === 'google' ? '구글' : p === 'kakao' ? '카카오' : '이메일';

  // 이메일 입력칸을 벗어날 때 중복 검사. 같은 값 재검사는 생략.
  const handleEmailBlur = async () => {
    const value = email.trim();
    if (!value) { setEmailCheck('idle'); return; }
    if (!EMAIL_RE.test(value)) { setEmailCheck('invalid'); return; }
    if (lastCheckedEmail.current === value && emailCheck !== 'idle') return;

    setEmailCheck('checking');
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
      const data = await res.json();
      lastCheckedEmail.current = value;
      if (data.available) {
        setEmailCheck('available');
        setEmailTakenProvider('');
      } else {
        setEmailCheck('taken');
        setEmailTakenProvider(data.provider || 'email');
      }
    } catch {
      // 검사 실패 시 막지 않음 — 최종 방어는 제출 시 서버 에러
      setEmailCheck('idle');
    }
  };

  const handleSendOtp = async () => {
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (!/^01[016789]\d{7,8}$/.test(cleaned)) {
      setError('올바른 휴대폰 번호를 입력해주세요.');
      return;
    }
    setError('');
    setOtpLoading(true);
    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 서버가 사유를 명시해 보낸 경우(예: 이미 가입한 번호) 그대로 노출 — 사용자가 원인을 알 수 있게.
        setError(data?.error || '인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      setOtpSent(true);
      setOtpTimer(300);
      setOtpVerified(false);
      setOtpCode('');
    } catch (err: any) {
      console.error('OTP send error:', err);
      setError('인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setError('6자리 인증번호를 입력해주세요.');
      return;
    }
    setError('');
    setOtpLoading(true);
    try {
      const cleaned = phone.replace(/[^0-9]/g, '');
      const res = await fetch('/api/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned, code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOtpVerified(true);
      setOtpTimer(0);
    } catch (err: any) {
      console.error('OTP verify error:', err);
      setError('인증번호가 올바르지 않습니다. 다시 확인해주세요.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email || !password || !confirmPassword || !phone) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    if (emailCheck === 'taken') {
      setError(`이미 ${providerLabel(emailTakenProvider)}로 가입된 이메일이에요.`);
      return;
    }

    if (!otpVerified) {
      setError('휴대폰 인증을 완료해주세요.');
      return;
    }

    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (!agreedTerms) {
      setError('이용약관에 동의해주세요.');
      return;
    }
    if (!agreedPrivacy) {
      setError('개인정보처리방침에 동의해주세요.');
      return;
    }
    if (!agreedAge14) {
      setError('만 14세 이상임을 확인해주세요.');
      return;
    }

    try {
      await signup(email, password, phone.replace(/[^0-9]/g, ''), agreedMarketing);
      setSuccess(true);
      setTimeout(() => {
        router.replace('/');
      }, 1500);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError('이미 가입된 이메일입니다.');
      } else if (msg.includes('invalid') && msg.includes('email')) {
        setError('올바른 이메일 형식이 아닙니다.');
      } else if (msg.includes('weak_password') || msg.includes('too short')) {
        setError('비밀번호가 너무 짧습니다. 6자 이상 입력해주세요.');
      } else {
        setError('회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    }
  };

  const inputClass = "w-full h-12 rounded-lg bg-space-elevated/60 border border-[var(--border-default)] px-4 text-text-primary placeholder-text-tertiary text-sm outline-none transition-all focus:border-cta focus:ring-1 focus:ring-cta/30";

  return (
    <div className="app-auth-shell">
      <div className="app-auth-container flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* 뒤로가기 — 최상단 좌측 absolute 고정 (텍스트 없는 아이콘만, 공통 BackButton)
         이메일 폼 단계면 단계 뒤로, 아니면 홈으로 — 둘 다 onClick 으로 처리 */}
      <div className="absolute top-3 left-3 z-20">
        <BackButton to="/" />
      </div>

      {/* Background glow effects */}
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-cta/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-sun-core/5 rounded-full blur-3xl" />

      <div className="w-full relative z-10">
        {/* Card */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-space-surface/80 backdrop-blur-xl p-8 shadow-2xl shadow-black/20">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-text-primary mb-2">회원가입</h1>
            <p className="text-text-secondary text-sm">정보를 입력해주세요</p>
          </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {success && (
                <div className="rounded-lg bg-status-success/10 border border-status-success/20 p-3 text-sm text-status-success font-medium text-center">
                  회원가입 완료! 홈으로 이동합니다...
                </div>
              )}


              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  이메일 <span className="text-status-error">*</span>
                </label>
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    // 값이 바뀌면 이전 검사 결과 무효화
                    if (emailCheck !== 'idle') setEmailCheck('idle');
                  }}
                  onBlur={handleEmailBlur}
                  className={inputClass}
                  autoComplete="email"
                  required
                />
                {emailCheck === 'checking' && (
                  <p className="mt-1 text-xs text-text-tertiary">이메일 확인 중...</p>
                )}
                {emailCheck === 'invalid' && (
                  <p className="mt-1 text-xs text-status-error">올바른 이메일 형식이 아니에요.</p>
                )}
                {emailCheck === 'available' && (
                  <p className="mt-1 text-xs text-status-success">사용 가능한 이메일이에요.</p>
                )}
                {emailCheck === 'taken' && (
                  <p className="mt-1 text-xs text-status-error">
                    이미 {providerLabel(emailTakenProvider)}로 가입된 이메일이에요.{' '}
                    {emailTakenProvider === 'email'
                      ? '로그인해주세요.'
                      : `${providerLabel(emailTakenProvider)} 간편 로그인을 이용해주세요.`}
                  </p>
                )}
              </div>

              {/* Phone — SMS OTP 인증 */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  휴대폰 번호 <span className="text-status-error">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="01012345678"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/[^0-9]/g, ''));
                      if (otpVerified) { setOtpVerified(false); setOtpSent(false); }
                    }}
                    className={`${inputClass} flex-1`}
                    maxLength={11}
                    disabled={otpVerified}
                  />
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={otpLoading || otpVerified || phone.length < 10}
                    className="shrink-0 h-12 px-4 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-space-elevated border border-[var(--border-default)] text-cta hover:bg-space-surface"
                  >
                    {otpLoading ? '발송 중...' : otpVerified ? '인증완료' : otpSent ? '재발송' : '인증요청'}
                  </button>
                </div>
                {otpSent && !otpVerified && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="인증번호 6자리"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      className={`${inputClass} flex-1`}
                      maxLength={6}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={otpLoading || otpCode.length !== 6 || otpTimer <= 0}
                      className="shrink-0 h-12 px-4 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-cta to-cta-active text-white"
                    >
                      확인
                    </button>
                  </div>
                )}
                {otpSent && !otpVerified && otpTimer > 0 && (
                  <p className="mt-1 text-xs text-text-tertiary">
                    인증번호가 발송되었습니다. <span className="text-cta font-medium">{formatTimer(otpTimer)}</span> 이내에 입력해주세요.
                  </p>
                )}
                {otpSent && !otpVerified && otpTimer <= 0 && (
                  <p className="mt-1 text-xs text-status-error">인증 시간이 만료되었습니다. 다시 요청해주세요.</p>
                )}
                {otpVerified && (
                  <p className="mt-1 text-xs text-status-success">휴대폰 인증이 완료되었습니다.</p>
                )}
              </div>

              {/* Password — 표시·숨김 토글 + 강도 시각화 */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  비밀번호 <span className="text-status-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="최소 6자 이상"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} pr-12`}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary p-1"
                    aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>
                {/* 강도 시각화 — 4단계 */}
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="h-1.5 flex-1 rounded-full transition-colors"
                          style={{
                            backgroundColor: passwordStrength >= i ? strengthColor : 'rgba(255,255,255,0.08)',
                          }}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-xs" style={{ color: strengthColor || 'var(--text-tertiary)' }}>
                      {strengthLabel || '비밀번호 강도'}
                    </p>
                  </div>
                )}
                <p className="mt-1 text-xs text-text-tertiary">영문 대소문자·숫자·기호 조합 권장 · 8자 이상</p>
              </div>

              {/* Confirm Password — 토글 */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  비밀번호 확인 <span className="text-status-error">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="비밀번호를 다시 입력하세요"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`${inputClass} pr-12`}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary p-1"
                    aria-label={showConfirmPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <p className="mt-1 text-xs text-status-error">비밀번호가 일치하지 않아요</p>
                )}
              </div>

              {/* 동의 항목 — 한국 KISA 가이드: 이용약관·개인정보·만14세 별도 분리.
                  인앱 브라우저(카카오/네이버 WebView)에서 네이티브 label↔checkbox 탭 포워딩이
                  불안정해 체크 누락 제보 → 행 전체를 React가 직접 제어하는 토글로 변경.
                  체크박스는 표시 전용(pointer-events-none), 탭은 행 div가 단일 처리. */}
              <div className="pt-2 space-y-2.5 border-t border-[var(--border-subtle)] pt-4 text-left">
                {/* 모두 동의 */}
                <div
                  role="checkbox" aria-checked={allAgreed} tabIndex={0}
                  onClick={() => toggleAllAgree(!allAgreed)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAllAgree(!allAgreed); } }}
                  className="flex items-start gap-3 cursor-pointer pb-2 border-b border-[var(--border-subtle)] text-left touch-manipulation select-none"
                >
                  <input
                    type="checkbox"
                    checked={allAgreed}
                    readOnly
                    tabIndex={-1}
                    className="w-5 h-5 mt-0.5 rounded accent-[var(--cta-primary)] shrink-0 pointer-events-none"
                  />
                  <span className="text-sm font-semibold text-text-primary flex-1 text-left">모두 동의 (필수 + 선택 포함)</span>
                </div>

                {/* 이용약관 */}
                <div
                  role="checkbox" aria-checked={agreedTerms} tabIndex={0}
                  onClick={() => setAgreedTerms((v) => !v)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAgreedTerms((v) => !v); } }}
                  className="flex items-start gap-3 cursor-pointer text-left touch-manipulation select-none"
                >
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    readOnly
                    tabIndex={-1}
                    className="w-5 h-5 mt-0.5 rounded accent-[var(--cta-primary)] shrink-0 pointer-events-none"
                  />
                  <span className="text-sm text-text-secondary flex-1 text-left">
                    <span className="text-status-error font-bold">[필수]</span>{' '}
                    이용약관에 동의합니다{' '}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowPolicy('terms'); }}
                      className="text-cta hover:underline font-medium"
                    >
                      보기
                    </button>
                  </span>
                </div>

                {/* 개인정보처리방침 */}
                <div
                  role="checkbox" aria-checked={agreedPrivacy} tabIndex={0}
                  onClick={() => setAgreedPrivacy((v) => !v)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAgreedPrivacy((v) => !v); } }}
                  className="flex items-start gap-3 cursor-pointer text-left touch-manipulation select-none"
                >
                  <input
                    type="checkbox"
                    checked={agreedPrivacy}
                    readOnly
                    tabIndex={-1}
                    className="w-5 h-5 mt-0.5 rounded accent-[var(--cta-primary)] shrink-0 pointer-events-none"
                  />
                  <span className="text-sm text-text-secondary flex-1 text-left">
                    <span className="text-status-error font-bold">[필수]</span>{' '}
                    개인정보처리방침에 동의합니다{' '}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowPolicy('privacy'); }}
                      className="text-cta hover:underline font-medium"
                    >
                      보기
                    </button>
                  </span>
                </div>

                {/* 만 14세 이상 — 한국 개인정보보호법 22조 의무 */}
                <div
                  role="checkbox" aria-checked={agreedAge14} tabIndex={0}
                  onClick={() => setAgreedAge14((v) => !v)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAgreedAge14((v) => !v); } }}
                  className="flex items-start gap-3 cursor-pointer text-left touch-manipulation select-none"
                >
                  <input
                    type="checkbox"
                    checked={agreedAge14}
                    readOnly
                    tabIndex={-1}
                    className="w-5 h-5 mt-0.5 rounded accent-[var(--cta-primary)] shrink-0 pointer-events-none"
                  />
                  <span className="text-sm text-text-secondary flex-1 text-left">
                    <span className="text-status-error font-bold">[필수]</span>{' '}
                    만 14세 이상입니다
                  </span>
                </div>

                {/* 마케팅 수신 동의 */}
                <div
                  role="checkbox" aria-checked={agreedMarketing} tabIndex={0}
                  onClick={() => setAgreedMarketing((v) => !v)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAgreedMarketing((v) => !v); } }}
                  className="flex items-start gap-3 cursor-pointer text-left touch-manipulation select-none"
                >
                  <input
                    type="checkbox"
                    checked={agreedMarketing}
                    readOnly
                    tabIndex={-1}
                    className="w-5 h-5 mt-0.5 rounded accent-[var(--cta-primary)] shrink-0 pointer-events-none"
                  />
                  <span className="text-sm text-text-secondary flex-1 text-left">
                    <span className="text-text-tertiary font-bold">[선택]</span>{' '}
                    이벤트·혜택 등 마케팅 정보 수신에 동의합니다
                  </span>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || success || emailCheck === 'taken' || emailCheck === 'checking' || emailCheck === 'invalid'}
                className="w-full h-12 rounded-lg bg-gradient-to-r from-cta to-cta-active text-white font-bold text-sm cursor-pointer transition-all hover:opacity-90 hover:shadow-lg hover:shadow-cta/20 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                {loading ? '가입 중...' : '회원가입 완료'}
              </button>
            </form>

          {/* Bottom link */}
          <div className="mt-6 text-center text-sm">
            <span className="text-text-tertiary">이미 계정이 있으신가요?</span>{' '}
            <Link href="/login" className="text-cta font-semibold hover:underline">
              로그인
            </Link>
          </div>
        </div>
      </div>
      </div>

      {/* 이용약관 / 개인정보처리방침 뷰어 모달 */}
      {showPolicy && (
        <div className="fixed inset-0 z-[70] bg-space-deep flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-space-surface/90 backdrop-blur-sm shrink-0">
            <button
              type="button"
              onClick={() => setShowPolicy(null)}
              className="text-text-secondary hover:text-text-primary text-sm flex items-center gap-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              닫기
            </button>
            <h2 className="text-sm font-bold text-text-primary">
              {showPolicy === 'terms' ? '이용약관' : '개인정보처리방침'}
            </h2>
            <div className="w-12" />
          </div>
          <iframe
            src={`/${showPolicy}?embed=1`}
            className="flex-1 w-full border-none"
            title={showPolicy === 'terms' ? '이용약관' : '개인정보처리방침'}
          />
        </div>
      )}

      {/* 검증 실패 등 알림 — 긴 폼이라 상단 배너 대신 모달로 띄워 바로 인지하게 한다 */}
      <AlertModal message={error} onClose={() => setError('')} title="회원가입" />
    </div>
  );
};
