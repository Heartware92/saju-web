/**
 * 프로필 → 만세력 변환 헬퍼
 *
 * - calendar_type === 'lunar' 이면 음력→양력 변환 후 계산
 * - 한국식 30분 시프트 시진 적용 (점신/천을귀인 호환)
 *   · 시진 경계를 11:30 / 13:30 / 15:30 ... 으로 30분 늦춤
 *   · 한국 표준자오선(135°)과 실제 서울(127.5°)의 30분 시차를 시진 자체에 반영
 *   · 진태양시(경도+EOT) 보정은 적용하지 않음 — 시장 표준(점신/포스텔러 등 대중 앱)과 일치
 */

import { Lunar } from 'lunar-javascript';
import type { BirthProfile } from '../types/credit';
import { calculateSaju, type SajuResult } from './sajuCalculator';

export function computeSajuFromProfile(profile: BirthProfile): SajuResult | null {
  try {
    const [y, m, d] = profile.birth_date.split('-').map(Number);
    const unknownTime = !profile.birth_time;
    const [h, min] = unknownTime
      ? [12, 0]
      : (profile.birth_time as string).split(':').map(Number);

    // 1) 음력이면 먼저 양력으로 변환 (시간은 그대로 유지 — 양력 날짜 결정엔 무관)
    let solarYear = y, solarMonth = m, solarDay = d;
    if (profile.calendar_type === 'lunar') {
      const lunar = Lunar.fromYmdHms(y, m, d, h, min, 0);
      const solar = lunar.getSolar();
      solarYear = solar.getYear();
      solarMonth = solar.getMonth();
      solarDay = solar.getDay();
    }

    // 2) 한국식 30분 시프트 — 시계 시간에서 30분 빼서
    //    lunar-javascript 의 정시법 시진(11~13 = 오시) 결과가
    //    한국식 30분 시프트 시진(11:30~13:30 = 오시) 과 같아지도록 조정
    let finalY = solarYear, finalM = solarMonth, finalD = solarDay;
    let finalH = unknownTime ? 12 : h;
    let finalMin = unknownTime ? 0 : min;
    if (!unknownTime) {
      const dt = new Date(solarYear, solarMonth - 1, solarDay, h, min);
      const shifted = new Date(dt.getTime() - 30 * 60 * 1000);
      finalY = shifted.getFullYear();
      finalM = shifted.getMonth() + 1;
      finalD = shifted.getDate();
      finalH = shifted.getHours();
      finalMin = shifted.getMinutes();
    }

    return calculateSaju(
      finalY,
      finalM,
      finalD,
      finalH,
      finalMin,
      profile.gender,
      unknownTime,
    );
  } catch (e) {
    console.error('만세력 계산 실패:', e);
    return null;
  }
}

/**
 * 저장된 풀이 레코드 → SajuResult.
 *
 * ★ 원칙: 보관함·공유처럼 "이미 본 풀이를 다시 보여주는" 화면은 다시 계산하지 않고
 *   생성 시 저장된 result_data(SajuResult 스냅샷)를 그대로 미러링한다.
 *   → 보관함/공유/생성 결과가 항상 100% 동일. 계산 규칙이 바뀌거나 프로필 생일을
 *     수정해도 영향 없음.
 *   (과거엔 화면마다 computeSajuFromProfile 로 재계산해 30분 시프트 등에서 결과가
 *    달라지는 버그가 있었음.)
 *
 * result_data 가 없거나 불완전한 옛 레코드만 예외적으로 birth 필드로 재계산(fallback).
 */
export function sajuFromRecord(record: {
  result_data?: unknown;
  birth_date?: string;
  birth_time?: string | null;
  birth_place?: string | null;
  gender?: string;
  calendar_type?: string | null;
  profile_id?: string | null;
  profile_name?: string | null;
}): SajuResult | null {
  const rd = record.result_data as SajuResult | null | undefined;
  // 저장본이 완전한 SajuResult 면 그대로 사용(미러링) — 재계산 금지
  if (rd && rd.pillars?.day?.gan && rd.strengthStatus && rd.elementPercent) {
    return rd;
  }
  // 옛 레코드(저장본 없음/불완전) → birth 필드로 재계산
  const birthDate = record.birth_date as string | undefined;
  if (!birthDate) return null;
  return computeSajuFromProfile({
    id: (record.profile_id as string) ?? 'archive',
    user_id: '',
    name: (record.profile_name as string) ?? '',
    birth_date: birthDate,
    birth_time: (record.birth_time as string | null) ?? undefined,
    birth_place: (record.birth_place as string | null) ?? 'seoul',
    gender: (record.gender as 'male' | 'female') ?? 'male',
    calendar_type: (record.calendar_type as 'solar' | 'lunar' | null) ?? 'solar',
    is_primary: false,
    created_at: '',
    updated_at: '',
  });
}
