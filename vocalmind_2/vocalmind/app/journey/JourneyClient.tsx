'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { hlbCurriculum } from '@/lib/data/hlbCurriculum';
import { useJourneyStore } from '@/stores/journeyStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import StageCard from '@/components/journey/StageCard';

export default function JourneyClient() {
  const router = useRouter();
  const { getStageStatus, progress, getNextAvailableStage } = useJourneyStore();
  const onboardingResult = useOnboardingStore((s) => s.result);

  const suggestedStage = onboardingResult?.consultation.suggested_stage_id ?? null;
  const nextAvailable = getNextAvailableStage();

  // 추천 단계: 온보딩 결과 우선, 없으면 다음 진행 가능 단계
  const highlightStageId = suggestedStage ?? nextAvailable ?? 1;

  const blocks = hlbCurriculum.reduce<Record<string, typeof hlbCurriculum>>((acc, stage) => {
    const key = stage.block;
    if (!acc[key]) acc[key] = [];
    acc[key].push(stage);
    return acc;
  }, {});

  const completedCount = Object.values(progress).filter((p) => p?.passedAt).length;

  // 블록별: 추천 단계가 포함된 블록과 미완료 블록은 열림, 전부 완료된 이전 블록은 접힘
  const blockEntries = Object.entries(blocks);
  const initialCollapsed = useMemo(() => {
    const collapsed: Record<string, boolean> = {};
    for (const [blockName, stages] of blockEntries) {
      const allPassed = stages.every((s) => progress[s.id]?.status === 'passed');
      const hasHighlight = stages.some((s) => s.id === highlightStageId);
      collapsed[blockName] = allPassed && !hasHighlight;
    }
    return collapsed;
  }, [blockEntries, progress, highlightStageId]);

  const [collapsedBlocks, setCollapsedBlocks] = useState(initialCollapsed);

  const toggleBlock = (blockName: string) => {
    setCollapsedBlocks((prev) => ({ ...prev, [blockName]: !prev[blockName] }));
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* 상단 네비 */}
      <nav className="sticky top-0 z-[100] bg-[var(--glass-bg)] backdrop-blur-[20px] border-b border-[var(--border)] flex items-center justify-between px-5 h-[52px]">
        <Link href="/" className="font-bold text-[15px] text-[var(--text-primary)] no-underline">
          HLB 보컬스튜디오
        </Link>
        <div className="hidden sm:flex gap-1">
          <Link href="/scale-practice" className="text-[13px] text-[var(--text-secondary)] no-underline px-2.5 py-1.5 rounded-md hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">스케일</Link>
          <Link href="/coach" className="text-[13px] text-[var(--text-secondary)] no-underline px-2.5 py-1.5 rounded-md hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">AI 코치</Link>
          <Link href="/dashboard" className="text-[13px] text-[var(--text-secondary)] no-underline px-2.5 py-1.5 rounded-md hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">대시보드</Link>
        </div>
      </nav>

      <div className="max-w-[720px] mx-auto px-5 pb-[60px]">
        <header className="pt-8 pb-6">
          <h1 className="font-[family-name:var(--font-display)] text-[var(--text-primary)] font-bold tracking-tight text-[28px]">소리의 길</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1.5">
            {completedCount}개 완료 · 전체 {hlbCurriculum.length}단계
          </p>
        </header>

        <div className="flex flex-col gap-8">
          {blockEntries.map(([blockName, stages]) => {
            const isCollapsed = collapsedBlocks[blockName];
            const passedInBlock = stages.filter((s) => progress[s.id]?.status === 'passed').length;

            return (
              <section key={blockName}>
                <button
                  type="button"
                  onClick={() => toggleBlock(blockName)}
                  className="flex items-center gap-2 w-full text-left bg-transparent border-none cursor-pointer p-0 pl-0.5 mb-3"
                >
                  <svg
                    className={`text-[var(--text-muted)] transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                    width="12" height="12" viewBox="0 0 12 12" fill="none"
                  >
                    <path d="M4.5 2.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-[13px] font-semibold text-[var(--text-secondary)] tracking-wide">
                    {blockName}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] ml-1">
                    {passedInBlock}/{stages.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="flex flex-col gap-2">
                    {stages.map((stage) => {
                      const status = getStageStatus(stage.id);
                      const prog = progress[stage.id];
                      const isHighlight = stage.id === highlightStageId;
                      return (
                        <div key={stage.id} className={isHighlight ? 'ring-2 ring-[var(--accent)] rounded-xl' : ''}>
                          <StageCard
                            stage={stage}
                            status={status}
                            bestScore={prog?.bestScore ?? 0}
                            onClick={() => router.push(`/journey/${stage.id}`)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
