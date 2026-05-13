/**
 * 크레딧 상태 관리 (Zustand)
 * 해(☀️)/달(🌙) 이중 크레딧 시스템
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { creditDB, auth } from '../services/supabase';
import type { CreditType, CreditTransaction } from '../types/credit';

const STALE_MS = 30_000; // 30초 내 재조회 생략

interface CreditState {
  sunBalance: number;
  moonBalance: number;
  transactions: CreditTransaction[];
  loading: boolean;
  error: string | null;
  lastFetched: number; // timestamp

  /**
   * 상담소 남은 질문 수 (팩 단위 차감 모델)
   * - 팩 구매 시 +3
   * - 질문할 때마다 -1 (로컬만, 크레딧 차감 없음)
   */
  consultationRemaining: number;

  fetchBalance: (userId?: string, opts?: { force?: boolean }) => Promise<void>;
  fetchTransactions: (userId?: string) => Promise<void>;
  /** idempotencyKey: 권장. record_id 등을 넘기면 DB 가 이중 차감 차단. */
  consumeCredit: (creditType: CreditType, amount: number, reason: string, idempotencyKey?: string) => Promise<boolean>;

  /**
   * 크레딧 차감 + 서버 재조회까지 묶은 헬퍼.
   * 낙관적 업데이트 후 서버에서 진짜 잔액을 재조회해 UI를 진실의 원천과 동기화.
   * idempotencyKey 권장 — record_id 같은 식별자로 이중 차감 차단.
   */
  chargeForContent: (creditType: CreditType, amount: number, reason: string, idempotencyKey?: string) => Promise<boolean>;

  /**
   * 잘못 차감된 크레딧 환불 — 응답 검증 실패 후 자동 환불 또는 어드민 수동 환불.
   * 잔액 +amount, 'refund' 거래 기록.
   * idempotencyKey 권장: `refund-${recordId}` 같이.
   */
  refundCredit: (creditType: CreditType, amount: number, reason: string, idempotencyKey?: string) => Promise<boolean>;

  /** 상담소 질문팩 구매 — sun 1 또는 moon 3 */
  purchaseConsultationPack: (payWith: 'sun' | 'moon') => Promise<boolean>;
  /** 상담소 질문 1개 사용 (팩에서 차감) */
  useConsultationQuestion: () => boolean;

  reset: () => void;
}

export const useCreditStore = create<CreditState>()(
  persist(
    (set, get) => ({
      sunBalance: 0,
      moonBalance: 0,
      transactions: [],
      loading: false,
      error: null,
      lastFetched: 0,
      consultationRemaining: 0,

      fetchBalance: async (userId?: string, opts?: { force?: boolean }) => {
        // stale-time: 30초 내 중복 요청 차단 (force=true 면 무시)
        if (!opts?.force && Date.now() - get().lastFetched < STALE_MS) return;

        try {
          set({ loading: true, error: null });

          // userId가 전달되면 getUser() 네트워크 왕복 생략
          const uid = userId ?? (await auth.getCurrentUser())?.id;
          if (!uid) {
            set({ sunBalance: 0, moonBalance: 0, loading: false });
            return;
          }

          const userCredit = await creditDB.getBalance(uid);
          set({
            sunBalance: userCredit?.sun_balance ?? 0,
            moonBalance: userCredit?.moon_balance ?? 0,
            loading: false,
            lastFetched: Date.now(),
          });
        } catch (error: any) {
          console.error('Error fetching balance:', error);
          set({ error: error.message, loading: false });
        }
      },

      fetchTransactions: async (userId?: string) => {
        try {
          set({ loading: true, error: null });

          const uid = userId ?? (await auth.getCurrentUser())?.id;
          if (!uid) {
            set({ transactions: [], loading: false });
            return;
          }

          const transactions = await creditDB.getTransactions(uid);
          set({ transactions, loading: false });
        } catch (error: any) {
          console.error('Error fetching transactions:', error);
          set({ error: error.message, loading: false });
        }
      },

      consumeCredit: async (creditType: CreditType, amount: number, reason: string, idempotencyKey?: string): Promise<boolean> => {
        const currentBalance = creditType === 'sun' ? get().sunBalance : get().moonBalance;

        if (currentBalance < amount) {
          const label = creditType === 'sun' ? '해' : '달';
          set({ error: `${label} 크레딧이 부족합니다` });
          return false;
        }

        try {
          set({ loading: true, error: null });
          const user = await auth.getCurrentUser();

          if (!user) throw new Error('로그인이 필요합니다');

          // user.id prefix — 다른 사용자가 같은 birth/cacheKey 를 입력해도 idempotency 충돌 없음
          const fullKey = idempotencyKey ? `${user.id}:${idempotencyKey}` : undefined;
          const success = await creditDB.consumeCredit(user.id, creditType, amount, reason, fullKey);

          if (success) {
            // 'duplicate' 도 success — 이미 차감됐으니 잔액 재조회만 하면 됨
            // 낙관적 업데이트는 일단 적용했다가, force fetchBalance 가 진실로 덮어씀
            const newBalance = currentBalance - amount;
            set({
              ...(creditType === 'sun' ? { sunBalance: newBalance } : { moonBalance: newBalance }),
              loading: false,
              lastFetched: Date.now(),
            });
            get().fetchTransactions(user.id);
          }

          return success;
        } catch (error: any) {
          console.error('Error consuming credit:', error);
          set({ error: error.message, loading: false });
          return false;
        }
      },

      /**
       * 차감 + 서버 재조회. 컨텐츠 페이지에서 consumeCredit 대신 이걸 쓰면
       * 낙관적 업데이트와 DB 진실 사이 불일치가 생겨도 UI가 즉시 바로잡힘.
       * idempotencyKey: 권장 — record_id 등을 넘기면 DB 가 이중 차감 차단.
       */
      chargeForContent: async (creditType, amount, reason, idempotencyKey) => {
        const ok = await get().consumeCredit(creditType, amount, reason, idempotencyKey);
        if (ok) {
          // 서버 진실로 덮어쓰기 — duplicate 였다면 낙관적 -amount 가 잘못된 거니 force fetch 가 보정
          try {
            const user = await auth.getCurrentUser();
            if (user) await get().fetchBalance(user.id, { force: true });
          } catch {
            // 재조회 실패는 무시
          }
        }
        return ok;
      },

      /** 환불 — 잔액 +amount, 'refund' 거래 기록. */
      refundCredit: async (creditType, amount, reason, idempotencyKey) => {
        try {
          const user = await auth.getCurrentUser();
          if (!user) return false;
          const fullKey = idempotencyKey ? `${user.id}:refund:${idempotencyKey}` : undefined;
          const ok = await creditDB.refundCredit(user.id, creditType, amount, reason, fullKey);
          if (ok) {
            // 잔액 즉시 반영 (낙관적 업데이트)
            const currentBalance = creditType === 'sun' ? get().sunBalance : get().moonBalance;
            set({
              ...(creditType === 'sun'
                ? { sunBalance: currentBalance + amount }
                : { moonBalance: currentBalance + amount }),
              lastFetched: Date.now(),
            });
            // 서버 진실 재조회
            try {
              await get().fetchBalance(user.id, { force: true });
              await get().fetchTransactions(user.id);
            } catch {
              // 재조회 실패 무시
            }
          }
          return ok;
        } catch (e: any) {
          console.error('refundCredit failed', e);
          return false;
        }
      },

      /**
       * 상담소 질문팩 구매.
       * - sun: 해 1개 차감 → 3 질문 적립
       * - moon: 달 3개 차감 → 3 질문 적립
       */
      purchaseConsultationPack: async (payWith) => {
        const cost = payWith === 'sun' ? 1 : 3;
        const ok = await get().chargeForContent(payWith, cost, '상담소 질문팩(3질문)');
        if (ok) {
          set(state => ({ consultationRemaining: state.consultationRemaining + 3 }));
        }
        return ok;
      },

      /**
       * 상담소 질문 1개 사용. 팩 잔량에서만 차감 (크레딧은 팩 구매 시 이미 차감됨).
       * @returns false면 팩이 비어있어 구매 필요.
       */
      useConsultationQuestion: () => {
        const remaining = get().consultationRemaining;
        if (remaining <= 0) return false;
        set({ consultationRemaining: remaining - 1 });
        return true;
      },

      reset: () => {
        set({
          sunBalance: 0,
          moonBalance: 0,
          transactions: [],
          loading: false,
          error: null,
          lastFetched: 0,
          consultationRemaining: 0,
        });
      },
    }),
    {
      name: 'credit-storage',
      partialize: (state) => ({
        sunBalance: state.sunBalance,
        moonBalance: state.moonBalance,
        consultationRemaining: state.consultationRemaining,
      }),
    }
  )
);
