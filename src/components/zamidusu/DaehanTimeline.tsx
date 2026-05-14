'use client';

import { motion } from 'framer-motion';
import type { DaehanSegment } from '../../engine/zamidusu/visualization';
import { PalaceTermLabel } from './PalaceTermLabel';

interface DaehanTimelineProps {
  segments: DaehanSegment[];
  currentAge: number;
}

function colorOfScore(score: number): string {
  if (score >= 75) return '#4ADE80';
  if (score >= 60) return '#A78BFA';
  if (score >= 45) return '#FBBF24';
  return '#F87171';
}

export function DaehanTimeline({ segments, currentAge }: DaehanTimelineProps) {
  if (segments.length === 0) return null;

  const current = segments.find((s) => s.isCurrent);
  const maxScore = Math.max(...segments.map((s) => s.score), 80);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ display: 'inline-block', width: 4, height: 20, borderRadius: 2, background: 'var(--cta-primary)' }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', letterSpacing: '-0.01em' }}>
          대한(大限) — 10년 단위의 리듬
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 14, paddingLeft: 12 }}>
        명반에서 10년마다 다른 방을 지나갑니다. 현재 머무는 방의 별자리를 강조해 표시했어요.
      </div>

      {current && (
        <div
          style={{
            background: 'rgba(167,139,250,0.10)',
            border: '1px solid rgba(167,139,250,0.30)',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: '#A78BFA', fontWeight: 700, letterSpacing: 1 }}>현재 머무는 방</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {current.startAge}~{current.endAge}세
            </span>
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', marginBottom: 4 }}>
            {current.palaceName}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {current.headline}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 110, position: 'relative' }}>
        {segments.map((seg, i) => {
          const color = colorOfScore(seg.score);
          const heightPct = Math.max(14, (seg.score / maxScore) * 100);
          return (
            <motion.div
              key={`${seg.startAge}-${seg.palaceName}`}
              initial={{ opacity: 0, scaleY: 0.4 }}
              animate={{ opacity: 1, scaleY: 1 }}
              transition={{ duration: 0.5, delay: i * 0.04, ease: 'easeOut' }}
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                position: 'relative',
                transformOrigin: 'bottom',
                height: '100%',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: `${heightPct}%`,
                  borderRadius: '6px 6px 2px 2px',
                  background: seg.isCurrent
                    ? `linear-gradient(180deg, ${color}, rgba(167,139,250,0.5))`
                    : `${color}55`,
                  border: `1.5px solid ${seg.isCurrent ? color : `${color}33`}`,
                  boxShadow: seg.isCurrent ? `0 0 12px ${color}66` : 'none',
                  position: 'relative',
                }}
              />
            </motion.div>
          );
        })}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${segments.length}, 1fr)`,
          gap: 4,
          marginTop: 8,
        }}
      >
        {segments.map((seg) => (
          <div
            key={`age-${seg.startAge}`}
            style={{
              fontSize: 12,
              textAlign: 'center',
              color: seg.isCurrent ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontWeight: seg.isCurrent ? 700 : 500,
              fontFamily: 'var(--font-serif)',
              lineHeight: 1.2,
            }}
          >
            {seg.startAge}
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${segments.length}, 1fr)`,
          gap: 4,
          marginTop: 4,
        }}
      >
        {segments.map((seg) => (
          <div
            key={`label-${seg.startAge}`}
            style={{
              fontSize: 12,
              textAlign: 'center',
              color: seg.isCurrent ? colorOfScore(seg.score) : 'var(--text-secondary)',
              fontWeight: seg.isCurrent ? 700 : 500,
              lineHeight: 1.2,
              fontFamily: 'var(--font-serif)',
              wordBreak: 'keep-all',
              overflow: 'visible',
              whiteSpace: 'nowrap',
            }}
          >
            <PalaceTermLabel palaceName={seg.palaceName} />
          </div>
        ))}
      </div>
    </div>
  );
}
