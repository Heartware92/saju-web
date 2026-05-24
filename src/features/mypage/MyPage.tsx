'use client';

/**
 * 마이페이지
 * - 프로필
 * - 크레딧 잔액 & 거래내역
 * - 구매 내역
 * (분석 기록은 보관함 /archive 가 풀 기능으로 대체)
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/useUserStore';
import { useCreditStore } from '@/store/useCreditStore';
import { useProfileStore } from '@/store/useProfileStore';
import { orderDB, auth, supabase } from '@/services/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CreditBalance } from '@/features/credit/components/CreditBalance';
import type { Order, CreditTransaction } from '@/types/credit';

type TabType = 'profile' | 'credits' | 'orders';

export const MyPage: React.FC = () => {
  const router = useRouter();
  const { user } = useUserStore();
  const { moonBalance, transactions, fetchTransactions } = useCreditStore();

  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, activeTab]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      if (activeTab === 'credits') {
        await fetchTransactions();
      } else if (activeTab === 'orders') {
        const orderList = await orderDB.getOrders(user.id);
        setOrders(orderList);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    // loading: true를 유지해서 ProtectedRoute가 로그인 카드 대신 스피너를 보여주도록 함
    useUserStore.setState({ loading: true });
    await supabase.auth.signOut().catch(() => {});
    useCreditStore.getState().reset();
    useProfileStore.getState().reset();
    router.replace('/');
    setTimeout(() => {
      useUserStore.setState({ user: null, loading: false });
    }, 300);
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'profile', label: '프로필' },
    { id: 'credits', label: '크레딧 관리' },
    { id: 'orders', label: '구매 내역' }
  ];

  return (
    <div className="min-h-screen bg-space-deep px-4 pt-4 pb-8">
        {/* 헤더 */}
        <div className="mb-5">
          <h1 className="text-xl font-bold text-text-primary mb-1">내 정보</h1>
          <p className="text-sm text-text-secondary">내 정보와 활동 내역을 확인하세요</p>
        </div>

        {/* 탭 네비게이션 — 좁은 화면에서 가로 스크롤 가능하되 스크롤바는 숨김 */}
        <div className="flex gap-1 mb-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden bg-space-surface rounded-xl p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center justify-center px-3 py-2 rounded-lg
                whitespace-nowrap transition-all text-xs font-medium flex-1
                ${
                  activeTab === tab.id
                    ? 'bg-cta text-white shadow-md shadow-cta/20'
                    : 'text-text-tertiary'
                }
              `}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="space-y-6">
          {activeTab === 'profile' && <ProfileTab user={user} onLogout={handleLogout} />}
          {activeTab === 'credits' && <CreditsTab moonBalance={moonBalance} transactions={transactions} loading={loading} />}
          {activeTab === 'orders' && <OrdersTab orders={orders} loading={loading} />}
        </div>
    </div>
  );
};

/**
 * 프로필 탭
 */
const ProfileTab: React.FC<{ user: any; onLogout: () => void }> = ({ user, onLogout }) => {
  const router = useRouter();
  const [showPwModal, setShowPwModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const isSocialLogin = user?.app_metadata?.provider && user.app_metadata.provider !== 'email';

  return (
    <>
      <Card>
        <h2 className="text-lg font-bold text-text-primary mb-5">내 정보</h2>

        <div className="space-y-0">
          <div className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)]">
            <span className="text-text-secondary text-sm">이메일</span>
            <span className="font-medium text-text-primary text-sm">{user?.email || '-'}</span>
          </div>

          {isSocialLogin && (
            <div className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)]">
              <span className="text-text-secondary text-sm">로그인 방법</span>
              <span className="font-medium text-text-primary text-sm capitalize">{user?.app_metadata?.provider}</span>
            </div>
          )}

          <div className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)]">
            <span className="text-text-secondary text-sm">휴대폰 번호</span>
            <span className="font-medium text-text-primary text-sm">
              {user?.user_metadata?.phone
                ? user.user_metadata.phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3')
                : '-'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)]">
            <span className="text-text-secondary text-sm">가입일</span>
            <span className="font-medium text-text-primary text-sm">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '-'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-text-secondary text-sm">보유 크레딧</span>
            <CreditBalance showAddButton={false} size="sm" />
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-[var(--border-subtle)] space-y-2">
          {!isSocialLogin && (
            <Button variant="outline" fullWidth onClick={() => setShowPwModal(true)}>
              비밀번호 변경
            </Button>
          )}
          <Button variant="outline" fullWidth onClick={onLogout}>
            로그아웃
          </Button>
          {/* 회원 탈퇴 — 위험 액션. 별도 영역 + 빨간 톤 */}
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="w-full mt-4 py-2.5 text-sm text-text-tertiary hover:text-status-error transition-colors"
          >
            회원 탈퇴
          </button>
        </div>
      </Card>

      {showPwModal && <ChangePasswordModal onClose={() => setShowPwModal(false)} />}
      {showDeleteModal && (
        <DeleteAccountModal
          email={user?.email || ''}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => {
            setShowDeleteModal(false);
            // 탈퇴 직후 홈으로 + 세션 정리
            router.replace('/');
            // 페이지 새로고침으로 모든 클라이언트 상태 초기화
            setTimeout(() => window.location.reload(), 200);
          }}
        />
      )}
    </>
  );
};

/**
 * 비밀번호 변경 모달 — Supabase auth.updateUser({ password }).
 * 현재 비밀번호 검증은 Supabase 가 자동 수행 (이미 로그인된 상태이므로).
 */
const ChangePasswordModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password || !confirmPassword) {
      setError('새 비밀번호를 입력해주세요.');
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
    setLoading(true);
    try {
      await auth.updatePassword(password);
      setDone(true);
      setTimeout(onClose, 1500);
    } catch (err: any) {
      console.error('Password change error:', err);
      setError('비밀번호 변경 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[400px] rounded-2xl p-6 bg-[rgba(28,18,50,0.98)] border border-[var(--border-subtle)]">
        <button type="button" onClick={onClose} className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/5 text-[var(--text-tertiary)] hover:bg-white/10 hover:text-[var(--text-primary)] transition-colors" aria-label="닫기">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
        </button>
        <h3 className="text-base font-bold text-text-primary mb-4">비밀번호 변경</h3>

        {done ? (
          <div className="rounded-lg bg-status-success/10 border border-status-success/20 p-3 text-sm text-status-success text-center">
            비밀번호가 변경됐어요!
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="rounded-lg bg-status-error/10 border border-status-error/20 p-2.5 text-xs text-status-error">
                {error}
              </div>
            )}
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">새 비밀번호</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="6자 이상"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 rounded-lg bg-space-elevated/60 border border-[var(--border-default)] px-3 pr-10 text-text-primary text-sm outline-none focus:border-cta focus:ring-1 focus:ring-cta/30"
                  required
                  autoFocus
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary p-1" aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'} tabIndex={-1}>
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">새 비밀번호 확인</label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="다시 한 번"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-11 rounded-lg bg-space-elevated/60 border border-[var(--border-default)] px-3 text-text-primary text-sm outline-none focus:border-cta focus:ring-1 focus:ring-cta/30"
                required
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" fullWidth onClick={onClose} type="button" disabled={loading}>취소</Button>
              <Button variant="sun" fullWidth type="submit" disabled={loading}>
                {loading ? '변경 중...' : '변경'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

/**
 * 회원 탈퇴 모달 — 사유 선택 + 확인 텍스트 입력 + 로그 + auth user 삭제
 */
const REASON_OPTIONS = [
  { code: 'not_useful', label: '서비스가 만족스럽지 않아요' },
  { code: 'rarely_used', label: '자주 사용하지 않아요' },
  { code: 'hard_to_use', label: '사용하기 어려워요' },
  { code: 'other', label: '기타' },
] as const;

const DeleteAccountModal: React.FC<{ email: string; onClose: () => void; onDeleted: () => void }> = ({ email, onClose, onDeleted }) => {
  const [reasonCode, setReasonCode] = useState<typeof REASON_OPTIONS[number]['code'] | ''>('');
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canDelete = reasonCode !== '' && confirmText === '탈퇴합니다';

  const handleDelete = async () => {
    if (!canDelete) return;
    setError('');
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        setError('로그인 세션이 만료됐어요. 다시 로그인 후 시도해주세요.');
        setLoading(false);
        return;
      }
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ reasonCode, reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '탈퇴 처리 실패');
      }
      // 성공 — supabase 세션 클리어
      await supabase.auth.signOut().catch(() => {});
      onDeleted();
    } catch (err: any) {
      setError(err?.message || '탈퇴 처리 중 오류가 발생했어요.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[440px] rounded-2xl p-6 bg-[rgba(28,18,50,0.98)] border border-status-error/40 max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary hover:bg-white/10 transition-colors"
          aria-label="닫기"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <h3 className="text-base font-bold text-status-error mb-3">정말 탈퇴하시겠어요?</h3>
        <p className="text-[13px] text-text-secondary leading-relaxed mb-4">
          <strong className="text-text-primary">{email}</strong> 계정의 모든 정보가 영구 삭제됩니다.<br />
          프로필·풀이 기록·크레딧·결제 내역 모두 복구할 수 없어요.
        </p>

        {error && (
          <div className="rounded-lg bg-status-error/10 border border-status-error/30 p-2.5 text-xs text-status-error mb-3">
            {error}
          </div>
        )}

        {/* 사유 */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-text-secondary mb-2">탈퇴 사유 (필수)</label>
          <div className="space-y-1.5">
            {REASON_OPTIONS.map((opt) => (
              <label key={opt.code} className="flex items-center gap-2 cursor-pointer text-[13px] text-text-secondary">
                <input
                  type="radio"
                  name="reason"
                  checked={reasonCode === opt.code}
                  onChange={() => setReasonCode(opt.code)}
                  className="accent-status-error"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          {reasonCode === 'other' && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              placeholder="자세한 이유를 알려주세요 (선택)"
              className="w-full mt-2 p-2.5 rounded-lg bg-space-elevated/60 border border-[var(--border-default)] text-[13px] text-text-primary outline-none focus:border-cta resize-none"
              rows={3}
            />
          )}
        </div>

        {/* 확인 텍스트 */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-text-secondary mb-2">
            확인을 위해 <span className="text-status-error font-bold">탈퇴합니다</span> 를 입력해주세요
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="탈퇴합니다"
            className="w-full h-11 rounded-lg bg-space-elevated/60 border border-[var(--border-default)] px-3 text-text-primary text-sm outline-none focus:border-status-error focus:ring-1 focus:ring-status-error/30"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" fullWidth onClick={onClose} disabled={loading}>취소</Button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete || loading}
            className="flex-1 h-11 rounded-lg bg-status-error text-white font-bold text-sm whitespace-nowrap transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? '처리 중...' : '영구 탈퇴'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * 크레딧 관리 탭
 */
const CreditsTab: React.FC<{
  moonBalance: number;
  transactions: CreditTransaction[];
  loading: boolean;
}> = ({ moonBalance, transactions, loading }) => {
  const router = useRouter();

  return (
    <div className="space-y-4">
      {/* 잔액 카드 */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">크레딧 잔액</h2>
          <Button variant="sun" onClick={() => router.push('/credit')}>
            충전하기
          </Button>
        </div>

        <div className="flex justify-center py-6">
          <div className="text-center">
            <div className="text-4xl mb-2">🌙</div>
            <div className="text-4xl font-bold text-text-primary mb-1">{moonBalance}</div>
            <div className="text-text-secondary text-xs">달 크레딧</div>
          </div>
        </div>
      </Card>

      {/* 거래 내역 */}
      <Card>
        <h2 className="text-lg font-bold text-text-primary mb-4">거래 내역</h2>

        {loading ? (
          <div className="text-center py-6 text-text-secondary text-sm">로딩 중...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-6 text-text-secondary text-sm">거래 내역이 없습니다.</div>
        ) : (
          <div className="space-y-0">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)] last:border-0">
                <div>
                  <div className="font-medium text-text-primary text-sm">{tx.reason}</div>
                  <div className="text-xs text-text-tertiary">
                    {new Date(tx.created_at).toLocaleString('ko-KR')}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold text-sm ${tx.amount > 0 ? 'text-sun-core' : 'text-fire-core'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount} 크레딧
                  </div>
                  <div className="text-xs text-text-tertiary">잔액: {tx.balance_after}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

/**
 * 구매 내역 탭
 */
const OrdersTab: React.FC<{ orders: Order[]; loading: boolean }> = ({ orders, loading }) => {
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: '대기중',
      completed: '완료',
      failed: '실패',
      refunded: '환불'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: 'text-text-secondary',
      completed: 'text-sun-core',
      failed: 'text-fire-core',
      refunded: 'text-text-secondary'
    };
    return colorMap[status] || 'text-text';
  };

  return (
    <Card>
      <h2 className="text-lg font-bold text-text-primary mb-4">구매 내역</h2>

      {loading ? (
        <div className="text-center py-6 text-text-secondary text-sm">로딩 중...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-6 text-text-secondary text-sm">
          구매 내역이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="border border-[var(--border-subtle)] rounded-xl p-3.5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-bold text-text-primary text-sm mb-0.5">{order.package_name}</div>
                  <div className="text-xs text-text-tertiary">
                    {new Date(order.created_at).toLocaleString('ko-KR')}
                  </div>
                </div>
                <div className={`font-bold text-xs ${getStatusColor(order.status)}`}>
                  {getStatusText(order.status)}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="text-text-tertiary">
                  {order.payment_method || '결제 수단'}
                </div>
                <div className="font-bold text-text-primary">
                  {order.amount.toLocaleString()}원
                  {order.sun_credit_amount > 0 && <span className="text-sun-core ml-2">+{order.sun_credit_amount} ☀️</span>}
                  {order.moon_credit_amount > 0 && <span className="text-moon-halo ml-2">+{order.moon_credit_amount} 🌙</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
