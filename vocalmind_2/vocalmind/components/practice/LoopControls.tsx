'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';

const MIN_LOOP_DURATION = 0.5;

function timeToSeconds(timeStr: string): number | null {
  const match = timeStr.match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return null;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  if (seconds >= 60) return null;
  return minutes * 60 + seconds;
}

function secondsToTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  disabled: boolean;
}

export default function LoopControls({ disabled }: Props) {
  const {
    loopStart,
    loopEnd,
    currentTime,
    setLoop,
    clearLoop,
  } = usePracticeStore();

  const [isEnabled, setIsEnabled] = useState(loopStart !== null && loopEnd !== null);
  const [startInput, setStartInput] = useState(loopStart !== null ? secondsToTime(loopStart) : '0:00');
  const [endInput, setEndInput] = useState(loopEnd !== null ? secondsToTime(loopEnd) : '0:00');
  const [repeatCount, setRepeatCount] = useState(0);

  useEffect(() => {
    if (loopStart !== null) setStartInput(secondsToTime(loopStart));
    if (loopEnd !== null) setEndInput(secondsToTime(loopEnd));
    setIsEnabled(loopStart !== null && loopEnd !== null);
  }, [loopStart, loopEnd]);

  useEffect(() => {
    if (loopStart !== null && loopEnd !== null && currentTime <= loopStart + 0.1) {
      setRepeatCount((prev) => prev + 1);
    }
  }, [currentTime, loopStart, loopEnd]);

  const applyLoop = useCallback((startSec: number, endSec: number) => {
    if (endSec - startSec < MIN_LOOP_DURATION) {
      endSec = startSec + MIN_LOOP_DURATION;
    }
    if (startSec >= endSec) {
      const temp = startSec;
      startSec = endSec;
      endSec = temp;
    }
    setLoop(startSec, endSec);
    setRepeatCount(0);
  }, [setLoop]);

  const handleToggle = useCallback(() => {
    if (isEnabled) {
      clearLoop();
      setIsEnabled(false);
    } else {
      const start = timeToSeconds(startInput);
      const end = timeToSeconds(endInput);
      if (start !== null && end !== null && end > start) {
        applyLoop(start, end);
        setIsEnabled(true);
      }
    }
  }, [isEnabled, startInput, endInput, clearLoop, applyLoop]);

  const handleSetStart = useCallback(() => {
    const sec = Math.floor(currentTime);
    setStartInput(secondsToTime(sec));
    if (isEnabled) {
      const end = timeToSeconds(endInput);
      if (end !== null && end > sec) {
        applyLoop(sec, end);
      }
    }
  }, [currentTime, isEnabled, endInput, applyLoop]);

  const handleSetEnd = useCallback(() => {
    const sec = Math.floor(currentTime);
    setEndInput(secondsToTime(sec));
    if (isEnabled) {
      const start = timeToSeconds(startInput);
      if (start !== null && sec > start) {
        applyLoop(start, sec);
      }
    }
  }, [currentTime, isEnabled, startInput, applyLoop]);

  const handleStartBlur = useCallback(() => {
    if (!isEnabled) return;
    const start = timeToSeconds(startInput);
    const end = timeToSeconds(endInput);
    if (start !== null && end !== null && end > start) {
      applyLoop(start, end);
    }
  }, [isEnabled, startInput, endInput, applyLoop]);

  const handleEndBlur = useCallback(() => {
    if (!isEnabled) return;
    const start = timeToSeconds(startInput);
    const end = timeToSeconds(endInput);
    if (start !== null && end !== null && end > start) {
      applyLoop(start, end);
    }
  }, [isEnabled, startInput, endInput, applyLoop]);

  const handleClear = useCallback(() => {
    clearLoop();
    setIsEnabled(false);
    setStartInput('0:00');
    setEndInput('0:00');
    setRepeatCount(0);
  }, [clearLoop]);

  return (
    <div className={`bg-[var(--bg2)] border border-[var(--border)] rounded-xl px-5 py-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[var(--text)]">구간 반복</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text2)]">{isEnabled ? 'ON' : 'OFF'}</span>
          <button
            className={`relative w-9 h-5 rounded-[10px] border-none cursor-pointer transition-colors p-0 ${isEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--surface2)]'}`}
            onClick={handleToggle}
            aria-label="구간 반복 토글"
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${isEnabled ? 'translate-x-4' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button className="px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text2)] text-xs cursor-pointer transition-all whitespace-nowrap hover:bg-[var(--surface2)] hover:text-[var(--text)]" onClick={handleSetStart}>
          시작점
        </button>
        <input
          className="w-16 px-2 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] text-xs text-center outline-none font-mono focus:border-[var(--accent)]"
          value={startInput}
          onChange={(e) => setStartInput(e.target.value)}
          onBlur={handleStartBlur}
          placeholder="0:00"
        />
        <span className="text-[var(--muted)] text-sm">~</span>
        <input
          className="w-16 px-2 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text)] text-xs text-center outline-none font-mono focus:border-[var(--accent)]"
          value={endInput}
          onChange={(e) => setEndInput(e.target.value)}
          onBlur={handleEndBlur}
          placeholder="0:00"
        />
        <button className="px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text2)] text-xs cursor-pointer transition-all whitespace-nowrap hover:bg-[var(--surface2)] hover:text-[var(--text)]" onClick={handleSetEnd}>
          끝점
        </button>
        <button className="px-2.5 py-1.5 bg-transparent border border-[var(--border)] rounded-md text-[var(--muted)] text-xs cursor-pointer transition-all hover:text-[var(--error)] hover:border-[var(--error)]" onClick={handleClear}>
          초기화
        </button>
      </div>

      {isEnabled && loopStart !== null && loopEnd !== null && (
        <div className="text-xs text-[var(--muted)] mt-2">
          구간: {secondsToTime(loopStart)} ~ {secondsToTime(loopEnd)} | 반복 횟수: {repeatCount}
        </div>
      )}
    </div>
  );
}
