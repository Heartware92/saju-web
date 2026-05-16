/**
 * 크레딧 상태 관리 (Zustand)
 *
 * 2026-05-16 단일 달 크레딧 통합:
 * - 옛 해(sun) 시스템 폐지. sunBalance 는 항상 0 (호환 prop 만 유지)
 * - 모든 차감/환불은 'moon' 으로 라우팅 — creditType 파라미터는 항상 'moon' 으로 강제
 * - 옛 호출처가 'sun' 으로 호출해도 내부적으로 'moon' 으로 처리
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { creditDB, auth } from '../services/supabase';
import type { CreditType, CreditTransaction } from '../types/credit';

const STALE_MS = 30_000; // 30초 내 재조회 생략

interface CreditState {
  /** @deprecated 항상 0. 단일 달 시스템 도입(2026-05-16)으로 폐지. moonBalance 만 사용 */
  sunBalance: number;
  moonBalance: number;
  transactions: CreditTransaction[];
  loading: boolean;
  error: string | null;
  lastFetched: number;

  /**
   * @deprecated 상담소 팩 정책 폐지(2026-05-16). 질문마다 직접 chargeForContent('moon', 1, …).
   * 옛 사용자 잔여분 호환을 위해 state 만 유지.
   */
  consultationRemaining: number;

  fetchBalance: (userId?: string, opts?: { force?: boolean }) => Promise<void>;
  fetchTransactions: (userId?: string) => Promise<void>;
  /**
   * 크레딧 차감. creditType 은 호환 위해 받지만 항상 'moon' 으로 처리됨.
   * idempotencyKey: 권장 — record_id 등을 넘기면 DB 가 이중 차감 차단.
   */
  consumeCredit: (creditType: CreditType, amount: number, reason: string, idempotencyKey?: string) => Promise<boolean>;
  chargeForContent: (creditType: CreditType, amount: number, reason: string, idempotencyKey?: string) => Promise<boolean>;
  /** 환불 — 잔액 +amount, creditType 무시(항상 moon). */
  refundCredit: (creditType: CreditType, amount: number, reason: string, idempotencyKey?: string) => Promise<boolean>;

  /** @deprecated 팩 정책 폐지. ConsultationChatPage 가 직접 chargeForContent 호출. */
  purchaseConsultationPack: (payWith: 'sun' | 'moon') => Promise<boolean>;
  /** @deprecated 팩 정책 폐지. */
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
        if (!opts?.force && Date.now() - get().lastFetched < STALE_MS) return;

        try {
          set({ loading: true, error: null });

          const uid = userId ?? (await auth.getCurrentUser())?.id;
          if (!uid) {
            set({ sunBalance: 0, moonBalance: 0, loading: false });
            return;
          }

          const userCredit = await creditDB.getBalance(uid);
          // 단일 달 시스템 — sun_balance 가 남아있을 수 있으나 항상 moon 으로 통합 표시
          // (DB 마이그레이션 033 이후 sun_balance 는 0 이어야 정상)
          set({
            sunBalance: 0,
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

      consumeCredit: async (_creditType, amount, reason, idempotencyKey): Promise<boolean> => {
        // 단일 달 시스템 — creditType 인자 무시하고 항상 'moon' 으로 처리
        const currentBalance = get().moonBalance;

        if (currentBalance < amount) {
          set({ error: '🌙 크레딧이 부족합니다' });
          return false;
        }

        try {
          set({ loading: true, error: null });
          const user = await auth.getCurrentUser();
          if (!user) throw new Error('로그인이 필요합니다');

          const fullKey = idempotencyKey ? `${user.id}:${idempotencyKey}` : undefined;
          const success = await creditDB.consumeCredit(user.id, 'moon', amount, reason, fullKey);

          if (success) {
            const newBalance = currentBalance - amount;
            set({
              moonBalance: newBalance,
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

      chargeForContent: async (creditType, amount, reason, idempotencyKey) => {
        const ok = await get().consumeCredit(creditType, amount, reason, idempotencyKey);
        if (ok) {
          try {
            const user = await auth.getCurrentUser();
            if (user) await get().fetchBalance(user.id, { force: true });
          } catch {
            /* 재조회 실패 무시 */
          }
        }
        return ok;
      },

      refundCredit: async (_creditType, amount, reason, idempotencyKey) => {
        // 단일 달 시스템 — _creditType 무시, 항상 moon 으로 환불
        try {
          const user = await auth.getCurrentUser();
          if (!user) return false;
          const fullKey = idempotencyKey ? `${user.id}:refund:${idempotencyKey}` : undefined;
          const ok = await creditDB.refundCredit(user.id, 'moon', amount, reason, fullKey);
          if (ok) {
            set({
              moonBalance: get().moonBalance + amount,
              lastFetched: Date.now(),
            });
            try {
              await get().fetchBalance(user.id, { force: true });
              await get().fetchTransactions(user.id);
            } catch {
              /* 재조회 실패 무시 */
            }
          }
          return ok;
        } catch (e: any) {
          console.error('refundCredit failed', e);
          return false;
        }
      },

      /**
       * @deprecated 팩 정책 폐지(2026-05-16). 옛 호출처 호환을 위해 잠시 유지.
       * 실제 동작: 달 차감만 일어남(팩 적립 안 함).
       */
      purchaseConsultationPack: async () => {
        // No-op stub — 새 정책에서는 ConsultationChatPage 가 직접 질문마다 차감
        return false;
      },
      /** @deprecated 팩 정책 폐지. */
      useConsultationQuestion: () => false,

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
