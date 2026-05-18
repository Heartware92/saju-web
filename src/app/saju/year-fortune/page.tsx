'use client';

/**
 * 연도별 운세 — 진입 시 연도 선택 후 신년운세 페이지 재사용으로 풀이.
 *
 * 구조:
 *  · 연도 선택 select (1900~2200, 디폴트 = 현재 연도)
 *  · "풀이 보기" 버튼 → QuickFortuneGate(10달 소모, archiveCategory='newyear')
 *  · 결제 완료 시 /saju/newyear?year=YYYY 로 navigate
 *    → PeriodFortunePage 가 targetYear 동적 처리 (이미 구현돼있음)
 *
 * 신년운세와의 차이:
 *  · 신년운세 = 현재 연도 자동
 *  · 연도별 운세 = 1900~2200 자유 선택
 *  · 풀이 결과·prompt 동일 (year 값만 다름)
 */

import { Suspense, useState, useMemo } from 'react';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { QuickFortuneGate, type QuickFortuneGateProps } from '@/components/QuickFortuneGate';
import { SUN_COST_BIG } from '@/constants/creditCosts';
import { BackButton } from '@/components/ui/BackButton';

const MIN_YEAR = 1900;
const MAX_YEAR = 2200;

function YearPicker() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [gateOpen, setGateOpen] = useState(false);

  // 연도 옵션 — 최신 연도가 위로 (사용자가 현재·미래 연도 더 자주 본다고 가정)
  const yearOptions = useMemo(() => {
    const list: number[] = [];
    for (let y = MAX_YEAR; y >= MIN_YEAR; y--) list.push(y);
    return list;
  }, []);

  const gateConfig: Omit<QuickFortuneGateProps, 'onClose'> = {
    serviceName: `${selectedYear}년 신년운세`,
    archiveCategory: 'newyear',
    creditType: 'moon',
    creditCost: SUN_COST_BIG,
    targetPath: `/saju/newyear?year=${selectedYear}`,
    archiveContext: { key: 'year', value: String(selectedYear) },
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
        원하시는 연도를 골라 그 해의 운세를 확인하실 수 있어요.<br />
        1900년부터 2200년까지 선택 가능합니다.
      </div>

      {/* 연도 선택 카드 */}
      <div className="rounded-2xl p-6 mb-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <label className="block text-[14px] font-semibold text-text-primary mb-3">
          연도 선택
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
        <p className="text-[11.5px] text-text-tertiary mt-2 text-center">
          기본값: 올해 ({currentYear}년)
        </p>
      </div>

      {/* 풀이 보기 버튼 */}
      <button
        type="button"
        onClick={() => setGateOpen(true)}
        className="w-full py-3.5 rounded-xl font-bold text-[15px] transition-all"
        style={{
          background: 'var(--cta-primary)',
          color: '#fff',
        }}
      >
        {selectedYear}년 운세 풀이 보기
      </button>

      {/* 결제 게이트 */}
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
          <YearPicker />
        </Suspense>
      </ProtectedRoute>
    </Layout>
  );
}
