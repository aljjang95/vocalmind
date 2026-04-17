'use client';

import { useState, useEffect, useRef } from 'react';
import type { BreathPhase } from '@/types';

const RHYTHM_PATTERNS: { label: string; phases: BreathPhase[] }[] = [
  {
    label: '기본',
    phases: [
      { type: 'inhale', durationSec: 4 },
      { type: 'hold', durationSec: 4 },
      { type: 'exhale', durationSec: 4 },
      { type: 'rest', durationSec: 2 },
    ],
  },
  {
    label: '중급',
    phases: [
      { type: 'inhale', durationSec: 4 },
      { type: 'hold', durationSec: 7 },
      { type: 'exhale', durationSec: 8 },
      { type: 'rest', durationSec: 2 },
    ],
  },
  {
    label: '고급',
    phases: [
      { type: 'inhale', durationSec: 5 },
      { type: 'hold', durationSec: 10 },
      { type: 'exhale', durationSec: 10 },
      { type: 'rest', durationSec: 3 },
    ],
  },
];

const PHASE_LABELS: Record<string, string> = {
  inhale: '들이쉬세요',
  hold: '참으세요',
  exhale: '내쉬세요',
  rest: '쉬세요',
};

const PHASE_COLOR: Record<string, string> = {
  inhale: 'text-[var(--accent)]',
  hold: 'text-[var(--warning)]',
  exhale: 'text-[var(--success)]',
  rest: 'text-[var(--muted)]',
};

export interface RhythmBreathTimerProps {
  isActive: boolean;
  setActive: (v: boolean) => void;
  setBreathData: (d: { rms: number; isBreathing: boolean; durationSec: number } | null) => void;
  resetSession: () => void;
}

export default function RhythmBreathTimer({
  isActive,
  setActive,
  setBreathData,
  resetSession,
}: RhythmBreathTimerProps) {
  const [diffIndex, setDiffIndex] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseElapsed, setPhaseElapsed] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pattern = RHYTHM_PATTERNS[diffIndex];
  const currentPhase = pattern.phases[phaseIndex];

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      resetSession();
    };
  }, [resetSession]);

  const handleStart = () => {
    setActive(true);
    setPhaseIndex(0);
    setPhaseElapsed(0);
    setCycleCount(0);

    timerRef.current = setInterval(() => {
      setPhaseElapsed((prev) => {
        const next = prev + 0.1;
        return Math.round(next * 10) / 10;
      });
    }, 100);
  };

  useEffect(() => {
    if (!isActive) return;
    if (phaseElapsed >= currentPhase.durationSec) {
      const nextIndex = phaseIndex + 1;
      if (nextIndex >= pattern.phases.length) {
        setPhaseIndex(0);
        setCycleCount((c) => c + 1);
      } else {
        setPhaseIndex(nextIndex);
      }
      setPhaseElapsed(0);
    }
  }, [phaseElapsed, currentPhase.durationSec, phaseIndex, pattern.phases.length, isActive]);

  useEffect(() => {
    if (!isActive) return;
    const simRms = currentPhase.type === 'exhale' ? 0.15 : currentPhase.type === 'inhale' ? 0.08 : 0.02;
    setBreathData({
      rms: simRms,
      isBreathing: currentPhase.type === 'exhale' || currentPhase.type === 'inhale',
      durationSec: phaseElapsed,
    });
  }, [isActive, currentPhase.type, phaseElapsed, setBreathData]);

  const handleStop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setActive(false);
    setBreathData(null);
    setPhaseIndex(0);
    setPhaseElapsed(0);
  };

  const remaining = Math.max(0, currentPhase.durationSec - phaseElapsed);

  return (
    <div className="flex flex-col items-center gap-5 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-xl max-md:p-4">
      <div className="flex flex-col items-center gap-4 w-full">
        {!isActive && (
          <div className="flex gap-2 max-md:flex-wrap max-md:justify-center">
            {RHYTHM_PATTERNS.map((p, i) => (
              <button
                key={p.label}
                type="button"
                className={`px-4 py-2 text-sm font-medium border rounded-md cursor-pointer transition-all ${
                  i === diffIndex
                    ? 'bg-blue-500/[0.15] text-[var(--accent)] border-blue-500/40'
                    : 'bg-[var(--surface2)] text-[var(--text2)] border-[var(--border)] hover:bg-[var(--surface3)] hover:text-[var(--text)]'
                }`}
                onClick={() => setDiffIndex(i)}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {!isActive && (
          <div className="flex items-center gap-1.5 text-sm text-[var(--text2)]">
            {pattern.phases.map((ph, i) => (
              <span key={i}>
                {i > 0 && <span className="text-[var(--muted)]"> / </span>}
                <span className="px-2.5 py-1 rounded bg-[var(--surface2)]">
                  {PHASE_LABELS[ph.type]} {ph.durationSec}초
                </span>
              </span>
            ))}
          </div>
        )}

        {isActive && (
          <div className="flex flex-col items-center gap-2">
            <span className={`text-[1.4rem] font-bold transition-colors duration-300 ${PHASE_COLOR[currentPhase.type]}`}>
              {PHASE_LABELS[currentPhase.type]}
            </span>
            <span className="text-2xl font-extrabold text-[var(--text)] tabular-nums">{remaining.toFixed(1)}</span>
            <div className="flex items-center gap-1.5 text-sm text-[var(--text2)]">
              {pattern.phases.map((ph, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-[var(--muted)]">/</span>}
                  <span
                    className={`px-2.5 py-1 rounded ${
                      i === phaseIndex ? 'bg-blue-500/20 text-[var(--accent)] font-semibold' : 'bg-[var(--surface2)]'
                    }`}
                  >
                    {PHASE_LABELS[ph.type]}
                  </span>
                </span>
              ))}
            </div>
            <span className="text-sm text-[var(--text2)]">{cycleCount + 1}번째 사이클</span>
          </div>
        )}

        {!isActive ? (
          <button type="button" className="px-10 py-3.5 bg-[var(--accent)] text-white text-base font-semibold border-none rounded-lg cursor-pointer transition-all hover:bg-[var(--accent-lt)] hover:-translate-y-px" onClick={handleStart}>
            시작
          </button>
        ) : (
          <button type="button" className="px-10 py-3.5 bg-[var(--error)] text-white text-base font-semibold border-none rounded-lg cursor-pointer transition-colors hover:bg-[var(--error-lt)]" onClick={handleStop}>
            정지
          </button>
        )}
      </div>
    </div>
  );
}
