'use client';

/**
 * 보관함 — 이전에 본 풀이 기록 리스트.
 *
 * 클릭 시 원래 결과 페이지로 `?recordId=<id>` 쿼리와 함께 이동한다.
 * 결과 페이지 각각이 recordId 를 감지해 AI 호출·크레딧 차감 없이
 * 저장된 interpretation 을 그대로 렌더 (보관함 재생 모드).
 */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Card } from '../components/ui/Card';
import { sajuDB, tarotDB, supabase } from '../services/supabase';
import { useUserStore } from '../store/useUserStore';
import { useProfileStore } from '../store/useProfileStore';
import { SAJU_CATEGORY_LABEL, TAROT_SPREAD_LABEL } from '../constants/adminLabels';
import type { SajuRecord, TarotRecord } from '../types/credit';
import { ShareBar } from '@/components/share/ShareBar';
import { TAEKIL_CATEGORIES } from '../engine/taekil';

type TabType = 'saju' | 'tarot';

// ── 카테고리별 색 — 텍스트 컬러 칩으로 한눈에 구분 (아이콘 사용 X — 사용자 요청) ──
const SAJU_CATEGORY_COLOR: Record<string, string> = {
  // 큰 8 — 비비드 톤
  traditional: '#fbbf24', newyear: '#fb923c', today: '#facc15', date: '#a3e635',
  gunghap: '#f472b6', taekil: '#60a5fa', tojeong: '#a78bfa', zamidusu: '#c084fc',
  // 더많은운세 — 차분 톤
  love: '#f9a8d4', wealth: '#fcd34d', career: '#7dd3fc', health: '#86efac',
  study: '#fde047', people: '#e9d5ff', children: '#fbcfe8', personality: '#fdba74',
  name: '#bef264', dream: '#c4b5fd',
  basic: '#94a3b8', hybrid: '#a78bfa', period: '#a3e635', relation: '#94a3b8',
};

/** YYYY-MM-DD HH:mm 형식 */
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch {
    return iso;
  }
}

// 궁합 관계 칩 → 한글 라벨 (GunghapPage CATEGORY_LABEL_MAP 과 동일 — 칩 종류 표기용)
const GUNGHAP_CHIP_LABEL: Record<string, string> = {
  secret_crush: '짝사랑', som: '썸남·썸녀', lover: '연인', spouse: '배우자',
  ex_lover: 'X여친·X남친', ex_spouse: 'X남편·X아내', soulmate: '소울메이트',
  rival: '라이벌', mentor: '멘토·멘티', friend: '친구', parent_child: '부모와 자녀',
  sibling: '형제·자매', work: '직장 동료', business: '사업 파트너',
  idol_fan: '유명인과의 궁합', pet: '반려동물', custom: '직접 입력',
};

/**
 * 칩 선택이 있는 카테고리(궁합·택일)에서 어떤 칩을 봤는지 라벨 추출.
 * 칩 정보가 없으면 null — 호출부에서 배지 미표시.
 */
function getSubCategoryLabel(record: SajuRecord): string | null {
  const eng = record.engine_result;
  if (!eng) return null;
  if (record.category === 'gunghap') {
    const custom = typeof eng.customLabel === 'string' ? eng.customLabel.trim() : '';
    if (custom) return custom;
    const cat = typeof eng.gunghapCategory === 'string' ? eng.gunghapCategory : '';
    return GUNGHAP_CHIP_LABEL[cat] ?? null;
  }
  if (record.category === 'taekil') {
    const label = typeof eng.categoryLabel === 'string' ? eng.categoryLabel.trim() : '';
    if (label) return label;
    const cat = typeof eng.category === 'string' ? eng.category : '';
    return TAEKIL_CATEGORIES.find((c) => c.id === cat)?.label ?? null;
  }
  return null;
}

/**
 * 보관함에 표시할 프로필 라벨.
 * 우선순위:
 *   1) record.profile_name (저장 시점 스냅샷 — 신규 record)
 *   2) record.profile_id 로 현재 birth_profiles 매칭한 이름 (스냅샷 누락된 옛 record)
 *   3) birth_date + gender 로 매칭 (job-based 흐름에서 profile_id 도 안 채워진 옛 record)
 *   4) 생일 fallback
 *
 * 궁합 record 는 "본인 × 상대" 형식. 상대 이름이 없으면 상대 생일 fallback.
 */
function getProfileLabel(
  record: SajuRecord,
  profilesById: Map<string, string>,
  profilesByBirth: Map<string, string>,
): string {
  let myLabel: string | null = record.profile_name ?? null;
  if (!myLabel && record.profile_id) {
    myLabel = profilesById.get(record.profile_id) ?? null;
  }
  if (!myLabel && record.birth_date) {
    myLabel = profilesByBirth.get(`${record.birth_date}|${record.gender}`) ?? null;
  }
  if (!myLabel) return (record.birth_date || '').replace(/-/g, '.');

  if (record.partner_name) return `${myLabel} × ${record.partner_name}`;
  if (record.partner_birth_date) return `${myLabel} × ${record.partner_birth_date.replace(/-/g, '.')}`;
  return myLabel;
}

/** 사주 카테고리 → 결과 페이지 URL. recordId 를 쿼리로 붙인다.
 *  단, 정통사주(traditional) + 진행 중·실패 잡은 ?jobId 로 진입해 Realtime 구독. */
function getSajuRoute(record: SajuRecord): string {
  const cat = record.category;
  const isPendingJob =
    record.status === 'pending' || record.status === 'processing' || record.status === 'failed';

  // 백그라운드 잡 시스템 — 진행 중/실패 row 는 jobId 모드로 (Realtime 구독).
  // 새 카테고리 마이그레이션 시 여기 if 분기 추가. docs/ASYNC_FORTUNE_JOBS.md 참조.
  if (cat === 'traditional' && isPendingJob) {
    return `/saju/result?jobId=${record.id}`;
  }
  if (cat === 'gunghap' && isPendingJob) {
    return `/saju/gunghap?jobId=${record.id}`;
  }
  if (cat === 'newyear' && isPendingJob) {
    // newyear record 의 engine_result.source 가 'year-fortune' 인 경우엔 /saju/year-fortune 로
    // 보내야 하지만 진행 중 상태에선 URL 만 매칭하면 됨 — page.tsx 는 같은 PeriodFortunePage 사용.
    const src = (record.engine_result as { source?: string } | null)?.source;
    if (src === 'year-fortune') {
      return `/saju/year-fortune?jobId=${record.id}`;
    }
    return `/saju/newyear?jobId=${record.id}`;
  }
  if (cat === 'tojeong' && isPendingJob) {
    return `/saju/tojeong?jobId=${record.id}`;
  }
  if (cat === 'zamidusu' && isPendingJob) {
    return `/saju/zamidusu?jobId=${record.id}`;
  }
  if (cat === 'taekil' && isPendingJob) {
    return `/saju/taekil/result?jobId=${record.id}`;
  }
  // 지정일 운세 — 신규 잡은 category='period', 레거시 record 는 'date' 일 수 있어 둘 다 처리
  if ((cat === 'period' || cat === 'date') && isPendingJob) {
    return `/saju/date?jobId=${record.id}`;
  }
  if (cat === 'today' && isPendingJob) {
    return `/saju/today?jobId=${record.id}`;
  }
  // 더많은 운세 5종 — /saju/more/[category] 동적 라우트
  if (
    (cat === 'study' || cat === 'children' || cat === 'personality' || cat === 'name' || cat === 'dream')
    && isPendingJob
  ) {
    return `/saju/more/${cat}?jobId=${record.id}`;
  }

  const moreCategories = [
    'love', 'wealth', 'career', 'health', 'study', 'people',
    'children', 'personality', 'name', 'dream',
  ];
  if (moreCategories.includes(cat)) {
    return `/saju/more/${cat}?recordId=${record.id}`;
  }
  const map: Record<string, string> = {
    traditional: '/saju/result',
    today: '/saju/today',
    newyear: '/saju/newyear',
    taekil: '/saju/taekil',
    tojeong: '/saju/tojeong',
    zamidusu: '/saju/zamidusu',
    gunghap: '/saju/gunghap',
    date: '/saju/date',
    period: '/saju/date',
    basic: '/saju/result',
  };
  const base = map[cat] ?? '/archive';
  // newyear 의 연도별 운세 record 는 source 파라미터도 함께 — 헤더·로딩 라벨 분기용
  if (cat === 'newyear') {
    const src = (record.engine_result as { source?: string } | null)?.source;
    if (src === 'year-fortune') {
      return `${base}?recordId=${record.id}&source=year-fortune`;
    }
  }
  return `${base}?recordId=${record.id}`;
}

/** 타로 레코드 → 결과 페이지 URL. 보관함 진입은 readonly 결과 페이지로.
 *  진행 중·실패 잡은 ?jobId 로 TarotPage 진입 (Realtime 구독). */
function getTarotRoute(record: TarotRecord): string {
  const isPendingJob =
    record.status === 'pending' || record.status === 'processing' || record.status === 'failed';
  if (isPendingJob) {
    return `/tarot?jobId=${record.id}`;
  }
  // /tarot 는 라이브 드로잉 전용. /tarot/result 는 보관함 재생 전용.
  return `/tarot/result?recordId=${record.id}`;
}

export default function ArchivePage() {
  const { user } = useUserStore();
  // 옛 record 의 profile_name 이 NULL 일 때 profile_id 로 현재 이름을 매칭하기 위한 맵.
  const { profiles, fetchProfiles } = useProfileStore();
  const profilesById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.id, p.name);
    return m;
  }, [profiles]);
  // birth_date+gender 매칭 — profile_id 도 NULL 인 옛 record 보강용.
  const profilesByBirth = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(`${p.birth_date}|${p.gender}`, p.name);
    return m;
  }, [profiles]);
  const [activeTab, setActiveTab] = useState<TabType>('saju');
  const [sajuRecords, setSajuRecords] = useState<SajuRecord[]>([]);
  const [tarotRecords, setTarotRecords] = useState<TarotRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 삭제 확인 모달 — undo 안전망 없는 삭제는 무조건 confirm 한 번 받는다
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: 'saju'; id: string; label: string }
    | { kind: 'tarot'; id: string; label: string }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);
  // 진행 중 잡 클릭 시 안내 모달 — 백그라운드 처리 중이므로 로딩 페이지로 보내지 않고
  // "완료되면 확인하세요" 안내 후 보관함에 머무름.
  const [pendingJobModal, setPendingJobModal] = useState(false);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      if (pendingDelete.kind === 'saju') {
        const ok = await sajuDB.deleteRecord(pendingDelete.id);
        if (ok) setSajuRecords((prev) => prev.filter((r) => r.id !== pendingDelete.id));
      } else {
        const ok = await tarotDB.deleteRecord(pendingDelete.id);
        if (ok) setTarotRecords((prev) => prev.filter((r) => r.id !== pendingDelete.id));
      }
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  useEffect(() => {
    if (!user) return;
    // 옛 record 백필용 — birth_profiles 도 같이 불러둔다 (캐시 있으면 skip).
    void fetchProfiles({ userId: user.id });
    setLoading(true);
    setError(null);
    Promise.all([
      sajuDB.getRecords(user.id, 100),
      tarotDB.getRecords(user.id, 100),
    ])
      .then(([saju, tarot]) => {
        setSajuRecords(saju);
        setTarotRecords(tarot);
      })
      .catch((e) => {
        console.error('[archive] fetch failed', e);
        setError('기록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
      })
      .finally(() => setLoading(false));
  }, [user, fetchProfiles]);

  // ── Realtime 구독 — 진행 중 잡이 완료/실패되면 보관함 카드 status 자동 갱신 ──
  // "완료되면 확인하세요" 모달 후 사용자가 보관함에 머물 때, 모래시계가 자동으로
  // ✓(또는 실패)로 전환되도록. saju_records·tarot_records 양쪽 구독.
  useEffect(() => {
    if (!user) return;
    const userId = user.id;

    const sajuCh = supabase
      .channel(`archive-saju:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'saju_records', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          setSajuRecords((prev) =>
            prev.map((r) =>
              r.id === row.id
                ? {
                    ...r,
                    status: (row.status as SajuRecord['status']) ?? r.status,
                    error_message: (row.error_message as string | null) ?? r.error_message,
                  }
                : r,
            ),
          );
        },
      )
      .subscribe();

    const tarotCh = supabase
      .channel(`archive-tarot:${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tarot_records', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          setTarotRecords((prev) =>
            prev.map((r) =>
              r.id === row.id
                ? {
                    ...r,
                    status: (row.status as TarotRecord['status']) ?? r.status,
                    error_message: (row.error_message as string | null) ?? r.error_message,
                  }
                : r,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(sajuCh);
      void supabase.removeChannel(tarotCh);
    };
  }, [user]);

  const sajuSorted = useMemo(() => sajuRecords, [sajuRecords]);

  if (!user) {
    return (
      <div className="min-h-screen bg-space-deep px-4 pt-6 pb-4 flex flex-col items-center justify-center text-center">
        <p className="text-text-secondary mb-4">보관함은 로그인 후 이용할 수 있어요.</p>
        <Link href="/login?from=/archive" className="text-cta font-semibold underline">로그인하기</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-space-deep px-4 pt-4 pb-4">
      {/* Header — 메인 페이지라 뒤로가기 없음. 풀이 클릭 시 진입한 상세 페이지에는 유지 */}
      <div className="flex items-center relative mb-5 pt-3 px-1">
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>보관함</h1>
          <p className="text-base text-text-tertiary mt-1">이전에 본 풀이를 그대로 다시 볼 수 있어요</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('saju')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'saju'
              ? 'bg-cta text-white shadow-lg shadow-cta/20'
              : 'bg-space-surface text-text-secondary'
          }`}
        >
          사주 기록 {sajuRecords.length > 0 && <span className="ml-1 opacity-80">({sajuRecords.length})</span>}
        </button>
        <button
          onClick={() => setActiveTab('tarot')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'tarot'
              ? 'bg-cta text-white shadow-lg shadow-cta/20'
              : 'bg-space-surface text-text-secondary'
          }`}
        >
          타로 기록 {tarotRecords.length > 0 && <span className="ml-1 opacity-80">({tarotRecords.length})</span>}
        </button>
      </div>

      {loading && (
        <div className="text-center py-12 text-text-tertiary text-sm">불러오는 중…</div>
      )}
      {error && !loading && (
        <div className="text-center py-8 text-text-secondary text-sm">{error}</div>
      )}

      {!loading && !error && (
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'saju' && (
            <div className="space-y-3">
              {sajuSorted.length > 0 ? (
                sajuSorted.map((record) => {
                  // 연도별 운세 진입한 newyear record 는 라벨을 "연도별 운세" 로
                  const engineSource = (record.engine_result as { source?: string } | null)?.source;
                  const categoryLabel = record.category === 'newyear' && engineSource === 'year-fortune'
                    ? '연도별 운세'
                    : SAJU_CATEGORY_LABEL[record.category] ?? record.category;
                  const color = SAJU_CATEGORY_COLOR[record.category] ?? '#94a3b8';
                  const profileLabel = getProfileLabel(record, profilesById, profilesByBirth);
                  // 칩 선택이 있는 카테고리(궁합·택일) — 어떤 칩을 봤는지
                  const subLabel = getSubCategoryLabel(record);
                  return (
                    <div key={record.id} className="relative">
                      <Link
                        href={getSajuRoute(record)}
                        className="block"
                        onClick={(e) => {
                          // 진행 중 잡 — 로딩 페이지로 보내지 않고 안내 모달만 (사용자 결정)
                          if (record.status === 'pending' || record.status === 'processing') {
                            e.preventDefault();
                            setPendingJobModal(true);
                          }
                        }}
                      >
                        <Card padding="md" hover>
                          <div className="flex items-start gap-3">
                            {/* 좌측 카테고리 색 바 */}
                            <div
                              className="w-1 self-stretch rounded-full flex-shrink-0"
                              style={{ backgroundColor: color }}
                              aria-hidden="true"
                            />
                            <div className="flex-1 min-w-0 pr-7">
                              <div className="flex items-center gap-2 mb-1">
                                <h3
                                  className="text-sm font-bold truncate flex-shrink-0"
                                  style={{ color }}
                                >
                                  {categoryLabel}
                                </h3>
                                {subLabel && (
                                  <span
                                    className="text-[10px] font-semibold px-1.5 py-[1px] rounded flex-shrink min-w-0 truncate"
                                    style={{ color, backgroundColor: `${color}1f`, border: `1px solid ${color}55` }}
                                  >
                                    {subLabel}
                                  </span>
                                )}
                                {record.is_detailed && (
                                  <span className="text-[10px] text-cta border border-cta/40 px-1.5 py-[1px] rounded flex-shrink-0">상세</span>
                                )}
                              </div>
                              {/* 누구의 풀이인지 — profile_name (없으면 생일 fallback) */}
                              <p className="text-[12px] text-text-secondary truncate mb-1">
                                {profileLabel}
                              </p>
                              {/* 백그라운드 잡 상태 배지 — 진행 중/실패만 노출 (done 은 표시 X) */}
                              {(record.status === 'pending' || record.status === 'processing') && (
                                <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5 mt-0.5">
                                  <span className="w-2.5 h-2.5 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                                  풀이 준비 중…
                                </span>
                              )}
                              {record.status === 'failed' && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded px-1.5 py-0.5 mt-0.5">
                                  실패 · 자동 환불됨
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-text-tertiary flex-shrink-0 whitespace-nowrap mt-1">
                              {formatDate(record.created_at)}
                            </span>
                          </div>
                        </Card>
                      </Link>
                      {/* 공유 + 삭제 버튼 — Link 외부 absolute 로 배치해서 카드 클릭 충돌 방지 */}
                      <div className="absolute bottom-2 right-2 flex items-center gap-0.5">
                        <ShareBar recordId={record.id} type="saju" category={record.category} compact />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPendingDelete({ kind: 'saju', id: record.id, label: categoryLabel });
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          aria-label={`${categoryLabel} 기록 삭제`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState type="saju" />
              )}
            </div>
          )}

          {activeTab === 'tarot' && (
            <div className="space-y-3">
              {tarotRecords.length > 0 ? (
                tarotRecords.map((record) => {
                  const spreadLabel = TAROT_SPREAD_LABEL[record.spread_type] ?? record.spread_type;
                  return (
                    <div key={record.id} className="relative">
                      <Link
                        href={getTarotRoute(record)}
                        className="block"
                        onClick={(e) => {
                          if (record.status === 'pending' || record.status === 'processing') {
                            e.preventDefault();
                            setPendingJobModal(true);
                          }
                        }}
                      >
                        <Card padding="md" hover>
                          <div className="flex items-start gap-3">
                            <div
                              className="w-1 self-stretch rounded-full flex-shrink-0"
                              style={{ backgroundColor: '#a5b4fc' }}
                              aria-hidden="true"
                            />
                            <div className="flex-1 min-w-0 pr-7">
                              <h3 className="text-sm font-bold text-[#a5b4fc] truncate mb-1">
                                {spreadLabel}
                              </h3>
                              <p className="text-[12px] text-text-secondary truncate">
                                {record.question || '질문 없음'}
                              </p>
                            </div>
                            <span className="text-[10px] text-text-tertiary flex-shrink-0 whitespace-nowrap mt-1">
                              {formatDate(record.created_at)}
                            </span>
                          </div>
                        </Card>
                      </Link>
                      <div className="absolute bottom-2 right-2 flex items-center gap-0.5">
                        <ShareBar recordId={record.id} type="tarot" category={record.spread_type} compact />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPendingDelete({ kind: 'tarot', id: record.id, label: spreadLabel });
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          aria-label={`${spreadLabel} 기록 삭제`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState type="tarot" />
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* 삭제 확인 모달 — 비가역 작업이라 confirm 한 번 받음 */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-[calc(64px+env(safe-area-inset-bottom,0px))] sm:pb-4"
          style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}
          onClick={() => !deleting && setPendingDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-space-surface border border-[var(--border-subtle)] p-5"
          >
            <h3 className="text-base font-bold text-text-primary mb-2">기록을 삭제하시겠어요?</h3>
            <p className="text-sm text-text-secondary mb-1">
              <span className="font-semibold text-text-primary">{pendingDelete.label}</span> 기록을 삭제합니다.
            </p>
            <p className="text-xs text-text-tertiary mb-5">삭제한 기록은 복구할 수 없어요.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border-subtle)] text-sm text-text-secondary disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {deleting ? '삭제 중…' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 진행 중 잡 안내 모달 — 백그라운드 처리 중이므로 로딩 페이지로 보내지 않음.
          보관함에 머물면 Realtime 구독으로 완료 시 모래시계가 자동으로 ✓ 전환됨. */}
      {pendingJobModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}
          onClick={() => setPendingJobModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-space-surface border border-[var(--border-subtle)] p-5 text-center"
          >
            <div className="w-12 h-12 mx-auto mb-4 border-[3px] border-amber-300 border-t-transparent rounded-full animate-spin" />
            <h3 className="text-[19px] font-bold text-text-primary mb-2.5">풀이를 준비하고 있어요</h3>
            {/* word-break: keep-all — 한국어 단어 중간에서 줄바꿈되는 어색함 방지.
                두 문장은 <br/> 로 명시 분리해 줄바꿈을 깔끔하게. */}
            <p
              className="text-[15px] text-text-secondary leading-[1.65] mb-6"
              style={{ wordBreak: 'keep-all' }}
            >
              완료되면 이 보관함에서 바로 확인할 수 있어요.
              <br />
              다른 화면을 보셔도 괜찮아요.
            </p>
            <button
              type="button"
              onClick={() => setPendingJobModal(false)}
              className="w-full py-3.5 rounded-xl bg-cta text-white text-[16px] font-semibold"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ type }: { type: 'saju' | 'tarot' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="w-16 h-16 rounded-full bg-space-surface flex items-center justify-center text-sm font-bold text-text-tertiary mb-4"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        {type === 'saju' ? '사주' : '타로'}
      </div>
      <p className="text-text-secondary text-sm mb-1">
        {type === 'saju' ? '사주 풀이 기록이 아직 없어요' : '타로 풀이 기록이 아직 없어요'}
      </p>
      <p className="text-text-tertiary text-xs">
        풀이를 진행하면 여기에 자동으로 저장됩니다
      </p>
    </div>
  );
}
