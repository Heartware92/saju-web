'use client';

/**
 * 평생 운세 흐름 그래프 (1~99세)
 *
 * UX/UI:
 *  - 가로 스크롤, 마운트 시 현재 만나이 자동 위치
 *  - 차트 클릭/터치 → 가장 가까운 나이 선택
 *  - 부드러운 곡선 (Catmull-Rom smoothing)
 *  - 점수대별 색상 그라데이션 stroke
 *  - 대운 segment 배경 band
 *  - 인생 최고/최저 자동 추출 + 빠른 점프 버튼
 *  - 폰트/자간: 본문은 SUIT + 0.14em, 타이틀은 마루부리
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  computeLifetimeFortune,
  getCurrentAge,
  type LifetimePoint,
  type LifetimeGrade,
} from '@/utils/lifetimeFortune';
import type { SajuResult } from '@/utils/sajuCalculator';

interface Props {
  saju: SajuResult;
}

const GRADE_COLOR: Record<LifetimeGrade, string> = {
  '대길': '#34D399',
  '길': '#86EFAC',
  '중길': '#FBBF24',
  '평': '#CBD5E1',
  '중흉': '#FB923C',
  '흉': '#F87171',
};

// ── 차트 차원 ──
const PX_PER_YEAR = 20;
const W = 99 * PX_PER_YEAR + 64;
const H = 240;
const PAD_L = 40;
const PAD_R = 28;
const PAD_T = 24;
const PAD_B = 50;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const AGE_MIN = 1;
const AGE_MAX = 99;
const Y_MAX = 100;
const xOf = (age: number) => PAD_L + ((age - AGE_MIN) / (AGE_MAX - AGE_MIN)) * PLOT_W;
const makeYOf = (yMin: number) => (score: number) =>
  PAD_T + (1 - (Math.max(yMin, Math.min(Y_MAX, score)) - yMin) / (Y_MAX - yMin)) * PLOT_H;

// Catmull-Rom → Bezier 변환으로 곡선을 부드럽게
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  const segs: string[] = [`M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t = 0.5; // tension
    const c1x = p1.x + ((p2.x - p0.x) / 6) * t;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * t;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * t;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * t;
    segs.push(`C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`);
  }
  return segs.join(' ');
}

export function LifetimeFortuneChart({ saju }: Props) {
  const points = useMemo(() => computeLifetimeFortune(saju, 99), [saju]);
  const currentAge = useMemo(() => getCurrentAge(saju), [saju]);

  // Y축 적응형 — 데이터 최저점 기준 가까운 10단위 내림. 최소 0, 최대 50.
  const yMin = useMemo(() => {
    if (!points.length) return 20;
    const minScore = Math.min(...points.map((p) => p.score));
    return Math.max(0, Math.min(50, Math.floor((minScore - 5) / 10) * 10));
  }, [points]);
  const yOf = useMemo(() => makeYOf(yMin), [yMin]);

  const [selectedAge, setSelectedAge] = useState<number>(currentAge);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 마운트 시 현재 나이가 중앙에 오도록 스크롤
  useEffect(() => {
    if (!scrollRef.current) return;
    const targetX = xOf(currentAge);
    const containerW = scrollRef.current.clientWidth;
    const svgEl = scrollRef.current.querySelector('svg');
    const renderedW = svgEl?.getBoundingClientRect().width ?? W;
    const ratio = renderedW / W;
    scrollRef.current.scrollLeft = Math.max(0, targetX * ratio - containerW / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 빠른 점프 — 부드럽게 스크롤
  const scrollToAge = (age: number) => {
    if (!scrollRef.current) return;
    const svgEl = scrollRef.current.querySelector('svg');
    const renderedW = svgEl?.getBoundingClientRect().width ?? W;
    const ratio = renderedW / W;
    const targetX = xOf(age) * ratio - scrollRef.current.clientWidth / 2;
    scrollRef.current.scrollTo({ left: Math.max(0, targetX), behavior: 'smooth' });
    setSelectedAge(age);
  };

  if (!points.length) return null;

  // 곡선 + 영역
  const smoothPts = points.map((p) => ({ x: xOf(p.age), y: yOf(p.score) }));
  const linePath = smoothPath(smoothPts);
  const lastX = smoothPts[smoothPts.length - 1].x.toFixed(1);
  const firstX = smoothPts[0].x.toFixed(1);
  const baseY = (PAD_T + PLOT_H).toFixed(1);
  const areaPath = `${linePath} L${lastX},${baseY} L${firstX},${baseY} Z`;

  const daewoonStarts = points.filter((p) => p.isDaewoonStart);

  // 대운 segment band
  const daewoonBands = daewoonStarts.map((start, idx) => {
    const nextStart = daewoonStarts[idx + 1];
    const endAge = nextStart ? nextStart.age - 1 : AGE_MAX;
    return {
      key: `band-${start.age}`,
      x1: xOf(start.age),
      x2: xOf(endAge + 0.5),
      label: start.daewoonGanZhi,
      midAge: Math.floor((start.age + endAge) / 2),
      tinted: idx % 2 === 0, // 짝홀로 색 교차
    };
  });

  const selectedPoint = points.find((p) => p.age === selectedAge);
  const currentPoint = points.find((p) => p.age === currentAge);

  const avgScore = Math.round(points.reduce((s, p) => s + p.score, 0) / points.length);

  // 인생 최고/최저 추출 (현재 나이 이전 / 이후 구분 없이 전체에서 1개씩)
  const best = points.reduce((a, b) => (b.score > a.score ? b : a));
  const worst = points.reduce((a, b) => (b.score < a.score ? b : a));

  // Y축 눈금 — yMin 기준 동적 (3~4단계)
  const yTicks = useMemo(() => {
    const mid = Math.round((yMin + Y_MAX) / 2);
    return [yMin, mid, Y_MAX];
  }, [yMin]);
  const xTicks = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99];

  const handlePointer = (clientX: number, target: SVGSVGElement) => {
    const rect = target.getBoundingClientRect();
    const localX = clientX - rect.left;
    const scale = W / rect.width;
    const svgX = localX * scale;
    const age = Math.round(((svgX - PAD_L) / PLOT_W) * (AGE_MAX - AGE_MIN)) + AGE_MIN;
    if (age >= AGE_MIN && age <= AGE_MAX) setSelectedAge(age);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1 h-5 rounded-full bg-cta" />
          <div
            className="text-[17px] font-bold text-text-primary tracking-tight"
            style={{ fontFamily: 'var(--font-title)' }}
          >
            평생 운세 흐름
          </div>
        </div>
        <div
          className="text-[13.5px] text-text-tertiary"
          style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.04em' }}
        >
          평균 <span className="text-text-secondary font-semibold">{avgScore}</span>점
        </div>
      </div>

      <p
        className="text-[15.5px] text-text-secondary mb-3 pl-3 leading-[1.75]"
        style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.04em' }}
      >
        1세부터 99세까지 종합 운세 점수예요. 대운(10년 주기)·세운(연 단위)의 천간·지지가 원국과
        어떻게 상호작용하는지 점수화한 결과로, 차트를 좌우로 밀거나 원하는 나이를 탭하면 상세
        정보가 표시돼요.
      </p>

      {/* 선택된 나이 — 2층 카드 */}
      {selectedPoint && (
        <div className="mb-4 rounded-xl px-4 py-3 bg-[rgba(124,92,252,0.10)] border border-[rgba(124,92,252,0.32)]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-baseline gap-2">
              <span
                className="text-[24px] font-bold text-text-primary"
                style={{ fontFamily: 'var(--font-title)' }}
              >
                {selectedPoint.age}세
              </span>
              <span
                className="text-[13px] text-text-tertiary"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {selectedPoint.year}년
              </span>
              {selectedPoint.age === currentAge && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-cta/20 text-cta font-semibold">
                  현재
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-[28px] font-bold leading-none"
                style={{ color: GRADE_COLOR[selectedPoint.grade] }}
              >
                {selectedPoint.score}
              </span>
              <span className="text-[12px] text-text-tertiary">점</span>
              <span
                className="text-[14px] font-bold ml-1"
                style={{ color: GRADE_COLOR[selectedPoint.grade] }}
              >
                · {selectedPoint.grade}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2 border-t border-[rgba(124,92,252,0.18)]">
            {selectedPoint.daewoonGanZhi && (
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-[12px] text-text-tertiary"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  대운
                </span>
                <span
                  className="text-[16px] font-bold text-text-primary"
                  style={{ fontFamily: 'var(--font-title)' }}
                >
                  {selectedPoint.daewoonGanZhi}
                </span>
              </div>
            )}
            {selectedPoint.sewoonGanZhi && (
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-[12px] text-text-tertiary"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  세운
                </span>
                <span
                  className="text-[16px] font-bold text-text-primary"
                  style={{ fontFamily: 'var(--font-title)' }}
                >
                  {selectedPoint.sewoonGanZhi}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 빠른 점프 버튼 — 가운데 정렬 */}
      <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
        {currentPoint && (
          <button
            type="button"
            onClick={() => scrollToAge(currentAge)}
            className="px-3 py-1.5 rounded-full text-[13px] bg-cta/20 border border-cta/50 text-cta font-semibold hover:bg-cta/30 transition-all"
            style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.02em' }}
          >
            현재 {currentAge}세
          </button>
        )}
        <button
          type="button"
          onClick={() => scrollToAge(best.age)}
          className="px-3 py-1.5 rounded-full text-[13px] bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-semibold hover:bg-emerald-500/30 transition-all"
          style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.02em' }}
        >
          최고 {best.age}세 ({best.score})
        </button>
        <button
          type="button"
          onClick={() => scrollToAge(worst.age)}
          className="px-3 py-1.5 rounded-full text-[13px] bg-red-500/20 border border-red-500/50 text-red-300 font-semibold hover:bg-red-500/30 transition-all"
          style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.02em' }}
        >
          주의 {worst.age}세 ({worst.score})
        </button>
      </div>

      {/* 가로 스크롤 SVG */}
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden -mx-2"
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          style={{ display: 'block', minWidth: W, height: H }}
          onClick={(e) => handlePointer(e.clientX, e.currentTarget)}
          onTouchStart={(e) => {
            if (e.touches[0]) handlePointer(e.touches[0].clientX, e.currentTarget);
          }}
        >
          <defs>
            <linearGradient id="lifeFortuneFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.50" />
              <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
            </linearGradient>
            {/* 점수대별 색 그라데이션 — 위는 초록, 중간 노랑, 아래 빨강 */}
            <linearGradient id="lifeLineStroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="35%" stopColor="#86EFAC" />
              <stop offset="55%" stopColor="#FBBF24" />
              <stop offset="80%" stopColor="#FB923C" />
              <stop offset="100%" stopColor="#F87171" />
            </linearGradient>
          </defs>

          {/* 대운 segment 배경 band */}
          {daewoonBands.map((b) =>
            b.tinted ? (
              <rect
                key={b.key}
                x={b.x1}
                y={PAD_T}
                width={Math.max(0, b.x2 - b.x1)}
                height={PLOT_H}
                fill="rgba(168,139,250,0.04)"
              />
            ) : null,
          )}

          {/* Y 보조선 + 라벨 */}
          {yTicks.map((t) => (
            <g key={`yt-${t}`}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={yOf(t)}
                y2={yOf(t)}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
                strokeDasharray={t === 50 ? '0' : '2 4'}
              />
              <text
                x={PAD_L - 8}
                y={yOf(t) + 4}
                textAnchor="end"
                fontSize="12"
                fill="rgba(255,255,255,0.55)"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {t}
              </text>
            </g>
          ))}

          {/* 대운 전환 세로선 + 간지 라벨 */}
          {daewoonStarts.map((p) => (
            <g key={`dw-${p.age}`}>
              <line
                x1={xOf(p.age)}
                x2={xOf(p.age)}
                y1={PAD_T}
                y2={PAD_T + PLOT_H}
                stroke="rgba(168,139,250,0.28)"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              <text
                x={xOf(p.age)}
                y={PAD_T + PLOT_H + 32}
                textAnchor="middle"
                fontSize="12"
                fill="rgba(168,139,250,0.85)"
                style={{ fontFamily: 'var(--font-title)' }}
              >
                {p.daewoonGanZhi}
              </text>
            </g>
          ))}

          {/* 에어리어 fill */}
          <path d={areaPath} fill="url(#lifeFortuneFill)" />

          {/* 메인 라인 — 점수대별 색 그라데이션 */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#lifeLineStroke)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X축 라벨 (나이) */}
          {xTicks.map((age) => (
            <text
              key={`xt-${age}`}
              x={xOf(age)}
              y={PAD_T + PLOT_H + 16}
              textAnchor="middle"
              fontSize="12.5"
              fill="rgba(255,255,255,0.55)"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {age}
            </text>
          ))}

          {/* 현재 만나이 — 회색 작은 dot */}
          {currentPoint && currentAge !== selectedAge && (
            <circle
              cx={xOf(currentPoint.age)}
              cy={yOf(currentPoint.score)}
              r="3.5"
              fill="rgba(255,255,255,0.55)"
              stroke="#1C1033"
              strokeWidth="1.5"
            />
          )}

          {/* 선택된 나이 강조 */}
          {selectedPoint && (
            <g>
              <line
                x1={xOf(selectedPoint.age)}
                x2={xOf(selectedPoint.age)}
                y1={PAD_T}
                y2={PAD_T + PLOT_H}
                stroke={GRADE_COLOR[selectedPoint.grade]}
                strokeWidth="1.4"
                strokeDasharray="3 3"
                opacity="0.6"
              />
              <circle
                cx={xOf(selectedPoint.age)}
                cy={yOf(selectedPoint.score)}
                r="6.5"
                fill={GRADE_COLOR[selectedPoint.grade]}
                stroke="#1C1033"
                strokeWidth="2"
              />
              <rect
                x={xOf(selectedPoint.age) - 30}
                y={yOf(selectedPoint.score) - 24}
                width="60"
                height="16"
                rx="3"
                fill="rgba(15,9,32,0.92)"
                stroke={GRADE_COLOR[selectedPoint.grade]}
                strokeWidth="0.8"
              />
              <text
                x={xOf(selectedPoint.age)}
                y={yOf(selectedPoint.score) - 13}
                textAnchor="middle"
                fontSize="11.5"
                fontWeight="700"
                fill={GRADE_COLOR[selectedPoint.grade]}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {selectedPoint.age}세 · {selectedPoint.score}점
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* 점수 색상 가이드 — 그라데이션이 점수 등급을 나타냄을 명시 */}
      <div
        className="flex items-center justify-center gap-2 mt-4 mb-1"
        style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.03em' }}
      >
        <span className="text-[12.5px] font-semibold" style={{ color: '#F87171' }}>
          흉
        </span>
        <svg width="120" height="10" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="legendGrade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#F87171" />
              <stop offset="25%" stopColor="#FB923C" />
              <stop offset="50%" stopColor="#FBBF24" />
              <stop offset="75%" stopColor="#86EFAC" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>
          </defs>
          <rect width="120" height="10" rx="3" fill="url(#legendGrade)" />
        </svg>
        <span className="text-[12.5px] font-semibold" style={{ color: '#34D399' }}>
          대길
        </span>
        <span className="text-[12px] ml-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
          ← 점수 등급
        </span>
      </div>

      {/* 범례 — 대운 / 현재 */}
      <div
        className="flex items-center justify-center gap-4 mt-2 flex-wrap"
        style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.03em' }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm border"
            style={{
              background: 'rgba(168,139,250,0.20)',
              borderColor: 'rgba(168,139,250,0.55)',
            }}
          />
          <span className="text-[13.5px] font-medium" style={{ color: '#C4B5FD' }}>
            대운 (10년 주기)
          </span>
        </div>
        {currentPoint && (
          <div className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full border"
              style={{
                background: '#FFFFFF',
                borderColor: 'rgba(255,255,255,0.8)',
              }}
            />
            <span className="text-[13.5px] font-medium text-text-primary">
              현재 {currentAge}세
            </span>
          </div>
        )}
      </div>

      <p
        className="text-[13px] mt-3 text-center"
        style={{
          fontFamily: 'var(--font-body)',
          letterSpacing: '0.04em',
          color: 'rgba(255,255,255,0.65)',
        }}
      >
        좌우로 밀어보세요 · 원하는 나이를 탭하면 상세 정보가 표시돼요
      </p>
    </motion.div>
  );
}
