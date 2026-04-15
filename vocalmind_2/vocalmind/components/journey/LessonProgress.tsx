'use client';

import type { JourneyLessonPhase } from '@/types';

const PHASES: { key: JourneyLessonPhase; label: string }[] = [
  { key: 'why', label: '왜?' },
  { key: 'demo', label: '시범' },
  { key: 'practice', label: '실습' },
  { key: 'eval', label: '평가' },
  { key: 'summary', label: '요약' },
];

const PHASE_ORDER: JourneyLessonPhase[] = ['why', 'demo', 'practice', 'eval', 'summary'];

interface Props {
  currentPhase: JourneyLessonPhase;
}

export default function LessonProgress({ currentPhase }: Props) {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);

  return (
    <div className="flex items-center w-full py-4">
      {PHASES.map((phase, i) => {
        const isCompleted = i < currentIndex;
        const isActive = i === currentIndex;

        return (
          <div key={phase.key} style={{ display: 'contents' }}>
            <div className="flex flex-col items-center flex-1 relative">
              <div
                className={`w-2.5 h-2.5 rounded-full z-[1] transition-all duration-300 ${
                  isActive
                    ? 'bg-[var(--accent)] border-2 border-[var(--accent)] shadow-[0_0_0_3px_rgba(59,130,246,0.25)]'
                    : isCompleted
                      ? 'bg-[var(--accent-light)] border-2 border-[var(--accent-light)]'
                      : 'bg-white/[0.06] border-2 border-white/20'
                }`}
              />
              <span
                className={`mt-1.5 text-[11px] whitespace-nowrap transition-colors duration-300 ${
                  isCompleted || isActive ? 'text-white/90' : 'text-white/35'
                }`}
              >
                {phase.label}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div
                className={`flex-1 h-0.5 -mx-1 self-start mt-1 relative top-[3px] ${
                  i < currentIndex ? 'bg-[var(--accent)]' : 'bg-white/10'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
