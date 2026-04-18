import { Suspense } from 'react';
import CreditsFailClient from './CreditsFailClient';

export default function CreditsFailPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md py-20 text-center text-sm text-white/60">로딩 중...</div>}>
      <CreditsFailClient />
    </Suspense>
  );
}
