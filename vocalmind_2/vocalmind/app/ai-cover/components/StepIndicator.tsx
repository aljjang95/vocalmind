'use client';

import type { AiCoverStep } from '@/types';

const STEPS: { key: AiCoverStep; label: string }[] = [
  { key: 'record', label: '녹음' },
  { key: 'model', label: '모델' },
  { key: 'convert', label: '변환' },
  { key: 'result', label: '결과' },
];

function stepIndex(step: AiCoverStep): number {
  return STEPS.findIndex((s) => s.key === step);
}

interface StepIndicatorProps {
  currentStep: AiCoverStep;
}

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIdx = stepIndex(currentStep);

  return (
    <div className="flex items-center mb-4">
      {STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;

        return (
          <div key={step.key} className="flex items-center gap-2 flex-1">
            <div
              className={[
                'w-8 h-8 rounded-full flex items-center justify-center text-[0.8rem] font-semibold shrink-0 transition-all border-2',
                isCompleted ? 'border-purple-600 bg-purple-600 text-white' : '',
                isCurrent ? 'border-purple-600 text-purple-600 bg-purple-600/10' : '',
                !isCompleted && !isCurrent ? 'text-[var(--text-secondary)] bg-[var(--bg-elevated)] border-[var(--border)]' : '',
              ].filter(Boolean).join(' ')}
            >
              {isCompleted ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <span>{idx + 1}</span>
              )}
            </div>
            <span
              className={[
                'text-[0.85rem] whitespace-nowrap transition-colors',
                isCurrent ? 'text-[var(--text-primary)] font-semibold' : '',
                isCompleted ? 'text-purple-600' : '',
                !isCurrent && !isCompleted ? 'text-[var(--text-muted)]' : '',
              ].filter(Boolean).join(' ')}
            >
              {step.label}
            </span>
            {idx < STEPS.length - 1 && (
              <div
                className={[
                  'flex-1 h-0.5 mx-1 transition-colors',
                  idx < currentIdx ? 'bg-purple-600' : 'bg-[var(--border)]',
                ].join(' ')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
