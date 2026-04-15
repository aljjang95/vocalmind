'use client';

import { useJourneyStore } from '@/stores/journeyStore';
import { hlbCurriculum } from '@/lib/data/hlbCurriculum';
import { GlowCard } from '@/components/ui/glow-card';

export default function GrowthChart() {
  const progress = useJourneyStore((s) => s.progress);

  // 통과한 스테이지만 스테이지 ID 순서로 정렬
  const passedEntries = hlbCurriculum
    .filter((stage) => progress[stage.id]?.status === 'passed')
    .map((stage) => ({
      id: stage.id,
      name: stage.name,
      blockIcon: stage.blockIcon,
      score: progress[stage.id].bestScore,
    }));

  if (passedEntries.length === 0) {
    return (
      <GlowCard className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">성장 그래프</h2>
        <div className="flex flex-col items-center justify-center py-10 gap-1.5">
          <p className="text-[0.95rem] text-[var(--text-secondary)] m-0">아직 데이터가 없어요</p>
          <p className="text-xs text-[var(--text-secondary)] opacity-60 m-0">레슨을 통과하면 점수 변화를 확인할 수 있어요</p>
        </div>
      </GlowCard>
    );
  }

  const maxScore = 100;

  return (
    <GlowCard className="p-6 space-y-4">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">성장 그래프</h2>
      <div className="flex gap-2 h-[220px] pt-2 max-md:h-[180px]">
        {/* Y Axis */}
        <div className="flex flex-col justify-between text-[0.7rem] text-[var(--text-secondary)] opacity-50 pb-6 w-7 text-right shrink-0">
          <span>100</span>
          <span>80</span>
          <span>60</span>
          <span>40</span>
          <span>20</span>
          <span>0</span>
        </div>
        {/* Bars */}
        <div className="flex items-end gap-1.5 flex-1 min-w-0 overflow-x-auto">
          {passedEntries.map((entry) => {
            const heightPct = (entry.score / maxScore) * 100;
            const barColor = entry.score >= 80
              ? 'bg-green-500'
              : entry.score >= 60
                ? 'bg-yellow-500'
                : 'bg-orange-500';
            const dotColor = entry.score >= 80
              ? 'bg-green-500'
              : entry.score >= 60
                ? 'bg-yellow-500'
                : 'bg-orange-500';

            return (
              <div key={entry.id} className="flex flex-col items-center gap-1.5 min-w-[28px] max-md:min-w-[22px] flex-1 max-w-[48px]">
                <div className="w-full h-[196px] max-md:h-[156px] flex items-end justify-center">
                  <div
                    className={`w-full max-w-[32px] rounded-t min-h-[4px] relative transition-[height] duration-400 ease-out ${barColor}`}
                    style={{ height: `${heightPct}%` }}
                  >
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[0.7rem] font-semibold text-[var(--text-primary)] whitespace-nowrap">
                      {entry.score}
                    </span>
                  </div>
                </div>
                <span className="text-[0.7rem] text-[var(--text-secondary)] text-center" title={entry.name}>
                  {entry.id}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {/* Legend */}
      <div className="flex gap-4 justify-center pt-1">
        <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <span className="inline-block w-2 h-2 rounded-sm bg-green-500" /> 80+
        </span>
        <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <span className="inline-block w-2 h-2 rounded-sm bg-yellow-500" /> 60-79
        </span>
        <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <span className="inline-block w-2 h-2 rounded-sm bg-orange-500" /> 60 미만
        </span>
      </div>
    </GlowCard>
  );
}
