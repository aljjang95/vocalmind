'use client';

import { GlowCard } from '@/components/ui/glow-card';
import type { HLBCurriculumStage, StageStatus } from '@/types';

interface StageCardProps {
  stage: HLBCurriculumStage;
  status: StageStatus;
  bestScore: number;
  onClick: () => void;
}

export default function StageCard({ stage, status, bestScore, onClick }: StageCardProps) {
  const isLocked = status === 'locked';
  const isActive = status === 'available' || status === 'in_progress';

  const cardProps = isLocked
    ? { className: 'p-4 opacity-40 pointer-events-none' }
    : isActive
      ? { active: true, glow: true, className: 'p-4 cursor-pointer' }
      : { hover3d: true, className: 'p-4 cursor-pointer' };

  return (
    <GlowCard
      {...cardProps}
      onClick={!isLocked ? onClick : undefined}
    >
      <div className="flex items-center gap-3.5">
        <span className="text-xs font-mono text-[var(--text-muted)] w-7 text-right shrink-0 font-semibold tabular-nums">
          {String(stage.id).padStart(2, '0')}
        </span>

        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{
            background: status === 'passed' ? 'var(--success)'
              : isActive ? 'var(--accent)'
              : 'var(--bg-elevated)',
            boxShadow: isActive ? '0 0 8px var(--accent-glow)' : 'none',
          }}
        />

        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-medium text-[var(--text-primary)] leading-snug">
            {stage.name}
          </div>
          <div className="text-[13px] text-[var(--text-muted)] mt-0.5">
            {stage.pronunciation} · {stage.scaleType || stage.block}
          </div>
        </div>

        {bestScore > 0 && (
          <div className="text-right">
            <div className="font-mono text-lg font-bold text-[var(--text-primary)]">
              {bestScore}
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">점</div>
          </div>
        )}

        {isLocked && (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-[var(--text-muted)] shrink-0">
            <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        )}

        {!isLocked && (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[var(--text-muted)] shrink-0">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
    </GlowCard>
  );
}
