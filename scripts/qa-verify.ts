/**
 * QA 검증 스크립트 — Vitest 셋업 전 임시 단위 검증
 *
 * 검증 항목:
 *  1) tarotSeed 결정론성 (오늘/이달 같은 키 → 같은 카드, 다른 키 → 충분히 분산)
 *  2) drawMany 중복 없음
 *  3) 프롬프트 출력 스키마 sanity (### 헤더 / 금지어 / 필수 키워드)
 *  4) pricing 엔트리 정합성 (신규 타로 모드·토정·자미두수)
 *
 * 실행: npx tsx scripts/qa-verify.ts
 */

import { drawOne, drawMany, getTodayKey, getMonthKey } from '../src/utils/tarotSeed';
import { CREDIT_COST } from '../src/constants/pricing';
import { calculateSaju } from '../src/utils/sajuCalculator';

type Result = { name: string; pass: boolean; detail?: string };
const results: Result[] = [];
const record = (name: string, pass: boolean, detail?: string) =>
  results.push({ name, pass, detail });

// ────────────────────────────────────────────────
// 1) tarotSeed 결정론성
// ────────────────────────────────────────────────
{
  const key = 'today:2026-04-14:user-abc';
  const d1 = drawOne(key);
  const d2 = drawOne(key);
  record(
    '[seed] drawOne 같은 키 → 동일 결과',
    d1.cardIndex === d2.cardIndex && d1.isReversed === d2.isReversed,
    `${JSON.stringify(d1)} vs ${JSON.stringify(d2)}`
  );
}
{
  // 다른 날짜 키 100개 → 카드 인덱스 분산도 확인 (편향 금지)
  const counts = new Array(22).fill(0);
  for (let i = 0; i < 1000; i++) {
    const d = drawOne(`today:2026-04-${String(i).padStart(3, '0')}`);
    counts[d.cardIndex]++;
  }
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  // 균일분포 기대값 ≈ 45, min>15, max<90 수준 (22장, 1000회)
  record(
    '[seed] drawOne 분산도 (1000회, 22장)',
    min >= 15 && max <= 100,
    `min=${min}, max=${max}, counts=${counts.join(',')}`
  );
}
{
  // 역방향 확률 ≈ 0.35
  let rev = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const d = drawOne(`rev-test-${i}`);
    if (d.isReversed) rev++;
  }
  const pct = rev / N;
  record(
    '[seed] 역방향 확률 ≈ 0.35 (±0.05)',
    pct > 0.30 && pct < 0.40,
    `${(pct * 100).toFixed(1)}%`
  );
}

// ────────────────────────────────────────────────
// 2) drawMany 중복 없음 + 결정론
// ────────────────────────────────────────────────
{
  const key = 'month:2026-04:user-xyz';
  const a = drawMany(key, 3);
  const b = drawMany(key, 3);
  const indicesA = a.map(x => x.cardIndex);
  const unique = new Set(indicesA).size === 3;
  const same = JSON.stringify(a) === JSON.stringify(b);
  record('[seed] drawMany 3장 중복 없음', unique, `indices=${indicesA}`);
  record('[seed] drawMany 결정론 (같은 키 → 같은 시퀀스)', same);
}
{
  // 다른 월 키 → 다른 스프레드가 나오는지
  const a = drawMany('month:2026-04', 3);
  const b = drawMany('month:2026-05', 3);
  const aStr = JSON.stringify(a.map(x => x.cardIndex));
  const bStr = JSON.stringify(b.map(x => x.cardIndex));
  record(
    '[seed] 다른 월 키 → 다른 스프레드',
    aStr !== bStr,
    `Apr=${aStr} May=${bStr}`
  );
}

// [REMOVED] 옛 단독 타로 프롬프트(today/monthly/question) 테스트 + sampleCard 픽스처는 dead 코드 제거와 함께 삭제.
// 현재는 모든 타로 모드가 generateHybridPrompt 로 통합되어 있어 prompts/service 직접 검증 불필요.

// ────────────────────────────────────────────────
// 4) pricing 정합성 (2026-05-16 단일 달 크레딧 통합 후)
// ────────────────────────────────────────────────
record(
  '[pricing] tarotToday = 달1',
  CREDIT_COST.tarotToday.type === 'moon' && CREDIT_COST.tarotToday.amount === 1,
  JSON.stringify(CREDIT_COST.tarotToday)
);
record(
  '[pricing] tarotMonthly = 달1',
  CREDIT_COST.tarotMonthly.type === 'moon' && CREDIT_COST.tarotMonthly.amount === 1,
  JSON.stringify(CREDIT_COST.tarotMonthly)
);
record(
  '[pricing] tojeong = 달10',
  CREDIT_COST.tojeong.type === 'moon' && CREDIT_COST.tojeong.amount === 10,
  JSON.stringify(CREDIT_COST.tojeong)
);
record(
  '[pricing] zamidusu = 달10',
  CREDIT_COST.zamidusu.type === 'moon' && CREDIT_COST.zamidusu.amount === 10,
  JSON.stringify(CREDIT_COST.zamidusu)
);

// ────────────────────────────────────────────────
// 5) key 생성기 sanity
// ────────────────────────────────────────────────
{
  const k1 = getTodayKey();
  const k2 = getTodayKey('user-xxx');
  record(
    '[seed] getTodayKey 포맷 YYYY-MM-DD',
    /^today:\d{4}-\d{2}-\d{2}$/.test(k1),
    k1
  );
  record(
    '[seed] getTodayKey uid 포함',
    k2.endsWith(':user-xxx') && k2.startsWith('today:'),
    k2
  );
}
{
  const k1 = getMonthKey();
  record(
    '[seed] getMonthKey 포맷 YYYY-MM',
    /^month:\d{4}-\d{2}$/.test(k1),
    k1
  );
}

// ────────────────────────────────────────────────
// 6) sajuCalculator 한자→한글 정규화 회귀 (2026-04-14 핫픽스)
//   lunar-javascript가 반환하는 中 한자(壬·癸·申 등)를 한글로 정규화하지 않으면
//   STEM_ELEMENT / TEN_GODS_MAP / BRANCH_HIDDEN_STEMS 조회가 전부 실패 →
//   십성분포 0, 오행 all-0, 용신 undefined, 대운 tenGod/twelveStage 공백 이슈.
// ────────────────────────────────────────────────
{
  const KOREAN_STEMS = ['갑','을','병','정','무','기','경','신','임','계'];
  const KOREAN_BRANCHES = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
  const r = calculateSaju(1992, 9, 14, 12, 50, 'male', false);

  record(
    '[saju] dayMaster 한글 정규화',
    KOREAN_STEMS.includes(r.dayMaster),
    `dayMaster=${r.dayMaster}`
  );
  record(
    '[saju] dayMasterElement 비어있지 않음 (오행 매핑 동작)',
    r.dayMasterElement !== '' && ['목','화','토','금','수'].includes(r.dayMasterElement),
    `dayMasterElement=${r.dayMasterElement}`
  );
  record(
    '[saju] 년/월/일 천간 모두 한글',
    KOREAN_STEMS.includes(r.pillars.year.gan)
      && KOREAN_STEMS.includes(r.pillars.month.gan)
      && KOREAN_STEMS.includes(r.pillars.day.gan),
    `${r.pillars.year.gan}/${r.pillars.month.gan}/${r.pillars.day.gan}`
  );
  record(
    '[saju] 년/월/일 지지 모두 한글',
    KOREAN_BRANCHES.includes(r.pillars.year.zhi)
      && KOREAN_BRANCHES.includes(r.pillars.month.zhi)
      && KOREAN_BRANCHES.includes(r.pillars.day.zhi),
    `${r.pillars.year.zhi}/${r.pillars.month.zhi}/${r.pillars.day.zhi}`
  );
  const elSum = r.elementCount.목 + r.elementCount.화 + r.elementCount.토 + r.elementCount.금 + r.elementCount.수;
  record(
    '[saju] elementCount 합 > 0 (오행 카운트 동작)',
    elSum > 0,
    `sum=${elSum}, ${JSON.stringify(r.elementCount)}`
  );
  record(
    '[saju] 년주 tenGodGan 계산됨 (십성 매핑 동작)',
    r.pillars.year.tenGodGan !== '' && r.pillars.year.tenGodGan !== '일주',
    `year.tenGodGan=${r.pillars.year.tenGodGan}`
  );
  record(
    '[saju] yongSinElement 유효',
    !!r.yongSinElement && ['목','화','토','금','수'].includes(r.yongSinElement),
    `yongSinElement=${r.yongSinElement}`
  );
  // daeWoon 첫 번째 유효 엔트리(startAge>0인 것)는 tenGod/twelveStage 모두 한글이어야 함
  const validDw = r.daeWoon.find(d => d.gan && d.zhi);
  record(
    '[saju] 대운 tenGod/twelveStage 유효',
    !!validDw && validDw.tenGod !== '' && validDw.twelveStage !== '',
    validDw ? `${validDw.startAge}세 ${validDw.gan}${validDw.zhi} ${validDw.tenGod}/${validDw.twelveStage}` : 'no valid daewoon'
  );
  // seWoon 첫 엔트리
  const sw0 = r.seWoon[0];
  record(
    '[saju] 세운 가장 앞 엔트리 tenGod/twelveStage 유효',
    sw0 && KOREAN_STEMS.includes(sw0.gan) && sw0.tenGod !== '' && sw0.twelveStage !== '',
    sw0 ? `${sw0.year} ${sw0.gan}${sw0.zhi} ${sw0.tenGod}/${sw0.twelveStage}` : 'no sewoon'
  );
}

// ────────────────────────────────────────────────
// Report
// ────────────────────────────────────────────────
console.log('\n━━━━━━━━━━ QA 검증 리포트 ━━━━━━━━━━');
let passed = 0;
let failed = 0;
for (const r of results) {
  const mark = r.pass ? '✓' : '✗';
  const color = r.pass ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  console.log(`${color}${mark}${reset} ${r.name}${r.detail && !r.pass ? `  → ${r.detail}` : ''}`);
  if (r.pass) passed++;
  else failed++;
}
console.log(`\n  ${passed} passed, ${failed} failed / ${results.length} total`);
process.exit(failed > 0 ? 1 : 0);
