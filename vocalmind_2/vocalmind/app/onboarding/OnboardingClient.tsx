'use client';

import Link from 'next/link';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

export default function OnboardingClient() {
  return (
    <>
      <div className="gradient-bg" aria-hidden="true" />
      <header className="sticky top-0 z-[100] py-4 bg-[var(--glass-bg)] backdrop-blur-[24px] backdrop-saturate-[180%] border-b border-[var(--border)]">
        <div className="container">
          <div className="flex items-center justify-between">
            <Link href="/" className="font-['Inter',sans-serif] text-[1.1rem] font-bold text-[var(--text)] no-underline transition-colors duration-200 hover:text-[var(--accent)]">
              &larr; HLB 보컬스튜디오
            </Link>
            <nav className="flex items-center gap-2">
              <Link href="/journey" className="px-[18px] py-2 text-[var(--text2)] no-underline text-[0.88rem] rounded-lg transition-all duration-200 hover:text-[var(--text)] hover:bg-[var(--surface2)]">
                소리의 길
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="relative z-[1] py-[60px] pb-[100px] max-[768px]:py-10 max-[768px]:pb-20">
        <div className="container">
          <div className="text-center mb-12 max-[768px]:mb-8">
            <div className="section-kicker">AI 상담</div>
            <h1 className="section-title">
              목소리를 분석하고<br /><em>맞춤 로드맵</em>을 제시합니다
            </h1>
            <p className="section-desc mx-auto mt-4 max-w-[600px] text-center break-keep">
              녹음 한 번으로 AI가 긴장 상태를 분석하고, 당신만의 학습 경로를 설계합니다.
            </p>
          </div>
          <OnboardingWizard />
        </div>
      </main>
    </>
  );
}
