'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { WarmupRoutine } from '@/types';
import { useWarmupStore } from '@/stores/warmupStore';
import * as scheduler from '@/lib/audio/scheduler';
import { resumeAudioContext } from '@/lib/audio/audioEngine';
import { GlowCard } from '@/components/ui/glow-card';

interface ExercisePlayerProps {
  routine: WarmupRoutine;
  onComplete: (stagesCompleted: number[], elapsedSec: number) => void;
}

function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ExercisePlayer({ routine, onComplete }: ExercisePlayerProps) {
  const { currentStageIndex, setCurrentStage, completeStage } = useWarmupStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [currentBpm, setCurrentBpm] = useState(() => {
    const first = routine.stages[0];
    return first ? first.suggestedBpm : 80;
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedStagesRef = useRef<number[]>([]);

  const currentStage = routine.stages[currentStageIndex];
  const totalStages = routine.stages.length;
  const isLastStage = currentStageIndex >= totalStages - 1;
  const progress = totalStages > 0 ? ((currentStageIndex) / totalStages) * 100 : 0;

  useEffect(() => {
    if (isPlaying && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, isPaused]);

  useEffect(() => {
    scheduler.setBpm(currentBpm);
  }, [currentBpm]);

  useEffect(() => {
    if (currentStage) {
      setCurrentBpm(currentStage.suggestedBpm);
    }
  }, [currentStage]);

  const startStagePlayback = useCallback((stage: typeof currentStage) => {
    if (!stage || stage.pattern.length === 0) return;

    scheduler.stop();
    scheduler.setPattern(stage.pattern);
    scheduler.setBpm(currentBpm);
    scheduler.setRootNote(60);
    scheduler.setStartKey(48);
    scheduler.setEndKey(72);
    scheduler.setTransposeDirection(1);
    scheduler.setRepeatCount(stage.repetitions);
    scheduler.setSectionRange(null, null);
    scheduler.setCallbacks({
      onComplete: () => {},
    });
    scheduler.start();
  }, [currentBpm]);

  const handlePlay = useCallback(async () => {
    await resumeAudioContext();

    if (isPaused) {
      scheduler.resume();
      setIsPaused(false);
      return;
    }

    setIsPlaying(true);
    setIsPaused(false);
    if (currentStage) {
      startStagePlayback(currentStage);
    }
  }, [isPaused, currentStage, startStagePlayback]);

  const handlePause = useCallback(() => {
    scheduler.pause();
    setIsPaused(true);
  }, []);

  const handleSkip = useCallback(() => {
    scheduler.stop();

    if (currentStage) {
      completeStage(currentStage.stageId);
      if (!completedStagesRef.current.includes(currentStage.stageId)) {
        completedStagesRef.current.push(currentStage.stageId);
      }
    }

    if (isLastStage) {
      setIsPlaying(false);
      setIsPaused(false);
      onComplete(completedStagesRef.current, elapsedSec);
      return;
    }

    const nextIdx = currentStageIndex + 1;
    setCurrentStage(nextIdx);
    setIsPaused(false);

    const nextStage = routine.stages[nextIdx];
    if (nextStage && isPlaying) {
      setCurrentBpm(nextStage.suggestedBpm);
      setTimeout(() => {
        startStagePlayback(nextStage);
      }, 300);
    }
  }, [currentStage, currentStageIndex, isLastStage, isPlaying, routine.stages, elapsedSec, completeStage, setCurrentStage, onComplete, startStagePlayback]);

  const handleNext = useCallback(() => {
    handleSkip();
  }, [handleSkip]);

  useEffect(() => {
    return () => {
      scheduler.stop();
    };
  }, []);

  if (!currentStage) return null;

  return (
    <GlowCard className="max-w-[680px] mx-auto p-8 animate-[slideIn_0.4s_ease-out] max-sm:p-5">
      {/* 진행률 바 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-1 bg-[var(--surface2)] rounded-sm overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] rounded-sm transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs text-[var(--muted)] font-mono whitespace-nowrap">{currentStageIndex + 1}/{totalStages}</span>
      </div>

      {/* 현재 단계 정보 */}
      <div className="text-center px-5 py-8 mb-6 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
        <div className="text-xs text-[var(--muted)] uppercase tracking-widest mb-2">
          STAGE {currentStageIndex + 1}
        </div>
        <div className="text-2xl font-bold text-[var(--text)] mb-3">{currentStage.name}</div>
        <div className="text-[clamp(2rem,5vw,3.5rem)] font-extrabold text-[var(--accent-lt)] mb-3 tracking-wide max-sm:text-[2rem]">{currentStage.pronunciation}</div>
        <div className="text-sm text-[var(--text2)] leading-relaxed max-w-[400px] mx-auto">{currentStage.guideText}</div>
      </div>

      {/* 메타 정보 */}
      <div className="flex justify-center gap-5 mb-6 flex-wrap">
        <div className="flex flex-col items-center gap-1 px-[18px] py-2.5 bg-[var(--surface)] rounded-md border border-[var(--border)]">
          <span className="text-xs text-[var(--muted)]">반복</span>
          <span className="text-base font-bold text-[var(--text)] font-mono">{currentStage.repetitions}회</span>
        </div>
        <div className="flex flex-col items-center gap-1 px-[18px] py-2.5 bg-[var(--surface)] rounded-md border border-[var(--border)]">
          <span className="text-xs text-[var(--muted)]">예상 시간</span>
          <span className="text-base font-bold text-[var(--text)] font-mono">{currentStage.durationMin}분</span>
        </div>
        <div className="flex flex-col items-center gap-1 px-[18px] py-2.5 bg-[var(--surface)] rounded-md border border-[var(--border)]">
          <span className="text-xs text-[var(--muted)]">BPM 범위</span>
          <span className="text-base font-bold text-[var(--text)] font-mono">{currentStage.bpmRange[0]}-{currentStage.bpmRange[1]}</span>
        </div>
      </div>

      {/* BPM 슬라이더 */}
      <div className="flex items-center gap-3.5 px-5 py-3.5 bg-[var(--surface)] border border-[var(--border)] rounded-md mb-6">
        <span className="text-sm text-[var(--text2)] whitespace-nowrap">BPM</span>
        <input
          type="range"
          className="flex-1 h-1 appearance-none bg-[var(--surface3)] rounded-sm outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--bg3)]"
          min={currentStage.bpmRange[0]}
          max={currentStage.bpmRange[1]}
          value={currentBpm}
          onChange={(e) => setCurrentBpm(Number(e.target.value))}
        />
        <span className="text-sm font-bold text-[var(--accent-lt)] font-mono min-w-[60px] text-right">{currentBpm} BPM</span>
      </div>

      {/* 경과 시간 */}
      <div className="text-center mb-6">
        <div className="text-[clamp(1.5rem,3vw,2rem)] font-bold text-[var(--text)] font-mono">{formatTime(elapsedSec)}</div>
        <div className="text-xs text-[var(--muted)] mt-0.5">경과 시간</div>
      </div>

      {/* 컨트롤 */}
      <div className="flex justify-center gap-3 max-sm:flex-wrap">
        {isPlaying && !isPaused ? (
          <button type="button" className="px-6 py-3 rounded-md border border-[var(--border2)] bg-[var(--surface)] text-[var(--text2)] text-sm font-semibold cursor-pointer transition-all hover:bg-[var(--surface2)] hover:border-[var(--accent)] hover:text-[var(--text)] max-sm:flex-1 max-sm:min-w-[100px]" onClick={handlePause}>
            일시정지
          </button>
        ) : (
          <button type="button" className="px-8 py-3 rounded-md border-none bg-[var(--cta-bg)] text-[var(--cta-text)] text-base font-bold cursor-pointer transition-colors hover:bg-[var(--cta-hover)] max-sm:flex-1 max-sm:min-w-[100px]" onClick={handlePlay}>
            {isPaused ? '재개' : '재생'}
          </button>
        )}
        <button type="button" className="px-6 py-3 rounded-md border border-[var(--border2)] bg-[var(--surface)] text-[var(--text2)] text-sm font-semibold cursor-pointer transition-all hover:bg-[var(--surface2)] hover:border-[var(--accent)] hover:text-[var(--text)] max-sm:flex-1 max-sm:min-w-[100px]" onClick={handleSkip}>
          건너뛰기
        </button>
        <button
          type="button"
          className="px-6 py-3 rounded-md border border-[var(--accent)] bg-blue-500/10 text-[var(--accent-lt)] text-sm font-semibold cursor-pointer transition-all hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed max-sm:flex-1 max-sm:min-w-[100px]"
          onClick={handleNext}
        >
          {isLastStage ? '완료' : '다음 단계'}
        </button>
      </div>
    </GlowCard>
  );
}
