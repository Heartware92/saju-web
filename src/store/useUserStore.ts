/**
 * 사용자 인증 상태 관리 (Zustand)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, auth } from '../services/supabase';
import { useCreditStore } from './useCreditStore';
import { useProfileStore } from './useProfileStore';
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
            useProfileStore.getState().fetchProfiles({ userId: session.user.id });
          } else {
            set({ user: null, loading: false });
          }

          supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
              set({ user: session.user });
              useCreditStore.getState().fetchBalance(session.user.id);
              useProfileStore.getState().fetchProfiles({ userId: session.user.id });
            } else {
              set({ user: null });
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

          const response = await auth.signUpWithEmail(email, password, phone, marketingAgreed);

          set({ user: response.user || null, loading: false });

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
