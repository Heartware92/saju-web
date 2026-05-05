'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createShareLink, triggerShare, type ShareRecordType } from '@/services/shareService';
import { SAJU_CATEGORY_LABEL } from '@/constants/adminLabels';
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
  category,
  className = '',
  compact = false,
}: ShareBarProps) {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

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
      showToast('공유 링크 생성에 실패했어요');
      return null;
    } catch {
      showToast('오류가 발생했어요');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const url = await getShareLink();
    if (!url) return;

    const label = category ? (SAJU_CATEGORY_LABEL[category] ?? '사주 풀이') : '운세 풀이';
    const result = await triggerShare(url, `${label} — 이천점`, `${label} 결과를 확인해보세요!`);

    if (result === 'copied') showToast('링크가 복사되었어요');
    else if (result === 'failed') showToast('공유에 실패했어요');
  };

  const handleCopyLink = async () => {
    const url = await getShareLink();
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      showToast('링크가 복사되었어요');
    } catch {
      showToast('복사에 실패했어요');
    }
  };

  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={handleShare}
          disabled={loading}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-cta hover:bg-white/5 transition-colors disabled:opacity-50"
          aria-label="공유"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-cta border-t-transparent rounded-full animate-spin" />
          ) : (
            <ShareIcon size={16} />
          )}
        </button>
        <Toast message={toast} />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-2">
        {/* 공유하기 (시스템 / 카톡) */}
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

        {/* 링크 복사 */}
        <button
          onClick={handleCopyLink}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] text-text-secondary hover:text-cta hover:border-cta/30 transition-all disabled:opacity-50"
        >
          <LinkIcon size={18} />
          <span className="text-sm font-medium">링크 복사</span>
        </button>
      </div>
      <Toast message={toast} />
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

function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-space-elevated border border-[var(--border-subtle)] shadow-lg"
        >
          <span className="text-sm text-text-primary font-medium">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { ShareIcon };
