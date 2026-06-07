// temp_test 데이터 사전 생성 — 4일(6/7~6/10) × 4시간대(오전/오후/저녁/새벽) = 16개. (4열 비교용)
// 결과를 public/temp-test-data.json 으로 저장. 실행: npx tsx scripts/gen-temp-data.ts
import { Solar } from 'lunar-javascript';
import * as fs from 'fs';
import {
  calculateSaju, normalizeGan, normalizeZhi,
  TEN_GODS_MAP, STEM_ELEMENT, BRANCH_ELEMENT, BRANCH_HIDDEN_STEMS, EARTHLY_BRANCHES,
  type SajuResult,
} from '../src/utils/sajuCalculator';
import { generateTodayFortuneV3Prompt } from '../src/constants/prompts';

const env = fs.readFileSync('.env.local', 'utf8');
const KEY = (env.match(/^GEMINI_API_KEY=(.*)$/m)?.[1] || '').trim().replace(/^["']|["']$/g, '');
if (!KEY) { console.error('GEMINI_API_KEY 없음'); process.exit(1); }

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
  for (let a=1;a<=3;a++){ try {
    const res = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ systemInstruction:{parts:[{text:SYS}]}, contents:[{role:'user',parts:[{text:prompt}]}], generationConfig:{ temperature:0.85, maxOutputTokens:8192, thinkingConfig:{thinkingBudget:0,includeThoughts:false} } }) });
    const j:any = await res.json();
    if(!res.ok){ if(a<3){await new Promise(r=>setTimeout(r,2500));continue;} return `[오류 ${res.status}]`; }
    const t = j?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text).join('')||'';
    if(t.length<300&&a<3){await new Promise(r=>setTimeout(r,2500));continue;}
    return t||'[빈 응답]';
  } catch(e:any){ if(a<3){await new Promise(r=>setTimeout(r,2500));continue;} return `[실패 ${e?.message}]`; } }
  return '[재시도 실패]';
}

(async () => {
  // test@test.com 대표: 허진우 1992-09-14 13:24 경남 남 양력
  const birth = { name:'허진우', birth_date:'1992-09-14', birth_time:'13:24', birth_place:'gyeongnam', gender:'male' as const, calendar_type:'solar' };
  const result = calculateSaju(1992, 9, 14, 13, 24, 'male', false);
  const dates = ['2026-06-07','2026-06-08','2026-06-09','2026-06-10'];
  const slots: {v:string;label:string}[] = [{v:'morning',label:'오전'},{v:'afternoon',label:'오후'},{v:'evening',label:'저녁'},{v:'midnight',label:'새벽'}];
  const items: any[] = [];
  for (const date of dates) {
    const gz = calcTodayGz(result, date);
    for (const slot of slots) {
      const ctx:any = { hobbies:['업무·일'], jobState:null, loveState:null, timeSlot:slot.v, q1Text:'', q2Text:'' };
      const prompt = generateTodayFortuneV3Prompt(result, gz as any, date, ctx, null);
      process.stdout.write(`${date} ${slot.label} (일진 ${gz.gan}${gz.zhi}) ...\n`);
      const raw = await callGemini(prompt);
      items.push({ date, slot: slot.v, slotLabel: slot.label, iljin: `${gz.gan}${gz.zhi}`,
        record: {
          profile_id:'temp', profile_name: birth.name,
          birth_date: birth.birth_date, birth_time: birth.birth_time, birth_place: birth.birth_place,
          gender: birth.gender, calendar_type: birth.calendar_type,
          interpretation_detailed: raw, interpretation_basic: raw,
          engine_result: { todayGz: gz, userContext: ctx, isoDate: date, version:'v3' },
          category:'today',
        } });
      fs.writeFileSync('public/temp-test-data.json', JSON.stringify({ profile: birth, items }, null, 0)); // 누적 저장
    }
  }
  process.stdout.write(`완료: public/temp-test-data.json (${items.length}개)\n`);
})();
