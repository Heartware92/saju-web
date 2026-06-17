'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';
import { useCreditStore } from '../store/useCreditStore';
import { findRecentArchivesBatch, type ArchiveCategory } from '../services/archiveService';
import { BackButton } from './ui/BackButton';
import type { BirthProfile } from '../types/credit';

export interface FortuneProfileSelectProps {
  serviceName: string;
  archiveCategory?: ArchiveCategory;
  archiveContext?: { key: string; value: string };
  creditType: 'sun' | 'moon';
  creditCost: number;
}

type ArchiveInfo = { id: string; created_at: string };

export function FortuneProfileSelect({
  serviceName,
  archiveCategory,
  archiveContext,
  creditType,
  creditCost,
}: FortuneProfileSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUserStore();
  const { profiles, fetchProfiles, loading: profilesLoading } = useProfileStore();
  const { moonBalance } = useCreditStore();

  const [initialized, setInitialized] = useState(profiles.length > 0);
  const [archiveMap, setArchiveMap] = useState<Record<string, ArchiveInfo | null>>({});
  const [archiveChecking, setArchiveChecking] = useState(!!archiveCategory);

  const [selectedProfile, setSelectedProfile] = useState<BirthProfile | null>(null);
  const [modalType, setModalType] = useState<'credit' | 'existing' | 'insufficient' | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfiles().then(() => setInitialized(true));
    } else {
      setInitialized(true);
    }
  }, [user, fetchProfiles]);

  useEffect(() => {
    if (initialized && (!user || profiles.length === 0)) {
      router.replace('/saju/input');
    }
  }, [initialized, profiles, user, router]);

  useEffect(() => {
    if (!archiveCategory || !profiles.length) {
      setArchiveChecking(false);
      return;
    }
    setArchiveChecking(true);
    findRecentArchivesBatch({
      category: archiveCategory,
      profileIds: profiles.map(p => p.id),
      context: archiveContext,
    }).then((map) => {
      setArchiveMap(map);
      setArchiveChecking(false);
    });
  }, [profiles, archiveCategory, archiveContext]);

  // 단일 달 크레딧 시스템 — creditType prop 은 호환 위해 유지하지만 항상 moon
  void creditType;
  const balance = moonBalance;
  const creditLabel = '🌙';

  const handleProfileClick = useCallback(
    (profile: BirthProfile) => {
      setSelectedProfile(profile);
      const archive = archiveCategory ? archiveMap[profile.id] : null;
      if (archive) {
        setModalType('existing');
      } else if (balance < creditCost) {
        setModalType('insufficient');
      } else {
        setModalType('credit');
      }
    },
    [archiveMap, archiveCategory, balance, creditCost],
  );

  const navigate = useCallback(
    (profileId: string, extra?: string) => {
      router.push(`${pathname}?profileId=${profileId}${extra ?? ''}`);
    },
    [pathname, router],
  );

  const handleViewExisting = useCallback(() => {
    if (!selectedProfile) return;
    const archive = archiveMap[selectedProfile.id];
    if (archive) navigate(selectedProfile.id, `&recordId=${archive.id}`);
    setModalType(null);
  }, [selectedProfile, archiveMap, navigate]);

  const handleNewReading = useCallback(() => {
    if (!selectedProfile) return;
    if (balance < creditCost) {
      setModalType('insufficient');
      return;
    }
    navigate(selectedProfile.id, '&fresh=1');
    setModalType(null);
  }, [selectedProfile, balance, creditCost, navigate]);

  const handleConfirmCredit = useCallback(() => {
    if (!selectedProfile) return;
    navigate(selectedProfile.id, archiveCategory ? '&fresh=1' : '');
    setModalType(null);
  }, [selectedProfile, navigate, archiveCategory]);

  const closeModal = () => {
    setModalType(null);
    setSelectedProfile(null);
  };

  if (!initialized || (profilesLoading && profiles.length === 0)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-cta border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (profiles.length === 0) return null;

  return (
    <div className="px-4 pt-4 pb-8">
      <div className="flex items-center relative mb-5 pt-3 px-1">
        <BackButton to="/" className="absolute left-0" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>{serviceName}</h1>
          <p className="text-base text-text-tertiary mt-1">프로필을 선택하세요</p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {profiles.map((profile, idx) => {
          const archive = archiveCategory ? archiveMap[profile.id] : null;
          return (
            <motion.button
              key={profile.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => handleProfileClick(profile)}
              disabled={archiveChecking}
              className="w-full text-left rounded-2xl bg-space-surface/60 border border-[var(--border-subtle)] p-4 hover:border-cta/50 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-[14px] font-semibold shrink-0 ${
                  profile.gender === 'male' ? 'bg-sky-500/15 text-sky-300' : 'bg-pink-400/15 text-pink-300'
                }`}>
                  {profile.gender === 'male' ? '남' : '여'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-text-primary text-sm">{profile.name}</span>
                    {profile.is_primary && (
                      <span className="text-[12px] px-1.5 py-0.5 rounded-full bg-cta/15 text-cta font-medium">
                        대표
                      </span>
                    )}
                    {archive && (
                      <span className="text-[12px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
                        결과있음
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-tertiary mt-0.5">
                    {profile.birth_date.replace(/-/g, '.')}
                    {profile.birth_time && ` ${profile.birth_time}`}
                    {' · '}
                    {profile.gender === 'male' ? '남' : '여'}
                  </div>
                  {profile.memo && (
                    <div className="text-[13px] text-text-tertiary mt-0.5 truncate">
                      {profile.memo}
                    </div>
                  )}
                </div>
                {archiveChecking ? (
                  <div className="w-4 h-4 border-2 border-text-tertiary border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-tertiary)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        onClick={() => router.push('/saju/input?mode=profile-only')}
        className="w-full rounded-2xl border-2 border-dashed border-[var(--border-subtle)] hover:border-cta/40 p-4 flex items-center justify-center gap-2 text-text-tertiary hover:text-cta transition-all"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span className="text-sm font-medium">새 프로필 추가</span>
      </motion.button>

      {/* ── 모달 ── */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm px-4">
          <div className="relative w-full max-w-[400px] rounded-2xl bg-[rgba(20,12,38,0.96)] border border-[var(--border-subtle)] p-6 text-center shadow-2xl">
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary hover:bg-white/10 transition-colors"
              aria-label="닫기"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {modalType === 'existing' && (
              <>
                <h3 className="text-[17px] font-bold text-text-primary mb-2">
                  이전 풀이가 있어요
                </h3>
                <p className="text-[14px] text-text-secondary leading-relaxed mb-5">
                  <span className="font-semibold text-text-primary">
                    {selectedProfile?.name}
                  </span>
                  님의 {serviceName} 결과가 남아있어요.
                </p>
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={handleViewExisting}
                    className="block w-full h-12 rounded-lg bg-gradient-to-r from-cta to-cta-active text-white font-bold text-[15px] hover:opacity-90 transition-all"
                  >
                    기존 결과 보기
                  </button>
                  <button
                    type="button"
                    onClick={handleNewReading}
                    className="block w-full h-12 rounded-lg border border-cta/40 text-cta font-semibold text-[15px] hover:bg-cta/10 transition-all"
                  >
                    새로 풀이 받기
                    <span className="block text-[12px] font-normal text-text-tertiary mt-0.5">
                      {creditLabel} {creditCost}개 소모
                    </span>
                  </button>
                </div>
              </>
            )}

            {modalType === 'credit' && (
              <>
                <h3 className="text-[17px] font-bold text-text-primary mb-2">크레딧 안내</h3>
                <p className="text-[14px] text-text-secondary leading-relaxed mb-5">
                  <span className="font-semibold text-text-primary">
                    {selectedProfile?.name}
                  </span>
                  님의 {serviceName}을 풀이합니다.
                  <br />
                  {creditLabel} {creditCost}개가 소모됩니다.
                </p>
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={handleConfirmCredit}
                    className="block w-full h-12 rounded-lg bg-gradient-to-r from-cta to-cta-active text-white font-bold text-[15px] hover:opacity-90 transition-all"
                  >
                    풀이 받기
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="block w-full h-12 rounded-lg border border-[var(--border-subtle)] text-text-secondary font-medium text-[15px] hover:bg-white/5 transition-all"
                  >
                    취소
                  </button>
                </div>
              </>
            )}

            {modalType === 'insufficient' && (
              <>
                <h3 className="text-[17px] font-bold text-text-primary mb-2">
                  크레딧이 부족해요
                </h3>
                <p className="text-[14px] text-text-secondary leading-relaxed mb-5">
                  {serviceName}에는 {creditLabel} {creditCost}개가 필요해요.
                  <br />
                  현재 잔액: {creditLabel} {balance}개
                </p>
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      closeModal();
                      router.push('/credit');
                    }}
                    className="block w-full h-12 rounded-lg bg-gradient-to-r from-cta to-cta-active text-white font-bold text-[15px] hover:opacity-90 transition-all"
                  >
                    크레딧 충전하기
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="block w-full h-12 rounded-lg border border-[var(--border-subtle)] text-text-secondary font-medium text-[15px] hover:bg-white/5 transition-all"
                  >
                    취소
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
