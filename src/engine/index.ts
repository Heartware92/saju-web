/**
 * 사주 명리학 규칙 엔진 메인 모듈
 *
 * 이 엔진은 사주 계산 결과를 받아서:
 * 1. 격국(格局) 판정
 * 2. 용신(用神) 분석
 * 3. 카테고리별 해석 생성
 * 4. AI에게 전달할 확정 사실 구성
 *
 * 모든 계산은 심볼릭(결정론적)으로 수행되어
 * LLM 없이도 일관된 결과를 보장합니다.
 */

import type { SajuResult } from '../utils/sajuCalculator';
import type {
  RuleEngineResult,
  ConfirmedFacts,
  OhangType,
  YinyangType,
  InterpretationCategory
} from './types';
import { STEM_ELEMENT, STEM_YINYANG } from '../utils/sajuCalculator';
import { determineGyeokguk, analyzeGyeokgukStatus, GYEOKGUK_DEFINITIONS } from './gyeokguk';
import { analyzeYongsin, getYongsinColor, getYongsinDirection, getYongsinNumber } from './yongsin';
import { generateInterpretations } from './interpretation';

// ============================================
// 메인 규칙 엔진 함수
// ============================================

/**
 * 사주 분석을 수행하는 메인 함수
 *
 * @param saju - sajuCalculator의 결과
 * @returns 규칙 엔진 분석 결과
 */
export function analyzeWithRuleEngine(saju: SajuResult): RuleEngineResult {
  const startTime = performance.now();

  const dayElement = STEM_ELEMENT[saju.dayMaster] as OhangType;
  const dayYinyang = STEM_YINYANG[saju.dayMaster] as YinyangType;

  // 1. 격국 판정
  const gyeokguk = determineGyeokguk(saju);
  const gyeokgukStatus = analyzeGyeokgukStatus(saju, gyeokguk);

  // 2. 용신 분석
  const yongsin = analyzeYongsin(saju);

  // 3. 카테고리별 해석 생성
  const interpretations = generateInterpretations(
    gyeokguk,
    yongsin,
    saju.isStrong,
    dayElement
  );

  // 4. 오행 분포 계산
  const elementDistribution = calculateElementDistribution(saju);
  const sortedElements = Object.entries(elementDistribution)
    .sort((a, b) => b[1] - a[1]);

  // 5. 특이사항 수집
  const specialFeatures = collectSpecialFeatures(saju, gyeokguk, gyeokgukStatus);

  // 6. 확정 사실 구성
  const confirmedFacts: ConfirmedFacts = {
    // 기본 정보
    dayMaster: saju.dayMaster,
    dayMasterElement: dayElement,
    dayMasterYinyang: dayYinyang,

    // 격국
    gyeokguk: gyeokguk.name,
    gyeokgukType: gyeokguk.type,

    // 신강/신약
    isStrong: saju.isStrong,
    strengthScore: saju.strengthScore,

    // 용신
    yongsinElement: yongsin.primary.yongsin,
    yongsinMethod: yongsin.primary.method,
    heeSinElement: yongsin.primary.heeSin,
    giSinElement: yongsin.primary.giSin,

    // 오행 분포
    elementDistribution,
    strongElement: sortedElements[0][0] as OhangType,
    weakElement: sortedElements[sortedElements.length - 1][0] as OhangType,

    // 특이사항
    specialFeatures
  };

  const endTime = performance.now();

  // 적용된 규칙 목록
  const rulesApplied = [
    `격국: ${gyeokguk.id}`,
    `용신법: ${yongsin.primary.method}`,
    ...(yongsin.secondary ? [`보조용신법: ${yongsin.secondary.method}`] : [])
  ];

  return {
    gyeokguk,
    yongsin,
    interpretations: interpretations as RuleEngineResult['interpretations'],
    confirmedFacts,
    metadata: {
      rulesApplied,
      processingTime: endTime - startTime,
      confidence: gyeokguk.confidence
    }
  };
}

// ============================================
// 유틸리티 함수들
// ============================================

/**
 * 오행 분포를 계산합니다
 * - 천간 / 지지: 각 1점
 * - 지장간: 정기(첫번째) 0.5점, 중·여기 0.25점
 * (sajuCalculator.ts의 countElements와 동일한 가중치)
 */
function calculateElementDistribution(saju: SajuResult): Record<OhangType, number> {
  const count: Record<OhangType, number> = {
    '목': 0, '화': 0, '토': 0, '금': 0, '수': 0
  };

  const pillars = [
    saju.pillars.year,
    saju.pillars.month,
    saju.pillars.day,
    saju.pillars.hour
  ];

  pillars.forEach(pillar => {
    const ganEl = pillar.ganElement as OhangType;
    const zhiEl = pillar.zhiElement as OhangType;

    if (ganEl && count[ganEl] !== undefined) count[ganEl] += 1;
    if (zhiEl && count[zhiEl] !== undefined) count[zhiEl] += 1;

    pillar.hiddenStems.forEach((stem, idx) => {
      const hiddenEl = STEM_ELEMENT[stem] as OhangType;
      if (hiddenEl && count[hiddenEl] !== undefined) {
        count[hiddenEl] += idx === 0 ? 0.5 : 0.25;
      }
    });
  });

  return count;
}

/**
 * 특이사항을 수집합니다
 */
function collectSpecialFeatures(
  saju: SajuResult,
  gyeokguk: ReturnType<typeof determineGyeokguk>,
  gyeokgukStatus: ReturnType<typeof analyzeGyeokgukStatus>
): string[] {
  const features: string[] = [];

  // 격국 관련
  features.push(`${gyeokguk.name} (${gyeokguk.type})`);

  if (!gyeokgukStatus.isSuccessful) {
    features.push('격국 손상(敗格) 주의');
  }

  // 신살 관련 (2분류: gilseong/sinsal)
  saju.sinSals.forEach(sinsal => {
    if (sinsal.type === 'gilseong') {
      features.push(`길성: ${sinsal.name}`);
    } else {
      features.push(`신살: ${sinsal.name}`);
    }
  });

  // 합충 관련
  const significantInteractions = saju.interactions.filter(
    i => i.type === '충' || (i.type === '합' && i.description.includes('삼합'))
  );

  significantInteractions.forEach(interaction => {
    features.push(`${interaction.type}: ${interaction.description.split('-')[0].trim()}`);
  });

  // 신강/신약 정도
  if (saju.strengthScore >= 70) {
    features.push('매우 신강');
  } else if (saju.strengthScore <= 35) {
    features.push('매우 신약');
  }

  return features;
}

// ============================================
// AI 프롬프트 생성 함수
// ============================================

/**
 * AI에게 전달할 시스템 프롬프트를 생성합니다
 */
export function generateSystemPrompt(): string {
  return `당신은 전통 사주명리학에 기반한 운세 상담사입니다.

## 핵심 원칙
1. 아래 제공되는 "확정 사실"은 반드시 사실로 인용해야 합니다
2. 확정 사실과 모순되는 내용은 절대 생성하지 마세요
3. 긍정적이면서도 현실적인 조언을 제공하세요
4. 전문 용어는 쉽게 풀어서 설명하세요

## 응답 스타일
- 따뜻하고 공감적인 어조
- 구체적이고 실용적인 조언
- 운명론적이지 않고 가능성 중심`;
}

/**
 * AI에게 전달할 사용자 프롬프트를 생성합니다
 */
export function generateUserPrompt(
  result: RuleEngineResult,
  userContext?: {
    name?: string;
    concern?: string;
    question?: string;
  }
): string {
  const { confirmedFacts, interpretations, gyeokguk, yongsin } = result;

  let prompt = `## 확정 사실 (반드시 인용)

### 기본 정보
- 일간: ${confirmedFacts.dayMaster} (${confirmedFacts.dayMasterElement}${confirmedFacts.dayMasterYinyang})
- 격국: ${confirmedFacts.gyeokguk} (${confirmedFacts.gyeokgukType})
- 신강/신약: ${confirmedFacts.isStrong ? '신강' : '신약'} (점수: ${confirmedFacts.strengthScore}/100)

### 용신 분석
- 용신: ${confirmedFacts.yongsinElement} (${confirmedFacts.yongsinMethod}법)
- 희신: ${confirmedFacts.heeSinElement}
- 기신: ${confirmedFacts.giSinElement}
- 용신 해석: ${yongsin.analysis}

### 격국 특성
${gyeokguk.traits.map(t => `- ${t}`).join('\n')}

### 추천 직업군
${gyeokguk.careers.map(c => `- ${c}`).join('\n')}

### 용신 활용법
- 용신 색상: ${getYongsinColor(confirmedFacts.yongsinElement)}
- 용신 방위: ${getYongsinDirection(confirmedFacts.yongsinElement)}
- 용신 숫자: ${getYongsinNumber(confirmedFacts.yongsinElement)}

### 특이사항
${confirmedFacts.specialFeatures.map(f => `- ${f}`).join('\n')}

## 기본 해석 (참고용)
${Object.entries(interpretations).map(([cat, text]) =>
  `### ${getCategoryKorean(cat as InterpretationCategory)}\n${text}`
).join('\n\n')}
`;

  if (userContext) {
    prompt += `\n## 사용자 정보`;
    if (userContext.name) prompt += `\n- 이름: ${userContext.name}`;
    if (userContext.concern) prompt += `\n- 주요 관심사: ${userContext.concern}`;
    if (userContext.question) prompt += `\n- 질문: ${userContext.question}`;
  }

  prompt += `\n\n위 확정 사실을 바탕으로 따뜻하고 실용적인 사주 해석을 제공해주세요.`;

  return prompt;
}

function getCategoryKorean(category: InterpretationCategory): string {
  const map: Record<InterpretationCategory, string> = {
    personality: '성격/기질',
    career: '직업/재능',
    wealth: '재물운',
    love: '애정운',
    health: '건강운',
    overall: '총평'
  };
  return map[category] || category;
}

// ============================================
// 내보내기
// ============================================

export {
  // 격국 관련
  determineGyeokguk,
  analyzeGyeokgukStatus,
  GYEOKGUK_DEFINITIONS,

  // 용신 관련
  analyzeYongsin,
  getYongsinColor,
  getYongsinDirection,
  getYongsinNumber,

  // 해석 관련
  generateInterpretations
};

// 타입 재내보내기
export type {
  RuleEngineResult,
  ConfirmedFacts,
  OhangType,
  YinyangType
} from './types';
