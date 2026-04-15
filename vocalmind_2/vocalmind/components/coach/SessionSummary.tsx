'use client';

import { useMemo, useCallback } from 'react';
import { useCoachStore } from '@/stores/coachStore';
import { getStageById } from '@/lib/data/hlbCurriculum';

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}초`;
  return `${m}분 ${s}초`;
}

export default function SessionSummary() {
  const {
    sessionStartTime,
    lastScore,
    currentPatternScores,
    currentStageId,
    condition,
    failStreak,
    progress,
    setPhase,
    resetSession,
    sessionHistory,
  } = useCoachStore();

  const summary = useMemo(() => {
    const now = Date.now();
    const elapsed = sessionStartTime ? now - sessionStartTime : 0;

    const latestSession = sessionHistory.length > 0
      ? sessionHistory[sessionHistory.length - 1]
      : null;

    const stagesAttempted = latestSession
      ? latestSession.stagesAttempted.length
      : 1;
    const stagesPassed = latestSession
      ? latestSession.stagesAttempted.filter((a) => a.passed).length
      : (lastScore >= 80 ? 1 : 0);
    const avgScore = latestSession && latestSession.stagesAttempted.length > 0
      ? Math.round(
          latestSession.stagesAttempted.reduce((s, a) => s + a.score, 0) /
            latestSession.stagesAttempted.length
        )
      : lastScore;

    return {
      duration: formatDuration(elapsed),
      stagesAttempted,
      stagesPassed,
      avgScore,
    };
  }, [sessionStartTime, lastScore, sessionHistory]);

  const currentStage = getStageById(currentStageId);

  const comment = useMemo(() => {
    if (summary.stagesPassed > 0) {
      return `오늘 ${summary.stagesPassed}개의 단계를 합격했어요! 꾸준한 연습이 실력을 만듭니다. 내일도 같은 시간에 연습해보세요.`;
    }
    if (failStreak >= 5) {
      return '오늘은 여기까지입니다. 충분히 노력했어요. 내일 다시 도전하면 분명 더 나은 결과가 있을 거예요.';
    }
    return '오늘 연습한 것만으로도 성장하고 있어요. 내일 다시 도전해보세요!';
  }, [summary.stagesPassed, failStreak]);

  const handleGoHome = useCallback(() => {
    const store = useCoachStore.getState();
    const session = {
      id: `session-${Date.now()}`,
      startedAt: store.sessionStartTime
        ? new Date(store.sessionStartTime).toISOString()
        : new Date().toISOString(),
      condition: store.condition ?? 'normal' as const,
      stagesAttempted: [{
        stageId: store.currentStageId,
        score: store.lastScore,
        bpm: store.currentBpm,
        condition: store.condition ?? 'normal' as const,
        attemptedAt: new Date().toISOString(),
        passed: store.lastScore >= 80,
      }],
      totalDurationSec: store.sessionStartTime
        ? Math.floor((Date.now() - store.sessionStartTime) / 1000)
        : 0,
    };

    useCoachStore.setState((s) => ({
      sessionHistory: [...s.sessionHistory, session],
    }));

    resetSession();
    setPhase('home');
  }, [resetSession, setPhase]);

  return (
    <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-[var(--r)] p-8 max-[768px]:px-5 max-[768px]:py-6 max-w-[600px] mx-auto text-center animate-[slideIn_0.4s_ease-out]">
      <h2 className="text-[var(--fs-h2)] font-bold text-[var(--text)] mb-2">오늘의 레슨 요약</h2>
      <p className="text-[var(--fs-sm)] text-[var(--text2)] mb-7">수고하셨습니다.</p>

      <div className="grid grid-cols-2 gap-3 max-[768px]:gap-2.5 mb-6">
        {[
          { value: summary.duration, label: '연습 시간' },
          { value: summary.stagesAttempted, label: '진행 단계' },
          { value: summary.stagesPassed, label: '합격 수' },
          { value: summary.avgScore, label: '평균 점수' },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-1 px-3 py-4 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-xs)]">
            <span className="text-[var(--fs-h3)] font-bold text-[var(--accent-lt)] font-mono">{stat.value}</span>
            <span className="text-[var(--fs-xs)] text-[var(--muted)]">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-sm)] p-5 mb-6 text-left">
        <div className="text-[var(--fs-sm)] text-[var(--text2)] leading-relaxed">{comment}</div>
      </div>

      <div className="flex flex-col gap-2.5 max-w-[320px] mx-auto">
        <button
          type="button"
          className="px-6 py-3.5 border-none rounded-[var(--r-xs)] bg-[var(--cta-bg)] text-[var(--cta-text)] text-[var(--fs-body)] font-bold cursor-pointer transition-colors duration-200 hover:bg-[var(--cta-hover)]"
          onClick={handleGoHome}
        >
          레슨 홈으로
        </button>
      </div>
    </div>
  );
}
