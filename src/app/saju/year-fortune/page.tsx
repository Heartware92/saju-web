'use client';

/**
 * 연도별 운세 — 연도 + 프로필 동시 선택 후 풀이.
 *
 * 구조:
 *  · 연도 select (1900~2200, 디폴트 = 현재 연도) — 상단 컴팩트 카드
 *  · 프로필 카드 리스트 (정통사주·신년운세와 동일 UI)
 *    - 클릭 즉시 QuickFortuneGate 모달 (선택된 연도로)
 *    - 결과있음 배지 / 대표 라벨 / 화살표 시각 일관
 *  · gate 동작:
 *    - 선택 프로필의 모든 신년운세 풀이 1건이라도 있으면 → 리스트 모달
 *      (연도 무관 — archiveContext 안 보냄으로 isListMode 트리거)
 *    - 없으면 → 결제 모달 (10달 소모)
 *  · 결제 완료 시 /saju/newyear?year=YYYY&source=year-fortune 로 navigate
 *
 * 신년운세와 차이:
 *  · 신년운세 = 대표 프로필 자동 + 현재 연도 + 단일 모달
 *  · 연도별 운세 = 프로필 선택 + 연도 선택(1900~2200) + 리스트 모달(과거 풀이 모두)
 */

import { Suspense, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { QuickFortuneGate, type QuickFortuneGateProps } from '@/components/QuickFortuneGate';
import { SUN_COST_BIG } from '@/constants/creditCosts';
import { BackButton } from '@/components/ui/BackButton';
import { useProfileStore } from '@/store/useProfileStore';
import { useUserStore } from '@/store/useUserStore';
import { findRecentArchivesBatch } from '@/services/archiveService';
import type { BirthProfile } from '@/types/credit';

const MIN_YEAR = 1900;
const MAX_YEAR = 2200;

function YearFortuneSelector() {
  const currentYear = new Date().getFullYear();
  const { user } = useUserStore();
  const { profiles, fetchProfiles } = useProfileStore();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedProfile, setSelectedProfile] = useState<BirthProfile | null>(null);
  const [archiveMap, setArchiveMap] = useState<Record<string, { id: string; created_at: string } | null>>({});
  const [archiveChecking, setArchiveChecking] = useState(true);

  useEffect(() => {
    if (user) fetchProfiles();
  }, [user, fetchProfiles]);

  // 결과있음 배지 — 모든 프로필의 newyear 풀이 1건 이상 여부 (연도 무관)
  useEffect(() => {
    if (profiles.length === 0) {
      setArchiveChecking(false);
      return;
    }
    setArchiveChecking(true);
    findRecentArchivesBatch({
      category: 'newyear',
      profileIds: profiles.map((p) => p.id),
    }).then((map) => {
      setArchiveMap(map);
      setArchiveChecking(false);
    });
  }, [profiles]);

  // 연도 옵션 — 최신 연도가 위로
  const yearOptions = useMemo(() => {
    const list: number[] = [];
    for (let y = MAX_YEAR; y >= MIN_YEAR; y--) list.push(y);
    return list;
  }, []);

  const gateConfig: Omit<QuickFortuneGateProps, 'onClose'> | null = selectedProfile
    ? {
        serviceName: `${selectedYear}년 운세 풀이`,
        archiveCategory: 'newyear',
        creditType: 'moon',
        creditCost: SUN_COST_BIG,
        targetPath: `/saju/newyear?year=${selectedYear}&source=year-fortune`,
        profileId: selectedProfile.id,
        sourceFilter: 'year-fortune',
      }
    : null;

  return (
    <div className="px-4 pt-4 pb-12">
      {/* 헤더 — 정통사주·신년운세와 동일 패턴 */}
      <div className="flex items-center relative mb-5 pt-3 px-1">
        <BackButton className="absolute left-0" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            연도별 운세
          </h1>
          <p className="text-base text-text-tertiary mt-1">연도와 프로필을 선택하세요</p>
        </div>
      </div>

      {/* 연도 선택 — 상단 컴팩트 카드 */}
      <div className="rounded-2xl p-4 mb-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[13px] font-semibold text-text-secondary">
            풀이 연도
          </label>
          <span className="text-[11px] text-text-tertiary">1900~2200년</span>
        </div>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
          className="w-full px-4 py-3 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[18px] font-bold text-text-primary"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}년{y === currentYear ? ' (올해)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 프로필 카드 리스트 — 정통사주·신년운세와 동일 UI */}
      {profiles.length === 0 ? (
        <div className="rounded-2xl p-6 mb-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] text-center">
          <p className="text-[14px] text-text-tertiary">
            등록된 프로필이 없어요. 먼저 프로필을 등록해주세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {profiles.map((profile, idx) => {
            const archive = archiveMap[profile.id];
            return (
              <motion.button
                key={profile.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setSelectedProfile(profile)}
                disabled={archiveChecking}
                className="w-full text-left rounded-2xl bg-space-surface/60 border border-[var(--border-subtle)] p-4 hover:border-cta/50 transition-all active:scale-[0.98] disabled:opacity-60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[rgba(124,92,252,0.12)] flex items-center justify-center text-lg shrink-0">
                    {profile.gender === 'male' ? '👨' : '👩'}
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
      )}

      <p className="text-center text-[11.5px] text-text-tertiary mt-2 leading-relaxed">
        이전에 풀이 받은 기록이 있으면 다시 볼 수 있어요.<br />
        새로 풀이 받을 때만 🌙 10개가 소모됩니다.
      </p>

      {/* 결제·기존 풀이 게이트 모달 */}
      {gateConfig && (
        <QuickFortuneGate
          {...gateConfig}
          onClose={() => setSelectedProfile(null)}
        />
      )}
    </div>
  );
}

export default function YearFortunePage() {
  return (
    <Layout>
      <ProtectedRoute>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-cta border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <YearFortuneSelector />
        </Suspense>
      </ProtectedRoute>
    </Layout>
  );
}
