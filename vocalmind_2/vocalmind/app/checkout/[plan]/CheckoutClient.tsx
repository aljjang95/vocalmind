'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { loadPaymentWidget, PaymentWidgetInstance } from '@tosspayments/payment-widget-sdk';
import { Button } from '@/components/ui/button';

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY!;

const PLAN_INFO: Record<string, { name: string; amount: number; desc: string }> = {
  hobby: { name: '취미반', amount: 100000, desc: '자유 곡 실시간 평가 + AI 피드백' },
  pro: { name: '발성전문반', amount: 150000, desc: '28단계 HLB 체계적 커리큘럼' },
  feedback: { name: '유료 피드백', amount: 50000, desc: '선생님 직접 듣고 진단 (1회)' },
};

function nanoid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function generateOrderId(plan: string) {
  return `vocal-${plan}-${Date.now()}-${nanoid().slice(0, 6)}`;
}

interface Props {
  plan: string;
  userEmail: string;
  userName: string;
}

export default function CheckoutClient({ plan, userEmail, userName }: Props) {
  const widgetRef = useRef<PaymentWidgetInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const orderIdRef = useRef(generateOrderId(plan));

  const info = PLAN_INFO[plan];

  useEffect(() => {
    if (!info) return;

    const init = async () => {
      try {
        const customerKey = userEmail;
        const widget = await loadPaymentWidget(CLIENT_KEY, customerKey);
        await widget.renderPaymentMethods('#payment-widget', { value: info.amount }, { variantKey: 'DEFAULT' });
        await widget.renderAgreement('#agreement-widget', { variantKey: 'AGREEMENT' });
        widgetRef.current = widget;
      } catch (e) {
        console.error(e);
        setError('결제 위젯 로드 실패. 새로고침 해주세요.');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [info, userEmail]);

  const handlePay = async () => {
    if (!widgetRef.current || !info) return;
    setPaying(true);
    setError('');
    try {
      await widgetRef.current.requestPayment({
        orderId: orderIdRef.current,
        orderName: `HLB 보컬스튜디오 ${info.name}`,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: userEmail,
        customerName: userName,
      });
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code !== 'USER_CANCEL') {
        setError('결제 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
      setPaying(false);
    }
  };

  if (!info) {
    return <div className="text-red-500 text-center p-8">잘못된 요금제입니다.</div>;
  }

  return (
    <div className="max-w-[520px] mx-auto px-4 pt-8 pb-16">
      <div className="mb-6">
        <Link href="/pricing" className="text-[13px] text-[var(--text-muted)] no-underline">
          &larr; 요금제로 돌아가기
        </Link>
      </div>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{info.name} 결제</h1>
        <p className="text-[var(--text-secondary)] text-[0.9rem] mb-4">{info.desc}</p>
        <div className="text-[2rem] font-extrabold text-[var(--accent)]">
          &#8361;{info.amount.toLocaleString()}
          {plan !== 'feedback' && <span className="text-base font-normal text-[var(--text-secondary)]"> / 월</span>}
        </div>
      </div>

      {loading && <div className="h-[300px] bg-[var(--bg-surface)] rounded-xl mb-4 animate-pulse" />}

      <div id="payment-widget" className="mb-4" />
      <div id="agreement-widget" className="mb-6" />

      {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

      <Button
        variant="default"
        onClick={handlePay}
        disabled={loading || paying}
        className="w-full mb-4"
      >
        {paying ? '결제 진행 중...' : `\u20A9${info.amount.toLocaleString()} 결제하기`}
      </Button>

      <p className="text-[0.8rem] text-[var(--text-secondary)] text-center leading-relaxed">
        결제 후 즉시 플랜이 활성화됩니다.{plan !== 'feedback' ? ' 매월 자동 갱신되지 않으며, 만료 후 재결제 필요합니다.' : ''}
      </p>
    </div>
  );
}
