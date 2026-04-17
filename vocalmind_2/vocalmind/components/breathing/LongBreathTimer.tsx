'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  startBreathDetection,
  stopBreathDetection,
} from '@/lib/audio/breathDetector';
import type { BreathEvent } from '@/lib/audio/breathDetector';
import type { BreathRecord } from '@/types';

export interface LongBreathTimerProps {
  isActive: boolean;
  setActive: (v: boolean) => void;
  updateExhaleDuration: (d: number) => void;
  setBreathData: (d: { rms: number; isBreathing: boolean; durationSec: number } | null) => void;
  saveRecord: (r: BreathRecord) => void;
  resetSession: () => void;
}

export default function LongBreathTimer({
  isActive,
  setActive,
  updateExhaleDuration,
  setBreathData,
  saveRecord,
  resetSession,
}: LongBreathTimerProps) {
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
