'use client';

import { motion } from 'framer-motion';
import { SAJU_CATEGORY_LABEL } from '@/constants/adminLabels';
import {
  JUNGTONGSAJU_SECTION_KEYS, JUNGTONGSAJU_SECTION_LABELS,
  NEWYEAR_SECTION_KEYS, NEWYEAR_SECTION_LABELS,
  PICKED_DATE_SECTION_KEYS, PICKED_DATE_SECTION_LABELS,
  ZAMIDUSU_SECTION_KEYS, ZAMIDUSU_SECTION_LABELS,
  TOJEONG_SECTION_KEYS, TOJEONG_SECTION_LABELS,
  TODAY_V3_DOMAIN_KEYS, TODAY_V3_DOMAIN_LABELS,
  TODAY_TIME_SLOT_LABELS,
  type TodayTimeSlot,
} from '@/constants/prompts';
import {
  parseJungtongsaju, parseNewyearReport,
  parsePickedDateReport, parseZamidusuSections, parseTojeongSections,
  parseTodayV3DomainScores, parseTodayV3FlowScores, parseTojeongScores,
} from '@/services/fortuneService';
import { parseGunghapHeader } from '@/lib/gunghap';
import { extractMetaphor } from '@/utils/parseMetaphor';
import { renderEmphasis } from '@/utils/renderEmphasis';
import { GunghapResultBlock } from '@/components/gunghap/GunghapResultBlock';
import { RadarChart } from '@/components/charts/RadarChart';
import { SajuTraditionalResultBlock } from '@/components/share/blocks/SajuTraditionalResultBlock';
import { TodayResultBlock } from '@/components/share/blocks/TodayResultBlock';
import { TojeongResultBlock } from '@/components/share/blocks/TojeongResultBlock';
import { PeriodResultBlock } from '@/components/share/blocks/PeriodResultBlock';
import { TaekilResultBlock } from '@/components/share/blocks/TaekilResultBlock';
import { MoreResultBlock } from '@/components/share/blocks/MoreResultBlock';
import { MORE_FORTUNE_ORDER } from '@/constants/moreFortunes';
import { ZamidusuResultBlock } from '@/components/share/blocks/ZamidusuResultBlock';

interface Props {
  type: 'saju' | 'tarot';
  record: Record<string, any>;
}

type SectionConfig = {
  keys: readonly string[];
  labels: Record<string, string>;
  parser: (raw: string) => Partial<Record<string, string>>;
};

const SECTION_MAP: Record<string, SectionConfig> = {
  traditional: { keys: JUNGTONGSAJU_SECTION_KEYS, labels: JUNGTONGSAJU_SECTION_LABELS, parser: parseJungtongsaju },
  newyear:     { keys: NEWYEAR_SECTION_KEYS,      labels: NEWYEAR_SECTION_LABELS,      parser: parseNewyearReport },
  // today 카테고리는 TodayResultBlock 으로 직접 렌더링하므로 SECTION_MAP 항목 불필요
  date:        { keys: PICKED_DATE_SECTION_KEYS,   labels: PICKED_DATE_SECTION_LABELS,  parser: parsePickedDateReport },
  zamidusu:    { keys: ZAMIDUSU_SECTION_KEYS,      labels: ZAMIDUSU_SECTION_LABELS,      parser: parseZamidusuSections },
  tojeong:     { keys: TOJEONG_SECTION_KEYS,       labels: TOJEONG_SECTION_LABELS,       parser: parseTojeongSections as (raw: string) => Partial<Record<string, string>> },
};

/**
 * ▶ 섹션 마커 기반 범용 파서 — 궁합·택일·기간운세·더많은운세 등
 * [tag] 블록을 제거하고 ▶ 마커로 섹션을 분리합니다.
 */
function universalSectionParser(raw: string): { sections: { title: string; body: string }[] } {
  let cleaned = raw
    .replace(/\[gunghap_header\][\s\S]*?\[\/gunghap_header\]/g, '')
    .replace(/\[gunghap_scores\][\s\S]*?\[\/gunghap_scores\]/g, '')
    .replace(/\[tojeong_scores\][\s\S]*?\[\/tojeong_scores\]/g, '')
    .replace(/\[today_scores\][^\n]*\n?/g, '')
    .replace(/\[today_flow\][^\n]*\n?/g, '')
    .replace(/\[.*?\]/g, '')
    .trim();

  const parts: { title: string; body: string }[] = [];
  const lines = cleaned.split('\n');
  let currentTitle = '';
  let currentBody: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('▶')) {
      if (currentTitle || currentBody.length > 0) {
        parts.push({ title: currentTitle, body: currentBody.join('\n').trim() });
      }
      currentTitle = trimmed.replace(/^▶\s*/, '').replace(/\s*\(.*?\)\s*$/, '');
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  if (currentTitle || currentBody.length > 0) {
    parts.push({ title: currentTitle, body: currentBody.join('\n').trim() });
  }

  return { sections: parts.filter(p => p.body.length > 0) };
}

// ─── 점수 → 색상/등급 (오늘의 운세·토정비결 공통) ───
function scoreColor(s: number): string {
  return s >= 75 ? '#34D399' : s >= 60 ? '#A78BFA' : s >= 45 ? '#FBBF24' : s >= 30 ? '#FB923C' : '#F87171';
}

// ─── 오늘의 운세 — 시간대 흐름 SVG ───
function TodayFlowChart({ flow }: { flow: { midnight: number; morning: number; afternoon: number; evening: number } }) {
  const slots: TodayTimeSlot[] = ['midnight', 'morning', 'afternoon', 'evening'];
  const points = slots.map((s, i) => ({ x: 30 + i * 80, y: 110 - (flow[s] ?? 50) * 0.85, slot: s, score: flow[s] ?? 50 }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  return (
    <svg viewBox="0 0 290 140" className="w-full">
      <line x1="20" y1="110" x2="270" y2="110" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      <line x1="20" y1="68"  x2="270" y2="68"  stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
      <line x1="20" y1="25"  x2="270" y2="25"  stroke="rgba(255,255,255,0.05)" strokeDasharray="2 4" />
      <path d={path} fill="none" stroke="#A78BFA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`${path} L${points[points.length-1].x},110 L${points[0].x},110 Z`} fill="url(#shareFlowGrad)" opacity="0.35" />
      <defs>
        <linearGradient id="shareFlowGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
        </linearGradient>
      </defs>
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="#A78BFA" stroke="#1C1033" strokeWidth="2" />
          <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#A78BFA">{p.score}</text>
          <text x={p.x} y={128} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.7)">
            {TODAY_TIME_SLOT_LABELS[p.slot]}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── 오늘의 운세 — 9도메인 점수 바 ───
function TodayDomainBars({ scores }: { scores: Record<string, number> }) {
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

// ─── 토정비결 — 4영역 레이더 ───
function TojeongRadarBlock({ scores }: { scores: { wealth: number; love: number; health: number; career: number } }) {
  const domains = [
    { label: '재물', score: scores.wealth, color: scoreColor(scores.wealth) },
    { label: '애정', score: scores.love, color: scoreColor(scores.love) },
    { label: '건강', score: scores.health, color: scoreColor(scores.health) },
    { label: '직장', score: scores.career, color: scoreColor(scores.career) },
  ];
  return (
    <div>
      <RadarChart domains={domains} size={240} />
      <div className="space-y-2 mt-3">
        {domains.map(d => (
          <div key={d.label} className="flex items-center gap-2">
            <div className="w-14 shrink-0 text-[14px] font-semibold text-text-secondary">{d.label}</div>
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full" style={{ backgroundColor: d.color, width: `${d.score}%` }} />
            </div>
            <div className="w-8 text-right text-[14px] font-bold" style={{ color: d.color }}>{d.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 택일 — 길일 카드 (engine_result 의 bestDays 또는 days 일부 사용) ───
type TaekilDayLite = { date: string; grade?: string; rank?: number; score?: number };
function TaekilRankBlock({ days, customLabel }: { days: TaekilDayLite[]; customLabel?: string }) {
  const GRADE_BG: Record<string, string> = {
    '대길': 'rgba(52,211,153,0.18)',
    '길': 'rgba(134,239,172,0.16)',
    '중길': 'rgba(251,191,36,0.16)',
    '평': 'rgba(203,213,225,0.12)',
    '중흉': 'rgba(251,146,60,0.16)',
    '흉': 'rgba(248,113,113,0.16)',
  };
  const GRADE_FG: Record<string, string> = {
    '대길': '#34D399', '길': '#86EFAC', '중길': '#FBBF24',
    '평': '#CBD5E1', '중흉': '#FB923C', '흉': '#F87171',
  };
  const top = days.slice(0, 5);
  return (
    <div className="rounded-2xl mb-4 p-5 bg-gradient-to-br from-teal-500/15 to-emerald-500/8 border border-white/15">
      <p className="text-[14px] font-semibold text-text-secondary text-center mb-3">
        {customLabel ? `${customLabel} — 추천 일자` : '추천 일자'}
      </p>
      <div className="space-y-2">
        {top.map((d, i) => {
          const g = d.grade ?? '평';
          return (
            <div key={d.date}
              className="flex items-center justify-between px-4 py-3 rounded-xl border"
              style={{ backgroundColor: GRADE_BG[g] ?? GRADE_BG['평'], borderColor: `${GRADE_FG[g] ?? '#CBD5E1'}55` }}
            >
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-bold text-text-tertiary w-5">{i + 1}</span>
                <span className="text-[15px] font-semibold text-text-primary">{d.date.replace(/-/g, '.')}</span>
              </div>
              <span className="text-[13px] font-bold" style={{ color: GRADE_FG[g] ?? '#CBD5E1' }}>{g}{d.score != null ? ` · ${d.score}` : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SharePageClient({ type, record }: Props) {
  const category: string = type === 'saju' ? record.category : 'tarot';
  const label = type === 'saju'
    ? SAJU_CATEGORY_LABEL[category] ?? '사주 풀이'
    : '타로 리딩';

  const content = record.interpretation_detailed || record.interpretation_basic || record.interpretation || '';

  // 궁합: 점수 원·레이더 차트·점수 바를 본문 위에 그대로 렌더 (결과 페이지와 동일)
  const isGunghap = type === 'saju' && category === 'gunghap';
  const gunghapHeader = isGunghap ? parseGunghapHeader(content) : null;
  // 궁합 본문은 헤더/스코어 블록을 제거한 body 만 섹션 파서에 넘긴다
  const bodyForSections = gunghapHeader ? gunghapHeader.body : content;

  // 오늘의 운세 — 점수·시간대 흐름
  const isToday = type === 'saju' && category === 'today';
  const todayDomainScores = isToday ? parseTodayV3DomainScores(content) : undefined;
  const todayFlowScores = isToday ? parseTodayV3FlowScores(content) : undefined;

  // 토정비결 — 4영역 점수
  const isTojeong = type === 'saju' && category === 'tojeong';
  const tojeongScores = isTojeong ? parseTojeongScores(content) : undefined;
  const tojeongGrade = (record.engine_result as any)?.gwae?.grade as string | undefined;
  const tojeongHexagram = (record.engine_result as any)?.gwae?.name as string | undefined;

  // 택일 — engine_result.bestDays 사용
  const isTaekil = type === 'saju' && category === 'taekil';
  const taekilDays = isTaekil ? (record.engine_result as any)?.bestDays as TaekilDayLite[] | undefined : undefined;
  const taekilCustom = isTaekil ? (record.engine_result as any)?.customLabel as string | undefined : undefined;

  // 정통사주 — 결과 페이지와 동일한 풀 컴포넌트 사용
  const isTraditional = type === 'saju' && category === 'traditional';

  // 신년운세 / 지정일 운세 — PeriodResultBlock 으로 위임
  const isNewyear = type === 'saju' && category === 'newyear';
  const isPeriod = type === 'saju' && category === 'period';

  // 더많은운세 10종
  const isMore = type === 'saju' && (MORE_FORTUNE_ORDER as readonly string[]).includes(category);

  // 자미두수
  const isZamidusu = type === 'saju' && category === 'zamidusu';

  const config = SECTION_MAP[category];
  const useUniversal = !config;
  const universalResult = useUniversal ? universalSectionParser(bodyForSections) : null;

  const sections = config ? config.parser(bodyForSections) : {};
  const sectionKeys = config ? config.keys : [];
  const sectionLabels = config ? config.labels : {};

  const profileName = record.profile_name;
  const birthDate = record.birth_date;
  const createdAt = record.created_at;

  return (
    <div className="min-h-screen px-4 pt-4 pb-12 max-w-[430px] mx-auto">
      {/* 브랜드 헤더 */}
      <div className="text-center mb-6">
        <a href="/" className="inline-block">
          <h1
            className="text-lg font-bold bg-gradient-to-r from-sun-core via-cta to-moon-halo bg-clip-text text-transparent"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            이천점
          </h1>
        </a>
      </div>

      {/* 카테고리 + 프로필 정보 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl px-5 py-4 mb-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
      >
        <div
          className="text-[18px] font-bold text-text-primary mb-1"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {label}
        </div>
        <div className="text-[13px] text-text-tertiary space-x-2">
          {profileName && <span>{profileName}</span>}
          {birthDate && <span>{birthDate.replace(/-/g, '.')}</span>}
          {record.partner_name && (
            <span>
              {'& '}{record.partner_name}
              {record.partner_birth_date && ` (${record.partner_birth_date.replace(/-/g, '.')})`}
            </span>
          )}
        </div>
        {createdAt && (
          <div className="text-[12px] text-text-tertiary mt-1">
            {new Date(createdAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        )}
      </motion.div>

      {/* 궁합 점수·레이더 차트 — 결과 페이지와 동일한 시각 블록 */}
      {isGunghap && gunghapHeader && gunghapHeader.score != null && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <GunghapResultBlock
            title={gunghapHeader.title}
            score={gunghapHeader.score}
            domainScores={gunghapHeader.domainScores}
          />
        </motion.div>
      )}

      {/* 오늘의 운세 — 결과 페이지 풀 시각 (일진·종합·9도메인·시간대·10섹션) */}
      {isToday && (
        <TodayResultBlock record={record} />
      )}

      {/* 토정비결 — 결과 페이지 풀 시각 (괘·괘사·총평·월별·조언·AI 영역점수·6섹션) */}
      {isTojeong && (
        <TojeongResultBlock record={record} />
      )}

      {/* 택일 — 결과 페이지 풀 시각 (포디움·점수바·날짜별 상세·피해야 할 날) */}
      {isTaekil && (
        <TaekilResultBlock record={record} />
      )}

      {/* 정통사주 — 핵심요약 + 만세력 보드 + 9섹션 카드 (결과 페이지 풀 시각) */}
      {isTraditional && (
        <SajuTraditionalResultBlock record={record} />
      )}

      {/* 신년운세 / 지정일 운세 — 점수링·레이더·월별흐름·6or7섹션 (결과 페이지 풀 시각) */}
      {(isNewyear || isPeriod) && (
        <PeriodResultBlock record={record} />
      )}

      {/* 더많은운세 10종 — 결과 페이지 풀 시각 (이름·꿈 입력 + 카드) */}
      {isMore && (
        <MoreResultBlock record={record} />
      )}

      {/* 자미두수 — 결과 페이지 풀 시각 (명반 12궁·6궁 레이더·사화·대한·7섹션) */}
      {isZamidusu && (
        <ZamidusuResultBlock record={record} />
      )}

      {/* 타로 질문 */}
      {type === 'tarot' && record.question && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl px-5 py-4 mb-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
        >
          <div className="text-[13px] text-text-tertiary mb-1">질문</div>
          <div className="text-[15px] text-text-secondary">{record.question}</div>
        </motion.div>
      )}

      {/* 섹션 카드 — 전용 파서가 있는 카테고리 (자체 블록이 처리하는 카테고리는 제외) */}
      {!useUniversal && !isTraditional && !isToday && !isTojeong && !isNewyear && !isPeriod && !isZamidusu && (
        <div className="space-y-2">
          {(sectionKeys as readonly string[]).map((key, idx) => {
            const text = sections[key as string];
            if (!text) return null;

            const sLabel = (sectionLabels as Record<string, string>)[key as string] ?? '';
            return (
              <SectionCard key={key} label={sLabel} text={text} idx={idx} />
            );
          })}
        </div>
      )}

      {/* 섹션 카드 — 범용 파서 (자체 블록이 처리하는 카테고리는 제외)
          ★ 궁합: 위 GunghapResultBlock 은 점수·차트만 렌더하므로, 본문(▶ 섹션)은 여기서 그린다.
            (회귀 사고: 점수 블록 추가 시 !isGunghap 으로 본문까지 막혀 해설이 통째로 사라졌었음) */}
      {useUniversal && universalResult && !isTaekil && !isMore && (
        <div className="space-y-2">
          {universalResult.sections.map((sec, idx) => (
            <SectionCard key={idx} label={sec.title} text={sec.body} idx={idx} />
          ))}
        </div>
      )}

      {/* CTA 배너 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-center"
      >
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cta to-cta-active text-white font-bold text-[15px] shadow-lg shadow-cta/20"
        >
          나도 운세 보러 가기
        </a>
        <p className="text-[12px] text-text-tertiary mt-2">
          이천점 — 우주의 기운을 드려요
        </p>
      </motion.div>
    </div>
  );
}

function SectionCard({ label, text, idx }: { label: string; text: string; idx: number }) {
  // 공통 파서로 교체 — 다양한 [은유] 마커 변형과 본문 잔존 마커 strip 까지 한 번에 처리.
  const { metaphorTitle, bodyText } = extractMetaphor(text);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.07 * idx }}
      className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]"
    >
      {label && (
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-block w-1 h-5 rounded-full bg-cta" />
          <div
            className="text-[17px] font-bold text-text-primary tracking-tight"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {label}
          </div>
        </div>
      )}

      {metaphorTitle && (
        <div
          className="text-[17px] font-bold leading-snug text-cta/90 mb-4 pl-3"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {metaphorTitle}
        </div>
      )}

      <div className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
        {bodyText.split(/\n\n+/).map((para, pi) => (
          <p key={pi} className="whitespace-pre-line">{renderEmphasis(para.trim())}</p>
        ))}
      </div>
    </motion.div>
  );
}
