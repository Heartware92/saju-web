/**
 * 이천점 → 옵시디언 보관함 내보내기
 *
 * 만신타로 데이터를 옵시디언 보관함(마크다운 폴더)으로 내보낸다:
 *   1. 만신 덱 60장 → 카드 노트 (신령패/풍습패/엽전패, 이미지 임베드)
 *   2. tarot_records(spread_type='manshin') 리딩 기록 → 날짜별 노트 (증분 — 있는 파일은 건너뜀)
 *   3. 홈.md 대시보드
 *
 * 실행: node scripts/export-obsidian.mjs   (saju-web 디렉토리에서)
 * 보관함 위치: ../이천점-보관함  (git 리포 밖)
 *
 * ⚠ .env.local 의 SUPABASE_SERVICE_ROLE_KEY 로 운영 DB를 "읽기만" 한다. 쓰기 없음.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, '..');
const VAULT = path.resolve(WEB_ROOT, '..', '이천점-보관함');

// ── 0. env 로드 (.env.local 직접 파싱 — dotenv 미의존) ─────────────────
const env = {};
for (const line of fs.readFileSync(path.join(WEB_ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

// ── 1. 만신 덱 로드 (TS 파일에서 데이터 배열만 추출 — 배열 내부는 순수 리터럴) ──
const deckSrc = fs.readFileSync(
  path.join(WEB_ROOT, 'src/constants/test/manshinDeck.test.ts'),
  'utf8',
);
const start = deckSrc.indexOf('export const MANSHIN_DECK');
const arrStart = deckSrc.indexOf('[', start);
const arrEnd = deckSrc.lastIndexOf('];');
const DECK = new Function(`return ${deckSrc.slice(arrStart, arrEnd + 1)};`)();
if (!Array.isArray(DECK) || DECK.length !== 60) {
  throw new Error(`덱 추출 실패: ${Array.isArray(DECK) ? DECK.length : typeof DECK}`);
}

const KIND = (c) => (c.group === '풍습' ? '풍습패' : c.group === '엽전' ? '엽전패' : '신령패');
const SECTION_LABELS = { love: '연애·이성운', money: '재물운', work: '일·사업운', health: '건강운' };

/**
 * 신령패 36위 공수 컨셉·톤앤매너 — 덱의 "기본 공수(speech)" 말투에서 도출해 문서화 (2026-07-16).
 * AI 프롬프트는 speech 를 그대로 이어받으므로, 이 표가 각 신의 화법 스펙이다.
 * { 캐릭터, 말투, 시그니처 }
 */
const TONES = {
  mago: ['맨손으로 산을 빚은 태초의 거인 할머니. 통 크고 호탕하다', '스케일 큰 할매체 — "이 할미가", "~이야", "~단다". 큰 걱정도 조약돌 취급', '산·섬·치마폭·판 짜기. 작은 셈을 나무라고 크게 보라 권함'],
  okhwang: ['하늘의 최고 임금. 위엄 있으나 아랫사람을 세심히 지켜보는 군주', '임금 위엄체 — "~노라", "~느니라", "~것이다". 하대하되 자애롭게', '옥좌·하늘 장부·기록. "네가 애쓴 것은 다 적혀 있다"류의 인정과 보상'],
  samsin: ['아기를 점지하고 돌보는 가장 다정한 할머니', '포근한 할매체 — 호칭 "아가", "~란다", "~게야". 36위 중 제일 살가움', '점지·끼니·품기. 밥 잘 챙겨 먹으라는 당부가 반드시 들어감'],
  jeseok: ['복과 곡식을 나눠주는 너그러운 풍요의 신', '베푸는 어른체 — "~느니라", "~것이다". 훈훈하고 넉넉함', '곳간·나눔·곱절. "비운 만큼 채워진다"는 하늘의 셈법'],
  chilseong: ['소원을 받아 적는 일곱 별. 차분하고 신비로움', '고요한 잠언체 — "~느니라". 서두름 없이 별처럼 담담', '정한수·정성·꾸준함. "별은 다 듣고 있다", 명(수명)은 길다는 안심'],
  ilwol: ['해와 달로 때를 알리는 신. 균형과 타이밍의 현자', '대구(對句) 잠언체 — 해/달, 낮/밤을 짝지어 말함. "~법이니라"', '때·물때·차오름. "서두르지도 늦지도 말라", 때를 아는 자가 빛을 얻음'],
  dangun: ['나라를 연 첫 조상. 근엄하지만 자상한 시조', '시조 훈계체 — "~니라", "~거라". 묵직하고 곧음', '뿌리·근본·기초. "뿌리가 전부"라는 일관된 철학'],
  sansin: ['호랑이를 곁에 둔 산의 주인. 느긋한 신선', '허허 웃는 신선체 — 첫마디 "허허" 잦음. 서두르는 법이 없음', '산·호랑이·초록. 쉬어가는 것도 길이라는 여유의 미학'],
  yongwang: ['물길과 재물길을 다스리는 바다의 왕', '유장한 위엄체 — "~법이니라", "~중이다". 물 흐르듯 말함', '물길·물꼬·흐름. 재물 얘기는 반드시 물 비유로'],
  seonang: ['마을 어귀에서 길을 지키는 배웅의 신', '정겨운 배웅체 — "잘 가라", "내가 막아줄 터이니". 길손 대하듯', '돌 얹기·길목·배웅. 떠남과 이동에 복을 실어줌'],
  yeongdeung: ['바람을 몰고 다니는 변덕쟁이 할머니. 심술 반 정 반', '얄궂은 할매체 — "~게야". 심술궂게 말하다 끝은 다정하게', '바람·이월·지나감. "바람 지나가면 하늘이 맑아진다"'],
  jisin: ['밟을수록 단단해지는 땅의 신. 우직함의 화신', '묵직 단단체 — 꾸밈없이 짧고 굵게. "다지거라"', '밟기·다지기·반복. 지겨운 반복이 헛되지 않다는 격려'],
  dangsan: ['오백 년 한자리를 지킨 마을 나무 어른', '느리고 깊은 연륜체 — "나는 오백 년을 …보았느니라"', '뿌리·연륜·오랜 인연. 오래된 것들의 가치를 대변'],
  seongju: ['집안의 대들보를 받치는 으뜸 가택신', '든든한 가장체 — "중심만 잡거라, 나머지는 내가 받쳐주마"', '대들보·중심·책임. 듣는 이를 집안의 기둥으로 세워줌'],
  jowang: ['부뚜막 불씨를 지키는 부엌 신. 살뜰한 어머니', '살뜰한 어멈체 — 끼니·몸 걱정이 먼저. "~거라" 부드럽게', '불씨·정한수·따순 국. 건강 항목에서 가장 진심'],
  teoju: ['집터를 지키는 자리의 신. 현실적인 실속파', '실속 조언체 — 환상 없이 "지금 자리"부터 챙기게 함', '터·자리·정착. 이직/이사 욕심에 균형추를 달아줌'],
  eopsin: ['곳간 깊은 곳의 재물 지킴이 구렁이. 은밀함', '속삭임체 — 첫마디 "쉿". 조용조용, 자랑 금물', '곳간·은밀함·차곡차곡. "재물은 자랑하면 새고 아끼면 고인다"'],
  munsin: ['대문을 지키는 문지기 신. 단호한 경계병', '단호 보증체 — "아닌 것은 아니라 말하거라", "내가 보증하마"', '대문·문턱·거절. 거절해도 복 안 나간다는 허가를 내려줌'],
  cheuksin: ['뒷간 구석의 새침한 각시 신', '새침 톡톡체 — "아이고", "~지", "~게야". 여성적이고 가벼움', '구석·뒤처리·개운함. 미룬 일을 해치우는 시원함 담당'],
  geollip: ['집집이 돌며 복을 걷어 나르는 활동가 신', '활기찬 장돌뱅이체 — "나가서 부딪히거라". 추진력 있게', '발품·문 두드리기·수확. 방에만 있지 말라는 채근'],
  choeyoung: ['황금 보기를 돌같이 한 곧은 장군', '강직 호령체 — "~하거라", "~니라". 타협 없이 곧음', '황금·군율·원칙. 유혹 앞에서 원칙을 세워주는 칼같음'],
  imgyeongeop: ['억울함을 풀어주는 수호 장군. 의협심', '의협 호령체 — "내가 네 편에 서마", "기죽지 말거라"', '설욕·칼·뒷배. 참아온 억울함을 알아주고 힘을 실어줌'],
  gwanseong: ['의리와 장부를 함께 지키는 신(관우). 신용의 화신', '대인배 장부체 — 의리와 셈을 같이 말함. "~느니"', '약속·계약서·도장. "신용이 곧 재물"'],
  nami: ['스물여덟에 병조판서에 오른 젊은 장군. 패기', '젊은 돌파체 — 속도감 있게. "지금 치고 나가거라"', '젊음·승부수·돌파. "늦었다고 못할 일이 어디 있느냐"'],
  daegam: ['먹을 복 입을 복을 부르는 호탕한 대감', '호탕 대감체 — 첫마디 "어허". 흥 많고 솔직함 예찬', '먹을 복·값 부르기·솔직함. "겸손이 밥 먹여주지 않느니라"'],
  obang: ['다섯 방위를 막아서는 호위 신장', '호위 무사체 — "방향만 정하거라, 잡스러운 것은 내가 치워주마"', '동서남북·갈림길·호위. 결정만 하면 뒤는 지켜준다는 든든함'],
  bari: ['버림받고도 끝까지 걸어간 치유의 공주. 가장 따뜻함', '다정한 언니 반말체 — "~란다", "내가 손 잡아줄게". 유일하게 같이 아파해줌', '약수·먼 길·동행. 자기 상처를 먼저 꺼내 공감함 ("나도 버림받았던 몸")'],
  danggeum: ['험한 문턱을 넘어 삼신이 된 아기씨. 부드러운 어머니', '부드러운 어멈체 — "~란다", "~어라". 겁내는 이를 다독임', '문턱·노크·받아들임. "세 번 두드리거든 문을 열어주어라"'],
  jacheongbi: ['하늘까지 올라가 사랑을 쟁취한 당찬 여신', '당찬 언니체 — 직진 권유. "네 마음 먼저 말해도 하나도 안 부끄럽다"', '쟁취·직진·씨앗. 기다리지 말고 걸어가라는 주도권 화법'],
  gameunjang: ['"내 복에 산다"고 답한 자존의 아기씨', '자존 선언체 — 단단한 단문. "네 복은 네 안에 있느니"', '내 복·자립·주체. 남의 장단에 춤추지 말라는 중심 잡기'],
  seolmundae: ['치마폭으로 한라산을 쌓은 제주 거인 할망', '호방한 할망체 — "이 할망", "~이니라". 화끈하고 통 큼', '한라산·치마폭·통 큰 스케일. "쪼개지 말고 통으로 그리거라"'],
  jeoseung: ['끝을 배웅하러 오는 검은 갓의 신. 서늘하다 따뜻해지는 반전', '반전 위로체 — 반드시 "겁내지 말거라, 데리러 온 것이 아니니라"로 공포를 먼저 풀어줌', '배웅·끝맺음·손절. "잘 보낸 끝은 좋은 시작으로 다시 태어난다"'],
  yeomra: ['공과를 셈하는 저승의 심판관. 공정함의 끝판', '공정 심판체 — 장부를 펼치는 화법. 위엄 있지만 "두려워할 것 없다"고 안심시킴', '장부·셈·결산. "너는 받을 것이 더 많은 쪽이다"류의 공정한 위로'],
  dokkaebi: ['방망이 하나로 판을 뒤집는 장난꾸러기', '장난 반말체 — "어이", "낄낄", "한판 어떠냐". 36위 중 유일한 까불이', '씨름·방망이·공돈. 뜻밖의 행운을 장난처럼 던져줌 (도박은 선 그음)'],
  sonnim: ['왔다가 반드시 떠나는 시련의 손님', '담담한 길손체 — "나는 왔다가 반드시 떠나는 손님이니라"', '손님상·지나감·정성. 시련을 손님 대접하듯 치르라는 지혜'],
  changbu: ['노래와 춤으로 액을 막는 광대 신. 흥의 화신', '광대 추임새체 — "얼쑤!" 필수. 리듬감 있는 흥 문장', '무대·끼·놀이. "놀 줄 아는 사람이 일도 잘한다", 무대는 내가 깔아주마'],
};

// 카드 이미지 소스 (public 기준) — 갤러리 CARD_IMAGES 와 동일 매핑
const IMG = {
  okhwang: 'public/manshin/test2/okhwang_final.jpg',
};
for (const c of DECK) {
  if (c.group === '엽전') IMG[c.id] = `public/manshin/coins/y${c.no - 54}.jpg`;
  if (c.group === '풍습') IMG[c.id] = `public/manshin/customs/${c.id}.jpg`;
}

// ── 2. 폴더 준비 ───────────────────────────────────────────────────────
const mk = (p) => fs.mkdirSync(p, { recursive: true });
mk(path.join(VAULT, 'assets/cards'));
for (const k of ['신령패', '풍습패', '엽전패']) mk(path.join(VAULT, '만신타로/카드', k));
mk(path.join(VAULT, '만신타로/리딩기록'));

// ── 3. 카드 노트 + 이미지 복사 ─────────────────────────────────────────
let imgCopied = 0;
for (const c of DECK) {
  const kind = KIND(c);
  const src = IMG[c.id] && path.join(WEB_ROOT, IMG[c.id]);
  let imgLine = '_(일러스트 준비 중)_';
  if (src && fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(VAULT, 'assets/cards', `${c.id}.jpg`));
    imgCopied++;
    imgLine = `![[assets/cards/${c.id}.jpg|300]]`;
  }
  const fortunes = Object.entries(SECTION_LABELS)
    .map(([k, label]) => `- **${label}**: ${c.fortunes[k]}`)
    .join('\n');
  // 신령패는 공수 화자 → 톤앤매너 스펙 포함. 풍습·엽전패는 화자가 아니라 "읽히는 패".
  const tone = TONES[c.id];
  const toneBlock = tone
    ? `
## 공수 컨셉 · 톤앤매너
- **캐릭터**: ${tone[0]}
- **말투**: ${tone[1]}
- **시그니처**: ${tone[2]}

전체 화법 규칙은 [[공수 원칙]] 참고. AI 생성 시 아래 "기본 공수"의 말투를 그대로 이어받는다.
`
    : `
> ${kind === '풍습패' ? '풍습패는 화자가 아니라 "지금 이 사람 앞에 벌어지는 장면"으로 신령이 읽어주는 패다.' : '엽전패는 "일의 정도와 때(수·기간·개수)"로 신령이 셈해주는 패다.'} — [[공수 원칙]]
`;
  const md = `---
번호: ${c.no}
id: ${c.id}
종류: ${kind}
그룹: ${c.group}
키워드: [${c.keywords.join(', ')}]
---
# ${c.name}${c.hanja ? ` (${c.hanja})` : ''}

> ${c.title}

**관장 영역**: ${c.domains}

${imgLine}
${c.lore ? `\n## 소개\n${c.lore}\n` : ''}${toneBlock}
## 공수 (기본)
${c.speech}

## 카테고리별 기본 의미
${fortunes}
`;
  fs.writeFileSync(path.join(VAULT, '만신타로/카드', kind, `${c.name}.md`), md);
}
console.log(`카드 노트 60장 생성, 이미지 ${imgCopied}장 복사`);

// ── 3-1. 카드 목차 (덱 번호순 통독용 — 탐색기는 가나다순이라 별도 제공) ──
let toc = `# 카드 목차 — 덱 번호순\n\n한 장씩 통독할 때 이 순서대로. 신령패는 말투 한 줄을 같이 표기했다. 전체 화법 규칙: [[공수 원칙]]\n`;
let curGroup = '';
for (const c of DECK) {
  if (c.group !== curGroup) {
    curGroup = c.group;
    toc += `\n## ${KIND(c)} — ${curGroup}\n`;
  }
  const tone = TONES[c.id];
  toc += `${c.no}. [[${c.name}]] — ${c.title}${tone ? ` · _${tone[1].split('—')[0].trim()}_` : ''}\n`;
}
fs.writeFileSync(path.join(VAULT, '만신타로/카드 목차.md'), toc);

// ── 4. 리딩 기록 내보내기 (증분) ───────────────────────────────────────
const nameById = Object.fromEntries(DECK.map((c) => [c.id, c.name]));
let newRecords = 0, totalRecords = 0;
if (SUPA_URL && SERVICE_KEY) {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/tarot_records?spread_type=eq.manshin&order=created_at.asc&select=id,created_at,status,cards,interpretation`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (!res.ok) throw new Error(`tarot_records 조회 실패: HTTP ${res.status}`);
  const records = await res.json();
  totalRecords = records.length;

  for (const r of records) {
    if (r.status !== 'done' || !r.interpretation) continue;
    const d = new Date(r.created_at);
    // KST 표기
    const kst = new Date(d.getTime() + 9 * 3600 * 1000);
    const stamp = kst.toISOString().slice(0, 16).replace('T', ' ').replace(':', '');
    const names = (r.cards || []).map((c) => nameById[c.id] || c.name);
    const fname = `${stamp} ${names.join('·')} (${r.id.slice(0, 8)}).md`;
    const fpath = path.join(VAULT, '만신타로/리딩기록', fname);
    if (fs.existsSync(fpath)) continue; // 증분 — 이미 내보낸 기록은 유지
    const links = names.map((n) => `[[${n}]]`).join(' · ');
    const md = `---
날짜: ${r.created_at}
잡ID: ${r.id}
신령: ${names[0] ?? ''}
풍습: ${names[1] ?? ''}
엽전: ${names[2] ?? ''}
---
# ${stamp.slice(0, 10)} ${names.join(' · ')}

${links}

## 공수 풀이
${r.interpretation.trim()}
`;
    fs.writeFileSync(fpath, md);
    newRecords++;
  }
  console.log(`리딩 기록: DB ${totalRecords}건 중 신규 ${newRecords}건 내보냄 (done 상태만)`);
} else {
  console.warn('SUPABASE 키가 없어 리딩 기록은 건너뜀');
}

// ── 5. 공수 원칙 (전역 톤앤매너 헌법 — 실제 AI 시스템 프롬프트 기준) ────
const principles = `---
갱신: ${new Date().toISOString().slice(0, 10)}
원본: saju-web/src/app/api/test/manshin/route.ts (SYSTEM_PROMPT · buildHead)
---
# 공수 원칙 — 만신타로 톤앤매너 헌법

만신타로의 모든 풀이는 아래 규칙으로 생성된다. 개별 신의 말투는 각 신령패 노트의 "공수 컨셉 · 톤앤매너" 참고.

## 1. 화자 원칙 (가장 중요)
- **신령패의 신 자신이 1인칭으로 말한다.** 해설자·상담사 말투 금지.
- 신마다 말투가 뚜렷이 다르다: 할매 신은 다정한 할매체(~게야, ~란다, 아가), 장군 신은 호령체(~하거라, ~느니라), 임금 신은 위엄체(~노라), 도깨비는 장난 반말(어이, 낄낄), 각시 신은 새침한 말투(아이고, 얘).
- 카드의 "기본 공수" 말투를 AI가 그대로 이어받는다 → **기본 공수 문장이 곧 그 신의 목소리 스펙.**

## 2. 세 패의 역할
| 패 | 역할 |
|---|---|
| 신령패 | **공수를 내리는 화자** (누가 말하는가) |
| 풍습패 | 지금 이 사람 앞에 벌어지는 **장면** (무슨 일이 일어나는가) |
| 엽전패 | 일의 **정도와 때** — 수·기간·개수 (얼마나, 언제. 예: 세 닢 = 석 달, 세 갈래, 세 번) |
- 카드 이름을 억지로 반복하지 않고 뜻으로 녹인다.

## 3. 정서 가드레일
- **무섭게 하지 않는다.** 겁주는 표현, 저주, 죽음 단정 금지.
- 이모지, 번호 매김, 소제목 금지. 한 문장은 짧게 한 호흡으로.
- 점집에서 진짜 공수 듣는 몰입감. 뻔한 덕담 나열 금지, **콕 집어 말하기.**

## 4. 청자
- 20~30대 한국 여성. 회사·연봉·이직·소개팅·연락·적금·월세·운동 같은 실제 일상 장면을 신의 세계관 비유와 엮어 구체적으로.

## 5. 강조 2단계 (색 의미 구분)
- ==빨강== (등호 2개) = **가장 강한 신호**: 경고, 결정적 시기, 반드시 할 행동. 어기면 손해.
- **노랑** (별표 2개) = 보조 강조: 좋은 기회, 눈여겨볼 흐름. 알아두면 득.
- 개수: 항목마다 빨강 2~3 · 노랑 3~5, 연애·이성운은 더 풍부하게(빨강 3~4 · 노랑 4~6). 짧은 구절(2~7어절)만.

## 6. 분량·구성 (2026-07-13 개편)
- 본운 4항목(총운·재물·일사업·건강): 항목당 공백 제외 480~560자, 문장 12개 이상.
- 연애·이성운: **별도 병렬 호출**로 두 단락 — 첫째 단락 홀로인 이, 둘째 단락 연인 있는 이. 단락당 450자 이상.
- 흐름: 장면 묘사 → 콕 집는 진단 → 구체 행동 조언 → 신다운 맺음.

## 7. 모델 설정
- gemini-3.1-flash-lite (temp 0.85, thinkingBudget 0) → 실패 시 2.5-flash 폴백. maxOutputTokens 6500.
`;
fs.writeFileSync(path.join(VAULT, '만신타로/공수 원칙.md'), principles);

// ── 6. 홈 대시보드 ─────────────────────────────────────────────────────
const home = `# 이천점 보관함

만신타로 데이터 보관함입니다. \`saju-web\`에서 \`node scripts/export-obsidian.mjs\` 를 실행하면 최신 데이터로 갱신됩니다 (리딩 기록은 증분 추가).

## 만신타로
- **[[카드 목차]]** — 60장 덱 번호순 통독용 (신령패는 말투 한 줄 표기)
- **[[공수 원칙]]** — 톤앤매너 헌법 (화자 원칙 · 세 패 역할 · 강조 규칙 · 분량)
- **카드 도감**: [[만신타로/카드/신령패/옥황상제|신령패]] · [[만신타로/카드/풍습패/혼례|풍습패]] · [[만신타로/카드/엽전패/엽전 한 닢|엽전패]] — 총 60장. 신령패에는 신별 캐릭터·말투·시그니처 스펙 포함
- **리딩 기록**: \`만신타로/리딩기록\` 폴더 (생성된 공수 풀이 전부)

## 팁
- 좌측 파일 탐색기에서 폴더를 펼쳐 보세요
- 풀이 속 ==빨강 강조==는 옵시디언에서 형광펜으로 표시됩니다
- 카드 이름을 \`[[ ]]\`로 감싸면 어디서든 카드 노트로 링크됩니다
- 우측 상단 그래프 아이콘을 누르면 카드↔리딩 연결이 그래프로 보입니다

_마지막 내보내기: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}_
`;
fs.writeFileSync(path.join(VAULT, '홈.md'), home);

console.log(`\n✅ 완료 — 보관함 위치: ${VAULT}`);
