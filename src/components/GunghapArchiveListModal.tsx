'use client';

/**
 * 궁합 archive list 모달 — 다른 풀이(QuickFortuneGate)와 시각 일관성 보장.
 *
 * 사용 위치:
 *  · 홈 (HomePage): 궁합 카드 클릭 시 페이지 라우팅 없이 홈 위에 fade-in.
 *    뒤로는 홈 화면이 희미하게 보임 → 다른 풀이 모달과 100% 동일 UX.
 *  · GunghapPage 자체에는 이 컴포넌트를 import 안 함 — 페이지 진입 흐름은 기존 자체 모달
 *    (직접 URL 진입 호환). 홈 진입은 fresh=1 로 보내서 자체 모달 자동 표시 skip.
 */

import { motion, AnimatePresence } from 'framer-motion';
import type { GunghapArchiveItem } from '../services/archiveService';
import { CATEGORY_LABEL_MAP } from '../pages/GunghapPage';

interface Props {
  open: boolean;
  archiveList: GunghapArchiveItem[];
  /** 항목 클릭 — recordId 와 함께 호출 */
  onSelectItem: (id: string) => void;
  /** 새로 궁합 보기 클릭 */
  onClickNew: () => void;
  /** 취소·바깥 클릭 */
  onClose: () => void;
}

export function GunghapArchiveListModal({ open, archiveList, onSelectItem, onClickNew, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && archiveList.length > 0 && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-0 z-[60] flex items-center justify-center px-5 pointer-events-none"
          >
            <div className="relative w-full max-w-[400px] rounded-2xl bg-[rgba(20,12,38,0.97)] border border-[var(--border-subtle)] p-6 text-center shadow-2xl pointer-events-auto">
              <button
                type="button"
                onClick={onClose}
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
                      onClick={() => onSelectItem(item.id)}
                      className="w-full min-h-10 py-2 px-3 rounded-lg border border-[var(--border-subtle)] text-[14px] text-text-primary font-medium hover:bg-cta/10 hover:border-cta/40 transition-all flex items-center justify-between gap-2"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="text-[12px] font-bold text-cta bg-cta/10 px-2 py-0.5 rounded-md whitespace-nowrap flex-shrink-0 text-center truncate w-[100px]"
                          title={catLabel}
                        >
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
                  onClick={onClickNew}
                  className="block w-full h-12 rounded-lg bg-gradient-to-r from-cta to-cta-active text-white font-bold text-[15px] hover:opacity-90 transition-all"
                >
                  새로 궁합 보기
                </button>
                <button
                  type="button"
                  onClick={onClose}
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
  );
}
