'use client';

/**
 * 꿈해몽 결과 카드 V4 — 가로 2탭 (동양적 풀이 / 서양적 풀이) + 11섹션
 *
 * 본문 스타일은 다른 운세풀이 (AdviceCard / LuckyVisualCard / SajuResultPage) 와 완전 일치:
 *   - 본문 텍스트: `text-[16px] text-text-secondary leading-[1.75] tracking-[-0.005em]`
 *   - 카드 배경: `bg-white/5 border border-white/10`
 *   - 라벨: `text-[13px] text-text-tertiary` + 값: `text-[16px] text-text-primary font-semibold`
 *   - 칩: `text-[14px] px-2.5 py-1 rounded-md bg-white/8 border border-white/10`
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { SectionCollapsible } from '../saju/SectionCollapsible';
import {
  TIME_BANDS,
  SIJIN_RULES,
  DOMAIN_TAGS,
  ARCHETYPE_LABELS,
  CLINICAL_LABELS,
  type ArchetypeId,
  type ClinicalDreamType,
} from '../../constants/dreamSymbols';
import type {
  DreamV4Result,
  DreamSymbolCardData,
  DreamDomainScore,
  DreamAdviceItem,
  DreamArchetypeCard,
  DreamPolarityLabel,
} from '../../services/fortuneService';

// ════════════════════════════════════════════════════════════════════
// 색상 토큰
// ════════════════════════════════════════════════════════════════════
const POLARITY_COLOR: Record<DreamPolarityLabel, string> = {
  '대길': '#34D399', '길': '#86EFAC', '중길': '#FBBF24',
  '평': '#CBD5E1', '중흉': '#FB923C', '흉': '#F87171', '': '#CBD5E1',
};
const SYM_POLARITY_COLOR: Record<DreamSymbolCardData['polarity'], string> = {
  good: '#34D399', bad: '#F87171', mixed: '#FBBF24', neutral: '#CBD5E1',
};
const SYM_POLARITY_LABEL: Record<DreamSymbolCardData['polarity'], string> = {
  good: '길', bad: '흉', mixed: '혼재', neutral: '중립',
};

// LuckyVisualCard 와 동일 색상 매핑 — advice "색" 값 추출 시 사용
const COLOR_CSS: Record<string, string> = {
  '초록': '#22c55e', '연두': '#84cc16', '민트': '#10b981', '청록': '#14b8a6',
  '빨강': '#ef4444', '주황': '#f97316', '핑크': '#ec4899', '붉은': '#ef4444',
  '노랑': '#eab308', '황금': '#facc15', '금색': '#fbbf24', '황토': '#b45309', '갈색': '#92400e',
  '베이지': '#d4a574', '흰색': '#f1f5f9', '하얀': '#f1f5f9', '화이트': '#f1f5f9',
  '은색': '#94a3b8', '실버': '#94a3b8', '그레이': '#64748b', '회색': '#64748b',
  '파랑': '#3b82f6', '하늘색': '#0ea5e9', '네이비': '#1e3a8a', '검정': '#1e293b', '블랙': '#1e293b',
  '보라': '#8b5cf6', '자주': '#9333ea',
};
// 방향 → 나침반 각도 (북=0)
const DIRECTION_DEG: Record<string, number> = {
  '북': 0, '북동': 45, '동': 90, '남동': 135,
  '남': 180, '남서': 225, '서': 270, '북서': 315,
  '북쪽': 0, '북동쪽': 45, '동쪽': 90, '남동쪽': 135,
  '남쪽': 180, '남서쪽': 225, '서쪽': 270, '북서쪽': 315,
  '중앙': -1,
};

// "황금색, 갈색" → [{name, css}] 추출
function parseColors(value: string): { name: string; css: string }[] {
  return value
    .split(/[,、，·\s/]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map(name => {
      const key = Object.keys(COLOR_CSS).find(k => name.includes(k));
      return { name, css: key ? COLOR_CSS[key] : '#9ca3af' };
    });
}
// "서쪽, 북서" → ['서쪽', '북서']
function parseDirections(value: string): string[] {
  return value.split(/[,、，·\s/]+/).map(s => s.trim()).filter(Boolean).slice(0, 3);
}
// 칩으로 풀어쓸 값 ("주변 사람들과 식사, 작은 선물 나누기" → [...])
function parseChips(value: string): string[] {
  return value.split(/[,、，·]+/).map(s => s.trim()).filter(Boolean).slice(0, 6);
}

// ════════════════════════════════════════════════════════════════════
// 공통 작은 부품 — 다른 운세풀이와 동일 스펙
// ════════════════════════════════════════════════════════════════════

/**
 * 본문 단락 — 정통사주·신년운세와 동일한 평면 본문.
 * 박스로 감싸지 않음 — SectionCollapsible 의 px-5 패딩이 본문 폭 충분히 확보.
 * 박스 중첩으로 본문 폭이 좁아져 한 줄 5-10자만 들어가던 사고 차단.
 * (boxed prop은 호환성 유지 — 무시됨)
 */
function BodyParagraphs({ text }: { text: string; boxed?: boolean }) {
  const paras = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  if (paras.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {paras.map((p, i) => (
        <p key={i} className="text-[16px] text-text-secondary leading-[1.75] tracking-[-0.005em] whitespace-pre-line break-keep">
          {p}
        </p>
      ))}
    </div>
  );
}

/** 라벨-값 카드 — LuckyVisualCard 의 행운 숫자/시간대 카드와 동일 스펙 */
function LabelValueCard({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="rounded-xl p-3 bg-white/5 border border-white/10">
      <div className="text-[13px] text-text-tertiary mb-1.5">{label}</div>
      <div
        className={big ? "text-[20px] font-bold text-text-primary leading-snug tracking-wider" : "text-[16px] text-text-primary font-semibold leading-snug"}
        style={big ? { fontFamily: 'var(--font-serif)' } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

/** 칩 wrap 카드 — LuckyVisualCard 의 보석/활동 카드와 동일 스펙 */
function ChipWrapCard({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl p-3 bg-white/5 border border-white/10">
      <div className="text-[13px] text-text-tertiary mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="text-[14px] text-text-primary font-medium px-2.5 py-1 rounded-md bg-white/8 border border-white/10"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/** 색상 스와치 - LuckyVisualCard 와 동일 */
function ColorSwatch({ name, css }: { name: string; css: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-10 h-10 rounded-xl border border-white/15 shadow-inner" style={{ background: css }} />
      <span className="text-[13px] text-text-tertiary">{name}</span>
    </div>
  );
}

/** 단일 나침반 SVG - LuckyVisualCard 와 동일 스펙. */
function CompassSVG({ direction }: { direction: string }) {
  const deg = DIRECTION_DEG[direction] ?? null;
  // 등록되지 않은 방향 또는 '중앙' → 회색 디스크 + 라벨만
  if (deg === null || deg === -1) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="w-[64px] h-[64px] rounded-full border border-white/20 flex items-center justify-center bg-white/5">
          <span className="text-[14px] font-bold text-text-secondary text-center px-1 break-keep" style={{ fontFamily: 'var(--font-title)' }}>
            {direction || '중앙'}
          </span>
        </div>
      </div>
    );
  }
  const labels = [
    { text: '북', x: 32, y: 9 }, { text: '동', x: 57, y: 34 },
    { text: '남', x: 32, y: 59 }, { text: '서', x: 7, y: 34 },
  ];
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="30" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        <line x1="32" y1="4" x2="32" y2="60" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1="4" y1="32" x2="60" y2="32" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        {labels.map(l => (
          <text key={l.text} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle"
            fontSize="8" fill="rgba(255,255,255,0.35)" fontFamily="var(--font-sans)">{l.text}</text>
        ))}
        <g transform={`rotate(${deg}, 32, 32)`}>
          <polygon points="32,6 29,32 35,32" fill="var(--color-cta, #8B6914)" opacity="0.9" />
          <polygon points="32,58 29,32 35,32" fill="rgba(255,255,255,0.18)" />
        </g>
        <circle cx="32" cy="32" r="3" fill="white" opacity="0.7" />
      </svg>
      <span className="text-[12px] text-text-tertiary whitespace-nowrap">{direction}</span>
    </div>
  );
}

/** 다중 방향이면 나침반 N개 가로 정렬 */
function CompassGroup({ directions }: { directions: string[] }) {
  if (directions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-start justify-center gap-x-4 gap-y-3">
      {directions.map((d, i) => <CompassSVG key={`${d}-${i}`} direction={d} />)}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// 시각 컴포넌트 — 동양 탭
// ════════════════════════════════════════════════════════════════════

function PolarityScoreCard({ diag }: { diag: DreamV4Result['oriental_diagnosis'] }) {
  const color = POLARITY_COLOR[diag.polarity] || '#CBD5E1';
  const tagList = diag.label.split(/\s*[·•]\s*/).filter(Boolean);
  return (
    <div className="rounded-2xl border" style={{
      padding: '14px 12px',
      background: `linear-gradient(135deg, rgba(20,12,38,0.6), ${color}12)`,
      borderColor: `${color}55`,
    }}>
      <div className="flex items-baseline justify-between mb-3">
        <span className="flex items-baseline gap-1.5">
          <span style={{
            fontSize: 38, fontWeight: 800, lineHeight: 1,
            fontFamily: 'var(--font-serif)', color,
            textShadow: `0 0 18px ${color}55`,
          }}>{diag.score}</span>
          <span className="text-[14px] text-text-tertiary">점</span>
        </span>
        {diag.polarity && (
          <span className="text-[15px] font-extrabold px-3 py-1 rounded-lg border" style={{
            background: `${color}22`, color, borderColor: `${color}55`,
            fontFamily: 'var(--font-title)',
          }}>{
            /* LLM이 polarity 필드에 '길' 대신 '길몽'으로 적는 사고 — '몽' 중복 방지 */
            diag.polarity.endsWith('몽') ? diag.polarity : `${diag.polarity}몽`
          }</span>
        )}
      </div>
      <div className="h-2.5 rounded-full overflow-hidden mb-3.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(4, diag.score)}%` }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
          style={{
            height: '100%', borderRadius: 99,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            boxShadow: `0 0 12px ${color}66`,
          }}
        />
      </div>
      {tagList.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tagList.map((tag, i) => (
            <span key={i} className="px-3 py-1 rounded-full text-[13px] font-bold border" style={{
              color, background: 'rgba(255,255,255,0.04)', borderColor: `${color}55`,
              fontFamily: 'var(--font-title)',
            }}>{tag}</span>
          ))}
        </div>
      )}
      {diag.reason && <BodyParagraphs text={diag.reason} />}
    </div>
  );
}

function SymbolCardGrid({ symbols }: { symbols: DreamSymbolCardData[] }) {
  if (symbols.length === 0) {
    return <p className="text-[14px] text-text-tertiary">매칭된 상징이 없어요.</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {symbols.map((s, i) => {
        const color = SYM_POLARITY_COLOR[s.polarity];
        const polLabel = SYM_POLARITY_LABEL[s.polarity];
        const domain = DOMAIN_TAGS.find(d => d.id === s.domain);
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
            className="rounded-xl p-3.5 border"
            style={{ background: `${color}10`, borderColor: `${color}40` }}
          >
            {/* grid: 좌 이름 1fr / 우 칩 그룹 auto (각 칩은 동일 minWidth로 정렬) */}
            <div className="grid grid-cols-[1fr_auto] items-start gap-2 mb-2">
              <span className="text-[17px] font-extrabold text-text-primary leading-tight break-keep"
                style={{ fontFamily: 'var(--font-title)', letterSpacing: '-0.01em' }}>
                {s.name}
              </span>
              <div className="flex gap-1.5 flex-shrink-0">
                <span
                  className="text-[11px] font-bold rounded-md text-center"
                  style={{
                    color, background: `${color}20`,
                    minWidth: 36, padding: '3px 8px',
                    fontFamily: 'var(--font-title)',
                  }}>
                  {polLabel}
                </span>
                {domain && (
                  <span
                    className="text-[11px] font-semibold rounded-md text-center border"
                    style={{
                      color: domain.color, background: `${domain.color}15`,
                      borderColor: `${domain.color}40`,
                      minWidth: 76, padding: '3px 8px',
                      fontFamily: 'var(--font-title)',
                    }}>
                    {domain.id}
                  </span>
                )}
              </div>
            </div>
            <p className="text-[15px] text-text-secondary leading-[1.8] tracking-[-0.005em] break-keep m-0">
              {s.meaning}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

function DomainBarsCard({ domains }: { domains: DreamDomainScore[] }) {
  if (domains.length === 0) {
    return (
      <p className="text-[14px] text-text-tertiary leading-[1.7] break-keep">
        이 꿈은 특정 영역(재물·인연·건강·시험·일·관계)에 강한 신호가 보이지 않아요.
        일상의 잔상이거나 내면의 감정 흐름에 가까운 꿈으로 보입니다.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {domains.map((d, i) => {
        const meta = DOMAIN_TAGS.find(t => t.id === d.label);
        const color = meta?.color || '#A78BFA';
        return (
          <motion.div
            key={d.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[15px] font-bold text-text-primary" style={{ fontFamily: 'var(--font-title)' }}>
                {d.label}
              </span>
              <span className="text-[14px] font-extrabold" style={{ color, fontFamily: 'var(--font-serif)' }}>
                {d.score}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(3, d.score)}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 + i * 0.05 }}
                style={{
                  height: '100%', borderRadius: 99,
                  background: `linear-gradient(90deg, ${color}99, ${color})`,
                  boxShadow: `0 0 8px ${color}55`,
                }}
              />
            </div>
            {d.note && (
              <p className="text-[15px] text-text-secondary leading-[1.8] tracking-[-0.005em] break-keep m-0">
                {d.note}
              </p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function SijinChart({ timing, timeBandId }: { timing: string; timeBandId?: string }) {
  const band = TIME_BANDS.find(b => b.id === timeBandId);
  const userSijinIdx = (() => {
    if (!band || band.hour < 0) return -1;
    const minutes = band.hour * 60;
    if (minutes >= 23 * 60 + 30 || minutes < 1 * 60 + 30) return 0;
    if (minutes < 3 * 60 + 30) return 1;
    if (minutes < 5 * 60 + 30) return 2;
    if (minutes < 7 * 60 + 30) return 3;
    if (minutes < 9 * 60 + 30) return 4;
    if (minutes < 11 * 60 + 30) return 5;
    if (minutes < 13 * 60 + 30) return 6;
    if (minutes < 15 * 60 + 30) return 7;
    if (minutes < 17 * 60 + 30) return 8;
    if (minutes < 19 * 60 + 30) return 9;
    if (minutes < 21 * 60 + 30) return 10;
    return 11;
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl p-4 bg-white/5 border border-white/10">
        {/*
          막대 — grid 12col + 직접 px 계산.
          이전: motion height '%' 가 부모 height % 계산 실패해 모두 minHeight 12로 떨어지던 버그.
          현재: 영험도별로 16/40/64/88/112px 명확히 분리.
        */}
        <div className="grid items-end mb-2" style={{
          gridTemplateColumns: 'repeat(12, 1fr)', gap: 4, height: 112,
        }}>
          {SIJIN_RULES.map((s, i) => {
            const isUser = i === userSijinIdx;
            const heightPx = 16 + (s.weight - 1) * 24;  // 1→16, 2→40, 3→64, 4→88, 5→112
            const barColor = s.weight >= 4 ? '#FBBF24'
              : s.weight >= 3 ? '#A78BFA'
              : s.weight >= 2 ? 'rgba(167,139,250,0.60)'
              : 'rgba(167,139,250,0.35)';
            return (
              <motion.div
                key={s.id}
                initial={{ height: 0 }}
                animate={{ height: heightPx }}
                transition={{ duration: 0.6, delay: 0.05 * i, ease: 'easeOut' }}
                style={{
                  width: '100%',
                  background: isUser ? 'linear-gradient(180deg, #FCE8B2, #FBBF24)' : barColor,
                  borderRadius: '4px 4px 0 0',
                  boxShadow: isUser ? '0 0 14px rgba(252,232,178,0.7)' : 'none',
                }}
              />
            );
          })}
        </div>
        {/* 라벨 행 — 별도 grid 12col 로 정확히 위 막대와 정렬 */}
        <div className="grid mb-2.5" style={{
          gridTemplateColumns: 'repeat(12, 1fr)', gap: 4,
        }}>
          {SIJIN_RULES.map((s, i) => {
            const isUser = i === userSijinIdx;
            return (
              <span key={s.id} className="text-[13px] text-center leading-none" style={{
                fontWeight: isUser ? 800 : 600,
                color: isUser ? '#FCE8B2' : 'var(--text-secondary)',
                fontFamily: 'var(--font-title)',
              }}>{s.label.charAt(0)}</span>
            );
          })}
        </div>
        <div className="text-[12px] text-text-tertiary text-center">
          12 시진 영험도 — 막대 높이는 정몽(正夢) 가능성
        </div>
      </div>
      {timing && <BodyParagraphs text={timing} boxed />}
    </div>
  );
}

/** AdviceCard — LuckyVisualCard 패턴 차용. AI가 자유 텍스트로 준 키-값을 시각화. */
function AdviceCard({ advice }: { advice: { body: string; items: DreamAdviceItem[] } }) {
  // 키별 추출
  const get = (key: string) => advice.items.find(it => it.key === key)?.value || '';
  const colorVal = get('색');
  const dirVal = get('방향');
  const numVal = get('숫자');
  const timeVal = get('시간');
  const activityVal = get('활동');
  const foodVal = get('음식');
  const gemVal = get('보석');
  const otherItems = advice.items.filter(it =>
    !['색', '방향', '숫자', '시간', '활동', '음식', '보석'].includes(it.key)
  );

  const colors = colorVal ? parseColors(colorVal) : [];
  const directions = dirVal ? parseDirections(dirVal) : [];


  return (
    <div className="flex flex-col gap-3">
      {/* 1) 나침반들 — 방향 N개 각자 표시 (LuckyVisualCard 단일 나침반이 아닌 다중 표시) */}
      {directions.length > 0 && (
        <div className="rounded-xl p-3 bg-white/5 border border-white/10">
          <div className="text-[12px] text-text-tertiary text-center mb-3">길한 방향</div>
          <CompassGroup directions={directions} />
        </div>
      )}

      {/* 2) 색상 스와치 — 별도 카드 (나침반과 row 합치지 않음, 모바일 가독성) */}
      {colors.length > 0 && (
        <div className="rounded-xl p-3 bg-white/5 border border-white/10">
          <div className="text-[12px] text-text-tertiary text-center mb-3">행운 색상</div>
          <div className="flex flex-wrap justify-center gap-4">
            {colors.slice(0, 4).map((c, i) => (
              <ColorSwatch key={`${c.name}-${i}`} name={c.name} css={c.css} />
            ))}
          </div>
        </div>
      )}

      {/* 3) 숫자 + 시간대 — 2 col 카드 */}
      {(numVal || timeVal) && (
        <div className="grid grid-cols-2 gap-2">
          {numVal ? <LabelValueCard label="행운 숫자" value={numVal} big /> : <div />}
          {timeVal ? <LabelValueCard label="유리한 시간대" value={timeVal} /> : <div />}
        </div>
      )}

      {/* 4) 칩 wrap 카드들 */}
      {gemVal && <ChipWrapCard label="행운 보석" items={parseChips(gemVal)} />}
      {activityVal && <ChipWrapCard label="추천 활동" items={parseChips(activityVal)} />}
      {foodVal && <ChipWrapCard label="추천 음식" items={parseChips(foodVal)} />}

      {/* 5) 기타 항목 (액막이·환경·보호 등) — 2col 카드 */}
      {otherItems.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {otherItems.slice(0, 4).map((it, i) => (
            <LabelValueCard key={i} label={it.key} value={it.value} />
          ))}
        </div>
      )}

      {/* 6) 본문 풀이 — 박스 통일 */}
      <BodyParagraphs text={advice.body} boxed />
    </div>
  );
}

/** CautionBox — AdviceCard와 동일 패턴. "조심할 *" 키를 시각화. */
function CautionBox({ caution }: { caution: { body: string; items: DreamAdviceItem[] } }) {
  if (!caution.body && caution.items.length === 0) {
    return <p className="text-[14px] text-text-tertiary">주의할 점은 특별히 없어요.</p>;
  }
  const get = (key: string) => caution.items.find(it => it.key === key)?.value || '';
  const colorVal = get('조심할 색');
  const dirVal = get('조심할 방향');
  const timeVal = get('조심할 시간');
  const activityVal = get('조심할 활동');
  const personVal = get('조심할 사람');
  const foodVal = get('피해야 할 음식');
  const placeVal = get('피해야 할 장소');

  const colors = colorVal ? parseColors(colorVal) : [];
  const directions = dirVal ? parseDirections(dirVal) : [];

  return (
    <div className="flex flex-col gap-3">
      {/* 1) 나침반들 — 피해야 할 방향 N개 각자 표시 */}
      {directions.length > 0 && (
        <div className="rounded-xl p-3 border" style={{
          background: 'rgba(248,113,113,0.04)', borderColor: 'rgba(248,113,113,0.28)',
        }}>
          <div className="text-[12px] text-text-tertiary text-center mb-3">조심할 방향</div>
          <CompassGroup directions={directions} />
        </div>
      )}

      {/* 2) 피해야 할 색 — 별도 카드 */}
      {colors.length > 0 && (
        <div className="rounded-xl p-3 border" style={{
          background: 'rgba(248,113,113,0.04)', borderColor: 'rgba(248,113,113,0.28)',
        }}>
          <div className="text-[12px] text-text-tertiary text-center mb-3">조심할 색</div>
          <div className="flex flex-wrap justify-center gap-4">
            {colors.slice(0, 4).map((c, i) => (
              <ColorSwatch key={`${c.name}-${i}`} name={c.name} css={c.css} />
            ))}
          </div>
        </div>
      )}

      {/* 2) 시간 + 사람 / 활동 — 2col 카드 */}
      {(timeVal || personVal) && (
        <div className="grid grid-cols-2 gap-2">
          {timeVal ? <LabelValueCard label="조심할 시간" value={timeVal} /> : <div />}
          {personVal ? <LabelValueCard label="조심할 사람" value={personVal} /> : <div />}
        </div>
      )}

      {/* 3) 칩 wrap 카드들 */}
      {activityVal && <ChipWrapCard label="피해야 할 활동" items={parseChips(activityVal)} />}
      {foodVal && <ChipWrapCard label="피해야 할 음식" items={parseChips(foodVal)} />}
      {placeVal && <ChipWrapCard label="피해야 할 장소" items={parseChips(placeVal)} />}

      {/* 4) 본문 풀이 — 박스 통일 (다른 섹션과 일관) */}
      <BodyParagraphs text={caution.body} boxed />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// 시각 컴포넌트 — 서양 탭
// ════════════════════════════════════════════════════════════════════

function ClinicalDiagnosisCard({ diag }: { diag: DreamV4Result['western_diagnosis'] }) {
  const clinical = CLINICAL_LABELS[diag.clinical as ClinicalDreamType];
  const color = clinical?.color || '#A78BFA';
  const intensityColor = diag.intensity === 'high' ? '#F87171'
    : diag.intensity === 'medium' ? '#FBBF24'
    : diag.intensity === 'low' ? '#34D399' : '#CBD5E1';
  return (
    <div className="rounded-2xl border" style={{
      padding: '14px 12px',
      background: `linear-gradient(135deg, rgba(20,12,38,0.6), ${color}12)`,
      borderColor: `${color}55`,
    }}>
      <div className="flex flex-wrap gap-2 mb-3">
        {clinical && (
          <span className="text-[15px] font-extrabold px-3.5 py-1.5 rounded-lg border" style={{
            color, background: `${color}22`, borderColor: `${color}55`,
            fontFamily: 'var(--font-title)',
          }}>{clinical.ko}</span>
        )}
        {diag.intensity && (
          <span className="text-[13px] font-bold px-3 py-1.5 rounded-lg border" style={{
            color: intensityColor, background: `${intensityColor}15`, borderColor: `${intensityColor}40`,
            fontFamily: 'var(--font-title)',
          }}>강도 {diag.intensity === 'high' ? '강' : diag.intensity === 'medium' ? '중' : '약'}</span>
        )}
      </div>
      {clinical?.desc && (
        <p className="text-[14px] text-text-tertiary leading-relaxed mb-2.5 break-keep">{clinical.desc}</p>
      )}
      {diag.reason && <BodyParagraphs text={diag.reason} />}
    </div>
  );
}

function LatentDiptychCard({ latent }: { latent: DreamV4Result['western_latent'] }) {
  const workLabel: Record<string, string> = {
    condensation: '응축', displacement: '전치',
    symbolization: '형상화', secondary_revision: '2차 가공',
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl p-3.5 border" style={{
          background: 'rgba(168,139,250,0.08)', borderColor: 'rgba(168,139,250,0.30)',
        }}>
          <div className="text-[12px] font-extrabold mb-1.5" style={{ color: '#A78BFA', fontFamily: 'var(--font-title)' }}>
            표면 (manifest)
          </div>
          <p className="text-[14px] text-text-primary leading-relaxed break-keep m-0">{latent.surface || '—'}</p>
        </div>
        <div className="rounded-xl p-3.5 border" style={{
          background: 'rgba(232,164,144,0.08)', borderColor: 'rgba(232,164,144,0.30)',
        }}>
          <div className="text-[12px] font-extrabold mb-1.5" style={{ color: '#E8A490', fontFamily: 'var(--font-title)' }}>
            잠재 (latent)
          </div>
          <p className="text-[14px] text-text-primary leading-relaxed break-keep m-0">{latent.latent || '—'}</p>
        </div>
      </div>
      {latent.work && workLabel[latent.work] && (
        <div className="flex justify-center">
          <span className="px-3.5 py-1 rounded-full text-[12px] font-bold border" style={{
            color: '#FCE8B2', background: 'rgba(252,232,178,0.10)', borderColor: 'rgba(252,232,178,0.30)',
            fontFamily: 'var(--font-title)',
          }}>꿈 작업: {workLabel[latent.work]}</span>
        </div>
      )}
      {latent.body && <BodyParagraphs text={latent.body} />}
    </div>
  );
}

function ArchetypeCardGrid({ items }: { items: DreamArchetypeCard[] }) {
  if (items.length === 0) {
    return <p className="text-[14px] text-text-tertiary">분석할 등장인물·동물이 또렷하지 않아요.</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((it, i) => {
        const meta = ARCHETYPE_LABELS[it.archetype as ArchetypeId];
        const color = meta?.color || '#A78BFA';
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-xl p-3.5 border"
            style={{ background: `${color}10`, borderColor: `${color}40` }}
          >
            <div className="grid grid-cols-[1fr_auto] items-start gap-2 mb-2">
              <span className="text-[16px] font-extrabold text-text-primary leading-tight break-keep"
                style={{ fontFamily: 'var(--font-title)', letterSpacing: '-0.01em' }}>
                {it.target}
              </span>
              {meta && (
                <span
                  className="text-[11px] font-bold rounded-full text-center border"
                  style={{
                    color, background: `${color}20`, borderColor: `${color}50`,
                    minWidth: 64, padding: '3px 10px',
                    fontFamily: 'var(--font-title)',
                  }}>
                  {meta.ko}
                </span>
              )}
            </div>
            {it.note && (
              <p className="text-[15px] text-text-secondary leading-[1.8] tracking-[-0.005em] break-keep mb-1.5">
                {it.note}
              </p>
            )}
            {meta?.desc && (
              <p className="text-[12px] text-text-tertiary leading-[1.6] break-keep m-0">
                {meta.desc}
              </p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function MirrorBlock({ text }: { text: string }) {
  if (!text) return null;
  // 다른 본문(timing/advice/caution/self_work)과 통일된 박스 스펙 — BodyParagraphs boxed 사용
  return <BodyParagraphs text={text} boxed />;
}

function SelfWorkCard({ text }: { text: string }) {
  if (text) return <BodyParagraphs text={text} boxed />;
  return (
    <div className="rounded-2xl border" style={{
      padding: '14px 12px',
      background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.10)',
    }}>
      <p className="text-[15px] text-text-tertiary leading-[1.85] tracking-[-0.005em] break-keep m-0">
        이 섹션은 풀이 응답이 누락된 것 같아요. 새로 풀이를 받아보시면 자기 통합 워크 가이드가 채워집니다.
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// 메인 — DreamResultCard
// ════════════════════════════════════════════════════════════════════

interface Props {
  title: string;
  result: DreamV4Result;
  timeBandId?: string;
}

type TrackTab = 'oriental' | 'western';

export function DreamResultCard({ title, result, timeBandId }: Props) {
  const [tab, setTab] = useState<TrackTab>('oriental');

  return (
    <motion.div
      key="dream-v4-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      style={{ paddingTop: 4 }}
    >
      {/* 카드 헤더 */}
      <div className="flex items-center gap-2 mb-3 pl-1">
        <span className="inline-block w-1 h-5 rounded-full bg-cta" />
        <div className="text-[17px] font-bold text-text-primary tracking-tight" style={{ fontFamily: 'var(--font-title)' }}>
          {title}
        </div>
      </div>

      {/* 2탭 스위치 */}
      <div className="grid grid-cols-2 gap-2 mb-3.5 p-1 rounded-2xl border" style={{
        background: 'rgba(20,12,38,0.55)', borderColor: 'var(--border-subtle)',
      }}>
        <TabButton active={tab === 'oriental'} onClick={() => setTab('oriental')} label="동양적 풀이" />
        <TabButton active={tab === 'western'} onClick={() => setTab('western')} label="서양적 풀이" />
      </div>

      {/* 탭 컨텐츠 */}
      <AnimatePresence mode="wait">
        {tab === 'oriental' ? (
          <motion.div
            key="oriental"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-3"
          >
            <SectionCollapsible title="이 꿈은 어떤 꿈인가요" defaultOpen enterDelay={0}>
              <PolarityScoreCard diag={result.oriental_diagnosis} />
            </SectionCollapsible>

            <SectionCollapsible title="꿈 속 상징" enterDelay={0.06}>
              <SymbolCardGrid symbols={result.oriental_symbols} />
            </SectionCollapsible>

            <SectionCollapsible title="다가올 일 — 6 영역" enterDelay={0.12}>
              <DomainBarsCard domains={result.oriental_domains} />
            </SectionCollapsible>

            <SectionCollapsible title="꿈꾼 시간에 대한 해석" enterDelay={0.18}>
              <SijinChart timing={result.oriental_timing} timeBandId={timeBandId} />
            </SectionCollapsible>

            <SectionCollapsible title="이렇게 해보세요" enterDelay={0.24}>
              <AdviceCard advice={result.oriental_advice} />
            </SectionCollapsible>

            <SectionCollapsible title="조심할 점" enterDelay={0.30}>
              <CautionBox caution={result.oriental_caution} />
            </SectionCollapsible>
          </motion.div>
        ) : (
          <motion.div
            key="western"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-3"
          >
            <SectionCollapsible title="이 꿈의 정체" defaultOpen enterDelay={0}>
              <ClinicalDiagnosisCard diag={result.western_diagnosis} />
            </SectionCollapsible>

            <SectionCollapsible title="마음 깊은 곳의 신호" enterDelay={0.06}>
              <LatentDiptychCard latent={result.western_latent} />
            </SectionCollapsible>

            <SectionCollapsible title="꿈 속 등장인물의 의미" enterDelay={0.12}>
              <ArchetypeCardGrid items={result.western_archetypes} />
            </SectionCollapsible>

            <SectionCollapsible title="지금 삶과의 거울" enterDelay={0.18}>
              <MirrorBlock text={result.western_mirror} />
            </SectionCollapsible>

            <SectionCollapsible title="스스로 해볼 수 있는 작업" enterDelay={0.24}>
              <SelfWorkCard text={result.western_self_work} />
            </SectionCollapsible>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TabButton({
  active, onClick, label,
}: {
  active: boolean; onClick: () => void; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '16px 10px',
        borderRadius: 10,
        border: 'none',
        background: active
          ? 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(232,164,144,0.18))'
          : 'transparent',
        color: active ? '#FCE8B2' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        textAlign: 'center',
        WebkitTapHighlightColor: 'transparent',
        fontSize: 17,
        fontWeight: 800,
        letterSpacing: '-0.01em',
        fontFamily: 'var(--font-title)',
      }}
    >
      {label}
    </button>
  );
}
