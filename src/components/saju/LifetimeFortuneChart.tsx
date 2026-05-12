'use client';

/**
 * 평생 운세 흐름 그래프 (1~99세)
 *
 * - 가로 스크롤 가능 (모바일에서 한 화면에 ~30년 정도)
 * - 마운트 시 현재 만나이 위치로 자동 스크롤
 * - 차트 클릭/터치 → 가장 가까운 나이 선택 → 상단에 상세 정보 표시
 * - 대운 전환점 세로 점선, 현재 나이는 별도 표시 (선택과 분리)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  computeLifetimeFortune,
  getCurrentAge,
  type LifetimePoint,
} from '@/utils/lifetimeFortune';
import type { SajuResult } from '@/utils/sajuCalculator';
import type { FortuneGrade } from '@/engine/periodFortune';

interface Props {
  saju: SajuResult;
}

const GRADE_COLOR: Record<FortuneGrade, string> = {
  '대길': '#34D399',
  '길': '#86EFAC',
  '중길': '#FBBF24',
  '평': '#CBD5E1',
  '중흉': '#FB923C',
  '흉': '#F87171',
};

// 차트 크기 — 한 살당 18px → 99세 ≈ 1800px (가로 스크롤로 전체 노출)
const PX_PER_YEAR = 18;
const W = 99 * PX_PER_YEAR + 60; // 좌우 여백 포함
const H = 220;
const PAD_L = 36;
const PAD_R = 24;
const PAD_T = 20;
const PAD_B = 36;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const AGE_MIN = 1;
const AGE_MAX = 99;
const xOf = (age: number) => PAD_L + ((age - AGE_MIN) / (AGE_MAX - AGE_MIN)) * PLOT_W;
const yOf = (score: number) => PAD_T + (1 - score / 100) * PLOT_H;

export function LifetimeFortuneChart({ saju }: Props) {
  const points = useMemo(() => computeLifetimeFortune(saju, 99), [saju]);
  const currentAge = useMemo(() => getCurrentAge(saju), [saju]);

  const [selectedAge, setSelectedAge] = useState<number>(currentAge);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 마운트 시 현재 나이가 가운데 보이도록 스크롤
  useEffect(() => {
    if (!scrollRef.current) return;
    const targetX = xOf(currentAge);
    const containerW = scrollRef.current.clientWidth;
    // SVG 는 100% width 가 아닌 고정 W 크기 — 실제 렌더링은 동일 비율
    // 하지만 viewBox 매핑이라 ratio 적용해야 함
    const svgEl = scrollRef.current.querySelector('svg');
    const renderedW = svgEl?.getBoundingClientRect().width ?? W;
    const ratio = renderedW / W;
    scrollRef.current.scrollLeft = Math.max(0, targetX * ratio - containerW / 2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!points.length) return null;

  // 라인 / 에어리어
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.age).toFixed(1)},${yOf(p.score).toFixed(1)}`)
    .join(' ');
  const lastX = xOf(points[points.length - 1].age).toFixed(1);
  const firstX = xOf(points[0].age).toFixed(1);
  const baseY = (PAD_T + PLOT_H).toFixed(1);
  const areaPath = `${linePath} L${lastX},${baseY} L${firstX},${baseY} Z`;

  const daewoonStarts = points.filter((p) => p.isDaewoonStart);
  const selectedPoint: LifetimePoint | undefined = points.find((p) => p.age === selectedAge);
  const currentPoint: LifetimePoint | undefined = points.find((p) => p.age === currentAge);

  const avgScore = Math.round(points.reduce((s, p) => s + p.score, 0) / points.length);

  const yTicks = [0, 50, 100];
  // 10년 단위 + 시작/끝
  const xTicks = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99];

  // SVG 클릭 / 터치 → 가장 가까운 나이 선택
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
        <div className="text-[13px] text-text-tertiary">평균 {avgScore}점</div>
      </div>
      <p className="text-[14.5px] text-text-secondary mb-3 pl-3 leading-[1.7]">
        1세부터 99세까지의 종합 운세 점수예요. 대운(10년 주기) 과 세운(연 단위) 의 천간·지지가
        원국과 어떻게 상호작용하는지 점수화한 결과로, 차트를 좌우로 밀거나 원하는 나이를 탭하면
        상세 정보가 위에 표시돼요.
      </p>

      {/* 선택된 나이 정보 — 상단 카드 */}
      {selectedPoint && (
        <div className="mb-3 rounded-xl px-3 py-2.5 bg-[rgba(124,92,252,0.10)] border border-[rgba(124,92,252,0.28)] flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: GRADE_COLOR[selectedPoint.grade] }}
            />
            <span className="text-[15px] font-bold text-text-primary">
              {selectedPoint.age}세
            </span>
            <span className="text-[12px] text-text-tertiary">({selectedPoint.year}년)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-text-tertiary">점수</span>
            <span
              className="text-[15px] font-bold"
              style={{ color: GRADE_COLOR[selectedPoint.grade] }}
            >
              {selectedPoint.score}
            </span>
            <span className="text-[12px] text-text-secondary">· {selectedPoint.grade}</span>
          </div>
          {selectedPoint.daewoonGanZhi && (
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-text-tertiary">대운</span>
              <span
                className="text-[14px] font-bold text-text-primary"
                style={{ fontFamily: 'var(--font-title)' }}
              >
                {selectedPoint.daewoonGanZhi}
              </span>
            </div>
          )}
          {selectedPoint.sewoonGanZhi && (
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-text-tertiary">세운</span>
              <span
                className="text-[14px] font-bold text-text-primary"
                style={{ fontFamily: 'var(--font-title)' }}
              >
                {selectedPoint.sewoonGanZhi}
              </span>
            </div>
          )}
        </div>
      )}

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
              <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y 보조선 + 라벨 */}
          {yTicks.map((t) => (
            <g key={`yt-${t}`}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={yOf(t)}
                y2={yOf(t)}
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="1"
                strokeDasharray={t === 50 ? '0' : '2 4'}
              />
              <text
                x={PAD_L - 8}
                y={yOf(t) + 4}
                textAnchor="end"
                fontSize="11"
                fill="rgba(255,255,255,0.5)"
              >
                {t}
              </text>
            </g>
          ))}

          {/* 대운 전환 세로 점선 */}
          {daewoonStarts.map((p) => (
            <g key={`dw-${p.age}`}>
              <line
                x1={xOf(p.age)}
                x2={xOf(p.age)}
                y1={PAD_T}
                y2={PAD_T + PLOT_H}
                stroke="rgba(168,139,250,0.22)"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              <text
                x={xOf(p.age)}
                y={PAD_T + PLOT_H + 28}
                textAnchor="middle"
                fontSize="10"
                fill="rgba(168,139,250,0.7)"
                style={{ fontFamily: 'var(--font-title)' }}
              >
                {p.daewoonGanZhi}
              </text>
            </g>
          ))}

          {/* 에어리어 fill */}
          <path d={areaPath} fill="url(#lifeFortuneFill)" />

          {/* 메인 라인 */}
          <path
            d={linePath}
            fill="none"
            stroke="#A78BFA"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X축 라벨 (나이) */}
          {xTicks.map((age) => (
            <text
              key={`xt-${age}`}
              x={xOf(age)}
              y={PAD_T + PLOT_H + 14}
              textAnchor="middle"
              fontSize="11"
              fill="rgba(255,255,255,0.5)"
            >
              {age}
            </text>
          ))}

          {/* 현재 만나이 — 회색 작은 dot (선택 강조와 분리) */}
          {currentPoint && currentAge !== selectedAge && (
            <circle
              cx={xOf(currentPoint.age)}
              cy={yOf(currentPoint.score)}
              r="3"
              fill="rgba(255,255,255,0.45)"
              stroke="#1C1033"
              strokeWidth="1.5"
            />
          )}

          {/* 선택된 나이 강조 — 큰 dot + 점수 라벨 */}
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
                opacity="0.55"
              />
              <circle
                cx={xOf(selectedPoint.age)}
                cy={yOf(selectedPoint.score)}
                r="6"
                fill={GRADE_COLOR[selectedPoint.grade]}
                stroke="#1C1033"
                strokeWidth="2"
              />
              <rect
                x={xOf(selectedPoint.age) - 28}
                y={yOf(selectedPoint.score) - 22}
                width="56"
                height="14"
                rx="3"
                fill="rgba(15,9,32,0.85)"
                stroke={GRADE_COLOR[selectedPoint.grade]}
                strokeWidth="0.8"
              />
              <text
                x={xOf(selectedPoint.age)}
                y={yOf(selectedPoint.score) - 12}
                textAnchor="middle"
                fontSize="10.5"
                fontWeight="700"
                fill={GRADE_COLOR[selectedPoint.grade]}
              >
                {selectedPoint.age}세 · {selectedPoint.score}점
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* 범례 */}
      <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#A78BFA' }} />
          <span className="text-[12px] text-text-tertiary">종합 운세 점수</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-0.5" style={{ background: 'rgba(168,139,250,0.6)' }} />
          <span className="text-[12px] text-text-tertiary">대운 전환 (10년)</span>
        </div>
        {currentPoint && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.45)' }} />
            <span className="text-[12px] text-text-tertiary">현재 ({currentAge}세)</span>
          </div>
        )}
      </div>

      <p className="text-[12px] text-text-tertiary mt-2 text-center">
        ← 좌우로 밀어보세요 · 원하는 나이를 탭하면 상세 정보가 표시됩니다
      </p>
    </motion.div>
  );
}
