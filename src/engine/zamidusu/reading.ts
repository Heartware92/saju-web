/**
 * 자미두수 무료 명반 풀이 합성기
 *
 * iztro 로 계산된 명반과 knowledge.ts 의 별·궁 해설을 결합해
 * AI 없이 완성도 있는 명리 풀이 텍스트를 구성한다.
 */

import type { ZamidusuResult, ZamidusuPalace } from '../zamidusu';
import {
  MAJOR_STARS_META,
  MINOR_STARS_META,
  MUTAGEN_META,
  PALACE_ROLE_META,
  type FengShenCharacter,
  type GekkukMeta,
} from './knowledge';
import { detectGekkuk } from './gekkuk';

export interface StarDetail {
  name: string;
  hanja: string;
  keywords: string[];
  theme: string;
  mutagen?: { name: string; hanja: string; effect: string };
}

export interface PalaceReading {
  index: number;
  name: string;
  role?: string;           // 주관 영역
  ganZhi: string;
  majorStars: StarDetail[];
  minorStars: { name: string; effect: string; category: '6길성' | '6살성' | '잡성' | '기타' }[];
  summary: string;         // 한 문장 요약
}

/**
 * 봉신연의 캐릭터 카드 — 명궁/주요 궁 주성의 의인화 정보.
 * UI에서 캐릭터 서사 카드로 노출.
 */
export interface CharacterCard {
  palace: string;
  starName: string;
  character: FengShenCharacter;
}

/**
 * 영역별 풀이 묶음 — 청월당 7장 구조 벤치마크.
 * 12궁을 사용자 의사결정 영역(재물·직업·연애·건강·대인관계)으로
 * 재포장해서 사용자가 자기 관심 영역만 빠르게 볼 수 있도록 한다.
 */
export interface DomainBundle {
  /** 영역 식별자 */
  id: 'overview' | 'wealth' | 'career' | 'love' | 'health' | 'relations' | 'timing';
  /** 영역 표시 라벨 */
  title: string;
  /** 영역 부제/한 줄 설명 */
  subtitle: string;
  /** 영역에 포함되는 12궁 풀이들 (timing 영역은 비어있음) */
  palaces: PalaceReading[];
  /** 영역에서 자동 도출된 인사이트 (사화·살성·회조 기반) */
  insights: string[];
}

export interface ZamidusuReading {
  profileHeadline: string;           // "제왕의 상 · 자미 + 좌보 보좌"
  coreStars: StarDetail[];           // 명궁의 주성
  helperStars: { name: string; effect: string }[];  // 명궁의 6길성
  mutagens: { type: string; star: string; palace: string; effect: string; positive: string; caution: string }[];
  /** 격국 — detectGekkuk으로 자동 판정된 명반의 격국 (여러 개 가능) */
  gekkuks: GekkukMeta[];
  /** 봉신연의 캐릭터 카드 — 명궁 주성 위주, 영역별 주요 궁 주성도 포함 */
  characterCards: CharacterCard[];
  domainSummaries: { palace: string; text: string }[]; // 주요 궁 요약
  /** 영역별 풀이 묶음 — 청월당식 7장 구조 (overview·wealth·career·love·health·relations·timing) */
  domainBundles: DomainBundle[];
  advice: string[];
  warnings: string[];
  palaceReadings: PalaceReading[];
}

const KEY_PALACES = ['명궁', '재백궁', '관록궁', '부처궁', '천이궁', '복덕궁'];

/**
 * 영역(domain) → 12궁 매핑.
 * 청월당 7장 구조와 동일. 자녀궁은 직업의 부하·후배·창작물,
 * 전택궁은 재물의 자산·부동산으로 현대적 재해석.
 */
const DOMAIN_PALACE_MAP: Record<DomainBundle['id'], { title: string; subtitle: string; palaces: string[] }> = {
  overview: { title: '명반 분석', subtitle: '나의 본질·격국·14주성 캐릭터', palaces: ['명궁'] },
  wealth:   { title: '재물운',   subtitle: '돈을 다루는 성향과 자산 흐름',  palaces: ['재백궁', '전택궁'] },
  career:   { title: '직업운',   subtitle: '일하는 방식과 커리어 방향',     palaces: ['관록궁', '자녀궁'] },
  love:     { title: '연애운',   subtitle: '배우자·연인과의 관계',           palaces: ['부처궁'] },
  health:   { title: '건강운',   subtitle: '몸·마음의 강약과 위험 시기',    palaces: ['복덕궁', '질액궁'] },
  relations:{ title: '대인관계운', subtitle: '가족·친구·동료와의 관계',     palaces: ['형제궁', '천이궁', '노복궁', '부모궁'] },
  timing:   { title: '운흐름',    subtitle: '대한·유년·유월의 시기 예측',  palaces: [] },
};

function starsToDetails(stars: ZamidusuPalace['majorStars']): StarDetail[] {
  return stars
    .map(s => {
      const meta = MAJOR_STARS_META[s.name];
      if (!meta) return null;
      const mutagen = s.mutagen ? MUTAGEN_META[s.mutagen] : undefined;
      return {
        name: meta.name,
        hanja: meta.hanja,
        keywords: meta.keywords,
        theme: meta.theme,
        mutagen: mutagen
          ? { name: mutagen.name, hanja: mutagen.hanja, effect: mutagen.effect }
          : undefined,
      } as StarDetail;
    })
    .filter((x): x is StarDetail => !!x);
}

function buildPalaceSummary(p: ZamidusuPalace, coreStars: StarDetail[]): string {
  const role = PALACE_ROLE_META[p.name];
  if (coreStars.length === 0) {
    return role
      ? `${p.name}은 공궁이지만 대궁(對宮) 영향을 강하게 받는다. ${role.domain}에서는 대조되는 궁의 기운이 주도권을 쥔다.`
      : '공궁 — 대궁의 영향이 커진다.';
  }
  const names = coreStars.map(s => s.name).join('·');
  const kw = coreStars.flatMap(s => s.keywords).slice(0, 4);
  const mutagenNote = coreStars.find(s => s.mutagen)?.mutagen;
  const mutagenText = mutagenNote ? ` · ${mutagenNote.name}: ${mutagenNote.effect}` : '';
  const domain = role?.domain ?? p.name;
  return `${names}이(가) 좌한 ${p.name}. ${domain}에 ${kw.join('·')}의 기운이 작동한다.${mutagenText}`;
}

export function buildZamidusuReading(chart: ZamidusuResult): ZamidusuReading {
  const myeong = chart.palaces.find(p => p.name === '명궁');
  const coreStars = myeong ? starsToDetails(myeong.majorStars) : [];
  const helperStars = myeong
    ? myeong.minorStars
        .map(s => {
          const m = MINOR_STARS_META[s.name];
          return m && m.category === '6길성' ? { name: m.name, effect: m.effect } : null;
        })
        .filter((x): x is { name: string; effect: string } => !!x)
    : [];

  // 헤드라인 합성
  const coreNames = coreStars.map(s => s.name).join(' · ') || '공궁';
  const helpers = helperStars.map(h => h.name).join(',');
  const profileHeadline = helpers
    ? `명궁에 ${coreNames} 좌한 구조 — 6길성 ${helpers} 보좌`
    : `명궁에 ${coreNames} 좌한 구조`;

  // 사화(mutagen) 전체 수집
  const mutagens: ZamidusuReading['mutagens'] = [];
  chart.palaces.forEach(p => {
    p.majorStars.forEach(s => {
      if (s.mutagen) {
        const m = MUTAGEN_META[s.mutagen];
        if (m) {
          mutagens.push({
            type: s.mutagen,
            star: s.name,
            palace: p.name,
            effect: m.effect,
            positive: m.positive,
            caution: m.caution,
          });
        }
      }
    });
  });

  // 주요 궁 요약
  const domainSummaries = KEY_PALACES.map(name => {
    const p = chart.palaces.find(x => x.name === name);
    if (!p) return null;
    const stars = starsToDetails(p.majorStars);
    return { palace: name, text: buildPalaceSummary(p, stars) };
  }).filter((x): x is { palace: string; text: string } => !!x);

  // 전체 12궁 상세
  const palaceReadings: PalaceReading[] = chart.palaces.map(p => {
    const stars = starsToDetails(p.majorStars);
    const minor: { name: string; effect: string; category: '6길성' | '6살성' | '잡성' | '기타' }[] = [];
    p.minorStars.forEach(s => {
      const m = MINOR_STARS_META[s.name];
      if (m) minor.push({ name: m.name, effect: m.effect, category: m.category });
    });
    // 잡성(adjectiveStars) 통합 — 음살·천형·홍란·천희·고진·과숙 등 ~30종
    (p.adjectiveStars || []).forEach(s => {
      const m = MINOR_STARS_META[s.name];
      if (m) minor.push({ name: m.name, effect: m.effect, category: m.category });
    });
    return {
      index: p.index,
      name: p.name,
      role: PALACE_ROLE_META[p.name]?.domain,
      ganZhi: `${p.heavenlyStem}${p.earthlyBranch}`,
      majorStars: stars,
      minorStars: minor,
      summary: buildPalaceSummary(p, stars),
    };
  });

  // 조언·주의
  const advice: string[] = [];
  const warnings: string[] = [];
  const hasSunPolar = coreStars.some(s => s.name === '자미' || s.name === '태양');
  const hasMoney = coreStars.some(s => ['무곡', '천부', '태음'].includes(s.name));
  const hasRebel = coreStars.some(s => ['칠살', '파군', '탐랑'].includes(s.name));
  if (hasSunPolar) advice.push('리더·대표 위치에서 기량을 펼치기 좋음 — 책임 회피 금물');
  if (hasMoney) advice.push('재무·자산 관리 직무에서 특히 빛남 — 부업·투자 공부');
  if (hasRebel) advice.push('개척·창업·변혁 분야 적성 — 조직보다 개인 역량으로 승부');
  if (helperStars.length >= 2) advice.push('귀인·보좌의 복이 있음 — 인맥 관리에 투자');

  mutagens.forEach(m => {
    if (m.type === '화기') warnings.push(`${m.palace}의 화기(${m.star}) — ${m.caution}`);
    if (m.type === '화록' && m.palace === '재백궁') advice.push('재백궁 화록 — 재물운 탁월, 기회 적극 활용');
    if (m.type === '화권' && m.palace === '관록궁') advice.push('관록궁 화권 — 승진·권한 확대의 기운');
  });

  if (warnings.length === 0) warnings.push('특별한 사화기 위협 없음 — 평소의 리듬 유지');
  if (advice.length === 0) advice.push('균형 잡힌 명반 — 여러 분야에서 무난한 성취');

  // 격국 자동 판정
  const gekkuks = detectGekkuk(chart);

  // 봉신연의 캐릭터 카드 — 명궁 주성 + 신궁(다르면) 주성 + 영역별 핵심 궁 주성
  const characterCards: CharacterCard[] = [];
  const addedKeys = new Set<string>(); // 중복 방지 (같은 별이 여러 궁에 등장 시 한 번만)
  const collectCardsFromPalace = (palaceName: string) => {
    const p = chart.palaces.find((x) => x.name === palaceName);
    if (!p) return;
    p.majorStars.forEach((s) => {
      const meta = MAJOR_STARS_META[s.name];
      if (!meta || !meta.fenshen) return;
      if (addedKeys.has(s.name)) return;
      addedKeys.add(s.name);
      characterCards.push({ palace: palaceName, starName: s.name, character: meta.fenshen });
    });
  };
  // 우선순위: 명궁 → 신궁(다른 궁이면) → 재백·관록·부처
  collectCardsFromPalace('명궁');
  const sinPalace = chart.palaces.find((p) => p.isBodyPalace);
  if (sinPalace && sinPalace.name !== '명궁') collectCardsFromPalace(sinPalace.name);
  ['재백궁', '관록궁', '부처궁'].forEach(collectCardsFromPalace);

  // 영역별 풀이 묶음 — 청월당 7장 구조
  const palaceReadingByName = new Map(palaceReadings.map((pr) => [pr.name, pr]));
  const domainBundles: DomainBundle[] = (Object.entries(DOMAIN_PALACE_MAP) as [DomainBundle['id'], typeof DOMAIN_PALACE_MAP['overview']][])
    .map(([id, conf]) => {
      const palaces = conf.palaces
        .map((name) => palaceReadingByName.get(name))
        .filter((x): x is PalaceReading => !!x);

      // 영역별 인사이트 — 해당 궁에 들어선 사화 + 살성 회조 자동 도출
      const insights: string[] = [];
      palaces.forEach((pr) => {
        const muHits = mutagens.filter((m) => m.palace === pr.name);
        muHits.forEach((m) => {
          insights.push(`${pr.name}의 ${m.type}(${m.star}) — ${m.effect}`);
        });
        const sals = pr.minorStars.filter((s) => s.category === '6살성');
        if (sals.length > 0) {
          insights.push(`${pr.name}에 6살성 ${sals.map((s) => s.name).join('·')} — 변동·갈등 주의`);
        }
        const gils = pr.minorStars.filter((s) => s.category === '6길성');
        if (gils.length >= 2) {
          insights.push(`${pr.name}에 6길성 ${gils.slice(0, 3).map((s) => s.name).join('·')} 회조 — 귀인의 도움`);
        }
        const japs = pr.minorStars.filter((s) => s.category === '잡성');
        if (japs.length > 0) {
          insights.push(`${pr.name}에 잡성 ${japs.slice(0, 3).map((s) => s.name).join('·')} — 미세 변수`);
        }
      });

      // overview에는 격국 인사이트 추가
      if (id === 'overview' && gekkuks.length > 0) {
        gekkuks.slice(0, 2).forEach((g) => {
          insights.push(`${g.name}(${g.hanja}) — ${g.description}`);
        });
      }

      return {
        id,
        title: conf.title,
        subtitle: conf.subtitle,
        palaces,
        insights,
      };
    });

  return {
    profileHeadline,
    coreStars,
    helperStars,
    mutagens,
    gekkuks,
    characterCards,
    domainSummaries,
    domainBundles,
    advice,
    warnings,
    palaceReadings,
  };
}
