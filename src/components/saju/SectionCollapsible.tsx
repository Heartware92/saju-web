'use client';

/**
 * 운세 결과 섹션 — 펼침/접힘 + 우주 컨셉 애니메이션 (Starlight Bloom + Nebula Expand)
 *
 * - 헤더: 좌측 cta bar + 섹션 타이틀 + 우측 chevron (180° 회전)
 * - 본문: 은유 부제목 + children
 * - 펼침 시 카드 외곽이 자수정 빛으로 0.7초간 짧게 빛났다 사라짐 (별빛 발광)
 * - 본문은 위에서 살짝 떨어지면서 미세하게 부풀어오르며 등장 (성운 확산)
 */

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  /** 섹션 타이틀 (예: "총운", "재물운") */
  title: string;
  /** 은유 부제목 (예: "별이 빛나는 밤") */
  metaphorTitle?: string;
  /** 본문 컨텐츠 */
  children: ReactNode;
  /** 디폴트 펼침 여부 (첫 섹션만 true) */
  defaultOpen?: boolean;
  /** 진입 stagger delay (옵션) */
  enterDelay?: number;
}

// 우주적 ease — 부드럽게 가속/감속
const COSMIC_EASE = [0.16, 1, 0.3, 1] as const;

export function SectionCollapsible({
  title,
  metaphorTitle,
  children,
  defaultOpen = false,
  enterDelay = 0,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  // 카드 외곽 starlight bloom — 펼침 트리거마다 keyframe 으로 잠시 빛남
  const bloomShadow = open
    ? [
        '0 0 0 0 rgba(168,139,250,0)',
        '0 0 26px 4px rgba(168,139,250,0.42)',
        '0 0 0 0 rgba(168,139,250,0)',
      ]
    : '0 0 0 0 rgba(168,139,250,0)';

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
        boxShadow: { duration: 0.75, ease: 'easeOut', times: [0, 0.45, 1] },
      }}
      className="rounded-2xl bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] overflow-hidden"
    >
      {/* 헤더 — 클릭으로 토글 */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="inline-block w-1 h-5 rounded-full bg-cta shrink-0" />
        <div
          className="flex-1 text-[17px] font-bold text-text-primary tracking-tight"
          style={{ fontFamily: 'var(--font-title)' }}
        >
          {title}
        </div>
        <motion.svg
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.35, ease: COSMIC_EASE }}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-tertiary shrink-0"
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>

      {/* 본문 — 펼침 시 성운 확산 */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.45, ease: COSMIC_EASE },
              opacity: { duration: 0.3, ease: 'easeOut' },
            }}
            style={{ overflow: 'hidden' }}
          >
            <motion.div
              initial={{ y: -10, scale: 0.992 }}
              animate={{ y: 0, scale: 1 }}
              transition={{
                duration: 0.5,
                delay: 0.05,
                ease: COSMIC_EASE,
              }}
              className="px-5 pb-5"
            >
              {metaphorTitle && (
                <div
                  className="text-[17px] font-bold leading-snug text-cta/90 mb-4 pl-3"
                  style={{ fontFamily: 'var(--font-title)' }}
                >
                  {metaphorTitle}
                </div>
              )}
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
