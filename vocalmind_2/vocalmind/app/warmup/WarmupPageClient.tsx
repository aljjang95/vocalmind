'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useWarmupStore } from '@/stores/warmupStore';
import { WarmupRoutine } from '@/types';
import ConditionForm from '@/components/warmup/ConditionForm';
import RoutineView from '@/components/warmup/RoutineView';
import ExercisePlayer from '@/components/warmup/ExercisePlayer';
import RoutineHistory from '@/components/warmup/RoutineHistory';

type Phase = 'input' | 'confirm' | 'exercise' | 'complete';

interface CompletionData {
  stagesCompleted: number[];
  elapsedSec: number;
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}초`;
  return `${m}분 ${s}초`;
}

export default function WarmupPageClient() {
  const { routine, addRecord, resetRoutine, setCurrentStage } = useWarmupStore();
  const [phase, setPhase] = useState<Phase>('input');
  const [completionData, setCompletionData] = useState<CompletionData | null>(null);

  const handleRoutineGenerated = useCallback((_routine: WarmupRoutine) => {
    setPhase('confirm');
  }, []);

  const handleStart = useCallback(() => {
    setCurrentStage(0);
    setPhase('exercise');
  }, [setCurrentStage]);

  const handleRegenerate = useCallback(() => {
    resetRoutine();
    setPhase('input');
  }, [resetRoutine]);

  const handleComplete = useCallback((stagesCompleted: number[], elapsedSec: number) => {
    if (routine) {
      addRecord({
        routineId: routine.id,
        completedAt: new Date().toISOString(),
        stagesCompleted,
      });
    }
    setCompletionData({ stagesCompleted, elapsedSec });
    setPhase('complete');
  }, [routine, addRecord]);

  const handleNewRoutine = useCallback(() => {
    resetRoutine();
    setCompletionData(null);
    setPhase('input');
  }, [resetRoutine]);

  return (
    <>
      <div className="gradient-bg" aria-hidden="true" />
      <header className="sticky top-0 z-[100] py-4 bg-[var(--glass-bg)] backdrop-blur-[24px] backdrop-saturate-[180%] border-b border-[var(--border)]">
        <div className="container">
          <div className="flex items-center justify-between max-w-[1400px] mx-auto px-5">
            <Link href="/" className="font-[Inter] text-[1.1rem] font-bold text-[var(--text)] no-underline transition-colors hover:text-[var(--accent)]">
              &larr; HLB 보컬스튜디오
            </Link>
            <nav className="flex items-center gap-2">
              <Link href="/coach" className="px-[18px] py-2 text-[var(--text2)] no-underline text-[0.88rem] rounded-lg transition-all hover:text-[var(--text)] hover:bg-[var(--surface2)]">AI 코치</Link>
              <Link href="/diagnosis" className="px-[18px] py-2 text-[var(--text2)] no-underline text-[0.88rem] rounded-lg transition-all hover:text-[var(--text)] hover:bg-[var(--surface2)]">진단</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="relative z-[1] py-8 pb-[60px]">
        <div className="max-w-[800px] mx-auto px-5 flex flex-col gap-8">
          {phase === 'input' && (
            <ConditionForm onRoutineGenerated={handleRoutineGenerated} />
          )}

          {phase === 'confirm' && routine && (
            <RoutineView
              routine={routine}
              onStart={handleStart}
              onRegenerate={handleRegenerate}
            />
          )}

          {phase === 'exercise' && routine && (
            <ExercisePlayer
              routine={routine}
              onComplete={handleComplete}
            />
          )}

          {phase === 'complete' && completionData && (
            <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-xl px-8 py-12 max-w-[600px] mx-auto text-center animate-[slideIn_0.4s_ease-out] max-sm:px-5 max-sm:py-8">
              <div className="text-[3rem] mb-4" aria-hidden="true">&#10004;</div>
              <h2 className="text-2xl font-bold text-[var(--text)] mb-2">워밍업 완료</h2>
              <p className="text-sm text-[var(--text2)] mb-6">오늘도 수고하셨습니다. 꾸준한 연습이 실력을 만듭니다.</p>

              <div className="flex justify-center gap-6 mb-8 max-sm:flex-col max-sm:gap-2.5">
                <div className="flex flex-col items-center gap-1 px-5 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-md">
                  <span className="text-lg font-bold text-[var(--accent-lt)] font-mono">{formatElapsed(completionData.elapsedSec)}</span>
                  <span className="text-xs text-[var(--muted)]">소요 시간</span>
                </div>
                <div className="flex flex-col items-center gap-1 px-5 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-md">
                  <span className="text-lg font-bold text-[var(--accent-lt)] font-mono">{completionData.stagesCompleted.length}단계</span>
                  <span className="text-xs text-[var(--muted)]">완료</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 max-w-[320px] mx-auto">
                <Link href="/practice" className="block px-6 py-3.5 rounded-md bg-[var(--cta-bg)] text-[var(--cta-text)] text-base font-bold no-underline text-center transition-colors hover:bg-[var(--cta-hover)]">
                  곡 연습하러 가기
                </Link>
                <Link href="/coach" className="block px-6 py-3 rounded-md border border-[var(--border2)] text-[var(--text2)] text-sm font-semibold no-underline text-center transition-all hover:bg-[var(--surface2)] hover:border-[var(--accent)] hover:text-[var(--text)]">
                  AI 코치 받으러 가기
                </Link>
                <button
                  type="button"
                  className="block mt-1 px-6 py-3 rounded-md border border-[var(--border2)] bg-transparent text-[var(--text2)] text-sm font-semibold cursor-pointer transition-all w-full hover:bg-[var(--surface2)] hover:border-[var(--accent)] hover:text-[var(--text)]"
                  onClick={handleNewRoutine}
                >
                  새 루틴 생성하기
                </button>
              </div>
            </div>
          )}

          <RoutineHistory />
        </div>
      </main>
    </>
  );
}
