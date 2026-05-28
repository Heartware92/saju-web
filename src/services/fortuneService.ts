/**
 * 운세 분석 서비스 (크레딧 시스템 통합)
 */

import { SajuResult } from '../utils/sajuCalculator';
import { calculateSeWoonRange } from '../utils/sajuCalculator';
import { archiveSaju, archiveTarot } from './archiveService';
import {
  SYSTEM_PROMPT,
  generateTodayFortuneV3Prompt,
  generateUserInputClassifierPrompt,
  type UserInputClassifications,
  TODAY_V3_SECTION_KEYS,
  TODAY_TIME_SLOT_QUESTION_POOL,
  type TodayV3SectionKey,
  type TodayV3DomainKey,
  type TodayUserContext,
  type TodayTimeSlot,
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
  type PeriodDomainBrief,
  type NewyearSectionKey,
  type JungtongsajuSectionKey,
  type TodayGanZhi,
  STUDY_SECTION_KEYS,
  type StudySectionKey,
  CHILDREN_SECTION_KEYS,
  type ChildrenSectionKey,
  PERSONALITY_SECTION_KEYS,
  type PersonalitySectionKey,
  NAME_SECTION_KEYS,
  type NameSectionKey,
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
  /** 섹션 마커 [key] 기반 파싱 결과 (있을 때만). MoreFortuneResultCard 가 카드별 렌더링에 사용 */
  sections?: Record<string, string>;
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

  // 8) 구조적 파싱 닫는 태그 제거 — [/xxx] 형식 모두 제거 (AI가 자의적으로 닫는 태그 출력 방지)
  //    [은유]는 여는 태그이므로 이 패턴에 매칭되지 않음 → 자동 보존
  text = text.replace(/\[\/[a-zA-Z_]+\]/g, '');

  // 9) AI 자기소개 문구 제거
  text = text.replace(/^\s*(?:AI로서|인공지능으로서|챗봇으로서|저는 AI)[^\n]*\n?/gm, '');
  text = text.replace(/제공된 (?:데이터|정보)에 (?:따르면|근거하여)[^,.\n]*[,.]?/g, '');

  // 9) 중복 공백·개행 정리
  text = text.replace(/[ \t]+\n/g, '\n');           // 줄 끝 공백
  text = text.replace(/\n{3,}/g, '\n\n');           // 3개 이상 연속 개행 → 2개
  text = text.replace(/^[ \t]+/gm, (m) => m.replace(/\t/g, '  ')); // 들여쓰기 탭 → 공백 2개

  return text.trim();
};

/**
 * rawText 폴백 렌더링용 — 섹션 파싱 실패 시 모든 구조적 태그를 제거하여 깨끗한 텍스트 반환.
 *
 * 제거 대상:
 *   1) 영문 섹션 마커: [general] / [/general] / [character] 등
 *   2) [은유] / 【은유】 / **[은유]** 등 모든 변형 — 줄 통째 strip
 *   3) 본문 잔존 인라인 [은유] 마커
 *
 * 이전 정규식 `/\[\/?[a-zA-Z_]+\]/g` 는 영문만 매칭해 [은유] 가 한글 캐릭터라
 * strip 되지 않고 본문에 그대로 노출되는 사고가 있었음.
 */
export const stripAllSectionTags = (text: string): string =>
  text
    .replace(/\[\/?[a-zA-Z_]+\]/g, '')                                         // 영문 섹션 마커
    .replace(/^[\s*▶■#·•\-]*[[【『]\s*은유\s*[:：]?\s*[\]】』].*$/gm, '')      // [은유] 줄 통째
    .replace(/[\s*]*[[【『]\s*은유\s*[:：]?\s*[\]】』][\s*]*/g, '')             // 인라인 잔존 마커 안전망
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * GPT API 호출 헬퍼 (서버 API Route 경유)
 * - 응답을 sanitize 하여 마크다운·이모지 잔해 제거
 */
// Vercel 서버 maxDuration=120초와 맞춤 — 클라이언트는 110초에 abort.
// 이전 55초였으나 maxDuration 이 60→120 으로 늘어난 뒤 동기화 안 돼 회귀:
// 정통사주 2차(maxTokens 14k, 보통 50~80초) 가 클라이언트 측 timeout 에 자주
// 걸리면서 "응답이 너무 오래 걸려요" 안내가 빈번하던 사고의 원인.
const AI_CLIENT_TIMEOUT_MS = 110_000;

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
  opts?: { allowTruncated?: boolean; timeoutMs?: number; jsonMode?: boolean; systemPrompt?: string },
): Promise<string> => {
  const controller = new AbortController();
  const timeout = opts?.timeoutMs ?? AI_CLIENT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: userPrompt,
        maxTokens,
        systemPrompt: opts?.systemPrompt ?? SYSTEM_PROMPT,
        jsonMode: opts?.jsonMode === true,
      }),
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
 * [Pre-classification] 5개 직접 입력 필드 사전 분류.
 *
 * - 비어있지 않은 직접 입력 필드가 1개 이상 있을 때만 호출 (호출자가 판단)
 * - 모두 칩 선택이면 null 반환하지 말고 호출 자체 skip 권장 (비용 절감)
 * - 분류 실패 (JSON parse 실패 / API 에러 등) → null 반환 → fallback: 기존 single-pass 동작
 * - 회귀 위험 0: 분류 결과는 메인 풀이 prompt 상단에 명시 주입되며, 분류 없을 때는 기존 customHobbyNote 가이드 그대로 동작
 *
 * @param inputs 5개 직접 입력 필드 (undefined/빈 string 인 필드는 자동 skip)
 * @param q1Question q1 의 질문 텍스트 (분류기에 context 제공용, optional)
 * @param q2Question q2 의 질문 텍스트 (분류기에 context 제공용, optional)
 * @returns 분류 결과 또는 null (실패 시)
 */
export const classifyUserInputs = async (
  inputs: {
    customHobby?: string;
    customJobState?: string;
    customLoveState?: string;
    q1Answer?: string;
    q2Answer?: string;
  },
  q1Question?: string,
  q2Question?: string,
): Promise<UserInputClassifications | null> => {
  // 비어있지 않은 필드가 1개도 없으면 호출 skip
  const hasAny = Object.values(inputs).some((v) => v && v.trim().length > 0);
  if (!hasAny) return null;

  try {
    const prompt = generateUserInputClassifierPrompt(inputs, q1Question, q2Question);
    const raw = await callGPT(prompt, 1500, 20, {
      timeoutMs: 30_000,
      jsonMode: true,
      // 분류는 SYSTEM_PROMPT 명리 톤이 아닌 분류기 역할
      systemPrompt: '당신은 사용자 입력을 분류하는 분류기입니다. 반드시 JSON 으로만 응답하세요. 다른 텍스트·설명·마크다운 wrapper 절대 금지.',
    });

    // JSON 파싱 — 마크다운 wrapper 가 섞여 있으면 제거 시도
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned) as UserInputClassifications;

    // 최소 유효성 검사 — 적어도 1개 필드 분류 결과가 있어야 함
    if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
      console.warn('[classifyUserInputs] 빈 분류 결과 → fallback');
      return null;
    }

    return parsed;
  } catch (err) {
    // 분류 실패 → null 반환 → 메인 풀이는 기존 single-pass 로 자연 fallback
    console.warn('[classifyUserInputs] 분류 실패 → fallback (single-pass):', err);
    return null;
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
  /** archive 저장 후 record id — ShareBar 표시에 사용 */
  archivedRecordId?: string;
}

/** [tojeong_scores] 재물:72 | 애정:65 | 건강:58 | 직장:80 [/tojeong_scores] 파싱
 *
 * AI 가이드와 일치하는 floor 보장: 영역별 60~97 (다른 운세 카테고리와 일관)
 */
export function parseTojeongScores(raw: string): { wealth: number; love: number; health: number; career: number } | null {
  const m = raw.match(/\[tojeong_scores\]\s*(.+?)\s*\[\/tojeong_scores\]/);
  if (!m) return null;
  const inner = m[1];
  const extract = (label: string): number => {
    const r = new RegExp(`${label}\\s*:\\s*(\\d+)`);
    const found = inner.match(r);
    return found ? Math.min(97, Math.max(60, Number(found[1]))) : 70;
  };
  return {
    wealth: extract('재물'),
    love: extract('애정'),
    health: extract('건강'),
    career: extract('직장'),
  };
}

/**
 * 한글 번호 헤더(`1. 제목`, `2. 제목` …) 기반 섹션 파서.
 * SYSTEM_PROMPT 규칙(### 금지, 평문 번호) 에 맞춰 AI 가 출력하는 형식.
 * 타로(`generateHybridPrompt`) 결과를 N개 카드로 나눠 렌더링할 때 사용.
 */
export function parseNumberedSections(raw: string): Array<{ title: string; body: string }> {
  const lines = raw.split('\n');
  const out: Array<{ title: string; body: string }> = [];
  const headerRe = /^\s*#*\s*(\d+)\.\s+(.+?)\s*$/;
  let current: { title: string; body: string[] } | null = null;
  for (const line of lines) {
    const m = headerRe.exec(line);
    if (m) {
      if (current) out.push({ title: current.title, body: current.body.join('\n').trim() });
      current = { title: m[2].trim(), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) out.push({ title: current.title, body: current.body.join('\n').trim() });
  return out.filter(s => s.body.length > 0);
}

/** [key] 델리미터로 토정비결 섹션 파싱. TOJEONG_SECTION_KEYS 에 정의된 모든 키 동적 매치. */
export function parseTojeongSections(raw: string): Partial<Record<TojeongSectionKey, string>> {
  const out: Partial<Record<TojeongSectionKey, string>> = {};
  // 신규 키 (business_move, warning) 도 자동 포함 — TOJEONG_SECTION_KEYS 변경 시 정규식 자동 갱신.
  const pattern = TOJEONG_SECTION_KEYS.join('|');
  const re = new RegExp(`^\\s*\\[(${pattern})\\]\\s*$`, 'm');
  const parts = raw.split(re);
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
  /** ★ 사주+토정 하이브리드 — 사주 명식 인용해 분야별 풀이 깊이 ↑. 옵셔널. */
  saju?: SajuResult,
  /** ★ 사용자 정황 — 직업·연애 상태 분산 인용 매트릭스. 옵셔널. */
  userCtx?: {
    jobState?: string | null;
    customJobState?: string | null;
    loveState?: string | null;
    customLoveState?: string | null;
  },
): Promise<TojeongAIResult> => {
  // archive 는 3초 timeout — supabase hang 으로 클라이언트 await 가 안 풀려 backend
  // 전체 deadline race 까지 끌고가는 사고 차단. timeout 되어도 archiveSaju 내부 supabase 요청은
  // 백그라운드에서 계속 진행되므로 보관함 저장은 보장됨.
  const archive = async (content: string): Promise<string | null> => {
    return Promise.race([
      archiveSaju({ profileId, sourceBirth, category: 'tojeong', engineResult: tj as unknown as Record<string, unknown>, interpretation: content, isDetailed: true }).catch(() => null),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 3_000)),
    ]);
  };

  // 전체 180초 제한 — 분량 ↑(4200~5500자) 에 맞춰 확장.
  //   2-pass(50+40=90) + single(30) + compact(25) + minimal(20) = 165s
  //   어떤 상황에서도 180초 안에 결과 반환(빈 문자열일 수 있음). 페이지가 graceful 처리.
  return Promise.race([
    tojeongAllAttempts(tj, archive, saju, userCtx),
    new Promise<TojeongAIResult>(resolve =>
      setTimeout(() => {
        console.warn('[tojeong] 180s overall deadline — returning empty');
        resolve({ success: true, content: '' });
      }, 180_000),
    ),
  ]);
};

async function tojeongAllAttempts(
  tj: TojeongResult,
  archive: (content: string) => Promise<string | null>,
  saju?: SajuResult,
  userCtx?: { jobState?: string | null; customJobState?: string | null; loveState?: string | null; customLoveState?: string | null },
): Promise<TojeongAIResult> {
  // ── 시도 1: 2-pass (풍부한 결과, pass1 50s + pass2 40s) ──
  // pass2 가 실패해도 pass1 결과만으로 반환. pass1 자체가 실패하면 시도 2로.
  try {
    const result = await tojeong2Pass(tj, saju, userCtx);
    if (result.content) {
      const archivedRecordId = await archive(result.content);
      return { ...result, ...(archivedRecordId ? { archivedRecordId } : {}) };
    }
  } catch (e: any) {
    console.warn('[tojeong] try1 (2-pass) failed:', e.message);
  }

  // ── 시도 2: 레거시 단일 호출 (30s 타임아웃, 5000 토큰) ──
  try {
    const content = await callGPT(generateTojeongPrompt(tj, saju, userCtx), 5000, undefined, { allowTruncated: true, timeoutMs: 30_000 });
    if (content) {
      const archivedRecordId = await archive(content);
      return { success: true, content, ...(archivedRecordId ? { archivedRecordId } : {}) };
    }
  } catch (e: any) {
    console.warn('[tojeong] try2 (single 5000) failed:', e.message);
  }

  // ── 시도 3: 컴팩트 단일 호출 (25s 타임아웃, 2400 토큰) ──
  try {
    const content = await callGPT(generateTojeongPrompt(tj), 2400, undefined, { allowTruncated: true, timeoutMs: 25_000 });
    if (content) {
      const archivedRecordId = await archive(content);
      return { success: true, content, ...(archivedRecordId ? { archivedRecordId } : {}) };
    }
  } catch (e: any) {
    console.warn('[tojeong] try3 (compact 2400) failed:', e.message);
  }

  // ── 시도 4: 미니멀 단일 호출 (20s 타임아웃, 1500 토큰) ──
  // 마지막 안전망 — 분량은 줄지만 사용자에게 뭐라도 보이도록 보장.
  try {
    const content = await callGPT(generateTojeongPrompt(tj), 1500, undefined, { allowTruncated: true, timeoutMs: 20_000 });
    if (content) {
      const archivedRecordId = await archive(content);
      return { success: true, content, ...(archivedRecordId ? { archivedRecordId } : {}) };
    }
  } catch (e: any) {
    console.warn('[tojeong] try4 (minimal 1500) failed:', e.message);
  }

  // 4단 폴백 모두 실패 — 에러 대신 빈 결과. 페이지의 무료 결정론적 풀이가 결과로 노출됨.
  return { success: true, content: '' };
}

async function tojeong2Pass(
  tj: TojeongResult,
  saju?: SajuResult,
  userCtx?: { jobState?: string | null; customJobState?: string | null; loveState?: string | null; customLoveState?: string | null },
): Promise<TojeongAIResult> {
  // Pass1 — 분량 ↑ (총운 400~600자 + 월별 180~250자/월) 위해 8000 토큰 + 50s
  const pass1Prompt = generateTojeongPass1Prompt(tj, saju, userCtx);
  const pass1Content = await callGPT(pass1Prompt, 8000, undefined, { allowTruncated: true, timeoutMs: 50_000 });
  const pass1Sections = parseTojeongSections(pass1Content);
  const domainScores = parseTojeongScores(pass1Content) ?? undefined;

  let pass2Content = '';
  let pass2Sections: Partial<Record<TojeongSectionKey, string>> = {};
  try {
    // Pass2 — 7섹션 (재물·연애·학업대인·창업이전·건강소망·주의·조언) 위해 8500 토큰 + 40s
    const pass2Prompt = generateTojeongPass2Prompt(tj, pass1Content, saju, userCtx);
    pass2Content = await callGPT(pass2Prompt, 8500, undefined, { allowTruncated: true, timeoutMs: 40_000 });
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
  /** archive 저장 후 record id — ShareBar 표시에 사용 */
  archivedRecordId?: string;
}

// 2026-05-27 영역별 13 섹션 재구성
const ZAMIDUSU_KEYS: ZamidusuSectionKey[] = [
  'overview', 'main_star', 'helper_stars', 'body_palace',
  'wealth', 'career', 'love', 'body_mind', 'relations',
  'mutagen', 'daehan', 'sohan', 'advice',
];

export function parseZamidusuSections(raw: string): Partial<Record<ZamidusuSectionKey, string>> {
  const out: Partial<Record<ZamidusuSectionKey, string>> = {};
  const re = /^\s*\[(overview|main_star|helper_stars|body_palace|wealth|career|love|body_mind|relations|mutagen|daehan|sohan|advice|interactions|core)\]\s*$/m;
  const parts = raw.split(re);
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i];
    const body = (parts[i + 1] ?? '').trim();
    // 호환성: 'core' → 'main_star', 'interactions' → 'mutagen' 흡수
    let normalizedKey: ZamidusuSectionKey;
    if (key === 'core') normalizedKey = 'main_star';
    else if (key === 'interactions') normalizedKey = 'mutagen';
    else normalizedKey = key as ZamidusuSectionKey;
    if (ZAMIDUSU_KEYS.includes(normalizedKey) && body) {
      out[normalizedKey] = body;
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

    // 2-pass 분할 (13 섹션, 2026-05-27 영역별 재구성):
    //   1차 (명궁 4 + 재물·직업·연애): overview·main_star·helper_stars·body_palace·wealth·career·love (7)
    //   2차 (건강·관계·정통·조언): body_mind·relations·mutagen·daehan·sohan·advice (6)
    const pass1Prompt = prompt + '\n\n★ 이번 응답에서는 [overview] [main_star] [helper_stars] [body_palace] [wealth] [career] [love] 7개 섹션만 출력하세요. 나머지 6개는 다음 호출에서 작성합니다. 각 섹션의 분량 지침을 충실히 따라 깊이 있게 작성하세요.';
    const pass1Content = await callGPT(pass1Prompt, 8000);
    const pass1Sections = parseZamidusuSections(pass1Content);

    const pass2Prompt = prompt
      + '\n\n★ 이번 응답에서는 [body_mind] [relations] [mutagen] [daehan] [sohan] [advice] 6개 섹션만 출력하세요. [overview] [main_star] [helper_stars] [body_palace] [wealth] [career] [love]는 이미 완료되었습니다. 각 섹션의 분량 지침을 충실히 따라 깊이 있게 작성하세요.'
      + `\n\n[이미 작성된 1차 내용 — 참고만, 출력하지 말 것]\n${pass1Content}`;
    const pass2Content = await callGPT(pass2Prompt, 8000);
    const pass2Sections = parseZamidusuSections(pass2Content);

    const sections: Partial<Record<ZamidusuSectionKey, string>> = { ...pass1Sections, ...pass2Sections };
    const content = `${pass1Content}\n\n${pass2Content}`;

    const archivedRecordId = await archiveSaju({ profileId, sourceBirth, category: 'zamidusu', engineResult: z as unknown as Record<string, unknown>, interpretation: content, isDetailed: true }).catch(() => null);

    if (Object.keys(sections).length === 0) {
      return { success: true, content, sections: undefined, ...(archivedRecordId ? { archivedRecordId } : {}) };
    }
    return { success: true, content, sections, ...(archivedRecordId ? { archivedRecordId } : {}) };
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
  /** archive 저장 후 record id — ShareBar 표시에 사용 */
  archivedRecordId?: string;
}

export const parseJungtongsaju = (raw: string): Partial<Record<JungtongsajuSectionKey, string>> => {
  const out: Partial<Record<JungtongsajuSectionKey, string>> = {};
  const keysPattern = JUNGTONGSAJU_SECTION_KEYS.join('|');

  // ── [luck] 마커 누락 보정 ──
  // luck 섹션이 대운별 [대운 N세] 소섹션 구조로 바뀌면서, AI 가 [luck] 섹션 마커를
  // 빼먹고 [relation] 다음 바로 [대운 28세] 부터 출력하는 사고가 있음.
  // [luck] 마커가 없는데 [대운 N세] 가 있으면 → 첫 [대운 N세] 앞에 [luck] 마커를 삽입.
  if (!raw.includes('[luck]') && /\[대운\s*\d+\s*세\]/.test(raw)) {
    raw = raw.replace(/(\n\s*\[대운\s*\d+\s*세\])/, '\n[luck]$1');
  }

  // AI 가 섹션 마커 주변에 markdown bold(**), prefix 기호(▶ ■ # · • -), 잔여 공백을
  // 끼우는 케이스를 흡수 — 줄 통째가 마커이면 양옆 장식을 깎아 [key] 단독 줄로 정규화.
  // 이전 split 정규식은 마커가 줄에 단독으로 있을 때만 매칭해 `**[character]**` 같은
  // 변형에서 빈 객체가 반환되어 rawText fallback 으로 떨어지는 사고가 있었음.
  const normalized = raw.replace(
    new RegExp(`^[\\s*#▶■·•\\-]*\\[(${keysPattern})\\][\\s*#]*$`, 'gm'),
    '[$1]',
  );

  const parts = normalized.split(new RegExp(`^\\s*\\[(${keysPattern})\\]\\s*$`, 'm'));
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i] as JungtongsajuSectionKey;
    const body = (parts[i + 1] || '').trim();
    if (body) out[key] = body;
  }

  // 마커 파싱 실패 fallback — AI 가 "1. 사주 총론\n\n2. 일주론" 같은 번호 헤딩으로
  // 응답한 경우(프롬프트 마커 강제 룰 누락) 번호 + 헤딩 라인으로 split 하여 KEYS 순서대로 매핑.
  // 결과지 카드 렌더가 가능하도록 끝까지 살림 → 결제 사고 차단.
  if (Object.keys(out).length === 0) {
    // "^\d+\.?\s+한글헤딩" 패턴 (예: "1. 사주 총론", "2. 일주론") 으로 split
    // markdown ## / ### 헤딩 prefix 도 흡수
    const numericParts = raw.split(/^(?:#{1,3}\s+)?\s*(\d{1,2})\.?\s+[가-힣·\s]{2,30}\s*$/m);
    // split 결과: [전문, 번호1, 본문1, 번호2, 본문2, ...]
    // 첫 번째 element 는 number prefix 가 적용되지 않은 head text (보통 비어있거나 인사말)
    if (numericParts.length >= 3) {
      for (let i = 1; i < numericParts.length; i += 2) {
        const sectionIdx = parseInt(numericParts[i], 10);
        const body = (numericParts[i + 1] || '').trim();
        // 번호 1~N 을 KEYS 순서대로 매핑 (1=general, 2=daymaster, ...)
        const key = JUNGTONGSAJU_SECTION_KEYS[sectionIdx - 1];
        if (key && body) out[key] = body;
      }
    }
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
    // ★★ 결제 후 빈손 방지 — 자동 retry 2회 + 파싱 실패도 재시도 트리거
    const appPrompt = generateJungtongsajuApplicationPrompt(result, coreContent, forbiddenAliases);
    let appContent = '';
    let appSections: Partial<Record<JungtongsajuSectionKey, string>> = {};
    let appError: string | null = null;

    // 8섹션이 모두 들어왔는지 검증 — 결제 사고 방지의 최후 보루
    const APPLICATION_KEYS = ['character', 'career', 'wealth', 'love', 'health', 'relation', 'luck', 'advice'] as const;
    const tryApplicationCall = async (): Promise<{ content: string; sections: Partial<Record<JungtongsajuSectionKey, string>> }> => {
      // 명세 ~6,400자 (luck 대운별 소섹션 확장으로 +1,200자) → 18,000 토큰.
      const content = await callGPT(appPrompt, 18000);
      const sections = parseJungtongsaju(content);
      const parsedKeys = Object.keys(sections);
      // 마커 누락 / 형식 어긋남 등으로 빈 객체 또는 일부만 파싱된 경우 — 에러로 취급해 retry 트리거
      if (parsedKeys.length === 0) {
        throw new Error('PARSE_EMPTY: 2차 응답에서 섹션 마커를 하나도 찾지 못함');
      }
      const missing = APPLICATION_KEYS.filter((k) => !sections[k]);
      // 8개 중 4개 미만이면 명백히 손상된 응답 — 재시도
      if (missing.length >= 5) {
        throw new Error(`PARSE_PARTIAL: 2차 응답 ${parsedKeys.length}/8 섹션만 파싱됨 (누락: ${missing.join(',')})`);
      }
      // 마지막 섹션(advice) 누락은 truncation 의심 — 재시도
      if (!sections.advice) {
        throw new Error('TRUNCATED: 2차 응답에 advice 섹션 누락(응답 잘림 의심)');
      }
      return { content, sections };
    };

    const MAX_APP_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_APP_ATTEMPTS; attempt++) {
      try {
        const r = await tryApplicationCall();
        appContent = r.content;
        appSections = r.sections;
        appError = null;
        if (attempt > 1) console.log(`[jungtongsaju] 2차 호출 ${attempt}회차 성공`);
        break;
      } catch (e: any) {
        appError = e?.message || '2차 분석 중 오류가 발생했어요.';
        console.warn(`[jungtongsaju] 2차 호출 ${attempt}회차 실패:`, appError);
        if (attempt < MAX_APP_ATTEMPTS) {
          // 점진 백오프: 1500ms, 2500ms
          await new Promise((r) => setTimeout(r, 1500 + (attempt - 1) * 1000));
        }
      }
    }

    // ── 머지 + archive ──
    // ★ partial 케이스에서도 appContent raw 가 있으면 archive 에 함께 저장(복원 시 보강 가능)
    const merged: Partial<Record<JungtongsajuSectionKey, string>> = { ...coreSections, ...appSections };
    const fullContent = appContent ? `${coreContent}\n\n${appContent}` : coreContent;
    // archive 결과를 await로 받아 ShareBar 즉시 표시 가능하게 함 (fire-and-forget X)
    const archivedRecordId = await archiveSaju({
      profileId,
      sourceBirth: sourceBirthFromSaju(result),
      category: 'traditional',
      resultData: result as unknown as Record<string, unknown>,
      interpretation: fullContent,
      isDetailed: true,
    }).catch(() => null);

    const adviceMeta = merged.advice ? parseAdviceMeta(merged.advice) : undefined;
    // 3회 retry 후에도 실패한 경우만 partial — 사용자에게 명확한 안내
    return {
      success: true,
      sections: merged,
      adviceMeta,
      ...(archivedRecordId ? { archivedRecordId } : {}),
      ...(appError ? {
        partial: true,
        partialMessage: '핵심 4섹션은 분석 완료. 나머지 8섹션(직업·재물·애정·건강 등)은 3회 재시도 후에도 일시 오류가 지속됐어요. 잠시 후 다시 풀이를 받으면 재차감 없이 8섹션만 다시 시도합니다.',
      } : {}),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// ── 실시간 운세 — V3 만 사용 (V1 함수·인터페이스는 데드코드로 제거) ──

/** 한자 매핑 */
const GAN_HANJA: Record<string, string> = {
  갑:'甲', 을:'乙', 병:'丙', 정:'丁', 무:'戊', 기:'己', 경:'庚', 신:'辛', 임:'壬', 계:'癸'
};
const ZHI_HANJA: Record<string, string> = {
  자:'子', 축:'丑', 인:'寅', 묘:'卯', 진:'辰', 사:'巳', 오:'午', 미:'未', 신:'申', 유:'酉', 술:'戌', 해:'亥'
};

/** 오늘 일진(日辰) 간지 계산 + 원국과의 합충 분석 */
export function calcTodayGanZhi(result: SajuResult, isoDate: string): TodayGanZhi {
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

// ─────────────────────────────────────────────────────────────────────────────
// 실시간 운세 V3 — 14 섹션 + 9 항목 점수 + 4 시간대 흐름 + 사용자 입력 반영
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
  /** archive 저장 후 record id — ShareBar 표시에 사용 */
  archivedRecordId?: string;
  /** 3회 retry 후에도 13 섹션 모두 채우지 못한 경우 true */
  partial?: boolean;
  partialMessage?: string;
}

/** [today_scores] 종합:XX 시험:XX 공부:XX 멘탈:XX 대인:XX 이성:XX 금전:XX 운동:XX 회복:XX 횡재:XX
 *
 * AI 가이드와 일치하는 floor 보장:
 * - 종합 60~97 (어떤 흉운에도 60 미만 금지)
 * - 항목별 55~97 (페널티 누적 시도 보호)
 */
export function parseTodayV3DomainScores(raw: string): TodayV3DomainScores | undefined {
  const m = raw.match(/\[today_scores\]\s*종합:(\d+)\s*시험:(\d+)\s*공부:(\d+)\s*멘탈:(\d+)\s*대인:(\d+)\s*이성:(\d+)\s*금전:(\d+)\s*운동:(\d+)\s*회복:(\d+)\s*횡재:(\d+)/);
  if (!m) return undefined;
  const clampOverall = (s: string) => Math.min(97, Math.max(60, Number(s)));
  const clampDomain = (s: string) => Math.min(97, Math.max(55, Number(s)));
  return {
    overall:  clampOverall(m[1]),
    exam:     clampDomain(m[2]),
    focus:    clampDomain(m[3]),
    mental:   clampDomain(m[4]),
    social:   clampDomain(m[5]),
    love:     clampDomain(m[6]),
    money:    clampDomain(m[7]),
    exercise: clampDomain(m[8]),
    recovery: clampDomain(m[9]),
    luck:     clampDomain(m[10]),
  };
}

/** [today_flow] 자정:XX 아침:XX 오후:XX 저녁:XX
 *
 * AI 가이드와 일치하는 floor 보장: 시간대별 50~95 (가장 약한 시간대도 50 미만 금지)
 */
export function parseTodayV3FlowScores(raw: string): TodayV3FlowScores | undefined {
  const m = raw.match(/\[today_flow\]\s*자정:(\d+)\s*아침:(\d+)\s*오후:(\d+)\s*저녁:(\d+)/);
  if (!m) return undefined;
  const clamp = (s: string) => Math.min(95, Math.max(50, Number(s)));
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

/** today_domains_brief / today_lucky_card 의 라벨 — 줄별 분리·문단화에 사용 */
const TODAY_DOMAIN_LABELS_RE = /(연애|일·업무|일\s*업무|재물|건강|학습|대인|횡재|멘탈|이동|컬러|숫자|아이템|장소)\s*[—–-]/;

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
    // 줄 앞 불릿·세모 기호 제거 (today_lucky_card / today_domains_brief 줄별 라벨 형식 보정)
    .replace(/^[\s]*[▶▷►▸▶︎▷︎]+\s*/gm, '')
    // ── today_domains_brief / today_lucky_card 라벨 시작 줄 앞에 빈 줄 강제 ──
    // 라벨이 줄 중간에 붙어있거나(같은 줄에 두 라벨) 줄바꿈 1번만 있어 문단 구분 안 보이는 경우 모두 정화
    .replace(/([^\n])\n((?:연애|일·업무|일\s*업무|재물|건강|학습|대인|횡재|멘탈|이동|컬러|숫자|아이템|장소)\s*[—–-])/g, '$1\n\n$2')
    .replace(/([.!?…,)])\s*((?:연애|일·업무|일\s*업무|재물|건강|학습|대인|횡재|멘탈|이동|컬러|숫자|아이템|장소)\s*[—–-])/g, '$1\n\n$2')
    // 연속 빈 줄 정리 (3개 이상 → 2개)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// 미사용 경고 회피용 (regex 가 함수 안에서 재사용되지 않더라도 유지)
void TODAY_DOMAIN_LABELS_RE;

/**
 * q1Answer / q2Answer 가 칩 옵션 매칭이 아닌 자유 텍스트(직접 입력)인지 판정.
 * ctx.q1Text / q2Text 와 ctx.timeSlot 으로 옵션 lookup 후 비교.
 */
const isCustomTimeSlotAnswer = (
  questionText: string | undefined,
  answer: string | undefined,
  slot: TodayTimeSlot,
): boolean => {
  if (!answer || !answer.trim() || !questionText) return false;
  const pool = TODAY_TIME_SLOT_QUESTION_POOL[slot] ?? [];
  const matched = pool.find((qs) => qs.q === questionText);
  if (!matched) return true; // 질문 자체 매칭 안 되면 안전하게 custom 으로 간주
  return !matched.options.includes(answer.trim());
};

export const getTodayFortuneV3Report = async (
  result: SajuResult,
  ctx: TodayUserContext,
  isoDate?: string,
  profileId?: string,
): Promise<TodayFortuneV3AIResult> => {
  try {
    const date = isoDate ?? new Date().toISOString().slice(0, 10);
    const todayGz = calcTodayGanZhi(result, date);

    // ── [Pre-classification] 직접 입력 필드들 분류 (있을 때만) ──
    // 칩만 선택한 케이스는 호출 자체 skip → 영향 0. 분류 실패 시 null 반환 → fallback.
    const q1IsCustom = isCustomTimeSlotAnswer(ctx.q1Text, ctx.q1Answer, ctx.timeSlot);
    const q2IsCustom = isCustomTimeSlotAnswer(ctx.q2Text, ctx.q2Answer, ctx.timeSlot);
    const classifierInputs = {
      customHobby: ctx.customHobby?.trim() || undefined,
      customJobState: ctx.customJobState?.trim() || undefined,
      customLoveState: ctx.customLoveState?.trim() || undefined,
      q1Answer: q1IsCustom ? ctx.q1Answer?.trim() : undefined,
      q2Answer: q2IsCustom ? ctx.q2Answer?.trim() : undefined,
    };
    const hasAnyCustom = Object.values(classifierInputs).some((v) => v && v.length > 0);
    const classifications: UserInputClassifications | null = hasAnyCustom
      ? await classifyUserInputs(classifierInputs, ctx.q1Text, ctx.q2Text)
      : null;

    const prompt = generateTodayFortuneV3Prompt(result, todayGz, date, ctx, classifications);

    // ── 13 섹션 모두 있는 응답을 받기 위한 retry 안전망 ──
    // 사용자 보고: "큰 섹션은 동일해야지 않나?" — 13개 섹션 항상 노출 보장.
    // LLM 이 한두 섹션 빼먹으면 재시도. 정통사주의 MAX_APP_ATTEMPTS=3 패턴 적용.
    const REQUIRED_KEYS: ReadonlyArray<TodayV3SectionKey> = TODAY_V3_SECTION_KEYS;
    const MAX_TODAY_ATTEMPTS = 3;
    /** 13개 중 누락 허용 임계치 — 12~13 OK, 10~11 재시도, 9 이하 재시도(마지막엔 partial 인정) */
    const ACCEPT_THRESHOLD = 12;

    let content = '';
    let sections: Partial<Record<TodayV3SectionKey, string>> = {};
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= MAX_TODAY_ATTEMPTS; attempt++) {
      try {
        content = await callGPT(prompt, 9500, undefined, { allowTruncated: true, timeoutMs: 120_000 });
        sections = parseTodayV3Sections(content);
        const parsedCount = Object.keys(sections).length;
        const missing = REQUIRED_KEYS.filter(k => !sections[k]);

        if (parsedCount >= ACCEPT_THRESHOLD) {
          if (attempt > 1) console.log(`[today_v3] retry ${attempt}회차 성공 (${parsedCount}/13)`);
          lastError = null;
          break;
        }

        // 핵심 섹션(today_basis / today_domains_brief / today_lucky_card / today_fortune_message) 누락 시 무조건 재시도
        const coreKeys: TodayV3SectionKey[] = ['today_basis', 'today_domains_brief', 'today_lucky_card', 'today_fortune_message'];
        const missingCore = coreKeys.filter(k => !sections[k]);

        lastError = `PARTIAL: 13 섹션 중 ${parsedCount}개만 파싱됨 (누락: ${missing.join(',')}${missingCore.length ? ` / 핵심 누락: ${missingCore.join(',')}` : ''})`;
        console.warn(`[today_v3] 호출 ${attempt}회차 미흡:`, lastError);

        if (attempt < MAX_TODAY_ATTEMPTS) {
          // 점진 백오프: 1500ms, 2500ms
          await new Promise((r) => setTimeout(r, 1500 + (attempt - 1) * 1000));
          continue;
        }
        // 마지막 시도면 partial 인정 — 사용자가 풀이는 받지만 일부 섹션 누락 가능
        if (attempt > 1) console.warn(`[today_v3] retry ${MAX_TODAY_ATTEMPTS}회 모두 미흡 — partial 인정 (${parsedCount}/13)`);
        break;
      } catch (e: any) {
        lastError = e?.message || 'callGPT 호출 실패';
        console.warn(`[today_v3] 호출 ${attempt}회차 에러:`, lastError);
        if (attempt < MAX_TODAY_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 1500 + (attempt - 1) * 1000));
          continue;
        }
      }
    }

    const domainScores = parseTodayV3DomainScores(content);
    const flowScores = parseTodayV3FlowScores(content);

    const archivedRecordId = await archiveSaju({
      profileId,
      sourceBirth: sourceBirthFromSaju(result),
      category: 'today',
      resultData: result as unknown as Record<string, unknown>,
      engineResult: { todayGz, isoDate: date, userContext: ctx, version: 'v3' } as Record<string, unknown>,
      interpretation: content,
    }).catch(() => null);

    if (Object.keys(sections).length === 0) {
      // 3회 retry 후에도 파싱 0건이면 rawText fallback
      return { success: true, rawText: content, domainScores, flowScores, todayGz, isoDate: date, userContext: ctx, ...(archivedRecordId ? { archivedRecordId } : {}) };
    }
    return {
      success: true,
      sections,
      domainScores,
      flowScores,
      todayGz,
      isoDate: date,
      userContext: ctx,
      ...(archivedRecordId ? { archivedRecordId } : {}),
      ...(lastError ? { partial: true, partialMessage: '일부 섹션이 누락되어 다시 시도했어요. 보이는 섹션은 정상 분석된 내용이에요.' } : {}),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * 실시간 운세 V3 prompt 빌드 — 백그라운드 잡 시스템용.
 * getTodayFortuneV3Report 의 prompt 생성 로직(분류기 포함)을 추출.
 * 클라이언트가 호출해 완성된 prompt 를 /api/fortune/jobs/create 로 전달.
 */
export async function buildTodayV3Prompt(
  result: SajuResult,
  ctx: TodayUserContext,
  isoDate: string,
): Promise<{ prompt: string; todayGz: TodayGanZhi }> {
  const todayGz = calcTodayGanZhi(result, isoDate);

  const q1IsCustom = isCustomTimeSlotAnswer(ctx.q1Text, ctx.q1Answer, ctx.timeSlot);
  const q2IsCustom = isCustomTimeSlotAnswer(ctx.q2Text, ctx.q2Answer, ctx.timeSlot);
  const classifierInputs = {
    customHobby: ctx.customHobby?.trim() || undefined,
    customJobState: ctx.customJobState?.trim() || undefined,
    customLoveState: ctx.customLoveState?.trim() || undefined,
    q1Answer: q1IsCustom ? ctx.q1Answer?.trim() : undefined,
    q2Answer: q2IsCustom ? ctx.q2Answer?.trim() : undefined,
  };
  const hasAnyCustom = Object.values(classifierInputs).some((v) => v && v.length > 0);
  const classifications: UserInputClassifications | null = hasAnyCustom
    ? await classifyUserInputs(classifierInputs, ctx.q1Text, ctx.q2Text)
    : null;

  const prompt = generateTodayFortuneV3Prompt(result, todayGz, isoDate, ctx, classifications);
  return { prompt, todayGz };
}

// ── 택일 AI 추천 ─────────────────────────────────────────────

export interface TaekilAdviceResult {
  success: boolean;
  advice?: string;
  error?: string;
  /** archive 저장 후 record id — ShareBar 표시에 사용 */
  archivedRecordId?: string;
}

export const getTaekilAdvice = async (
  saju: SajuResult,
  taekil: TaekilResult,
  profileId?: string,
  /** 사용자가 100자 이내로 적은 행사 정황. prompt 의 [상세 입력] 블록으로 전달 */
  detail?: string,
): Promise<TaekilAdviceResult> => {
  try {
    const prompt = generateTaekilAdvicePrompt(saju, taekil, detail);
    // [comprehensive_analysis] + top1·2·3 × (종합·조언·주의·키워드) + avoid + overall_advice + alternative.
    // 총 2300~2900자 (출산 2400~3000자) 풍부 풀이 위해 maxTokens 12000.
    // 한국어 토큰 비율 보수적으로 잡아 응답 잘림 방지. timeoutMs 180초 — 분량 늘어난 만큼 여유 확보.
    // minContentLength 1500 — 새 하한선 분량 미달 시 callGPT 가 재시도.
    const raw = await callGPT(prompt, 12000, 1500, { timeoutMs: 180_000 });
    // [taekil_advice] 마커 제거하고 본문만 추출
    const match = raw.match(/\[taekil_advice\]\s*([\s\S]+)/);
    const advice = match ? match[1].trim() : raw.trim();
    // engineResult 에 detail 도 같이 저장 — archive 복원 시 같은 정황이 prompt 에 다시 들어가도록
    const engineWithDetail = { ...(taekil as unknown as Record<string, unknown>), userDetail: detail ?? '' };
    const archivedRecordId = await archiveSaju({ profileId, sourceBirth: sourceBirthFromSaju(saju), category: 'taekil', resultData: saju as unknown as Record<string, unknown>, engineResult: engineWithDetail, interpretation: advice }).catch(() => null);
    return { success: true, advice, ...(archivedRecordId ? { archivedRecordId } : {}) };
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
  /** archive 저장 후 record id — ShareBar 표시에 사용 */
  archivedRecordId?: string;
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
  /** 대표 프로필의 사용자 컨텍스트 — 각 섹션 풀이에 분산 인용해 커스텀 결과 생성 */
  userCtx?: {
    jobState?: string | null;
    customJobState?: string | null;
    loveState?: string | null;
    customLoveState?: string | null;
  },
  /** 연도별 운세 메뉴에서 진입한 경우 true — archive 의 engine_result.source 에 박혀 보관함 라벨 분기 */
  isYearFortune?: boolean,
): Promise<NewyearReportAIResult> => {
  try {
    // ★ saju.seWoon 은 calculateSeWoon 의 12년 윈도우 (currentYear -7 ~ +4) 만 가짐
    //   연도별 운세에서 1900 ~ 2200 자유 선택 가능하므로 윈도우 밖이면 동적 계산
    let seWoon = result.seWoon.find(s => s.year === year);
    if (!seWoon) {
      const dynamicRange = calculateSeWoonRange(result.pillars.day.gan, year, 1, result.pillars.year.zhi);
      seWoon = dynamicRange[0];
      if (!seWoon) throw new Error(`${year}년 세운 데이터가 없습니다.`);
    }

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
      userCtx,
    });

    // 2-pass 분할: 1차(general·wealth·career·study·love) + 2차(health·relation·monthly·lucky)
    // study 신설로 1차에 추가 — 1차 5섹션 합 ~1450자라 5000 토큰 여유
    const pass1Prompt = prompt + '\n\n★ 이번 응답에서는 [general] [wealth] [career] [study] [love] 5개 섹션만 출력. 나머지 4개는 다음 호출에서 작성.';
    const pass1Content = await callGPT(pass1Prompt, 5500);
    const pass1Sections = parseNewyearReport(pass1Content);

    const pass2Prompt = prompt
      + '\n\n★ 이번 응답에서는 [health] [relation] [monthly] [lucky] 4개 섹션만 출력. [general] [wealth] [career] [study] [love]는 이미 완료.'
      + `\n\n[이미 작성된 1차 내용 — 참고만, 출력하지 말 것]\n${pass1Content}`;
    const pass2Content = await callGPT(pass2Prompt, 6000);
    const pass2Sections = parseNewyearReport(pass2Content);

    const sections: Partial<Record<NewyearSectionKey, string>> = { ...pass1Sections, ...pass2Sections };
    const content = `${pass1Content}\n\n${pass2Content}`;

    // engineResult 에 isoDate·categoryLabel 추가 — findArchiveList 가 리스트 모달에서 연도 식별·표시 가능
    const archivedRecordId = await archiveSaju({
      profileId,
      sourceBirth: sourceBirthFromSaju(result),
      category: 'newyear',
      resultData: result as unknown as Record<string, unknown>,
      engineResult: {
        year,
        isoDate: String(year),
        categoryLabel: isYearFortune ? `${year}년도 운세 풀이` : `${year}년 신년운세`,
        source: isYearFortune ? 'year-fortune' : 'newyear',
        seWoon,
        currentDaeWoon,
      } as unknown as Record<string, unknown>,
      interpretation: content,
      isDetailed: true,
    }).catch(() => null);

    if (Object.keys(sections).length === 0) {
      return { success: true, rawText: content, ...(archivedRecordId ? { archivedRecordId } : {}) };
    }
    return { success: true, sections, ...(archivedRecordId ? { archivedRecordId } : {}) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

// ─────────────────────────────────────────────
// 지정일 운세 — 사용자가 직접 고른 날짜의 7섹션 종합 풀이
// ─────────────────────────────────────────────

export type DateTimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';
export type DateFlowScores = Record<DateTimeSlot, number>;

export const DATE_TIME_SLOT_LABELS: Record<DateTimeSlot, string> = {
  morning: '아침', afternoon: '낮', evening: '저녁', night: '밤',
};

export function parseDateFlowScores(raw: string): DateFlowScores | undefined {
  const m = raw.match(/(?:\[date_flow\]\s*)?아침\s*[:：]\s*(\d+)\s*낮\s*[:：]\s*(\d+)\s*저녁\s*[:：]\s*(\d+)\s*밤\s*[:：]\s*(\d+)/);
  if (!m) return undefined;
  const clamp = (s: string) => Math.min(100, Math.max(0, Number(s)));
  return { morning: clamp(m[1]), afternoon: clamp(m[2]), evening: clamp(m[3]), night: clamp(m[4]) };
}

export interface PickedDateReportAIResult {
  success: boolean;
  sections?: Partial<Record<PickedDateSectionKey, string>>;
  flow?: DateFlowScores;
  rawText?: string;
  error?: string;
  /** archive 저장 후 record id — ShareBar 표시에 사용 */
  archivedRecordId?: string;
}

export const parsePickedDateReport = (raw: string): Partial<Record<PickedDateSectionKey, string>> => {
  const out: Partial<Record<PickedDateSectionKey, string>> = {};

  const cleaned = raw
    .replace(/\*\*?\s*\[/g, '[')
    .replace(/\]\s*\*\*?/g, ']')
    .replace(/^\s*[-•▶]\s*\[/gm, '[');

  const variantsFor = (k: string) => k.split('_').join('[_\\s-]?');
  const altPattern = PICKED_DATE_SECTION_KEYS.map(variantsFor).join('|');
  const splitter = new RegExp(`\\[(${altPattern})\\]\\s*:?`, 'gi');
  const parts = cleaned.split(splitter);

  const normalize = (k: string): PickedDateSectionKey | null => {
    const stripped = k.toLowerCase().replace(/[^a-z]/g, '');
    return (PICKED_DATE_SECTION_KEYS.find(s => s.replace(/_/g, '') === stripped) ?? null) as PickedDateSectionKey | null;
  };

  for (let i = 1; i < parts.length; i += 2) {
    const key = normalize(parts[i]);
    if (!key) continue;
    const body = (parts[i + 1] || '').replace(/\[\/?[a-zA-Z_]+\]/g, '').trim();
    if (body) out[key] = body;
  }
  return out;
};

export const getPickedDateReport = async (
  result: SajuResult,
  isoDate: string,
  profileId?: string,
  /** 대표 프로필의 사용자 컨텍스트 — 각 섹션 풀이에 분산 인용해 커스텀 결과 생성.
   *  신년운세(getNewyearReport) 와 동일 패턴. */
  userCtx?: {
    jobState?: string | null;
    customJobState?: string | null;
    loveState?: string | null;
    customLoveState?: string | null;
  },
): Promise<PickedDateReportAIResult> => {
  try {
    const todayGz = calcTodayGanZhi(result, isoDate);
    const prompt = generatePickedDateFortunePrompt(result, todayGz, isoDate, userCtx);

    // 2-pass 분할 (13 섹션, 3400~4400자):
    //   1차: [date_essence] [date_timeflow] [date_wealth] [date_career] [date_love] [date_health] [date_relation] (7)
    //   2차: [date_study] [date_yes] [date_no] [date_people] [date_remedy] [date_closing] (6)
    const pass1Prompt = prompt + '\n\n★ 이번 응답에서는 [date_flow] 데이터 줄과 [date_essence] [date_timeflow] [date_wealth] [date_career] [date_love] [date_health] [date_relation] 섹션만 출력하세요. 나머지는 다음 호출에서 작성합니다. 각 섹션 분량 지침을 충실히 따라 깊이 있게 작성하세요.';
    const pass1Content = await callGPT(pass1Prompt, 7000, undefined, { allowTruncated: true, timeoutMs: 90_000 });

    const pass2Prompt = prompt
      + '\n\n★ 이번 응답에서는 [date_study] [date_yes] [date_no] [date_people] [date_remedy] [date_closing] 섹션만 출력하세요. 앞의 섹션들은 이미 완료되었습니다. 각 섹션 분량 지침을 충실히 따라 깊이 있게 작성하세요.'
      + `\n\n[이미 작성된 1차 내용 — 참고만, 출력하지 말 것]\n${pass1Content}`;
    const pass2Content = await callGPT(pass2Prompt, 6000, undefined, { allowTruncated: true, timeoutMs: 90_000 });

    const content = `${pass1Content}\n\n${pass2Content}`;
    const sections = parsePickedDateReport(content);
    const flow = parseDateFlowScores(content);
    const archivedRecordId = await archiveSaju({
      profileId,
      sourceBirth: sourceBirthFromSaju(result),
      category: 'period',
      resultData: result as unknown as Record<string, unknown>,
      engineResult: { isoDate, todayGz } as unknown as Record<string, unknown>,
      interpretation: content,
      creditType: 'sun',
      isDetailed: true,
    }).catch(() => null);
    if (Object.keys(sections).length === 0) {
      return { success: true, rawText: content, flow, ...(archivedRecordId ? { archivedRecordId } : {}) };
    }
    return { success: true, sections, rawText: content, flow, ...(archivedRecordId ? { archivedRecordId } : {}) };
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
    const prompt = generateHybridPrompt(sajuResult, tarotCard, question, mode, allDrawnCards);
    // 모드별 섹션 분기: today/question 4섹션 (≤1,180자), monthly 5섹션 (≤1,450자). 4,000 토큰 충분.
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
// (모두 달 크레딧 5개 소모 — 2026-05-16 단일 달 크레딧 통합 후, 짧은 형식)
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

/** 섹션 마커 [key] 기반 본문 파싱 — 학업·자녀·성격 공용 */
function parseMarkerSections<K extends string>(raw: string, keys: readonly K[]): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  if (!raw) return out;
  const keysPattern = keys.join('|');
  // ★ AI 출력 변형 흡수 — 모든 케이스를 표준 [key] 형식으로 정규화:
  //   [Summary] / [summary :] / [ summary ] / **[summary]** / ▶ [summary] / [summary]:
  //   대소문자(i flag) + 마커 안팎 공백 + 뒤따라오는 콜론·기호도 강제 제거.
  const normalized = raw.replace(
    new RegExp(`^[\\s*#▶■·•\\-]*\\[\\s*(${keysPattern})\\s*\\][\\s*#:：]*$`, 'gmi'),
    (_match: string, key: string) => `[${key.toLowerCase()}]`,
  );
  const parts = normalized.split(new RegExp(`^\\s*\\[(${keysPattern})\\]\\s*$`, 'm'));
  for (let i = 1; i < parts.length; i += 2) {
    const key = parts[i] as K;
    const body = (parts[i + 1] || '').trim();
    if (body) out[key] = body;
  }
  return out;
}

export const parseStudySections = (raw: string): Partial<Record<StudySectionKey, string>> =>
  parseMarkerSections(raw, STUDY_SECTION_KEYS);
export const parseChildrenSections = (raw: string): Partial<Record<ChildrenSectionKey, string>> =>
  parseMarkerSections(raw, CHILDREN_SECTION_KEYS);
export const parsePersonalitySections = (raw: string): Partial<Record<PersonalitySectionKey, string>> =>
  parseMarkerSections(raw, PERSONALITY_SECTION_KEYS);
/**
 * 이름 풀이 섹션 파싱 — 마커 기반 + 본문 키워드 fallback 2단계.
 *
 * 1차: [summary]/[meaning]/[four_axis]/[strength]/[shadow]/[preserve]/[rename] 마커로 분리 (정상)
 * 2차 (fallback): Gemini 가 마커 누락한 경우 본문 키워드로 단락 추론
 *
 * ★ 레거시 호환 — 과거 6섹션([eum_ryeong]/[ja_won]/[harmony]/[numerology]/[advice]) 마커로
 *   저장된 archive 풀이는 옛 키 → 새 키로 매핑하여 표시.
 *     eum_ryeong/ja_won/numerology → four_axis 로 머지
 *     harmony                       → strength
 *     advice                        → preserve
 */
const LEGACY_NAME_KEYS = ['eum_ryeong', 'ja_won', 'harmony', 'numerology', 'advice'] as const;
type LegacyNameKey = typeof LEGACY_NAME_KEYS[number];

const LEGACY_TO_NEW_NAME: Record<LegacyNameKey, NameSectionKey> = {
  eum_ryeong: 'four_axis',
  ja_won:     'four_axis',
  numerology: 'four_axis',
  harmony:    'strength',
  advice:     'preserve',
};

export const parseNameSections = (raw: string): Partial<Record<NameSectionKey, string>> => {
  // 1차 — 새 7섹션 마커
  const markerResult = parseMarkerSections(raw, NAME_SECTION_KEYS);

  // 1.5차 — 레거시 6섹션 마커도 함께 보고 새 키로 매핑
  const legacyResult = parseMarkerSections(raw, LEGACY_NAME_KEYS as unknown as readonly string[]);
  const mergedFromLegacy: Partial<Record<NameSectionKey, string>> = {};
  for (const lk of LEGACY_NAME_KEYS) {
    const body = (legacyResult as Record<string, string | undefined>)[lk];
    if (!body) continue;
    const nk = LEGACY_TO_NEW_NAME[lk];
    mergedFromLegacy[nk] = mergedFromLegacy[nk] ? `${mergedFromLegacy[nk]}\n\n${body}` : body;
  }

  // 새 마커가 충분히 잡혔으면 새 결과 우선
  if (Object.keys(markerResult).length >= 3) return { ...mergedFromLegacy, ...markerResult };
  // 레거시 마커가 충분히 잡혔으면 그걸 우선
  if (Object.keys(mergedFromLegacy).length >= 3) return { ...mergedFromLegacy, ...markerResult };

  // 2차 fallback — 본문 키워드 기반 단락 분할
  const trimmed = raw.trim();
  if (!trimmed) return { ...mergedFromLegacy, ...markerResult };

  const paragraphs = trimmed.split(/\n\s*\n+/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length < 2) return { ...mergedFromLegacy, ...markerResult };

  const classifyParagraph = (p: string, idx: number, total: number): NameSectionKey | null => {
    const lower = p;

    // rename — "개명", "이름을 바꾼", "작명소", "권장 방향"
    if (/(개명|이름을\s*바꾸|작명소|새\s*이름|부분\s*개명)/.test(lower) && idx >= total - 4) {
      return 'rename';
    }
    // preserve — 불릿이 있고 "필명/호명/SNS/이니셜/색·소품" 류
    if ((/^\s*[-·•∙]\s/.test(p) || /(필명|호명|닉네임|SNS|이니셜|서명|소품|색|호칭)/.test(lower))
        && idx >= total - 5) {
      return 'preserve';
    }
    // shadow — "그늘/약점/주의/조심/충돌/거스/기신/흉수"
    if (/(그늘|약점|주의|조심|충돌|거스|기신|흉수|보완\s*필요|봉합|마찰)/.test(lower)) {
      return 'shadow';
    }
    // strength — "강점/살아나/받쳐주/돋보/보강"
    if (/(강점|살아나|받쳐주|돋보|보강\s*되|일치해|용신.*돕)/.test(lower)) {
      return 'strength';
    }
    // four_axis — "음령/자원오행/부수/수리/4격/원격/형격/이격/정격"
    if (/(음령오행|음령|초성|자원오행|부수|수리오행|수리|81\s*수|원격|형격|이격|정격|大吉|大凶)/.test(lower)
        || /(\d+수\s*(대길|대흉|길|흉|평))/.test(lower)) {
      return 'four_axis';
    }
    // meaning — "뜻/의미/한자 조합/풀이"
    if (/(이름의\s*뜻|뜻|의미|한자\s*조합|어감|풀이)/.test(lower) && idx <= 2) {
      return 'meaning';
    }
    // summary — 첫 단락 또는 결론 톤
    if (idx === 0 || /(전반적으로|결론|보강합니다|중립|거스릅니다|보강해|중립적|거스르는)/.test(lower)) {
      return 'summary';
    }
    return null;
  };

  const out: Partial<Record<NameSectionKey, string>> = { ...mergedFromLegacy };
  paragraphs.forEach((p, i) => {
    const key = classifyParagraph(p, i, paragraphs.length);
    if (key) {
      out[key] = out[key] ? `${out[key]}\n\n${p}` : p;
    }
  });

  if (!out.summary && paragraphs[0]) out.summary = paragraphs[0];

  // 마커 결과가 있으면 우선 적용
  return { ...out, ...markerResult };
};

export const getStudyShort = async (result: SajuResult, profileId?: string): Promise<FortuneResponse> => {
  try {
    const content = await callGPT(generateStudyShortPrompt(result), MORE_FORTUNE_CONFIGS.study.maxTokens);
    const sections = parseStudySections(content);
    archiveSaju({ profileId, sourceBirth: sourceBirthFromSaju(result), category: 'study', resultData: result as unknown as Record<string, unknown>, interpretation: content, creditType: 'moon', creditUsed: 1 });
    return { success: true, content, sections };
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
    const sections = parseChildrenSections(content);
    archiveSaju({ profileId, sourceBirth: sourceBirthFromSaju(result), category: 'children', resultData: result as unknown as Record<string, unknown>, interpretation: content, creditType: 'moon', creditUsed: 1 });
    return { success: true, content, sections };
  } catch (e: any) { return { success: false, error: e.message }; }
};

export const getPersonalityShort = async (result: SajuResult, profileId?: string): Promise<FortuneResponse> => {
  try {
    const content = await callGPT(generatePersonalityShortPrompt(result), MORE_FORTUNE_CONFIGS.personality.maxTokens);
    const sections = parsePersonalitySections(content);
    archiveSaju({ profileId, sourceBirth: sourceBirthFromSaju(result), category: 'personality', resultData: result as unknown as Record<string, unknown>, interpretation: content, creditType: 'moon', creditUsed: 1 });
    return { success: true, content, sections };
  } catch (e: any) { return { success: false, error: e.message }; }
};

/**
 * 이름 풀이 prompt 빌드 — 백그라운드 잡 시스템용.
 * getNameFortune 의 hanjaResolved·numerology4Gyeok 처리 + prompt 생성을 추출.
 * 클라이언트가 호출해 완성된 prompt·maxTokens·engineResult 를 jobs/create 로 전달.
 */
export async function buildNameFortunePrompt(
  result: SajuResult,
  nameInput: NameAnalysisInput,
): Promise<{ prompt: string; maxTokens: number; engineResult: Record<string, unknown> }> {
  const hasMeaning = !!(nameInput.charMeanings ?? []).find((c) => c.meaning && c.meaning.trim().length > 0);
  const isHanjaMode = hasMeaning || !!nameInput.hanjaName;

  let nameInputWithResolved = nameInput;
  if (nameInput.hanjaName && nameInput.charMeanings && nameInput.charMeanings.length > 0) {
    const { lookupHanjaBySound } = await import('@/lib/data/hanjaByKoreanSound');
    const { calc4Gyeok } = await import('@/utils/numerology');
    const chars = [...nameInput.hanjaName];
    const resolved = chars.map((char, i) => {
      const sound = nameInput.charMeanings?.[i]?.sound ?? '';
      const candidates = lookupHanjaBySound(sound);
      const hit = candidates.find((c) => c.char === char);
      return hit
        ? { char, meaning: hit.meanings[0] ?? (nameInput.charMeanings?.[i]?.meaning ?? ''), radical: hit.radical, strokes: hit.strokes, jawon: hit.jawon }
        : { char, meaning: nameInput.charMeanings?.[i]?.meaning ?? '', radical: '', strokes: 0, jawon: '' };
    });
    const sounds = (nameInput.charMeanings ?? []).map((c) => c.sound ?? '');
    const fourGyeok = calc4Gyeok(chars, sounds, nameInput.surnameLength ?? 1);
    const numerology4Gyeok = fourGyeok
      ? {
          strokes: fourGyeok.strokes,
          won: { sum: fourGyeok.won.sum, grade: fourGyeok.won.entry.grade, name: fourGyeok.won.entry.name, meaning: fourGyeok.won.entry.meaning },
          hyeong: { sum: fourGyeok.hyeong.sum, grade: fourGyeok.hyeong.entry.grade, name: fourGyeok.hyeong.entry.name, meaning: fourGyeok.hyeong.entry.meaning },
          i: { sum: fourGyeok.i.sum, grade: fourGyeok.i.entry.grade, name: fourGyeok.i.entry.name, meaning: fourGyeok.i.entry.meaning },
          jeong: { sum: fourGyeok.jeong.sum, grade: fourGyeok.jeong.entry.grade, name: fourGyeok.jeong.entry.name, meaning: fourGyeok.jeong.entry.meaning },
        }
      : undefined;
    nameInputWithResolved = { ...nameInput, hanjaResolved: resolved, numerology4Gyeok };
  }

  const baseTokens = MORE_FORTUNE_CONFIGS.name.maxTokens;
  const maxTokens = isHanjaMode ? Math.round(baseTokens * 1.5) : Math.round(baseTokens * 1.25);
  const prompt = generateNameFortunePrompt(result, nameInputWithResolved);
  const engineResult: Record<string, unknown> = {
    koreanName: nameInput.koreanName,
    charMeanings: nameInput.charMeanings,
    hanjaName: nameInput.hanjaName,
    // ★ 보관함 재생 시 시각 카드(4격 계산)와 본문 4격 일치를 위해 surnameLength 필수 저장.
    //   없으면 옛 record 재생 시 default=1 로 단성 룰 → 본문(복성 룰)과 시각 카드 불일치 사고.
    surnameLength: nameInput.surnameLength ?? 1,
    compoundSurnameKorean: nameInput.compoundSurnameKorean,
    // ★ 이전 풀이 모달 리스트에 입력값 라벨 표시용 — 한글 이름 그대로
    categoryLabel: nameInput.koreanName,
  };
  return { prompt, maxTokens, engineResult };
}

export const getNameFortune = async (
  result: SajuResult,
  nameInput: NameAnalysisInput,
  profileId?: string,
): Promise<FortuneResponse> => {
  try {
    // 한자 모드(글자별 뜻 ≥1 또는 사용자가 선택한 hanjaName)면 출력 길이 25% 가산.
    const hasMeaning = !!(nameInput.charMeanings ?? []).find((c) => c.meaning && c.meaning.trim().length > 0);
    const isHanjaMode = hasMeaning || !!nameInput.hanjaName;

    // ★ 사용자가 모달에서 선택한 한자가 있으면 정적 데이터에서 lookup → 결정론적 메타 주입
    //   AI 한자 추정 단계 완전 생략 + 자원오행 환각 차단.
    let nameInputWithResolved = nameInput;
    if (nameInput.hanjaName && nameInput.charMeanings && nameInput.charMeanings.length > 0) {
      const { lookupHanjaBySound } = await import('@/lib/data/hanjaByKoreanSound');
      const { calc4Gyeok } = await import('@/utils/numerology');
      const chars = [...nameInput.hanjaName];
      const resolved = chars.map((char, i) => {
        const sound = nameInput.charMeanings?.[i]?.sound ?? '';
        const candidates = lookupHanjaBySound(sound);
        const hit = candidates.find(c => c.char === char);
        return hit
          ? {
              char,
              meaning: hit.meanings[0] ?? (nameInput.charMeanings?.[i]?.meaning ?? ''),
              radical: hit.radical,
              strokes: hit.strokes,
              jawon: hit.jawon,
            }
          : {
              char,
              meaning: nameInput.charMeanings?.[i]?.meaning ?? '',
              radical: '',
              strokes: 0,
              jawon: '',
            };
      });

      // 81 수리 4격 계산 — 모든 글자가 정적 데이터에 매칭됐을 때만
      const sounds = (nameInput.charMeanings ?? []).map(c => c.sound ?? '');
      const fourGyeok = calc4Gyeok(chars, sounds, nameInput.surnameLength ?? 1);
      const numerology4Gyeok = fourGyeok
        ? {
            strokes: fourGyeok.strokes,
            won:    { sum: fourGyeok.won.sum,    grade: fourGyeok.won.entry.grade,    name: fourGyeok.won.entry.name,    meaning: fourGyeok.won.entry.meaning },
            hyeong: { sum: fourGyeok.hyeong.sum, grade: fourGyeok.hyeong.entry.grade, name: fourGyeok.hyeong.entry.name, meaning: fourGyeok.hyeong.entry.meaning },
            i:      { sum: fourGyeok.i.sum,      grade: fourGyeok.i.entry.grade,      name: fourGyeok.i.entry.name,      meaning: fourGyeok.i.entry.meaning },
            jeong:  { sum: fourGyeok.jeong.sum,  grade: fourGyeok.jeong.entry.grade,  name: fourGyeok.jeong.entry.name,  meaning: fourGyeok.jeong.entry.meaning },
          }
        : undefined;

      nameInputWithResolved = { ...nameInput, hanjaResolved: resolved, numerology4Gyeok };
    }

    // 6 섹션 마커 출력이 추가되어 길이 증가 — 출력 토큰 50% 증액
    const baseTokens = MORE_FORTUNE_CONFIGS.name.maxTokens;
    const maxTokens = isHanjaMode ? Math.round(baseTokens * 1.5) : Math.round(baseTokens * 1.25);
    const content = await callGPT(generateNameFortunePrompt(result, nameInputWithResolved), maxTokens);
    const sections = parseNameSections(content);
    archiveSaju({
      profileId,
      sourceBirth: sourceBirthFromSaju(result),
      category: 'name',
      resultData: result as unknown as Record<string, unknown>,
      engineResult: {
        koreanName: nameInput.koreanName,
        charMeanings: nameInput.charMeanings,
        hanjaName: nameInput.hanjaName,
        // ★ 보관함 시각 카드와 본문 4격 일치 보장
        surnameLength: nameInput.surnameLength ?? 1,
        compoundSurnameKorean: nameInput.compoundSurnameKorean,
        // ★ 이전 풀이 모달 리스트 라벨용
        categoryLabel: nameInput.koreanName,
      } as Record<string, unknown>,
      interpretation: content,
      creditType: 'moon',
      creditUsed: 1,
    });
    return { success: true, content, sections };
  } catch (e: any) { return { success: false, error: e.message }; }
};

/**
 * 꿈 해몽 — 사주 무관, 꿈 내용만으로 해석.
 * dreamText는 선명 모드의 원문 또는 흐릿 모드에서 구조화 입력을 composeDreamTextFromStructured로 합성한 텍스트.
 */
/**
 * 꿈해몽 응답에서 5섹션 추출.
 * - [diagnosis] / [symbols] / [oriental_interpretation] / [western_interpretation] / [action]
 * - 마커 모두 누락 시 fallback: 전체를 oriental 에 보존 (옛 record 호환).
 *
 * 세부 파싱(symbols 카드·action items)은 UI 에서 parseDreamSymbols / parseDreamAction 으로.
 */
export const parseDreamSections = (raw: string): {
  diagnosis: string;
  symbols: string;
  oriental: string;
  western: string;
  advice: string;
  caution: string;
} => {
  const empty = { diagnosis: '', symbols: '', oriental: '', western: '', advice: '', caution: '' };
  if (!raw) return empty;
  const keys = ['diagnosis', 'symbols', 'oriental_interpretation', 'western_interpretation', 'advice', 'caution', 'action'];
  const sec = (key: string): string => {
    const others = keys.filter(k => k !== key).join('|');
    const re = new RegExp(`\\[${key}\\]\\s*([\\s\\S]*?)(?=\\[(?:${others})\\]|$)`);
    const m = raw.match(re);
    return m ? m[1].trim() : '';
  };
  const diagnosis = sec('diagnosis');
  const symbols = sec('symbols');
  const oriental = sec('oriental_interpretation');
  const western = sec('western_interpretation');
  let advice = sec('advice');
  const caution = sec('caution');
  // 옛 record (v3) 의 [action] 마커는 advice 로 마이그레이션 — 시각·항목 그리드 호환 위해
  const legacyAction = sec('action');
  if (!advice && legacyAction) advice = legacyAction;
  if (!diagnosis && !symbols && !oriental && !western && !advice && !caution && !legacyAction) {
    // 옛 record 또는 AI 마커 모두 누락. 전체를 동양식에 보존.
    return { ...empty, oriental: raw.trim() };
  }
  return { diagnosis, symbols, oriental, western, advice, caution };
};

/** symbols 본문 → { name, traditional, modern }[]. 각 줄 "이름=전통의미 / 현대의미" 형식. */
export const parseDreamSymbols = (raw: string): { name: string; traditional: string; modern: string }[] => {
  if (!raw) return [];
  const out: { name: string; traditional: string; modern: string }[] = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const name = t.slice(0, eq).trim();
    const rest = t.slice(eq + 1);
    const slash = rest.indexOf(' / ');
    const traditional = (slash === -1 ? rest : rest.slice(0, slash)).trim()
      .replace(/^전통\s*[:：]\s*/, '');
    const modern = (slash === -1 ? '' : rest.slice(slash + 3)).trim()
      .replace(/^현대\s*[:：]\s*/, '');
    if (name) out.push({ name, traditional, modern });
  }
  return out.slice(0, 5);
};

/** action 본문 → { body, items }. 화이트리스트 키로 시작하는 줄은 items 로, 그 외는 body 로. */
const ACTION_KEY_WHITELIST = new Set([
  '색', '방향', '시간', '숫자', '활동', '보석',
  '액막이', '환경', '조심할 시간', '조심할 방향', '조심할 색', '보호',
]);
export const parseDreamAction = (raw: string): { body: string; items: { key: string; value: string }[] } => {
  if (!raw) return { body: '', items: [] };
  const bodyLines: string[] = [];
  const items: { key: string; value: string }[] = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    const m = t.match(/^([가-힣\s]+?)\s*[:：]\s*(.+)$/);
    if (m && ACTION_KEY_WHITELIST.has(m[1].trim())) {
      items.push({ key: m[1].trim(), value: m[2].trim() });
    } else {
      bodyLines.push(line);
    }
  }
  return {
    body: bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    items: items.slice(0, 6),
  };
};

// ════════════════════════════════════════════════════════════════════
// 꿈해몽 V4 파서 — 11 마커 (동양 6 + 서양 5)
// 2026-05-27 재설계: 가로 2탭 / 동·서양 별도 진단 / 시진 영험도 결합
// V5 (3-pass): 1차 분류기 + 2차 동양 + 3차 서양 분리 호출 — 같은 파서 재사용
// ════════════════════════════════════════════════════════════════════

/** 1차 분류기 JSON 응답 파서 */
export interface ParsedDreamClassification {
  primary_kind: string;
  confidence: 'high' | 'medium' | 'low';
  polarity_hint: string;
  strong_domains: string[];
  key_signals: string[];
  interpretive_hints: string[];
  clinical_hint: string;
  is_taemong_alert: boolean;
  is_clinical_alert: boolean;
}
export const parseDreamClassification = (raw: string): ParsedDreamClassification | null => {
  if (!raw) return null;
  try {
    // ```json ... ``` 로 감쌌을 수 있음 — strip
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const j = JSON.parse(stripped);
    if (!j || typeof j !== 'object') return null;
    return {
      primary_kind: String(j.primary_kind || '일상몽'),
      confidence: (j.confidence === 'high' || j.confidence === 'medium' || j.confidence === 'low') ? j.confidence : 'medium',
      polarity_hint: String(j.polarity_hint || '평'),
      strong_domains: Array.isArray(j.strong_domains) ? j.strong_domains.map(String).slice(0, 3) : [],
      key_signals: Array.isArray(j.key_signals) ? j.key_signals.map(String).slice(0, 6) : [],
      interpretive_hints: Array.isArray(j.interpretive_hints) ? j.interpretive_hints.map(String).slice(0, 5) : [],
      clinical_hint: String(j.clinical_hint || 'ordinary'),
      is_taemong_alert: !!j.is_taemong_alert,
      is_clinical_alert: !!j.is_clinical_alert,
    };
  } catch {
    return null;
  }
};

export type DreamPolarityLabel = '대길' | '길' | '중길' | '평' | '중흉' | '흉' | '';
export type DreamKindLabel = '태몽' | '일상몽' | '영몽' | '잡몽' | '혼재' | '';
export type DreamClinicalType = 'ordinary' | 'vivid' | 'lucid' | 'nightmare' | 'recurring' | 'threat_sim' | 'continuity' | 'sleep_paralysis' | 'false_awakening' | '';
export type DreamArchetype = 'persona' | 'shadow' | 'anima' | 'animus' | 'self' | 'wise_elder' | 'inner_child' | 'trickster' | '';

export interface DreamSymbolCardData {
  name: string;
  meaning: string;
  polarity: 'good' | 'bad' | 'mixed' | 'neutral';
  domain: string;
}
export interface DreamDomainScore {
  label: string;
  score: number;
  note: string;
}
export interface DreamAdviceItem {
  key: string;
  value: string;
}
export interface DreamArchetypeCard {
  target: string;
  archetype: DreamArchetype;
  note: string;
}

export interface DreamV4Result {
  isV4: true;
  // 동양 6섹션
  oriental_diagnosis: {
    label: string;
    kind: DreamKindLabel;
    polarity: DreamPolarityLabel;
    score: number;        // 0~100
    certainty: 'high' | 'medium' | 'low' | '';
    reason: string;
  };
  oriental_symbols: DreamSymbolCardData[];
  oriental_domains: DreamDomainScore[];
  oriental_timing: string;
  oriental_advice: { body: string; items: DreamAdviceItem[] };
  oriental_caution: { body: string; items: DreamAdviceItem[] };
  // 서양 5섹션
  western_diagnosis: {
    clinical: DreamClinicalType;
    function: string;
    intensity: 'low' | 'medium' | 'high' | '';
    reason: string;
  };
  western_latent: { surface: string; latent: string; work: string; body: string };
  western_archetypes: DreamArchetypeCard[];
  western_mirror: string;
  western_self_work: string;
}

const V4_KEYS = [
  'oriental_diagnosis',
  'oriental_symbols',
  'oriental_domains',
  'oriental_timing',
  'oriental_advice',
  'oriental_caution',
  'western_diagnosis',
  'western_latent',
  'western_archetypes',
  'western_mirror',
  'western_self_work',
] as const;

// advice 본문 안 "키:값" 항목 화이트리스트 — 긍정 처방.
const ORIENTAL_ADVICE_KEYS = new Set([
  '색', '방향', '시간', '숫자', '활동', '보석', '음식',
  '액막이', '환경', '보호',
]);

// caution 본문 안 "키:값" 항목 화이트리스트 — 회피 안내 시각화.
const ORIENTAL_CAUTION_KEYS = new Set([
  '조심할 시간', '조심할 방향', '조심할 색', '조심할 활동', '조심할 사람',
  '피해야 할 음식', '피해야 할 장소',
]);

const DOMAIN_ORDER = ['재물', '인연', '건강', '시험·학업', '직장·일', '가족·관계'] as const;

/**
 * 입력 raw 의 모든 마커를 V4_KEYS 정확 매칭으로 정규화. LLM 변형 모두 흡수:
 *   [ ORIENTAL DIAGNOSIS ] / [oriental-diagnosis] / [OrientalDiagnosis] /
 *   [westernselfwork] / [WesternSelfWork] / [western self work]
 *   → [oriental_diagnosis] / [western_self_work] 등 표준형으로 통일.
 *
 * 이전: 공백·하이픈만 underscore 로 변환 → [westernselfwork] 같이 구분자 없이
 *       붙은 형태는 정규화 실패.
 * 변경: V4_KEYS 각 키마다 "[_\s-]*" (0개 이상 구분자) 정규식으로 매칭.
 */
function normalizeMarkers(raw: string): string {
  let result = raw;
  for (const key of V4_KEYS) {
    // 'oriental_diagnosis' → 'oriental[_\\s-]*diagnosis' (0개 이상 구분자 허용)
    const flexKey = key.split('_').join('[_\\s-]*');
    const re = new RegExp(`\\[\\s*${flexKey}\\s*\\]`, 'gi');
    result = result.replace(re, `[${key}]`);
  }
  return result;
}

/**
 * V4 마커 매칭 — 입력 raw 를 먼저 정규화한 뒤 단순 매칭.
 * 이전: 정규식 안 [_\s-]? 변형 처리 → "[ ORIENTAL DIAGNOSIS ]" 같이 대소문자·공백 섞이면 일부 실패.
 * 변경: 마커 자체를 normalizeMarkers 로 통일 → 정규식은 단순 lowercase 매칭. 견고성 ↑.
 */
function extractV4Section(raw: string, key: string): string {
  const normalized = normalizeMarkers(raw);
  const others = V4_KEYS.filter(k => k !== key).join('|');
  const re = new RegExp(`\\[${key}\\]\\s*([\\s\\S]*?)(?=\\[(?:${others})\\]|$)`);
  const m = normalized.match(re);
  return m ? m[1].trim() : '';
}

function getKV(text: string, key: string): string {
  const re = new RegExp(`^\\s*${key}\\s*[:=]\\s*(.+)$`, 'mi');
  const m = text.match(re);
  return m ? m[1].trim() : '';
}

/**
 * 11마커 응답을 구조화 데이터로 파싱.
 * V4 마커가 하나도 없으면 null 반환 — 호출부에서 legacy parseDreamSections로 fallback.
 */
export const parseDreamV4 = (raw: string): DreamV4Result | null => {
  if (!raw) return null;
  // V4 마커가 하나도 없으면 legacy 응답. normalizeMarkers 로 변형 마커도 흡수.
  const normalized = normalizeMarkers(raw);
  if (!normalized.includes('[oriental_diagnosis]') && !normalized.includes('[western_diagnosis]')) return null;

  // ── 동양 ────────────────────────────────────────────
  // LLM이 score 안 적은 사고(연예인·성관계 등 컨텐츠 분류 회피로 score 누락) →
  // polarity 기반 default 로 보정. 0점 표시 사고 차단.
  const POLARITY_DEFAULT_SCORE: Record<string, number> = {
    '대길': 90, '길': 78, '중길': 62,
    '평': 50, '중흉': 38, '흉': 22, '': 55,
  };
  const odBody = extractV4Section(raw, 'oriental_diagnosis');
  const polarityVal = getKV(odBody, 'polarity') || '';
  const scoreMatch = odBody.match(/score\s*=\s*(\d+)/i);
  const rawScore = scoreMatch ? Number(scoreMatch[1]) : NaN;
  // score 누락 또는 0 (잘못) 이면 polarity 기반 default
  const scoreNum = (!isNaN(rawScore) && rawScore > 0) ? rawScore : (POLARITY_DEFAULT_SCORE[polarityVal] ?? 55);

  const odReason = (() => {
    const m = odBody.match(/근거\s*[:：]\s*([\s\S]+)/);
    if (m) return m[1].trim();
    // 근거: 라벨 없으면 마지막 비라벨 줄들
    const lines = odBody.split('\n').filter(l => l.trim() && !/^\s*(label|kind|polarity|score|certainty)\s*=/i.test(l));
    return lines.join(' ').trim();
  })();
  const oriental_diagnosis: DreamV4Result['oriental_diagnosis'] = {
    label: getKV(odBody, 'label'),
    kind: (getKV(odBody, 'kind') as DreamKindLabel) || '',
    polarity: (polarityVal as DreamPolarityLabel) || '',
    score: Math.max(0, Math.min(100, scoreNum)),
    certainty: (getKV(odBody, 'certainty') as 'high' | 'medium' | 'low' | '') || '',
    reason: odReason.slice(0, 500),
  };

  // ── 상징 카드 ──────────────────────────────────────
  const osBody = extractV4Section(raw, 'oriental_symbols');
  const oriental_symbols: DreamSymbolCardData[] = osBody
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const eq = line.indexOf('=');
      if (eq < 0) return null;
      const name = line.slice(0, eq).trim();
      const rest = line.slice(eq + 1);
      const parts = rest.split('|').map(s => s.trim());
      const meaning = parts[0] || '';
      const polRaw = (parts[1] || '').toLowerCase();
      let polarity: DreamSymbolCardData['polarity'] = 'neutral';
      if (polRaw === 'good' || polRaw === 'bad' || polRaw === 'mixed' || polRaw === 'neutral') polarity = polRaw;
      const domain = parts[2] || '';
      return { name, meaning, polarity, domain };
    })
    .filter((x): x is DreamSymbolCardData => !!x && !!x.name)
    .slice(0, 5);

  // ── 도메인 점수 ────────────────────────────────────
  // LLM 출력만 반환. "종합=점수 | 풀이" 한 줄도 인식.
  const odsBody = extractV4Section(raw, 'oriental_domains');
  const allDomainLabels = [...DOMAIN_ORDER, '종합'];
  const oriental_domains: DreamDomainScore[] = [];
  for (const label of allDomainLabels) {
    const re = new RegExp(`^\\s*${label}\\s*=\\s*(\\d+)\\s*\\|\\s*(.+)$`, 'm');
    const m = odsBody.match(re);
    if (m) {
      oriental_domains.push({
        label,
        score: Math.max(0, Math.min(100, Number(m[1]))),
        note: m[2].trim(),
      });
    }
  }
  // LLM 이 도메인 출력 모두 누락 시 polarity 기반 fallback 6 영역 자동 생성.
  // "빈 도메인 사고" (사용자가 "강한 신호 없음" 안내문만 보는 케이스) 차단.
  if (oriental_domains.length === 0) {
    const baseScore = POLARITY_DEFAULT_SCORE[polarityVal] ?? 50;
    // 영역별 고정 오프셋 — 같은 polarity 라도 영역마다 자연스러운 분산 (random 금지, 매번 동일 결과 보장)
    const DOMAIN_OFFSET: Record<string, number> = {
      '재물': 4, '인연': -3, '건강': -1,
      '시험·학업': -7, '직장·일': 6, '가족·관계': 1,
    };
    for (const label of DOMAIN_ORDER) {
      const score = Math.max(20, Math.min(90, baseScore + (DOMAIN_OFFSET[label] ?? 0)));
      oriental_domains.push({
        label,
        score,
        note: '이 영역에 대한 자세한 풀이는 본문(이 꿈은 어떤 꿈인가요)을 참고해주세요.',
      });
    }
  }

  // ── 시진 ──────────────────────────────────────────
  const oriental_timing = extractV4Section(raw, 'oriental_timing');

  // ── 조언 본문 + 항목 ───────────────────────────────
  // ── 조언 — "키: 값" 항목 추출 + 본문 분리 ────────────
  // LLM이 가끔 "키: 색: 값" 형식으로 prompt의 "키:" literal까지 적는 사고가 있음 → 자동 strip.
  const oaBody = extractV4Section(raw, 'oriental_advice');
  const bodyLines: string[] = [];
  const adviceItems: DreamAdviceItem[] = [];
  for (const ln of oaBody.split('\n')) {
    // "키: 색: ..." 같은 잘못된 prefix 자동 제거 → "색: ..."
    const t = ln.trim().replace(/^키\s*[:：]\s*/, '');
    const m = t.match(/^([가-힣\s·]+?)\s*[:：]\s*(.+)$/);
    if (m && ORIENTAL_ADVICE_KEYS.has(m[1].trim())) {
      adviceItems.push({ key: m[1].trim(), value: m[2].trim() });
    } else {
      bodyLines.push(ln);
    }
  }
  const oriental_advice = {
    body: bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    items: adviceItems.slice(0, 6),
  };

  // ── 주의 ───────────────────────────────────────────
  const ocBody = extractV4Section(raw, 'oriental_caution');
  const cautionBodyLines: string[] = [];
  const cautionItems: DreamAdviceItem[] = [];
  for (const ln of ocBody.split('\n')) {
    const t = ln.trim().replace(/^키\s*[:：]\s*/, '');
    const m = t.match(/^([가-힣\s·]+?)\s*[:：]\s*(.+)$/);
    if (m && ORIENTAL_CAUTION_KEYS.has(m[1].trim())) {
      cautionItems.push({ key: m[1].trim(), value: m[2].trim() });
    } else {
      cautionBodyLines.push(ln);
    }
  }
  const oriental_caution = {
    body: cautionBodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    items: cautionItems.slice(0, 5),
  };

  // ── 서양 진단 ──────────────────────────────────────
  const wdBody = extractV4Section(raw, 'western_diagnosis');
  const wdReason = (() => {
    const m = wdBody.match(/근거\s*[:：]\s*([\s\S]+)/);
    if (m) return m[1].trim();
    const lines = wdBody.split('\n').filter(l => l.trim() && !/^\s*(clinical|function|intensity)\s*=/i.test(l));
    return lines.join(' ').trim();
  })();
  const western_diagnosis: DreamV4Result['western_diagnosis'] = {
    clinical: (getKV(wdBody, 'clinical') as DreamClinicalType) || '',
    function: getKV(wdBody, 'function'),
    intensity: (getKV(wdBody, 'intensity') as 'low' | 'medium' | 'high' | '') || '',
    reason: wdReason.slice(0, 500),
  };

  // ── 잠재 의미 ──────────────────────────────────────
  const wlBody = extractV4Section(raw, 'western_latent');
  const wlReason = (() => {
    // 표면/잠재/작동 라벨 제외한 나머지를 본문으로
    const lines = wlBody.split('\n').filter(l => {
      const t = l.trim();
      return t && !/^\s*(표면|잠재|작동)\s*[:=]/i.test(t);
    });
    return lines.join('\n').trim();
  })();
  const western_latent: DreamV4Result['western_latent'] = {
    surface: getKV(wlBody, '표면'),
    latent: getKV(wlBody, '잠재'),
    work: getKV(wlBody, '작동'),
    body: wlReason,
  };

  // ── 원형 카드 ──────────────────────────────────────
  const waBody = extractV4Section(raw, 'western_archetypes');
  const western_archetypes: DreamArchetypeCard[] = waBody
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const eq = line.indexOf('=');
      if (eq < 0) return null;
      const target = line.slice(0, eq).trim();
      const rest = line.slice(eq + 1);
      const parts = rest.split('|').map(s => s.trim());
      const archetype = (parts[0] || '').toLowerCase() as DreamArchetype;
      const note = parts[1] || '';
      return { target, archetype, note };
    })
    .filter((x): x is DreamArchetypeCard => !!x && !!x.target)
    .slice(0, 4);

  // ── 거울 ───────────────────────────────────────────
  const western_mirror = extractV4Section(raw, 'western_mirror');

  // ── 자기 워크 ──────────────────────────────────────
  const western_self_work = extractV4Section(raw, 'western_self_work');

  return {
    isV4: true,
    oriental_diagnosis,
    oriental_symbols,
    oriental_domains,
    oriental_timing,
    oriental_advice,
    oriental_caution,
    western_diagnosis,
    western_latent,
    western_archetypes,
    western_mirror,
    western_self_work,
  };
};

export const getDreamInterpretation = async (
  dreamText: string,
  profileId?: string,
): Promise<FortuneResponse> => {
  try {
    if (!dreamText || dreamText.trim().length < 5) {
      return { success: false, error: '꿈 내용을 조금 더 적어주세요. (등장물·행동·감정 중 하나만이라도 있으면 좋아요)' };
    }
    // 5섹션 (진단 + 상징 + 동양 + 서양 + 실천) 한국어 약 3000자 ≈ 7500 토큰 필요. 10000 으로 여유.
    const content = await callGPT(generateDreamInterpretationPrompt(dreamText), 10000, 1000);
    const parsed = parseDreamSections(content);
    // ★ 이전 풀이 모달 리스트 라벨 — 꿈 텍스트 첫 8자 + ellipsis (날짜 다 보이게 짧게)
    const dreamLabel = dreamText.trim().length > 8 ? `${dreamText.trim().slice(0, 8)}…` : dreamText.trim();
    archiveSaju({ profileId, category: 'dream', engineResult: { dreamText, categoryLabel: dreamLabel } as Record<string, unknown>, interpretation: content, creditType: 'moon', creditUsed: 1 });
    return {
      success: true,
      content,
      sections: {
        diagnosis: parsed.diagnosis,
        symbols: parsed.symbols,
        oriental: parsed.oriental,
        western: parsed.western,
        advice: parsed.advice,
        caution: parsed.caution,
      },
    };
  } catch (e: any) { return { success: false, error: e.message }; }
};
