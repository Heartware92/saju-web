'use client';

/**
 * 택일 운세 결과 페이지 — recordId 기반 단독 라우트
 * 입력은 TaekilPage 가 처리하고, 풀이 완료 후 archive recordId 와 함께 이 페이지로 navigate.
 * 보관함 진입(recordId in URL) 역시 동일 페이지를 사용.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { sajuDB } from '../services/supabase';
import { useProfileStore } from '../store/useProfileStore';
import { useUserStore } from '../store/useUserStore';
import { computeSajuFromProfile } from '../utils/profileSaju';
import { extractMetaphor } from '../utils/parseMetaphor';
import { BackButton } from '../components/ui/BackButton';
import { ShareBar } from '@/components/share/ShareBar';
import {
  TAEKIL_CATEGORIES,
  migrateLegacyCategory,
  type TaekilGrade,
  type TaekilDay,
  type TaekilResult,
} from '../engine/taekil';
import styles from './SajuResultPage.module.css';

// ── 상수 ──
const GRADE_COLOR: Record<TaekilGrade, string> = {
  '대길': '#34D399',
  '길': '#86EFAC',
  '평': '#94A3B8',
  '흉': '#F87171',
};
const GRADE_BG: Record<TaekilGrade, string> = {
  '대길': 'rgba(52,211,153,0.2)',
  '길': 'rgba(134,239,172,0.15)',
  '평': 'rgba(148,163,184,0.08)',
  '흉': 'rgba(248,113,113,0.15)',
};
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const ELEMENT_COLORS: Record<string, string> = {
  '목': '#2D8659', '화': '#E63946', '토': '#F4A261', '금': '#94A3B8', '수': '#3B82F6',
};

interface TaekilDateAdvice {
  rank: number;
  summary: string;
  keywords: string[];
}

function parseTaekilStructuredAdvice(raw: string): { dates: TaekilDateAdvice[]; avoid: string } {
  const dates: TaekilDateAdvice[] = [];
  const topRe = /\[top(\d)\]/g;
  const parts = raw.split(topRe);
  for (let i = 1; i < parts.length; i += 2) {
    const rank = parseInt(parts[i], 10);
    const content = (parts[i + 1] ?? '').split(/\[(?:top\d|avoid)\]/)[0].trim();
    const summaryMatch = content.match(/종합[:：]\s*([\s\S]*?)(?=\n키워드[:：]|$)/);
    const keywordMatch = content.match(/키워드[:：]\s*(.+)/);
    if (summaryMatch) {
      dates.push({
        rank,
        summary: summaryMatch[1].trim(),
        keywords: keywordMatch
          ? keywordMatch[1].split(/[,，]/).map(k => k.trim()).filter(Boolean)
          : [],
      });
    } else {
      const extract = (label: string): string => {
        const re = new RegExp(`${label}[:：]\\s*([\\s\\S]*?)(?=\\n(?:분석|시간대|개운법|주의|종합|키워드)[:：]|$)`);
        const m = content.match(re);
        return m ? m[1].trim() : '';
      };
      const analysis = extract('분석');
      const times = extract('시간대');
      const luck = extract('개운법');
      const caution = extract('주의');
      const merged = [analysis, times && `추천 시간대: ${times}`, luck && `개운법: ${luck}`, caution && `주의: ${caution}`].filter(Boolean).join('\n');
      dates.push({ rank, summary: merged || content, keywords: [] });
    }
  }
  const avoidMatch = raw.match(/\[avoid\]\s*([\s\S]*?)$/);
  const avoid = avoidMatch ? avoidMatch[1].trim() : '';
  return { dates, avoid };
}

export default function TaekilResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recordId = searchParams?.get('recordId') ?? null;
  const { user } = useUserStore();
  const { profiles, fetchProfiles } = useProfileStore();

  const [result, setResult] = useState<TaekilResult | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [parsedAdvice, setParsedAdvice] = useState<{ dates: TaekilDateAdvice[]; avoid: string } | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  // recordId 없으면 즉시 에러 상태로 시작 → useEffect 안 sync setState 회피
  const [loading, setLoading] = useState<boolean>(!!recordId);
  const [error, setError] = useState<string | null>(
    recordId ? null : '잘못된 접근이에요. recordId 가 없습니다.'
  );

  useEffect(() => {
    if (user) fetchProfiles();
  }, [user, fetchProfiles]);

  // recordId 기반 record load
  useEffect(() => {
    if (!recordId) return;
    let cancelled = false;
    sajuDB.getRecordById(recordId)
      .then((record) => {
        if (cancelled) return;
        if (!record) {
          setError('결과를 찾을 수 없어요.');
          setLoading(false);
          return;
        }
        const engine = record.engine_result as unknown as TaekilResult | null;
        if (engine) {
          const migrated = migrateLegacyCategory(engine.category as string) ?? engine.category;
          setResult({ ...engine, category: migrated });
        }
        const content = record.interpretation_detailed ?? record.interpretation_basic ?? '';
        if (content) {
          setAiAdvice(content);
          setParsedAdvice(parseTaekilStructuredAdvice(content));
        }
        setProfileId(record.profile_id ?? null);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('[taekil-result] load failed', e);
        setError('결과 로드 중 오류가 발생했어요.');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [recordId]);

  const targetProfile = useMemo(() => {
    if (!profileId) return null;
    return profiles.find(p => p.id === profileId) ?? null;
  }, [profiles, profileId]);

  const saju = useMemo(() => {
    if (!targetProfile) return null;
    return computeSajuFromProfile(targetProfile);
  }, [targetProfile]);

  const catLabel = useMemo(() => {
    if (!result) return '';
    return TAEKIL_CATEGORIES.find(c => c.id === result.category)?.label ?? '';
  }, [result]);

  // 점수순 정렬된 후보 날짜 목록
  const pickedDays = useMemo(() => {
    if (!result) return [];
    return [...result.days].sort((a, b) => b.score - a.score) as TaekilDay[];
  }, [result]);

  // ── 로딩/에러 ──
  if (loading) {
    return (
      <div className={styles.container}>
        <div className="flex items-center relative mb-5 pt-3 px-1">
          <BackButton className="absolute left-0" />
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>택일 운세</h1>
          </div>
        </div>
        <div className={styles.section} style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>결과를 불러오는 중이에요…</p>
        </div>
      </div>
    );
  }

  if (error || !result || !aiAdvice) {
    return (
      <div className={styles.container}>
        <div className="flex items-center relative mb-5 pt-3 px-1">
          <BackButton className="absolute left-0" />
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>택일 운세</h1>
          </div>
        </div>
        <div className={styles.section} style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>{error ?? '결과를 표시할 수 없어요.'}</p>
          <button
            onClick={() => router.push('/saju/taekil')}
            style={{
              padding: '12px 28px', borderRadius: 12,
              background: 'var(--cta-primary)', color: 'white',
              border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}
          >
            택일 다시하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <div className="flex items-center relative mb-5 pt-3 px-1">
        <BackButton className="absolute left-0" />
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-serif)' }}>택일 운세</h1>
          {targetProfile && (
            <p className="text-[12px] text-text-tertiary mt-0.5">
              {targetProfile.name}{catLabel ? ` · ${catLabel}` : ''}
              {result.customLabel ? ` · ${result.customLabel}` : ''}
              {result.subItem ? ` · ${result.subItem}` : ''}
            </p>
          )}
        </div>
      </div>

      <div className={styles.content}>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {/* 선택한 후보 날짜 */}
          {pickedDays.length > 0 && (
            <div className={styles.section} style={{ paddingTop: 12, paddingBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                선택한 후보 날짜
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {pickedDays.map((d) => {
                  const dayNum = parseInt(d.date.split('-')[2]);
                  const mon = parseInt(d.date.split('-')[1]);
                  const dow = WEEKDAYS[new Date(d.date).getDay()];
                  return (
                    <div key={d.date} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px',
                      background: 'rgba(124,92,252,0.12)',
                      border: '1px solid rgba(124,92,252,0.3)',
                      borderRadius: 10,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {mon}/{dayNum}({dow})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 포디움 — Top 3 */}
          {pickedDays.length > 0 && (
            <div className={styles.section}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ display: 'inline-block', width: 4, height: 20, borderRadius: 2, background: '#34D399' }} />
                <h2 style={{ margin: 0, fontSize: 17, fontFamily: 'var(--font-serif)' }}>
                  {catLabel} 추천 순위
                </h2>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, padding: '0 4px' }}>
                {(() => {
                  const top = pickedDays.slice(0, 3);
                  const podiumOrder = top.length >= 3
                    ? [{ d: top[1], rank: 2, h: 120 }, { d: top[0], rank: 1, h: 155 }, { d: top[2], rank: 3, h: 100 }]
                    : top.length === 2
                    ? [{ d: top[0], rank: 1, h: 155 }, { d: top[1], rank: 2, h: 120 }]
                    : [{ d: top[0], rank: 1, h: 155 }];
                  const rankBadge = ['', '1st', '2nd', '3rd'];
                  const rankColor = ['', '#FFD700', '#C0C0C0', '#CD7F32'];
                  return podiumOrder.map(({ d, rank, h }) => {
                    const dayNum = parseInt(d.date.split('-')[2]);
                    const mon = parseInt(d.date.split('-')[1]);
                    const dow = WEEKDAYS[new Date(d.date).getDay()];
                    return (
                      <div key={d.date} style={{
                        flex: rank === 1 ? '1.2' : '1',
                        minHeight: h, padding: '14px 6px 12px',
                        background: rank === 1
                          ? 'linear-gradient(180deg, rgba(255,215,0,0.15) 0%, rgba(124,92,252,0.12) 100%)'
                          : 'var(--space-elevated)',
                        border: rank === 1 ? '1.5px solid rgba(255,215,0,0.4)' : '1px solid var(--border-subtle)',
                        borderRadius: 16, textAlign: 'center',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}>
                        <span style={{ fontSize: rank === 1 ? 13 : 11, fontWeight: 800, color: rankColor[rank], letterSpacing: '0.05em' }}>
                          {rankBadge[rank]}
                        </span>
                        <span style={{ fontSize: rank === 1 ? 28 : 22, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                          {dayNum}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{mon}월 ({dow})</span>
                        <span style={{
                          marginTop: 4, padding: '3px 10px', borderRadius: 99,
                          fontSize: 11, fontWeight: 700,
                          color: GRADE_COLOR[d.grade], background: GRADE_BG[d.grade],
                          border: `1px solid ${GRADE_COLOR[d.grade]}40`,
                        }}>
                          {d.grade} · {d.score}점
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* 점수 바 그래프 */}
              {pickedDays.length > 1 && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {pickedDays.map((d) => (
                      <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, width: 50, color: 'var(--text-secondary)', flexShrink: 0 }}>
                          {d.date.slice(5).replace('-', '/')}
                        </span>
                        <div style={{
                          flex: 1, height: 16, borderRadius: 6,
                          background: 'rgba(255,255,255,0.05)',
                          position: 'relative', overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${d.score}%`, height: '100%',
                            background: GRADE_COLOR[d.grade], opacity: 0.85, borderRadius: 6,
                            transition: 'width 0.4s ease',
                          }} />
                          <span style={{
                            position: 'absolute', right: 6, top: 0,
                            fontSize: 10, fontWeight: 700, color: 'var(--text-primary)',
                            textShadow: '0 0 4px rgba(0,0,0,0.6)',
                          }}>
                            {d.score}
                          </span>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, width: 28, textAlign: 'right',
                          color: GRADE_COLOR[d.grade], flexShrink: 0,
                        }}>
                          {d.grade}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI 상세 카드 — 오행 에너지 + 시간 에너지 + 종합 풀이 */}
          <div className={styles.section}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ display: 'inline-block', width: 4, height: 20, borderRadius: 2, background: 'var(--cta-primary)' }} />
              <h2 style={{ margin: 0, fontSize: 17, fontFamily: 'var(--font-serif)' }}>
                날짜별 상세 풀이
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {parsedAdvice && parsedAdvice.dates.length > 0 ? (
                <>
                  {parsedAdvice.dates.map((adv, idx) => {
                    const topDay = pickedDays[idx];
                    const rankLabel = [`1위`, `2위`, `3위`][idx] ?? `${idx + 1}위`;
                    const rankColor = ['#FFD700', '#C0C0C0', '#CD7F32'][idx] ?? 'var(--text-secondary)';
                    const elEnergy = topDay?.elementEnergy;
                    const timeSlots = topDay?.timeSlots;
                    const peakSlots = timeSlots?.filter(t => t.energy >= 7) ?? [];
                    const maxTimeEnergy = timeSlots ? Math.max(...timeSlots.map(t => t.energy)) : 10;

                    return (
                      <div key={idx} style={{
                        padding: 16,
                        background: idx === 0
                          ? 'linear-gradient(135deg, rgba(255,215,0,0.08) 0%, rgba(20,12,38,0.55) 40%)'
                          : 'rgba(20,12,38,0.55)',
                        borderRadius: 14,
                        border: idx === 0 ? '1px solid rgba(255,215,0,0.25)' : '1px solid var(--border-subtle)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 28, height: 28, borderRadius: '50%',
                            background: `${rankColor}22`, border: `1.5px solid ${rankColor}`,
                            fontSize: 11, fontWeight: 800, color: rankColor,
                          }}>
                            {rankLabel}
                          </span>
                          {topDay && (
                            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>
                              {topDay.date} ({WEEKDAYS[new Date(topDay.date).getDay()]})
                            </span>
                          )}
                          {topDay && (
                            <span style={{
                              padding: '2px 8px', borderRadius: 99,
                              fontSize: 11, fontWeight: 700,
                              color: GRADE_COLOR[topDay.grade], background: GRADE_BG[topDay.grade],
                            }}>
                              {topDay.grade}
                            </span>
                          )}
                        </div>

                        {adv.keywords.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                            {adv.keywords.map((kw, ki) => (
                              <span key={ki} style={{
                                padding: '4px 10px', borderRadius: 99,
                                fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
                                color: 'var(--cta-primary)',
                                background: 'rgba(124,92,252,0.12)',
                                border: '1px solid rgba(124,92,252,0.25)',
                              }}>
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}

                        {elEnergy && (
                          <div style={{
                            marginBottom: 14, padding: '12px 14px',
                            background: 'rgba(255,255,255,0.03)', borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 10 }}>
                              오행 에너지
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {(['목', '화', '토', '금', '수'] as const).map((el) => (
                                <div key={el} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{
                                    width: 16, fontSize: 12, fontWeight: 800,
                                    color: ELEMENT_COLORS[el], textAlign: 'center',
                                  }}>{el}</span>
                                  <div style={{
                                    flex: 1, height: 10, borderRadius: 5,
                                    background: 'rgba(255,255,255,0.05)', overflow: 'hidden',
                                  }}>
                                    <div style={{
                                      width: `${(elEnergy[el] ?? 1) * 10}%`, height: '100%',
                                      borderRadius: 5,
                                      background: `linear-gradient(90deg, ${ELEMENT_COLORS[el]}88, ${ELEMENT_COLORS[el]})`,
                                      transition: 'width 0.5s ease',
                                    }} />
                                  </div>
                                  <span style={{
                                    width: 16, fontSize: 10, fontWeight: 700,
                                    color: 'var(--text-tertiary)', textAlign: 'right',
                                  }}>{elEnergy[el]}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {adv.summary && (
                          <div style={{ marginBottom: 14 }}>
                            <p style={{
                              fontSize: 14, color: 'var(--text-secondary)',
                              lineHeight: 1.85, margin: 0, whiteSpace: 'pre-line',
                              fontFamily: 'var(--font-body)',
                            }}>
                              {adv.summary}
                            </p>
                          </div>
                        )}

                        {timeSlots && timeSlots.length > 0 && (
                          <div style={{
                            padding: '16px 14px',
                            background: 'rgba(255,255,255,0.03)', borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14 }}>
                              시간 에너지 흐름
                            </div>
                            <div style={{
                              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                              gap: 3, height: 68, padding: '0 2px',
                            }}>
                              {timeSlots.map((slot) => {
                                const isPeak = slot.energy >= 7;
                                const barH = Math.max(8, (slot.energy / maxTimeEnergy) * 68);
                                return (
                                  <div key={slot.zhi} style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    flex: 1, gap: 3,
                                  }}>
                                    <div style={{
                                      width: '100%', maxWidth: 24, height: barH, borderRadius: 4,
                                      background: isPeak
                                        ? 'linear-gradient(180deg, #34D399, rgba(52,211,153,0.4))'
                                        : slot.energy <= 3
                                          ? 'rgba(248,113,113,0.3)'
                                          : 'rgba(148,163,184,0.2)',
                                      transition: 'height 0.4s ease',
                                    }} />
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '0 2px' }}>
                              {timeSlots.map((slot) => {
                                const startHour = slot.hours.split('~')[0].slice(0, 2);
                                const isPeak = slot.energy >= 7;
                                return (
                                  <div key={slot.zhi} style={{
                                    flex: 1, textAlign: 'center',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                                  }}>
                                    <span style={{
                                      fontSize: 14, fontWeight: isPeak ? 800 : 600,
                                      color: isPeak ? '#34D399' : 'var(--text-secondary)',
                                      letterSpacing: '-0.01em', lineHeight: 1.1,
                                    }}>{slot.zhi}</span>
                                    <span style={{
                                      fontSize: 9.5, fontWeight: 500,
                                      color: isPeak ? 'rgba(52,211,153,0.75)' : 'var(--text-tertiary)',
                                      lineHeight: 1, letterSpacing: '-0.02em',
                                    }}>{startHour}</span>
                                  </div>
                                );
                              })}
                            </div>
                            {peakSlots.length > 0 && (
                              <div style={{
                                marginTop: 12, paddingTop: 10,
                                borderTop: '1px solid rgba(255,255,255,0.06)',
                                fontSize: 12.5, color: 'var(--text-tertiary)',
                                lineHeight: 1.5, textAlign: 'center',
                              }}>
                                <span style={{ color: '#34D399', fontWeight: 700 }}>녹색 시간대</span>
                                가 에너지가 강한 구간이에요
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {parsedAdvice.avoid && (
                    <div style={{
                      padding: 14,
                      background: 'rgba(248,113,113,0.06)',
                      borderRadius: 14,
                      border: '1px solid rgba(248,113,113,0.25)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 22, height: 22, borderRadius: '50%',
                          background: 'rgba(248,113,113,0.15)',
                          fontSize: 11, fontWeight: 800, color: '#F87171',
                        }}>!</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#F87171' }}>피해야 할 날</span>
                      </div>
                      <p style={{
                        fontSize: 13, color: 'var(--text-secondary)',
                        lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line',
                      }}>
                        {parsedAdvice.avoid}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div style={{
                  padding: 16,
                  background: 'rgba(20,12,38,0.55)',
                  borderRadius: 14,
                  border: '1px solid var(--border-subtle)',
                  fontSize: 15,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.85,
                  whiteSpace: 'pre-line',
                  fontFamily: 'var(--font-body)',
                }}>
                  {extractMetaphor(aiAdvice.replace(/^\s*\[(?:top\d|avoid)\].*$/gm, '')).bodyText}
                </div>
              )}
            </div>

            <button
              onClick={() => router.push('/saju/taekil')}
              style={{
                width: '100%', marginTop: 16,
                padding: '14px', borderRadius: 12,
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontWeight: 600, fontSize: 14,
                cursor: 'pointer',
              }}
            >
              다른 날짜로 다시 풀이받기
            </button>
          </div>
        </motion.div>
      </div>

      {/* 공유 — 카카오톡 + URL 복사 */}
      {recordId && (
        <div style={{ marginTop: 24, marginBottom: 32, padding: '0 4px' }}>
          <ShareBar recordId={recordId} type="saju" category="taekil" />
        </div>
      )}
      {/* saju ref 살림 — TS unused 방지: 향후 confirm 모달/디버그용 */}
      {!saju && null}
    </div>
  );
}
