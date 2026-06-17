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
import { supabase } from '../services/supabase';
import { useFortuneJob } from '../hooks/useFortuneJob';
import { MOON_COST_CONSULTATION_QUESTION } from '../constants/creditCosts';
import {
  type ChatMessage,
  type StoredConversation,
  type ElementKey,
  QUICK_QUESTIONS,
  getElement,
  defaultElementKey,
  loadUnlockedElements,
  loadRoom,
  saveRoom,
  migrateLegacyToRoom,
  trimToMaxQuestions,
  pickFresherConversation,
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
  const elParam = searchParams?.get('el') || '';

  const { user } = useUserStore();
  const { profiles, fetchProfiles } = useProfileStore();
  const { moonBalance, fetchBalance } = useCreditStore();

  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);
  const [ready, setReady] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  // 타이핑 효과 — 백그라운드 답변을 타자기처럼 점진 노출(스트리밍 느낌 복원). { 메시지id, 노출 글자수 }
  const [typing, setTyping] = useState<{ id: string; n: number } | null>(null);
  const justAnsweredRef = useRef(false); // 잡 완료 직후 도착한 답변만 애니메이션(기존 대화 하이드레이트는 즉시 표시)
  const animatedRef = useRef<Set<string>>(new Set());

  const scrollRef = useRef<HTMLDivElement>(null);

  // 백그라운드 잡 구독 (saju_records 캐리어) — 답변은 서버가 생성·DB 기록, 클라는 폴링만.
  const { job: consultJob } = useFortuneJob(activeJobId, 'saju_records');

  const activeConv = useMemo(
    () => conversations.find(c => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );
  const messages = activeConv?.messages ?? [];

  const setMessages = useCallback((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== activeConversationId) return c;
      // 방 제목은 오행 방 이름 고정. 질문 30개 초과 시 가장 오래된 질문·답변부터 슬라이딩 제거.
      const nextMessages = trimToMaxQuestions(typeof updater === 'function' ? updater(c.messages) : updater);
      return { ...c, messages: nextMessages, updatedAt: Date.now() };
    }));
  }, [activeConversationId]);

  const selectedProfile = useMemo(() => profiles.find(p => p.id === pid) ?? null, [profiles, pid]);

  const saju = useMemo(() => {
    if (!selectedProfile) return null;
    return computeSajuFromProfile(selectedProfile);
  }, [selectedProfile]);

  // 본인 물상(디폴트 열린 방). 요청된 el 이 없거나 잠겨 있으면 디폴트 방으로.
  const defaultKey = useMemo<ElementKey>(() => defaultElementKey(saju?.dayMasterElement), [saju]);
  const elementKey = useMemo<ElementKey>(() => {
    if (!saju) return defaultKey;
    const unlocked = loadUnlockedElements(pid, defaultKey);
    return unlocked.find(k => k === elParam) ?? defaultKey;
  }, [saju, defaultKey, elParam, pid]);
  const room = getElement(elementKey);

  // DB(consultation_records)에서 방을 읽어 로컬과 병합 — 크로스기기 하이드레이트.
  const hydrateRoomFromDb = useCallback(async (roomId: string) => {
    try {
      const { data } = await supabase
        .from('consultation_records')
        .select('conversation_id,messages,updated_at')
        .eq('conversation_id', roomId)
        .maybeSingle();
      if (!data) return;
      const dbConv: StoredConversation = {
        id: roomId,
        title: getElement(elementKey).name,
        messages: Array.isArray(data.messages) ? (data.messages as ChatMessage[]) : [],
        updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : Date.now(),
      };
      setConversations(prev => {
        const local = prev.find(c => c.id === roomId) ?? null;
        const merged = pickFresherConversation(local, dbConv) ?? dbConv;
        saveRoom(pid, merged);
        return prev.some(c => c.id === roomId) ? prev.map(c => c.id === roomId ? merged : c) : [merged];
      });
    } catch { /* ignore */ }
  }, [elementKey, pid]);

  // 초기화
  useEffect(() => {
    if (user) { fetchProfiles(); fetchBalance(); }
  }, [user, fetchProfiles, fetchBalance]);

  // 프로필 로드 후 방(오행 대화) 로드 + DB 하이드레이트 + 진행 중 잡 폴링 재개
  useEffect(() => {
    if (!pid || profiles.length === 0) return;
    if (!profiles.find(p => p.id === pid)) { router.replace('/sangdamso'); return; }
    // 사주 계산 실패 프로필 — 무한 로딩 방지 폴백
    if (!saju) { router.replace('/sangdamso'); return; }
    // 잠긴 방 직접 접근(URL) 차단 → 목록으로
    const unlocked = loadUnlockedElements(pid, defaultKey);
    if (elParam && !unlocked.some(k => k === elParam)) { router.replace('/sangdamso'); return; }

    // 레거시 자유대화 → 본인 물상 방 이관(멱등) 후 방 로드
    migrateLegacyToRoom(pid, defaultKey);
    const conv = loadRoom(pid, elementKey);
    setConversations([conv]);
    setActiveConversationId(conv.id);
    setReady(true);

    // 크로스기기: DB 에서 읽어 병합 (다른 기기에서 나눈 대화도 보이게)
    void hydrateRoomFromDb(conv.id);

    // 재진입 시 진행 중 잡이 있으면 폴링 재개 (브라우저 닫았다 들어와도 답변이 붙음)
    const pendingMsg = conv.messages.find(m => m.pending && m.jobId);
    if (pendingMsg?.jobId) { setActiveJobId(pendingMsg.jobId); setLoading(true); }
  }, [pid, elementKey, elParam, defaultKey, profiles, saju, router, hydrateRoomFromDb]);

  // 자동 저장 (localStorage)
  useEffect(() => {
    if (!pid || conversations.length === 0 || !ready) return;
    const conv = conversations.find(c => c.id === activeConversationId);
    if (conv) saveRoom(pid, conv);
  }, [conversations, activeConversationId, pid, ready]);

  // 백그라운드 잡 결과 반영 — done 이면 DB(권위본)에서 답변+후속질문 하이드레이트, failed 면 환불 안내.
  useEffect(() => {
    if (!consultJob || !activeJobId) return;
    if (consultJob.status === 'done') {
      justAnsweredRef.current = true; // 이번 잡 답변은 타자기 애니메이션 대상
      void hydrateRoomFromDb(activeConversationId);
      setActiveJobId(null);
      setLoading(false);
      fetchBalance();
    } else if (consultJob.status === 'failed') {
      setError(consultJob.errorMessage ?? '답변 생성에 실패했어요. 크레딧은 자동 환불됐어요.');
      setConversations(prev => prev.map(c => c.id === activeConversationId
        ? { ...c, messages: c.messages.filter(m => !m.pending) } : c));
      setActiveJobId(null);
      setLoading(false);
      fetchBalance();
    }
  }, [consultJob?.status, activeJobId, activeConversationId, hydrateRoomFromDb, fetchBalance, consultJob?.errorMessage]);

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
  }, [messages, loading, typing?.n]);

  // 타이핑 트리거 — 잡 완료로 새 답변이 도착하면(justAnswered) 그 답변을 타자기처럼 노출 시작.
  // 기존 대화 하이드레이트/재진입은 즉시 표시(애니메이션 안 함).
  useEffect(() => {
    if (!justAnsweredRef.current) return;
    const last = [...messages].reverse().find(m => m.role === 'assistant' && !m.pending && m.content);
    if (!last || animatedRef.current.has(last.id)) return;
    justAnsweredRef.current = false;
    animatedRef.current.add(last.id);
    setTyping({ id: last.id, n: 0 });
  }, [messages]);

  // 타이핑 진행 — 글자 점진 노출(타자기). 완료되면 typing 해제.
  useEffect(() => {
    if (!typing) return;
    const full = messages.find(m => m.id === typing.id)?.content ?? '';
    if (typing.n >= full.length) { setTyping(null); return; }
    const t = setTimeout(() => setTyping(x => (x ? { ...x, n: Math.min(full.length, x.n + 4) } : null)), 16);
    return () => clearTimeout(t);
  }, [typing, messages]);

  // 방 진입 시 1회 — 가장 최근(최하단) 대화로 포커싱 (smooth 아닌 즉시 점프)
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (!ready || didInitialScroll.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    didInitialScroll.current = true;
  }, [ready, messages.length]);

  const handleSend = async (questionOverride?: string) => {
    const question = (questionOverride ?? inputText).trim();
    if (!question || loading || !saju || !selectedProfile) return;

    if (moonBalance < MOON_COST_CONSULTATION_QUESTION) {
      setShowInsufficientModal(true);
      return;
    }

    setError('');
    setInputText('');

    const userMsg: ChatMessage = {
      id: crypto.randomUUID?.() ?? `u-${Date.now()}-${Math.random()}`,
      role: 'user',
      content: question,
      createdAt: Date.now(),
    };
    const placeholderId = crypto.randomUUID?.() ?? `a-${Date.now()}-${Math.random()}`;

    // 잡에 보낼 이전 대화(진행 중 placeholder 제외)
    const history = messages
      .filter(m => !m.pending)
      .map(m => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt }));

    // 낙관적 표시: 질문 + "생성 중" placeholder
    setMessages(prev => [
      ...prev,
      userMsg,
      { id: placeholderId, role: 'assistant', content: '', createdAt: Date.now(), pending: true },
    ]);
    setLoading(true);

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
      const sourceBirth = {
        birthDate: selectedProfile.birth_date,
        birthTime: selectedProfile.birth_time ?? null,
        birthPlace: selectedProfile.birth_place ?? null,
        gender: selectedProfile.gender,
        calendarType: selectedProfile.calendar_type,
      };

      // 백그라운드 잡 생성 — 답변은 서버가 생성·DB 기록(무중단·크로스기기). 차감도 라우트가 멱등 처리.
      const res = await fetch('/api/fortune/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          category: 'consultation',
          systemPrompt,
          history,
          userMessage: question,
          userMessageId: userMsg.id,
          conversationId: activeConversationId,
          profileId: pid,
          profileName: selectedProfile.name,
          sourceBirth,
          idempotencyKey: `${activeConversationId}:${userMsg.id}`,
        }),
      });

      if (res.status === 402) {
        setShowInsufficientModal(true);
        setMessages(prev => prev.filter(m => m.id !== userMsg.id && m.id !== placeholderId));
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '요청에 실패했어요.');
      }
      const { jobId } = (await res.json()) as { jobId?: string };
      if (!jobId) throw new Error('잡 생성에 실패했어요.');

      // placeholder 에 jobId 부착(재진입 폴링 재개용) + 폴링 시작
      setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, jobId } : m));
      setActiveJobId(jobId);
      fetchBalance(); // 차감 즉시 반영
    } catch (e: unknown) {
      setMessages(prev => prev.filter(m => m.id !== userMsg.id && m.id !== placeholderId));
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleBack = () => {
    // 백그라운드 잡이라 나가도 서버가 답변을 끝까지 생성·저장 — 중단 없음.
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
  const convTitle = room.name;

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
              const isPending = msg.role === 'assistant' && !!msg.pending && !msg.content;
              const isTyping = typing?.id === msg.id;
              const showFollowups = !loading && !isTyping && msg.role === 'assistant' && isLast && (msg.followups?.length ?? 0) > 0;
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
                      {isPending ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full bg-cta animate-pulse" style={{ animationDelay: '0s' }} />
                          <span className="inline-block w-2 h-2 rounded-full bg-cta animate-pulse" style={{ animationDelay: '0.2s' }} />
                          <span className="inline-block w-2 h-2 rounded-full bg-cta animate-pulse" style={{ animationDelay: '0.4s' }} />
                          <span className="text-[14px] text-text-secondary ml-1">사주 데이터를 엮는 중...</span>
                        </div>
                      ) : isTyping ? (
                        <>
                          {msg.content.slice(0, typing!.n)}
                          <span className="inline-block w-[8px] h-[15px] bg-cta/80 ml-0.5 -mb-0.5 align-middle animate-pulse" />
                        </>
                      ) : (
                        msg.content
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
