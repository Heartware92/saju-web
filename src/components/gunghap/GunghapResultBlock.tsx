'use client';

import { motion } from 'framer-motion';
import { RadarChart } from '@/components/charts/RadarChart';
import {
  GRADE_COLOR, GUNGHAP_DOMAINS, scoreToGrade,
  type GunghapDomainScores,
} from '@/lib/gunghap';
import type { FortuneGrade } from '@/engine/periodFortune';

export function ScoreRing({ score, grade, size = 120 }: { score: number; grade: FortuneGrade; size?: number }) {
  const c = GRADE_COLOR[grade];
  const r = size * 0.4;
  const C = 2 * Math.PI * r;
  const offset = C * (1 - score / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={size * 0.083} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={c} strokeWidth={size * 0.083} strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.23} fontWeight="bold" fill="white">{score}</text>
      <text x={size / 2} y={size / 2 + size * 0.18} textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.09} fill="rgba(255,255,255,0.6)">점 · {grade}</text>
    </svg>
  );
}

export function DomainBar({ label, score, grade }: { label: string; score: number; grade: FortuneGrade }) {
  const c = GRADE_COLOR[grade];
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 shrink-0 text-[14px] font-semibold text-text-secondary whitespace-nowrap">{label}</div>
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: c }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <div className="w-8 text-right text-[14px] font-bold" style={{ color: c }}>{score}</div>
    </div>
  );
}

interface GunghapResultBlockProps {
  title: string;
  score: number;
  domainScores: GunghapDomainScores;
  /** 카드 배경 클래스. 기본은 결과/공유 페이지에서 공통으로 쓰는 그라디언트. */
  accentClassName?: string;
}

/**
 * 궁합 결과 시각 블록 — 은유 제목 + 종합 점수 원 + 레이더 차트 + 영역별 점수 바.
 * GunghapPage 결과뷰와 공유 페이지에서 동일한 모양으로 사용된다.
 */
export function GunghapResultBlock({
  title,
  score,
  domainScores,
  accentClassName = 'bg-gradient-to-br from-fuchsia-500/20 to-pink-500/10',
}: GunghapResultBlockProps) {
  const hasDomains = Object.keys(domainScores).length >= 3;
  return (
    <div className={`rounded-2xl mb-4 p-5 ${accentClassName} border border-white/15`}>
      {title && (
        <p className="text-[18px] font-bold text-text-primary leading-relaxed mb-4 text-center" style={{ fontFamily: 'var(--font-serif)' }}>
          {title}
        </p>
      )}
      <div className="flex justify-center mb-2">
        <ScoreRing score={score} grade={scoreToGrade(score)} size={130} />
      </div>
      <p className="text-[13px] text-text-secondary text-center mb-1">종합 궁합 점수</p>

      {hasDomains && (
        <>
          <div className="mt-4 mb-2">
            <RadarChart
              domains={GUNGHAP_DOMAINS.map(d => ({
                label: d.label,
                score: domainScores[d.key] ?? 50,
                color: GRADE_COLOR[scoreToGrade(domainScores[d.key] ?? 50)],
              }))}
              size={250}
            />
          </div>
          <div className="space-y-2 mt-3">
            {GUNGHAP_DOMAINS.map(d => {
              const s = domainScores[d.key];
              if (s == null) return null;
              return <DomainBar key={d.key} label={d.label} score={s} grade={scoreToGrade(s)} />;
            })}
          </div>
        </>
      )}
    </div>
  );
}
