'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// import { triggerShare } from '@/services/shareService'; // 공유하기 일시 비활성 — 공유 페이지 렌더링 완성 후 복귀
import type { ShareRecordType } from '@/services/shareService';
import { supabase } from '@/services/supabase';

interface ShareBarProps {
  recordId: string;
  type?: ShareRecordType;
  category?: string;
  className?: string;
  compact?: boolean;
}

export function ShareBar({
  recordId,
  type = 'saju',
  className = '',
  compact = false,
}: ShareBarProps) {
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ message: string; success: boolean } | null>(null);

  const getShareLink = async (): Promise<string | null> => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/share/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ recordId, type }),
      });
      const json = await res.json();
      if (json?.success && json?.shareUrl) return json.shareUrl;
      setModal({ message: '공유 링크 생성에 실패했어요', success: false });
      return null;
    } catch {
      setModal({ message: '오류가 발생했어요', success: false });
      return null;
    } finally {
      setLoading(false);
    }
  };

  /* ── 공유하기 (시스템 공유) — 공유 페이지 렌더링 완성 후 복귀 예정 ──
  const handleShare = async () => {
    const url = await getShareLink();
    if (!url) return;
    const label = category ? (SAJU_CATEGORY_LABEL[category] ?? '사주 풀이') : '운세 풀이';
    const result = await triggerShare(url, `${label} — 이천점`, `${label} 결과를 확인해보세요!`);
    if (result === 'copied') setModal({ message: '링크가 복사되었어요', success: true });
    else if (result === 'failed') setModal({ message: '공유에 실패했어요', success: false });
  };
  */

  const handleCopyLink = async () => {
    const url = await getShareLink();
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setModal({ message: '링크가 복사되었어요', success: true });
    } catch {
      setModal({ message: '복사에 실패했어요', success: false });
    }
  };

  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={handleCopyLink}
          disabled={loading}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-cta hover:bg-white/5 transition-colors disabled:opacity-50"
          aria-label="링크 복사"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-cta border-t-transparent rounded-full animate-spin" />
          ) : (
            <LinkIcon size={16} />
          )}
        </button>
        <CopyModal modal={modal} onClose={() => setModal(null)} />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        {/* ── 공유하기 버튼 — 공유 페이지 렌더링 완성 후 복귀 예정 ──
        <button
          onClick={handleShare}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] text-text-secondary hover:text-cta hover:border-cta/30 transition-all disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-cta border-t-transparent rounded-full animate-spin" />
          ) : (
            <ShareIcon size={18} />
          )}
          <span className="text-sm font-medium">공유하기</span>
        </button>
        */}

        {/* 링크 복사 */}
        <button
          onClick={handleCopyLink}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] text-text-secondary hover:text-cta hover:border-cta/30 transition-all disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-cta border-t-transparent rounded-full animate-spin" />
          ) : (
            <LinkIcon size={18} />
          )}
          <span className="text-sm font-medium">링크 복사</span>
        </button>
      </div>
      <CopyModal modal={modal} onClose={() => setModal(null)} />
    </div>
  );
}

function ShareIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function LinkIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CopyModal({ modal, onClose }: { modal: { message: string; success: boolean } | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {modal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="mx-6 w-full max-w-[300px] rounded-2xl bg-space-elevated border border-[var(--border-subtle)] p-6 text-center shadow-2xl"
          >
            <div className={`text-3xl mb-3 ${modal.success ? '' : ''}`}>
              {modal.success ? '✓' : '✕'}
            </div>
            <p className="text-[16px] font-medium text-text-primary mb-5">
              {modal.message}
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-cta/20 border border-cta/40 text-cta font-bold text-[15px] active:scale-[0.98] transition-all"
            >
              확인
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { ShareIcon };
