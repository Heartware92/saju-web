'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SpinningEarth } from './SpinningEarth';

interface AILoadingBarProps {
  label: string;
  minLabel: string;   // e.g. "30초"
  maxLabel: string;   // e.g. "1분 30초"
  estimatedSeconds: number;
  messages: string[];
  topContent?: React.ReactNode;
  // inline 모드: 카드 안에 삽입 (full-screen이 아닌 경우)
  inline?: boolean;
  /**
   * 잡 시작 시각 (ISO timestamp). 페이지 새로고침·재진입 시 mount 시점이 아닌
   * 실제 잡 시작부터의 경과를 반영한 progress 로 시작.
   * 백그라운드 잡 시스템(saju_records.started_at) 과 연결.
   */
  startedAt?: string | null;
}

// 비대칭 점근선: estimatedSeconds 시점에서 ~86% 도달, 이후 천천히 92%로 수렴
// progress(t) = 92 * (1 - exp(-k*t)),  k = 2/estimatedSeconds
function progressFromElapsed(elapsedSec: number, estimatedSeconds: number): number {
  const k = 2 / estimatedSeconds;
  return Math.min(92, 92 * (1 - Math.exp(-k * Math.max(0, elapsedSec))));
}

export function AILoadingBar({
  label,
  minLabel,
  maxLabel,
  estimatedSeconds,
  messages,
  topContent,
  inline = false,
  startedAt,
}: AILoadingBarProps) {
  const [progress, setProgress] = useState<number>(() => {
    if (!startedAt) return 0;
    const elapsedSec = (Date.now() - new Date(startedAt).getTime()) / 1000;
    return progressFromElapsed(elapsedSec, estimatedSeconds);
  });
  const [msgIdx, setMsgIdx] = useState(0);

  // startedAt prop 늦게 도착(useFortuneJob select 결과)했을 때 즉시 보정.
  useEffect(() => {
    if (!startedAt) return;
    const elapsedSec = (Date.now() - new Date(startedAt).getTime()) / 1000;
    setProgress(progressFromElapsed(elapsedSec, estimatedSeconds));
  }, [startedAt, estimatedSeconds]);

  // 진행 timer.
  //   startedAt 있음: 매 tick 실제 elapsed 기반 재계산 → 새로고침해도 정확한 %
  //   startedAt 없음: mount 시점 기준 점근선 (기존 동작 — 새 잡 처음 생성 등)
  useEffect(() => {
    const k = 2 / estimatedSeconds;
    const timer = setInterval(() => {
      if (startedAt) {
        const elapsedSec = (Date.now() - new Date(startedAt).getTime()) / 1000;
        setProgress(progressFromElapsed(elapsedSec, estimatedSeconds));
      } else {
        setProgress(p => Math.min(92, p + (92 - p) * k * 0.5));
      }
    }, 500);
    return () => clearInterval(timer);
  }, [estimatedSeconds, startedAt]);

  // 분석 메시지 순환
  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIdx(i => (i + 1) % messages.length);
    }, 2800);
    return () => clearInterval(timer);
  }, [messages.length]);

  const rounded = Math.round(progress);

  if (inline) {
    return (
      <div className="py-4 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="text-[15px] font-semibold text-text-primary">{label}</span>
          <span className="text-[13px] text-text-tertiary">{rounded}%</span>
        </div>

        {/* 게이지 바 */}
        <div className="w-full bg-white/10 rounded-full h-[3px] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, var(--color-cta, #8B6914) 0%, color-mix(in srgb, var(--color-cta, #C9963B) 70%, white) 100%)',
            }}
            transition={{ duration: 0.5, ease: 'linear' }}
          />
        </div>

        <div className="flex justify-between items-center">
          {/* 회전 메시지 */}
          <div className="h-[18px] overflow-hidden flex-1">
            <AnimatePresence mode="wait">
              <motion.span
                key={msgIdx}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.35 }}
                className="block text-[13px] text-text-tertiary"
              >
                {messages[msgIdx]}
              </motion.span>
            </AnimatePresence>
          </div>
          <span className="text-[12px] text-text-tertiary/60 ml-2 shrink-0">
            약 {minLabel}~{maxLabel}
          </span>
        </div>
      </div>
    );
  }

  // ── Full-screen 버전 ──────────────────────────────────
  // Layout 안에 자연스럽게 들어감 — Layout 헤더(이천점/잔액/햄버거) + 하단 탭바 유지.
  // main 영역(flex-1, overflow-y-auto) 안에서 컨텐츠가 viewport 가용 영역 안에 맞도록 설계.
  //
  // 레이아웃:
  //  - 상단 영역(topContent + 타이틀 + 진행바 + 메시지)은 위쪽에 자연 배치
  //  - 행성은 flex-1 로 남은 공간 차지
  //  - main 영역 안에서 자연스럽게 fit (Layout 헤더 48px + 탭바 64px 제외한 영역)
  //  - 행성 transform: scale 로 짧은 뷰포트 자동 축소
  return (
    <div className="w-full flex flex-col items-center px-6 pt-6 pb-4 gap-4" style={{ minHeight: 'calc(100dvh - 48px - 64px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))' }}>
      {/* 상단 영역 — topContent + 타이틀 + 진행바 + 메시지 */}
      <div className="w-full flex flex-col items-center gap-3.5 flex-shrink-0">
        {/* 상단 컨텐츠 (연도·일주 등) */}
        {topContent && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            {topContent}
          </motion.div>
        )}

        <div className="w-full max-w-[300px] flex flex-col gap-3">
          {/* 타이틀 */}
          <div className="text-center">
            <div className="text-[17px] font-semibold text-text-primary mb-1">{label}</div>
            <div className="text-[13px] text-text-tertiary">
              정확한 풀이를 위해 시간이 필요합니다
            </div>
          </div>

          {/* 게이지 바 */}
          <div className="flex flex-col gap-2">
            <div className="w-full bg-white/10 rounded-full h-[4px] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, var(--color-cta, #8B6914) 0%, color-mix(in srgb, var(--color-cta, #C9963B) 60%, white) 100%)',
                }}
                transition={{ duration: 0.5, ease: 'linear' }}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-text-tertiary font-medium">{rounded}%</span>
              <span className="text-[12px] text-text-tertiary">
                약 {minLabel} ~ {maxLabel}
              </span>
            </div>
          </div>

          {/* 회전 분석 메시지 */}
          <div className="h-[20px] overflow-hidden flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={msgIdx}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.4 }}
                className="text-[13px] text-text-tertiary text-center"
              >
                {messages[msgIdx]}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 코스믹 행성 — 남은 공간 가운데. Layout 유지하면서 가용 영역 안에 fit */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 min-h-0 w-full flex items-center justify-center"
      >
        <div
          style={{
            // 380px 기준, transform: scale 로 반응형
            // 상한 0.55 — Layout(헤더+탭바) 안에서 텍스트 영역 양보
            // 60vw / 32vh — 짧은 뷰포트도 텍스트 안 침범
            transform: 'scale(min(0.55, calc(60vw / 380), calc(32vh / 380)))',
            transformOrigin: 'center',
          }}
        >
          <SpinningEarth size={380} />
        </div>
      </motion.div>
    </div>
  );
}
