'use client';

import type { RhythmSessionScore } from '@/types';

interface RhythmScoreDisplayProps {
  session: RhythmSessionScore;
  onJumpTo?: (sectionIndex: number) => void;
}

function gradeColor(score: number): string {
  if (score >= 90) return 'text-[var(--streak-gold)]';
  if (score >= 80) return 'text-[var(--success)]';
  if (score >= 70) return 'text-[var(--accent-lt)]';
  if (score >= 60) return 'text-[var(--warning)]';
  return 'text-[var(--error-lt)]';
}

/**
 * 리듬 세션 결과 표시 — 종합 점수 + 구간별 점수 + 문제 구간 하이라이트.
 * onJumpTo가 주어지면 구간반복 버튼 노출.
 */
export default function RhythmScoreDisplay({ session, onJumpTo }: RhythmScoreDisplayProps) {
  const coveragePct = Math.round(session.coverageRatio * 100);

  return (
    <div className="flex flex-col gap-4 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
      {/* 헤더: 종합 점수 */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs text-[var(--muted)] mb-1">리듬 정확도</div>
          <div className={`text-3xl font-extrabold font-[Inter,monospace] ${gradeColor(session.rhythmScore)}`}>
            {session.rhythmScore}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-[var(--muted)]">매칭률</div>
          <div className="text-sm font-semibold text-[var(--text2)]">{coveragePct}%</div>
        </div>
      </div>

      {/* 구간별 막대 */}
      {session.sectionScores.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-[var(--text2)] font-medium">구간별 점수</div>
          {session.sectionScores.map((s) => (
            <div key={s.sectionIndex} className="flex items-center gap-2">
              <span className="text-xs text-[var(--muted)] min-w-[60px] truncate">{s.label}</span>
              <div className="flex-1 h-1.5 bg-[var(--surface2)] rounded-sm overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-sm"
                  style={{ width: `${s.score}%` }}
                />
              </div>
              <span className="text-xs text-[var(--text)] font-semibold min-w-[28px] text-right font-[Inter,monospace]">
                {s.score}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 문제 구간 */}
      {session.problemSegments.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border)]">
          <div className="text-xs text-[var(--warning)] font-semibold">박자 문제 구간</div>
          {session.problemSegments.map((s) => (
            <div
              key={s.sectionIndex}
              className="flex items-center justify-between p-2 rounded-md bg-[var(--surface2)]"
            >
              <div>
                <div className="text-xs text-[var(--text)] font-medium">{s.label}</div>
                <div className="text-[10px] text-[var(--muted)]">{s.eventCount}개 이벤트 · {s.score}점</div>
              </div>
              {onJumpTo && (
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 bg-[var(--accent)] text-white rounded-md font-medium hover:opacity-90 transition-opacity"
                  onClick={() => onJumpTo(s.sectionIndex)}
                >
                  구간반복
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {session.problemSegments.length === 0 && session.rhythmScore >= 80 && (
        <div className="text-xs text-[var(--success)] font-medium text-center py-2">
          박자가 전반적으로 안정적입니다.
        </div>
      )}
    </div>
  );
}
