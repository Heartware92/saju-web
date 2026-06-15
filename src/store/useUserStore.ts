/**
 * 사용자 인증 상태 관리 (Zustand)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, auth, agreement } from '../services/supabase';
import { useCreditStore } from './useCreditStore';
import { useProfileStore } from './useProfileStore';
import { trackEvent } from '../lib/analytics/track';
import type { AuthUser } from '../types/user';

interface UserState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, phone?: string, marketingAgreed?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      loading: true,
      error: null,

      /**
       * 앱 초기화 시 인증 상태 확인
       */
      initialize: async () => {
        try {
          set({ loading: true });

          // 현재 세션 확인 → 크레딧 병렬 로드 (userId 전달로 중복 getUser 제거)
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.user) {
            set({ user: session.user, loading: false });
            useCreditStore.getState().fetchBalance(session.user.id);
            // Realtime user_credits 구독 — 어디서 차감·환불·충전되든 자동 반영
            useCreditStore.getState().subscribeToBalance(session.user.id);
            useProfileStore.getState().fetchProfiles({ userId: session.user.id });
          } else {
            set({ user: null, loading: false });
          }

          supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
              set({ user: session.user });
              useCreditStore.getState().fetchBalance(session.user.id);
              useCreditStore.getState().subscribeToBalance(session.user.id);
              useProfileStore.getState().fetchProfiles({ userId: session.user.id });
            } else {
              set({ user: null });
              // reset() 내부에서 unsubscribe 도 처리됨
              useCreditStore.getState().reset();
              useProfileStore.getState().reset();
            }
          });
        } catch (error: any) {
          console.error('Error initializing auth:', error);
          set({ error: error.message, loading: false });
        }
      },

      /**
       * 이메일/비밀번호 로그인
       */
      login: async (email: string, password: string) => {
        try {
          set({ loading: true, error: null });

          const response = await auth.signInWithEmail(email, password);

          set({ user: response.user });
          // 전환 분석: 로그인 성공 이벤트(익명 visitor_id ↔ user_id 연결). 실패해도 무시.
          if (response.user) trackEvent('login');
          if (response.user) {
            await Promise.all([
              useCreditStore.getState().fetchBalance(response.user.id, { force: true }),
              useProfileStore.getState().fetchProfiles({ force: true, userId: response.user.id }),
            ]);
          }
          set({ loading: false });
        } catch (error: any) {
          console.error('Login error:', error);
          const msg = error.message || '';
          let userMsg = '로그인에 실패했습니다. 잠시 후 다시 시도해주세요.';
          if (msg.includes('Invalid login')) {
            userMsg = '이메일 또는 비밀번호가 올바르지 않습니다';
          } else if (msg.includes('Email not confirmed')) {
            userMsg = '이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.';
          }
          set({ error: userMsg, loading: false });
          throw error;
        }
      },

      /**
       * 이메일/비밀번호 회원가입
       */
      signup: async (email: string, password: string, phone?: string, marketingAgreed?: boolean) => {
        try {
          set({ loading: true, error: null });

          const response = await auth.signUpWithEmail(email, password, phone);

          set({ user: response.user || null, loading: false });

          // 전환 분석: 가입 성공 이벤트(방문→가입 전환율 집계용). 실패해도 무시.
          if (response.user) trackEvent('signup');

          // 가입 직후 동의 정보 기록 (user_agreements 테이블)
          // 세션이 즉시 생성되는 환경(이메일 확인 비활성화)에서 RLS 통과 가능
          if (response.user) {
            try {
              await agreement.upsertMine(!!marketingAgreed);
            } catch (e) {
              console.error('Agreement upsert failed at signup (will be retried at first login):', e);
            }
          }

          // 회원가입 시 자동으로 1엽전이 Supabase Trigger로 지급됨
          // 크레딧 정보 로드
          setTimeout(() => {
            useCreditStore.getState().fetchBalance();
          }, 1000);
        } catch (error: any) {
          console.error('Signup error:', error);
          const msg = error.message || '';
          let userMsg = '회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.';
          if (msg.includes('already registered') || msg.includes('already been registered')) {
            userMsg = '이미 가입된 이메일입니다';
          } else if (msg.includes('weak_password') || msg.includes('too short')) {
            userMsg = '비밀번호가 너무 짧습니다. 6자 이상 입력해주세요.';
          } else if (msg.includes('invalid') && msg.includes('email')) {
            userMsg = '올바른 이메일 형식이 아닙니다.';
          }
          set({ error: userMsg, loading: false });
          throw error;
        }
      },

      /**
       * 로그아웃
       */
      logout: async () => {
        try {
          set({ loading: true, error: null });

          await auth.signOut();

          set({ user: null, loading: false });

          // 크레딧 / 프로필 캐시 초기화 — localStorage persist된 대표 프로필이 다음 로그인 전까지 남는 이슈 방지
          useCreditStore.getState().reset();
          useProfileStore.getState().reset();
        } catch (error: any) {
          console.error('Logout error:', error);
          set({ error: error.message, loading: false });
        }
      },

      /**
       * 비밀번호 재설정 이메일 전송
       */
      resetPassword: async (email: string) => {
        try {
          set({ loading: true, error: null });

          await auth.resetPasswordForEmail(email);

          set({ loading: false });
        } catch (error: any) {
          console.error('Reset password error:', error);
          set({ error: error.message, loading: false });
          throw error;
        }
      }
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
