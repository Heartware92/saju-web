'use client';

/**
 * 연도별 운세 — 연도 + 프로필 동시 선택 후 풀이.
 *
 * 구조:
 *  · 연도 select (1900~2200, 디폴트 = 현재 연도)
 *  · 프로필 select (대표 프로필 디폴트, 다른 프로필 선택 가능)
 *  · "풀이 보기" 버튼 → QuickFortuneGate
 *    - 선택 프로필의 모든 신년운세 풀이 1건이라도 있으면 → 리스트 모달
 *      (연도 무관 — archiveContext 안 보냄으로 isListMode 트리거)
 *    - 없으면 → 결제 모달 (10달 소모)
 *  · 결제 완료 시 /saju/newyear?year=YYYY 로 navigate (선택 연도)
 *
 * 신년운세와 차이:
 *  · 신년운세 = 대표 프로필 자동 + 현재 연도 + 단일 모달
 *  · 연도별 운세 = 프로필 선택 + 연도 선택(1900~2200) + 리스트 모달(과거 풀이 모두)
 */

import { Suspense, useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { QuickFortuneGate, type QuickFortuneGateProps } from '@/components/QuickFortuneGate';
import { SUN_COST_BIG } from '@/constants/creditCosts';
import { BackButton } from '@/components/ui/BackButton';
import { useProfileStore } from '@/store/useProfileStore';
import { useUserStore } from '@/store/useUserStore';

const MIN_YEAR = 1900;
const MAX_YEAR = 2200;

function YearFortuneSelector() {
  const currentYear = new Date().getFullYear();
  const { user } = useUserStore();
  const { profiles, fetchProfiles } = useProfileStore();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [gateOpen, setGateOpen] = useState(false);

  useEffect(() => {
    if (user) fetchProfiles();
  }, [user, fetchProfiles]);

  // 프로필 fetch 완료 시 대표 프로필 디폴트 선택
  useEffect(() => {
    if (selectedProfileId || profiles.length === 0) return;
    const primary = profiles.find((p) => p.is_primary) ?? profiles[0];
    if (primary) setSelectedProfileId(primary.id);
  }, [profiles, selectedProfileId]);

  // 연도 옵션 — 최신 연도가 위로
  const yearOptions = useMemo(() => {
    const list: number[] = [];
    for (let y = MAX_YEAR; y >= MIN_YEAR; y--) list.push(y);
    return list;
  }, []);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  const canSubmit = !!selectedProfile && selectedYear >= MIN_YEAR && selectedYear <= MAX_YEAR;

  const gateConfig: Omit<QuickFortuneGateProps, 'onClose'> = {
    serviceName: `${selectedYear}년 신년운세`,
    archiveCategory: 'newyear',
    creditType: 'moon',
    creditCost: SUN_COST_BIG,
    targetPath: `/saju/newyear?year=${selectedYear}`,
    profileId: selectedProfileId,
    // archiveContext 안 보냄 — 그 프로필의 모든 newyear 풀이 리스트로 노출 (isListMode)
  };

  return (
    <div className="px-4 pt-4 pb-12">
      {/* 헤더 */}
      <div className="flex items-center justify-center relative mb-5 pt-3 px-1">
        <BackButton className="absolute left-0" />
        <h1
          className="text-2xl font-bold text-text-primary"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          연도별 운세
        </h1>
      </div>

      <div className="text-center mb-6 text-[13px] text-text-tertiary leading-relaxed">
        원하시는 연도와 프로필을 골라 그 해의 운세를 확인하실 수 있어요.<br />
        1900년부터 2200년까지 선택 가능합니다.
      </div>

      {/* 연도 선택 카드 */}
      <div className="rounded-2xl p-5 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <label className="block text-[14px] font-semibold text-text-primary mb-3">
          연도 <span className="text-red-400">*</span>
        </label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
          className="w-full px-4 py-3 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[18px] font-semibold text-text-primary"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}년{y === currentYear ? ' (올해)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 프로필 선택 카드 */}
      <div className="rounded-2xl p-5 mb-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <label className="block text-[14px] font-semibold text-text-primary mb-3">
          프로필 <span className="text-red-400">*</span>
        </label>
        {profiles.length === 0 ? (
          <div className="text-[13px] text-text-tertiary py-3 text-center">
            등록된 프로필이 없어요. 먼저 프로필을 등록해주세요.
          </div>
        ) : (
          <select
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[15px] text-text-primary"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.birth_date} · {p.gender === 'male' ? '남' : '여'}
                {p.is_primary ? ' (대표)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 풀이 보기 버튼 */}
      <button
        type="button"
        onClick={() => setGateOpen(true)}
        disabled={!canSubmit}
        className="w-full py-3.5 rounded-xl font-bold text-[15px] transition-all"
        style={{
          background: canSubmit ? 'var(--cta-primary)' : 'rgba(124,92,252,0.3)',
          color: '#fff',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          opacity: canSubmit ? 1 : 0.6,
        }}
      >
        {selectedProfile
          ? `${selectedProfile.name}님의 ${selectedYear}년 운세 보기`
          : '프로필을 선택해주세요'}
      </button>

      <p className="text-center text-[11.5px] text-text-tertiary mt-3 leading-relaxed">
        이전에 풀이 받은 기록이 있으면 다시 볼 수 있어요.<br />
        새로 풀이 받을 때만 🌙 10개가 소모됩니다.
      </p>

      {/* 결제·기존 풀이 게이트 모달 */}
      {gateOpen && (
        <QuickFortuneGate
          {...gateConfig}
          onClose={() => setGateOpen(false)}
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
