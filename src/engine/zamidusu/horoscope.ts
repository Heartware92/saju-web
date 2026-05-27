/**
 * 자미두수 운한(運限) — 유년(流年)·유월(流月) 정밀 시기 예측
 *
 * 자미두수 정통 시기 단위: 대한(大限, 10년) > 소한(小限, 12년 순환)
 *                       > 유년(流年, 1년) > 유월(流月, 1달) > 유일(流日, 1일)
 *
 * 본 모듈은 iztro의 astrolabe.horoscope(targetDate, timeIndex)를 호출해
 * 특정 시점의 유년·유월 사화 비행과 12궁 매핑을 받아 자미두수 정통
 * 시기 분석을 가능하게 한다.
 *
 * 시기 정밀도 — 사용자 의사결정 단위에 맞춰 영역별로 조정:
 *   - 인생 큰 그림: 대한(10년)
 *   - 실생활 의사결정: 유년(1년)
 *   - 즉각 위험 회피: 유월(1달)
 */

import { astro } from 'iztro';
import { timeIndexFromHour } from '../zamidusu';

export interface BirthInfo {
  year: number;
  month: number;
  day: number;
  hour: number;
  gender: 'male' | 'female';
  calendarType: 'solar' | 'lunar';
}

/** 유년/유월/유일 공통 — 시기별 사화 비행과 12궁 매핑 */
export interface HoroscopeWindow {
  /** 운한 라벨 (예: "2026년", "2026년 5월") */
  label: string;
  heavenlyStem: string;
  earthlyBranch: string;
  /**
   * 사화 비행 — 그 시점의 천간에 따라 어떤 별이
   * 화록/화권/화과/화기로 비행했는지.
   */
  mutagen: {
    록: string;
    권: string;
    과: string;
    기: string;
  };
  /**
   * 운한 12궁 매핑 — palaceNames[i] 는 본래 i번째 위치(지지)에
   * 들어선 운한의 궁 이름. 명궁이 어느 지지로 이동했는지 확인 가능.
   */
  palaceNames: string[];
}

export interface YearlyHoroscope extends HoroscopeWindow {
  year: number;
  /** 한국식 만 나이 근사 — 정확한 만 나이는 호출부에서 생일 비교 필요 */
  approxAge: number;
}

export interface MonthlyHoroscope extends HoroscopeWindow {
  year: number;
  month: number;
}

/** astrolabe 생성 — calculateZamidusu와 동일 패턴 */
function buildAstrolabe(birth: BirthInfo) {
  const timeIndex = timeIndexFromHour(birth.hour);
  const dateStr = `${birth.year}-${birth.month}-${birth.day}`;
  const genderName = birth.gender === 'male' ? '남' : '여';
  return birth.calendarType === 'lunar'
    ? (astro as any).byLunar(dateStr, timeIndex, genderName, false, true, 'ko-KR')
    : (astro as any).bySolar(dateStr, timeIndex, genderName, true, 'ko-KR');
}

/**
 * mutagen 배열을 화록/화권/화과/화기로 정규화.
 * iztro 한국어 로케일에서 mutagen[0..3] = [록, 권, 과, 기] 순.
 */
function normalizeMutagen(arr: string[]): HoroscopeWindow['mutagen'] {
  return {
    록: arr[0] ?? '',
    권: arr[1] ?? '',
    과: arr[2] ?? '',
    기: arr[3] ?? '',
  };
}

/**
 * 여러 연도의 유년 운한을 한 번에 계산.
 *
 * @param birth 생년월일시 + 성별 + 역법
 * @param years 분석할 연도 배열 (예: [2026, 2027, 2028, 2029, 2030])
 */
export function getYearlyHoroscopes(birth: BirthInfo, years: number[]): YearlyHoroscope[] {
  const astrolabe = buildAstrolabe(birth);

  return years.map((year) => {
    // 유년은 해당 연도 중간 날짜 기준으로 산출 (입춘/해당 연도 천간 전환은 iztro가 처리)
    const dateStr = `${year}-6-15`;
    const horo = astrolabe.horoscope(dateStr, 0);
    const y = horo.yearly;

    return {
      year,
      approxAge: year - birth.year + 1, // 한국식 세는 나이 근사
      label: `${year}년`,
      heavenlyStem: y.heavenlyStem,
      earthlyBranch: y.earthlyBranch,
      mutagen: normalizeMutagen(y.mutagen || []),
      palaceNames: y.palaceNames || [],
    };
  });
}

/**
 * 특정 연도의 12개월 유월 운한 전부 계산.
 *
 * @param birth 생년월일시 + 성별 + 역법
 * @param year 분석할 연도
 */
export function getMonthlyHoroscopes(birth: BirthInfo, year: number): MonthlyHoroscope[] {
  const astrolabe = buildAstrolabe(birth);

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const dateStr = `${year}-${month}-15`;
    const horo = astrolabe.horoscope(dateStr, 0);
    const m = horo.monthly;

    return {
      year,
      month,
      label: `${year}년 ${month}월`,
      heavenlyStem: m.heavenlyStem,
      earthlyBranch: m.earthlyBranch,
      mutagen: normalizeMutagen(m.mutagen || []),
      palaceNames: m.palaceNames || [],
    };
  });
}

/**
 * 단일 시점 유월 — 특정 연·월의 유월 운한만 필요할 때 사용.
 */
export function getSingleMonthlyHoroscope(
  birth: BirthInfo,
  year: number,
  month: number,
): MonthlyHoroscope {
  const astrolabe = buildAstrolabe(birth);
  const dateStr = `${year}-${month}-15`;
  const horo = astrolabe.horoscope(dateStr, 0);
  const m = horo.monthly;

  return {
    year,
    month,
    label: `${year}년 ${month}월`,
    heavenlyStem: m.heavenlyStem,
    earthlyBranch: m.earthlyBranch,
    mutagen: normalizeMutagen(m.mutagen || []),
    palaceNames: m.palaceNames || [],
  };
}
