/**
 * 한국 전통 꿈해몽 지식베이스
 *
 * 사용 목적:
 *  - 사용자가 입력한 꿈 설명에서 키워드를 추출해 전통 상징 해석을 매칭
 *  - 매칭된 상징을 프롬프트에 주입하여 AI가 근거 있는 해석을 생성하도록 유도
 *
 * 구조:
 *  - category: 상징 분류 (동물, 자연, 신체, 행위, 인물, 사물, 감정)
 *  - keywords: 매칭용 한글 키워드(동의어·활용형 포함)
 *  - tradition: 한국 전통(토정비결·주공해몽 계열) 해석 — 길흉 포함
 *  - psychology: 현대 심리적 보조 해석 (무의식·상징)
 *  - polarity: 'good' | 'bad' | 'neutral' | 'mixed' — 전반 경향
 */

export type DreamPolarity = 'good' | 'bad' | 'neutral' | 'mixed';

export interface DreamSymbol {
  id: string;
  label: string;              // 대표 이름
  category: '동물' | '자연' | '신체' | '행위' | '인물' | '사물' | '숫자색' | '감정';
  keywords: string[];         // 매칭용
  tradition: string;          // 전통 해몽 (2~3문장)
  psychology?: string;        // 현대 심리 상징
  polarity: DreamPolarity;
}

export const DREAM_SYMBOLS: DreamSymbol[] = [
  // ── 동물 ──────────────────────────────────────────────
  {
    id: 'pig',
    label: '돼지',
    category: '동물',
    keywords: ['돼지', '멧돼지', '새끼돼지', '돼지꿈'],
    tradition: '전통적으로 재물·재복의 대표 길몽. 돼지를 품에 안거나 집에 들어오는 꿈은 곧 큰돈이 들어온다는 신호다. 새끼돼지 여러 마리는 재물이 연달아 생긴다는 뜻이며, 태몽으로도 복된 자식을 의미한다.',
    psychology: '풍요·다산·본능적 충만함의 상징.',
    polarity: 'good',
  },
  {
    id: 'snake',
    label: '뱀',
    category: '동물',
    keywords: ['뱀', '구렁이', '살모사', '독사', '이무기', '뱀꿈'],
    tradition: '뱀은 태몽·재물·변화 세 가지를 상징한다. 큰 구렁이가 몸을 감거나 품에 들어오면 귀한 아이를 얻거나 재물·권력이 생긴다. 뱀에 물리는 꿈은 정식 인연(특히 귀인)을 만나는 상서로운 꿈으로 전해진다.',
    psychology: '변화·재생·억눌린 욕망의 각성.',
    polarity: 'good',
  },
  {
    id: 'dragon',
    label: '용',
    category: '동물',
    keywords: ['용', '이무기승천', '용이', '청룡', '황룡', '승천'],
    tradition: '용꿈은 최고의 길몽. 승천하는 용은 출세·시험 합격·승진을 뜻하고, 여의주를 물면 평생의 큰 성취가 임박한다는 뜻이다. 태몽으로는 크게 될 자식을 의미한다.',
    psychology: '자기실현·리더십·초월적 에너지.',
    polarity: 'good',
  },
  {
    id: 'tiger',
    label: '호랑이',
    category: '동물',
    keywords: ['호랑이', '백호', '범', '호랑이꿈'],
    tradition: '호랑이는 권력·명예·귀인을 상징한다. 호랑이를 타거나 쓰다듬는 꿈은 윗사람의 후원·승진. 호랑이에게 쫓기는 꿈은 권력자와의 갈등이나 큰 도전 임박.',
    psychology: '내면의 카리스마·억압된 공격성.',
    polarity: 'mixed',
  },
  {
    id: 'dog',
    label: '개',
    category: '동물',
    keywords: ['개', '강아지', '진돗개', '개꿈'],
    tradition: '하얀 개·귀여운 강아지는 귀인·친구의 도움. 검은 개나 짖는 개는 구설·배신의 징조. 개에게 물리는 꿈은 가까운 사람과의 갈등 주의.',
    polarity: 'mixed',
  },
  {
    id: 'cat',
    label: '고양이',
    category: '동물',
    keywords: ['고양이', '냥이', '야옹'],
    tradition: '검은 고양이는 예로부터 구설·질투·여성으로 인한 다툼. 하얀 고양이는 예술·직감의 발현. 고양이가 품에 안기면 묘한 인연이 생긴다.',
    polarity: 'mixed',
  },
  {
    id: 'rat',
    label: '쥐',
    category: '동물',
    keywords: ['쥐', '생쥐', '들쥐'],
    tradition: '쥐는 작은 재물이지만 도둑·새는 돈을 의미하기도 한다. 여러 마리가 나오면 재물이 모이나 관리가 어렵고, 쥐를 잡는 꿈은 숨은 재물·기회 획득.',
    polarity: 'mixed',
  },
  {
    id: 'bird',
    label: '새·날짐승',
    category: '동물',
    keywords: ['새', '까치', '봉황', '학', '비둘기', '독수리', '참새'],
    tradition: '까치는 반가운 소식·손님. 봉황·학은 귀한 자리·명예. 까마귀는 흉사나 구설의 예고. 새가 품에 들어오면 좋은 소식이 가까이 온다.',
    polarity: 'mixed',
  },
  {
    id: 'fish',
    label: '물고기',
    category: '동물',
    keywords: ['물고기', '잉어', '붕어', '금붕어', '생선'],
    tradition: '잉어·금붕어는 재물운의 상징. 많이 잡는 꿈은 큰 수입. 큰 잉어가 품에 뛰어들면 귀한 자식이나 큰돈. 죽은 물고기는 기회가 지나감.',
    polarity: 'good',
  },

  // ── 자연 ──────────────────────────────────────────────
  {
    id: 'water',
    label: '물',
    category: '자연',
    keywords: ['물', '바다', '강', '호수', '비', '개울'],
    tradition: '맑은 물은 재물·축복. 잔잔한 바다는 안정. 더럽거나 탁한 물은 건강·감정 문제. 홍수는 큰 변동이지만 물이 집으로 들어오면 재물이 들어오는 뜻.',
    psychology: '감정·무의식의 상태.',
    polarity: 'mixed',
  },
  {
    id: 'fire',
    label: '불',
    category: '자연',
    keywords: ['불', '불꽃', '화재', '모닥불', '산불'],
    tradition: '타오르는 불·활활 붙는 불은 큰 재물·명성. 반대로 집이 타서 재만 남으면 소식은 흉. 자기가 불을 끄지 못하면 감당 못 할 일이 생긴다는 경고.',
    psychology: '정열·분노·변화의 힘.',
    polarity: 'mixed',
  },
  {
    id: 'sun_moon',
    label: '해·달·별',
    category: '자연',
    keywords: ['해', '태양', '달', '별', '일출', '월출'],
    tradition: '해가 떠오르거나 품에 들어오면 크게 출세한다. 달이 밝으면 여성에게 좋은 일. 별이 떨어지는 꿈은 귀인의 죽음 또는 큰 기회 임박.',
    polarity: 'good',
  },
  {
    id: 'mountain',
    label: '산·나무',
    category: '자연',
    keywords: ['산', '등산', '나무', '큰나무', '거목'],
    tradition: '푸른 산·큰 나무는 안정·가문의 번창. 산을 오르면 지위 상승. 나무가 말라 있거나 꺾이면 건강·가족 주의.',
    polarity: 'good',
  },

  // ── 신체 ──────────────────────────────────────────────
  {
    id: 'teeth',
    label: '이빨',
    category: '신체',
    keywords: ['이', '이빨', '치아', '이빠짐', '이가빠지', '이뽑'],
    tradition: '이가 빠지는 꿈은 전통적으로 가족·가까운 이의 우환을 의미한다. 윗니는 윗사람, 아랫니는 아랫사람. 다만 스스로 흔들리는 이를 빼고 시원하면 묵은 문제 해결의 신호.',
    psychology: '상실·통제 불안·변화 저항.',
    polarity: 'bad',
  },
  {
    id: 'blood',
    label: '피',
    category: '신체',
    keywords: ['피', '출혈', '코피', '피흘리'],
    tradition: '피는 재물로 푸는 것이 원칙. 바닥에 흥건히 흐르는 피는 큰 재물. 자기 몸에서 많이 나면 건강 주의. 남의 피를 보면 구설 조심.',
    polarity: 'mixed',
  },
  {
    id: 'hair',
    label: '머리카락',
    category: '신체',
    keywords: ['머리', '머리카락', '머리빠짐', '탈모', '머리자름'],
    tradition: '머리가 길게 자라면 수명·복. 숱이 많으면 재물. 스스로 자르면 결단·변화. 뭉텅이로 빠지면 기력·명예 손실.',
    polarity: 'mixed',
  },
  {
    id: 'poop',
    label: '똥',
    category: '신체',
    keywords: ['똥', '대변', '변'],
    tradition: '똥꿈은 대표적 길몽. 똥을 밟거나 덮어쓰면 재물운 대박. 깨끗이 씻는 꿈은 돈이 나간다는 반대 의미.',
    polarity: 'good',
  },

  // ── 행위 ──────────────────────────────────────────────
  {
    id: 'fly',
    label: '날다',
    category: '행위',
    keywords: ['날다', '하늘', '비행', '날아', '날았'],
    tradition: '하늘을 자유롭게 나는 꿈은 성취·승진·해방. 높이 오를수록 큰 성공. 추락하면 현재 기반의 불안.',
    psychology: '자유·자기확장.',
    polarity: 'good',
  },
  {
    id: 'fall',
    label: '떨어지다',
    category: '행위',
    keywords: ['떨어지', '추락', '낙하', '빠지'],
    tradition: '높은 곳에서 떨어지는 꿈은 지위·계획의 동요. 다만 떨어져서 바닥에 부드럽게 닿으면 시련 뒤 안착.',
    psychology: '통제 상실·변화 불안.',
    polarity: 'bad',
  },
  {
    id: 'chase',
    label: '쫓기다',
    category: '행위',
    keywords: ['쫓기', '도망', '추격', '피해'],
    tradition: '정체 모를 것에 쫓기면 스트레스·회피 중인 문제. 아는 대상(사람·짐승)에 쫓기면 해당 관계의 압박감.',
    psychology: '회피·억압된 감정 직면 필요.',
    polarity: 'bad',
  },
  {
    id: 'swim',
    label: '수영·헤엄',
    category: '행위',
    keywords: ['수영', '헤엄', '물에빠', '물속'],
    tradition: '맑은 물에서 자유롭게 헤엄치면 일이 순조롭다. 탁한 물에서 허우적대면 감정·관계 혼란.',
    polarity: 'mixed',
  },
  {
    id: 'death',
    label: '죽음',
    category: '행위',
    keywords: ['죽', '죽음', '죽었', '사망', '장례', '관'],
    tradition: '꿈에서 죽는 것은 끝이 아니라 재생·새 시작을 상징한다. 자기 장례를 보면 큰 변화 직전. 남의 죽음은 그 사람과의 관계 전환.',
    psychology: '한 국면의 종결, 새 자아의 등장.',
    polarity: 'good',
  },
  {
    id: 'wedding',
    label: '결혼',
    category: '행위',
    keywords: ['결혼', '웨딩', '신부', '신랑', '혼례'],
    tradition: '결혼식 꿈은 큰 변화의 시작. 미혼자에게는 인연이, 기혼자에게는 사업·협력 관계의 결합. 다만 슬프게 느껴졌다면 준비 부족의 신호.',
    polarity: 'mixed',
  },
  {
    id: 'exam',
    label: '시험',
    category: '행위',
    keywords: ['시험', '수능', '면접', '평가'],
    tradition: '시험 꿈은 현실의 평가·도전 앞 압박감. 잘 보면 실제 결과도 좋은 신호. 답을 못 쓰면 준비 부족을 무의식이 알리는 것.',
    polarity: 'neutral',
  },
  {
    id: 'naked',
    label: '벌거벗다',
    category: '행위',
    keywords: ['벌거', '나체', '알몸', '옷벗'],
    tradition: '공공 장소에서 알몸이 되는 꿈은 숨기고 싶은 약점의 노출 불안. 반대로 편안하게 느꼈다면 진실에의 수용.',
    psychology: '자기노출·취약함의 인식.',
    polarity: 'neutral',
  },

  // ── 인물 ──────────────────────────────────────────────
  {
    id: 'deceased',
    label: '돌아가신 분',
    category: '인물',
    keywords: ['돌아가신', '죽은사람', '조상', '할아버지', '할머니', '아버지', '어머니'],
    tradition: '조상·돌아가신 분이 밝은 표정으로 나타나면 일이 풀린다는 신호. 무언가를 건네주면 실제 도움(유산·기회)이 온다. 슬픈 표정이면 가족에 주의할 일.',
    polarity: 'mixed',
  },
  {
    id: 'baby',
    label: '아기',
    category: '인물',
    keywords: ['아기', '아이', '신생아', '태아', '갓난'],
    tradition: '밝고 건강한 아기는 새 시작·창작·프로젝트. 태몽으로도 해석된다. 우는 아기는 해결 못한 문제의 신호.',
    psychology: '새로운 가능성·내면의 자아.',
    polarity: 'good',
  },
  {
    id: 'stranger',
    label: '낯선 사람',
    category: '인물',
    keywords: ['낯선', '모르는사람', '이방인'],
    tradition: '낯선 인물은 자기 안의 미처 몰랐던 면 또는 곧 만날 인연. 도움을 주면 귀인, 해치면 경계할 만남.',
    polarity: 'mixed',
  },

  // ── 사물 ──────────────────────────────────────────────
  {
    id: 'money',
    label: '돈·금',
    category: '사물',
    keywords: ['돈', '지폐', '금', '금반지', '보석'],
    tradition: '직접 돈을 받는 꿈은 오히려 지출의 암시인 경우가 많다. 반대로 쓰거나 잃어버리는 꿈은 실제로 수입이 생긴다는 역몽. 금·보석을 얻으면 장기적 재물.',
    polarity: 'mixed',
  },
  {
    id: 'house',
    label: '집',
    category: '사물',
    keywords: ['집', '방', '아파트', '현관', '이사'],
    tradition: '큰 집·새 집은 상승·확장. 허물어진 집은 기반·가족 문제. 이사하는 꿈은 실제로 삶의 국면 전환이 임박.',
    psychology: '자기·가족·정체성.',
    polarity: 'mixed',
  },
  {
    id: 'car',
    label: '차·교통',
    category: '사물',
    keywords: ['차', '자동차', '버스', '기차', '비행기'],
    tradition: '내가 운전대를 잡으면 주도권 확보. 사고가 나면 계획에 제동. 큰 차·고급차를 타면 지위 상승.',
    polarity: 'mixed',
  },
  {
    id: 'knife',
    label: '칼·날붙이',
    category: '사물',
    keywords: ['칼', '식칼', '검', '가위'],
    tradition: '번뜩이는 칼은 결단력·권력의 상징. 날붙이에 베이면 구설 조심. 칼을 받으면 권한 위임, 잃으면 권위 약화.',
    polarity: 'mixed',
  },

  // ── 숫자·색 ──────────────────────────────────────────────
  {
    id: 'color_red',
    label: '붉은색',
    category: '숫자색',
    keywords: ['빨간', '붉은', '빨강'],
    tradition: '붉은색은 정열·재물·경사. 다만 붉은 피가 과하면 건강 주의. 붉은 꽃·옷은 좋은 일의 전조.',
    polarity: 'good',
  },
  {
    id: 'color_white',
    label: '흰색',
    category: '숫자색',
    keywords: ['하얀', '흰', '하양'],
    tradition: '흰색은 순수·정결·상(喪). 흰 옷·흰 새·흰 짐승은 귀인 또는 조상의 가호. 흰 수의는 실제 애사 주의.',
    polarity: 'mixed',
  },
  {
    id: 'color_black',
    label: '검은색',
    category: '숫자색',
    keywords: ['검은', '까만', '검정'],
    tradition: '검은 구름·검은 물은 답답함·장애. 검은 짐승은 구설·음해 주의. 다만 검은 소·검은 돼지는 예외적으로 재물.',
    polarity: 'bad',
  },

  // ── 감정/현상 ──────────────────────────────────────────
  {
    id: 'crying',
    label: '울다',
    category: '감정',
    keywords: ['울', '눈물', '슬펐', '울고'],
    tradition: '시원하게 우는 꿈은 억눌림 해소 뒤 길사. 소리 없이 울면 현실의 응어리가 있음.',
    polarity: 'mixed',
  },
  {
    id: 'laugh',
    label: '웃다',
    category: '감정',
    keywords: ['웃', '웃었', '웃음'],
    tradition: '활짝 웃는 꿈은 기대했던 일이 성사된다. 다만 억지로 웃거나 기괴하게 웃으면 역몽으로 풀이되기도 한다.',
    polarity: 'good',
  },

  // ── 추가 자연·현상 ───────────────────────────────────────
  {
    id: 'rainbow',
    label: '무지개',
    category: '자연',
    keywords: ['무지개', '쌍무지개'],
    tradition: '무지개는 갈등과 시련 끝의 화해·새 출발을 알리는 길몽. 쌍무지개는 큰 경사가 겹쳐서 들어온다. 다만 끊어진 무지개는 일이 중간에 어그러질 신호.',
    psychology: '회복·연결·희망의 상징.',
    polarity: 'good',
  },
  {
    id: 'lightning',
    label: '천둥·번개',
    category: '자연',
    keywords: ['천둥', '번개', '벼락', '뇌성'],
    tradition: '내 몸이나 집에 벼락이 내리면 갑작스러운 큰 변화·성취. 멀리서 번개를 보기만 하면 변동의 예고. 여러 번 치는 천둥은 윗사람의 노여움이나 큰 결정을 동반한다.',
    polarity: 'mixed',
  },
  {
    id: 'flower',
    label: '꽃',
    category: '자연',
    keywords: ['꽃', '꽃밭', '꽃피', '꽃봉오리', '장미'],
    tradition: '활짝 핀 꽃은 기쁨·결실·인연. 꽃을 받으면 사랑·축하의 일이 생긴다. 시들거나 짓밟힌 꽃은 정 내려놓은 관계 또는 무산된 기대.',
    psychology: '아름다움·결실·관계의 절정.',
    polarity: 'mixed',
  },
  {
    id: 'fruit',
    label: '과일',
    category: '자연',
    keywords: ['과일', '사과', '배', '복숭아', '귤', '포도', '감', '석류'],
    tradition: '잘 익은 과일은 노력의 결실. 과일을 따거나 먹는 꿈은 기다리던 결과가 손에 들어온다. 석류·포도처럼 알이 많은 과일은 재물·자손운. 썩거나 벌레 먹은 과일은 결과 직전 어그러짐.',
    polarity: 'good',
  },
  {
    id: 'egg',
    label: '알·계란',
    category: '사물',
    keywords: ['알', '계란', '달걀', '새알'],
    tradition: '알은 잠재력·잉태·재물의 씨앗. 알을 줍거나 품는 꿈은 새 일의 시작 또는 태몽. 깨진 알은 시작 단계의 좌절. 알에서 무언가 부화하면 큰 성취 임박.',
    polarity: 'good',
  },
  {
    id: 'rice_bowl',
    label: '밥·밥상·솥',
    category: '사물',
    keywords: ['밥', '밥상', '솥', '쌀', '잔치상', '한상'],
    tradition: '김 나는 밥과 가득 찬 밥상은 가정의 풍요·재물. 솥 안에 음식이 가득하면 식록(食祿)이 두텁다. 빈 밥상이나 깨진 솥은 살림의 어려움을 경계.',
    polarity: 'mixed',
  },
  {
    id: 'royalty',
    label: '임금·왕·고관',
    category: '인물',
    keywords: ['왕', '임금', '대통령', '귀인', '고관', '왕비', '여왕'],
    tradition: '왕·임금·대통령처럼 큰 인물을 만나거나 인사를 받으면 큰 귀인의 후원이나 출세의 신호. 그들에게 무엇을 받는다면 곧 직접적인 도움이 들어온다.',
    polarity: 'good',
  },
  {
    id: 'tomb',
    label: '무덤·묘',
    category: '사물',
    keywords: ['무덤', '묘', '봉분', '비석'],
    tradition: '잘 단장된 큰 무덤이나 양지바른 묘를 본 꿈은 의외로 길몽 — 조상의 음덕이나 재물·승진의 신호. 허물어진 무덤은 가운(家運)에 주의가 필요하다는 경고.',
    polarity: 'mixed',
  },
  {
    id: 'shoes',
    label: '신발',
    category: '사물',
    keywords: ['신발', '구두', '운동화', '짚신'],
    tradition: '새 신발을 신으면 새로운 길·이동·승진. 신발이 잘 맞으면 인연·자리가 자기에게 맞다는 신호. 한 짝만 잃거나 짝짝이로 신으면 동반자·협력의 어긋남.',
    polarity: 'mixed',
  },
  {
    id: 'mirror',
    label: '거울',
    category: '사물',
    keywords: ['거울', '거울보', '거울깨'],
    tradition: '맑고 깨끗한 거울에 비친 자기 모습은 자기 점검·진로 정리의 길조. 거울이 깨지면 가까운 관계의 단절이나 평판의 손상을 경계.',
    psychology: '자기 인식·진실 직면.',
    polarity: 'mixed',
  },
  {
    id: 'bridge_road',
    label: '다리·길',
    category: '자연',
    keywords: ['다리', '길', '도로', '건너', '갈림길', '오솔길'],
    tradition: '다리를 건너는 꿈은 인생 국면의 전환. 다 건너면 변화 성공, 도중에 끊기거나 무너지면 일이 중도에 막힌다. 갈림길은 곧 선택의 기로에 선다는 신호.',
    polarity: 'mixed',
  },
  {
    id: 'gift',
    label: '선물·받음',
    category: '사물',
    keywords: ['선물', '꾸러미', '받았다', '편지받'],
    tradition: '누군가에게 선물·꾸러미·편지를 받는 꿈은 곧 좋은 소식·도움이 온다. 선물의 색이 밝고 깨끗할수록 길조. 검은 보자기 등은 부고의 예고일 수 있어 주의.',
    polarity: 'mixed',
  },
  {
    id: 'lost_way',
    label: '길을 잃음',
    category: '행위',
    keywords: ['길을잃', '길잃', '미아', '헤맸'],
    tradition: '길을 잃거나 헤매는 꿈은 진로·관계·가치관의 혼란을 무의식이 가리킨다. 누군가 길을 알려주면 곧 귀인이 나타난다는 신호.',
    psychology: '결정 회피·정체성 혼란.',
    polarity: 'bad',
  },
  {
    id: 'pregnancy',
    label: '임신·만삭',
    category: '신체',
    keywords: ['임신', '만삭', '배가부른', '잉태'],
    tradition: '본인이 임신했거나 부른 배를 본 꿈은 새 프로젝트·창작·자녀운. 배가 점점 커진 꿈은 일이 무르익는 신호. 가족 임신 꿈은 실제 태몽일 수 있다.',
    polarity: 'good',
  },
  {
    id: 'feast',
    label: '잔치·연회',
    category: '행위',
    keywords: ['잔치', '연회', '파티', '회식', '큰모임'],
    tradition: '큰 잔치·연회는 모임의 중심에 서거나 큰 경사가 임박한다는 길조. 자리에 끼지 못하고 바깥에서 보기만 했다면 기회를 놓칠 가능성을 경계.',
    polarity: 'good',
  },
  {
    id: 'darkness',
    label: '어둠·캄캄함',
    category: '자연',
    keywords: ['어둠', '캄캄', '암흑', '깜깜'],
    tradition: '꿈 전반이 어둡고 캄캄하면 답답한 시기·정체. 한 줄기 빛이라도 있으면 위기 속 길이 보인다는 신호. 빛이 점점 밝아지는 꿈은 운이 회복된다.',
    polarity: 'bad',
  },
  {
    id: 'light',
    label: '밝은 빛·후광',
    category: '자연',
    keywords: ['밝은빛', '환한빛', '후광', '광채', '빛이쏟아'],
    tradition: '환한 빛이 자기 위로 쏟아지거나 사람에게 후광이 비치면 큰 운·귀인·종교적 가호. 길몽 중 강한 격.',
    polarity: 'good',
  },

  // ─── 영물(靈物) ────────────────────────────────────
  {
    id: 'phoenix',
    label: '봉황',
    category: '동물',
    keywords: ['봉황', '봉황새', '주작'],
    tradition: '봉황은 용에 버금가는 최상위 길조. 만나면 큰 명예·귀한 자리·태몽으로는 영부인급 자식. 봉황이 품에 안기면 평생의 큰 행운.',
    psychology: '자기실현의 정점·재탄생의 원형.',
    polarity: 'good',
  },
  {
    id: 'kirin',
    label: '기린',
    category: '동물',
    keywords: ['기린', '신수기린'],
    tradition: '기린은 성인(聖人)의 등장을 알리는 상서로운 짐승. 학자·교사·종교지도자급 태몽으로 풀이된다.',
    polarity: 'good',
  },
  {
    id: 'haetae',
    label: '해태·신수',
    category: '동물',
    keywords: ['해태', '신수', '백호', '주작', '현무'],
    tradition: '사신수·해태가 등장하면 가호·수호의 길조. 법정·시험·다툼에서 정의가 자기 편이 된다는 신호.',
    polarity: 'good',
  },

  // ─── 가축·야생포유 추가 ────────────────────────────
  {
    id: 'cow',
    label: '소·황소',
    category: '동물',
    keywords: ['소', '황소', '암소', '송아지', '검은소'],
    tradition: '검은 소·황소는 재물·근면의 길조. 송아지를 받거나 안으면 태몽 또는 자수성가의 신호. 소가 달아나면 재물 누수 주의.',
    polarity: 'mixed',
  },
  {
    id: 'horse',
    label: '말·백마',
    category: '동물',
    keywords: ['말', '백마', '준마', '말타고'],
    tradition: '말을 타는 꿈은 출세·명성·이동. 백마는 명예·귀인. 말이 사납게 날뛰면 통제 안 되는 일이 임박.',
    psychology: '본능적 추동력·리비도.',
    polarity: 'mixed',
  },
  {
    id: 'deer',
    label: '사슴',
    category: '동물',
    keywords: ['사슴', '꽃사슴', '뿔사슴'],
    tradition: '뿔이 큰 사슴은 학자·교사 태몽. 사슴을 잡거나 받으면 명예·승진. 뿔 없는 사슴은 우아한 딸 태몽.',
    polarity: 'good',
  },
  {
    id: 'bear',
    label: '곰',
    category: '동물',
    keywords: ['곰', '흑곰', '백곰'],
    tradition: '곰은 우직함·강인함의 상징. 곰에게 안기거나 곰을 받으면 든든한 자식 태몽 또는 큰 후원자의 등장.',
    polarity: 'good',
  },
  {
    id: 'rabbit',
    label: '토끼',
    category: '동물',
    keywords: ['토끼', '산토끼', '흰토끼'],
    tradition: '토끼는 행운·재물의 작은 신호. 토끼를 안으면 귀여운 딸 태몽. 토끼가 도망가면 작은 기회를 놓침.',
    polarity: 'good',
  },
  {
    id: 'fox',
    label: '여우',
    category: '동물',
    keywords: ['여우', '구미호', '백여우'],
    tradition: '여우는 영리함과 동시에 변덕·유혹의 양가성. 흰 여우는 영적 가호, 검은 여우는 음해·구설 주의.',
    psychology: '아니마의 그림자 면·유혹과 직관.',
    polarity: 'mixed',
  },
  {
    id: 'wolf',
    label: '늑대',
    category: '동물',
    keywords: ['늑대', '이리'],
    tradition: '늑대는 위협적 인물·경쟁자의 등장 신호. 늑대 무리에 쫓기면 집단적 압박. 늑대를 쓰러뜨리면 큰 적을 이긴다.',
    psychology: '그림자·억압된 야성.',
    polarity: 'mixed',
  },
  {
    id: 'monkey',
    label: '원숭이',
    category: '동물',
    keywords: ['원숭이', '잔나비'],
    tradition: '원숭이는 영리하나 변덕·교활의 양면. 장난스러운 원숭이는 가벼운 즐거움, 위협적 원숭이는 구설.',
    polarity: 'mixed',
  },

  // ─── 곤충 ──────────────────────────────────────────
  {
    id: 'butterfly',
    label: '나비',
    category: '동물',
    keywords: ['나비', '나비꿈', '범나비'],
    tradition: '고운 나비는 영혼의 자유·짧은 행복·예쁜 딸 태몽. 빨간 나비는 강한 인연, 검은 나비는 부고 또는 큰 변화 예고.',
    psychology: '변환·영혼·재탄생의 원형.',
    polarity: 'mixed',
  },
  {
    id: 'bee',
    label: '벌·꿀벌',
    category: '동물',
    keywords: ['벌', '꿀벌', '말벌', '벌떼'],
    tradition: '꿀벌은 근면·재물·풍요. 벌에 쏘이면 작지만 따끔한 손실. 벌떼가 따라오면 사소한 일들이 몰아닥침.',
    polarity: 'mixed',
  },
  {
    id: 'spider',
    label: '거미',
    category: '동물',
    keywords: ['거미', '거미줄'],
    tradition: '큰 검은 거미는 의외로 길조 — 능력·복의 신호. 거미줄에 걸리면 인간관계 옭아매임 주의.',
    psychology: '그레이트 마더의 양가성·운명의 짜임.',
    polarity: 'mixed',
  },
  {
    id: 'ant',
    label: '개미',
    category: '동물',
    keywords: ['개미', '개미떼', '왕개미'],
    tradition: '개미떼는 작은 재물이 모이는 신호. 개미가 집 안으로 들어오면 식록(食祿) 풍성. 개미에 물리면 사소한 손실·구설.',
    polarity: 'mixed',
  },
  {
    id: 'dragonfly',
    label: '잠자리',
    category: '동물',
    keywords: ['잠자리'],
    tradition: '잠자리는 가벼움·자유·작은 행운. 잡았다 놓아주면 기회가 손에서 빠져나가는 경고.',
    polarity: 'mixed',
  },
  {
    id: 'cicada',
    label: '매미',
    category: '동물',
    keywords: ['매미', '매미소리'],
    tradition: '매미는 시기·계절의 단서. 우는 매미는 답답한 일의 끝 또는 짧은 영광 후의 마침.',
    polarity: 'neutral',
  },
  {
    id: 'cockroach',
    label: '바퀴벌레',
    category: '동물',
    keywords: ['바퀴벌레', '바퀴'],
    tradition: '바퀴벌레는 끈질긴 골칫거리·드러내고 싶지 않은 일의 노출 위험. 잡아 없애면 묵은 문제 해결.',
    polarity: 'bad',
  },
  {
    id: 'worm',
    label: '지렁이·구더기',
    category: '동물',
    keywords: ['지렁이', '구더기', '벌레떼'],
    tradition: '구더기·벌레떼는 의외로 큰 재물의 역몽으로 풀이되기도 한다. 다만 자기 몸에 붙으면 건강 점검.',
    polarity: 'mixed',
  },

  // ─── 신체부위 추가 ─────────────────────────────────
  {
    id: 'eye',
    label: '눈',
    category: '신체',
    keywords: ['눈', '눈동자', '시력', '눈이밝'],
    tradition: '눈이 밝아지거나 새 눈이 생기는 꿈은 통찰·진리·기회 포착. 눈이 멀거나 흐려지면 판단 흐려짐의 경고.',
    polarity: 'mixed',
  },
  {
    id: 'nose_mouth',
    label: '코·입',
    category: '신체',
    keywords: ['코', '입', '입술', '혀'],
    tradition: '코가 커지면 명예·재물. 입에서 빛이 나거나 좋은 말이 나오면 명성. 이상한 것을 뱉으면 구설 정화.',
    polarity: 'mixed',
  },
  {
    id: 'hand',
    label: '손·손톱',
    category: '신체',
    keywords: ['손', '손톱', '손가락', '주먹'],
    tradition: '손에 무언가 쥐는 꿈은 재물·기회의 획득. 손톱이 빠지거나 손가락이 부러지면 재물·관계 손실.',
    polarity: 'mixed',
  },
  {
    id: 'foot',
    label: '발·다리',
    category: '신체',
    keywords: ['발', '다리', '맨발', '발가락'],
    tradition: '발이 시원하게 걷는 꿈은 진로 순항. 다리가 부러지거나 못 걸으면 추진력·기반 약화 경고.',
    polarity: 'mixed',
  },
  {
    id: 'heart_organ',
    label: '심장·내장',
    category: '신체',
    keywords: ['심장', '내장', '간', '폐'],
    tradition: '심장이 강하게 뛰는 꿈은 새 인연·새 도전의 신호. 내장이 보이거나 다치면 건강·정서 점검 필요.',
    polarity: 'mixed',
  },

  // ─── 인물·신령 ─────────────────────────────────────
  {
    id: 'buddha_jesus',
    label: '부처·예수·신',
    category: '인물',
    keywords: ['부처', '석가', '예수', '하나님', '천사', '관음', '보살'],
    tradition: '부처·예수·신이 등장해 무언가를 주거나 미소 짓는 꿈은 최상위 영성·가호의 길조. 큰 시련의 끝 또는 영적 각성 신호.',
    polarity: 'good',
  },
  {
    id: 'monk_priest',
    label: '스님·도사·신선',
    category: '인물',
    keywords: ['스님', '도사', '신선', '백발노인', '수염노인'],
    tradition: '스님·도사·백발노인이 시주를 청하거나 무언가를 건네면 귀한 자식 태몽 또는 큰 가르침·기회.',
    psychology: '노현자(Wise Old Man) 원형 — 자기 통합의 안내자.',
    polarity: 'good',
  },
  {
    id: 'shaman',
    label: '무당·점쟁이',
    category: '인물',
    keywords: ['무당', '점쟁이', '굿', '신내림'],
    tradition: '무당이 굿을 하거나 점을 봐주는 꿈은 가운(家運)의 변동·조상 점검 필요 신호. 무당이 길조를 말해주면 그대로 일어날 가능성.',
    polarity: 'mixed',
  },
  {
    id: 'ghost',
    label: '귀신·도깨비',
    category: '인물',
    keywords: ['귀신', '도깨비', '유령', '혼령'],
    tradition: '귀신·도깨비가 놀라게 하면 가위눌림·억눌린 정서의 표출. 잡아 쫓아내면 묵은 문제 해결. 도깨비방망이를 얻으면 횡재.',
    psychology: '그림자·억압된 트라우마의 인격화.',
    polarity: 'mixed',
  },
  {
    id: 'reaper',
    label: '저승사자·죽음의 사자',
    category: '인물',
    keywords: ['저승사자', '검은옷', '죽음의사자'],
    tradition: '저승사자가 나타나 따라오라 하면 인생의 큰 결정·전환점이 임박. 도망쳐 벗어나면 위기 회피, 따라가면 큰 변화 수용.',
    polarity: 'mixed',
  },
  {
    id: 'celebrity',
    label: '연예인·유명인',
    category: '인물',
    keywords: ['연예인', '아이돌', '배우', '가수', '스타', '유명인'],
    tradition: '연예인이 친밀하게 다가오면 인기·인정·사회적 주목. 유명인과 함께 있으면 그 분야의 기회 신호.',
    psychology: '자아 이상(Ego Ideal)의 투사. 이성 유명인은 아니마/아니무스.',
    polarity: 'good',
  },

  // ─── 사물·보석·재물 추가 ────────────────────────────
  {
    id: 'gold_silver',
    label: '금·은·옥',
    category: '사물',
    keywords: ['금', '황금', '금괴', '은', '옥', '비취', '진주'],
    tradition: '금·옥·진주는 장기적 재물·고귀함의 상징. 받거나 주우면 큰 재물 또는 귀한 자식 태몽.',
    polarity: 'good',
  },
  {
    id: 'diamond',
    label: '다이아·보석',
    category: '사물',
    keywords: ['다이아', '다이아몬드', '보석', '루비', '사파이어'],
    tradition: '큰 보석을 발견하거나 받으면 큰 재물·예술적 재능·귀한 딸 태몽.',
    polarity: 'good',
  },
  {
    id: 'amulet',
    label: '부적·반지·목걸이',
    category: '사물',
    keywords: ['부적', '반지', '목걸이', '귀걸이', '팔찌'],
    tradition: '부적을 받으면 액막이·가호. 반지를 받으면 결혼·약속·귀한 딸 태몽. 잃어버리면 관계·기반 약화.',
    polarity: 'good',
  },
  {
    id: 'book_letter',
    label: '책·편지·문서',
    category: '사물',
    keywords: ['책', '편지', '문서', '계약서', '두루마리', '붓'],
    tradition: '책·두루마리를 펼치거나 편지를 받는 꿈은 학문성취·좋은 소식·계약 성사. 검은 봉투·찢어진 문서는 흉사 또는 약속 파기.',
    polarity: 'mixed',
  },
  {
    id: 'clothes_hanbok',
    label: '옷·한복·수의',
    category: '사물',
    keywords: ['옷', '한복', '드레스', '양복', '수의', '갑옷', '제복'],
    tradition: '깨끗한 새 옷·한복은 새 출발·승진·인연. 갑옷은 보호·승리. 수의는 의외로 장수·재생의 역몽. 더러운 옷은 평판 점검.',
    polarity: 'mixed',
  },
  {
    id: 'naked_undies',
    label: '속옷·반나체',
    category: '사물',
    keywords: ['속옷', '반나체', '맨몸'],
    tradition: '속옷 차림 또는 반나체로 공공장소에 나타나는 꿈은 약점 노출 불안. 편안했다면 진짜 자기를 받아들이는 신호.',
    psychology: '페르소나 박탈·자기 수용.',
    polarity: 'neutral',
  },

  // ─── 가옥 구조 추가 ────────────────────────────────
  {
    id: 'stairs',
    label: '계단·엘리베이터',
    category: '사물',
    keywords: ['계단', '엘리베이터', '에스컬레이터', '층계'],
    tradition: '계단을 오르면 승진·지위 상승. 내리면 정리·종결. 미끄러지거나 무너지면 진행 중인 일에 제동.',
    psychology: '의식 수준의 이행·자기 탐사.',
    polarity: 'mixed',
  },
  {
    id: 'kitchen',
    label: '부엌·아궁이',
    category: '사물',
    keywords: ['부엌', '아궁이', '주방', '솥걸이'],
    tradition: '부엌이 깨끗하고 음식이 가득하면 가운(家運) 융성. 부엌에 불이 꺼져 있으면 살림의 어려움.',
    polarity: 'mixed',
  },
  {
    id: 'toilet',
    label: '화장실·변소',
    category: '사물',
    keywords: ['화장실', '변소', '뒷간'],
    tradition: '화장실에서 시원하게 일을 보면 묵은 문제 해소·재물 정리. 화장실이 더럽거나 막혀 있으면 답답한 일이 쌓임.',
    polarity: 'mixed',
  },
  {
    id: 'well',
    label: '우물·샘',
    category: '사물',
    keywords: ['우물', '샘', '약수터', '용천'],
    tradition: '맑은 우물물을 길어 마시면 재물·건강·지혜의 길조. 우물이 마르거나 더러우면 자원 고갈 경고.',
    psychology: '무의식의 깊은 자원·내면의 지혜.',
    polarity: 'good',
  },
  {
    id: 'window',
    label: '창문·열린 문',
    category: '사물',
    keywords: ['창문', '열린문', '문이열려'],
    tradition: '창문이 활짝 열려 빛이 들어오면 새 기회·전환점. 깨진 창은 사생활 노출 또는 예기치 못한 사건.',
    polarity: 'mixed',
  },

  // ─── 무덤·장례 ─────────────────────────────────────
  {
    id: 'coffin',
    label: '관·시체',
    category: '사물',
    keywords: ['관', '시체', '죽은사람몸', '주검'],
    tradition: '관이 집 안으로 들어오거나 시체를 보는 꿈은 의외의 큰 길몽 — 관운·재물·승진. 다만 자기 관이라도 두려움이 컸다면 변화에 대한 저항.',
    polarity: 'good',
  },
  {
    id: 'funeral',
    label: '장례·상복·제사',
    category: '행위',
    keywords: ['장례', '상복', '제사', '차례', '발인'],
    tradition: '장례식·제사 꿈은 옛 자기·옛 관계의 정리와 새 시작. 상복을 입고 평온했다면 새 인생 시작의 신호.',
    polarity: 'mixed',
  },

  // ─── 천체 추가 ─────────────────────────────────────
  {
    id: 'eclipse',
    label: '일식·월식',
    category: '자연',
    keywords: ['일식', '월식', '해가림', '달가림'],
    tradition: '일식·월식은 권력자의 변고 또는 큰 정치적·사회적 사건의 예고. 개인적으로는 큰 결단·전환의 임박.',
    polarity: 'mixed',
  },
  {
    id: 'meteor',
    label: '유성·혜성',
    category: '자연',
    keywords: ['유성', '혜성', '별똥별', '별이떨어'],
    tradition: '별이 품에 떨어지는 꿈은 귀한 자식 태몽의 최상위. 김유신·자장율사 어머니의 태몽으로 유명. 멀리 떨어진 별은 큰 기회 임박.',
    polarity: 'good',
  },

  // ─── 색 추가 ───────────────────────────────────────
  {
    id: 'color_gold',
    label: '금색·황금색',
    category: '숫자색',
    keywords: ['금색', '황금색', '금빛'],
    tradition: '금색·황금빛은 재물·권력·왕재의 최상위 길조. 황금에 둘러싸이면 큰 부와 명예.',
    polarity: 'good',
  },
  {
    id: 'color_blue',
    label: '파란색·청록',
    category: '숫자색',
    keywords: ['파란', '파랑', '청색', '청록', '하늘색'],
    tradition: '파란색은 수(水)의 기운 — 재물의 흐름·지혜. 맑은 하늘색은 마음의 평정과 새 기회.',
    polarity: 'good',
  },
  {
    id: 'color_green',
    label: '초록색·연두',
    category: '숫자색',
    keywords: ['초록', '녹색', '연두', '푸른'],
    tradition: '초록은 목(木)의 기운 — 성장·생명·건강. 푸른 들판이나 푸른 옷은 새 출발의 길조.',
    polarity: 'good',
  },
  {
    id: 'color_yellow',
    label: '노란색',
    category: '숫자색',
    keywords: ['노란', '노랑', '황색'],
    tradition: '노란색은 토(土)의 기운 — 안정·중심·재물의 누적. 황금색과 가까울수록 길조 강함.',
    polarity: 'good',
  },

  // ─── 숫자 ──────────────────────────────────────────
  {
    id: 'numbers_lucky',
    label: '숫자(1·3·7·9)',
    category: '숫자색',
    keywords: ['숫자', '1', '3', '7', '9', '777'],
    tradition: '1은 시작·유일, 3은 천지인 조화, 7은 신성·완성, 9는 양의 극치. 꿈에서 또렷이 본 숫자는 행운수로 기억해둘 가치.',
    polarity: 'good',
  },

  // ─── 행위 추가 ─────────────────────────────────────
  {
    id: 'sex_intimacy',
    label: '성관계·키스',
    category: '행위',
    keywords: ['성관계', '섹스', '키스', '입맞춤', '안고있'],
    tradition: '성관계·키스 꿈은 깊은 결합·생명력·창조의 응축. 누구와 했는가보다 그 감정(따뜻함/거부감)이 길흉을 가른다.',
    psychology: 'Coniunctio — 대립의 통합. 자기 안의 두 면의 결합.',
    polarity: 'mixed',
  },
  {
    id: 'breakup',
    label: '이별·헤어짐',
    category: '행위',
    keywords: ['이별', '헤어졌', '헤어지', '결별'],
    tradition: '이별 꿈은 실제 이별보다 한 국면의 종결·내려놓음의 신호. 시원했다면 정리 완성, 슬펐다면 미해결 감정 잔존.',
    polarity: 'mixed',
  },
  {
    id: 'proposal',
    label: '청혼·약혼',
    category: '행위',
    keywords: ['청혼', '약혼', '프러포즈', '반지받'],
    tradition: '청혼·약혼 장면은 새로운 관계 또는 사업 결합의 예고. 받아들였다면 좋은 인연, 거절했다면 잠재된 망설임.',
    polarity: 'good',
  },
  {
    id: 'pass_exam',
    label: '합격·승리',
    category: '행위',
    keywords: ['합격', '붙었', '승리', '이겼', '수상'],
    tradition: '꿈에서 합격하거나 이기면 실제 결과도 좋을 가능성. 다만 너무 쉬운 합격은 방심 경계.',
    polarity: 'good',
  },
  {
    id: 'move_house',
    label: '이사·이동',
    category: '행위',
    keywords: ['이사', '이동', '거처옮'],
    tradition: '이사 꿈은 실제 환경·관계·직장의 전환 임박. 새 집이 밝고 넓으면 좋은 전환, 좁고 어두우면 신중함 필요.',
    polarity: 'mixed',
  },
  {
    id: 'travel',
    label: '여행·길떠남',
    category: '행위',
    keywords: ['여행', '길떠나', '출발', '먼길'],
    tradition: '여행 꿈은 인생의 새 국면·자기 탐색. 짐을 잘 챙겼다면 준비된 출발, 잃어버렸다면 미흡한 준비.',
    polarity: 'mixed',
  },
  {
    id: 'driving',
    label: '운전·핸들',
    category: '행위',
    keywords: ['운전', '핸들', '브레이크', '액셀'],
    tradition: '내가 운전대를 잡으면 주도권 확보. 사고가 나거나 브레이크가 안 들으면 통제 상실 경고.',
    polarity: 'mixed',
  },
  {
    id: 'speech',
    label: '발표·연설',
    category: '행위',
    keywords: ['발표', '연설', '강의', '많은사람앞'],
    tradition: '많은 사람 앞에서 또렷이 발표하면 인정·승진의 신호. 말이 막히거나 옷이 흐트러지면 준비 부족 또는 불안.',
    polarity: 'mixed',
  },
  {
    id: 'bath_wash',
    label: '목욕·씻기',
    category: '행위',
    keywords: ['목욕', '씻었', '샤워', '몸을씻'],
    tradition: '맑은 물에 시원하게 목욕하면 묵은 일·관계의 정화. 흙탕물에서 씻으면 정화가 어렵거나 오히려 더러워짐.',
    polarity: 'good',
  },

  // ─── 음식 추가 ─────────────────────────────────────
  {
    id: 'rice_cake',
    label: '떡·전통음식',
    category: '사물',
    keywords: ['떡', '백설기', '인절미', '시루떡'],
    tradition: '떡을 받거나 나누는 꿈은 복덕·잔치·결실. 시루떡이 김 나며 익으면 가운(家運) 융성.',
    polarity: 'good',
  },
  {
    id: 'meat_fish',
    label: '고기·생선 음식',
    category: '사물',
    keywords: ['고기', '생선요리', '회', '구이'],
    tradition: '잘 익은 고기·생선을 받거나 먹으면 풍요·식록(食祿). 비린내가 강하거나 상한 음식이면 구설·건강 주의.',
    polarity: 'mixed',
  },
  {
    id: 'alcohol',
    label: '술·잔치 음료',
    category: '사물',
    keywords: ['술', '막걸리', '소주', '와인', '잔치술'],
    tradition: '맑은 술을 받거나 함께 마시면 좋은 만남·계약 성사. 취해 쓰러지면 분별 잃을 위험 경고.',
    polarity: 'mixed',
  },

  // ─── 식물 추가 ─────────────────────────────────────
  {
    id: 'pine_bamboo',
    label: '소나무·대나무',
    category: '자연',
    keywords: ['소나무', '대나무', '청송', '왕대'],
    tradition: '소나무·대나무는 절개·장수·곧음의 상징. 청청한 소나무 숲은 가문의 번창과 자손의 강건함.',
    polarity: 'good',
  },
  {
    id: 'ginseng',
    label: '인삼·산삼',
    category: '자연',
    keywords: ['인삼', '산삼', '약초'],
    tradition: '산삼·인삼은 귀한 자식 태몽 또는 큰 횡재·장수의 강한 길조. 캐어 손에 쥐면 더욱 강함.',
    polarity: 'good',
  },
  {
    id: 'lotus',
    label: '연꽃',
    category: '자연',
    keywords: ['연꽃', '연못꽃'],
    tradition: '연꽃은 진흙 속의 고결함 — 영성·고귀함의 태몽 또는 큰 명예. 활짝 핀 연꽃은 깨달음·성취.',
    polarity: 'good',
  },
  {
    id: 'plum_blossom',
    label: '매화·난초·국화',
    category: '자연',
    keywords: ['매화', '난초', '국화', '사군자'],
    tradition: '사군자는 학자·절개·인격의 상징. 매화·난초 꿈은 학문성취·교양 있는 자식 태몽.',
    polarity: 'good',
  },

  // ─── 자연재해 ──────────────────────────────────────
  {
    id: 'flood',
    label: '홍수·큰물',
    category: '자연',
    keywords: ['홍수', '큰물', '물난리'],
    tradition: '홍수가 집으로 들어오면 의외로 큰 재물의 길조. 자기를 휩쓸어 가면 큰 변동 — 통제 어려움.',
    polarity: 'mixed',
  },
  {
    id: 'typhoon',
    label: '태풍·폭풍',
    category: '자연',
    keywords: ['태풍', '폭풍', '강풍'],
    tradition: '태풍이 지나가면 큰 정리·전환. 안전한 곳에서 지켜봤다면 시련을 비켜 가는 신호.',
    polarity: 'mixed',
  },
  {
    id: 'earthquake',
    label: '지진',
    category: '자연',
    keywords: ['지진', '땅이흔들', '진동'],
    tradition: '지진은 기반·정체성의 흔들림. 무너지지 않고 버텼다면 큰 시련을 견뎌낸다는 신호.',
    psychology: '정체성 토대의 동요.',
    polarity: 'bad',
  },
];

// ════════════════════════════════════════════════════════
// 12지시 영험도 (Sijin Rules)
// 동양 전통의 시간대별 꿈 영험도 — 사주 데이터와 결합하여 시각화 가능
// ════════════════════════════════════════════════════════

export interface SijinRule {
  id: string;
  label: string;           // 한자+한글
  hour: string;            // 시간 범위
  weight: 1 | 2 | 3 | 4 | 5; // 1=거의 잡몽, 5=최고 정몽
  note: string;            // 한 줄 의미
}

export const SIJIN_RULES: SijinRule[] = [
  { id: 'ja',  label: '자시 (子)', hour: '23:30~01:30', weight: 1, note: '초경몽 — 정신이 혼탁해 대부분 허몽' },
  { id: 'chuk',label: '축시 (丑)', hour: '01:30~03:30', weight: 2, note: '잠재의식 정리 — 풀이 가치 낮음' },
  { id: 'in',  label: '인시 (寅)', hour: '03:30~05:30', weight: 4, note: '정몽(正夢) — 적중률 높은 시간대' },
  { id: 'myo', label: '묘시 (卯)', hour: '05:30~07:30', weight: 5, note: '★ 새벽 꿈의 황금시간대 — 예지력 최고' },
  { id: 'jin', label: '진시 (辰)', hour: '07:30~09:30', weight: 3, note: '각몽기 — 상징몽 다수, 기억에 잘 남음' },
  { id: 'sa',  label: '사시 (巳)', hour: '09:30~11:30', weight: 2, note: '낮잠몽 — 가벼운 인상' },
  { id: 'o',   label: '오시 (午)', hour: '11:30~13:30', weight: 2, note: '낮잠몽 — 약한 정몽' },
  { id: 'mi',  label: '미시 (未)', hour: '13:30~15:30', weight: 1, note: '잡몽 빈도↑' },
  { id: 'sin', label: '신시 (申)', hour: '15:30~17:30', weight: 1, note: '잡몽 빈도↑' },
  { id: 'yu',  label: '유시 (酉)', hour: '17:30~19:30', weight: 2, note: '저녁몽 — 일상 잔상' },
  { id: 'sul', label: '술시 (戌)', hour: '19:30~21:30', weight: 2, note: '입몽기 — 사몽·오몽 빈도↑' },
  { id: 'hae', label: '해시 (亥)', hour: '21:30~23:30', weight: 1, note: '입몽기 — 정몽 가능성 낮음' },
];

/** 24시간 형식의 시각을 받아 해당 시진을 반환. 잘못된 입력은 null. */
export function findSijinByHour(hour24: number, minute: number = 0): SijinRule | null {
  if (Number.isNaN(hour24) || hour24 < 0 || hour24 > 23) return null;
  const minutes = hour24 * 60 + minute;
  // 자시는 23:30~01:30 으로 자정을 가로지름
  if (minutes >= 23 * 60 + 30 || minutes < 1 * 60 + 30) return SIJIN_RULES[0];
  if (minutes < 3 * 60 + 30) return SIJIN_RULES[1];
  if (minutes < 5 * 60 + 30) return SIJIN_RULES[2];
  if (minutes < 7 * 60 + 30) return SIJIN_RULES[3];
  if (minutes < 9 * 60 + 30) return SIJIN_RULES[4];
  if (minutes < 11 * 60 + 30) return SIJIN_RULES[5];
  if (minutes < 13 * 60 + 30) return SIJIN_RULES[6];
  if (minutes < 15 * 60 + 30) return SIJIN_RULES[7];
  if (minutes < 17 * 60 + 30) return SIJIN_RULES[8];
  if (minutes < 19 * 60 + 30) return SIJIN_RULES[9];
  if (minutes < 21 * 60 + 30) return SIJIN_RULES[10];
  return SIJIN_RULES[11];
}

// ════════════════════════════════════════════════════════
// 시간대 친화 라벨 (입력 UI 용)
// ════════════════════════════════════════════════════════

export interface TimeBand {
  id: 'dawn' | 'morning' | 'noon' | 'evening' | 'midnight' | 'unknown';
  label: string;
  sub: string;
  /** 대표 시각(시간만) — 시진 매핑용 */
  hour: number;
}

// hour는 각 시간대의 의도 시진 한복판 시각 (findSijinByHour 분기와 정합):
//   dawn=6(묘시 영험도 5★) / morning=8(진시 3) / noon=12(오시 2) /
//   evening=20(술시 2) / midnight=0(자시 1)
export const TIME_BANDS: TimeBand[] = [
  { id: 'dawn',     label: '새벽',   sub: '03:30~07:30 · 영험도 최고', hour: 6 },
  { id: 'morning',  label: '아침',   sub: '07:30~11:30 · 상징몽',       hour: 8 },
  { id: 'noon',     label: '낮·오후', sub: '11:30~17:30 · 잡몽',         hour: 12 },
  { id: 'evening',  label: '저녁',   sub: '17:30~21:30 · 입몽기',       hour: 20 },
  { id: 'midnight', label: '한밤중', sub: '21:30~03:30 · 깊은 잠',      hour: 0 },
  { id: 'unknown',  label: '모름',   sub: '시간 보정 없이 풀이',         hour: -1 },
];

// ════════════════════════════════════════════════════════
// 도메인 태그 (6 영역)
// 동양 풀이의 [oriental_domains] 섹션에서 사용
// ════════════════════════════════════════════════════════

export type DomainTag = '재물' | '인연' | '건강' | '시험·학업' | '직장·일' | '가족·관계';

export const DOMAIN_TAGS: { id: DomainTag; icon: string; color: string }[] = [
  { id: '재물',       icon: '◆', color: '#FBBF24' },
  { id: '인연',       icon: '♡', color: '#F87171' },
  { id: '건강',       icon: '+', color: '#34D399' },
  { id: '시험·학업',  icon: '✎', color: '#A78BFA' },
  { id: '직장·일',    icon: '▲', color: '#60A5FA' },
  { id: '가족·관계',  icon: '◎', color: '#F472B6' },
];

// ════════════════════════════════════════════════════════
// Jung Archetype 라벨 (서양 풀이 [western_archetypes] 섹션용)
// ════════════════════════════════════════════════════════

export type ArchetypeId = 'persona' | 'shadow' | 'anima' | 'animus' | 'self' | 'wise_elder' | 'inner_child' | 'trickster';

export const ARCHETYPE_LABELS: Record<ArchetypeId, { ko: string; desc: string; color: string }> = {
  persona:     { ko: '페르소나',       desc: '사회적 가면 — 외부에 보이는 자기',         color: '#94A3B8' },
  shadow:      { ko: '그림자',         desc: '의식이 거부한 자기 — 통합 과제',           color: '#7C3AED' },
  anima:       { ko: '아니마',         desc: '남성 안의 여성성 — 감정·직관·관계',         color: '#F472B6' },
  animus:      { ko: '아니무스',       desc: '여성 안의 남성성 — 의지·논리·행동',         color: '#60A5FA' },
  self:        { ko: '자기(Self)',     desc: '의식·무의식 통합의 중심 — 개성화 목표',     color: '#FBBF24' },
  wise_elder:  { ko: '노현자',         desc: '내면의 지혜 안내자',                       color: '#C9A6FF' },
  inner_child: { ko: '내면 아이',      desc: '취약성·창조성·신성한 가능성',               color: '#A7F3D0' },
  trickster:   { ko: '트릭스터',       desc: '전환·교란·새로운 관점',                    color: '#FB923C' },
};

// ════════════════════════════════════════════════════════
// 임상 유형 (서양 풀이 [western_diagnosis] 섹션용)
// 현대 dream science 분류
// ════════════════════════════════════════════════════════

export type ClinicalDreamType =
  | 'ordinary'        // 일상몽
  | 'vivid'           // 생생몽
  | 'lucid'           // 자각몽
  | 'nightmare'       // 악몽
  | 'recurring'       // 반복몽
  | 'threat_sim'      // 위협 시뮬레이션
  | 'continuity'      // 일상 연속
  | 'sleep_paralysis' // 가위눌림
  | 'false_awakening'; // 거짓 각성

export const CLINICAL_LABELS: Record<ClinicalDreamType, { ko: string; desc: string; color: string }> = {
  ordinary:        { ko: '일상몽',         desc: '평범한 일상 단편',                color: '#94A3B8' },
  vivid:           { ko: '생생몽',         desc: 'REM 후기 — 인상 강렬',           color: '#FBBF24' },
  lucid:           { ko: '자각몽',         desc: '꿈인 줄 아는 꿈 — 자기효능감',   color: '#A78BFA' },
  nightmare:       { ko: '악몽',           desc: '강한 부정 정서 동반',             color: '#F87171' },
  recurring:       { ko: '반복몽',         desc: '미해결 과제의 신호',              color: '#FB923C' },
  threat_sim:      { ko: '위협 시뮬레이션', desc: '추격·낙하 — 적응적 기능',         color: '#FB923C' },
  continuity:      { ko: '일상 연속',      desc: '현실 고민의 거울',                color: '#60A5FA' },
  sleep_paralysis: { ko: '가위눌림',       desc: 'REM atonia 정상 현상',           color: '#7C3AED' },
  false_awakening: { ko: '거짓 각성',      desc: '깬 줄 알았는데 꿈',               color: '#C9A6FF' },
};

/** 특수 규칙: 역몽(逆夢) — 흉해 보이지만 길한 것들 */
export const REVERSE_DREAM_NOTES = [
  '꿈에서 "죽음·장례·피·똥·불"은 전통적으로 역몽(逆夢)으로, 실제로는 재생·재물·변화의 길몽으로 본다.',
  '"돈을 직접 받는 꿈"은 오히려 지출의 암시가 많고, "돈을 잃거나 쓰는 꿈"이 실제 수입의 전조인 경우가 많다.',
  '"우는 꿈"은 시원하게 울었다면 응어리 해소 후의 길몽이다.',
];

/** 공통 해석 프레임 — 프롬프트에 상수 블록으로 주입 */
export const DREAM_FRAMEWORK = `[꿈해몽 해석 프레임 — 순서대로 적용]
1) 꿈 종류 판별 — 태몽/예지몽/심리몽/길몽/흉몽 중 어느 유형에 가까운지 [꿈 종류 체크리스트] 근거로 추정
2) 상징 추출 — 매칭된 [꿈속 상징]의 전통 의미를 우선 인용
3) 맥락 가중 — [맥락 규칙]에 따라 "보는/당하는/품는/쫓기는" 의미 강도를 조정
4) 감정 가중 — [감정 규칙]으로 길흉 방향을 최종 조정(감정이 상징보다 우선)
5) 역몽 확인 — [역몽 규칙]에 해당하면 반대 해석을 먼저 검토
6) 최종 해석 — 사용자의 현실에 어떤 힌트를 주는지 단정적으로 제시`;

/**
 * 꿈 종류 판별 체크리스트
 * - 사주처럼 수식적 계산은 없으나, 해몽가들이 통상 쓰는 판별 기준을 명문화.
 * - AI는 각 체크리스트에 몇 개 부합하는지 추정해 "가능성 높음/경향 있음/해당 없음"으로 판정.
 */
export const DREAM_TYPE_CHECKLIST = `[꿈 종류 체크리스트]
■ 태몽(胎夢) 가능성 — 아래 중 2개 이상 부합 시 태몽 가능성 높음
  1) 본인/배우자/가까운 가족 중 임신 가능성 있는 사람이 있다
  2) 용·뱀·호랑이·돼지·물고기·과일·해·달·꽃·보석 중 하나 이상 등장
  3) 그 대상을 "본 것"이 아니라 품에 안거나, 잡거나, 먹거나, 받았다
  4) 꿈이 유난히 생생하고 깼을 때 "이건 특별한 꿈"이라는 직감이 있다

■ 예지몽 가능성 — 아래 중 2개 이상 부합 시 예지몽 경향
  1) 새벽 3~7시에 꾼 꿈이다(전통적으로 예지력 높다고 본다)
  2) 꿈이 생생·논리적이고 현실처럼 일관되게 진행됐다
  3) 같은 꿈을 반복해서 꾼다
  4) 꿈의 구체적 장면이 최근 현실의 특정 상황과 바로 연결된다

■ 심리몽 가능성 — 아래 중 2개 이상 부합 시 심리몽 경향(무의식의 반영)
  1) 최근 스트레스·고민·관계 문제가 장면에 그대로 투영되어 있다
  2) 비논리적·조각난 전개이고 깨고 나면 내용이 쉽게 흐려진다
  3) 시험·추락·쫓김·발가벗음·늦음 같은 스트레스 정형 장면이다
  4) 반복되는 악몽 성격이다

■ 길몽 신호 — 빛·상승·풍요·따뜻함·깨끗한 물·해·달·용·봉황·돼지·똥·피(역몽)
■ 흉몽 신호 — 어둠·추락·끊김·더러움·쫓김·무서움. 단 [역몽 규칙]으로 재판정 필요.

[주의] 태몽·예지몽·심리몽은 서로 배타적이지 않다. 동시에 해당할 수 있다.
판별 근거를 반드시 본문에서 한 문장으로 명시할 것("새벽에 반복해서 꾸셨다고 하셔서 예지몽 경향으로 봅니다" 식).`;

/**
 * 맥락 규칙 — 같은 상징도 "어떻게 등장했는가"로 의미가 달라진다.
 * 키워드 매칭 결과 폴라리티에 가중치를 주는 개념적 지침.
 */
export interface ContextRule {
  action: string;
  keywords: string[];
  strengthNote: string;
}

export const CONTEXT_RULES: ContextRule[] = [
  { action: '보다(관찰)',    keywords: ['봤', '보았', '보이', '보더라', '나타났'],
    strengthNote: '의미 세기 중간. 객관 상태 확인의 성격.' },
  { action: '품다/안다/소유', keywords: ['품', '안았', '껴안', '받았', '얻었', '가졌'],
    strengthNote: '의미 세기 최강(+). 내 것이 됨 — 길몽은 더 길몽, 흉몽은 나에게 직접 영향.' },
  { action: '먹다/마시다',   keywords: ['먹', '마셨', '삼켰'],
    strengthNote: '의미 세기 강(+). 내면화 — 태몽 맥락에서는 아기를 잉태하는 암시.' },
  { action: '타다/운전',     keywords: ['탔', '타고', '운전', '몰고'],
    strengthNote: '의미 세기 강. 주도권·추진력 상승/하락의 신호.' },
  { action: '당하다/물리다', keywords: ['물렸', '당했', '맞았', '잡혔'],
    strengthNote: '의미 세기 강(-). 수동적 영향 — 좋은 상징이면 귀인 개입, 나쁜 상징이면 공격.' },
  { action: '쫓기다/도망',   keywords: ['쫓겼', '도망', '쫓아', '피했'],
    strengthNote: '의미 세기 강. 회피 중인 현실 문제의 투영이 큼.' },
  { action: '싸우다/다투다', keywords: ['싸웠', '다퉜', '공격'],
    strengthNote: '의미 세기 중간. 갈등 상황 — 이겼는지 졌는지가 길흉을 가름.' },
  { action: '죽다/죽이다',   keywords: ['죽', '죽었', '죽였'],
    strengthNote: '역몽 1순위. 내가 죽으면 재생·변화, 남을 죽이면 관계 종결.' },
  { action: '날다/오르다',   keywords: ['날았', '올라', '비행', '솟아'],
    strengthNote: '의미 세기 강(+). 성취·해방·상승.' },
  { action: '떨어지다',      keywords: ['떨어', '추락', '빠졌'],
    strengthNote: '의미 세기 강(-). 통제 상실. 부드럽게 착지하면 연착륙의 길조.' },
  { action: '찾다/잃다',     keywords: ['찾았', '잃었', '잃어'],
    strengthNote: '의미 세기 중간. 잃는 쪽이 더 직접적.' },
];

/**
 * 감정 규칙 — 꿈 속에서 느낀 감정은 길흉을 결정적으로 가름.
 * 같은 뱀이라도 따뜻했는가/무서웠는가로 해석이 180도 바뀐다.
 */
export interface EmotionRule {
  emotion: string;
  keywords: string[];
  modifier: 'strong+' | 'mild+' | 'neutral' | 'mild-' | 'strong-';
  note: string;
}

export const EMOTION_RULES: EmotionRule[] = [
  { emotion: '따뜻함/편안함',  keywords: ['따뜻', '편안', '포근', '안심', '평온'],
    modifier: 'strong+', note: '흉몽 상징이어도 길몽 쪽으로 전환 가능. 관계·재물·건강 개선 신호.' },
  { emotion: '기쁨/설렘',      keywords: ['기뻤', '즐거', '설렜', '행복', '웃었'],
    modifier: 'strong+', note: '기대했던 일이 이뤄진다는 신호.' },
  { emotion: '평온/담담',      keywords: ['담담', '평범', '그냥', '덤덤'],
    modifier: 'neutral', note: '감정 단서 약함. 상징과 맥락 위주로 해석.' },
  { emotion: '찜찜함/불안',    keywords: ['찜찜', '불안', '께름', '이상'],
    modifier: 'mild-', note: '완전한 흉몽은 아니지만 주의 신호. 현실의 불편함 점검 필요.' },
  { emotion: '슬픔/외로움',    keywords: ['슬펐', '외로', '쓸쓸', '눈물'],
    modifier: 'mild-', note: '정리·이별의 시기. 시원한 눈물이었다면 오히려 해소.' },
  { emotion: '무서움/공포',    keywords: ['무서', '두려', '겁났', '끔찍'],
    modifier: 'strong-', note: '길몽 상징이어도 길함을 잃을 수 있음. 회피 중인 현실 문제의 강력한 신호.' },
  { emotion: '분노/짜증',      keywords: ['화났', '분노', '짜증', '격분'],
    modifier: 'mild-', note: '억눌린 갈등. 가까운 관계에서 풀어야 할 실마리가 있음.' },
];

/** Mode B(흐릿) 가이드용 칩 그룹 — UI에서 다중 선택으로 노출 */
export interface ChipGroup {
  id: 'people' | 'animal' | 'nature' | 'object' | 'place' | 'action' | 'emotion';
  label: string;
  question: string;
  items: string[];
}

export const DREAM_CHIP_GROUPS: ChipGroup[] = [
  {
    id: 'people',
    label: '사람',
    question: '꿈에 누가 나왔나요?',
    items: [
      '돌아가신 분(조상·고인)',
      '부모님',
      '형제·자매',
      '배우자',
      '연인',
      '친구',
      '직장 동료·상사',
      '낯선 사람',
      '아기(갓난아이)',
      '아이(어린이)',
      '유명인·스타',
      '신(神)·종교적 존재',
      '나 자신',
    ],
  },
  {
    id: 'animal',
    label: '동물',
    question: '어떤 동물이 나왔나요?',
    items: [
      '돼지',
      '뱀·구렁이',
      '용',
      '호랑이',
      '사자·곰',
      '개(강아지)',
      '고양이',
      '쥐',
      '까치·비둘기',
      '까마귀',
      '봉황·학',
      '물고기·잉어',
      '소·말',
      '벌레·곤충',
    ],
  },
  {
    id: 'nature',
    label: '자연',
    question: '어떤 자연이 보였나요?',
    items: [
      '맑은 물(강·호수)',
      '바다·파도',
      '홍수·큰물',
      '탁한 물·더러운 물',
      '불꽃·모닥불',
      '큰 화재·집이 탐',
      '해·태양',
      '달',
      '별·유성',
      '산·큰 바위',
      '나무·숲',
      '비·눈',
      '하늘·구름',
      '땅·흙·진흙',
    ],
  },
  {
    id: 'object',
    label: '사물',
    question: '어떤 사물이 나왔나요?',
    items: [
      '돈·지폐',
      '금·보석',
      '집·건물',
      '자동차',
      '버스·기차',
      '비행기·배',
      '음식·떡',
      '꽃·과일',
      '칼·무기',
      '옷·신발',
      '책·편지',
      '거울·유리',
      '열쇠·문',
    ],
  },
  {
    id: 'place',
    label: '장소',
    question: '어디서 일어난 꿈인가요?',
    items: [
      '우리 집',
      '과거 살던 집',
      '모르는 집',
      '학교',
      '직장·사무실',
      '길거리·시내',
      '바닷가·강가',
      '산·숲속',
      '병원',
      '결혼식장',
      '장례식장',
      '시험장·면접장',
      '모르는 낯선 곳',
    ],
  },
  {
    id: 'action',
    label: '행동·상황',
    question: '꿈에서 무슨 일이 있었나요? (애매하면 여러 개 골라도 됩니다)',
    items: [
      '바라봤다·지켜봤다',
      '품에 안았다·받았다',
      '먹었다·마셨다',
      '차·배·비행기를 탔다',
      '불에 탔다·화상 입었다',
      '누가 불태웠다',
      '싸웠다·다퉜다',
      '누구에게 쫓겼다',
      '내가 쫓아갔다',
      '하늘을 날았다',
      '내가 높은 곳에서 떨어졌다',
      '물건을 잃어버렸다',
      '물건을 찾았다·주웠다',
      '내가 죽었다',
      '누구를 죽였다',
      '누가 죽는 걸 봤다',
      '울었다',
      '웃었다',
      '결혼식을 올렸다',
      '장례식에 갔다',
      '시험·면접을 봤다',
      '목욕·씻었다',
      '길을 잃었다',
      '발가벗었다',
    ],
  },
  {
    id: 'emotion',
    label: '감정',
    question: '꿈에서 느낀 기분은 어땠나요?',
    items: [
      '따뜻하고 편안함',
      '기쁨·설렘',
      '평온·담담함',
      '찜찜함·불안',
      '슬픔·외로움',
      '무서움·공포',
      '분노·짜증',
      '놀람',
      '기억 안 남',
    ],
  },
];

/** 구조화된 선택지 + 자유 메모를 프롬프트용 자연어 문장으로 합성 */
export interface StructuredDreamInput {
  selections: Partial<Record<ChipGroup['id'], string[]>>;
  note?: string;
  timeOfNight?: '새벽' | '한밤' | '아침' | '모름';
  isRepeating?: boolean;
}

export function composeDreamTextFromStructured(input: StructuredDreamInput): string {
  const parts: string[] = [];
  const groups = DREAM_CHIP_GROUPS;

  for (const g of groups) {
    const sel = input.selections[g.id];
    if (sel && sel.length > 0) {
      parts.push(`${g.label}: ${sel.join(', ')}`);
    }
  }
  if (input.timeOfNight && input.timeOfNight !== '모름') {
    parts.push(`꾼 시간대: ${input.timeOfNight}`);
  }
  if (input.isRepeating) {
    parts.push('반복해서 꾸는 꿈');
  }
  if (input.note && input.note.trim()) {
    parts.push(`추가 기억: ${input.note.trim()}`);
  }
  return parts.join('\n');
}

/**
 * 사용자 꿈 설명에서 KB 상징을 매칭한다.
 * - 모든 심벌의 키워드를 포함 검색(부분 일치).
 * - 최대 5개 반환(너무 많으면 프롬프트 과대).
 */
export function matchDreamSymbols(userText: string, maxHits: number = 5): DreamSymbol[] {
  if (!userText) return [];
  const text = userText.trim();
  if (text.length === 0) return [];

  const hits: { sym: DreamSymbol; rank: number }[] = [];
  for (const sym of DREAM_SYMBOLS) {
    let rank = 0;
    for (const kw of sym.keywords) {
      if (!kw) continue;
      if (text.includes(kw)) {
        // 긴 키워드(구체적) 우선
        rank += kw.length;
      }
    }
    if (rank > 0) hits.push({ sym, rank });
  }

  hits.sort((a, b) => b.rank - a.rank);
  return hits.slice(0, maxHits).map(h => h.sym);
}

/** 매칭된 상징 목록을 프롬프트용 텍스트 블록으로 직렬화. */
export function buildMatchedSymbolsBlock(matches: DreamSymbol[]): string {
  if (matches.length === 0) {
    return '[꿈속 상징 매칭 결과]\n직접 매칭된 전통 상징 없음 — 사용자의 문장 자체를 토대로 자유롭게 해석하되, 길흉 단정은 보수적으로 하세요.';
  }
  const lines = matches.map(s => {
    const pol = s.polarity === 'good' ? '길몽' : s.polarity === 'bad' ? '흉몽' : s.polarity === 'mixed' ? '길흉혼재' : '중립';
    return `• ${s.label} [${s.category}·${pol}] — ${s.tradition}${s.psychology ? ` (심리: ${s.psychology})` : ''}`;
  });
  return `[꿈속 상징 매칭 결과]\n${lines.join('\n')}`;
}
