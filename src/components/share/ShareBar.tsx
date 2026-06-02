'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// import { triggerShare } from '@/services/shareService'; // 공유하기 일시 비활성 — 공유 페이지 렌더링 완성 후 복귀
import type { ShareRecordType } from '@/services/shareService';
import { supabase } from '@/services/supabase';
import { shareToKakao } from '@/lib/kakao';
import { trackEvent } from '@/lib/analytics/track';

interface ShareBarProps {
  recordId: string;
  type?: ShareRecordType;
  category?: string;
  className?: string;
  compact?: boolean;
  shareTitle?: string;
  shareDescription?: string;
}

// ── 서브 컴포넌트 (ShareBar 위에 배치 — 일부 빌드 환경에서 hoisting 미적용) ──

function ShareIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function KakaoIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M12 3C6.48 3 2 6.44 2 10.61c0 2.68 1.78 5.03 4.46 6.36-.15.54-.97 3.49-.99 3.7 0 0-.02.16.08.22.1.06.22.01.22.01.29-.04 3.36-2.2 3.89-2.57.75.11 1.53.17 2.34.17 5.52 0 10-3.44 10-7.89S17.52 3 12 3z"
        fill="#FEE500"
      />
    </svg>
  );
}

function LinkIcon({ size = 20 }: { size?: number }) {
  // 표준 3-노드 공유 아이콘 (기존 체인/클립 모양 → 교체)
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

type CopyModalState = { message: string; success: boolean; manualUrl?: string };

function CopyModal({ modal, onClose }: { modal: CopyModalState | null; onClose: () => void }) {
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
            className="mx-6 w-full max-w-[320px] rounded-2xl bg-space-elevated border border-[var(--border-subtle)] p-6 text-center shadow-2xl"
          >
            <div className="text-3xl mb-3">
              {modal.success ? '✓' : '✕'}
            </div>
            <p className="text-[16px] font-medium text-text-primary mb-4">
              {modal.message}
            </p>
            {modal.manualUrl && (
              <>
                <p className="text-[13px] text-text-tertiary mb-2 leading-relaxed">
                  아래 링크를 길게 눌러 복사해주세요
                </p>
                <input
                  readOnly
                  value={modal.manualUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full px-3 py-2 mb-5 rounded-lg bg-[rgba(0,0,0,0.3)] border border-[var(--border-subtle)] text-[12.5px] text-text-secondary font-mono break-all select-all"
                />
              </>
            )}
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

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy fallback
    }
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function ShareBar({
  recordId,
  type = 'saju',
  className = '',
  compact = false,
  shareTitle,
  shareDescription,
}: ShareBarProps) {
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<CopyModalState | null>(null);

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
    trackEvent('share_url'); // 공유(링크 복사) 페이지 집계

    const ok = await copyTextToClipboard(url);
    if (ok) {
      setModal({ message: '링크가 복사되었어요', success: true });
    } else {
      setModal({
        message: '자동 복사가 막힌 환경이에요',
        success: false,
        manualUrl: url,
      });
    }
  };

  const handleKakaoShare = async () => {
    const url = await getShareLink();
    if (!url) return;
    trackEvent('share_kakao'); // 공유(카카오톡) 페이지 집계

    const title = shareTitle || '이천점 — 우주의 기운을 드려요';
    const description = shareDescription || '우주의 기운으로 풀어낸 운세 결과를 확인해보세요';

    const result = await shareToKakao({ title, description, shareUrl: url });
    if (result === 'no-sdk') {
      setModal({ message: '카카오 SDK를 불러올 수 없어요', success: false });
    } else if (result === 'failed') {
      setModal({ message: '카카오톡 공유에 실패했어요', success: false });
    }
  };

  if (compact) {
    return (
      <div className={`relative flex items-center gap-1 ${className}`}>
        <button
          onClick={handleKakaoShare}
          disabled={loading}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-[#FEE500] hover:bg-white/5 transition-colors disabled:opacity-50"
          aria-label="카카오톡 공유"
        >
          <KakaoIcon size={16} />
        </button>
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
        {/* 카카오톡 공유 */}
        <button
          onClick={handleKakaoShare}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#FEE500]/10 border border-[#FEE500]/30 text-[#3C1E1E] hover:bg-[#FEE500]/20 transition-all disabled:opacity-50"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-[#FEE500] border-t-transparent rounded-full animate-spin" />
          ) : (
            <KakaoIcon size={18} />
          )}
          <span className="text-sm font-medium text-[#FEE500]">카카오톡</span>
        </button>

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

export { ShareIcon };
