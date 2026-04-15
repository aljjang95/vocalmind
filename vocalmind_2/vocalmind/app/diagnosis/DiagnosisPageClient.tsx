'use client';

import Link from 'next/link';
import DiagnosisWizard from '@/components/diagnosis/DiagnosisWizard';

export default function DiagnosisPageClient() {
  return (
    <>
      <div className="gradient-bg" aria-hidden="true" />
      <header className="sticky top-0 z-[100] py-4 bg-[var(--glass-bg)] backdrop-blur-[24px] backdrop-saturate-[180%] border-b border-[var(--border)]">
        <div className="container">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-[1.1rem] font-bold text-[var(--text)] no-underline hover:text-[var(--accent)] transition-colors">
              &larr; HLB 보컬스튜디오
            </Link>
            <nav className="flex items-center gap-2">
              <Link href="/coach" className="px-[18px] py-2 text-[var(--text2)] no-underline text-[0.88rem] rounded-lg hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-colors">AI 코치</Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="relative z-[1] py-[60px] pb-[100px] md:py-[60px] md:pb-[100px] max-md:py-10 max-md:pb-20">
        <div className="container">
          <div className="text-center mb-12 max-md:mb-8">
            <div className="section-kicker">AI 보컬 진단</div>
            <h1 className="section-title">
              당신의 목소리를<br /><em>분석합니다</em>
            </h1>
            <p className="section-desc">
              4단계 설문을 완료하면 AI가 당신의 보컬 상태를 종합 진단하고 맞춤 커리큘럼을 추천해드립니다.
            </p>
          </div>
          <DiagnosisWizard />
        </div>
      </main>
    </>
  );
}
