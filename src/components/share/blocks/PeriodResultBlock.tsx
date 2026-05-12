'use client';

import { motion } from 'framer-motion';
import { computeSajuFromProfile } from '@/utils/profileSaju';
import type { BirthProfile } from '@/types/credit';
import { calculatePeriodFortune, type FortuneGrade, type FortuneScope } from '@/engine/periodFortune';
import { parseNewyearReport, parsePickedDateReport } from '@/services/fortuneService';
import { NEWYEAR_SECTION_KEYS, NEWYEAR_SECTION_LABELS, PICKED_DATE_SECTION_KEYS, PICKED_DATE_SECTION_LABELS } from '@/constants/prompts';
import { LuckyVisualCard, ELEMENT_LUCKY } from '@/components/saju/LuckyVisualCard';
import { TermChip } from '@/components/ui/TermChip';
import { RadarChart } from '@/components/charts/RadarChart';
import { MonthlyTrendChart } from '@/components/charts/MonthlyTrendChart';
import { extractMetaphor } from '@/utils/parseMetaphor';

interface Props {
  record: Record<string, any>;
  /** category 가 'newyear' / 'period' 인지로 scope 결정 */
}

const GRADE_COLOR: Record<FortuneGrade, string> = {
  '대길': '#34D399', '길': '#86EFAC', '중길': '#FBBF24',
  '평': '#CBD5E1', '중흉': '#FB923C', '흉': '#F87171',
};

function ScoreRing({ score, grade }: { score: number; grade: FortuneGrade }) {
  const c = GRADE_COLOR[grade];
  const r = 48, C = 2 * Math.PI * r;
  const offset = C * (1 - score / 100);
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
      <circle cx="60" cy="60" r={r} fill="none"
        stroke={c} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={offset}
        transform="rotate(-90 60 60)" />
      <text x="60" y="60" textAnchor="middle" dominantBaseline="middle"
            fontSize="28" fontWeight="bold" fill="white">{score}</text>
      <text x="60" y="82" textAnchor="middle" dominantBaseline="middle"
            fontSize="11" fill="rgba(255,255,255,0.6)">점 · {grade}</text>
    </svg>
  );
}

function DomainBar({ label, score, grade }: { label: string; score: number; grade: FortuneGrade }) {
  const c = GRADE_COLOR[grade];
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

export function PeriodResultBlock({ record }: Props) {
  const category = record.category as string;
  const scope: FortuneScope = category === 'newyear' ? 'year' : 'day';
  const isYear = scope === 'year';
  const isDate = category === 'period';

  const eng = (record.engine_result ?? {}) as any;
  const isoDate = eng.isoDate as string | undefined;
  const year = eng.year as number | undefined;

  const profile: BirthProfile = {
    id: record.profile_id ?? 'share',
    user_id: '',
    name: record.profile_name ?? '',
    birth_date: record.birth_date,
    birth_time: record.birth_time ?? undefined,
    birth_place: record.birth_place ?? 'seoul',
    gender: record.gender,
    calendar_type: record.calendar_type ?? 'solar',
    is_primary: false,
    created_at: '',
    updated_at: '',
  };
  const saju = computeSajuFromProfile(profile);
  if (!saju) {
    return (
      <div className="rounded-2xl p-5 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <p className="text-[14px] text-text-secondary">사주 데이터를 불러오지 못했어요.</p>
      </div>
    );
  }

  const fortune = calculatePeriodFortune(saju, {
    scope,
    year: isYear ? year : undefined,
    date: !isYear ? isoDate : undefined,
  });

  const content: string = record.interpretation_detailed || record.interpretation_basic || '';
  const newyearSections = isYear ? parseNewyearReport(content) : null;
  const pickedDateSections = isDate ? parsePickedDateReport(content) : null;

  return (
    <>
      {isDate && isoDate && (
        <div className="mb-3 px-1">
          <div className="text-[15px] font-semibold text-text-secondary">
            <span className="text-text-tertiary text-[13px]">선택한 날짜</span>{' '}
            <span className="text-text-primary">{isoDate}</span>
          </div>
        </div>
      )}

      {/* 요약 카드 */}
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 mb-3 bg-[rgba(20,12,38,0.6)] border border-[var(--border-subtle)]"
      >
        <div className="flex items-center gap-4">
          <ScoreRing score={fortune.overallScore} grade={fortune.overallGrade} />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] text-text-tertiary mb-1">{fortune.lunarLabel}</div>
            <div className="text-[16px] font-bold text-text-primary leading-snug mb-1.5 break-keep">
              {fortune.headline}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <TermChip term={fortune.targetGanZhi.ganZhi} />
              <TermChip term={fortune.targetGanZhi.tenGodGan} />
              <TermChip term={fortune.overallGrade} asGrade />
            </div>
          </div>
        </div>
        <p className="text-[15px] text-text-secondary mt-3 leading-relaxed break-keep">{fortune.summary}</p>
      </motion.section>

      {/* 영역별 점수 */}
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
      >
        <div className="text-[15px] font-semibold text-text-secondary mb-3 px-1 uppercase tracking-wider">영역별 운세</div>
        <RadarChart
          domains={fortune.domains.filter(d => d.key !== 'overall').map(d => ({
            label: d.label, score: d.score, color: GRADE_COLOR[d.grade],
          }))}
          size={250} className="mb-4"
        />
        <div className="space-y-2.5">
          {fortune.domains.filter(d => d.key !== 'overall').map(d => (
            <DomainBar key={d.key} label={d.label} score={d.score} grade={d.grade} />
          ))}
        </div>
      </motion.section>

      {/* 영역별 상세 — AI 텍스트가 없으므로 엔진 summary 를 사용 */}
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="space-y-2 mb-3"
      >
        {fortune.domains.filter(d => d.key !== 'overall').map(d => (
          <div key={d.key}
            className="rounded-xl p-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[15px] font-bold text-text-primary">{d.label}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[14px] font-bold" style={{ color: GRADE_COLOR[d.grade] }}>{d.score}점</span>
                <TermChip term={d.grade} asGrade />
              </div>
            </div>
            <p className="text-[14px] text-text-secondary leading-relaxed mb-2">{d.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              {d.tips.map((t, i) => (
                <span key={i} className="text-[13px] px-2 py-1 rounded-md border"
                  style={{ borderColor: `${GRADE_COLOR[d.grade]}55`, color: GRADE_COLOR[d.grade], backgroundColor: `${GRADE_COLOR[d.grade]}12` }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </motion.section>

      {/* 행운 메타 */}
      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
      >
        <div className="text-[15px] font-semibold text-text-secondary mb-3 px-1 uppercase tracking-wider">
          {isYear ? '연간 행운 처방' : '오늘의 행운'}
        </div>
        {(() => {
          const luckyEl = saju.yongSinElement ?? '목';
          const el = ELEMENT_LUCKY[luckyEl] ?? ELEMENT_LUCKY['목'];
          return (
            <LuckyVisualCard
              colors={fortune.luckyColors.length >= 2 ? fortune.luckyColors : el.colors}
              colorCss={fortune.luckyColors.length >= 2 ? undefined : el.colorCss}
              numbers={fortune.luckyNumbers.length > 0 ? fortune.luckyNumbers : el.numbers}
              direction={fortune.luckyDirection || el.direction}
              timeSlot={fortune.luckyTime || el.timeSlot}
              gem={el.gem}
              activity={el.activity}
            />
          );
        })()}
      </motion.section>

      {/* 상호작용 */}
      {fortune.interactions.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
        >
          <div className="text-[15px] font-semibold text-text-secondary mb-3 px-1 uppercase tracking-wider">원국과의 상호작용</div>
          <div className="space-y-2">
            {fortune.interactions.map((it, i) => {
              const color = it.nature === 'good' ? '#34D399' : it.nature === 'bad' ? '#F87171' : '#FBBF24';
              return (
                <div key={i} className="rounded-lg p-2.5 border" style={{ borderColor: `${color}55`, backgroundColor: `${color}12` }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[14px] font-bold" style={{ color }}>{it.kind}</span>
                    <span className="text-[13px] text-text-tertiary">{it.between}</span>
                  </div>
                  <div className="text-[14px] text-text-secondary">{it.description}</div>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* 주의점 */}
      {fortune.cautions.length > 0 && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
        >
          <div className="text-[15px] font-semibold text-text-secondary mb-2 px-1 uppercase tracking-wider">주의점</div>
          <ul className="space-y-1">
            {fortune.cautions.map((c, i) => (
              <li key={i} className="text-[14px] text-text-secondary flex gap-2">
                <span className="text-[#F87171]">•</span><span>{c}</span>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      {/* 월별 흐름 (신년운세 전용) */}
      {isYear && fortune.monthlyFlow && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
        >
          <div className="text-[15px] font-semibold text-text-secondary mb-3 px-1 uppercase tracking-wider">월별 흐름 (12개월)</div>
          <MonthlyTrendChart data={fortune.monthlyFlow} className="mb-4" />
          <div className="grid grid-cols-3 gap-1.5">
            {fortune.monthlyFlow.map(m => (
              <div key={m.month} className="rounded-lg p-2 border flex flex-col items-center gap-0.5"
                style={{ borderColor: `${GRADE_COLOR[m.grade]}55`, backgroundColor: `${GRADE_COLOR[m.grade]}10` }}>
                <span className="text-[13px] text-text-tertiary">{m.month}월</span>
                <span className="text-[14px] font-bold" style={{ color: GRADE_COLOR[m.grade] }}>{m.grade}</span>
                <span className="text-[12px] text-text-secondary">{m.keyword}</span>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* 신년운세 종합 리포트 6섹션 */}
      {isYear && newyearSections && Object.keys(newyearSections).length > 0 && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="mb-3"
        >
          <div className="text-[15px] font-semibold text-text-secondary mb-2 px-1 uppercase tracking-wider">
            {(year ?? new Date().getFullYear())}년 종합 리포트
          </div>
          <div className="space-y-2">
            {NEWYEAR_SECTION_KEYS.map((key, idx) => {
              const text = newyearSections[key];
              if (!text) return null;
              // 공통 파서로 [은유] 마커 우선 추출 + 본문 strip. 마커 못 잡으면 첫 줄 fallback.
              const parsed = extractMetaphor(text);
              let metaphorTitle = parsed.metaphorTitle;
              let rawBody = parsed.bodyText;
              if (!metaphorTitle) {
                const lines = rawBody.split('\n');
                metaphorTitle = lines[0]?.trim() ?? '';
                rawBody = lines.slice(1).join('\n').trim();
              }
              if (key === 'monthly' && /^\d{1,2}월\s*\(/.test(metaphorTitle)) {
                rawBody = parsed.bodyText;
                metaphorTitle = '';
              }
              const bodyText = key === 'monthly' ? rawBody : rawBody.replace(/\n(?!\n)/g, ' ');
              return (
                <motion.div key={key}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 * idx }}
                  className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-block w-1 h-5 rounded-full bg-cta" />
                    <div className="text-[17px] font-bold text-text-primary tracking-tight break-keep" style={{ fontFamily: 'var(--font-title)' }}>
                      {NEWYEAR_SECTION_LABELS[key]}
                    </div>
                  </div>
                  {metaphorTitle && (
                    <div className="text-[17px] font-bold leading-snug text-cta/90 mb-4 pl-3 break-keep" style={{ fontFamily: 'var(--font-title)' }}>
                      {metaphorTitle}
                    </div>
                  )}
                  {key === 'monthly' ? (
                    <div className="space-y-3">
                      {(bodyText.includes('\n\n')
                        ? bodyText.split(/\n\n+/)
                        : bodyText.split(/(?=\d{1,2}월\s*\()/)
                      ).filter(Boolean).map((monthBlock, mi) => (
                        <p key={mi} className="text-[15px] text-text-secondary leading-relaxed break-keep">
                          {monthBlock.replace(/\n/g, ' ').trim()}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[15px] text-text-secondary leading-relaxed whitespace-pre-line break-keep">
                      {bodyText}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* 지정일 7섹션 풀이 */}
      {isDate && pickedDateSections && Object.keys(pickedDateSections).length > 0 && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
        >
          <div className="text-[15px] font-semibold text-text-secondary mb-3 px-1 uppercase tracking-wider">
            이 날의 종합 풀이
          </div>
          <div className="space-y-3">
            {PICKED_DATE_SECTION_KEYS.map((key, idx) => {
              const text = pickedDateSections[key];
              if (!text) return null;
              // 공통 파서로 [은유] 마커 우선 추출 + 본문 strip. 마커 못 잡으면 첫 줄 fallback.
              const parsed = extractMetaphor(text);
              let metaphorTitle = parsed.metaphorTitle;
              let bodyText = parsed.bodyText;
              if (!metaphorTitle) {
                const lines = bodyText.split('\n');
                metaphorTitle = lines[0]?.trim() ?? '';
                bodyText = lines.slice(1).join('\n').trim();
              }
              return (
                <motion.div key={key}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * idx }}
                  className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-block w-1 h-5 rounded-full bg-cta" />
                    <div className="text-[17px] font-bold text-text-primary tracking-tight break-keep" style={{ fontFamily: 'var(--font-title)' }}>
                      {PICKED_DATE_SECTION_LABELS[key]}
                    </div>
                  </div>
                  {metaphorTitle && (
                    <div className="text-[17px] font-bold leading-snug text-cta/90 mb-4 pl-3 break-keep" style={{ fontFamily: 'var(--font-title)' }}>
                      {metaphorTitle}
                    </div>
                  )}
                  <div className="text-[15px] text-text-secondary leading-relaxed break-keep space-y-3">
                    {bodyText.split(/\n\n+/).map((para, pi) => (
                      <p key={pi} className="whitespace-pre-line">{para.trim()}</p>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      )}
    </>
  );
}
