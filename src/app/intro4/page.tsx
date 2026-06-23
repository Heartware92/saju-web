'use client';

/**
 * 온보딩 3장 — 달로 운명의 문 열기 (/intro4)
 *
 * 홈화면과 동일한 Layout(헤더·탭바·배경) 위에 메인 운세 8개 그리드.
 *  - 최초 진입: "달을 밝혀, 아직 보이지 않는 흐름을 열어보세요." 모달
 *  - 메인 풀이(10달) 클릭: 보유 5달 → "5개가 더 필요해요" 안내
 *  - 8개 카드 주변 빛나는 글로우
 *
 * NOTE: 샌드박스. 데모용으로 보유 달을 5로 표시(이탈 시 복원). 실제 결제/차감 없음.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useCreditStore } from '@/store/useCreditStore';
import { MOON_COST_BIG } from '@/constants/creditCosts';
import styles from './intro4.module.css';

const CURRENT_YEAR = new Date().getFullYear();
const BONUS_MOON = 5; // 첫 가입 보너스

const SERVICES = [
  { id: 'newyear', title: `${CURRENT_YEAR} 신년운세`, desc: '한 해의 흐름', gradient: 'from-rose-500/20 to-pink-500/10' },
  { id: 'traditional', title: '정통 사주', desc: '사주팔자 종합 분석', gradient: 'from-purple-500/20 to-indigo-500/10' },
  { id: 'gunghap', title: '궁합', desc: '연인·친구·가족 케미', gradient: 'from-rose-500/20 to-fuchsia-500/10' },
  { id: 'date', title: '지정일 운세', desc: '특정 날짜의 운세', gradient: 'from-blue-500/20 to-cyan-500/10' },
  { id: 'taekil', title: '택일 운세', desc: '행사 길일 찾기', gradient: 'from-teal-500/20 to-emerald-500/10' },
  { id: 'tojeong', title: '토정비결', desc: '한 해의 길흉', gradient: 'from-emerald-500/20 to-teal-500/10' },
  { id: 'zamidusu', title: '자미두수', desc: '별자리 명리', gradient: 'from-violet-500/20 to-fuchsia-500/10' },
  { id: 'year-fortune', title: '연도별 운세', desc: '특정 연도의 운세', gradient: 'from-amber-500/20 to-orange-500/10' },
];

export default function Onboarding3Page() {
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(true);
  const [showShort, setShowShort] = useState(false);

  // 데모용 보유 달 = 5 (이탈 시 원복)
  useEffect(() => {
    const prev = useCreditStore.getState().moonBalance;
    useCreditStore.setState({ moonBalance: BONUS_MOON });
    return () => {
      useCreditStore.setState({ moonBalance: prev });
    };
  }, []);

  const need = MOON_COST_BIG - BONUS_MOON;

  return (
    <Layout glowTabs={['/sangdamso', '/archive']}>
      <div className="px-4 pt-3 pb-8">
        {/* 헤드라인 */}
        <div className="mb-5 px-1">
          <h1 className="text-[20px] font-bold leading-snug text-text-primary" style={{ fontFamily: 'var(--font-title)' }}>
            달을 밝혀,
            <br />
            아직 보이지 않는 흐름을 열어보세요.
          </h1>
          <p className="mt-1.5 text-[13px] text-text-secondary">각각의 문 너머에는 당신만의 이야기가 기다리고 있어요.</p>
        </div>

        {/* 메인 운세 8개 그리드 — 빛나는 글로우 */}
        <div className="grid grid-cols-2 gap-2.5">
          {SERVICES.map((svc, i) => (
            <div key={svc.id} className={styles.cardGlow} style={{ animationDelay: `${(i % 4) * 0.25}s` }}>
              <button type="button" onClick={() => setShowShort(true)} className="w-full text-left">
                <div
                  className={`relative flex h-[88px] flex-col items-center justify-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-gradient-to-br p-3 text-center ${svc.gradient}`}
                >
                  <h3 className="text-[19px] font-bold tracking-tight text-text-primary">{svc.title}</h3>
                  <p className="text-[15px] font-medium text-text-secondary">{svc.desc}</p>
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 최초 진입 모달 */}
      {showIntro && (
        <Overlay onClose={() => setShowIntro(false)}>
          <div className="mb-4 text-[34px]">🌙</div>
          <h2 className="mb-2 text-[19px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-title)' }}>
            달을 밝혀, 아직 보이지 않는 흐름을 열어보세요.
          </h2>
          <p className="mb-6 text-[14px] leading-relaxed text-text-secondary">
            각각의 문 너머에는 당신만의 이야기가 기다리고 있어요.
          </p>
          <PrimaryBtn onClick={() => setShowIntro(false)}>문 둘러보기</PrimaryBtn>
        </Overlay>
      )}

      {/* 달 부족 안내 */}
      {showShort && (
        <Overlay onClose={() => setShowShort(false)}>
          <div className="mb-4 text-[34px]">🌙</div>
          <h2 className="mb-2 text-[18px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-title)' }}>
            조금만 더 있으면 이 문을 열 수 있어요.
          </h2>
          <p className="mb-1 text-[14px] text-text-secondary">
            당신의 달이 <span className="font-bold text-cta">{BONUS_MOON}</span>개 남았네요.
          </p>
          <p className="mb-6 text-[14px] text-text-secondary">
            이 문을 열려면 달 {MOON_COST_BIG}개가 필요해요. <span className="font-bold text-cta">{need}개</span>가 더 필요해요.
          </p>
          <PrimaryBtn onClick={() => router.push('/credit')}>달의 기운 채우기</PrimaryBtn>
          <button onClick={() => setShowShort(false)} className="mt-3 text-[13px] text-text-tertiary">
            다음에 할게요
          </button>
        </Overlay>
      )}
    </Layout>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-8" style={{ background: 'rgba(8,4,18,0.72)' }} onClick={onClose}>
      <div
        className="w-full max-w-[320px] rounded-3xl border border-[var(--border-default)] bg-[rgba(24,15,46,0.96)] p-7 text-center backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function PrimaryBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-full bg-gradient-to-r from-cta to-cta-active py-3 text-[15px] font-bold text-white shadow-lg shadow-cta/20 transition-all hover:opacity-90 active:opacity-80"
    >
      {children}
    </button>
  );
}
