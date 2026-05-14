'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';
import { type ConsultationStatus } from '../constants/prompts';
import { BackButton } from '../components/ui/BackButton';
import {
  type StoredConversation,
  STATUS_KEY,
  RELATIONSHIP_PRESETS,
  CONCERN_PRESETS,
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
  const [status, setStatus] = useState<ConsultationStatus>({});
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [jobInput, setJobInput] = useState('');
  const [relationshipSelect, setRelationshipSelect] = useState('');
  const [customRelationship, setCustomRelationship] = useState('');
  const [concernSelect, setConcernSelect] = useState('');
  const [customConcern, setCustomConcern] = useState('');

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

  // 프로필 전환 시 대화목록·상태 로드
  useEffect(() => {
    if (!selectedProfileId) return;
    if (typeof window === 'undefined') return;

    try {
      const raw = localStorage.getItem(STATUS_KEY(selectedProfileId));
      setStatus(raw ? JSON.parse(raw) : {});
    } catch { setStatus({}); }

    const { conversations: loaded } = loadConversations(selectedProfileId);
    setConversations(loaded);
  }, [selectedProfileId]);

  const saveStatus = () => {
    if (!selectedProfileId) return;
    const finalRelationship = relationshipSelect === '기타' ? customRelationship.trim() : relationshipSelect;
    const finalConcern = concernSelect === '기타' ? customConcern.trim() : concernSelect;
    const next: ConsultationStatus = {
      relationshipStatus: finalRelationship || undefined,
      job: jobInput.trim() || undefined,
      concern: finalConcern || undefined,
    };
    setStatus(next);
    try { localStorage.setItem(STATUS_KEY(selectedProfileId), JSON.stringify(next)); } catch { /* ignore */ }
    setStatusModalOpen(false);
  };

  const openStatusModal = () => {
    const current = status.relationshipStatus || '';
    if (RELATIONSHIP_PRESETS.includes(current)) {
      setRelationshipSelect(current);
      setCustomRelationship('');
    } else if (current) {
      setRelationshipSelect('기타');
      setCustomRelationship(current);
    } else {
      setRelationshipSelect('');
      setCustomRelationship('');
    }
    setJobInput(status.job || '');
    const currentConcern = status.concern || '';
    if (CONCERN_PRESETS.includes(currentConcern)) {
      setConcernSelect(currentConcern);
      setCustomConcern('');
    } else if (currentConcern) {
      setConcernSelect('기타');
      setCustomConcern(currentConcern);
    } else {
      setConcernSelect('');
      setCustomConcern('');
    }
    setStatusModalOpen(true);
  };

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

      {/* 헤더 — 뒤로가기 좌측 + 중앙 정렬 타이틀 */}
      <div className="flex items-center relative mb-5 pt-3 px-1">
        <BackButton to="/" className="absolute left-0" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            상담소
          </h1>
        </div>
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
          {/* 상태 + 수정 */}
          <div className="px-5 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1.5 text-[12px]">
                {status.relationshipStatus && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300">
                    연애 · {status.relationshipStatus}
                  </span>
                )}
                {status.job && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300">
                    직업 · {status.job}
                  </span>
                )}
                {status.concern && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                    고민 · {status.concern}
                  </span>
                )}
                {!status.relationshipStatus && !status.job && !status.concern && (
                  <span className="text-text-tertiary text-[13px]">상태를 설정하면 더 정확한 답변을 받아요</span>
                )}
              </div>
              <button onClick={openStatusModal} className="text-[13px] text-cta hover:text-cta/80 font-medium flex-shrink-0 ml-2">
                상태 수정
              </button>
            </div>
          </div>

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

      {/* 상태 수정 모달 */}
      <AnimatePresence>
        {statusModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setStatusModalOpen(false)}
              className="fixed inset-0 z-[80] bg-black/60"
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[81] w-[min(420px,calc(100vw-32px))] max-h-[calc(100dvh-80px)] overflow-y-auto bg-[rgba(20,12,38,0.98)] border border-white/15 rounded-2xl p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[16px] font-bold text-text-primary">현재 상태 수정</p>
                  <p className="text-[13px] text-text-tertiary mt-0.5">답변 개인화를 위한 참고 정보</p>
                </div>
                <button onClick={() => setStatusModalOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary">
                  ✕
                </button>
              </div>

              <div className="mb-4">
                <p className="text-[13px] font-semibold text-text-secondary mb-2 uppercase tracking-wider">연애상태</p>
                <div className="flex flex-wrap gap-1.5">
                  {RELATIONSHIP_PRESETS.map(r => (
                    <button
                      key={r}
                      onClick={() => setRelationshipSelect(r)}
                      className={`px-3 py-1.5 rounded-full text-[14px] font-medium border transition-all
                        ${relationshipSelect === r ? 'bg-cta/25 border-cta/60 text-cta' : 'bg-white/5 border-white/10 text-text-secondary hover:border-white/20'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {relationshipSelect === '기타' && (
                  <input
                    type="text" value={customRelationship}
                    onChange={e => setCustomRelationship(e.target.value)}
                    placeholder="직접 입력 (예: 장거리 연애중)" maxLength={30}
                    className="w-full mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-text-primary text-[15px] placeholder-text-tertiary focus:border-cta/50 focus:outline-none"
                  />
                )}
              </div>

              <div className="mb-4">
                <p className="text-[13px] font-semibold text-text-secondary mb-2 uppercase tracking-wider">직업 / 일</p>
                <input
                  type="text" value={jobInput}
                  onChange={e => setJobInput(e.target.value)}
                  placeholder="예: IT 회사 대표, 대학생, 취업 준비중" maxLength={50}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-text-primary text-[15px] placeholder-text-tertiary focus:border-cta/50 focus:outline-none"
                />
              </div>

              <div className="mb-5">
                <p className="text-[13px] font-semibold text-text-secondary mb-2 uppercase tracking-wider">요즘 고민 키워드</p>
                <div className="flex flex-wrap gap-1.5">
                  {CONCERN_PRESETS.map(c => (
                    <button
                      key={c}
                      onClick={() => setConcernSelect(concernSelect === c ? '' : c)}
                      className={`px-3 py-1.5 rounded-full text-[14px] font-medium border transition-all
                        ${concernSelect === c ? 'bg-cta/25 border-cta/60 text-cta' : 'bg-white/5 border-white/10 text-text-secondary hover:border-white/20'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {concernSelect === '기타' && (
                  <input
                    type="text" value={customConcern}
                    onChange={e => setCustomConcern(e.target.value)}
                    placeholder="직접 입력 (예: 부동산 투자, 자녀 교육)" maxLength={30}
                    className="w-full mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-text-primary text-[15px] placeholder-text-tertiary focus:border-cta/50 focus:outline-none"
                  />
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStatusModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-white/15 text-text-secondary font-medium text-[15px]">
                  취소
                </button>
                <button onClick={saveStatus} className="flex-1 py-2.5 rounded-xl bg-cta text-white font-bold text-[15px]">
                  저장
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
