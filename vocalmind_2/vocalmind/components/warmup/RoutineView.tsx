'use client';

import { WarmupRoutine } from '@/types';
import { GlowCard } from '@/components/ui/glow-card';

interface RoutineViewProps {
  routine: WarmupRoutine;
  onStart: () => void;
  onRegenerate: () => void;
}

export default function RoutineView({ routine, onStart, onRegenerate }: RoutineViewProps) {
  return (
    <GlowCard className="max-w-[680px] mx-auto p-8 animate-[slideIn_0.4s_ease-out] max-sm:p-5">
      <div className="flex items-center justify-between mb-5 max-sm:flex-col max-sm:items-start max-sm:gap-2.5">
        <h2 className="text-2xl font-bold text-[var(--text)]">워밍업 루틴</h2>
        <span className="px-3.5 py-1.5 bg-blue-500/[0.12] border border-blue-500/25 rounded-md text-sm font-semibold text-[var(--accent-lt)] font-mono">
          {routine.totalMinutes}분
        </span>
      </div>

      {/* AI 코멘트 */}
      <div className="px-[18px] py-3.5 bg-purple-500/[0.06] border border-purple-500/[0.15] rounded-md mb-6 text-sm text-[var(--text2)] leading-relaxed">
        <div className="text-xs font-semibold text-[var(--accent2-lt)] mb-1.5 uppercase tracking-wide">AI 코치 코멘트</div>
        {routine.aiComment}
      </div>

      {/* 단계 목록 */}
      <div className="flex flex-col gap-2.5 mb-7">
        {routine.stages.map((stage, idx) => (
          <div key={`${stage.stageId}-${idx}`} className="grid grid-cols-[36px_1fr_auto] gap-3.5 items-center px-4 py-3.5 bg-[var(--surface)] border border-[var(--border)] rounded-md transition-colors hover:border-[var(--border2)] max-sm:grid-cols-[32px_1fr] max-sm:gap-2.5">
            <div className="w-9 h-9 rounded-full bg-blue-500/[0.12] text-[var(--accent-lt)] text-sm font-bold flex items-center justify-center font-mono">
              {idx + 1}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--text)] whitespace-nowrap overflow-hidden text-ellipsis">{stage.name}</div>
              <div className="flex gap-3 mt-1 text-xs text-[var(--muted)]">
                <span className="flex items-center gap-1">{stage.pronunciation}</span>
                <span className="flex items-center gap-1">BPM {stage.suggestedBpm}</span>
                <span className="flex items-center gap-1">{stage.repetitions}회 반복</span>
              </div>
            </div>
            <div className="text-xs text-[var(--text2)] font-mono whitespace-nowrap max-sm:col-span-full max-sm:text-right">{stage.durationMin}분</div>
          </div>
        ))}
      </div>

      {/* 버튼 */}
      <div className="flex gap-3 max-sm:flex-col">
        <button type="button" className="flex-1 px-6 py-3.5 rounded-md border-none bg-[var(--cta-bg)] text-[var(--cta-text)] text-base font-bold cursor-pointer transition-colors hover:bg-[var(--cta-hover)]" onClick={onStart}>
          루틴 시작
        </button>
        <button type="button" className="px-6 py-3.5 rounded-md border border-[var(--border2)] bg-transparent text-[var(--text2)] text-sm font-semibold cursor-pointer transition-all hover:bg-[var(--surface2)] hover:border-[var(--accent)] hover:text-[var(--text)]" onClick={onRegenerate}>
          다시 생성
        </button>
      </div>
    </GlowCard>
  );
}
