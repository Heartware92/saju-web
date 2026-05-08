'use client';

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { CITY_COORDINATES } from '../utils/timeCorrection'
import { useProfileStore } from '../store/useProfileStore'
import { useUserStore } from '../store/useUserStore'
import { BackButton } from '../components/ui/BackButton'
import type { BirthProfile } from '../types/credit'
import styles from './SajuInputPage.module.css'

type Gender = 'male' | 'female'
type CalendarType = 'solar' | 'lunar'

// 연도별 띠 동물
const ZODIAC_ANIMALS = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'] as const;
const ZODIAC_ICONS = ['🐀', '🐂', '🐅', '🐇', '🐉', '🐍', '🐴', '🐑', '🐵', '🐔', '🐶', '🐷'] as const;
const STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'] as const;
const BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'] as const;

function getYearInfo(year: number) {
  const stemIdx = (year - 4) % 10;
  const branchIdx = (year - 4) % 12;
  return {
    ganZhi: `${STEMS[stemIdx]}${BRANCHES[branchIdx]}`,
    animal: ZODIAC_ANIMALS[branchIdx],
    icon: ZODIAC_ICONS[branchIdx],
  };
}

const THIS_YEAR = new Date().getFullYear();
const YEAR_INFO = getYearInfo(THIS_YEAR);

// 카테고리 정의 (앱과 동일)
// [B안] love/wealth 입력 카드는 비활성. 외부에서 ?category=love 로 진입 시 traditional 로 fallback.
const SAJU_CATEGORIES: Record<string, { title: string; icon: string; desc: string }> = {
  'today': { title: '오늘의 운세', icon: '☀️', desc: '하루의 흐름 미리보기' },
  'tomorrow': { title: '내일의 운세', icon: '🌙', desc: '미리 준비하는 내일' },
  'traditional': { title: '정통 사주', icon: '📜', desc: '나의 타고난 명운 분석' },
  'newyear': { title: `${THIS_YEAR} 신년운세`, icon: YEAR_INFO.icon, desc: `${YEAR_INFO.ganZhi}년 ${YEAR_INFO.animal}띠 총운` },
  'tojeong': { title: '토정비결', icon: '📖', desc: '한 해의 길흉화복' },
  'zamidusu': { title: '자미두수', icon: '🌌', desc: '북두칠성과 12궁으로 보는 명운' },
  // [비활성 — B안] 'love'/'wealth' 단독 카테고리는 메인 8 중복으로 제거
  // 'love': { title: '애정운', icon: '❤️', desc: '나의 인연과 연애 스타일' },
  // 'wealth': { title: '재물운', icon: '💰', desc: '재물 모으는 법과 시기' },
  'date': { title: '지정일 운세', icon: '📅', desc: '중요한 날의 기운 확인' },
}

export default function SajuInputPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const categoryId = searchParams?.get('category') || 'traditional'
  const category = SAJU_CATEGORIES[categoryId] || SAJU_CATEGORIES['traditional']
  // 프로필 관리 페이지에서 "+ 새 프로필 추가" 로 진입한 경우.
  // 분석 결과로 라우팅하지 않고 프로필만 저장 후 목록으로 복귀.
  const isProfileOnly = searchParams?.get('mode') === 'profile-only'
  const fromPage = searchParams?.get('from')

  const currentYear = new Date().getFullYear()
  const { user } = useUserStore()
  const { profiles, fetchProfiles, addProfile, updateProfile, deleteProfile } = useProfileStore()

  const [gender, setGender] = useState<Gender>('male')
  const [calendarType, setCalendarType] = useState<CalendarType>('solar')
  // 생년월일 YYYYMMDD (8자리) / 시간 HHMM (4자리) — 키보드 입력 + 엄격 검증
  const [birthDateStr, setBirthDateStr] = useState('')
  const [birthTimeStr, setBirthTimeStr] = useState('')
  const [unknownTime, setUnknownTime] = useState(false)
  const [birthPlace, setBirthPlace] = useState('seoul')
  const [targetDate, setTargetDate] = useState('')

  // 프로필 관련
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [editingProfile, setEditingProfile] = useState<BirthProfile | null>(null)
  const [profileForm, setProfileForm] = useState({
    name: '',
    memo: '',
  })

  useEffect(() => {
    if (user) {
      fetchProfiles()
    }
  }, [user])

  // 프로필 저장 전용 모드로 진입한 비로그인 사용자는 로그인 페이지로
  // — 일반 체험(사주 계산만)은 기존처럼 허용
  useEffect(() => {
    if (!user && isProfileOnly) {
      router.replace(`/login?from=${encodeURIComponent('/saju/input?mode=profile-only')}`)
    }
  }, [user, isProfileOnly, router])

  // ── 입력 검증 ───────────────────────────────────────────────
  // YYYYMMDD 형식 + 1900~현재년도 + 월/일 범위 + 실재 날짜
  const validateBirthDate = (s: string): { ok: boolean; year?: number; month?: number; day?: number; msg?: string } => {
    if (!s) return { ok: false, msg: '생년월일을 입력해주세요' }
    if (!/^\d{8}$/.test(s)) return { ok: false, msg: '8자리 숫자로 입력해주세요 (예: 19920914)' }
    const y = parseInt(s.slice(0, 4), 10)
    const m = parseInt(s.slice(4, 6), 10)
    const d = parseInt(s.slice(6, 8), 10)
    if (y < 1900 || y > currentYear) return { ok: false, msg: `연도는 1900~${currentYear} 사이여야 합니다` }
    if (m < 1 || m > 12) return { ok: false, msg: '월은 01~12 사이여야 합니다' }
    if (d < 1 || d > 31) return { ok: false, msg: '일은 01~31 사이여야 합니다' }
    // 실재일 검증 — 2월 30일 등 거름
    const dt = new Date(y, m - 1, d)
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
      return { ok: false, msg: '존재하지 않는 날짜입니다' }
    }
    return { ok: true, year: y, month: m, day: d }
  }

  // HHMM 형식 + 시(0~23) + 분(0~59)
  const validateBirthTime = (s: string): { ok: boolean; hour?: number; minute?: number; msg?: string } => {
    if (!s) return { ok: false, msg: '출생 시간을 입력해주세요 (모르면 옆 "모름" 체크)' }
    if (!/^\d{4}$/.test(s)) return { ok: false, msg: '4자리 숫자로 입력해주세요 (예: 1322)' }
    const h = parseInt(s.slice(0, 2), 10)
    const mi = parseInt(s.slice(2, 4), 10)
    if (h > 23) return { ok: false, msg: '시는 00~23 사이여야 합니다' }
    if (mi > 59) return { ok: false, msg: '분은 00~59 사이여야 합니다' }
    return { ok: true, hour: h, minute: mi }
  }

  const dateValidation = useMemo(() => validateBirthDate(birthDateStr), [birthDateStr])
  const timeValidation = useMemo(
    () => (unknownTime ? { ok: true, hour: 12, minute: 0 } : validateBirthTime(birthTimeStr)),
    [birthTimeStr, unknownTime],
  )

  // 입력 박스에 표시할 라이브 에러 메시지 — 사용자가 무언가 입력했을 때만 보여줌(첫 진입 시 빈 빨간 메시지 X)
  const dateError = birthDateStr.length > 0 && !dateValidation.ok ? dateValidation.msg : ''
  const timeError = !unknownTime && birthTimeStr.length > 0 && !timeValidation.ok ? timeValidation.msg : ''

  // 프로필 선택 시 폼에 반영
  const selectProfile = (profile: BirthProfile) => {
    setSelectedProfileId(profile.id)
    const [y, m, d] = profile.birth_date.split('-').map(Number)
    setBirthDateStr(`${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`)
    setGender(profile.gender)
    setCalendarType(profile.calendar_type)
    // 국외 도시 키 저장돼있던 기존 프로필은 서울로 fallback (옵션이 사라졌으므로)
    const place = profile.birth_place && CITY_COORDINATES[profile.birth_place] ? profile.birth_place : 'seoul'
    setBirthPlace(place)

    if (profile.birth_time) {
      const [h, min] = profile.birth_time.split(':').map(Number)
      setBirthTimeStr(`${String(h).padStart(2, '0')}${String(min).padStart(2, '0')}`)
      setUnknownTime(false)
    } else {
      setBirthTimeStr('')
      setUnknownTime(true)
    }
  }

  // 프로필 저장
  const handleSaveProfile = async () => {
    if (!profileForm.name.trim()) return
    // 형식 위반 시 저장 차단 — UI 의 disabled 와 함께 이중 가드
    if (!dateValidation.ok || !timeValidation.ok) return

    const { year, month, day } = dateValidation as { year: number; month: number; day: number }
    const birthDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const birthTime = unknownTime
      ? undefined
      : `${String((timeValidation as { hour: number }).hour).padStart(2, '0')}:${String((timeValidation as { minute: number }).minute).padStart(2, '0')}`

    const birthLongitude = CITY_COORDINATES[birthPlace]?.lng ?? null;

    if (editingProfile) {
      await updateProfile(editingProfile.id, {
        name: profileForm.name.trim(),
        birth_date: birthDate,
        birth_time: birthTime,
        birth_place: birthPlace,
        longitude: birthLongitude,
        gender,
        calendar_type: calendarType,
        memo: profileForm.memo || undefined,
      })
    } else {
      const created = await addProfile({
        name: profileForm.name.trim(),
        birth_date: birthDate,
        birth_time: birthTime,
        birth_place: birthPlace,
        longitude: birthLongitude,
        gender,
        calendar_type: calendarType,
        is_primary: profiles.length === 0,
        memo: profileForm.memo || undefined,
      })
      if (created) setSelectedProfileId(created.id)
    }

    setShowProfileModal(false)
    setEditingProfile(null)
    setProfileForm({ name: '', memo: '' })

    if (isProfileOnly) {
      router.replace(fromPage === 'sangdamso' ? '/sangdamso' : '/saju/profile')
    }
  }

  const handleEditProfile = (profile: BirthProfile) => {
    setEditingProfile(profile)
    setProfileForm({ name: profile.name, memo: profile.memo || '' })
    selectProfile(profile)
    setShowProfileModal(true)
  }

  const handleDeleteProfile = async (id: string) => {
    await deleteProfile(id)
    if (selectedProfileId === id) setSelectedProfileId(null)
  }

  // 출생지 옵션 — 대한민국 17개 시도만 (국외는 보정 정확도 문제로 제거)
  const cityOptions = useMemo(
    () => Object.entries(CITY_COORDINATES).map(([key, value]) => ({ key, name: value.name })),
    [],
  )

  const handleSubmit = () => {
    // 지정일 운세의 경우 날짜 검증
    if (categoryId === 'date' && !targetDate) {
      alert('확인하고 싶은 날짜를 입력해주세요.')
      return
    }

    // 생년월일·시간 형식 검증 — 위반 시 결과 화면 진입 차단
    if (!dateValidation.ok) {
      alert(dateValidation.msg || '생년월일을 확인해주세요')
      return
    }
    if (!timeValidation.ok) {
      alert(timeValidation.msg || '출생 시간을 확인해주세요')
      return
    }

    const { year, month, day } = dateValidation as { year: number; month: number; day: number }
    const { hour, minute } = unknownTime
      ? { hour: 12, minute: 0 }
      : (timeValidation as { hour: number; minute: number })

    const coords = CITY_COORDINATES[birthPlace] || CITY_COORDINATES['seoul']

    const queryParams = new URLSearchParams({
      year: year.toString(),
      month: month.toString(),
      day: day.toString(),
      hour: hour.toString(),
      minute: minute.toString(),
      gender,
      calendarType,
      longitude: coords.lng.toString(),
      unknownTime: unknownTime.toString(),
      category: categoryId,
      ...(targetDate && { targetDate })
    })

    // 카테고리별 결과 페이지 분기
    let target = '/saju/result';
    if (categoryId === 'tojeong') target = '/saju/tojeong';
    else if (categoryId === 'zamidusu') target = '/saju/zamidusu';
    else if (categoryId === 'newyear') target = '/saju/newyear';
    else if (categoryId === 'today') target = '/saju/today';
    else if (categoryId === 'date') target = '/saju/date';

    // 지정일 운세는 targetDate 를 date 파라미터로 전달
    if (categoryId === 'date' && targetDate) {
      queryParams.set('date', targetDate);
    }
    // 신년운세는 현재 연도 고정
    if (categoryId === 'newyear') {
      queryParams.set('year', String(currentYear));
    }

    router.push(`${target}?${queryParams.toString()}`)
  }

  return (
    <div className={styles.container}>
      {/* 통일 헤더 — 모든 진입 경로에서 카테고리 헤더 대신 단순 제목 + BackButton */}
      <div className="flex items-center relative mb-5 pt-3 px-1">
        <BackButton to={isProfileOnly ? '/saju/profile' : '/saju'} className="absolute left-0" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>
            {isProfileOnly ? '새 프로필' : '사주 정보 입력'}
          </h1>
        </div>
      </div>

      <motion.div
        className={styles.form}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {/* 저장된 프로필 선택 */}
        {/* 저장된 프로필 리스트 — 일반 진입 모드에서만 노출(사주 분석 시 기존 프로필 빠르게 선택용).
            프로필 추가 모드(isProfileOnly)에선 새 프로필 만드는 게 목적이라 기존 리스트 숨김. */}
        {user && !isProfileOnly && (
          <div className={styles.profileSection}>
            <div className={styles.profileLabel}>
              <span>저장된 프로필</span>
            </div>
            <div className={styles.profileList}>
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className={`${styles.profileCard} ${selectedProfileId === profile.id ? styles.selected : ''}`}
                  onClick={() => selectProfile(profile)}
                  onDoubleClick={() => handleEditProfile(profile)}
                  title="더블클릭으로 수정"
                >
                  <div className={styles.profileName}>{profile.name}</div>
                  <div className={styles.profileInfo}>
                    {profile.birth_date.replace(/-/g, '.')}
                  </div>
                </div>
              ))}
              <button
                className={styles.profileNewCard}
                onClick={() => {
                  setEditingProfile(null)
                  setProfileForm({ name: '', memo: '' })
                  setShowProfileModal(true)
                }}
              >
                <span style={{ fontSize: 20 }}>+</span>
                <span>추가</span>
              </button>
            </div>
          </div>
        )}

        {/* 프로필 저장 전용 모드: 이름을 본 화면에서 직접 입력 */}
        {isProfileOnly && (
          <div className={styles.section}>
            <label className={styles.label}>프로필 이름 <span style={{ color: '#F87171', fontSize: 13 }}>*</span></label>
            <input
              className={styles.textInput}
              type="text"
              placeholder="예: 나, 엄마, 친구 민수"
              value={profileForm.name}
              onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
              maxLength={20}
            />
          </div>
        )}

        {/* 성별 선택 */}
        <div className={styles.section}>
          <label className={styles.label}>성별</label>
          <div className={styles.toggleGroup}>
            <button
              className={`${styles.toggleBtn} ${gender === 'male' ? styles.active : ''}`}
              onClick={() => setGender('male')}
            >
              <span>👨</span> 남성
            </button>
            <button
              className={`${styles.toggleBtn} ${gender === 'female' ? styles.active : ''}`}
              onClick={() => setGender('female')}
            >
              <span>👩</span> 여성
            </button>
          </div>
        </div>

        {/* 양력/음력 선택 */}
        <div className={styles.section}>
          <label className={styles.label}>양력/음력</label>
          <div className={styles.toggleGroup}>
            <button
              className={`${styles.toggleBtn} ${calendarType === 'solar' ? styles.active : ''}`}
              onClick={() => setCalendarType('solar')}
            >
              ☀️ 양력
            </button>
            <button
              className={`${styles.toggleBtn} ${calendarType === 'lunar' ? styles.active : ''}`}
              onClick={() => setCalendarType('lunar')}
            >
              🌙 음력
            </button>
          </div>
        </div>

        {/* 생년월일 — YYYYMMDD 8자리 직접 입력 */}
        <div className={styles.section}>
          <label className={styles.label}>생년월일 (YYYYMMDD)</label>
          <input
            className={`${styles.textInput} ${dateError ? styles.inputError : ''}`}
            type="text"
            inputMode="numeric"
            pattern="\d{8}"
            maxLength={8}
            placeholder="YYYYMMDD (숫자 8자리)"
            value={birthDateStr}
            onChange={(e) => setBirthDateStr(e.target.value.replace(/\D/g, '').slice(0, 8))}
            aria-invalid={!!dateError}
          />
          {dateError && <p className={styles.errorMsg}>{dateError}</p>}
        </div>

        {/* 출생 시간 — HHMM 4자리 직접 입력 */}
        <div className={styles.section}>
          <div className={styles.labelRow}>
            <label className={styles.label}>출생 시간 (HHMM)</label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={unknownTime}
                onChange={(e) => setUnknownTime(e.target.checked)}
              />
              <span>모름</span>
            </label>
          </div>
          <input
            className={`${styles.textInput} ${timeError ? styles.inputError : ''}`}
            type="text"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            placeholder="HHMM (숫자 4자리, 24시 표기)"
            value={birthTimeStr}
            onChange={(e) => setBirthTimeStr(e.target.value.replace(/\D/g, '').slice(0, 4))}
            disabled={unknownTime}
            aria-invalid={!!timeError}
          />
          {timeError && <p className={styles.errorMsg}>{timeError}</p>}
          {unknownTime && (
            <p className={styles.hint}>
              시간을 모르면 시주(時柱)가 정확하지 않을 수 있습니다
            </p>
          )}
        </div>

        {/* 출생지 — 대한민국 17개 시도 */}
        <div className={styles.section}>
          <label className={styles.label}>출생지</label>
          <select
            className={styles.select}
            value={birthPlace}
            onChange={(e) => setBirthPlace(e.target.value)}
          >
            {cityOptions.map(city => (
              <option key={city.key} value={city.key}>{city.name}</option>
            ))}
          </select>
        </div>

        {/* 지정일 운세 전용: 날짜 입력 */}
        {categoryId === 'date' && (
          <div className={`${styles.section} ${styles.targetDateSection}`}>
            <label className={styles.labelHighlight}>📅 언제의 운세가 궁금하신가요?</label>
            <input
              type="date"
              className={styles.dateInput}
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
            <p className={styles.hint}>
              확인하고 싶은 날짜를 선택해주세요
            </p>
          </div>
        )}

        {/* 제출 버튼 — 형식 위반 시 disabled */}
        <motion.button
          className={styles.submitBtn}
          onClick={() => {
            if (isProfileOnly) {
              // 본 화면 인라인 입력으로 변경됨 — 모달 없이 직접 저장
              handleSaveProfile()
            } else {
              handleSubmit()
            }
          }}
          disabled={
            !dateValidation.ok ||
            !timeValidation.ok ||
            (isProfileOnly && !profileForm.name.trim())
          }
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isProfileOnly ? '프로필 저장' : `${category.title} 결과 보기`}
        </motion.button>

        {/* 하단 뒤로가기 — 일반 진입 모드에서만 노출.
            프로필 추가 모드는 상단 BackButton 사용으로 일관성 유지. */}
        {!isProfileOnly && (
          <button
            className={styles.backBtn}
            onClick={() => router.push('/saju')}
          >
            ← 프로필 목록으로
          </button>
        )}
      </motion.div>

      {/* 프로필 저장 모달 */}
      {showProfileModal && (
        <div className={styles.modalOverlay} onClick={() => setShowProfileModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>
              {editingProfile ? '프로필 수정' : '새 프로필 저장'}
            </h2>

            <div className={styles.section}>
              <label className={styles.label}>프로필 이름</label>
              <input
                className={styles.profileInput}
                placeholder="예: 나, 엄마, 친구 민수"
                value={profileForm.name}
                onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                autoFocus
              />
            </div>

            <p className={styles.hint} style={{ marginBottom: 12 }}>
              현재 입력된 생년월일/시간/성별/출생지가 프로필로 저장됩니다
            </p>

            <div className={styles.modalActions}>
              <button
                className={styles.modalBtnSecondary}
                onClick={() => {
                  setShowProfileModal(false)
                  setEditingProfile(null)
                }}
              >
                취소
              </button>
              {editingProfile && (
                <button
                  className={styles.modalBtnDanger}
                  onClick={() => {
                    handleDeleteProfile(editingProfile.id)
                    setShowProfileModal(false)
                    setEditingProfile(null)
                  }}
                >
                  삭제
                </button>
              )}
              <button
                className={styles.modalBtnPrimary}
                onClick={handleSaveProfile}
                disabled={!profileForm.name.trim() || !dateValidation.ok || !timeValidation.ok}
              >
                {editingProfile ? '수정' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
