'use client';

/**
 * 사주 프로필 선택 페이지
 * - 저장된 프로필이 있으면 리스트 표시 + 추가 버튼
 * - 프로필이 없으면 바로 입력 페이지로 이동
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';
import type { BirthProfile } from '../types/credit';
import { CITY_COORDINATES } from '../utils/timeCorrection';
import { BackButton } from '../components/ui/BackButton';

export default function SajuProfilePage() {
  const router = useRouter();
  const { user } = useUserStore();
  const { profiles, fetchProfiles, loading } = useProfileStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfiles().then(() => setInitialized(true));
    } else {
      // 비로그인 → 바로 입력으로
      setInitialized(true);
    }
  }, [user]);

  // 프로필 없으면 바로 입력 페이지
  useEffect(() => {
    if (initialized && (!user || profiles.length === 0)) {
      router.replace('/saju/input');
    }
  }, [initialized, profiles, user]);

  const handleSelectProfile = (profile: BirthProfile) => {
    const [y, m, d] = profile.birth_date.split('-').map(Number);
    const coords = CITY_COORDINATES[profile.birth_place] || CITY_COORDINATES['seoul'];

    let hour = 12;
    let minute = 0;
    let unknownTime = true;

    if (profile.birth_time) {
      const [h, min] = profile.birth_time.split(':').map(Number);
      hour = h;
      minute = min;
      unknownTime = false;
    }

    const params = new URLSearchParams({
      // profileId 를 함께 전달해야 보관함 저장 시 대표 프로필로 fallback 되지 않는다.
      // (이전 버그: 대표=A, 선택=B 일 때 보관함에 A 이름으로 저장)
      profileId: profile.id,
      year: y.toString(),
      month: m.toString(),
      day: d.toString(),
      hour: hour.toString(),
      minute: minute.toString(),
      gender: profile.gender,
      calendarType: profile.calendar_type,
      longitude: coords.lng.toString(),
      unknownTime: unknownTime.toString(),
      category: 'traditional',
    });

    router.push(`/saju/result?${params.toString()}`);
  };

  // 로딩 중이거나 초기화 안됐으면 스피너
  if (!initialized || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-cta border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 프로필이 없으면 이미 redirect됨
  if (profiles.length === 0) return null;

  return (
    <div className="px-4 pt-4 pb-8">
      {/* 헤더 — 뒤로가기 좌측 + 중앙 정렬 타이틀 */}
      <div className="flex items-center relative mb-5 pt-3 px-1">
        <BackButton to="/" className="absolute left-0" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>사주 분석</h1>
          <p className="text-base text-text-tertiary mt-1">프로필을 선택하거나 새로 추가하세요</p>
        </div>
      </div>

      {/* 프로필 리스트 */}
      <div className="space-y-3 mb-6">
        {profiles.map((profile, idx) => (
          <motion.button
            key={profile.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => handleSelectProfile(profile)}
            className="w-full text-left rounded-2xl bg-space-surface/60 border border-[var(--border-subtle)] p-4 hover:border-cta/50 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              {/* 아바타 */}
              <div className="w-11 h-11 rounded-full bg-[rgba(124,92,252,0.12)] flex items-center justify-center text-lg shrink-0">
                {profile.gender === 'male' ? '👨' : '👩'}
              </div>

              {/* 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-text-primary text-sm">{profile.name}</span>
                  {profile.is_primary && (
                    <span className="text-[12px] px-1.5 py-0.5 rounded-full bg-cta/15 text-cta font-medium">대표</span>
                  )}
                </div>
                <div className="text-xs text-text-tertiary mt-0.5">
                  {profile.birth_date.replace(/-/g, '.')}
                  {profile.birth_time && ` ${profile.birth_time}`}
                  {' · '}
                  {profile.gender === 'male' ? '남' : '여'}
                </div>
                {profile.memo && (
                  <div className="text-[13px] text-text-tertiary mt-0.5 truncate">{profile.memo}</div>
                )}
              </div>

              {/* 화살표 */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </motion.button>
        ))}
      </div>

      {/* 새 프로필 추가 버튼 */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        onClick={() => router.push('/saju/input?mode=profile-only')}
        className="w-full rounded-2xl border-2 border-dashed border-[var(--border-subtle)] hover:border-cta/40 p-4 flex items-center justify-center gap-2 text-text-tertiary hover:text-cta transition-all"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span className="text-sm font-medium">새 프로필 추가</span>
      </motion.button>
    </div>
  );
}
