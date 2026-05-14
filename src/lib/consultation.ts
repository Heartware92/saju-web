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

export const MAX_CONVERSATIONS_PER_PROFILE = 20;
export const MAX_MESSAGES_PER_CONVERSATION = 50;

export const QUICK_QUESTIONS = [
  '올해 재물운은 어떤가요?',
  '요즘 연애운이 궁금해요',
  '이직을 고민 중인데 올해 해도 될까요?',
  '건강운 어떤지 봐주세요',
  '내가 조심해야 할 게 뭔가요?',
];

export function newConversation(): StoredConversation {
  return {
    id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `c-${Date.now()}-${Math.random()}`,
    title: '새 대화',
    messages: [],
    updatedAt: Date.now(),
  };
}

export function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return '새 대화';
  return firstUser.content.slice(0, 24).trim() || '새 대화';
}

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

/**
 * 프로필별 대화 목록 로드 (레거시 마이그레이션 포함)
 */
export function loadConversations(profileId: string): { conversations: StoredConversation[]; activeId: string } {
  let loadedConvs: StoredConversation[] = [];
  try {
    const rawConvs = localStorage.getItem(CONVERSATIONS_KEY(profileId));
    if (rawConvs) {
      loadedConvs = JSON.parse(rawConvs);
    } else {
      const legacyRaw = localStorage.getItem(LEGACY_HISTORY_KEY(profileId));
      if (legacyRaw) {
        const legacyMessages: ChatMessage[] = JSON.parse(legacyRaw);
        if (legacyMessages.length > 0) {
          const migrated: StoredConversation = {
            ...newConversation(),
            messages: legacyMessages,
            title: deriveTitle(legacyMessages),
          };
          loadedConvs = [migrated];
        }
        localStorage.removeItem(LEGACY_HISTORY_KEY(profileId));
      }
    }
  } catch {
    loadedConvs = [];
  }

  let activeId = '';
  try {
    activeId = localStorage.getItem(ACTIVE_KEY(profileId)) || '';
  } catch { /* ignore */ }

  if (loadedConvs.length === 0) {
    const fresh = newConversation();
    loadedConvs = [fresh];
    activeId = fresh.id;
  } else if (!activeId || !loadedConvs.find(c => c.id === activeId)) {
    activeId = [...loadedConvs].sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
  }

  return { conversations: loadedConvs, activeId };
}

/**
 * 대화 목록 저장 (크기 제한 포함)
 */
export function saveConversations(profileId: string, conversations: StoredConversation[], activeId: string) {
  try {
    const trimmed = conversations
      .map(c => ({
        ...c,
        messages: c.messages.length > MAX_MESSAGES_PER_CONVERSATION
          ? c.messages.slice(-MAX_MESSAGES_PER_CONVERSATION)
          : c.messages,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CONVERSATIONS_PER_PROFILE);
    localStorage.setItem(CONVERSATIONS_KEY(profileId), JSON.stringify(trimmed));
    localStorage.setItem(ACTIVE_KEY(profileId), activeId);
  } catch { /* ignore */ }
}
