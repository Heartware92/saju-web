'use client';

import { motion } from 'framer-motion';
import { TOJEONG_SECTION_KEYS, TOJEONG_SECTION_LABELS } from '@/constants/prompts';
import { parseTojeongSections, parseTojeongScores } from '@/services/fortuneService';
import { calculateTojeong, type TojeongResult } from '@/engine/tojeong';
import { buildTojeongReading } from '@/engine/tojeong/reading';
import { extractMetaphor } from '@/utils/parseMetaphor';
import type { GwaeGrade } from '@/engine/tojeong/gwae-table';
import type { FortuneGrade } from '@/engine/periodFortune';
import { RadarChart } from '@/components/charts/RadarChart';

interface Props {
  record: Record<string, any>;
}

const HANJA_TO_KOR: Record<string, string> = {
  '甲': '갑', '乙': '을', '丙': '병', '丁': '정', '戊': '무',
  '己': '기', '庚': '경', '辛': '신', '壬': '임', '癸': '계',
  '子': '자', '丑': '축', '寅': '인', '卯': '묘', '辰': '진',
  '巳': '사', '午': '오', '未': '미', '申': '신', '酉': '유',
  '戌': '술', '亥': '해',
};

function ganZhiToKor(ganZhi: string): string {
  return Array.from(ganZhi || '').map(c => HANJA_TO_KOR[c] ?? c).join('');
}

const GRADE_COLOR: Record<GwaeGrade, string> = {
  '대길': '#34D399', '길': '#86EFAC', '중길': '#FBBF24',
  '평': '#CBD5E1', '중흉': '#FB923C', '흉': '#F87171', '대흉': '#EF4444',
};
const FORTUNE_GRADE_COLOR: Record<FortuneGrade, string> = {
  '대길': '#34D399', '길': '#86EFAC', '중길': '#FBBF24',
  '평': '#CBD5E1', '중흉': '#FB923C', '흉': '#F87171',
};

function scoreToGrade(s: number): FortuneGrade {
  if (s >= 90) return '대길';
  if (s >= 75) return '길';
  if (s >= 60) return '중길';
  if (s >= 45) return '평';
  if (s >= 30) return '중흉';
  return '흉';
}

function ScoreRing({ score, grade, size = 120 }: { score: number; grade: FortuneGrade; size?: number }) {
  const c = FORTUNE_GRADE_COLOR[grade];
  const r = size * 0.4;
  const C = 2 * Math.PI * r;
  const offset = C * (1 - score / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={size*0.083} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={c} strokeWidth={size*0.083} strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={offset}
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
            fontSize={size*0.23} fontWeight="bold" fill="white">{score}</text>
      <text x={size/2} y={size/2 + size*0.18} textAnchor="middle" dominantBaseline="middle"
            fontSize={size*0.09} fill="rgba(255,255,255,0.6)">점 · {grade}</text>
    </svg>
  );
}

function DomainBar({ label, score, grade }: { label: string; score: number; grade: FortuneGrade }) {
  const c = FORTUNE_GRADE_COLOR[grade];
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 shrink-0 text-[14px] font-semibold text-text-secondary whitespace-nowrap">{label}</div>
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full" style={{ backgroundColor: c, width: `${score}%`, transition: 'width 0.6s ease-out' }} />
      </div>
      <div className="w-8 text-right text-[14px] font-bold" style={{ color: c }}>{score}</div>
    </div>
  );
}

function parseMonthlyEntries(raw: string): { month: number; keyword: string; text: string }[] {
  const entries: { month: number; keyword: string; text: string }[] = [];
  const parts = raw.split(/(?=\d{1,2}월\s*[—\-–]\s*)/);
  for (const part of parts) {
    const m = part.match(/^(\d{1,2})월\s*[—\-–]\s*(.+?)[\n\r]/);
    if (!m) continue;
    const month = parseInt(m[1], 10);
    const keyword = m[2].trim();
    const text = part.slice(m[0].length).trim();
    if (month >= 1 && month <= 12 && text) {
      entries.push({ month, keyword, text });
    }
  }
  return entries;
}

const DOMAIN_DEFS: { key: 'wealth' | 'love' | 'health' | 'career'; label: string }[] = [
  { key: 'wealth', label: '재물운' },
  { key: 'love', label: '애정·가정' },
  { key: 'health', label: '건강운' },
  { key: 'career', label: '직장·학업' },
];

export function TojeongResultBlock({ record }: Props) {
  const content: string = record.interpretation_detailed || record.interpretation_basic || '';
  const aiSections = parseTojeongSections(content);
  const aiDomainScores = parseTojeongScores(content);

  // engine_result 가 TojeongResult 그 자체로 저장됨
  const stored = record.engine_result as TojeongResult | undefined;

  // 보관함 레코드는 engine_result 가 있을 가능성 높음. 없으면 birth_date 로 재계산.
  let tojeong: TojeongResult | null = null;
  let reading: ReturnType<typeof buildTojeongReading> | null = null;
  try {
    if (stored && stored.gwaeNumber) {
      tojeong = stored;
    } else {
      const [y, m, d] = (record.birth_date as string).split('-').map(Number);
      const cal = (record.calendar_type ?? 'solar') as 'solar' | 'lunar';
      const tgtYear = stored?.targetYear ?? new Date().getFullYear();
      tojeong = calculateTojeong(y, m, d, cal, tgtYear);
    }
    reading = buildTojeongReading(tojeong);
  } catch (e) {
    console.error('[share/tojeong] reconstruct failed', e);
  }

  if (!tojeong || !reading) {
    return (
      <div className="rounded-2xl p-5 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <p className="text-[14px] text-text-secondary">토정비결 데이터를 불러오지 못했어요.</p>
      </div>
    );
  }

  const gradeColor = GRADE_COLOR[reading.grade];

  return (
    <>
      <p className="text-center text-[14px] text-text-tertiary mb-3">
        {ganZhiToKor(tojeong.yearGanZhi.ganZhi)}년 ({tojeong.yearGanZhi.ganZhi}年)
      </p>

      {/* 괘 번호 */}
      <motion.section
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl p-6 mb-3 text-center"
        style={{ backgroundColor: `${gradeColor}12`, border: `1px solid ${gradeColor}55` }}
      >
        <div className="text-[13px] font-semibold uppercase tracking-wider text-text-tertiary mb-2">올해의 괘</div>
        <div className="text-5xl font-bold mb-2" style={{ color: gradeColor, fontFamily: 'var(--font-serif)' }}>
          {tojeong.gwaeNumber}
        </div>
        <div className="text-[16px] font-semibold mb-1" style={{ color: gradeColor }}>{reading.grade}</div>
        <div className="text-[15px] text-text-secondary">{reading.headline}</div>
      </motion.section>

      {/* 괘 구성 */}
      <section className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <div className="text-[15px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">괘 풀이</div>
        <div className="space-y-2">
          <div className="rounded-lg p-3 bg-white/5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[13px] font-bold text-text-tertiary">상괘</span>
              <span className="text-2xl">{tojeong.upperGwae.symbol}</span>
              <span className="text-[15px] font-bold text-text-primary">
                {tojeong.upperGwae.name}({tojeong.upperGwae.hanja})
              </span>
              <span className="text-[13px] text-text-tertiary">· {tojeong.upperGwae.element}</span>
            </div>
            <div className="text-[14px] text-text-secondary">{tojeong.upperGwae.meaning}</div>
          </div>
          <div className="rounded-lg p-3 bg-white/5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[13px] font-bold text-text-tertiary">중괘</span>
              <span className="text-[15px] font-bold text-text-primary">{tojeong.middleGwae.position}</span>
            </div>
            <div className="text-[14px] text-text-secondary">{tojeong.middleGwae.meaning}</div>
          </div>
          <div className="rounded-lg p-3 bg-white/5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[13px] font-bold text-text-tertiary">하괘</span>
              <span className="text-[15px] font-bold text-text-primary">{tojeong.lowerGwae.name}</span>
            </div>
            <div className="text-[14px] text-text-secondary">{tojeong.lowerGwae.meaning}</div>
          </div>
        </div>
      </section>

      {/* 키워드 */}
      <section className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <div className="text-[15px] font-semibold text-text-secondary mb-2 uppercase tracking-wider">키워드</div>
        <div className="flex flex-wrap gap-1.5">
          {reading.entry.keywords.map((k, i) => (
            <span key={i} className="text-[14px] px-2.5 py-1 rounded-md border"
              style={{ borderColor: `${gradeColor}55`, color: gradeColor, backgroundColor: `${gradeColor}12` }}>
              {k}
            </span>
          ))}
        </div>
      </section>

      {/* 한문 괘사 */}
      {reading.entry.hanjaSa && (
        <section className="rounded-2xl p-4 mb-3 text-center" style={{ backgroundColor: `${gradeColor}08`, border: `1px solid ${gradeColor}33` }}>
          <div className="text-[12px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">괘사 (卦辭)</div>
          <div className="text-[22px] font-bold mb-3 tracking-[0.15em]" style={{ fontFamily: 'var(--font-serif)', color: gradeColor }}>
            {reading.entry.hanjaSa.title}
          </div>
          <div className="space-y-1 mb-3">
            {reading.entry.hanjaSa.lines.map((line, i) => (
              <div key={i} className="text-[16px] tracking-[0.1em] text-text-secondary" style={{ fontFamily: 'var(--font-serif)' }}>
                {line}
              </div>
            ))}
          </div>
          <div className="text-[14px] text-text-tertiary leading-relaxed border-t border-white/10 pt-3 mt-3">
            {reading.entry.hanjaSa.translation}
          </div>
        </section>
      )}

      {/* 총평 */}
      <section className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <div className="text-[15px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">올해 총평</div>
        <div className="space-y-3">
          {reading.paragraphs.map((p, i) => (
            <p key={i} className="text-[15px] text-text-secondary leading-relaxed">{p}</p>
          ))}
        </div>
      </section>

      {/* 월별 흐름 */}
      <section className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <div className="text-[15px] font-semibold text-text-secondary mb-3 uppercase tracking-wider">월별 흐름</div>
        <div className="space-y-1.5">
          {reading.monthly.map(m => (
            <div key={m.month} className="rounded-lg p-2.5 bg-white/5 flex gap-3">
              <div className="shrink-0 text-center" style={{ minWidth: 52 }}>
                <div className="text-[15px] font-bold text-text-primary">{m.month}월</div>
                <div className="text-[12px] text-text-tertiary mt-0.5 whitespace-nowrap">{m.keyword.split('·')[0]}</div>
              </div>
              <div className="flex-1 text-[14px] text-text-secondary leading-relaxed">{m.text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 조언·주의 */}
      <div className="grid grid-cols-1 gap-3">
        <section className="rounded-2xl p-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <div className="text-[15px] font-semibold mb-2" style={{ color: '#34D399' }}>올해의 조언</div>
          <ul className="space-y-1.5">
            {reading.advice.map((a, i) => (
              <li key={i} className="text-[14px] text-text-secondary flex gap-2">
                <span style={{ color: '#34D399' }}>✓</span><span>{a}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl p-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <div className="text-[15px] font-semibold mb-2" style={{ color: '#F87171' }}>주의할 점</div>
          <ul className="space-y-1.5">
            {reading.warnings.map((w, i) => (
              <li key={i} className="text-[14px] text-text-secondary flex gap-2">
                <span style={{ color: '#F87171' }}>!</span><span>{w}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* AI 영역별 점수 */}
      {aiDomainScores && (
        <section className="mt-3 rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-block w-1 h-5 rounded-full bg-cta" />
            <div className="text-[18px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
              영역별 운세 점수
            </div>
          </div>
          {(() => {
            const avg = Math.round((aiDomainScores.wealth + aiDomainScores.love + aiDomainScores.health + aiDomainScores.career) / 4);
            return (
              <div className="flex justify-center mb-4">
                <ScoreRing score={avg} grade={scoreToGrade(avg)} size={130} />
              </div>
            );
          })()}
          <RadarChart
            domains={DOMAIN_DEFS.map(d => ({
              label: d.label,
              score: aiDomainScores[d.key],
              color: FORTUNE_GRADE_COLOR[scoreToGrade(aiDomainScores[d.key])],
            }))}
            size={240}
            className="mb-4"
          />
          <div className="space-y-2.5">
            {DOMAIN_DEFS.map(d => (
              <DomainBar key={d.key} label={d.label} score={aiDomainScores[d.key]} grade={scoreToGrade(aiDomainScores[d.key])} />
            ))}
          </div>
        </section>
      )}

      {/* AI 섹션 카드 */}
      {aiSections && Object.keys(aiSections).length > 0 && (
        <div className="mt-3 space-y-3">
          {TOJEONG_SECTION_KEYS.map((key, idx) => {
            const body = aiSections[key];
            if (!body) return null;

            if (key === 'monthly') {
              const monthEntries = parseMonthlyEntries(body);
              if (monthEntries.length > 0) {
                return (
                  <section key={key} className="rounded-2xl p-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-block w-1 h-5 rounded-full bg-cta" />
                      <div className="text-[18px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
                        {TOJEONG_SECTION_LABELS[key]}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {monthEntries.map(me => (
                        <div key={me.month} className="rounded-lg p-3 bg-white/5">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[15px] font-bold text-text-primary" style={{ minWidth: 36 }}>{me.month}월</span>
                            <span className="text-[13px] text-cta/70 font-semibold whitespace-nowrap">{me.keyword}</span>
                          </div>
                          <div className="text-[14px] text-text-secondary leading-relaxed">{me.text}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              }
            }

            // [은유] 마커 우선 추출 + 본문 strip. 마커 없으면 첫 줄 휴리스틱 fallback.
            const parsed = extractMetaphor(body);
            let headline = parsed.metaphorTitle;
            let bodyText = parsed.bodyText;
            let hasHeadline = headline.length > 0;
            if (!hasHeadline) {
              const lines = bodyText.split('\n').filter(l => l.trim());
              const candidate = lines[0]?.trim() || '';
              const couldBe = lines.length > 1 && candidate.length > 0 && candidate.length <= 80;
              if (couldBe) {
                headline = candidate;
                bodyText = lines.slice(1).join('\n').trim();
                hasHeadline = true;
              }
            }

            return (
              <motion.section
                key={key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * idx }}
                className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block w-1 h-5 rounded-full bg-cta" />
                  <div className="text-[17px] font-bold text-text-primary tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
                    {TOJEONG_SECTION_LABELS[key]}
                  </div>
                </div>
                {hasHeadline && (
                  <div className="text-[16px] font-bold leading-snug text-cta/90 mb-4 pl-3" style={{ fontFamily: 'var(--font-serif)' }}>
                    {headline}
                  </div>
                )}
                <p className="text-[15px] text-text-secondary leading-[1.85] tracking-[-0.005em] whitespace-pre-line">
                  {bodyText}
                </p>
              </motion.section>
            );
          })}
        </div>
      )}
    </>
  );
}
