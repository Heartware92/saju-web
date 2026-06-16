/**
 * 상담소 공유 모듈 — 타입, 상수, 헬퍼
 * ConsultationListPage · ConsultationChatPage 공통
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  followups?: string[];
}

export interface StoredConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

// localStorage 키 (기존 호환)
// 참고: 'sangdamso:status:${pid}' 키는 상태 수정 기능 제거 후 더 이상 쓰지 않음.
//       기존 사용자 localStorage 에 남아있던 값은 무시되며 별도 정리 없이 dead key 로 둠.
export const CONVERSATIONS_KEY = (pid: string) => `sangdamso:conversations:${pid}`;
export const ACTIVE_KEY = (pid: string) => `sangdamso:active:${pid}`;
export const LEGACY_HISTORY_KEY = (pid: string) => `sangdamso:history:${pid}`;
export const STORAGE_NOTICE_KEY = 'sangdamso:storage-notice-dismissed';

/** 한 방(대화)당 최대 질문(=user 메시지) 수. 초과 시 가장 오래된 질문·답변부터 슬라이딩 제거. */
export const MAX_QUESTIONS_PER_ROOM = 30;
/** 질문 1개 = user+assistant 2메시지. 저장 트림 한도(질문 30개 = 60메시지). */
export const MAX_MESSAGES_PER_CONVERSATION = MAX_QUESTIONS_PER_ROOM * 2;

// ────────────────────────────────────────────────────────────
// 오행 5방(房) 모델
// ────────────────────────────────────────────────────────────
// 프로필 1명당 오행(목·화·토·금·수) 5개의 고정 대화방을 가진다.
// 각 방은 단 하나의 이어지는 대화(StoredConversation)이며, 방마다 톤앤매너가 다르다(톤앤매너는 추후 구현).
// 본인 물상(일간 오행)에 해당하는 방만 디폴트로 열리고, 나머지 4개는 잠금(달 크레딧으로 해제 — 추후).
// 방의 conversation_id 는 결정적 ID `${profileId}::${elementKey}` 로 생성한다(기존 free-form uuid 와 구분됨).

export type ElementKey = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

export interface ElementRoom {
  key: ElementKey;
  han: string;        // 목 화 토 금 수
  hanja: string;      // 木 火 土 金 水
  name: string;       // 방 이름
  /** 톤앤매너 시드 (추후 시스템 프롬프트에 주입) */
  toneHint: string;
  accent: string;     // 오행 강조색 (다크 배경 대비)
}

export const ELEMENTS: ElementRoom[] = [
  { key: 'wood',  han: '목', hanja: '木', name: '나무의 방', toneHint: '차분하고 성장지향적인, 북돋아 주는 말투', accent: '#4CC38A' },
  { key: 'fire',  han: '화', hanja: '火', name: '불의 방',   toneHint: '직설적이고 열정적인, 기운을 끌어올리는 강한 말투', accent: '#FF6B5A' },
  { key: 'earth', han: '토', hanja: '土', name: '흙의 방',   toneHint: '든든하고 포용적인, 안정감을 주는 말투', accent: '#E0A45E' },
  { key: 'metal', han: '금', hanja: '金', name: '쇠의 방',   toneHint: '단호하고 명료한, 핵심을 짚는 절제된 말투', accent: '#CBD5E1' },
  { key: 'water', han: '수', hanja: '水', name: '물의 방',   toneHint: '유연하고 통찰적인, 깊이 헤아리는 말투', accent: '#5B9BD5' },
];

const HAN_TO_KEY: Record<string, ElementKey> = {
  '목': 'wood', '화': 'fire', '토': 'earth', '금': 'metal', '수': 'water',
};

const ALL_ELEMENT_KEYS: ElementKey[] = ['wood', 'fire', 'earth', 'metal', 'water'];

export function getElement(key: ElementKey): ElementRoom {
  return ELEMENTS.find(e => e.key === key) ?? ELEMENTS[2];
}

/** 일간 오행(dayMasterElement, 한글 '목'~'수') → 본인 물상 방 key */
export function defaultElementKey(dayMasterElement: string | null | undefined): ElementKey {
  return (dayMasterElement && HAN_TO_KEY[dayMasterElement]) || 'earth';
}

/** 방 대화 ID — 프로필+오행으로 결정적 생성 */
export const ROOM_ID = (profileId: string, key: ElementKey) => `${profileId}::${key}`;

/** 방 ID 에서 오행 key 추출 (레거시 free-form 대화면 null) */
export function elementKeyFromRoomId(roomId: string): ElementKey | null {
  const suffix = roomId.split('::')[1] as ElementKey | undefined;
  return suffix && ALL_ELEMENT_KEYS.includes(suffix) ? suffix : null;
}

/** 잠금 해제 상태 저장 키 — 추후 달 크레딧 해제 시 element key 배열 저장 */
export const UNLOCKS_KEY = (pid: string) => `sangdamso:unlocks:${pid}`;

/**
 * 현재 열려 있는 방 목록. 디폴트(본인 물상)는 항상 포함.
 * (추후: 달 크레딧으로 해제한 방을 UNLOCKS_KEY 에서 합산)
 */
export function loadUnlockedElements(profileId: string, defaultKey: ElementKey): ElementKey[] {
  const set = new Set<ElementKey>([defaultKey]);
  try {
    const raw = localStorage.getItem(UNLOCKS_KEY(profileId));
    if (raw) (JSON.parse(raw) as ElementKey[]).forEach(k => { if (ALL_ELEMENT_KEYS.includes(k)) set.add(k); });
  } catch { /* ignore */ }
  return ALL_ELEMENT_KEYS.filter(k => set.has(k));
}

/** 빈 방 대화 생성 */
export function emptyRoom(profileId: string, key: ElementKey): StoredConversation {
  return { id: ROOM_ID(profileId, key), title: getElement(key).name, messages: [], updatedAt: Date.now() };
}

/**
 * 질문(user 메시지) 수가 max 를 넘으면 가장 오래된 질문·답변부터 슬라이딩 제거.
 * 예) 31번째 질문이 들어오면 1번 질문·답변이 사라지고 2~31번만 남는다.
 */
export function trimToMaxQuestions(messages: ChatMessage[], max = MAX_QUESTIONS_PER_ROOM): ChatMessage[] {
  const userIdxs: number[] = [];
  messages.forEach((m, i) => { if (m.role === 'user') userIdxs.push(i); });
  if (userIdxs.length <= max) return messages;
  const firstKeepUserIdx = userIdxs[userIdxs.length - max];
  return messages.slice(firstKeepUserIdx);
}

/** 프로필의 5개 방 대화를 오행 key 로 매핑해 로드 (없으면 빈 방) */
export function loadRooms(profileId: string): Record<ElementKey, StoredConversation> {
  const out = {} as Record<ElementKey, StoredConversation>;
  for (const k of ALL_ELEMENT_KEYS) out[k] = emptyRoom(profileId, k);
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY(profileId));
    if (raw) {
      const arr: StoredConversation[] = JSON.parse(raw);
      for (const c of arr) {
        const k = elementKeyFromRoomId(c.id);
        if (k) out[k] = c;
      }
    }
  } catch { /* ignore */ }
  return out;
}

/** 단일 방 대화 로드 (없으면 빈 방) */
export function loadRoom(profileId: string, key: ElementKey): StoredConversation {
  return loadRooms(profileId)[key];
}

/**
 * 단일 방 대화 저장 (질문 30개 트림).
 * 참고: 5방 전환 이전의 레거시 free-form 대화(uuid·c- ID)는 의도적으로 삭제하지 않는다.
 *       loadRooms 가 방 ID(`${pid}::${key}`)만 매핑하므로 레거시는 무시될 뿐이며,
 *       조용한 데이터 손실을 피하려 localStorage 에 그대로 보존한다.
 */
export function saveRoom(profileId: string, conv: StoredConversation) {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY(profileId));
    const arr: StoredConversation[] = raw ? JSON.parse(raw) : [];
    const trimmedConv: StoredConversation = { ...conv, messages: trimToMaxQuestions(conv.messages) };
    const idx = arr.findIndex(c => c.id === conv.id);
    if (idx >= 0) arr[idx] = trimmedConv; else arr.push(trimmedConv);
    localStorage.setItem(CONVERSATIONS_KEY(profileId), JSON.stringify(arr));
    localStorage.setItem(ACTIVE_KEY(profileId), conv.id);
  } catch { /* ignore */ }
}

/**
 * 5방 전환 이전의 레거시 자유대화(uuid·c- ID)를 모두 시간순으로 본인 물상(defaultKey) 방에 합친다.
 * - 여러 자유대화의 메시지를 createdAt 오름차순으로 병합(이미 물상 방에 있던 메시지와도 시간순 병합).
 * - 질문 30개 한도(trimToMaxQuestions) 적용 → 초과 시 가장 오래된 질문·답변부터 제거.
 * - 이관 후 레거시 항목은 제거. 멱등(레거시가 없으면 즉시 반환).
 * 반환: 이관이 실제로 일어났으면 true.
 */
export function migrateLegacyToRoom(profileId: string, defaultKey: ElementKey): boolean {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY(profileId));
    if (!raw) return false;
    const arr: StoredConversation[] = JSON.parse(raw);
    const legacy = arr.filter(c => !elementKeyFromRoomId(c.id));
    if (legacy.length === 0) return false; // 이미 이관됨 (멱등)

    const roomId = ROOM_ID(profileId, defaultKey);
    const existingRoom = arr.find(c => c.id === roomId);
    const merged = [
      ...legacy.flatMap(c => c.messages),
      ...(existingRoom?.messages ?? []),
    ].sort((a, b) => a.createdAt - b.createdAt);

    const roomConv: StoredConversation = {
      id: roomId,
      title: getElement(defaultKey).name,
      messages: trimToMaxQuestions(merged),
      updatedAt: merged.length ? merged[merged.length - 1].createdAt : Date.now(),
    };

    // 레거시 전부 제거 + 다른 방(룸 ID)은 보존 + 물상 방 교체/추가
    const next = arr.filter(c => elementKeyFromRoomId(c.id) && c.id !== roomId);
    next.push(roomConv);
    localStorage.setItem(CONVERSATIONS_KEY(profileId), JSON.stringify(next));
    return true;
  } catch { return false; }
}

export const QUICK_QUESTIONS = [
  '올해 재물운은 어떤가요?',
  '요즘 연애운이 궁금해요',
  '이직을 고민 중인데 올해 해도 될까요?',
  '건강운 어떤지 봐주세요',
  '내가 조심해야 할 게 뭔가요?',
];

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

