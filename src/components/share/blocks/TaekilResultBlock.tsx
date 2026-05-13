'use client';

import type { TaekilResult, TaekilDay, TaekilGrade } from '@/engine/taekil';

interface Props {
  record: Record<string, any>;
}

const GRADE_COLOR: Record<TaekilGrade, string> = {
  '대길': '#34D399', '길': '#86EFAC', '평': '#CBD5E1', '흉': '#F87171',
};
const GRADE_BG: Record<TaekilGrade, string> = {
  '대길': 'rgba(52,211,153,0.15)', '길': 'rgba(134,239,172,0.12)',
  '평': 'rgba(203,213,225,0.08)', '흉': 'rgba(248,113,113,0.12)',
};
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const ELEMENT_COLORS: Record<string, string> = {
  '목': '#2D8659', '화': '#E63946', '토': '#F4A261', '금': '#94A3B8', '수': '#3B82F6',
};

interface TaekilDateAdvice { rank: number; summary: string; keywords: string[]; }
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
        keywords: keywordMatch ? keywordMatch[1].split(/[,，]/).map(k => k.trim()).filter(Boolean) : [],
      });
    } else {
      const extract = (label: string): string => {
        const re = new RegExp(`${label}[:：]\\s*([\\s\\S]*?)(?=\\n(?:분석|시간대|개운법|주의|종합|키워드)[:：]|$)`);
        const m = content.match(re);
        return m ? m[1].trim() : '';
      };
      const merged = [extract('분석'), extract('시간대'), extract('개운법'), extract('주의')]
        .filter(Boolean).join('\n');
      dates.push({ rank, summary: merged || content, keywords: [] });
    }
  }
  const avoidMatch = raw.match(/\[avoid\]\s*([\s\S]*?)$/);
  return { dates, avoid: avoidMatch ? avoidMatch[1].trim() : '' };
}

export function TaekilResultBlock({ record }: Props) {
  const stored = record.engine_result as TaekilResult | undefined;
  const content: string = record.interpretation_detailed || record.interpretation_basic || '';
  if (!stored || !stored.days) {
    return (
      <div className="rounded-2xl p-5 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <p className="text-[14px] text-text-secondary">택일 데이터를 불러오지 못했어요.</p>
      </div>
    );
  }

  const parsedAdvice = parseTaekilStructuredAdvice(content);
  // 사용자가 선택했던 날짜 = bestDays + 그 외 days 중 score 순 상위. 단, 결과는 bestDays 기준이 정확.
  // bestDays 가 비어있으면 days 전체에서 score 순 상위 5개 사용.
  const pickedDays: TaekilDay[] = (stored.bestDays && stored.bestDays.length > 0)
    ? stored.bestDays
    : [...stored.days].sort((a, b) => b.score - a.score).slice(0, 5);

  const catLabel = stored.customLabel
    ? `기타 — ${stored.customLabel}`
    : stored.categoryLabel ?? '택일';

  return (
    <>
      {/* 포디움 */}
      {pickedDays.length > 0 && (
        <div className="rounded-2xl p-5 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ display: 'inline-block', width: 4, height: 20, borderRadius: 2, background: '#34D399' }} />
            <h2 style={{ margin: 0, fontSize: 17, fontFamily: 'var(--font-serif)' }}>{catLabel} 추천 순위</h2>
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
                    flex: rank === 1 ? '1.2' : '1', minHeight: h,
                    padding: '14px 6px 12px',
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
                      color: GRADE_COLOR[d.grade],
                      background: GRADE_BG[d.grade],
                      border: `1px solid ${GRADE_COLOR[d.grade]}40`,
                    }}>{d.grade} · {d.score}점</span>
                  </div>
                );
              });
            })()}
          </div>

          {/* 점수 바 그래프 */}
          {pickedDays.length > 1 && (
            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {pickedDays.map(d => (
                  <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, width: 50, color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {d.date.slice(5).replace('-', '/')}
                    </span>
                    <div style={{ flex: 1, height: 16, borderRadius: 6, background: 'rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ width: `${d.score}%`, height: '100%', background: GRADE_COLOR[d.grade], opacity: 0.85, borderRadius: 6 }} />
                      <span style={{ position: 'absolute', right: 6, top: 0, fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {d.score}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, width: 28, textAlign: 'right', color: GRADE_COLOR[d.grade], flexShrink: 0 }}>
                      {d.grade}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 날짜별 상세 풀이 */}
      <div className="rounded-2xl p-5 mb-3 bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ display: 'inline-block', width: 4, height: 20, borderRadius: 2, background: 'var(--cta-primary)' }} />
          <h2 style={{ margin: 0, fontSize: 17, fontFamily: 'var(--font-serif)' }}>날짜별 상세 풀이</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {parsedAdvice.dates.length > 0 ? (
            <>
              {parsedAdvice.dates.map((adv, idx) => {
                const topDay = pickedDays[idx];
                const rankLabel = ['1위', '2위', '3위'][idx] ?? `${idx + 1}위`;
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
                      }}>{rankLabel}</span>
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
                        }}>{topDay.grade}</span>
                      )}
                    </div>

                    {adv.keywords.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                        {adv.keywords.map((kw, ki) => (
                          <span key={ki} style={{
                            padding: '4px 10px', borderRadius: 99,
                            fontSize: 12, fontWeight: 700,
                            color: 'var(--cta-primary)',
                            background: 'rgba(124,92,252,0.12)',
                            border: '1px solid rgba(124,92,252,0.25)',
                          }}>{kw}</span>
                        ))}
                      </div>
                    )}

                    {elEnergy && (
                      <div style={{
                        marginBottom: 14, padding: '12px 14px',
                        background: 'rgba(255,255,255,0.03)', borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 10 }}>오행 에너지</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {(['목', '화', '토', '금', '수'] as const).map(el => (
                            <div key={el} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 16, fontSize: 12, fontWeight: 800, color: ELEMENT_COLORS[el], textAlign: 'center' }}>{el}</span>
                              <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                <div style={{
                                  width: `${(elEnergy[el] ?? 1) * 10}%`, height: '100%',
                                  borderRadius: 5,
                                  background: `linear-gradient(90deg, ${ELEMENT_COLORS[el]}88, ${ELEMENT_COLORS[el]})`,
                                }} />
                              </div>
                              <span style={{ width: 16, fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textAlign: 'right' }}>{elEnergy[el]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {adv.summary && (
                      <div style={{ marginBottom: 14 }}>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.85, margin: 0, whiteSpace: 'pre-line', fontFamily: 'var(--font-body)' }}>
                          {adv.summary}
                        </p>
                      </div>
                    )}

                    {timeSlots && timeSlots.length > 0 && (
                      <div style={{ padding: '12px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 10 }}>시간 에너지 흐름</div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, height: 48, padding: '0 2px' }}>
                          {timeSlots.map(slot => {
                            const isPeak = slot.energy >= 7;
                            const barH = Math.max(6, (slot.energy / maxTimeEnergy) * 48);
                            return (
                              <div key={slot.zhi} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 3 }}>
                                <div style={{
                                  width: '100%', maxWidth: 18, height: barH, borderRadius: 3,
                                  background: isPeak
                                    ? 'linear-gradient(180deg, #34D399, rgba(52,211,153,0.4))'
                                    : slot.energy <= 3 ? 'rgba(248,113,113,0.3)' : 'rgba(148,163,184,0.2)',
                                }} />
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, padding: '0 2px' }}>
                          {timeSlots.map(slot => {
                            const startHour = slot.hours.split('~')[0].slice(0, 2);
                            const isPeak = slot.energy >= 7;
                            return (
                              <div key={slot.zhi} style={{
                                flex: 1, textAlign: 'center',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                              }}>
                                <span style={{
                                  fontSize: 9, fontWeight: isPeak ? 800 : 500,
                                  color: isPeak ? '#34D399' : 'var(--text-tertiary)',
                                  lineHeight: 1,
                                }}>{slot.zhi}</span>
                                <span style={{
                                  fontSize: 7.5, fontWeight: 500,
                                  color: isPeak ? 'rgba(52,211,153,0.75)' : 'var(--text-tertiary)',
                                  lineHeight: 1, letterSpacing: '-0.02em',
                                }}>{startHour}</span>
                              </div>
                            );
                          })}
                        </div>
                        {peakSlots.length > 0 && (
                          <div style={{
                            marginTop: 10, paddingTop: 8,
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                            fontSize: 11, color: 'var(--text-tertiary)',
                            textAlign: 'center', lineHeight: 1.5,
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
                  padding: 14, background: 'rgba(248,113,113,0.06)',
                  borderRadius: 14, border: '1px solid rgba(248,113,113,0.25)',
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
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>
                    {parsedAdvice.avoid}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div style={{
              padding: 16, background: 'rgba(20,12,38,0.55)', borderRadius: 14,
              border: '1px solid var(--border-subtle)',
              fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.85, whiteSpace: 'pre-line',
              fontFamily: 'var(--font-body)',
            }}>
              {content.replace(/^\s*\[(?:top\d|avoid)\].*$/gm, '').trim()}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
