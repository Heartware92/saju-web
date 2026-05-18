/**
 * 81 수리 길흉표 — 전통 작명학 표준 (쿠마사키 켄오우熊崎健翁 정립, 한국 작명학 채택)
 *
 * 한자 이름의 획수를 4격(원·형·이·정) 으로 합산해 81로 mod, 각 격의 수에 매핑된 길흉으로 판정.
 *
 * 격(格) 의미:
 *  - 원격(元格) = 이름 첫 + 끝 글자 획수 합 → 초년운 (출생~35세)
 *  - 형격(亨格) = 성씨 + 이름 첫 글자 합 → 중년운·주운 (35~55세)
 *  - 이격(利格) = 성씨 + 이름 끝 글자 합 → 사회운·대인관계
 *  - 정격(貞格) = 전체 합 → 평생운·총운
 *
 * 0 으로 떨어지면 81 로 처리 (mod 결과 1~81 보장).
 *
 * 라이센스: 전통 점법 표 — 공유재.
 */

export type SuriGrade = '대길' | '길' | '평' | '흉' | '대흉';

export interface SuriEntry {
  /** 1~81 */
  num: number;
  grade: SuriGrade;
  /** 한자 명칭 (예: "太極之數") */
  name: string;
  /** 한국어 의미 한 줄 */
  meaning: string;
}

export const NUMEROLOGY_81: Record<number, SuriEntry> = {
  1:  { num: 1,  grade: '대길', name: '太極之數', meaning: '만물의 시작 — 강한 의지와 명예·성공' },
  2:  { num: 2,  grade: '대흉', name: '分離之數', meaning: '분리와 고독 — 결단력 부족' },
  3:  { num: 3,  grade: '대길', name: '福德之數', meaning: '명예와 부 — 지도자의 결' },
  4:  { num: 4,  grade: '대흉', name: '破滅之數', meaning: '붕괴와 좌절 — 인내 필요' },
  5:  { num: 5,  grade: '대길', name: '福壽之數', meaning: '부귀·장수 — 만사형통' },
  6:  { num: 6,  grade: '대길', name: '順成之數', meaning: '순조로운 성공 — 화목한 가정' },
  7:  { num: 7,  grade: '대길', name: '剛健之數', meaning: '강직과 성공 — 독립심' },
  8:  { num: 8,  grade: '대길', name: '健勝之數', meaning: '강건한 성취 — 인내로 큰 성공' },
  9:  { num: 9,  grade: '흉',   name: '困窮之數', meaning: '곤궁과 시련 — 보완 필요' },
  10: { num: 10, grade: '대흉', name: '空虛之數', meaning: '공허·실패 — 운기 약함' },
  11: { num: 11, grade: '대길', name: '興旺之數', meaning: '흥왕·번영 — 사람 따름' },
  12: { num: 12, grade: '흉',   name: '薄弱之數', meaning: '박약·고독 — 결단력 부족' },
  13: { num: 13, grade: '대길', name: '智謀之數', meaning: '지혜로 큰 성공 — 학문·기획' },
  14: { num: 14, grade: '흉',   name: '離散之數', meaning: '이별·고립 — 인간관계 주의' },
  15: { num: 15, grade: '대길', name: '福德之數', meaning: '복록·신망 — 만인의 신뢰' },
  16: { num: 16, grade: '대길', name: '厚德之數', meaning: '덕이 두터움 — 자연스러운 인덕' },
  17: { num: 17, grade: '길',   name: '健暢之數', meaning: '강건·소통 — 신념과 추진' },
  18: { num: 18, grade: '길',   name: '發展之數', meaning: '발전과 성취 — 의지 강함' },
  19: { num: 19, grade: '흉',   name: '苦難之數', meaning: '고난·노력 — 끝에 성공' },
  20: { num: 20, grade: '대흉', name: '空虛之數', meaning: '공허·재난 — 보완 필수' },
  21: { num: 21, grade: '대길', name: '自立之數', meaning: '자립·리더 — 독립적 성공' },
  22: { num: 22, grade: '흉',   name: '中折之數', meaning: '중도 좌절 — 끈기 부족' },
  23: { num: 23, grade: '대길', name: '攻名之數', meaning: '명성을 이룸 — 명예와 권위' },
  24: { num: 24, grade: '대길', name: '立身之數', meaning: '입신양명 — 노력의 결실' },
  25: { num: 25, grade: '길',   name: '安康之數', meaning: '안강과 재능 — 개성으로 성공' },
  26: { num: 26, grade: '흉',   name: '變怪之數', meaning: '변괴·기복 — 큰 풍파' },
  27: { num: 27, grade: '흉',   name: '中折之數', meaning: '중도 좌절 — 후반 보완 필요' },
  28: { num: 28, grade: '흉',   name: '波亂之數', meaning: '파란·풍파 — 가정 불안' },
  29: { num: 29, grade: '길',   name: '智謀之數', meaning: '지혜·성공 — 욕심 절제 필요' },
  30: { num: 30, grade: '평',   name: '不安之數', meaning: '불안·길흉 양면 — 분별 필요' },
  31: { num: 31, grade: '대길', name: '興家之數', meaning: '가문 번영 — 큰 그릇' },
  32: { num: 32, grade: '대길', name: '僥倖之數', meaning: '행운·귀인 도움' },
  33: { num: 33, grade: '대길', name: '升天之數', meaning: '승천·대성공 — 최길수 중 하나' },
  34: { num: 34, grade: '대흉', name: '變亂之數', meaning: '변란·재난 — 보완 필수' },
  35: { num: 35, grade: '길',   name: '平和之數', meaning: '평화·온화 — 문예 적성' },
  36: { num: 36, grade: '흉',   name: '義俠之數', meaning: '의협심 — 자기희생 위험' },
  37: { num: 37, grade: '대길', name: '忠實之數', meaning: '충실·신뢰 — 독립적 성공' },
  38: { num: 38, grade: '평',   name: '福壽之數', meaning: '안락·창의 — 문예' },
  39: { num: 39, grade: '대길', name: '安樂之數', meaning: '부귀·영화' },
  40: { num: 40, grade: '흉',   name: '退場之數', meaning: '퇴장·고독 — 과욕 금물' },
  41: { num: 41, grade: '대길', name: '高名之數', meaning: '명성·권위' },
  42: { num: 42, grade: '평',   name: '困境之數', meaning: '곤경·고집 — 결단 필요' },
  43: { num: 43, grade: '흉',   name: '散財之數', meaning: '재산 흩어짐 — 욕심 절제' },
  44: { num: 44, grade: '흉',   name: '滅亡之數', meaning: '쇠퇴·파괴 — 큰 보완 필요' },
  45: { num: 45, grade: '대길', name: '大智之數', meaning: '큰 지혜·통찰' },
  46: { num: 46, grade: '흉',   name: '困苦之數', meaning: '곤고·시련' },
  47: { num: 47, grade: '대길', name: '出世之數', meaning: '출세·번영' },
  48: { num: 48, grade: '대길', name: '智謀之數', meaning: '지혜·고문역' },
  49: { num: 49, grade: '평',   name: '變動之數', meaning: '변동·길흉 양면' },
  50: { num: 50, grade: '흉',   name: '不時之數', meaning: '일시적 성공 → 쇠퇴' },
  51: { num: 51, grade: '평',   name: '浮沈之數', meaning: '부침 — 전반 길 후반 흉' },
  52: { num: 52, grade: '길',   name: '達晚之數', meaning: '만성·후발 — 끈기로 성공' },
  53: { num: 53, grade: '흉',   name: '內憂之數', meaning: '내우외환 — 표면만 길' },
  54: { num: 54, grade: '대흉', name: '多難之數', meaning: '다난·재난' },
  55: { num: 55, grade: '평',   name: '善惡之數', meaning: '선악 양면 — 분별 필요' },
  56: { num: 56, grade: '흉',   name: '損失之數', meaning: '손실·노력 부족' },
  57: { num: 57, grade: '길',   name: '努力之數', meaning: '노력으로 성공' },
  58: { num: 58, grade: '흉',   name: '災難之數', meaning: '재난 후 회복 — 인내' },
  59: { num: 59, grade: '대흉', name: '出財之數', meaning: '재산 출진·실패' },
  60: { num: 60, grade: '흉',   name: '動搖之數', meaning: '동요·불안' },
  61: { num: 61, grade: '길',   name: '名利之數', meaning: '명예와 이익' },
  62: { num: 62, grade: '흉',   name: '衰退之數', meaning: '쇠퇴·고독' },
  63: { num: 63, grade: '대길', name: '富榮之數', meaning: '부영·자손번성' },
  64: { num: 64, grade: '흉',   name: '沈淪之數', meaning: '침륜·고독' },
  65: { num: 65, grade: '대길', name: '富貴之數', meaning: '부귀·장수' },
  66: { num: 66, grade: '흉',   name: '內外之數', meaning: '내외 분란 — 보완 필요' },
  67: { num: 67, grade: '대길', name: '通達之數', meaning: '통달·만사형통' },
  68: { num: 68, grade: '길',   name: '智謀之數', meaning: '지혜·인내' },
  69: { num: 69, grade: '흉',   name: '衰敗之數', meaning: '쇠패·심신피로' },
  70: { num: 70, grade: '대흉', name: '滅亡之數', meaning: '멸망·고독' },
  71: { num: 71, grade: '평',   name: '健全之數', meaning: '건전 — 끈기로 보완' },
  72: { num: 72, grade: '흉',   name: '後困之數', meaning: '후환·말년 곤란' },
  73: { num: 73, grade: '평',   name: '平凡之數', meaning: '평범·안락' },
  74: { num: 74, grade: '흉',   name: '寂寞之數', meaning: '적막·고독' },
  75: { num: 75, grade: '길',   name: '旺成之數', meaning: '왕성·근면 성공' },
  76: { num: 76, grade: '흉',   name: '離散之數', meaning: '이산·내우외환' },
  77: { num: 77, grade: '평',   name: '內外之數', meaning: '전반 길 후반 약' },
  78: { num: 78, grade: '평',   name: '平凡之數', meaning: '평범·만성' },
  79: { num: 79, grade: '흉',   name: '終末之數', meaning: '종말·기력 쇠퇴' },
  80: { num: 80, grade: '흉',   name: '終末之數', meaning: '종말·고독' },
  81: { num: 81, grade: '대길', name: '還元之數', meaning: '재출발 — 최길수, 1과 동격' },
};

/**
 * 합산 수를 81 범위로 정규화 (81 초과면 -81 반복, 0 이면 81 로).
 */
export function normalize81(n: number): number {
  if (n <= 0) return 81;
  if (n <= 81) return n;
  const mod = n % 81;
  return mod === 0 ? 81 : mod;
}

/**
 * 수에 매핑된 길흉 엔트리 반환.
 */
export function lookupSuri(n: number): SuriEntry {
  return NUMEROLOGY_81[normalize81(n)];
}
