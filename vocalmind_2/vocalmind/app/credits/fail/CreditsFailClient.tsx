'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function CreditsFailClient() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code') ?? 'UNKNOWN';
  const message = searchParams.get('message') ?? '결제가 취소되었거나 실패했어요.';

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-2xl text-red-300">
        ×
      </div>
      <h1 className="text-xl font-bold text-white">결제 실패</h1>
      <p className="text-sm text-white/70">{message}</p>
      <p className="text-xs text-white/40">코드: {code}</p>
      <div className="mt-2 flex gap-3">
        <Link
          href="/credits"
          className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400"
        >
          다시 시도
        </Link>
        <Link
          href="/studio"
          className="rounded-lg border border-white/15 px-5 py-2.5 text-sm text-white/80 hover:border-white/30"
        >
          스튜디오 홈
        </Link>
      </div>
    </main>
  );
}
