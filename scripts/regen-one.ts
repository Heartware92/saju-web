// 단일 항목 재생성 — gen-temp-data.ts 와 동일 조건으로 1개(date+slot)만 다시 만들어 json 교체.
// 실행: npx tsx scripts/regen-one.ts 2026-06-07 morning
import { Solar } from 'lunar-javascript';
import * as fs from 'fs';
import {
  calculateSaju, normalizeGan, normalizeZhi,
  TEN_GODS_MAP, STEM_ELEMENT, BRANCH_ELEMENT, BRANCH_HIDDEN_STEMS, EARTHLY_BRANCHES,
  type SajuResult,
} from '../src/utils/sajuCalculator';
import { generateTodayFortuneV3Prompt } from '../src/constants/prompts';

const [, , DATE, SLOT] = process.argv;
if (!DATE || !SLOT) { console.error('usage: regen-one.ts <YYYY-MM-DD> <slot>'); process.exit(1); }
const env = fs.readFileSync('.env.local', 'utf8');
const KEY = (env.match(/^GEMINI_API_KEY=(.*)$/m)?.[1] || '').trim().replace(/^["']|["']$/g, '');

function calcTodayGz(result: SajuResult, isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dayGz = Solar.fromYmd(y, m, d).getLunar().getDayInGanZhi();
  const gan = normalizeGan(dayGz[0]); const zhi = normalizeZhi(dayGz[1]);
  const map = TEN_GODS_MAP[result.dayMaster] || {};
  const mainHidden = BRANCH_HIDDEN_STEMS[zhi]?.[0] || '';
  const origZhis = [result.pillars.year.zhi, result.pillars.month.zhi, result.pillars.day.zhi,
    ...(result.hourUnknown ? [] : [result.pillars.hour.zhi])];
  const interactions: string[] = [];
  const ti = EARTHLY_BRANCHES.indexOf(zhi);
  const hex: [string,string][] = [['자','축'],['인','해'],['묘','술'],['진','유'],['사','신'],['오','미']];
  origZhis.forEach(oz => { const oi = EARTHLY_BRANCHES.indexOf(oz); if (oi<0||ti<0) return;
    const md = Math.min(Math.abs(ti-oi), 12-Math.abs(ti-oi));
    if (md===6) interactions.push(`일진${zhi}×${oz} 충(沖)`); else if (md===0) interactions.push(`일진${zhi}×${oz} 동(同)`);
    hex.forEach(([a,b])=>{ if((zhi===a&&oz===b)||(zhi===b&&oz===a)) interactions.push(`일진${zhi}×${oz} 합(合)`); });
  });
  return { gan, zhi, hanja:`${gan}${zhi}`, ganElement: STEM_ELEMENT[gan]||'', zhiElement: BRANCH_ELEMENT[zhi]||'',
    tenGodGan: map[gan]||'', tenGodZhi: mainHidden ? (map[mainHidden]||'') : '', interactions };
}

const SYS = '당신은 정통 사주명리 전문가입니다. 핵심만 간결하게, 실용적으로 답변하세요. 한국어로 작성하며 이모지는 최소화하세요.';
async function callGemini(prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}`;
  for (let a=1;a<=4;a++){ try {
    const res = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ systemInstruction:{parts:[{text:SYS}]}, contents:[{role:'user',parts:[{text:prompt}]}], generationConfig:{ temperature:0.85, maxOutputTokens:8192, thinkingConfig:{thinkingBudget:0,includeThoughts:false} } }) });
    const j:any = await res.json();
    if(!res.ok){ if(a<4){await new Promise(r=>setTimeout(r,2500));continue;} return `[오류 ${res.status}]`; }
    const t = j?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text).join('')||'';
    // 15개 마커 전부 존재해야 통과 — 하나라도 누락 시 재시도
    const MARKERS = ['today_scores','today_flow','today_basis','today_domains_brief','today_hobby_method','today_timeflow','today_sleep','today_meal','today_exercise','today_relationship','today_caution','today_strength','today_persona_extra','today_lucky_card','today_fortune_message'];
    const missing = MARKERS.filter(m=>!t.includes(`[${m}]`));
    if((t.length<300 || missing.length>0) && a<4){console.log(`  재시도 ${a} (누락: ${missing.join(',')||'길이부족'})`);await new Promise(r=>setTimeout(r,2000));continue;}
    return t||'[빈 응답]';
  } catch(e:any){ if(a<4){await new Promise(r=>setTimeout(r,2500));continue;} return `[실패 ${e?.message}]`; } }
  return '[재시도 실패]';
}

(async () => {
  const result = calculateSaju(1992, 9, 14, 13, 24, 'male', false);
  const gz = calcTodayGz(result, DATE);
  const slotLabel = { morning:'오전', afternoon:'오후', evening:'저녁', midnight:'새벽' }[SLOT] || SLOT;
  const ctx:any = { hobbies:['업무·일'], jobState:null, loveState:null, timeSlot:SLOT, q1Text:'', q2Text:'' };
  const prompt = generateTodayFortuneV3Prompt(result, gz as any, DATE, ctx, null);
  const raw = await callGemini(prompt);
  const MARKERS = ['today_scores','today_flow','today_basis','today_domains_brief','today_hobby_method','today_timeflow','today_sleep','today_meal','today_exercise','today_relationship','today_caution','today_strength','today_persona_extra','today_lucky_card','today_fortune_message'];
  const missing = MARKERS.filter(m=>!raw.includes(`[${m}]`));
  console.log(`${DATE} ${slotLabel} (일진 ${gz.hanja}) 길이 ${raw.length} 마커 ${15-missing.length}/15${missing.length?' 누락:'+missing.join(','):''}`);
  if (missing.length) { console.error('재생성에도 마커 누락 — 교체 보류'); process.exit(2); }

  const data = JSON.parse(fs.readFileSync('public/temp-test-data.json', 'utf8'));
  const idx = data.items.findIndex((i:any) => i.date===DATE && i.slot===SLOT);
  if (idx < 0) { console.error('대상 항목 없음'); process.exit(3); }
  data.items[idx].record.interpretation_detailed = raw;
  data.items[idx].record.interpretation_basic = raw;
  data.items[idx].iljin = gz.hanja;
  fs.writeFileSync('public/temp-test-data.json', JSON.stringify(data, null, 0));
  console.log('교체 완료:', DATE, slotLabel);
})();
