'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { stopBreathDetection } from '@/lib/audio/breathDetector';
import { useBreathingStore } from '@/stores/breathingStore';
import ModeSelector from '@/components/breathing/ModeSelector';
import BreathVisualizer from '@/components/breathing/BreathVisualizer';
import BreathTimer from '@/components/breathing/BreathTimer';
import WeeklyChart from '@/components/breathing/WeeklyChart';

export default function BreathingPageClient() {
  const resetSession = useBreathingStore((s) => s.resetSession);

  useEffect(() => {
    return () => {
      stopBreathDetection();
      resetSession();
    };
  }, [resetSession]);

  return (
    <>
      <div className="gradient-bg" aria-hidden="true" />
      <header className="sticky top-0 z-[100] py-4 bg-[var(--glass-bg)] backdrop-blur-[24px] backdrop-saturate-[180%] border-b border-[var(--border)]">
        <div className="container">
          <div className="flex items-center justify-between max-w-[1400px] mx-auto px-5">
            <Link href="/" className="font-[Inter] text-[1.1rem] font-bold text-[var(--text)] no-underline transition-colors hover:text-[var(--accent)]">
              &larr; HLB 보컬스튜디오
            </Link>
            <nav className="flex items-center gap-2">
              <Link href="/coach" className="px-[18px] py-2 text-[var(--text2)] no-underline text-[0.88rem] rounded-lg transition-all hover:text-[var(--text)] hover:bg-[var(--surface2)]">AI 코치</Link>
              <Link href="/diagnosis" className="px-[18px] py-2 text-[var(--text2)] no-underline text-[0.88rem] rounded-lg transition-all hover:text-[var(--text)] hover:bg-[var(--surface2)]">진단</Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="relative z-[1] py-6 pb-[60px] max-md:py-4 max-md:pb-10">
        <div className="max-w-[960px] mx-auto px-5">
          <h1 className="text-2xl font-extrabold text-[var(--text)] mb-2">호흡 트레이너</h1>
          <p className="text-sm text-[var(--text2)] mb-8">
            호흡 훈련을 통해 보컬에 필요한 폐활량과 호흡 안정성을 키워보세요.
          </p>
          <div className="flex flex-col gap-6">
            <ModeSelector />
            <div className="grid grid-cols-2 gap-5 items-start max-md:grid-cols-1">
              <BreathVisualizer />
              <BreathTimer />
            </div>
            <WeeklyChart />
          </div>
        </div>
      </main>
    </>
  );
}
