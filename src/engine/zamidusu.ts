/**
 * 자미두수(紫微斗數) 명반 계산 엔진
 *
 * 내부적으로 iztro 라이브러리(MIT)를 한국어 로케일로 호출하여
 * 12궁 + 14주성 + 보조성 + 사화 + 대한 운세를 모두 생성한다.
 *
 * iztro 문서: https://docs.iztro.com
 */

import { astro } from 'iztro';

// ============================================
// 타입 정의 (렌더/프롬프트에서 사용하기 쉬운 형태)
// ============================================

export interface ZamidusuStar {
  name: string;
  type: string;       // '주성' | '보조성' | '사화' 등
  brightness?: string;
  mutagen?: string;
}

export interface ZamidusuPalace {
  index: number;
  name: string;          // '명궁' | '재백궁' 등
  heavenlyStem: string;  // '갑', '을' ...
  earthlyBranch: string; // '자', '축' ...
  isBodyPalace: boolean;
  isOriginalPalace: boolean;
  majorStars: ZamidusuStar[];
  minorStars: ZamidusuStar[];
  adjectiveStars: ZamidusuStar[];
  ages: number[];        // 소한(小限) — 12년 주기 연간 순환 나이 목록
  decadalRange?: string;
  decadal?: { startAge: number; endAge: number }; // 대한(大限) — 10년 단위 대운 구간
}

export interface ZamidusuResult {
  gender: '남' | '여';
  solarDate: string;
  lunarDate: string;
  chineseDate: string;
  time: string;
  timeRange: string;
  sign: string;
  zodiac: string;
  soul: string;
  body: string;
  fiveElementsClass: string;
  soulBranch: string;
  bodyBranch: string;
  palaces: ZamidusuPalace[]; // 12개
}

// ============================================
// 시진 변환: 0~23시 → iztro timeIndex(0~12)
// 0: 야자시(23:00~), 1: 자시, 2: 축시 ... 12: 해시
// ============================================

export function timeIndexFromHour(hour: number): number {
  if (hour === 23) return 0;          // 야자시
  return Math.floor((hour + 1) / 2);  // 0→0(조자), 1~2→1(축), ...
}

// ============================================
// 메인 계산
// ============================================

export function calculateZamidusu(
  year: number,
  month: number,
  day: number,
  hour: number,
  gender: 'male' | 'female',
  calendarType: 'solar' | 'lunar' = 'solar'
): ZamidusuResult {
  const timeIndex = timeIndexFromHour(hour);
  const solarDateStr = `${year}-${month}-${day}`;
  const genderName = gender === 'male' ? '남' : '여';

  const astrolabe =
    calendarType === 'lunar'
      ? (astro as any).byLunar(solarDateStr, timeIndex, genderName, false, true, 'ko-KR')
      : (astro as any).bySolar(solarDateStr, timeIndex, genderName, true, 'ko-KR');

  // palaces 직렬화 — iztro는 명궁만 "궁"을 붙이고 나머지는 약칭(부모·복덕·…) 반환.
  // 앱 전역에서 "부처궁"·"재백궁" 등 풀네임 매칭 규약이라 엔진 경계에서 정규화한다.
  const normalizePalaceName = (n: string): string => (n === '명궁' || n.endsWith('궁')) ? n : `${n}궁`;

  const palaces: ZamidusuPalace[] = astrolabe.palaces.map((p: any) => ({
    index: p.index,
    name: normalizePalaceName(p.name),
    heavenlyStem: p.heavenlyStem,
    earthlyBranch: p.earthlyBranch,
    isBodyPalace: p.isBodyPalace,
    isOriginalPalace: p.isOriginalPalace,
    majorStars: (p.majorStars || []).map((s: any) => ({
      name: s.name,
      type: s.type,
      brightness: s.brightness,
      mutagen: s.mutagen,
    })),
    minorStars: (p.minorStars || []).map((s: any) => ({
      name: s.name,
      type: s.type,
      brightness: s.brightness,
      mutagen: s.mutagen,
    })),
    adjectiveStars: (p.adjectiveStars || []).map((s: any) => ({
      name: s.name,
      type: s.type,
      brightness: s.brightness,
      mutagen: s.mutagen,
    })),
    ages: p.ages || [],
    decadalRange: p.decadal ? `${p.decadal.range?.[0] ?? ''}~${p.decadal.range?.[1] ?? ''}세` : undefined,
    decadal: p.decadal?.range ? { startAge: p.decadal.range[0], endAge: p.decadal.range[1] } : undefined,
  }));

  return {
    gender: genderName as '남' | '여',
    solarDate: astrolabe.solarDate,
    lunarDate: astrolabe.lunarDate,
    chineseDate: astrolabe.chineseDate,
    time: astrolabe.time,
    timeRange: astrolabe.timeRange,
    sign: astrolabe.sign,
    zodiac: astrolabe.zodiac,
    soul: astrolabe.soul,
    body: astrolabe.body,
    fiveElementsClass: astrolabe.fiveElementsClass,
    soulBranch: astrolabe.earthlyBranchOfSoulPalace,
    bodyBranch: astrolabe.earthlyBranchOfBodyPalace,
    palaces,
  };
}

// ============================================
// 12궁 레이아웃 (전통 배열: 인/묘/진/사를 왼쪽 위에서 반시계 방향)
// 4x4 그리드에 12궁을 배치하기 위한 지지→좌표 매핑
// 축=왼아래 2번째, 인=왼아래 1번째, 묘=왼쪽 3행, 진=왼쪽 2행, 사=왼쪽 1행(최상),
// 오=상단, 미=상단 오른쪽, 신=오른쪽 최상, 유=오른쪽 2행 ...
// ============================================
export const BRANCH_GRID_POSITIONS: Record<string, { row: number; col: number }> = {
  '사': { row: 0, col: 0 },
  '오': { row: 0, col: 1 },
  '미': { row: 0, col: 2 },
  '신': { row: 0, col: 3 },
  '진': { row: 1, col: 0 },
  '유': { row: 1, col: 3 },
  '묘': { row: 2, col: 0 },
  '술': { row: 2, col: 3 },
  '인': { row: 3, col: 0 },
  '축': { row: 3, col: 1 },
  '자': { row: 3, col: 2 },
  '해': { row: 3, col: 3 },
};
