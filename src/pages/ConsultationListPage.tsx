'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';
import { computeSajuFromProfile } from '../utils/profileSaju';
import { supabase } from '../services/supabase';
import {
  ELEMENTS,
  type ElementKey,
  type ChatMessage,
  type StoredConversation,
  defaultElementKey,
  getElement,
  elementKeyFromRoomId,
  loadRooms,
  saveRoom,
  loadUnlockedElements,
  migrateLegacyToRoom,
  pickFresherConversation,
  formatRelativeTime,
} from '../lib/consultation';

export default function ConsultationListPage() {
  const router = useRouter();
  const { user } = useUserStore();
  const { profiles, fetchProfiles } = useProfileStore();

  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [rooms, setRooms] = useState<Record<ElementKey, StoredConversation> | null>(null);
  const [lockedNotice, setLockedNotice] = useState(false);

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

  // 선택된 프로필의 사주 → 본인 물상(디폴트 열린 방) 결정
  const defaultKey = useMemo<ElementKey | null>(() => {
    if (!selectedProfile) return null;
    const saju = computeSajuFromProfile(selectedProfile);
    return defaultElementKey(saju?.dayMasterElement);
  }, [selectedProfile]);

  const unlockedKeys = useMemo<Set<ElementKey>>(() => {
    if (!selectedProfileId || !defaultKey) return new Set();
    return new Set(loadUnlockedElements(selectedProfileId, defaultKey));
  }, [selectedProfileId, defaultKey]);

  // 본인 물상 방을 최상단으로, 나머지는 오행 순서(목·화·토·금·수)로 정렬
  const orderedElements = useMemo(() => {
    if (!defaultKey) return ELEMENTS;
    const mine = ELEMENTS.find(e => e.key === defaultKey);
    const rest = ELEMENTS.filter(e => e.key !== defaultKey);
    return mine ? [mine, ...rest] : ELEMENTS;
  }, [defaultKey]);

  // 프로필 전환 시 레거시 자유대화 → 본인 물상 방 이관(멱등) 후 방별 미리보기 로드
  // + DB(consultation_records) 하이드레이트 — 다른 기기/브라우저에서 나눈 대화도 목록에 보이게(크로스기기).
  useEffect(() => {
    if (!selectedProfileId || !defaultKey || typeof window === 'undefined') { setRooms(null); return; }
    migrateLegacyToRoom(selectedProfileId, defaultKey);
    setRooms(loadRooms(selectedProfileId));

    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('consultation_records')
          .select('conversation_id,messages,updated_at')
          .like('conversation_id', `${selectedProfileId}::%`);
        if (cancelled || !Array.isArray(data) || data.length === 0) return;
        setRooms(prev => {
          const next: Record<ElementKey, StoredConversation> = { ...(prev ?? loadRooms(selectedProfileId)) };
          for (const row of data) {
            const key = elementKeyFromRoomId(row.conversation_id as string);
            if (!key) continue;
            const dbConv: StoredConversation = {
              id: row.conversation_id as string,
              title: getElement(key).name,
              messages: Array.isArray(row.messages) ? (row.messages as ChatMessage[]) : [],
              updatedAt: row.updated_at ? new Date(row.updated_at as string).getTime() : Date.now(),
            };
            const merged = pickFresherConversation(next[key] ?? null, dbConv);
            if (merged) { next[key] = merged; saveRoom(selectedProfileId, merged); }
          }
          return next;
        });
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [selectedProfileId, defaultKey]);

  const handleOpenRoom = (key: ElementKey) => {
    if (!unlockedKeys.has(key)) { setLockedNotice(true); return; }
    router.push(`/sangdamso/chat?pid=${selectedProfileId}&el=${key}`);
  };

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
        <p className="text-text-secondary mb-4">상담소는 로그인 후 이용 가능합니다.</p>
        <Link href="/login?from=/sangdamso" className="text-cta font-semibold underline">로그인하기</Link>
      </div>
    );
  }

  return (
    <div className="pb-6">

      {/* 헤더 */}
      <div className="flex items-center relative mb-5 pt-3 px-1">
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            상담소
          </h1>
        </div>
        <span className="absolute right-2 text-[12px] text-text-tertiary">달 1개 소모</span>
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
        <div className="px-4">
          <p className="text-[13px] font-semibold text-text-tertiary uppercase tracking-wider mb-2 px-1">
            오행의 방
          </p>
          <p className="text-[13px] text-text-tertiary/80 mb-3 px-1 leading-relaxed">
            방마다 말투와 결이 달라요. <span className="text-text-secondary">본인 물상</span>의 방이 먼저 열려 있어요.
          </p>

          <div className="flex flex-col gap-2.5">
            {orderedElements.map(el => {
              const unlocked = unlockedKeys.has(el.key);
              const isDefault = defaultKey === el.key;
              const conv = rooms?.[el.key];
              const lastMsg = conv && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
              const preview = lastMsg
                ? (lastMsg.role === 'user' ? '나: ' : '') + lastMsg.content.slice(0, 38).trim()
                : '';

              return (
                <button
                  key={el.key}
                  onClick={() => handleOpenRoom(el.key)}
                  className={`group relative w-full text-left px-4 py-3.5 rounded-2xl border transition-all flex items-center gap-3.5
                    ${unlocked
                      ? 'bg-white/5 border-white/10 hover:border-cta/30 hover:bg-white/[0.07] active:scale-[0.99]'
                      : 'bg-white/[0.02] border-white/[0.06] opacity-70 hover:opacity-90'}`}
                >
                  {/* 오행 마크 */}
                  <span
                    className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-[20px] font-bold border"
                    style={{
                      color: unlocked ? el.accent : 'var(--text-tertiary)',
                      borderColor: unlocked ? `${el.accent}55` : 'rgba(255,255,255,0.08)',
                      background: unlocked ? `${el.accent}14` : 'rgba(255,255,255,0.02)',
                      fontFamily: 'var(--font-serif)',
                    }}
                  >
                    {el.hanja}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[15px] font-semibold text-text-primary truncate">{el.name}</p>
                      {isDefault && (
                        <span className="flex-shrink-0 text-[10px] font-semibold text-cta border border-cta/40 rounded px-1.5 py-0.5">
                          내 물상
                        </span>
                      )}
                    </div>
                    {/* 대화가 있을 때만 미리보기 표시 — 디폴트 안내 텍스트는 제거 */}
                    {unlocked ? (
                      preview ? (
                        <p className="text-[13px] text-text-tertiary truncate mt-0.5">{preview}</p>
                      ) : null
                    ) : (
                      <p className="text-[13px] text-text-tertiary/70 mt-0.5">준비 중인 방이에요</p>
                    )}
                    {unlocked && conv && conv.messages.length > 0 && (
                      <p className="text-[11px] text-text-tertiary/50 mt-1">
                        질문 {conv.messages.filter(m => m.role === 'user').length}개 · {formatRelativeTime(conv.updatedAt)}
                      </p>
                    )}
                  </div>

                  {/* 우측 표시: 열림=화살표 / 잠금=자물쇠 */}
                  <span className="flex-shrink-0 text-text-tertiary/50">
                    {unlocked ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {profiles.length === 0 && (
        <div className="text-center py-16 px-6">
          <p className="text-text-secondary mb-4">프로필을 먼저 등록해야 상담이 가능해요.</p>
          <Link href="/saju/input?mode=profile-only&from=sangdamso" className="text-cta font-semibold underline">프로필 등록</Link>
        </div>
      )}

      {/* 잠긴 방 안내 (껍데기 — 달 크레딧 해제 플로우는 추후) */}
      {lockedNotice && (
        <>
          <div onClick={() => setLockedNotice(false)} className="fixed inset-0 z-[80] bg-black/60" />
          <div className="fixed inset-0 z-[81] flex items-center justify-center px-5 pointer-events-none">
            <div className="w-full max-w-sm rounded-2xl bg-[rgba(20,12,38,0.98)] border border-cta/40 p-5 pointer-events-auto">
              <h3 className="text-lg font-bold text-text-primary mb-1">아직 잠긴 방이에요</h3>
              <p className="text-[13px] text-text-secondary mb-4 leading-relaxed">
                지금은 본인 물상의 방만 이용할 수 있어요. 해당 기능은 준비 중이에요.
              </p>
              <button
                onClick={() => setLockedNotice(false)}
                className="w-full py-3 rounded-xl bg-cta text-white font-semibold text-[15px]"
              >
                확인
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
