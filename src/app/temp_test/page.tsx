'use client';

/**
 * /temp_test — 임시 테스트 페이지 (검증용, 끝나면 제거 권장)
 * 로그인 계정 대표 프로필로 임의 날짜의 실시간 운세를 실제 결과 페이지 UI 그대로 렌더.
 * 날짜를 바꿔가며 일진별 결과 차이를 눈으로 비교.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '../../store/useUserStore';
import { supabase } from '../../services/supabase';
import Layout from '../../components/Layout';
import { TodayResultBlock } from '../../components/share/blocks/TodayResultBlock';

const SLOTS: { v: string; label: string }[] = [
  { v: 'midnight', label: '새벽' }, { v: 'morning', label: '아침' },
  { v: 'afternoon', label: '오후' }, { v: 'evening', label: '저녁' },
];

export default function TempTestPage() {
  const router = useRouter();
  const { user } = useUserStore();
  const userLoading = useUserStore((s) => s.loading);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [timeSlot, setTimeSlot] = useState('afternoon');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [iljin, setIljin] = useState('');

  useEffect(() => {
    if (!userLoading && user === null) router.replace('/login?from=/temp_test');
  }, [user, userLoading, router]);

  const generate = async () => {
    setLoading(true); setError(''); setRecord(null);
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) { router.replace('/login?from=/temp_test'); return; }
      const res = await fetch('/api/temp-test/today', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isoDate: date, timeSlot }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || '생성 실패'); return; }
      setIljin(json.iljin || '');
      setRecord(json.record);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="px-4 pt-4 pb-12">
        <h1 className="text-xl font-bold text-text-primary mb-1">실시간 운세 — 날짜 테스트 (임시)</h1>
        <p className="text-[12.5px] text-text-tertiary mb-4">대표 프로필 기준. 날짜를 바꿔 일진별 결과를 비교하세요. (크레딧 차감 없음)</p>

        <div className="flex flex-wrap items-end gap-3 mb-5 p-4 rounded-2xl bg-[rgba(20,12,38,0.55)] border border-[var(--border-subtle)]">
          <div>
            <label className="block text-[12px] text-text-secondary mb-1">날짜</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[14px] text-text-primary" />
          </div>
          <div>
            <label className="block text-[12px] text-text-secondary mb-1">시간대</label>
            <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.12)] text-[14px] text-text-primary">
              {SLOTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
          </div>
          <button onClick={generate} disabled={loading}
            className="px-5 py-2.5 rounded-xl font-bold text-[14px] text-white disabled:opacity-50"
            style={{ background: 'var(--cta-primary)' }}>
            {loading ? '생성 중… (수십초)' : '생성'}
          </button>
          {iljin && <span className="text-[13px] text-text-tertiary self-center">일진 {iljin}</span>}
        </div>

        {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[13px] text-red-300">{error}</div>}

        {record && <TodayResultBlock record={record as Record<string, unknown> as never} />}
      </div>
    </Layout>
  );
}
