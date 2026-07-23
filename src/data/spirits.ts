/**
 * 10정령(물상 캐릭터) 데이터 — 일간(천간) 기준
 *
 * 오행 5 × 음양 2 = 10종. 이천점 마스터 가이드라인 V 기준.
 * 일간(day.gan, '갑'~'계')으로 조회한다.
 */

export type Ohaeng = '목' | '화' | '토' | '금' | '수';

export interface Spirit {
  ilgan: string; // 천간 한글 '갑'
  ilganHanja: string; // '甲'
  ilganLabel: string; // '갑목 · 거목형'
  name: string; // '루트'
  nameEn: string; // 'Root'
  ohaeng: Ohaeng;
  starType: string; // 오행 별 종류
  traits: string[]; // 핵심 성향
  worldview: string;
  relationship: string;
  quote: string;
  image: string;
}

// 오행 별 종류 (가이드라인 IV-1)
const STAR_TYPE: Record<Ohaeng, string> = {
  수: '흐르는 별',
  화: '타오르는 별',
  목: '성장하는 별',
  금: '단단한 별',
  토: '품는 별',
};

export const SPIRITS: Record<string, Spirit> = {
  갑: {
    ilgan: '갑',
    ilganHanja: '甲',
    ilganLabel: '갑목 · 거목형',
    name: '루트',
    nameEn: 'Root',
    ohaeng: '목',
    starType: STAR_TYPE['목'],
    traits: ['강직함', '진취성', '리더십', '자존심', '책임감'],
    worldview: '우주의 오래된 숲에서, 수많은 별의 흐름을 견디며 자라난 거대한 나무의 기운.',
    relationship: '사람들을 챙기고 이끌지만, 은근히 책임을 혼자 떠안는다.',
    quote:
      '나는 루트! 하늘을 향해 자라는 나무야. 때로는 너무 곧아서 부러질 것 같지만, 그게 내가 살아가는 방식이라고 믿어!',
    image: '/intro/characters/gap.webp?v=4',
  },
  을: {
    ilgan: '을',
    ilganHanja: '乙',
    ilganLabel: '을목 · 덩굴형',
    name: '아이비',
    nameEn: 'Ivy',
    ohaeng: '목',
    starType: STAR_TYPE['목'],
    traits: ['유연함', '적응력', '실속', '끈기', '영민함'],
    worldview: '거목들이 드리운 그늘 아래, 별빛 한 줄기를 좇아 굽이굽이 길을 낸 여린 덩굴의 숨결.',
    relationship: '누구와도 부드럽게 어울리지만, 속내는 끝까지 다 내보이지 않는다.',
    quote:
      '난 아이비라고 하는데. 똑바로 서느니 휘감고 오르는 쪽이 실속 있거든. 안 부러지고 끝끝내 닿고 마는 게 내 방식이지.',
    image: '/intro/characters/eul.webp?v=4',
  },
  병: {
    ilgan: '병',
    ilganHanja: '丙',
    ilganLabel: '병화 · 태양형',
    name: '솔',
    nameEn: 'Sol',
    ohaeng: '화',
    starType: STAR_TYPE['화'],
    traits: ['열정', '공정함', '용기', '활력', '당당함'],
    worldview: '어둠뿐이던 우주 한가운데, 스스로 불붙어 가장 먼저 떠오른 첫 태양의 불꽃.',
    relationship: '어디서든 사람을 끌어모으고 분위기를 밝히지만, 빛이 강한 만큼 곁의 그늘을 놓칠 때가 있다.',
    quote:
      '어이, 난 솔이야. 떠올랐으면 누구든 안 가리고 다 비추는 게 내 일이지. 눈부시다 해도 빛은 안 줄여.',
    image: '/intro/characters/byeong.webp?v=4',
  },
  정: {
    ilgan: '정',
    ilganHanja: '丁',
    ilganLabel: '정화 · 촛불형',
    name: '엠버',
    nameEn: 'Ember',
    ohaeng: '화',
    starType: STAR_TYPE['화'],
    traits: ['섬세함', '집중력', '장인정신', '따뜻함', '외유내강'],
    worldview: '거대한 별들이 사그라든 잿더미 속, 홀로 깜빡이며 밤을 지켜낸 작은 불씨의 온기.',
    relationship:
      '요란하지 않게 곁을 지키다 꼭 필요한 순간에 빛을 내지만, 마음을 깊이 주는 만큼 혼자 속을 태우기 쉽다.',
    quote:
      '헤이 난 엠버야. 크게 못 타올라도 길 잃은 곁은 끝까지 밝혀. 작은 불이라 흔들려도 한번 켠 자린 안 꺼뜨려.',
    image: '/intro/characters/jeong.webp?v=4',
  },
  무: {
    ilgan: '무',
    ilganHanja: '戊',
    ilganLabel: '무토 · 산형',
    name: '테라',
    nameEn: 'Terra',
    ohaeng: '토',
    starType: STAR_TYPE['토'],
    traits: ['포용력', '신뢰감', '우직함', '개척정신', '듬직함'],
    worldview: '흩어진 별먼지가 억겁을 두고 굳고 쌓여, 처음으로 솟아오른 거대한 산.',
    relationship: '말없이 곁을 내주고 기댈 곳이 되어주지만, 한번 정한 건 좀처럼 바꾸지 않아 고집스러워 보인다.',
    quote:
      '그래, 난 테라야... 휩쓸려 다니는 건 못 해… 그냥 여기 서서 다 받아낼 뿐이야… 답답해도, 기댈 데 하나쯤은 안 흔들려야지...',
    image: '/intro/characters/mu.webp?v=4',
  },
  기: {
    ilgan: '기',
    ilganHanja: '己',
    ilganLabel: '기토 · 정원형',
    name: '로움',
    nameEn: 'Loam',
    ohaeng: '토',
    starType: STAR_TYPE['토'],
    traits: ['자애로움', '꼼꼼함', '헌신', '안정감', '세심함'],
    worldview: '산이 부서져 내린 흙이 양지바른 자리에 모여, 무엇이든 품어 길러내는 대지의 손길.',
    relationship: '곁의 사람을 살뜰히 살피고 작은 변화도 놓치지 않지만, 남을 챙기느라 정작 제 마음은 뒤로 미룬다.',
    quote:
      '응, 난 로움이야~ 화려하진 않아도 심은 건 뭐든 살려내는 흙이지. 내 몫은 잊고 남만 키우다가도, 자란 걸 보면 됐다 싶어~',
    image: '/intro/characters/gi.webp?v=4',
  },
  경: {
    ilgan: '경',
    ilganHanja: '庚',
    ilganLabel: '경금 · 강철형',
    name: '아이언',
    nameEn: 'Iron',
    ohaeng: '금',
    starType: STAR_TYPE['금'],
    traits: ['강건함', '의리', '결단력', '정의감', '추진력'],
    worldview: '별과 별이 부딪쳐 깨진 파편이 수없이 두들겨 맞아, 가장 단단하게 벼려진 강철.',
    relationship: '한번 믿은 사람은 끝까지 지키지만, 직설적이고 날이 서 있어 가까운 이가 그 말에 베이기도 한다.',
    quote:
      '난 아이언이다. 두들겨 맞을수록 단단해지는 쇠라, 어설픈 말은 안 한다. 무뚝뚝해도 내 사람 앞을 막는 일엔 안 물러선다.',
    image: '/intro/characters/gyeong.webp?v=4',
  },
  신: {
    ilgan: '신',
    ilganHanja: '辛',
    ilganLabel: '신금 · 보석형',
    name: '젬',
    nameEn: 'Gem',
    ohaeng: '금',
    starType: STAR_TYPE['금'],
    traits: ['예리함', '완벽주의', '섬세함', '자존심', '외유내강'],
    worldview: '땅속 깊은 압력과 오랜 시간이 한 점에 모여, 별빛을 머금고 맺힌 한 알의 보석.',
    relationship:
      '겉은 부드러워도 안엔 또렷한 기준이 있어, 아무에게나 곁을 주지 않고 인정한 사람에게만 진짜 빛을 보인다.',
    quote:
      '음, 난 젬이라고 해. 작아도 빛 한 줄기 허투루 흘리지 않겠어. 까다롭다지만, 함부로 안 빛나는 게 진짜를 지키는 내 방식이야.',
    image: '/intro/characters/sin.webp?v=4',
  },
  임: {
    ilgan: '임',
    ilganHanja: '壬',
    ilganLabel: '임수 · 바다형',
    name: '웨이브',
    nameEn: 'Wave',
    ohaeng: '수',
    starType: STAR_TYPE['수'],
    traits: ['포용력', '지혜로움', '유연함', '적응력', '여유'],
    worldview: '우주의 모든 물줄기가 흐르고 흘러 마지막에 다다른 깊고 넓은 바다.',
    relationship: '있는 그대로 받아주지만, 품이 넓은 만큼 속을 잘 드러내지 않아 정작 무얼 원하는지는 알기 어렵다.',
    quote:
      '안녕, 난 웨이브야. 막히면 안 다투고 돌아가, 다 품으면서 흐르거든. 어디로 갈진 몰라도 그냥 흘러가다 보면 결국 바다에 닿는다는 걸 알고 있거든.',
    image: '/intro/characters/im.webp?v=4',
  },
  계: {
    ilgan: '계',
    ilganHanja: '癸',
    ilganLabel: '계수 · 이슬형',
    name: '듀',
    nameEn: 'Dew',
    ohaeng: '수',
    starType: STAR_TYPE['수'],
    traits: ['직관력', '섬세함', '스며드는 힘', '변화', '통찰'],
    worldview: '밤이 새벽으로 건너가는 찰나, 공기 중에 고요히 맺혀 내려앉은 한 방울 이슬.',
    relationship: '말보다 분위기를 먼저 읽고 조용히 곁에 스미지만, 남의 감정까지 떠안고 가라앉기 쉽다.',
    quote:
      '있지, 난 듀야. 큰 소리는 못 내도 분위기는 누구보다 먼저 읽어. 햇빛에 사라질 듯해도, 내가 적신 자리는 아침까지 남거든.',
    image: '/intro/characters/gye.webp?v=4',
  },
};

// 오행별 카드 테마 색 (globals.css 토큰과 동일 계열)
export const OHAENG_COLOR: Record<Ohaeng, string> = {
  목: 'var(--wood-core)',
  화: 'var(--fire-core)',
  토: 'var(--earth-core)',
  금: 'var(--metal-core)',
  수: 'var(--water-core)',
};
