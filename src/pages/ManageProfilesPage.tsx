'use client';

/**
 * 프로필 관리 페이지 — 대표 지정 / 수정 / 삭제 / 추가
 */

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';
import { CITY_COORDINATES } from '../utils/timeCorrection';
import { computeSajuFromProfile } from '../utils/profileSaju';
import { getCharacterFromStem } from '../lib/character';
import type { BirthProfile } from '../types/credit';
import { JobLoveStateInput } from '../components/profile/JobLoveStateInput';
import { BackButton } from '../components/ui/BackButton';

function preloadCharacterImage(profile: BirthProfile) {
  try {
    const result = computeSajuFromProfile(profile);
    if (!result) return;
    const character = getCharacterFromStem(result.pillars.day.gan);
    if (!character?.image) return;
    const img = new window.Image();
    img.src = character.image;
  } catch {}
}

export default function ManageProfilesPage() {
  const router = useRouter();
  const { user } = useUserStore();
  const {
    profiles,
    fetchProfiles,
    deleteProfile,
    setPrimary,
    updateProfile,
    loading,
  } = useProfileStore();

  const [confirmDelete, setConfirmDelete] = useState<BirthProfile | null>(null);
  const [editing, setEditing] = useState<BirthProfile | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    birthDateStr: string;
    birthTimeStr: string;
    unknownTime: boolean;
    gender: 'male' | 'female';
    calendar_type: 'solar' | 'lunar';
    birth_place: string;
    memo: string;
    jobState: string;
    customJobState: string;
    loveState: string;
    customLoveState: string;
  } | null>(null);

  const currentYear = new Date().getFullYear();

  const validateBirthDate = (s: string) => {
    if (!s) return { ok: false, msg: '생년월일을 입력해주세요' };
    if (!/^\d{8}$/.test(s)) return { ok: false, msg: '8자리 숫자로 입력해주세요 (예: 19920914)' };
    const y = parseInt(s.slice(0, 4), 10);
    const m = parseInt(s.slice(4, 6), 10);
    const d = parseInt(s.slice(6, 8), 10);
    if (y < 1900 || y > currentYear) return { ok: false, msg: `연도는 1900~${currentYear} 사이여야 합니다` };
    if (m < 1 || m > 12) return { ok: false, msg: '월은 01~12 사이여야 합니다' };
    if (d < 1 || d > 31) return { ok: false, msg: '일은 01~31 사이여야 합니다' };
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
      return { ok: false, msg: '존재하지 않는 날짜입니다' };
    }
    return { ok: true, year: y, month: m, day: d };
  };

  const validateBirthTime = (s: string) => {
    if (!s) return { ok: false, msg: '출생 시간을 입력해주세요' };
    if (!/^\d{4}$/.test(s)) return { ok: false, msg: '4자리 숫자로 입력해주세요 (예: 1322)' };
    const h = parseInt(s.slice(0, 2), 10);
    const mi = parseInt(s.slice(2, 4), 10);
    if (h > 23) return { ok: false, msg: '시는 00~23 사이여야 합니다' };
    if (mi > 59) return { ok: false, msg: '분은 00~59 사이여야 합니다' };
    return { ok: true, hour: h, minute: mi };
  };

  const editDateValidation = useMemo(
    () => (editForm ? validateBirthDate(editForm.birthDateStr) : { ok: false }),
    [editForm?.birthDateStr],
  );
  const editTimeValidation = useMemo(
    () => (editForm?.unknownTime ? { ok: true } : editForm ? validateBirthTime(editForm.birthTimeStr) : { ok: false }),
    [editForm?.birthTimeStr, editForm?.unknownTime],
  );

  const editDateError = editForm && editForm.birthDateStr.length > 0 && !editDateValidation.ok ? (editDateValidation as { ok: false; msg: string }).msg : '';
  const editTimeError = editForm && !editForm.unknownTime && editForm.birthTimeStr.length > 0 && !editTimeValidation.ok ? (editTimeValidation as { ok: false; msg: string }).msg : '';

  useEffect(() => {
    if (user) fetchProfiles();
  }, [user, fetchProfiles]);

  // 페이지 진입 시 스크롤 항상 최상단으로 복귀.
  // 새 프로필 추가/수정/삭제 후 history.back 또는 router.push 로 돌아올 때
  // 브라우저가 이전 스크롤 위치를 복원해 사용자가 헤더를 못 보는 문제 방지.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, []);

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
        <p className="text-text-secondary mb-4">로그인이 필요해요</p>
        <Link
          href="/login?from=/saju/profile"
          className="px-5 py-2.5 rounded-xl bg-cta text-white text-sm font-semibold"
        >
          로그인
        </Link>
      </div>
    );
  }

  const openEdit = (p: BirthProfile) => {
    setEditing(p);
    const dateStr = p.birth_date.replace(/-/g, '');
    const timeStr = p.birth_time ? p.birth_time.replace(':', '') : '';
    const hasCustomJob = !!(p.custom_job_state && p.custom_job_state.trim());
    const hasCustomLove = !!(p.custom_love_state && p.custom_love_state.trim());
    setEditForm({
      name: p.name,
      birthDateStr: dateStr,
      birthTimeStr: timeStr,
      unknownTime: !p.birth_time,
      gender: p.gender,
      calendar_type: p.calendar_type ?? 'solar',
      birth_place: p.birth_place || 'seoul',
      memo: p.memo ?? '',
      jobState: hasCustomJob ? '' : (p.job_state || '직장인'),
      customJobState: hasCustomJob ? p.custom_job_state! : '',
      loveState: hasCustomLove ? '' : (p.love_state || '연애 중'),
      customLoveState: hasCustomLove ? p.custom_love_state! : '',
    });
  };

  const saveEdit = async () => {
    if (!editing || !editForm) return;
    if (!editDateValidation.ok || !editTimeValidation.ok) return;

    const { year, month, day } = editDateValidation as { year: number; month: number; day: number };
    const birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const birthTime = editForm.unknownTime
      ? undefined
      : `${editForm.birthTimeStr.slice(0, 2)}:${editForm.birthTimeStr.slice(2, 4)}`;

    const longitude = CITY_COORDINATES[editForm.birth_place]?.lng ?? null;
    const customJobTrim = editForm.customJobState.trim();
    const customLoveTrim = editForm.customLoveState.trim();
    const ok = await updateProfile(editing.id, {
      name: editForm.name.trim(),
      birth_date: birthDate,
      birth_time: birthTime,
      gender: editForm.gender,
      calendar_type: editForm.calendar_type,
      birth_place: editForm.birth_place,
      longitude,
      memo: editForm.memo.trim() || undefined,
      job_state: customJobTrim ? '직접 입력' : editForm.jobState,
      custom_job_state: customJobTrim || null,
      love_state: customLoveTrim ? '직접 입력' : editForm.loveState,
      custom_love_state: customLoveTrim || null,
    });
    if (ok) {
      setEditing(null);
      setEditForm(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    await deleteProfile(confirmDelete.id);
    setConfirmDelete(null);
  };

  return (
    <div className="px-4 pt-4 pb-10">
      {/* 헤더 */}
      <div className="flex items-center relative mb-5 pt-3 px-1">
        <BackButton className="absolute left-0" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            프로필 관리
          </h1>
        </div>
      </div>

      {/* 안내 */}
      <p className="text-[14px] text-text-tertiary mb-3 px-1">
        대표 프로필은 홈 화면에 표시되며, 모든 운세 분석의 기본값으로 사용됩니다.
      </p>

      {/* 프로필 리스트 */}
      {profiles.length === 0 && !loading ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-8 text-center">
          <p className="text-sm text-text-secondary mb-3">아직 등록된 프로필이 없어요</p>
          <Link
            href="/saju/input?mode=profile-only"
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-cta text-white text-[15px] font-semibold"
          >
            새 프로필 추가
          </Link>
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {profiles.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl p-3.5 border transition-all ${
                p.is_primary
                  ? 'border-cta/50 bg-[rgba(124,92,252,0.08)]'
                  : 'border-[var(--border-subtle)] bg-[rgba(20,12,38,0.55)]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[rgba(124,92,252,0.12)] flex items-center justify-center text-lg shrink-0">
                  {p.gender === 'male' ? '👨' : '👩'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-text-primary text-sm">{p.name}</span>
                    {p.is_primary && (
                      <span className="text-[12px] px-1.5 py-0.5 rounded-full bg-cta/20 text-cta font-semibold">
                        대표
                      </span>
                    )}
                  </div>
                  <div className="text-[13px] text-text-tertiary mt-0.5">
                    {p.birth_date.replace(/-/g, '.')}
                    {p.birth_time ? ` ${p.birth_time}` : ' (시간 모름)'}
                    {' · '}
                    {p.gender === 'male' ? '남' : '여'}
                  </div>
                  {p.memo && (
                    <div className="text-[13px] text-text-tertiary mt-0.5 truncate">{p.memo}</div>
                  )}
                </div>
              </div>

              {/* 액션 */}
              <div className="mt-3 flex items-center gap-1.5">
                {!p.is_primary && (
                  <button
                    onClick={() => { preloadCharacterImage(p); setPrimary(p.id); }}
                    className="flex-1 py-1.5 rounded-lg bg-[rgba(124,92,252,0.14)] border border-cta/30 text-cta text-[14px] font-semibold hover:bg-[rgba(124,92,252,0.22)] active:scale-[0.97] transition-all"
                  >
                    대표로 지정
                  </button>
                )}
                <button
                  onClick={() => openEdit(p)}
                  className="flex-1 py-1.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[var(--border-subtle)] text-text-secondary text-[14px] font-medium hover:text-text-primary active:scale-[0.97] transition-all"
                >
                  수정
                </button>
                <button
                  onClick={() => setConfirmDelete(p)}
                  className="px-3 py-1.5 rounded-lg bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.35)] text-[#F87171] text-[14px] font-medium hover:bg-[rgba(239,68,68,0.15)] active:scale-[0.97] transition-all"
                  aria-label="삭제"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 추가 버튼 */}
      {profiles.length > 0 && (
        <button
          onClick={() => router.push('/saju/input?mode=profile-only')}
          className="w-full rounded-2xl border-2 border-dashed border-[var(--border-subtle)] hover:border-cta/40 p-3.5 flex items-center justify-center gap-2 text-text-tertiary hover:text-cta transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span className="text-[15px] font-medium">새 프로필 추가</span>
        </button>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 pb-[calc(16px+64px+env(safe-area-inset-bottom,0px))] sm:pb-4"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[360px] rounded-2xl p-5 bg-[rgba(28,18,50,0.98)] border border-[var(--border-subtle)]"
            >
              <button type="button" onClick={() => setConfirmDelete(null)} className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/5 text-[var(--text-tertiary)] hover:bg-white/10 hover:text-[var(--text-primary)] transition-colors" aria-label="닫기">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
              </button>
              <h3 className="text-base font-bold text-text-primary mb-1">프로필을 삭제할까요?</h3>
              <p className="text-[14px] text-text-secondary mb-4">
                <span className="font-semibold">{confirmDelete.name}</span> 님의 프로필이 영구 삭제됩니다.
                {confirmDelete.is_primary && ' 대표 프로필이므로 삭제 후 홈이 비어보일 수 있습니다.'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[var(--border-subtle)] text-text-secondary text-[15px] font-medium"
                >
                  취소
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2.5 rounded-lg bg-[rgba(239,68,68,0.85)] text-white text-[15px] font-semibold active:scale-[0.98]"
                >
                  삭제
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 수정 다이얼로그 */}
      <AnimatePresence>
        {editing && editForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 pb-[calc(16px+64px+env(safe-area-inset-bottom,0px))] sm:pb-4"
            onClick={() => { setEditing(null); setEditForm(null); }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[380px] rounded-2xl p-5 bg-[rgba(28,18,50,0.98)] border border-[var(--border-subtle)]"
            >
              <button type="button" onClick={() => { setEditing(null); setEditForm(null); }} className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/5 text-[var(--text-tertiary)] hover:bg-white/10 hover:text-[var(--text-primary)] transition-colors" aria-label="닫기">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
              </button>
              <h3 className="text-base font-bold text-text-primary mb-4">프로필 수정</h3>

              <div className="space-y-3">
                <div>
                  <label className="text-[13px] text-text-tertiary block mb-1">이름</label>
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[var(--border-subtle)] text-sm text-text-primary focus:border-cta/50 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[13px] text-text-tertiary block mb-1">양력/음력</label>
                  <div className="flex gap-2">
                    {(['solar', 'lunar'] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditForm({ ...editForm, calendar_type: c })}
                        className={`flex-1 py-2 rounded-lg text-[15px] font-medium border transition-all ${
                          editForm.calendar_type === c
                            ? 'bg-[rgba(124,92,252,0.14)] border-cta/40 text-cta'
                            : 'bg-[rgba(255,255,255,0.04)] border-[var(--border-subtle)] text-text-secondary'
                        }`}
                      >
                        {c === 'solar' ? '☀️ 양력' : '🌙 음력'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[13px] text-text-tertiary block mb-1">생년월일 (YYYYMMDD)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="YYYYMMDD (숫자 8자리)"
                    value={editForm.birthDateStr}
                    onChange={(e) => setEditForm({ ...editForm, birthDateStr: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                    className={`w-full px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] border text-sm text-text-primary outline-none ${editDateError ? 'border-red-500/60' : 'border-[var(--border-subtle)] focus:border-cta/50'}`}
                  />
                  {editDateError && <p className="text-[12px] text-red-400 mt-1">{editDateError}</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[13px] text-text-tertiary">출생 시간 (HHMM)</label>
                    <label className="flex items-center gap-1.5 text-[13px] text-text-tertiary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.unknownTime}
                        onChange={(e) => setEditForm({ ...editForm, unknownTime: e.target.checked, birthTimeStr: e.target.checked ? '' : editForm.birthTimeStr })}
                        className="accent-cta"
                      />
                      <span>모름</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="HHMM (숫자 4자리, 24시 표기)"
                    value={editForm.birthTimeStr}
                    onChange={(e) => setEditForm({ ...editForm, birthTimeStr: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    disabled={editForm.unknownTime}
                    className={`w-full px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] border text-sm text-text-primary outline-none disabled:opacity-40 ${editTimeError ? 'border-red-500/60' : 'border-[var(--border-subtle)] focus:border-cta/50'}`}
                  />
                  {editTimeError && <p className="text-[12px] text-red-400 mt-1">{editTimeError}</p>}
                  {editForm.unknownTime && (
                    <p className="text-[12px] text-text-tertiary mt-1">시간을 모르면 시주(時柱)가 정확하지 않을 수 있습니다</p>
                  )}
                </div>

                <div>
                  <label className="text-[13px] text-text-tertiary block mb-1">성별</label>
                  <div className="flex gap-2">
                    {(['male', 'female'] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => setEditForm({ ...editForm, gender: g })}
                        className={`flex-1 py-2 rounded-lg text-[15px] font-medium border transition-all ${
                          editForm.gender === g
                            ? 'bg-[rgba(124,92,252,0.14)] border-cta/40 text-cta'
                            : 'bg-[rgba(255,255,255,0.04)] border-[var(--border-subtle)] text-text-secondary'
                        }`}
                      >
                        {g === 'male' ? '남자' : '여자'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[13px] text-text-tertiary block mb-1">메모 (선택)</label>
                  <input
                    value={editForm.memo}
                    onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
                    placeholder="예: 엄마, 친구 등"
                    className="w-full px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[var(--border-subtle)] text-sm text-text-primary focus:border-cta/50 outline-none"
                  />
                </div>

                <JobLoveStateInput
                  jobState={editForm.jobState}
                  customJobState={editForm.customJobState}
                  loveState={editForm.loveState}
                  customLoveState={editForm.customLoveState}
                  onJobStateChange={(v) => setEditForm({ ...editForm, jobState: v })}
                  onCustomJobStateChange={(v) => setEditForm({ ...editForm, customJobState: v })}
                  onLoveStateChange={(v) => setEditForm({ ...editForm, loveState: v })}
                  onCustomLoveStateChange={(v) => setEditForm({ ...editForm, customLoveState: v })}
                />
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => { setEditing(null); setEditForm(null); }}
                  className="flex-1 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[var(--border-subtle)] text-text-secondary text-[15px] font-medium"
                >
                  취소
                </button>
                <button
                  onClick={saveEdit}
                  disabled={!editForm.name.trim() || !editDateValidation.ok || !editTimeValidation.ok}
                  className="flex-1 py-2.5 rounded-lg bg-cta text-white text-[15px] font-semibold disabled:opacity-40 active:scale-[0.98]"
                >
                  저장
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
