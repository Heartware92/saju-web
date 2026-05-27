'use client';

/**
 * 유년·유월 시기 예측 타임라인 + 라인 차트.
 *
 * 자운파 색채 — 자미두수 정통 시기 단위(대한·유년·유월·유일)를
 * 사용자가 즉시 알아보는 연도/월 라벨로 시각화.
 *
 * 각 시점 구성:
 *  - 천간·지지 라벨
 *  - 사화 4개 비행 (록·권·과·기 별)
 *  - 종합 점수 게이지 + 등급 라벨
 *  - 유월에는 짧은 한줄 의미 라벨 (사용자가 카드만 보고 의미 즉시 파악 가능하도록)
 *  - 부드러운 곡선 라인 차트 (정통사주 LifetimeFortuneChart 스타일)
 *
 * 헤더 스타일: DaehanTimeline과 동일한 "X(漢) — Y" 형식 (4px 사이드바 + serif 18px + 부제)
 */

import { useEffect, useRef } from 'react';
import type { YearlyHoroscope, MonthlyHoroscope } from '../../engine/zamidusu/horoscope';
import { MAJOR_STARS_META } from '../../engine/zamidusu/knowledge';

const MUTAGEN_COLOR: Record<string, string> = {
  록: '#fbbf24',
  권: '#a78bfa',
  과: '#34d399',
  기: '#f87171',
};

function MutagenChip({ type, star }: { type: '록' | '권' | '과' | '기'; star: string }) {
  if (!star) return null;
  const color = MUTAGEN_COLOR[type];
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded"
      style={{ backgroundColor: `${color}1f`, color, border: `1px solid ${color}55` }}
    >
      <span className="font-semibold">{type}</span>
      <span>{star}</span>
    </span>
  );
}

/**
 * 시기별 종합 점수 — 사화 4개 비행 별의 polarity 가중 합.
 * 범위 0~100, 기본 50.
 */
function calcWindowScore(mutagen: { 록: string; 권: string; 과: string; 기: string }): number {
  const polW = (star: string): number => {
    const p = MAJOR_STARS_META[star]?.polarity;
    return p === '선' ? 1 : p === '중' ? 0.6 : p === '부' ? 0.3 : 0.5;
  };
  let s = 50;
  if (mutagen.록) s += polW(mutagen.록) * 12;
  if (mutagen.권) s += polW(mutagen.권) * 10;
  if (mutagen.과) s += polW(mutagen.과) * 8;
  if (mutagen.기) s -= polW(mutagen.기) * 16;
  return Math.max(0, Math.min(100, Math.round(s)));
}

function scoreColor(score: number): string {
  if (score >= 60) return '#34d399';
  if (score >= 45) return '#fbbf24';
  return '#f87171';
}

function scoreLabel(score: number): string {
  if (score >= 75) return '대길';
  if (score >= 60) return '길';
  if (score >= 45) return '평';
  if (score >= 30) return '주의';
  return '흉';
}

/**
 * 사용자 친화 한 줄 의미 라벨 — "X 화기 → 영역 주의" / "Y 화록 → 영역 좋음" 식.
 * 사화 별의 본의 키워드 2개를 묶어 직관적 영역 전달.
 */
function makeWindowMeaning(mutagen: { 록: string; 권: string; 과: string; 기: string }, score: number): string {
  const giStar = mutagen.기;
  const rokStar = mutagen.록;
  const giMeta = MAJOR_STARS_META[giStar];
  const rokMeta = MAJOR_STARS_META[rokStar];

  if (score < 45 && giMeta) {
    const kw = giMeta.keywords.slice(0, 2).join('·');
    return `${giStar} 화기 → ${kw} 영역 주의`;
  }
  if (score >= 60 && rokMeta) {
    const kw = rokMeta.keywords.slice(0, 2).join('·');
    return `${rokStar} 화록 → ${kw} 흐름 좋음`;
  }
  // 평이 — 화권 별 키워드로 색채만 알림
  const gwonStar = mutagen.권;
  const gwonMeta = MAJOR_STARS_META[gwonStar];
  if (gwonMeta) {
    const kw = gwonMeta.keywords.slice(0, 2).join('·');
    return `${gwonStar} 화권 → ${kw} 활성화`;
  }
  return '평이한 흐름';
}

/** 점수 게이지 막대 */
function ScoreBar({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const color = scoreColor(score);
  const label = scoreLabel(score);
  const height = size === 'sm' ? 4 : 6;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full bg-space-deep overflow-hidden" style={{ height }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span
        className={`${size === 'sm' ? 'text-[10px]' : 'text-[11px]'} font-bold whitespace-nowrap`}
        style={{ color }}
      >
        {score} · {label}
      </span>
    </div>
  );
}

/**
 * 헤더 — DaehanTimeline과 동일 디자인 (4px 사이드바 + 18px serif + 부제).
 * 운흐름 wrapper 안에서 sub-section 헤더로 사용 가능.
 */
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: subtitle ? 14 : 18 }}>
        <span
          style={{
            display: 'inline-block',
            width: 4,
            height: 20,
            borderRadius: 2,
            background: 'var(--cta-primary)',
          }}
        />
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-serif)',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-tertiary)',
            lineHeight: 1.6,
            marginBottom: 14,
            paddingLeft: 12,
          }}
        >
          {subtitle}
        </div>
      )}
    </>
  );
}

// ============================================
// 라인 차트 — 정통사주 LifetimeFortuneChart 스타일
// ============================================

interface ChartPoint {
  label: string;     // x축 라벨 (예: "2026", "5월")
  score: number;     // 0~100
  isCurrent?: boolean;
}

/**
 * 부드러운 곡선 라인 차트 — Catmull-Rom → Bezier 변환.
 * 정통사주 LifetimeFortuneChart 동일 알고리즘.
 */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  const segs: string[] = [`M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t = 0.5;
    const c1x = p1.x + ((p2.x - p0.x) / 6) * t;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * t;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * t;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * t;
    segs.push(
      `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`,
    );
  }
  return segs.join(' ');
}

function FortuneLineChart({
  points,
  title,
  scrollable = false,
  focusIndex,
}: {
  points: ChartPoint[];
  title?: string;
  /** true 시 가로 스크롤 + 각 포인트에 충분한 간격 부여 (유월 12개월용) */
  scrollable?: boolean;
  /** 마운트 시 이 인덱스가 컨테이너 중앙에 오도록 자동 스크롤 */
  focusIndex?: number;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 가로 스크롤 모드: 한 포인트당 60px씩 확보 → 12개월이면 720px (스크롤 발생)
  // 일반 모드: 컨테이너 너비에 fit (400 viewBox)
  const W = scrollable ? Math.max(400, points.length * 60) : 400;
  const H = 160;
  const PAD_L = 28;
  const PAD_R = 16;
  const PAD_T = 22;
  const PAD_B = 36;
  const PLOT_W = W - PAD_L - PAD_R;
  const PLOT_H = H - PAD_T - PAD_B;

  useEffect(() => {
    if (!scrollable || focusIndex == null || !scrollRef.current) return;
    const el = scrollRef.current;
    const ratio = focusIndex / Math.max(points.length - 1, 1);
    const target = ratio * el.scrollWidth - el.clientWidth / 2;
    el.scrollLeft = Math.max(0, Math.min(target, el.scrollWidth - el.clientWidth));
  }, [scrollable, focusIndex, points.length]);

  if (points.length < 2) return null;

  const xOf = (i: number) => PAD_L + (i / (points.length - 1)) * PLOT_W;
  const yOf = (score: number) => PAD_T + (1 - score / 100) * PLOT_H;

  const smoothPts = points.map((p, i) => ({ x: xOf(i), y: yOf(p.score) }));
  const linePath = smoothPath(smoothPts);
  const areaPath = `${linePath} L${smoothPts[smoothPts.length - 1].x.toFixed(1)},${(PAD_T + PLOT_H).toFixed(1)} L${smoothPts[0].x.toFixed(1)},${(PAD_T + PLOT_H).toFixed(1)} Z`;

  const svgEl = (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={scrollable ? W : '100%'}
      height={scrollable ? H : undefined}
      style={{ display: 'block', maxWidth: scrollable ? 'none' : '100%' }}
      preserveAspectRatio="xMidYMid meet"
    >
        <defs>
          <linearGradient id="fortuneArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#FBBF24" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="fortuneLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#F87171" />
            <stop offset="50%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>
        </defs>

        {/* 점수 0/50/100 가이드 라인 */}
        {[0, 50, 100].map((v) => (
          <line
            key={v}
            x1={PAD_L}
            x2={W - PAD_R}
            y1={yOf(v)}
            y2={yOf(v)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
            strokeDasharray={v === 50 ? '4 4' : ''}
          />
        ))}

        {/* 영역 */}
        <path d={areaPath} fill="url(#fortuneArea)" />
        {/* 라인 */}
        <path d={linePath} fill="none" stroke="url(#fortuneLine)" strokeWidth="2.5" strokeLinecap="round" />

        {/* 각 포인트 */}
        {smoothPts.map((pt, i) => {
          const p = points[i];
          const color = scoreColor(p.score);
          const isCurrent = !!p.isCurrent;
          return (
            <g key={i}>
              {isCurrent && (
                <circle cx={pt.x} cy={pt.y} r="8" fill={color} opacity="0.2" />
              )}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isCurrent ? 5 : 3.5}
                fill={color}
                stroke={isCurrent ? '#fff' : 'none'}
                strokeWidth={isCurrent ? 1.5 : 0}
              />
              <text
                x={pt.x}
                y={pt.y - (isCurrent ? 14 : 10)}
                textAnchor="middle"
                fontSize={isCurrent ? '11' : '10'}
                fontWeight="700"
                fill={color}
              >
                {p.score}
              </text>
              <text
                x={pt.x}
                y={H - 10}
                textAnchor="middle"
                fontSize="11"
                fill={isCurrent ? 'var(--text-primary)' : 'var(--text-tertiary)'}
                fontWeight={isCurrent ? '700' : '500'}
              >
                {p.label}
              </text>
            </g>
          );
        })}
    </svg>
  );

  return (
    <div style={{ marginBottom: 14 }}>
      {scrollable ? (
        <div
          ref={scrollRef}
          style={{
            overflowX: 'auto',
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
          }}
        >
          {svgEl}
        </div>
      ) : (
        svgEl
      )}
      {title && (
        <div className="text-[11px] text-text-tertiary text-center mt-1">{title}</div>
      )}
    </div>
  );
}

// ============================================
// 유년 / 유월 컴포넌트
// ============================================

interface YearlyProps {
  horoscopes: YearlyHoroscope[];
  /** wrapper 안 sub-section으로 쓸 때 헤더 생략 */
  embedded?: boolean;
}

export function YearlyTimeline({ horoscopes, embedded = false }: YearlyProps) {
  if (horoscopes.length === 0) return null;
  const points: ChartPoint[] = horoscopes.map((y, i) => ({
    label: `${y.year}`,
    score: calcWindowScore(y.mutagen),
    isCurrent: i === 0,
  }));

  const Wrapper: React.ElementType = embedded ? 'div' : 'div';
  const wrapperClass = embedded
    ? 'pt-4 border-t border-[var(--border-subtle)] mt-4'
    : 'rounded-2xl bg-space-surface border border-[var(--border-subtle)] p-5';

  return (
    <Wrapper className={wrapperClass}>
      <SectionHeader title="유년(流年) — 1년 단위의 흐름" subtitle="올해부터 5개년 — 그 해의 주된 사화와 점수" />
      <FortuneLineChart points={points} title="5개년 운 흐름" />
      <div className="space-y-4">
        {horoscopes.map((y) => {
          const score = calcWindowScore(y.mutagen);
          const meaning = makeWindowMeaning(y.mutagen, score);
          return (
            <div key={y.year} className="pb-4 border-b border-[var(--border-subtle)] last:border-b-0 last:pb-0">
              <div className="flex items-start gap-3 mb-2">
                <div className="flex-shrink-0 w-16">
                  <div className="text-sm font-bold text-text-primary">{y.year}년</div>
                  <div className="text-[11px] text-text-tertiary">{y.approxAge}세</div>
                  <div className="text-[11px] text-cta mt-0.5">{y.heavenlyStem}{y.earthlyBranch}</div>
                </div>
                <div className="flex-1">
                  <div className="text-[12px] text-text-secondary mb-1.5 font-medium" style={{ wordBreak: 'keep-all' }}>
                    {meaning}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <MutagenChip type="록" star={y.mutagen.록} />
                    <MutagenChip type="권" star={y.mutagen.권} />
                    <MutagenChip type="과" star={y.mutagen.과} />
                    <MutagenChip type="기" star={y.mutagen.기} />
                  </div>
                </div>
              </div>
              <ScoreBar score={score} />
            </div>
          );
        })}
      </div>
    </Wrapper>
  );
}

interface MonthlyProps {
  year: number;
  horoscopes: MonthlyHoroscope[];
  /** wrapper 안 sub-section으로 쓸 때 헤더 생략 */
  embedded?: boolean;
}

export function MonthlyTimeline({ year, horoscopes, embedded = false }: MonthlyProps) {
  if (horoscopes.length === 0) return null;
  const currentMonth = new Date().getMonth() + 1;
  const points: ChartPoint[] = horoscopes.map((m) => ({
    label: `${m.month}월`,
    score: calcWindowScore(m.mutagen),
    isCurrent: m.month === currentMonth,
  }));
  const focusIndex = horoscopes.findIndex((m) => m.month === currentMonth);

  const wrapperClass = embedded
    ? 'pt-4 border-t border-[var(--border-subtle)] mt-4'
    : 'rounded-2xl bg-space-surface border border-[var(--border-subtle)] p-5';

  return (
    <div className={wrapperClass}>
      <SectionHeader title="유월(流月) — 1달 단위의 변화" />
      <FortuneLineChart
        points={points}
        scrollable
        focusIndex={focusIndex >= 0 ? focusIndex : undefined}
      />
      {/* 세로 리스트 — 1월 표기 + 설명, 2월 표기 + 설명 식 (신년운세 월별 흐름 스타일) */}
      <div className="space-y-2.5">
        {horoscopes.map((m) => {
          const score = calcWindowScore(m.mutagen);
          const meaning = makeWindowMeaning(m.mutagen, score);
          const isCurrent = m.month === new Date().getMonth() + 1;
          return (
            <div
              key={m.month}
              className="rounded-xl p-3.5 flex items-start gap-3"
              style={{
                background: isCurrent ? 'rgba(167,139,250,0.12)' : 'rgba(20,12,38,0.5)',
                border: isCurrent ? '1px solid rgba(167,139,250,0.45)' : '1px solid var(--border-subtle)',
              }}
            >
              {/* 월 표기 — 왼쪽 큰 라벨 */}
              <div className="flex-shrink-0 w-14 text-center">
                <div
                  className="text-lg font-bold"
                  style={{
                    color: isCurrent ? '#A78BFA' : 'var(--text-primary)',
                    fontFamily: 'var(--font-serif)',
                  }}
                >
                  {m.month}월
                </div>
                <div className="text-[11px] text-cta mt-0.5">{m.heavenlyStem}{m.earthlyBranch}</div>
                {isCurrent && (
                  <div className="text-[9px] font-bold text-[#A78BFA] mt-1">현재</div>
                )}
              </div>
              {/* 설명 영역 */}
              <div className="flex-1 min-w-0">
                <div
                  className="text-[13px] text-text-secondary font-medium mb-1.5"
                  style={{ wordBreak: 'keep-all' }}
                >
                  {meaning}
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  <MutagenChip type="록" star={m.mutagen.록} />
                  <MutagenChip type="권" star={m.mutagen.권} />
                  <MutagenChip type="과" star={m.mutagen.과} />
                  <MutagenChip type="기" star={m.mutagen.기} />
                </div>
                <ScoreBar score={score} size="sm" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// 운흐름 그룹 wrapper — 대한·유년·유월 묶음
// ============================================

interface FlowGroupProps {
  daehanNode: React.ReactNode;
  yearlyHoroscopes: YearlyHoroscope[];
  monthlyYear: number;
  monthlyHoroscopes: MonthlyHoroscope[];
}

/**
 * 운 흐름 통합 섹션 — 대한(10년) → 유년(1년) → 유월(1달) 정통 순서.
 * 하나의 큰 카드 안에 3개 sub-section으로 묶어 사용자가 시기 흐름을 한 흐름으로 인지하게.
 */
export function FlowGroup({ daehanNode, yearlyHoroscopes, monthlyYear, monthlyHoroscopes }: FlowGroupProps) {
  return (
    <div className="rounded-2xl bg-space-surface border border-[var(--border-subtle)] p-5">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span
          style={{
            display: 'inline-block',
            width: 4,
            height: 22,
            borderRadius: 2,
            background: 'var(--cta-primary)',
          }}
        />
        <div
          style={{
            fontSize: 19,
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-serif)',
            letterSpacing: '-0.01em',
          }}
        >
          운의 흐름 — 대한 · 유년 · 유월
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 18, paddingLeft: 12 }}>
        10년 단위(대한) → 1년 단위(유년) → 1달 단위(유월)의 정통 시기 흐름
      </p>

      {/* 대한 */}
      <div>{daehanNode}</div>

      {/* 유년 */}
      {yearlyHoroscopes.length > 0 && (
        <YearlyTimeline horoscopes={yearlyHoroscopes} embedded />
      )}

      {/* 유월 */}
      {monthlyHoroscopes.length > 0 && (
        <MonthlyTimeline year={monthlyYear} horoscopes={monthlyHoroscopes} embedded />
      )}
    </div>
  );
}
