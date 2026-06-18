'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Card } from '../components/ui/Card';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';
import { computeSajuFromProfile } from '../utils/profileSaju';
import {
  getCharacterFromStem,
  stemToHanja,
  zhiToHanja,
  STEM_TO_ELEMENT,
} from '../lib/character';
import { BRANCH_ELEMENT } from '../lib/data/constants';
import { MORE_FORTUNE_CONFIGS, MORE_FORTUNE_ORDER, MOON_COST_PER_FORTUNE } from '../constants/moreFortunes';
import { SUN_COST_BIG, MOON_COST_MORE } from '../constants/creditCosts';
import { QuickFortuneGate, type QuickFortuneGateProps } from '../components/QuickFortuneGate';
import { GunghapArchiveListModal } from '../components/GunghapArchiveListModal';
import type { ArchiveCategory, GunghapArchiveItem } from '../services/archiveService';
import { findGunghapArchives } from '../services/archiveService';
import MoonPhase from '../components/MoonPhase';

// 만세력 페이지(SajuReport)와 동일한 오행 색상 — 홈 4기둥 한자 색칠용
const ELEMENT_COLORS: Record<string, string> = {
  '목': '#34D399', '화': '#F43F5E', '토': '#F59E0B', '금': '#CBD5E1', '수': '#3B82F6',
};

/**
 * 운세 서비스 목록
 * - 메인 2x2: 신년운세 / 정통사주 / 궁합 / 지정일 운세
 * - 메인 하단 1x2: 택일 운세 / 연도별 운세 / 자미두수
 *   (토정비결은 업데이트 예정으로 홈에서 숨김)
 * - 서브 (작은 칩): 더 많은 운세 / 타로
 */
const CURRENT_YEAR = new Date().getFullYear();

// 상단 메인 풀이 — 모두 동일 크기 (지정일·택일 운세 사이즈) 로 통일.
// 신년 / 정통 / 궁합 + 지정일 / 택일 / 연도별 / 자미두수
// 토정비결은 TOP_SERVICES에서 주석 처리됨 (게이트·페이지·엔진은 유지)
const TOP_SERVICES = [
  {
    id: 'newyear',
    title: `${CURRENT_YEAR} 신년운세`,
    desc: '한 해의 흐름',
    direct: '/saju/newyear',
    gradient: 'from-rose-500/20 to-pink-500/10',
  },
  {
    id: 'traditional',
    title: '정통 사주',
    desc: '사주팔자 종합 분석',
    direct: '/saju/result',
    gradient: 'from-purple-500/20 to-indigo-500/10',
  },
  {
    id: 'gunghap',
    title: '궁합',
    desc: '연인·친구·가족 케미',
    direct: '/saju/gunghap',
    gradient: 'from-rose-500/20 to-fuchsia-500/10',
  },
  {
    id: 'date',
    title: '지정일 운세',
    desc: '특정 날짜의 운세',
    direct: '/saju/date',
    gradient: 'from-blue-500/20 to-cyan-500/10',
  },
  {
    id: 'taekil',
    title: '택일 운세',
    desc: '행사 길일 찾기',
    direct: '/saju/taekil',
    gradient: 'from-teal-500/20 to-emerald-500/10',
  },
  // 토정비결 — 홈에서 숨김 (업데이트 예정). 페이지/엔진/게이트 설정은 유지.
  // {
  //   id: 'tojeong',
  //   title: '토정비결',
  //   desc: '한 해의 길흉',
  //   direct: '/saju/tojeong',
  //   gradient: 'from-emerald-500/20 to-teal-500/10',
  // },
  {
    id: 'year-fortune',
    title: '연도별 운세',
    desc: '특정 연도의 운세',
    direct: '/saju/year-fortune',
    gradient: 'from-amber-500/20 to-orange-500/10',
  },
  {
    id: 'zamidusu',
    title: '자미두수',
    desc: '별자리 명리',
    direct: '/saju/zamidusu',
    gradient: 'from-violet-500/20 to-fuchsia-500/10',
  },
];

// 모든 서비스 버튼은 결과 페이지로 직행한다.
// 대표 프로필이 없으면 결과 페이지 자체에서 "프로필 등록" 안내가 표시된다.

// "더 많은 운세" — 달 크레딧 5개 소모 (5종) + 실시간 운세를 1행 1열 첫 카드로 prepend.
// 실시간 운세도 같은 단가(5달)이라 시각적으로 같은 카드 사이즈로 통일.
const SUB_SERVICES = [
  {
    id: 'today',
    title: '실시간 운세',
    icon: '☀️',
    desc: '지금의 운세',
    href: '/saju/today',
  },
  ...MORE_FORTUNE_ORDER.map((id) => {
    const cfg = MORE_FORTUNE_CONFIGS[id];
    return {
      id,
      title: cfg.title,
      icon: cfg.icon,
      desc: cfg.shortDesc,
      href: `/saju/more/${id}`,
    };
  }),
];

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};


type GateConfig = Omit<QuickFortuneGateProps, 'onClose'>;

function buildGateConfig(path: string): GateConfig | null {
  const GATE_SERVICES: Record<string, GateConfig> = {
    '/saju/today': { serviceName: '실시간 운세', archiveCategory: 'today' as ArchiveCategory, creditType: 'moon', creditCost: MOON_COST_MORE, targetPath: '/saju/today' },
    '/saju/date': { serviceName: '지정일 운세', archiveCategory: 'period' as ArchiveCategory, creditType: 'moon', creditCost: SUN_COST_BIG, targetPath: '/saju/date' },
    '/saju/taekil': { serviceName: '택일 운세', archiveCategory: 'taekil' as ArchiveCategory, creditType: 'moon', creditCost: SUN_COST_BIG, targetPath: '/saju/taekil' },
    '/saju/tojeong': { serviceName: '토정비결', description: '조선 시대 토정 이지함 선생이 만든 연간 신수 풀이예요. 음력 생년월일과 세는 나이로 144괘 중 하나를 뽑아 올해의 총운, 12개월 흐름, 재물·애정·건강·직장운을 살펴봅니다.', archiveCategory: 'tojeong' as ArchiveCategory, creditType: 'moon', creditCost: SUN_COST_BIG, targetPath: '/saju/tojeong' },
    '/saju/zamidusu': { serviceName: '자미두수', description: '중국 송나라 진희이가 창시한 별자리 명리학이에요. 생년월일시를 기반으로 자미성을 비롯한 108개 성(星)의 배치를 분석하여 성격, 재물, 관계, 건강 등 삶의 큰 그림을 읽어냅니다.', archiveCategory: 'zamidusu' as ArchiveCategory, creditType: 'moon', creditCost: SUN_COST_BIG, targetPath: '/saju/zamidusu' },
  };

  if (GATE_SERVICES[path]) return GATE_SERVICES[path];

  const moreMatch = path.match(/^\/saju\/more\/(.+)$/);
  if (moreMatch) {
    const category = moreMatch[1];
    const cfg = (MORE_FORTUNE_CONFIGS as Record<string, (typeof MORE_FORTUNE_CONFIGS)[keyof typeof MORE_FORTUNE_CONFIGS]>)[category];
    if (cfg) {
      return { serviceName: cfg.title, archiveCategory: category as ArchiveCategory, creditType: 'moon', creditCost: MOON_COST_PER_FORTUNE, targetPath: path };
    }
  }

  return null;
}

export default function HomePage() {
  const { user } = useUserStore();
  const { profiles, fetchProfiles, loading: profilesLoading } = useProfileStore();
  const [imgError, setImgError] = useState(false);
  const [activeGate, setActiveGate] = useState<GateConfig | null>(null);
  // 궁합 archive list 모달 — 다른 풀이 모달처럼 홈 위에 fade-in (페이지 라우팅 없이)
  const [gunghapModalOpen, setGunghapModalOpen] = useState(false);
  const [gunghapArchiveList, setGunghapArchiveList] = useState<GunghapArchiveItem[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (user) fetchProfiles();
  }, [user, fetchProfiles]);

  // bfcache(모바일 Safari·Chrome 등) 복원 시 게이트 모달이 떠 있던 상태 그대로
  // 보이는 현상 방지 — 페이지가 다시 보여질 때 강제로 모달 닫기.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setActiveGate(null);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  // 로그인 직후 첫 진입 — 프로필 페치 완료 전에 "등록 유도" 카드가 flash되는 현상 방지
  const showProfileSkeleton = !!user && profilesLoading && profiles.length === 0;

  // 대표 프로필
  const primary = useMemo(
    () => profiles.find((p) => p.is_primary) ?? null,
    [profiles],
  );

  // 대표 프로필 만세력 계산 — 음력/양력 변환은 헬퍼에서 일관 처리
  const sajuData = useMemo(() => {
    if (!primary) return null;
    const result = computeSajuFromProfile(primary);
    if (!result) return null;
    const dayStem = result.pillars.day.gan;
    const element = STEM_TO_ELEMENT[dayStem];
    const character = getCharacterFromStem(dayStem);
    return { pillars: result.pillars, element, character, unknownTime: result.hourUnknown };
  }, [primary]);

  const handleServiceClick = useCallback((e: React.MouseEvent, targetPath: string) => {
    e.preventDefault();
    if (!user) {
      router.push(`/login?from=${targetPath}`);
      return;
    }
    // 대표 프로필이 아직 없으면 게이트 모달을 띄우지 않고 바로 프로필 등록으로 보낸다
    // (모달 안에서 fetchProfiles 후 즉시 onClose 되며 깜박이는 현상 회피)
    if (!profilesLoading && !primary) {
      router.push('/saju/input?mode=profile-only');
      return;
    }
    // ★ 궁합 — 다른 풀이와 동일하게 홈 위에 모달 fade-in (페이지 라우팅 없이).
    //   archive 있으면 archive 리스트 모달, 없으면 바로 페이지 이동 (입력 단계 진입).
    if (targetPath === '/saju/gunghap') {
      findGunghapArchives(20).then(list => {
        if (list.length > 0) {
          setGunghapArchiveList(list);
          setGunghapModalOpen(true);
        } else {
          router.push('/saju/gunghap');
        }
      }).catch(() => {
        // archive fetch 실패 시 그냥 페이지로 이동 (fallback)
        router.push('/saju/gunghap');
      });
      return;
    }
    const gate = buildGateConfig(targetPath);
    if (gate) {
      setActiveGate(gate);
    } else {
      router.push(targetPath);
    }
  }, [user, router, primary, profilesLoading]);

  return (
    <div className="min-h-screen">
      {/* 달 — 우상단 고정, 스크롤 시 자연스럽게 올라감 */}
      <div
        className="absolute top-14 right-4 w-[76px] h-[76px] pointer-events-none opacity-70 z-[1] rounded-full"
        style={{
          boxShadow: '0 0 30px 10px rgba(255,240,200,0.10), 0 0 60px 20px rgba(255,220,180,0.05)',
        }}
      >
        <MoonPhase size={76} />
      </div>

      {/* Hero — 대표 프로필 상태에 따라 분기 */}
      <section className="relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-10 pb-8">

          {/* CASE 0: 로그인 직후 프로필 페치 중 — 스켈레톤 */}
          {showProfileSkeleton && (
            <div className="w-full max-w-[340px] mx-auto" aria-hidden="true">
              <div className="rounded-2xl px-6 py-8 bg-[rgba(124,92,252,0.06)] border border-[var(--border-subtle)] animate-pulse">
                <div className="mx-auto w-16 h-16 mb-3 rounded-full bg-[rgba(255,255,255,0.06)]" />
                <div className="h-5 w-40 mx-auto rounded bg-[rgba(255,255,255,0.06)] mb-2" />
                <div className="h-3 w-32 mx-auto rounded bg-[rgba(255,255,255,0.04)]" />
              </div>
            </div>
          )}

          {/* CASE 1: 대표 프로필 없음 → 등록 유도 */}
          {!showProfileSkeleton && !primary && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full"
            >
              <Link href={user ? "/saju/input?mode=profile-only" : "/login?from=/saju/input?mode=profile-only"} className="block">
                <div className="relative mx-auto w-full max-w-[340px] rounded-2xl px-6 py-8
                                bg-gradient-to-br from-[rgba(124,92,252,0.18)] to-[rgba(201,166,255,0.08)]
                                border border-[var(--border-subtle)] hover:border-cta/50
                                transition-all active:scale-[0.98]">
                  <div className="mx-auto w-16 h-16 mb-3 rounded-full bg-[rgba(20,12,38,0.6)]
                                  border border-cta/30 flex items-center justify-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="#B8C5F0" aria-hidden="true">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  </div>
                  <h2
                    className="text-lg font-bold text-text-primary mb-1 tracking-tight"
                    style={{ fontFamily: 'var(--font-serif)' }}
                  >
                    대표 프로필을 선택하세요
                  </h2>
                  <p className="text-xs text-text-secondary">
                    생년월일을 등록하면 당신의 캐릭터와 만세력을 볼 수 있어요
                  </p>
                  <div className="mt-4 inline-flex items-center gap-1 text-[17px] font-semibold text-cta">
                    프로필 등록하기
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </div>
              </Link>
            </motion.div>
          )}

          {/* CASE 2: 대표 프로필 있음 → 캐릭터 + 만세력 */}
          {!showProfileSkeleton && primary && sajuData && sajuData.character && (
            <>
              {/* 캐릭터 이미지 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="mb-3"
              >
                <div className="relative w-44 h-44 mx-auto">
                  {/* 오행 색 글로우 */}
                  <div
                    className="absolute inset-[-8px] rounded-full blur-xl"
                    style={{ backgroundColor: sajuData.character.colorGlow }}
                  />
                  {/* 내부 원 */}
                  <div className="absolute inset-0 rounded-full overflow-hidden
                                  bg-[rgba(20,12,38,0.85)] border border-[var(--border-subtle)]
                                  flex items-center justify-center">
                    {!imgError ? (
                      <Image
                        src={sajuData.character.image}
                        alt={sajuData.character.label}
                        width={176}
                        height={176}
                        priority
                        className="w-full h-full object-cover"
                        onError={() => setImgError(true)}
                      />
                    ) : (
                      <span className="text-5xl">{sajuData.character.emoji}</span>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* 이름 · 오행 */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="mb-5"
              >
                <h1
                  className="text-xl font-bold text-text-primary tracking-tight mb-1"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {primary.name}
                </h1>
                <p className="text-sm font-medium text-text-secondary mb-2">
                  <span style={{ color: sajuData.character.colorMain }}>
                    {sajuData.character.hanjaElement}
                  </span>
                  {' · '}
                  {sajuData.character.label}
                </p>
                <p className="text-[17px] text-text-secondary mb-2 italic" style={{ fontFamily: 'var(--font-serif)' }}>
                  "{sajuData.character.tagline}"
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {sajuData.character.traits.map((t) => (
                    <span
                      key={t}
                      className="text-[13px] px-2 py-0.5 rounded-full border"
                      style={{
                        color: sajuData.character!.colorMain,
                        borderColor: `${sajuData.character!.colorMain}55`,
                        backgroundColor: `${sajuData.character!.colorMain}15`,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </motion.div>

              {/* 만세력 — 4기둥 한자 */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="w-full max-w-[340px]"
              >
                <div className="rounded-2xl p-4 bg-[rgba(20,12,38,0.55)]
                                border border-[var(--border-subtle)] backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-[13px] font-medium text-text-tertiary uppercase tracking-wider">
                      만세력
                    </span>
                    <Link
                      href="/saju/profile"
                      className="text-[13px] font-medium text-cta hover:underline"
                    >
                      프로필 관리
                    </Link>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {[
                      { label: '시', pillar: sajuData.pillars.hour, unknown: sajuData.unknownTime },
                      { label: '일', pillar: sajuData.pillars.day, unknown: false },
                      { label: '월', pillar: sajuData.pillars.month, unknown: false },
                      { label: '년', pillar: sajuData.pillars.year, unknown: false },
                    ].map((col) => (
                      <div
                        key={col.label}
                        className="flex flex-col items-center rounded-xl bg-[rgba(20,12,38,0.6)]
                                   border border-[var(--border-subtle)] px-2 py-2.5 text-center"
                      >
                        <div className="text-[12px] font-medium text-text-tertiary mb-1.5">
                          {col.label}
                        </div>
                        {/* 내용 영역 — flex-1 + 중앙정렬로 '?'칸과 4줄칸 높이·세로정렬 일치 */}
                        <div className="flex-1 flex flex-col items-center justify-center">
                          {col.unknown ? (
                            <div className="text-xl font-bold text-text-tertiary"
                                 style={{ fontFamily: 'var(--font-serif)' }}>
                              ?
                            </div>
                          ) : (
                            <>
                              {/* 천간: 한글음(위) + 오행색 한자 — 만세력 페이지와 동일 표기 */}
                              <div className="text-[10px] font-medium text-text-tertiary leading-none mb-0.5">
                                {col.pillar.gan}
                              </div>
                              <div
                                className="text-xl font-bold leading-none"
                                style={{
                                  fontFamily: 'var(--font-serif)',
                                  color: ELEMENT_COLORS[STEM_TO_ELEMENT[col.pillar.gan]] ?? 'var(--text-primary)',
                                }}
                              >
                                {stemToHanja(col.pillar.gan)}
                              </div>
                              {/* 지지: 오행색 한자 + 한글음(아래) */}
                              <div
                                className="text-xl font-bold leading-none mt-1"
                                style={{
                                  fontFamily: 'var(--font-serif)',
                                  color: ELEMENT_COLORS[BRANCH_ELEMENT[col.pillar.zhi]] ?? 'var(--text-primary)',
                                }}
                              >
                                {zhiToHanja(col.pillar.zhi)}
                              </div>
                              <div className="text-[10px] font-medium text-text-tertiary leading-none mt-0.5">
                                {col.pillar.zhi}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 만세력 보기 버튼 */}
                  <Link
                    href="/saju/manseryeok"
                    className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl
                               bg-[rgba(124,92,252,0.15)] border border-cta/30
                               text-[17px] font-semibold text-cta
                               hover:bg-[rgba(124,92,252,0.22)] active:scale-[0.98] transition-all"
                  >
                    만세력 보기
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </Link>
                </div>
              </motion.div>
            </>
          )}

        </div>
      </section>

      {/* 상단 서비스 7종 — 지정일·택일 운세 사이즈로 통일 (h-[88], 폰트 19/15) */}
      <section className="px-4 -mt-3 relative z-10">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-base font-bold text-text-primary">메인 풀이</h2>
          <span className="text-[12px] text-text-tertiary">🌙 10개 소모</span>
        </div>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-2 gap-2.5"
        >
          {TOP_SERVICES.map((svc) => (
            <motion.div key={svc.id} variants={fadeUp}>
              <button type="button" onClick={(e) => handleServiceClick(e, svc.direct)} className="w-full text-left">
                <div className={`
                  service-card
                  relative rounded-xl p-3 h-[88px]
                  bg-gradient-to-br ${svc.gradient}
                  border border-[var(--border-subtle)]
                  flex flex-col items-center justify-center text-center gap-1
                `}>
                  <h3 className="text-[19px] font-bold text-text-primary tracking-tight">{svc.title}</h3>
                  <p className="text-[15px] font-medium text-text-secondary">{svc.desc}</p>
                </div>
              </button>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* 추가 서비스 - 더 많은 운세 9종 (달 크레딧) */}
      <section className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-base font-bold text-text-primary">더 많은 운세</h2>
          <span className="text-[12px] text-text-tertiary">🌙 5개 소모</span>
        </div>
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-3 gap-2"
        >
          {SUB_SERVICES.map((svc) => (
            <motion.div key={svc.id} variants={fadeUp}>
              <button type="button" onClick={(e) => handleServiceClick(e, svc.href)} className="w-full">
                <div className="service-card flex flex-col items-center justify-center h-[80px] p-2.5 rounded-xl bg-space-surface/60 border border-[var(--border-subtle)]">
                  <span className="text-[17px] font-bold text-text-primary text-center leading-tight mb-1 whitespace-nowrap">{svc.title}</span>
                  <span className="text-[14px] text-text-tertiary text-center leading-tight line-clamp-1 whitespace-nowrap">{svc.desc}</span>
                </div>
              </button>
            </motion.div>
          ))}
        </motion.div>
      </section>


      {/* 타로 배너 */}
      <section className="px-4 mt-6 mb-10">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-base font-bold text-text-primary">타로</h2>
          <span className="text-[12px] text-text-tertiary">🌙 1개 소모</span>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Link href="/tarot">
            <Card hover padding="none" glow="cta" className="overflow-hidden">
              <div className="relative px-5 py-5 bg-gradient-to-br from-[rgba(232,164,144,0.18)] to-[rgba(201,166,255,0.1)]">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-text-primary mb-0.5 tracking-tight">타로 상담실</h3>
                    <p className="text-sm font-medium text-text-secondary">카드가 전하는 오늘의 한 문장</p>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </div>
            </Card>
          </Link>
        </motion.div>
      </section>

      {/* 서비스 진입 게이트 모달 */}
      {activeGate && (
        <QuickFortuneGate
          {...activeGate}
          onClose={() => setActiveGate(null)}
        />
      )}

      {/* 궁합 archive list 모달 — 홈 위에 fade-in (다른 풀이와 동일 UX) */}
      <GunghapArchiveListModal
        open={gunghapModalOpen}
        archiveList={gunghapArchiveList}
        onSelectItem={(id) => {
          setGunghapModalOpen(false);
          router.push(`/saju/gunghap?recordId=${id}`);
        }}
        onClickNew={() => {
          // 새로 시작 — fresh=1 로 GunghapPage 진입, 자체 archive 모달 자동 노출 차단
          setGunghapModalOpen(false);
          router.push('/saju/gunghap?fresh=1');
        }}
        onClose={() => setGunghapModalOpen(false)}
      />

    </div>
  );
}
