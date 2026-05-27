'use client';

/**
 * 꿈 해몽 입력 패널 — 단순화 V2 (2026-05-27)
 *
 * V1(흐릿/선명 모드) 폐기. 단일 textarea + 꿈꾼 시각 선택 + 반복 여부.
 * placeholder 안에 두 종류 입력 예시(긴 서술 + 단어 나열)를 노출해
 * 사용자가 모드 분기 없이 자유롭게 작성하도록 한다.
 */

import { useEffect, useState } from 'react';
import { TIME_BANDS, type TimeBand } from '../../constants/dreamSymbols';

interface Props {
  onTextChange: (dreamText: string) => void;
  onValidChange: (isValid: boolean) => void;
  onTimeBandChange?: (timeBandId: string) => void;
  onRepeatingChange?: (isRepeating: boolean) => void;
}

const DREAM_MIN = 5;
const DREAM_MAX = 800;

export function DreamInputPanel({
  onTextChange,
  onValidChange,
  onTimeBandChange,
  onRepeatingChange,
}: Props) {
  const [dreamText, setDreamText] = useState('');
  const [timeBandId, setTimeBandId] = useState<TimeBand['id']>('unknown');
  const [isRepeating, setIsRepeating] = useState(false);

  useEffect(() => {
    const t = dreamText.trim();
    onTextChange(t);
    onValidChange(t.length >= DREAM_MIN && t.length <= DREAM_MAX);
  }, [dreamText, onTextChange, onValidChange]);

  useEffect(() => { onTimeBandChange?.(timeBandId); }, [timeBandId, onTimeBandChange]);
  useEffect(() => { onRepeatingChange?.(isRepeating); }, [isRepeating, onRepeatingChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── 꿈 내용 입력 ───────────────────────────────── */}
      <div>
        <h3 style={labelStyle}>꿈 내용</h3>
        <p style={subLabelStyle}>
          또렷이 기억나면 장면 그대로, 흐릿하면 떠오르는 단어 몇 개만 적어도 풀어드려요.
        </p>
        <textarea
          value={dreamText}
          onChange={(e) => setDreamText(e.target.value.slice(0, DREAM_MAX))}
          placeholder={
            '예 1) 큰 구렁이가 몸을 감았는데 무섭지 않고 따뜻했어요. ' +
            '그 뒤 맑은 물에서 헤엄쳤고, 돌아가신 할머니가 웃으며 떡을 건네주셨어요.\n\n' +
            '예 2) 뱀, 물, 따뜻함, 할머니, 떡'
          }
          rows={9}
          style={{
            width: '100%',
            padding: '14px 16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            color: 'var(--text-primary)',
            fontSize: 16,
            lineHeight: 1.75,
            resize: 'vertical',
            minHeight: 180,
            fontFamily: 'inherit',
          }}
        />
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 8, fontSize: 13, color: 'var(--text-tertiary)',
        }}>
          <span>
            {dreamText.trim().length < DREAM_MIN
              ? `최소 ${DREAM_MIN}자 이상 적어주세요`
              : '풀이 가능'}
          </span>
          <span>{dreamText.length} / {DREAM_MAX}</span>
        </div>
      </div>

      {/* ── 꿈꾼 시각 (선택) ──────────────────────────── */}
      <div>
        <h3 style={labelStyle}>꿈꾼 시각 (선택)</h3>
        <p style={subLabelStyle}>
          새벽 꿈일수록 동양 전통에서 영험도가 높다고 봅니다. 시간을 알려주시면 시진(時辰) 보정까지 결합해 풀이합니다.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {TIME_BANDS.map(b => (
            <button
              key={b.id}
              type="button"
              onClick={() => setTimeBandId(b.id)}
              style={timeChipStyle(timeBandId === b.id)}
            >
              <span style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{b.label}</span>
              <span style={{ fontSize: 11, opacity: 0.75 }}>{b.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 반복 여부 ─────────────────────────────────── */}
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 15, color: 'var(--text-primary)',
        cursor: 'pointer', padding: '4px 0',
      }}>
        <input
          type="checkbox"
          checked={isRepeating}
          onChange={(e) => setIsRepeating(e.target.checked)}
          style={{ width: 18, height: 18, flexShrink: 0 }}
        />
        <span>반복해서 꾸는 꿈이에요</span>
      </label>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 16, fontWeight: 700, color: 'var(--text-primary)',
  margin: '0 0 6px 0',
  lineHeight: 1.5,
  wordBreak: 'keep-all',
};

const subLabelStyle: React.CSSProperties = {
  fontSize: 13, color: 'var(--text-tertiary)',
  margin: '0 0 10px 0',
  lineHeight: 1.6,
};

function timeChipStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '10px 12px',
    borderRadius: 12,
    border: `1.5px solid ${active ? 'var(--cta-primary)' : 'rgba(255,255,255,0.15)'}`,
    background: active ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
    color: active ? '#E9D5FF' : 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'left',
    lineHeight: 1.3,
  };
}
