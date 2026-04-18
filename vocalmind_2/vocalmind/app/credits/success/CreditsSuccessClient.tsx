'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Status = 'loading' | 'done' | 'error';

export default function CreditsSuccessClient() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>('loading');
  const [credits, setCredits] = useState<number | null>(null);
  const [label, setLabel] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = Number(searchParams.get('amount'));

    if (!paymentKey || !orderId || !amount) {
      setStatus('error');
      setErrorMsg('결제 정보가 올바르지 않습니다.');
      return;
    }

    fetch('/api/credits/topup/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (r.ok && data.ok) {
          setCredits(data.credits ?? null);
          setLabel(data.label ?? '');
          setStatus('done');
        } else {
          setStatus('error');
          setErrorMsg(data.error ?? '결제 승인 실패');
        }
      })
      .catch(() => {
        setStatus('error');
        setErrorMsg('네트워크 오류 — 고객센터에 문의해주세요.');
      });
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" />
        <p className="text-sm text-white/60">결제를 확인하고 있어요...</p>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-2xl text-red-300">
          !
        </div>
        <h1 className="text-xl font-bold text-white">결제 승인 실패</h1>
        <p className="text-sm text-white/60">{errorMsg}</p>
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

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-2xl text-emerald-300">
        ✓
      </div>
      <h1 className="text-xl font-bold text-white">크레딧 충전 완료</h1>
      {credits !== null && (
        <p className="text-sm text-white/70">
          <span className="font-semibold text-white">{credits}크레딧</span>이 지급되었어요
          {label && <span className="block mt-1 text-xs text-white/40">{label}</span>}
        </p>
      )}
      <div className="mt-2 flex gap-3">
        <Link
          href="/studio/new"
          className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400"
        >
          커버 만들러 가기
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
