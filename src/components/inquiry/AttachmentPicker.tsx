'use client';

/**
 * 문의 첨부 사진 피커 — 선택/미리보기/삭제. 업로드는 제출 시 부모가 수행.
 * 최대 3장, 장당 5MB, 이미지만.
 */

import { useEffect, useRef, useState } from 'react';
import { MAX_ATTACHMENTS, validateAttachment } from '@/services/inquiryAttachments';

interface AttachmentPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

export default function AttachmentPicker({ files, onChange, disabled }: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setError('');
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_ATTACHMENTS) {
        setError(`사진은 최대 ${MAX_ATTACHMENTS}장까지 첨부할 수 있어요.`);
        break;
      }
      const msg = validateAttachment(f);
      if (msg) { setError(msg); continue; }
      next.push(f);
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeAt = (i: number) => {
    setError('');
    onChange(files.filter((_, idx) => idx !== i));
  };

  return (
    <div>
      <label className="block text-[13px] font-medium text-text-secondary mb-2">
        사진 첨부 <span className="text-text-tertiary text-[12px] font-normal">(선택 · 최대 {MAX_ATTACHMENTS}장)</span>
      </label>

      <div className="flex flex-wrap gap-2">
        {files.map((f, i) => (
          <Thumb key={`${f.name}-${i}`} file={f} onRemove={() => removeAt(i)} disabled={disabled} />
        ))}

        {files.length < MAX_ATTACHMENTS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
            className="w-20 h-20 shrink-0 flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[rgba(255,255,255,0.22)] bg-[rgba(255,255,255,0.03)] text-text-tertiary hover:border-cta/50 hover:text-text-secondary transition-colors disabled:opacity-50"
            aria-label="사진 추가"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 15l4-4a2 2 0 012.8 0L15 16" />
              <path d="M14 14l1.5-1.5a2 2 0 012.8 0L21 15" />
              <circle cx="9" cy="9" r="1.2" />
            </svg>
            <span className="text-[11px]">사진 추가</span>
          </button>
        )}
      </div>

      {error && <p className="text-[11.5px] text-status-error mt-1.5">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
    </div>
  );
}

function Thumb({ file, onRemove, disabled }: { file: File; onRemove: () => void; disabled?: boolean }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-black/20">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt={file.name} className="w-full h-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/85 disabled:opacity-50"
        aria-label="삭제"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 6l12 12M6 18L18 6" />
        </svg>
      </button>
    </div>
  );
}
