'use client';

/**
 * 오프닝 인트로 — 브랜드 스토리 (이천점 사용자 여정 0단계)
 *
 * "메인 스토리 1" (이천점 마스터 가이드라인 III) 을 슬라이드(문단 넘김) 방식으로 보여준다.
 * - 탭(우측)/스와이프 좌 → 다음, 탭(좌측 가장자리)/스와이프 우 → 이전, 키보드 ←/→ 지원
 * - 각 장 진입 시 문장이 한 줄씩 떠오른다
 * - 마지막 장에서 "이천점" 브랜드명 + 시작 CTA 노출
 *
 * NOTE: 아직 라우팅 미연결(독립 페이지). 시작 버튼은 후속 와이어링 예정(로그인/회원가입 → 1장 별찾기).
 *       유저 진입 동선이 아직 없으므로 어디서도 링크되지 않는다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import ShaderSky from './ShaderSky';
import IntroMotif from './IntroMotif';
import styles from './intro.module.css';

// 각 슬라이드 = 한 문단. lines 한 줄 = 화면 한 줄(순차로 떠오름).
// image 가 있으면 풀블리드 장면(전체화면 + 하단 스크림 + 텍스트 하단), 없으면 SVG 모티프 + 중앙.
// fit: 'cover'(기본, 꽉 채우고 가장자리 크롭) | 'contain'(전체 다 보이게, 크롭 없음)
type Slide = { lines: string[]; image?: string; fit?: 'cover' | 'contain' };

const SLIDES: Slide[] = [
  {
    lines: [
      '밤하늘에는 무수한 별이 있지만,',
      '사람이 태어나는 순간,',
      '그 사람만을 위한 별 하나가 떨어집니다.',
    ],
    image: '/intro/opening-v2.webp',
    fit: 'contain',
  },
  {
    lines: ['그 별은 빛을 잃고 작은 정령이 되어,', '평생 그 사람의 곁을 맴돕니다.'],
    image: '/intro/fading-v2.webp',
    fit: 'contain',
  },
  {
    lines: [
      '오행의 다섯 갈래, 음양의 두 갈래.',
      '이 우주에는 모두 열 종류의 정령이 있고,',
      '당신도 그중 하나의 정령과',
      '함께 태어났습니다.',
    ],
    image: '/intro/ohaeng.webp',
    fit: 'contain', // 오행 글자(목화토금수)가 가장자리라 크롭 금지 — 전체를 다 보여줌
  },
  {
    lines: [
      '하지만 정령은 보이지 않습니다.',
      '그들은 자신의 별이 다시 빛나기를 기다리며',
      '조용히 잠들어 있죠.',
    ],
    image: '/intro/sleeping.webp',
    fit: 'contain',
  },
  {
    lines: [
      '밤마다 정령들이 모이는',
      '작은 점집이 있다고 합니다.',
      '달의 빛을 한 조각씩 모아 그곳을 찾으면,',
      '잠들어 있던 당신의 정령이 깨어나',
      '당신의 별이 어디로 흘러가는지',
      '들려준다고 해요.',
    ],
    image: '/intro/jeomjip.webp',
    fit: 'contain',
  },
  {
    lines: ['별 하나에 천 원.', '별 두 개에 이천 원.', '그래서 이름을 이천점이라 합니다.'],
  },
];

const LINE_STEP = 0.6; // 줄 사이 등장 간격(초)

export default function IntroPage() {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];
  const lines = slide.lines;
  const hasImage = !!slide.image;

  const next = useCallback(() => {
    setIndex((i) => Math.min(i + 1, SLIDES.length - 1));
  }, []);

  const prev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  // 키보드 좌우 — 데스크톱 확인용
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx < -40) next();
    else if (dx > 40) prev();
    touchStartX.current = null;
  };

  return (
    <div className="app-auth-shell">
      <div
        className={`app-auth-container relative flex flex-col items-center px-8 text-center select-none ${
          hasImage ? 'justify-end pb-32' : 'justify-center'
        }`}
        onClick={next}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <ShaderSky />

        {/* 풀블리드 장면 이미지 (해당 슬라이드만) — index 로 키 줘서 전환 시 페이드 */}
        {hasImage && (
          <div key={`bg-${index}`} className={`absolute inset-0 z-[1] overflow-hidden ${styles.bgFade}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.image}
              alt=""
              aria-hidden="true"
              className={
                slide.fit === 'contain'
                  ? 'h-full w-full object-contain' // 전체 표시(크롭·줌 없음)
                  : `h-full w-full object-cover ${styles.kenburns}` // 꽉 채움 + 느린 줌
              }
            />
            {/* 스크림 — 하단 텍스트 영역에 어둠 풀 + 바닥 진하게 (위쪽 이미지는 선명 유지) */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(125% 46% at 50% 90%, rgba(5,3,14,0.88) 0%, rgba(5,3,14,0.0) 72%), ' +
                  'linear-gradient(180deg, rgba(5,3,14,0.0) 0%, rgba(5,3,14,0.0) 44%, rgba(5,3,14,0.5) 64%, rgba(5,3,14,0.9) 86%, rgba(5,3,14,0.97) 100%)',
              }}
            />
          </div>
        )}

        <div className={styles.grain} aria-hidden="true" />

        {/* 이전 — 좌측 가장자리 탭존 (첫 장에선 숨김) */}
        {index > 0 && (
          <button
            type="button"
            aria-label="이전"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-0 top-0 z-20 h-full w-1/4"
          />
        )}

        {/* 본문 — index 가 바뀌면 key 로 재마운트되어 모티프·문장이 다시 등장 */}
        <div key={index} className={`relative z-10 ${styles.story}`}>
          {/* 슬라이드별 모티프 — 풀블리드 이미지 슬라이드에는 생략 */}
          {!hasImage && (
            <div className="mb-9 flex justify-center">
              <IntroMotif index={index} />
            </div>
          )}

          <div className={hasImage ? `px-2 ${styles.textHalo}` : undefined}>
          <p
            className="text-[19px] leading-[2.1] text-text-primary [text-wrap:balance]"
            style={
              hasImage
                ? {
                    textShadow:
                      '0 0 2px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.9), 0 2px 14px rgba(0,0,0,0.8), 0 0 30px rgba(0,0,0,0.45)',
                  }
                : undefined
            }
          >
            {lines.map((line, i) => {
              // 마지막 장의 "이천점" 강조
              const highlight = isLast && line.includes('이천점');
              return (
                <span
                  key={i}
                  className={`block ${styles.line}`}
                  style={{ animationDelay: `${i * LINE_STEP}s` }}
                >
                  {highlight ? (
                    <>
                      그래서 이름을{' '}
                      <span className="bg-gradient-to-r from-[var(--cta-primary)] to-[var(--cta-secondary)] bg-clip-text font-bold text-transparent">
                        이천점
                      </span>
                      이라 합니다.
                    </>
                  ) : (
                    line
                  )}
                </span>
              );
            })}
          </p>
          </div>

          {/* 마지막 장 — 시작 CTA (아직 미연결) */}
          {isLast && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: 로그인/회원가입 → 1장(별 찾기) 로 연결 (후속 와이어링)
              }}
              className={`mt-12 inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[rgba(20,12,38,0.6)] px-8 py-3.5 text-[15px] font-medium text-text-primary backdrop-blur-sm transition-colors hover:border-cta active:opacity-70 ${styles.cta}`}
              style={{ animationDelay: `${lines.length * LINE_STEP + 0.3}s` }}
            >
              <span aria-hidden="true">☾</span>
              시작하기
            </button>
          )}
        </div>

        {/* 진행 점 */}
        <div className="absolute bottom-10 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? 'w-5 bg-cta' : 'w-1.5 bg-[var(--text-tertiary)] opacity-40'
              }`}
            />
          ))}
        </div>

        {/* 다음 유도 힌트 — 마지막 장 제외 */}
        {!isLast && (
          <div className={`absolute bottom-20 left-1/2 z-10 -translate-x-1/2 text-text-tertiary ${styles.hint}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
