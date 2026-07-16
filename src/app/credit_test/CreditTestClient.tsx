'use client';

/**
 * 내부 결제 테스트 화면 — PortOne 채널키를 직접 입력해 특정 PG로 실제 결제를 테스트한다.
 * 라이브 결제 설정(payment_gateway_config / active_channel)을 건드리지 않는다.
 * 새 PG 연동 검증용. 검증 끝나면 어드민 결제 게이트웨이에 정식 추가한다.
 */
import { useEffect, useState } from 'react';
import { CREDIT_PACKAGES, type CreditPackage } from '@/constants/pricing';
import { processPayment } from '@/services/payment';

const PAY_METHODS = ['CARD', 'EASY_PAY', 'VIRTUAL_ACCOUNT', 'TRANSFER', 'MOBILE'] as const;

// EASY_PAY 일 때 어느 간편결제사인지 — KPN 등은 provider 지정이 필수
const EASY_PAY_PROVIDERS: { label: string; value: string }[] = [
  { label: '카카오페이', value: 'EASY_PAY_PROVIDER_KAKAOPAY' },
  { label: '네이버페이', value: 'EASY_PAY_PROVIDER_NAVERPAY' },
  { label: '토스페이', value: 'EASY_PAY_PROVIDER_TOSSPAY' },
  { label: '페이코', value: 'EASY_PAY_PROVIDER_PAYCO' },
  { label: '삼성페이', value: 'EASY_PAY_PROVIDER_SAMSUNGPAY' },
];

// 채널키 프리셋 — 클릭으로 채움. PortOne channelKey는 클라이언트에 노출되는 공개값.
// payMethod/easyPayProvider 가 있으면 클릭 시 결제수단까지 자동 세팅(원클릭 테스트).
const CHANNEL_PRESETS: { label: string; key: string; payMethod?: string; easyPayProvider?: string }[] = [
  { label: 'KPN (포트원)', key: 'channel-key-8d7ca754-c4de-4a24-bb5c-ac6d27b24659' },
  {
    label: '카카오페이',
    key: 'channel-key-b249efa8-2c72-4b85-b32c-76ea193e5431',
    payMethod: 'EASY_PAY',
    easyPayProvider: 'EASY_PAY_PROVIDER_KAKAOPAY',
  },
];

export default function CreditTestClient() {
  const [channelKey, setChannelKey] = useState('');
  const [payMethod, setPayMethod] = useState<string>('CARD');
  const [easyPayProvider, setEasyPayProvider] = useState<string>('EASY_PAY_PROVIDER_KAKAOPAY');
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('credit_test:channelKey');
      if (saved) setChannelKey(saved);
    } catch { /* ignore */ }
  }, []);

  const buy = async (pkg: CreditPackage) => {
    if (!channelKey.trim()) {
      setResult({ ok: false, msg: '먼저 PortOne 채널키를 입력하세요.' });
      return;
    }
    try { localStorage.setItem('credit_test:channelKey', channelKey.trim()); } catch { /* ignore */ }
    setBusy(pkg.id);
    setResult(null);
    try {
      const r = await processPayment(
        { packageId: pkg.id, amount: pkg.price, creditAmount: pkg.moonCredit },
        { channelKeyOverride: channelKey.trim(), payMethod, easyPayProvider: payMethod === 'EASY_PAY' ? easyPayProvider : undefined },
      );
      setResult({ ok: !!r.success, msg: r.message || (r.success ? '결제 성공' : r.error || '실패') });
    } catch (e: unknown) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : '오류' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-[560px] mx-auto px-4 py-6 text-text-primary">
      <h1 className="text-[20px] font-bold mb-1">결제 테스트 (내부 전용)</h1>
      <p className="text-[13px] text-text-tertiary mb-4">
        PortOne 채널키를 입력하면 그 PG로 실제 결제가 진행됩니다. 라이브 결제 설정과 무관합니다.
      </p>

      <div className="mb-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[13px] text-amber-300">
        실제 결제/주문이 생성됩니다. <b>PortOne 테스트 모드 채널</b>로 테스트하거나, 라이브 채널이면 소액으로 진행 후 환불하세요.
        이 계정은 어드민에서 <b>분석 제외</b>로 두는 걸 권장합니다.
      </div>

      <label className="block text-[13px] text-text-secondary mb-1">PortOne 채널키 (channelKey)</label>
      <input
        type="text"
        value={channelKey}
        onChange={(e) => setChannelKey(e.target.value)}
        placeholder="channel-key-xxxxxxxx..."
        className="w-full h-11 rounded-lg bg-white/5 border border-white/15 px-3 text-sm outline-none focus:border-cta/50 mb-2 font-mono"
      />
      <div className="flex flex-wrap gap-1.5 mb-3">
        {CHANNEL_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setChannelKey(p.key);
              if (p.payMethod) setPayMethod(p.payMethod);
              if (p.easyPayProvider) setEasyPayProvider(p.easyPayProvider);
            }}
            className="px-2.5 py-1 rounded-lg text-[12px] bg-white/5 border border-white/15 text-text-secondary hover:border-cta/40 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      <label className="block text-[13px] text-text-secondary mb-1">결제수단 (payMethod)</label>
      <select
        value={payMethod}
        onChange={(e) => setPayMethod(e.target.value)}
        className="w-full h-11 rounded-lg bg-white/5 border border-white/15 px-3 text-sm outline-none focus:border-cta/50 mb-5"
      >
        {PAY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>

      {payMethod === 'EASY_PAY' && (
        <>
          <label className="block text-[13px] text-text-secondary mb-1">간편결제사 (easyPayProvider)</label>
          <select
            value={easyPayProvider}
            onChange={(e) => setEasyPayProvider(e.target.value)}
            className="w-full h-11 rounded-lg bg-white/5 border border-white/15 px-3 text-sm outline-none focus:border-cta/50 mb-5"
          >
            {EASY_PAY_PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </>
      )}

      {result && (
        <div className={`mb-4 px-4 py-3 rounded-xl border text-[14px] ${result.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
          {result.ok ? '성공: ' : '실패: '}{result.msg}
        </div>
      )}

      <div className="space-y-2">
        {CREDIT_PACKAGES.map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => buy(pkg)}
            disabled={busy !== null}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-cta/40 transition-colors disabled:opacity-40 text-left"
          >
            <span className="text-[14px] font-medium">{pkg.name} <span className="text-text-tertiary">· 달 {pkg.moonCredit}</span></span>
            <span className="text-[14px] font-bold tabular-nums">
              {busy === pkg.id ? '결제창…' : `${pkg.price.toLocaleString('ko-KR')}원`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
