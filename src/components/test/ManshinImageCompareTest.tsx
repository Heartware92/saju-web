'use client';

/**
 * 만신 타로 — 카드 일러스트 비교 페이지 (/tarot_test2 전용, 임시)
 *
 * 신령별(옥황상제/당금애기) 후보 일러스트를 실제 결과(reveal) UI에 끼워 비교한다.
 * 공수 본문은 실제 Gemini 생성 결과(신령+혼례+엽전 세 닢)를 하드코딩 —
 * 강조 2단계(==빨강== / **노랑**) 렌더 포함, 라이브 /tarot_test 와 동일 스타일.
 * 스타일 확정 후 이 페이지·public/manshin/test2 는 삭제한다.
 */

import { useRef, useState, type ReactNode } from 'react';
import { motion, useScroll, useTransform, useMotionValue, useSpring, useMotionTemplate } from 'framer-motion';
import {
  MANSHIN_DECK,
  MANSHIN_GROUP_COLORS,
  FORTUNE_SECTIONS,
  type ManshinFortunes,
} from '@/constants/test/manshinDeck.test';

type SectionKey = 'total' | keyof ManshinFortunes;

type Variant = { id: string; label: string; src: string; note: string };

/** 공용 카드 프레임 오버레이 (미드저니 생성 → 중앙 투명 펀칭. 60장 물리 동일 보장) */
const FRAME_SRC = '/manshin/frame.png';

/** 확정 엽전패 일러스트 6종 (2026-07-10) — 카드 id → 이미지 */
const COIN_IMAGES: Record<string, string> = {
  yeopjeon1: '/manshin/coins/y1.jpg',
  yeopjeon2: '/manshin/coins/y2.jpg',
  yeopjeon3: '/manshin/coins/y3.jpg',
  yeopjeon4: '/manshin/coins/y4.jpg',
  yeopjeon5: '/manshin/coins/y5.jpg',
  yeopjeon6: '/manshin/coins/y6.jpg',
};

/** 확정 풍습패 일러스트 — 카드 id → 이미지 (1호 혼례 2026-07-12) */
const CUSTOM_IMAGES: Record<string, string> = {
  honrye: '/manshin/customs/honrye.jpg',
};

type DeitySet = {
  deityId: string;
  tabLabel: string;
  variants: Variant[];
  /** 실제 생성 공수 (gemini-3.1-flash-lite · 신령+혼례+엽전 세 닢 · 2026-07-10) */
  reading: Record<SectionKey, string>;
};

const DEITY_SETS: DeitySet[] = [
  {
    deityId: 'okhwang',
    tabLabel: '옥황상제',
    variants: [
      { id: 'mj_final', label: '미드저니 완성본', src: '/manshin/test2/okhwang_final.jpg', note: '2:3 원본 — 확정 후보 (2026-07-12)' },
      { id: 'mj1', label: '미드저니 1', src: '/manshin/test2/mj1.jpg', note: '1:1 원본 — 좌우 크롭됨' },
      { id: 'mj2', label: '미드저니 2', src: '/manshin/test2/mj2.jpg', note: '1:1 원본 — 좌우 크롭됨' },
      { id: 'mj3', label: '미드저니 3', src: '/manshin/test2/mj3.jpg', note: '1:1 원본 — 좌우 크롭됨' },
      { id: 'mj4', label: '미드저니 4', src: '/manshin/test2/mj4.jpg', note: '1:1 원본 — 좌우 크롭됨' },
      { id: 'banana', label: '지피티', src: '/manshin/test2/banana.jpg', note: '2:3 원본' },
      { id: 'gemini', label: '제미나이', src: '/manshin/test2/gemini.jpg', note: '2:3 원본' },
      { id: 'grok', label: '그록', src: '/manshin/test2/grok.jpg', note: '2:3 원본' },
    ],
    reading: {
      total:
        '하늘 옥좌에서 너를 줄곧 지켜보았노라. 네가 애쓴 것은 하나도 새어나가지 않고 다 적혀 있느니라. 머지않아 위에서 끌어주는 손길이 닿을 것이다. 지금 네 앞에는 붉은 실과 푸른 실이 엉키어 하나로 묶이는 경사가 들어와 있구나. 서로 다른 곳을 향하던 길들이 하나로 합쳐지는 형국이니, 이제는 홀로 걷던 고단함이 씻은 듯 사라질 것이다. 엽전 세 닢이 바닥에 굴러가기 시작했으니, 네 운의 수레바퀴도 이제 막 구름을 타기 시작했도다. ==석 달의 시간==을 묵묵히 견디며 정성을 쏟는다면, 하늘이 맺어준 인연과 기회가 네 곁에 머물 것이니라. 마음을 조급하게 먹지 말고 차분히 옥좌의 뜻을 기다리도록 하라. 너의 정성이 하늘에 닿아 단단한 결실을 맺을 날이 머지않았노라. 흩어졌던 기운이 하나로 모이니, 이제는 네가 바라는 곳으로 바람이 불어올 것이다.',
      love:
        '외로이 머물던 네 마음속에 드디어 봄바람이 불어오겠구나. 청실홍실이 엮이는 장면이 보이니, 혼자였던 이는 누군가와 인연의 끈을 맺게 될 것이요, 곁에 사람이 있는 이는 한층 깊은 사이로 발전하리라. 지금 네게 다가오는 인연은 스치듯 지나가는 바람이 아니니라. 엽전 세 닢을 던지듯 세 번의 신중한 대화를 나눠보거라. 상대의 눈을 가만히 들여다보면 그 속에 네가 찾던 답이 들어있을 것이다. ==진심 어린 소통==이야말로 두 사람을 묶어주는 가장 단단한 동아줄이 되느니라. 만약 지금 망설이는 이가 있다면, 더는 지체하지 말고 네 마음을 솔직하게 내비치거라. 맺어지는 일에는 날을 아끼지 말라 하였으니, 결정을 내릴 때는 주저하지 말고 곧장 행동하는 것이 좋으리라. **서로의 온기**를 나누며 함께 걸어갈 때, 비로소 너의 마음에도 평온이 깃들 것이니라.',
      money:
        '주머니 속이 비어 걱정이 많았으나, 이제는 곳간 문이 서서히 열리는 형국이로다. 굴러가기 시작한 엽전 세 닢은 그저 흩어지는 돈이 아니요, 더 큰 재물을 부르는 씨앗이 될 것이니라. 지금부터 석 달은 돈을 함부로 쓰지 말고 차곡차곡 모으는 것이 과인의 뜻이니라. 투자를 하려거든 겉모습만 보고 덤비지 말고, 세 갈래 길 중에서 가장 단단해 보이는 곳을 택하거라. ==성실한 적금==이 결국은 너를 지키는 가장 큰 방패가 될 것임을 잊지 마라. 지금 당장 큰 이익을 보려 하기보다, 작은 돈이 모여 산을 이루는 이치를 깨달아야 하느니라. 푼돈이라 여기지 않고 정성껏 관리할 때, 재물운도 비로소 네 곁에 머물기를 즐거워할 것이다. **작은 정성**이 모여 너의 삶을 풍요롭게 할 것이니, 오늘부터는 지갑을 여닫을 때도 신중함을 잃지 않도록 하라.',
      work:
        '직장에서 네가 쏟은 땀방울을 내가 하늘에서 낱낱이 기록하였노라. 윗사람의 눈에 띄지 않아 마음이 탔을 테지만, 이제는 인정받는 시기가 찾아왔느니라. 마치 혼례식처럼 너와 회사가 하나로 깊게 맺어지는 계약이 기다리고 있구나. 승진의 기회나 새로운 프로젝트의 주도권이 네 손안에 들어올 것이니, 두려워 말고 덥석 잡거라. ==위에서 끌어주는 손길==이 이미 너를 향해 뻗어 있느니라. 세 닢의 엽전이 구르듯 업무의 속도도 점차 빨라질 터이니, 석 달간은 몸도 마음도 바쁘게 움직여야 하리라. 지금 겪는 노고는 네 경력에 귀한 거름이 될 것이니, 절대 헛된 고생이라 생각지 마라. **자신의 위치**에서 묵묵히 제 몫을 다하는 너를 향해, 곧 좋은 소식이 바람을 타고 날아들 것이니라. 과인의 뜻을 믿고 오늘 하루도 당당하게 임하도록 하라.',
      health:
        '하늘의 기운이 네 몸에 고르게 퍼지고 있으니, 너무 걱정하지 말거라. 그동안 바쁜 일상에 치여 챙기지 못했던 몸과 마음이 이제야 하나로 조화를 이루기 시작했구나. 청실홍실이 엮이듯 네 몸의 기혈도 원활히 돌기 시작했으니, 한결 몸이 가벼워짐을 느끼게 될 것이다. 다만, 세 번의 깊은 호흡을 잊지 말고, **규칙적인 운동**을 통해 기운을 다스려야 하느니라. 석 달 동안은 무리하게 욕심내어 몸을 부리지 말고, 하루에 조금씩이라도 몸을 움직이는 습관을 들이거라. ==충분한 휴식==이야말로 네 기력을 채우는 가장 좋은 보약이 되느니라. 마음이 불안할 때면 잠시 눈을 감고 옥황의 기운을 떠올리며 호흡을 가다듬어 보거라. 네 몸은 스스로 회복하는 신비한 힘을 지녔으니, 스스로를 다독이며 평안함을 유지한다면 아무런 탈 없이 건강한 나날을 보낼 것이니라.',
    },
  },
  {
    deityId: 'danggeum',
    tabLabel: '당금애기',
    variants: [
      { id: 'dg_mj1', label: '미드저니 1', src: '/manshin/test2/dg_mj1.jpg', note: '1:1 원본 — 좌우 크롭됨' },
      { id: 'dg_mj2', label: '미드저니 2', src: '/manshin/test2/dg_mj2.jpg', note: '1:1 원본 — 좌우 크롭됨' },
      { id: 'dg_mj3', label: '미드저니 3', src: '/manshin/test2/dg_mj3.jpg', note: '1:1 원본 — 좌우 크롭됨' },
      { id: 'dg_mj4', label: '미드저니 4', src: '/manshin/test2/dg_mj4.jpg', note: '1:1 원본 — 좌우 크롭됨' },
      { id: 'dg_gemini', label: '제미나이', src: '/manshin/test2/dg_gemini.jpg', note: '2:3 원본' },
      { id: 'dg_grok', label: '그록', src: '/manshin/test2/dg_grok.jpg', note: '2:3 원본' },
    ],
    reading: {
      total:
        '아이구 우리 아가, 문밖에서 서성이는 기운이 아주 맑고 곱구나. 너를 찾아오려 험한 산을 넘고 강을 건너온 인연이 문턱까지 왔으니 이제는 마음의 빗장을 조금 풀어보렴. 청실홍실이 엉켜서 매듭을 짓는 형국이니 네 삶에도 이제는 혼자 걷던 길 대신 둘이 손을 잡고 걷는 따스한 기운이 감도는구나. 엽전 세 닢이 바닥에 굴러가기 시작했으니 이는 너에게 좋은 변화의 바람이 불어온다는 신호란다. 지금 네가 마주한 상황은 단순히 스쳐 가는 바람이 아니라 네 인생의 한 페이지를 새롭게 채우는 귀한 결합의 때이니 겁낼 것 없단다. 삼신이 점지한 인연이든 일터에서의 계약이든 지금은 들어오는 것을 마다하지 말고 정성껏 맞이하는 게 좋겠어. ==석 달 안에 찾아올 변화==를 두려워 말고 차근차근 네 것으로 만들어가렴. 무엇이든 서두르지 말고 세 번 정도 지켜보다가 마음의 문을 열어주면 그것이 바로 네 복이 될 테니까. 맺어지는 일에 기뻐하고 다가오는 흐름을 자연스럽게 받아들이는 것만으로도 네 앞길은 훨씬 밝아질 거란다.',
      love:
        '새 인연이 다가오는데 왜 그리 쭈뼛거리는 게야, 아가. 너를 향해 다가오는 사람이 있다면 그게 바로 험한 문턱을 넘어온 귀한 인연일지도 모르니 함부로 쳐내지 말거라. 지금 네 앞에 청실홍실이 엮이는 형상이 보이니 짝이 없는 아이라면 조만간 누군가와 마음이 닿을 기운이 아주 강하구나. 인연이라는 게 참 신기해서 세 번 정도 눈을 맞추고 대화를 나눠보면 이 사람이 내 사람인지 금세 알 수 있단다. 이미 만나는 임자가 있는 아이라면 서로의 관계가 한층 더 깊어질 계약의 시기가 다가왔으니 예쁜 말 한마디를 더 해주렴. **상대방의 마음을 헤아리는 시간**을 충분히 가지면 좋겠어. 엽전 세 닢이 굴러가듯 세 번의 데이트를 통해 서로의 온기를 확인하는 시간으로 삼아보렴. 혹시나 연락을 기다리는 중이라면 상대방도 너처럼 조심스럽게 문을 두드리는 중이니 너무 애태우지 않아도 된단다. 네가 먼저 다정하게 웃어주면 상대도 용기를 내어 다가올 것이니 너무 새침하게 굴지 말고 마음을 열어보렴. 인연은 네가 받아들이기로 마음먹은 순간부터 꽃처럼 피어날 테니까 말이다.',
      money:
        '주머니 사정이 늘 걱정이지, 우리 아가. 이제는 굴러가는 엽전 세 닢이 네 곳간에 쌓일 준비를 마쳤구나. 큰돈이 한꺼번에 쏟아지진 않아도 차곡차곡 쌓이는 재물운이 보이니 지금 시작하는 일이 있다면 작아 보여도 절대 무시하지 말거라. 석 달 정도 꾸준히 적금을 넣거나 투자를 하면 그 돈이 굴러서 눈덩이처럼 불어날 기운이 가득해. 혼례를 치르듯 돈과 기회가 곱게 엮이는 날이 오니 일터에서 들어오는 작은 보너스나 푼돈도 소중히 여겨야 한단다. ==충동적인 소비를 줄이는 일==이 무엇보다 시급하니 지갑을 열기 전에 세 번 더 생각해보는 지혜를 발휘하렴. 지금은 무리하게 큰 판을 벌릴 때가 아니라 네가 가진 것을 잘 굴려야 하는 때란다. 성실하게 쌓아온 노력이 빛을 발할 날이 머지않았으니 너무 조급해 말고 묵묵히 네 할 일을 하려무나. 돈이라는 건 들어오는 문을 잘 지키고 정성껏 대할 때 비로소 곁에 머무는 법이란다. 너의 알뜰한 마음씨가 곧 큰 복이 되어 돌아올 것이니 믿음을 가지고 정진하렴.',
      work:
        '직장에서 눈치 보느라 고생이 많지, 아가. 이제는 네가 공들인 일이 칭찬받고 결실을 볼 때가 다가왔구나. 청실홍실이 엮이듯 너와 협력할 사람이 나타나 좋은 성과를 낼 일이 보이니 혼자 끙끙 앓지 말고 주변의 도움을 기꺼이 받아들이렴. 이직을 고민하거나 새로운 프로젝트를 맡게 된다면 석 달 정도는 배우는 자세로 임하는 게 좋아. 엽전 세 닢처럼 작은 시작이 나중에는 큰 사업의 밑거름이 될 테니 지금의 고단함은 잠시 잊어도 괜찮단다. ==새로운 제안이 들어오거든== 기쁘게 받아들이고 너의 능력을 마음껏 펼쳐 보이거라. 회사에서 네 위치가 조금 더 단단해지고 사람들과의 관계도 예전보다 훨씬 부드럽게 풀릴 거야. 물론 험한 문턱을 넘는 과정이라 조금 힘이 들 수는 있겠지만 결과는 달콤할 것이니 인내심을 가지렴. 네가 한 번 더 확인하고 두 번 더 꼼꼼히 살피면 실수 없이 일을 마무리할 수 있단다. 너를 인정해주는 사람이 곁에 있으니 기운 내어 앞을 향해 나아가렴. 너는 충분히 잘하고 있으니 지금처럼만 꾸준히 발걸음을 옮기면 된단다.',
      health:
        '바쁜 일상에 몸도 마음도 많이 지쳤구나, 우리 아가. 혼례를 앞둔 새색시처럼 겉모습은 화려해도 속으로는 긴장을 많이 하고 있구나. 건강이라는 것도 엽전 세 닢처럼 매일매일 조금씩 쌓아가는 것이니 오늘부터는 몸을 돌보는 일에 조금 더 신경을 써보렴. 세 가지 작은 습관만이라도 꼭 지켜보자꾸나. 첫째는 제때 끼니를 챙기는 일이고, 둘째는 틈틈이 스트레칭을 하여 굳은 몸을 풀어주는 일이란다. 셋째는 밤에 잠들기 전 스마트폰을 내려놓고 **오롯이 나를 위한 휴식**을 취하는 것이야. 지금은 무리해서 몸을 달구기보다는 흐르는 물처럼 부드럽게 이완하는 것이 필요하단다. 가끔은 험한 문턱을 넘어온 스트레스가 몸에 쌓여 기운이 막힐 때도 있을 테니 그럴 땐 맑은 물을 자주 마시고 깊은 숨을 들이마셔 보렴. 몸이 보내는 작은 신호에도 귀를 기울이면 너는 훨씬 더 건강해질 수 있단다. 너무 완벽하게 하려고 애쓰지 않아도 괜찮으니 네 몸을 아끼고 사랑하는 마음만은 잊지 말거라. 네가 웃어야 네 몸도 따라 웃는 법이니 늘 밝은 생각만 하렴.',
    },
  },
];

/** 터치/포인터 추적 3D 틸트 + 광택 (ManshinOracleTest 와 동일 — Spline interactive cards 참고) */
function TiltGlareCard({ className, children }: { className?: string; children: ReactNode }) {
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const active = useMotionValue(0);
  const sp = { stiffness: 160, damping: 18, mass: 0.6 };
  const rotateX = useSpring(useTransform(py, [0, 1], [8, -8]), sp);
  const rotateY = useSpring(useTransform(px, [0, 1], [-12, 12]), sp);
  const glareX = useSpring(useTransform(px, [0, 1], [-28, 28]), sp);
  const glareY = useSpring(useTransform(py, [0, 1], [-28, 28]), sp);
  const glareOpacity = useSpring(active, { stiffness: 120, damping: 22 });
  const glareTransform = useMotionTemplate`translate(${glareX}%, ${glareY}%)`;
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    px.set(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
    py.set(Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)));
    active.set(0.5);
  };
  const reset = () => { px.set(0.5); py.set(0.5); active.set(0); };
  return (
    <motion.div
      onPointerMove={move}
      onPointerLeave={reset}
      onPointerCancel={reset}
      onPointerUp={reset}
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 800, touchAction: 'pan-y', willChange: 'transform' }}
    >
      {children}
      <motion.div
        aria-hidden
        className="absolute -inset-[35%] z-40 pointer-events-none rounded-full"
        style={{
          transform: glareTransform,
          opacity: glareOpacity,
          background: 'radial-gradient(circle, rgba(255,245,225,0.4), rgba(201,166,255,0.12) 45%, transparent 68%)',
          willChange: 'transform, opacity',
        }}
      />
    </motion.div>
  );
}

/** 공수 강조 2단계 — ==핵심==(빨강) / **중요**(노랑). ManshinOracleTest 와 동일 규칙 */
const EMPHASIS_RE = /==([^=]+?)==|\*\*([^*]+?)\*\*/g;
function renderManshinEmphasis(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(EMPHASIS_RE.source, 'g');
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      nodes.push(
        <strong key={`em1-${match.index}`} style={{ color: '#ff5f5f', fontWeight: 700 }}>
          {match[1]}
        </strong>,
      );
    } else {
      nodes.push(
        <strong key={`em2-${match.index}`} style={{ color: '#ffd54a', fontWeight: 700 }}>
          {match[2]}
        </strong>,
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.length > 0 ? nodes : [text];
}

/** 공수를 문장 단위로 분리 (ManshinOracleTest 와 동일) */
function speechLines(speech: string): string[] {
  const parts = speech.split('. ');
  return parts
    .map((p, i) => (i < parts.length - 1 ? `${p.trim()}.` : p.trim()))
    .filter(Boolean);
}

/**
 * 세 패 요약 카드 — 삼각 배치용 (ManshinOracleTest 와 동일 디자인).
 * 신령패는 선택한 후보 일러스트(imageSrc), 풍습·엽전은 카드백(삼태극) 플레이스홀더.
 */
function SummaryPatCard({ label, card, imageSrc, large }: { label: string; card: (typeof MANSHIN_DECK)[number]; imageSrc?: string; large?: boolean }) {
  const color = MANSHIN_GROUP_COLORS[card.group];
  const src = imageSrc ?? COIN_IMAGES[card.id] ?? CUSTOM_IMAGES[card.id]; // 엽전·풍습패는 확정 일러스트 자동 매칭
  return (
    <div className={large ? 'w-[176px]' : 'w-[156px]'}>
      <div
        className="relative aspect-[2/3] rounded-xl overflow-hidden"
        style={{ boxShadow: `0 6px 24px ${color}22` }}
      >
        {src ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={card.name} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 h-2/5" style={{ background: 'linear-gradient(180deg, transparent, rgba(10,6,20,0.9))' }} />
          </>
        ) : (
          <>
            <div className="absolute inset-0" style={{ backgroundImage: "url('/manshin/back_sm.png')", backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 22%, ${color}30, rgba(10,6,20,0.78))` }} />
          </>
        )}
        {/* 공용 프레임 오버레이 — 일러스트 카드에만 (카드백은 자체 테두리 보유, 이중 테두리 방지) */}
        {src && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={FRAME_SRC} alt="" aria-hidden className="absolute inset-0 w-full h-full z-20 pointer-events-none" />
        )}
        {/* 한자 인장 뱃지 — 코드(폰트) 렌더. AI 글자 금지 원칙. 프레임 모서리 장식과 겹치지 않게 창 안쪽(7%)으로 */}
        {card.hanja && card.hanja.length <= 2 && (
          <div
            className={`absolute z-30 top-[7%] left-[7%] rounded-full flex items-center justify-center border font-bold ${large ? 'w-8 h-8 text-[15px]' : 'w-7 h-7 text-[13.5px]'}`}
            style={{ background: 'rgba(10,6,20,0.72)', color, borderColor: `${color}66`, fontFamily: 'var(--font-serif)' }}
          >
            {card.hanja}
          </div>
        )}
        <div className="absolute top-2.5 inset-x-0 flex justify-center z-30">
          <span
            className="text-[12.5px] font-semibold tracking-[0.14em] px-2.5 py-0.5 rounded-full border"
            style={{ background: 'rgba(10,6,20,0.6)', color, borderColor: `${color}55` }}
          >
            {label}
          </span>
        </div>
        <div
          className={`absolute inset-x-0 z-30 text-center font-bold text-text-primary px-2 leading-tight ${
            src ? 'bottom-4' : 'top-1/2 -translate-y-1/2'
          } ${large ? 'text-[22px]' : 'text-[18px]'}`}
          style={{ fontFamily: 'var(--font-title)', textShadow: '0 2px 10px rgba(10,6,20,0.8)' }}
        >
          {card.name}
        </div>
      </div>
      <div className={`mt-2 text-center text-text-secondary leading-snug ${large ? 'text-[14.5px]' : 'text-[13px]'}`}>{card.title}</div>
      <div className="mt-1 text-center text-[12.5px] leading-snug" style={{ color: `${color}dd` }}>
        {card.domains}
      </div>
    </div>
  );
}

/** 스크롤 연동 문장 리빌 (ManshinOracleTest 와 동일) */
function RevealLine({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start start'] });
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.22, 0.38, 0.62, 0.82, 1],
    [0.1, 0.3, 1, 1, 0.28, 0.12],
  );
  const y = useTransform(scrollYProgress, [0, 0.38], [10, 0]);
  return (
    <motion.p ref={ref} style={{ opacity, y, willChange: 'transform, opacity', ...style }} className={className}>
      {children}
    </motion.p>
  );
}

export function ManshinImageCompareTest() {
  const [setIdx, setSetIdx] = useState(0);
  const deitySet = DEITY_SETS[setIdx];
  const [variantId, setVariantId] = useState(DEITY_SETS[0].variants[0].id);

  const deity = MANSHIN_DECK.find((c) => c.id === deitySet.deityId)!;
  const custom = MANSHIN_DECK.find((c) => c.id === 'honrye')!;
  const coin = MANSHIN_DECK.find((c) => c.id === 'yeopjeon3')!;
  const deityColor = MANSHIN_GROUP_COLORS[deity.group];
  const variant = deitySet.variants.find((v) => v.id === variantId) ?? deitySet.variants[0];
  const reading = deitySet.reading;

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ love: true });

  const switchDeity = (idx: number) => {
    setSetIdx(idx);
    setVariantId(DEITY_SETS[idx].variants[0].id);
  };

  return (
    <div className="max-w-[480px] mx-auto px-4 pb-16">
      {/* ── 신령 + 일러스트 후보 선택 (sticky) ── */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-3 backdrop-blur-md bg-[rgba(10,6,20,0.82)] border-b border-[var(--border-subtle)]">
        <div className="flex gap-1.5 mb-2.5">
          {DEITY_SETS.map((s, i) => {
            const active = i === setIdx;
            const color = MANSHIN_GROUP_COLORS[MANSHIN_DECK.find((c) => c.id === s.deityId)!.group];
            return (
              <button
                key={s.deityId}
                onClick={() => switchDeity(i)}
                className="flex-1 py-2 rounded-xl border text-[14px] font-bold transition-colors"
                style={{
                  color: active ? '#1a1030' : 'var(--text-secondary)',
                  background: active ? color : 'rgba(255,255,255,0.04)',
                  borderColor: active ? color : 'var(--border-subtle)',
                }}
              >
                {s.tabLabel}
              </button>
            );
          })}
        </div>
        <div className="text-[13px] tracking-[0.18em] text-text-tertiary mb-2">일러스트 후보 — 탭해서 비교</div>
        <div className="flex flex-wrap gap-1.5">
          {deitySet.variants.map((v) => {
            const active = v.id === variant.id;
            return (
              <button
                key={v.id}
                onClick={() => setVariantId(v.id)}
                className="text-[14px] px-3.5 py-1.5 rounded-full border transition-colors"
                style={{
                  color: active ? '#1a1030' : 'var(--text-secondary)',
                  background: active ? deityColor : 'rgba(255,255,255,0.04)',
                  borderColor: active ? deityColor : 'var(--border-subtle)',
                  fontWeight: active ? 700 : 400,
                }}
              >
                {v.label}
              </button>
            );
          })}
        </div>
        <div className="text-[12px] text-text-tertiary mt-1.5">{variant.note}</div>
      </div>

      <div className="space-y-5 mt-5">
        {/* ── 부채꼴 크기(92px) 미리보기 — 뽑기 화면에서 보이는 실제 크기 ── */}
        <div className="rounded-xl border border-[var(--border-subtle)] p-3 bg-white/[0.03]">
          <div className="text-[13px] tracking-[0.15em] text-text-tertiary mb-2.5">뽑기 화면 크기(92px)에서는 이렇게 보입니다</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {deitySet.variants.map((v) => (
              <button key={v.id} onClick={() => setVariantId(v.id)} className="shrink-0">
                <div
                  className="relative w-[92px] aspect-[2/3] rounded-lg border overflow-hidden"
                  style={{ borderColor: v.id === variant.id ? deityColor : 'rgba(201,166,255,0.35)' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.src} alt={v.label} className="w-full h-full object-cover" loading="lazy" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={FRAME_SRC} alt="" aria-hidden className="absolute inset-0 w-full h-full pointer-events-none" />
                </div>
                <div className="text-[12px] mt-1 text-center" style={{ color: v.id === variant.id ? deityColor : 'var(--text-tertiary)' }}>
                  {v.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── 세 패 요약 — 풍습·엽전 2장만 (신령패는 아래 공수 카드의 대형 일러스트로 표시, 중복 제거) ── */}
        <div className="flex justify-center gap-4">
          <SummaryPatCard label="풍습패" card={custom} />
          <SummaryPatCard label="엽전패" card={coin} />
        </div>

        {/* ── 엽전패 6종 갤러리 — 확정 일러스트 + 프레임 + 한자 뱃지 검수용 ── */}
        <div className="rounded-xl border border-[var(--border-subtle)] p-4 bg-white/[0.03]">
          <div className="text-[13px] tracking-[0.15em] text-text-tertiary mb-3">엽전패 6종 — 프레임·한자 뱃지 적용 상태</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 justify-items-center">
            {(['yeopjeon1', 'yeopjeon2', 'yeopjeon3', 'yeopjeon4', 'yeopjeon5', 'yeopjeon6'] as const).map((id) => {
              const c = MANSHIN_DECK.find((x) => x.id === id)!;
              return <SummaryPatCard key={id} label="엽전패" card={c} />;
            })}
          </div>
        </div>

        {/* ── 공수 카드 (reveal 동일 + 일러스트 삽입) ── */}
        <div className="rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[rgba(20,12,38,0.55)]">
          <div
            className="relative flex flex-col items-center justify-center py-8 px-4 overflow-hidden"
            style={{
              background: `radial-gradient(circle at 50% 20%, ${deityColor}33, rgba(20,12,38,0.2)), linear-gradient(180deg, ${deityColor}22, transparent)`,
            }}
          >
            <motion.div
              className="absolute w-[240px] h-[240px] rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle, ${deityColor}2e, transparent 70%)`, willChange: 'transform, opacity' }}
              animate={{ scale: [1, 1.22, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* 신령패 라벨은 카드 위가 아닌 여기(카드 밖)에 — 캐릭터 모자/머리 가림 방지 */}
            <div className="text-[15px] tracking-[0.22em] mb-3 relative" style={{ color: deityColor }}>
              신령패 · {deity.group} · 제{deity.no}패
            </div>
            {/* 카드 일러스트 — 진입 플립(외부) + 터치 틸트/광택(내부) 분리 */}
            <motion.div
              key={`${deitySet.deityId}-${variant.id}`}
              initial={{ opacity: 0, rotateY: 60 }}
              animate={{ opacity: 1, rotateY: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformPerspective: 700 }}
              className="relative w-[264px]"
            >
              <TiltGlareCard className="relative w-full aspect-[2/3] rounded-xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={variant.src} alt={`${deity.name} — ${variant.label}`} className="absolute inset-0 w-full h-full object-cover" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={FRAME_SRC} alt="" aria-hidden className="absolute inset-0 w-full h-full z-20 pointer-events-none" />
              </TiltGlareCard>
            </motion.div>
            <div className="text-[32px] font-bold text-text-primary leading-tight text-center relative mt-4" style={{ fontFamily: 'var(--font-title)' }}>
              {deity.name}
            </div>
            <div className="text-[15.5px] text-text-secondary mt-1.5 text-center relative">{deity.title}</div>
            <div className="text-[14px] text-text-tertiary mt-2.5 text-center relative">
              {custom.name}의 장면에 {coin.name}을 얹어 공수를 내립니다
            </div>
          </div>

          <div className="px-5 py-5">
            {deity.lore && (
              <div className="mb-4 rounded-xl px-4 py-3 bg-white/[0.04] border border-[var(--border-subtle)]">
                <div className="text-[13px] tracking-[0.18em] text-text-tertiary mb-1.5">이 신령은</div>
                <p className="text-[15px] text-text-secondary leading-[1.8]">{deity.lore}</p>
              </div>
            )}
            <div className="mb-4">
              <div className="text-[13.5px] tracking-[0.2em] text-text-tertiary">공수 내리시길</div>
              <div className="text-[12.5px] text-text-tertiary mt-1" style={{ opacity: 0.75 }}>
                공수(空唱) — 신령이 사람의 입을 빌려 직접 들려주는 말
              </div>
            </div>
            <div className="space-y-5 border-l-2 pl-4" style={{ borderColor: `${deityColor}66` }}>
              {speechLines(reading.total).map((line, li) => (
                <RevealLine
                  key={`${deitySet.deityId}-total-${li}`}
                  className="text-[19px] text-text-primary leading-[2.05]"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {renderManshinEmphasis(line)}
                </RevealLine>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5 mt-4">
              {deity.keywords.map((k) => (
                <span
                  key={k}
                  className="text-[13.5px] px-3 py-1.5 rounded-full border"
                  style={{ color: deityColor, borderColor: `${deityColor}55`, background: `${deityColor}14` }}
                >
                  {k}
                </span>
              ))}
            </div>

            {/* 카테고리별 공수 아코디언 (reveal 동일) */}
            <div className="mt-5 space-y-2">
              <div className="text-[13.5px] text-text-tertiary mb-1.5">궁금한 운을 짚어 마저 듣거라</div>
              {FORTUNE_SECTIONS.map((sec) => {
                const open = !!openSections[sec.key];
                const text = reading[sec.key];
                return (
                  <div
                    key={sec.key}
                    className="rounded-xl border overflow-hidden"
                    style={{ borderColor: open ? `${deityColor}55` : 'var(--border-subtle)' }}
                  >
                    <button
                      onClick={() => setOpenSections((s) => ({ ...s, [sec.key]: !s[sec.key] }))}
                      className="w-full flex items-center justify-between px-4 py-3"
                      style={{ background: open ? `${deityColor}0f` : 'rgba(255,255,255,0.03)' }}
                    >
                      <span className="text-[17px] font-semibold" style={{ color: open ? deityColor : 'var(--text-secondary)' }}>
                        {sec.label}
                      </span>
                      <motion.span
                        animate={{ rotate: open ? 180 : 0 }}
                        transition={{ duration: 0.25 }}
                        className="text-[12.5px] text-text-tertiary"
                      >
                        ▾
                      </motion.span>
                    </button>
                    {open && (
                      <div className="px-4 pb-5 pt-1 space-y-4">
                        {speechLines(text).map((line, li) => (
                          <RevealLine
                            key={`${deitySet.deityId}-${sec.key}-${li}`}
                            className="text-[18px] text-text-primary leading-[2.0]"
                            style={{ fontFamily: 'var(--font-serif)' }}
                          >
                            {renderManshinEmphasis(line)}
                          </RevealLine>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
