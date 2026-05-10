'use client';

import { motion } from 'framer-motion';
import { RadarChart, type RadarDomain } from '../charts/RadarChart';
import type { CoreScore } from '../../engine/zamidusu/visualization';

interface CorePalaceScoresProps {
  cores: CoreScore[];
  overall: number;
}

function colorOfScore(score: number): string {
  if (score >= 80) return '#4ADE80';
  if (score >= 68) return '#A78BFA';
  if (score >= 58) return '#FBBF24';
  return '#F87171';
}

function gradeOfScore(score: number): string {
  if (score >= 85) return '대길';
  if (score >= 72) return '길';
  if (score >= 62) return '평';
  return '주의';
}

export function CorePalaceScores({ cores, overall }: CorePalaceScoresProps) {
  const domains: RadarDomain[] = cores.map((c) => ({
    label: c.label,
    score: c.score,
    color: colorOfScore(c.score),
  }));

  const overallColor = colorOfScore(overall);
  const overallGrade = gradeOfScore(overall);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ display: 'inline-block', width: 4, height: 20, borderRadius: 2, background: 'var(--cta-primary)' }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>
          여섯 하늘 — 인생 영역의 결
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 14, paddingLeft: 12 }}>
        명반 12궁 가운데 가장 비중이 큰 여섯 영역을 모았습니다. 각 방의 주성·보좌성·사화를 종합해 결의 강약을 보여드려요.
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          alignItems: 'stretch',
        }}
      >
        <div style={{ position: 'relative', alignSelf: 'center', width: '100%', maxWidth: 280 }}>
          <RadarChart
            domains={domains}
            size={240}
            fillColor="rgba(167,139,250,0.22)"
            strokeColor="rgba(167,139,250,0.85)"
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: 1 }}>종합</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: overallColor, fontFamily: 'var(--font-serif)', lineHeight: 1.2 }}>
              {overall}
            </div>
            <div style={{ fontSize: 11, color: overallColor, fontWeight: 700 }}>{overallGrade}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cores.map((c, i) => {
            const color = colorOfScore(c.score);
            return (
              <motion.div
                key={c.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '64px 1fr 38px',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                    {c.label}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{c.palaceName}</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${c.score}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 + i * 0.04 }}
                    style={{ height: '100%', background: color, borderRadius: 999 }}
                  />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color, textAlign: 'right', fontFamily: 'var(--font-serif)' }}>
                  {c.score}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
