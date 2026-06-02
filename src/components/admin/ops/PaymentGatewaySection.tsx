/**
 * 결제 게이트웨이 스위처 — 토스페이먼츠 ↔ KG이니시스 즉시 전환
 * 환경변수 변경/재배포 없이 DB row 한 줄 업데이트로 모든 신규 결제가 새 채널로 흘러감.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';

type Channel = 'tosspayments' | 'inicis';

interface Config {
  activeChannel: Channel;
  tossChannelKey: string;
  inicisChannelKey: string;
  tossEnabled: boolean;
  inicisEnabled: boolean;
  note: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

const CHANNEL_LABEL: Record<Channel, string> = {
  tosspayments: '토스페이먼츠',
  inicis: 'KG이니시스',
};

const mask = (k: string) => k ? `${k.slice(0, 10)}…(총 ${k.length}자)` : '(미설정)';
const fmtDate = (s: string | null) => s
  ? new Date(s).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '-';

export function PaymentGatewaySection({ token }: { token: string | null }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [envChannelKey, setEnvChannelKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // 키 편집 상태
  const [editingKeys, setEditingKeys] = useState(false);
  const [tossKey, setTossKey] = useState('');
  const [inicisKey, setInicisKey] = useState('');
  const [noteInput, setNoteInput] = useState('');

  // 전환 확인 모달
  const [pendingSwitch, setPendingSwitch] = useState<Channel | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/payment-gateway', { headers: { 'x-admin-key': token } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '실패');
      setEnvChannelKey(json.fallback?.envChannelKey ?? '');
      if (json.config) {
        setConfig(json.config);
        setTossKey(json.config.tossChannelKey);
        setInicisKey(json.config.inicisChannelKey);
        setNoteInput(json.config.note ?? '');
      } else {
        setConfig(null);
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const submit = async (body: Record<string, unknown>, successText: string) => {
    if (!token) return;
    setLoading(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/payment-gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': token },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '실패');
      setConfig(json.config);
      setTossKey(json.config.tossChannelKey);
      setInicisKey(json.config.inicisChannelKey);
      setNoteInput(json.config.note ?? '');
      setMsg({ type: 'ok', text: successText });
      setEditingKeys(false);
      setPendingSwitch(null);
    } catch (e: any) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  const confirmSwitch = () => {
    if (!pendingSwitch) return;
    submit({ activeChannel: pendingSwitch }, `${CHANNEL_LABEL[pendingSwitch]} 로 전환되었습니다`);
  };

  const toggleEnabled = (channel: Channel, enabled: boolean) => {
    submit(
      channel === 'tosspayments' ? { tossEnabled: enabled } : { inicisEnabled: enabled },
      `${CHANNEL_LABEL[channel]} ${enabled ? '활성화' : '비활성화'}`,
    );
  };

  const saveKeys = () => {
    submit(
      { tossChannelKey: tossKey, inicisChannelKey: inicisKey, note: noteInput },
      '채널 키 저장됨',
    );
  };

  const active = config?.activeChannel ?? 'tosspayments';

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[14px] font-semibold text-text-primary">결제 게이트웨이</h3>
        {config && (
          <p className="text-[11px] text-text-tertiary">
            최종 수정 {fmtDate(config.updatedAt)} · {config.updatedBy ?? '-'}
          </p>
        )}
      </div>

      {!config && !loading && (
        <div className="px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[13px] text-amber-300">
          DB 설정 row 가 없습니다. 마이그레이션 042 가 미적용되었거나 초기화 필요.
          현재 환경변수 fallback: <span className="font-mono">{envChannelKey ? mask(envChannelKey) : '(미설정)'}</span>
        </div>
      )}

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-[13px] text-red-300">
          {error}
        </div>
      )}
      {msg && (
        <div className={`px-3 py-2 rounded-lg text-[13px] border ${
          msg.type === 'ok' ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>{msg.text}</div>
      )}

      {config && (
        <>
          {/* 활성 채널 표시 + 전환 버튼 */}
          <div className="grid grid-cols-2 gap-3">
            {(['tosspayments', 'inicis'] as const).map(ch => {
              const isActive = active === ch;
              const enabled = ch === 'tosspayments' ? config.tossEnabled : config.inicisEnabled;
              const key = ch === 'tosspayments' ? config.tossChannelKey : config.inicisChannelKey;
              return (
                <div
                  key={ch}
                  className={`rounded-xl border p-4 ${isActive ? 'border-cta bg-cta/10' : 'border-white/15 bg-white/5'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[14px] font-semibold text-text-primary">{CHANNEL_LABEL[ch]}</span>
                    {isActive && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-cta text-white font-medium">활성</span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-tertiary font-mono mb-3">
                    {key ? mask(key) : '(키 미설정)'}
                  </p>
                  <div className="flex gap-2">
                    {!isActive && (
                      <button
                        onClick={() => setPendingSwitch(ch)}
                        disabled={loading || !enabled || !key}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-cta text-white text-[12px] font-medium disabled:opacity-40"
                      >
                        이 채널로 전환
                      </button>
                    )}
                    <button
                      onClick={() => toggleEnabled(ch, !enabled)}
                      disabled={loading || isActive}
                      title={isActive ? '활성 채널은 비활성화할 수 없습니다 (먼저 다른 채널로 전환)' : ''}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-medium border disabled:opacity-40 ${
                        enabled
                          ? 'border-green-500/30 text-green-300'
                          : 'border-gray-500/30 text-gray-400'
                      }`}
                    >
                      {enabled ? '활성화됨' : '비활성'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 채널 키 편집 */}
          <div className="rounded-xl border border-white/10 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-medium text-text-secondary">채널 키 관리</p>
              {!editingKeys ? (
                <button
                  onClick={() => setEditingKeys(true)}
                  className="text-[12px] text-cta hover:underline"
                >
                  편집
                </button>
              ) : (
                <button
                  onClick={() => { setEditingKeys(false); setTossKey(config.tossChannelKey); setInicisKey(config.inicisChannelKey); setNoteInput(config.note ?? ''); }}
                  className="text-[12px] text-text-tertiary hover:text-text-secondary"
                >
                  취소
                </button>
              )}
            </div>

            {editingKeys ? (
              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] text-text-tertiary mb-1">토스페이먼츠 채널 키</label>
                  <input
                    type="text"
                    value={tossKey}
                    onChange={e => setTossKey(e.target.value)}
                    placeholder="channel-key-..."
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[12px] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-text-tertiary mb-1">KG이니시스 채널 키</label>
                  <input
                    type="text"
                    value={inicisKey}
                    onChange={e => setInicisKey(e.target.value)}
                    placeholder="channel-key-..."
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[12px] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-text-tertiary mb-1">메모 (선택)</label>
                  <input
                    type="text"
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    placeholder="전환 사유, 인시던트 번호 등"
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-[12px]"
                  />
                </div>
                <button
                  onClick={saveKeys}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-cta text-white text-[13px] font-medium disabled:opacity-40"
                >
                  저장
                </button>
              </div>
            ) : (
              <div className="text-[12px] text-text-tertiary space-y-1">
                {config.note && <p>메모: {config.note}</p>}
                <p>환경변수 fallback: <span className="font-mono">{envChannelKey ? mask(envChannelKey) : '(없음)'}</span></p>
              </div>
            )}
          </div>
        </>
      )}

      {/* 전환 확인 모달 */}
      {pendingSwitch && config && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPendingSwitch(null)}>
          <div className="bg-[#0a0614] border border-white/15 rounded-2xl max-w-[420px] w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-white/10">
              <h3 className="text-[15px] font-semibold text-text-primary">결제 게이트웨이 전환</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-[13px] text-text-secondary">
                <span className="text-text-primary font-medium">{CHANNEL_LABEL[config.activeChannel]}</span>
                {' → '}
                <span className="text-cta font-medium">{CHANNEL_LABEL[pendingSwitch]}</span>
              </p>
              <p className="text-[12px] text-text-tertiary">
                전환 즉시 모든 신규 결제가 새 채널로 흐릅니다 (진행 중 결제는 영향 없음).
                30초 캐시로 인해 클라이언트 반영까지 최대 30초 지연될 수 있습니다.
              </p>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setPendingSwitch(null)} className="px-4 py-2 rounded-lg border border-white/15 text-[13px] text-text-secondary">
                  취소
                </button>
                <button onClick={confirmSwitch} disabled={loading} className="px-4 py-2 rounded-lg bg-cta text-white text-[13px] font-medium disabled:opacity-40">
                  전환 진행
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
