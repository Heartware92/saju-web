'use client';

/**
 * 자미두수 결과 페이지 (리뉴얼)
 * - 진입 → 풀스크린 로딩 → 결과 (명반 계산 + AI 풀이 동시 대기)
 * - 별자리 SVG 시각화 (StarChart)
 * - 섹션별 은유 헤드라인 + 카드 UI
 * - AI 용어 제거 — "별이 전하는 이야기" 같은 감성 네이밍
 *
 * URL: /saju/zamidusu?year=1990&month=1&day=1&hour=12&gender=male&calendarType=solar
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  calculateZamidusu,
  ZamidusuResult,
  ZamidusuPalace,
} from '../engine/zamidusu';
import { buildZamidusuReading, type ZamidusuReading } from '../engine/zamidusu/reading';
import { SectionCollapsible } from '../components/saju/SectionCollapsible';
import styles from './ZamidusuResultPage.module.css';
import { useProfileStore } from '../store/useProfileStore';
import { extractMetaphor } from '../utils/parseMetaphor';
import { renderEmphasis } from '../utils/renderEmphasis';
import { useCreditStore } from '../store/useCreditStore';
import { useReportCacheStore, type ReportKind } from '../store/useReportCacheStore';
import { RestoreReportModal } from '../components/RestoreReportModal';
import { QuickFortuneGate } from '../components/QuickFortuneGate';
import { findRecentArchive } from '../services/archiveService';
import {
  parseZamidusuSections,
  stripAllSectionTags,
  type ZamidusuAIResult,
} from '../services/fortuneService';
import { sajuDB, supabase } from '../services/supabase';
import { useFortuneJob } from '../hooks/useFortuneJob';
import { SUN_COST_BIG, CHARGE_REASONS } from '../constants/creditCosts';
import { ZAMIDUSU_SECTION_KEYS, ZAMIDUSU_SECTION_LABELS } from '../constants/prompts';
import { MAJOR_STARS_META, MINOR_STARS_META, MUTAGEN_META, PALACE_ROLE_META, isValidBrightness, isValidMutagen } from '../engine/zamidusu/knowledge';
import { AILoadingBar } from '../components/AILoadingBar';
import { LuckyVisualCard, ELEMENT_LUCKY } from '../components/saju/LuckyVisualCard';
import { BackButton } from '../components/ui/BackButton';
import { StarChart } from '../components/zamidusu/StarChart';
import { CorePalaceScores } from '../components/zamidusu/CorePalaceScores';
import { MutagenCards } from '../components/zamidusu/MutagenCards';
import { DaehanTimeline } from '../components/zamidusu/DaehanTimeline';
import { CharacterCard } from '../components/zamidusu/CharacterCard';
import { YearlyTimeline, MonthlyTimeline } from '../components/zamidusu/HoroscopeTimeline';
import { getYearlyHoroscopes, getMonthlyHoroscopes, type YearlyHoroscope, type MonthlyHoroscope } from '../engine/zamidusu/horoscope';
import {
  calcCoreScores,
  calcMutagenPlacements,
  calcDaehanTimeline,
  calcOverallScore,
} from '../engine/zamidusu/visualization';
import { useLoadingGuard } from '../hooks/useLoadingGuard';
import { useScrollToTopOnLoad } from '../hooks/useScrollToTopOnLoad';
import { ShareBar } from '@/components/share/ShareBar';
import { ResultFooterActions } from '@/components/ui/ResultFooterActions';

const LOADING_MESSAGES = [
  '명반 12궁의 별자리를 배치하는 중입니다',
  '주인공 별과 보좌별을 확인하는 중입니다',
  '사화(四化)의 변주를 읽는 중입니다',
  '대한(大限)의 10년 리듬을 살피는 중입니다',
  '별자리 속 이야기를 엮는 중입니다',
];

/**
 * 긴 본문을 읽기 쉬운 단락 배열로 분리.
 * - 이미 빈 줄(\n\n)로 단락이 나뉘어 있으면 그대로 존중
 * - 한 단락 안에 문장이 너무 많으면 sentencesPerPara 단위로 추가 분할
 * - 한국어 문장 종결(. ! ? + 공백) 기준
 */
// ============================================
// 섹션별 데이터 카드 — 본문 위에 시각 파티션
// ============================================

const CARD_BG = 'rgba(139, 92, 246, 0.10)';
const CARD_BORDER = 'rgba(139, 92, 246, 0.30)';
const CARD_ACCENT = '#fcd5b4';

// ── 시각 카드 공통 디자인 토큰 (정통사주·신년 Visuals 와 동일 위계) ──
//  라벨 13 / 값·제목 18 / 본문·역할 13.5 / 칩 14 / 카드 간격 16
const ZV = {
  radius: 14,
  gap: 10,
  sectionGap: 16,
  pad: '15px 16px',
  label: { fontSize: 13, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.04em' } as const,
  value: { fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'keep-all', overflowWrap: 'break-word' } as const,
  sub: { fontSize: 13.5, color: 'var(--text-tertiary)', lineHeight: 1.55, wordBreak: 'keep-all', overflowWrap: 'break-word' } as const,
};

function MetaPills({ items }: { items: { label: string; value: string; color?: string }[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: ZV.gap, marginBottom: ZV.sectionGap }}>
      {items.map((it, i) => (
        <div key={i} style={{
          textAlign: 'center', padding: '14px 8px', borderRadius: ZV.radius,
          background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
        }}>
          <div style={{ ...ZV.label, marginBottom: 7 }}>{it.label}</div>
          <div style={{ fontSize: 19, fontWeight: 700, color: it.color ?? 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

function StarBigCard({ name, hanja, brightness, mutagen, keywords, theme, strength }: {
  name: string; hanja: string; brightness?: string; mutagen?: string;
  keywords?: string[]; theme?: string; strength?: string;
}) {
  return (
    <div style={{
      flex: '1 1 0', minWidth: 0,
      padding: '20px 16px', borderRadius: ZV.radius,
      background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
      textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
    }}>
      <div style={{ fontSize: 40, fontFamily: 'var(--font-serif)', color: 'var(--text-primary)', lineHeight: 1 }}>{hanja}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{name}</div>
      {(isValidBrightness(brightness) || isValidMutagen(mutagen)) && (
        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          {isValidBrightness(brightness) && <span>{brightness}</span>}
          {isValidMutagen(mutagen) && <span style={{ color: CARD_ACCENT, fontWeight: 700 }}>{mutagen}</span>}
        </div>
      )}
      {keywords && keywords.length > 0 && (
        <div style={{ marginTop: 3, display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
          {keywords.slice(0, 3).map((k, i) => (
            <span key={i} style={{ fontSize: 13, padding: '4px 10px', borderRadius: 8, background: 'rgba(252,213,180,0.10)', color: CARD_ACCENT, border: '1px solid rgba(252,213,180,0.25)' }}>#{k}</span>
          ))}
        </div>
      )}
      {/* 별 본질 — theme 한 줄 + strength 한 줄. 사용자가 카드 보고 별의 의미 즉시 인지 (#키워드만 보고 무슨 뜻인지 모르는 문제 해결) */}
      {theme && (
        <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55, padding: '0 4px', wordBreak: 'keep-all' }}>
          {theme}
        </div>
      )}
      {strength && (
        <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.55, padding: '0 4px', wordBreak: 'keep-all' }}>
          <span style={{ color: '#34D399', fontWeight: 700 }}>강점</span> {strength}
        </div>
      )}
    </div>
  );
}

function MainStarCards({ palace }: { palace: ZamidusuPalace }) {
  if (palace.majorStars.length === 0) {
    return (
      <div style={{ padding: ZV.pad, borderRadius: ZV.radius, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, textAlign: 'center', marginBottom: ZV.sectionGap, fontSize: 15, color: 'var(--text-tertiary)' }}>
        명궁 공궁 — 대궁(對宮)의 별이 명궁에 비춰 들어옴
      </div>
    );
  }
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: palace.majorStars.length === 1 ? '1fr' : 'repeat(2, 1fr)',
      gap: ZV.gap, marginBottom: ZV.sectionGap,
    }}>
      {palace.majorStars.map(s => {
        const meta = MAJOR_STARS_META[s.name];
        return (
          <StarBigCard
            key={s.name}
            name={meta?.name ?? s.name}
            hanja={meta?.hanja ?? s.name}
            brightness={s.brightness}
            mutagen={s.mutagen}
            keywords={meta?.keywords}
            theme={meta?.theme}
            strength={meta?.strength}
          />
        );
      })}
    </div>
  );
}

function HelperStarGroup({ title, desc, stars, color, bg }: {
  title: string; desc: string; stars: ZamidusuPalace['minorStars']; color: string; bg: string;
}) {
  if (stars.length === 0) return null;
  return (
    <div style={{ padding: ZV.pad, borderRadius: ZV.radius, background: bg, border: `1px solid ${color}55`, marginBottom: ZV.gap }}>
      {/* 제목 + 개수 — "길성 2개" 처럼 분류명과 개수를 자연스럽게 */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 6 }}>
        <span style={{ fontSize: 15, color, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 14, color, fontWeight: 700 }}>{stars.length}개</span>
      </div>
      {/* 부연 설명 — 이 별 무리가 뭘 뜻하는지 */}
      <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 11, wordBreak: 'keep-all' }}>
        {desc}
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {stars.map(s => {
          const meta = MINOR_STARS_META[s.name];
          return (
            <span key={s.name} style={{
              display: 'inline-flex', alignItems: 'baseline', gap: 5,
              fontSize: 14.5, padding: '7px 12px', borderRadius: 9,
              background: `${color}1f`, border: `1px solid ${color}3a`,
              color: 'var(--text-primary)', fontWeight: 600,
            }}>
              {meta?.name ?? s.name}
              {meta?.hanja && <span style={{ fontFamily: 'var(--font-serif)', opacity: 0.6, fontSize: 12 }}>{meta.hanja}</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function HelperStarsChips({ palace }: { palace: ZamidusuPalace }) {
  // 보좌성·살성·잡성 통합 — minorStars(6길성·6살성·록마) + adjectiveStars(잡성)
  const allMinor = [...palace.minorStars, ...(palace.adjectiveStars || [])];
  const lucky = allMinor.filter(s => MINOR_STARS_META[s.name]?.category === '6길성');
  const unlucky = allMinor.filter(s => MINOR_STARS_META[s.name]?.category === '6살성');
  const other = allMinor.filter(s => MINOR_STARS_META[s.name]?.category === '기타');
  const misc = allMinor.filter(s => MINOR_STARS_META[s.name]?.category === '잡성');
  if (lucky.length + unlucky.length + other.length + misc.length === 0) {
    return (
      <div style={{ padding: ZV.pad, borderRadius: ZV.radius, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, textAlign: 'center', marginBottom: ZV.sectionGap, fontSize: 15, color: 'var(--text-tertiary)' }}>
        명궁에 보좌성 없음 — 본인 별만으로 풀어가는 인생
      </div>
    );
  }
  return (
    <div style={{ marginBottom: ZV.sectionGap }}>
      {/* 보조성 = 명궁 주성을 곁에서 받쳐주는 별. 길성·흉성·재물성 3 갈래 */}
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.65, marginBottom: 10, wordBreak: 'keep-all' }}>
        보조성은 명궁의 주인공 별을 곁에서 돕거나 자극하는 별이에요. 명궁에 들어온 별만
        아래에 모았습니다.
      </div>
      <HelperStarGroup
        title="길성"
        desc="위기에 손 내밀어 주는 귀인·조력의 별. 명궁에 많을수록 사람 덕·기회 덕이 두텁습니다."
        stars={lucky} color="#34D399" bg="rgba(52,211,153,0.08)"
      />
      <HelperStarGroup
        title="흉성"
        desc="압력·시련을 주는 별. 부담스럽지만 잘 다스리면 나를 단련시키는 추진력이 됩니다."
        stars={unlucky} color="#F87171" bg="rgba(248,113,113,0.08)"
      />
      <HelperStarGroup
        title="록존·천마"
        desc="재물복을 부르는 록존, 이동·변동·기회를 부르는 천마. 활동성과 실리의 별입니다."
        stars={other} color="#FBBF24" bg="rgba(251,191,36,0.08)"
      />
      <HelperStarGroup
        title="잡성"
        desc="음살·천형·홍란·천희·고진·과숙 같은 미세 변수들. 큰 흐름은 주성·6길·6살이 정하지만, 잡성이 색채를 입혀줍니다."
        stars={misc} color="#A78BFA" bg="rgba(167,139,250,0.08)"
      />
    </div>
  );
}

function PalaceMiniCard({ palace, accent }: { palace: ZamidusuPalace | undefined; accent?: string }) {
  if (!palace) return null;
  const role = PALACE_ROLE_META[palace.name];
  const stars = palace.majorStars.map(s => s.name).join('·') || '공궁';
  return (
    <div style={{
      padding: ZV.pad, borderRadius: ZV.radius,
      background: CARD_BG,
      border: `1px solid ${accent ?? CARD_BORDER}`,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>{palace.name}</span>
        <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>{palace.heavenlyStem}{palace.earthlyBranch}</span>
      </div>
      <div style={{ fontSize: 15.5, color: 'var(--text-secondary)', fontWeight: 600 }}>{stars}</div>
      {role && <div style={ZV.sub}>{role.domain}</div>}
    </div>
  );
}

// 모든 궁 그룹을 2 컬럼으로 통일 — 가시성 우선. 카드 자체가 커서 1행 2열 자동 wrap.
// (3궁=2+1, 5궁=2+2+1, 4궁=2+2)
function PalaceGroup({ chart, names, accent }: { chart: ZamidusuResult; names: string[]; accent?: string }) {
  const palaces = names.map(n => chart.palaces.find(p => p.name === n));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: ZV.gap, marginBottom: ZV.sectionGap }}>
      {palaces.map((p, i) => <PalaceMiniCard key={i} palace={p} accent={accent} />)}
    </div>
  );
}

function MutagenGridCards({ chart }: { chart: ZamidusuResult }) {
  const muts: { type: string; star: string; palace: string }[] = [];
  chart.palaces.forEach(p => {
    p.majorStars.forEach(s => {
      if (s.mutagen) muts.push({ type: s.mutagen, star: s.name, palace: p.name });
    });
  });
  const order = ['화록', '화권', '화과', '화기'];
  const colorMap: Record<string, string> = {
    화록: '#34D399', 화권: '#FBBF24', 화과: '#60A5FA', 화기: '#F87171',
  };
  // 4 사화는 2 컬럼 (2+2) — 카드 크게
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: ZV.gap, marginBottom: ZV.sectionGap }}>
      {order.map(t => {
        const m = muts.find(x => x.type === t);
        const meta = MUTAGEN_META[t];
        const color = colorMap[t];
        return (
          <div key={t} style={{
            padding: ZV.pad, borderRadius: ZV.radius,
            background: `${color}10`, border: `1px solid ${color}40`,
            display: 'flex', flexDirection: 'column', gap: 7,
          }}>
            <span style={{ fontSize: 17, fontWeight: 700, color, fontFamily: 'var(--font-serif)' }}>
              {meta?.name ?? t}
              {meta?.hanja && <span style={{ opacity: 0.6, marginLeft: 6, fontSize: 14 }}>{meta.hanja}</span>}
            </span>
            {m ? (
              <div style={{ fontSize: 14.5, color: 'var(--text-secondary)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{m.star}</span>
                <span style={{ color: 'var(--text-tertiary)', marginLeft: 8, fontSize: 12.5 }}>{m.palace}</span>
              </div>
            ) : (
              <div style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>없음</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InteractionsCards({ chart }: { chart: ZamidusuResult }) {
  // 명궁 기준 삼방사정 — 재백·관록·천이
  const targets = ['명궁', '재백궁', '관록궁', '천이궁'];
  return (
    <>
      <div style={{ ...ZV.label, marginBottom: 10 }}>
        삼방사정 — 명궁에 비춰 들어오는 핵심 4 궁
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: ZV.gap, marginBottom: ZV.sectionGap }}>
        {targets.map(n => <PalaceMiniCard key={n} palace={chart.palaces.find(p => p.name === n)} accent="rgba(252,213,180,0.35)" />)}
      </div>
    </>
  );
}

function DaehanTable({ chart, currentAge }: { chart: ZamidusuResult; currentAge?: number }) {
  const rows = chart.palaces
    .filter(p => p.decadal)
    .sort((a, b) => (a.decadal!.startAge - b.decadal!.startAge))
    .slice(0, 10);
  if (rows.length === 0) return null;
  return (
    <div style={{
      marginBottom: ZV.sectionGap, borderRadius: ZV.radius, overflow: 'hidden',
      border: `1px solid ${CARD_BORDER}`, background: CARD_BG,
    }}>
      {rows.map((p, i) => {
        const isCurrent = currentAge !== undefined && p.decadal!.startAge <= currentAge && currentAge <= p.decadal!.endAge;
        const stars = p.majorStars.map(s => s.name).join('·') || '공궁';
        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '92px 76px 1fr', gap: 10,
            padding: '13px 16px', alignItems: 'center',
            borderBottom: i === rows.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)',
            background: isCurrent ? 'rgba(252,213,180,0.10)' : 'transparent',
          }}>
            <div style={{ fontSize: 14, color: isCurrent ? CARD_ACCENT : 'var(--text-secondary)', fontWeight: isCurrent ? 700 : 600 }}>
              {isCurrent && '★ '}{p.decadal!.startAge}~{p.decadal!.endAge}세
            </div>
            <div style={{ fontSize: 15.5, color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'var(--font-serif)' }}>{p.name}</div>
            <div style={{ fontSize: 14.5, color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>{stars}</div>
          </div>
        );
      })}
    </div>
  );
}

// 단독 궁 카드 — 신궁·소한 공용. 라벨 / 궁 이름(크게)+간지 / 주성(라벨 붙임) / 의미.
function SoloPalaceCard({
  label, labelColor, accentBorder, palace, note,
}: {
  label: string;
  labelColor: string;
  accentBorder: string;
  palace: ZamidusuPalace;
  note?: string;
}) {
  const role = PALACE_ROLE_META[palace.name];
  const stars = palace.majorStars.map(s => s.name).join(' · ') || '공궁';
  return (
    <div style={{
      padding: '18px 18px', borderRadius: ZV.radius, marginBottom: ZV.sectionGap,
      background: CARD_BG, border: `1px solid ${accentBorder}`,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontSize: 13, color: labelColor, fontWeight: 700, letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
        <span style={{ fontSize: 23, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
          {palace.name}
        </span>
        <span style={{ fontSize: 14, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
          {palace.heavenlyStem}{palace.earthlyBranch}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)', fontWeight: 600 }}>이 궁의 주성</span>
        <span style={{ fontSize: 16.5, fontWeight: 600, color: 'var(--text-secondary)', wordBreak: 'keep-all', overflowWrap: 'break-word' }}>{stars}</span>
      </div>
      {role && <div style={{ ...ZV.sub, wordBreak: 'keep-all', overflowWrap: 'break-word' }}>{role.domain}</div>}
      {note && (
        <div style={{
          fontSize: 13, color: labelColor, fontWeight: 600,
          paddingTop: 10, borderTop: `1px solid ${accentBorder}`,
          wordBreak: 'keep-all',
          overflowWrap: 'break-word',
          lineHeight: 1.55,
        }}>
          {note}
        </div>
      )}
    </div>
  );
}

function BodyPalaceCard({ chart }: { chart: ZamidusuResult }) {
  const body = chart.palaces.find(p => p.isBodyPalace);
  if (!body) return null;
  const accent = '#F472B6';
  const sameAsMyeong = body.name === '명궁';
  return (
    <SoloPalaceCard
      label="신궁(身宮)이 자리한 궁"
      labelColor={accent}
      accentBorder="rgba(244,114,182,0.45)"
      palace={body}
      note={sameAsMyeong
        ? '신궁이 명궁과 같은 자리 — 타고난 본질과 페르소나가 일치'
        : '신궁이 명궁과 다른 자리 — 본질과 또 다른 페르소나가 나뉨'}
    />
  );
}

function SohanCard({ chart, currentAge }: { chart: ZamidusuResult; currentAge?: number }) {
  if (currentAge === undefined) return null;
  const cur = chart.palaces.find(p => p.ages.includes(currentAge));
  if (!cur) return null;
  return (
    <SoloPalaceCard
      label={`★ 올해 소한 — 만 ${currentAge}세`}
      labelColor={CARD_ACCENT}
      accentBorder="rgba(252,213,180,0.40)"
      palace={cur}
    />
  );
}

// 오행국(水二局·木三局 등)에서 한글 오행 한 글자 추출
function elementFromFiveClass(cls: string): string {
  if (/水|수/.test(cls)) return '수';
  if (/木|목/.test(cls)) return '목';
  if (/金|금/.test(cls)) return '금';
  if (/土|토/.test(cls)) return '토';
  if (/火|화/.test(cls)) return '화';
  return '목';
}

// 별의 조언 — 오행국 기준 개운 시각 카드 (나침반·색·시간 — 정통사주 용신 처방과 동일 UI)
function AdviceLuckyCard({ chart }: { chart: ZamidusuResult }) {
  const el = elementFromFiveClass(chart.fiveElementsClass);
  const data = ELEMENT_LUCKY[el] ?? ELEMENT_LUCKY['목'];
  return (
    <div style={{ marginBottom: ZV.sectionGap }}>
      <div style={{ ...ZV.label, marginBottom: 10 }}>
        오행국 ({chart.fiveElementsClass}) 기준 개운 처방
      </div>
      <LuckyVisualCard
        colors={data.colors}
        colorCss={data.colorCss}
        numbers={data.numbers}
        direction={data.direction}
        timeSlot={data.timeSlot}
        gem={data.gem}
        activity={data.activity}
      />
    </div>
  );
}

function renderSectionDataCards(
  key: string,
  chart: ZamidusuResult,
  currentAge?: number,
  yearlyHoroscopes?: YearlyHoroscope[],
  monthlyHoroscopes?: MonthlyHoroscope[],
  currentYearForMonthly?: number,
): React.ReactNode | null {
  const myeong = chart.palaces.find(p => p.name === '명궁');
  switch (key) {
    case 'overview':
      return <MetaPills items={[
        { label: '명주', value: chart.soul },
        { label: '신주', value: chart.body },
        { label: '오행국', value: chart.fiveElementsClass, color: '#FBBF24' },
      ]} />;
    case 'main_star':
      return myeong ? <MainStarCards palace={myeong} /> : null;
    case 'helper_stars':
      return myeong ? <HelperStarsChips palace={myeong} /> : null;
    case 'body_palace':
      return <BodyPalaceCard chart={chart} />;
    // 영역별 분리 (2026-05-27 사용자 재구성)
    case 'wealth':
      return <PalaceGroup chart={chart} names={['재백궁', '전택궁']} />;
    case 'career':
      return <PalaceGroup chart={chart} names={['관록궁', '자녀궁']} />;
    case 'love':
      return <PalaceGroup chart={chart} names={['부처궁']} />;
    case 'body_mind':
      return <PalaceGroup chart={chart} names={['질액궁', '복덕궁']} />;
    case 'relations':
      return <PalaceGroup chart={chart} names={['형제궁', '노복궁', '천이궁', '부모궁']} />;
    case 'mutagen':
      // 사화 + 합·충·삼방사정 회조 함께 표시 (interactions 흡수)
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MutagenGridCards chart={chart} />
          <InteractionsCards chart={chart} />
        </div>
      );
    case 'daehan': {
      // 대한 — DaehanTimeline 시각 + DaehanTable (한 섹션에서 보여줌)
      // SectionCollapsible 헤더가 이미 있으므로 DaehanTimeline 자체 헤더는 숨김 (중복 방지)
      const ageForCalc = currentAge ?? 0;
      const segs = calcDaehanTimeline(chart, ageForCalc);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {segs.length > 0 && <DaehanTimeline segments={segs} currentAge={ageForCalc} hideHeader />}
          <DaehanTable chart={chart} currentAge={currentAge} />
        </div>
      );
    }
    case 'sohan':
      // 정통 자미두수 4단위(대한·유년·유월·유일)에 맞춰 sohan 키를 유년·유월 시각으로 재사용.
      // 라벨도 "유년·유월 — 가까운 시기 흐름"으로 변경 (prompts.ts ZAMIDUSU_SECTION_LABELS).
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {yearlyHoroscopes && yearlyHoroscopes.length > 0 && <YearlyTimeline horoscopes={yearlyHoroscopes} />}
          {monthlyHoroscopes && monthlyHoroscopes.length > 0 && currentYearForMonthly && (
            <MonthlyTimeline year={currentYearForMonthly} horoscopes={monthlyHoroscopes} />
          )}
        </div>
      );
    case 'advice':
      return <AdviceLuckyCard chart={chart} />;
    default:
      return null;
  }
}

function splitIntoParagraphs(text: string, sentencesPerPara = 3): string[] {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
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
    if (sentences.length === 0) {
      out.push(flat);
      continue;
    }
    if (sentences.length <= sentencesPerPara) {
      out.push(sentences.join(' '));
      continue;
    }
    for (let i = 0; i < sentences.length; i += sentencesPerPara) {
      out.push(sentences.slice(i, i + sentencesPerPara).join(' '));
    }
  }
  return out;
}


export default function ZamidusuResultPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const profileId = searchParams?.get('profileId') ?? null;
  const recordId = searchParams?.get('recordId') ?? null;
  const urlJobId = searchParams?.get('jobId') ?? null;
  const isArchiveMode = !!recordId;
  const needsProfileSelect = !profileId && !isArchiveMode && !urlJobId && !(searchParams?.get('year') && searchParams?.get('month') && searchParams?.get('day'));

  // 백그라운드 잡 시스템 — Phase 4
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const effectiveJobId = urlJobId ?? createdJobId;
  const { job: fortuneJob } = useFortuneJob(effectiveJobId);
  const { profiles, fetchProfiles, hydrated, loading: profilesLoading, lastFetchedAt } = useProfileStore();
  const targetProfile = useMemo(() => {
    if (profileId) return profiles.find(p => p.id === profileId) ?? null;
    if (needsProfileSelect) return null;
    return profiles.find(p => p.is_primary) ?? null;
  }, [profiles, profileId, needsProfileSelect]);

  const [chart, setChart] = useState<ZamidusuResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<number | null>(null);
  const [aiResult, setAiResult] = useState<ZamidusuAIResult | null>(null);
  const [aiLoading, setAiLoading] = useState(!isArchiveMode && !needsProfileSelect);
  const [introOpen, setIntroOpen] = useState(false);

  // 결과 준비 완료 시 스크롤 최상단
  useScrollToTopOnLoad(!!chart && !aiLoading);

  // ── 로딩 안전장치: 70초 초과 시 강제 해제 ──
  const [aiTimedOut] = useLoadingGuard(aiLoading, 140_000);
  useEffect(() => {
    if (aiTimedOut) {
      setAiLoading(false);
      if (!aiResult) setAiResult({ success: false, error: '응답이 너무 오래 걸려요. 새로고침 후 다시 시도해주세요.' });
    }
  }, [aiTimedOut, aiResult]);
  const chargeForContent = useCreditStore(s => s.chargeForContent);
  const chargeRef = useRef(chargeForContent);
  chargeRef.current = chargeForContent;

  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [cacheGate, setCacheGate] = useState<{ kind: ReportKind; key: string; restore: () => void } | null>(null);
  const [refetchNonce, setRefetchNonce] = useState(0);
  const handleUseCached = () => { cacheGate?.restore(); setCacheGate(null); };
  const handleRefetch = () => {
    if (cacheGate) useReportCacheStore.getState().invalidate(cacheGate.kind, cacheGate.key);
    setCacheGate(null);
    aiStartedRef.current = false;
    setRefetchNonce(n => n + 1);
  };

  const hasUrlBirth = !!(searchParams?.get('year') && searchParams?.get('month') && searchParams?.get('day'));
  const primaryHourUnknown = !!targetProfile && !targetProfile.birth_time;
  const hourUnknown = hasUrlBirth
    ? searchParams?.get('unknownTime') === 'true'
    : primaryHourUnknown;

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  // 모달 오픈 시 ESC 키로 닫기 + body 스크롤 잠금
  useEffect(() => {
    if (selectedPalace === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedPalace(null);
    };
    window.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedPalace]);

  // 명반 계산용 입력 — 캐시 키와 chart 둘 다 같은 입력에서 파생되도록 분리
  //
  // 시진 결정 시 한국식 30분 시프트 적용 (정통사주와 일관)
  //  - 한국 표준자오선 135°와 실제 서울 127.5° 사이 30분 시차를 시진에 반영
  //  - 13:24 입력 → 12:54로 시프트 → 오시(11~13)에 안착
  //  - 정통사주/포스텔러/점신 등 한국 시장 표준과 동일
  const birthInput = useMemo(() => {
    if (hourUnknown) return null;
    let rawY: number, rawM: number, rawD: number, rawH: number, rawMin: number;
    let gender: 'male' | 'female';
    let calendarType: 'solar' | 'lunar';

    if (hasUrlBirth) {
      rawY = parseInt(searchParams!.get('year')!);
      rawM = parseInt(searchParams!.get('month')!);
      rawD = parseInt(searchParams!.get('day')!);
      rawH = parseInt(searchParams!.get('hour') || '12');
      rawMin = parseInt(searchParams!.get('minute') || '0');
      gender = (searchParams!.get('gender') || 'male') as 'male' | 'female';
      calendarType = (searchParams!.get('calendarType') || 'solar') as 'solar' | 'lunar';
    } else if (targetProfile) {
      const [y, m, d] = targetProfile.birth_date.split('-').map(Number);
      const [h, min] = targetProfile.birth_time
        ? targetProfile.birth_time.split(':').map(Number)
        : [12, 0];
      rawY = y; rawM = m; rawD = d;
      rawH = h ?? 12;
      rawMin = min ?? 0;
      gender = targetProfile.gender;
      calendarType = targetProfile.calendar_type;
    } else {
      return null;
    }

    // 한국식 30분 시프트 — 시계 시간에서 30분 빼서 시진 경계 보정
    // 자정 가까운 시각은 전날로 넘어갈 수 있으므로 Date 객체 사용
    const dt = new Date(rawY, rawM - 1, rawD, rawH, rawMin);
    const shifted = new Date(dt.getTime() - 30 * 60 * 1000);

    return {
      year: shifted.getFullYear(),
      month: shifted.getMonth() + 1,
      day: shifted.getDate(),
      hour: shifted.getHours(),
      gender,
      calendarType,
    };
  }, [searchParams, hourUnknown, hasUrlBirth, targetProfile]);

  const cacheKey = useMemo(() => {
    if (!birthInput) return null;
    const b = birthInput;
    return `${b.calendarType}_${b.year}-${b.month}-${b.day}_${b.hour}_${b.gender}`;
  }, [birthInput]);

  // 보관함 매칭용 sourceBirth — birthInput 에서 추출
  const sourceBirth = useMemo(() => {
    if (!birthInput) return undefined;
    const b = birthInput;
    return {
      birth_date: `${b.year}-${String(b.month).padStart(2,'0')}-${String(b.day).padStart(2,'0')}`,
      gender: b.gender,
      calendar_type: b.calendarType,
    };
  }, [birthInput]);

  // 명반 계산 — 보관함 재생 모드에서도 chart 는 birth_date 기반으로 재계산해 SVG 등 렌더 가능하게.
  // birthInput 객체 reference 가 매 렌더 갱신되어도 명반 식별이 동일하면 chart reference 를
  // 유지해야 하위 effect (AI 호출) 가 cleanup→재실행 되며 setTimeout 이 무한 cancel 되는
  // 무한 로딩 버그를 방지.
  useEffect(() => {
    if (!birthInput) return;
    try {
      const b = birthInput;
      const result = calculateZamidusu(b.year, b.month, b.day, b.hour, b.gender, b.calendarType);
      setChart((prev) => {
        if (
          prev &&
          prev.solarDate === result.solarDate &&
          prev.lunarDate === result.lunarDate &&
          prev.gender === result.gender &&
          prev.timeRange === result.timeRange
        ) {
          return prev;
        }
        return result;
      });
    } catch (e: any) {
      setError(e?.message || '명반 계산 실패');
    }
  }, [birthInput]);

  // ── 보관함 재생 모드 — recordId 가 있으면 DB에서 풀이 복원, AI 호출 skip ──
  useEffect(() => {
    if (!recordId) return;
    let cancelled = false;
    sajuDB.getRecordById(recordId)
      .then((record) => {
        if (cancelled || !record) return;
        // chart 는 위 useEffect 가 처리(birthInput → calculateZamidusu).
        // 보관함 모드에서 birthInput 도출은 primary/searchParams 를 따르므로,
        // 보관함 record 의 birth 로 강제 재계산.
        try {
          const [y, m, d] = record.birth_date.split('-').map(Number);
          const h = record.birth_time ? parseInt(record.birth_time.split(':')[0], 10) : 12;
          setChart(calculateZamidusu(y, m, d, h, record.gender, record.calendar_type));
        } catch (e) {
          console.error('[archive replay] zamidusu chart recalc failed', e);
        }
        const content = record.interpretation_detailed ?? record.interpretation_basic ?? '';
        const sections = parseZamidusuSections(content);
        setAiResult(
          Object.keys(sections).length > 0
            ? { success: true, content, sections }
            : { success: true, content },
        );
      })
      .catch((e) => {
        console.error('[archive replay] load failed', e);
        if (!cancelled) setAiResult({ success: false, error: '보관된 풀이를 불러오지 못했어요.' });
      })
      .finally(() => { if (!cancelled) setAiLoading(false); });
    return () => { cancelled = true; };
  }, [recordId]);

  const reading: ZamidusuReading | null = useMemo(() => {
    return chart ? buildZamidusuReading(chart) : null;
  }, [chart]);

  // 유년(流年) 5개년 · 유월(流月) 12개월 — 자운파 시기 예측.
  //
  // ★ 보관함 진입 깜빡거림 방지 (2026-05-27 사용자 보고): horoscope 계산은
  // iztro astrolabe를 새로 만들어 12*N 번 호출하므로 동기 실행 시 첫 렌더가
  // 무거워져 화면이 한 번 더 깜빡인다. useMemo 동기 호출 대신 useState +
  // useEffect로 chart 마운트 직후 next tick에 비동기 계산해 첫 렌더는 빠르게
  // 표시하고, horoscope는 뒤따라 렌더된다.
  const currentYearForMonthly = new Date().getFullYear();
  const [yearlyHoroscopes, setYearlyHoroscopes] = useState<YearlyHoroscope[]>([]);
  const [monthlyHoroscopes, setMonthlyHoroscopes] = useState<MonthlyHoroscope[]>([]);

  useEffect(() => {
    if (!birthInput || !chart) {
      setYearlyHoroscopes([]);
      setMonthlyHoroscopes([]);
      return;
    }
    // next tick으로 미뤄 chart 마운트 첫 렌더는 즉시 표시
    const id = setTimeout(() => {
      try {
        const currentYear = new Date().getFullYear();
        const years = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4];
        setYearlyHoroscopes(getYearlyHoroscopes(birthInput, years));
      } catch (e) {
        console.error('[zamidusu] yearly horoscope failed', e);
        setYearlyHoroscopes([]);
      }
      try {
        setMonthlyHoroscopes(getMonthlyHoroscopes(birthInput, currentYearForMonthly));
      } catch (e) {
        console.error('[zamidusu] monthly horoscope failed', e);
        setMonthlyHoroscopes([]);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [birthInput, chart, currentYearForMonthly]);

  // ── 보관함 DB 확인 → AI 호출 (순차 실행) ──
  // 보관함 체크를 먼저 완료한 뒤, 기존 풀이가 없을 때만 AI 호출
  const aiStartedRef = useRef(false);
  useEffect(() => {
    if (isArchiveMode) return;
    // ★ 가이드 4.10 — ?jobId 진입 또는 새 잡 생성된 경우 cacheGate/findRecentArchive skip
    if (effectiveJobId) return;
    if (!chart || !cacheKey) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const isFresh = searchParams?.get('fresh') === '1';

    const run = async () => {
      // ★ cache 우선 — 메모리 unload→reload 후에도 archive 모달 없이 즉시 복원
      if (!isFresh && refetchNonce === 0) {
        const cached = useReportCacheStore.getState().getReport<ZamidusuAIResult>('zamidusu', cacheKey);
        if (cached?.error) {
          setAiResult({ success: false, error: cached.error });
          setAiLoading(false);
          return;
        }
        if (cached?.data) {
          setAiResult(cached.data);
          setAiLoading(false);
          aiStartedRef.current = true;
          return;
        }
      } else if (isFresh) {
        useReportCacheStore.getState().invalidate('zamidusu', cacheKey);
      }

      if (refetchNonce === 0 && sourceBirth && !isFresh) {
        try {
          const found = await findRecentArchive({
            category: 'zamidusu',
            birth_date: sourceBirth.birth_date,
            gender: sourceBirth.gender,
            profile_id: targetProfile?.id,
          });
          if (cancelled) return;
          if (found) {
            setSavedRecordId(found.id);
            setAiLoading(false);
            setCacheGate({
              kind: 'zamidusu',
              key: '',
              restore: () => {
                const params = new URLSearchParams(window.location.search);
                params.set('recordId', found.id);
                router.replace(`${window.location.pathname}?${params.toString()}`);
              },
            });
            return;
          }
        } catch { /* ignore */ }
        if (cancelled) return;
      }

      if (aiStartedRef.current) return;
      aiStartedRef.current = true;

      setAiLoading(true);
      // 새 잡 시스템 — 옛 timeout·cache.setReport·chargeForContent 모두 서버 책임으로 대체.
      // setLoading(false) 는 잡 결과 동기화 useEffect 가 status='done' 시 호출 (가이드 4.8).
      void (async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          if (!accessToken) {
            if (!cancelled) {
              setAiResult({ success: false, error: '로그인이 만료됐어요. 다시 로그인해주세요.' });
              setAiLoading(false);
            }
            return;
          }
          const minuteBucket = Math.floor(Date.now() / 60000);
          const idempotencyKey = `${cacheKey}:${minuteBucket}`;
          const res = await fetch('/api/fortune/jobs/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({
              category: 'zamidusu',
              // zamidusu 는 SajuResult 없음 — chart(ZamidusuResult) 자체가 result_data 보존
              sajuResult: chart as unknown as Record<string, unknown>,
              zamidusuResult: chart,
              profileId: targetProfile?.id,
              sourceBirth: sourceBirth
                ? {
                    birthDate: sourceBirth.birth_date,
                    birthTime: null,
                    birthPlace: null,
                    gender: sourceBirth.gender,
                    calendarType: sourceBirth.calendar_type ?? 'solar',
                  }
                : null,
              idempotencyKey,
            }),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            if (!cancelled) {
              setAiResult({ success: false, error: errData.error || '풀이 요청에 실패했어요.' });
              setAiLoading(false);
            }
            return;
          }
          const { jobId } = (await res.json()) as { jobId: string };
          if (cancelled) return;
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('jobId', jobId);
          window.history.replaceState(null, '', newUrl.toString());
          setCreatedJobId(jobId);
          // 이후 잡 동기화 useEffect 가 setAiResult·setAiLoading(false) 책임
        } catch (err) {
          if (!cancelled) {
            const msg = err instanceof Error ? err.message : '풀이를 불러오지 못했어요';
            setAiResult({ success: false, error: msg });
            setAiLoading(false);
          }
        }
      })();
    };

    run();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart, cacheKey, isArchiveMode, refetchNonce, effectiveJobId]);

  // ── 잡 결과 → state 동기화 (백그라운드 잡 시스템) ──
  useEffect(() => {
    if (isArchiveMode) return;
    if (!fortuneJob) return;
    if (fortuneJob.status === 'done') {
      const content = fortuneJob.interpretationDetailed ?? '';
      const sections = parseZamidusuSections(content);
      setAiResult(
        Object.keys(sections).length > 0
          ? { success: true, content, sections }
          : { success: true, content, sections: undefined },
      );
      setSavedRecordId(fortuneJob.jobId);
      setAiLoading(false);
    } else if (fortuneJob.status === 'failed') {
      setAiResult({
        success: false,
        error: fortuneJob.errorMessage ?? '풀이 생성에 실패했어요. 크레딧은 자동 환불됐어요.',
      });
      setAiLoading(false);
    } else if (fortuneJob.status === 'processing' && fortuneJob.interpretationBasic) {
      // 1차 partial 도착 — 부분 렌더
      const content = fortuneJob.interpretationBasic;
      const sections = parseZamidusuSections(content);
      if (Object.keys(sections).length > 0) {
        setAiResult({ success: true, content, sections });
      }
      setSavedRecordId(fortuneJob.jobId);
      setAiLoading(true);
    } else {
      setAiLoading(true);
    }
  }, [
    fortuneJob?.status,
    fortuneJob?.interpretationDetailed,
    fortuneJob?.interpretationBasic,
    fortuneJob?.errorMessage,
    fortuneJob?.jobId,
    isArchiveMode,
  ]);

  // ── 시각화 데이터 (chart 가 null 일 수 있으므로 가드. 훅 순서 보장 위해 early return 앞에 둠) ──
  const currentAge = useMemo(() => {
    if (!birthInput) return 0;
    return Math.max(0, new Date().getFullYear() - birthInput.year + 1);
  }, [birthInput]);
  const coreScores = useMemo(() => (chart ? calcCoreScores(chart) : []), [chart]);
  const overallScore = useMemo(
    () => (coreScores.length > 0 ? calcOverallScore(coreScores) : 0),
    [coreScores],
  );
  const mutagenPlacements = useMemo(
    () => (chart ? calcMutagenPlacements(chart) : []),
    [chart],
  );
  const daehanSegments = useMemo(
    () => (chart ? calcDaehanTimeline(chart, currentAge) : []),
    [chart, currentAge],
  );

  // ── 시간 미상 가드 ──
  // 보관함 재생 모드에선 이 가드를 우회 — 과거에 시간 알았던 시점에 받은 풀이를
  // 이후 프로필 시간을 미상으로 바꿨다는 이유로 못 보게 막으면 안 됨.
  if (hourUnknown && !isArchiveMode) {
    return (
      <div className={styles.container}>
        <div className="flex items-center relative mb-5 pt-3 px-1">
          <BackButton className="absolute left-0" />
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>자미두수</h1>
          </div>
        </div>
        <div style={{
          margin: '24px 16px', padding: '20px',
          background: 'var(--space-surface)',
          border: '1px solid rgba(251, 191, 36, 0.35)',
          borderRadius: '16px',
          color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          <p style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 8 }}>
            자미두수는 정확한 출생 시간이 필요합니다
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            자미두수는 태어난 시각(시지)에 따라 12궁 배치가 완전히 달라지는 별자리 체계예요. 시간이 없으면 별들이 어느 방에 자리 잡는지 알 수 없어 명반 자체가 성립하지 않습니다.
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
            대신 <strong>사주 해석</strong>은 시주 없이도 연·월·일주와 대운으로 성격·재물·애정·직업을 충실히 읽어드려요.
          </p>
          <button
            onClick={() => {
              if (!searchParams) return;
              const qs = searchParams.toString();
              router.push(`/saju/result?${qs}`);
            }}
            style={{
              width: '100%', padding: '12px',
              background: 'var(--cta-primary)', color: '#fff',
              border: 'none', borderRadius: 10,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            사주 해석으로 이동
          </button>
        </div>
      </div>
    );
  }

  // ── 프로필 선택 가드 ──
  if (needsProfileSelect) {
    return (
      <QuickFortuneGate
        serviceName="자미두수"
        description="중국 송나라 진희이가 창시한 별자리 명리학이에요. 생년월일시를 기반으로 자미성을 비롯한 108개 성(星)의 배치를 분석하여 성격, 재물, 관계, 건강 등 삶의 큰 그림을 읽어냅니다."
        archiveCategory="zamidusu"
        creditType="moon"
        creditCost={SUN_COST_BIG}
      />
    );
  }

  // ── 프로필 없음 가드 ──
  if (!hasUrlBirth && !targetProfile) {
    const profileStoreReady = hydrated && lastFetchedAt !== null && !profilesLoading;
    if (!profileStoreReady) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-cta border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[17px] font-semibold text-text-primary mb-2">대표 프로필이 없어요</p>
        <p className="text-[15px] text-text-secondary mb-4">프로필을 등록하면 자미두수를 볼 수 있어요</p>
        <button
          onClick={() => router.push('/saju/input?mode=profile-only')}
          className="px-4 py-2 rounded-lg bg-cta text-white text-[15px] font-semibold"
        >
          프로필 등록하기
        </button>
      </div>
    );
  }

  if (error) {
    return <div className={styles.loading}>{error}</div>;
  }

  // ── 풀스크린 로딩: 명반 계산 OR AI 풀이 대기 중 ──
  // 한번에 모든 내용이 준비되어 쭉 보이도록 풀스크린으로 대기
  if (!chart || aiLoading) {
    return (
      <AILoadingBar
        label="자미두수 명반을 펼치는 중"
        minLabel="15초"
        maxLabel="40초"
        estimatedSeconds={25}
        startedAt={fortuneJob?.startedAt}
        messages={LOADING_MESSAGES}
        topContent={
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="text-[28px] mb-1 tracking-widest" style={{ fontFamily: 'var(--font-serif)' }}>
              紫微斗數
            </div>
            <div className="text-[15px] text-text-tertiary">하늘의 별자리 지도</div>
          </motion.div>
        }
      />
    );
  }

  const sections = aiResult?.sections ?? {};
  const aiFailed = !!aiResult && !aiResult.success;

  const retryAI = () => {
    if (!chart) return;
    aiStartedRef.current = false;
    setAiResult(null);
    setCreatedJobId(null);  // 새 잡 생성 트리거
    setAiLoading(true);
    setRefetchNonce(n => n + 1);
  };

  return (
    <div className={styles.container} style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}>
      {/* Header */}
      <div className="flex items-center relative mb-5 pt-3 px-1">
        <BackButton className="absolute left-0" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>자미두수</h1>
          <p className="text-base text-text-tertiary mt-1">
            {chart.solarDate} {chart.timeRange}
          </p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

        {/* AI 풀이 실패 배너 + 재시도 */}
        {aiFailed && (
          <div
            className={styles.section}
            style={{
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.35)',
            }}
          >
            <p style={{ fontSize: 13, color: '#F87171', fontWeight: 600, marginBottom: 6 }}>
              별자리 풀이를 불러오지 못했어요
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              {aiResult?.error || '잠시 후 다시 시도해주세요.'} 아래 명반 자체는 정상적으로 계산되어 있어 바로 확인할 수 있어요.
            </p>
            <button
              onClick={retryAI}
              style={{
                padding: '8px 16px',
                background: 'var(--cta-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              다시 풀이받기
            </button>
          </div>
        )}

        {/* 자미두수란? 안내 카드 */}
        <div className={styles.section} style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }}>
          <button
            onClick={() => setIntroOpen(v => !v)}
            style={{
              width: '100%', background: 'none', border: 'none', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
              자미두수가 뭔가요?
            </span>
            <span style={{ fontSize: 14, color: 'var(--cta-primary)', fontWeight: 600 }}>
              {introOpen ? '접기' : '펼치기'}
            </span>
          </button>
          <AnimatePresence>
            {introOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <p className="leading-[1.85]" style={{ fontSize: 15, color: 'var(--text-secondary)', margin: '14px 0 0' }}>
                  자미두수(紫微斗數)는 <b style={{ color: 'var(--text-primary)' }}>북극성</b>과 <b style={{ color: 'var(--text-primary)' }}>북두칠성</b>으로 운명을 읽는 천 년 된 별자리 점성술이에요.
                  태어난 순간 하늘에 나만의 <b style={{ color: 'var(--text-primary)' }}>별자리 지도(명반)</b>가 그려지는데, 이 지도에는 인생의 12개 방이 있어요.
                  각 방에는 다른 주인공 별이 앉아서 — 사랑·재물·건강·명예 — 인생의 각 영역을 이끌어가죠.
                  사주가 <b style={{ color: 'var(--text-primary)' }}>내 기질·체질</b>을 본다면, 자미두수는 <b style={{ color: 'var(--text-primary)' }}>내 인생 무대의 조명 배치</b>를 봅니다.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 명반 요약 메타 — 별도 섹션으로 분리 + 크게 */}
        <div className={styles.section} style={{ padding: '16px' }}>
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
        <div className={styles.section}>
          <h2 style={{ textAlign: 'center', marginBottom: 14, fontSize: 18 }}>하늘에 새겨진 당신의 별자리</h2>
          <StarChart
            palaces={chart.palaces}
            soul={chart.soul}
            fiveElementsClass={chart.fiveElementsClass}
            selectedIndex={selectedPalace}
            onSelect={(idx) => setSelectedPalace(selectedPalace === idx ? null : idx)}
          />
        </div>

        {/* 격국 카드 노출은 제거 (사용자 결정 2026-05-27).
            격국 데이터는 reading.gekkuks 그대로 살아있고, AI 풀이 본문 안에 일상 표현으로
            녹여 들어감 (prompts.ts의 [overview]·[main_star] 본문 지침 + 별도 한자 노출 금지 규칙).
            진입장벽 우려로 한자 격국명을 직접 노출하지 않는 대신 본문 묘사로만 활용. */}

        {/* 봉신연의 캐릭터 카드 — 14주성 의인화 */}
        {reading && reading.characterCards.length > 0 && (
          <div className={styles.section}>
            <h2 style={{ textAlign: 'center', marginBottom: 14, fontSize: 18 }}>당신 안의 봉신연의 인물</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reading.characterCards.map((cc) => (
                <CharacterCard key={`${cc.palace}-${cc.starName}`} data={cc} />
              ))}
            </div>
          </div>
        )}

{/* 영역별 인사이트 텍스트 카드는 제거 (2026-05-27 사용자 결정)
            이유: 위쪽 시각 카드(CorePalaceScores·MutagenCards·FlowGroup)에서
            영역별 점수가 이미 시각화되고, 아래 AI 풀이 12 섹션에서 영역별
            깊이 풀이가 나오므로 중간의 짧은 텍스트 요약 카드는 중복.
            domainBundles 데이터는 reading.ts에 유지 — 다른 곳에서 활용 여지. */}

        {/* 선택된 궁 상세 — 모달 오버레이 */}
        <AnimatePresence>
          {selectedPalace !== null && (() => {
            const p = chart.palaces.find((x) => x.index === selectedPalace);
            if (!p) return null;
            return (
              <motion.div
                key="palace-modal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSelectedPalace(null)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 100,
                  background: 'rgba(0,0,0,0.7)',
                  backdropFilter: 'blur(6px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 16,
                  paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
                  paddingBottom: 'calc(16px + 64px + env(safe-area-inset-bottom, 0px))',
                  overflowY: 'auto',
                }}
              >
                {/* 모달 카드 — transform 대신 flex 센터링 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.22 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'relative',
                    width: 'min(380px, 100%)',
                    maxHeight: 'calc(100dvh - 120px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
                    overflowY: 'auto',
                    background: 'rgba(20, 12, 38, 0.98)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 18,
                    padding: 22,
                    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                  }}
                >
                  {/* 닫기 버튼 */}
                  <button
                    onClick={() => setSelectedPalace(null)}
                    style={{
                      position: 'absolute',
                      top: 14,
                      right: 14,
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.06)',
                      border: 'none',
                      color: 'var(--text-tertiary)',
                      fontSize: 20,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    aria-label="닫기"
                  >
                    ✕
                  </button>

                  {/* 헤더 — 궁 이름 + 이 방이 뭐하는 곳인지 설명 */}
                  <div style={{ marginBottom: 20, paddingRight: 36 }}>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-serif)',
                      }}
                    >
                      {p.name}
                      {p.isBodyPalace && (
                        <span style={{ fontSize: 14, color: '#F472B6', marginLeft: 8, fontWeight: 500 }}>
                          · 신궁
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--text-tertiary)',
                        marginTop: 4,
                        letterSpacing: 1,
                      }}
                    >
                      {p.heavenlyStem}{p.earthlyBranch}
                      {p.decadalRange && ` · 대한 ${p.decadalRange}`}
                    </div>

                    {/* 이 궁이 뭐하는 자리인지 쉬운 설명 */}
                    {PALACE_ROLE_META[p.name] && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: '12px 14px',
                          background: 'rgba(139,92,246,0.08)',
                          border: '1px solid rgba(139,92,246,0.25)',
                          borderRadius: 10,
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#C4B5FD', marginBottom: 4 }}>
                          이 방은 뭘 맡고 있나요?
                        </div>
                        <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>
                          {PALACE_ROLE_META[p.name].domain}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                          {PALACE_ROLE_META[p.name].focus}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 주성 — 각각 설명 풀어서 */}
                  <div style={{ marginBottom: 18 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: 10,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span style={{ display: 'inline-block', width: 3, height: 16, borderRadius: 2, background: 'var(--cta-primary)' }} />
                      주인공 별
                    </div>
                    {p.majorStars.length === 0 ? (
                      <div
                        style={{
                          fontSize: 14,
                          padding: 14,
                          borderRadius: 10,
                          background: 'rgba(255,255,255,0.04)',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.6,
                        }}
                      >
                        공궁이에요 — 이 방에는 주성이 없고 맞은편 궁(대궁)의 영향을 크게 받습니다.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {p.majorStars.map((s, i) => {
                          const meta = MAJOR_STARS_META[s.name];
                          const mutagen = s.mutagen ? MUTAGEN_META[s.mutagen] : undefined;
                          return (
                            <div
                              key={i}
                              style={{
                                padding: 14,
                                borderRadius: 12,
                                background: 'rgba(196,181,253,0.08)',
                                border: '1px solid rgba(196,181,253,0.25)',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: '#D8BFFD',
                                    fontFamily: 'var(--font-serif)',
                                  }}
                                >
                                  {s.name}
                                  {meta && <span style={{ fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: 4 }}>({meta.hanja})</span>}
                                </span>
                                {isValidBrightness(s.brightness) && (
                                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 6 }}>
                                    {s.brightness}
                                  </span>
                                )}
                                {isValidMutagen(s.mutagen) && (
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#FBBF24', background: 'rgba(251,191,36,0.12)', padding: '2px 8px', borderRadius: 6 }}>
                                    {s.mutagen}
                                  </span>
                                )}
                              </div>

                              {meta && (
                                <>
                                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6, lineHeight: 1.5 }}>
                                    {meta.theme}
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                                    {meta.keywords.slice(0, 5).map((kw, ki) => (
                                      <span
                                        key={ki}
                                        style={{
                                          fontSize: 12,
                                          padding: '3px 9px',
                                          borderRadius: 999,
                                          background: 'rgba(255,255,255,0.05)',
                                          color: 'var(--text-secondary)',
                                        }}
                                      >
                                        {kw}
                                      </span>
                                    ))}
                                  </div>
                                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 4 }}>
                                    <b style={{ color: '#34D399' }}>강점</b> {meta.strength}
                                  </div>
                                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                                    <b style={{ color: '#F87171' }}>약점</b> {meta.weakness}
                                  </div>
                                </>
                              )}

                              {mutagen && (
                                <div
                                  style={{
                                    marginTop: 10,
                                    padding: '10px 12px',
                                    background: 'rgba(251,191,36,0.1)',
                                    border: '1px solid rgba(251,191,36,0.3)',
                                    borderRadius: 8,
                                  }}
                                >
                                  <div style={{ fontSize: 12, fontWeight: 700, color: '#FBBF24', marginBottom: 3 }}>
                                    사화({mutagen.name}) 발동
                                  </div>
                                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                                    {mutagen.effect}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 보조성·살성·잡성 — 각각 설명. minorStars + adjectiveStars 통합 */}
                  {(p.minorStars.length + (p.adjectiveStars?.length || 0)) > 0 && (() => {
                    const allStars = [...p.minorStars, ...(p.adjectiveStars || [])];
                    return (
                    <div style={{ marginBottom: 18 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          marginBottom: 10,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span style={{ display: 'inline-block', width: 3, height: 16, borderRadius: 2, background: '#34D399' }} />
                        곁에서 돕는 별 · 살성 · 잡성
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {allStars.map((s, i) => {
                          const meta = MINOR_STARS_META[s.name];
                          const badgeColor =
                            meta?.category === '6길성' ? '#34D399' :
                            meta?.category === '6살성' ? '#F87171' :
                            meta?.category === '잡성' ? '#A78BFA' : 'var(--text-tertiary)';
                          return (
                            <div
                              key={i}
                              style={{
                                padding: '10px 12px',
                                borderRadius: 10,
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: meta ? 4 : 0, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {s.name}
                                  {meta && <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: 4 }}>({meta.hanja})</span>}
                                </span>
                                {meta && (
                                  <span style={{ fontSize: 11, fontWeight: 600, color: badgeColor, background: `${badgeColor}18`, padding: '2px 7px', borderRadius: 6 }}>
                                    {meta.category}
                                  </span>
                                )}
                              </div>
                              {meta && (
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                  {meta.effect}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })()}
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* 시각화 — 6궁 레이더·사화·대한 (명반 데이터 기반, AI 무관) */}
        <div className={styles.section}>
          <CorePalaceScores cores={coreScores} overall={overallScore} />
        </div>
        {mutagenPlacements.length > 0 && (
          <div className={styles.section}>
            <MutagenCards placements={mutagenPlacements} />
          </div>
        )}
        {/* 대한·유년·유월 시각은 모두 AI 풀이 섹션 안으로 통합됨 (사용자 결정 2026-05-27)
            대한 → [daehan] 섹션 안, 유년·유월 → [sohan] 섹션 안 */}

        {/* AI 풀이 — 섹션별 은유 헤드라인으로 카드화 */}
        {ZAMIDUSU_SECTION_KEYS.map((key, idx) => {
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
            <SectionCollapsible
              key={key}
              title={ZAMIDUSU_SECTION_LABELS[key]}
              metaphorTitle={hasHeadline ? headline : undefined}
              defaultOpen={idx === 0}
              enterDelay={0.05 * idx}
            >
              {/* 섹션별 데이터 카드 — 본문 위 시각 파티션 */}
              {renderSectionDataCards(key, chart, currentAge, yearlyHoroscopes, monthlyHoroscopes, currentYearForMonthly)}
              {(() => {
                const raw = hasHeadline ? body : text;
                const paragraphs = splitIntoParagraphs(raw);
                return paragraphs.map((p, i) => (
                  <p
                    key={i}
                    className="leading-[1.85]"
                    style={{
                      fontSize: 17,
                      color: 'var(--text-secondary)',
                      margin: i === 0 ? 0 : '14px 0 0',
                    }}
                  >
                    {renderEmphasis(p)}
                  </p>
                ));
              })()}
            </SectionCollapsible>
          );
        })}

        {/* AI 응답이 섹션 파싱 실패했거나 완전히 비어있으면 원문 fallback */}
        {aiResult?.content && Object.keys(sections).length === 0 && (
          <div className={styles.section}>
            <p className="leading-[1.85]" style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-line', margin: 0 }}>
              {stripAllSectionTags(aiResult.content)}
            </p>
          </div>
        )}

        {/* 엔진 기반 보조 풀이 — AI 섹션도 실패하고 원문도 없을 때만 노출 */}
        {reading && Object.keys(sections).length === 0 && !aiResult?.content && (
          <>
            <div className={styles.section}>
              <h2>명반 요약</h2>
              <p style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 12 }}>
                {reading.profileHeadline}
              </p>
              {reading.coreStars.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {reading.coreStars.map((s, i) => (
                    <div key={i} style={{ padding: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                        {s.name}({s.hanja}) — {s.keywords.slice(0, 3).join(' · ')}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.theme}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </motion.div>

      {(recordId || savedRecordId) && (
        <div style={{ marginTop: 24, padding: '0 16px' }}>
          <ShareBar recordId={(recordId || savedRecordId)!} type="saju" category="zamidusu" />
        </div>
      )}

      <div style={{ padding: '0 16px' }}>
        <ResultFooterActions />
      </div>

      <RestoreReportModal
        open={!!cacheGate}
        title="자미두수"
        onUseCached={handleUseCached}
        onRefresh={handleRefetch}
        onClose={() => setCacheGate(null)}
      />
    </div>
  );
}
