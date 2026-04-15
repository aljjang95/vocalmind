'use client';

import Link from 'next/link';
import { useCoachStore } from '@/stores/coachStore';
import LessonHome from '@/components/coach/LessonHome';
import ConditionCheck from '@/components/coach/ConditionCheck';
import LessonPlayer from '@/components/coach/LessonPlayer';
import JudgmentResult from '@/components/coach/JudgmentResult';
import SessionSummary from '@/components/coach/SessionSummary';

export default function CoachPageClient() {
  const phase = useCoachStore((s) => s.phase);

  return (
    <>
      <div className="gradient-bg" aria-hidden="true" />
      <header className="sticky top-0 z-[100] py-4 bg-[var(--glass-bg)] backdrop-blur-[24px] backdrop-saturate-[180%] border-b border-[var(--border)]">
        <div className="container">
          <div className="flex items-center justify-between max-w-[1400px] mx-auto px-5">
            <Link href="/" className="font-['Inter',sans-serif] text-[1.1rem] font-bold text-[var(--text)] no-underline transition-colors duration-200 hover:text-[var(--accent)]">
              &larr; HLB 보컬스튜디오
            </Link>
            <nav className="flex items-center gap-2">
              <Link href="/practice" className="px-[18px] py-2 text-[var(--text2)] no-underline text-[0.88rem] rounded-lg transition-all duration-200 hover:text-[var(--text)] hover:bg-[var(--surface2)]">연습실</Link>
              <Link href="/warmup" className="px-[18px] py-2 text-[var(--text2)] no-underline text-[0.88rem] rounded-lg transition-all duration-200 hover:text-[var(--text)] hover:bg-[var(--surface2)]">워밍업</Link>
              <Link href="/breathing" className="px-[18px] py-2 text-[var(--text2)] no-underline text-[0.88rem] rounded-lg transition-all duration-200 hover:text-[var(--text)] hover:bg-[var(--surface2)]">호흡</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="relative z-[1] pt-8 pb-[60px]">
        <div className="max-w-[800px] mx-auto px-5 flex flex-col gap-8">
          {phase === 'home' && <LessonHome />}
          {phase === 'condition' && <ConditionCheck />}
          {phase === 'lesson' && <LessonPlayer />}
          {phase === 'judgment' && <JudgmentResult />}
          {phase === 'summary' && <SessionSummary />}
        </div>
      </main>
    </>
  );
}
