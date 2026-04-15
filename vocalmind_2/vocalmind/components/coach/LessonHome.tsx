'use client';

import { useState, useCallback, useMemo } from 'react';
import { useCoachStore } from '@/stores/coachStore';
import { hlbCurriculum, blockNames } from '@/lib/data/hlbCurriculum';

export default function LessonHome() {
  const { progress, sessionHistory, setPhase } = useCoachStore();
  const [openBlocks, setOpenBlocks] = useState<Record<string, boolean>>({});

  const nextStageId = useCoachStore((s) => s.getNextStageId());

  const passedCount = useMemo(() => {
    return Object.values(progress).filter((p) => p.passedAt !== null).length;
  }, [progress]);

  const currentStage = hlbCurriculum.find((s) => s.id === nextStageId);

  const toggleBlock = useCallback((block: string) => {
    setOpenBlocks((prev) => ({ ...prev, [block]: !prev[block] }));
  }, []);

  const handleStartLesson = useCallback(() => {
    setPhase('condition');
  }, [setPhase]);

  const handleReviewStage = useCallback((stageId: number) => {
    const store = useCoachStore.getState();
    store.startLesson(stageId, 80);
    setPhase('condition');
  }, [setPhase]);

  const recentHistory = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const allAttempts: Array<{
      date: string;
      stageId: number;
      stageName: string;
      score: number;
      passed: boolean;
    }> = [];

    for (const session of sessionHistory) {
      for (const attempt of session.stagesAttempted) {
        const ts = new Date(attempt.attemptedAt).getTime();
        if (ts >= sevenDaysAgo) {
          const stage = hlbCurriculum.find((s) => s.id === attempt.stageId);
          allAttempts.push({
            date: attempt.attemptedAt,
            stageId: attempt.stageId,
            stageName: stage?.name ?? `Stage ${attempt.stageId}`,
            score: attempt.score,
            passed: attempt.passed,
          });
        }
      }
    }

    return allAttempts
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [sessionHistory]);

  const isFirstVisit = passedCount === 0 && sessionHistory.length === 0;

  return (
    <div className="animate-[slideIn_0.4s_ease-out]">
      {/* Hero section */}
      <div className="text-center px-5 py-10 max-[768px]:px-4 max-[768px]:py-7 bg-[var(--bg3)] border border-[var(--border2)] rounded-[var(--r)] mb-6">
        <h1 className="text-[var(--fs-h2)] font-bold text-[var(--text)] mb-2">AI 보컬 코치</h1>

        {currentStage && (
          <>
            <div className="text-[var(--fs-xs)] text-[var(--muted)] uppercase tracking-wider mb-1">
              Stage {nextStageId} / 50 - {currentStage.block}
            </div>
            <div className="text-[clamp(1.3rem,3vw,1.6rem)] font-extrabold text-[var(--accent-lt)] mb-4">
              {currentStage.name}
            </div>
          </>
        )}

        {/* Progress bar */}
        <div className="max-w-[400px] mx-auto mb-6">
          <div className="flex justify-between text-[var(--fs-xs)] text-[var(--muted)] mb-2">
            <span>진도율</span>
            <span>{passedCount} / 50</span>
          </div>
          <div className="h-1.5 bg-[var(--surface2)] rounded-[3px] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] rounded-[3px] transition-[width] duration-500 ease-out"
              style={{ width: `${(passedCount / 50) * 100}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          className="inline-block px-10 py-4 max-[768px]:w-full border-none rounded-[var(--r-xs)] bg-[var(--cta-bg)] text-[var(--cta-text)] text-[var(--fs-body)] font-bold cursor-pointer transition-all duration-200 hover:bg-[var(--cta-hover)] hover:-translate-y-0.5"
          onClick={handleStartLesson}
        >
          오늘의 레슨 시작
        </button>

        {isFirstVisit && (
          <div className="mt-4 px-4 py-3 bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.2)] rounded-[var(--r-xs)] text-[var(--fs-sm)] text-[var(--text2)] leading-normal">
            Stage 1부터 시작합니다. 편안한 소리부터 시작해볼까요?
          </div>
        )}
      </div>

      {/* Block list with collapsible stages */}
      <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-[var(--r)] overflow-hidden mb-6">
        <div className="px-5 py-4 text-[var(--fs-sm)] font-bold text-[var(--text)] border-b border-[var(--border)]">
          커리큘럼 진행 상황
        </div>
        {blockNames.map((block) => {
          const stages = hlbCurriculum.filter((s) => s.block === block);
          const passedInBlock = stages.filter(
            (s) => progress[s.id]?.passedAt
          ).length;
          const isOpen = openBlocks[block] ?? false;

          return (
            <div key={block} className="border-b border-[var(--border)] last:border-b-0">
              <button
                type="button"
                className="flex items-center justify-between px-5 py-3.5 bg-transparent border-none text-[var(--text)] text-[var(--fs-sm)] font-semibold cursor-pointer w-full text-left transition-colors duration-200 hover:bg-[var(--surface)]"
                onClick={() => toggleBlock(block)}
              >
                <div className="flex items-center gap-2">
                  <span>{block}</span>
                  <span className="font-mono text-[var(--fs-xs)] text-[var(--muted)]">
                    {passedInBlock}/{stages.length}
                  </span>
                </div>
                <span
                  className={`text-[var(--fs-xs)] text-[var(--muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                >
                  &#9660;
                </span>
              </button>

              {isOpen && (
                <div className="px-5 pb-3">
                  {stages.map((stage) => {
                    const stageProgress = progress[stage.id];
                    const isPassed = !!stageProgress?.passedAt;
                    return (
                      <div
                        key={stage.id}
                        className="flex items-center justify-between px-3 py-2 rounded-[var(--r-xs)] cursor-pointer transition-colors duration-200 hover:bg-[var(--surface)]"
                        onClick={() => isPassed ? handleReviewStage(stage.id) : undefined}
                        role={isPassed ? 'button' : undefined}
                        tabIndex={isPassed ? 0 : undefined}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center text-[10px] shrink-0 ${
                              isPassed
                                ? 'border-[var(--success)] bg-[rgba(34,197,94,0.15)] text-[var(--success)]'
                                : 'border-[var(--border2)]'
                            }`}
                          >
                            {isPassed ? '\u2713' : ''}
                          </div>
                          <span className="text-[var(--fs-sm)] text-[var(--text2)]">
                            {stage.id}. {stage.name}
                          </span>
                        </div>
                        {stageProgress && (
                          <span className="text-[var(--fs-xs)] text-[var(--muted)] font-mono">
                            {stageProgress.bestScore}점
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent history */}
      <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-[var(--r)] p-5">
        <div className="text-[var(--fs-sm)] font-bold text-[var(--text)] mb-3">최근 7일 연습 기록</div>
        {recentHistory.length === 0 ? (
          <div className="text-[var(--fs-sm)] text-[var(--muted)] text-center py-5">
            아직 연습 기록이 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentHistory.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2.5 bg-[var(--surface)] rounded-[var(--r-xs)] border border-[var(--border)]">
                <span className="text-[var(--fs-xs)] text-[var(--muted)] font-mono">
                  {new Date(item.date).toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className="text-[var(--fs-sm)] text-[var(--text2)]">{item.stageName}</span>
                <span className="text-[var(--fs-sm)] font-bold text-[var(--accent-lt)] font-mono">{item.score}점</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
