/**
 * Supabase 클라이언트 설정 및 헬퍼 함수
 */

import { createClient } from '@supabase/supabase-js';
import type {
  CreditType,
  CreditTransaction,
  Order,
  UserCredit,
  SajuRecord,
  TarotRecord,
  BirthProfile
} from '../types/credit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 인증 관련 헬퍼 함수
 */

export const auth = {
  // 현재 로그인한 사용자 가져오기
  getCurrentUser: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  // 이메일/비밀번호 로그인
  signInWithEmail: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  signUpWithEmail: async (
    email: string,
    password: string,
    phone?: string
  ) => {
    const redirectBase = typeof window !== 'undefined' ? window.location.origin : '';
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${redirectBase}/auth/callback`,
        data: phone ? { phone } : undefined,
      },
    });
    if (error) throw error;
    return data;
  },

  // 비밀번호 재설정 이메일 발송 — /auth/update-password 로 redirect
  resetPasswordForEmail: async (email: string) => {
    const redirectBase = typeof window !== 'undefined' ? window.location.origin : '';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${redirectBase}/auth/update-password`,
    });
    if (error) throw error;
  },

  // 비밀번호 업데이트 — 재설정 메일 링크 클릭 후 또는 마이페이지에서 사용
  updatePassword: async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  // 로그아웃
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * OAuth 소셜 로그인 (Google / Kakao) — Supabase 네이티브 지원 제공자.
   * 브라우저가 제공자의 인증 페이지로 이동한 뒤, 완료되면
   * `NEXT_PUBLIC_BASE_URL/auth/callback` 으로 돌아와 code 교환이 이뤄진다.
   */
  signInWithProvider: async (provider: 'google' | 'kakao') => {
    const baseUrl =
      typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');

    // 새 소셜 로그인 시작 전 기존 세션(로컬)을 정리한다.
    // 안 그러면 살아있던 다른 provider 세션이 콜백에서 복원돼,
    // 예) 카카오를 눌렀는데 기존 구글 세션으로 로그인돼 버리는 문제가 생긴다.
    try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* noop */ }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${baseUrl}/auth/callback`,
      },
    });
    if (error) throw error;
    return data;
  },

};

/**
 * 약관 동의 정보 — public.user_agreements 테이블 분리 저장.
 * (auth.users.user_metadata 는 OAuth provider 가 덮어쓸 수 있어 신뢰 불가)
 */
export interface UserAgreement {
  user_id: string;
  terms_agreed_at: string;
  privacy_agreed_at: string;
  age14_agreed_at: string;
  marketing_agreed_at: string | null;
  updated_at: string;
}

export const agreement = {
  /** 현재 로그인 사용자의 동의 레코드 조회 — 없으면 null */
  getMine: async (): Promise<UserAgreement | null> => {
    const { data, error } = await supabase
      .from('user_agreements')
      .select('*')
      .maybeSingle();
    if (error) {
      console.error('Error fetching agreement:', error);
      return null;
    }
    return (data as UserAgreement | null) ?? null;
  },

  /** 동의 정보 upsert — 가입/첫 OAuth 후 ConsentPage 에서 호출 */
  upsertMine: async (marketingAgreed: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('user_agreements')
      .upsert({
        user_id: user.id,
        terms_agreed_at: nowIso,
        privacy_agreed_at: nowIso,
        age14_agreed_at: nowIso,
        marketing_agreed_at: marketingAgreed ? nowIso : null,
        updated_at: nowIso,
      });
    if (error) throw error;
  },
};

/**
 * 크레딧 관련 DB 함수
 */

export const creditDB = {
  // 사용자 크레딧 잔액 조회 (해/달 모두)
  getBalance: async (userId: string): Promise<UserCredit | null> => {
    const { data, error } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    // error 와 "row 없음" 을 구분한다.
    // - error: 조회 실패 → throw. 호출처가 잔액을 0 으로 오인하면 안 됨
    //   (탭 복귀 시 토큰 갱신 중 일시적 조회 실패가 잔액 0 으로 표시되던 버그 차단)
    // - data=null & error=null: 진짜 row 없음(신규 가입 직후 등) → null 반환
    if (error) {
      console.error('Error fetching balance:', error);
      throw error;
    }

    return data;
  },

  // 크레딧 잔액 업데이트 (특정 타입)
  updateBalance: async (userId: string, creditType: CreditType, newBalance: number) => {
    const field = creditType === 'sun' ? 'sun_balance' : 'moon_balance';
    const { error } = await supabase
      .from('user_credits')
      .update({ [field]: newBalance })
      .eq('user_id', userId);

    if (error) throw error;
  },

  /**
   * 크레딧 차감 (원자적 RPC).
   * - 잔액 조회·차감·transaction 기록·idempotency 체크가 단일 트랜잭션 내에서 실행
   * - race condition·partial failure·이중 차감 모두 DB 레벨 차단
   * - idempotencyKey 권장: 같은 key 재호출 시 DB가 'duplicate' 반환 → 이중 차감 0
   *   일반적으로 recordId 또는 `${kind}:${recordId}` 형태 사용
   */
  consumeCredit: async (
    userId: string,
    creditType: CreditType,
    amount: number,
    reason: string,
    idempotencyKey?: string,
  ): Promise<boolean> => {
    const { data, error } = await supabase.rpc('consume_credit_atomic', {
      p_user_id: userId,
      p_credit_type: creditType,
      p_amount: amount,
      p_reason: reason,
      p_idempotency_key: idempotencyKey ?? null,
    });
    if (error) {
      console.error('[consumeCredit] RPC error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        idempotencyKey,
        reason,
      });
      return false;
    }
    console.log('[consumeCredit] RPC ok:', { data, idempotencyKey, reason });
    // 'ok' / 'duplicate' 모두 사용자 입장에선 성공
    // 'insufficient' / 'no_user' / 'invalid_type' / 'invalid_amount' 는 실패
    if (data === 'ok') return true;
    if (data === 'duplicate') {
      console.warn('[consumeCredit] duplicate — 이미 차감됨');
      return true;
    }
    console.error('[consumeCredit] RPC returned non-ok:', data);
    return false;
  },

  /**
   * 크레딧 환불 (원자적 RPC).
   * idempotencyKey 권장 (예: `refund-${recordId}`) — 같은 사유로 두 번 환불 차단.
   */
  refundCredit: async (
    userId: string,
    creditType: CreditType,
    amount: number,
    reason: string,
    idempotencyKey?: string,
  ): Promise<boolean> => {
    if (amount <= 0) return false;
    const { data, error } = await supabase.rpc('refund_credit_atomic', {
      p_user_id: userId,
      p_credit_type: creditType,
      p_amount: amount,
      p_reason: reason,
      p_idempotency_key: idempotencyKey ?? null,
    });
    if (error) {
      console.error('[refundCredit] RPC error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return false;
    }
    console.log('[refundCredit] RPC ok:', { data });
    return data === 'ok' || data === 'duplicate';
  },

  // 크레딧 거래 기록 추가
  addTransaction: async (transaction: Omit<CreditTransaction, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('credit_transactions')
      .insert(transaction)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 크레딧 거래 내역 조회
  getTransactions: async (userId: string, limit = 50): Promise<CreditTransaction[]> => {
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }
    return data ?? [];
  }
};

/**
 * 주문 관련 DB 함수
 */

export const orderDB = {
  // 주문 생성
  createOrder: async (order: Omit<Order, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('orders')
      .insert(order)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 주문 상태 업데이트
  updateOrderStatus: async (
    orderId: string,
    status: Order['status'],
    paymentKey?: string,
    paymentMethod?: string
  ) => {
    const updates: any = { status };
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }
    if (paymentKey) {
      updates.payment_key = paymentKey;
    }
    if (paymentMethod) {
      updates.payment_method = paymentMethod;
    }

    const { error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId);

    if (error) throw error;
  },

  // 주문 내역 조회
  getOrders: async (userId: string, limit = 50): Promise<Order[]> => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching orders:', error);
      return [];
    }
    return data ?? [];
  }
};

/**
 * 사주 기록 관련 DB 함수
 */

export const sajuDB = {
  // 사주 기록 저장
  saveRecord: async (record: Omit<SajuRecord, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('saju_records')
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 사주 기록 조회 (리스트용 — 무거운 컬럼 제외)
  // result_data/engine_result/interpretation_basic/interpretation_detailed 제외 → 1MB → 30KB 수준
  // 상세 본문은 카드 클릭 시 getRecordById 가 풀 row 가져옴
  getRecords: async (userId: string, limit = 50): Promise<SajuRecord[]> => {
    // ★ engine_result 포함 — ArchivePage 가 newyear record 의 engine_result.source 로
    //   "신년운세" vs "연도별 운세" 라벨 분기에 사용. result_data·interpretation_*
    //   같은 무거운 필드는 여전히 제외.
    const { data, error } = await supabase
      .from('saju_records')
      .select('id, user_id, profile_id, profile_name, partner_name, partner_birth_date, birth_date, birth_time, birth_place, gender, calendar_type, category, created_at, is_detailed, credit_type, credit_used, engine_result, status, error_message')
      .eq('user_id', userId)
      // 상담소 잡 캐리어(category='consultation')는 보관함에 표시하지 않는다.
      // 상담 내용은 상담소 화면에서만 보이며(consultation_records), 보관함은 풀이 기록 전용.
      .neq('category', 'consultation')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching saju records:', error);
      return [];
    }
    return (data ?? []) as SajuRecord[];
  },

  // 특정 사주 기록 조회
  getRecordById: async (recordId: string): Promise<SajuRecord | null> => {
    const { data, error } = await supabase
      .from('saju_records')
      .select('*')
      .eq('id', recordId)
      .single();

    if (error) {
      console.error('Error fetching saju record:', error);
      return null;
    }
    return data;
  },

  // 사주 기록 삭제 (RLS 로 본인 user_id 만 삭제 가능)
  deleteRecord: async (recordId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('saju_records')
      .delete()
      .eq('id', recordId);
    if (error) {
      console.error('Error deleting saju record:', error);
      return false;
    }
    return true;
  },
};

/**
 * 타로 기록 관련 DB 함수
 */

export const tarotDB = {
  // 타로 기록 저장
  saveRecord: async (record: Omit<TarotRecord, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('tarot_records')
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 타로 기록 조회 (리스트용 — 무거운 컬럼 제외)
  // cards/interpretation 제외 → 상세 본문은 카드 클릭 시 getRecordById 가 풀 row 가져옴
  getRecords: async (userId: string, limit = 50): Promise<TarotRecord[]> => {
    const { data, error } = await supabase
      .from('tarot_records')
      .select('id, user_id, spread_type, question, credit_type, credit_used, created_at, status, error_message')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching tarot records:', error);
      return [];
    }
    return (data ?? []) as TarotRecord[];
  },

  // 특정 타로 기록 조회 (보관함 재생용)
  getRecordById: async (recordId: string): Promise<TarotRecord | null> => {
    const { data, error } = await supabase
      .from('tarot_records')
      .select('*')
      .eq('id', recordId)
      .single();

    if (error) {
      console.error('Error fetching tarot record:', error);
      return null;
    }
    return data;
  },

  // 타로 기록 삭제
  deleteRecord: async (recordId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('tarot_records')
      .delete()
      .eq('id', recordId);
    if (error) {
      console.error('Error deleting tarot record:', error);
      return false;
    }
    return true;
  },
};

/**
 * 사주 프로필 관련 DB 함수
 */

export const profileDB = {
  getProfiles: async (userId: string): Promise<BirthProfile[]> => {
    const { data, error } = await supabase
      .from('birth_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    // 에러 시 throw — 호출 측이 catch 해서 로컬 캐시를 유지하도록.
    // 과거엔 []를 반환했으나, 그 경우 스토어가 "빈 목록"으로 오해해
    // localStorage 까지 덮어써서 대표 프로필이 사라진 것처럼 보이는 버그가 있었음.
    if (error) {
      console.error('Error fetching profiles:', error);
      throw error;
    }
    return data ?? [];
  },

  createProfile: async (profile: Omit<BirthProfile, 'id' | 'created_at' | 'updated_at'>): Promise<BirthProfile> => {
    const { data, error } = await supabase
      .from('birth_profiles')
      .insert(profile)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateProfile: async (id: string, updates: Partial<Omit<BirthProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<BirthProfile> => {
    const { data, error } = await supabase
      .from('birth_profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  deleteProfile: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('birth_profiles')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * 대표 프로필 지정 — 사용자의 다른 프로필 is_primary 를 모두 false 로 돌린 뒤
   * 대상만 true 로 세팅. 동시성 위험은 RLS + 단일 유저 사용이라 무시.
   */
  setPrimaryProfile: async (userId: string, profileId: string): Promise<void> => {
    const { error: unsetError } = await supabase
      .from('birth_profiles')
      .update({ is_primary: false })
      .eq('user_id', userId)
      .neq('id', profileId);

    if (unsetError) throw unsetError;

    const { error: setError } = await supabase
      .from('birth_profiles')
      .update({ is_primary: true })
      .eq('id', profileId);

    if (setError) throw setError;
  }
};
