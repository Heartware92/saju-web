/**
 * 운세 분석 서비스 (크레딧 시스템 통합)
 */

import { SajuResult } from '../utils/sajuCalculator';
import { archiveSaju, archiveTarot } from './archiveService';
import {
  SYSTEM_PROMPT,
  generateBasicPrompt,
  generateDetailedPrompt,
  generateTodayFortunePrompt,
  generateTodayFortuneV3Prompt,
  TODAY_V3_SECTION_KEYS,
  type TodayV3SectionKey,
  type TodayV3DomainKey,
  type TodayUserContext,
  type TodayTimeSlot,
  generateTarotPrompt,
  generateTodayTarotPrompt,
  generateMonthlyTarotPrompt,
  generateHybridPrompt,
  // [B안] generateLoveFortunePrompt / generateWealthFortunePrompt — 호출처 함수 비활성. 복원 시 같이 풀기.
  // generateLoveFortunePrompt, generateWealthFortunePrompt,
  // [B안] love/wealth/career/health/people Short 프롬프트 비활성. 복원 시 같이 풀기.
  // generateLoveShortPrompt, generateWealthShortPrompt, generateCareerShortPrompt,
  // generateHealthShortPrompt, generatePeopleShortPrompt,
  generateStudyShortPrompt,
  generateChildrenShortPrompt,
  generatePersonalityShortPrompt,
  generateNameFortunePrompt,
  type NameAnalysisInput,
  generateDreamInterpretationPrompt,
  generateTojeongPrompt,
  generateTojeongPass1Prompt,
  generateTojeongPass2Prompt,
  type TojeongSectionKey,
  TOJEONG_SECTION_KEYS,
  generateZamidusuPrompt,
  ZAMIDUSU_SECTION_KEYS,
  ZAMIDUSU_SECTION_LABELS,
  type ZamidusuSectionKey,
  generatePeriodDomainsPrompt,
  generateNewyearReportPrompt,
  generateJungtongsajuCorePrompt,
  generateJungtongsajuApplicationPrompt,
  generateTaekilAdvicePrompt,
  generatePickedDateFortunePrompt,
  PICKED_DATE_SECTION_KEYS,
  type PickedDateSectionKey,
  NEWYEAR_SECTION_KEYS,
  JUNGTONGSAJU_SECTION_KEYS,
  TODAY_SECTION_KEYS,
  type PeriodDomainBrief,
  type NewyearSectionKey,
  type JungtongsajuSectionKey,
  type TodaySectionKey,
  type TodayGanZhi,
} from '../constants/prompts';
import type { TaekilResult } from '../engine/taekil';
import { Solar } from 'lunar-javascript';
import {
  TEN_GODS_MAP,
  BRANCH_HIDDEN_STEMS,
  STEM_ELEMENT,
  BRANCH_ELEMENT,
  normalizeGan,
  normalizeZhi,
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
} from '../utils/sajuCalculator';
import type { PeriodFortune } from '../engine/periodFortune';
import type { TarotCardInfo } from './api';
import type { TojeongResult } from '../engine/tojeong';
import type { ZamidusuResult } from '../engine/zamidusu';
import { MORE_FORTUNE_CONFIGS } from '../constants/moreFortunes';

interface FortuneResponse {
  success: boolean;
  content?: string;
  error?: string;
}

/**
 * AI 응답 후처리 — "AI 티 나는" Markdown·이모지 안전망
 *
 * 프론트는 응답을 <pre> 로 렌더하므로, 모델이 SYSTEM_PROMPT 규칙을 어기고
 * `## `, `### `, `**`, 이모지 등을 토해내면 독자 눈에 그대로 보인다.
 * 이 함수는 최종 레이어에서 잔여 마크업을 정리해 자연스러운 한국어만 남긴다.
 *
 * 규칙:
 * - 줄머리의 `#` `##` `###` `####` 헤딩 마커 제거 (뒤에 오는 제목은 보존)
 * - 굵게 표기 `**text**` / `__text__` → `text`
 * - 이탤릭 `*text*` / `_text_` (단, 단독 단어만 — 불릿과 겹치지 않게 보수적 처리)
 * - 인라인 백틱 `` `text` `` → `text`
 * - blockquote 줄머리 `> ` 제거
 * - 흔한 장식 이모지·이모티콘 제거
 * - "AI로서 분석해 보면…" 같은 자기소개 문구 제거
 * - 섹션 머리에 남는 "1. **사주 총론**" 류를 "1. 사주 총론" 으로 정리
 * - 양 끝 공백·중복 개행 정리
 */
const STRIP_EMOJI_REGEX =
  /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F02F}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25B5}\u{25B7}-\u{25FF}]/gu;

export const sanitizeAIOutput = (raw: string): string => {
  if (!raw) return '';
  let text = raw;

  // 1) 코드펜스 블록 전체 제거 (삼중 백틱으로 둘러싼 영역) — 드물지만 방어
  text = text.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, '').trim());

  // 2) 줄머리 헤딩 마커 제거 (#, ##, ###, ####, #####, ######)
  text = text.replace(/^\s*#{1,6}\s+/gm, '');

  // 3) 줄머리 blockquote 마커 제거
  text = text.replace(/^\s*>\s+/gm, '');

  // 4) 볼드/이탤릭 마크 제거 (내용은 보존)
  //    - ** ** / __ __ (볼드)
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');
  text = text.replace(/__(.+?)__/g, '$1');
  //    - * * / _ _ (이탤릭) — 줄머리 "* " 불릿은 보존하고 인라인만 제거
  text = text.replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1$2');
  text = text.replace(/(^|[^_])_(?!\s)([^_\n]+?)_(?!_)/g, '$1$2');

  // 5) 인라인 백틱 제거
  text = text.replace(/`([^`\n]+?)`/g, '$1');

  // 6) 줄머리 불릿 마커 `* ` → `- ` (plain 불릿 통일)
  text = text.replace(/^\s*\*\s+/gm, '- ');

  // 7) 이모지·장식 기호 제거
  text = text.replace(STRIP_EMOJI_REGEX, '');

  // 8) AI 자기소개 문구 제거
  text = text.replace(/^\s*(?:AI로서|인공지능으로서|챗봇으로서|저는 AI)[^\n]*\n?/gm, '');
  text = text.replace(/제공된 (?:데이터|정보)에 (?:따르면|근거하여)[^,.\n]*[,.]?/g, '');

  // 9) 중복 공백·개행 정리
  text = text.replace(/[ \t]+\n/g, '\n');           // 줄 끝 공백
  text = text.replace(/\n{3,}/g, '\n\n');           // 3개 이상 연속 개행 → 2개
  text = text.replace(/^[ \t]+/gm, (m) => m.replace(/\t/g, '  ')); // 들여쓰기 탭 → 공백 2개

  return text.trim();
};

/**
 * GPT API 호출 헬퍼 (서버 API Route 경유)
 * - 응답을 sanitize 하여 마크다운·이모지 잔해 제거
 */
// Vercel 서버 maxDuration=120초와 맞춤. 개별 API 호출 1회당 최대 대기 시간.
const AI_CLIENT_TIMEOUT_MS = 55_000;

/**
 * truncation 사유 에러 — UI 가 메시지 그대로 노출해 사용자가 재시도하도록 유도.
 * 잘린 응답을 캐시에 저장하면 재진입 시도 같은 잘린 결과만 반복되므로,
 * truncated 일 때는 에러로 throw 해 caller 의 catch 분기로 빠뜨려야 한다.
 */
const TRUNCATED_MESSAGE = '응답이 길어서 일부 잘렸어요. 잠시 후 다시 시도해주세요.';
const TOO_SHORT_MESSAGE = '풀이 결과가 비정상적으로 짧아요. 잠시 후 다시 시도해주세요.';

/**
 * AI 응답이 비정상적으로 짧을 때 거르는 안전망. AI가 "I cannot..." 같은 거부 메시지를
 * 짧게 반환하거나, 구조화 응답이 깨져서 빈 본문에 가까운 텍스트만 올 때 캐시·차감을 막는다.
 * - 기본 최소 길이 = maxTokens × 0.15 자 (보수적). 호출자가 minContentLength 로 덮어쓸 수 있음.
 */
const callGPT = async (
  userPrompt: string,
  maxTokens: number = 1000,
  minContentLength?: number,
  opts?: { allowTruncated?: boolean; timeoutMs?: number },
): Promise<string> => {
  const controller = new AbortController();
  const timeout = opts?.timeoutMs ?? AI_CLIENT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: userPrompt, maxTokens, systemPrompt: SYSTEM_PROMPT }),
      signal: controller.signal,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || '분석을 가져오는데 실패했습니다.');
    }
    if (!data.content || typeof data.content !== 'string') {
      throw new Error('응답이 비어 있어요. 잠시 후 다시 시도해주세요.');
    }
    if (data.truncated === true) {
      console.warn('[AI] truncated response — bump maxTokens', { len: data.content.length, maxTokens });
      if (!opts?.allowTruncated) {
        throw new Error(TRUNCATED_MESSAGE);
      }
    }
    const sanitized = sanitizeAIOutput(data.content);
    const minLen = minContentLength ?? Math.max(80, Math.floor(maxTokens * 0.15));
    if (sanitized.length < minLen) {
      console.warn('[AI] too-short response — likely refusal/garbage', { len: sanitized.length, minLen, snippet: sanitized.slice(0, 80) });
      throw new Error(TOO_SHORT_MESSAGE);
    }
    return sanitized;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('응답이 너무 오래 걸려요. 잠시 후 다시 시도해주세요.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * 무료 기본 해석 (0엽전)
 * - 만세력 확인 + 간단한 종합 운세
 */
export const getBasicInterpretation = async (
  result: SajuResult
): Promise<FortuneResponse> => {
  try {
    const prompt = generateBasicPrompt(result);
    const content = await callGPT(prompt, 1500);

    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * SajuResult → archiveSaju 의 sourceBirth 형태로 변환.
 * 보관함 저장 시 birth_profiles 와 자동 매칭(profile_id, profile_name 채움)에 사용.
 *
 * 주의: result.solarDate 는 항상 양력 변환된 값이라, 원본 입력이 음력인 프로필은
 * birth_profiles.birth_date(음력 원본) 와 매칭이 안 될 수 있음. 그 경우 매칭 실패 →
 * 대표 프로필 fallback (archiveService 내부) 으로 떨어진다. 정확 매칭이 필요하면
 * 호출 페이지가 BirthProfile.id 를 직접 넘기는 방식으로 향후 확장.
 */
const sourceBirthFromSaju = (result: SajuResult) => ({
  birth_date: result.solarDate,
  gender: result.gender,
  calendar_type: 'solar' as const,
});

/**
 * 상세 해석 (무료 공개)
 * - 대운/세운 + 신살 + 종합 상세 분석
 */
export const getDetailedInterpretation = async (
  result: SajuResult,
  profileId?: string,
): Promise<FortuneResponse> => {
  try {
    const prompt = generateDetailedPrompt(result);
    // 2800~3500자 본문 → 넉넉히 5500 토큰
    const content = await callGPT(prompt, 5500);
    archiveSaju({ profileId, sourceBirth: sourceBirthFromSaju(result), category: 'traditional', resultData: result as unknown as Record<string, unknown>, interpretation: content, creditType: 'sun', isDetailed: true });
    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * 오늘의 운세 (전체 무료 — 추후 크레딧 정책 결정 시 재도입)
 */
export const getTodayFortune = async (
  result: SajuResult,
  profileId?: string,
): Promise<FortuneResponse> => {
  try {
    const isoDate = new Date().toISOString().slice(0, 10);
    const todayGz = calcTodayGanZhi(result, isoDate);
    const prompt = generateTodayFortunePrompt(result, todayGz, isoDate);
    const content = await callGPT(prompt, 3500);
    archiveSaju({ profileId, sourceBirth: sourceBirthFromSaju(result), category: 'today', resultData: result as unknown as Record<string, unknown>, interpretation: content, creditType: 'moon', isDetailed: false });
    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * [B안 — 호출처 없음 + 카테고리 비활성으로 동시 정리]
 * getLoveFortune / getWealthFortune 은 정통사주 무료 분석으로 정의됐지만 실제 호출처가 없어
 * 죽은 코드 상태. 이대로 살려두면 향후 누군가 호출 시 archive 카테고리 'love'/'wealth' 로
 * 적재되어 비활성된 보관함 라우트로 떨어짐 → 사용자 좌초.
 * 함수 정의 자체를 주석 보존. 복원 필요 시 카테고리도 'traditional' 로 정정 후 살릴 것.
 */
// export const getLoveFortune = async (
//   result: SajuResult
// ): Promise<FortuneResponse> => {
//   try {
//     const prompt = generateLoveFortunePrompt(result);
//     // 본문 1,400~1,800자 × 한국어 토큰 비율 → 4,500 안전치
//     const content = await callGPT(prompt, 4500);
//     archiveSaju({ sourceBirth: sourceBirthFromSaju(result), category: 'love', resultData: result as unknown as Record<string, unknown>, interpretation: content, isDetailed: true });
//     return { success: true, content };
//   } catch (error: any) {
//     return { success: false, error: error.message };
//   }
// };

// export const getWealthFortune = async (
//   result: SajuResult
// ): Promise<FortuneResponse> => {
//   try {
//     const prompt = generateWealthFortunePrompt(result);
//     // 본문 1,400~1,800자 — 4,500 안전치
//     const content = await callGPT(prompt, 4500);
//     archiveSaju({ sourceBirth: sourceBirthFromSaju(result), category: 'wealth', resultData: result as unknown as Record<string, unknown>, interpretation: content, isDetailed: true });
//     return { success: true, content };
//   } catch (error: any) {
//     return { success: false, error: error.message };
//   }
// };

/**
 * 오늘의 타로 (전체 무료) — 하루 1장 고정
 * card는 UI에서 날짜 시드로 뽑아 전달.
 */
export const getTodayTarotReading = async (
  card: TarotCardInfo,
  dateStr: string
): Promise<FortuneResponse> => {
  try {
    const prompt = generateTodayTarotPrompt(card, dateStr);
    // 본문 1,000~1,300자 — 3,000 안전치
    const content = await callGPT(prompt, 3000);
    archiveTarot({ spreadType: 'today', cards: { card, dateStr } as unknown as Record<string, unknown>, interpretation: content });
    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * 이달의 타로 (전체 무료) — 3장 스프레드 (상/중/하순)
 */
export const getMonthlyTarotReading = async (
  cards: { early: TarotCardInfo; middle: TarotCardInfo; late: TarotCardInfo },
  monthStr: string
): Promise<FortuneResponse> => {
  try {
    const prompt = generateMonthlyTarotPrompt(cards, monthStr);
    // 본문 1,800~2,200자 — 5,000 안전치
    const content = await callGPT(prompt, 5000);
    archiveTarot({ spreadType: 'monthly-3card', cards: { ...cards, monthStr } as unknown as Record<string, unknown>, interpretation: content });
    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * 타로 단독 해석 (전체 무료)
 */
export const getTarotReading = async (
  card: TarotCardInfo,
  question?: string
): Promise<FortuneResponse> => {
  try {
    const prompt = generateTarotPrompt(card, question);
    // 본문 750~950자 — 2,500 안전치
    const content = await callGPT(prompt, 2500);
    archiveTarot({ spreadType: 'single', cards: { card } as unknown as Record<string, unknown>, question, interpretation: content });
    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * 토정비결 AI 결과 (2-pass, 섹션 파싱 + 도메인 점수)
 */
export interface TojeongAIResult {
  success: boolean;
  /** 원본 AI 전문 (fallback 또는 디버깅) */
  content?: string;
  /** 섹션별 본문 — key는 TojeongSectionKey */
  sections?: Partial<Record<TojeongSectionKey, string>>;
  /** 도메인별 0~100 점수 (시각화용) */
  domainScores?: { wealth: number; love: number; health: number; career: number };
  error?: string;
}

/** [tojeong_scores] 재물:72 | 애정:65 | 건강:58 | 직장:80 [/tojeong_scores] 파싱 */
export function parseTojeongScores(raw: string): { wealth: number; love: number; health: number; career: number } | null {
  const m = raw.match(/\[tojeong_scores\]\s*(.+?)\s*\[\/tojeong_scores\]/);
  if (!m) return null;
  const inner = m[1];
  const extract = (label: string): number => {
    const r = new RegExp(`${label}\\s*:\\s*(\\d+)`);
    const found = inner.match(r);
    return found ? Math.min(100, Math.max(0, Number(found[1]))) : 50;
  };
  return {
    wealth: extract('재물'),
    love: extract('애정'),
    health: extract('건강'),
    career: extract('직장'),
  };
}

/** [key] 델리미터로 토정비결 섹션 파싱 */
export function parseTojeongSections(raw: string): Partial<Record<TojeongSectionKey, string>> {
  const out: Partial<Record<TojeongSectionKey, string>> = {};
  const re = /^\s*\[(chongun|gwae|monthly|wealth|love|health|career|advice)\]\s*$/m;
  const parts = raw.split(re);
  // parts: ['', 'chongun', '본문...', 'gwae', '본문...', ...]
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i] as TojeongSectionKey;
    const body = (parts[i + 1] ?? '').trim();
    if (TOJEONG_SECTION_KEYS.includes(key) && body) {
      out[key] = body;
    }
  }
  return out;
}

/**
 * 토정비결 (전체 무료) — 2-pass AI 호출
 *
 * @param sourceBirth (선택) 풀이 주체 birth 정보. 호출자가 넘기면 archiveSaju 가
 *                    같은 birth_date+gender 의 birth_profiles 행을 매칭해
 *                    profile_id/name 자동 채움. 미전달 시 대표 프로필로 fallback.
 */
export const getTojeongReading = async (
  tj: TojeongResult,
  sourceBirth?: { birth_date: string; gender: 'male' | 'female'; calendar_type?: 'solar' | 'lunar' },
  profileId?: string,
): Promise<TojeongAIResult> => {
  const archive = (content: string) => {
    archiveSaju({ profileId, sourceBirth, category: 'tojeong', engineResult: tj as unknown as Record<string, unknown>, interpretation: content, isDetailed: true });
  };

  // 전체 150초 제한 — 4단 폴백을 모두 시도할 수 있는 마진.
  //   2-pass(35+25=60) + single(35) + compact(25) + minimal(20) = 140s
  //   어떤 상황에서도 150초 안에 결과 반환(빈 문자열일 수 있음). 페이지가 graceful 처리.
  return Promise.race([
    tojeongAllAttempts(tj, archive),
    new Promise<TojeongAIResult>(resolve =>
      setTimeout(() => {
        console.warn('[tojeong] 150s overall deadline — returning empty');
        resolve({ success: true, content: '' });
      }, 150_000),
    ),
  ]);
};

async function tojeongAllAttempts(
  tj: TojeongResult,
  archive: (content: string) => void,
): Promise<TojeongAIResult> {
  // ── 시도 1: 2-pass (풍부한 결과, pass1 35s + pass2 25s) ──
  // pass2 가 실패해도 pass1 결과만으로 반환. pass1 자체가 실패하면 시도 2로.
  try {
    const result = await tojeong2Pass(tj);
    if (result.content) {
      archive(result.content);
      return result;
    }
  } catch (e: any) {
    console.warn('[tojeong] try1 (2-pass) failed:', e.message);
  }

  // ── 시도 2: 레거시 단일 호출 (35s 타임아웃, 4000 토큰) ──
  try {
    const content = await callGPT(generateTojeongPrompt(tj), 4000, undefined, { allowTruncated: true, timeoutMs: 35_000 });
    if (content) {
      archive(content);
      return { success: true, content };
    }
  } catch (e: any) {
    console.warn('[tojeong] try2 (single 4000) failed:', e.message);
  }

  // ── 시도 3: 컴팩트 단일 호출 (25s 타임아웃, 2400 토큰) ──
  try {
    const content = await callGPT(generateTojeongPrompt(tj), 2400, undefined, { allowTruncated: true, timeoutMs: 25_000 });
    if (content) {
      archive(content);
      return { success: true, content };
    }
  } catch (e: any) {
    console.warn('[tojeong] try3 (compact 2400) failed:', e.message);
  }

  // ── 시도 4: 미니멀 단일 호출 (20s 타임아웃, 1500 토큰) ──
  // 마지막 안전망 — 분량은 줄지만 사용자에게 뭐라도 보이도록 보장.
  try {
    const content = await callGPT(generateTojeongPrompt(tj), 1500, undefined, { allowTruncated: true, timeoutMs: 20_000 });
    if (content) {
      archive(content);
      return { success: true, content };
    }
  } catch (e: any) {
    console.warn('[tojeong] try4 (minimal 1500) failed:', e.message);
  }

  // 4단 폴백 모두 실패 — 에러 대신 빈 결과. 페이지의 무료 결정론적 풀이가 결과로 노출됨.
  return { success: true, content: '' };
}

async function tojeong2Pass(tj: TojeongResult): Promise<TojeongAIResult> {
  const pass1Prompt = generateTojeongPass1Prompt(tj);
  const pass1Content = await callGPT(pass1Prompt, 6000, undefined, { allowTruncated: true, timeoutMs: 35_000 });
  const pass1Sections = parseTojeongSections(pass1Content);
  const domainScores = parseTojeongScores(pass1Content) ?? undefined;

  let pass2Content = '';
  let pass2Sections: Partial<Record<TojeongSectionKey, string>> = {};
  try {
    const pass2Prompt = generateTojeongPass2Prompt(tj, pass1Content);
    pass2Content = await callGPT(pass2Prompt, 5500, undefined, { allowTruncated: true, timeoutMs: 25_000 });
    pass2Sections = parseTojeongSections(pass2Content);
  } catch {
    // pass2 실패해도 pass1 결과는 반환
  }

  const sections: Partial<Record<TojeongSectionKey, string>> = { ...pass1Sections, ...pass2Sections };
  const content = pass2Content ? `${pass1Content}\n\n${pass2Content}` : pass1Content;

  if (Object.keys(sections).length === 0) {
    return { success: true, content, domainScores };
  }
  return { success: true, content, sections, domainScores };
}

/**
 * 자미두수 (전체 무료) — 섹션 델리미터 파싱까지
 */
export interface ZamidusuAIResult {
  success: boolean;
  /** 원본 AI 전문 (fallback 또는 디버깅) */
  content?: string;
  /** 섹션별 본문 — key는 ZAMIDUSU_SECTION_KEYS 중 하나 */
  sections?: Partial<Record<ZamidusuSectionKey, string>>;
  error?: string;
}

const ZAMIDUSU_KEYS: ZamidusuSectionKey[] = [
  'overview', 'core', 'relations', 'wealth', 'body_mind', 'mutagen', 'daehan', 'advice',
];

export function parseZamidusuSections(raw: string): Partial<Record<ZamidusuSectionKey, string>> {
  const out: Partial<Record<ZamidusuSectionKey, string>> = {};
  const re = /^\s*\[(overview|core|relations|wealth|body_mind|mutagen|daehan|advice)\]\s*$/m;
  const parts = raw.split(re);
  // parts: ['', 'overview', '본문...', 'core', '본문...', ...]
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i] as ZamidusuSectionKey;
    const body = (parts[i + 1] ?? '').trim();
    if (ZAMIDUSU_KEYS.includes(key) && body) {
      out[key] = body;
    }
  }
  return out;
}

export const getZamidusuReading = async (
  z: ZamidusuResult,
  sourceBirth?: { birth_date: string; gender: 'male' | 'female'; calendar_type?: 'solar' | 'lunar' },
  profileId?: string,
): Promise<ZamidusuAIResult> => {
  try {
    const prompt = generateZamidusuPrompt(z);

    // 2-pass 분할: 1차(overview·core·relations·wealth) + 2차(body_mind·mutagen·daehan·advice)
    const pass1Prompt = prompt + '\n\n★ 이번 응답에서는 [overview] [core] [relations] [wealth] 4개 섹션만 출력하세요. 나머지 4개는 다음 호출에서 작성합니다. 각 섹션의 분량 지침을 충실히 따라 깊이 있게 작성하세요.';
    const pass1Content = await callGPT(pass1Prompt, 7000);
    const pass1Sections = parseZamidusuSections(pass1Content);

    const pass2Prompt = prompt
      + '\n\n★ 이번 응답에서는 [body_mind] [mutagen] [daehan] [advice] 4개 섹션만 출력하세요. [overview] [core] [relations] [wealth]는 이미 완료되었습니다. 각 섹션의 분량 지침을 충실히 따라 깊이 있게 작성하세요.'
      + `\n\n[이미 작성된 1차 내용 — 참고만, 출력하지 말 것]\n${pass1Content}`;
    const pass2Content = await callGPT(pass2Prompt, 6000);
    const pass2Sections = parseZamidusuSections(pass2Content);

    const sections: Partial<Record<ZamidusuSectionKey, string>> = { ...pass1Sections, ...pass2Sections };
    const content = `${pass1Content}\n\n${pass2Content}`;

    archiveSaju({ profileId, sourceBirth, category: 'zamidusu', engineResult: z as unknown as Record<string, unknown>, interpretation: content, isDetailed: true });

    if (Object.keys(sections).length === 0) {
      return { success: true, content, sections: undefined };
    }
    return { success: true, content, sections };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * 기간 운세 영역별 상세 (무료)
 * - 엔진이 계산한 도메인 점수/등급을 근거로 각 영역 5문장 분석 생성
 * - 응답은 [key] 델리미터로 구분된 블록. 파싱 실패 시 전체 원문을 error 로 반환.
 */
const DOMAIN_KEYS: PeriodDomainBrief['key'][] = ['wealth', 'career', 'love', 'health', 'study'];

export interface PeriodDomainsAIResult {
  success: boolean;
  descriptions?: Partial<Record<PeriodDomainBrief['key'], string>>;
  error?: string;
}

const parsePeriodDomains = (raw: string): Partial<Record<PeriodDomainBrief['key'], string>> => {
  const out: Partial<Record<PeriodDomainBrief['key'], string>> = {};
  // [key] 헤더로 구간 분할 — 줄머리·공백 허용
  const re = /^\s*\[(wealth|career|love|health|study)\]\s*$/m;
  const parts = raw.split(/^\s*\[(wealth|career|love|health|study)\]\s*$/m);
  // split 결과: [서문?, key1, body1, key2, body2, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i] as PeriodDomainBrief['key'];
    const body = (parts[i + 1] || '').trim();
    if (body) out[key] = body;
  }
  // fallback — 한 블록도 못 찾으면 키별 검색
  if (Object.keys(out).length === 0 && re.test(raw)) {
    for (const k of DOMAIN_KEYS) {
      const m = raw.match(new RegExp(`\\[${k}\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[(?:wealth|career|love|health|study)\\]|$)`));
      if (m && m[1].trim()) out[k] = m[1].trim();
    }
  }
  return out;
};

export const getPeriodDomainsDescription = async (
  result: SajuResult,
  opts: {
    scopeLabel: string;
    targetGanZhi: string;
    overallHeadline: string;
    domains: PeriodDomainBrief[];
  }
): Promise<PeriodDomainsAIResult> => {
  try {
    const prompt = generatePeriodDomainsPrompt(result, opts);
    // 5영역 × 5문장 (각 200~300자) ≈ 1,500자. 한국어 토큰 비율 보수적 4,500.
    const content = await callGPT(prompt, 4500);
    const descriptions = parsePeriodDomains(content);

    if (Object.keys(descriptions).length === 0) {
      return { success: false, error: '영역별 설명 파싱 실패' };
    }
    return { success: true, descriptions };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * 정통사주 종합 리포트 (원국 기반 9섹션 분석)
 */
export interface AdviceMeta {
  title: string;
  timeSlot: string;
  foods: string[];
  body: string;
  actions: string[];
}

export function parseAdviceMeta(text: string): AdviceMeta {
  const lines = text.split('\n').map(l => l.trim());
  let title = '';
  let timeSlot = '';
  let foods: string[] = [];
  const bodyLines: string[] = [];
  const actions: string[] = [];
  let metaParsed = false;
  let inActions = false;

  for (const line of lines) {
    if (!line) continue;

    if (!title) { title = line; continue; }

    if (!metaParsed && line.startsWith('시간대:')) {
      timeSlot = line.replace('시간대:', '').trim();
      continue;
    }
    if (!metaParsed && line.startsWith('음식:')) {
      foods = line.replace('음식:', '').trim().split(/[,，·]/).map(f => f.trim()).filter(Boolean);
      metaParsed = true;
      continue;
    }

    if (line === '이번 달 실천:' || line.startsWith('이번 달 실천') || line === '평생 실천:' || line.startsWith('평생 실천')) {
      inActions = true;
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('· ')) {
      actions.push(line.slice(2).trim());
      continue;
    }

    if (!inActions) {
      bodyLines.push(line);
    }
  }

  return { title, timeSlot, foods, body: bodyLines.join('\n').trim(), actions };
}

export interface JungtongsajuAIResult {
  success: boolean;
  sections?: Partial<Record<JungtongsajuSectionKey, string>>;
  rawText?: string;
  error?: string;
  adviceMeta?: AdviceMeta;
  /** 2-pass 의 2차가 실패하고 1차 4섹션만 받았을 때 true. 사용자에게 안내 표시. */
  partial?: boolean;
  partialMessage?: string;
}

export const parseJungtongsaju = (raw: string): Partial<Record<JungtongsajuSectionKey, string>> => {
  const out: Partial<Record<JungtongsajuSectionKey, string>> = {};
  const keysPattern = JUNGTONGSAJU_SECTION_KEYS.join('|');
  const parts = raw.split(new RegExp(`^\\s*\\[(${keysPattern})\\]\\s*$`, 'm'));
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i] as JungtongsajuSectionKey;
    const body = (parts[i + 1] || '').trim();
    if (body) out[key] = body;
  }
  return out;
};

/**
 * 1차 응답 본문에서 시적 별칭/은유 표현을 자동 추출.
 * 2차 호출에 "이 별칭들 절대 0회" 동적 차단 리스트로 주입하기 위함 (B 옵션).
 *
 * 추출 패턴:
 * 1) 괄호 안 별칭: "편인격(가장 멀리, 홀로 빛나는 별)" → "가장 멀리, 홀로 빛나는 별"
 * 2) 일간 오행 별칭: "겨울 밤하늘 은하수", "한낮 정오의 태양", "정오 태양"
 * 3) 신강신약 별칭: "보름달", "초승달", "반달"
 * 4) 용신 별칭: "북극성"
 * 5) 십성 별칭: "아침 햇살이 정원을", "프리즘을 통과한 빛", "혜성", "달이 꾸준히 차오르는"
 * 6) 신살 별칭: "흐린 밤에도 유독 밝게 빛나는", "꽃이 만개한 봄밤의 달빛", "별똥별"
 *
 * 중복 제거 + 짧은(2자 이하) 항목 제거.
 */
const extractMetaphorAliases = (coreContent: string): string[] => {
  const found = new Set<string>();

  // 1) 괄호 안 시적 별칭 (한글 + 공백 + 쉼표만 허용, 길이 6자 이상 — 짧은 한자병기 "甲木" 같은 거 제외)
  const parenRegex = /\(([가-힣 ,·]{6,40})\)/g;
  let m;
  while ((m = parenRegex.exec(coreContent)) !== null) {
    const inner = m[1].trim();
    // 별칭으로 보이는 것만 (공백 또는 쉼표 포함하는 시적 표현)
    if (/[ ,]/.test(inner) && !inner.includes('점') && !inner.includes('년')) {
      found.add(inner);
    }
  }

  // 2) KB 의 핵심 시적 별칭 (직접 매칭 — 괄호 밖에 등장하는 경우)
  const kbAliases = [
    '가장 멀리, 홀로 빛나는 별', '가장 멀리 홀로 빛나는 별', '홀로 먼 곳에서 빛나는 별',
    '겨울 밤하늘 은하수', '겨울 밤 은하수', '겨울 밤하늘',
    '한낮 정오의 태양', '정오의 태양', '정오 태양',
    '봄 새벽 첫 햇살', '봄 새벽 햇살', '봄 새벽',
    '서리 내린 새벽',
    '환절기 구름',
    '보름달처럼', '보름달', '초승달', '반달',
    '북극성',
    '아침 햇살이 정원을', '프리즘을 통과한 빛',
    '혜성처럼', '혜성', '달이 꾸준히 차오르는',
    '나란히 빛나는 쌍둥이 별', '내 빛을 빼앗으려는 그림자 별', '그림자 별',
    '흐린 밤에도 유독 밝게 빛나는', '꽃이 만개한 봄밤의 달빛',
    '별똥별', '하늘 정중앙에 뜬 별',
  ];
  kbAliases.forEach((alias) => {
    if (coreContent.includes(alias)) found.add(alias);
  });

  // 3) 정형 표기 패턴 — KB 별칭이 아니지만 매번 같은 형식으로 반복되는 표현
  // 예: "용신인 목(갑목·을목), 즉 식신/상관" "결핍 오행인 목(갑목·을목)"
  const formulaicPatterns = [
    /용신인 [목화토금수]\([가-힣·]+\)[,，]?\s*즉 [가-힣·/]+/g,
    /결핍 오행인 [목화토금수]\([가-힣·]+\)/g,
    /과다 오행인 [목화토금수]\([가-힣·]+\)/g,
    /격국이 만드는 인생 [가-힣 ]+/g,
  ];
  formulaicPatterns.forEach((re) => {
    let mm;
    while ((mm = re.exec(coreContent)) !== null) {
      found.add(mm[0].trim());
    }
  });

  // 4) 명리적 결론 표현 — 데이터에서 자동 도출되어 매번 같은 결론으로 반복
  // "결핍 목 → 새로운 시작 부족", "과도한 분석 → 행동 지연" 같은 결론은 1차에서 다뤘으면 2차 0회
  const conclusionPatterns = [
    '새로운 시작에 대한 망설임',
    '실행력이 부족',
    '실행력 부족',
    '계획만 세우고',
    '실제 행동으로 옮기는 데 어려움',
    '과도한 분석',
    '지나치게 신중하고 완벽',
    '완벽주의로 이어',
    '기회를 놓치',
    '계획에만 몰두',
    '디테일에 갇혀',
    '겉냉속열', '겉은 차분, 속은 열정', '겉은 차분하고', '속은 뜨거운',
  ];
  conclusionPatterns.forEach((p) => {
    if (coreContent.includes(p)) found.add(p);
  });

  // 너무 짧거나 너무 긴 것 제거 + 중복 정리
  return Array.from(found).filter((s) => s.length >= 4 && s.length <= 60);
};

/**
 * 정통사주 풀이 — 2-pass 분할 호출 + A/B/J 통합 중복 방지.
 * 1차(Core 4섹션): general·daymaster·element·interaction → 사주 핵심 분석
 * 2차(Application 8섹션): 1차 결과 + 1차에서 쓴 별칭 자동 추출 → "이 별칭들 0회" 차단
 *
 * 점진 노출 UX: onCoreReady 콜백이 있으면 1차 완료 즉시 호출되어
 * 페이지가 핵심 4섹션을 먼저 렌더하고 2차는 백그라운드 진행.
 *
 * 분량: 1차 ~3,000자 + 2차 ~5,200자 = 총 ~8,200자 (이전 ~5,000자의 1.6배)
 * 비용·시간: 호출 2배. 중복 회피 효과 압도적.
 */
export const getJungtongsajuReport = async (
  result: SajuResult,
  onCoreReady?: (partial: JungtongsajuAIResult) => void,
  profileId?: string,
): Promise<JungtongsajuAIResult> => {
  try {
    // ── 1차 호출: Core 4섹션 ──
    const corePrompt = generateJungtongsajuCorePrompt(result);
    // 명세 ~3,000자 → 한국어 토큰 비율 고려 7,000 (안전 여유 2.3x)
    const coreContent = await callGPT(corePrompt, 7000);
    const coreSections = parseJungtongsaju(coreContent);
    if (Object.keys(coreSections).length === 0) {
      // 마커 파싱 실패 — 1차부터 무너지면 rawText fallback
      return { success: true, rawText: coreContent };
    }
    // 점진 노출 — 페이지가 1차 결과 즉시 렌더하도록 콜백
    onCoreReady?.({ success: true, sections: coreSections });

    // ── B 옵션: 1차 본문에서 시적 별칭 자동 추출 ──
    const forbiddenAliases = extractMetaphorAliases(coreContent);
    if (forbiddenAliases.length > 0) {
      console.log('[jungtongsaju] 2차 차단 별칭:', forbiddenAliases.length, '개');
    }

    // ── 2차 호출: Application 8섹션 (1차 컨텍스트 + 별칭 차단 리스트) ──
    // ★★ 2차 실패해도 1차 결과는 절대 잃지 않음 — 결제 후 빈손 방지 안전장치
    const appPrompt = generateJungtongsajuApplicationPrompt(result, coreContent, forbiddenAliases);
    let appContent = '';
    let appSections: Partial<Record<JungtongsajuSectionKey, string>> = {};
    let appError: string | null = null;
    try {
      // 명세 ~5,200자 → 한국어 토큰 비율 고려 12,000 (안전 여유 2.3x)
      appContent = await callGPT(appPrompt, 12000);
      appSections = parseJungtongsaju(appContent);
    } catch (e: any) {
      // 2차 실패 — 1차 4섹션 결과는 살려서 반환. 사용자에게 결제 후 빈손 X.
      console.error('[jungtongsaju] 2차 호출 실패, 1차 4섹션만 반환:', e?.message);
      appError = e?.message || '2차 분석 중 오류가 발생했어요.';
    }

    // ── 머지 + archive ──
    const merged: Partial<Record<JungtongsajuSectionKey, string>> = { ...coreSections, ...appSections };
    const fullContent = appContent ? `${coreContent}\n\n${appContent}` : coreContent;
    archiveSaju({
      profileId,
      sourceBirth: sourceBirthFromSaju(result),
      category: 'traditional',
      resultData: result as unknown as Record<string, unknown>,
      interpretation: fullContent,
      isDetailed: true,
    });

    const adviceMeta = merged.advice ? parseAdviceMeta(merged.advice) : undefined;
    // 2차 실패해도 success: true (1차 결과는 정상). 단 partial 표시 + 안내 메시지
    return {
      success: true,
      sections: merged,
      adviceMeta,
      ...(appError ? {
        partial: true,
        partialMessage: '핵심 4섹션은 분석 완료. 나머지 8섹션(직업·재물·애정·건강 등)은 일시 오류로 분석 못 했어요. 새로고침 시 재차감 없이 8섹션만 다시 시도합니다.',
      } : {}),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// ── 오늘의 운세 ──────────────────────────────────────────────

export interface TodayScores {
  overall: number;
  wealth: number;
  work: number;
  love: number;
  health: number;
}

export interface TodayFortuneAIResult {
  success: boolean;
  sections?: Partial<Record<TodaySectionKey, string>>;
  scores?: TodayScores;
  rawText?: string;
  error?: string;
  todayGz?: TodayGanZhi;
  isoDate?: string;
}

/** 한자 매핑 */
const GAN_HANJA: Record<string, string> = {
  갑:'甲', 을:'乙', 병:'丙', 정:'丁', 무:'戊', 기:'己', 경:'庚', 신:'辛', 임:'壬', 계:'癸'
};
const ZHI_HANJA: Record<string, string> = {
  자:'子', 축:'丑', 인:'寅', 묘:'卯', 진:'辰', 사:'巳', 오:'午', 미:'未', 신:'申', 유:'酉', 술:'戌', 해:'亥'
};

/** 오늘 일진(日辰) 간지 계산 + 원국과의 합충 분석 */
function calcTodayGanZhi(result: SajuResult, isoDate: string): TodayGanZhi {
  const [y, m, d] = isoDate.split('-').map(Number);
  const solar = Solar.fromYmd(y, m, d);
  const lunar = solar.getLunar();
  const dayGz = lunar.getDayInGanZhi();

  const todayGan = normalizeGan(dayGz[0]);
  const todayZhi = normalizeZhi(dayGz[1]);
  const dayMaster = result.dayMaster;
  const map = TEN_GODS_MAP[dayMaster] || {};

  const ganElement = STEM_ELEMENT[todayGan] || '';
  const zhiElement = BRANCH_ELEMENT[todayZhi] || '';
  const tenGodGan = map[todayGan] || '';
  const mainHidden = BRANCH_HIDDEN_STEMS[todayZhi]?.[0] || '';
  const tenGodZhi = mainHidden ? (map[mainHidden] || '') : '';

  // 원국 지지들과의 합충 간단 분석
  const origZhis = [
    result.pillars.year.zhi,
    result.pillars.month.zhi,
    result.pillars.day.zhi,
    ...(result.hourUnknown ? [] : [result.pillars.hour.zhi]),
  ];
  const interactions: string[] = [];
  const todayIdx = EARTHLY_BRANCHES.indexOf(todayZhi);
  origZhis.forEach(oz => {
    const oIdx = EARTHLY_BRANCHES.indexOf(oz);
    if (oIdx < 0 || todayIdx < 0) return;
    const diff = Math.abs(todayIdx - oIdx);
    const minDiff = Math.min(diff, 12 - diff);
    if (minDiff === 6) interactions.push(`일진${todayZhi}×${oz} 충(沖)`);
    else if (minDiff === 0) interactions.push(`일진${todayZhi}×${oz} 동(同)`);
    // 육합 쌍: 자축, 인해, 묘술, 진유, 사신, 오미
    const hexCombos: [string, string][] = [['자','축'],['인','해'],['묘','술'],['진','유'],['사','신'],['오','미']];
    hexCombos.forEach(([a, b]) => {
      if ((todayZhi === a && oz === b) || (todayZhi === b && oz === a))
        interactions.push(`일진${todayZhi}×${oz} 합(合)`);
    });
  });

  return {
    gan: todayGan,
    zhi: todayZhi,
    hanja: `${GAN_HANJA[todayGan] ?? todayGan}${ZHI_HANJA[todayZhi] ?? todayZhi}`,
    ganElement,
    zhiElement,
    tenGodGan,
    tenGodZhi,
    interactions,
  };
}

export function parseTodayScores(raw: string): TodayScores | undefined {
  const m = raw.match(/\[today_scores\]\s*종합:(\d+)\s*재물:(\d+)\s*업무:(\d+)\s*관계:(\d+)\s*건강:(\d+)/);
  if (!m) return undefined;
  return {
    overall: Math.min(100, Math.max(0, Number(m[1]))),
    wealth:  Math.min(100, Math.max(0, Number(m[2]))),
    work:    Math.min(100, Math.max(0, Number(m[3]))),
    love:    Math.min(100, Math.max(0, Number(m[4]))),
    health:  Math.min(100, Math.max(0, Number(m[5]))),
  };
}

export const parseTodayFortune = (raw: string): Partial<Record<TodaySectionKey, string>> => {
  const out: Partial<Record<TodaySectionKey, string>> = {};
  const keysPattern = TODAY_SECTION_KEYS.join('|');
  const parts = raw.split(new RegExp(`^\\s*\\[(${keysPattern})\\]\\s*$`, 'm'));
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i] as TodaySectionKey;
    const body = (parts[i + 1] || '').trim();
    if (body) out[key] = body;
  }
  return out;
};

export const getTodayFortuneReport = async (
  result: SajuResult,
  isoDate?: string,
  profileId?: string,
): Promise<TodayFortuneAIResult> => {
  try {
    const date = isoDate ?? new Date().toISOString().slice(0, 10);
    const todayGz = calcTodayGanZhi(result, date);
    const prompt = generateTodayFortunePrompt(result, todayGz, date);
    const content = await callGPT(prompt, 3500);
    const scores = parseTodayScores(content);
    const sections = parseTodayFortune(content);
    archiveSaju({ profileId, sourceBirth: sourceBirthFromSaju(result), category: 'today', resultData: result as unknown as Record<string, unknown>, engineResult: { todayGz, isoDate: date }, interpretation: content });

    if (Object.keys(sections).length === 0) {
      return { success: true, rawText: content, scores, todayGz, isoDate: date };
    }
    return { success: true, sections, scores, todayGz, isoDate: date };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 오늘의 운세 V3 — 13 섹션 + 9 항목 점수 + 4 시간대 흐름 + 사용자 입력 반영
// ─────────────────────────────────────────────────────────────────────────────

/** 9 항목 점수 (0~100) */
export type TodayV3DomainScores = { overall: number } & Record<TodayV3DomainKey, number>;

/** 4 시간대 흐름 점수 (0~100) */
export type TodayV3FlowScores = Record<TodayTimeSlot, number>;

export interface TodayFortuneV3AIResult {
  success: boolean;
  sections?: Partial<Record<TodayV3SectionKey, string>>;
  domainScores?: TodayV3DomainScores;
  flowScores?: TodayV3FlowScores;
  rawText?: string;
  error?: string;
  todayGz?: TodayGanZhi;
  isoDate?: string;
  userContext?: TodayUserContext;
}

/** [today_scores] 종합:XX 시험:XX 공부:XX 멘탈:XX 대인:XX 이성:XX 금전:XX 운동:XX 회복:XX 횡재:XX */
export function parseTodayV3DomainScores(raw: string): TodayV3DomainScores | undefined {
  const m = raw.match(/\[today_scores\]\s*종합:(\d+)\s*시험:(\d+)\s*공부:(\d+)\s*멘탈:(\d+)\s*대인:(\d+)\s*이성:(\d+)\s*금전:(\d+)\s*운동:(\d+)\s*회복:(\d+)\s*횡재:(\d+)/);
  if (!m) return undefined;
  const clamp = (s: string) => Math.min(100, Math.max(0, Number(s)));
  return {
    overall:  clamp(m[1]),
    exam:     clamp(m[2]),
    focus:    clamp(m[3]),
    mental:   clamp(m[4]),
    social:   clamp(m[5]),
    love:     clamp(m[6]),
    money:    clamp(m[7]),
    exercise: clamp(m[8]),
    recovery: clamp(m[9]),
    luck:     clamp(m[10]),
  };
}

/** [today_flow] 자정:XX 아침:XX 오후:XX 저녁:XX */
export function parseTodayV3FlowScores(raw: string): TodayV3FlowScores | undefined {
  const m = raw.match(/\[today_flow\]\s*자정:(\d+)\s*아침:(\d+)\s*오후:(\d+)\s*저녁:(\d+)/);
  if (!m) return undefined;
  const clamp = (s: string) => Math.min(100, Math.max(0, Number(s)));
  return {
    midnight:  clamp(m[1]),
    morning:   clamp(m[2]),
    afternoon: clamp(m[3]),
    evening:   clamp(m[4]),
  };
}

/**
 * 10 본문 섹션 파싱 — [key] 마커 기준
 *
 * 강화점:
 * - 줄 처음 단독이 아니어도 잡히게 (multiline 미강제)
 * - 키 안 밑줄 누락(`[todayhobbymethod]`), 콜론·불릿 등 변형 모두 잡기
 * - 마크다운 wrap(`**[key]**`) 도 stripping 후 재인식
 * - 본문에 잔여 마커가 살아남는 일이 없도록 마지막에 본문에서도 [...] 형태 모두 제거
 */
export function parseTodayV3Sections(raw: string): Partial<Record<TodayV3SectionKey, string>> {
  const out: Partial<Record<TodayV3SectionKey, string>> = {};

  // ── 1차 정리: 마크다운 wrapping/장식 제거
  const cleaned = raw
    .replace(/\*\*?\s*\[/g, '[')          // **[key] → [key]
    .replace(/\]\s*\*\*?/g, ']')           // [key]** → [key]
    .replace(/^\s*[-•▶]\s*\[/gm, '[');     // - [key] / ▶ [key] → [key]

  // ── 키 변형 허용 패턴 — 밑줄 0~1개, 키 사이 공백·하이픈도 매치
  const variantsFor = (k: string) => k.split('_').join('[_\\s-]?');
  const altPattern = TODAY_V3_SECTION_KEYS.map(variantsFor).join('|');

  // ── 줄 처음 강제 안 함 + 마커 뒤 콜론·공백 허용
  const splitter = new RegExp(`\\[(${altPattern})\\]\\s*:?`, 'gi');
  const parts = cleaned.split(splitter);

  // 키 정규화: 변형 키 → 표준 키
  const normalize = (k: string): TodayV3SectionKey | null => {
    const stripped = k.toLowerCase().replace(/[^a-z]/g, '');
    return (TODAY_V3_SECTION_KEYS.find(s => s.replace(/_/g, '') === stripped) ?? null) as TodayV3SectionKey | null;
  };

  for (let i = 1; i < parts.length; i += 2) {
    const key = normalize(parts[i]);
    if (!key) continue;
    const body = stripStrayMarkers((parts[i + 1] || '').trim());
    if (body) out[key] = body;
  }
  return out;
}

/** 본문 안에 절대 남으면 안 되는 마커·태그 일괄 제거 (safety net) */
export function stripStrayMarkers(text: string): string {
  return text
    // [today_xxx], [todayxxx], [today-xxx] 등 모든 today 마커 흔적 제거
    .replace(/\[\s*today[_\s-]?[a-z_]+\s*\]\s*:?/gi, '')
    // 점수 마커 잔여
    .replace(/\[\s*today[_\s-]?(scores|flow)\s*\][^\n]*\n?/gi, '')
    // 마크다운 헤더·강조
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    // 연속 빈 줄 정리
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const getTodayFortuneV3Report = async (
  result: SajuResult,
  ctx: TodayUserContext,
  isoDate?: string,
  profileId?: string,
): Promise<TodayFortuneV3AIResult> => {
  try {
    const date = isoDate ?? new Date().toISOString().slice(0, 10);
    const todayGz = calcTodayGanZhi(result, date);
    const prompt = generateTodayFortuneV3Prompt(result, todayGz, date, ctx);
    // 만세력 풍부화 + 분량 하한 상향 → 토큰·타임아웃 모두 확장
    // 13 섹션 합산 2200자+ 목표 → 7500 토큰 여유 / 90초 timeout
    const content = await callGPT(prompt, 7500, undefined, { allowTruncated: true, timeoutMs: 90_000 });
    const domainScores = parseTodayV3DomainScores(content);
    const flowScores = parseTodayV3FlowScores(content);
    const sections = parseTodayV3Sections(content);

    archiveSaju({
      profileId,
      sourceBirth: sourceBirthFromSaju(result),
      category: 'today',
      resultData: result as unknown as Record<string, unknown>,
      engineResult: { todayGz, isoDate: date, userContext: ctx, version: 'v3' } as Record<string, unknown>,
      interpretation: content,
    });

    if (Object.keys(sections).length === 0) {
      return { success: true, rawText: content, domainScores, flowScores, todayGz, isoDate: date, userContext: ctx };
    }
    return { success: true, sections, domainScores, flowScores, todayGz, isoDate: date, userContext: ctx };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// ── 택일 AI 추천 ─────────────────────────────────────────────

export interface TaekilAdviceResult {
  success: boolean;
  advice?: string;
  error?: string;
}

export const getTaekilAdvice = async (
  saju: SajuResult,
  taekil: TaekilResult,
  profileId?: string,
): Promise<TaekilAdviceResult> => {
  try {
    const prompt = generateTaekilAdvicePrompt(saju, taekil);
    const raw = await callGPT(prompt, 5000);
    // [taekil_advice] 마커 제거하고 본문만 추출
    const match = raw.match(/\[taekil_advice\]\s*([\s\S]+)/);
    const advice = match ? match[1].trim() : raw.trim();
    archiveSaju({ profileId, sourceBirth: sourceBirthFromSaju(saju), category: 'taekil', resultData: saju as unknown as Record<string, unknown>, engineResult: taekil as unknown as Record<string, unknown>, interpretation: advice });
    return { success: true, advice };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * 신년운세 종합 리포트 (연도별 8섹션 내러티브)
 * - 원국 + 해당 연도 세운/대운/월별흐름을 통합해 자연스러운 한국어 리포트 생성
 */

export interface NewyearReportAIResult {
  success: boolean;
  sections?: Partial<Record<NewyearSectionKey, string>>;
  rawText?: string;
  error?: string;
}

export const parseNewyearReport = (raw: string): Partial<Record<NewyearSectionKey, string>> => {
  const out: Partial<Record<NewyearSectionKey, string>> = {};
  const keysPattern = NEWYEAR_SECTION_KEYS.join('|');
  const parts = raw.split(new RegExp(`^\\s*\\[(${keysPattern})\\]\\s*$`, 'm'));
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i] as NewyearSectionKey;
    const body = (parts[i + 1] || '').trim();
    if (body) out[key] = body;
  }
  return out;
};

export const getNewyearReport = async (
  result: SajuResult,
  fortune: PeriodFortune,
  year: number,
  profileId?: string,
): Promise<NewyearReportAIResult> => {
  try {
    const seWoon = result.seWoon.find(s => s.year === year);
    if (!seWoon) throw new Error(`${year}년 세운 데이터가 없습니다.`);

    const currentDaeWoon = result.daeWoon.find(
      d => d.gan && d.zhi && year >= d.startAge && year <= d.endAge
    ) ?? null;

    const domains = fortune.domains.map(d => ({
      key: d.key,
      label: d.label,
      score: d.score,
      grade: d.grade as string,
    }));

    const prompt = generateNewyearReportPrompt(result, {
      year,
      seWoon,
      currentDaeWoon,
      monthlyFlow: fortune.monthlyFlow ?? [],
      domains,
      overallScore: fortune.overallScore,
      overallGrade: fortune.overallGrade as string,
    });

    // 2-pass 분할: 1차(general·wealth·career·love) + 2차(health·relation·monthly·lucky)
    const pass1Prompt = prompt + '\n\n★ 이번 응답에서는 [general] [wealth] [career] [love] 4개 섹션만 출력. 나머지 4개는 다음 호출에서 작성.';
    const pass1Content = await callGPT(pass1Prompt, 5000);
    const pass1Sections = parseNewyearReport(pass1Content);

    const pass2Prompt = prompt
      + '\n\n★ 이번 응답에서는 [health] [relation] [monthly] [lucky] 4개 섹션만 출력. [general] [wealth] [career] [love]는 이미 완료.'
      + `\n\n[이미 작성된 1차 내용 — 참고만, 출력하지 말 것]\n${pass1Content}`;
    const pass2Content = await callGPT(pass2Prompt, 6000);
    const pass2Sections = parseNewyearReport(pass2Content);

    const sections: Partial<Record<NewyearSectionKey, string>> = { ...pass1Sections, ...pass2Sections };
    const content = `${pass1Content}\n\n${pass2Content}`;

    archiveSaju({ profileId, sourceBirth: sourceBirthFromSaju(result), category: 'newyear', resultData: result as unknown as Record<string, unknown>, engineResult: { year, seWoon, currentDaeWoon } as unknown as Record<string, unknown>, interpretation: content, isDetailed: true });

    if (Object.keys(sections).length === 0) {
      return { success: true, rawText: content };
    }
    return { success: true, sections };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// ─────────────────────────────────────────────
// 지정일 운세 — 사용자가 직접 고른 날짜의 7섹션 종합 풀이
// ─────────────────────────────────────────────

export interface PickedDateReportAIResult {
  success: boolean;
  sections?: Partial<Record<PickedDateSectionKey, string>>;
  rawText?: string;
  error?: string;
}

export const parsePickedDateReport = (raw: string): Partial<Record<PickedDateSectionKey, string>> => {
  const out: Partial<Record<PickedDateSectionKey, string>> = {};
  const keysPattern = PICKED_DATE_SECTION_KEYS.join('|');
  const parts = raw.split(new RegExp(`^\\s*\\[(${keysPattern})\\]\\s*$`, 'm'));
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i] as PickedDateSectionKey;
    const body = (parts[i + 1] || '').trim();
    if (body) out[key] = body;
  }
  return out;
};

export const getPickedDateReport = async (
  result: SajuResult,
  isoDate: string,
  profileId?: string,
): Promise<PickedDateReportAIResult> => {
  try {
    const todayGz = calcTodayGanZhi(result, isoDate);
    const prompt = generatePickedDateFortunePrompt(result, todayGz, isoDate);
    const content = await callGPT(prompt, 6000);
    const sections = parsePickedDateReport(content);
    archiveSaju({
      profileId,
      sourceBirth: sourceBirthFromSaju(result),
      category: 'period',
      resultData: result as unknown as Record<string, unknown>,
      engineResult: { isoDate, todayGz } as unknown as Record<string, unknown>,
      interpretation: content,
      creditType: 'sun',
      isDetailed: true,
    });
    if (Object.keys(sections).length === 0) {
      return { success: true, rawText: content };
    }
    return { success: true, sections };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * 사주 × 타로 하이브리드 (3엽전)
 *
 * @param mode TarotPage 의 currentMode — 보관함 spread_type 결정
 * @param allDrawnCards (선택) 모드에서 뽑은 전체 카드 배열. 이달의 타로(3장) 등에서 모두 저장하기 위해.
 *                     미전달 시 tarotCard 단일만 저장 (단일 카드 모드 호환).
 */
export const getHybridReading = async (
  sajuResult: SajuResult,
  tarotCard: TarotCardInfo,
  question?: string,
  mode?: 'today' | 'monthly' | 'question',
  allDrawnCards?: TarotCardInfo[],
): Promise<FortuneResponse> => {
  try {
    const prompt = generateHybridPrompt(sajuResult, tarotCard, question);
    // 프롬프트 명세: 총 1,200~1,600자 (6섹션). 한국어 토큰 비율 고려해 4,000.
    const content = await callGPT(prompt, 4000);
    // 사주+타로 하이브리드는 saju_records · tarot_records 양쪽에 기록 (유저가 어느 탭에서 찾든 보이도록)
    archiveSaju({ sourceBirth: sourceBirthFromSaju(sajuResult), category: 'gunghap', resultData: sajuResult as unknown as Record<string, unknown>, engineResult: { tarotCard, question } as unknown as Record<string, unknown>, interpretation: content });
    // mode 별 spread_type — 보관함에서 "오늘의 타로" / "이달의 타로" / "질문 타로" 구분 표시
    const spreadType = mode === 'today' ? 'today'
      : mode === 'monthly' ? 'monthly'
      : mode === 'question' ? 'question'
      : 'hybrid-saju';
    // cards 페이로드 — 재생용 전체 정보 저장 (mode/cards 배열/단일카드/질문)
    const cardsPayload: Record<string, unknown> = {
      mode: spreadType,
      cards: allDrawnCards ?? [tarotCard],
      // 호환 — 이전 단일 키
      card: tarotCard,
    };
    archiveTarot({ spreadType, cards: cardsPayload, question, interpretation: content });
    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// ============================================================
// 더 많은 운세 — 카테고리 서비스 함수
// (모두 달 크레딧 1개 소모, 짧은 형식)
//
// [B안 — 2026-04-27] 메인 8 (신년/정통사주/지정일/자미두수)과 중복되던 5종 비활성:
//   getLoveShort, getWealthShort, getCareerShort, getHealthShort, getPeopleShort
// 비활성 함수는 주석으로 보존 — 비즈니스 결정 변경 시 빠르게 복원.
// MoreFortunePage.handleRead 의 switch 도 해당 case 들 동시 정리됨.
// ============================================================

// 더많은운세 short — 프롬프트 명세 350~700자 → 한국어 토큰 비율 보수적 2.5x로 잡아 2,000 일괄.
// 개별 분량 차이는 작아 LRU 비용 영향 미미, 잘림 방지가 우선.

// [비활성 — B안] 신년운세 연애·결혼운, 정통사주 애정·결혼운, 궁합 카테고리와 중복.
// export const getLoveShort = async (result: SajuResult): Promise<FortuneResponse> => {
//   try {
//     const content = await callGPT(generateLoveShortPrompt(result), 2000);
//     archiveSaju({ sourceBirth: sourceBirthFromSaju(result), category: 'love', resultData: result as unknown as Record<string, unknown>, interpretation: content, creditType: 'moon', creditUsed: 1 });
//     return { success: true, content };
//   } catch (e: any) { return { success: false, error: e.message }; }
// };

// [비활성 — B안] 신년운세 재물운, 정통사주 재물운, 자미두수 재물·일의 하늘과 중복.
// export const getWealthShort = async (result: SajuResult): Promise<FortuneResponse> => {
//   try {
//     const content = await callGPT(generateWealthShortPrompt(result), 2000);
//     archiveSaju({ sourceBirth: sourceBirthFromSaju(result), category: 'wealth', resultData: result as unknown as Record<string, unknown>, interpretation: content, creditType: 'moon', creditUsed: 1 });
//     return { success: true, content };
//   } catch (e: any) { return { success: false, error: e.message }; }
// };

// [비활성 — B안] 신년운세 직장·사업운, 정통사주 직업·적성과 중복.
// export const getCareerShort = async (result: SajuResult): Promise<FortuneResponse> => {
//   try {
//     const content = await callGPT(generateCareerShortPrompt(result), 2000);
//     archiveSaju({ sourceBirth: sourceBirthFromSaju(result), category: 'career', resultData: result as unknown as Record<string, unknown>, interpretation: content, creditType: 'moon', creditUsed: 1 });
//     return { success: true, content };
//   } catch (e: any) { return { success: false, error: e.message }; }
// };

// [비활성 — B안] 신년운세 건강운, 정통사주 건강운, 자미두수 몸과 마음의 하늘과 중복.
// export const getHealthShort = async (result: SajuResult): Promise<FortuneResponse> => {
//   try {
//     const content = await callGPT(generateHealthShortPrompt(result), 2000);
//     archiveSaju({ sourceBirth: sourceBirthFromSaju(result), category: 'health', resultData: result as unknown as Record<string, unknown>, interpretation: content, creditType: 'moon', creditUsed: 1 });
//     return { success: true, content };
//   } catch (e: any) { return { success: false, error: e.message }; }
// };

export const getStudyShort = async (result: SajuResult, profileId?: string): Promise<FortuneResponse> => {
  try {
    const content = await callGPT(generateStudyShortPrompt(result), MORE_FORTUNE_CONFIGS.study.maxTokens);
    archiveSaju({ profileId, sourceBirth: sourceBirthFromSaju(result), category: 'study', resultData: result as unknown as Record<string, unknown>, interpretation: content, creditType: 'moon', creditUsed: 1 });
    return { success: true, content };
  } catch (e: any) { return { success: false, error: e.message }; }
};

// [비활성 — B안] 신년운세 인간관계운, 정통사주 인간관계·가족, 자미두수 관계 하늘과 중복.
// export const getPeopleShort = async (result: SajuResult): Promise<FortuneResponse> => {
//   try {
//     const content = await callGPT(generatePeopleShortPrompt(result), 2000);
//     archiveSaju({ sourceBirth: sourceBirthFromSaju(result), category: 'people', resultData: result as unknown as Record<string, unknown>, interpretation: content, creditType: 'moon', creditUsed: 1 });
//     return { success: true, content };
//   } catch (e: any) { return { success: false, error: e.message }; }
// };

export const getChildrenShort = async (result: SajuResult, profileId?: string): Promise<FortuneResponse> => {
  try {
    const content = await callGPT(generateChildrenShortPrompt(result), MORE_FORTUNE_CONFIGS.children.maxTokens);
    archiveSaju({ profileId, sourceBirth: sourceBirthFromSaju(result), category: 'children', resultData: result as unknown as Record<string, unknown>, interpretation: content, creditType: 'moon', creditUsed: 1 });
    return { success: true, content };
  } catch (e: any) { return { success: false, error: e.message }; }
};

export const getPersonalityShort = async (result: SajuResult, profileId?: string): Promise<FortuneResponse> => {
  try {
    const content = await callGPT(generatePersonalityShortPrompt(result), MORE_FORTUNE_CONFIGS.personality.maxTokens);
    archiveSaju({ profileId, sourceBirth: sourceBirthFromSaju(result), category: 'personality', resultData: result as unknown as Record<string, unknown>, interpretation: content, creditType: 'moon', creditUsed: 1 });
    return { success: true, content };
  } catch (e: any) { return { success: false, error: e.message }; }
};

export const getNameFortune = async (
  result: SajuResult,
  nameInput: NameAnalysisInput,
  profileId?: string,
): Promise<FortuneResponse> => {
  try {
    // 한자 모드(글자별 뜻 ≥1 또는 레거시 hanjaName)면 출력 길이 25% 가산.
    const hasMeaning = !!(nameInput.charMeanings ?? []).find((c) => c.meaning && c.meaning.trim().length > 0);
    const isHanjaMode = hasMeaning || !!nameInput.hanjaName;
    const baseTokens = MORE_FORTUNE_CONFIGS.name.maxTokens;
    const maxTokens = isHanjaMode ? Math.round(baseTokens * 1.25) : baseTokens;
    const content = await callGPT(generateNameFortunePrompt(result, nameInput), maxTokens);
    archiveSaju({
      profileId,
      sourceBirth: sourceBirthFromSaju(result),
      category: 'name',
      resultData: result as unknown as Record<string, unknown>,
      engineResult: {
        koreanName: nameInput.koreanName,
        charMeanings: nameInput.charMeanings,
        hanjaName: nameInput.hanjaName,
      } as Record<string, unknown>,
      interpretation: content,
      creditType: 'moon',
      creditUsed: 1,
    });
    return { success: true, content };
  } catch (e: any) { return { success: false, error: e.message }; }
};

/**
 * 꿈 해몽 — 사주 무관, 꿈 내용만으로 해석.
 * dreamText는 선명 모드의 원문 또는 흐릿 모드에서 구조화 입력을 composeDreamTextFromStructured로 합성한 텍스트.
 */
export const getDreamInterpretation = async (
  dreamText: string,
  profileId?: string,
): Promise<FortuneResponse> => {
  try {
    if (!dreamText || dreamText.trim().length < 5) {
      return { success: false, error: '꿈 내용을 조금 더 적어주세요. (등장물·행동·감정 중 하나만이라도 있으면 좋아요)' };
    }
    const content = await callGPT(generateDreamInterpretationPrompt(dreamText), MORE_FORTUNE_CONFIGS.dream.maxTokens);
    archiveSaju({ profileId, category: 'dream', engineResult: { dreamText } as Record<string, unknown>, interpretation: content, creditType: 'moon', creditUsed: 1 });
    return { success: true, content };
  } catch (e: any) { return { success: false, error: e.message }; }
};
