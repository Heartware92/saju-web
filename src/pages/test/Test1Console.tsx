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

  const num = (v: string) => parseInt(v, 10) || 0;

  const generate = async (key: string) => {
    if (loading) return;
    setLoading(key);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { alert('로그인이 필요해요. /login 에서 로그인 후 다시 시도하세요.'); return; }

      // ★ 실제 만세력과 동일한 시간 보정(-30분) 후 계산 — 안 하면 시주가 어긋나
      //   오행·용신이 전부 틀어진다(예: 13:24가 미시로 잡혀 목이 생김). SajuResultPage 와 동일.
      let fy = birth.y, fm = birth.m, fd = birth.d, fh = 12, fmin = 0;
      if (!birth.unknown) {
        const dt = new Date(birth.y, birth.m - 1, birth.d, birth.h, birth.min);
        const shifted = new Date(dt.getTime() - 30 * 60 * 1000);
        fy = shifted.getFullYear();
        fm = shifted.getMonth() + 1;
        fd = shifted.getDate();
        fh = shifted.getHours();
        fmin = shifted.getMinutes();
      }
      const saju: SajuResult = calculateSaju(
        fy, fm, fd, fh, fmin,
        birth.gender as 'male' | 'female', birth.unknown,
      );

      const res = await fetch('/api/test/jungtongsaju/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ sajuResult: saju, section: key }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) { alert(json.error ?? '생성 실패'); return; }
      setResults(prev => ({ ...prev, [key]: json.text }));
    } catch (e) {
      alert(e instanceof Error ? e.message : '생성 오류');
    } finally {
      setLoading(null);
    }
  };

  const inputCls = 'w-16 px-2 py-1.5 rounded-md bg-black/30 border border-white/15 text-text-primary text-sm text-center';

  return (
    <div className="min-h-screen px-4 pt-5 pb-16 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-text-primary mb-1">정통사주 프롬프트 테스트 콘솔</h1>
      <p className="text-[13px] text-text-secondary mb-4">
        섹션별로 따로 생성합니다 (크레딧·저장 없음). 프롬프트 수정 → 배포 → 해당 섹션 버튼으로 확인.
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
      <p className="text-[12px] text-text-tertiary mb-5">양력 기준. 입력 바꾸면 다음 생성부터 반영돼요.</p>

      {/* 섹션 목록 */}
      <div className="space-y-2">
        {JUNGTONGSAJU_SECTION_KEYS.map((key) => (
          <div key={key} className="rounded-xl bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[15px] font-semibold text-text-primary">{key === 'advice' ? '개운법' : JUNGTONGSAJU_SECTION_LABELS[key]}</span>
              <button
                type="button"
                onClick={() => generate(key)}
                disabled={loading !== null}
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
