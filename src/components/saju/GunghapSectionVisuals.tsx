'use client';

/**
 * 궁합 결과 페이지의 각 섹션 본문 위에 박히는 시각 데이터 카드.
 *
 * 궁합은 섹션 제목이 카테고리(연인·친구·가족·직장 등)마다 달라 고정 키가 없다.
 * 따라서 섹션 제목을 키워드로 분류해 — 그 섹션과 가장 관련 깊은 영역 점수
 * (정서적 교감 / 소통과 이해 / 가치관 조화 / 성장 가능성 / 갈등 해소력)를
 * 게이지 카드로 보여준다. 명확히 매칭되지 않으면 카드를 띄우지 않는다(graceful).
 *
 * JungtongsajuSectionVisuals · NewyearSectionVisuals 와 같은 코스믹 톤.
 */

import { GUNGHAP_DOMAINS, GRADE_COLOR, scoreToGrade, type GunghapDomainScores, type GunghapDomainKey } from '../../lib/gunghap';

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
 * @param title       섹션 제목 (예: "갈등·마찰 포인트")
 * @param domainScores 영역별 점수 (없으면 카드 미표시)
 */
export function renderGunghapSectionVisual(
  title: string,
  domainScores: GunghapDomainScores | null | undefined,
) {
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
