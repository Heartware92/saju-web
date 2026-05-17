'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';
import { useCreditStore } from '../store/useCreditStore';
import { computeSajuFromProfile } from '../utils/profileSaju';
import { buildConsultationSystemPrompt } from '../constants/prompts';
import { sanitizeAIOutput } from '../services/fortuneService';
import { supabase } from '../services/supabase';
import { MOON_COST_CONSULTATION_QUESTION, CHARGE_REASONS } from '../constants/creditCosts';
import {
  type ChatMessage,
  type StoredConversation,
  CONVERSATIONS_KEY,
  QUICK_QUESTIONS,
  newConversation,
  deriveTitle,
  loadConversations,
  saveConversations,
} from '../lib/consultation';
import StarfallBackground from '../components/StarfallBackground';

// 탭바 — Layout.tsx 의 nav 와 동일. 채팅 페이지가 자체 viewport-fit 컨테이너라 직접 사용
const CHAT_TAB_ITEMS = [
  { path: '/', label: '홈', icon: 'home' },
  { path: '/sangdamso', label: '상담소', icon: 'chat' },
  { path: '/tarot', label: '타로', icon: 'card' },
  { path: '/archive', label: '보관함', icon: 'archive' },
];

function ChatTabIcon({ name, active }: { name: string; active: boolean }) {
  const color = active ? 'var(--cta-primary)' : 'var(--text-tertiary)';
  const size = 22;
  switch (name) {
    case 'home':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9,22 9,12 15,12 15,22" />
        </svg>
      );
    case 'chat':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a8.5 8.5 0 0 1-12.4 7.56L3 21l1.44-4.56A8.5 8.5 0 1 1 21 12Z" />
          <circle cx="9" cy="12" r="0.9" fill={color} stroke="none" />
          <circle cx="12" cy="12" r="0.9" fill={color} stroke="none" />
          <circle cx="15" cy="12" r="0.9" fill={color} stroke="none" />
        </svg>
      );
    case 'card':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <circle cx="12" cy="12" r="3" fill={active ? color : 'none'} />
        </svg>
      );
    case 'archive':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="5" rx="1" />
          <path d="M4 8v11a2 2 0 002 2h12a2 2 0 002-2V8" />
          <path d="M10 12h4" />
        </svg>
      );
    default:
      return null;
  }
}

export default function ConsultationChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const pid = searchParams?.get('pid') || '';
  const cid = searchParams?.get('cid') || '';

  const { user } = useUserStore();
  const { profiles, fetchProfiles } = useProfileStore();
  const { moonBalance, fetchBalance, chargeForContent } = useCreditStore();

  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);
  const [ready, setReady] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef<{ accumulated: string; botMsgId: string; profileId: string; convId: string } | null>(null);
  // followups 요청 시 최신 messages 참조 (setMessages 비동기 + fetch closure stale 회피)
  const messagesRef = useRef<ChatMessage[]>([]);

  const activeConv = useMemo(
    () => conversations.find(c => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );
  const messages = activeConv?.messages ?? [];
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const setMessages = useCallback((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== activeConversationId) return c;
      const nextMessages = typeof updater === 'function' ? updater(c.messages) : updater;
      return { ...c, messages: nextMessages, title: deriveTitle(nextMessages), updatedAt: Date.now() };
    }));
  }, [activeConversationId]);

  const selectedProfile = useMemo(() => profiles.find(p => p.id === pid) ?? null, [profiles, pid]);

  const saju = useMemo(() => {
    if (!selectedProfile) return null;
    return computeSajuFromProfile(selectedProfile);
  }, [selectedProfile]);

  // 초기화
  useEffect(() => {
    if (user) { fetchProfiles(); fetchBalance(); }
  }, [user, fetchProfiles, fetchBalance]);

  // 프로필 로드 후 대화 로드
  useEffect(() => {
    if (!pid || profiles.length === 0) return;
    if (!profiles.find(p => p.id === pid)) {
      router.replace('/sangdamso');
      return;
    }

    const { conversations: loaded, activeId } = loadConversations(pid);

    if (cid === 'new') {
      const existing = loaded.find(c => c.messages.length === 0);
      if (existing) {
        setConversations(loaded);
        setActiveConversationId(existing.id);
      } else {
        const fresh = newConversation();
        setConversations([fresh, ...loaded]);
        setActiveConversationId(fresh.id);
      }
    } else if (cid && loaded.find(c => c.id === cid)) {
      setConversations(loaded);
      setActiveConversationId(cid);
    } else {
      setConversations(loaded);
      setActiveConversationId(activeId);
    }

    setReady(true);
  }, [pid, cid, profiles, router]);

  // 자동 저장 (localStorage)
  useEffect(() => {
    if (!pid || conversations.length === 0 || !ready) return;
    saveConversations(pid, conversations, activeConversationId);
  }, [conversations, activeConversationId, pid, ready]);

  // DB 동기화 — 대화에 메시지가 있을 때 서버에 저장
  const syncToDb = useCallback(async (conv: StoredConversation) => {
    if (!conv || conv.messages.length === 0) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) return;
      await fetch('/api/consultation/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          profileId: pid,
          profileName: selectedProfile?.name ?? '',
          conversationId: conv.id,
          title: conv.title,
          messages: conv.messages,
        }),
      });
    } catch { /* silent */ }
  }, [pid, selectedProfile?.name]);

  // DB 동기화 — 대화가 변경되고 스트리밍 중이 아닐 때 서버에 저장
  useEffect(() => {
    if (!pid || !ready || loading) return;
    const conv = conversations.find(c => c.id === activeConversationId);
    if (!conv || conv.messages.length === 0) return;
    const timer = setTimeout(() => syncToDb(conv), 1500);
    return () => clearTimeout(timer);
  }, [conversations, activeConversationId, pid, ready, loading, syncToDb]);

  // 자동 스크롤 — 단, 사용자가 위로 스크롤해서 이전 답변을 읽고 있으면 따라가지 않음.
  // 사용 케이스: 답변 스트리밍 끝난 뒤 "이어서 물어볼까요" followups 가 setMessages 로 추가되면
  // messages 변경 트리거되어 스크롤이 또 바닥으로 점프 → 사용자가 위에서 읽다가 화면이 튐.
  // bottom 으로부터 120px 이내(거의 바닥) 일 때만 자동 스크롤 유지.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom > 120) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // 이탈 경고
  useEffect(() => {
    if (!loading) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [loading]);

  // 언마운트 시 부분 응답 저장
  useEffect(() => {
    return () => {
      if (streamingRef.current) {
        const { accumulated, botMsgId, profileId, convId } = streamingRef.current;
        if (accumulated) {
          const partial = sanitizeAIOutput(accumulated);
          try {
            const rawConvs = localStorage.getItem(CONVERSATIONS_KEY(profileId));
            if (rawConvs) {
              const convs: StoredConversation[] = JSON.parse(rawConvs);
              const updated = convs.map(c => {
                if (c.id !== convId) return c;
                return { ...c, messages: c.messages.map(m => m.id === botMsgId ? { ...m, content: partial } : m), updatedAt: Date.now() };
              });
              localStorage.setItem(CONVERSATIONS_KEY(profileId), JSON.stringify(updated));
            }
          } catch { /* ignore */ }
        }
      }
      abortRef.current?.abort();
    };
  }, []);

  const handleSend = async (questionOverride?: string) => {
    const question = (questionOverride ?? inputText).trim();
    if (!question || loading || !saju || !selectedProfile) return;

    if (moonBalance < MOON_COST_CONSULTATION_QUESTION) {
      setShowInsufficientModal(true);
      return;
    }

    setError('');
    setInputText('');
    const profileAtSend = pid;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID?.() ?? `u-${Date.now()}-${Math.random()}`,
      role: 'user',
      content: question,
      createdAt: Date.now(),
    };

    // 질문 1개당 달 1개 차감 (묻지 않고 즉시 차감, 잔액 0이면 위에서 차단됨)
    const charged = await chargeForContent(
      'moon',
      MOON_COST_CONSULTATION_QUESTION,
      CHARGE_REASONS.consultation,
      `consult:${activeConversationId}:${userMsg.id}`,
    );
    if (!charged) {
      setError('크레딧 차감에 실패했어요. 잠시 후 다시 시도해주세요.');
      return;
    }

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const botMsgId = crypto.randomUUID?.() ?? `a-${Date.now()}-${Math.random()}`;
    streamingRef.current = { accumulated: '', botMsgId, profileId: pid, convId: activeConversationId };

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('로그인이 필요합니다.');

      const systemPrompt = buildConsultationSystemPrompt(saju, {
        name: selectedProfile.name,
        birth_date: selectedProfile.birth_date,
        gender: selectedProfile.gender,
        calendar_type: selectedProfile.calendar_type,
      });

      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        content: m.content,
      }));

      const res = await fetch('/api/consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ systemPrompt, history, userMessage: question }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '응답 생성 실패');
      }
      if (!res.body) throw new Error('응답 본문이 비어 있습니다.');

      if (pid === profileAtSend) {
        setMessages(prev => [...prev, { id: botMsgId, role: 'assistant', content: '', createdAt: Date.now() }]);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let accumulated = '';
      let streamError: string | null = null;
      let gotDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = sseBuffer.indexOf('\n\n')) !== -1) {
          const frame = sseBuffer.slice(0, idx).trim();
          sseBuffer = sseBuffer.slice(idx + 2);
          if (!frame.startsWith('data:')) continue;
          const jsonStr = frame.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const parsed = JSON.parse(jsonStr) as { delta?: string; done?: boolean; error?: string };
            if (parsed.error) { streamError = parsed.error; continue; }
            if (parsed.done) { gotDone = true; continue; }
            if (parsed.delta) {
              accumulated += parsed.delta;
              streamingRef.current!.accumulated = accumulated;
              if (pid === profileAtSend) {
                const display = sanitizeAIOutput(accumulated).replace(/\*+/g, '');
                setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, content: display } : m));
              }
            }
          } catch { /* ignore */ }
        }
      }

      if (streamError) throw new Error(streamError);
      if (!gotDone && accumulated.length === 0) throw new Error('응답이 비어 있습니다.');

      const cleaned = sanitizeAIOutput(accumulated);
      if (pid === profileAtSend) {
        setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, content: cleaned } : m));
      }

      // 후속 질문 제안 — 이미 보낸 질문은 prevQuestions 로 서버에 알려 LLM 이 중복 회피
      if (pid === profileAtSend && cleaned) {
        const prevQuestions = [
          ...messagesRef.current.filter(m => m.role === 'user').map(m => m.content),
          question, // 현재 막 보낸 질문도 포함
        ];
        fetch('/api/consultation/followups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ lastQuestion: question, lastAnswer: cleaned, prevQuestions }),
        })
          .then(r => r.ok ? r.json() : null)
          .then((data: { suggestions?: string[] } | null) => {
            const suggestions = data?.suggestions ?? [];
            if (suggestions.length > 0 && pid === profileAtSend) {
              setMessages(prev => {
                // 이미 사용자가 보낸 질문 + QUICK_QUESTIONS(초기 칩) 모두 중복 제외
                // LLM 이 messages 컨텍스트를 모르므로 클라이언트가 필터링
                const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
                const sentQuestions = new Set<string>([
                  ...prev.filter(m => m.role === 'user').map(m => normalize(m.content)),
                  ...QUICK_QUESTIONS.map(q => normalize(q)),
                ]);
                // 새 질문(현재 막 보낸 question) 도 중복 제외
                sentQuestions.add(normalize(question));
                const dedup = suggestions.filter(s => !sentQuestions.has(normalize(s)));
                // 모두 필터링되면 빈 배열 — followups 영역 안 보임 (사용자 입장에선 자연스러움)
                return prev.map(m => m.id === botMsgId ? { ...m, followups: dedup } : m);
              });
            }
          })
          .catch(() => {});
      }
    } catch (e: unknown) {
      if ((e as Error)?.name === 'AbortError') return;
      setMessages(prev => prev.filter(m => m.id !== botMsgId));
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      streamingRef.current = null;
      abortRef.current = null;
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleBack = () => {
    abortRef.current?.abort();
    router.push('/sangdamso');
  };

  if (!ready || !selectedProfile) {
    return (
      <div className="app-auth-shell">
        <div className="app-auth-container flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-cta border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const showWelcome = messages.length === 0;
  const convTitle = activeConv?.title === '새 대화' ? '' : (activeConv?.title ?? '');

  return (
    // ★ outer 를 viewport 에 강제 박음 (position:fixed inset:0). body 스크롤 무관하게
    //   inner 가 항상 viewport 안에 fit. inner 는 flex-col + h-full + 마지막 자식이
    //   탭바라 입력창은 그 바로 위에 자연 stacking. height calc 없이 안전.
    <div
      className="app-auth-shell"
      style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', overflow: 'hidden' }}
    >
      <StarfallBackground />
      <div
        className="app-auth-container flex flex-col"
        style={{ width: '100%', maxWidth: '430px', height: '100%', overflow: 'hidden' }}
      >

        {/* 헤더 */}
        <div className="flex-shrink-0 flex items-center h-12 px-3 border-b border-[var(--border-subtle)] bg-[rgba(20,12,38,0.88)] backdrop-blur-xl">
          <button
            onClick={handleBack}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary transition-colors"
            aria-label="뒤로"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[15px] font-semibold text-text-primary truncate">
              {selectedProfile.name}
              {convTitle && <span className="font-normal text-text-tertiary"> · {convTitle}</span>}
            </p>
          </div>
          <span className="flex-shrink-0 text-right text-[11px] text-text-tertiary whitespace-nowrap">
            🌙 1개 소모
          </span>
        </div>

        {/* 메시지 영역 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {showWelcome && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="bg-[rgba(20,12,38,0.65)] border border-[var(--border-subtle)] rounded-2xl p-4 mb-4">
                <p className="text-[16px] text-text-primary leading-relaxed">
                  안녕하세요, <span className="font-bold text-cta">{selectedProfile.name}님</span>.
                </p>
                <p className="text-[15px] text-text-secondary leading-relaxed mt-2">
                  재물운·연애운·건강운 무엇이든 편하게 물어보세요.
                </p>
              </div>
              <p className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wider mb-2 px-1">
                이런 질문을 많이 해요
              </p>
              <div className="flex flex-col gap-2">
                {QUICK_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    disabled={loading}
                    className="text-left px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-[15px] text-text-secondary hover:border-cta/40 hover:text-text-primary transition-all disabled:opacity-40"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => {
              const isLast = idx === messages.length - 1;
              const isStreaming = loading && msg.role === 'assistant' && isLast;
              const showFollowups = !loading && msg.role === 'assistant' && isLast && (msg.followups?.length ?? 0) > 0;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                    {msg.role === 'assistant' && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/40 to-indigo-500/30 flex items-center justify-center text-sm mr-2 border border-white/15">
                        🌙
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-[16px] leading-[1.75] whitespace-pre-wrap
                        ${msg.role === 'user'
                          ? 'bg-cta/90 text-white rounded-tr-sm'
                          : 'bg-[rgba(20,12,38,0.75)] border border-[var(--border-subtle)] text-text-primary rounded-tl-sm'}`}
                    >
                      {msg.content}
                      {isStreaming && (
                        <span className="inline-block w-[8px] h-[14px] bg-cta/80 ml-0.5 -mb-0.5 align-middle animate-pulse" />
                      )}
                    </div>
                  </div>

                  {showFollowups && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="flex flex-col gap-1.5 mt-2 ml-10 max-w-[85%]"
                    >
                      <p className="text-[12px] font-medium text-text-tertiary uppercase tracking-wider px-1">이어서 물어볼까요</p>
                      {(msg.followups ?? []).map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(s)}
                          disabled={loading}
                          className="text-left px-3 py-2 rounded-xl bg-cta/10 border border-cta/30 text-[14px] text-cta hover:bg-cta/20 hover:border-cta/50 transition-all disabled:opacity-40"
                        >
                          {s}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {loading && (messages.length === 0 || messages[messages.length - 1]?.role === 'user') && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/40 to-indigo-500/30 flex items-center justify-center text-sm mr-2 border border-white/15">
                🌙
              </div>
              <div className="max-w-[85%] px-4 py-3 rounded-2xl bg-[rgba(20,12,38,0.75)] border border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-cta animate-pulse" style={{ animationDelay: '0s' }} />
                  <span className="inline-block w-2 h-2 rounded-full bg-cta animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <span className="inline-block w-2 h-2 rounded-full bg-cta animate-pulse" style={{ animationDelay: '0.4s' }} />
                  <span className="text-[14px] text-text-secondary ml-1">사주 데이터를 엮는 중...</span>
                </div>
              </div>
            </motion.div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-[15px] text-red-400 text-center">
              {error}
            </div>
          )}
        </div>

        {/* 입력창 — 탭바 바로 위에 자연 stacking. safe-area 는 탭바가 처리 */}
        <div className="flex-shrink-0 px-3 py-3 border-t border-[var(--border-subtle)] bg-[rgba(20,12,38,0.5)]">
          <div className="flex items-end gap-2">
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="무엇이든 물어보세요 (Enter 전송)"
              rows={1}
              maxLength={300}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-text-primary text-[16px] placeholder-text-tertiary focus:border-cta/50 focus:outline-none resize-none transition disabled:opacity-60"
              style={{ maxHeight: '100px' }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputText.trim() || loading}
              className="flex-shrink-0 w-11 h-11 rounded-full bg-cta text-white flex items-center justify-center active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="전송"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22,2 15,22 11,13 2,9 22,2" />
              </svg>
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[12px] text-text-tertiary">{inputText.length}/300</span>
            <span className="text-[12px] text-text-tertiary">
              질문 1개당 🌙 {MOON_COST_CONSULTATION_QUESTION}개 소모
              {moonBalance < MOON_COST_CONSULTATION_QUESTION && (
                <button onClick={() => router.push('/credit')} className="ml-2 text-cta underline font-semibold">
                  충전하기
                </button>
              )}
            </span>
          </div>
        </div>

        {/* 크레딧 부족 안내 모달 */}
        <AnimatePresence>
          {showInsufficientModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowInsufficientModal(false)}
                className="fixed inset-0 z-[80] bg-black/60"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-[81] flex items-center justify-center px-5 pointer-events-none"
              >
                <div className="w-full max-w-sm rounded-2xl bg-[rgba(20,12,38,0.98)] border border-cta/40 p-5 pointer-events-auto">
                  <h3 className="text-lg font-bold text-text-primary mb-1">🌙 크레딧이 부족해요</h3>
                  <p className="text-[13px] text-text-secondary mb-4 leading-relaxed">
                    상담소 질문 1개당 🌙 <b className="text-cta">{MOON_COST_CONSULTATION_QUESTION}개</b>가 소모돼요. 충전 후 다시 시도해주세요.
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setShowInsufficientModal(false);
                        router.push('/credit');
                      }}
                      className="py-3 rounded-xl bg-cta text-white font-semibold text-[15px]"
                    >
                      충전하러 가기
                    </button>
                    <button onClick={() => setShowInsufficientModal(false)} className="py-2 text-[13px] text-text-tertiary">
                      나중에
                    </button>
                  </div>
                  <p className="text-[11px] text-text-tertiary mt-3">현재 잔액: 🌙 {moonBalance}</p>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* 하단 탭바 — inner flex-col 의 마지막 자식. 입력창 바로 아래에 자연 stacking */}
        <nav
          className="flex-shrink-0 bg-[rgba(20,12,38,0.96)] border-t border-[var(--border-default)]"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div className="flex items-center justify-around h-16">
            {CHAT_TAB_ITEMS.map((item) => {
              const active = pathname === item.path
                || (item.path === '/sangdamso' && !!pathname?.startsWith('/sangdamso'));
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 min-w-[56px] ${active ? 'text-cta' : 'text-text-tertiary'}`}
                >
                  <div className="relative">
                    <ChatTabIcon name={item.icon} active={active} />
                    {active && (
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cta shadow-[0_0_6px_var(--cta-primary)]" />
                    )}
                  </div>
                  <span className="text-[12px] font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
