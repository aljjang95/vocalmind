'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { loadPaymentWidget, PaymentWidgetInstance } from '@tosspayments/payment-widget-sdk';
import { Button } from '@/components/ui/button';
import type { ShopItem } from '@/types';

const CLIENT_KEY = process.env.NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY!;

interface Props {
  item: ShopItem;
  userEmail: string;
  userName: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  hat: '모자',
  top: '상의',
  bottom: '하의',
  accessory: '액세서리',
  effect: '이펙트',
  crown: '왕관',
};

export default function ItemCheckoutClient({ item, userEmail, userName }: Props) {
  const widgetRef = useRef<PaymentWidgetInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const orderIdRef = useRef(
    `item-${item.id.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );

  useEffect(() => {
    const init = async () => {
      try {
        const widget = await loadPaymentWidget(CLIENT_KEY, userEmail);
        await widget.renderPaymentMethods(
          '#payment-widget',
          { value: item.price },
          { variantKey: 'DEFAULT' },
        );
        await widget.renderAgreement('#agreement-widget', { variantKey: 'AGREEMENT' });
        widgetRef.current = widget;
      } catch {
        setError('결제 위젯 로드 실패. 새로고침 해주세요.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [item.price, userEmail]);

  const handlePay = async () => {
    if (!widgetRef.current) return;
    setPaying(true);
    setError('');
    try {
      await widgetRef.current.requestPayment({
        orderId: orderIdRef.current,
        orderName: `HLB 보컬스튜디오 아이템: ${item.name}`,
        successUrl: `${window.location.origin}/payment/success?type=item&itemId=${item.id}`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: userEmail,
        customerName: userName,
      });
    } catch (e: unknown) {
      if (
        e &&
        typeof e === 'object' &&
        'code' in e &&
        (e as { code: string }).code !== 'USER_CANCEL'
      ) {
        setError('결제 중 오류가 발생했습니다.');
      }
      setPaying(false);
    }
  };

  return (
    <div className="max-w-[520px] mx-auto px-4 pt-8 pb-16">
      <div className="mb-6">
        <Link href="/avatar" className="text-[13px] text-[var(--text-muted)] no-underline">
          &larr; 아바타 상점으로 돌아가기
        </Link>
      </div>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">{item.name}</h1>
        <p className="text-[var(--text-secondary)] text-[0.9rem] mb-4">
          {CATEGORY_LABELS[item.category] ?? item.category} 아이템
        </p>
        <div className="text-[2rem] font-extrabold text-[var(--accent)]">
          &#8361;{item.price.toLocaleString()}
        </div>
      </div>

      {loading && (
        <div className="h-[300px] bg-[var(--bg-surface)] rounded-xl mb-4 animate-pulse" />
      )}

      <div id="payment-widget" className="mb-4" />
      <div id="agreement-widget" className="mb-6" />

      {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

      <Button
        variant="default"
        onClick={handlePay}
        disabled={loading || paying}
        className="w-full mb-4"
      >
        {paying ? '결제 진행 중...' : `\u20A9${item.price.toLocaleString()} 결제하기`}
      </Button>

      <p className="text-[0.8rem] text-[var(--text-secondary)] text-center leading-relaxed">
        결제 후 즉시 인벤토리에 추가됩니다.
      </p>
    </div>
  );
}
