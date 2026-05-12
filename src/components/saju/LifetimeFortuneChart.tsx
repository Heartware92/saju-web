'use client';

/**
 * 평생 운세 흐름 그래프 (1~99세)
 * - X축: 나이 (10년 단위 라벨)
 * - Y축: 종합 운세 점수 0~100
 * - 라인 + 에어리어 fill (점수대별 그라데이션)
 * - 대운 전환점 세로 점선
 * - 현재 나이 강조 dot
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { computeLifetimeFortune, getCurrentAge } from '@/utils/lifetimeFortune';
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

// 차트 영역 (viewBox 좌표계)
const W = 360;
const H = 180;
const PAD_L = 30;   // 왼쪽 여백 (Y축 라벨)
const PAD_R = 14;
const PAD_T = 18;
const PAD_B = 28;   // 아래 여백 (X축 라벨)
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

export function LifetimeFortuneChart({ saju }: Props) {
  const points = useMemo(() => computeLifetimeFortune(saju, 99), [saju]);
  const currentAge = useMemo(() => getCurrentAge(saju), [saju]);

  if (!points.length) return null;

  const ageMin = 1;
  const ageMax = 99;
  const x = (age: number) => PAD_L + ((age - ageMin) / (ageMax - ageMin)) * PLOT_W;
  const y = (score: number) => PAD_T + (1 - score / 100) * PLOT_H;

  // 라인 패스 (Catmull-Rom 대신 단순 경로 — 가독성 OK)
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.age).toFixed(1)},${y(p.score).toFixed(1)}`)
    .join(' ');

  // 에어리어 패스 (선 아래 영역 채움)
  const lastX = x(points[points.length - 1].age).toFixed(1);
  const firstX = x(points[0].age).toFixed(1);
  const baseY = (PAD_T + PLOT_H).toFixed(1);
  const areaPath = `${linePath} L${lastX},${baseY} L${firstX},${baseY} Z`;

  // 대운 전환 지점
  const daewoonStarts = points.filter((p) => p.isDaewoonStart);

  // 현재 나이의 포인트
  const currentPoint = points.find((p) => p.age === currentAge);

  // 점수대 평균 — 상단 헤드라인용
  const avgScore = Math.round(
    points.reduce((sum, p) => sum + p.score, 0) / points.length,
  );

  // Y축 라벨
  const yTicks = [0, 50, 100];
  // X축 라벨 — 10년 단위
  const xTicks = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99];

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
        <div className="text-[12px] text-text-tertiary">평균 {avgScore}점</div>
      </div>
      <p className="text-[12.5px] text-text-tertiary mb-3 pl-3 leading-relaxed">
        1세부터 99세까지의 종합 운세 점수. 대운(10년 주기) 과 세운(연 단위) 의 천간·지지가
        원국과 어떻게 상호작용하는지 점수화한 결과.
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="lifeFortuneFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y 보조선 */}
        {yTicks.map((t) => (
          <g key={`yt-${t}`}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(t)}
              y2={y(t)}
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="1"
              strokeDasharray={t === 50 ? '0' : '2 4'}
            />
            <text
              x={PAD_L - 6}
              y={y(t) + 3}
              textAnchor="end"
              fontSize="9"
              fill="rgba(255,255,255,0.45)"
            >
              {t}
            </text>
          </g>
        ))}

        {/* 대운 전환 세로 점선 */}
        {daewoonStarts.map((p) => (
          <line
            key={`dw-${p.age}`}
            x1={x(p.age)}
            x2={x(p.age)}
            y1={PAD_T}
            y2={PAD_T + PLOT_H}
            stroke="rgba(168,139,250,0.18)"
            strokeWidth="1"
            strokeDasharray="2 3"
          />
        ))}

        {/* 에어리어 fill */}
        <path d={areaPath} fill="url(#lifeFortuneFill)" />

        {/* 메인 라인 */}
        <path
          d={linePath}
          fill="none"
          stroke="#A78BFA"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 대운 전환점 마커 + 대운 라벨 */}
        {daewoonStarts.map((p) => (
          <g key={`dwm-${p.age}`}>
            <circle
              cx={x(p.age)}
              cy={y(p.score)}
              r="2.5"
              fill="#A78BFA"
              stroke="#1C1033"
              strokeWidth="1.2"
            />
            <text
              x={x(p.age)}
              y={PAD_T + PLOT_H + 22}
              textAnchor="middle"
              fontSize="8.5"
              fill="rgba(168,139,250,0.7)"
            >
              {p.daewoonGanZhi}
            </text>
          </g>
        ))}

        {/* X축 라벨 (나이) */}
        {xTicks.map((age) => (
          <text
            key={`xt-${age}`}
            x={x(age)}
            y={PAD_T + PLOT_H + 12}
            textAnchor="middle"
            fontSize="10"
            fill="rgba(255,255,255,0.5)"
          >
            {age === 1 || age === 99 ? `${age}` : age}
          </text>
        ))}

        {/* 현재 나이 강조 dot — 가장 위에 그려서 항상 보이게 */}
        {currentPoint && currentAge >= 1 && currentAge <= 99 && (
          <g>
            <line
              x1={x(currentPoint.age)}
              x2={x(currentPoint.age)}
              y1={PAD_T}
              y2={PAD_T + PLOT_H}
              stroke={GRADE_COLOR[currentPoint.grade]}
              strokeWidth="1.2"
              strokeDasharray="3 3"
              opacity="0.5"
            />
            <circle
              cx={x(currentPoint.age)}
              cy={y(currentPoint.score)}
              r="5"
              fill={GRADE_COLOR[currentPoint.grade]}
              stroke="#1C1033"
              strokeWidth="2"
            />
            <text
              x={x(currentPoint.age)}
              y={y(currentPoint.score) - 9}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="700"
              fill={GRADE_COLOR[currentPoint.grade]}
            >
              {currentPoint.age}세 · {currentPoint.score}점
            </text>
          </g>
        )}
      </svg>

      {/* 범례 */}
      <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: '#A78BFA' }} />
          <span className="text-[11px] text-text-tertiary">종합 운세 점수</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full opacity-50" style={{ background: '#A78BFA' }} />
          <span className="text-[11px] text-text-tertiary">대운 전환 (10년)</span>
        </div>
        {currentPoint && (
          <div className="flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: GRADE_COLOR[currentPoint.grade] }}
            />
            <span className="text-[11px] text-text-tertiary">현재 ({currentPoint.grade})</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
