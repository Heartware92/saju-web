'use client';

/**
 * 휴대폰 번호 변경 모달
 * 3단계: info(안내) → verify(새 번호 + OTP) → done(완료)
 *
 * - 매월 1회 무료, 이후 5 moon 차감
 * - idempotencyKey 는 모달 마운트 시 1회 생성 → 사용자가 여러 번 클릭해도 동일 키 사용
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/services/supabase';
import { useCreditStore } from '@/store/useCreditStore';
import { Button } from '@/components/ui/Button';

type Stage = 'info' | 'verify' | 'done';

interface PhoneStatus {
  freeRemaining: number;
  requiresCredit: boolean;
  creditCost: number;
  moonBalance: number;
  hasEnoughCredit: boolean;
}

interface Props {
  currentPhone: string | null;
  onClose: () => void;
  onChanged: (newPhone: string) => void;
}

function randomKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `phone-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatTimer(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const ChangePhoneModal: React.FC<Props> = ({ currentPhone, onClose, onChanged }) => {
  const idempotencyKey = useMemo(() => randomKey(), []);

  const [stage, setStage] = useState<Stage>('info');
  const [status, setStatus] = useState<PhoneStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error, setError] = useState('');

  const [newPhone, setNewPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpLoading, setOtpLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // OTP 타이머
  useEffect(() => {
    if (otpTimer > 0) {
      timerRef.current = setInterval(() => setOtpTimer((t) => Math.max(0, t - 1)), 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [otpTimer > 0]);

  // 1) 상태 로드
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          setError('로그인 세션이 만료됐어요.');
          setStatusLoading(false);
          return;
        }
        const res = await fetch('/api/phone/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error || '상태 조회 실패');
        } else {
          setStatus(data as PhoneStatus);
        }
      } catch (e) {
        setError('상태 조회 중 오류가 발생했어요.');
      } finally {
        setStatusLoading(false);
      }
    })();
  }, []);

  const handleSendOtp = async () => {
    const cleaned = newPhone.replace(/[^0-9]/g, '');
    if (!/^01[016789]\d{7,8}$/.test(cleaned)) {
      setError('올바른 휴대폰 번호를 입력해주세요.');
      return;
    }
    if (currentPhone && cleaned === currentPhone) {
      setError('현재 사용 중인 번호와 동일해요.');
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
      if (!res.ok) throw new Error(data?.error || '발송 실패');
      setOtpSent(true);
      setOtpTimer(300);
      setOtpCode('');
    } catch (e: any) {
      setError(e?.message || '인증번호 발송에 실패했어요.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (otpCode.length !== 6) {
      setError('6자리 인증번호를 입력해주세요.');
      return;
    }
    setError('');
    setSubmitLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('로그인 세션이 만료됐어요.');
        return;
      }
      const res = await fetch('/api/phone/change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          newPhone: newPhone.replace(/[^0-9]/g, ''),
          otpCode,
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || '변경에 실패했어요.');
        return;
      }
      // 크레딧이 차감됐을 수 있으니 거래내역·잔액 새로고침
      if (status?.requiresCredit) {
        const credit = useCreditStore.getState();
        credit.fetchBalance(undefined, { force: true }).catch(() => {});
        credit.fetchTransactions().catch(() => {});
      }
      setStage('done');
      setTimeout(() => onChanged(newPhone.replace(/[^0-9]/g, '')), 1200);
    } catch (e: any) {
      setError(e?.message || '변경 처리 중 오류가 발생했어요.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const inputClass =
    'w-full h-11 rounded-lg bg-space-elevated/60 border border-[var(--border-default)] px-3 text-text-primary placeholder-text-tertiary text-sm outline-none transition-all focus:border-cta focus:ring-1 focus:ring-cta/30';

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[420px] rounded-2xl p-6 bg-[rgba(28,18,50,0.98)] border border-[var(--border-subtle)] max-h-[90vh] overflow-y-auto"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/5 text-[var(--text-tertiary)] hover:bg-white/10 hover:text-[var(--text-primary)] transition-colors"
          aria-label="닫기"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>

        <h3 className="text-base font-bold text-text-primary mb-4">휴대폰 번호 변경</h3>

        {error && (
          <div className="mb-3 rounded-lg bg-status-error/10 border border-status-error/20 p-2.5 text-xs text-status-error">
            {error}
          </div>
        )}

        {stage === 'info' && (
          <div>
            {statusLoading ? (
              <div className="py-6 text-center text-sm text-text-secondary">상태 확인 중...</div>
            ) : status ? (
              <>
                <div className="space-y-3 mb-5">
                  <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                    <span className="text-text-secondary text-sm">현재 번호</span>
                    <span className="font-medium text-text-primary text-sm">
                      {currentPhone
                        ? currentPhone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3')
                        : '-'}
                    </span>
                  </div>

                  {status.requiresCredit ? (
                    <div className="rounded-lg bg-fire-core/10 border border-fire-core/30 p-3">
                      <p className="text-sm text-text-primary font-semibold mb-1">
                        이번 달 무료 변경 횟수를 모두 사용했어요
                      </p>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        지금 변경하려면 <span className="text-moon-halo font-bold">5 🌙</span> 크레딧이
                        차감돼요. (현재 잔액: {status.moonBalance}🌙)
                      </p>
                      <p className="text-xs text-text-tertiary mt-1.5">
                        다음 달 1일이 되면 무료 변경이 다시 가능해요.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-status-success/10 border border-status-success/30 p-3">
                      <p className="text-sm text-text-primary font-semibold mb-1">
                        이번 달 무료 변경 1회 가능
                      </p>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        무료 변경은 매월 1일에 갱신돼요. 추가 변경 시 5🌙 크레딧이 차감돼요.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" fullWidth onClick={onClose}>
                    취소
                  </Button>
                  <Button
                    variant="sun"
                    fullWidth
                    onClick={() => setStage('verify')}
                    disabled={status.requiresCredit && !status.hasEnoughCredit}
                  >
                    {status.requiresCredit && !status.hasEnoughCredit
                      ? '크레딧 부족'
                      : status.requiresCredit
                        ? '5🌙 동의하고 변경'
                        : '변경하기'}
                  </Button>
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-sm text-text-secondary">상태를 불러올 수 없어요.</div>
            )}
          </div>
        )}

        {stage === 'verify' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">새 휴대폰 번호</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="01012345678"
                  value={newPhone}
                  onChange={(e) => {
                    setNewPhone(e.target.value.replace(/[^0-9]/g, ''));
                    if (otpSent) {
                      setOtpSent(false);
                      setOtpCode('');
                      setOtpTimer(0);
                    }
                  }}
                  className={`${inputClass} flex-1`}
                  maxLength={11}
                />
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpLoading || newPhone.length < 10}
                  className="shrink-0 h-11 px-3 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-space-elevated border border-[var(--border-default)] text-cta hover:bg-space-surface"
                >
                  {otpLoading ? '발송 중...' : otpSent ? '재발송' : '인증요청'}
                </button>
              </div>
            </div>

            {otpSent && (
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">인증번호</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="6자리"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  className={inputClass}
                  maxLength={6}
                  autoFocus
                />
                {otpTimer > 0 ? (
                  <p className="mt-1 text-xs text-text-tertiary">
                    남은 시간 <span className="text-cta font-medium">{formatTimer(otpTimer)}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-status-error">
                    인증 시간이 만료됐어요. 재발송을 눌러주세요.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" fullWidth onClick={() => setStage('info')} disabled={submitLoading}>
                이전
              </Button>
              <Button
                variant="sun"
                fullWidth
                onClick={handleConfirm}
                disabled={submitLoading || !otpSent || otpCode.length !== 6 || otpTimer <= 0}
              >
                {submitLoading ? '변경 중...' : '변경 확정'}
              </Button>
            </div>
          </div>
        )}

        {stage === 'done' && (
          <div className="py-4">
            <div className="rounded-lg bg-status-success/10 border border-status-success/20 p-4 text-center">
              <p className="text-sm font-semibold text-status-success mb-1">변경 완료!</p>
              <p className="text-xs text-text-secondary">
                새 번호로 업데이트됐어요.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
