'use client';

/**
 * 대표 프로필 기반 상세 만세력 페이지
 * - 홈의 간단 만세력에서 "만세력 보기" 버튼으로 진입
 * - 정통사주 결과 페이지의 사주원국~세운 블록(사주관계·오행십성·신강신약·대운수)을 그대로 노출
 * - AI 해석(기본/상세 풀이) 은 정통사주 페이지에서만 제공
 */

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';
import { computeSajuFromProfile } from '../utils/profileSaju';
import SajuReport from '../components/saju/SajuReport';
import styles from './SajuResultPage.module.css';
import { BackButton } from '../components/ui/BackButton';

export default function ManseryeokPage() {
  const { user } = useUserStore();
  const { profiles, fetchProfiles, hydrated, loading: profilesLoading, lastFetchedAt } = useProfileStore();

  useEffect(() => {
    if (user) fetchProfiles();
  }, [user, fetchProfiles]);

  const primary = useMemo(
    () => profiles.find((p) => p.is_primary) ?? null,
    [profiles],
  );

  const saju = useMemo(() => {
    if (!primary) return null;
    return computeSajuFromProfile(primary);
  }, [primary]);

  if (!primary) {
    const profileStoreReady = hydrated && lastFetchedAt !== null && !profilesLoading;
    if (!profileStoreReady) {
      return <div className={styles.loading}>로딩 중...</div>;
    }
    return (
      <div className={styles.container}>
        <div className="flex items-center relative mb-5 pt-3 px-1">
          <BackButton className="absolute left-0" />
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>만세력</h1>
          </div>
        </div>
        <div className={styles.section} style={{ textAlign: 'center', padding: '48px 24px' }}>
          <h2>대표 프로필이 없어요</h2>
          <p style={{ margin: '16px 0 24px', color: 'var(--text-secondary)' }}>
            만세력을 보려면 먼저 생년월일시를 등록해주세요.
          </p>
          <Link href="/saju/input?mode=profile-only" className={styles.backBtn} style={{ margin: '0 auto', textDecoration: 'none' }}>
            프로필 등록하기
          </Link>
        </div>
      </div>
    );
  }

  if (!saju) {
    return <div className={styles.loading}>로딩 중...</div>;
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className="flex items-center relative pt-3 px-1">
        <BackButton className="absolute left-0" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>만세력</h1>
        </div>
      </div>
      <p className="text-sm text-text-tertiary text-center mt-2 mb-4">
        {primary.name} · {saju.solarDate} (양력) | {saju.lunarDateSimple} (음력)
      </p>

      {/* 시간 미상 안내 배너 */}
      {saju.hourUnknown && (
        <div className={styles.unknownHourBanner}>
          <strong>시간 미상 · 삼주추명(三柱推命)</strong>
          <p>
            출생 시간 미상으로 시주(時柱)는 제외되었습니다. 연·월·일주 기반으로
            분석됩니다.
          </p>
        </div>
      )}

      <div className={styles.content}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <SajuReport result={saju} defaultExpanded />
        </motion.div>
      </div>
    </div>
  );
}
