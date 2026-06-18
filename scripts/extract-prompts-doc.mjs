// 프롬프트 원문 추출 — 정통/신년·연도별 운세 톤앤매너 검토용 docs 생성.
// 원본 라인 범위를 그대로 떠서(verbatim) docs/프롬프트정리/ 에 정리한다.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'docs/프롬프트정리');
mkdirSync(OUT, { recursive: true });

const prompts = readFileSync(resolve(ROOT, 'src/constants/prompts.ts'), 'utf8').split('\n');
const aiClients = readFileSync(resolve(ROOT, 'src/lib/ai/aiClients.ts'), 'utf8').split('\n');
const newyearJob = readFileSync(resolve(ROOT, 'src/services/newyearJob.server.ts'), 'utf8').split('\n');

// 1-indexed inclusive
const slice = (arr, a, b) => arr.slice(a - 1, b).join('\n');
const fence = (text) => '~~~text\n' + text + '\n~~~\n';

// ── 01. 공통 톤앤매너 블록 ──────────────────────────────────────────
let d1 = `# 01. 공통 톤앤매너 블록 (모든 운세 공유)

> 원본: \`src/constants/prompts.ts\`. 아래 블록들은 정통·신년·연도별 등 거의 모든 풀이 프롬프트에 그대로 끼워 넣어진다.
> 톤이 "국어사전 같다"는 인상의 근원 대부분이 여기에 있다. \`\${...}\`는 사주 데이터가 자동으로 채워지는 자리.

---

## (A) 한자 표기 매핑 — HANJA_TABLE_BLOCK
원본 라인 446-471. 모든 시스템 프롬프트 끝에 붙는다.

${fence(slice(prompts, 446, 471))}

---

## (B) 은유 지식베이스 — METAPHOR_KB  ★톤의 핵심
원본 라인 538-710. 정통·신년·연도별 본문 프롬프트에 통째로 삽입된다. 명리 개념을 달·별·계절 은유로 번역하는 거대한 사전.

${fence(slice(prompts, 538, 710))}

---

## (C) 섹션 은유 부제목 규칙 — METAPHOR_TITLE_RULE
원본 라인 716-751. 각 섹션 첫 줄에 \`[은유] ...\` 부제목을 강제.

${fence(slice(prompts, 716, 751))}

---

## (D) 핵심 문장 강조 규칙 — KEY_SENTENCE_EMPHASIS_RULE
원본 라인 757-780. 정통사주에만 삽입(신년·연도별엔 없음).

${fence(slice(prompts, 757, 780))}

---

## (E) 시스템 프롬프트 2종

### E-1. 정통사주 기본 시스템 프롬프트 — DEFAULT_SYSTEM_PROMPT
원본: \`src/lib/ai/aiClients.ts\` 라인 25-28. 정통사주는 systemPrompt 미지정이라 이 기본값을 쓴다.

${fence(slice(aiClients, 25, 28))}

### E-2. 신년·연도별 전용 시스템 프롬프트 — NEWYEAR_SYSTEM_PROMPT
원본: \`src/services/newyearJob.server.ts\` 라인 30-58. "간결" 대신 "분량 충족"을 지시 + 섹션별 최소 글자수 강제 로직.

${fence(slice(newyearJob, 30, 56))}
`;
writeFileSync(resolve(OUT, '01_공통_톤앤매너_블록.md'), d1);

// ── 02. 정통운세 ────────────────────────────────────────────────
let d2 = `# 02. 정통운세(정통사주) 프롬프트

> 원본: \`src/constants/prompts.ts\`. 처리기: \`src/services/jungtongsajuJob.server.ts\`
> 구조: **2-pass**. 1차(Core) 4섹션 → 2차(Application) 8섹션. 1차 결과를 2차에 컨텍스트로 넘겨 중복 회피.
> 시스템 프롬프트 = DEFAULT_SYSTEM_PROMPT(01-E1). 공유블록 METAPHOR_KB·은유제목·핵심강조가 매 pass에 삽입됨.
> \`\${...}\`는 사주 데이터 자동 주입 자리.

---

## 공통 데이터 블록 — buildJungtongsajuInput (1차·2차 공유)

### 사주 원국 입력 블록 (inputBlock)
원본 라인 2418-2444.

${fence(slice(prompts, 2418, 2444))}

### 공통 작성 규칙 (commonRules)
원본 라인 2447-2467.

${fence(slice(prompts, 2447, 2467))}

---

## 1차 (Core) — generateJungtongsajuCorePrompt
4섹션: general(총론)·daymaster(일주)·element(오행)·interaction(합충형파해). 원본 라인 2504-2596.
(아래 텍스트 안의 \`\${METAPHOR_KB}\` \`\${METAPHOR_TITLE_RULE}\` \`\${KEY_SENTENCE_EMPHASIS_RULE}\`는 01번 문서의 (B)(C)(D) 블록이 그 자리에 통째로 삽입된다는 뜻.)

${fence(slice(prompts, 2504, 2596))}

---

## 2차 (Application) — generateJungtongsajuApplicationPrompt
8섹션: character·career·wealth·love·health·relation·luck·advice. 원본 라인 2636-2917.

${fence(slice(prompts, 2636, 2917))}
`;
writeFileSync(resolve(OUT, '02_정통운세_프롬프트.md'), d2);

// ── 03. 신년/연도별 ─────────────────────────────────────────────
let d3 = `# 03. 신년운세 · 연도별운세 프롬프트 (동일)

> ★ **신년운세와 연도별운세는 완전히 같은 프롬프트**(\`generateNewyearReportPrompt\`)와 같은 처리기(\`runNewyearJob\`)를 쓴다.
> 차이는 대상 \`year\` 값과 화면 라벨(\`isYearFortune\`)뿐 — **프롬프트 본문·톤은 동일하므로 하나를 고치면 둘 다 바뀐다.**
> 원본: \`src/constants/prompts.ts\`. 처리기: \`src/services/newyearJob.server.ts\`
> 구조: **2-pass**. 1차 5섹션(general·wealth·career·study·love) → 2차 4섹션(health·relation·monthly·lucky). 두 pass 모두 같은 base 프롬프트 + "이번엔 어느 섹션만" 지시 + 분량강제(01-E2)를 덧붙인다.
> 시스템 프롬프트 = NEWYEAR_SYSTEM_PROMPT(01-E2). 공유블록 METAPHOR_KB·은유제목 삽입(핵심강조 KEY_SENTENCE는 없음).
> \`\${...}\`는 사주·세운·사용자상황 데이터 자동 주입 자리.

---

## 본문 — generateNewyearReportPrompt
원본 라인 3088-3242. (\`\${METAPHOR_KB}\` \`\${METAPHOR_TITLE_RULE}\`는 01번 문서 (B)(C) 블록이 삽입됨.)

${fence(slice(prompts, 3088, 3242))}
`;
writeFileSync(resolve(OUT, '03_신년_연도별운세_프롬프트.md'), d3);

console.log('생성 완료:');
console.log(' -', resolve(OUT, '01_공통_톤앤매너_블록.md'));
console.log(' -', resolve(OUT, '02_정통운세_프롬프트.md'));
console.log(' -', resolve(OUT, '03_신년_연도별운세_프롬프트.md'));
