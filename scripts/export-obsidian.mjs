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
${c.lore ? `\n## 소개\n${c.lore}\n` : ''}
## 공수 (기본)
${c.speech}

## 카테고리별 기본 의미
${fortunes}
`;
  fs.writeFileSync(path.join(VAULT, '만신타로/카드', kind, `${c.name}.md`), md);
}
console.log(`카드 노트 60장 생성, 이미지 ${imgCopied}장 복사`);

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

// ── 5. 홈 대시보드 ─────────────────────────────────────────────────────
const home = `# 이천점 보관함

만신타로 데이터 보관함입니다. \`saju-web\`에서 \`node scripts/export-obsidian.mjs\` 를 실행하면 최신 데이터로 갱신됩니다 (리딩 기록은 증분 추가).

## 만신타로
- **카드 도감**: [[만신타로/카드/신령패/옥황상제|신령패]] · [[만신타로/카드/풍습패/혼례|풍습패]] · [[만신타로/카드/엽전패/엽전 한 닢|엽전패]] — 총 60장
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
