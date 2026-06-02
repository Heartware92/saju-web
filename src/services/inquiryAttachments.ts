/**
 * 문의 첨부 사진 업로드 헬퍼 (클라이언트).
 *
 * - 비공개 버킷 inquiry-attachments 에 본인 uid 폴더로 업로드.
 * - 업로드는 사용자 세션(anon client) + RLS(insert own folder)로 수행.
 * - 어드민은 service_role 서명 URL로 열람한다(별도).
 */

import { supabase } from './supabase';

export const INQUIRY_BUCKET = 'inquiry-attachments';
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5MB

/** 첨부 가능 여부 검증 — 통과 시 null, 실패 시 사용자 메시지 */
export function validateAttachment(file: File): string | null {
  if (!file.type.startsWith('image/')) return '이미지 파일만 첨부할 수 있어요.';
  if (file.size > MAX_ATTACHMENT_SIZE) return '사진 한 장당 5MB 이하만 첨부할 수 있어요.';
  return null;
}

/**
 * 파일들을 업로드하고 저장된 객체 경로 배열을 반환한다.
 * 경로 형식: {userId}/{timestamp}-{rand}.{ext}
 */
export async function uploadInquiryAttachments(userId: string, files: File[]): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    const rawExt = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const ext = rawExt || 'jpg';
    const rand = Math.random().toString(36).slice(2, 10);
    const path = `${userId}/${Date.now()}-${rand}.${ext}`;
    const { error } = await supabase.storage.from(INQUIRY_BUCKET).upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });
    if (error) throw new Error(error.message);
    paths.push(path);
  }
  return paths;
}
