'use client';

/**
 * 사주 리포트 — 사주원국 → 사주관계 → 오행십성 → 신강신약 → 대운수
 * 정통사주(SajuResultPage) 와 만세력(ManseryeokPage) 두 곳에서 동일 렌더링 사용.
 * (AI 풀이 섹션은 정통사주 페이지에만 붙임)
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SajuResult, TEN_GODS_MAP, calculateSeWoonRange, type Interaction, type SinSal } from '../../utils/sajuCalculator';
import { determineGyeokguk, analyzeGyeokgukStatus } from '../../engine/gyeokguk';
import { stemToHanja, zhiToHanja } from '../../lib/character';
import { buildMonthlyFlow, type FortuneGrade } from '../../engine/periodFortune';
import { resolveTerm } from '../../constants/termDictionary';
import styles from '../../pages/SajuResultPage.module.css';

function CollapsibleSection({
  title,
  helpText,
  defaultOpen = false,
  children,
}: {
  title: string;
  helpText?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => setOpen(v => !v);
  return (
    <div className={styles.section}>
      {/*
        외곽 요소는 <div role="button">. <button> 안에 <button>(SectionHelp) 중첩은
        HTML 표준 위반 + React 하이드레이션 에러 유발. 키보드 접근성(Enter/Space)도 보장.
      */}
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        className={styles.collapsibleHeader}
        aria-expanded={open}
        style={{ cursor: 'pointer' }}
      >
        <div className={styles.collapsibleTitle}>
          <h2>{title}</h2>
          {helpText && <SectionHelp text={helpText} />}
        </div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className={styles.collapsibleChevron}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </motion.span>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: 12 }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const SectionHelp = ({ text }: { text: string }) => {
  const [open, setOpen] = useState(false);
  // 이 버튼은 CollapsibleSection 헤더(div role=button) 내부에 위치하므로
  // 클릭 이벤트가 바깥으로 전파되면 섹션이 동시에 펼쳐지는 버그가 생긴다.
  // stopPropagation으로 차단.
  return (
    <span
      className={styles.sectionHelpWrap}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={styles.sectionHelpBtn}
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        aria-expanded={open}
        aria-label="섹션 설명 보기"
      >
        <span aria-hidden="true">※</span>
        <span>설명</span>
      </button>
      {open && (
        <>
          <button
            type="button"
            className={styles.sectionHelpBackdrop}
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            aria-label="설명 닫기"
            tabIndex={-1}
          />
          <div className={styles.sectionHelpPopover} role="dialog" aria-modal="false">
            <button
              type="button"
              className={styles.sectionHelpClose}
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              aria-label="설명 닫기"
            >
              ×
            </button>
            <p>{text}</p>
          </div>
        </>
      )}
    </span>
  );
};

const SECTION_HELP_TEXT: Record<string, string> = {
  wonguk: '태어난 해·달·날·시의 천간과 지지로 구성된 네 기둥(年·月·日·時)이에요. 팔자(八字) 8글자가 운명의 기본 구조를 만들고, 지장간·12운성·십성으로 그 힘과 역할을 읽어요.',
  sinsal: '특정 기둥에서 발동하는 특수한 성격·사건의 단서예요. 길성(吉星)은 도움이 되는 별, 신살(神殺)은 주의해야 할 별, 중립은 양면성을 가진 별이에요.',
  relation: '사주 여덟 글자 사이의 상호작용이에요. 합(결합)·충(충돌)·형(긴장)·파(깨짐)·해(해침)는 천간과 지지의 기운이 끌어당기거나 부딪히는 방식을 나타내요.',
  ohaeng: '오행(목·화·토·금·수)은 사주에 깃든 자연 기운의 비율이고, 십성은 일간을 기준으로 다른 간지가 맡는 역할(비겁·식상·재성·관성·인성)을 뜻해요.',
  strength: '일간(日干·자기 자신)이 얼마나 힘 있게 서 있는지 판정한 결과예요. 득령(월지 지원)·득지(일지 지원)·득세(전체 지원)의 3단계로 체크해 매우 신강부터 매우 신약까지 5단계로 판별해요.',
  daewoon: '10년 단위로 바뀌는 큰 흐름의 운이에요. 대운이 시작되는 나이부터 각 구간이 어떤 오행·십성 기운을 가져오는지 보면 인생의 변동 시기를 읽을 수 있어요.',
};

function TermTap({ text, className, hint }: { text: string; className?: string; hint?: 'stem' | 'branch' | 'stage' }) {
  const [open, setOpen] = useState(false);
  const entry = resolveTerm(text, hint);
  if (!entry) return <span className={className}>{text}</span>;

  const popover = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={styles.termBackdrop}
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className={styles.termPopover}
          >
            <button type="button" onClick={() => setOpen(false)} className={styles.termPopoverClose} aria-label="닫기">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
            </button>
            <div className={styles.termPopoverTitle}>{entry.term}</div>
            <div className={styles.termPopoverShort}>{entry.short}</div>
            <div className={styles.termPopoverDesc}>{entry.description}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`${className ?? ''} ${styles.termTap}`}
        aria-label={`${text} 설명 보기`}
      >
        {text}
      </button>
      {typeof document !== 'undefined' ? createPortal(popover, document.body) : popover}
    </>
  );
}

const StemCell = ({ gan }: { gan: string }) => (
  <span className={styles.stemCell}>
    <span className={styles.pillarHangul}>{gan}</span>
    <span className={styles.pillarHanja}>{stemToHanja(gan)}</span>
  </span>
);

const BranchCell = ({ zhi }: { zhi: string }) => (
  <span className={styles.branchCell}>
    <span className={styles.pillarHanja}>{zhiToHanja(zhi)}</span>
    <span className={styles.pillarHangul}>{zhi}</span>
  </span>
);

const SIPSEONG_ORDER = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'] as const;

const SIPSEONG_COLORS: Record<string, string> = {
  '비견': '#34D399', '겁재': '#10B981',
  '식신': '#F59E0B', '상관': '#FBBF24',
  '편재': '#FB923C', '정재': '#F97316',
  '편관': '#F43F5E', '정관': '#E11D48',
  '편인': '#60A5FA', '정인': '#3B82F6',
};

function computeSipseongDistribution(result: SajuResult) {
  const dayGan = result.dayMaster;
  const map = TEN_GODS_MAP[dayGan];
  if (!map) return {} as Record<string, number>;

  const counts: Record<string, number> = {};
  SIPSEONG_ORDER.forEach(s => { counts[s] = 0; });

  const stems = [
    result.pillars.year.gan,
    result.pillars.month.gan,
    result.pillars.hour.gan,
  ];
  stems.forEach(gan => {
    const s = map[gan];
    if (s && counts[s] !== undefined) counts[s] += 1;
  });

  const branches = [
    result.pillars.year.hiddenStems,
    result.pillars.month.hiddenStems,
    result.pillars.day.hiddenStems,
    result.pillars.hour.hiddenStems,
  ];
  branches.forEach(hidden => {
    hidden.forEach(gan => {
      const s = map[gan];
      if (s && counts[s] !== undefined) counts[s] += 0.5;
    });
  });

  Object.keys(counts).forEach(k => { counts[k] = Math.round(counts[k] * 2) / 2; });

  return counts;
}

const ELEMENT_COLORS: Record<string, string> = {
  '목': '#34D399',
  '화': '#F43F5E',
  '토': '#F59E0B',
  '금': '#CBD5E1',
  '수': '#3B82F6',
};

// ── 용신·희신·기신 오행→천간 매핑 (직원 피드백: '편재' 만 보여주는 게 아니라 '병화·정화' 까지) ──
const ELEMENT_TO_STEMS: Record<string, [string, string]> = {
  '목': ['갑목', '을목'],
  '화': ['병화', '정화'],
  '토': ['무토', '기토'],
  '금': ['경금', '신금'],
  '수': ['임수', '계수'],
};

/** 십성명("편재" 또는 "편재/정재") + 일간 오행 → 그 십성이 가리키는 오행 */
function tenGodToElement(tenGod: string, dayElement: string): string {
  const GEN: Record<string, string>  = { '목': '화', '화': '토', '토': '금', '금': '수', '수': '목' };
  const CTRL: Record<string, string> = { '목': '토', '화': '금', '토': '수', '금': '목', '수': '화' };
  const PAR: Record<string, string>  = { '목': '수', '화': '목', '토': '화', '금': '토', '수': '금' };
  const BY: Record<string, string>   = { '목': '금', '화': '수', '토': '목', '금': '화', '수': '토' };
  const first = tenGod.split('/')[0];
  if (first === '비견' || first === '겁재') return dayElement;
  if (first === '식신' || first === '상관') return GEN[dayElement] || '';
  if (first === '편재' || first === '정재') return CTRL[dayElement] || '';
  if (first === '편관' || first === '정관') return BY[dayElement] || '';
  if (first === '편인' || first === '정인') return PAR[dayElement] || '';
  return '';
}

// ============== 오행 크리스털 다이아몬드 ==============
const ELEMENT_GEMS = [
  { key: '목', hanja: '木', color: '#4ADE80' },
  { key: '화', hanja: '火', color: '#F87171' },
  { key: '토', hanja: '土', color: '#FBBF24' },
  { key: '금', hanja: '金', color: '#E5E7EB' },
  { key: '수', hanja: '水', color: '#60A5FA' },
] as const;

const GEM_PATH = 'M 40 4 L 72 24 L 72 68 L 40 96 L 8 68 L 8 24 Z';

function Crystal({ hanja, color, percent, delay, idSuffix }: {
  hanja: string; color: string; percent: number; delay: number; idSuffix: string;
}) {
  const clipId = `saju-crystal-clip-${idSuffix}`;
  const gradId = `saju-crystal-grad-${idSuffix}`;
  const pct = Math.max(0, Math.min(100, percent));
  const gemTop = 4, gemBottom = 96;
  const liquidTop = gemBottom - (gemBottom - gemTop) * (pct / 100);
  const waveAmp = 3.5;
  const buildWavePath = (topY: number) => {
    const pts: string[] = [`M 0 ${topY}`];
    for (let x = 0; x <= 160; x += 10) {
      const y = topY + Math.sin((x / 160) * Math.PI * 4) * waveAmp;
      pts.push(`L ${x} ${y.toFixed(2)}`);
    }
    pts.push(`L 160 ${gemBottom}`, `L 0 ${gemBottom}`, 'Z');
    return pts.join(' ');
  };

  return (
    <motion.g
      initial={{ opacity: 0, y: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.5, ease: 'easeOut' }}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={GEM_PATH} />
        </clipPath>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0.85" />
        </linearGradient>
      </defs>
      <path d={GEM_PATH} fill="rgba(255,255,255,0.03)" stroke={`${color}55`} strokeWidth="1" />
      <g clipPath={`url(#${clipId})`}>
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            from="-80 0"
            to="0 0"
            dur="3.2s"
            repeatCount="indefinite"
          />
          <path
            d={buildWavePath(liquidTop)}
            fill={`url(#${gradId})`}
          />
        </g>
      </g>
      <path d={GEM_PATH} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      <path
        d="M 40 4 L 40 24 M 8 24 L 72 24 M 8 68 L 72 68 M 40 68 L 40 96"
        stroke={`${color}33`} strokeWidth="0.6" fill="none"
      />
      <text x="40" y="50" textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize="20" fontWeight="bold"
            style={{ fontFamily: 'var(--font-serif)' }}>
        {hanja}
      </text>
      <text x="40" y="72" textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize="10" fontWeight="600" opacity="0.9">
        {pct}%
      </text>
    </motion.g>
  );
}

// 상생: 목→화→토→금→수→목 (인접 꼭짓점)
const SHENG: Array<[number, number]> = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]];
// 상극: 목→토→수→화→금→목 (한 칸 건너)
const KE: Array<[number, number]> = [[0, 2], [2, 4], [4, 1], [1, 3], [3, 0]];

function ElementCrystalPentagon({ counts }: { counts: Record<'목'|'화'|'토'|'금'|'수', number> }) {
  const W = 340, H = 320;
  const cx = W / 2, cy = H / 2 + 8;
  const R = 112;
  const total = ELEMENT_GEMS.reduce((s, e) => s + (counts[e.key] ?? 0), 0) || 1;

  const vertexPt = (i: number, r = R) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };

  const pentagonPath = (scale: number) => {
    const pts: string[] = [];
    for (let i = 0; i < 5; i++) {
      const p = vertexPt(i, R * scale);
      pts.push(`${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    return pts.join(' ') + ' Z';
  };

  // 보석 중심에서 양쪽 끝을 safely 잘라내어 화살표가 보석 안으로 파고들지 않도록
  const GEM_RADIUS = 44;
  const shortenedLine = (i: number, j: number) => {
    const p1 = vertexPt(i);
    const p2 = vertexPt(j);
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const sx = p1.x + ux * GEM_RADIUS;
    const sy = p1.y + uy * GEM_RADIUS;
    const ex = p2.x - ux * GEM_RADIUS;
    const ey = p2.y - uy * GEM_RADIUS;
    return `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.crystalPentagonSvg}>
      <defs>
        <marker id="saju-sheng-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill="#34D399" opacity="0.95" />
        </marker>
        <marker id="saju-ke-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill="#F43F5E" opacity="0.95" />
        </marker>
      </defs>

      {[1.32, 1.0, 0.5].map((scale, i) => (
        <path
          key={i}
          d={pentagonPath(scale)}
          fill="none"
          stroke={`rgba(255,255,255,${0.04 + i * 0.02})`}
          strokeWidth={1}
          strokeDasharray={i === 0 ? '4 4' : undefined}
        />
      ))}

      {/* 상극 — 내부 펜타그램 (보석 뒤, 먼저 렌더) */}
      {KE.map(([a, b], i) => (
        <motion.path
          key={`ke-${i}`}
          d={shortenedLine(a, b)}
          stroke="#F43F5E"
          strokeWidth={1.4}
          fill="none"
          strokeDasharray="4 3"
          markerEnd="url(#saju-ke-head)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ duration: 0.5, delay: 1.1 + i * 0.08 }}
        />
      ))}

      {/* 상생 — 오각형 외곽선 (보석 뒤) */}
      {SHENG.map(([a, b], i) => (
        <motion.path
          key={`sheng-${i}`}
          d={shortenedLine(a, b)}
          stroke="#34D399"
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray="5 4"
          markerEnd="url(#saju-sheng-head)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ duration: 0.5, delay: 0.9 + i * 0.08 }}
        />
      ))}

      {/* 보석들 — 화살표 위에 올라오도록 마지막에 */}
      {ELEMENT_GEMS.map((gem, i) => {
        const p = vertexPt(i);
        const gx = p.x - 40;
        const gy = p.y - 50;
        const pct = Math.round(((counts[gem.key] ?? 0) / total) * 100);
        return (
          <g key={gem.key} transform={`translate(${gx}, ${gy})`}>
            <Crystal
              hanja={gem.hanja}
              color={gem.color}
              percent={pct}
              delay={0.1 + i * 0.08}
              idSuffix={gem.key}
            />
          </g>
        );
      })}
    </svg>
  );
}

function ElementPentagonLegend() {
  return (
    <div className={styles.pentagonKey}>
      <span className={styles.pentagonKeyItem}>
        <span
          className={styles.pentagonKeySwatch}
          style={{
            backgroundColor: '#34D399',
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.35) 2px, rgba(0,0,0,0.35) 4px)',
          }}
        />
        상생
      </span>
      <span className={styles.pentagonKeyItem}>
        <span
          className={styles.pentagonKeySwatch}
          style={{
            backgroundColor: '#F43F5E',
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
          }}
        />
        상극
      </span>
    </div>
  );
}

// ============================================
// 사주 관계 보드
// ============================================

type PillarCol = 0 | 1 | 2 | 3;
type PillarRow = 'stem' | 'branch';

const INTERACTION_COLORS: Record<Interaction['type'], string> = {
  '합': '#34D399',
  '충': '#F43F5E',
  '형': '#F59E0B',
  '파': '#60A5FA',
  '해': '#A78BFA',
};

const SINSAL_TYPE_COLORS: Record<SinSal['type'], string> = {
  gilseong: '#34D399',
  sinsal: '#F59E0B',
};

// 길성 / 신살 2분류 — 학파마다 길살/흉살/중립 기준이 모호해 단순화
const SINSAL_TYPE_LABELS: Record<SinSal['type'], string> = {
  gilseong: '길성',
  sinsal: '신살',
};

function elementPosToCell(el: string): { col: PillarCol; row: PillarRow } | null {
  const pillarChar = el[0];
  const kindChar = el[1];
  const colMap: Record<string, PillarCol> = { '시': 0, '일': 1, '월': 2, '년': 3 };
  const col = colMap[pillarChar];
  if (col == null) return null;
  if (kindChar !== '간' && kindChar !== '지') return null;
  return { col, row: kindChar === '간' ? 'stem' : 'branch' };
}

function PillarsRelationBoard({
  pillars,
  interactions,
  hourUnknown,
}: {
  pillars: SajuResult['pillars'];
  interactions: Interaction[];
  hourUnknown: boolean;
}) {
  // 정팔각형 배치 — 45° 간격으로 8꼭짓점
  // 위쪽 4개: 천간 (시·일·월·년 ←→), 아래쪽 4개: 지지 (시·일·월·년 ←→)
  const VB_W = 340;
  const VB_H = 310;
  const cx = VB_W / 2;
  const cy = VB_H / 2;
  const R = 115;

  const vertexAt = (angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + R * Math.cos(rad), y: cy + R * Math.sin(rad) };
  };

  // 8 꼭짓점 — 팔각형 시계방향 순서 (천간 왼→오, 지지 오→왼)
  const octVertices: Array<{
    col: PillarCol;
    row: PillarRow;
    x: number;
    y: number;
    pillar: typeof pillars.hour;
    unknown: boolean;
  }> = [
    { ...vertexAt(202.5), col: 0, row: 'stem',   pillar: pillars.hour,  unknown: hourUnknown },
    { ...vertexAt(247.5), col: 1, row: 'stem',   pillar: pillars.day,   unknown: false },
    { ...vertexAt(292.5), col: 2, row: 'stem',   pillar: pillars.month, unknown: false },
    { ...vertexAt(337.5), col: 3, row: 'stem',   pillar: pillars.year,  unknown: false },
    { ...vertexAt(22.5),  col: 3, row: 'branch', pillar: pillars.year,  unknown: false },
    { ...vertexAt(67.5),  col: 2, row: 'branch', pillar: pillars.month, unknown: false },
    { ...vertexAt(112.5), col: 1, row: 'branch', pillar: pillars.day,   unknown: false },
    { ...vertexAt(157.5), col: 0, row: 'branch', pillar: pillars.hour,  unknown: hourUnknown },
  ];

  // 같은 col의 stem·branch 좌표 조회
  const getVertex = (col: PillarCol, row: PillarRow) =>
    octVertices.find(v => v.col === col && v.row === row)!;

  // 팔각형 아웃라인 path
  const octOutline = octVertices
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${v.x.toFixed(1)},${v.y.toFixed(1)}`)
    .join(' ') + ' Z';

  const edges = interactions
    .map((it, idx) => {
      const cells = it.elements
        .map(elementPosToCell)
        .filter((c): c is { col: PillarCol; row: PillarRow } => c != null);
      const unique = cells.filter(
        (c, i, arr) => arr.findIndex(o => o.col === c.col && o.row === c.row) === i
      );
      return { it, cells: unique, idx };
    })
    .filter(e => e.cells.length >= 2);

  type Arc = {
    key: string;
    color: string;
    type: Interaction['type'];
    desc: string;
    d: string;
    midX: number;
    midY: number;
    labelX: number;
    labelY: number;
  };

  // 노드 반경 — 선이 노드 바깥에서 시작/끝나도록
  const NODE_R = 30;

  // 두 점 사이 선을 양끝에서 NODE_R 만큼 줄이기
  const shortenedLine = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    return {
      sx: p1.x + ux * NODE_R,
      sy: p1.y + uy * NODE_R,
      ex: p2.x - ux * NODE_R,
      ey: p2.y - uy * NODE_R,
    };
  };

  // 꼭짓점 인덱스 — stem 0~3 (col 0→3), branch 4~7 (col 3→0)
  const vertexIdx = (col: PillarCol, row: PillarRow) =>
    row === 'stem' ? col : 7 - col;

  // 중심에서 멀어지는(바깥) 단위 방향 벡터 — 팔각형 외곽 기준 라벨 배치
  const outwardAt = (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  };

  // ── 1단계: raw arc 정보 수집 (라벨 위치 미정) ─────────────────────────
  type RawArc = {
    key: string;
    color: string;
    type: Interaction['type'];
    desc: string;
    d: string;
    midX: number;
    midY: number;
    perpX: number;
    perpY: number;
    outX: number;
    outY: number;
    adjacent: boolean;
  };
  const rawArcs: RawArc[] = [];

  edges.forEach(({ it, cells, idx }) => {
    const color = INTERACTION_COLORS[it.type];
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i];
        const b = cells[j];
        const ia = vertexIdx(a.col, a.row);
        const ib = vertexIdx(b.col, b.row);
        const va = octVertices[ia];
        const vb = octVertices[ib];

        const { sx, sy, ex, ey } = shortenedLine(va, vb);
        const d = `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)}`;
        const midX = (sx + ex) / 2;
        const midY = (sy + ey) / 2;

        const diff = Math.abs(ia - ib);
        const adjacent = diff === 1 || diff === 7;

        // 선에 수직 단위 벡터
        const dxL = ex - sx;
        const dyL = ey - sy;
        const len = Math.hypot(dxL, dyL) || 1;
        const perpX = -dyL / len;
        const perpY = dxL / len;
        // 중심 → 중점 외향 단위 벡터
        const out = outwardAt(midX, midY);

        rawArcs.push({
          key: `${idx}-${i}-${j}`,
          color, type: it.type, desc: it.description, d,
          midX, midY, perpX, perpY, outX: out.x, outY: out.y, adjacent,
        });
      }
    }
  });

  // ── 2단계: 라벨 위치 결정 — 다중 후보 + 충돌 회피 스코어링 ────────────
  // 8각형 모든 선 케이스(인접 8 + diff2 8 + diff3 8 + 대각 4 = 28)에서
  // 라벨이 다른 라벨·노드와 겹치지 않도록 후보 중 최대 거리 위치 선택.
  const NODE_AVOID = 32;     // 노드 중심 회피 반경
  const LABEL_MIN_DIST = 18; // 라벨 간 최소 거리 목표
  const VIEW_PAD = 6;        // viewBox 경계 여유

  const nodePositions = octVertices.map(v => ({ x: v.x, y: v.y }));
  const placedLabels: Array<{ x: number; y: number }> = [];

  // 인접선 먼저 배치(고정 바깥 위치 선호) → 비인접선이 그 뒤에 회피
  const sortedRaw = rawArcs.slice().sort((a, b) => (b.adjacent ? 1 : 0) - (a.adjacent ? 1 : 0));

  const arcs: Arc[] = sortedRaw.map(r => {
    // 후보 위치 — 수직 방향 ±, 외향, 그리고 거리 단계
    const candidates: Array<{ x: number; y: number; bias: number }> = [];
    const DIST_STEPS = [14, 20, 28, 38, 50];
    for (const dist of DIST_STEPS) {
      // 수직 양쪽
      candidates.push({ x: r.midX + r.perpX * dist, y: r.midY + r.perpY * dist, bias: dist === 14 ? 0 : 2 });
      candidates.push({ x: r.midX - r.perpX * dist, y: r.midY - r.perpY * dist, bias: dist === 14 ? 0 : 2 });
      // 외향 (인접선은 외향이 자연스러움)
      const outBias = r.adjacent ? -4 : 1;
      candidates.push({ x: r.midX + r.outX * dist, y: r.midY + r.outY * dist, bias: outBias + (dist === 14 ? 0 : 2) });
    }

    // 각 후보 평가: 라벨 간 최소거리 + 노드 회피 + 경계 페널티 - bias(가까운 게 더 좋음)
    let best = candidates[0];
    let bestScore = -Infinity;
    for (const c of candidates) {
      let labelDist = Infinity;
      for (const p of placedLabels) {
        labelDist = Math.min(labelDist, Math.hypot(c.x - p.x, c.y - p.y));
      }
      if (placedLabels.length === 0) labelDist = LABEL_MIN_DIST * 2;

      let nodePenalty = 0;
      for (const n of nodePositions) {
        const dn = Math.hypot(c.x - n.x, c.y - n.y);
        if (dn < NODE_AVOID) nodePenalty += (NODE_AVOID - dn) * 2;
      }

      let boundPenalty = 0;
      if (c.x < VIEW_PAD) boundPenalty += (VIEW_PAD - c.x) * 3;
      if (c.x > VB_W - VIEW_PAD) boundPenalty += (c.x - (VB_W - VIEW_PAD)) * 3;
      if (c.y < VIEW_PAD) boundPenalty += (VIEW_PAD - c.y) * 3;
      if (c.y > VB_H - VIEW_PAD) boundPenalty += (c.y - (VB_H - VIEW_PAD)) * 3;

      const score = labelDist - nodePenalty - boundPenalty - c.bias;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    placedLabels.push({ x: best.x, y: best.y });

    return {
      key: r.key, color: r.color, type: r.type, desc: r.desc, d: r.d,
      midX: r.midX, midY: r.midY, labelX: best.x, labelY: best.y,
    };
  });

  // 확장 viewBox — 상단 컬럼 헤더 + 행 라벨 여유
  const MARGIN_TOP = 70;
  const MARGIN_BOT = 50;
  const EXT_H = VB_H + MARGIN_TOP + MARGIN_BOT;
  const toExtY = (y: number) => y + MARGIN_TOP;

  // 컬럼별 stem·branch x좌표 (각 기둥의 중앙)
  const colCenterX: Record<PillarCol, number> = {
    0: getVertex(0, 'stem').x,
    1: getVertex(1, 'stem').x,
    2: getVertex(2, 'stem').x,
    3: getVertex(3, 'stem').x,
  };

  // 천간/지지 행 라벨 Y — 팔각형 바깥
  const stemTopY = Math.min(...octVertices.filter(v => v.row === 'stem').map(v => v.y));
  const branchBotY = Math.max(...octVertices.filter(v => v.row === 'branch').map(v => v.y));

  return (
    <div className={styles.octBoardWrap}>
      <div
        className={styles.octBoardInner}
        style={{ aspectRatio: `${VB_W} / ${EXT_H}` }}
      >
        <svg
          className={styles.octSvg}
          viewBox={`0 0 ${VB_W} ${EXT_H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <g transform={`translate(0, ${MARGIN_TOP})`}>
            {/* 팔각형 아웃라인 */}
            <path
              d={octOutline}
              fill="rgba(124,92,252,0.06)"
              stroke="rgba(168,132,255,0.35)"
              strokeWidth={1.2}
              strokeDasharray="5 4"
            />

            {/* 천간↔지지 구분 수평선 (팔각형 너비) */}
            <line
              x1={cx - R * 0.924}
              y1={cy}
              x2={cx + R * 0.924}
              y2={cy}
              stroke="rgba(168,132,255,0.28)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />

            {/* 꼭짓점 노드 후광 */}
            {octVertices.map((v, i) => (
              <circle
                key={`node-${i}`}
                cx={v.x}
                cy={v.y}
                r={NODE_R}
                fill="rgba(20,12,38,0.85)"
                stroke={v.unknown ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.14)'}
                strokeWidth={1}
              />
            ))}

            {/* 관계 화살/아치 */}
            {arcs.map(a => (
              <motion.path
                key={a.key}
                d={a.d}
                stroke={a.color}
                strokeWidth={1.8}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={a.type === '충' ? '5 3' : '0'}
                initial={{ opacity: 0, pathLength: 0 }}
                animate={{ opacity: 0.95, pathLength: 1 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            ))}

            {/* 라벨 leader — 라벨이 어느 선 위에서 떨어졌는지 명시 */}
            {arcs.map(a => {
              const dist = Math.hypot(a.labelX - a.midX, a.labelY - a.midY);
              if (dist < 10) return null;
              return (
                <line
                  key={`lead-${a.key}`}
                  x1={a.midX}
                  y1={a.midY}
                  x2={a.labelX}
                  y2={a.labelY}
                  stroke={a.color}
                  strokeWidth={0.6}
                  strokeDasharray="2 2"
                  opacity={0.45}
                />
              );
            })}
          </g>
        </svg>

        {/* 컬럼 헤더 — 각 기둥 x 위에 절대 배치 */}
        {(['시주', '일주', '월주', '년주'] as const).map((label, i) => (
          <span
            key={`colh-${i}`}
            className={styles.octColLabel}
            style={{
              left: `${(colCenterX[i as PillarCol] / VB_W) * 100}%`,
              top: `${((toExtY(stemTopY) - NODE_R - 40) / EXT_H) * 100}%`,
            }}
          >
            {label}
          </span>
        ))}

        {/* 8글자 HTML 레이어 */}
        {octVertices.map((v, i) => {
          const isStemRow = v.row === 'stem';
          const element = isStemRow ? v.pillar.ganElement : v.pillar.zhiElement;
          return (
            <span
              key={`cell-${i}`}
              className={`${styles.octCell} ${v.unknown ? styles.hourUnknownCell : ''}`}
              style={{
                left: `${(v.x / VB_W) * 100}%`,
                top: `${(toExtY(v.y) / EXT_H) * 100}%`,
                color: v.unknown ? undefined : ELEMENT_COLORS[element],
              }}
            >
              {v.unknown ? '?' : isStemRow ? <StemCell gan={v.pillar.gan} /> : <BranchCell zhi={v.pillar.zhi} />}
            </span>
          );
        })}

        {/* 관계 라벨 */}
        {arcs.map(a => (
          <span
            key={`lab-${a.key}`}
            className={styles.relationLabelBadge}
            style={{
              left: `${(a.labelX / VB_W) * 100}%`,
              top: `${(toExtY(a.labelY) / EXT_H) * 100}%`,
              color: a.color,
              borderColor: a.color,
            }}
          >
            {a.type}
          </span>
        ))}

        {/* 행 라벨 */}
        <span
          className={styles.octRowLabel}
          style={{ top: `${((toExtY(stemTopY) - NODE_R - 18) / EXT_H) * 100}%` }}
        >
          천간
        </span>
        <span
          className={styles.octRowLabel}
          style={{ top: `${((toExtY(branchBotY) + NODE_R + 18) / EXT_H) * 100}%` }}
        >
          지지
        </span>
      </div>

      {interactions.length > 0 && (
        <ul className={styles.relationLegend}>
          {interactions.map((it, i) => (
            <li key={i} className={styles.relationLegendItem}>
              <span
                className={styles.relationLegendBadge}
                style={{ color: INTERACTION_COLORS[it.type], borderColor: INTERACTION_COLORS[it.type] }}
              >
                {it.type}
              </span>
              <span className={styles.relationLegendDesc}>{it.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SinSalBoard({
  pillars,
  sinSals,
  hourUnknown,
}: {
  pillars: SajuResult['pillars'];
  sinSals: SinSal[];
  hourUnknown: boolean;
}) {
  const columns = [
    { col: 0 as PillarCol, pillar: pillars.hour, unknown: hourUnknown },
    { col: 1 as PillarCol, pillar: pillars.day, unknown: false },
    { col: 2 as PillarCol, pillar: pillars.month, unknown: false },
    { col: 3 as PillarCol, pillar: pillars.year, unknown: false },
  ];

  const byCol: Record<PillarCol, SinSal[]> = { 0: [], 1: [], 2: [], 3: [] };
  sinSals.forEach(s => {
    const unique = Array.from(new Set(s.pillars)) as PillarCol[];
    unique.forEach(c => {
      if (c === 0 || c === 1 || c === 2 || c === 3) {
        const exists = byCol[c].some(x => x.name === s.name);
        if (!exists) byCol[c].push(s);
      }
    });
  });
  // 각 컬럼 안에서도 길성→신살→중립 순서로 정렬 (아래 설명 리스트와 통일)
  // 직원 피드백 + 사용자 보고: 년주에서 길성→중립→길성→신살 식 뒤섞여 보이는 문제
  const TYPE_ORDER_COL: Record<SinSal['type'], number> = { gilseong: 0, sinsal: 1 };
  (Object.keys(byCol) as unknown as PillarCol[]).forEach((c) => {
    byCol[c].sort((a, b) => TYPE_ORDER_COL[a.type] - TYPE_ORDER_COL[b.type]);
  });

  return (
    <div className={styles.sinsalBoardWrap}>
      {/* 범례 — 길성 / 신살 2분류 */}
      <div className={styles.sinsalLegend}>
        <span className={styles.sinsalLegendItem} style={{ color: SINSAL_TYPE_COLORS.gilseong }}>
          <span className={styles.sinsalLegendDot} style={{ background: SINSAL_TYPE_COLORS.gilseong }} />
          길성 (귀인성·이로움)
        </span>
        <span className={styles.sinsalLegendItem} style={{ color: SINSAL_TYPE_COLORS.sinsal }}>
          <span className={styles.sinsalLegendDot} style={{ background: SINSAL_TYPE_COLORS.sinsal }} />
          신살 (작용 살펴볼 것)
        </span>
      </div>
      {/*
        직원 피드백: 사주원국과 신살/길성 섹션에 한자 8글자(천간·지지)가 중복 표기됨.
        사주원국에 이미 있으므로 신살 보드에서는 천간/지지 행을 제거하고
        시주/일주/월주/년주 컬럼 헤더만 남겨 신살/길성 행 하나만 보여준다.
      */}
      <div className={styles.pillarsTable}>
        <div className={styles.pillarsHeader}>
          <span aria-hidden="true" />
          <span>시주</span>
          <span>일주</span>
          <span>월주</span>
          <span>년주</span>
        </div>
        <div className={`${styles.pillarsRow} ${styles.sinsalRow}`}>
          <span className={styles.label}>신살/길성</span>
          {columns.map(({ col }) => (
            <span key={`st-${col}`} className={styles.sinsalTagCell}>
              {byCol[col].length === 0 ? (
                <span className={styles.sinsalTagEmpty}>—</span>
              ) : (
                byCol[col].map(s => (
                  <span
                    key={s.name}
                    className={styles.sinsalTag}
                    style={{ color: SINSAL_TYPE_COLORS[s.type], borderColor: SINSAL_TYPE_COLORS[s.type] }}
                    title={s.description}
                  >
                    {s.name}
                  </span>
                ))
              )}
            </span>
          ))}
        </div>
      </div>
      {sinSals.length > 0 && (() => {
        /*
          타입(길성/신살/중립)별로 그룹화 — 각 행마다 라벨 반복하면
          설명이 좁아져 줄바꿈 강제됨. 그룹 헤더에 라벨 한 번,
          각 행은 이름 + 설명만 두어 설명 폭을 최대화.
        */
        const TYPE_ORDER: SinSal['type'][] = ['gilseong', 'sinsal'];
        const uniques = sinSals.filter((s, i, arr) => arr.findIndex(x => x.name === s.name) === i);
        const grouped = TYPE_ORDER
          .map(type => ({ type, items: uniques.filter(s => s.type === type) }))
          .filter(g => g.items.length > 0);
        return (
          <div className={styles.sinsalGroups}>
            {grouped.map(({ type, items }) => (
              <div key={type} className={styles.sinsalGroup}>
                <div
                  className={styles.sinsalGroupHeader}
                  style={{
                    color: SINSAL_TYPE_COLORS[type],
                    borderColor: SINSAL_TYPE_COLORS[type],
                  }}
                >
                  {SINSAL_TYPE_LABELS[type]}
                </div>
                <ul className={styles.sinsalDescList}>
                  {items.map((s) => (
                    <li key={s.name} className={styles.sinsalDescItem}>
                      <span
                        className={styles.sinsalDescName}
                        style={{ color: SINSAL_TYPE_COLORS[type] }}
                      >
                        {s.name}
                      </span>
                      <span className={styles.sinsalDescText}>{s.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

/**
 * 가로 스크롤 컨테이너에 마우스 드래그 + 터치 스와이프 추가.
 *
 * 데스크탑: 카드 위에서 마우스를 누른 채 드래그하면 컨테이너가 좌우로 스크롤됨.
 * 모바일: 카드 button 의 클릭 처리가 native swipe 를 잡아먹는 케이스가 있어
 *        pointer 이벤트로 직접 scrollLeft 제어 (단순 탭은 그대로 click 발화).
 *
 * 드래그 거리 6px 이상이면 그 직후의 click 이벤트를 한 번 막아 카드 onClick 이
 * 의도치 않게 발생하는 것을 방지.
 */
function useDragScroll(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let dragged = false;
    const DRAG_THRESHOLD = 6;

    const onPointerDown = (e: PointerEvent) => {
      isDown = true;
      dragged = false;
      startX = e.clientX;
      scrollLeft = el.scrollLeft;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > DRAG_THRESHOLD) {
        dragged = true;
        el.style.cursor = 'grabbing';
        el.scrollLeft = scrollLeft - dx;
      }
    };
    const onPointerUp = () => {
      if (!isDown) return;
      isDown = false;
      el.style.cursor = '';
      if (dragged) {
        // 드래그 직후의 click 한 번만 차단 — 카드 onClick 오발화 방지
        const block = (ev: MouseEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
          el.removeEventListener('click', block, true);
        };
        el.addEventListener('click', block, true);
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [ref]);
}

/**
 * 대운 → 세운 → 월운 드릴다운.
 *
 * 동작:
 * 1) 대운 카드 클릭: 그 대운(10년)의 시작/끝 연도 범위로 세운 영역을 자동 스크롤·강조
 * 2) 세운 카드 클릭: 그 연도의 12개월 월운 그리드 인라인 표시 (다시 클릭 시 닫힘)
 * 3) 초기엔 현재 대운·세운이 강조된 채 가운데로 스크롤
 * 4) 가로 스크롤 영역은 마우스 드래그 / 터치 스와이프 모두 지원 (useDragScroll)
 */
function DaeWoonSection({
  daeWoon,
  seWoon,
  result,
}: {
  daeWoon: SajuResult['daeWoon'];
  seWoon: SajuResult['seWoon'];
  result: SajuResult;
}) {
  const dwScrollRef = useRef<HTMLDivElement>(null);
  const swScrollRef = useRef<HTMLDivElement>(null);
  // 카드를 button 으로 바꿔 클릭·키보드 접근성 확보 — ref 타입도 HTMLButtonElement 로
  const currentDwRef = useRef<HTMLDivElement>(null);
  const currentSwRef = useRef<HTMLDivElement>(null);

  // 가로 스크롤에 마우스 드래그 + 터치 스와이프 활성화
  useDragScroll(dwScrollRef);
  useDragScroll(swScrollRef);

  const birthYear = parseInt(result.solarDate.split('-')[0]);
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - birthYear;
  const yearZhi = result.pillars.year.zhi;

  // 사용자가 선택한 대운(시작 나이) — 진입 즉시 현재 대운 자동 펼침
  const [selectedDwAge, setSelectedDwAge] = useState<number | null>(() => {
    for (let i = 0; i < 10; i++) {
      const age = result.daeWoonStartAge + i * 10;
      if (currentAge >= age && currentAge < age + 10) return age;
    }
    return null;
  });
  // 사용자가 선택한 세운(연도) — 진입 즉시 현재 년도 자동 선택 (월운 펼침)
  const [selectedYear, setSelectedYear] = useState<number | null>(currentYear);

  // 선택된 대운의 [시작 연도, 끝 연도]
  const selectedDwRange = useMemo(() => {
    if (selectedDwAge == null) return null;
    const startYear = birthYear + selectedDwAge;
    return { startYear, endYear: startYear + 9 };
  }, [selectedDwAge, birthYear]);

  // 대운 선택에 따라 세운 10년분 동적 계산
  // 대운과 동일하게 우→좌 정렬(왼=미래, 오른=과거) — calculateSeWoonRange 는 오름차순이므로 reverse
  const displaySeWoon = useMemo(() => {
    const range = selectedDwRange
      ? calculateSeWoonRange(result.dayMaster, selectedDwRange.startYear, 10, yearZhi)
      : seWoon;
    return [...range].reverse();
  }, [selectedDwRange, result.dayMaster, yearZhi, seWoon]);

  // 대운 변경 시 세운 선택: 현재 년도가 범위 안이면 유지, 아니면 초기화
  useEffect(() => {
    if (selectedDwRange) {
      const inRange = currentYear >= selectedDwRange.startYear && currentYear <= selectedDwRange.endYear;
      setSelectedYear(inRange ? currentYear : null);
    } else {
      setSelectedYear(null);
    }
  }, [selectedDwAge, selectedDwRange, currentYear]);

  // 선택된 연도의 월운 — 클릭 시점에만 계산
  const monthlyFlow = useMemo(() => {
    if (selectedYear == null) return null;
    try {
      return buildMonthlyFlow(result, selectedYear);
    } catch {
      return null;
    }
  }, [selectedYear, result]);

  // 대운 현재 카드 중앙 스크롤
  useEffect(() => {
    if (currentDwRef.current && dwScrollRef.current) {
      const container = dwScrollRef.current;
      const card = currentDwRef.current;
      const offset = card.offsetLeft - container.offsetLeft - container.clientWidth / 2 + card.clientWidth / 2;
      container.scrollLeft = Math.max(0, offset);
    }
  }, []);

  // 세운 현재 년도 카드 중앙 스크롤
  useEffect(() => {
    requestAnimationFrame(() => {
      if (currentSwRef.current && swScrollRef.current) {
        const container = swScrollRef.current;
        const card = currentSwRef.current;
        const offset = card.offsetLeft - container.offsetLeft - container.clientWidth / 2 + card.clientWidth / 2;
        container.scrollLeft = Math.max(0, offset);
      }
    });
  }, [displaySeWoon]);

  const monthlyGradeColor: Record<FortuneGrade, string> = {
    '대길': '#34D399', '길': '#86EFAC', '중길': '#FBBF24',
    '평': '#CBD5E1', '중흉': '#FB923C', '흉': '#F87171',
  };

  return (
    <>
      <div className={styles.subheading}>대운 (10년 주기)</div>
      <p className={styles.sectionHint} style={{ margin: '0 0 8px' }}>
        대운 카드를 누르면 해당 시기의 세운으로 이동, 세운을 누르면 그 해 12개월 월운이 펼쳐져요.
      </p>
      <div className={styles.daewoonScroll} ref={dwScrollRef}>
        {daeWoon.slice(0, 10).map((dw, i) => ({
          ...dw,
          _age: result.daeWoonStartAge + i * 10,
        })).reverse().map((dw) => {
          const age = dw._age;
          const isCurrent = currentAge >= age && currentAge < age + 10;
          const isSelected = selectedDwAge === age;
          return (
            <div
              role="button"
              tabIndex={0}
              key={age}
              ref={isCurrent ? currentDwRef : undefined}
              onClick={() => setSelectedDwAge(isSelected ? null : age)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDwAge(isSelected ? null : age); } }}
              className={`${styles.daewoonCard} ${isCurrent ? styles.current : ''} ${isSelected ? styles.selected : ''}`}
              aria-pressed={isSelected}
            >
              <div className={styles.dwAge}>{age}세</div>
              <div className={styles.dwTenGod}><TermTap text={dw.tenGod} /></div>
              <div className={styles.dwGanBox} style={{ background: `${ELEMENT_COLORS[dw.ganElement]}22`, color: ELEMENT_COLORS[dw.ganElement] }}>{stemToHanja(dw.gan)}</div>
              <div className={styles.dwGanBox} style={{ background: `${ELEMENT_COLORS[dw.zhiElement]}22`, color: ELEMENT_COLORS[dw.zhiElement] }}>{zhiToHanja(dw.zhi)}</div>
              <div className={styles.dwMeta}><TermTap text={dw.tenGodZhi} /></div>
              <div className={styles.dwMeta}><TermTap text={dw.twelveStage} hint="stage" /></div>
              {dw.sinSal12 && <div className={styles.dwMetaSinsal}><TermTap text={dw.sinSal12} /></div>}
            </div>
          );
        })}
      </div>

      <div className={styles.subheading} style={{ marginTop: 16 }}>
        세운 (연운)
        {selectedDwRange && (
          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 400 }}>
            · {selectedDwRange.startYear}~{selectedDwRange.endYear}년
          </span>
        )}
      </div>
      <div className={styles.daewoonScroll} ref={swScrollRef}>
        {displaySeWoon.map((sw) => {
          const isCurrent = sw.year === currentYear;
          const isSelected = selectedYear === sw.year;
          return (
            <div
              role="button"
              tabIndex={0}
              key={sw.year}
              ref={isCurrent ? currentSwRef : undefined}
              data-sw-year={sw.year}
              onClick={() => setSelectedYear(isSelected ? null : sw.year)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedYear(isSelected ? null : sw.year); } }}
              className={`${styles.sewoonCard} ${isCurrent ? styles.current : ''} ${isSelected ? styles.selected : ''}`}
              aria-pressed={isSelected}
            >
              <div className={styles.swYear}>{sw.year}년</div>
              <div className={styles.swAnimal}>{sw.animal}띠</div>
              <div className={styles.dwTenGod}><TermTap text={sw.tenGod} /></div>
              <div className={styles.dwGanBox} style={{ background: `${ELEMENT_COLORS[sw.ganElement]}22`, color: ELEMENT_COLORS[sw.ganElement] }}>{stemToHanja(sw.gan)}</div>
              <div className={styles.dwGanBox} style={{ background: `${ELEMENT_COLORS[sw.zhiElement]}22`, color: ELEMENT_COLORS[sw.zhiElement] }}>{zhiToHanja(sw.zhi)}</div>
              <div className={styles.dwMeta}><TermTap text={sw.tenGodZhi} /></div>
              <div className={styles.dwMeta}><TermTap text={sw.twelveStage} hint="stage" /></div>
              {sw.sinSal12 && <div className={styles.dwMetaSinsal}><TermTap text={sw.sinSal12} /></div>}
            </div>
          );
        })}
      </div>

      {/* 월운 — 세운 카드 선택 시 인라인 그리드 */}
      <AnimatePresence initial={false}>
        {selectedYear != null && monthlyFlow && (
          <motion.div
            key={`monthly-${selectedYear}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className={styles.subheading} style={{ marginTop: 14 }}>
              월운 — {selectedYear}년
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 6,
                marginTop: 6,
              }}
            >
              {monthlyFlow.map((m) => {
                const c = monthlyGradeColor[m.grade];
                return (
                  <div
                    key={m.month}
                    style={{
                      padding: '10px 6px',
                      borderRadius: 10,
                      border: `1px solid ${c}66`,
                      background: `${c}22`,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 700, color: c }}>{m.month}월</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}><TermTap text={m.tenGod} /></div>
                    <div className={styles.dwGanBox} style={{ background: `${ELEMENT_COLORS[m.ganElement]}22`, color: ELEMENT_COLORS[m.ganElement], margin: '3px auto' }}>{stemToHanja(m.gan)}</div>
                    <div className={styles.dwGanBox} style={{ background: `${ELEMENT_COLORS[m.zhiElement]}22`, color: ELEMENT_COLORS[m.zhiElement], margin: '0 auto' }}>{zhiToHanja(m.zhi)}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
                      <div><TermTap text={m.tenGodZhi} /></div>
                      <div><TermTap text={m.twelveStage} hint="stage" /></div>
                      {m.sinSal12 && <div style={{ color: 'var(--text-tertiary)' }}><TermTap text={m.sinSal12} /></div>}
                    </div>
                    <div style={{ fontSize: 14, color: c, marginTop: 3, fontWeight: 700 }}>{m.grade}</div>
                    {m.keyword && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{m.keyword}</div>}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * @param hideManseryeok - 정통사주에선 만세력 섹션 중복이라 숨김. 만세력 페이지 단독 진입 시는 그대로 표시.
 * @param defaultExpanded - true 면 모든 CollapsibleSection 이 펼친 상태로 마운트. 만세력 페이지 디폴트 펼침용.
 */
export default function SajuReport({
  result,
  hideManseryeok = false,
  defaultExpanded = false,
}: {
  result: SajuResult;
  hideManseryeok?: boolean;
  defaultExpanded?: boolean;
}) {
  const { pillars, elementCount, daeWoon, seWoon, sinSals, interactions } = result;

  const gyeokguk = useMemo(() => determineGyeokguk(result), [result]);
  const gyeokgukStatus = useMemo(
    () => analyzeGyeokgukStatus(result, gyeokguk),
    [result, gyeokguk]
  );
  const sipseongDist = useMemo(() => computeSipseongDistribution(result), [result]);

  return (
    <>
      {/* 1. 사주 원국 — 정통사주 화면에선 중복이라 숨김 (만세력 페이지 단독 진입 시는 표시) */}
      {!hideManseryeok && (
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>사주 원국 (만세력)</h2>
          <SectionHelp text={SECTION_HELP_TEXT.wonguk} />
        </div>
        <div className={styles.pillarsTable}>
          <div className={styles.pillarsHeader}>
            <span aria-hidden="true" />
            <span>시주</span>
            <span>일주</span>
            <span>월주</span>
            <span>년주</span>
          </div>
          <div className={styles.pillarsRow}>
            <span className={styles.label}>천간 십성</span>
            <span className={result.hourUnknown ? styles.hourUnknownCell : ''}>
              {result.hourUnknown ? '—' : <TermTap text={pillars.hour.tenGodGan} />}
            </span>
            <span className={styles.highlight}>(본인)</span>
            <span><TermTap text={pillars.month.tenGodGan} /></span>
            <span><TermTap text={pillars.year.tenGodGan} /></span>
          </div>
          <div className={`${styles.pillarsRow} ${styles.stemRow}`}>
            <span className={styles.label}>천간</span>
            <span
              className={result.hourUnknown ? styles.hourUnknownCell : ''}
              style={result.hourUnknown ? undefined : { color: ELEMENT_COLORS[pillars.hour.ganElement] }}
            >
              {result.hourUnknown ? '?' : <StemCell gan={pillars.hour.gan} />}
            </span>
            <span style={{ color: ELEMENT_COLORS[pillars.day.ganElement] }}><StemCell gan={pillars.day.gan} /></span>
            <span style={{ color: ELEMENT_COLORS[pillars.month.ganElement] }}><StemCell gan={pillars.month.gan} /></span>
            <span style={{ color: ELEMENT_COLORS[pillars.year.ganElement] }}><StemCell gan={pillars.year.gan} /></span>
          </div>
          <div className={`${styles.pillarsRow} ${styles.branchRow}`}>
            <span className={styles.label}>지지</span>
            <span
              className={result.hourUnknown ? styles.hourUnknownCell : ''}
              style={result.hourUnknown ? undefined : { color: ELEMENT_COLORS[pillars.hour.zhiElement] }}
            >
              {result.hourUnknown ? '?' : <BranchCell zhi={pillars.hour.zhi} />}
            </span>
            <span style={{ color: ELEMENT_COLORS[pillars.day.zhiElement] }}><BranchCell zhi={pillars.day.zhi} /></span>
            <span style={{ color: ELEMENT_COLORS[pillars.month.zhiElement] }}><BranchCell zhi={pillars.month.zhi} /></span>
            <span style={{ color: ELEMENT_COLORS[pillars.year.zhiElement] }}><BranchCell zhi={pillars.year.zhi} /></span>
          </div>
          {/* 지지 십성 — 지장간 본기 기준 */}
          <div className={styles.pillarsRow}>
            <span className={styles.label}>지지 십성</span>
            <span className={result.hourUnknown ? styles.hourUnknownCell : ''}>
              {result.hourUnknown ? '—' : <TermTap text={pillars.hour.tenGodZhi} />}
            </span>
            <span><TermTap text={pillars.day.tenGodZhi} /></span>
            <span><TermTap text={pillars.month.tenGodZhi} /></span>
            <span><TermTap text={pillars.year.tenGodZhi} /></span>
          </div>
          <div className={styles.pillarsRow}>
            <span className={styles.label}>지장간</span>
            <span className={`${styles.hiddenStems} ${result.hourUnknown ? styles.hourUnknownCell : ''}`}>
              {result.hourUnknown ? '—' : pillars.hour.hiddenStems.map((g, i) => (
                <TermTap key={`${g}-${i}`} text={g} hint="stem" className={styles.hiddenStemTap} />
              ))}
            </span>
            <span className={styles.hiddenStems}>{pillars.day.hiddenStems.map((g, i) => (
              <TermTap key={`${g}-${i}`} text={g} hint="stem" className={styles.hiddenStemTap} />
            ))}</span>
            <span className={styles.hiddenStems}>{pillars.month.hiddenStems.map((g, i) => (
              <TermTap key={`${g}-${i}`} text={g} hint="stem" className={styles.hiddenStemTap} />
            ))}</span>
            <span className={styles.hiddenStems}>{pillars.year.hiddenStems.map((g, i) => (
              <TermTap key={`${g}-${i}`} text={g} hint="stem" className={styles.hiddenStemTap} />
            ))}</span>
          </div>
          <div className={styles.pillarsRow}>
            <span className={styles.label}>12운성</span>
            <span className={result.hourUnknown ? styles.hourUnknownCell : ''}>
              {result.hourUnknown ? '—' : <TermTap text={pillars.hour.twelveStage} hint="stage" />}
            </span>
            <span><TermTap text={pillars.day.twelveStage} hint="stage" /></span>
            <span><TermTap text={pillars.month.twelveStage} hint="stage" /></span>
            <span><TermTap text={pillars.year.twelveStage} hint="stage" /></span>
          </div>
        </div>

        {/*
          신살·길성, 합·충·형·파·해는 출생 시 8글자에서 즉시 도출되는 고정 정보라
          사주원국 한 섹션 안에 소제목으로 묶어 표시.
          (이전엔 별도 "사주 관계" CollapsibleSection 으로 분리되어 맥락이 끊겼음)
        */}

        {/* 신살과 길성 */}
        {sinSals.length > 0 && (
          <>
            <div className={styles.subheading} style={{ marginTop: 22 }}>신살과 길성</div>
            <SinSalBoard
              pillars={pillars}
              sinSals={sinSals}
              hourUnknown={result.hourUnknown}
            />
          </>
        )}

        {/* 천간과 지지 관계 (합·충·형·파·해) */}
        {interactions.length > 0 && (
          <>
            <div className={styles.subheading} style={{ marginTop: 22 }}>천간과 지지 관계</div>
            <PillarsRelationBoard
              pillars={pillars}
              interactions={interactions}
              hourUnknown={result.hourUnknown}
            />
            <p className={styles.sectionHint} style={{ marginTop: 14 }}>
              합·충·형·파·해는 천간과 지지 사이의 기운이 끌어당기거나 부딪히는 방식이에요.
            </p>
          </>
        )}
      </div>
      )}

      {/* 3. 오행과 십성 */}
      <CollapsibleSection title="오행과 십성" helpText={SECTION_HELP_TEXT.ohaeng} defaultOpen={defaultExpanded}>
        <div className={styles.ohaengHeader}>
          <span className={styles.subheading}>오행 분포</span>
          <span className={styles.ohaengMeta}>
            {result.isStrong ? '신강' : '신약'} · 용신 {result.yongSinElement}
          </span>
        </div>
        <div className={styles.crystalPentagonWrap}>
          <ElementCrystalPentagon counts={elementCount as Record<'목'|'화'|'토'|'금'|'수', number>} />
        </div>
        <ElementPentagonLegend />

        <div className={styles.subheading} style={{ marginTop: 20 }}>십성 분포 (十星)</div>
        <div className={styles.sipseongGrid}>
          {SIPSEONG_ORDER.map((s) => {
            const count = sipseongDist[s] || 0;
            const dimmed = count === 0;
            return (
              <div
                key={s}
                className={`${styles.sipseongItem} ${dimmed ? styles.sipseongDim : ''}`}
                style={{ borderColor: dimmed ? 'var(--border-subtle)' : SIPSEONG_COLORS[s] }}
              >
                <span
                  className={styles.sipseongName}
                  style={{ color: dimmed ? 'var(--text-tertiary)' : SIPSEONG_COLORS[s] }}
                >
                  {s}
                </span>
                <span className={styles.sipseongCount}>{count}</span>
              </div>
            );
          })}
        </div>
        <p className={styles.sectionHint}>
          오행은 내 사주에 깃든 자연의 기운 비율이고, 십성은 일간을 기준으로 다른 간지가 어떤 역할(관성·재성·인성 등)을 하는지 보여줘요.
        </p>
      </CollapsibleSection>

      {/* 4. 신강신약 */}
      <CollapsibleSection title="신강신약 · 용신 · 격국" helpText={SECTION_HELP_TEXT.strength} defaultOpen={defaultExpanded}>
        <div className={styles.strengthBox}>
          <div className={styles.strengthBadge} data-strong={result.isStrong}>
            {result.strengthStatus} ({result.strengthScore}점)
          </div>
          <div className={styles.strengthTrio}>
            <span className={styles.trioChip} data-on={result.deukRyeong}>
              <span className={styles.trioName}>득령</span>
              <span className={styles.trioValue}>{result.deukRyeong ? '성립' : '불성립'}</span>
            </span>
            <span className={styles.trioChip} data-on={result.deukJi}>
              <span className={styles.trioName}>득지</span>
              <span className={styles.trioValue}>{result.deukJi ? '성립' : '불성립'}</span>
            </span>
            <span className={styles.trioChip} data-on={result.deukSe}>
              <span className={styles.trioName}>득세</span>
              <span className={styles.trioValue}>{result.deukSe ? '성립' : '불성립'}</span>
            </span>
          </div>
          <p>{result.strengthAnalysis}</p>
          <div className={styles.strengthDetail}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>강화점(비겁·인성·득령)</span>
              <span className={styles.detailValue}>{result.strengthDetail.supportTotal.toFixed(1)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>약화점(식상·재성·관성)</span>
              <span className={styles.detailValue}>{result.strengthDetail.weakenTotal.toFixed(1)}</span>
            </div>
            <div className={styles.detailBreakdown}>
              <span>비겁 {result.strengthDetail.bijeopScore.toFixed(1)}</span>
              <span>인성 {result.strengthDetail.inseongScore.toFixed(1)}</span>
              <span>식상 {result.strengthDetail.sikSangPenalty.toFixed(1)}</span>
              <span>재성 {result.strengthDetail.jaeseongPenalty.toFixed(1)}</span>
              <span>관성 {result.strengthDetail.gwanseongPenalty.toFixed(1)}</span>
            </div>
          </div>
        </div>

        <div className={styles.subheading} style={{ marginTop: 16 }}>용신 · 희신 · 기신</div>
        <div className={styles.yongshinBox}>
          {/*
            직원 피드백: 십성만 표시 → 오행 + 구체 천간(병화·정화 등) 까지 보여 명리적 정확성↑.
            tenGodToElement 가 십성명 → 오행 매핑, ELEMENT_TO_STEMS 가 오행 → 천간.
          */}
          {(() => {
            const renderRow = (label: string, tenGod: string, element: string) => {
              const stems = ELEMENT_TO_STEMS[element];
              const color = ELEMENT_COLORS[element] ?? 'var(--text-secondary)';
              return (
                <div className={styles.yongshinItem}>
                  <span className={styles.yLabel}>{label}</span>
                  <span className={styles.yValue}>
                    <span style={{ color, fontWeight: 700 }}>{element}</span>
                    {stems && (
                      <span style={{ color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: 6 }}>
                        ({stems[0]}·{stems[1]})
                      </span>
                    )}
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 500, marginLeft: 6 }}>
                      · {tenGod}
                    </span>
                  </span>
                </div>
              );
            };
            const heeEl = tenGodToElement(result.heeSin, result.dayMasterElement);
            const giEl = tenGodToElement(result.giSin, result.dayMasterElement);
            return (
              <>
                {renderRow('용신', result.yongSin, result.yongSinElement)}
                {renderRow('희신', result.heeSin, heeEl)}
                {renderRow('기신', result.giSin, giEl)}
              </>
            );
          })()}
        </div>

        {/* 용신·희신·기신 풀이 — 사용자 피드백: 단어만 보면 뜻 모름 */}
        <div className={styles.yongshinLegend}>
          <p>
            <b>용신(用神)</b> — 내 일간(자기 자신)의 균형을 맞춰주는 핵심 오행이에요.
            이 기운이 강한 시기·환경·인연을 만나면 일이 풀려요.
          </p>
          <p>
            <b>희신(喜神)</b> — 용신을 도와주는 보조 오행이에요.
            용신만큼은 아니어도 좋은 운을 더해주는 기운이라 함께 받으면 효과가 커져요.
          </p>
          <p>
            <b>기신(忌神)</b> — 용신을 깨뜨려 흉작용을 일으키는 오행이에요.
            이 기운이 강한 시기엔 무리한 결정·확장은 잠시 미루는 게 좋아요.
          </p>
        </div>

        {gyeokguk && (
          <>
            <div className={styles.subheading} style={{ marginTop: 16 }}>격국 (格局)</div>
            <div className={styles.gyeokgukBox}>
              <div className={styles.gyeokgukHeader}>
                <span className={styles.gyeokgukName}>
                  {gyeokguk.name}
                  {gyeokguk.nameHanja && <small> · {gyeokguk.nameHanja}</small>}
                </span>
                <span className={styles.gyeokgukType}>{gyeokguk.type}</span>
              </div>
              <p className={styles.gyeokgukDesc}>{gyeokguk.description}</p>
              <p className={styles.gyeokgukReason}>판정 근거: {gyeokguk.reason}</p>

              {gyeokgukStatus && (
                <div
                  className={styles.gyeokgukStatus}
                  data-success={gyeokgukStatus.isSuccessful}
                >
                  <strong>{gyeokgukStatus.isSuccessful ? '성격(成格)' : '패격(敗格)'}</strong>
                  <span>{gyeokgukStatus.analysis}</span>
                </div>
              )}

              <div className={styles.gyeokgukTraits}>
                <div className={styles.traitRow}>
                  <span className={styles.traitLabel}>성향 키워드</span>
                  <div className={styles.traitChips}>
                    {gyeokguk.traits.map((t) => (
                      <span key={t} className={styles.chip}>{t}</span>
                    ))}
                  </div>
                </div>
                <div className={styles.traitRow}>
                  <span className={styles.traitLabel}>어울리는 직업</span>
                  <div className={styles.traitChips}>
                    {gyeokguk.careers.map((c) => (
                      <span key={c} className={`${styles.chip} ${styles.chipAccent}`}>{c}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <p className={styles.sectionHint}>
          신강·신약은 내 일간이 얼마나 힘 있게 버티고 있는지 판정한 결과예요. 그에 따라 필요한 용신과 주된 성격 유형(격국)이 결정돼요.
        </p>
      </CollapsibleSection>

      {/* 5. 대운수 */}
      <CollapsibleSection title="대운수" helpText={SECTION_HELP_TEXT.daewoon} defaultOpen={defaultExpanded}>
        <p className={styles.subInfo}>대운 시작: {result.daeWoonStartAge}세</p>
        <DaeWoonSection daeWoon={daeWoon} seWoon={seWoon} result={result} />
      </CollapsibleSection>
    </>
  );
}
