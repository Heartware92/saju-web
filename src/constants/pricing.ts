/**
 * 크레딧 패키지 정의 (2026-05-16 단일 달 크레딧 통합)
 *
 * 단위: 달 🌙 (1달 = ₩200, 옛 해 단위 폐지)
 * 기본 사용 단가:
 *   - 본격 운세 7종 = 달 10개 (₩2,000)
 *   - 더많은 운세 6종 + 실시간 운세 = 달 5개 (₩1,000)
 *   - 타로 (오늘/이달/질문) = 달 1개 (₩200)
 *   - 상담소 1질문 = 달 1개 (₩200)
 *
 * 패키지 톤: 행성/우주 점층 (작은 천체 → 큰 천체)
 */

export interface CreditPackage {
  id: string;
  name: string;
  /** UI 표시용 이모지 (이모지 미지정 시 빈 문자열) */
  planet: string;
  /**
   * UI 표시용 이미지 경로 (있으면 이모지 대신 이미지 사용).
   * public/ 기준 절대 경로 (예: '/icons/packages/mars.png').
   */
  iconImage?: string;
  /** @deprecated planet 사용 */
  icon: string;
  price: number;
  /** 충전되는 달(🌙) 개수 (옛 sun/moon 분리 폐지) */
  moonCredit: number;
  description: string;
  features: string[];
  popular?: boolean;
  bestValue?: boolean;
}

export const CREDIT_PACKAGES: readonly CreditPackage[] = [
  {
    id: 'moon',
    name: '달 세트',
    planet: '🌙',
    icon: '🌙',
    price: 2000,
    moonCredit: 10,
    description: '본격 풀이 1번 — 가볍게 시작',
    features: ['🌙 10개', '본격 운세 1번 가능'],
  },
  {
    id: 'mars',
    name: '화성 세트',
    planet: '',
    iconImage: '/icons/packages/mars.png',
    icon: '',
    price: 3900,
    moonCredit: 22,
    description: '본격 풀이 2번 — 한 번 더 풍성하게',
    features: ['🌙 22개 (보너스 11%)', '본격 운세 2번 + 가벼운 자투리'],
  },
  {
    id: 'earth',
    name: '지구 세트',
    planet: '🌍',
    icon: '🌍',
    price: 5900,
    moonCredit: 35,
    description: '본인 + 가족 2~3명 풀이',
    features: ['🌙 35개 (보너스 16%)', '본격 3번 + 가벼운 1번'],
  },
  {
    id: 'saturn',
    name: '토성 세트',
    planet: '🪐',
    icon: '🪐',
    price: 9900,
    moonCredit: 60,
    description: '가족 모두 풀이',
    features: ['🌙 60개 (보너스 21%)', '본격 5번 + 가벼운 2번'],
    popular: true,
  },
  {
    id: 'jupiter',
    name: '목성 세트',
    planet: '',
    iconImage: '/icons/packages/jupiter.png',
    icon: '',
    price: 19900,
    moonCredit: 125,
    description: '한 달 푹 사용',
    features: ['🌙 125개 (보너스 26%)', '본격 12번 + 자투리'],
    bestValue: true,
  },
  {
    id: 'solar',
    name: '태양계 세트',
    planet: '',
    iconImage: '/icons/packages/solar-system.png',
    icon: '',
    price: 39900,
    moonCredit: 270,
    description: '분기 단위 마니아',
    features: ['🌙 270개 (보너스 35%)', '본격 27번'],
  },
  {
    id: 'cosmos',
    name: '우주 세트',
    planet: '',
    iconImage: '/icons/packages/galaxy.png',
    icon: '',
    price: 79900,
    moonCredit: 580,
    description: '1년치 헤비 유저',
    features: ['🌙 580개 (보너스 45%)', '본격 58번'],
  },
] as const;

/**
 * 크레딧 소비량 정의 (참고용 — 실제 차감은 creditCosts.ts 상수 사용)
 */
export const CREDIT_COST = {
  // 본격 운세 7종
  traditional: { type: 'moon' as const, amount: 10 },
  newyear: { type: 'moon' as const, amount: 10 },
  gunghap: { type: 'moon' as const, amount: 10 },
  pickedDate: { type: 'moon' as const, amount: 10 },
  taekil: { type: 'moon' as const, amount: 10 },
  tojeong: { type: 'moon' as const, amount: 10 },
  zamidusu: { type: 'moon' as const, amount: 10 },

  // 더많은 운세 + 실시간
  realtimeFortune: { type: 'moon' as const, amount: 5 },
  studyFortune: { type: 'moon' as const, amount: 5 },
  childrenFortune: { type: 'moon' as const, amount: 5 },
  personalityFortune: { type: 'moon' as const, amount: 5 },
  nameFortune: { type: 'moon' as const, amount: 5 },
  dreamFortune: { type: 'moon' as const, amount: 5 },

  // 타로
  tarotToday: { type: 'moon' as const, amount: 1 },
  tarotMonthly: { type: 'moon' as const, amount: 1 },
  tarotQuestion: { type: 'moon' as const, amount: 1 },

  // 상담소
  consultationQuestion: { type: 'moon' as const, amount: 1 },
} as const;

/**
 * 패키지 ID로 패키지 정보 조회
 */
export const getPackageById = (id: string): CreditPackage | undefined => {
  return CREDIT_PACKAGES.find(pkg => pkg.id === id);
};

/**
 * 가격으로 패키지 정보 조회
 */
export const getPackageByPrice = (price: number): CreditPackage | undefined => {
  return CREDIT_PACKAGES.find(pkg => pkg.price === price);
};
