'use client';

/**
 * 만신 타로 — 카드 일러스트 비교 페이지 (/tarot_test2 전용, 임시)
 *
 * 옥황상제 후보 일러스트 6종을 실제 결과(reveal) UI에 끼워 비교한다.
 * 공수 본문은 실제 Gemini 생성 결과(옥황상제+혼례+엽전 세 닢)를 하드코딩 —
 * 강조 2단계(==빨강== / **노랑**) 렌더 포함, 라이브 /tarot_test 와 동일 스타일.
 * 스타일 확정 후 이 페이지·public/manshin/test2 는 삭제한다.
 */

import { useRef, useState, type ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  MANSHIN_DECK,
  MANSHIN_GROUP_COLORS,
  FORTUNE_SECTIONS,
  type ManshinFortunes,
} from '@/constants/test/manshinDeck.test';

type SectionKey = 'total' | keyof ManshinFortunes;

const VARIANTS: { id: string; label: string; src: string; note: string }[] = [
  { id: 'mj1', label: '미드저니 1', src: '/manshin/test2/mj1.jpg', note: '1:1 원본 — 좌우 크롭됨' },
  { id: 'mj2', label: '미드저니 2', src: '/manshin/test2/mj2.jpg', note: '1:1 원본 — 좌우 크롭됨' },
  { id: 'mj3', label: '미드저니 3', src: '/manshin/test2/mj3.jpg', note: '1:1 원본 — 좌우 크롭됨' },
  { id: 'mj4', label: '미드저니 4', src: '/manshin/test2/mj4.jpg', note: '1:1 원본 — 좌우 크롭됨' },
  { id: 'banana', label: '나노바나나', src: '/manshin/test2/banana.jpg', note: '2:3 원본' },
  { id: 'gemini', label: '제미나이', src: '/manshin/test2/gemini.jpg', note: '2:3 원본' },
];

/** 실제 생성 공수 (gemini-3.1-flash-lite · 옥황상제+혼례+엽전 세 닢 · 2026-07-10) */
const READING: Record<SectionKey, string> = {
  total:
    '하늘 옥좌에서 너를 줄곧 지켜보았노라. 네가 애쓴 것은 하나도 새어나가지 않고 다 적혀 있느니라. 머지않아 위에서 끌어주는 손길이 닿을 것이다. 지금 네 앞에는 붉은 실과 푸른 실이 엉키어 하나로 묶이는 경사가 들어와 있구나. 서로 다른 곳을 향하던 길들이 하나로 합쳐지는 형국이니, 이제는 홀로 걷던 고단함이 씻은 듯 사라질 것이다. 엽전 세 닢이 바닥에 굴러가기 시작했으니, 네 운의 수레바퀴도 이제 막 구름을 타기 시작했도다. ==석 달의 시간==을 묵묵히 견디며 정성을 쏟는다면, 하늘이 맺어준 인연과 기회가 네 곁에 머물 것이니라. 마음을 조급하게 먹지 말고 차분히 옥좌의 뜻을 기다리도록 하라. 너의 정성이 하늘에 닿아 단단한 결실을 맺을 날이 머지않았노라. 흩어졌던 기운이 하나로 모이니, 이제는 네가 바라는 곳으로 바람이 불어올 것이다.',
  love:
    '외로이 머물던 네 마음속에 드디어 봄바람이 불어오겠구나. 청실홍실이 엮이는 장면이 보이니, 혼자였던 이는 누군가와 인연의 끈을 맺게 될 것이요, 곁에 사람이 있는 이는 한층 깊은 사이로 발전하리라. 지금 네게 다가오는 인연은 스치듯 지나가는 바람이 아니니라. 엽전 세 닢을 던지듯 세 번의 신중한 대화를 나눠보거라. 상대의 눈을 가만히 들여다보면 그 속에 네가 찾던 답이 들어있을 것이다. ==진심 어린 소통==이야말로 두 사람을 묶어주는 가장 단단한 동아줄이 되느니라. 만약 지금 망설이는 이가 있다면, 더는 지체하지 말고 네 마음을 솔직하게 내비치거라. 맺어지는 일에는 날을 아끼지 말라 하였으니, 결정을 내릴 때는 주저하지 말고 곧장 행동하는 것이 좋으리라. **서로의 온기**를 나누며 함께 걸어갈 때, 비로소 너의 마음에도 평온이 깃들 것이니라.',
  money:
    '주머니 속이 비어 걱정이 많았으나, 이제는 곳간 문이 서서히 열리는 형국이로다. 굴러가기 시작한 엽전 세 닢은 그저 흩어지는 돈이 아니요, 더 큰 재물을 부르는 씨앗이 될 것이니라. 지금부터 석 달은 돈을 함부로 쓰지 말고 차곡차곡 모으는 것이 과인의 뜻이니라. 투자를 하려거든 겉모습만 보고 덤비지 말고, 세 갈래 길 중에서 가장 단단해 보이는 곳을 택하거라. ==성실한 적금==이 결국은 너를 지키는 가장 큰 방패가 될 것임을 잊지 마라. 지금 당장 큰 이익을 보려 하기보다, 작은 돈이 모여 산을 이루는 이치를 깨달아야 하느니라. 푼돈이라 여기지 않고 정성껏 관리할 때, 재물운도 비로소 네 곁에 머물기를 즐거워할 것이다. **작은 정성**이 모여 너의 삶을 풍요롭게 할 것이니, 오늘부터는 지갑을 여닫을 때도 신중함을 잃지 않도록 하라.',
  work:
    '직장에서 네가 쏟은 땀방울을 내가 하늘에서 낱낱이 기록하였노라. 윗사람의 눈에 띄지 않아 마음이 탔을 테지만, 이제는 인정받는 시기가 찾아왔느니라. 마치 혼례식처럼 너와 회사가 하나로 깊게 맺어지는 계약이 기다리고 있구나. 승진의 기회나 새로운 프로젝트의 주도권이 네 손안에 들어올 것이니, 두려워 말고 덥석 잡거라. ==위에서 끌어주는 손길==이 이미 너를 향해 뻗어 있느니라. 세 닢의 엽전이 구르듯 업무의 속도도 점차 빨라질 터이니, 석 달간은 몸도 마음도 바쁘게 움직여야 하리라. 지금 겪는 노고는 네 경력에 귀한 거름이 될 것이니, 절대 헛된 고생이라 생각지 마라. **자신의 위치**에서 묵묵히 제 몫을 다하는 너를 향해, 곧 좋은 소식이 바람을 타고 날아들 것이니라. 과인의 뜻을 믿고 오늘 하루도 당당하게 임하도록 하라.',
  health:
    '하늘의 기운이 네 몸에 고르게 퍼지고 있으니, 너무 걱정하지 말거라. 그동안 바쁜 일상에 치여 챙기지 못했던 몸과 마음이 이제야 하나로 조화를 이루기 시작했구나. 청실홍실이 엮이듯 네 몸의 기혈도 원활히 돌기 시작했으니, 한결 몸이 가벼워짐을 느끼게 될 것이다. 다만, 세 번의 깊은 호흡을 잊지 말고, **규칙적인 운동**을 통해 기운을 다스려야 하느니라. 석 달 동안은 무리하게 욕심내어 몸을 부리지 말고, 하루에 조금씩이라도 몸을 움직이는 습관을 들이거라. ==충분한 휴식==이야말로 네 기력을 채우는 가장 좋은 보약이 되느니라. 마음이 불안할 때면 잠시 눈을 감고 옥황의 기운을 떠올리며 호흡을 가다듬어 보거라. 네 몸은 스스로 회복하는 신비한 힘을 지녔으니, 스스로를 다독이며 평안함을 유지한다면 아무런 탈 없이 건강한 나날을 보낼 것이니라.',
};

/** 공수 강조 2단계 — ==핵심==(빨강) / **중요**(노랑). ManshinOracleTest 와 동일 규칙 */
const EMPHASIS_RE = /==([^=]+?)==|\*\*([^*]+?)\*\*/g;
function renderManshinEmphasis(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(EMPHASIS_RE.source, 'g');
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      nodes.push(
        <strong key={`em1-${match.index}`} style={{ color: '#ff5f5f', fontWeight: 700 }}>
          {match[1]}
        </strong>,
      );
    } else {
      nodes.push(
        <strong key={`em2-${match.index}`} style={{ color: '#ffd54a', fontWeight: 700 }}>
          {match[2]}
        </strong>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.length > 0 ? nodes : [text];
}

/** 공수를 문장 단위로 분리 (ManshinOracleTest 와 동일) */
function speechLines(speech: string): string[] {
  const parts = speech.split('. ');
  return parts
    .map((p, i) => (i < parts.length - 1 ? `${p.trim()}.` : p.trim()))
    .filter(Boolean);
}

/** 스크롤 연동 문장 리빌 (ManshinOracleTest 와 동일) */
function RevealLine({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start start'] });
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.22, 0.38, 0.62, 0.82, 1],
    [0.1, 0.3, 1, 1, 0.28, 0.12],
  );
  const y = useTransform(scrollYProgress, [0, 0.38], [10, 0]);
  return (
    <motion.p ref={ref} style={{ opacity, y, willChange: 'transform, opacity', ...style }} className={className}>
      {children}
    </motion.p>
  );
}

export function ManshinImageCompareTest() {
  const deity = MANSHIN_DECK.find((c) => c.id === 'okhwang')!;
  const custom = MANSHIN_DECK.find((c) => c.id === 'honrye')!;
  const coin = MANSHIN_DECK.find((c) => c.id === 'yeopjeon3')!;
  const deityColor = MANSHIN_GROUP_COLORS[deity.group];

  const [variant, setVariant] = useState(VARIANTS[0]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ love: true });

  const threeCards = [
    { label: '신령패', card: deity },
    { label: '풍습패', card: custom },
    { label: '엽전패', card: coin },
  ];

  return (
    <div className="max-w-[480px] mx-auto px-4 pb-16">
      {/* ── 일러스트 후보 선택 (sticky) ── */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-3 backdrop-blur-md bg-[rgba(10,6,20,0.82)] border-b border-[var(--border-subtle)]">
        <div className="text-[11px] tracking-[0.18em] text-text-tertiary mb-2">일러스트 후보 — 탭해서 비교</div>
        <div className="flex flex-wrap gap-1.5">
          {VARIANTS.map((v) => {
            const active = v.id === variant.id;
            return (
              <button
                key={v.id}
                onClick={() => setVariant(v)}
                className="text-[12.5px] px-3 py-1.5 rounded-full border transition-colors"
                style={{
                  color: active ? '#1a1030' : 'var(--text-secondary)',
                  background: active ? deityColor : 'rgba(255,255,255,0.04)',
                  borderColor: active ? deityColor : 'var(--border-subtle)',
                  fontWeight: active ? 700 : 400,
                }}
              >
                {v.label}
              </button>
            );
          })}
        </div>
        <div className="text-[10.5px] text-text-tertiary mt-1.5">{variant.note}</div>
      </div>

      <div className="space-y-5 mt-5">
        {/* ── 부채꼴 크기(92px) 미리보기 — 뽑기 화면에서 보이는 실제 크기 ── */}
        <div className="rounded-xl border border-[var(--border-subtle)] p-3 bg-white/[0.03]">
          <div className="text-[11px] tracking-[0.15em] text-text-tertiary mb-2.5">뽑기 화면 크기(92px)에서는 이렇게 보입니다</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {VARIANTS.map((v) => (
              <button key={v.id} onClick={() => setVariant(v)} className="shrink-0">
                <div
                  className="w-[92px] aspect-[2/3] rounded-lg border overflow-hidden"
                  style={{ borderColor: v.id === variant.id ? deityColor : 'rgba(201,166,255,0.35)' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.src} alt={v.label} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="text-[10px] mt-1 text-center" style={{ color: v.id === variant.id ? deityColor : 'var(--text-tertiary)' }}>
                  {v.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── 세 패 요약 (reveal 동일) ── */}
        <div className="grid grid-cols-3 gap-2">
          {threeCards.map(({ label, card }) => {
            const color = MANSHIN_GROUP_COLORS[card.group];
            return (
              <div key={label} className="rounded-xl border border-[var(--border-subtle)] overflow-hidden text-center">
                <div className="py-1.5 text-[10.5px] tracking-[0.15em]" style={{ background: `${color}1a`, color }}>
                  {label}
                </div>
                <div
                  className="px-1.5 py-3 flex flex-col items-center justify-center min-h-[112px]"
                  style={{ background: `radial-gradient(circle at 50% 0%, ${color}22, rgba(20,12,38,0.4))` }}
                >
                  <div className="text-[16px] font-bold text-text-primary leading-tight" style={{ fontFamily: 'var(--font-title)' }}>
                    {card.name}
                  </div>
                  <div className="text-[11.5px] text-text-secondary mt-1.5 leading-snug px-0.5">{card.title}</div>
                  <div className="text-[10px] mt-1.5 leading-snug px-0.5" style={{ color: `${color}cc` }}>
                    {card.domains}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 공수 카드 (reveal 동일 + 일러스트 삽입) ── */}
        <div className="rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[rgba(20,12,38,0.55)]">
          <div
            className="relative flex flex-col items-center justify-center py-8 px-4 overflow-hidden"
            style={{
              background: `radial-gradient(circle at 50% 20%, ${deityColor}33, rgba(20,12,38,0.2)), linear-gradient(180deg, ${deityColor}22, transparent)`,
            }}
          >
            <motion.div
              className="absolute w-[240px] h-[240px] rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle, ${deityColor}2e, transparent 70%)`, willChange: 'transform, opacity' }}
              animate={{ scale: [1, 1.22, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="text-[11px] tracking-[0.25em] mb-3 relative" style={{ color: deityColor }}>
              {deity.group} · 제{deity.no}패
            </div>
            {/* 카드 일러스트 — 2:3 카드 프레임 */}
            <motion.div
              key={variant.id}
              initial={{ opacity: 0, rotateY: 60 }}
              animate={{ opacity: 1, rotateY: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformPerspective: 700 }}
              className="relative w-[216px] aspect-[2/3] rounded-xl overflow-hidden border-2"
            >
              <div className="absolute inset-0 rounded-xl pointer-events-none z-10 border-2" style={{ borderColor: `${deityColor}88` }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={variant.src} alt={`옥황상제 — ${variant.label}`} className="w-full h-full object-cover" />
            </motion.div>
            <div className="text-[32px] font-bold text-text-primary leading-tight text-center relative mt-4" style={{ fontFamily: 'var(--font-title)' }}>
              {deity.name}
            </div>
            <div className="text-[13.5px] text-text-secondary mt-1.5 text-center relative">{deity.title}</div>
            <div className="text-[12.5px] text-text-tertiary mt-2.5 text-center relative">
              {custom.name}의 장면에 {coin.name}을 얹어 공수를 내립니다
            </div>
          </div>

          <div className="px-5 py-5">
            {deity.lore && (
              <div className="mb-4 rounded-xl px-4 py-3 bg-white/[0.04] border border-[var(--border-subtle)]">
                <div className="text-[11px] tracking-[0.18em] text-text-tertiary mb-1.5">이 신령은</div>
                <p className="text-[13.5px] text-text-secondary leading-[1.75]">{deity.lore}</p>
              </div>
            )}
            <div className="mb-4">
              <div className="text-[11.5px] tracking-[0.2em] text-text-tertiary">공수 내리시길</div>
              <div className="text-[11px] text-text-tertiary mt-1" style={{ opacity: 0.75 }}>
                공수(空唱) — 신령이 사람의 입을 빌려 직접 들려주는 말
              </div>
            </div>
            <div className="space-y-5 border-l-2 pl-4" style={{ borderColor: `${deityColor}66` }}>
              {speechLines(READING.total).map((line, li) => (
                <RevealLine
                  key={`total-${li}`}
                  className="text-[19px] text-text-primary leading-[2.05]"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {renderManshinEmphasis(line)}
                </RevealLine>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5 mt-4">
              {deity.keywords.map((k) => (
                <span
                  key={k}
                  className="text-[12px] px-2.5 py-1 rounded-full border"
                  style={{ color: deityColor, borderColor: `${deityColor}55`, background: `${deityColor}14` }}
                >
                  {k}
                </span>
              ))}
            </div>

            {/* 카테고리별 공수 아코디언 (reveal 동일) */}
            <div className="mt-5 space-y-2">
              <div className="text-[11.5px] text-text-tertiary mb-1">궁금한 운을 짚어 마저 듣거라</div>
              {FORTUNE_SECTIONS.map((sec) => {
                const open = !!openSections[sec.key];
                const text = READING[sec.key];
                return (
                  <div
                    key={sec.key}
                    className="rounded-xl border overflow-hidden"
                    style={{ borderColor: open ? `${deityColor}55` : 'var(--border-subtle)' }}
                  >
                    <button
                      onClick={() => setOpenSections((s) => ({ ...s, [sec.key]: !s[sec.key] }))}
                      className="w-full flex items-center justify-between px-4 py-3"
                      style={{ background: open ? `${deityColor}0f` : 'rgba(255,255,255,0.03)' }}
                    >
                      <span className="text-[14px] font-semibold" style={{ color: open ? deityColor : 'var(--text-secondary)' }}>
                        {sec.label}
                      </span>
                      <motion.span
                        animate={{ rotate: open ? 180 : 0 }}
                        transition={{ duration: 0.25 }}
                        className="text-[11px] text-text-tertiary"
                      >
                        ▾
                      </motion.span>
                    </button>
                    {open && (
                      <div className="px-4 pb-5 pt-1 space-y-4">
                        {speechLines(text).map((line, li) => (
                          <RevealLine
                            key={`${sec.key}-${li}`}
                            className="text-[18px] text-text-primary leading-[2.0]"
                            style={{ fontFamily: 'var(--font-serif)' }}
                          >
                            {renderManshinEmphasis(line)}
                          </RevealLine>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
