'use client';

import Link from 'next/link';
import { useState } from 'react';
import { loadPaymentWidget, PaymentWidgetInstance } from '@tosspayments/payment-widget-sdk';
import { CREDIT_PACKS, type CreditPack } from '@/types/credits';

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY!;

interface Props {
  userEmail: string;
  userName: string;
  initialBalance: number;
}

function generateOrderId() {
  return `credits-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clearWidgetContainer(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

export default function CreditsClient({ userEmail, userName, initialBalance }: Props) {
  const [selected, setSelected] = useState<CreditPack | null>(null);
  const [widget, setWidget] = useState<PaymentWidgetInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  const handleSelect = async (pack: CreditPack) => {
    setSelected(pack);
    setError(null);

    try {
      const w = await loadPaymentWidget(CLIENT_KEY, userEmail || 'anon');
      // 기존 위젯 DOM 정리 후 새로 렌더 (innerHTML 사용 안 함 — XSS 방지)
      clearWidgetContainer('credits-payment-widget');
      clearWidgetContainer('credits-agreement-widget');

      await w.renderPaymentMethods(
        '#credits-payment-widget',
        { value: pack.amount },
        { variantKey: 'DEFAULT' },
      );
      await w.renderAgreement('#credits-agreement-widget', { variantKey: 'AGREEMENT' });
      setWidget(w);
    } catch (e) {
      console.error(e);
      setError('결제 위젯 로드 실패. 새로고침 해주세요.');
    }
  };

  const handlePay = async () => {
    if (!widget || !selected) return;
    setIsPaying(true);
    setError(null);
    try {
      await widget.requestPayment({
        orderId: generateOrderId(),
        orderName: `스튜디오 크레딧 ${selected.credits}개`,
        successUrl: `${window.location.origin}/credits/success?credits=${selected.credits}`,
        failUrl: `${window.location.origin}/credits/fail`,
        customerEmail: userEmail,
        customerName: userName,
      });
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code !== 'USER_CANCEL') {
        setError('결제 중 오류가 발생했어요');
      }
      setIsPaying(false);
    }
  };

  return (
    <main className="mx-auto max-w-[720px] px-5 py-10">
      <Link href="/studio" className="mb-6 inline-block text-xs text-white/50 hover:text-white/80">
        ← 스튜디오 홈
      </Link>

      <header className="mb-8">
        <h1 className="text-[24px] font-extrabold text-white">크레딧 충전</h1>
        <p className="mt-1 text-sm text-white/60">
          현재 잔액{' '}
          <span className="font-semibold text-white">{initialBalance}크레딧</span>
          {' '}· 커버 1편 = 5크레딧
        </p>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        {CREDIT_PACKS.map((pack) => (
          <button
            key={pack.amount}
            type="button"
            onClick={() => handleSelect(pack)}
            className={`rounded-xl border p-5 text-left transition-colors ${
              selected?.amount === pack.amount
                ? 'border-emerald-400 bg-emerald-500/10'
                : 'border-white/10 bg-white/[0.03] hover:border-white/20'
            }`}
          >
            {pack.badge && (
              <div className="mb-2 inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                {pack.badge}
              </div>
            )}
            <div className="text-2xl font-extrabold text-white">
              {pack.credits}
              <span className="ml-1 text-sm font-medium text-white/50">크레딧</span>
            </div>
            <div className="mt-1 text-sm text-white/80">
              {pack.amount.toLocaleString('ko-KR')}원
            </div>
            <div className="mt-2 text-xs text-white/40">{pack.desc}</div>
          </button>
        ))}
      </section>

      {selected && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div id="credits-payment-widget" />
          <div id="credits-agreement-widget" className="mt-4" />
          {error && (
            <div className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
          <button
            type="button"
            disabled={isPaying}
            onClick={handlePay}
            className="mt-5 w-full rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPaying ? '결제 진행 중...' : `${selected.amount.toLocaleString('ko-KR')}원 결제`}
          </button>
        </section>
      )}

      <p className="mt-6 text-xs text-white/40">
        결제 후 크레딧은 즉시 지급되며, 잔여분은 탈퇴 전까지 만료되지 않아요.
      </p>
    </main>
  );
}
