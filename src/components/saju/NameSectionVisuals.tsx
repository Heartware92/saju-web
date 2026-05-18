'use client';

/**
 * 이름 풀이 결과 페이지의 각 섹션 위에 박히는 시각 카드 컴포넌트들.
 *
 * 본문(줄글)이 길어지지 않도록 결정값(음령오행 분포·자원오행·4격 길흉·실천 조언)을
 * 시각 박스로 빼고, 본문은 "왜 그런가 + 어떻게 활용" 에 집중하게 한다.
 *
 * 신년운세 월별 카드·정통사주 행운 처방 카드와 같은 코스믹 톤.
 */

import type { JSX } from 'react';
import { lookupHanjaBySound, type HanjaCandidate } from '../../lib/data/hanjaByKoreanSound';
import { calc4Gyeok } from '../../utils/numerology';

// ─────────────────────────────────────────────────────────────────────────────
// 색 매핑
// ─────────────────────────────────────────────────────────────────────────────
const ELEMENT_COLOR: Record<string, string> = {
  '목': '#22c55e',
  '화': '#ef4444',
  '토': '#eab308',
  '금': '#94a3b8',
  '수': '#3b82f6',
};
const ELEMENT_BG: Record<string, string> = {
  '목': 'rgba(34,197,94,0.10)',
  '화': 'rgba(239,68,68,0.10)',
  '토': 'rgba(234,179,8,0.10)',
  '금': 'rgba(148,163,184,0.10)',
  '수': 'rgba(59,130,246,0.10)',
};
const GRADE_COLOR: Record<string, string> = {
  '대길': '#34D399',
  '길':   '#86EFAC',
  '평':   '#CBD5E1',
  '흉':   '#FB923C',
  '대흉': '#F87171',
};

// ─────────────────────────────────────────────────────────────────────────────
// 1) 음령오행 — 음절별 카드 + 5오행 분포 막대
// ─────────────────────────────────────────────────────────────────────────────
export function EumRyeongVisual({
  chars,
  elements,
  yongSinEl,
  giSinEl,
}: {
  chars: string[];
  elements: string[];
  yongSinEl: string;
  giSinEl?: string;
}) {
  const counts = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 } as Record<string, number>;
  elements.forEach(e => { if (counts[e] !== undefined) counts[e]++; });
  const maxC = Math.max(1, ...Object.values(counts));

  return (
    <div className="space-y-3 mb-3">
      {/* 음절별 카드 */}
      <div className="flex flex-wrap gap-2">
        {chars.map((ch, i) => {
          const el = elements[i] ?? '';
          const color = ELEMENT_COLOR[el] ?? 'transparent';
          const bg = ELEMENT_BG[el] ?? 'rgba(255,255,255,0.04)';
          return (
            <div
              key={i}
              className="flex flex-col items-center justify-center px-3 py-2 rounded-xl border"
              style={{ background: bg, borderColor: `${color}55`, minWidth: 56 }}
            >
              <span className="text-[18px] font-bold leading-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>{ch}</span>
              <span className="text-[10px] font-semibold mt-0.5" style={{ color, letterSpacing: '0.04em' }}>{el || '?'}</span>
            </div>
          );
        })}
      </div>

      {/* 5오행 분포 막대 */}
      <div className="rounded-xl p-3 bg-white/[0.03] border border-white/10">
        <div className="text-[12px] font-semibold text-text-tertiary mb-2">오행 분포</div>
        <div className="space-y-1.5">
          {(['목', '화', '토', '금', '수'] as const).map((el) => {
            const color = ELEMENT_COLOR[el];
            const n = counts[el];
            const isYong = el === yongSinEl;
            const isGi = el === giSinEl;
            return (
              <div key={el} className="flex items-center gap-2">
                <span className="text-[12px] font-bold w-4 text-center" style={{ color }}>{el}</span>
                <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(n / maxC) * 100}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }} />
                </div>
                <span className="text-[11px] text-text-secondary w-6 text-right">{n}</span>
                <span className="text-[10px] font-bold w-8 text-right" style={{ color: isYong ? '#34D399' : isGi ? '#F87171' : 'transparent' }}>
                  {isYong ? '용신' : isGi ? '기신' : '·'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) 자원오행 — 한자별 카드 그리드
// ─────────────────────────────────────────────────────────────────────────────
export function JaWonVisual({
  hanjas,
}: {
  hanjas: Array<{ char: string; meaning: string; radical: string; strokes: number; jawon: string }>;
}) {
  if (hanjas.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-2 mb-3">
      {hanjas.map((h, i) => {
        const color = ELEMENT_COLOR[h.jawon] ?? 'transparent';
        const bg = ELEMENT_BG[h.jawon] ?? 'rgba(255,255,255,0.04)';
        return (
          <div
            key={i}
            className="relative flex flex-col items-center px-2 py-3 rounded-2xl border"
            style={{ background: bg, borderColor: `${color}55` }}
          >
            {h.jawon && (
              <span
                className="absolute top-2 left-2 w-2 h-2 rounded-full"
                style={{ background: color, boxShadow: `0 0 6px ${color}aa` }}
                aria-hidden
              />
            )}
            <span
              className="text-[28px] font-bold leading-none mt-1"
              style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}
            >
              {h.char}
            </span>
            <span className="text-[12px] font-semibold text-text-secondary mt-1 text-center">
              {h.meaning}
            </span>
            <span className="text-[10px] text-text-tertiary mt-0.5">
              {h.radical || '?'}부 · {h.strokes}획
            </span>
            {h.jawon && (
              <span className="text-[10px] font-bold mt-1" style={{ color }}>
                자원 {h.jawon}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) 사주와의 조화 — 좋은점·보완점 2단 박스 (간단 신호)
// ─────────────────────────────────────────────────────────────────────────────
export function HarmonyVisual({
  yongSinEl,
  giSinEl,
  eumElements,
  jawonElements,
}: {
  yongSinEl: string;
  giSinEl?: string;
  eumElements: string[];
  jawonElements: string[]; // 한자 모드일 때만, 아니면 []
}) {
  const pros: string[] = [];
  const cons: string[] = [];

  // 음령
  if (eumElements.includes(yongSinEl)) pros.push(`음령에 용신 ${yongSinEl} 포함 — 발음이 사주 보강`);
  if (giSinEl && eumElements.includes(giSinEl)) cons.push(`음령에 기신 ${giSinEl} 포함 — 발음에서 조심`);

  // 자원
  if (jawonElements.length > 0) {
    if (jawonElements.includes(yongSinEl)) pros.push(`한자 자원에 용신 ${yongSinEl} 포함 — 부수가 사주 보강`);
    if (giSinEl && jawonElements.includes(giSinEl)) cons.push(`한자 자원에 기신 ${giSinEl} 포함 — 한자 영향에 주의`);
  }

  if (pros.length === 0) pros.push('직접적 용신 매칭은 없음 — 다른 영역에서 보강');
  if (cons.length === 0) cons.push('치명적 기신 매칭은 없음 — 큰 부담 없음');

  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      <div
        className="rounded-2xl p-3 border"
        style={{ background: 'rgba(52,211,153,0.06)', borderColor: 'rgba(52,211,153,0.30)' }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <span className="inline-block w-1 h-4 rounded-full" style={{ background: '#34D399' }} />
          <span className="text-[12px] font-bold" style={{ color: '#34D399' }}>이름의 강점</span>
        </div>
        <ul className="space-y-1.5">
          {pros.map((p, i) => (
            <li key={i} className="text-[12px] text-text-secondary leading-snug">{p}</li>
          ))}
        </ul>
      </div>
      <div
        className="rounded-2xl p-3 border"
        style={{ background: 'rgba(248,113,113,0.06)', borderColor: 'rgba(248,113,113,0.30)' }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <span className="inline-block w-1 h-4 rounded-full" style={{ background: '#F87171' }} />
          <span className="text-[12px] font-bold" style={{ color: '#F87171' }}>보완 필요</span>
        </div>
        <ul className="space-y-1.5">
          {cons.map((c, i) => (
            <li key={i} className="text-[12px] text-text-secondary leading-snug">{c}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) 81 수리 — 4격(원·형·이·정) 카드 4개
// ─────────────────────────────────────────────────────────────────────────────
export function NumerologyVisual({
  chars,
  sounds,
}: {
  chars: string[]; // 한자
  sounds: string[]; // 한국 음
}) {
  const result = calc4Gyeok(chars, sounds);
  if (!result) return null;

  const items: Array<{ label: string; area: string; data: typeof result.won }> = [
    { label: '원격', area: '초년운',         data: result.won },
    { label: '형격', area: '중년·주운',       data: result.hyeong },
    { label: '이격', area: '사회·인간관계',    data: result.i },
    { label: '정격', area: '평생·총운',       data: result.jeong },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      {items.map((it, i) => {
        const color = GRADE_COLOR[it.data.entry.grade] ?? '#CBD5E1';
        return (
          <div
            key={i}
            className="rounded-2xl p-3 border"
            style={{
              background: `linear-gradient(135deg, rgba(20,12,38,0.65) 0%, ${color}10 50%, rgba(20,12,38,0.55) 100%)`,
              borderColor: `${color}45`,
              boxShadow: `0 0 18px ${color}10, inset 0 0 1px ${color}40`,
            }}
          >
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}>
                {it.label}
              </span>
              <span className="text-[10px] text-text-tertiary">{it.area}</span>
            </div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span
                className="text-[22px] font-bold leading-none"
                style={{ fontFamily: 'var(--font-serif)', color }}
              >
                {it.data.sum}
              </span>
              <span className="text-[11px] text-text-tertiary">수</span>
              <span
                className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: `${color}1a`, color }}
              >
                {it.data.entry.grade}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-text-secondary mb-1" style={{ fontFamily: 'var(--font-title)' }}>
              {it.data.entry.name}
            </div>
            <div className="text-[10px] text-text-tertiary leading-snug">
              {it.data.entry.meaning}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) 실천 조언 — 본문의 "- " 불릿을 카드로 분할 (CSS 전용)
// ─────────────────────────────────────────────────────────────────────────────
export function AdviceVisual({ bullets }: { bullets: string[] }): JSX.Element | null {
  if (bullets.length === 0) return null;
  return (
    <div className="space-y-2 mb-2">
      {bullets.map((b, i) => (
        <div
          key={i}
          className="flex items-start gap-2 rounded-xl p-3 bg-white/[0.04] border border-white/10"
        >
          <span
            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-cta"
            style={{ background: 'rgba(124,92,252,0.15)', border: '1px solid rgba(124,92,252,0.40)' }}
          >
            {i + 1}
          </span>
          <span className="text-[14px] text-text-secondary leading-snug">{b}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 유틸: hanjaName + charMeanings 에서 hanjaResolved 재계산 (archive 모드 호환)
// ─────────────────────────────────────────────────────────────────────────────
export function resolveHanjasForVisual(
  hanjaName: string,
  charMeanings: Array<{ sound?: string; meaning?: string } | undefined>,
): Array<{ char: string; meaning: string; radical: string; strokes: number; jawon: string }> {
  if (!hanjaName) return [];
  const chars = [...hanjaName];
  return chars.map((char, i) => {
    const sound = charMeanings[i]?.sound ?? '';
    const hit = lookupHanjaBySound(sound).find((c: HanjaCandidate) => c.char === char);
    return hit
      ? { char, meaning: hit.meanings[0] ?? '', radical: hit.radical, strokes: hit.strokes, jawon: hit.jawon }
      : { char, meaning: charMeanings[i]?.meaning ?? '', radical: '', strokes: 0, jawon: '' };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 본문에서 "- " 불릿 추출 (advice 섹션용)
// ─────────────────────────────────────────────────────────────────────────────
export function extractBullets(text: string): { bullets: string[]; rest: string } {
  const lines = text.split('\n');
  const bullets: string[] = [];
  const restLines: string[] = [];
  for (const ln of lines) {
    const t = ln.trim();
    const m = t.match(/^[-•·]\s+(.+)$/);
    if (m) bullets.push(m[1].trim());
    else restLines.push(ln);
  }
  return { bullets, rest: restLines.join('\n').trim() };
}
