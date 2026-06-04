'use client';

/**
 * 실시간 운세(TodayFortune V3) 결과 페이지의 각 섹션 본문 위에 박히는 시각 데이터 카드.
 *
 * 줄글 본문 위에 결정값(일진·입력 요약·시간대 흐름·영역 점수·행운 카드)을 시각 박스로
 * 빼서 한눈에 보이게 한다. 정통사주 JungtongsajuSectionVisuals 와 같은 코스믹 톤.
 *
 * 페이지 상단에 종합 점수 링·9영역 막대·시간대 흐름 그래프가 이미 있으므로,
 * 섹션 카드는 그 섹션에 직접 닿는 값만 좁혀서 보여 준다.
 * (영역별 한 줄·식사·맞춤 포인트·행운의 한마디 섹션은 별도 결정값이 없어 카드 없음)
 */

import type { TodayFortuneV3AIResult } from '../../services/fortuneService';
import type { TodayV3SectionKey, TodayTimeSlot } from '../../constants/prompts';
import { TODAY_V3_DOMAIN_LABELS, TODAY_TIME_SLOT_LABELS } from '../../constants/prompts';
import { ELEMENT_LUCKY, LuckyVisualCard } from './LuckyVisualCard';

const ELEMENT_COLOR: Record<string, string> = {
  목: '#34D399', 화: '#F87171', 토: '#FBBF24', 금: '#E5E7EB', 수: '#60A5FA',
};

// 오행 한줄 의미 — 일진 카드 캡션용 (6자 내외)
const ELEMENT_MEANING: Record<string, string> = {
  목: '성장·뻗어남',
  화: '열정·확산',
  토: '안정·중심',
  금: '결단·정리',
  수: '흐름·지혜',
};

// 십성 한줄 의미 — 일진 카드 캡션용 (6~8자)
const TENGOD_MEANING: Record<string, string> = {
  비견: '동등·자립',
  겁재: '경쟁·도전',
  식신: '표현·여유',
  상관: '창의·반항',
  편재: '활동성·기회',
  정재: '안정 재물',
  편관: '압박·강행',
  정관: '책임·정도',
  편인: '직관·연구',
  정인: '보호·학문',
};

// "일진유×유 동(同)" → 사람말 풀이
function parseInteraction(raw: string): { kind: '동' | '충' | '합' | 'etc'; mate: string; label: string; desc: string } {
  const m = raw.match(/일진([^\s×]+)×([^\s]+)\s*(동|충|합)/);
  if (!m) return { kind: 'etc', mate: '', label: raw, desc: '' };
  const mate = m[2];
  const k = m[3] as '동' | '충' | '합';
  if (k === '동') return { kind: '동', mate, label: '같은 기운', desc: `내 사주의 ${mate}와 겹쳐 같은 흐름이 강해져요` };
  if (k === '충') return { kind: '충', mate, label: '부딪힘',   desc: `내 사주의 ${mate}와 충돌해 변화·갈등이 생겨요` };
  return { kind: '합', mate, label: '어울림', desc: `내 사주의 ${mate}와 어울려 호응·결속이 일어나요` };
}

const INTERACTION_TONE: Record<'동' | '충' | '합' | 'etc', { bg: string; border: string; text: string }> = {
  동: { bg: 'rgba(251,191,36,0.14)',  border: 'rgba(251,191,36,0.45)',  text: '#FCD34D' },
  충: { bg: 'rgba(248,113,113,0.14)', border: 'rgba(248,113,113,0.45)', text: '#FCA5A5' },
  합: { bg: 'rgba(52,211,153,0.14)',  border: 'rgba(52,211,153,0.45)',  text: '#6EE7B7' },
  etc:{ bg: 'rgba(201,166,255,0.12)', border: 'rgba(201,166,255,0.40)', text: '#C9A6FF' },
};

const FLOW_ORDER: TodayTimeSlot[] = ['midnight', 'morning', 'afternoon', 'evening'];

function scoreTier(s: number): { label: string; color: string } {
  if (s >= 75) return { label: '좋음', color: '#34D399' };
  if (s >= 55) return { label: '보통', color: '#FBBF24' };
  return { label: '주의', color: '#FB923C' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 공통 래퍼
// ─────────────────────────────────────────────────────────────────────────────
function CardWrap({
  accent,
  title,
  titleSub,
  children,
}: {
  accent: string;
  title: string;
  titleSub?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-4 border mb-3"
      style={{
        background: `linear-gradient(135deg, rgba(20,12,38,0.62) 0%, ${accent}10 60%, rgba(20,12,38,0.55) 100%)`,
        borderColor: `${accent}50`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[15px] font-bold tracking-[0.04em]" style={{ color: accent }}>
          {title}
          {titleSub && (
            <span className="text-text-tertiary font-normal text-[13px] ml-1.5">{titleSub}</span>
          )}
        </span>
      </div>
      {children}
    </div>
  );
}

// 점수 게이지 한 줄 — 라벨 + 막대 + 점수 (열 정렬 통일)
function MiniGauge({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[78px] shrink-0 text-[13px] font-semibold text-text-secondary" style={{ wordBreak: 'keep-all' }}>
        {label}
      </span>
      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(4, score))}%`, background: color }}
        />
      </div>
      <span className="w-11 text-right text-[14px] font-bold shrink-0" style={{ color }}>
        {score}점
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) 명리적 근거 — 오늘의 일진 (간지·오행·십성·작용)
// ─────────────────────────────────────────────────────────────────────────────
function IljinVisual({ report }: { report: TodayFortuneV3AIResult }) {
  const gz = report.todayGz;
  if (!gz) return null;
  const ganColor = ELEMENT_COLOR[gz.ganElement] ?? '#C9A6FF';
  const zhiColor = ELEMENT_COLOR[gz.zhiElement] ?? '#C9A6FF';
  const ganHanja = gz.hanja?.[0] ?? '';
  const zhiHanja = gz.hanja?.[1] ?? '';
  const pillars = [
    { tag: '하늘 기운 (천간)', gz: gz.gan, hanja: ganHanja, el: gz.ganElement, tenGod: gz.tenGodGan, color: ganColor },
    { tag: '땅 기운 (지지)',   gz: gz.zhi, hanja: zhiHanja, el: gz.zhiElement, tenGod: gz.tenGodZhi, color: zhiColor },
  ];
  return (
    <CardWrap accent={ganColor} title="오늘의 일진" titleSub={`${gz.hanja} · ${gz.gan}${gz.zhi}`}>
      <p className="text-[13.5px] text-text-secondary mb-3 leading-relaxed">
        일진은 오늘 하루를 이끄는 두 기운이에요. 하늘 기운은 오늘의 분위기, 땅 기운은 그 분위기가 머무는 자리예요.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {pillars.map((p) => (
          <div
            key={p.tag}
            className="rounded-xl px-3 py-3 border flex flex-col items-center gap-1.5"
            style={{ background: `${p.color}12`, borderColor: `${p.color}45` }}
          >
            <span className="text-[11.5px] text-text-tertiary">{p.tag}</span>
            <span className="flex items-baseline gap-1">
              <span
                className="text-[28px] font-bold leading-none"
                style={{ color: p.color, fontFamily: 'var(--font-serif)' }}
              >
                {p.gz}
              </span>
              {p.hanja && (
                <span className="text-[14px] text-text-tertiary leading-none">({p.hanja})</span>
              )}
            </span>
            <span className="text-[12.5px] font-semibold leading-tight text-center" style={{ color: p.color }}>
              오행 {p.el}
              {ELEMENT_MEANING[p.el] && (
                <span className="block text-[11px] font-normal text-text-tertiary mt-0.5">
                  {ELEMENT_MEANING[p.el]}
                </span>
              )}
            </span>
            {p.tenGod && (
              <span className="text-[12px] text-text-secondary mt-0.5 text-center leading-tight">
                십성 {p.tenGod}
                {TENGOD_MEANING[p.tenGod] && (
                  <span className="block text-[11px] text-text-tertiary mt-0.5">
                    {TENGOD_MEANING[p.tenGod]}
                  </span>
                )}
              </span>
            )}
          </div>
        ))}
      </div>
      {gz.interactions.length > 0 && (
        <div className="mt-3">
          <div className="text-[12px] text-text-tertiary mb-1.5">내 사주 원국과의 작용</div>
          <div className="flex flex-col gap-1.5">
            {gz.interactions.map((it, i) => {
              const parsed = parseInteraction(it);
              const tone = INTERACTION_TONE[parsed.kind];
              return (
                <div
                  key={i}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-md border"
                  style={{ background: tone.bg, borderColor: tone.border }}
                >
                  <span
                    className="inline-flex items-center justify-center text-[13px] font-bold rounded shrink-0 leading-none"
                    style={{ width: 26, height: 26, background: tone.border, color: tone.text }}
                  >
                    {parsed.kind === 'etc' ? '작용' : parsed.kind}
                  </span>
                  <span className="text-[13px] text-text-secondary leading-snug">
                    {parsed.desc || parsed.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) 관심사 운용법 — 입력 요약 (관심사·직업·연애 상태)
// ─────────────────────────────────────────────────────────────────────────────
function HobbyVisual({ report }: { report: TodayFortuneV3AIResult }) {
  const uc = report.userContext;
  if (!uc) return null;
  const hobbies: string[] = [...uc.hobbies];
  if (uc.customHobby && uc.customHobby.trim()) hobbies.push(uc.customHobby.trim());
  const jobState = uc.customJobState?.trim() || uc.jobState;
  const loveState = uc.customLoveState?.trim() || uc.loveState;
  return (
    <CardWrap accent="#C9A6FF" title="오늘의 나는 이런 상태예요">
      <div className="text-[12px] text-text-tertiary mb-1.5">요즘 관심 가는 것</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {hobbies.map((h, i) => (
          <span
            key={i}
            className="text-[13px] font-bold px-2.5 py-1.5 rounded-lg border text-text-primary"
            style={{ background: 'rgba(201,166,255,0.16)', borderColor: 'rgba(201,166,255,0.5)' }}
          >
            {h}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: '직업·역할', value: jobState },
          { label: '연애 상태', value: loveState },
        ].map((row) => (
          <div
            key={row.label}
            className="rounded-xl px-3 py-2.5 border"
            style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="text-[11.5px] text-text-tertiary mb-1">{row.label}</div>
            <div className="text-[14px] font-bold text-text-primary">{row.value}</div>
          </div>
        ))}
      </div>
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) 시간대별 흐름 — 4구간 점수 막대 (현재 시간대 강조)
// ─────────────────────────────────────────────────────────────────────────────
function TimeflowVisual({ report }: { report: TodayFortuneV3AIResult }) {
  const flow = report.flowScores;
  if (!flow) return null;
  const cur = report.userContext?.timeSlot;
  const curIdx = cur ? FLOW_ORDER.indexOf(cur) : -1;
  return (
    <CardWrap accent="#7DD3FC" title="하루 시간대 흐름" titleSub="현재 구간 기준">
      <div className="flex flex-col gap-2">
        {FLOW_ORDER.map((slot, i) => {
          const score = flow[slot];
          const tier = scoreTier(score);
          const isNow = i === curIdx;
          const isPast = curIdx >= 0 && i < curIdx;
          return (
            <div key={slot} className="flex items-center gap-2.5" style={{ opacity: isPast ? 0.45 : 1 }}>
              <span className="w-16 shrink-0 text-[13px] font-semibold text-text-secondary">
                {TODAY_TIME_SLOT_LABELS[slot]}
              </span>
              <div
                className="flex-1 h-2.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, Math.max(4, score))}%`, background: tier.color }}
                />
              </div>
              <span className="w-11 text-right text-[14px] font-bold shrink-0" style={{ color: tier.color }}>
                {score}점
              </span>
              <span className="w-10 shrink-0 flex justify-end">
                {isNow && (
                  <span
                    className="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                    style={{ background: 'rgba(125,211,252,0.22)', color: '#7DD3FC' }}
                  >
                    지금
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) 단일 영역 게이지 — 수면·운동
// ─────────────────────────────────────────────────────────────────────────────
const DOMAIN_INTERP: Record<string, [string, string, string]> = {
  recovery: [
    '몸과 마음이 잘 회복되는 하루예요',
    '적당히 쉬면 컨디션이 유지되는 흐름이에요',
    '푹 쉬어 에너지를 충분히 채워야 하는 날이에요',
  ],
  exercise: [
    '몸을 움직이기에 활력이 가장 좋은 날이에요',
    '가벼운 활동으로 리듬을 잡기 좋은 흐름이에요',
    '무리한 운동보다 스트레칭과 산책이 알맞아요',
  ],
};

function DomainGaugeVisual({
  domain,
  title,
  score,
}: {
  domain: keyof typeof DOMAIN_INTERP;
  title: string;
  score: number;
}) {
  const tier = scoreTier(score);
  const interpIdx = score >= 75 ? 0 : score >= 55 ? 1 : 2;
  return (
    <CardWrap accent={tier.color} title={title}>
      <div className="flex items-end gap-2 mb-2.5">
        <span className="text-[30px] font-bold leading-none" style={{ color: tier.color }}>
          {score}
        </span>
        <span className="text-[14px] text-text-tertiary mb-0.5">점</span>
        <span
          className="ml-auto text-[14px] font-bold px-2.5 py-1 rounded-full"
          style={{ color: tier.color, background: `${tier.color}22` }}
        >
          {tier.label}
        </span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(4, score))}%`, background: tier.color }}
        />
      </div>
      <p className="text-[14px] text-text-secondary mt-2.5 leading-relaxed">
        {DOMAIN_INTERP[domain][interpIdx]}
      </p>
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) 대인·이성 — 대인관계 + 이성운 2게이지
// ─────────────────────────────────────────────────────────────────────────────
function RelationshipVisual({ report }: { report: TodayFortuneV3AIResult }) {
  const s = report.domainScores;
  if (!s) return null;
  const rows = [
    { label: '대인관계', score: s.social },
    { label: '이성운', score: s.love },
  ];
  return (
    <CardWrap accent="#F0A6C9" title="오늘의 관계 기운">
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <MiniGauge key={r.label} label={r.label} score={r.score} color={scoreTier(r.score).color} />
        ))}
      </div>
    </CardWrap>
  );
}

// 순위 행 — 순위 배지 + 라벨 + 막대 + 점수 (열 정렬 통일)
function RankRow({
  rank,
  label,
  score,
  color,
}: {
  rank: number;
  label: string;
  score: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0 text-[11px] font-bold"
        style={{ background: `${color}26`, color }}
      >
        {rank}
      </span>
      <span
        className="w-[78px] shrink-0 text-[13.5px] font-bold text-text-primary"
        style={{ wordBreak: 'keep-all' }}
      >
        {label}
      </span>
      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(4, score))}%`, background: color }}
        />
      </div>
      <span className="w-11 text-right text-[14px] font-bold shrink-0" style={{ color }}>
        {score}점
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) 주의할 점 — 오늘 점수가 낮은 영역 순위
// ─────────────────────────────────────────────────────────────────────────────
function CautionVisual({ report }: { report: TodayFortuneV3AIResult }) {
  const s = report.domainScores;
  if (!s) return null;
  const ranked = (Object.keys(TODAY_V3_DOMAIN_LABELS) as (keyof typeof TODAY_V3_DOMAIN_LABELS)[])
    .map((k) => ({ label: TODAY_V3_DOMAIN_LABELS[k], score: s[k] }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  return (
    <CardWrap accent="#FB923C" title="오늘 더 살펴야 할 영역" titleSub="점수 낮은 순">
      <div className="flex flex-col gap-2.5">
        {ranked.map((d, i) => (
          <RankRow key={d.label} rank={i + 1} label={d.label} score={d.score} color={scoreTier(d.score).color} />
        ))}
      </div>
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) 좋은 포인트 — 오늘 점수가 높은 영역 순위 + 종합 점수
// ─────────────────────────────────────────────────────────────────────────────
function StrengthVisual({ report }: { report: TodayFortuneV3AIResult }) {
  const s = report.domainScores;
  if (!s) return null;
  const ranked = (Object.keys(TODAY_V3_DOMAIN_LABELS) as (keyof typeof TODAY_V3_DOMAIN_LABELS)[])
    .map((k) => ({ label: TODAY_V3_DOMAIN_LABELS[k], score: s[k] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return (
    <CardWrap accent="#34D399" title="오늘 가장 빛나는 영역" titleSub={`종합 ${s.overall}점`}>
      <div className="flex flex-col gap-2.5">
        {ranked.map((d, i) => (
          <RankRow key={d.label} rank={i + 1} label={d.label} score={d.score} color="#34D399" />
        ))}
      </div>
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8) 식사 가이드 — 일진 지지 오행 기반 오미·장부·음식 기운
// ─────────────────────────────────────────────────────────────────────────────
const ELEMENT_FOOD: Record<string, { taste: string; organ: string; foods: string[] }> = {
  목: { taste: '신맛', organ: '간·담', foods: ['푸른 잎채소', '매실', '신김치', '딸기'] },
  화: { taste: '쓴맛', organ: '심장·소장', foods: ['도라지', '쌉쌀한 나물', '녹차', '자몽'] },
  토: { taste: '단맛', organ: '비위', foods: ['단호박', '고구마', '대추', '꿀'] },
  금: { taste: '매운맛', organ: '폐·대장', foods: ['무', '생강', '마늘', '배'] },
  수: { taste: '짠맛', organ: '신장·방광', foods: ['해조류', '검은콩', '두부', '견과'] },
};

function MealVisual({ report }: { report: TodayFortuneV3AIResult }) {
  const el = report.todayGz?.zhiElement;
  const food = el ? ELEMENT_FOOD[el] : undefined;
  if (!el || !food) return null;
  const color = ELEMENT_COLOR[el] ?? '#F4A261';
  return (
    <CardWrap accent={color} title="오늘 몸에 맞는 식사 기운" titleSub={`일진 ${el} 기운`}>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div
          className="rounded-xl px-3 py-2.5 border text-center"
          style={{ background: `${color}12`, borderColor: `${color}45` }}
        >
          <div className="text-[11.5px] text-text-tertiary mb-1">어울리는 맛</div>
          <div className="text-[15px] font-bold" style={{ color }}>{food.taste}</div>
        </div>
        <div
          className="rounded-xl px-3 py-2.5 border text-center"
          style={{ background: `${color}12`, borderColor: `${color}45` }}
        >
          <div className="text-[11.5px] text-text-tertiary mb-1">살피면 좋은 장부</div>
          <div className="text-[15px] font-bold" style={{ color }}>{food.organ}</div>
        </div>
      </div>
      <div className="text-[12px] text-text-tertiary mb-1.5">오늘 챙기면 좋은 음식</div>
      <div className="flex flex-wrap gap-1.5">
        {food.foods.map((f) => (
          <span
            key={f}
            className="text-[13px] font-semibold px-2.5 py-1.5 rounded-lg border text-text-primary"
            style={{ background: `${color}16`, borderColor: `${color}45` }}
          >
            {f}
          </span>
        ))}
      </div>
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9) 맞춤 포인트 — 직업·역할에 닿는 영역 점수
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_DOMAINS: Record<string, [keyof typeof TODAY_V3_DOMAIN_LABELS, keyof typeof TODAY_V3_DOMAIN_LABELS]> = {
  학생: ['exam', 'focus'],
  직장인: ['focus', 'recovery'],
  '자영업·프리랜서': ['money', 'social'],
  '구직 중': ['social', 'mental'],
  주부: ['recovery', 'mental'],
  기타: ['focus', 'mental'],
};

function PersonaVisual({ report }: { report: TodayFortuneV3AIResult }) {
  const uc = report.userContext;
  const s = report.domainScores;
  if (!uc || !s) return null;
  const pair = ROLE_DOMAINS[uc.jobState ?? '기타'] ?? ROLE_DOMAINS['기타'];
  const roleLabel = uc.customJobState?.trim() || uc.jobState || '오늘의 나';
  return (
    <CardWrap accent="#F4C2A1" title="내 역할에 닿는 오늘 기운">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[12.5px] text-text-tertiary">오늘의 나</span>
        <span
          className="text-[13px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(244,194,161,0.2)', color: '#F4C2A1' }}
        >
          {roleLabel}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {pair.map((k) => (
          <MiniGauge
            key={k}
            label={TODAY_V3_DOMAIN_LABELS[k]}
            score={s[k]}
            color={scoreTier(s[k]).color}
          />
        ))}
      </div>
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 10) 행운 카드 — 일진 천간 오행 기반 결정론적 행운 처방
// ─────────────────────────────────────────────────────────────────────────────
function LuckyVisual({ report }: { report: TodayFortuneV3AIResult }) {
  const el = report.todayGz?.ganElement;
  const lucky = el ? ELEMENT_LUCKY[el] : undefined;
  if (!lucky) return null;
  return (
    <CardWrap accent="#FCE8B2" title="오늘의 행운 처방" titleSub="일진 오행 기준">
      <LuckyVisualCard
        colors={lucky.colors}
        colorCss={lucky.colorCss}
        numbers={lucky.numbers}
        direction={lucky.direction}
        timeSlot={lucky.timeSlot}
        gem={lucky.gem}
        activity={lucky.activity}
      />
    </CardWrap>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 통합 라우터 — 섹션 키에 맞는 시각 카드 반환
// ─────────────────────────────────────────────────────────────────────────────
export function renderTodaySectionVisual(key: TodayV3SectionKey, report: TodayFortuneV3AIResult) {
  switch (key) {
    case 'today_basis':
      return <IljinVisual report={report} />;
    case 'today_hobby_method':
      return <HobbyVisual report={report} />;
    case 'today_timeflow':
      return <TimeflowVisual report={report} />;
    case 'today_sleep':
      return report.domainScores ? (
        <DomainGaugeVisual domain="recovery" title="오늘의 회복·수면 점수" score={report.domainScores.recovery} />
      ) : null;
    case 'today_exercise':
      return report.domainScores ? (
        <DomainGaugeVisual domain="exercise" title="오늘의 운동운 점수" score={report.domainScores.exercise} />
      ) : null;
    case 'today_relationship':
      return <RelationshipVisual report={report} />;
    case 'today_meal':
      return <MealVisual report={report} />;
    case 'today_caution':
      return <CautionVisual report={report} />;
    case 'today_strength':
      return <StrengthVisual report={report} />;
    case 'today_persona_extra':
      return <PersonaVisual report={report} />;
    case 'today_lucky_card':
      return <LuckyVisual report={report} />;
    default:
      // today_domains_brief·today_fortune_message 는 상단 차트로 충분하거나
      // 별도 결정값이 없어 카드 없음
      return null;
  }
}
