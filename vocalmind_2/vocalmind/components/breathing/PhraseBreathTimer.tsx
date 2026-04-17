'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  startBreathDetection,
  stopBreathDetection,
} from '@/lib/audio/breathDetector';
import type { BreathEvent } from '@/lib/audio/breathDetector';
import type { BreathRecord } from '@/types';

const PHRASE_TARGETS = [8, 15, 20];

export interface PhraseBreathTimerProps {
  isActive: boolean;
  setActive: (v: boolean) => void;
  updateExhaleDuration: (d: number) => void;
  setBreathData: (d: { rms: number; isBreathing: boolean; durationSec: number } | null) => void;
  saveRecord: (r: BreathRecord) => void;
  resetSession: () => void;
}

export default function PhraseBreathTimer({
  isActive,
  setActive,
  updateExhaleDuration,
  setBreathData,
  saveRecord,
  resetSession,
}: PhraseBreathTimerProps) {
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
