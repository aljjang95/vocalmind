import { Suspense } from 'react';
import PaymentSuccessClient from './PaymentSuccessClient';

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>결제 확인 중...</div>}>
      <PaymentSuccessClient />
    </Suspense>
  );
}
