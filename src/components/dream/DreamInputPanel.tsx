'use client';

/**
 * 꿈 해몽 입력 패널 — 두 모드 지원
 *  A. 선명 모드(vivid): 자유 서술 textarea 하나
 *  B. 흐릿 모드(foggy): 칩 그룹(등장물 · 행동 · 감정) + 추가 메모 — "기억나는 조각"만 골라도 해몽 가능
 *
 * 상위(MoreFortunePage)에는 최종적으로 "프롬프트에 넣을 dreamText"를 onChange로 전달한다.
 *  - 선명 모드: 사용자가 직접 쓴 문장 그대로
 *  - 흐릿 모드: composeDreamTextFromStructured()로 자연어 라벨로 직렬화한 문장
 */

import { useEffect, useMemo, useState } from 'react';
import {
  DREAM_CHIP_GROUPS,
  composeDreamTextFromStructured,
  type StructuredDreamInput,
  type ChipGroup,
} from '../../constants/dreamSymbols';

export type DreamMode = 'vivid' | 'foggy';

interface Props {
  onTextChange: (dreamText: string) => void;
  onValidChange: (isValid: boolean) => void;
}

const VIVID_MIN = 10;
const VIVID_MAX = 800;
const NOTE_MAX = 300;

export function DreamInputPanel({ onTextChange, onValidChange }: Props) {
  const [mode, setMode] = useState<DreamMode>('vivid');

  // ── Mode A ────────────────────────────────────────
  const [vividText, setVividText] = useState('');

  // ── Mode B ────────────────────────────────────────
  const [selections, setSelections] = useState<StructuredDreamInput['selections']>({});
  const [note, setNote] = useState('');
  const [timeOfNight, setTimeOfNight] = useState<StructuredDreamInput['timeOfNight']>('모름');
  const [isRepeating, setIsRepeating] = useState(false);
  const [customByGroup, setCustomByGroup] = useState<Record<ChipGroup['id'], string>>({
    people: '', animal: '', nature: '', object: '', place: '', action: '', emotion: '',
  });

  const totalSelectedCount = useMemo(
    () => Object.values(selections).reduce((n, arr) => n + (arr?.length ?? 0), 0),
    [selections],
  );

  // 흐릿 모드의 합성 텍스트 — selections + 직접입력을 합쳐 구조화
  const foggyComposedText = useMemo(() => {
    const merged: StructuredDreamInput['selections'] = {};
    for (const g of DREAM_CHIP_GROUPS) {
      const base = selections[g.id] ?? [];
      const custom = customByGroup[g.id].trim();
      const items = custom ? [...base, custom] : base;
      if (items.length > 0) merged[g.id] = items;
    }
    return composeDreamTextFromStructured({
      selections: merged,
      note,
      timeOfNight,
      isRepeating,
    });
  }, [selections, customByGroup, note, timeOfNight, isRepeating]);

  // ── 상위 동기화 ────────────────────────────────────
  useEffect(() => {
    if (mode === 'vivid') {
      const v = vividText.trim();
      onTextChange(v);
      onValidChange(v.length >= VIVID_MIN && v.length <= VIVID_MAX);
    } else {
      const t = foggyComposedText.trim();
      onTextChange(t);
      const enough = totalSelectedCount >= 1 || note.trim().length >= 5 ||
                     Object.values(customByGroup).some(s => s.trim().length > 0);
      onValidChange(enough);
    }
  }, [mode, vividText, foggyComposedText, totalSelectedCount, note, customByGroup, onTextChange, onValidChange]);

  const toggleChip = (groupId: ChipGroup['id'], item: string) => {
    setSelections(prev => {
      const cur = prev[groupId] ?? [];
      const next = cur.includes(item) ? cur.filter(x => x !== item) : [...cur, item];
      return { ...prev, [groupId]: next };
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── 모드 선택 ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <ModeButton
          active={mode === 'vivid'}
          onClick={() => setMode('vivid')}
          title="꿈이 선명해요"
          sub="또렷이 기억나요"
        />
        <ModeButton
          active={mode === 'foggy'}
          onClick={() => setMode('foggy')}
          title="꿈이 흐릿해요"
          sub="조각만 기억나요"
        />
      </div>

      {/* ── Mode A: vivid ──────────────────────────── */}
      {mode === 'vivid' && (
        <div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.7 }}>
            간밤에 꾼 꿈을 떠오르는 대로 자유롭게 적어주세요. 등장한 사람·동물·장소·행동·느낀 감정을 구체적으로 쓸수록 해석이 정확해져요.
          </p>
          <textarea
            value={vividText}
            onChange={(e) => setVividText(e.target.value.slice(0, VIVID_MAX))}
            placeholder={'예) 큰 구렁이가 몸을 감는데 무섭지 않고 따뜻했어요. 그 뒤 맑은 물에서 헤엄치고 있었고, 돌아가신 할머니가 웃으며 떡을 건네주셨어요.'}
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
              {vividText.trim().length < VIVID_MIN
                ? `최소 ${VIVID_MIN}자 이상 적어주세요`
                : '분석 가능'}
            </span>
            <span>{vividText.length} / {VIVID_MAX}</span>
          </div>
        </div>
      )}

      {/* ── Mode B: foggy (guided) ─────────────────── */}
      {mode === 'foggy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 2 }}>
            기억나는 조각만 골라주세요. 여러 개 선택할 수 있고, 해당되는 게 없으면 각 항목 아래 직접 입력칸에 적어도 됩니다. 한두 개만 골라도 해몽할 수 있어요.
          </p>

          {DREAM_CHIP_GROUPS.map((g) => (
            <ChipGroupSection
              key={g.id}
              group={g}
              selected={selections[g.id] ?? []}
              customValue={customByGroup[g.id]}
              onToggle={(item) => toggleChip(g.id, item)}
              onCustomChange={(v) => setCustomByGroup(prev => ({ ...prev, [g.id]: v.slice(0, 40) }))}
            />
          ))}

          {/* 꾼 시간대 */}
          <div>
            <h3 style={labelStyle}>꿈 꾼 시간대</h3>
            <p style={subLabelStyle}>예지몽 판별에 쓰여요 (새벽 3~7시가 전통적으로 예지력 높음)</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['새벽','한밤','아침','모름'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTimeOfNight(t)}
                  style={chipStyle(timeOfNight === t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 반복 여부 */}
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

          {/* 자유 메모 */}
          <div>
            <h3 style={labelStyle}>추가로 기억나는 내용 (선택)</h3>
            <p style={subLabelStyle}>남은 조각이 있으면 자유롭게 적어주세요.</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
              placeholder="예) 꿈이 끝날 때쯤 누가 이름을 불렀어요."
              rows={3}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                color: 'var(--text-primary)',
                fontSize: 15,
                lineHeight: 1.7,
                resize: 'vertical',
                minHeight: 80,
                fontFamily: 'inherit',
              }}
            />
            <div style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6 }}>
              {note.length} / {NOTE_MAX}
            </div>
          </div>

          {/* 요약 미리보기 */}
          {foggyComposedText && (
            <div style={{
              padding: 14, borderRadius: 12,
              background: 'rgba(139,92,246,0.08)',
              border: '1px solid rgba(139,92,246,0.20)',
            }}>
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 8, fontWeight: 600 }}>
                해몽에 전달될 내용
              </div>
              <pre style={{
                whiteSpace: 'pre-wrap', margin: 0,
                fontSize: 14, lineHeight: 1.8,
                color: 'var(--text-secondary)',
                fontFamily: 'inherit',
                wordBreak: 'keep-all',
              }}>{foggyComposedText}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 작은 UI 컴포넌트 ─────────────────────────────────
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

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '10px 16px',
    borderRadius: 999,
    border: `1.5px solid ${active ? 'var(--cta-primary)' : 'rgba(255,255,255,0.18)'}`,
    background: active ? 'rgba(139,92,246,0.20)' : 'rgba(255,255,255,0.05)',
    color: active ? '#E9D5FF' : 'var(--text-primary)',
    fontSize: 14,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',     // 칩 내부 줄바꿈 방지 — 흉하게 2줄 되는 것 방지
    lineHeight: 1.3,
  };
}

function ModeButton({ active, onClick, title, sub }: {
  active: boolean; onClick: () => void; title: string; sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '18px 14px',
        borderRadius: 14,
        border: `2px solid ${active ? 'var(--cta-primary)' : 'rgba(255,255,255,0.15)'}`,
        background: active ? 'rgba(139,92,246,0.16)' : 'rgba(255,255,255,0.04)',
        color: active ? '#E9D5FF' : 'var(--text-primary)',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, whiteSpace: 'nowrap' }}>{title}</div>
      <div style={{ fontSize: 13, opacity: 0.85, whiteSpace: 'nowrap' }}>{sub}</div>
    </button>
  );
}

function ChipGroupSection({ group, selected, customValue, onToggle, onCustomChange }: {
  group: ChipGroup;
  selected: string[];
  customValue: string;
  onToggle: (item: string) => void;
  onCustomChange: (v: string) => void;
}) {
  return (
    <div>
      <h3 style={labelStyle}>{group.question}</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {group.items.map(item => (
          <button
            key={item}
            type="button"
            onClick={() => onToggle(item)}
            style={chipStyle(selected.includes(item))}
          >
            {item}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={customValue}
        onChange={(e) => onCustomChange(e.target.value)}
        placeholder={`그 외 ${group.label} 직접 입력 (선택)`}
        style={{
          width: '100%',
          padding: '11px 14px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10,
          color: 'var(--text-primary)',
          fontSize: 14,
        }}
      />
    </div>
  );
}
