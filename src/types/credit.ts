/**
 * 크레딧 시스템 관련 타입 정의
 * 해(☀️)/달(🌙) 이중 크레딧 시스템
 */

export type CreditType = 'sun' | 'moon';

export interface CreditTransaction {
  id: string;
  user_id: string;
  credit_type: CreditType;
  type: 'purchase' | 'consume' | 'bonus' | 'refund';
  amount: number;
  balance_after: number;
  reason: string;
  order_id?: string;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  package_id: string;
  package_name: string;
  amount: number;              // 결제 금액 (원)
  sun_credit_amount: number;   // 지급할 해 크레딧
  moon_credit_amount: number;  // 지급할 달 크레딧
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method?: string;
  payment_key?: string;
  portone_payment_id?: string;
  created_at: string;
  completed_at?: string;
}

export interface UserCredit {
  user_id: string;
  sun_balance: number;
  moon_balance: number;
  total_sun_purchased: number;
  total_moon_purchased: number;
  total_sun_consumed: number;
  total_moon_consumed: number;
  created_at: string;
  updated_at: string;
}

export interface SajuRecord {
  id: string;
  user_id: string;
  birth_date: string;
  birth_time?: string;
  birth_place?: string;
  gender: 'male' | 'female';
  calendar_type: 'solar' | 'lunar';
  category: string;
  result_data: Record<string, unknown>;
  engine_result?: Record<string, unknown>;
  interpretation_basic?: string;
  interpretation_detailed?: string;
  credit_type?: CreditType;
  credit_used: number;
  is_detailed: boolean;
  created_at: string;
  /** birth_profiles FK — 풀이 시점 프로필. 프로필 삭제 시 NULL (스냅샷은 profile_name 으로 보존). */
  profile_id?: string | null;
  /** 저장 시점 프로필명 스냅샷 — 프로필 이름이 바뀌어도 풀이 시점 이름 유지. */
  profile_name?: string | null;
  /** 궁합용 — 상대방 이름·생일 스냅샷. */
  partner_name?: string | null;
  partner_birth_date?: string | null;
  /** 공유 링크용 토큰 — 최초 공유 시 생성 */
  share_token?: string | null;
  /** 백그라운드 잡 상태 — 신규 컬럼 (037 마이그레이션). 옛 row 는 'done' default. */
  status?: 'pending' | 'processing' | 'done' | 'failed';
  /** 잡 실패 시 사유 또는 partial 경고. */
  error_message?: string | null;
  /** 잡 시작·완료 타임스탬프. */
  started_at?: string | null;
  completed_at?: string | null;
}

export interface TarotRecord {
  id: string;
  user_id: string;
  spread_type: string;
  cards: Record<string, unknown>;
  question?: string;
  interpretation?: string;
  credit_type?: CreditType;
  credit_used: number;
  created_at: string;
  /** 공유 링크용 토큰 */
  share_token?: string | null;
}

/**
 * 사주 프로필 (여러 명의 생년월일 저장)
 */
export interface BirthProfile {
  id: string;
  user_id: string;
  name: string;
  birth_date: string;
  birth_time?: string;
  /** CITY_COORDINATES 키(예: 'seoul') 또는 임의 지명 문자열 */
  birth_place: string;
  /**
   * 출생지 경도 (동경 +, 서경 -). 진태양시 보정에 사용.
   * null 이면 birth_place 코드로 조회 → 그래도 없으면 서울(126.978) 기본.
   */
  longitude?: number | null;
  gender: 'male' | 'female';
  calendar_type: 'solar' | 'lunar';
  is_primary: boolean;
  memo?: string;
  /**
   * 직업 상태 — 칩 또는 직접 입력. DB DEFAULT '직장인' 이라 항상 존재하지만
   * INSERT 시 누락 가능하도록 optional 로 선언 (DB가 보장).
   */
  job_state?: string;
  /** 칩 대신 직접 입력했을 때만 값. 칩 선택 시 NULL */
  custom_job_state?: string | null;
  /** 연애 상태 — DB DEFAULT '연애 중' */
  love_state?: string;
  /** 칩 대신 직접 입력했을 때만 값 */
  custom_love_state?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 크레딧 패키지 정의
 */
export interface CreditPackage {
  id: string;
  name: string;
  price: number;              // 원
  sun_amount: number;         // 해 크레딧
  moon_amount: number;        // 달 크레딧
  description: string;
  popular?: boolean;
}

/**
 * 서비스별 크레딧 소비 비용
 */
export interface ServiceCost {
  service: string;
  credit_type: CreditType;
  amount: number;
  description: string;
}
