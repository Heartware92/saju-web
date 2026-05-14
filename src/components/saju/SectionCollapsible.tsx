'use client';

/**
 * 운세 결과 섹션 — 펼침/접힘 + 우주 컨셉 화려한 애니메이션
 *
 * 효과 (Cosmic Burst):
 *  1) Sparkle Burst — 헤더 chevron 주변에서 6개의 별빛 입자가 사방으로 흩어짐
 *  2) Aurora Sweep — 카드 우상단에서 자수정 라디얼 그라데이션이 빠르게 쓸려 지나감
 *  3) Starlight Bloom — 카드 외곽 자수정+피치 듀얼 box-shadow 가 부풀었다 사라짐
 *  4) Nebula Expand — 본문이 height 0→auto + scale 0.92→1.005→1 + y -14→0 (살짝 overshoot)
 *  5) CTA Bar Flash — 좌측 cta 바가 피치→크림→피치로 짧게 빛남
 *  6) Chevron Pulse — chevron 이 180° 회전 + scale 1→1.2→1 펄스
 */

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  title: string;
  metaphorTitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  enterDelay?: number;
  /** 좌측 cta 바 색상 — 기본 #e8a490 (피치). 특정 섹션에서 emerald/red 사용 시 override */
  barColor?: string;
  /** Bar pulse 시 mid 색상 — 기본 크림 (#fce8b2) */
  barPulseColor?: string;
  /** 카드 외곽 테두리 색상 — 미지정 시 기본 var(--border-subtle). 시도/피하기처럼 강한 시그널 필요 시 override */
  borderColor?: string;
}

const COSMIC_EASE = [0.16, 1, 0.3, 1] as const;
const BOUNCE_EASE = [0.34, 1.4, 0.64, 1] as const; // 약한 overshoot — 살짝 튀는 느낌

// Chevron 주변에서 사방으로 흩어지는 별빛 입자
const SPARKLE_DIRS = [
  { x: -38, y: -14, delay: 0.00, size: 11 },
  { x: -28, y: 18, delay: 0.04, size: 9 },
  { x: 18, y: -20, delay: 0.08, size: 12 },
  { x: 32, y: 10, delay: 0.10, size: 8 },
  { x: 4, y: -28, delay: 0.06, size: 10 },
  { x: -8, y: 28, delay: 0.12, size: 9 },
];

function SparkleBurst() {
  return (
    <div
      className="absolute right-12 top-1/2 pointer-events-none z-10"
      style={{ transform: 'translateY(-50%)' }}
      aria-hidden
    >
      {SPARKLE_DIRS.map((s, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            scale: [0, 1.4, 1, 0],
            x: s.x,
            y: s.y,
          }}
          transition={{
            duration: 0.85,
            delay: s.delay,
            ease: 'easeOut',
            times: [0, 0.25, 0.6, 1],
          }}
          className="absolute font-bold"
          style={{
            fontSize: s.size,
            color: i % 2 === 0 ? '#FCE8B2' : '#C9A6FF',
            textShadow: i % 2 === 0
              ? '0 0 8px rgba(252,232,178,0.8)'
              : '0 0 8px rgba(201,166,255,0.8)',
            top: 0,
            left: 0,
          }}
        >
          ✦
        </motion.span>
      ))}
    </div>
  );
}

export function SectionCollapsible({
  title,
  metaphorTitle,
  children,
  defaultOpen = false,
  enterDelay = 0,
  barColor = '#e8a490',
  barPulseColor = '#fce8b2',
  borderColor,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [burstKey, setBurstKey] = useState(0);

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    setOpen((prev) => {
      if (!prev) setBurstKey((k) => k + 1);
      return !prev;
    });
    // Android Chrome / Samsung Internet 은 탭 후 :hover / :focus 가 유지되어
    // 헤더 배경 틴트가 남아있고 본문과 경계처럼 보이는 사고가 있음. 즉시 blur 하여 해제.
    e.currentTarget.blur();
  };

  // Starlight Bloom — 듀얼 box-shadow (라일락 + 피치) 키프레임
  const bloomShadow = open
    ? [
        '0 0 0 0 rgba(168,139,250,0), 0 0 0 0 rgba(232,164,144,0)',
        '0 0 50px 12px rgba(168,139,250,0.55), 0 0 100px 24px rgba(232,164,144,0.30)',
        '0 0 20px 4px rgba(168,139,250,0.20), 0 0 40px 8px rgba(232,164,144,0.10)',
        '0 0 0 0 rgba(168,139,250,0), 0 0 0 0 rgba(232,164,144,0)',
      ]
    : '0 0 0 0 rgba(168,139,250,0), 0 0 0 0 rgba(232,164,144,0)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow: bloomShadow,
      }}
      transition={{
        opacity: { duration: 0.4, delay: enterDelay },
        y: { duration: 0.4, delay: enterDelay },
        boxShadow: { duration: 1.1, ease: 'easeOut', times: [0, 0.35, 0.65, 1] },
      }}
      className="relative rounded-2xl bg-[rgba(20,12,38,0.55)] border overflow-hidden"
      style={{ borderColor: borderColor ?? 'var(--border-subtle)' }}
    >
      {/* Aurora Sweep — 펼침 시 카드 우상단에서 자수정 빛이 쓸려 지나감 */}
      <AnimatePresence>
        {open && (
          <motion.div
            key={`sweep-${burstKey}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0.3, 0] }}
            transition={{ duration: 1.0, ease: 'easeOut', times: [0, 0.3, 0.6, 1] }}
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              background:
                'radial-gradient(ellipse 70% 60% at 85% -5%, rgba(168,139,250,0.45) 0%, rgba(232,164,144,0.18) 35%, transparent 70%)',
            }}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* 헤더 */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        // Android 탭 후 hover/focus 잔존 이슈 차단:
        //  - WebkitTapHighlightColor: transparent → 탭 시 회색 박스 깜빡임 제거
        //  - [@media(hover:hover)]:hover — 실제 hover 가능한 디바이스에서만 hover 배경 적용
        //  - focus-visible 만 outline 표시 (키보드 접근성 유지)
        style={{ WebkitTapHighlightColor: 'transparent' }}
        className="relative w-full flex items-center gap-2 px-5 py-4 text-left [@media(hover:hover)]:hover:bg-white/[0.03] transition-colors z-10 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-cta/40"
      >
        {/* CTA Bar — 펼침 시 base→pulse→base 컬러 펄스 */}
        <motion.span
          animate={
            open
              ? {
                  backgroundColor: [barColor, barPulseColor, barColor],
                  boxShadow: [
                    '0 0 0 rgba(252,232,178,0)',
                    '0 0 12px rgba(252,232,178,0.8)',
                    '0 0 0 rgba(252,232,178,0)',
                  ],
                }
              : { backgroundColor: barColor, boxShadow: '0 0 0 rgba(252,232,178,0)' }
          }
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="inline-block w-1 h-5 rounded-full shrink-0"
        />
        <div
          className="flex-1 text-[17px] font-bold text-text-primary tracking-tight"
          style={{ fontFamily: 'var(--font-title)' }}
        >
          {title}
        </div>

        {/* Sparkle Burst — 펼침 트리거마다 chevron 주변 별빛 분출 */}
        <div className="relative shrink-0">
          <AnimatePresence>
            {open && <SparkleBurst key={`spk-${burstKey}`} />}
          </AnimatePresence>

          {/* Chevron — 180° 회전 + scale 펄스 */}
          <motion.svg
            animate={
              open
                ? { rotate: 180, scale: [1, 1.3, 1] }
                : { rotate: 0, scale: 1 }
            }
            transition={{
              rotate: { duration: 0.4, ease: COSMIC_EASE },
              scale: { duration: 0.5, ease: 'easeOut' },
            }}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-text-tertiary"
            aria-hidden
          >
            <polyline points="6 9 12 15 18 9" />
          </motion.svg>
        </div>
      </button>

      {/* Nebula Expand — 본문 펼침 */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.55, ease: COSMIC_EASE },
              opacity: { duration: 0.4, ease: 'easeOut' },
            }}
            style={{ overflow: 'hidden' }}
            className="relative z-10"
          >
            <motion.div
              initial={{ y: -16, scale: 0.92, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{
                y: { duration: 0.55, delay: 0.08, ease: BOUNCE_EASE },
                scale: { duration: 0.55, delay: 0.08, ease: BOUNCE_EASE },
                opacity: { duration: 0.4, delay: 0.1, ease: 'easeOut' },
              }}
              className="px-5 pb-5"
            >
              {metaphorTitle && (
                <motion.div
                  initial={{ opacity: 0, letterSpacing: '0.2em' }}
                  animate={{ opacity: 1, letterSpacing: '0.04em' }}
                  transition={{ duration: 0.6, delay: 0.15, ease: COSMIC_EASE }}
                  className="text-[17px] font-bold leading-snug text-cta/90 mb-4 pl-3"
                  style={{ fontFamily: 'var(--font-title)' }}
                >
                  {metaphorTitle}
                </motion.div>
              )}
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
