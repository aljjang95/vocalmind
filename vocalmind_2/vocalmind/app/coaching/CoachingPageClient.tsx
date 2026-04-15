'use client';

import Link from 'next/link';
import CoachingLayout from '@/components/coaching/CoachingLayout';

export default function CoachingPageClient() {
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
              <Link href="/diagnosis" className="px-[18px] py-2 text-[var(--text2)] no-underline text-[0.88rem] rounded-lg transition-all duration-200 hover:text-[var(--text)] hover:bg-[var(--surface2)]">진단</Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="relative z-[1] py-5 pb-10">
        <div className="max-w-[1400px] mx-auto px-5">
          <CoachingLayout />
        </div>
      </main>
    </>
  );
}
