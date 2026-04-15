'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useBreathingStore } from '@/stores/breathingStore';
import {
  startBreathDetection,
  stopBreathDetection,
} from '@/lib/audio/breathDetector';
import type { BreathEvent } from '@/lib/audio/breathDetector';
import type { BreathPhase, BreathRecord } from '@/types';

// ── Rhythm patterns (inhale/hold/exhale in seconds) ──
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

const PHRASE_TARGETS = [8, 15, 20];

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

export default function BreathTimer() {
  const mode = useBreathingStore((s) => s.mode);
  const isActive = useBreathingStore((s) => s.isActive);
  const setActive = useBreathingStore((s) => s.setActive);
  const updateExhaleDuration = useBreathingStore((s) => s.updateExhaleDuration);
  const setBreathData = useBreathingStore((s) => s.setBreathData);
  const saveRecord = useBreathingStore((s) => s.saveRecord);
  const resetSession = useBreathingStore((s) => s.resetSession);

  switch (mode) {
    case 'long':
      return (
        <LongBreathTimer
          isActive={isActive}
          setActive={setActive}
          updateExhaleDuration={updateExhaleDuration}
          setBreathData={setBreathData}
          saveRecord={saveRecord}
          resetSession={resetSession}
        />
      );
    case 'rhythm':
      return (
        <RhythmBreathTimer
          isActive={isActive}
          setActive={setActive}
          setBreathData={setBreathData}
          resetSession={resetSession}
        />
      );
    case 'phrase':
      return (
        <PhraseBreathTimer
          isActive={isActive}
          setActive={setActive}
          updateExhaleDuration={updateExhaleDuration}
          setBreathData={setBreathData}
          saveRecord={saveRecord}
          resetSession={resetSession}
        />
      );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LONG BREATH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface LongBreathProps {
  isActive: boolean;
  setActive: (v: boolean) => void;
  updateExhaleDuration: (d: number) => void;
  setBreathData: (d: { rms: number; isBreathing: boolean; durationSec: number } | null) => void;
  saveRecord: (r: BreathRecord) => void;
  resetSession: () => void;
}

function LongBreathTimer({
  isActive,
  setActive,
  updateExhaleDuration,
  setBreathData,
  saveRecord,
  resetSession,
}: LongBreathProps) {
  const [calibrating, setCalibrating] = useState(false);
  const [finalDuration, setFinalDuration] = useState<number | null>(null);
  const breathStartRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    stopBreathDetection();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    silenceTimerRef.current = null;
    tickRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
      resetSession();
    };
  }, [cleanup, resetSession]);

  const handleStart = async () => {
    setFinalDuration(null);
    resetSession();
    setCalibrating(true);
    setActive(true);
    breathStartRef.current = null;

    try {
      await startBreathDetection(
        (ev: BreathEvent) => {
          const now = Date.now();

          if (ev.isBreathing) {
            if (!breathStartRef.current) {
              breathStartRef.current = now;
            }
            const elapsed = (now - breathStartRef.current) / 1000;
            updateExhaleDuration(elapsed);
            setBreathData({ rms: ev.rms, isBreathing: true, durationSec: elapsed });

            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          } else {
            setBreathData({ rms: ev.rms, isBreathing: false, durationSec: 0 });

            if (breathStartRef.current && !silenceTimerRef.current) {
              silenceTimerRef.current = setTimeout(() => {
                const totalDuration = breathStartRef.current
                  ? (Date.now() - breathStartRef.current) / 1000
                  : 0;
                finishLong(totalDuration);
              }, 1000);
            }
          }
        },
        () => {
          setCalibrating(false);
        },
      );
    } catch {
      setCalibrating(false);
      setActive(false);
    }
  };

  const finishLong = useCallback((duration: number) => {
    cleanup();
    setActive(false);
    setFinalDuration(duration);
    if (duration > 0.5) {
      saveRecord({
        id: crypto.randomUUID(),
        date: new Date().toISOString().slice(0, 10),
        mode: 'long' as const,
        longestExhaleSec: duration,
        avgExhaleSec: duration,
        sessionsCount: 1,
        completedAt: new Date().toISOString(),
      });
    }
  }, [cleanup, setActive, saveRecord]);

  const handleStop = () => {
    const duration = breathStartRef.current
      ? (Date.now() - breathStartRef.current) / 1000
      : 0;
    finishLong(duration);
  };

  const handleRetry = () => {
    setFinalDuration(null);
    resetSession();
  };

  if (finalDuration !== null) {
    return (
      <div className="flex flex-col items-center gap-5 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-xl max-md:p-4">
        <div className="flex flex-col items-center gap-3 p-5 bg-blue-500/[0.06] border border-blue-500/20 rounded-lg w-full">
          <span className="text-sm text-[var(--text2)] font-semibold">호흡 지속 시간</span>
          <span className="text-[2rem] font-extrabold text-[var(--accent)] tabular-nums">{finalDuration.toFixed(1)}초</span>
          <div className="flex gap-3 mt-1">
            <button type="button" className="px-6 py-2.5 bg-[var(--surface2)] text-[var(--text)] text-sm font-semibold border border-[var(--border2)] rounded-md cursor-pointer transition-colors hover:bg-[var(--surface3)]" onClick={handleRetry}>
              다시 하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (calibrating) {
    return (
      <div className="flex flex-col items-center gap-5 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-xl max-md:p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-[var(--surface3)] border-t-[var(--accent)] rounded-full animate-spin" />
          <span className="text-sm text-[var(--text2)]">주변 소음을 측정하고 있습니다...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-xl max-md:p-4">
      {!isActive ? (
        <button type="button" className="px-10 py-3.5 bg-[var(--accent)] text-white text-base font-semibold border-none rounded-lg cursor-pointer transition-all hover:bg-[var(--accent-lt)] hover:-translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0" onClick={handleStart}>
          시작
        </button>
      ) : (
        <button type="button" className="px-10 py-3.5 bg-[var(--error)] text-white text-base font-semibold border-none rounded-lg cursor-pointer transition-colors hover:bg-[var(--error-lt)]" onClick={handleStop}>
          정지
        </button>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RHYTHM BREATH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface RhythmBreathProps {
  isActive: boolean;
  setActive: (v: boolean) => void;
  setBreathData: (d: { rms: number; isBreathing: boolean; durationSec: number } | null) => void;
  resetSession: () => void;
}

function RhythmBreathTimer({
  isActive,
  setActive,
  setBreathData,
  resetSession,
}: RhythmBreathProps) {
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHRASE BREATH
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PhraseBreathProps {
  isActive: boolean;
  setActive: (v: boolean) => void;
  updateExhaleDuration: (d: number) => void;
  setBreathData: (d: { rms: number; isBreathing: boolean; durationSec: number } | null) => void;
  saveRecord: (r: BreathRecord) => void;
  resetSession: () => void;
}

function PhraseBreathTimer({
  isActive,
  setActive,
  updateExhaleDuration,
  setBreathData,
  saveRecord,
  resetSession,
}: PhraseBreathProps) {
  const [targetSec, setTargetSec] = useState(8);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [success, setSuccess] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breathActiveRef = useRef(false);

  const cleanup = useCallback(() => {
    stopBreathDetection();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
      resetSession();
    };
  }, [cleanup, resetSession]);

  const handleStart = async () => {
    setFinished(false);
    setElapsed(0);
    resetSession();
    breathActiveRef.current = false;

    setCountdown(3);
    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCountdown(null);

    setCalibrating(true);
    setActive(true);

    try {
      await startBreathDetection(
        (ev: BreathEvent) => {
          breathActiveRef.current = ev.isBreathing;
          setBreathData({ rms: ev.rms, isBreathing: ev.isBreathing, durationSec: 0 });
        },
        () => {
          setCalibrating(false);
          const startTime = Date.now();
          timerRef.current = setInterval(() => {
            const el = (Date.now() - startTime) / 1000;
            setElapsed(el);
            updateExhaleDuration(el);

            if (el >= targetSec) {
              finishPhrase(el, true);
            }
          }, 100);
        },
      );
    } catch {
      setCalibrating(false);
      setActive(false);
    }
  };

  const finishPhrase = useCallback((duration: number, isSuccess: boolean) => {
    cleanup();
    setActive(false);
    setFinished(true);
    setSuccess(isSuccess);
    if (duration > 0.5) {
      saveRecord({
        id: crypto.randomUUID(),
        date: new Date().toISOString().slice(0, 10),
        mode: 'phrase' as const,
        longestExhaleSec: duration,
        avgExhaleSec: duration,
        sessionsCount: 1,
        completedAt: new Date().toISOString(),
      });
    }
  }, [cleanup, setActive, saveRecord]);

  const handleStop = () => {
    finishPhrase(elapsed, elapsed >= targetSec);
  };

  const handleRetry = () => {
    setFinished(false);
    setElapsed(0);
    resetSession();
  };

  const progressPct = Math.min((elapsed / targetSec) * 100, 100);

  if (countdown !== null) {
    return (
      <div className="flex flex-col items-center gap-5 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-xl max-md:p-4">
        <span className="text-[3rem] font-extrabold text-[var(--accent)] animate-[countPulse_1s_ease-in-out]">{countdown}</span>
      </div>
    );
  }

  if (calibrating) {
    return (
      <div className="flex flex-col items-center gap-5 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-xl max-md:p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-[var(--surface3)] border-t-[var(--accent)] rounded-full animate-spin" />
          <span className="text-sm text-[var(--text2)]">주변 소음을 측정하고 있습니다...</span>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-5 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-xl max-md:p-4">
        <div className="flex flex-col items-center gap-3 p-5 bg-blue-500/[0.06] border border-blue-500/20 rounded-lg w-full">
          <span className="text-sm text-[var(--text2)] font-semibold">프레이즈 호흡 결과</span>
          <span className="text-[2rem] font-extrabold text-[var(--accent)] tabular-nums">{elapsed.toFixed(1)}초 / {targetSec}초</span>
          <span className={success ? 'text-[var(--success)] font-semibold text-sm' : 'text-sm text-[var(--text2)] text-center'}>
            {success ? '목표 달성!' : '아쉽지만 다시 도전해보세요'}
          </span>
          <div className="flex gap-3 mt-1">
            <button type="button" className="px-6 py-2.5 bg-[var(--surface2)] text-[var(--text)] text-sm font-semibold border border-[var(--border2)] rounded-md cursor-pointer transition-colors hover:bg-[var(--surface3)]" onClick={handleRetry}>
              다시 하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-xl max-md:p-4">
      <div className="flex flex-col items-center gap-4 w-full">
        {!isActive && (
          <div className="flex gap-2 max-md:flex-wrap max-md:justify-center">
            {PHRASE_TARGETS.map((t) => (
              <button
                key={t}
                type="button"
                className={`px-5 py-2.5 text-sm font-semibold border rounded-md cursor-pointer transition-all ${
                  t === targetSec
                    ? 'bg-blue-500/[0.15] text-[var(--accent)] border-blue-500/40'
                    : 'bg-[var(--surface2)] text-[var(--text2)] border-[var(--border)] hover:bg-[var(--surface3)] hover:text-[var(--text)]'
                }`}
                onClick={() => setTargetSec(t)}
              >
                {t}초
              </button>
            ))}
          </div>
        )}

        {isActive && (
          <div className="w-full max-w-[360px]">
            <div className="w-full h-3 bg-[var(--surface2)] rounded-md overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--success)] rounded-md transition-[width] duration-150 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-[var(--text2)]">
              <span>{elapsed.toFixed(1)}초</span>
              <span>목표 {targetSec}초</span>
            </div>
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
