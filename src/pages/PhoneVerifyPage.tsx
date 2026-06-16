'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../services/supabase';
import { useUserStore } from '../store/useUserStore';
import { notifySignupWelcome } from '../services/notify';

export default function PhoneVerifyPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);

  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [error, setError] = useState('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (otpTimer > 0) {
      timerRef.current = setInterval(() => setOtpTimer((t) => t - 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [otpTimer > 0]);

  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [user, router]);

  const formatTimer = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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
      if (!res.ok) throw new Error(data.error);
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

      const { error: updateError } = await supabase.auth.updateUser({
        data: { phone: cleaned, phone_verified: true },
      });
      if (updateError) throw updateError;

      const { data: { user: updatedUser } } = await supabase.auth.getUser();
      if (updatedUser) {
        useUserStore.setState({ user: updatedUser });
      }

      // 소셜 가입 완료 — 회원가입 환영 알림톡 (비차단·멱등은 서버 보장)
      void notifySignupWelcome();

      router.replace('/');
    } catch (err: any) {
      console.error('OTP verify error:', err);
      setError('인증번호가 올바르지 않습니다. 다시 확인해주세요.');
    } finally {
      setOtpLoading(false);
    }
  };

  const inputClass = "w-full h-12 rounded-lg bg-space-elevated/60 border border-[var(--border-default)] px-4 text-text-primary placeholder-text-tertiary text-sm outline-none transition-all focus:border-cta focus:ring-1 focus:ring-cta/30";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cta/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-moon-halo/5 rounded-full blur-3xl" />

      <div className="w-full max-w-[420px] relative z-10">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-space-surface/80 backdrop-blur-xl p-8 shadow-2xl shadow-black/20">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-text-primary mb-2">휴대폰 인증</h1>
            <p className="text-text-secondary text-sm">서비스 이용을 위해 휴대폰 인증이 필요합니다</p>
          </div>

          {error && (
            <div className="rounded-lg bg-status-error/10 border border-status-error/20 p-3 text-sm text-status-error mb-4">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                휴대폰 번호
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
            </div>

            {otpSent && !otpVerified && (
              <div className="flex gap-2">
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
              <p className="text-xs text-text-tertiary">
                인증번호가 발송되었습니다. <span className="text-cta font-medium">{formatTimer(otpTimer)}</span> 이내에 입력해주세요.
              </p>
            )}
            {otpSent && !otpVerified && otpTimer <= 0 && (
              <p className="text-xs text-status-error">인증 시간이 만료되었습니다. 다시 요청해주세요.</p>
            )}
            {otpVerified && (
              <p className="text-xs text-status-success">인증이 완료되었습니다. 잠시만 기다려주세요...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
