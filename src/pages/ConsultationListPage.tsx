'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';
import {
  type StoredConversation,
  loadConversations,
  formatRelativeTime,
  newConversation,
  saveConversations,
} from '../lib/consultation';

export default function ConsultationListPage() {
  const router = useRouter();
  const { user } = useUserStore();
  const { profiles, fetchProfiles } = useProfileStore();

  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [conversations, setConversations] = useState<StoredConversation[]>([]);

  useEffect(() => {
    if (user) fetchProfiles();
  }, [user, fetchProfiles]);

  // 기본 프로필 자동 선택
  useEffect(() => {
    if (!selectedProfileId && profiles.length > 0) {
      const primary = profiles.find(p => p.is_primary) ?? profiles[0];
      setSelectedProfileId(primary.id);
    }
  }, [profiles, selectedProfileId]);

  const selectedProfile = useMemo(
    () => profiles.find(p => p.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );

  // 프로필 전환 시 대화목록 로드
  useEffect(() => {
    if (!selectedProfileId) return;
    if (typeof window === 'undefined') return;

    const { conversations: loaded } = loadConversations(selectedProfileId);
    setConversations(loaded);
  }, [selectedProfileId]);

  const handleOpenChat = (conversationId: string) => {
    router.push(`/sangdamso/chat?pid=${selectedProfileId}&cid=${conversationId}`);
  };

  const handleNewChat = () => {
    router.push(`/sangdamso/chat?pid=${selectedProfileId}&cid=new`);
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('이 대화를 삭제할까요?')) return;
    const next = conversations.filter(c => c.id !== id);
    if (next.length === 0) {
      const fresh = newConversation();
      setConversations([fresh]);
      saveConversations(selectedProfileId, [fresh], fresh.id);
    } else {
      setConversations(next);
      saveConversations(selectedProfileId, next, next[0].id);
    }
  };

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
        <p className="text-text-secondary mb-4">상담소는 로그인 후 이용 가능합니다.</p>
        <Link href="/login?from=/sangdamso" className="text-cta font-semibold underline">로그인하기</Link>
      </div>
    );
  }

  const nonEmptyConvs = conversations.filter(c => c.messages.length > 0).sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="pb-6">

      {/* 헤더 — 메인 페이지라 뒤로가기 없음. 타이틀 + 우측 차감 안내 */}
      <div className="flex items-center relative mb-5 pt-3 px-1">
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            상담소
          </h1>
        </div>
        <span className="absolute right-2 text-[12px] text-text-tertiary">🌙 1개 소모</span>
      </div>

      {/* 프로필 선택 */}
      <div className="px-4 mb-4">
        <p className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wider mb-2 px-1">
          상담할 프로필 선택
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {profiles.map(p => {
            const isSelected = selectedProfileId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProfileId(p.id)}
                className={`flex-shrink-0 px-4 py-3 rounded-xl border transition-all text-left min-w-[120px]
                  ${isSelected
                    ? 'bg-cta/15 border-cta/50 ring-1 ring-cta/30'
                    : 'bg-white/5 border-white/10 hover:border-white/25'}`}
              >
                <p className={`text-[15px] font-semibold ${isSelected ? 'text-cta' : 'text-text-primary'}`}>
                  {p.name}
                  {p.is_primary && <span className="ml-1 text-[11px] text-cta/70">대표</span>}
                </p>
                <p className="text-[12px] text-text-tertiary mt-0.5">
                  {p.birth_date} · {p.gender === 'male' ? '남' : '여'}
                </p>
              </button>
            );
          })}
          <Link
            href="/saju/input?mode=profile-only&from=sangdamso"
            className="flex-shrink-0 flex items-center justify-center px-4 py-3 rounded-xl border border-dashed border-white/20 text-text-tertiary hover:border-white/40 hover:text-text-secondary transition-all min-w-[80px]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </Link>
        </div>
      </div>

      {selectedProfile && (
        <>
          {/* 새 대화 시작 */}
          <div className="px-4 mb-3">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cta/15 border border-cta/40 text-cta font-semibold text-[15px] hover:bg-cta/25 active:scale-[0.98] transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              새 대화 시작
            </button>
          </div>

          {/* 대화방 리스트 */}
          <div className="px-4">
            {nonEmptyConvs.length > 0 && (
              <p className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wider mb-2 px-1">
                이전 대화 · {nonEmptyConvs.length}개
              </p>
            )}
            <div className="flex flex-col gap-2">
              {nonEmptyConvs.map(c => {
                const lastMsg = c.messages[c.messages.length - 1];
                const preview = lastMsg
                  ? (lastMsg.role === 'user' ? '나: ' : '') + lastMsg.content.slice(0, 40).trim()
                  : '';
                return (
                  <button
                    key={c.id}
                    onClick={() => handleOpenChat(c.id)}
                    className="group relative w-full text-left px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-cta/30 hover:bg-white/[0.07] transition-all"
                  >
                    <p className="text-[15px] font-medium text-text-primary truncate pr-8">{c.title}</p>
                    {preview && (
                      <p className="text-[13px] text-text-tertiary truncate mt-0.5">{preview}</p>
                    )}
                    <p className="text-[11px] text-text-tertiary/60 mt-1">
                      {c.messages.length}개 메시지 · {formatRelativeTime(c.updatedAt)}
                    </p>
                    <button
                      onClick={(e) => handleDeleteConversation(c.id, e)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary/40 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                      aria-label="삭제"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </button>
                );
              })}
            </div>

            {nonEmptyConvs.length === 0 && (
              <div className="text-center py-12">
                <p className="text-[15px] text-text-tertiary">아직 대화 기록이 없어요.</p>
                <p className="text-[13px] text-text-tertiary/60 mt-1">새 대화를 시작해보세요!</p>
              </div>
            )}
          </div>
        </>
      )}

      {profiles.length === 0 && (
        <div className="text-center py-16 px-6">
          <p className="text-text-secondary mb-4">프로필을 먼저 등록해야 상담이 가능해요.</p>
          <Link href="/saju/input?mode=profile-only&from=sangdamso" className="text-cta font-semibold underline">프로필 등록</Link>
        </div>
      )}
    </div>
  );
}
