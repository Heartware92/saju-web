'use client';

/**
 * TodayResultView — 오늘의 운세 "결과 본문" 공유 렌더러.
 * 제품 페이지(TodayFortunePage)와 temp_test 가 동일 코드를 쓰도록 결과 렌더 JSX를 추출.
 * (헤더·공유바·푸터·모달 등 인터랙션은 제품 페이지가 따로 감싼다 — 여기는 순수 결과 뷰)
 *
 * 1:1 보장: 제품/temp_test 모두 이 컴포넌트를 호출하므로 일진 카드·입력 요약·종합 점수·
 * 항목별 운세·시간대 흐름·11 섹션(+섹션별 시각 카드)이 픽셀 단위로 동일하게 나온다.
 */

import { motion } from 'framer-motion';
import { extractMetaphor } from '../../utils/parseMetaphor';
import { renderEmphasizedBody } from '../../utils/renderEmphasizedBody';
import { SectionCollapsible } from './SectionCollapsible';
import { renderTodaySectionVisual } from './TodaySectionVisuals';
import { stripStrayMarkers, type TodayFortuneV3AIResult } from '../../services/fortuneService';
import { TODAY_PERSONA_EXTRA_LABEL } from '../../constants/sajuKnowledgeBase';
import type { SajuResult } from '../../utils/sajuCalculator';
import {
  TODAY_V3_SECTION_KEYS,
  TODAY_V3_SECTION_LABELS,
  TODAY_V3_DOMAIN_KEYS,
  TODAY_V3_DOMAIN_LABELS,
  TODAY_TIME_SLOT_LABELS,
  type TodayTimeSlot,
  type TodayV3DomainKey,
} from '../../constants/prompts';

// ─── 사용자 입력 요약 카드 — 사주아이 스타일 행 단위 리스트 ───
type SummaryRow = { icon: React.ReactNode; label: string; value: string };

function UserInputSummary({ rows }: { rows: SummaryRow[] }) {
  if (rows.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 }}
      className="rounded-2xl px-5 py-2 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
    >
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex items-center gap-3 py-3"
          style={{
            borderBottom: i < rows.length - 1 ? '1px solid rgba(244,194,161,0.10)' : 'none',
          }}
        >
          <span className="shrink-0 w-5 h-5 flex items-center justify-center">{r.icon}</span>
          <span className="text-[13px] text-text-tertiary w-12 shrink-0">{r.label}</span>
          <span className="text-[15px] text-text-primary flex-1 break-words" style={{ fontFamily: 'var(--font-body)', letterSpacing: '0.02em' }}>
            {r.value}
          </span>
        </div>
      ))}
    </motion.div>
  );
}

// 아이콘 helper — 외부 라이브러리 없이 인라인 SVG
const Icon = {
  Heart: ({ color }: { color: string }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  Briefcase: ({ color }: { color: string }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  Sparkles: ({ color }: { color: string }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
    </svg>
  ),
  Clock: ({ color }: { color: string }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Star: ({ color }: { color: string }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
};

function ScoreRing({ score, size = 132 }: { score: number; size?: number }) {
  const r = size * 0.4;
  const C = 2 * Math.PI * r;
  const offset = C * (1 - score / 100);
  const color = score >= 75 ? '#34D399' : score >= 60 ? '#86EFAC' : score >= 45 ? '#FBBF24' : score >= 30 ? '#FB923C' : '#F87171';
  const grade = score >= 75 ? '대길' : score >= 60 ? '길' : score >= 45 ? '평' : score >= 30 ? '주의' : '경계';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={size * 0.083} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={size * 0.083} strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
      />
      <text x={size / 2} y={size / 2 - 2} textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.26} fontWeight="bold" fill="white">{score}</text>
      <text x={size / 2} y={size / 2 + size * 0.18} textAnchor="middle" dominantBaseline="middle"
            fontSize={size * 0.09} fill="rgba(255,255,255,0.6)">점 · {grade}</text>
    </svg>
  );
}

function DomainBars({ scores }: { scores: Partial<Record<TodayV3DomainKey, number>> }) {
  return (
    <div className="space-y-2.5">
      {TODAY_V3_DOMAIN_KEYS.map((k) => {
        const v = scores[k] ?? 0;
        const c = v >= 75 ? '#34D399' : v >= 60 ? '#A78BFA' : v >= 45 ? '#FBBF24' : v >= 30 ? '#FB923C' : '#F87171';
        return (
          <div key={k} className="flex items-center gap-3">
            <span className="text-[12.5px] text-text-tertiary w-[68px] shrink-0 text-right">
              {TODAY_V3_DOMAIN_LABELS[k]}
            </span>
            <div className="flex-1 h-2.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${v}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
                className="h-full rounded-full"
                style={{ backgroundColor: c }}
              />
            </div>
            <span className="text-[13px] font-semibold w-7 text-right" style={{ color: c }}>{v}</span>
          </div>
        );
      })}
    </div>
  );
}

function FlowChart({ flow, currentSlot }: { flow: Record<TodayTimeSlot, number>; currentSlot: TodayTimeSlot }) {
  const slots: TodayTimeSlot[] = ['midnight', 'morning', 'afternoon', 'evening'];
  const points = slots.map((s, i) => ({ x: 30 + i * 80, y: 110 - (flow[s] ?? 50) * 0.85, slot: s, score: flow[s] ?? 50 }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  return (
    <div className="w-full">
      <svg viewBox="0 0 290 140" className="w-full">
        <line x1="20" y1="110" x2="270" y2="110" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1="20" y1="68"  x2="270" y2="68"  stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
        <line x1="20" y1="25"  x2="270" y2="25"  stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
        <path d={path} fill="none" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d={`${path} L${points[points.length-1].x},110 L${points[0].x},110 Z`}
          fill="url(#flowGrad)"
          opacity="0.35"
        />
        <defs>
          <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
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
    </div>
  );
}

export interface TodayResultViewProps {
  report: TodayFortuneV3AIResult;
  result: SajuResult;
  reportDateStr: string;
  ctxLabel: string | null;
  /** flow chart 강조용 fallback 시간대 (report.userContext 없을 때) */
  initialSlot: TodayTimeSlot;
}

export function TodayResultView({ report, result, reportDateStr, ctxLabel, initialSlot }: TodayResultViewProps) {
  const todayGz = report?.todayGz;
  const overall = report?.domainScores?.overall ?? 0;

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
            <div className="text-[14px] text-text-tertiary mb-1">{reportDateStr}</div>
            <div className="text-[15px] font-semibold text-text-secondary">
              내 일주: <span className="text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
                {result.pillars.day.gan}{result.pillars.day.zhi}
              </span>
            </div>
            {ctxLabel && (
              <div className="text-[12px] text-text-tertiary mt-1">{ctxLabel} 기준 풀이</div>
            )}
          </div>
          {todayGz && (
            <div className="text-right">
              <div className="text-[13px] text-text-tertiary mb-0.5">오늘 일진</div>
              <div className="text-[26px] font-bold text-text-primary leading-none" style={{ fontFamily: 'var(--font-serif)' }}>
                {todayGz.hanja}
              </div>
              <div className="text-[13px] text-text-tertiary mt-0.5">
                {todayGz.ganElement}·{todayGz.zhiElement}
                {(todayGz.tenGodGan || todayGz.tenGodZhi) && ' · '}
                {todayGz.tenGodGan && `${todayGz.tenGodGan}(천간)`}
                {todayGz.tenGodGan && todayGz.tenGodZhi && '·'}
                {todayGz.tenGodZhi && `${todayGz.tenGodZhi}(지지)`}
              </div>
              {todayGz.interactions.length > 0 && (
                <div className="text-[11px] text-text-tertiary mt-0.5 max-w-[140px] truncate" title={todayGz.interactions.join(' / ')}>
                  {todayGz.interactions[0]}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* 1.5. 입력하신 정보 — 행 단위 리스트 (취미·직업·연애·시간대·답변1·2) */}
      {report?.userContext && (() => {
        const uc = report.userContext;
        const rows: SummaryRow[] = [];

        const hobbyList = [...(uc.hobbies ?? []), uc.customHobby].filter(Boolean) as string[];
        if (hobbyList.length > 0) {
          rows.push({ icon: <Icon.Sparkles color="#C4B5FD" />, label: '관심', value: hobbyList.join(', ') });
        }
        const jobVal = (uc.customJobState && uc.customJobState.trim()) || uc.jobState;
        if (jobVal) {
          rows.push({ icon: <Icon.Briefcase color="#93C5FD" />, label: '직업', value: jobVal });
        }
        const loveVal = (uc.customLoveState && uc.customLoveState.trim()) || uc.loveState;
        if (loveVal && loveVal !== '공개 안 함') {
          rows.push({ icon: <Icon.Heart color="#FCA5A5" />, label: '연애', value: loveVal });
        }
        rows.push({ icon: <Icon.Clock color="#FCD34D" />, label: '시간', value: TODAY_TIME_SLOT_LABELS[uc.timeSlot] ?? uc.timeSlot });
        if (uc.q1Answer && uc.q1Answer.trim()) {
          rows.push({ icon: <Icon.Star color="#F4C2A1" />, label: '답변', value: uc.q1Answer });
        }
        if (uc.q2Answer && uc.q2Answer.trim()) {
          rows.push({ icon: <Icon.Star color="#E8A490" />, label: '답변', value: uc.q2Answer });
        }
        return <UserInputSummary rows={rows} />;
      })()}

      {/* 2. 종합 점수 ring */}
      {report?.domainScores && (
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
      {report?.domainScores && (
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
          <DomainBars scores={report.domainScores} />
        </motion.div>
      )}

      {/* 4. 시간대별 흐름 그래프 */}
      {report?.flowScores && (
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
          <FlowChart flow={report.flowScores} currentSlot={report.userContext?.timeSlot ?? initialSlot} />
        </motion.div>
      )}

      {/* 에러 / rawText fallback */}
      {report?.error && (
        <div className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <p className="text-[14px] text-text-secondary">{report.error}</p>
        </div>
      )}
      {report?.rawText && (
        <div className="rounded-2xl p-4 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <p className="text-[15px] text-text-secondary leading-relaxed whitespace-pre-line">
            {stripStrayMarkers(report.rawText)}
          </p>
        </div>
      )}

      {/* 본문 11 섹션 (today_persona_extra 포함) */}
      {report?.sections && (
        <div className="space-y-2">
          {TODAY_V3_SECTION_KEYS.map((key, idx) => {
            const text = report.sections?.[key];
            if (!text) return null;

            const safe = stripStrayMarkers(text);
            const parsed = extractMetaphor(safe);
            let metaphorTitle = parsed.metaphorTitle;
            let bodyText = parsed.bodyText;
            if (!metaphorTitle) {
              const lines = bodyText.split('\n');
              const firstLine = lines[0]?.trim() ?? '';
              const hasMetaphor = lines.length > 1 && firstLine.length > 0 && firstLine.length <= 40 && !firstLine.endsWith('.');
              metaphorTitle = hasMetaphor ? firstLine : '';
              bodyText = hasMetaphor ? lines.slice(1).join('\n').trim() : bodyText;
            }

            const headerLabel = (() => {
              if (key === 'today_persona_extra' && report.userContext?.jobState) {
                return TODAY_PERSONA_EXTRA_LABEL[report.userContext.jobState] ?? TODAY_V3_SECTION_LABELS[key];
              }
              return TODAY_V3_SECTION_LABELS[key];
            })();

            return (
              <SectionCollapsible
                key={key}
                title={headerLabel}
                metaphorTitle={metaphorTitle}
                defaultOpen={idx === 0}
                enterDelay={0.05 * idx}
              >
                {/* 섹션별 시각 데이터 카드 — 본문 줄글 위 한눈 요약 */}
                {renderTodaySectionVisual(key, report)}
                <div className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
                  {bodyText.split(/\n\n+/).map((para, pi) => (
                    <p key={pi} className="whitespace-pre-line">{renderEmphasizedBody(para.trim())}</p>
                  ))}
                </div>
              </SectionCollapsible>
            );
          })}
        </div>
      )}
    </>
  );
}
