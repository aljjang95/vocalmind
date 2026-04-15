'use client';

import Link from 'next/link';
import { useJourneyStore } from '@/stores/journeyStore';
import { hlbCurriculum } from '@/lib/data/hlbCurriculum';
import { GlowCard } from '@/components/ui/glow-card';
import { Button } from '@/components/ui/button';

export default function ProgressCard() {
  const progress = useJourneyStore((s) => s.progress);
  const getNextAvailableStage = useJourneyStore((s) => s.getNextAvailableStage);

  const totalStages = hlbCurriculum.length;
  const passedStages = Object.values(progress).filter((p) => p.status === 'passed');
  const passedCount = passedStages.length;
  const percentage = totalStages > 0 ? Math.round((passedCount / totalStages) * 100) : 0;

  const nextStageId = getNextAvailableStage();
  const nextStage = nextStageId ? hlbCurriculum.find((s) => s.id === nextStageId) : null;

  // 가장 최근 통과한 스테이지
  const lastPassed = passedStages.length > 0
    ? passedStages.sort((a, b) => {
        const aTime = a.passedAt ? new Date(a.passedAt).getTime() : 0;
        const bTime = b.passedAt ? new Date(b.passedAt).getTime() : 0;
        return bTime - aTime;
      })[0]
    : null;
  const lastPassedStage = lastPassed
    ? hlbCurriculum.find((s) => s.id === lastPassed.stageId)
    : null;

  return (
    <GlowCard className="p-6 space-y-4">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">레슨 진도</h2>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-1">
          <span className="text-[2rem] font-bold text-[var(--text-primary)] leading-none">{passedCount}</span>
          <span className="text-sm text-[var(--text-secondary)]">/ {totalStages} 완료</span>
        </div>
        <div className="w-full h-1.5 bg-white/[0.06] rounded-sm overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] rounded-sm transition-[width] duration-400 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-xs text-[var(--text-secondary)] text-right">{percentage}%</span>
      </div>

      {lastPassedStage && (
        <div className="flex justify-between items-center py-2.5 border-t border-[var(--border-subtle)]">
          <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">최근 통과</span>
          <span className="text-sm text-[var(--text-primary)] text-right">
            {lastPassedStage.blockIcon} {lastPassedStage.name}
            {lastPassed ? ` (${lastPassed.bestScore}점)` : ''}
          </span>
        </div>
      )}

      {nextStage && (
        <div className="flex justify-between items-center py-2.5 border-t border-[var(--border-subtle)]">
          <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">다음 레슨</span>
          <span className="text-sm text-[var(--text-primary)] text-right">
            {nextStage.blockIcon} {nextStage.name}
          </span>
        </div>
      )}

      {nextStageId ? (
        <Link href={`/journey/${nextStageId}`} className="no-underline mt-1 block">
          <Button variant="default" className="w-full">
            이어서 연습하기
          </Button>
        </Link>
      ) : passedCount === totalStages ? (
        <Link href="/journey" className="no-underline mt-1 block">
          <Button variant="secondary" className="w-full">
            전체 복습하기
          </Button>
        </Link>
      ) : (
        <Link href="/journey" className="no-underline mt-1 block">
          <Button variant="secondary" className="w-full">
            소리의 길 보기
          </Button>
        </Link>
      )}
    </GlowCard>
  );
}
