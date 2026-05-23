'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';
import { useCreditStore } from '../store/useCreditStore';
import { useReportCacheStore, sajuKey } from '../store/useReportCacheStore';
import { sajuDB, supabase } from '../services/supabase';
import { useFortuneJob } from '../hooks/useFortuneJob';
import { BackButton } from '../components/ui/BackButton';
import { SUN_COST_BIG, CHARGE_REASONS } from '../constants/creditCosts';
import { extractMetaphor } from '../utils/parseMetaphor';
import { renderEmphasis } from '../utils/renderEmphasis';
import { SectionCollapsible } from '../components/saju/SectionCollapsible';
import { renderGunghapSectionVisual } from '../components/saju/GunghapSectionVisuals';
import { computeSajuFromProfile } from '../utils/profileSaju';
import type { BirthProfile } from '../types/credit';
import {
  SYSTEM_PROMPT,
  generateLoverGunghapPrompt,
  generateFriendGunghapPrompt,
  generateFamilyGunghapPrompt,
  generateWorkGunghapPrompt,
  generateGeneralGunghapPrompt,
  generateSomGunghapPrompt,
  generateSpouseGunghapPrompt,
  generateExRelationGunghapPrompt,
  generateBusinessGunghapPrompt,
  generateSecretCrushGunghapPrompt,
  generateSoulmateGunghapPrompt,
  generateRivalGunghapPrompt,
  generateMentorGunghapPrompt,
  generatePetGunghapPrompt,
  PET_SPECIES_VIBE,
  PET_PERSONALITY_OPTIONS,
  type PetSpecies,
  type PetInput,
  injectRoleContext,
  generateCustomDynamicGunghapPrompt,
  type GunghapCategory,
  type RelationClassification,
} from '../constants/prompts';
import { sanitizeAIOutput } from '../services/fortuneService';
import { archiveSaju, findGunghapArchives, type GunghapArchiveItem } from '../services/archiveService';
import Link from 'next/link';
import { AILoadingBar } from '../components/AILoadingBar';
import { useLoadingGuard } from '../hooks/useLoadingGuard';
import type { SajuResult } from '../utils/sajuCalculator';
import { STEM_TO_HANJA, ZHI_TO_HANJA, STEM_TO_ELEMENT, ELEMENT_CELL_COLORS, type Element } from '../lib/character';
import { ShareBar } from '@/components/share/ShareBar';
import { ResultFooterActions } from '@/components/ui/ResultFooterActions';
import { RadarChart, type RadarDomain } from '../components/charts/RadarChart';
import { RelationTimelineChart } from '../components/charts/RelationTimelineChart';
import {
  GRADE_COLOR, GUNGHAP_DOMAINS as SHARED_GUNGHAP_DOMAINS,
  scoreToGrade, parseGunghapHeader,
  type GunghapDomainKey, type GunghapDomainScores, type GunghapTimelinePoint,
} from '@/lib/gunghap';
import { ScoreRing, DomainBar } from '@/components/gunghap/GunghapResultBlock';
import { useScrollToTopOnLoad } from '../hooks/useScrollToTopOnLoad';

// ──────────────────────────────────────────────
// 카테고리 그룹 정의
// ──────────────────────────────────────────────
type CategoryItem = {
  id: GunghapCategory;
  label: string;
  desc: string;
  icon: string;
  accent: string;
};

type CategoryGroup = {
  groupLabel: string;
  groupColor: string;
  items: CategoryItem[];
};

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    groupLabel: '연애',
    groupColor: 'text-rose-400',
    items: [
      { id: 'secret_crush', label: '짝사랑', desc: '혼자만 마음이 있는 상대', icon: '✦', accent: 'from-rose-600/30 to-pink-500/15' },
      { id: 'som', label: '썸남·썸녀', desc: '아직 고백 전, 설레는 감정', icon: '♡', accent: 'from-rose-500/25 to-pink-400/15' },
      { id: 'lover', label: '연인', desc: '사귀는 남자친구·여자친구', icon: '♡', accent: 'from-pink-500/25 to-rose-400/15' },
      { id: 'spouse', label: '배우자', desc: '함께 사는 남편·아내', icon: '◎', accent: 'from-rose-400/25 to-amber-400/15' },
      { id: 'ex_lover', label: 'X여친·X남친', desc: '헤어진 연인', icon: '◇', accent: 'from-slate-500/25 to-rose-500/15' },
      { id: 'ex_spouse', label: 'X남편·X아내', desc: '이혼한 배우자', icon: '◇', accent: 'from-slate-500/25 to-violet-500/15' },
    ],
  },
  {
    groupLabel: '특별한 인연',
    groupColor: 'text-violet-400',
    items: [
      { id: 'soulmate', label: '소울메이트', desc: '설명 못하는 특별한 연결감', icon: '◉', accent: 'from-violet-500/30 to-indigo-400/15' },
      { id: 'rival', label: '라이벌', desc: '경쟁하며 서로 자극하는 관계', icon: '▲', accent: 'from-orange-500/25 to-amber-400/15' },
      { id: 'mentor', label: '멘토·멘티', desc: '성장과 배움의 파트너십', icon: '◆', accent: 'from-teal-500/25 to-emerald-400/15' },
    ],
  },
  {
    groupLabel: '인간관계',
    groupColor: 'text-blue-400',
    items: [
      { id: 'friend', label: '친구', desc: '가까운 벗, 오랜 친구', icon: '★', accent: 'from-amber-500/25 to-yellow-400/15' },
      { id: 'parent_child', label: '부모와 자녀', desc: '세대를 잇는 혈연 관계', icon: '▲', accent: 'from-teal-500/25 to-emerald-400/15' },
      { id: 'sibling', label: '형제·자매', desc: '같은 뿌리의 형제자매', icon: '▲', accent: 'from-green-500/25 to-teal-400/15' },
      { id: 'work', label: '직장 동료', desc: '함께 일하는 동료·상사', icon: '▲', accent: 'from-blue-500/25 to-indigo-400/15' },
      { id: 'business', label: '사업 파트너', desc: '공동 창업·사업 파트너', icon: '◆', accent: 'from-indigo-500/25 to-blue-400/15' },
    ],
  },
  {
    groupLabel: '재미로 보기',
    groupColor: 'text-amber-400',
    items: [
      { id: 'idol_fan', label: '유명인과의 궁합', desc: '유명인과의 사주 인연', icon: '★', accent: 'from-yellow-500/25 to-amber-400/15' },
      { id: 'pet', label: '나와 반려동물', desc: '나와 애완동물', icon: '◆', accent: 'from-amber-500/25 to-orange-400/15' },
      { id: 'custom', label: '직접 입력', desc: '원하는 관계를 직접 입력', icon: '✎', accent: 'from-purple-500/25 to-violet-400/15' },
    ],
  },
];

const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap(g => g.items);

type ResolvedCategory = 'lover' | 'friend' | 'parent_child' | 'sibling' | 'work' | 'business' | 'spouse' | 'rival' | 'mentor' | 'som' | null;

function resolveCustomCategory(label: string): ResolvedCategory {
  const t = label.trim().toLowerCase();
  const KEYWORD_MAP: [string[], ResolvedCategory][] = [
    [['연인', '남친', '여친', '남자친구', '여자친구', '애인', '사귀', '커플'], 'lover'],
    [['썸', '좋아하는', '관심있는', '호감'], 'som'],
    [['배우자', '남편', '아내', '부부', '결혼'], 'spouse'],
    [['친구', '벗', '동창', '절친', '베프', '단짝'], 'friend'],
    [['부모', '엄마', '아빠', '아버지', '어머니', '자녀', '아들', '딸', '부녀', '부자', '모녀', '모자'], 'parent_child'],
    [['형제', '자매', '오빠', '언니', '동생', '누나', '형'], 'sibling'],
    [['직장', '동료', '상사', '부하', '팀원', '팀장', '회사'], 'work'],
    [['사업', '파트너', '공동대표', '동업', '창업', '공동창업'], 'business'],
    [['라이벌', '경쟁', '적수', '맞수'], 'rival'],
    [['멘토', '멘티', '스승', '제자', '선생', '선배', '후배'], 'mentor'],
  ];
  for (const [keywords, cat] of KEYWORD_MAP) {
    if (keywords.some(kw => t.includes(kw))) return cat;
  }
  return null;
}

// ──────────────────────────────────────────────
// 반려동물 입력 기본값
const defaultPet: PetInput = {
  name: '',
  species: 'dog',
  gender: 'unknown',
  personalityKeywords: [],
  birthDate: '',
  adoptionDate: '',
};

type Step = 'category' | 'input' | 'result';

const STEP_LABELS: Record<string, string> = {
  category: '관계 선택',
  input: '상대 정보',
  result: '결과',
};

const CATEGORY_LABEL_MAP: Record<string, string> = {
  secret_crush: '짝사랑',
  som: '썸남·썸녀',
  lover: '연인',
  spouse: '배우자',
  ex_lover: 'X여친·X남친',
  ex_spouse: 'X남편·X아내',
  soulmate: '소울메이트',
  rival: '라이벌',
  mentor: '멘토·멘티',
  friend: '친구',
  parent_child: '부모와 자녀',
  sibling: '형제·자매',
  work: '직장 동료',
  business: '사업 파트너',
  idol_fan: '유명인과의 궁합',
  pet: '반려동물',
  custom: '직접 입력',
};

const AUTO_ROLES: Record<string, [string, string]> = {
  secret_crush: ['나', '짝사랑 상대'],
  som: ['나', '썸 상대'],
  lover: ['남자친구', '여자친구'],
  spouse: ['남편', '아내'],
  ex_lover: ['나', '전 연인'],
  ex_spouse: ['나', '전 배우자'],
  soulmate: ['나', '소울메이트'],
  rival: ['나', '라이벌'],
  mentor: ['멘티', '멘토'],
  friend: ['나', '친구'],
  parent_child: ['부모', '자녀'],
  sibling: ['나', '형제·자매'],
  work: ['나', '동료'],
  business: ['나', '사업 파트너'],
  idol_fan: ['팬', '유명인'],
  pet: ['나', '반려동물'],
  custom: ['나', '상대'],
};

// 궁합 영역별 점수 5개 도메인 — 공유 모듈 alias
const GUNGHAP_DOMAINS = SHARED_GUNGHAP_DOMAINS;

// 관계 추이 그래프를 노출할 카테고리 — 연애 관계 4종.
// (전 연인·가족·친구·동료·반려동물 등은 "관계 연차" 흐름이 부적절해 제외)
const TIMELINE_CATEGORIES: GunghapCategory[] = ['secret_crush', 'som', 'lover', 'spouse'];

// 프롬프트에 은유 제목+점수+영역별 점수(+관계 추이) 요청 래퍼 추가
function wrapWithTitleScore(prompt: string, includeTimeline = false): string {
  const timelineBlock = includeTimeline
    ? `

셋째 줄 (관계 추이 — 시간이 흐름에 따른 궁합 점수):
[gunghap_timeline] 만남:점수 | 6개월:점수 | 1년차:점수 | 2년차:점수 | 3년차:점수 | 5년차:점수 [/gunghap_timeline]

추이 규칙:
- 라벨 6개(만남·6개월·1년차·2년차·3년차·5년차)를 그대로 사용하고 각 시점의 점수만 산출
- 두 사주의 대운·세운 흐름과 합충 변화를 근거로 시점별 점수를 다르게 산출 (전부 비슷하면 안 됨, 기복이 드러나야 함)
- 점수는 45~98 사이 정수`
    : '';
  const timelineExample = includeTimeline
    ? `\n[gunghap_timeline] 만남:72 | 6개월:80 | 1년차:86 | 2년차:74 | 3년차:88 | 5년차:91 [/gunghap_timeline]`
    : '';
  const lineLabel = includeTimeline ? '응답의 가장 첫 줄·둘째 줄·셋째 줄' : '응답의 가장 첫 줄과 둘째 줄';
  const bodyStart = includeTimeline ? '- 이 세 줄 다음부터 본문 시작' : '- 이 두 줄 다음부터 본문 시작';
  return prompt + `

★★★ 응답 시작 형식 — 반드시 준수 ★★★
${lineLabel}에 아래 형식을 정확히 지켜 출력하세요:

첫째 줄:
[gunghap_header] 은유적 한 줄 제목 | 점수(0~100 정수) [/gunghap_header]

둘째 줄 (영역별 세부 점수):
[gunghap_scores] 정서교감:점수 | 소통이해:점수 | 가치관:점수 | 성장발전:점수 | 갈등해소:점수 [/gunghap_scores]${timelineBlock}

예시:
[gunghap_header] 서로의 영혼을 비추는 거울 같은 만남 | 88 [/gunghap_header]
[gunghap_scores] 정서교감:92 | 소통이해:85 | 가치관:78 | 성장발전:90 | 갈등해소:72 [/gunghap_scores]${timelineExample}

규칙:
- 제목은 두 사주의 일간 오행 관계를 은유로 표현 (20~50자)
- 종합 점수는 두 사주의 합충·오행 조화·십성 궁합을 종합한 0~100 정수
- 영역별 점수 5개도 각각 0~100 정수로 산출 (두 사주 관계를 명리적으로 평가)
${bodyStart}
`;
}

// ──────────────────────────────────────────────
// GPT 호출 (55초 타임아웃 + 빈 응답·잘림 방어)
// ──────────────────────────────────────────────
// 궁합 프롬프트별 본문 분량(2,000~2,600자, 8섹션이 가장 김)을 안전하게 수용:
// 한국어 1자 ≈ 1.5~2 토큰 → 2,600자 ≈ 4,000~5,200 토큰. 보수적으로 4,500.
async function callGunghapGPT(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55_000);
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, maxTokens: 6000, systemPrompt: SYSTEM_PROMPT }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '분석 실패');
    if (!data.content || typeof data.content !== 'string') {
      throw new Error('응답이 비어 있어요. 잠시 후 다시 시도해주세요.');
    }
    if (data.truncated === true) {
      console.warn('[Gunghap] truncated response — bump maxTokens', { len: data.content.length });
      throw new Error('응답이 길어서 일부 잘렸어요. 잠시 후 다시 시도해주세요.');
    }
    const sanitized = sanitizeAIOutput(data.content);
    // 궁합 본문은 최소 700자 이상이어야 정상 (가장 짧은 ex 카테고리 1,000자 기준의 70%)
    if (sanitized.length < 700) {
      console.warn('[Gunghap] too-short response — likely refusal/garbage', { len: sanitized.length, snippet: sanitized.slice(0, 80) });
      throw new Error('풀이 결과가 비정상적으로 짧아요. 잠시 후 다시 시도해주세요.');
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
}

// ──────────────────────────────────────────────
// 컴포넌트
// ──────────────────────────────────────────────
export default function GunghapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlRecordId = searchParams?.get('recordId') ?? null;
  const urlJobId = searchParams?.get('jobId') ?? null;
  const { user } = useUserStore();
  const { profiles } = useProfileStore();

  // 내부 recordId — URL 파라미터 또는 랜딩에서 클릭한 결과
  const [activeRecordId, setActiveRecordId] = useState<string | null>(urlRecordId);
  const isArchiveMode = !!activeRecordId;

  // 백그라운드 잡 시스템 — ?jobId 진입 또는 새 잡 생성 후 setCreatedJobId.
  // 정통사주(SajuResultPage)와 동일 패턴. useFortuneJob 으로 saju_records Realtime 구독.
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const effectiveJobId = urlJobId ?? createdJobId;
  const { job: fortuneJob } = useFortuneJob(effectiveJobId);

  const [step, setStep] = useState<Step>(urlRecordId || urlJobId ? 'result' : 'category');
  const [category, setCategory] = useState<GunghapCategory>('lover');
  const [customLabel, setCustomLabel] = useState('');
  // 직접 입력 관계 — 1차 분류 API 결과 (null = 미분류·폴백)
  const [classifiedRelation, setClassifiedRelation] = useState<RelationClassification | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [classifyError, setClassifyError] = useState('');
  const [myRole, setMyRole] = useState('');
  const [otherRole, setOtherRole] = useState('');
  const [roleSwapped, setRoleSwapped] = useState(false);
  const [myProfileId, setMyProfileId] = useState<string>('');
  const [pet, setPet] = useState<PetInput>(defaultPet);
  // 상대방은 본인과 동일한 흐름 — 등록 birth_profiles 에서 선택.
  // 새 사람을 보고 싶으면 '새 프로필 추가' 로 birth_profile 만들어 와서 선택.
  const [otherProfileId, setOtherProfileId] = useState<string>('');
  // archiveModalIsEntry 제거: 페이지 진입 시에만 자동 모달 → close 는 무조건 history.back.
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  // 결과 준비 완료 시 스크롤 최상단
  useScrollToTopOnLoad(!!result && !loading);
  const [mySajuResult, setMySajuResult] = useState<SajuResult | null>(null);
  const [otherSajuResult, setOtherSajuResult] = useState<SajuResult | null>(null);
  const [gunghapTitle, setGunghapTitle] = useState('');
  const [gunghapScore, setGunghapScore] = useState<number | null>(null);
  const [gunghapDomainScores, setGunghapDomainScores] = useState<GunghapDomainScores>({});
  const [gunghapTimeline, setGunghapTimeline] = useState<GunghapTimelinePoint[]>([]);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);

  // 보관함 재생 시 record에서 가져온 메타 정보
  const [archiveMeta, setArchiveMeta] = useState<{
    categoryLabel: string;
    profileName: string;
    partnerName: string;
    myRole: string;
    otherRole: string;
  } | null>(null);

  // 기존 궁합 결과 목록
  const [archiveList, setArchiveList] = useState<GunghapArchiveItem[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);
  // 이전 궁합 결과 리스트 모달 — 택일·지정일과 동일 UX. 진입 시 기록 있으면 표시.
  const [showArchiveList, setShowArchiveList] = useState(false);
  // 진입 모달은 페이지 첫 진입 시 자동 노출 — 닫으면 무조건 홈으로.
  // (재진입 트리거가 사라지면서 archiveModalIsEntry state 도 제거 — 모든 close = 홈 복귀)
  // 모달이 '진입 모달'인지(true) 카테고리 화면에서 다시 연 것인지(false) 구분.
  // 진입 모달을 취소하면 궁합 화면이 아니라 직전 화면(홈)으로 돌아가야 한다.
  const [forceNewReading, setForceNewReading] = useState(false);

  // ── 로딩 안전장치: 70초 초과 시 강제 해제 ──
  const [loadingTimedOut] = useLoadingGuard(loading, 70_000);
  useEffect(() => {
    if (loadingTimedOut) {
      setLoading(false);
      if (!result) setError('응답이 너무 오래 걸려요. 새로고침 후 다시 시도해주세요.');
    }
  }, [loadingTimedOut, result]);

  const primaryProfile = useMemo(() => profiles.find(p => p.is_primary) ?? profiles[0] ?? null, [profiles]);
  const selectedProfile = useMemo(
    () => profiles.find(p => p.id === myProfileId) ?? primaryProfile,
    [profiles, myProfileId, primaryProfile],
  );
  const selectedCat = ALL_CATEGORIES.find(c => c.id === category)!;

  // 상대 후보 = 내 기준 프로필을 제외한 나머지 내 등록 프로필
  const otherProfileChoices = useMemo(
    () => profiles.filter(p => p.id !== selectedProfile?.id),
    [profiles, selectedProfile],
  );
  const selectedOtherProfile = useMemo(
    () => otherProfileChoices.find(p => p.id === otherProfileId) ?? null,
    [otherProfileChoices, otherProfileId],
  );

  // 내 프로필이 변경되어 상대로 선택했던 프로필이 더 이상 후보에 없어졌으면 초기화.
  useEffect(() => {
    if (otherProfileId && !otherProfileChoices.some(p => p.id === otherProfileId)) {
      setOtherProfileId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherProfileChoices.length, selectedProfile?.id]);

  // 단계형 페이지 — native back/스와이프 가 step 단위로 동작하도록 history entry 추가.
  // step='input' 진입 시 가짜 entry 를 push → native back 발생하면 popstate 로 category 복귀.
  // (UI BackButton 은 handleGunghapBack 으로 별도 처리)
  useEffect(() => {
    if (step !== 'input' || typeof window === 'undefined') return;
    window.history.pushState({ gunghapStep: 'input' }, '');
    const onPop = () => setStep('category');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [step]);

  const isPetCategory = category === 'pet';

  const SWAPPABLE_CATEGORIES = ['parent_child', 'mentor', 'idol_fan'];

  // 카테고리 선택 시 자동 역할 결정 (swap 반영)
  useEffect(() => {
    const roles = AUTO_ROLES[category];
    if (roles) {
      if (roleSwapped && SWAPPABLE_CATEGORIES.includes(category)) {
        setMyRole(roles[1]);
        setOtherRole(roles[0]);
      } else {
        setMyRole(roles[0]);
        setOtherRole(roles[1]);
      }
    }
  }, [category, roleSwapped]);

  // 카테고리가 custom 이 아니게 바뀌면 분류 상태 초기화
  useEffect(() => {
    if (category !== 'custom') {
      setClassifiedRelation(null);
      setClassifyError('');
    }
  }, [category]);

  // ── 잡 결과 → state 동기화 ──
  // useFortuneJob 으로 받은 saju_records row 의 모든 정보를 GunghapPage state 에 매핑.
  // archive 모드(?recordId) 는 별도 useEffect (sajuDB.getRecordById 직접 호출).
  useEffect(() => {
    if (isArchiveMode) return;
    if (!fortuneJob) return;

    // ── 두 사람 정보·사주 복원 (status 무관, 진행 중에도 표시) ──
    // 보관함에서 진행 중 잡(?jobId)으로 진입했을 때도 상대 이름·역할·사주가 즉시 보이게.
    if (fortuneJob.partnerName || fortuneJob.profileName) {
      const eng = fortuneJob.engineResult ?? {};
      const cat = (eng.gunghapCategory as string) ?? '';
      const customLbl = (eng.customLabel as string) ?? '';
      setArchiveMeta({
        categoryLabel: customLbl || CATEGORY_LABEL_MAP[cat] || cat || '궁합',
        profileName: fortuneJob.profileName ?? '나',
        partnerName:
          fortuneJob.partnerName
          || (fortuneJob.partnerBirthDate ? fortuneJob.partnerBirthDate.replace(/-/g, '.') : '상대'),
        myRole: (eng.myRole as string) ?? '',
        otherRole: (eng.otherRole as string) ?? '',
      });

      if (cat !== 'pet' && fortuneJob.birthDate && fortuneJob.gender && fortuneJob.calendarType) {
        try {
          const myBirth: BirthProfile = {
            id: 'job_me', user_id: '', name: fortuneJob.profileName ?? '나',
            birth_date: fortuneJob.birthDate,
            birth_time: fortuneJob.birthTime ?? undefined,
            birth_place: fortuneJob.birthPlace ?? 'seoul',
            gender: fortuneJob.gender,
            calendar_type: fortuneJob.calendarType,
            is_primary: false, created_at: '', updated_at: '',
          };
          const myCalc = computeSajuFromProfile(myBirth);
          if (myCalc) setMySajuResult(myCalc);

          if (fortuneJob.partnerBirthDate) {
            const partnerGender = (eng.partnerGender as string)
              || (fortuneJob.gender === 'male' ? 'female' : 'male');
            const otherBirth: BirthProfile = {
              id: 'job_other', user_id: '',
              name: fortuneJob.partnerName || fortuneJob.partnerBirthDate.replace(/-/g, '.'),
              birth_date: fortuneJob.partnerBirthDate,
              birth_time: (eng.partnerBirthTime as string) ?? undefined,
              birth_place: 'seoul',
              gender: partnerGender as 'male' | 'female',
              calendar_type: (eng.partnerCalendarType as 'solar' | 'lunar') ?? 'solar',
              is_primary: false, created_at: '', updated_at: '',
            };
            const otherCalc = computeSajuFromProfile(otherBirth);
            if (otherCalc) setOtherSajuResult(otherCalc);
          }
        } catch { /* 사주 복원 실패 시 표 없이 본문만 표시 */ }
      }
    }

    // ── status 별 분기 ──
    if (fortuneJob.status === 'done') {
      const content = fortuneJob.interpretationDetailed ?? '';
      const { title, score, domainScores, timeline, body } = parseGunghapHeader(content);
      setResult(body);
      setGunghapTitle(title);
      setGunghapScore(score);
      setGunghapDomainScores(domainScores);
      setGunghapTimeline(timeline);
      setSavedRecordId(fortuneJob.jobId);
      setStep('result');
      setLoading(false);
    } else if (fortuneJob.status === 'failed') {
      setError(fortuneJob.errorMessage ?? '풀이 생성에 실패했어요. 크레딧은 자동 환불됐어요.');
      setLoading(false);
    } else {
      // pending/processing — 진행 중. 옛 state reset 으로 '0.1초 결과 번쩍' 차단.
      // (이전 풀이 결과가 result state 에 남아있으면 setStep('result') 직후 잠깐 보임)
      setResult('');
      setGunghapTitle('');
      setGunghapScore(null);
      setGunghapDomainScores({});
      setGunghapTimeline([]);
      setStep('result');
      setLoading(true);
    }
  }, [
    fortuneJob?.status,
    fortuneJob?.interpretationDetailed,
    fortuneJob?.errorMessage,
    fortuneJob?.jobId,
    fortuneJob?.partnerName,
    fortuneJob?.partnerBirthDate,
    fortuneJob?.profileName,
    fortuneJob?.birthDate,
    fortuneJob?.birthTime,
    fortuneJob?.birthPlace,
    fortuneJob?.gender,
    fortuneJob?.calendarType,
    fortuneJob?.engineResult,
    isArchiveMode,
  ]);

  // ── 보관함 재생 모드 — activeRecordId 가 있으면 DB 에서 풀이 텍스트 + 메타 + 사주 복원 ──
  useEffect(() => {
    if (!activeRecordId) return;
    const recordId = activeRecordId;
    let cancelled = false;
    sajuDB.getRecordById(recordId)
      .then((record) => {
        if (cancelled || !record) return;
        const content = record.interpretation_detailed ?? record.interpretation_basic ?? '';
        if (content) {
          const { title, score, domainScores, timeline, body } = parseGunghapHeader(content);
          setResult(body);
          setGunghapTitle(title);
          setGunghapScore(score);
          setGunghapDomainScores(domainScores);
          setGunghapTimeline(timeline);
          setStep('result');

          const eng = record.engine_result as Record<string, unknown> | undefined;
          const cat = (eng?.gunghapCategory as string) ?? '';
          const customLbl = (eng?.customLabel as string) ?? '';
          // 옛날 레코드는 partner_name 이 NULL 일 수 있음 — 생일이라도 보여 두 사람 식별 유지
          const partnerLabel = record.partner_name
            || (record.partner_birth_date ? record.partner_birth_date.replace(/-/g, '.') : '상대');
          setArchiveMeta({
            categoryLabel: customLbl || CATEGORY_LABEL_MAP[cat] || cat || '궁합',
            profileName: record.profile_name ?? '나',
            partnerName: partnerLabel,
            myRole: (eng?.myRole as string) ?? '',
            otherRole: (eng?.otherRole as string) ?? '',
          });

          // 사주 데이터 복원 — 나와 상대 사주표를 보여주기 위해 재계산
          if (cat !== 'pet') {
            try {
              const myBirth: BirthProfile = {
                id: 'archive_me', user_id: '', name: record.profile_name ?? '나',
                birth_date: record.birth_date, birth_time: record.birth_time ?? undefined,
                birth_place: record.birth_place ?? 'seoul',
                gender: record.gender, calendar_type: record.calendar_type,
                is_primary: false, created_at: '', updated_at: '',
              };
              const myCalc = computeSajuFromProfile(myBirth);
              if (myCalc) setMySajuResult(myCalc);

              if (record.partner_birth_date) {
                const partnerGender = (eng?.partnerGender as string) || (record.gender === 'male' ? 'female' : 'male');
                const otherBirth: BirthProfile = {
                  id: 'archive_other', user_id: '', name: record.partner_name || record.partner_birth_date.replace(/-/g, '.'),
                  birth_date: record.partner_birth_date,
                  birth_time: (eng?.partnerBirthTime as string) ?? undefined,
                  birth_place: 'seoul',
                  gender: partnerGender as 'male' | 'female',
                  calendar_type: (eng?.partnerCalendarType as 'solar' | 'lunar') ?? 'solar',
                  is_primary: false, created_at: '', updated_at: '',
                };
                const otherCalc = computeSajuFromProfile(otherBirth);
                if (otherCalc) setOtherSajuResult(otherCalc);
              }
            } catch { /* 사주 복원 실패 시 표 없이 본문만 표시 */ }
          }
        } else {
          setError('보관된 풀이 본문이 없어요.');
        }
      })
      .catch((e) => {
        console.error('[archive replay] gunghap load failed', e);
        if (!cancelled) setError('보관된 풀이를 불러오지 못했어요.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeRecordId]);

  // ── 궁합 기존 결과 목록 로딩 — landing 진입 시마다 재조회 ──
  // 진입 시 이전 궁합 결과를 1회 fetch — 기록이 있으면 리스트 모달을 띄운다.
  // (택일·지정일과 동일 UX — landing 화면 대신 모달)
  useEffect(() => {
    if (isArchiveMode) { setArchiveLoading(false); return; }
    let cancelled = false;
    setArchiveLoading(true);
    findGunghapArchives(20).then(list => {
      if (cancelled) return;
      setArchiveList(list);
      // 진입 모달은 '진짜 첫 진입'(카테고리 스텝·jobId 없음)에서만 자동 표시.
      // ?jobId 결과 화면 위에 모달이 덮이지 않도록 차단.
      if (list.length > 0 && step === 'category' && !urlJobId) {
        setShowArchiveList(true);
      }
    }).catch(() => {}).finally(() => {
      if (!cancelled) setArchiveLoading(false);
    });
    return () => { cancelled = true; };
    // step·urlJobId 는 진입(마운트) 시점 값으로 판정 — deps 에 넣지 않음.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isArchiveMode]);

  // 궁합 메인(landing)에 머무는 동안 백그라운드 잡이 완료되면 이전 결과 목록을 자동 갱신.
  // findGunghapArchives 는 status=done 만 반환하므로, 잡이 done 으로 UPDATE 되는 순간 재fetch 하면
  // 그때 목록에 새 결과가 등장한다.
  useEffect(() => {
    if (isArchiveMode || step !== 'category' || !user) return;
    const ch = supabase
      .channel(`gunghap-archive:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'saju_records', filter: `user_id=eq.${user.id}` },
        () => {
          findGunghapArchives(20).then(setArchiveList).catch(() => {});
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [isArchiveMode, step, user]);

  const otherDisplayName = isPetCategory
    ? pet.name.trim()
    : (selectedOtherProfile?.name ?? '');

  const isOtherValid = isPetCategory
    ? !!pet.name.trim()
    : !!selectedOtherProfile;

  const getCategoryDisplayLabel = () => {
    if (category === 'custom' && customLabel.trim()) return customLabel.trim();
    return selectedCat?.label ?? '';
  };

  // STEP 1 → STEP 2 진행. custom 이면 먼저 관계 분류 API 를 1차 호출한다.
  // 분류 실패·타임아웃 시엔 null 로 두고 진행 → handleAnalyze 가 키워드 매칭으로 폴백.
  const handleCategoryNext = async () => {
    if (category !== 'custom') {
      setStep('input');
      return;
    }
    const label = customLabel.trim();
    if (!label) return;
    // 이미 같은 라벨을 분류해 둔 경우 재호출 생략
    if (classifiedRelation) {
      setStep('input');
      return;
    }
    setClassifying(true);
    setClassifyError('');
    try {
      const res = await fetch('/api/gunghap/classify-relation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      if (res.ok) {
        const data: RelationClassification = await res.json();
        if (!data.valid) {
          setClassifyError('관계를 알아볼 수 있게 입력해 주세요. 예: 전생의 연인, 오래된 친구');
          setClassifying(false);
          return;
        }
        setClassifiedRelation(data);
      }
      // res 가 ok 가 아니면 classifiedRelation 은 null 유지 → 키워드 매칭 폴백
    } catch {
      // 네트워크 실패 — 폴백으로 진행
    }
    setClassifying(false);
    setStep('input');
  };

  // ── 백그라운드 잡 생성 헬퍼 ──
  // POST /api/fortune/jobs/create → jobId 받음 → URL ?jobId 로 replace.
  // 이후 useFortuneJob 이 saju_records Realtime 구독, 결과 도착 시 동기화 useEffect 가 setResult.
  const createGunghapJob = async (input: {
    prompt: string;
    sajuResult: SajuResult;
    profileId: string;
    sourceBirth: {
      birthDate: string;
      birthTime: string | null;
      birthPlace: string | null;
      gender: 'male' | 'female';
      calendarType: 'solar' | 'lunar';
    };
    /** 본인 프로필명 — 사주표 라벨에 "나" 대신 표시 */
    profileName: string;
    partnerName: string;
    partnerBirthDate: string | null;
    engineResult: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<void> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error('로그인이 만료됐어요. 다시 로그인해주세요.');
    }
    const res = await fetch('/api/fortune/jobs/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        category: 'gunghap',
        prompt: input.prompt,
        sajuResult: input.sajuResult,
        profileId: input.profileId,
        profileName: input.profileName,
        sourceBirth: input.sourceBirth,
        partnerName: input.partnerName,
        partnerBirthDate: input.partnerBirthDate,
        engineResult: input.engineResult,
        idempotencyKey: input.idempotencyKey,
      }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || '풀이 요청에 실패했어요.');
    }
    const { jobId } = (await res.json()) as { jobId: string; deduplicated?: boolean };
    // URL ?jobId 로 replace — 새로고침·재진입 시 같은 잡 재구독.
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('jobId', jobId);
    window.history.replaceState(null, '', newUrl.toString());

    // React 18 automatic batching — 같은 동기 흐름의 setState 들이 한 렌더에 처리됨.
    // 옛 state(이전 풀이 result/title 등) 잔재가 setStep('result') 직후 잠깐 보이는
    // '0.1초 결과 번쩍' 현상 차단.
    setResult('');
    setError('');
    setGunghapTitle('');
    setGunghapScore(null);
    setGunghapDomainScores({});
    setGunghapTimeline([]);
    setMySajuResult(null);
    setOtherSajuResult(null);
    setSavedRecordId(null);
    setCreatedJobId(jobId);
    setStep('result');
    setLoading(true);
    // 이후 잡 결과 동기화 useEffect 가 알아서 status 별 분기:
    //   processing → 로딩 화면 + partner/saju 정보 채우기 (보관함 진입 케이스 포함)
    //   done       → setResult + parseGunghapHeader + setGunghapTitle/Score/Domain
    //   failed     → setError + 자동 환불 안내
  };

  const handleAnalyze = async () => {
    if (!selectedProfile || !isOtherValid) return;
    setLoading(true);
    setError('');
    // catch 단계에서 negative cache 에 저장할 키. pet/normal 분기 어디서 실패했는지 추적.
    let activeCacheKey: string | null = null;
    // 잡이 생성된 경우 finally 의 setLoading(false) skip — loading state 관리 책임은
    // 잡 동기화 useEffect 가 가짐 (status='done'/'failed' 도착 시 false). finally 가
    // setLoading(false) 호출하면 잡 결과 도착 직전에 빈 결과 화면이 0.1~1초 깜빡임.
    let jobCreated = false;
    try {
      const myResult = computeSajuFromProfile(selectedProfile);
      if (!myResult) throw new Error('내 사주 계산 실패');
      setMySajuResult(myResult);

      // ── 반려동물 전용 분기 (사주 없이 주인 사주 + 동물 상징 기운으로 해석) ──
      if (isPetCategory) {
        const petTrimmed: PetInput = {
          ...pet,
          name: pet.name.trim(),
          birthDate: pet.birthDate || undefined,
          adoptionDate: pet.adoptionDate || undefined,
        };
        const petCacheKey = [
          sajuKey(myResult),
          'pet',
          petTrimmed.species,
          petTrimmed.gender,
          petTrimmed.name,
          petTrimmed.personalityKeywords.slice().sort().join(','),
          petTrimmed.birthDate ?? '_',
          petTrimmed.adoptionDate ?? '_',
        ].join('|');
        if (!forceNewReading) {
          const petCached = useReportCacheStore.getState().getReport<string>('gunghap', petCacheKey);
          if (petCached?.error) {
            setError(petCached.error);
            setLoading(false);
            return;
          }
          if (petCached?.data) {
            setResult(petCached.data);
            setStep('result');
            setLoading(false);
            return;
          }
        }
        setForceNewReading(false);
        activeCacheKey = petCacheKey;
        const petPrompt = generatePetGunghapPrompt(myResult, selectedProfile.name, petTrimmed);
        // 백그라운드 잡 생성 — 차감·INSERT·archive 모두 서버에서 처리. 클라는 jobId 만 받고 빠짐.
        // jobCreated=true 로 finally 의 setLoading(false) skip → 잡 동기화 useEffect 가 책임.
        jobCreated = true;
        const minuteBucket = Math.floor(Date.now() / 60000);
        await createGunghapJob({
          prompt: petPrompt,
          sajuResult: myResult,
          profileId: selectedProfile.id,
          profileName: selectedProfile.name,
          sourceBirth: {
            birthDate: selectedProfile.birth_date,
            birthTime: selectedProfile.birth_time ?? null,
            birthPlace: selectedProfile.birth_place ?? null,
            gender: selectedProfile.gender,
            calendarType: selectedProfile.calendar_type,
          },
          partnerName: petTrimmed.name || '반려동물',
          partnerBirthDate: petTrimmed.birthDate ?? null,
          engineResult: {
            gunghapCategory: 'pet',
            pet: petTrimmed,
            myRole: myRole.trim(),
            otherRole: otherRole.trim(),
          },
          idempotencyKey: `${petCacheKey}:${minuteBucket}`,
        });
        return;
      }

      // 상대 사주 계산 — 등록 birth_profiles 에서 선택한 프로필만 사용 (manual 폐지).
      // isOtherValid 가 selectedOtherProfile 의 truthy 를 보장.
      const otherBase: BirthProfile = selectedOtherProfile!;
      const otherResult = computeSajuFromProfile(otherBase);
      if (!otherResult) throw new Error('상대방 사주 계산 실패');
      setOtherSajuResult(otherResult);

      // 캐시 키 — 두 사주 + 카테고리 + 역할 + custom 라벨까지 포함해야 결과가 달라질 때 새로 호출
      const cacheKey = [
        sajuKey(myResult),
        sajuKey(otherResult),
        category,
        myRole || '_',
        otherRole || '_',
        category === 'custom' ? customLabel.trim() : '_',
      ].join('|');

      if (!forceNewReading) {
        const cached = useReportCacheStore.getState().getReport<string>('gunghap', cacheKey);
        if (cached?.error) {
          setError(cached.error);
          setLoading(false);
          return;
        }
        if (cached?.data) {
          const { title, score, domainScores: ds, timeline, body } = parseGunghapHeader(cached.data);
          setGunghapTitle(title);
          setGunghapScore(score);
          setGunghapDomainScores(ds);
          setGunghapTimeline(timeline);
          setResult(body);
          setStep('result');
          setLoading(false);
          return;
        }
      }
      setForceNewReading(false);
      activeCacheKey = cacheKey;

      const myName = selectedProfile.name;
      const otherName = otherBase.name;
      let prompt = '';

      // 직접 입력 + 분류 성공 → 항상 dynamic 생성기.
      // 섹션 제목·구성을 LLM 이 라벨 맥락으로 동적 생성 (사주아이 스타일).
      // 분류 실패한 경우만 아래 switch default 의 키워드 매칭 fallback 으로 빠진다.
      if (category === 'custom' && classifiedRelation) {
        prompt = generateCustomDynamicGunghapPrompt(
          myResult, otherResult, myName, otherName,
          customLabel.trim(), classifiedRelation,
        );
      } else switch (category) {
        case 'secret_crush':
          prompt = generateSecretCrushGunghapPrompt(myResult, otherResult, myName, otherName);
          break;
        case 'som':
          prompt = generateSomGunghapPrompt(myResult, otherResult, myName, otherName);
          break;
        case 'lover':
          prompt = generateLoverGunghapPrompt(myResult, otherResult, myName, otherName);
          break;
        case 'spouse':
          prompt = generateSpouseGunghapPrompt(myResult, otherResult, myName, otherName);
          break;
        case 'ex_lover':
          prompt = generateExRelationGunghapPrompt(myResult, otherResult, myName, otherName, 'X여친·X남친');
          break;
        case 'ex_spouse':
          prompt = generateExRelationGunghapPrompt(myResult, otherResult, myName, otherName, 'X남편·X아내');
          break;
        case 'soulmate':
          prompt = generateSoulmateGunghapPrompt(myResult, otherResult, myName, otherName);
          break;
        case 'rival':
          prompt = generateRivalGunghapPrompt(myResult, otherResult, myName, otherName);
          break;
        case 'friend':
          prompt = generateFriendGunghapPrompt(myResult, otherResult, myName, otherName);
          break;
        case 'mentor':
          prompt = generateMentorGunghapPrompt(myResult, otherResult, myName, otherName);
          break;
        case 'parent_child':
          prompt = generateFamilyGunghapPrompt(myResult, otherResult, myName, otherName, '부모-자녀');
          break;
        case 'sibling':
          prompt = generateFamilyGunghapPrompt(myResult, otherResult, myName, otherName, '형제자매');
          break;
        case 'work':
          prompt = generateWorkGunghapPrompt(myResult, otherResult, myName, otherName);
          break;
        case 'business':
          prompt = generateBusinessGunghapPrompt(myResult, otherResult, myName, otherName);
          break;
        default: {
          // custom 인데 분류 실패한 경우 + idol_fan 같은 미지원 카테고리 → 키워드 매칭 fallback
          const lbl = getCategoryDisplayLabel();
          const resolved = category === 'custom' ? resolveCustomCategory(lbl) : null;
          if (resolved === 'lover') {
            prompt = generateLoverGunghapPrompt(myResult, otherResult, myName, otherName);
          } else if (resolved === 'friend') {
            prompt = generateFriendGunghapPrompt(myResult, otherResult, myName, otherName);
          } else if (resolved === 'parent_child') {
            prompt = generateFamilyGunghapPrompt(myResult, otherResult, myName, otherName, '부모-자녀');
          } else if (resolved === 'sibling') {
            prompt = generateFamilyGunghapPrompt(myResult, otherResult, myName, otherName, '형제자매');
          } else if (resolved === 'work') {
            prompt = generateWorkGunghapPrompt(myResult, otherResult, myName, otherName);
          } else if (resolved === 'business') {
            prompt = generateBusinessGunghapPrompt(myResult, otherResult, myName, otherName);
          } else if (resolved === 'spouse') {
            prompt = generateSpouseGunghapPrompt(myResult, otherResult, myName, otherName);
          } else if (resolved === 'rival') {
            prompt = generateRivalGunghapPrompt(myResult, otherResult, myName, otherName);
          } else if (resolved === 'mentor') {
            prompt = generateMentorGunghapPrompt(myResult, otherResult, myName, otherName);
          } else if (resolved === 'som') {
            prompt = generateSomGunghapPrompt(myResult, otherResult, myName, otherName);
          } else {
            prompt = generateGeneralGunghapPrompt(myResult, otherResult, myName, otherName, lbl);
          }
          break;
        }
      }

      // 역할 컨텍스트 주입 + 제목/점수 요청 래핑.
      // 직접 입력 dynamic 의 timeline 노출 여부는 분류된 카테고리 기준.
      prompt = injectRoleContext(prompt, myName, myRole, otherName, otherRole);
      const timelineCategory: GunghapCategory =
        category === 'custom' && classifiedRelation && classifiedRelation.category !== 'general'
          ? classifiedRelation.category
          : category;
      prompt = wrapWithTitleScore(prompt, TIMELINE_CATEGORIES.includes(timelineCategory));

      // 백그라운드 잡 생성 — 차감·INSERT·archive 모두 서버. 결과는 useFortuneJob → 동기화 useEffect 가
      // parseGunghapHeader → setResult + setGunghapTitle/Score/Domain 으로 매핑.
      // jobCreated=true 로 finally 의 setLoading(false) skip → 잡 동기화 useEffect 가 책임.
      jobCreated = true;
      const minuteBucket = Math.floor(Date.now() / 60000);
      await createGunghapJob({
        prompt,
        sajuResult: myResult,
        profileId: selectedProfile.id,
        profileName: selectedProfile.name,
        sourceBirth: {
          birthDate: selectedProfile.birth_date,
          birthTime: selectedProfile.birth_time ?? null,
          birthPlace: selectedProfile.birth_place ?? null,
          gender: selectedProfile.gender,
          calendarType: selectedProfile.calendar_type,
        },
        partnerName: otherName,
        partnerBirthDate: otherBase.birth_date || null,
        engineResult: {
          gunghapCategory: category,
          customLabel: category === 'custom' ? customLabel.trim() : undefined,
          myRole: myRole.trim(),
          otherRole: otherRole.trim(),
          partnerBirthTime: otherBase.birth_time ?? undefined,
          partnerCalendarType: otherBase.calendar_type ?? 'solar',
          partnerGender: otherBase.gender ?? 'female',
        },
        idempotencyKey: `${cacheKey}:${minuteBucket}`,
      });

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '분석 중 오류가 발생했습니다.';
      setError(msg);
      // negative cache: 같은 입력 즉시 재시도 시 1분간 API 안 부르게 막아 토큰비 보호
      if (activeCacheKey) {
        useReportCacheStore.getState().setError('gunghap', activeCacheKey, msg);
      }
      // catch 단계로 떨어진 경우 잡 동기화 useEffect 가 책임지지 못하므로 loading 해제 필요.
      jobCreated = false;
    } finally {
      // 잡이 생성된 경우 (jobCreated=true) loading 해제는 잡 결과 동기화 useEffect 가 책임.
      // 그 외 (캐시 hit·검증 실패·catch) 만 여기서 직접 해제.
      if (!jobCreated) {
        setLoading(false);
      }
    }
  };

  const reset = () => {
    setStep('category');
    setResult('');
    setError('');
    setPet(defaultPet);
    setOtherProfileId('');
    setMyRole('');
    setOtherRole('');
    setRoleSwapped(false);
    setCustomLabel('');
    setClassifiedRelation(null);
    setClassifyError('');
    window.scrollTo({ top: 0 });
  };

  // 궁합 분석 로딩 전체화면
  if (loading) {
    return (
      <AILoadingBar
        label="궁합 분석중"
        minLabel="25초"
        maxLabel="1분"
        estimatedSeconds={40}
        startedAt={fortuneJob?.startedAt}
        messages={[
          '두 사람의 원국을 비교하는 중입니다',
          '합충 관계와 오행 조화를 분석하는 중입니다',
          '십성으로 본 관계 패턴을 읽는 중입니다',
          '대운 흐름과 인연의 타이밍을 보는 중입니다',
        ]}
        topContent={
          <div className="text-[17px] font-semibold text-text-primary">
            {getCategoryDisplayLabel()} 궁합
          </div>
        }
      />
    );
  }

  // 비로그인 처리
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-text-secondary mb-4">궁합 분석은 로그인 후 이용 가능합니다.</p>
        <Link href="/login?from=/saju/gunghap" className="text-cta font-semibold underline">로그인하기</Link>
      </div>
    );
  }

  if (!primaryProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-text-secondary mb-4">내 프로필을 먼저 등록해야 궁합을 볼 수 있어요.</p>
        <Link href="/saju/input?mode=profile-only" className="text-cta font-semibold underline">프로필 등록</Link>
      </div>
    );
  }

  /**
   * 뒤로가기: step 별 이전 단계로 → 첫 단계(category)에선 홈으로.
   * 단계 흐름이 있는 페이지라 명시적 분기.
   */
  const handleGunghapBack = () => {
    if (step === 'result' && urlRecordId) {
      // 외부 진입 (보관함 등) → 브라우저 히스토리 back
      router.back();
      return;
    } else if (step === 'result' && isArchiveMode) {
      // 모달에서 기존 결과 클릭 후 진입 → 궁합 메인(카테고리)으로
      setActiveRecordId(null);
      setArchiveMeta(null);
      setResult('');
      setStep('category');
      return;
    } else if (step === 'result') {
      setStep('input');
    } else if (step === 'input') {
      setStep('category');
    } else if (typeof window !== 'undefined') {
      // 카테고리(첫 화면)에서 뒤로 → 홈
      window.history.length > 1 ? window.history.back() : window.location.assign('/');
    }
  };

  // 결과 리스트 모달 닫기 — 진입 모달만 남았으므로 항상 직전 화면(홈)으로.
  // setShowArchiveList(false) 후 history.back 하면 카테고리 화면이 한 프레임 깜빡임 → 곧바로 back.
  const handleArchiveModalClose = () => {
    if (typeof window !== 'undefined') {
      window.history.length > 1 ? window.history.back() : window.location.assign('/');
      return;
    }
    setShowArchiveList(false);
  };

  const flowSteps: Step[] = ['category', 'input', 'result'];
  const flowIdx = flowSteps.indexOf(step);
  const showStepper = !isArchiveMode;

  // 진입 직후 이전 결과 조회 중이거나 결과 리스트 모달이 떠 있는 동안엔
  // 페이지 본체(헤더·스텝·카테고리)를 아예 렌더하지 않는다.
  // → 모달 뒤로 궁합 페이지가 비쳐 "이미 넘어간 것처럼" 보이는 문제 차단.
  // step==='category' 한정 — ?jobId 결과/진행 화면(step='result')은 가리지 않는다.
  const modalGateActive =
    !isArchiveMode && step === 'category' && (archiveLoading || (showArchiveList && archiveList.length > 0));

  return (
    <div className="min-h-screen pb-24">
      {modalGateActive ? (
        archiveLoading ? (
          <div className="flex items-center justify-center min-h-screen">
            <div className="w-8 h-8 border-3 border-cta border-t-transparent rounded-full animate-spin" />
          </div>
        ) : null
      ) : (
      <>
      {/* 헤더 */}
      <div className="px-5 pt-4 pb-4">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center relative">
          <BackButton onClick={handleGunghapBack} label="이전 단계" className="absolute left-0" />
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
              궁합 분석
            </h1>
            <p className="text-base text-text-tertiary mt-1">두 사람의 사주로 보는 인연의 흐름</p>
          </div>
        </motion.div>
      </div>

      {/* 스텝 인디케이터 — landing에서는 숨김 */}
      {showStepper && (
        <div className="px-5 mb-6">
          <div className="flex items-center gap-0">
            {flowSteps.map((s, i) => (
              <div key={s} className="flex items-center flex-1">
                {i > 0 && (
                  <div className={`flex-1 h-px transition-colors ${i <= flowIdx ? 'bg-cta/40' : 'bg-white/10'}`} />
                )}
                <div className="flex flex-col items-center gap-0.5 px-1">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-bold transition-all
                    ${step === s ? 'bg-cta text-white scale-110' : i < flowIdx ? 'bg-cta/50 text-white' : 'bg-white/10 text-text-tertiary'}`}>
                    {i + 1}
                  </div>
                  <span className={`text-[11px] font-medium whitespace-nowrap transition-colors
                    ${step === s ? 'text-cta' : i < flowIdx ? 'text-text-secondary' : 'text-text-tertiary'}`}>
                    {STEP_LABELS[s]}
                  </span>
                </div>
                {i < flowSteps.length - 1 && (
                  <div className={`flex-1 h-px transition-colors ${i < flowIdx ? 'bg-cta/40' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">

        {/* ── STEP 1: 관계 유형 선택 ── */}
        {step === 'category' && (
          <motion.div key="category" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-5 space-y-5">
            {/* '이전 궁합 결과 보기' 버튼은 제거 — 페이지 진입 시 archive 모달이 자동 노출되어 중복.
                보관함 진입은 하단 네비의 [보관함] 탭으로 일원화. */}
            {CATEGORY_GROUPS.map(group => (
              <div key={group.groupLabel}>
                <p className={`text-[13px] font-bold mb-2.5 uppercase tracking-wider ${group.groupColor}`}>
                  {group.groupLabel}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all text-left
                        bg-gradient-to-br ${cat.accent}
                        ${category === cat.id ? 'border-cta/70 ring-1 ring-cta/30 shadow-[0_0_12px_rgba(139,92,246,0.15)]' : 'border-[var(--border-subtle)] hover:border-white/25'}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold text-text-primary leading-tight">{cat.label}</p>
                        <p className="text-[12px] text-text-secondary mt-0.5 leading-tight">{cat.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* 직접 입력 커스텀 라벨 */}
            <AnimatePresence>
              {category === 'custom' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <input
                    type="text"
                    value={customLabel}
                    onChange={e => {
                      setCustomLabel(e.target.value);
                      // 라벨이 바뀌면 이전 분류 결과·에러 폐기
                      setClassifiedRelation(null);
                      setClassifyError('');
                    }}
                    placeholder="관계를 직접 입력 (예: 전생의 연인, 인터넷 친구)"
                    maxLength={30}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-text-primary text-[16px] placeholder-text-tertiary focus:border-cta/50 focus:outline-none transition"
                  />
                  {classifyError && (
                    <p className="mt-2 text-[13px] text-[#FB923C]">{classifyError}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={handleCategoryNext}
              disabled={(category === 'custom' && !customLabel.trim()) || classifying}
              className="w-full py-3.5 rounded-2xl bg-cta text-white font-bold text-[17px] active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {classifying ? '관계 분석 중...' : '다음 — 상대 정보'}
            </button>
          </motion.div>
        )}

        {/* ── STEP 2: 상대방 정보 입력 ── */}
        {step === 'input' && (
          <motion.div key="input" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-5">

            {/* 내 프로필 선택 */}
            {profiles.length > 1 && (
              <div className="mb-4">
                <p className="text-[13px] font-semibold text-text-secondary mb-2 uppercase tracking-wider">내 프로필</p>
                {/* 가로 스크롤 — flex-nowrap + 칩 shrink-0 으로 줄바꿈 차단. 5개 이상이면 옆으로 스와이프. */}
                <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                  {profiles.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setMyProfileId(p.id)}
                      className={`flex-shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl text-[15px] font-medium border transition-all
                        ${selectedProfile?.id === p.id ? 'bg-cta/20 border-cta/50 text-cta' : 'bg-white/5 border-white/10 text-text-secondary hover:border-white/20'}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 내 정보 요약 — 카테고리 라벨은 위, 본인 정보는 아래로 분리해 줄바꿈 방지 */}
            {selectedProfile && (
              <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-cta/15 flex items-center justify-center text-[13px] font-bold text-cta shrink-0">1</div>
                  <div className={`px-2.5 py-0.5 rounded-full bg-gradient-to-br ${selectedCat.accent} text-[12px] font-semibold text-text-primary border border-white/15 whitespace-nowrap`}>
                    {getCategoryDisplayLabel()}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-text-primary truncate">{selectedProfile.name}</p>
                    <p className="text-[12px] text-text-secondary truncate">
                      {selectedProfile.birth_date} · {selectedProfile.gender === 'male' ? '남' : '여'}
                    </p>
                  </div>
                  {(myRole.trim() || otherRole.trim()) && (
                    <div className="text-[11px] text-text-tertiary text-right shrink-0 leading-snug">
                      {myRole.trim() && <div className="whitespace-nowrap">내 역할: {myRole}</div>}
                      {otherRole.trim() && <div className="whitespace-nowrap">상대 역할: {otherRole}</div>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 역할 선택 토글 — 부모·자녀 / 멘토·멘티 */}
            {SWAPPABLE_CATEGORIES.includes(category) && (() => {
              const roles = AUTO_ROLES[category];
              if (!roles) return null;
              const [roleA, roleB] = roles;
              return (
                <div className="mb-4 p-3.5 rounded-xl bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
                  <p className="text-[13px] font-semibold text-text-secondary mb-2.5">나는 누구인가요?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRoleSwapped(false)}
                      className={`flex-1 py-2.5 rounded-xl text-[15px] font-semibold transition-all border
                        ${!roleSwapped ? 'bg-cta/20 border-cta/50 text-cta' : 'bg-white/5 border-white/10 text-text-secondary hover:border-white/20'}`}
                    >
                      {roleA}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoleSwapped(true)}
                      className={`flex-1 py-2.5 rounded-xl text-[15px] font-semibold transition-all border
                        ${roleSwapped ? 'bg-cta/20 border-cta/50 text-cta' : 'bg-white/5 border-white/10 text-text-secondary hover:border-white/20'}`}
                    >
                      {roleB}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 상대방 입력 */}
            <div className="p-4 rounded-2xl bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] space-y-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-full bg-cta/15 flex items-center justify-center text-[14px] font-bold text-cta shrink-0">2</div>
                <div>
                  <p className="text-[17px] font-bold text-text-primary">상대방 정보</p>
                  <p className="text-[13px] text-text-tertiary">궁합을 볼 두 번째 사람</p>
                </div>
              </div>

              {isPetCategory ? (
                /* ── 반려동물 카테고리 — 종·이름·성격 키워드 입력 ── */
                <div className="space-y-4">
                  <div>
                    <label className="text-[13px] font-medium text-text-tertiary mb-1.5 block">이름</label>
                    <input
                      type="text"
                      value={pet.name}
                      onChange={e => setPet(p => ({ ...p, name: e.target.value }))}
                      placeholder="반려동물 이름"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-text-primary text-[16px] placeholder-text-tertiary focus:border-cta/50 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="text-[13px] font-medium text-text-tertiary mb-1.5 block">종</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(Object.keys(PET_SPECIES_VIBE) as PetSpecies[]).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setPet(p => ({ ...p, species: s }))}
                          className={`py-2 rounded-xl text-[13px] font-medium border transition-all
                            ${pet.species === s ? 'bg-cta/20 border-cta/50 text-cta' : 'bg-white/5 border-white/10 text-text-secondary hover:border-white/20'}`}
                        >
                          {PET_SPECIES_VIBE[s].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[13px] font-medium text-text-tertiary mb-1.5 block">성별</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['male', 'female', 'unknown'] as const).map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setPet(p => ({ ...p, gender: g }))}
                          className={`py-2 rounded-xl text-[14px] font-medium border transition-all
                            ${pet.gender === g ? 'bg-cta/20 border-cta/50 text-cta' : 'bg-white/5 border-white/10 text-text-secondary hover:border-white/20'}`}
                        >
                          {g === 'male' ? '수컷' : g === 'female' ? '암컷' : '모름'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[13px] font-medium text-text-tertiary block">성격 (최대 3개, 선택)</label>
                      <span className="text-[11px] text-text-tertiary">{pet.personalityKeywords.length}/3</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PET_PERSONALITY_OPTIONS.map(kw => {
                        const active = pet.personalityKeywords.includes(kw);
                        const full = pet.personalityKeywords.length >= 3 && !active;
                        return (
                          <button
                            key={kw}
                            type="button"
                            disabled={full}
                            onClick={() => setPet(p => ({
                              ...p,
                              personalityKeywords: active
                                ? p.personalityKeywords.filter(k => k !== kw)
                                : [...p.personalityKeywords, kw],
                            }))}
                            className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-all
                              ${active ? 'bg-cta/20 border-cta/50 text-cta'
                              : full ? 'bg-white/5 border-white/10 text-text-tertiary opacity-40 cursor-not-allowed'
                              : 'bg-white/5 border-white/10 text-text-secondary hover:border-white/20'}`}
                          >
                            {kw}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                /* ── 일반 카테고리 — 등록된 birth_profiles 중에서 선택 ── */
                <div>
                  <p className="text-[13px] font-medium text-text-tertiary mb-2">
                    상대로 분석할 프로필을 선택하세요
                  </p>
                  {otherProfileChoices.length === 0 ? (
                    <p className="text-[13px] text-text-tertiary py-2">
                      선택 가능한 다른 프로필이 없어요. 아래 &lsquo;새 프로필 추가&rsquo;로 만들어 주세요.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {otherProfileChoices.map(p => {
                        const active = selectedOtherProfile?.id === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setOtherProfileId(p.id)}
                            className={`p-3 rounded-xl border text-left transition-all active:scale-[0.98]
                              ${active ? 'bg-cta/15 border-cta/50' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold shrink-0 ${
                                p.gender === 'male' ? 'bg-sky-500/15 text-sky-300' : 'bg-pink-400/15 text-pink-300'
                              }`}>
                                {p.gender === 'male' ? '남' : '여'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-[15px] font-semibold truncate ${active ? 'text-cta' : 'text-text-primary'}`}>
                                  {p.name}
                                </p>
                                <p className="text-[12px] text-text-tertiary mt-0.5 truncate">
                                  {p.birth_date.replace(/-/g, '.')}
                                  {p.birth_time ? ` ${p.birth_time}` : ' (시간 모름)'}
                                </p>
                              </div>
                              {active && (
                                <span className="text-[12px] px-2 py-0.5 rounded-full bg-cta/20 text-cta font-semibold flex-shrink-0">
                                  선택됨
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 새 프로필 추가 — 본인 슬롯·정통사주·신년운세와 동일 패턴.
                      SajuInputPage 로 라우팅해 저장 후 돌아오면 birth_profiles 에 추가되어 위 칩 리스트에 자동 노출. */}
                  <button
                    type="button"
                    onClick={() => router.push('/saju/input?mode=profile-only')}
                    className="mt-3 w-full rounded-2xl border-2 border-dashed border-[var(--border-subtle)] hover:border-cta/40 p-4 flex items-center justify-center gap-2 text-text-tertiary hover:text-cta transition-all"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span className="text-sm font-medium">새 프로필 추가</span>
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-[15px] text-red-400">
                {error}
              </div>
            )}

            {/* 비활성 사유 — 사용자가 무엇이 부족한지 알 수 있게 */}
            {!isOtherValid && !loading && (
              <p className="mt-3 text-[12px] text-amber-300/80 text-center">
                {isPetCategory ? '반려동물 이름을 입력해주세요' : '상대 프로필을 선택해주세요'}
              </p>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setStep('category')}
                className="px-5 py-3.5 rounded-2xl border border-white/15 text-text-secondary font-medium text-[16px] active:scale-[0.98] transition-all"
              >
                이전
              </button>
              <button
                disabled={!isOtherValid || loading}
                onClick={handleAnalyze}
                className="flex-1 py-3.5 rounded-2xl bg-cta text-white font-bold text-[17px] active:scale-[0.98] transition-all disabled:opacity-40"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    분석 중...
                  </span>
                ) : '궁합 분석하기'}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3: 결과 ── */}
        {step === 'result' && (
          <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="px-5">

            {/* 은유 대제목 + ScoreRing + 영역별 차트 */}
            {gunghapScore != null && (
              <div className={`rounded-2xl mb-4 p-5 bg-gradient-to-br ${selectedCat.accent} border border-white/15`}>
                {gunghapTitle && (
                  <p className="text-[18px] font-bold text-text-primary leading-relaxed mb-4 text-center" style={{ fontFamily: 'var(--font-serif)' }}>
                    {gunghapTitle}
                  </p>
                )}
                <div className="flex justify-center mb-2">
                  <ScoreRing score={gunghapScore} grade={scoreToGrade(gunghapScore)} size={130} />
                </div>
                <p className="text-[13px] text-text-secondary text-center mb-1">종합 궁합 점수</p>

                {/* 영역별 레이더 차트 */}
                {Object.keys(gunghapDomainScores).length >= 3 && (
                  <>
                    <div className="mt-4 mb-2">
                      <RadarChart
                        domains={GUNGHAP_DOMAINS.map(d => ({
                          label: d.label,
                          score: gunghapDomainScores[d.key] ?? 50,
                          color: GRADE_COLOR[scoreToGrade(gunghapDomainScores[d.key] ?? 50)],
                        }))}
                        size={250}
                      />
                    </div>
                    <div className="space-y-2 mt-3">
                      {GUNGHAP_DOMAINS.map(d => {
                        const s = gunghapDomainScores[d.key];
                        if (s == null) return null;
                        return <DomainBar key={d.key} label={d.label} score={s} grade={scoreToGrade(s)} />;
                      })}
                    </div>
                  </>
                )}

                {/* 관계 추이 그래프 — 시간 흐름에 따른 궁합 점수 (연애 관계 4종) */}
                {gunghapTimeline.length >= 2 && (
                  <div className="mt-5 pt-4 border-t border-[rgba(124,92,252,0.18)]">
                    <RelationTimelineChart data={gunghapTimeline} />
                  </div>
                )}
              </div>
            )}

            {/* 관계 + 이름 배지 */}
            <div className="rounded-2xl mb-4 p-4 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
              <p className="text-center text-[13px] font-bold text-cta uppercase tracking-wider mb-3">
                {archiveMeta ? archiveMeta.categoryLabel : getCategoryDisplayLabel()}
              </p>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-[16px] font-bold text-text-primary">
                    {archiveMeta ? archiveMeta.profileName : selectedProfile?.name}
                  </p>
                  {!archiveMeta && (
                    <p className="text-[12px] text-text-tertiary mt-0.5">
                      {selectedProfile?.birth_date?.replace(/-/g, '.')}
                    </p>
                  )}
                  {(archiveMeta ? archiveMeta.myRole : myRole) && (
                    <p className="text-[12px] text-cta/80 mt-0.5">{archiveMeta ? archiveMeta.myRole : myRole}</p>
                  )}
                </div>
                <span className="text-[20px] text-cta/60">
                  {isPetCategory && !archiveMeta ? '🐾' : '·'}
                </span>
                <div className="text-center">
                  <p className="text-[16px] font-bold text-text-primary">
                    {archiveMeta ? archiveMeta.partnerName : otherDisplayName}
                    {!archiveMeta && isPetCategory && pet.species && (
                      <span className="text-[12px] font-normal text-text-secondary ml-1">({PET_SPECIES_VIBE[pet.species].label})</span>
                    )}
                  </p>
                  {!archiveMeta && !isPetCategory && (
                    <p className="text-[12px] text-text-tertiary mt-0.5">
                      {selectedOtherProfile?.birth_date?.replace(/-/g, '.')}
                    </p>
                  )}
                  {(archiveMeta ? archiveMeta.otherRole : otherRole) && (
                    <p className="text-[12px] text-cta/80 mt-0.5">{archiveMeta ? archiveMeta.otherRole : otherRole}</p>
                  )}
                </div>
              </div>
            </div>

            {/* 두 사람 사주명식 표 — 만세력 스타일 */}
            {!isPetCategory && mySajuResult && otherSajuResult && (
              <div className="space-y-4 mb-4">
                {[
                  { label: archiveMeta?.profileName ?? selectedProfile?.name ?? '나', result: mySajuResult },
                  { label: archiveMeta?.partnerName ?? otherDisplayName, result: otherSajuResult },
                ].map((person, pi) => {
                  const p = person.result.pillars;
                  const hu = person.result.hourUnknown;
                  const ELEM_COLOR: Record<string, string> = {
                    '목': '#34D399', '화': '#F43F5E', '토': '#F59E0B', '금': '#CBD5E1', '수': '#3B82F6',
                  };
                  return (
                    <div key={pi} className="rounded-2xl overflow-hidden bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
                      <div className="text-[19px] font-bold text-cta py-3 px-3 text-center">{person.label}</div>
                      {/* 헤더 */}
                      <div className="grid text-center text-[13px] font-bold text-cta/80 py-2 px-1 bg-[rgba(124,92,252,0.08)] rounded-lg mx-2 mb-1"
                           style={{ gridTemplateColumns: '44px repeat(4, 1fr)' }}>
                        <span />
                        <span>시주</span><span>일주</span><span>월주</span><span>연주</span>
                      </div>
                      {/* 천간 */}
                      <div className="grid items-center text-center py-5 px-1 border-b border-[var(--border-subtle)]"
                           style={{ gridTemplateColumns: '44px repeat(4, 1fr)' }}>
                        <span className="text-[12px] font-semibold text-text-secondary text-left pl-2">천간</span>
                        {(['hour', 'day', 'month', 'year'] as const).map(col => {
                          const gan = p[col]?.gan;
                          const isUnknown = col === 'hour' && hu;
                          const color = !isUnknown && gan ? ELEM_COLOR[p[col].ganElement] : undefined;
                          return (
                            <div key={`g-${pi}-${col}`} className="flex flex-col items-center" style={{ color }}>
                              <span className="text-[11px] opacity-60 mb-1" style={{ fontFamily: 'var(--font-sans)' }}>
                                {isUnknown ? '' : (gan ?? '')}
                              </span>
                              <span className="text-[28px] font-bold leading-none" style={{ fontFamily: 'var(--font-serif)' }}>
                                {isUnknown ? '?' : (gan ? (STEM_TO_HANJA[gan] ?? gan) : '?')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {/* 지지 */}
                      <div className="grid items-center text-center py-5 px-1"
                           style={{ gridTemplateColumns: '44px repeat(4, 1fr)' }}>
                        <span className="text-[12px] font-semibold text-text-secondary text-left pl-2">지지</span>
                        {(['hour', 'day', 'month', 'year'] as const).map(col => {
                          const zhi = p[col]?.zhi;
                          const isUnknown = col === 'hour' && hu;
                          const color = !isUnknown && zhi ? ELEM_COLOR[p[col].zhiElement] : undefined;
                          return (
                            <div key={`z-${pi}-${col}`} className="flex flex-col items-center" style={{ color }}>
                              <span className="text-[28px] font-bold leading-none" style={{ fontFamily: 'var(--font-serif)' }}>
                                {isUnknown ? '?' : (zhi ? (ZHI_TO_HANJA[zhi] ?? zhi) : '?')}
                              </span>
                              <span className="text-[11px] opacity-60 mt-1" style={{ fontFamily: 'var(--font-sans)' }}>
                                {isUnknown ? '' : (zhi ?? '')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 반려동물 재미 해석 안내 — 결과 상단 */}
            {isPetCategory && (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[13px] text-amber-200 leading-relaxed">
                이 결과는 <b>주인의 사주 + 동물 상징 기운</b>으로 풀어낸 재미 해석입니다. 정통 사주 풀이가 아닌 라이프스타일 참고용으로 가볍게 봐주세요.
              </div>
            )}

            {/* 결과 본문 — 섹션별 카드 분리 렌더링 */}
            {(() => {
              const cleanedText = result.replace(/\[\/?\s*gunghap[_\s]?(?:header|scores|timeline)\s*\][^\n]*/gi, '').trim();

              // Known section titles from gunghap prompts (프롬프트와 정확히 일치)
              const SECTION_TITLES = [
                // 연인
                '핵심 요약', '공명과 끌림', '오행 상보 관계', '갈등·마찰 포인트',
                '운명의 연결고리', '연애 방식과 역학', '서로의 속마음',
                '일상 속 케미', '이 사랑의 미래', '개운법·처방',
                // 친구
                '이 우정의 에너지 구조', '서로에게 어떤 친구인가', '갈등과 마찰 포인트',
                '함께 성장하는 방법', '오래가는 우정을 위한 처방',
                '우정이 빛나는 순간', '이 우정의 미래',
                // 가족
                '이 가족 관계의 명리 구조', '각자의 역할과 에너지', '갈등과 오해 패턴',
                '서로에게 주는 선물', '관계를 더 깊게 하는 처방',
                '세대 간 에너지 흐름', '가족의 미래 전망',
                // 직장동료
                '업무 에너지 구조', '각자의 업무 스타일과 시너지', '협업 극대화 전략', '직장 관계 처방',
                '의사소통 패턴', '서로의 숨은 능력', '성과 극대화 시기', '장기 파트너십 전망',
                // 범용
                '이 관계의 에너지 구조', '서로가 주고받는 것', '마찰과 주의 포인트',
                '이 관계를 더 좋게 만드는 처방', '관계의 숨은 면', '함께하면 빛나는 순간', '이 관계의 미래',
                // 썸
                '이 설렘의 정체', '상대방이 나를 보는 시선', '연애로 발전할 가능성',
                '썸 단계의 주의사항', '고백 타이밍과 개운법',
                '감정의 온도차', '데이트 케미', '이 감정의 미래',
                // 배우자
                '공명과 유대', '가정 역할과 생활 방식', '경제·자산 궁합',
                '자녀와 가족 관계', '이 결혼의 미래',
                // 전 연인/전 배우자
                '왜 헤어졌는가', '그때 서로에게 어떤 존재였나', '재결합 가능성',
                '이 관계에서 배운 것', '감정 정리와 개운법',
                '이별의 순환 패턴', '지금 내 안에 남은 것', '다음 인연의 청사진', '진정한 이별의 의미',
                // 사업 파트너
                '파트너십의 에너지 구조', '최대 시너지 영역', '파트너십의 위험 신호',
                '금전과 신뢰', '사업 파트너십 처방',
                '의사결정 구조', '위기 극복 패턴', '성장 시너지', '장기 파트너십 전망',
                // 짝사랑
                '왜 이 사람에게 끌리는가', '상대방 눈에 나는 어떻게 보이는가', '마음이 이어질 가능성',
                '이런 행동은 멀어지게 한다', '고백 타이밍과 처방',
                '감정의 깊이', '상대방의 이상형 분석', '다가가는 전략', '이 마음의 미래',
                // 소울메이트
                '이 인연의 명리적 정체', '영혼의 공명 — 왜 통하는가', '서로가 서로를 완성하는 구조',
                '소울메이트도 겪는 갈등', '이 인연에서 각자가 성장하는 것', '이 인연을 지키는 처방',
                '상대가 보는 나', '일상 케미 포인트', '함께하는 성장의 길',
                // 라이벌
                '이 라이벌 관계의 정체', '서로가 서로에게 주는 자극', '라이벌 관계의 그림자',
                '라이벌을 활용해 성장하는 전략', '이 경쟁의 최종 가치',
                '경쟁의 열쇠', '보이지 않는 존경', '경쟁이 독이 되는 순간', '라이벌에서 동료로',
                // 멘토·멘티
                '이 성장 관계의 명리 구조', '가르치고 배우는 방식', '갈등과 마찰 포인트',
                '각자에게 주는 성장', '멘토십을 오래 지속하는 처방',
                '멘토가 전하는 가치', '성장의 변곡점',
                // 공통 (여러 유형에서 공유)
                '서로의 속마음',
              ];

              // ▶ 기반 파싱 (항상 우선): 모든 궁합 프롬프트가 "▶ 제목" 형식 강제
              const parts: { title: string; body: string }[] = [];
              let preamble = '';
              const matches: { title: string; index: number; end: number }[] = [];

              const markerRegex = /^\s*▶\s*(.+?)\s*$/gm;
              let fm: RegExpExecArray | null;
              while ((fm = markerRegex.exec(cleanedText)) !== null) {
                matches.push({
                  title: fm[1].replace(/\s*\(.+?\)\s*$/, '').trim(),
                  index: fm.index,
                  end: fm.index + fm[0].length,
                });
              }

              // fallback: ▶ 마커 없으면 알려진 섹션 제목으로 매칭
              if (matches.length === 0) {
                const titlePattern = SECTION_TITLES.map(t => t.replace(/[·()—]/g, s => `\\${s}`)).join('|');
                const sectionRegex = new RegExp(`^\\s*(?:${titlePattern})(?:\\s*\\(.+?\\))?\\s*$`, 'gm');
                let m: RegExpExecArray | null;
                while ((m = sectionRegex.exec(cleanedText)) !== null) {
                  matches.push({
                    title: m[0].replace(/\s*\(.+?\)\s*$/, '').trim(),
                    index: m.index,
                    end: m.index + m[0].length,
                  });
                }
              }

              if (matches.length === 0) {
                return (
                  <div className="p-5 rounded-2xl bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
                    <div className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
                      {cleanedText.split(/\n\n+/).map((para, pi) => (
                        <p key={pi} className="whitespace-pre-line">{renderEmphasis(para.trim())}</p>
                      ))}
                    </div>
                  </div>
                );
              }

              preamble = cleanedText.slice(0, matches[0].index).trim();
              for (let i = 0; i < matches.length; i++) {
                const bodyStart = matches[i].end;
                const bodyEnd = i + 1 < matches.length ? matches[i + 1].index : cleanedText.length;
                parts.push({ title: matches[i].title, body: cleanedText.slice(bodyStart, bodyEnd).trim() });
              }

              // 자체 extractMetaphor 함수 → 공통 유틸(utils/parseMetaphor)로 교체. 변형 마커 + 본문 strip 안전망 적용.

              return (
                <div className="space-y-2">
                  {preamble && (() => {
                    const { metaphorTitle: pMeta, bodyText: pBody } = extractMetaphor(preamble);
                    return (
                      <div className="rounded-2xl p-5 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
                        {pMeta && (
                          <div className="text-[17px] font-bold leading-snug text-cta/90 mb-4" style={{ fontFamily: 'var(--font-serif)' }}>
                            {pMeta}
                          </div>
                        )}
                        {pBody && (
                          <div className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
                            {pBody.split(/\n\n+/).map((para, pi) => (
                              <p key={pi} className="whitespace-pre-line">{renderEmphasis(para.trim())}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {parts.map((sec, idx) => {
                    const { metaphorTitle, bodyText } = extractMetaphor(sec.body);

                    return (
                      <SectionCollapsible
                        key={idx}
                        title={sec.title}
                        metaphorTitle={metaphorTitle}
                        defaultOpen={idx === 0}
                        enterDelay={0.06 * idx}
                      >
                        {/* 섹션별 시각 데이터 카드 — 영역 점수 / 오행 관계 / 개운법 */}
                        {renderGunghapSectionVisual(
                          sec.title,
                          gunghapDomainScores,
                          mySajuResult?.pillars.day.ganElement,
                          otherSajuResult?.pillars.day.ganElement,
                          archiveMeta?.profileName ?? selectedProfile?.name,
                          archiveMeta?.partnerName ?? otherDisplayName,
                        )}
                        <div className="text-[17px] text-text-secondary leading-[1.85] tracking-[-0.005em] space-y-3">
                          {bodyText.split(/\n\n+/).map((para, pi) => (
                            <p key={pi} className="whitespace-pre-line">{renderEmphasis(para.trim())}</p>
                          ))}
                        </div>
                      </SectionCollapsible>
                    );
                  })}
                </div>
              );
            })()}

            {(activeRecordId || savedRecordId) && (
              <div className="mt-6">
                <ShareBar recordId={(activeRecordId || savedRecordId)!} type="saju" category="gunghap" />
              </div>
            )}

            <ResultFooterActions
              redo={!isArchiveMode ? { label: '다시 풀이 받기', onClick: reset } : undefined}
            />

          </motion.div>
        )}

      </AnimatePresence>
      </>
      )}

      {/* 이전 궁합 결과 리스트 모달 — 택일·지정일과 동일 UX */}
      <AnimatePresence>
        {showArchiveList && !isArchiveMode && archiveList.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={handleArchiveModalClose}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="fixed inset-0 z-50 flex items-center justify-center px-5 pointer-events-none"
            >
              <div className="relative w-full max-w-[400px] rounded-2xl bg-[rgba(20,12,38,0.97)] border border-[var(--border-subtle)] p-6 text-center shadow-2xl pointer-events-auto">
                <button
                  type="button"
                  onClick={handleArchiveModalClose}
                  className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-text-tertiary hover:text-text-primary hover:bg-white/10 transition-colors"
                  aria-label="닫기"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
                <h3 className="text-[17px] font-bold text-text-primary mb-2">이전 궁합 기록이 있어요</h3>
                <p className="text-[14px] text-text-secondary leading-relaxed mb-3">
                  다시 보고 싶은 결과를 선택하세요.
                </p>
                <div className="max-h-[240px] overflow-y-auto space-y-1.5 mb-4 px-1">
                  {archiveList.map(item => {
                    const rawCatLabel = item.custom_label || CATEGORY_LABEL_MAP[item.gunghap_category] || item.gunghap_category;
                    const catLabel = rawCatLabel || '이전 궁합';
                    const dateStr = new Date(item.created_at).toLocaleDateString('ko-KR');
                    const names = item.partner_name
                      ? `${item.profile_name} ↔ ${item.partner_name}`
                      : item.profile_name;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => { setShowArchiveList(false); setActiveRecordId(item.id); }}
                        className="w-full min-h-10 py-2 px-3 rounded-lg border border-[var(--border-subtle)] text-[14px] text-text-primary font-medium hover:bg-cta/10 hover:border-cta/40 transition-all flex items-center justify-between gap-2"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-[12px] font-bold text-cta bg-cta/10 px-2 py-0.5 rounded-md whitespace-nowrap flex-shrink-0">
                            {catLabel}
                          </span>
                          <span className="truncate">{names}</span>
                        </span>
                        <span className="text-[12px] text-text-tertiary flex-shrink-0 whitespace-nowrap">{dateStr}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => { setShowArchiveList(false); setForceNewReading(true); }}
                    className="block w-full h-12 rounded-lg bg-gradient-to-r from-cta to-cta-active text-white font-bold text-[15px] hover:opacity-90 transition-all"
                  >
                    새로 궁합 보기
                  </button>
                  <button
                    type="button"
                    onClick={handleArchiveModalClose}
                    className="block w-full h-12 rounded-lg border border-[var(--border-subtle)] text-text-secondary font-medium text-[15px] hover:bg-white/5 transition-all"
                  >
                    취소
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
