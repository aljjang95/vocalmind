'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const FAIL_MESSAGES: Record<string, string> = {
  PAY_PROCESS_CANCELED: '결제가 취소되었습니다.',
  PAY_PROCESS_ABORTED: '결제가 중단되었습니다.',
  REJECT_CARD_COMPANY: '카드사에서 결제를 거부했습니다.',
};

export default function PaymentFailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const code = searchParams.get('code') ?? '';
  const message = searchParams.get('message') ?? '결제에 실패했습니다.';
  const orderId = searchParams.get('orderId') ?? '';

  const displayMessage = FAIL_MESSAGES[code] || message;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center bg-[var(--bg-base)]">
      <div className="w-16 h-16 rounded-full bg-red-100 text-red-500 text-[2rem] flex items-center justify-center">&#10007;</div>
      <h2 className="text-[1.75rem] font-bold text-[var(--text-primary)]">결제 실패</h2>
      <p className="text-[var(--text-secondary)] text-base max-w-[360px]">{displayMessage}</p>
      {code && <p className="text-[var(--text-secondary)] text-[0.8rem] font-mono">오류 코드: {code}</p>}
      {orderId && <p className="text-[var(--text-secondary)] text-[0.8rem] font-mono">주문 번호: {orderId}</p>}
      <div className="flex gap-3 flex-wrap justify-center">
        <Button variant="default" onClick={() => router.back()}>
          다시 시도하기
        </Button>
        <Button variant="secondary" onClick={() => router.push('/pricing')}>
          요금제로 돌아가기
        </Button>
      </div>
    </div>
  );
}
