'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZAMIDUSU_SECTION_KEYS, ZAMIDUSU_SECTION_LABELS } from '@/constants/prompts';
import { parseZamidusuSections } from '@/services/fortuneService';
import { calculateZamidusu, type ZamidusuResult } from '@/engine/zamidusu';
import { extractMetaphor } from '@/utils/parseMetaphor';
import { StarChart } from '@/components/zamidusu/StarChart';
import { CorePalaceScores } from '@/components/zamidusu/CorePalaceScores';
import { MutagenCards } from '@/components/zamidusu/MutagenCards';
import { DaehanTimeline } from '@/components/zamidusu/DaehanTimeline';
import {
  calcCoreScores, calcMutagenPlacements, calcDaehanTimeline, calcOverallScore,
} from '@/engine/zamidusu/visualization';

interface Props {
  record: Record<string, any>;
}

function splitIntoParagraphs(text: string, sentencesPerPara = 3): string[] {
  const paras = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const para of paras) {
    const flat = para.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    const parts = flat.split(/([.!?])\s+/);
    const sentences: string[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      const s = (parts[i] || '').trim();
      const punct = parts[i + 1] || '';
      const combined = (s + punct).trim();
      if (combined) sentences.push(combined);
    }
    if (sentences.length === 0) { out.push(flat); continue; }
    if (sentences.length <= sentencesPerPara) { out.push(sentences.join(' ')); continue; }
    for (let i = 0; i < sentences.length; i += sentencesPerPara) {
      out.push(sentences.slice(i, i + sentencesPerPara).join(' '));
    }
  }
  return out;
}

export function ZamidusuResultBlock({ record }: Props) {
  const [selectedPalace, setSelectedPalace] = useState<number | null>(null);

  const content: string = record.interpretation_detailed || record.interpretation_basic || '';
  const sections = parseZamidusuSections(content);

  const stored = record.engine_result as ZamidusuResult | undefined;
  let chart: ZamidusuResult | null = null;
  try {
    if (stored && stored.palaces) {
      chart = stored;
    } else {
      const [y, m, d] = (record.birth_date as string).split('-').map(Number);
      const [hh] = (record.birth_time ?? '12:00').split(':').map(Number);
      chart = calculateZamidusu(y, m, d, hh, record.gender as 'male' | 'female', (record.calendar_type ?? 'solar') as 'solar' | 'lunar');
    }
  } catch (e) {
    console.error('[share/zamidusu] reconstruct failed', e);
  }

  if (!chart) {
    return (
      <div className="rounded-2xl p-5 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <p className="text-[14px] text-text-secondary">자미두수 명반을 불러오지 못했어요.</p>
      </div>
    );
  }

  const coreScores = calcCoreScores(chart);
  const overallScore = calcOverallScore(coreScores);
  const mutagenPlacements = calcMutagenPlacements(chart);
  const daehanSegments = calcDaehanTimeline(chart, 0);

  return (
    <>
      {/* 명반 요약 메타 */}
      <div className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <div style={{ textAlign: 'center', padding: '10px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>띠</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>{chart.zodiac}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>별자리</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>{chart.sign}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px 6px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>오행국</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#FBBF24', fontFamily: 'var(--font-serif)' }}>{chart.fiveElementsClass}</div>
          </div>
        </div>
      </div>

      {/* 별자리 시각화 */}
      <div className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <h2 style={{ textAlign: 'center', marginBottom: 14, fontSize: 18 }}>하늘에 새겨진 당신의 별자리</h2>
        <StarChart
          palaces={chart.palaces}
          soul={chart.soul}
          fiveElementsClass={chart.fiveElementsClass}
          selectedIndex={selectedPalace}
          onSelect={(idx) => setSelectedPalace(selectedPalace === idx ? null : idx)}
        />
      </div>

      {/* 6궁 레이더 */}
      <div className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <CorePalaceScores cores={coreScores} overall={overallScore} />
      </div>

      {/* 사화 카드 */}
      {mutagenPlacements.length > 0 && (
        <div className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <MutagenCards placements={mutagenPlacements} />
        </div>
      )}

      {/* 대한 타임라인 */}
      {daehanSegments.length > 0 && (
        <div className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <DaehanTimeline segments={daehanSegments} currentAge={0} />
        </div>
      )}

      {/* AI 섹션 카드 */}
      {ZAMIDUSU_SECTION_KEYS.map((key) => {
        const text = sections[key];
        if (!text) return null;
        // [은유] 마커 우선 추출 + 본문 strip. 마커 없으면 첫 줄 휴리스틱 fallback.
        const parsed = extractMetaphor(text);
        let headline = parsed.metaphorTitle;
        let body = parsed.bodyText;
        let hasHeadline = headline.length > 0;
        if (!hasHeadline) {
          const lines = body.split('\n');
          const candidate = lines[0]?.trim() || '';
          const couldBe = lines.length > 1 && candidate.length > 0 && candidate.length <= 80;
          if (couldBe) {
            headline = candidate;
            body = lines.slice(1).join('\n').trim() || candidate;
            hasHeadline = true;
          } else {
            body = body || candidate;
          }
        }
        return (
          <motion.div key={key}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-5 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block w-1 h-5 rounded-full bg-cta" />
              <div className="text-[18px] font-bold text-text-primary tracking-tight" style={{ fontFamily: 'var(--font-title)' }}>
                {ZAMIDUSU_SECTION_LABELS[key]}
              </div>
            </div>
            {hasHeadline && (
              <div className="text-[16px] font-bold leading-snug text-cta/90 mb-4 pl-3" style={{ fontFamily: 'var(--font-title)' }}>
                {headline}
              </div>
            )}
            {(() => {
              const raw = hasHeadline ? body : text;
              return splitIntoParagraphs(raw).map((p, i) => (
                <p key={i} className="leading-[1.85]" style={{ fontSize: 15, color: 'var(--text-secondary)', margin: i === 0 ? 0 : '14px 0 0' }}>
                  {p}
                </p>
              ));
            })()}
          </motion.div>
        );
      })}

      <AnimatePresence>{/* placeholder for layout consistency */}</AnimatePresence>
    </>
  );
}
