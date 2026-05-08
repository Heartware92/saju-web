'use client';

import { motion } from 'framer-motion';
import {
  TODAY_V3_SECTION_KEYS, TODAY_V3_SECTION_LABELS,
  TODAY_V3_DOMAIN_KEYS, TODAY_V3_DOMAIN_LABELS,
  TODAY_TIME_SLOT_LABELS,
  type TodayTimeSlot,
} from '@/constants/prompts';
import { TODAY_PERSONA_EXTRA_LABEL } from '@/constants/sajuKnowledgeBase';
import {
  parseTodayV3Sections, parseTodayV3DomainScores, parseTodayV3FlowScores,
  stripStrayMarkers,
} from '@/services/fortuneService';
import { computeSajuFromProfile } from '@/utils/profileSaju';
import type { BirthProfile } from '@/types/credit';

interface Props {
  record: Record<string, any>;
}

function scoreColor(s: number): string {
  return s >= 75 ? '#34D399' : s >= 60 ? '#A78BFA' : s >= 45 ? '#FBBF24' : s >= 30 ? '#FB923C' : '#F87171';
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const c = scoreColor(score);
  const r = size * 0.4;
  const C = 2 * Math.PI * r;
  const offset = C * (1 - score / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={size * 0.083} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={c} strokeWidth={size * 0.083} strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + size * 0.08} textAnchor="middle" fontSize={size * 0.32} fontWeight="bold" fill="white">{score}</text>
    </svg>
  );
}

function DomainBars({ scores }: { scores: Record<string, number> }) {
  return (
    <div className="space-y-2.5">
      {TODAY_V3_DOMAIN_KEYS.map(k => {
        const v = scores[k] ?? 50;
        const c = scoreColor(v);
        return (
          <div key={k} className="flex items-center gap-3">
            <span className="text-[12.5px] text-text-tertiary w-[68px] shrink-0 text-right">
              {TODAY_V3_DOMAIN_LABELS[k]}
            </span>
            <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full" style={{ backgroundColor: c, width: `${v}%`, transition: 'width 0.6s ease-out' }} />
            </div>
            <span className="text-[13px] font-semibold w-7 text-right" style={{ color: c }}>{v}</span>
          </div>
        );
      })}
    </div>
  );
}

function FlowChart({ flow, currentSlot }: { flow: Record<TodayTimeSlot, number>; currentSlot?: TodayTimeSlot }) {
  const slots: TodayTimeSlot[] = ['midnight', 'morning', 'afternoon', 'evening'];
  const points = slots.map((s, i) => ({ x: 30 + i * 80, y: 110 - (flow[s] ?? 50) * 0.85, slot: s, score: flow[s] ?? 50 }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  return (
    <svg viewBox="0 0 290 140" className="w-full">
      <line x1="20" y1="110" x2="270" y2="110" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <line x1="20" y1="68"  x2="270" y2="68"  stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
      <line x1="20" y1="25"  x2="270" y2="25"  stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
      <path d={path} fill="none" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`${path} L${points[points.length-1].x},110 L${points[0].x},110 Z`} fill="url(#shareTodayFlow)" opacity="0.35" />
      <defs>
        <linearGradient id="shareTodayFlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
        </linearGradient>
      </defs>
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={p.slot === currentSlot ? 6 : 4} fill="#A78BFA" stroke="#1C1033" strokeWidth="2" />
          <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#A78BFA">{p.score}</text>
          <text x={p.x} y={128} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.7)">
            {TODAY_TIME_SLOT_LABELS[p.slot]}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function TodayResultBlock({ record }: Props) {
  const content: string = record.interpretation_detailed || record.interpretation_basic || '';
  const sections = parseTodayV3Sections(content);
  const domainScores = parseTodayV3DomainScores(content);
  const flowScores = parseTodayV3FlowScores(content);

  const eng = (record.engine_result ?? {}) as any;
  const todayGz = eng.todayGz as { hanja?: string; ganElement?: string; zhiElement?: string; tenGodGan?: string; interactions?: string[] } | undefined;
  const userContext = eng.userContext as { hobbies?: string[]; customHobby?: string; timeSlot?: TodayTimeSlot; jobState?: string; loveState?: string } | undefined;
  const isoDate = eng.isoDate as string | undefined;

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
  const result = computeSajuFromProfile(profile);

  const reportDateStr = isoDate
    ? new Date(isoDate).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })
    : '';
  const overall = domainScores?.overall ?? 0;
  const ctxLabel = userContext?.timeSlot
    ? `${TODAY_TIME_SLOT_LABELS[userContext.timeSlot]} · ${userContext.hobbies?.[0] ?? userContext.customHobby ?? '자기계발'}`
    : null;

  return (
    <>
      {/* 1. 일진·날짜 카드 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl px-5 py-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
      >
        <div className="flex items-center justify-between">
          <div>
            {reportDateStr && <div className="text-[14px] text-text-tertiary mb-1">{reportDateStr}</div>}
            {result && (
              <div className="text-[15px] font-semibold text-text-secondary">
                내 일주: <span className="text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
                  {result.pillars.day.gan}{result.pillars.day.zhi}
                </span>
              </div>
            )}
            {ctxLabel && <div className="text-[12px] text-text-tertiary mt-1">{ctxLabel} 기준 풀이</div>}
          </div>
          {todayGz && (
            <div className="text-right">
              <div className="text-[13px] text-text-tertiary mb-0.5">오늘 일진</div>
              {todayGz.hanja && (
                <div className="text-[26px] font-bold text-text-primary leading-none" style={{ fontFamily: 'var(--font-serif)' }}>
                  {todayGz.hanja}
                </div>
              )}
              {(todayGz.ganElement || todayGz.zhiElement || todayGz.tenGodGan) && (
                <div className="text-[13px] text-text-tertiary mt-0.5">
                  {todayGz.ganElement}·{todayGz.zhiElement}
                  {todayGz.tenGodGan ? ` · ${todayGz.tenGodGan}` : ''}
                </div>
              )}
              {todayGz.interactions && todayGz.interactions.length > 0 && (
                <div className="text-[11px] text-text-tertiary mt-0.5 max-w-[140px] truncate">
                  {todayGz.interactions[0]}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* 2. 종합 점수 ring */}
      {domainScores && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl px-5 py-5 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] flex items-center gap-5"
        >
          <ScoreRing score={overall} />
          <div className="flex-1">
            <div className="text-[15px] font-bold text-text-primary mb-1" style={{ fontFamily: 'var(--font-serif)' }}>
              오늘의 종합 점수
            </div>
            <p className="text-[12.5px] text-text-tertiary leading-relaxed">
              사주 원국과 4층 운기(대운·세운·월운·일진)를 종합한 오늘 하루의 전체 기운
            </p>
          </div>
        </motion.div>
      )}

      {/* 3. 항목별 점수 9개 */}
      {domainScores && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl px-5 py-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block w-1 h-5 rounded-full bg-cta" />
            <h3 className="text-[16px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
              항목별 운세
            </h3>
          </div>
          <DomainBars scores={domainScores as unknown as Record<string, number>} />
        </motion.div>
      )}

      {/* 4. 시간대별 흐름 */}
      {flowScores && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl px-5 py-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block w-1 h-5 rounded-full bg-cta" />
            <h3 className="text-[16px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
              시간대별 흐름
            </h3>
          </div>
          <FlowChart flow={flowScores} currentSlot={userContext?.timeSlot} />
        </motion.div>
      )}

      {/* 5. 본문 11 섹션 (today_persona_extra 포함) */}
      <div className="space-y-2">
        {TODAY_V3_SECTION_KEYS.map((key, idx) => {
          const text = sections[key];
          if (!text) return null;
          const safe = stripStrayMarkers(text);
          const lines = safe.split('\n');
          const firstLine = lines[0]?.trim() ?? '';
          const hasMetaphor = lines.length > 1 && firstLine.length > 0 && firstLine.length <= 40 && !firstLine.endsWith('.');
          const metaphorTitle = hasMetaphor ? firstLine : '';
          const bodyText = hasMetaphor ? lines.slice(1).join('\n').trim() : safe;

          const headerLabel = (() => {
            if (key === 'today_hobby_method' && userContext) {
              const primary = userContext.hobbies?.[0] ?? userContext.customHobby ?? '자기계발';
              return `${primary} 운용법`;
            }
            if (key === 'today_persona_extra' && userContext?.jobState) {
              return TODAY_PERSONA_EXTRA_LABEL[userContext.jobState] ?? TODAY_V3_SECTION_LABELS[key];
            }
            return TODAY_V3_SECTION_LABELS[key];
          })();

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * idx }}
              className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-1 h-5 rounded-full bg-cta" />
                <div className="text-[17px] font-bold text-text-primary tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
                  {headerLabel}
                </div>
              </div>
              {metaphorTitle && (
                <div className="text-[15px] font-medium leading-snug text-cta/90 mb-4 pl-3" style={{ fontFamily: 'var(--font-serif)' }}>
                  {metaphorTitle}
                </div>
              )}
              <div className="text-[15px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
                {bodyText.split(/\n\n+/).map((para, pi) => (
                  <p key={pi} className="whitespace-pre-line">{para.trim()}</p>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}
