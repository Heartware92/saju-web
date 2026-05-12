'use client';

import { motion } from 'framer-motion';
import { MORE_FORTUNE_CONFIGS, type MoreFortuneId } from '@/constants/moreFortunes';

interface Props {
  record: Record<string, any>;
}

/** MoreFortunePage 의 MoreFortuneResultCard 와 동일한 레이아웃. */
export function MoreResultBlock({ record }: Props) {
  const category = record.category as MoreFortuneId;
  const cfg = MORE_FORTUNE_CONFIGS[category];
  const title = cfg ? `${cfg.title} 풀이` : '풀이';
  const text: string = record.interpretation_detailed || record.interpretation_basic || '';

  // 이름 풀이 / 꿈 해몽 사용자 입력 표시용
  const eng = (record.engine_result ?? {}) as any;
  const koreanName = eng.koreanName as string | undefined;
  const charMeanings = (eng.charMeanings as string[] | undefined) ?? [];
  const dreamText = eng.dreamText as string | undefined;

  // ─ 줄/단락 정리
  const rawLines = text.replace(/\r/g, '').split('\n');
  const metaphorIdx = rawLines.findIndex(l => l.trim().length > 0);
  const metaphor = metaphorIdx >= 0 ? rawLines[metaphorIdx].trim() : '';

  const restLines = metaphorIdx >= 0 ? rawLines.slice(metaphorIdx + 1) : [];
  let jawonLine = '';
  const bodyLines: string[] = [];
  for (const ln of restLines) {
    const t = ln.trim();
    if (!jawonLine && t.startsWith('자원오행 판정')) jawonLine = t;
    else bodyLines.push(ln);
  }
  const body = bodyLines.join('\n').replace(/^\s*\n+/, '');

  const paragraphs = (() => {
    const parts = body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
    if (parts.length === 0) return [];
    const flat = parts[0].replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
    const sents = flat.split(/([.!?])\s+/);
    const sentences: string[] = [];
    for (let i = 0; i < sents.length; i += 2) {
      const s = (sents[i] || '').trim();
      const punct = sents[i + 1] || '';
      const combined = (s + punct).trim();
      if (combined) sentences.push(combined);
    }
    if (sentences.length <= 3) return [flat];
    const grouped: string[] = [];
    for (let i = 0; i < sentences.length; i += 3) grouped.push(sentences.slice(i, i + 3).join(' '));
    return grouped;
  })();

  return (
    <>
      {/* 이름 풀이: 사용자 입력 표시 */}
      {category === 'name' && koreanName && (
        <div className="rounded-2xl p-4 mb-3 bg-[rgba(124,92,252,0.08)] border border-[rgba(124,92,252,0.25)]">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">사용자 입력</div>
          <div className="text-[18px] font-bold text-text-primary mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
            {koreanName}
          </div>
          {charMeanings.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {koreanName.split('').map((ch, i) => (
                charMeanings[i] ? (
                  <span key={i} className="text-[12.5px] px-2 py-1 rounded-md bg-white/5 border border-white/10 text-text-secondary">
                    {ch} — {charMeanings[i]}
                  </span>
                ) : null
              ))}
            </div>
          )}
        </div>
      )}

      {/* 꿈 해몽: 사용자 입력 표시 */}
      {category === 'dream' && dreamText && (
        <div className="rounded-2xl p-4 mb-3 bg-[rgba(124,92,252,0.08)] border border-[rgba(124,92,252,0.25)]">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">사용자 입력 — 꿈</div>
          <p className="text-[14px] text-text-secondary leading-relaxed whitespace-pre-line">{dreamText}</p>
        </div>
      )}

      {/* 결과 카드 */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-1 h-5 rounded-full bg-cta" />
          <div className="text-[17px] font-bold text-text-primary tracking-tight" style={{ fontFamily: 'var(--font-title)' }}>
            {title}
          </div>
        </div>

        {metaphor && (
          <div className="text-[17px] font-medium leading-snug text-cta/90 mb-4 pl-3" style={{ fontFamily: 'var(--font-serif)' }}>
            {metaphor}
          </div>
        )}

        {jawonLine && (
          <div style={{
            margin: '0 0 14px', padding: '10px 12px',
            background: 'rgba(168, 132, 255, 0.08)',
            border: '1px solid rgba(168, 132, 255, 0.25)',
            borderRadius: 10, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7,
          }}>
            {jawonLine}
          </div>
        )}

        <div className="space-y-3">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-[16px] text-text-secondary leading-[1.85] whitespace-pre-line tracking-[-0.005em]">
              {p}
            </p>
          ))}
        </div>
      </motion.div>
    </>
  );
}
