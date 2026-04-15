'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCoachStore } from '@/stores/coachStore';
import { getStageById } from '@/lib/data/hlbCurriculum';
import { getKeyRange } from '@/lib/coach/progressManager';
import { gradeLesson } from '@/lib/coach/pitchGrader';
import * as lessonEngine from '@/lib/coach/lessonEngine';
import ScaleDisplay from './ScaleDisplay';
import PitchMonitor from './PitchMonitor';

type LessonState = 'guide' | 'countdown' | 'playing' | 'timer';

export default function LessonPlayer() {
  const {
    currentStageId,
    currentBpm,
    condition,
    isPlaying,
    setPhase,
    setIsPlaying,
    completeLesson,
    currentPatternScores,
  } = useCoachStore();

  const [lessonState, setLessonState] = useState<LessonState>('guide');
  const [countdownValue, setCountdownValue] = useState(3);
  const [timerSeconds, setTimerSeconds] = useState(10);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stage = getStageById(currentStageId);
  const isNonVocal = stage ? stage.pattern.length === 0 : false;

  const guideText = stage
    ? stage.scaleType === '비발성'
      ? stage.name.includes('바람')
        ? '바람만 부는 연습입니다. 소리 내지 마세요.\n주먹을 쥐고 천천히 바람을 불어보세요.'
        : '소리 없이 호흡만 연습합니다.'
      : `"${stage.pronunciation}"을(를) ${stage.scaleType} 패턴으로 발성하세요.\n피아노 소리에 맞춰 정확한 음정을 유지합니다.`
    : '';

  useEffect(() => {
    return () => {
      lessonEngine.stopLesson();
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleReady = useCallback(() => {
    setLessonState('countdown');
    setCountdownValue(3);

    countdownRef.current = setInterval(() => {
      setCountdownValue((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;

          if (isNonVocal) {
            setLessonState('timer');
            setTimerSeconds(10);
            setIsPlaying(true);

            timerRef.current = setInterval(() => {
              setTimerSeconds((s) => {
                if (s <= 1) {
                  if (timerRef.current) clearInterval(timerRef.current);
                  timerRef.current = null;
                  completeLesson(100);
                  setPhase('judgment');
                  return 0;
                }
                return s - 1;
              });
            }, 1000);
          } else {
            setLessonState('playing');
            const keyRangeSemitones = getKeyRange(condition ?? 'normal');
            const startKey = 48;

            lessonEngine.startLesson(
              currentStageId,
              currentBpm,
              startKey,
              keyRangeSemitones,
              {
                onNotePlay: () => {},
                onKeyChange: () => {},
                onPatternComplete: (patternScore) => {
                  useCoachStore.getState().completePattern(
                    patternScore.rootNote,
                    patternScore.noteScores
                  );
                },
                onLessonComplete: (score) => {
                  useCoachStore.getState().completeLesson(score);
                  useCoachStore.getState().setPhase('judgment');
                },
              }
            );
          }

          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [isNonVocal, currentStageId, currentBpm, condition, setIsPlaying, completeLesson, setPhase]);

  const handlePause = useCallback(() => {
    lessonEngine.stopLesson();
    setIsPlaying(false);
    const scores = lessonEngine.getCurrentPatternScores();
    const score = scores.length > 0 ? gradeLesson(scores) : 0;
    completeLesson(score);
    setPhase('judgment');
  }, [setIsPlaying, completeLesson, setPhase]);

  const handleStop = useCallback(() => {
    lessonEngine.stopLesson();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
    const scores = lessonEngine.getCurrentPatternScores();
    const score = scores.length > 0 ? gradeLesson(scores) : 0;
    completeLesson(score);
    setPhase('judgment');
  }, [setIsPlaying, completeLesson, setPhase]);

  if (!stage) return null;

  return (
    <div className="max-w-[680px] mx-auto animate-[slideIn_0.4s_ease-out]">
      {/* Stage header */}
      <div className="text-center px-5 py-6 max-[768px]:px-4 max-[768px]:py-5 bg-[var(--bg3)] border border-[var(--border2)] rounded-[var(--r)] mb-4">
        <div className="text-[var(--fs-xs)] text-[var(--muted)] uppercase tracking-wider mb-1">
          {stage.block} / Stage {currentStageId}
        </div>
        <h2 className="text-[var(--fs-h2)] font-bold text-[var(--text)] mb-2">{stage.name}</h2>
        <div className="text-[clamp(1.5rem,4vw,2.5rem)] font-extrabold text-[var(--accent-lt)] tracking-wider mb-2">
          {stage.pronunciation}
        </div>
        <span className="inline-block px-3 py-1 bg-[var(--surface2)] rounded-xl text-[var(--fs-xs)] text-[var(--muted)] font-mono">
          {currentBpm} BPM
        </span>
      </div>

      {/* Guide text (pre-start) */}
      {lessonState === 'guide' && (
        <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-[var(--r)] p-6 max-[768px]:px-4 max-[768px]:py-5 text-center mb-4">
          <div className="text-[var(--fs-sm)] text-[var(--text2)] leading-relaxed mb-5 whitespace-pre-line">{guideText}</div>
          <button
            type="button"
            className="inline-block px-10 py-3.5 border-none rounded-[var(--r-xs)] bg-[var(--cta-bg)] text-[var(--cta-text)] text-[var(--fs-body)] font-bold cursor-pointer transition-colors duration-200 hover:bg-[var(--cta-hover)]"
            onClick={handleReady}
          >
            준비됐어요
          </button>
        </div>
      )}

      {/* Countdown */}
      {lessonState === 'countdown' && countdownValue > 0 && (
        <div className="flex items-center justify-center px-5 py-12 bg-[var(--bg3)] border border-[var(--border2)] rounded-[var(--r)] mb-4">
          <div className="text-[clamp(4rem,10vw,6rem)] font-extrabold text-[var(--accent-lt)] font-mono animate-[countPulse_1s_ease-in-out_infinite]">
            {countdownValue}
          </div>
        </div>
      )}

      {/* Playing: vocal stage */}
      {lessonState === 'playing' && (
        <div className="flex flex-col gap-4 mb-4">
          <ScaleDisplay />
          <PitchMonitor />
          <div className="flex justify-center gap-3 max-[768px]:flex-wrap">
            <button
              type="button"
              className="px-6 py-3 max-[768px]:flex-1 max-[768px]:min-w-[120px] rounded-[var(--r-xs)] border border-[var(--border2)] bg-[var(--surface)] text-[var(--text2)] text-[var(--fs-sm)] font-semibold cursor-pointer transition-all duration-200 hover:bg-[var(--surface2)] hover:border-[var(--accent)] hover:text-[var(--text)]"
              onClick={handlePause}
            >
              일시정지
            </button>
            <button
              type="button"
              className="px-6 py-3 max-[768px]:flex-1 max-[768px]:min-w-[120px] rounded-[var(--r-xs)] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] text-[var(--error-lt)] text-[var(--fs-sm)] font-semibold cursor-pointer transition-all duration-200 hover:bg-[rgba(239,68,68,0.15)] hover:border-[var(--error)]"
              onClick={handleStop}
            >
              중단
            </button>
          </div>
        </div>
      )}

      {/* Timer mode: non-vocal stage */}
      {lessonState === 'timer' && (
        <div className="flex flex-col gap-4 mb-4">
          <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-[var(--r)] px-5 py-8 text-center">
            <div className="text-[var(--fs-sm)] text-[var(--text2)] leading-relaxed mb-5">{guideText}</div>
            <div className="text-[clamp(2rem,6vw,3.5rem)] font-extrabold text-[var(--accent-lt)] font-mono mb-2">
              {timerSeconds}
            </div>
            <div className="text-[var(--fs-xs)] text-[var(--muted)]">초 남음</div>
          </div>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              className="px-6 py-3 rounded-[var(--r-xs)] border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.08)] text-[var(--error-lt)] text-[var(--fs-sm)] font-semibold cursor-pointer transition-all duration-200 hover:bg-[rgba(239,68,68,0.15)] hover:border-[var(--error)]"
              onClick={handleStop}
            >
              중단
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
