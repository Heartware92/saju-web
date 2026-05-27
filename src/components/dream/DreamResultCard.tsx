'use client';

/**
 * 꿈해몽 결과 카드 V4 — 가로 2탭 (동양적 풀이 / 서양적 풀이) + 11섹션
 *
 * 동양 탭 (6 섹션):
 *   1. 어떤 꿈인가요   — 길흉 게이지 + 라벨 칩 + 근거
 *   2. 꿈 속 상징      — 상징 카드 그리드
 *   3. 다가올 일       — 6 도메인 막대
 *   4. 꿈꾼 때의 의미  — 시진 영험도 그래프 (시각 입력 시)
 *   5. 이렇게 해보세요 — 처방 본문 + "키:값" 그리드
 *   6. 조심할 점       — 좌측 띠 박스
 *
 * 서양 탭 (5 섹션):
 *   1. 이 꿈의 정체           — 임상 유형 배지 + 기능 가설
 *   2. 마음 깊은 곳의 신호    — Freud 표면↔잠재 대비
 *   3. 꿈 속 등장인물의 의미  — Jung archetype 카드
 *   4. 지금 삶과의 거울       — Continuity 메시지 박스
 *   5. 스스로 해볼 수 있는 작업 — Gestalt 1인칭 워크 / IRT 다시쓰기
 *
 * 디자인:
 *   - SectionCollapsible 의 cosmic burst 펼침 애니메이션 그대로 차용
 *   - 신년운세·정통사주의 폰트·색상·간격 토큰 동일시
 *   - 옛 record (legacy 6마커) 는 fallback으로 옛 카드 렌더링
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { SectionCollapsible } from '../saju/SectionCollapsible';
import {
  TIME_BANDS,
  SIJIN_RULES,
  DOMAIN_TAGS,
  ARCHETYPE_LABELS,
  CLINICAL_LABELS,
  type ArchetypeId,
  type ClinicalDreamType,
} from '../../constants/dreamSymbols';
import type {
  DreamV4Result,
  DreamSymbolCardData,
  DreamDomainScore,
  DreamAdviceItem,
  DreamArchetypeCard,
  DreamPolarityLabel,
} from '../../services/fortuneService';

// ════════════════════════════════════════════════════════════════════
// 색상 토큰 (신년운세 GRADE_COLOR 와 일치)
// ════════════════════════════════════════════════════════════════════
const POLARITY_COLOR: Record<DreamPolarityLabel, string> = {
  '대길': '#34D399',
  '길':   '#86EFAC',
  '중길': '#FBBF24',
  '평':   '#CBD5E1',
  '중흉': '#FB923C',
  '흉':   '#F87171',
  '':     '#CBD5E1',
};

const SYM_POLARITY_COLOR: Record<DreamSymbolCardData['polarity'], string> = {
  good:    '#34D399',
  bad:     '#F87171',
  mixed:   '#FBBF24',
  neutral: '#CBD5E1',
};
const SYM_POLARITY_LABEL: Record<DreamSymbolCardData['polarity'], string> = {
  good:    '길',
  bad:     '흉',
  mixed:   '혼재',
  neutral: '중립',
};

// ════════════════════════════════════════════════════════════════════
// 시각 컴포넌트 — 동양 탭
// ════════════════════════════════════════════════════════════════════

function PolarityScoreCard({ diag }: { diag: DreamV4Result['oriental_diagnosis'] }) {
  const color = POLARITY_COLOR[diag.polarity] || '#CBD5E1';
  const tagList = diag.label.split(/\s*[·•]\s*/).filter(Boolean);
  return (
    <div style={{
      padding: '16px 18px',
      borderRadius: 14,
      background: `linear-gradient(135deg, rgba(20,12,38,0.6), ${color}12)`,
      border: `1px solid ${color}55`,
    }}>
      {/* 점수 + 등급 */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{
            fontSize: 38, fontWeight: 800, lineHeight: 1,
            fontFamily: 'var(--font-serif)',
            color,
            textShadow: `0 0 18px ${color}55`,
          }}>{diag.score}</span>
          <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>점</span>
        </span>
        {diag.polarity && (
          <span style={{
            fontSize: 15, fontWeight: 800,
            padding: '4px 12px', borderRadius: 10,
            background: `${color}22`, color, border: `1px solid ${color}55`,
            fontFamily: 'var(--font-title)',
          }}>{diag.polarity}몽</span>
        )}
      </div>
      {/* 점수 막대 */}
      <div style={{
        height: 10, borderRadius: 99, overflow: 'hidden',
        background: 'rgba(255,255,255,0.06)', marginBottom: 14,
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(4, diag.score)}%` }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
          style={{
            height: '100%', borderRadius: 99,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            boxShadow: `0 0 12px ${color}66`,
          }}
        />
      </div>
      {/* 태그 칩 */}
      {tagList.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: diag.reason ? 12 : 0 }}>
          {tagList.map((tag, i) => (
            <span key={i} style={{
              padding: '4px 12px', borderRadius: 99,
              fontSize: 13, fontWeight: 700,
              color, background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${color}55`,
              fontFamily: 'var(--font-title)',
            }}>{tag}</span>
          ))}
        </div>
      )}
      {/* 근거 본문 */}
      {diag.reason && (
        <p style={{
          margin: 0, fontSize: 15, lineHeight: 1.8,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-body)',
          wordBreak: 'keep-all',
        }}>{diag.reason}</p>
      )}
    </div>
  );
}

function SymbolCardGrid({ symbols }: { symbols: DreamSymbolCardData[] }) {
  if (symbols.length === 0) {
    return <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>매칭된 상징이 없어요.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {symbols.map((s, i) => {
        const color = SYM_POLARITY_COLOR[s.polarity];
        const polLabel = SYM_POLARITY_LABEL[s.polarity];
        const domain = DOMAIN_TAGS.find(d => d.id === s.domain);
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
            style={{
              padding: '14px 16px', borderRadius: 12,
              background: `${color}10`,
              border: `1px solid ${color}40`,
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap',
            }}>
              <span style={{
                fontSize: 17, fontWeight: 800,
                fontFamily: 'var(--font-title)',
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
              }}>{s.name}</span>
              <span style={{
                fontSize: 11, fontWeight: 700,
                padding: '2px 8px', borderRadius: 6,
                color, background: `${color}20`,
              }}>{polLabel}</span>
              {domain && (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  padding: '2px 8px', borderRadius: 6,
                  color: domain.color, background: `${domain.color}15`,
                  border: `1px solid ${domain.color}40`,
                }}>{domain.icon} {domain.id}</span>
              )}
            </div>
            <p style={{
              margin: 0, fontSize: 14, lineHeight: 1.7,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-body)',
              wordBreak: 'keep-all',
            }}>{s.meaning}</p>
          </motion.div>
        );
      })}
    </div>
  );
}

function DomainBarsCard({ domains }: { domains: DreamDomainScore[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {domains.map((d, i) => {
        const meta = DOMAIN_TAGS.find(t => t.id === d.label);
        const color = meta?.color || '#A78BFA';
        return (
          <motion.div
            key={d.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              marginBottom: 6,
            }}>
              <span style={{
                fontSize: 14, fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-title)',
              }}>
                {meta?.icon} {d.label}
              </span>
              <span style={{
                fontSize: 13, fontWeight: 800,
                color, fontFamily: 'var(--font-serif)',
              }}>{d.score}</span>
            </div>
            <div style={{
              height: 6, borderRadius: 99,
              background: 'rgba(255,255,255,0.06)',
              overflow: 'hidden', marginBottom: 4,
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(3, d.score)}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 + i * 0.05 }}
                style={{
                  height: '100%', borderRadius: 99,
                  background: `linear-gradient(90deg, ${color}99, ${color})`,
                  boxShadow: `0 0 8px ${color}55`,
                }}
              />
            </div>
            {d.note && (
              <p style={{
                margin: 0, fontSize: 13, lineHeight: 1.6,
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-body)',
                wordBreak: 'keep-all',
              }}>{d.note}</p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function SijinChart({ timing, timeBandId }: { timing: string; timeBandId?: string }) {
  // 사용자 시각이 어느 시진에 매핑되는지 (TIME_BANDS 의 hour → SIJIN_RULES)
  const band = TIME_BANDS.find(b => b.id === timeBandId);
  const userSijinIdx = (() => {
    if (!band || band.hour < 0) return -1;
    const minutes = band.hour * 60;
    if (minutes >= 23 * 60 + 30 || minutes < 1 * 60 + 30) return 0;
    if (minutes < 3 * 60 + 30) return 1;
    if (minutes < 5 * 60 + 30) return 2;
    if (minutes < 7 * 60 + 30) return 3;
    if (minutes < 9 * 60 + 30) return 4;
    if (minutes < 11 * 60 + 30) return 5;
    if (minutes < 13 * 60 + 30) return 6;
    if (minutes < 15 * 60 + 30) return 7;
    if (minutes < 17 * 60 + 30) return 8;
    if (minutes < 19 * 60 + 30) return 9;
    if (minutes < 21 * 60 + 30) return 10;
    return 11;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 12지시 영험도 막대 그래프 */}
      <div>
        <div style={{
          display: 'flex', gap: 3, alignItems: 'flex-end',
          height: 80, marginBottom: 6,
        }}>
          {SIJIN_RULES.map((s, i) => {
            const isUser = i === userSijinIdx;
            const heightPct = (s.weight / 5) * 100;
            const barColor = s.weight >= 4 ? '#FBBF24' : s.weight >= 3 ? '#A78BFA' : 'rgba(255,255,255,0.15)';
            return (
              <div key={s.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${heightPct}%` }}
                  transition={{ duration: 0.6, delay: 0.05 * i, ease: 'easeOut' }}
                  style={{
                    width: '100%',
                    background: isUser
                      ? 'linear-gradient(180deg, #FCE8B2, #FBBF24)'
                      : barColor,
                    borderRadius: '3px 3px 0 0',
                    boxShadow: isUser ? '0 0 12px rgba(252,232,178,0.7)' : 'none',
                  }}
                />
                <span style={{
                  fontSize: 10, fontWeight: isUser ? 800 : 500,
                  color: isUser ? '#FCE8B2' : 'var(--text-tertiary)',
                  fontFamily: 'var(--font-title)',
                }}>{s.id.slice(0, 1).toUpperCase() === 'J' ? '자' : s.label.charAt(3)}</span>
              </div>
            );
          })}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-tertiary)',
          textAlign: 'center', fontFamily: 'var(--font-body)',
        }}>
          자 · 축 · 인 · 묘 · 진 · 사 · 오 · 미 · 신 · 유 · 술 · 해 (12 시진)
        </div>
      </div>
      {/* 시진 본문 */}
      {timing && (
        <p style={{
          margin: 0, fontSize: 15, lineHeight: 1.8,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-body)',
          wordBreak: 'keep-all',
          padding: '12px 14px',
          background: 'rgba(252,232,178,0.06)',
          border: '1px solid rgba(252,232,178,0.20)',
          borderRadius: 10,
        }}>{timing}</p>
      )}
    </div>
  );
}

function AdviceCard({ advice }: { advice: { body: string; items: DreamAdviceItem[] } }) {
  const paras = advice.body.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {paras.length > 0 && (
        <div style={{
          padding: '16px 18px', borderRadius: 12,
          background: 'rgba(52,211,153,0.08)',
          border: '1px solid rgba(52,211,153,0.28)',
        }}>
          {paras.map((p, i) => (
            <p key={i} style={{
              margin: i === 0 ? 0 : '10px 0 0 0',
              fontSize: 15, lineHeight: 1.8,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
              wordBreak: 'keep-all',
            }}>{p}</p>
          ))}
        </div>
      )}
      {advice.items.length > 0 && (
        <div style={{
          padding: 14,
          background: 'rgba(124,92,252,0.06)',
          border: '1px solid rgba(124,92,252,0.20)',
          borderRadius: 12,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 10,
        }}>
          {advice.items.map((it, i) => (
            <div key={i} style={{
              padding: '12px 14px',
              background: 'rgba(20,12,38,0.5)',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{
                fontSize: 12, fontWeight: 800,
                color: 'var(--cta-primary)',
                marginBottom: 4,
                fontFamily: 'var(--font-title)',
                letterSpacing: '-0.01em',
              }}>{it.key}</div>
              <div style={{
                fontSize: 14, fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.5,
                fontFamily: 'var(--font-body)',
              }}>{it.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CautionBox({ text }: { text: string }) {
  const paras = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  if (paras.length === 0) {
    return <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>주의할 점은 특별히 없어요.</p>;
  }
  return (
    <div style={{
      padding: '14px 18px',
      borderLeft: '3px solid #F87171',
      background: 'rgba(248,113,113,0.06)',
      borderRadius: 10,
    }}>
      {paras.map((p, i) => (
        <p key={i} style={{
          margin: i === 0 ? 0 : '10px 0 0 0',
          fontSize: 15, lineHeight: 1.8,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-body)',
          wordBreak: 'keep-all',
        }}>{p}</p>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// 시각 컴포넌트 — 서양 탭
// ════════════════════════════════════════════════════════════════════

function ClinicalDiagnosisCard({ diag }: { diag: DreamV4Result['western_diagnosis'] }) {
  const clinical = CLINICAL_LABELS[diag.clinical as ClinicalDreamType];
  const color = clinical?.color || '#A78BFA';
  const intensityColor = diag.intensity === 'high' ? '#F87171'
    : diag.intensity === 'medium' ? '#FBBF24'
    : diag.intensity === 'low' ? '#34D399' : '#CBD5E1';
  return (
    <div style={{
      padding: '16px 18px', borderRadius: 14,
      background: `linear-gradient(135deg, rgba(20,12,38,0.6), ${color}12)`,
      border: `1px solid ${color}55`,
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {clinical && (
          <span style={{
            padding: '6px 14px', borderRadius: 10,
            fontSize: 15, fontWeight: 800,
            color, background: `${color}22`,
            border: `1px solid ${color}55`,
            fontFamily: 'var(--font-title)',
          }}>{clinical.ko}</span>
        )}
        {diag.intensity && (
          <span style={{
            padding: '6px 12px', borderRadius: 10,
            fontSize: 13, fontWeight: 700,
            color: intensityColor, background: `${intensityColor}15`,
            border: `1px solid ${intensityColor}40`,
            fontFamily: 'var(--font-title)',
          }}>강도 {diag.intensity === 'high' ? '강' : diag.intensity === 'medium' ? '중' : '약'}</span>
        )}
      </div>
      {clinical?.desc && (
        <p style={{
          margin: '0 0 10px 0', fontSize: 13, lineHeight: 1.6,
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-body)',
        }}>{clinical.desc}</p>
      )}
      {diag.reason && (
        <p style={{
          margin: 0, fontSize: 15, lineHeight: 1.8,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-body)',
          wordBreak: 'keep-all',
        }}>{diag.reason}</p>
      )}
    </div>
  );
}

function LatentDiptychCard({ latent }: { latent: DreamV4Result['western_latent'] }) {
  const workLabel: Record<string, string> = {
    condensation: '응축',
    displacement: '전치',
    symbolization: '형상화',
    secondary_revision: '2차 가공',
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
      }}>
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: 'rgba(168,139,250,0.08)',
          border: '1px solid rgba(168,139,250,0.30)',
        }}>
          <div style={{
            fontSize: 12, fontWeight: 800,
            color: '#A78BFA', marginBottom: 6,
            fontFamily: 'var(--font-title)',
          }}>표면 (manifest)</div>
          <p style={{
            margin: 0, fontSize: 14, lineHeight: 1.6,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)',
            wordBreak: 'keep-all',
          }}>{latent.surface || '—'}</p>
        </div>
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: 'rgba(232,164,144,0.08)',
          border: '1px solid rgba(232,164,144,0.30)',
        }}>
          <div style={{
            fontSize: 12, fontWeight: 800,
            color: '#E8A490', marginBottom: 6,
            fontFamily: 'var(--font-title)',
          }}>잠재 (latent)</div>
          <p style={{
            margin: 0, fontSize: 14, lineHeight: 1.6,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)',
            wordBreak: 'keep-all',
          }}>{latent.latent || '—'}</p>
        </div>
      </div>
      {latent.work && workLabel[latent.work] && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <span style={{
            padding: '4px 14px', borderRadius: 99,
            fontSize: 12, fontWeight: 700,
            color: '#FCE8B2', background: 'rgba(252,232,178,0.10)',
            border: '1px solid rgba(252,232,178,0.30)',
            fontFamily: 'var(--font-title)',
          }}>꿈 작업: {workLabel[latent.work]}</span>
        </div>
      )}
      {latent.body && (
        <p style={{
          margin: 0, fontSize: 15, lineHeight: 1.8,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-body)',
          wordBreak: 'keep-all',
        }}>{latent.body}</p>
      )}
    </div>
  );
}

function ArchetypeCardGrid({ items }: { items: DreamArchetypeCard[] }) {
  if (items.length === 0) {
    return <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>분석할 등장인물·동물이 또렷하지 않아요.</p>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it, i) => {
        const meta = ARCHETYPE_LABELS[it.archetype as ArchetypeId];
        const color = meta?.color || '#A78BFA';
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            style={{
              padding: '14px 16px', borderRadius: 12,
              background: `${color}10`,
              border: `1px solid ${color}40`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 16, fontWeight: 800,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-title)',
                letterSpacing: '-0.01em',
              }}>{it.target}</span>
              {meta && (
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  padding: '2px 10px', borderRadius: 99,
                  color, background: `${color}20`,
                  border: `1px solid ${color}50`,
                  fontFamily: 'var(--font-title)',
                }}>{meta.ko}</span>
              )}
            </div>
            {it.note && (
              <p style={{
                margin: '0 0 6px 0', fontSize: 14, lineHeight: 1.7,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-body)',
                wordBreak: 'keep-all',
              }}>{it.note}</p>
            )}
            {meta?.desc && (
              <p style={{
                margin: 0, fontSize: 12, lineHeight: 1.5,
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-body)',
                wordBreak: 'keep-all',
              }}>{meta.desc}</p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function MirrorBlock({ text }: { text: string }) {
  if (!text) return null;
  const paras = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  return (
    <div style={{
      padding: '16px 18px', borderRadius: 12,
      background: 'rgba(96,165,250,0.06)',
      border: '1px solid rgba(96,165,250,0.28)',
    }}>
      {paras.map((p, i) => (
        <p key={i} style={{
          margin: i === 0 ? 0 : '10px 0 0 0',
          fontSize: 15, lineHeight: 1.8,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-body)',
          wordBreak: 'keep-all',
        }}>{p}</p>
      ))}
    </div>
  );
}

function SelfWorkCard({ text }: { text: string }) {
  if (!text) return null;
  const paras = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  return (
    <div style={{
      padding: '18px 20px', borderRadius: 14,
      background: 'linear-gradient(135deg, rgba(124,92,252,0.10), rgba(252,232,178,0.06))',
      border: '1px solid rgba(124,92,252,0.30)',
    }}>
      <div style={{
        fontSize: 13, fontWeight: 800,
        color: '#FCE8B2', marginBottom: 10,
        fontFamily: 'var(--font-title)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}>스스로 해보는 작업</div>
      {paras.map((p, i) => (
        <p key={i} style={{
          margin: i === 0 ? 0 : '10px 0 0 0',
          fontSize: 15, lineHeight: 1.85,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-body)',
          wordBreak: 'keep-all',
        }}>{p}</p>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// 메인 — DreamResultCard
// ════════════════════════════════════════════════════════════════════

interface Props {
  title: string;
  result: DreamV4Result;
  /** 사용자가 입력한 시간대 ID (시진 그래프 마커용) — 옛 record면 undefined */
  timeBandId?: string;
}

type TrackTab = 'oriental' | 'western';

export function DreamResultCard({ title, result, timeBandId }: Props) {
  const [tab, setTab] = useState<TrackTab>('oriental');

  return (
    <motion.div
      key="dream-v4-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      style={{ paddingTop: 4 }}
    >
      {/* 카드 헤더 */}
      <div className="flex items-center gap-2 mb-3 pl-1">
        <span className="inline-block w-1 h-5 rounded-full bg-cta" />
        <div
          className="text-[17px] font-bold text-text-primary tracking-tight"
          style={{ fontFamily: 'var(--font-title)' }}
        >
          {title}
        </div>
      </div>

      {/* 2탭 스위치 */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 8, marginBottom: 14,
        padding: 4,
        background: 'rgba(20,12,38,0.55)',
        borderRadius: 14,
        border: '1px solid var(--border-subtle)',
      }}>
        <TabButton active={tab === 'oriental'} onClick={() => setTab('oriental')} label="동양적 풀이" sub="주공해몽·민속" />
        <TabButton active={tab === 'western'} onClick={() => setTab('western')} label="서양적 풀이" sub="프로이트·융" />
      </div>

      {/* 탭 컨텐츠 */}
      <AnimatePresence mode="wait">
        {tab === 'oriental' ? (
          <motion.div
            key="oriental"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-3"
          >
            <SectionCollapsible title="이 꿈은 어떤 꿈인가요" defaultOpen enterDelay={0}>
              <PolarityScoreCard diag={result.oriental_diagnosis} />
            </SectionCollapsible>

            <SectionCollapsible title="꿈 속 상징" enterDelay={0.06}>
              <SymbolCardGrid symbols={result.oriental_symbols} />
            </SectionCollapsible>

            <SectionCollapsible title="다가올 일 — 6 영역" enterDelay={0.12}>
              <DomainBarsCard domains={result.oriental_domains} />
            </SectionCollapsible>

            <SectionCollapsible title="꿈꾼 때의 의미" enterDelay={0.18}>
              <SijinChart timing={result.oriental_timing} timeBandId={timeBandId} />
            </SectionCollapsible>

            <SectionCollapsible title="이렇게 해보세요" enterDelay={0.24}>
              <AdviceCard advice={result.oriental_advice} />
            </SectionCollapsible>

            <SectionCollapsible title="조심할 점" enterDelay={0.30}>
              <CautionBox text={result.oriental_caution} />
            </SectionCollapsible>
          </motion.div>
        ) : (
          <motion.div
            key="western"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-3"
          >
            <SectionCollapsible title="이 꿈의 정체" defaultOpen enterDelay={0}>
              <ClinicalDiagnosisCard diag={result.western_diagnosis} />
            </SectionCollapsible>

            <SectionCollapsible title="마음 깊은 곳의 신호" enterDelay={0.06}>
              <LatentDiptychCard latent={result.western_latent} />
            </SectionCollapsible>

            <SectionCollapsible title="꿈 속 등장인물의 의미" enterDelay={0.12}>
              <ArchetypeCardGrid items={result.western_archetypes} />
            </SectionCollapsible>

            <SectionCollapsible title="지금 삶과의 거울" enterDelay={0.18}>
              <MirrorBlock text={result.western_mirror} />
            </SectionCollapsible>

            <SectionCollapsible title="스스로 해볼 수 있는 작업" enterDelay={0.24}>
              <SelfWorkCard text={result.western_self_work} />
            </SectionCollapsible>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TabButton({
  active, onClick, label, sub,
}: {
  active: boolean; onClick: () => void; label: string; sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '12px 10px',
        borderRadius: 10,
        border: 'none',
        background: active
          ? 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(232,164,144,0.18))'
          : 'transparent',
        color: active ? '#FCE8B2' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        textAlign: 'center',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{
        fontSize: 15, fontWeight: 800,
        marginBottom: 2, letterSpacing: '-0.01em',
        fontFamily: 'var(--font-title)',
      }}>{label}</div>
      <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 500 }}>{sub}</div>
    </button>
  );
}
