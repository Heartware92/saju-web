'use client';

import React, { useEffect } from 'react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  closeOnOverlay?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnOverlay = true,
}) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes: Record<string, string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-[var(--space-overlay)] backdrop-blur-sm"
        onClick={closeOnOverlay ? onClose : undefined}
      />

      {/* Centering wrapper — min-height trick works on all browsers including Safari */}
      <div className="flex min-h-full items-center justify-center px-4
                       pt-[env(safe-area-inset-top,0px)]
                       pb-[calc(64px+env(safe-area-inset-bottom,0px))] sm:pb-4 sm:pt-4">
      {/* Modal */}
      <div
        className={`
          relative w-full ${sizes[size]}
          glass-strong rounded-2xl
          max-h-[calc(100vh-72px-64px)] max-h-[calc(100dvh-72px-64px)]
          sm:max-h-[85vh] sm:max-h-[85dvh]
          overflow-y-auto
          animate-slideUp
        `}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
            {title && (
              <h2 className="text-xl font-bold text-text-primary">{title}</h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-text-tertiary hover:text-text-primary transition-colors ml-auto p-1 rounded-lg hover:bg-space-elevated"
                aria-label="닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className="px-6 py-4">
          {children}
        </div>
      </div>
      </div>
    </div>
  );
};

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'sun' | 'moon';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  variant = 'primary',
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-6">
        <p className="text-text-secondary whitespace-pre-line">{message}</p>
        <div className="flex gap-3">
          <Button variant="ghost" fullWidth onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant={variant}
            fullWidth
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

interface AlertModalProps {
  /** 메시지가 있으면 열림. 빈 문자열이면 닫힘. */
  message: string;
  onClose: () => void;
  title?: string;
  confirmText?: string;
  variant?: 'primary' | 'sun' | 'moon';
}

/**
 * 단순 알림 모달 — 확인 버튼 1개.
 * 긴 폼에서 상단 에러 배너는 스크롤을 올려야 보여 인지가 어렵다.
 * message 가 비어있지 않으면 자동으로 화면 중앙에 떠서 사용자가 바로 인지한다.
 */
export const AlertModal: React.FC<AlertModalProps> = ({
  message,
  onClose,
  title = '알림',
  confirmText = '확인',
  variant = 'primary',
}) => {
  return (
    <Modal isOpen={!!message} onClose={onClose} title={title} size="sm" showCloseButton={false}>
      <div className="space-y-6">
        <p className="text-text-secondary whitespace-pre-line">{message}</p>
        <Button variant={variant} fullWidth onClick={onClose}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
};
