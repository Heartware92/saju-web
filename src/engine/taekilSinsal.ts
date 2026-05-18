/**
 * 택일 흉신·길신 판정 모듈
 *
 * 한국 명리 표준(시중 만세력·사주포럼·한국민족문화대백과 종합) 기반으로
 * 행사 카테고리별 차등 적용되는 18개 신살을 판정.
 *
 * 점수 페널티는 calculateTaekil 의 scoreOneDay 마지막 단계에서 합산되며,
 * AI prompt 에는 reasons + KB 로 자연스럽게 녹는다.
 *
 * 28수·절기는 lunar-javascript 라이브러리에 위임 (정통 통서 기준).
 */

import type { Lunar, Solar } from 'lunar-javascript';
import type { TaekilCategory } from './taekil';

// ============================================
// 타입
// ============================================

export type SinsalKind = 'positive' | 'severe' | 'major' | 'minor';

export interface SinsalHit {
  /** 한글 신살 이름 (예: "복단일", "월기일") */
  name: string;
  /** 한자 표기 (예: "伏斷日") — 본문 노출용 */
  hanja?: string;
  kind: SinsalKind;
  /** 점수 가감. 양수=보너스, 음수=페널티 */
  delta: number;
  /** 사람이 읽는 짧은 사유 (reasons 에 직접 들어감) */
  reason: string;
}

export interface SinsalContext {
  /** YYYY-MM-DD */
  date: string;
  /** lunar-javascript Lunar 객체 */
  lunar: Lunar;
  /** lunar-javascript Solar 객체 */
  solar: Solar;
  /** 일진 천간 (한글) */
  dayGan: string;
  /** 일진 지지 (한글) */
  dayZhi: string;
  /** 일진 60갑자 (한글, 예: "갑진") */
  dayGz: string;
  /** 월지 (한글) */
  monthZhi: string;
  /** 연지 (한글) — 그 날이 속한 해의 연지 */
  yearZhi: string;
  /** 본인 사주 일지 (한글) */
  natalDayZhi: string;
  /** 본인 사주 연지 = 본인 띠 (한글) */
  natalYearZhi: string;
  /** 음력 일자 (1~30) */
  lunarDay: number;
  /** 행사 카테고리 */
  category: TaekilCategory;
  /** 행사 하위 항목 (예: "이사", "이별", "신축", "창업") */
  subItem?: string;
}

// ============================================
// 한국 명리 신살 데이터
// ============================================

/** 28수 → 복단일 매칭 (일지: 28수). lunar-javascript getXiu() 한자 출력 기준 */
const BOKDAN_MAP: Record<string, string> = {
  '자': '虛', '축': '斗', '인': '室', '묘': '女',
  '진': '箕', '사': '房', '오': '角', '미': '張',
  '신': '鬼', '유': '觜', '술': '胃', '해': '壁',
};

/** 십악대패일 60갑자 10개 (한글) */
const SIPAK_DAEPAE: Set<string> = new Set([
  '갑진', '을사', '병신', '정해', '무술',
  '기축', '경진', '신사', '임신', '계해',
]);

/** 끊는 일 — 복단일 면제 + 보너스 대상 */
const CUTTING_SUBITEMS: Set<string> = new Set([
  '이별', '퇴사', '관계 정리',
]);

/** 신축에만 적용되는 흉신 (토온일) */
const CONSTRUCTION_SUBITEMS: Set<string> = new Set(['신축']);

/** 창업·개업에 적용되는 흉신 (천적일·대모일) */
const BUSINESS_SUBITEMS: Set<string> = new Set(['창업', '개업']);

/** 결혼 핵심 — 본명일·해불가취·홍사·절기 적용 */
const WEDDING_SUBITEMS: Set<string> = new Set(['혼례', '약혼', '상견례']);

/** 육충 매핑 */
const CHUNG_MAP: Record<string, string> = {
  '자': '오', '오': '자', '축': '미', '미': '축',
  '인': '신', '신': '인', '묘': '유', '유': '묘',
  '진': '술', '술': '진', '사': '해', '해': '사',
};

/** 월지(寅~丑) → 천화일 일지 — 인오술·사유축·신자진·해묘미 4계 기준 */
function getCheonhwa(monthZhi: string): string {
  if (['인', '오', '술'].includes(monthZhi)) return '자';
  if (['사', '유', '축'].includes(monthZhi)) return '묘';
  if (['신', '자', '진'].includes(monthZhi)) return '오';
  return '유'; // 해묘미
}

/** 월지 → 수사일 일지 */
const SUSA_MAP: Record<string, string> = {
  '인': '술', '묘': '진', '진': '해', '사': '사',
  '오': '자', '미': '오', '신': '축', '유': '미',
  '술': '인', '해': '신', '자': '묘', '축': '유',
};

/** 월지 → 천적일 일지 */
const CHEONJEOK_MAP: Record<string, string> = {
  '인': '진', '묘': '사', '진': '오', '사': '미',
  '오': '신', '미': '유', '신': '술', '유': '해',
  '술': '자', '해': '축', '자': '인', '축': '묘',
};

/** 월지 → 혈기일 일지 */
const HYEOLGI_MAP: Record<string, string> = {
  '인': '술', '묘': '해', '진': '자', '사': '축',
  '오': '인', '미': '묘', '신': '진', '유': '사',
  '술': '오', '해': '미', '자': '신', '축': '유',
};

/** 사계 → 왕망일 일지 (춘 寅·하 巳·추 申·동 亥) */
function getWangmang(monthZhi: string): string {
  if (['인', '묘', '진'].includes(monthZhi)) return '인';
  if (['사', '오', '미'].includes(monthZhi)) return '사';
  if (['신', '유', '술'].includes(monthZhi)) return '신';
  return '해';
}

/** 사계 → 귀기일 일지 (시중 자료 합의 기준) */
function getGwigi(monthZhi: string): string {
  if (['인', '묘', '진'].includes(monthZhi)) return '축';
  if (['사', '오', '미'].includes(monthZhi)) return '인';
  if (['신', '유', '술'].includes(monthZhi)) return '자';
  return '사';
}

/** 사계 → 토온일 일지 (사계 토 지지) */
function getToOn(monthZhi: string): string {
  if (['인', '묘', '진'].includes(monthZhi)) return '진';
  if (['사', '오', '미'].includes(monthZhi)) return '미';
  if (['신', '유', '술'].includes(monthZhi)) return '술';
  return '축';
}

/** 사계 → 홍사일 일지 — 결혼 흉신 */
function getHongsa(monthZhi: string): string {
  if (['인', '묘', '진'].includes(monthZhi)) return '유';
  if (['사', '오', '미'].includes(monthZhi)) return '사';
  if (['신', '유', '술'].includes(monthZhi)) return '축';
  return '인';
}

/** 연지(띠) → 삼살 지지 그룹 — 일지가 이 그룹에 들면 삼살일 */
function getSamSalGroup(yearZhi: string): string[] {
  // 신자진(申子辰)년 → 巳午未
  if (['신', '자', '진'].includes(yearZhi)) return ['사', '오', '미'];
  // 인오술(寅午戌)년 → 亥子丑
  if (['인', '오', '술'].includes(yearZhi)) return ['해', '자', '축'];
  // 사유축(巳酉丑)년 → 寅卯辰
  if (['사', '유', '축'].includes(yearZhi)) return ['인', '묘', '진'];
  // 해묘미(亥卯未)년 → 申酉戌
  return ['신', '유', '술'];
}

/** lunar-javascript 한자 절기명 → 한글 매핑 (대표 8절기만 결혼 흉신용) */
const JIEQI_HANJA_TO_KOR: Record<string, string> = {
  '立春': '입춘', '立夏': '입하', '立秋': '입추', '立冬': '입동',
  '夏至': '하지', '冬至': '동지', '春分': '춘분', '秋分': '추분',
};

// ============================================
// 메인 판정
// ============================================

/**
 * 행사 카테고리 + 일자 정보로 흉신·길신을 판정.
 * 카테고리별로 적용되는 신살이 차등화되어 있어 한 날짜에 동시에 영향 줄 수 있다.
 */
export function detectSinsal(ctx: SinsalContext): SinsalHit[] {
  const hits: SinsalHit[] = [];
  const {
    lunar, dayGan, dayZhi, dayGz, monthZhi, yearZhi,
    natalDayZhi, natalYearZhi, lunarDay, category, subItem,
  } = ctx;

  // ── 공통 (모든 카테고리) ──

  // 1) 손없는날 — 음력 일자 끝자리 9·0 → 보너스
  const lunarLastDigit = lunarDay % 10;
  if (lunarLastDigit === 9 || lunarLastDigit === 0) {
    hits.push({
      name: '손없는날',
      kind: 'positive',
      delta: 5,
      reason: '손없는날 — 동서남북 손신(損神)이 쉬는 길일',
    });
  }

  // 2) 복단일 — 28수 + 일지 조합 12개
  // lunar-javascript 의 getXiu() 는 한자 1글자 (예: "虛") 반환.
  // d.ts 에 메서드가 빠져 있어 캐스팅으로 호출.
  let xiu = '';
  try {
    xiu = (lunar as unknown as { getXiu: () => string }).getXiu();
  } catch {
    xiu = '';
  }
  const isBokdan = xiu && BOKDAN_MAP[dayZhi] === xiu;
  if (isBokdan) {
    const isCutting = subItem ? CUTTING_SUBITEMS.has(subItem) : false;
    if (isCutting) {
      hits.push({
        name: '복단일',
        hanja: '伏斷日',
        kind: 'positive',
        delta: 8,
        reason: `복단일(${xiu}수+${dayZhi}일) — 끊고 정리하는 일에는 오히려 길`,
      });
    } else {
      hits.push({
        name: '복단일',
        hanja: '伏斷日',
        kind: 'severe',
        delta: -18,
        reason: `복단일(${xiu}수+${dayZhi}일) — 시작·맺음 금기, 흐름이 끊김`,
      });
    }
  }

  // 3) 월기일 — 음력 5·14·23일
  if (lunarDay === 5 || lunarDay === 14 || lunarDay === 23) {
    hits.push({
      name: '월기일',
      hanja: '月忌日',
      kind: 'major',
      delta: -10,
      reason: `월기일(음력 ${lunarDay}일) — 큰 행사 기피`,
    });
  }

  // 4) 십악대패일 — 60갑자 10개
  if (SIPAK_DAEPAE.has(dayGz)) {
    hits.push({
      name: '십악대패일',
      hanja: '十惡大敗日',
      kind: 'severe',
      delta: -15,
      reason: `십악대패일(${dayGz}) — 관운·재운 큰 손실`,
    });
  }

  // 5) 일파 — 본인 일지와 일진 지지의 충
  if (CHUNG_MAP[natalDayZhi] === dayZhi) {
    hits.push({
      name: '일파',
      hanja: '日破',
      kind: 'minor',
      delta: -8,
      reason: `일파(${natalDayZhi}↔${dayZhi}) — 본인 일주를 직접 충함`,
    });
  }

  // 6) 수사일 — 모든 시작 행사에 흉. 단 정리·이별엔 페널티 절반.
  if (SUSA_MAP[monthZhi] === dayZhi) {
    const isCutting = subItem ? CUTTING_SUBITEMS.has(subItem) : false;
    hits.push({
      name: '수사일',
      hanja: '受死日',
      kind: 'major',
      delta: isCutting ? -6 : -12,
      reason: `수사일(${monthZhi}월 ${dayZhi}일) — ${isCutting ? '정리엔 페널티 약함' : '생기 끊기는 흉일'}`,
    });
  }

  // ── bond (혼례·약혼·상견례·고백·재회) ──
  if (category === 'bond') {
    const isWeddingCore = subItem ? WEDDING_SUBITEMS.has(subItem) : false;

    // 7) 홍사일
    if (getHongsa(monthZhi) === dayZhi) {
      hits.push({
        name: '홍사일',
        hanja: '紅紗日',
        kind: 'major',
        delta: -10,
        reason: `홍사일(${monthZhi}월 ${dayZhi}일) — 혼인·약속 깨짐 시그널`,
      });
    }

    // 8) 해불가취일 — 해(亥)일은 혼인 금기
    if (dayZhi === '해' && isWeddingCore) {
      hits.push({
        name: '해불가취일',
        hanja: '亥不嫁娶日',
        kind: 'major',
        delta: -10,
        reason: '해(亥)일 — 전통적으로 혼인 금기',
      });
    }

    // 9) 남녀본명일 — 본인 띠(연지)와 일지 일치 or 충
    if (dayZhi === natalYearZhi) {
      hits.push({
        name: '본명일',
        hanja: '本命日',
        kind: 'minor',
        delta: -8,
        reason: `본명일 — 일진(${dayZhi})이 본인 띠와 같은 날, 혼사엔 주의`,
      });
    } else if (CHUNG_MAP[natalYearZhi] === dayZhi) {
      hits.push({
        name: '본명충일',
        hanja: '本命沖日',
        kind: 'major',
        delta: -10,
        reason: `본명충일 — 일진(${dayZhi})이 본인 띠(${natalYearZhi})와 충`,
      });
    }

    // 10) 절기일 — 입춘·입하·입추·입동·동지·하지·춘분·추분
    if (isWeddingCore) {
      try {
        const jq = (lunar as unknown as { getJieQi: () => string }).getJieQi();
        const korJq = JIEQI_HANJA_TO_KOR[jq] || '';
        if (korJq) {
          hits.push({
            name: `${korJq}일`,
            kind: 'minor',
            delta: -8,
            reason: `${korJq}일 — 기운이 바뀌는 절기, 혼사 기피`,
          });
        }
      } catch {
        // pass
      }
    }
  }

  // ── settle (이사·입주·창업·개업·신축) ──
  if (category === 'settle') {
    // 11) 천화일 — 화재 상징, 입택·이사·신축에 흉
    if (getCheonhwa(monthZhi) === dayZhi) {
      hits.push({
        name: '천화일',
        hanja: '天火日',
        kind: 'major',
        delta: -10,
        reason: `천화일(${monthZhi}월 ${dayZhi}일) — 화재·관재 상징, 입택 기피`,
      });
    }

    // 12) 삼살일 — 그 해 삼살 방위 지지에 일지가 들어가면 흉
    if (getSamSalGroup(yearZhi).includes(dayZhi)) {
      hits.push({
        name: '삼살일',
        hanja: '三煞日',
        kind: 'minor',
        delta: -8,
        reason: `삼살일(${yearZhi}년 ${dayZhi}일) — 큰 행사·이동에 불리`,
      });
    }

    // 13) 토온일 — 신축에만 적용 (토목·건축 흉)
    if (subItem && CONSTRUCTION_SUBITEMS.has(subItem) && getToOn(monthZhi) === dayZhi) {
      hits.push({
        name: '토온일',
        hanja: '土瘟日',
        kind: 'minor',
        delta: -6,
        reason: `토온일(${monthZhi}월 ${dayZhi}일) — 토목·건축에 흉`,
      });
    }

    // 14) 천적일 — 창업·개업에 적용
    if (subItem && BUSINESS_SUBITEMS.has(subItem) && CHEONJEOK_MAP[monthZhi] === dayZhi) {
      hits.push({
        name: '천적일',
        hanja: '天賊日',
        kind: 'major',
        delta: -10,
        reason: `천적일(${monthZhi}월 ${dayZhi}일) — 도난·손실 상징, 개업 기피`,
      });
    }

    // 15) 대모일 — 창업·개업에 적용 (월충일)
    if (subItem && BUSINESS_SUBITEMS.has(subItem) && CHUNG_MAP[monthZhi] === dayZhi) {
      hits.push({
        name: '대모일',
        hanja: '大耗日',
        kind: 'minor',
        delta: -8,
        reason: `대모일(${monthZhi}월 ${dayZhi}일) — 재물 큰 손실 상징`,
      });
    }
  }

  // ── decision (큰 계약·매매·차량·이별·퇴사·관계 정리) ──
  if (category === 'decision') {
    // 삼살일 — 큰 결단에 부정적
    if (getSamSalGroup(yearZhi).includes(dayZhi)) {
      hits.push({
        name: '삼살일',
        hanja: '三煞日',
        kind: 'minor',
        delta: -8,
        reason: `삼살일(${yearZhi}년 ${dayZhi}일) — 큰 결단에 외부 압력`,
      });
    }

    // 대모일 — 매매·계약에 손실 위험
    const isExchange = subItem && (subItem === '매매' || subItem === '큰 계약' || subItem === '차량 구매');
    if (isExchange && CHUNG_MAP[monthZhi] === dayZhi) {
      hits.push({
        name: '대모일',
        hanja: '大耗日',
        kind: 'minor',
        delta: -8,
        reason: `대모일(${monthZhi}월 ${dayZhi}일) — 거래에서 손실 위험`,
      });
    }
  }

  // ── journey (여행·해외 출장·이주·유학·면접·시험) ──
  if (category === 'journey') {
    // 16) 왕망일 — 출행·이동의 가장 큰 흉
    if (getWangmang(monthZhi) === dayZhi) {
      hits.push({
        name: '왕망일',
        hanja: '往亡日',
        kind: 'major',
        delta: -10,
        reason: `왕망일(${monthZhi}월 ${dayZhi}일) — 떠나면 못 돌아온다, 출행 강한 흉`,
      });
    }

    // 17) 귀기일 — 귀가·복귀에 흉
    if (getGwigi(monthZhi) === dayZhi) {
      hits.push({
        name: '귀기일',
        hanja: '歸忌日',
        kind: 'minor',
        delta: -8,
        reason: `귀기일(${monthZhi}월 ${dayZhi}일) — 귀가·복귀 흐름이 막힘`,
      });
    }
  }

  // ── heal (수술·시술·치유) ──
  if (category === 'heal') {
    // 18) 혈기일 — 수술·시술 강한 흉
    if (HYEOLGI_MAP[monthZhi] === dayZhi) {
      hits.push({
        name: '혈기일',
        hanja: '血忌日',
        kind: 'major',
        delta: -12,
        reason: `혈기일(${monthZhi}월 ${dayZhi}일) — 칼·피의 흐름이 강함, 수술 기피`,
      });
    }
  }

  // ── birth (출산·제왕절개) — 삼살은 산모·태아에 부정적 ──
  if (category === 'birth') {
    if (getSamSalGroup(yearZhi).includes(dayZhi)) {
      hits.push({
        name: '삼살일',
        hanja: '三煞日',
        kind: 'minor',
        delta: -8,
        reason: `삼살일(${yearZhi}년 ${dayZhi}일) — 출산 택일에 기피`,
      });
    }
  }

  // 미사용 식별자 lint 회피
  void dayGan;

  return hits;
}

/**
 * 본문 노출용 요약 라인. 빈 배열이면 빈 문자열.
 * 예: "복단일·월기일 — 강한 흉신 / 손없는날 — 길"
 */
export function summarizeSinsal(hits: SinsalHit[]): string {
  if (hits.length === 0) return '';
  const positives = hits.filter(h => h.kind === 'positive').map(h => h.name);
  const severes = hits.filter(h => h.kind === 'severe').map(h => h.name);
  const majors = hits.filter(h => h.kind === 'major').map(h => h.name);
  const minors = hits.filter(h => h.kind === 'minor').map(h => h.name);

  const parts: string[] = [];
  if (severes.length) parts.push(`${severes.join('·')}(강흉)`);
  if (majors.length) parts.push(`${majors.join('·')}(흉)`);
  if (minors.length) parts.push(`${minors.join('·')}(약흉)`);
  if (positives.length) parts.push(`${positives.join('·')}(길)`);
  return parts.join(' / ');
}
