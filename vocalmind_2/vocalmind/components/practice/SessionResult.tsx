'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import { getSessions } from '@/lib/storage/songDB';
import type { SessionScore } from '@/types';
import PitchTimeline from './PitchTimeline';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getScoreGrade(score: number): { label: string; className: string } {
  if (score >= 90) return { label: 'S', className: "text-[var(--streak-gold)]" };
  if (score >= 80) return { label: 'A', className: "text-[var(--success)]" };
  if (score >= 70) return { label: 'B', className: "text-[var(--accent-lt)]" };
  if (score >= 60) return { label: 'C', className: "text-[var(--warning)]" };
  return { label: 'D', className: "text-[var(--error-lt)]" };
}

export default function SessionResult() {
  const { currentSession, showResult, setShowResult, setMode, currentAnalysis } = usePracticeStore();
  const [previousBest, setPreviousBest] = useState<SessionScore | null>(null);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [showTimeline, setShowTimeline] = useState(false);
  const animRef = useRef<number>(0);

  // Load previous best
  useEffect(() => {
    if (!currentSession) return;

    async function loadPrevious() {
      if (!currentSession) return;
      try {
        const sessions = await getSessions(currentSession.songId);
        // Find best session excluding current
        const others = sessions.filter((s) => s.id !== currentSession.id);
        if (others.length > 0) {
          const best = others.reduce((a, b) => (a.overallScore > b.overallScore ? a : b));
          setPreviousBest(best);
        } else {
          setPreviousBest(null);
        }
      } catch {
        setPreviousBest(null);
      }
    }

    loadPrevious();
  }, [currentSession]);

  // Animate score counter
  useEffect(() => {
    if (!showResult || !currentSession) {
      setAnimatedScore(0);
      return;
    }

    const target = currentSession.overallScore;
    const startTime = performance.now();
    const animDuration = 1200;

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / animDuration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(target * eased));

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    }

    // Small delay before starting animation
    const timer = setTimeout(() => {
      animRef.current = requestAnimationFrame(animate);
    }, 300);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(animRef.current);
    };
  }, [showResult, currentSession]);

  const handleClose = useCallback(() => {
    setShowResult(false);
  }, [setShowResult]);

  const handleRetry = useCallback(() => {
    setShowResult(false);
    // Stay in play mode, user can click start again
  }, [setShowResult]);

  const handlePractice = useCallback(() => {
    setShowResult(false);
    setMode('practice');
  }, [setShowResult, setMode]);

  if (!showResult || !currentSession) return null;

  const grade = getScoreGrade(currentSession.overallScore);
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference * (1 - animatedScore / 100);

  const scoreDiff = previousBest
    ? currentSession.overallScore - previousBest.overallScore
    : null;

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[300] backdrop-blur-sm" onClick={handleClose}>
      <div className="bg-[var(--bg2)] border border-[var(--border2)] rounded-xl px-8 py-9 max-w-[440px] w-[92%] relative animate-[resultSlideIn_0.4s_cubic-bezier(0.16,1,0.3,1)]" onClick={(e) => e.stopPropagation()}>
        <button className="absolute top-4 right-4 bg-transparent border-none text-[var(--muted)] text-lg cursor-pointer p-1 transition-colors hover:text-[var(--text)]" onClick={handleClose} aria-label="닫기">
          &#10005;
        </button>

        <div className="text-sm font-semibold text-[var(--text)]">연주 결과</div>

        {/* Score gauge */}
        <div className="flex justify-center mb-7">
          <div className="relative w-[140px] h-[140px]">
            <svg viewBox="0 0 120 120" className="w-full h-full">
              <circle
                cx="60" cy="60" r="54"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="8"
              />
              <circle
                cx="60" cy="60" r="54"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 60 60)"
                className="transition-[stroke-dashoffset] duration-[800ms] cubic-bezier(0.16,1,0.3,1)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[2.5rem] font-extrabold text-[var(--text)] font-[Inter,monospace] leading-none">{animatedScore}</div>
              <div className={`${"text-sm font-bold mt-1"} ${grade.className}`}>{grade.label}</div>
            </div>
          </div>
        </div>

        {/* Category scores */}
        <div className="flex flex-col gap-3.5 mb-5">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text2)] min-w-[80px] font-medium">음정 정확도</span>
            <div className="flex-1 h-1.5 bg-[var(--surface2)] rounded-sm overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] rounded-sm transition-[width] duration-1000 ease-out delay-500"
                style={{ width: `${currentSession.overallScore}%` }}
              />
            </div>
            <span className="text-xs text-[var(--text)] font-semibold min-w-[28px] text-right font-[Inter,monospace]">{currentSession.overallScore}</span>
          </div>
        </div>

        {/* Comparison with previous */}
        {previousBest && scoreDiff !== null && (
          <div className="flex items-center justify-center gap-2 p-2.5 bg-[var(--surface)] rounded-md mb-4">
            <span className="text-xs text-[var(--text2)]">이전 최고 기록 대비</span>
            <span className={`${"text-sm font-bold font-[Inter,monospace]"} ${
              scoreDiff > 0 ? "text-[var(--success)]" : scoreDiff < 0 ? "text-[var(--error-lt)]" : "text-[var(--muted)]"
            }`}>
              {scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff === 0 ? '동일' : `${scoreDiff}`}
            </span>
            <span className="text-xs text-[var(--muted)]">
              (이전: {previousBest.overallScore}점)
            </span>
          </div>
        )}

        {/* Song + duration info */}
        <div className="flex justify-center gap-4 text-xs text-[var(--muted)] mb-6">
          <span>소요 시간: {formatDuration(currentSession.duration)}</span>
          {currentSession.keyShift !== 0 && (
            <span>
              키: {currentSession.keyShift > 0 ? '+' : ''}{currentSession.keyShift}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2.5">
          <button className="flex-1 py-3 bg-[var(--accent)] text-white border-none rounded-md text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90" onClick={handleRetry}>
            다시 부르기
          </button>
          <button className="flex-1 py-3 bg-transparent text-[var(--text2)] border border-[var(--border2)] rounded-md text-sm font-semibold cursor-pointer transition-all hover:bg-[var(--surface2)] hover:text-[var(--text)]" onClick={handlePractice}>
            연습하기
          </button>
        </div>

        {/* Detail analysis toggle */}
        <button
          className="block w-full mt-3 py-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--accent-lt)] text-xs font-semibold cursor-pointer transition-all text-center hover:bg-[var(--surface2)] hover:text-[var(--accent)]"
          onClick={() => setShowTimeline((prev) => !prev)}
        >
          {showTimeline ? '상세 분석 닫기' : '상세 분석 보기'}
        </button>

        {/* PitchTimeline */}
        {showTimeline && currentSession && (
          <div className="mt-4">
            <PitchTimeline session={currentSession} analysis={currentAnalysis} />
          </div>
        )}
      </div>
    </div>
  );
}
