'use client';

/**
 * 궁합 결과 페이지의 각 섹션 본문 위에 박히는 시각 데이터 카드.
 *
 * 궁합은 섹션 제목이 카테고리(연인·친구·가족·직장 등)마다 달라 고정 키가 없다.
 * 섹션 제목을 키워드로 분류해 — 그 섹션에 맞는 시각 카드를 띄운다:
 *  · "오행" 섹션      → 두 일간 오행의 상생·상극·비화 관계 카드
 *  · "개운법·처방" 섹션 → 관계 개운 오행 기반 LuckyVisualCard (신년운세·정통사주와 동일 UI)
 *  · 그 외            → 가장 관련 깊은 영역 점수 게이지 카드
 * 매칭 데이터가 없으면 카드를 띄우지 않는다(graceful).
 *
 * JungtongsajuSectionVisuals · NewyearSectionVisuals 와 같은 코스믹 톤.
 */

import { GUNGHAP_DOMAINS, GRADE_COLOR, scoreToGrade, type GunghapDomainScores, type GunghapDomainKey } from '../../lib/gunghap';
import { LuckyVisualCard, ELEMENT_LUCKY } from './LuckyVisualCard';

const DOMAIN_LABEL: Record<GunghapDomainKey, string> = {
  emotion: '정서적 교감',
  communication: '소통과 이해',
  values: '가치관 조화',
  growth: '성장 가능성',
  conflict: '갈등 해소력',
};
// 각 영역이 이 섹션에서 왜 중요한지 한 줄 설명
const DOMAIN_HINT: Record<GunghapDomainKey, string> = {
  emotion: '두 사람의 감정이 얼마나 자연스럽게 흐르는지',
  communication: '서로의 말을 얼마나 잘 알아듣는지',
  values: '인생관·생활 방식이 얼마나 맞물리는지',
  growth: '함께 있을 때 서로 얼마나 나아가는지',
  conflict: '부딪쳤을 때 얼마나 잘 풀어내는지',
};

// ─────────────────────────────────────────────────────────────────────────────
// 오행 관계 — 두 일간 오행의 상생·상극·비화 + 관계 개운 오행
// ─────────────────────────────────────────────────────────────────────────────
const OHAENG_LIST = ['목', '화', '토', '금', '수'] as const;
const OHAENG_COLOR: Record<string, string> = {
  '목': '#34D399', '화': '#F43F5E', '토': '#F59E0B', '금': '#CBD5E1', '수': '#3B82F6',
};
const OHAENG_HANJA: Record<string, string> = {
  '목': '木', '화': '火', '토': '土', '금': '金', '수': '水',
};
// 상생: 목→화→토→금→수→목
const OHAENG_GENERATES: Record<string, string> = {
  '목': '화', '화': '토', '토': '금', '금': '수', '수': '목',
};
// 상극: 목극토·화극금·토극수·금극목·수극화
const OHAENG_CONTROLS: Record<string, string> = {
  '목': '토', '화': '금', '토': '수', '금': '목', '수': '화',
};

type OhaengRelation = '상생' | '상극' | '비화';

function ohaengRelation(a: string, b: string): OhaengRelation {
  if (a === b) return '비화';
  if (OHAENG_GENERATES[a] === b || OHAENG_GENERATES[b] === a) return '상생';
  return '상극';
}

/** 두 사람 관계를 가장 안정시키는 개운 오행 — 상극은 통관, 상생은 흐름 연장, 비화는 발산 출구 */
function relationLuckyElement(a: string, b: string): string {
  if (a === b) return OHAENG_GENERATES[a];
  if (OHAENG_GENERATES[a] === b || OHAENG_GENERATES[b] === a) {
    const downstream = OHAENG_GENERATES[a] === b ? b : a;
    return OHAENG_GENERATES[downstream];
  }
  const controller = OHAENG_CONTROLS[a] === b ? a : b;
  return OHAENG_GENERATES[controller];
}

/** "목"·"木"·"목(木)" 등 다양한 형태에서 한글 오행 한 글자만 추출 */
function normalizeElement(raw: string | undefined | null): string | null {
  if (!raw) return null;
  for (const el of OHAENG_LIST) {
    if (raw.includes(el) || raw.includes(OHAENG_HANJA[el])) return el;
  }
  return null;
}

function OhaengBadge({ element, name }: { element: string; name: string }) {
  const color = OHAENG_COLOR[element];
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <div
        className="w-[60px] h-[60px] rounded-full flex items-center justify-center shrink-0"
        style={{ background: `${color}1f`, border: `1.5px solid ${color}88`, boxShadow: `0 0 16px ${color}33` }}
      >
        <span className="text-[28px] font-bold leading-none" style={{ color, fontFamily: 'var(--font-serif)' }}>
          {OHAENG_HANJA[element]}
        </span>
      </div>
      <span className="text-[13px] font-bold" style={{ color }}>{element} 기운</span>
      <span className="text-[12px] text-text-tertiary max-w-[80px] truncate">{name}</span>
    </div>
  );
}

function OhaengRelationVisual({
  myElement,
  otherElement,
  myName,
  otherName,
}: {
  myElement: string;
  otherElement: string;
  myName: string;
  otherName: string;
}) {
  const rel = ohaengRelation(myElement, otherElement);
  const lucky = relationLuckyElement(myElement, otherElement);
  const relColor = rel === '상생' ? '#34D399' : rel === '상극' ? '#FB923C' : '#A78BFA';
  const luckyColor = OHAENG_COLOR[lucky];

  const relDesc =
    rel === '상생'
      ? '두 사람의 기운이 한 방향으로 자연스럽게 흐르는 상생 관계예요. 한쪽이 다른 쪽을 살려주듯, 서로를 북돋우며 함께 자라납니다.'
      : rel === '상극'
        ? '한쪽 기운이 다른 쪽을 누르는 상극 관계예요. 긴장과 자극이 있지만, 둘 사이를 이어주는 매개 기운이 있으면 오히려 단단해집니다.'
        : `같은 ${myElement} 기운을 나눠 가진 비화 관계예요. 닮은 만큼 깊이 통하지만, 비슷해서 같은 자리를 두고 부딪치기도 합니다.`;

  return (
    <div
      className="rounded-2xl p-4 border mb-3"
      style={{
        background: `linear-gradient(135deg, rgba(20,12,38,0.62) 0%, ${relColor}10 60%, rgba(20,12,38,0.55) 100%)`,
        borderColor: `${relColor}50`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-block w-1 h-5 rounded-full" style={{ background: relColor }} />
        <span className="text-[15px] font-bold tracking-[0.04em]" style={{ color: relColor }}>
          오행 상보 관계
        </span>
      </div>

      {/* 두 일간 오행 배지 + 관계 */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <OhaengBadge element={myElement} name={myName} />
        <div className="flex flex-col items-center gap-1 px-1">
          <div className="flex items-center gap-1">
            <span className="block w-5 h-px" style={{ background: `${relColor}99` }} />
            <span
              className="text-[13px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{ background: `${relColor}22`, color: relColor, border: `1px solid ${relColor}66` }}
            >
              {rel}
            </span>
            <span className="block w-5 h-px" style={{ background: `${relColor}99` }} />
          </div>
        </div>
        <OhaengBadge element={otherElement} name={otherName} />
      </div>

      <p className="text-[13px] text-text-secondary leading-relaxed mb-3" style={{ wordBreak: 'keep-all' }}>
        {relDesc}
      </p>

      {/* 관계를 살리는 개운 오행 */}
      <div
        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
        style={{ background: `${luckyColor}14`, border: `1px solid ${luckyColor}44` }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: `${luckyColor}22`, border: `1.5px solid ${luckyColor}88` }}
        >
          <span className="text-[17px] font-bold" style={{ color: luckyColor, fontFamily: 'var(--font-serif)' }}>
            {OHAENG_HANJA[lucky]}
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-[12px] text-text-tertiary">관계를 살리는 기운</div>
          <div className="text-[14px] font-bold" style={{ color: luckyColor }}>
            {lucky} 기운 — 두 사람을 이어주는 다리
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 개운법 — 관계 개운 오행 기반 LuckyVisualCard (신년운세·정통사주와 동일 UI)
// ─────────────────────────────────────────────────────────────────────────────
function GunghapLuckyVisual({
  myElement,
  otherElement,
}: {
  myElement: string;
  otherElement: string;
}) {
  const el = relationLuckyElement(myElement, otherElement);
  const data = ELEMENT_LUCKY[el] ?? ELEMENT_LUCKY['목'];
  const color = OHAENG_COLOR[el];

  return (
    <div
      className="rounded-2xl p-4 border mb-3"
      style={{
        background: `linear-gradient(135deg, rgba(20,12,38,0.62) 0%, ${color}10 60%, rgba(20,12,38,0.55) 100%)`,
        borderColor: `${color}50`,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-block w-1 h-5 rounded-full" style={{ background: color }} />
        <span className="text-[15px] font-bold tracking-[0.04em]" style={{ color }}>
          관계 개운 가이드
        </span>
      </div>
      <p className="text-[12.5px] text-text-tertiary leading-snug mb-3" style={{ wordBreak: 'keep-all' }}>
        두 사람의 일간 오행({myElement} · {otherElement})을 이어주는 {el} 기운이 이 관계를 가장
        안정시켜요. 아래 색·방향·시간대를 함께 활용해 보세요.
      </p>
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

/**
 * 섹션 제목 → 가장 관련 깊은 궁합 영역 분류.
 * 강한 시그널(갈등)부터 검사, 넓은 시그널(정서)을 마지막에 — 오분류 최소화.
 */
function classifyGunghapSection(title: string): GunghapDomainKey | null {
  const t = title;
  if (/갈등|마찰|주의|위험|그림자|오해|이별|헤어|독이|상처|함정/.test(t)) return 'conflict';
  if (/소통|대화|의사소통|이해|표현|시선|보는|속마음/.test(t)) return 'communication';
  if (/가치관|경제|금전|자산|신뢰|역할|생활|의사결정|방식/.test(t)) return 'values';
  if (/성장|발전|시너지|성과|배움|미래|전망|변곡|가능성|진로/.test(t)) return 'growth';
  if (/공명|끌림|에너지|유대|설렘|감정|정서|마음|온도|케미|연결|영혼|공명/.test(t)) return 'emotion';
  return null;
}

function ScoreGauge({ score }: { score: number }) {
  const grade = scoreToGrade(score);
  const color = GRADE_COLOR[grade];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="flex items-baseline gap-1.5">
          <span
            className="text-[28px] font-bold leading-none"
            style={{ fontFamily: 'var(--font-serif)', color, textShadow: `0 0 16px ${color}55` }}
          >
            {score}
          </span>
          <span className="text-[13px] text-text-tertiary">점</span>
        </span>
        <span
          className="text-[14px] font-bold px-2.5 py-1 rounded-lg"
          style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
        >
          {grade}
        </span>
      </div>
      <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.max(4, Math.min(100, score))}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            boxShadow: `0 0 10px ${color}66`,
          }}
        />
      </div>
    </div>
  );
}

/**
 * 궁합 섹션 시각 카드.
 * @param title        섹션 제목 (예: "갈등·마찰 포인트")
 * @param domainScores 영역별 점수 (없으면 도메인 게이지 카드 미표시)
 * @param myElement    내 일간 오행 ('목'~'수' 또는 한자 — 없으면 오행/개운 카드 미표시)
 * @param otherElement 상대 일간 오행
 * @param myName       내 표시 이름
 * @param otherName    상대 표시 이름
 */
export function renderGunghapSectionVisual(
  title: string,
  domainScores: GunghapDomainScores | null | undefined,
  myElement?: string | null,
  otherElement?: string | null,
  myName?: string,
  otherName?: string,
) {
  const myEl = normalizeElement(myElement);
  const otherEl = normalizeElement(otherElement);

  // 1) 오행 관계 섹션 — 두 일간 오행 상생·상극·비화 카드
  if (/오행/.test(title) && myEl && otherEl) {
    return (
      <OhaengRelationVisual
        myElement={myEl}
        otherElement={otherEl}
        myName={myName || '나'}
        otherName={otherName || '상대'}
      />
    );
  }

  // 2) 개운법·처방 섹션 — 관계 개운 오행 기반 LuckyVisualCard
  if (/개운|처방/.test(title) && myEl && otherEl) {
    return <GunghapLuckyVisual myElement={myEl} otherElement={otherEl} />;
  }

  // 3) 그 외 — 가장 관련 깊은 영역 점수 게이지 카드
  if (!domainScores) return null;
  const domainKey = classifyGunghapSection(title);
  if (!domainKey) return null;
  const score = domainScores[domainKey];
  if (typeof score !== 'number') return null;

  const grade = scoreToGrade(score);
  const color = GRADE_COLOR[grade];
  // 5개 영역 중 이 섹션 영역이 몇 위인지 (상대 강도 표시용)
  const allScores = GUNGHAP_DOMAINS
    .map((d) => domainScores[d.key])
    .filter((s): s is number => typeof s === 'number')
    .sort((a, b) => b - a);
  const rank = allScores.indexOf(score) + 1;

  return (
    <div
      className="rounded-2xl p-4 border mb-3"
      style={{
        background: `linear-gradient(135deg, rgba(20,12,38,0.62) 0%, ${color}10 60%, rgba(20,12,38,0.55) 100%)`,
        borderColor: `${color}50`,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-block w-1 h-5 rounded-full" style={{ background: color }} />
        <span className="text-[15px] font-bold tracking-[0.04em]" style={{ color }}>
          {DOMAIN_LABEL[domainKey]}
        </span>
        {rank > 0 && allScores.length >= 3 && (
          <span
            className="text-[11.5px] font-bold px-1.5 py-0.5 rounded ml-auto"
            style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
          >
            5개 영역 중 {rank}위
          </span>
        )}
      </div>
      <p className="text-[12.5px] text-text-tertiary leading-snug mb-2.5" style={{ wordBreak: 'keep-all' }}>
        이 섹션과 가장 관련 깊은 지표예요 — {DOMAIN_HINT[domainKey]}.
      </p>
      <ScoreGauge score={score} />
    </div>
  );
}
