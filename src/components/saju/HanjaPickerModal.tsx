'use client';

/**
 * 이름 풀이 — 한 음("허", "진" 등)에 해당하는 한자 후보를 그리드로 보여주는 모달.
 * 사용자가 카드를 탭하면 onSelect(candidate) 콜백으로 선택값 전달.
 *
 * 데이터: src/lib/data/hanjaByKoreanSound.ts (한국어문회 한자 5,758자, 자원오행 매핑 85%)
 * 라이센스: 사단법인 한국어문회 학습자료 (rycont/hanja-grade-dataset 정제)
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { lookupHanjaBySound, type HanjaCandidate } from '../../lib/data/hanjaByKoreanSound';

const JAWON_COLOR: Record<string, string> = {
  '木': '#22c55e',
  '火': '#ef4444',
  '土': '#eab308',
  '金': '#94a3b8',
  '水': '#3b82f6',
  '': 'transparent',
};

interface Props {
  open: boolean;
  sound: string;
  /** 현재 선택된 한자 (있으면 강조) */
  currentChar?: string;
  onSelect: (candidate: HanjaCandidate) => void;
  onClose: () => void;
}

export function HanjaPickerModal({ open, sound, currentChar, onSelect, onClose }: Props) {
  const [filter, setFilter] = useState('');

  // open 변경 시 검색어 초기화
  useEffect(() => {
    if (open) setFilter('');
  }, [open, sound]);

  // 모달 열린 동안 body 스크롤 차단
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const candidates = useMemo(() => lookupHanjaBySound(sound), [sound]);
  const filtered = useMemo(() => {
    const q = filter.trim();
    if (!q) return candidates;
    return candidates.filter(c =>
      c.char.includes(q)
      || c.meanings.some(m => m.includes(q))
      || c.radical.includes(q)
    );
  }, [candidates, filter]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 배경 dim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-black/60"
          />

          {/* 모달 본체 — 하단 시트 형태 */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 z-[81] mx-auto"
            style={{ maxWidth: '430px' }}
          >
            <div
              className="rounded-t-3xl border-t border-x border-[var(--border-default)] bg-[rgba(20,12,38,0.98)] flex flex-col"
              style={{
                maxHeight: '85vh',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              {/* 헤더 */}
              <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-[var(--border-subtle)]">
                {/* 핸들 (시각적 힌트) */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/15" />
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-[24px] font-bold text-cta leading-none"
                      style={{ fontFamily: 'var(--font-serif)' }}
                    >
                      {sound || '?'}
                    </span>
                    <span className="text-[13px] text-text-tertiary">자 후보</span>
                  </div>
                  <p className="text-[11px] text-text-tertiary mt-1">
                    {candidates.length}개 한자 · 자원오행 색 표시 · 클릭하면 선택돼요
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
                  aria-label="닫기"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* 검색 필터 */}
              {candidates.length > 12 && (
                <div className="px-5 pt-3 pb-2">
                  <input
                    type="text"
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    placeholder="뜻 또는 한자로 좁히기 (예: 넓을, 洪)"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[14px] text-text-primary placeholder-text-tertiary focus:border-cta/50 focus:outline-none"
                  />
                </div>
              )}

              {/* 후보 그리드 */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {filtered.length === 0 ? (
                  <div className="text-center py-12 text-text-tertiary text-[14px]">
                    {candidates.length === 0
                      ? `"${sound}" 음의 한자가 데이터에 없어요. 직접 입력 모드로 진행해 주세요.`
                      : '해당하는 한자가 없어요. 검색어를 다시 적어주세요.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {filtered.map((c) => {
                      const isSelected = c.char === currentChar;
                      const jawonColor = JAWON_COLOR[c.jawon] ?? 'transparent';
                      return (
                        <button
                          key={c.char + c.level}
                          onClick={() => onSelect(c)}
                          className={`
                            relative flex flex-col items-center justify-start gap-1 px-2 py-3 rounded-2xl
                            border transition-all active:scale-[0.96]
                            ${isSelected
                              ? 'bg-cta/15 border-cta'
                              : 'bg-white/[0.03] border-white/10 hover:border-cta/40 hover:bg-white/[0.06]'}
                          `}
                        >
                          {/* 자원오행 표시 (좌상단 점) */}
                          {c.jawon && (
                            <span
                              className="absolute top-2 left-2 w-2 h-2 rounded-full"
                              style={{ background: jawonColor, boxShadow: `0 0 6px ${jawonColor}88` }}
                              aria-label={`자원오행 ${c.jawon}`}
                            />
                          )}
                          {/* 한자 (큰) */}
                          <span
                            className="text-[28px] font-bold leading-none mt-1"
                            style={{
                              fontFamily: 'var(--font-serif)',
                              color: isSelected ? 'var(--cta-primary)' : 'var(--text-primary)',
                            }}
                          >
                            {c.char}
                          </span>
                          {/* 뜻 + 음 */}
                          <span className="text-[12px] font-semibold text-text-secondary leading-tight text-center px-0.5">
                            {c.meanings[0]} {sound}
                          </span>
                          {/* 부수·획수·자원오행 */}
                          <span className="text-[10px] text-text-tertiary leading-none mt-0.5">
                            {c.radical}부 · {c.strokes}획
                            {c.jawon && (
                              <>
                                {' · '}
                                <span style={{ color: jawonColor, fontWeight: 700 }}>{c.jawon}</span>
                              </>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 푸터 — "직접 입력" 옵션 */}
              <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                <span className="text-[11px] text-text-tertiary leading-snug">
                  원하는 한자가 없으면 모달을 닫고<br />뜻만 직접 입력하셔도 풀이됩니다.
                </span>
                <button
                  onClick={onClose}
                  className="text-[13px] font-semibold text-cta hover:text-cta/80 transition-colors px-3 py-1.5"
                >
                  닫기
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
