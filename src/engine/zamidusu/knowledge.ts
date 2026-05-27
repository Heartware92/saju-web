/**
 * 자미두수(紫微斗數) 지식 베이스 — 불변 상수
 *
 * 14주성, 주요 보좌성, 사화(四化), 12궁 각각의 전통 해석을
 * 구조화된 자료로 고정한다. 프롬프트 생성 시 명반에 실제로 등장한
 * 엔트리만 뽑아 AI에 주입하여, AI가 "어떤 별이 어떤 뜻인지"를
 * 창작하지 않도록 한다.
 *
 * 출처: 자미두수 전통 개론 + iztro 공식 한국어 로케일 용어
 */

// ============================================
// 14 主星 (주성)
// ============================================

/**
 * 봉신연의(封神演義) 캐릭터 매칭 — 14주성 의인화
 *
 * 자미두수 14주성을 봉신연의 인물에 매칭해 별의 추상 성정을
 * 사용자에게 친숙한 서사로 전달한다. 매칭은 한국 자미두수
 * 입문서·포스텔러 라인 등 일반적 분류를 따른다.
 *
 * 학파/저자에 따라 일부 인물 매칭은 다를 수 있다 (예: 강태공을
 * 천기/무곡 두 별에 분리 매칭하는 학파도 있음). 본 매칭은
 * "한 별 = 한 인물" 단일 매칭 원칙으로, 별의 핵심 면모를 가장
 * 잘 보여주는 인물을 선택했다.
 */
export interface FengShenCharacter {
  name: string;        // 한글 이름 — '백읍고', '강자아' ...
  hanja: string;       // 한자 — '伯邑考', '姜子牙' ...
  role: string;        // 봉신연의 내 역할 한 줄
  anecdote: string;    // 핵심 일화 1-2 문장
  trait: string;       // 별과 매칭되는 캐릭터 정수 키워드
}

export interface MajorStarMeta {
  name: string;           // '자미', '천기' ...
  hanja: string;
  group: '북두' | '남두' | '중천';
  element: string;        // 오행
  polarity: '선' | '중' | '부'; // 길흉 경향 (선=길성계열, 부=흉성계열, 중=중성)
  keywords: string[];     // 3~5개 키워드
  strength: string;       // 강점
  weakness: string;       // 약점
  theme: string;          // 한 줄 테마
  fenshen: FengShenCharacter; // 봉신연의 캐릭터 매칭
}

export const MAJOR_STARS_META: Record<string, MajorStarMeta> = {
  자미: {
    name: '자미', hanja: '紫微', group: '북두', element: '土', polarity: '선',
    keywords: ['제왕', '리더십', '권위', '통솔', '체면'],
    strength: '타고난 품격과 통솔력. 조직의 중심이 되기 쉬움.',
    weakness: '주변의 보좌성이 부족하면 고독하고 독선적이기 쉬움.',
    theme: '왕좌에 앉은 사람 — 보좌가 있어야 진짜 왕이 된다.',
    fenshen: {
      name: '백읍고', hanja: '伯邑考', role: '주문왕의 장자',
      anecdote: '부친 주문왕을 구하러 상나라 궁궐에 갔다가 폭군 주왕에게 살해되어 자미 별이 됨. 효성과 고귀한 인품의 상징.',
      trait: '황제격·고귀·희생·인덕',
    },
  },
  천기: {
    name: '천기', hanja: '天機', group: '남두', element: '木', polarity: '선',
    keywords: ['지혜', '기획', '분석', '변화', '참모'],
    strength: '머리 회전이 빠르고 전략 수립에 능함. 기획·자문 계열 강점.',
    weakness: '생각이 많아 실행이 늦고, 신경이 예민함.',
    theme: '지혜의 별 — 생각은 많지만 결단이 필요하다.',
    fenshen: {
      name: '강자아', hanja: '姜子牙', role: '주문왕의 군사 (강태공·태공망)',
      anecdote: '노년에 위수(渭水)에서 곧은 낚시를 하다 문왕에게 발탁된 모사·전략가. 봉신방을 만들고 주나라 승리를 이끔.',
      trait: '노년 지혜·모사·기획·전략',
    },
  },
  태양: {
    name: '태양', hanja: '太陽', group: '중천', element: '火', polarity: '선',
    keywords: ['명예', '공익', '아버지', '빛', '적극'],
    strength: '외향적이고 공정하며 공적인 일에서 빛남. 남성적 에너지.',
    weakness: '과로와 간섭이 심해지면 번아웃. 야생(夜生)은 힘이 약함.',
    theme: '태양 — 밝게 비추지만 쉬어야 오래 빛난다.',
    fenshen: {
      name: '비간', hanja: '比干', role: '주왕의 숙부, 충신',
      anecdote: '주왕에게 직언으로 충간하다 "성인의 심장은 일곱 구멍이 있다"는 트집으로 심장이 도려내져 죽음. 죽어서 태양 별이 됨.',
      trait: '충직·광명·헌신·공정',
    },
  },
  무곡: {
    name: '무곡', hanja: '武曲', group: '북두', element: '金', polarity: '선',
    keywords: ['재물', '결단', '금속', '군인', '실천'],
    strength: '추진력과 재물 관리 능력. 금융·재무·기술직 적합.',
    weakness: '딱딱하고 정이 적어 인간관계가 경직됨.',
    theme: '장수의 별 — 재물과 결단, 그러나 따뜻함이 부족.',
    fenshen: {
      name: '주무왕', hanja: '周武王', role: '주나라 건국 군주',
      anecdote: '부친 문왕의 뜻을 이어받아 강자아와 함께 상나라 폭군 주왕을 정벌하고 주나라를 세움. 결단력과 무재(武才)의 화신.',
      trait: '결단·추진·왕도·실천',
    },
  },
  천동: {
    name: '천동', hanja: '天同', group: '남두', element: '水', polarity: '선',
    keywords: ['복록', '온화', '향유', '안주', '복성'],
    strength: '성품이 유순하고 복을 타고남. 서비스·문화·예술 친화.',
    weakness: '게으름과 무기력에 빠지기 쉬움. 도전 정신 부족.',
    theme: '복의 별 — 편안함에 안주하지 말 것.',
    fenshen: {
      name: '주문왕', hanja: '周文王', role: '주나라 시조',
      anecdote: '어진 왕으로 칭송받자 위협을 느낀 주왕에게 옥에 갇힘. 아들 백읍고의 살을 모르고 먹어야 했음에도 인내해 풀려나 주나라 기틀을 세움.',
      trait: '복신·관후·인내·온화',
    },
  },
  염정: {
    name: '염정', hanja: '廉貞', group: '북두', element: '火', polarity: '중',
    keywords: ['감정', '예술', '집착', '매력', '도화'],
    strength: '감성이 풍부하고 매력적. 예술·기획·마케팅 유리.',
    weakness: '감정 기복과 집착. 법·규율과 얽히기 쉬움.',
    theme: '이중성의 별 — 매혹적이지만 자제가 필요.',
    fenshen: {
      name: '비중', hanja: '費仲', role: '주왕의 간신',
      anecdote: '달기와 결탁해 충신을 모해하고 주왕의 폭정을 부추긴 간신. 매력과 계략으로 권력을 휘둘렀으나 결국 멸망.',
      trait: '도화·계략·매력·집착',
    },
  },
  천부: {
    name: '천부', hanja: '天府', group: '남두', element: '土', polarity: '선',
    keywords: ['저장', '안정', '재물', '관리', '중후'],
    strength: '재물·자산 관리에 능하고 인내심이 강함. 부의 창고.',
    weakness: '변화 적응이 느리고 보수적. 기회를 놓치기도.',
    theme: '창고의 별 — 쌓고 지키는 힘.',
    fenshen: {
      name: '강황후', hanja: '姜皇后', role: '주왕의 정실 황후',
      anecdote: '단정·절개의 여인. 달기의 모함으로 두 눈이 도려내지고 두 손이 잘리는 형벌을 받고 죽음. 후궁들의 모범이자 재고(財庫)의 상징.',
      trait: '정실·재고·풍요·중후',
    },
  },
  태음: {
    name: '태음', hanja: '太陰', group: '중천', element: '水', polarity: '선',
    keywords: ['감성', '어머니', '재물(잠재)', '섬세', '야음'],
    strength: '세심하고 감성적이며 저축력이 강함. 밤에 빛남.',
    weakness: '주야 비교에 따라 강약 편차. 감정에 휘둘림.',
    theme: '달의 별 — 고요한 힘, 밤에 피어나는 재물.',
    fenshen: {
      name: '가 부인', hanja: '賈夫人', role: '황비호의 정실',
      anecdote: '달기의 초대로 입궁했다가 주왕이 희롱·겁탈하려 하자 누각에서 몸을 던져 자결. 남편 황비호의 상나라 배반과 멸망의 단초.',
      trait: '절개·달·섬세·결백',
    },
  },
  탐랑: {
    name: '탐랑', hanja: '貪狼', group: '북두', element: '木', polarity: '중',
    keywords: ['욕망', '도화', '다재', '사교', '변화'],
    strength: '다재다능, 사교적, 예술·유흥·영업에 강점.',
    weakness: '욕심과 유혹에 약하고 집중 지속이 어려움.',
    theme: '욕망의 별 — 무엇을 원하는가에 따라 천사도 악마도 된다.',
    fenshen: {
      name: '달기', hanja: '妲己', role: '주왕의 후궁 (구미호의 화신)',
      anecdote: '본디 구미호가 미녀의 몸을 빌려 주왕을 홀려 상나라를 멸망으로 이끔. 절세 미모와 끝없는 욕망·유혹의 화신.',
      trait: '도화·욕망·유혹·매력',
    },
  },
  거문: {
    name: '거문', hanja: '巨門', group: '북두', element: '水', polarity: '부',
    keywords: ['언변', '의심', '논쟁', '전문성', '시비'],
    strength: '언어·논리·연구에 탁월. 법조·교육·언론 유리.',
    weakness: '말로 인한 시비와 구설. 인간관계 갈등.',
    theme: '말의 별 — 칼이 될 수도, 약이 될 수도.',
    fenshen: {
      name: '마천금', hanja: '馬千金', role: '강자아의 아내',
      anecdote: '노인이 될 때까지 출세 못 한 강자아를 떠났다가, 그가 주나라 재상이 되자 돌아왔으나 거절당해 치욕에 자결. 의심과 후회의 상징.',
      trait: '논쟁·의심·자기표현·후회',
    },
  },
  천상: {
    name: '천상', hanja: '天相', group: '남두', element: '水', polarity: '선',
    keywords: ['보좌', '의리', '충성', '공정', '봉사'],
    strength: '인정 많고 공정하며 조력자 역할에 탁월.',
    weakness: '주체성이 약해져 남의 일에 끌려다닐 수 있음.',
    theme: '재상의 별 — 보좌할 때 빛난다.',
    fenshen: {
      name: '문중', hanja: '聞仲', role: '주왕의 태사(太師)',
      anecdote: '주왕에게 충간하며 상나라를 끝까지 보위하려 한 충직한 재상. 폭군을 섬기는 비극을 안고도 임무를 다함.',
      trait: '보좌·충성·공정·중재',
    },
  },
  천량: {
    name: '천량', hanja: '天梁', group: '남두', element: '土', polarity: '선',
    keywords: ['원로', '구제', '청렴', '고독', '장수'],
    strength: '정직·청렴하고 어려움 속에서 버팀. 의료·상담·교육 적합.',
    weakness: '고집과 고독. 젊어서는 고생이 따르기 쉬움.',
    theme: '음덕의 별 — 위기에서 빛나는 원로.',
    fenshen: {
      name: '이정', hanja: '李靖', role: '탁탑이천왕(托塔李天王)',
      anecdote: '도력과 위엄을 갖춘 노대신·신선. 자비와 청렴으로 사람들을 구제하며 정의를 지킴. 후에 옥황상제 휘하 사대천왕이 됨.',
      trait: '원로·자비·구제·수호',
    },
  },
  칠살: {
    name: '칠살', hanja: '七殺', group: '남두', element: '金', polarity: '부',
    keywords: ['돌파', '장수', '개척', '고독', '위엄'],
    strength: '강한 추진력과 개척 정신. 창업·군·경찰 적합.',
    weakness: '독단과 충돌. 인간관계 마찰.',
    theme: '장군의 별 — 홀로 나아가는 용기.',
    fenshen: {
      name: '황비호', hanja: '黃飛虎', role: '상나라 대장군',
      anecdote: '아내 가 부인의 자결을 계기로 상나라를 배반하고 주나라에 합류. 무용(武勇)과 기개로 상나라 정벌의 선봉이 됨.',
      trait: '장수·기개·돌파·변혁',
    },
  },
  파군: {
    name: '파군', hanja: '破軍', group: '북두', element: '水', polarity: '부',
    keywords: ['파괴', '개혁', '변혁', '모험', '선봉'],
    strength: '낡은 틀을 깨는 변혁력. 혁신·창업·변화 산업에서 빛남.',
    weakness: '파괴 후 재건 없는 경우 상처만 남음. 기복 큼.',
    theme: '선봉의 별 — 부수고 새로 짓는다.',
    fenshen: {
      name: '주왕', hanja: '紂王', role: '상나라 마지막 임금',
      anecdote: '본디 명민하고 무력 강한 군주였으나 달기에게 빠져 폭정을 일삼다 상나라 멸망. 낡은 시대를 끝내는 파괴의 화신.',
      trait: '파괴·변혁·기복·선봉',
    },
  },
};

// ============================================
// 주요 보좌성(輔星·佐星) — 6길성 + 4흉성
// ============================================

export interface MinorStarMeta {
  name: string;
  hanja: string;
  category: '6길성' | '4흉성' | '기타';
  effect: string;
}

export const MINOR_STARS_META: Record<string, MinorStarMeta> = {
  좌보: { name: '좌보', hanja: '左輔', category: '6길성', effect: '좌우 보좌 — 귀인·조력자, 리더를 돕는 힘.' },
  우필: { name: '우필', hanja: '右弼', category: '6길성', effect: '실질적 지원 — 협력자·파트너 복.' },
  문창: { name: '문창', hanja: '文昌', category: '6길성', effect: '학문·문서·시험운. 글·계약·발표 유리.' },
  문곡: { name: '문곡', hanja: '文曲', category: '6길성', effect: '예술·감성·언변. 표현력과 매력.' },
  천괴: { name: '천괴', hanja: '天魁', category: '6길성', effect: '주간 귀인 — 윗사람·남성 조력.' },
  천월: { name: '천월', hanja: '天鉞', category: '6길성', effect: '야간 귀인 — 여성·부드러운 조력자.' },
  경양: { name: '경양', hanja: '擎羊', category: '4흉성', effect: '날카로운 경쟁·다툼·상해. 용맹하나 갈등 유발.' },
  타라: { name: '타라', hanja: '陀羅', category: '4흉성', effect: '지체·장애·우회. 일이 느리고 얽힘.' },
  화성: { name: '화성', hanja: '火星', category: '4흉성', effect: '급격한 변동·충동·사고. 불같은 에너지.' },
  영성: { name: '영성', hanja: '鈴星', category: '4흉성', effect: '은근한 타격·예민·걱정. 내재된 긴장.' },
  녹존: { name: '녹존', hanja: '祿存', category: '기타', effect: '재물의 씨앗 — 꾸준한 벌이와 안정.' },
  천마: { name: '천마', hanja: '天馬', category: '기타', effect: '이동·변화·역마. 여행·출장·이직 기운.' },
};

// ============================================
// 사화(四化) — 화록/화권/화과/화기
// ============================================

export interface MutagenMeta {
  name: string;
  hanja: string;
  effect: string;
  positive: string;
  caution: string;
}

export const MUTAGEN_META: Record<string, MutagenMeta> = {
  화록: {
    name: '화록', hanja: '化祿',
    effect: '복록이 붙음 — 돈·기회·즐거움이 해당 궁의 영역으로 흘러듦.',
    positive: '해당 궁 영역에서 이득과 풍요.',
    caution: '과욕·허영으로 흐르면 소모로 끝남.',
  },
  화권: {
    name: '화권', hanja: '化權',
    effect: '권세가 붙음 — 해당 궁의 영역에서 주도권·결정권이 생김.',
    positive: '리더·전문가 역할, 영향력 확대.',
    caution: '독단·완고함으로 마찰.',
  },
  화과: {
    name: '화과', hanja: '化科',
    effect: '명예가 붙음 — 해당 궁 영역에서 평판·시험·인정을 얻음.',
    positive: '학문·문서·명성의 길.',
    caution: '겉치레에 치우치면 실속이 빈약.',
  },
  화기: {
    name: '화기', hanja: '化忌',
    effect: '집착·장애가 붙음 — 해당 궁 영역에 애로·집요함·시비.',
    positive: '위기 대응력, 깊이 파고드는 집중력.',
    caution: '강박·손재·인간관계 파열. 결정적 순간 회피 권장.',
  },
};

// ============================================
// brightness·mutagen 화이트리스트 — UI 표시 가드
//
// iztro 한국어 로케일이 가끔 값을 변환하지 못하고 숫자(-1, +1) 또는
// 영문 코드로 흘려보내는 경우가 있어, UI 표시 시 화이트리스트로 가드.
// 알려진 값만 노출, 나머지는 숨김.
// ============================================

export const VALID_BRIGHTNESS = ['묘', '왕', '지', '득', '이', '평', '불', '함'] as const;
export const VALID_MUTAGEN = ['화록', '화권', '화과', '화기'] as const;

export function isValidBrightness(v: string | undefined | null): boolean {
  return !!v && (VALID_BRIGHTNESS as readonly string[]).includes(v);
}

export function isValidMutagen(v: string | undefined | null): boolean {
  return !!v && (VALID_MUTAGEN as readonly string[]).includes(v);
}

// ============================================
// 12궁 역할
//
// 자미두수 정통 12궁 분류. 사용자 직관 인지와 맞추기 위해 핵심 영역
// (수명·외부 인간관계·경제·지위 등)을 domain·focus에 명시 보강.
// ============================================

export interface PalaceRoleMeta {
  name: string;        // '명궁', '형제궁' ...
  domain: string;      // 주관 영역
  focus: string;       // 관찰 포인트
}

export const PALACE_ROLE_META: Record<string, PalaceRoleMeta> = {
  명궁: { name: '명궁', domain: '본질·성격·인생 방향·타고난 자질', focus: '이 사람이 어떤 사람인가 — 주성과 사화를 먼저 본다. 평생을 관통하는 자기 정체성.' },
  형제궁: { name: '형제궁', domain: '형제자매·동급자·가까운 동료', focus: '혈연·동급 인간관계의 우호/갈등, 형제 인연 깊이.' },
  부처궁: { name: '부처궁', domain: '배우자·연인·결혼·동업자', focus: '장기 파트너의 성향·끌리는 이성·결혼운·궁합·이혼 가능성.' },
  자녀궁: { name: '자녀궁', domain: '자녀·창작물·제자·아랫사람', focus: '자손운·창의력·후배 복·자녀와의 인연.' },
  재백궁: { name: '재백궁', domain: '돈을 버는 방식·수입원·경제·유동 재산', focus: '어떻게 돈을 벌고 다루는가 — 수입원·소비 성향·재테크·재물복.' },
  질액궁: { name: '질액궁', domain: '건강·질병·체질·재액·사고수', focus: '약한 신체 부위·만성 질환 경향·재난 유형·정신적 위기.' },
  천이궁: { name: '천이궁', domain: '외부 활동·이동·타향·사회 진출·대외적 인간관계', focus: '해외·출장·이직·외부에서 만나는 사람들과의 인연·사회적 모습.' },
  노복궁: { name: '노복궁', domain: '부하·친구·동료·인맥·수평 인간관계', focus: '친구·후배·동료 복, 직장 인간관계의 도움/갈등.' },
  관록궁: { name: '관록궁', domain: '직업·공명·지위·승진·커리어', focus: '어떤 직업이 맞는가·직장에서의 지위·승진 가능성·일하는 방식.' },
  전택궁: { name: '전택궁', domain: '부동산·가족 공간·자산·가업', focus: '집·땅·큰 자산 축적·부동산운·가정 환경·유산.' },
  복덕궁: { name: '복덕궁', domain: '정신세계·취미·복록·수명·내면의 행복', focus: '심리·취미·여가·정신적 평안·종교성·복의 그릇·수명 잠재.' },
  부모궁: { name: '부모궁', domain: '부모·윗사람·상사·웃어른과의 관계', focus: '부모와의 인연 깊이·상사 운·연장자와의 관계.' },
};

// ============================================
// 격국(格局) — 14주성 조합 패턴
//
// 자미두수의 격국은 명궁의 주성 + 삼방사정 회조 별 조합으로
// 결정된다. 격국에 따라 인생의 큰 흐름(부귀·권위·변화·복록)이
// 갈리며, 동일 명궁이라도 격국에 따라 풀이의 톤이 달라진다.
//
// 본 데이터는 한국 자미두수 입문서에서 가장 자주 등장하는
// 8개 핵심 격국을 정리한 것. detectGekkuk()에서 명반의 별 조합을
// 보고 해당 격국 여부를 판정한다.
// ============================================

export interface GekkukMeta {
  name: string;          // '살파랑'
  hanja: string;         // '殺破狼'
  /** 격국 구성 주성 — detectGekkuk 판정 기준 */
  stars: string[];
  /**
   * 격국 패턴:
   * - same_palace: 명궁(또는 명·신궁)에 별이 모두 동궁
   * - sanhab_huijo: 명궁 + 삼방사정(대궁·재백·관록) 4궁에 별이 분포
   * - opposite_palace: 명궁과 대궁(천이궁)에 회조
   * - empty_palace: 명궁에 주성 없음 (공궁)
   */
  pattern: 'same_palace' | 'sanhab_huijo' | 'opposite_palace' | 'empty_palace';
  description: string;
  positive: string;
  caution: string;
  tier: 'top' | 'high' | 'mid' | 'special';
}

export const GEKKUK_META: Record<string, GekkukMeta> = {
  자부동궁: {
    name: '자부동궁', hanja: '紫府同宮',
    stars: ['자미', '천부'],
    pattern: 'same_palace',
    description: '자미와 천부가 같은 궁에 있는 최고의 격. 인궁 또는 신궁에서 가능.',
    positive: '부귀쌍전(富貴雙全). 권위와 재물 모두 갖추고 안정과 위엄을 동시에 발휘.',
    caution: '보좌성이 약하면 오만·독선·체면치레로 흐를 수 있음.',
    tier: 'top',
  },
  자부염무상: {
    name: '자부염무상', hanja: '紫府廉武相',
    stars: ['자미', '천부', '염정', '무곡', '천상'],
    pattern: 'sanhab_huijo',
    description: '자미·천부·염정·무곡·천상 5성이 명궁과 삼방사정에 회조하는 정통 대격.',
    positive: '대기업·관료·정치 등 큰 무대에서 성공. 권위·재물·인맥 모두 풍족.',
    caution: '책임감과 야망이 큰 만큼 압박감도 큼. 휴식과 위임이 필요.',
    tier: 'top',
  },
  살파랑: {
    name: '살파랑', hanja: '殺破狼',
    stars: ['칠살', '파군', '탐랑'],
    pattern: 'sanhab_huijo',
    description: '칠살·파군·탐랑 3성이 명궁과 삼방사정에 회조하는 격. 변화·개혁의 인생.',
    positive: '강한 추진력으로 변화와 개혁을 이끔. 창업·혁신 산업·자영업에 강점.',
    caution: '기복이 크고 안정을 못 견딤. 인내심·재정 관리 부족 시 모든 게 무너질 위험.',
    tier: 'high',
  },
  기월동량: {
    name: '기월동량', hanja: '機月同梁',
    stars: ['천기', '태음', '천동', '천량'],
    pattern: 'sanhab_huijo',
    description: '천기·태음·천동·천량 4성이 명궁과 삼방사정에 회조하는 격. 안정·복록형.',
    positive: '안정적이고 복록 있는 삶. 공무원·교육·의료·문서 관련 직업에 어울림.',
    caution: '큰 변화·도전 부족으로 평범에 머무를 수 있음. 추진력 보완 필요.',
    tier: 'high',
  },
  일월병명: {
    name: '일월병명', hanja: '日月並明',
    stars: ['태양', '태음'],
    pattern: 'opposite_palace',
    description: '태양과 태음이 모두 입묘(밝은 위치)인 격. 축미궁 동궁 또는 대궁 회조.',
    positive: '음양 균형이 완벽. 부귀쌍전, 부모복·배우자복도 좋음.',
    caution: '균형이 무너지면 양쪽 다 잃을 수 있음. 보좌성 의존도 높음.',
    tier: 'top',
  },
  자미칠살: {
    name: '자미칠살', hanja: '紫微七殺',
    stars: ['자미', '칠살'],
    pattern: 'same_palace',
    description: '자미와 칠살이 같은 궁에 있는 격. 오궁(午宮)에서 화권 형태로 만남.',
    positive: '권위와 결단력 결합. 군왕격(軍王格)으로 큰 조직 리더·창업 적합.',
    caution: '독단·고독에 빠질 수 있음. 보좌성 도움 필요. 정·무 융합 필수.',
    tier: 'high',
  },
  자부조원: {
    name: '자부조원', hanja: '紫府朝垣',
    stars: ['자미', '천부'],
    pattern: 'sanhab_huijo',
    description: '자미와 천부가 명궁의 삼방사정에서 회조하는 격 (동궁 아님).',
    positive: '귀인의 도움을 받으며 차근차근 성공. 안정적인 부귀.',
    caution: '주체적 결단보다 외부 의존이 강할 수 있음. 스스로 결정하는 훈련 필요.',
    tier: 'high',
  },
  명궁공궁: {
    name: '명궁공궁', hanja: '空宮',
    stars: [],
    pattern: 'empty_palace',
    description: '명궁에 14주성이 없는 격. 대궁(천이궁)의 별을 차용해서 본다.',
    positive: '환경 적응력 뛰어남. 외부 자원·인맥을 활용하면 유연하게 성공 가능.',
    caution: '자기 정체성이 약하고 환경에 휘둘리기 쉬움. 대궁의 별이 흉성이면 어려움 큼.',
    tier: 'special',
  },
};

// ============================================
// 유틸: 명반에서 의미 있는 엔트리만 추출
// ============================================

import type { ZamidusuResult, ZamidusuPalace } from '../zamidusu';

export interface KnowledgeHit {
  majorStars: { palace: string; meta: MajorStarMeta; mutagen?: MutagenMeta }[];
  minorStars: { palace: string; meta: MinorStarMeta }[];
  palaceRoles: PalaceRoleMeta[];
}

/**
 * 명반에 실제 등장한 별/궁만 뽑아서 해설 엔트리를 반환한다.
 * 프롬프트에서 이 결과만 AI에 주입한다 (존재하지 않는 별을 묘사하지 않도록).
 */
export function collectKnowledge(chart: ZamidusuResult): KnowledgeHit {
  const majorStars: KnowledgeHit['majorStars'] = [];
  const minorStars: KnowledgeHit['minorStars'] = [];

  chart.palaces.forEach((p: ZamidusuPalace) => {
    p.majorStars.forEach((s) => {
      const meta = MAJOR_STARS_META[s.name];
      if (meta) {
        const mutagen = s.mutagen ? MUTAGEN_META[s.mutagen] : undefined;
        majorStars.push({ palace: p.name, meta, mutagen });
      }
    });
    p.minorStars.forEach((s) => {
      const meta = MINOR_STARS_META[s.name];
      if (meta) minorStars.push({ palace: p.name, meta });
    });
  });

  // 12궁 역할 — 전부 포함(12개 고정)
  const palaceRoles = chart.palaces
    .map((p) => PALACE_ROLE_META[p.name])
    .filter((x): x is PalaceRoleMeta => !!x);

  return { majorStars, minorStars, palaceRoles };
}
