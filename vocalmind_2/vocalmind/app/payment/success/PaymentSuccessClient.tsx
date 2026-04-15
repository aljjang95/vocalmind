'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const PLAN_LABEL: Record<string, string> = {
  hobby: '취미반',
  pro: '발성전문반',
  feedback: '유료 피드백',
};

export default function PaymentSuccessClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [plan, setPlan] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = Number(searchParams.get('amount'));

    if (!paymentKey || !orderId || !amount) {
      setStatus('error');
      setErrorMsg('결제 정보가 올바르지 않습니다.');
      return;
    }

    fetch('/api/payment/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setPlan(data.plan);
          setStatus('done');
        } else {
          setStatus('error');
          setErrorMsg(data.error || '결제 승인 실패');
        }
      })
      .catch(() => {
        setStatus('error');
        setErrorMsg('네트워크 오류. 고객센터에 문의해주세요.');
      });
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center bg-[var(--bg-base)]">
        <div className="w-12 h-12 border-[3px] border-[var(--bg-surface)] border-t-[var(--accent)] rounded-full animate-spin" />
        <p>결제를 확인하고 있습니다...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center bg-[var(--bg-base)]">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-500 text-[2rem] flex items-center justify-center">&#10007;</div>
        <h2 className="text-[1.75rem] font-bold text-[var(--text-primary)]">결제 처리 실패</h2>
        <p className="text-[var(--text-secondary)] text-base max-w-[360px]">{errorMsg}</p>
        <Button variant="secondary" onClick={() => router.push('/pricing')}>
          요금제로 돌아가기
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 text-center bg-[var(--bg-base)]">
      <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 text-[2rem] flex items-center justify-center">&#10003;</div>
      <h2 className="text-[1.75rem] font-bold text-[var(--text-primary)]">결제 완료!</h2>
      <p className="text-[var(--text-secondary)] text-base max-w-[360px]">
        <strong>{PLAN_LABEL[plan] ?? plan}</strong> 플랜이 활성화되었습니다.
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        {plan === 'feedback' ? (
          <Button variant="default" onClick={() => router.push('/feedback-request')}>
            녹음 제출하기
          </Button>
        ) : (
          <Button variant="default" onClick={() => router.push('/journey')}>
            레슨 시작하기
          </Button>
        )}
        <Button variant="secondary" onClick={() => router.push('/dashboard')}>
          대시보드로
        </Button>
      </div>
    </div>
  );
}
