import { Suspense } from 'react';
import CreditsSuccessClient from './CreditsSuccessClient';

export default function CreditsSuccessPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md py-20 text-center text-sm text-white/60">결제 확인 중...</div>}>
      <CreditsSuccessClient />
    </Suspense>
  );
}
