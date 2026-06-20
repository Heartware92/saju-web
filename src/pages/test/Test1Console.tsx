'use client';

/**
 * 정통사주 프롬프트 섹션별 테스트 콘솔 — /test_1
 *
 * 생년월일 입력 → 12개 섹션 목록, 각 옆 "생성" 버튼.
 * 버튼 클릭 시 그 섹션만 /api/test/jungtongsaju/section 으로 호출해 결과 표시.
 * 크레딧·DB 미반영(로그인 가드). 프롬프트 섹션별 0부터 재작성 튜닝 전용.
 */
import { useState } from 'react';
import { calculateSaju, type SajuResult } from '@/utils/sajuCalculator';
import { supabase } from '@/services/supabase';
import { renderEmphasizedBodyTest } from '@/utils/test/renderEmphasizedBodyTest';
import { JUNGTONGSAJU_SECTION_KEYS, JUNGTONGSAJU_SECTION_LABELS } from '@/constants/prompts';

export default function Test1Console() {
  // 기본값 고정: 허진우 1992-09-14 13:24 남 (양력)
  const [birth, setBirth] = useState({ y: 1992, m: 9, d: 14, h: 13, min: 24, gender: 'male', unknown: false });
  const [results, setResults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [allProgress, setAllProgress] = useState<number | null>(null); // 전체 생성 진행(완료 수), null=미실행

  const num = (v: string) => parseInt(v, 10) || 0;
  const busy = loading !== null || allProgress !== null;
  const TOTAL = JUNGTONGSAJU_SECTION_KEYS.length;

  const labelOf = (k: string) =>
    k === 'advice' ? '개운법' : (JUNGTONGSAJU_SECTION_LABELS[k as keyof typeof JUNGTONGSAJU_SECTION_LABELS] ?? k);

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { alert('로그인이 필요해요. /login 에서 로그인 후 다시 시도하세요.'); return null; }
    return token;
  };

  // 만세력과 동일한 -30분 시간 보정 후 사주 계산
  const buildSaju = (): SajuResult => {
    let fy = birth.y, fm = birth.m, fd = birth.d, fh = 12, fmin = 0;
    if (!birth.unknown) {
      const dt = new Date(birth.y, birth.m - 1, birth.d, birth.h, birth.min);
      const s = new Date(dt.getTime() - 30 * 60 * 1000);
      fy = s.getFullYear(); fm = s.getMonth() + 1; fd = s.getDate(); fh = s.getHours(); fmin = s.getMinutes();
    }
    return calculateSaju(fy, fm, fd, fh, fmin, birth.gender as 'male' | 'female', birth.unknown);
  };

  // 한 섹션 생성 — priorArr: 반복 회피용 이미 생성된 섹션들
  const genOne = async (key: string, token: string, saju: SajuResult, priorArr: Array<{ label: string; text: string }>) => {
    const res = await fetch('/api/test/jungtongsaju/section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ sajuResult: saju, section: key, priorSections: priorArr }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error ?? '생성 실패');
    return json.text as string;
  };

  const generate = async (key: string) => {
    if (busy) return;
    setLoading(key);
    try {
      const token = await getToken();
      if (!token) return;
      const priorArr = Object.entries(results)
        .filter(([k, t]) => k !== key && !!t)
        .map(([k, t]) => ({ label: labelOf(k), text: t }));
      const text = await genOne(key, token, buildSaju(), priorArr);
      setResults(prev => ({ ...prev, [key]: text }));
    } catch (e) {
      alert(e instanceof Error ? e.message : '생성 오류');
    } finally {
      setLoading(null);
    }
  };

  // 전체 생성 — 위에서부터 순서대로(앞 섹션을 다음 섹션 반복 회피 컨텍스트로 누적)
  const generateAll = async () => {
    if (busy) return;
    const token = await getToken();
    if (!token) return;
    const saju = buildSaju();
    const acc: Record<string, string> = {};
    setAllProgress(0);
    setResults({}); // 새로 전체 생성 — 기존 결과 초기화
    try {
      for (let i = 0; i < JUNGTONGSAJU_SECTION_KEYS.length; i++) {
        const key = JUNGTONGSAJU_SECTION_KEYS[i];
        setLoading(key);
        const priorArr = Object.entries(acc).map(([k, t]) => ({ label: labelOf(k), text: t }));
        try {
          const text = await genOne(key, token, saju, priorArr);
          acc[key] = text;
          setResults(prev => ({ ...prev, [key]: text }));
        } catch (e) {
          console.error('[generateAll]', key, e);
        }
        setAllProgress(i + 1);
      }
    } finally {
      setLoading(null);
      setAllProgress(null);
    }
  };

  const inputCls = 'w-16 px-2 py-1.5 rounded-md bg-black/30 border border-white/15 text-text-primary text-sm text-center';

  return (
    <div className="min-h-screen px-4 pt-5 pb-16 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-text-primary mb-1">정통사주 프롬프트 테스트 콘솔</h1>
      <p className="text-[13px] text-text-secondary mb-4">
        전체 한 번에, 또는 섹션별로 생성 (크레딧·저장 없음). 프롬프트 수정 → 배포 → 버튼으로 확인.
      </p>

      {/* 생년월일 입력 */}
      <div className="flex flex-wrap items-center gap-2 mb-2 p-3 rounded-xl bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
        <input className={inputCls} value={birth.y} onChange={e => setBirth({ ...birth, y: num(e.target.value) })} /><span className="text-text-secondary text-sm">년</span>
        <input className={inputCls} value={birth.m} onChange={e => setBirth({ ...birth, m: num(e.target.value) })} /><span className="text-text-secondary text-sm">월</span>
        <input className={inputCls} value={birth.d} onChange={e => setBirth({ ...birth, d: num(e.target.value) })} /><span className="text-text-secondary text-sm">일</span>
        <input className={inputCls} value={birth.h} onChange={e => setBirth({ ...birth, h: num(e.target.value) })} /><span className="text-text-secondary text-sm">시</span>
        <input className={inputCls} value={birth.min} onChange={e => setBirth({ ...birth, min: num(e.target.value) })} /><span className="text-text-secondary text-sm">분</span>
        <select
          className="px-2 py-1.5 rounded-md bg-black/30 border border-white/15 text-text-primary text-sm"
          value={birth.gender}
          onChange={e => setBirth({ ...birth, gender: e.target.value })}
        >
          <option value="male">남</option>
          <option value="female">여</option>
        </select>
        <label className="flex items-center gap-1 text-text-secondary text-sm">
          <input type="checkbox" checked={birth.unknown} onChange={e => setBirth({ ...birth, unknown: e.target.checked })} /> 시간모름
        </label>
      </div>
      <p className="text-[12px] text-text-tertiary mb-3">양력 기준. 입력 바꾸면 다음 생성부터 반영돼요.</p>

      {/* 전체 한 번에 생성 — 위에서부터 순서대로(앞 섹션을 다음 섹션 중복회피에 활용) */}
      <button
        type="button"
        onClick={generateAll}
        disabled={busy}
        className="w-full mb-5 px-4 py-3 rounded-xl bg-cta text-white font-bold disabled:opacity-50"
      >
        {allProgress !== null ? `전체 생성 중… (${allProgress}/${TOTAL})` : '전체 한 번에 생성'}
      </button>

      {/* 섹션 목록 */}
      <div className="space-y-2">
        {JUNGTONGSAJU_SECTION_KEYS.map((key) => (
          <div key={key} className="rounded-xl bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[15px] font-semibold text-text-primary">{key === 'advice' ? '개운법' : JUNGTONGSAJU_SECTION_LABELS[key]}</span>
              <button
                type="button"
                onClick={() => generate(key)}
                disabled={busy}
                className="px-3 py-1.5 rounded-md bg-cta text-white text-[13px] font-bold disabled:opacity-50"
              >
                {loading === key ? '생성 중…' : results[key] ? '다시 생성' : '생성'}
              </button>
            </div>
            {results[key] && (
              <div className="px-4 pb-4 pt-1 text-[16px] text-text-secondary leading-[1.85] whitespace-pre-line border-t border-[var(--border-subtle)]">
                {renderEmphasizedBodyTest(results[key])}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
