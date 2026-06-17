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
import { lookupHanjaBySoundWithDueum, findHanjaByChar, type HanjaCandidate } from '../../lib/data/hanjaByKoreanSound';
import { getSurnameHanja, getSurnameFallbackCandidate } from '../../lib/data/koreanSurnameHanja';

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
  /** 성씨 위치 글자면 true — 한국 성씨로 쓰는 한자를 후보 최상단에 모아 보여준다. */
  prioritizeSurname?: boolean;
  onSelect: (candidate: HanjaCandidate) => void;
  onClose: () => void;
}

export function HanjaPickerModal({ open, sound, currentChar, prioritizeSurname, onSelect, onClose }: Props) {
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

  const lookup = useMemo(() => lookupHanjaBySoundWithDueum(sound), [sound]);
  const totalCount = lookup.totalCount;

  // 성씨 위치면 그 음의 성씨 한자 목록(인구순). 아니면 빈 배열 → 기존 동작 그대로.
  const surnameChars = useMemo(
    () => (prioritizeSurname ? getSurnameHanja(sound) : []),
    [prioritizeSurname, sound],
  );

  // 필터링 — 성씨 + primary + 두음 그룹 모두에 동일 q 적용
  const filteredGroups = useMemo(() => {
    const q = filter.trim();
    const matches = (cands: HanjaCandidate[]) => !q ? cands : cands.filter(c =>
      c.char.includes(q)
      || c.meanings.some(m => m.includes(q))
      || c.radical.includes(q)
    );

    // 성씨 한자 추출 — 본음·두음 후보 전체에서 성씨 한자를 인구순으로 골라 상단으로.
    const surnameSet = new Set(surnameChars);
    let surname: HanjaCandidate[] = [];
    if (surnameSet.size) {
      const pool = [lookup.primary, ...lookup.dueumGroups.map(g => g.candidates)].flat();
      const seen = new Set<string>();
      for (const ch of surnameChars) {
        // 본음/두음 후보에 있으면 그걸 쓰고, 없으면 전역 char 조회 → 그래도 없으면(金 등 데이터셋 누락) 성씨 보강 메타.
        const found = pool.find(c => c.char === ch) ?? findHanjaByChar(ch) ?? getSurnameFallbackCandidate(ch);
        if (found && !seen.has(ch)) { surname.push(found); seen.add(ch); }
      }
      surname = matches(surname);
    }

    // 성씨로 올라간 한자는 본음/두음 그리드에서 제외(중복 방지)
    const dropSurname = (cands: HanjaCandidate[]) =>
      surnameSet.size ? cands.filter(c => !surnameSet.has(c.char)) : cands;

    return {
      surname,
      primary: matches(dropSurname(lookup.primary)),
      dueum: lookup.dueumGroups
        .map(g => ({ sound: g.sound, candidates: matches(dropSurname(g.candidates)) }))
        .filter(g => g.candidates.length > 0),
    };
  }, [lookup, filter, surnameChars]);
  const filteredTotal = filteredGroups.surname.length + filteredGroups.primary.length + filteredGroups.dueum.reduce((s, g) => s + g.candidates.length, 0);

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
                    {totalCount}개 한자 · 자원오행 색 표시 · 클릭하면 선택돼요
                    {filteredGroups.surname.length > 0 && (
                      <>
                        <br />
                        <span style={{ color: 'var(--cta-primary)' }}>
                          한국에서 성씨로 쓰는 한자를 맨 위에 모아 보여드려요.
                        </span>
                      </>
                    )}
                    {lookup.dueumGroups.length > 0 && (
                      <>
                        <br />
                        <span style={{ color: 'var(--cta-primary)' }}>
                          본음({lookup.dueumGroups.map(g => g.sound).join('·')})에서 두음법칙으로 「{sound}」로 읽는 한자도 함께 보여드려요.
                        </span>
                      </>
                    )}
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
              {totalCount > 12 && (
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
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {filteredTotal === 0 ? (
                  <div className="text-center py-12 text-text-tertiary text-[14px]">
                    {totalCount === 0
                      ? `"${sound}" 음의 한자가 데이터에 없어요. 직접 입력 모드로 진행해 주세요.`
                      : '해당하는 한자가 없어요. 검색어를 다시 적어주세요.'}
                  </div>
                ) : (
                  <>
                    {/* 성씨 그리드 — 한국 성씨로 쓰는 한자 우선 노출 */}
                    {filteredGroups.surname.length > 0 && (
                      <div>
                        <div
                          className="text-[13px] font-bold mb-2 pl-0.5 flex items-center gap-2"
                          style={{ color: 'var(--cta-primary)', fontFamily: 'var(--font-title)' }}
                        >
                          <span>성씨로 쓰는 한자</span>
                          <span className="text-[11px] font-normal text-text-tertiary">{filteredGroups.surname.length}자</span>
                        </div>
                        <CandidateGrid
                          candidates={filteredGroups.surname}
                          displaySound={sound}
                          currentChar={currentChar}
                          onSelect={onSelect}
                          isDueum={false}
                        />
                      </div>
                    )}

                    {/* primary 그리드 — 입력 음 그대로 */}
                    {filteredGroups.primary.length > 0 && (
                      <div>
                        {(lookup.dueumGroups.length > 0 || filteredGroups.surname.length > 0) && (
                          <div
                            className="text-[13px] font-bold mb-2 pl-0.5 flex items-center gap-2"
                            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}
                          >
                            <span>{filteredGroups.surname.length > 0 ? `그 외 「${sound}」 한자` : `「${sound}」 본음`}</span>
                            <span className="text-[11px] font-normal text-text-tertiary">{filteredGroups.primary.length}자</span>
                          </div>
                        )}
                        <CandidateGrid
                          candidates={filteredGroups.primary}
                          displaySound={sound}
                          currentChar={currentChar}
                          onSelect={onSelect}
                          isDueum={false}
                        />
                      </div>
                    )}

                    {/* 두음 그룹별 — "리 → 이 (두음법칙)" 헤더 + 그리드 */}
                    {filteredGroups.dueum.map((g) => (
                      <div key={g.sound}>
                        <div
                          className="text-[13px] font-bold mb-2 pl-0.5 flex items-center gap-2 flex-wrap"
                          style={{ color: 'var(--cta-primary)', fontFamily: 'var(--font-title)' }}
                        >
                          <span>「{g.sound}」 → 「{sound}」 (두음법칙)</span>
                          <span className="text-[11px] font-normal text-text-tertiary">{g.candidates.length}자</span>
                        </div>
                        <CandidateGrid
                          candidates={g.candidates}
                          displaySound={sound}
                          originalSound={g.sound}
                          currentChar={currentChar}
                          onSelect={onSelect}
                          isDueum
                        />
                      </div>
                    ))}
                  </>
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

function CandidateGrid({
  candidates,
  displaySound,
  originalSound,
  currentChar,
  onSelect,
  isDueum,
}: {
  candidates: HanjaCandidate[];
  /** 화면에 표시할 한국식 음 (예: 두음 후보의 경우에도 "이") */
  displaySound: string;
  /** 두음 후보일 때 본음 (예: "리") */
  originalSound?: string;
  currentChar?: string;
  onSelect: (c: HanjaCandidate) => void;
  isDueum: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {candidates.map((c) => {
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
                : isDueum
                  ? 'bg-[rgba(139,92,246,0.04)] border-[rgba(139,92,246,0.18)] hover:border-cta/50 hover:bg-[rgba(139,92,246,0.08)]'
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
            {/* 두음 배지 — 우상단 (본음 표시) */}
            {isDueum && originalSound && (
              <span
                className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none"
                style={{
                  color: 'var(--cta-primary)',
                  background: 'rgba(139,92,246,0.12)',
                  border: '1px solid rgba(139,92,246,0.3)',
                }}
              >
                {originalSound}→{displaySound}
              </span>
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
              {c.meanings[0]} {displaySound}
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
  );
}
