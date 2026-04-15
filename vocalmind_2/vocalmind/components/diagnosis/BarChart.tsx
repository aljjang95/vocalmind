'use client';

import { SelfEvalScores } from '@/types';

const LABELS: Record<keyof SelfEvalScores, string> = {
  pitch: '음정',
  breath: '호흡',
  power: '성량',
  tone: '음색',
  technique: '테크닉',
};

const COLORS: Record<keyof SelfEvalScores, string> = {
  pitch: 'var(--accent)',
  breath: 'var(--success)',
  power: 'var(--accent2)',
  tone: 'var(--error)',
  technique: 'var(--accent-lt)',
};

interface BarChartProps {
  scores: SelfEvalScores;
}

export default function BarChart({ scores }: BarChartProps) {
  const keys = Object.keys(LABELS) as (keyof SelfEvalScores)[];

  return (
    <div className="flex flex-col gap-3.5">
      {keys.map((key) => (
        <div key={key} className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-[0.8rem] text-[var(--text2)] text-right">{LABELS[key]}</span>
          <div className="flex-1 h-2.5 bg-[var(--surface2)] rounded-[5px] overflow-hidden">
            <div
              className="h-full rounded-[5px] transition-[width] duration-1000 ease-[cubic-bezier(.16,1,.3,1)]"
              style={{
                width: `${scores[key]}%`,
                background: `linear-gradient(90deg, ${COLORS[key]}, ${COLORS[key]}88)`,
              }}
            />
          </div>
          <span className="w-8 shrink-0 font-mono text-[0.82rem] text-[var(--text)] text-right">{scores[key]}</span>
        </div>
      ))}
    </div>
  );
}
